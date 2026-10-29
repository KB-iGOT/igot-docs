# Explore Content — Low-Level Design (LLD)

## iGOT Karmayogi: Course Catalog, Learner Portal, Mobile App, UI/UX Revamp & Explore by Theme

### 2. Module & Package Breakdown

```text
igot-learner-services/
├── content-search-service/
│   ├── controllers/
│   │   ├── CatalogSearchController.java       <-- POST /api/content/v1/search
│   │   └── ThematicSearchController.java      <-- POST /api/content/v1/thematic/search
│   ├── service/
│   │   ├── CatalogSearchServiceImpl.java
│   │   └── ElasticsearchQueryBuilder.java     <-- Compiles multi-facet & RBAC filters
│   └── models/
│       ├── dto/CatalogSearchRequestDTO.java
│       └── dto/CatalogSearchResponseDTO.java
├── form-config-service/
│   ├── controllers/
│   │   └── ThematicConfigController.java      <-- GET /api/form/v1/read, POST /api/form/v1/thematic/mapping
│   ├── service/
│   │   └── CadreMappingResolver.java          <-- Evaluates User Org + Designation -> Cadre Group
│   └── cache/
│       └── RedisCadreCacheManager.java        <-- Resolves L0/State cache invalidation (KB-15120)
├── learner-track-service/
│   ├── controllers/
│   │   └── ContinueLearningController.java    <-- GET /api/user/v1/continue-learning
│   └── service/
│       └── UserProgressAggregator.java        <-- Evaluates last consumed leaf unit
└── telemetry-pipeline/
    ├── interceptor/
    │   └── TelemetryDispatchInterceptor.java  <-- Dispatches INTERACTION events to Kafka
    └── models/
        └── TelemetryEnvelope.java
```

### 3. Detailed Class & Interface Specifications

#### 3.1 `ElasticsearchQueryBuilder`

Translates incoming faceted catalog search and theme discovery parameters into structured Elasticsearch 7.x/8.x boolean queries while enforcing multi-tenant visibility boundaries.

```java
package org.sunbird.learner.search.service;

import org.elasticsearch.index.query.BoolQueryBuilder;
import org.elasticsearch.index.query.QueryBuilders;
import org.elasticsearch.search.aggregations.AggregationBuilders;
import org.elasticsearch.search.builder.SearchSourceBuilder;
import org.elasticsearch.search.sort.SortOrder;
import org.sunbird.learner.search.models.dto.CatalogSearchRequestDTO;

public class ElasticsearchQueryBuilder {

    public SearchSourceBuilder buildCatalogQuery(CatalogSearchRequestDTO request, String userOrgId) {
        SearchSourceBuilder sourceBuilder = new SearchSourceBuilder();
        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();

        // 1. Mandatory System Boundaries (Status & Access Isolation)
        boolQuery.must(QueryBuilders.termQuery("status.keyword", "Live"));

        BoolQueryBuilder visibilityClause = QueryBuilders.boolQuery();
        visibilityClause.should(QueryBuilders.termQuery("visibility.keyword", "Default"));
        visibilityClause.should(QueryBuilders.boolQuery()
            .must(QueryBuilders.termQuery("visibility.keyword", "Private"))
            .must(QueryBuilders.termQuery("createdFor.keyword", userOrgId)));
        visibilityClause.minimumShouldMatch(1);
        boolQuery.must(visibilityClause);

        // 2. Multi-Facet Filtering
        if (request.getFilters() != null) {
            var f = request.getFilters();

            // Primary Categories (Course, Program, Assessment, Case Study)
            if (f.getPrimaryCategory() != null && !f.getPrimaryCategory().isEmpty()) {
                boolQuery.must(QueryBuilders.termsQuery("primaryCategory.keyword", f.getPrimaryCategory()));
            }

            // Governance Sectors (8 Sectors)
            if (f.getSector() != null && !f.getSector().isEmpty()) {
                boolQuery.must(QueryBuilders.termsQuery("sector.keyword", f.getSector()));
            }

            // Duration Bucket Filter
            if (f.getDuration() != null) {
                var range = QueryBuilders.rangeQuery("duration");
                if (f.getDuration().getMin() != null) range.gte(f.getDuration().getMin());
                if (f.getDuration().getMax() != null) range.lte(f.getDuration().getMax());
                boolQuery.must(range);
            }

            // Rating Threshold Filter
            if (f.getAverageRating() != null && f.getAverageRating().getGte() != null) {
                boolQuery.must(QueryBuilders.rangeQuery("averageRating").gte(f.getAverageRating().getGte()));
            }

            // Language Filter
            if (f.getLanguage() != null && !f.getLanguage().isEmpty()) {
                boolQuery.must(QueryBuilders.termsQuery("language.keyword", f.getLanguage()));
            }

            // Competency v6 (KCM Nested Object Filtering)
            if (f.getCompetencyAreaId() != null) {
                boolQuery.must(QueryBuilders.nestedQuery(
                    "competencies_v6",
                    QueryBuilders.termQuery("competencies_v6.competencyAreaId.keyword", f.getCompetencyAreaId()),
                    org.apache.lucene.search.join.ScoreMode.None
                ));
            }
        }

        // 3. Deterministic Sorting
        if (request.getSortBy() != null) {
            if ("averageRating".equalsIgnoreCase(request.getSortBy())) {
                sourceBuilder.sort("averageRating", SortOrder.DESC);
                sourceBuilder.sort("totalRatingsCount", SortOrder.DESC);
            } else {
                // Default: Recently Added
                sourceBuilder.sort("lastPublishedOn", SortOrder.DESC);
                sourceBuilder.sort("createdOn", SortOrder.DESC);
            }
        }

        // 4. Aggregations (Facets)
        sourceBuilder.aggregation(AggregationBuilders.terms("sector_agg").field("sector.keyword").size(20));
        sourceBuilder.aggregation(AggregationBuilders.terms("language_agg").field("language.keyword").size(20));
        sourceBuilder.aggregation(AggregationBuilders.terms("category_agg").field("primaryCategory.keyword").size(10));

        sourceBuilder.query(boolQuery);
        sourceBuilder.from(request.getOffset());
        sourceBuilder.size(request.getLimit());
        return sourceBuilder;
    }
}
```

#### 3.2 `CadreMappingResolver`

Resolves user eligibility for the **Explore by Theme** section and identifies their Cadre Group, mitigating Form-Config evaluation failures ([KB-15120: Form-Config Service - Cache Enhancements](https://karmayogibharat.atlassian.net/browse/KB-15120) (Prod Deployed), [KB-15334: BE | Explore by theme is missing for L0 Org's State User](https://karmayogibharat.atlassian.net/browse/KB-15334) (Open)).

```java
package org.sunbird.learner.config.service;

import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import java.util.Optional;
import java.time.Duration;

@Service
public class CadreMappingResolver {

    private final ThematicMappingRepository repository;
    private final RedisTemplate<String, String> redisTemplate;
    private static final String CACHE_PREFIX = "thematic:cadre:";

    public CadreMappingResolver(ThematicMappingRepository repository, RedisTemplate<String, String> redisTemplate) {
        this.repository = repository;
        this.redisTemplate = redisTemplate;
    }

    public CadreResolutionResult resolveCadre(String orgId, String designation) {
        String cacheKey = CACHE_PREFIX + orgId + ":" + designation.trim().toLowerCase();

        // 1. Check L2 Redis Cache
        String cachedCadre = redisTemplate.opsForValue().get(cacheKey);
        if (cachedCadre != null) {
            if ("NONE".equals(cachedCadre)) {
                return CadreResolutionResult.ineligible();
            }
            return CadreResolutionResult.eligible(cachedCadre);
        }

        // 2. Query PostgreSQL Master
        Optional<ThematicMappingEntity> mapping =
            repository.findByOrganizationIdAndDesignationNameIgnoreCaseAndIsActiveTrue(orgId, designation);

        if (mapping.isPresent()) {
            String cadreGroup = mapping.get().getCadreGroup();
            redisTemplate.opsForValue().set(cacheKey, cadreGroup, Duration.ofHours(24));
            return CadreResolutionResult.eligible(cadreGroup);
        } else {
            // Negative caching to prevent DB hammering
            redisTemplate.opsForValue().set(cacheKey, "NONE", Duration.ofMinutes(30));
            return CadreResolutionResult.ineligible();
        }
    }
}
```

### 4. API Specifications & Contracts

#### 4.1 Centralized Catalog Search API

- **Route:** `POST /api/content/v1/search`
- **Purpose:** Powers `/app/learn/catalog` with faceted filters, category toggles, and sorting.
- **Headers:**
```http
Authorization: Bearer <JWT_USER_TOKEN>
x-authenticated-user-orgid: org-central-001
Content-Type: application/json
```

##### Request Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "request"
  ],
  "properties": {
    "request": {
      "type": "object",
      "required": [
        "offset",
        "limit"
      ],
      "properties": {
        "filters": {
          "type": "object",
          "properties": {
            "primaryCategory": {
              "type": "array",
              "items": {
                "type": "string",
                "enum": [
                  "Course",
                  "Program",
                  "Assessment",
                  "Case Study"
                ]
              }
            },
            "sector": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "duration": {
              "type": "object",
              "properties": {
                "min": {
                  "type": "integer",
                  "minimum": 0
                },
                "max": {
                  "type": "integer"
                }
              }
            },
            "averageRating": {
              "type": "object",
              "properties": {
                "gte": {
                  "type": "number",
                  "minimum": 1.0,
                  "maximum": 5.0
                }
              }
            },
            "language": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "competencyAreaId": {
              "type": "string"
            }
          }
        },
        "sort_by": {
          "type": "string",
          "enum": [
            "lastPublishedOn",
            "averageRating"
          ]
        },
        "offset": {
          "type": "integer",
          "minimum": 0
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 100
        }
      }
    }
  }
}
```

##### Sample Request Payload

```json
{
  "request": {
    "filters": {
      "primaryCategory": [
        "Course"
      ],
      "sector": [
        "Governance & Public Admin"
      ],
      "duration": {
        "min": 0,
        "max": 1800
      },
      "averageRating": {
        "gte": 4.0
      },
      "language": [
        "English",
        "Hindi"
      ]
    },
    "sort_by": "averageRating",
    "offset": 0,
    "limit": 10
  }
}
```

##### Sample Response Payload (`200 OK`)

```json
{
  "id": "api.content.search",
  "ver": "v1",
  "ts": "2026-10-27T15:29:00.000Z",
  "params": {
    "resmsgid": "8f887b40-9a2c-473d-82d1-21ff0a747b01",
    "status": "successful"
  },
  "responseCode": "OK",
  "result": {
    "count": 142,
    "content": [
      {
        "identifier": "do_1138928374",
        "name": "Public Leadership in Digital Governance",
        "primaryCategory": "Course",
        "posterImage": "https://cdn.igot.gov.in/content/do_1138928374/banner.png",
        "duration": 1200,
        "averageRating": 4.65,
        "totalRatingsCount": 184,
        "language": [
          "English"
        ],
        "sector": "Governance & Public Admin",
        "competencies_v6": [
          {
            "competencyAreaId": "ca_01",
            "competencyAreaName": "Behavioral",
            "competencyThemeId": "ct_04",
            "competencyThemeName": "Leadership",
            "competencySubThemeId": "cst_12",
            "competencySubThemeName": "Strategic Vision"
          }
        ],
        "lastPublishedOn": "2026-08-15T06:30:00.000Z"
      }
    ],
    "facets": [
      {
        "name": "sector",
        "values": [
          {
            "name": "Governance & Public Admin",
            "count": 142
          },
          {
            "name": "Economic Dev & Industry",
            "count": 48
          }
        ]
      },
      {
        "name": "language",
        "values": [
          {
            "name": "English",
            "count": 120
          },
          {
            "name": "Hindi",
            "count": 86
          }
        ]
      }
    ]
  }
}
```

#### 4.2 Explore by Theme Search API

- **Route:** `POST /api/content/v1/thematic/search`
- **Purpose:** Surfaces curated courses for Senior Officials based on selected theme, user cadre group, and organization context.
- **Headers:**
```http
Authorization: Bearer <JWT_USER_TOKEN>
Content-Type: application/json
```

##### Request Schema (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": [
    "request"
  ],
  "properties": {
    "request": {
      "type": "object",
      "required": [
        "themeId",
        "cadreGroup",
        "orgId",
        "offset",
        "limit"
      ],
      "properties": {
        "themeId": {
          "type": "string",
          "enum": [
            "PUBLIC_LEADERSHIP",
            "TECH_DATA_GOVERNANCE",
            "ENVIRONMENT_CLIMATE",
            "ECONOMY_PUBLIC_FINANCE",
            "GOVERNANCE_PUBLIC_POLICY"
          ]
        },
        "cadreGroup": {
          "type": "string",
          "enum": [
            "GROUP_1",
            "GROUP_2"
          ]
        },
        "orgId": {
          "type": "string"
        },
        "query": {
          "type": "string"
        },
        "offset": {
          "type": "integer",
          "minimum": 0
        },
        "limit": {
          "type": "integer",
          "minimum": 1,
          "maximum": 50
        }
      }
    }
  }
}
```

##### Sample Request Payload

```json
{
  "request": {
    "themeId": "PUBLIC_LEADERSHIP",
    "cadreGroup": "GROUP_2",
    "orgId": "org-central-001",
    "query": "Policy Execution",
    "offset": 0,
    "limit": 10
  }
}
```

##### Sample Response Payload (`200 OK`)

```json
{
  "id": "api.content.thematic.search",
  "ver": "v1",
  "ts": "2026-10-27T15:29:05.000Z",
  "responseCode": "OK",
  "result": {
    "themeId": "PUBLIC_LEADERSHIP",
    "cadreGroup": "GROUP_2",
    "totalCount": 18,
    "courses": [
      {
        "identifier": "do_1149201928",
        "name": "Strategic Public Policy Formulation & Execution",
        "primaryCategory": "Course",
        "posterImage": "https://cdn.igot.gov.in/content/do_1149201928/banner.png",
        "duration": 3600,
        "averageRating": 4.88,
        "totalRatingsCount": 54,
        "lastPublishedOn": "2026-09-01T10:00:00.000Z"
      }
    ]
  }
}
```

#### 4.3 Continue Learning Progress API

- **Route:** `GET /api/user/v1/continue-learning`
- **Purpose:** Retrieves the single latest active in-progress course unit for the homepage progress card ([KB-12710: Q12 | UI/UX Homepage Revamp - Web](https://karmayogibharat.atlassian.net/browse/KB-12710) (Prod Deployed), Q12 FR-15).
- **Headers:**
  `Authorization: Bearer <JWT_USER_TOKEN>`

##### Sample Response Payload (`200 OK`)

```json
{
  "id": "api.user.continue-learning",
  "ver": "v1",
  "responseCode": "OK",
  "result": {
    "hasActiveProgress": true,
    "course": {
      "courseId": "do_1138928374",
      "batchId": "0138928389102",
      "courseName": "Public Leadership in Digital Governance",
      "posterImage": "https://cdn.igot.gov.in/content/do_1138928374/banner.png",
      "primaryCategory": "Course",
      "completionPercentage": 45.0,
      "lastReadContentId": "do_1138928499",
      "lastReadContentName": "Module 2: Cross-Departmental Collaboration",
      "lastAccessTime": 1793095560000
    }
  }
}
```

*Note: If no progress exists,* `"hasActiveProgress": false` and `"course": null` are returned with HTTP 200, prompting the frontend to hide the card.

#### 4.4 Form-Config Cadre Mapping CRUD & Invalidation API

- **Route:** `POST /api/form/v1/thematic/mapping`
- **Purpose:** Registers or updates an organization-designation-to-cadre rule and invalidates Redis cache keys ([KB-14911: Q13| BE | FormConfig Enhanacement for Designation Create/read/update Api](https://karmayogibharat.atlassian.net/browse/KB-14911) (QA Completed), [KB-15120: Form-Config Service - Cache Enhancements](https://karmayogibharat.atlassian.net/browse/KB-15120) (Prod Deployed)).
- **Headers:**
```http
Authorization: Bearer <ADMIN_JWT>
Content-Type: application/json
```

##### Request Schema

```json
{
  "organizationId": "org-central-001",
  "designationName": "Director",
  "cadreGroup": "GROUP_1",
  "isActive": true
}
```

##### Response Payload (`200 OK`)

```json
{
  "id": "api.form.thematic.mapping",
  "responseCode": "OK",
  "result": {
    "status": "SUCCESS",
    "mappingId": "map_98a72b01-34",
    "invalidatedCacheKey": "thematic:cadre:org-central-001:director"
  }
}
```

#### 4.5 Telemetry Dispatch Contract

- **Route:** `POST /api/data/v1/telemetry`
- **Payload:** Kafka Ingestion Envelope (`CS_DISCOVERY_EVENT`)

```json
{
  "eid": "INTERACTION",
  "ets": 1793095740000,
  "ver": "3.0",
  "mid": "mid:550e8400-e29b-41d4-a716-446655440000",
  "actor": {
    "id": "712020:2b1926b8-ba53-4277-9b45-3508667c6b3d",
    "type": "User"
  },
  "context": {
    "channel": "igot-portal",
    "env": "learn-catalog",
    "cdata": [
      {
        "id": "KB-9333",
        "type": "Feature"
      },
      {
        "id": "Governance & Public Admin",
        "type": "FilterSector"
      },
      {
        "id": "0-30 Mins",
        "type": "FilterDuration"
      }
    ]
  },
  "edata": {
    "id": "CATALOG_FILTER_APPLIED",
    "type": "click",
    "pageid": "catalog-view",
    "extra": {
      "matchCount": 142,
      "selectedFacet": "sector"
    }
  }
}
```

### 5. Detailed Database & Storage Schemas

#### 5.1 Relational DDL (PostgreSQL: `application_config_db`)

```sql
-- Cadre Mapping Table
CREATE TABLE form_config_thematic_mapping (
    mapping_id VARCHAR(64) PRIMARY KEY,
    organization_id VARCHAR(64) NOT NULL,
    designation_name VARCHAR(128) NOT NULL,
    cadre_group VARCHAR(32) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chk_cadre_group CHECK (cadre_group IN ('GROUP_1', 'GROUP_2')),
    CONSTRAINT uq_org_designation UNIQUE (organization_id, designation_name)
);

CREATE INDEX idx_thematic_org_desig_active ON form_config_thematic_mapping (organization_id, designation_name) WHERE is_active = TRUE;

-- Audit Log Table
CREATE TABLE form_config_audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    mapping_id VARCHAR(64) NOT NULL,
    action_type VARCHAR(16) NOT NULL, -- INSERT, UPDATE, DELETE
    changed_by VARCHAR(64) NOT NULL,
    previous_state JSONB,
    new_state JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

#### 5.2 Content Elastic Index Mapping (`igot_content_catalog_v2`)

```json
{
  "settings": {
    "index": {
      "number_of_shards": 3,
      "number_of_replicas": 1,
      "refresh_interval": "1s"
    }
  },
  "mappings": {
    "dynamic": "strict",
    "properties": {
      "identifier": {
        "type": "keyword"
      },
      "name": {
        "type": "text",
        "fields": {
          "raw": {
            "type": "keyword"
          }
        }
      },
      "primaryCategory": {
        "type": "keyword"
      },
      "status": {
        "type": "keyword"
      },
      "visibility": {
        "type": "keyword"
      },
      "createdFor": {
        "type": "keyword"
      },
      "posterImage": {
        "type": "keyword",
        "index": false
      },
      "duration": {
        "type": "integer"
      },
      "averageRating": {
        "type": "float"
      },
      "totalRatingsCount": {
        "type": "integer"
      },
      "language": {
        "type": "keyword"
      },
      "sector": {
        "type": "keyword"
      },
      "lastPublishedOn": {
        "type": "date"
      },
      "createdOn": {
        "type": "date"
      },
      "competencies_v6": {
        "type": "nested",
        "properties": {
          "competencyAreaId": {
            "type": "keyword"
          },
          "competencyAreaName": {
            "type": "keyword"
          },
          "competencyThemeId": {
            "type": "keyword"
          },
          "competencyThemeName": {
            "type": "keyword"
          },
          "competencySubThemeId": {
            "type": "keyword"
          },
          "competencySubThemeName": {
            "type": "keyword"
          }
        }
      },
      "thematicTaxonomy": {
        "type": "nested",
        "properties": {
          "themeId": {
            "type": "keyword"
          },
          "targetCadreGroups": {
            "type": "keyword"
          }
        }
      }
    }
  }
}
```

### 6. Frontend Component Architecture & State Management

#### 6.1 Component Hierarchy (React 18 / TypeScript)

```text
<LearnerPortalLayout>
├── <LeftNavRail>
│   ├── <NavLinks activeRoute={currentRoute} />
│   ├── <ViewMoreOverflowMenu />
│   ├── <RoleGatedQuickActions userRoles={roles} />
│   └── <AppDownloadQRModal />
├── <TopNavHeader>
│   ├── <ScopedCategorySearch />
│   ├── <StaticLanguageSelector default="en" disabled={true} />
│   ├── <ThemeToggle scope="homepage-only" />
│   └── <UserProfileMenu />
└── <HomepageBodyContainer>
    ├── <ErrorBoundary fallback={<HeroFallback />}>
    │       <HeroBannerCarousel banners={heroData} />
    │   </ErrorBoundary>
    ├── <PersonalizedGreeting user={user} loginHistory={sessionHistory} />
    ├── <ErrorBoundary fallback={null}>
    │       <ContinueLearningCard progress={progressData} />
    │   </ErrorBoundary>
    ├── <RoleGatedThemeSection user={user}>
    │       <ErrorBoundary fallback={null}>
    │           <ExploreByThemeCarousel activeTheme="PUBLIC_LEADERSHIP" />
    │       </ErrorBoundary>
    │   </RoleGatedThemeSection>
    ├── <TrendingCoursesStrip rollingDays={7} />
    ├── <FeaturedAICoursesStrip />
    └── <MicroLearningStrip maxDurationSeconds={1800} />
```

#### 6.2 Frontend State Model: `useCatalogSearch` Hook

```ts
interface CatalogFilterState {
  primaryCategory: string[];
  sector: string[];
  duration: { min?: number; max?: number } | null;
  averageRating: number | null;
  language: string[];
  competencyAreaId?: string;
  sortBy: 'lastPublishedOn' | 'averageRating';
  offset: number;
  limit: number;
}

export const useCatalogSearch = (initialOrgId: string) => {
  const [filters, setFilters] = useState<CatalogFilterState>({
    primaryCategory: ['Course'],
    sector: [],
    duration: null,
    averageRating: null,
    language: [],
    sortBy: 'lastPublishedOn',
    offset: 0,
    limit: 12
  });
  const [results, setResults] = useState<CatalogSearchResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const applyFacet = useCallback((facetKey: keyof CatalogFilterState, value: any) => {
    setFilters(prev => ({
      ...prev,
      [facetKey]: value,
      offset: 0 // Reset pagination on filter mutation
    }));
    // Dispatch Telemetry Event
    TelemetryService.logInteraction('CATALOG_FILTER_APPLIED', { facetKey, value });
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    CatalogApi.searchContent(filters, initialOrgId)
      .then(data => {
        if (!isCancelled) {
          setResults(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!isCancelled) {
          console.error("Failed to fetch catalog content", err);
          setLoading(false);
        }
      });
    return () => { isCancelled = true; };
  }, [filters, initialOrgId]);

  return { filters, results, loading, applyFacet, setFilters };
};
```

### 7. Failure Handling & Circuit Breaking Matrix

| Failure Point | Detection Mechanism | LLD Recovery / Fallback Behavior |
|---|---|---|
| **Form-Config Cadre Resolution Timeout** | HTTP client timeout or HTTP 5xx | Return `CadreResolutionResult.ineligible()`. Hide the Explore by Theme strip on the frontend silently without interrupting the remaining homepage strips. |
| **Trending Courses Recommendation Service 503** | Resilience4j CircuitBreaker trips open after 5 consecutive failures | Degrade to executing standard catalog Elasticsearch query sorted by `lastPublishedOn DESC`. Strip title switches to `Recently Added Courses`. |
| **Continue Learning In-Progress API 404/500** | Client-side fetch exception | Collapse `<ContinueLearningCard />` container via React Error Boundary. Free viewport space without error banners. |
| **Search Facet Aggregation Out-of-Memory / High Latency** | Elasticsearch query execution | Query builder drops nested aggregations (`competencies_v6`), returns core content items, and serves cached facet counts from Redis. |
| **Kafka Broker Disconnection** | Producer buffer full exception | Store incoming telemetry events in local browser `IndexedDB` queue (FIFO, capped at 100 events); flush upon websocket/HTTP heartbeat recovery. |

### 8. Verification & Test Plan Mapping

| LLD Specification | Automated Test Suite & Strategy |
|---|---|
| **ElasticsearchQueryBuilder** | Unit Test (JUnit 5 + AssertJ):<br>- Verify generated JSON matches strict boolean AST.<br>- Verify visibility clause always contains userOrgId. |
| **CadreMappingResolver** | Integration Test (Embedded Redis & Testcontainers PG):<br>- Assert cache hit after initial fetch.<br>- Assert negative cache entry expires in 30 mins.<br>- Validate fix for [KB-15120](https://karmayogibharat.atlassian.net/browse/KB-15120) & [KB-15334](https://karmayogibharat.atlassian.net/browse/KB-15334). |
| **Catalog Search Endpoint** | API Contract & Performance Test (RestAssured + Gatling):<br>- Validate JSON Schema compliance.<br>- Verify P95 <= 350ms under 500 concurrent threads. |
| **React Homepage Layout** | Frontend Component Test (Jest + React Testing Library):<br>- Assert error boundary isolation when strip throws 500.<br>- Verify theme toggle styles apply only to homepage wrapper. |
