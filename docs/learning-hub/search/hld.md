# Search — High-Level Design (HLD) Document

## 2. Executive Architectural Summary & Evolution Drivers

Search across the **iGOT Karmayogi Platform** is the primary routing and discovery backbone connecting over 3 million civil servants, hundreds of Ministries, Departments, and Organizations (MDOs), autonomous training institutes (CTIs / CBP Providers), and the platform governing body (SPV / Karmayogi Bharat).

Between **Q2 and Q13**, Search evolved from a simple monolithic Elasticsearch keyword query on a single content index into an enterprise-grade, distributed discovery platform:

```mermaid
---
title: SEARCH ARCHITECTURAL EVOLUTION
---
flowchart TD
    E1["Q2-Q4: Monolithic Catalog Search"] --> D1["Single ES 6.7 cluster#59; basic keyword matching#59; client-side table filtering#59; uncaptured telemetry."]
    D1 ~~~ E2
    E2["Q6-Q8: Administrative Backend Migration & Discovery Expansion"] --> D2["Server-side user searches#59; 10-level Org Hierarchy tree#59; Recent Searches#59; Sector/Competency facets."]
    D2 ~~~ E3
    E3["Q9-Q10: High-Density Search, Universal Headers & ES Cluster Split"] --> D3["Cluster A (Content/Org) vs Cluster B (Users/Auth) split#59; 100-character query cap#59; suggestive edge-ngrams."]
    D3 ~~~ E4
    E4["Q11-Q13: Multi-Select Category Pills & NLP Response Caching"] --> D4["Multi-Select Category Pills (6 types)#59; NLP Search Microservice with Redis query caching & spell-correction."]
```

### Core Architecture Drivers

1. **Resource Segregation & Performance Protection**: High-frequency Learner catalog queries are physically separated from high-volume batch user updates by splitting Elasticsearch into two independent clusters (**Cluster A** and **Cluster B**).
2. **Deterministic Ranking & Spell Tolerance**: Rule-based syntactic query normalization, stop-word stripping, spelling correction, and weighted metadata ranking (Title > Keywords > Description) provide accurate discovery without requiring generative AI.
3. **Multi-Category Unification**: A unified discovery layer on the Learner Portal allows simultaneous queries across Courses, Events, People, Marketplace, Communities, and Knowledge Resources (Amrit Gyan Kosh).
4. **Universal Server-Side Administrative Table Search**: Replaced client-side browser filtering in SPV and MDO portals with server-side pagination (20, 50, 100 records per page), multi-column search, and tiered match scoring.

## 3. System Context & Container Architecture (C4 Model)

### 3.1 C4 Level 1: System Context Model

```mermaid
flowchart TD
    ACT["ACTORS & USERS<br/>Learners, MDO Admins, SPV, Creators"]
    subgraph SYS["iGOT SEARCH ECOSYSTEM (SYSTEM)"]
        CP["Client Portals<br/>(SPV, MDO, CBP, LRN)"] --> GW["API Gateway & Mesh<br/>(Auth, Tenancy, Caps)"]
        GW --> SDS["Search & Domain Services<br/>(NLP Normalizer, Redis, Core)"]
        SDS --> ESC[("Elasticsearch Clusters A & B<br/>(Content, Org, Users, Master)")]
    end
    ACT -->|"HTTPS / Mobile Traffic"| SYS
    subgraph EXT["EXTERNAL DATA PLATFORMS"]
        KAFKA["Apache Kafka Event Bus"] --> FLINK["Apache Flink Streaming"] --> DRUID["Apache Druid Analytics"]
    end
    SYS -->|"Async Ingestion CDC & Telemetry Streams"| EXT
```

### 3.2 C4 Level 2: Container Architecture Decomposition

```mermaid
flowchart TD
    subgraph CC["CLIENT CONSUMPTION CONTAINER"]
        SPV["SPV Portal<br/>(Angular Web App)"]
        MDO["MDO Portal<br/>(Angular Web App)"]
        CBP["CBP Portal<br/>(Angular Web App)"]
        LP["Learner Portal & App<br/>(Angular Web / Flutter)"]
    end
    KONG["KONG API GATEWAY CONTAINER<br/>Rate Limiting<br/>JWT Tenancy Verification<br/>100-Char Query Cap<br/>Reverse Proxy Routing"]
    NLP["NLP SEARCH MICROSERVICE (NodeJS)<br/>* 100-Char Boundary Validation<br/>* Stop-word / Intent Extraction<br/>* Spelling Correction Engine<br/>* Redis Cache Coordination"]
    SB["SUNBIRD SEARCH SERVICE (Java)<br/>* Composite Search Engine<br/>* Facet Aggregations & Filters<br/>* Server-Side Pagination<br/>* Tenancy Scoping Ingestion"]
    REDIS["REDIS CACHE CLUSTER<br/>* Key: search:cache:#lt;norm_query#gt;<br/>* TTL: Environment Configured<br/>* Atomic Query Counter: INCR"]
    SOR["SYSTEM OF RECORD DATASTORES<br/>* PostgreSQL (Users, Orgs)<br/>* Apache Cassandra (Content)<br/>* Kafka CDC Ingestion Bus"]
    subgraph ES["ELASTICSEARCH INFRASTRUCTURE"]
        ESA["CLUSTER A: CONTENT & ORG<br/>Indices: composite_search, content,<br/>organisations, events, agk_resources<br/>Analyzers: Standard, Edge-NGram (2-15)"]
        ESB["CLUSTER B: USERS & AUTH<br/>Indices: user, user-profile,<br/>designation_master, workflow_approvals<br/>Analyzers: Edge-NGram, Keyword Proximity"]
    end
    subgraph TEL["TELEMETRY & OBSERVABILITY PIPELINE"]
        KAF["Kafka Event Stream (telemetry.search)"]
        FL["Flink Jobs"]
        DR["Apache Druid"]
    end
    SPV --> KONG
    MDO --> KONG
    CBP --> KONG
    LP --> KONG
    KONG --> NLP
    KONG --> SB
    NLP --> REDIS
    SB --> SOR
    REDIS --> ES
    SOR --> ES
    ES --> TEL
    KAF --> FL
    FL --> DR
```

## 4. End-to-End Creation-to-Consumption Architecture

The search lifecycle is divided into two continuous loops:

1. **Creation & Indexing Loop (Async Write Path)**: Entities are authored, published, captured via Change-Data-Capture (CDC), and indexed into Elasticsearch.
2. **Query & Consumption Loop (Sync Read Path)**: Users search, filter, and discover resources, triggering downstream consumption.

```mermaid
---
title: "END-TO-END SEARCH CREATION & CONSUMPTION ARCHITECTURE"
---
flowchart TD
    subgraph CP["CREATION PATH - ASYNC WRITE PIPELINE"]
        C0["Content Author / MDO Admin"]
        C1["Portal Mutation: Create/Edit Entity"]
        C2["Transactional DBs: Cassandra / PostgreSQL"]
        C3["Kafka CDC Topics: entity.content.mutation / entity.user.mutation"]
        C4["Sunbird Ingestion Worker"]
        C4A["Resolves Taxonomies, Generates Edge-NGrams"]
        C5["Elasticsearch Cluster A (Content/Org) OR Cluster B (Users)"]
        C6["Evict Stale Redis Query Cache Keys"]
        C0 --> C1
        C1 --> C2
        C2 --> C3
        C3 --> C4
        C4 --> C4A
        C4 --> C5
        C5 --> C6
    end
    subgraph RP["CONSUMPTION PATH - SYNC READ PIPELINE"]
        R0["Learner / MDO Admin / SPV"]
        R1["Client UI: Input Query"]
        R1A["LocalStorage: Show Last 5 Recent Searches"]
        R2["API Gateway: Enforce 100-Char Cap & Validate JWT"]
        R3["NLP Search Service: Normalize, Strip Fillers, Spell-Check"]
        HIT["Redis Cache HIT"]
        HIT1["Return Cached Response Payload (P95 #lt;= 150ms)"]
        MISS["Redis Cache MISS"]
        Q["Query Elasticsearch Cluster A/B"]
        Q1["Execute Weighted BM25 Scoring"]
        W["Write Response to Redis Cache (TTL: 3600s)"]
        U["Client UI: Render Category Stacked Cards & Filters"]
        A["User Action: Enrol in Course / Approve Civil Servant Profile"]
        R0 --> R1
        R1 --> R1A
        R1 --> R2
        R2 --> R3
        R3 --> HIT
        HIT --> HIT1
        R3 --> MISS
        MISS --> Q
        Q --> Q1
        Q --> W
        W --> U
        U --> A
    end
```

## 5. Portal-Wise High-Level Architecture

**PORTAL-SPECIFIC SEARCH ARCHITECTURES**

1. SPV PORTAL (Directory, Org Hierarchy & Partner Discovery)
    - Architecture: Client-Side Angular Grids with Server-Side Full-Table Query Pagination (20/50/100).
    - Search Interfaces: Dedicated Directory Search, Org Hierarchy 10-Level Tree Explorer.
    - Target Indices: ES Cluster A (`organisations`, `partners`, `kcm_competencies`).
    - Processing: Tiered Match Scoring (Exact > Partial > Fuzzy); Hierarchy jurisdiction filtering.
2. MDO PORTAL (Civil Servant Approvals & Capacity Building Management)
    - Architecture: Universal Top-Nav Search Header + Scoped Administrative Listing Grids.
    - Search Interfaces: Suggestive Auto-complete Dropdown, User Management, Training Plans / APAR.
    - Target Indices: ES Cluster B (`user`, `user-profile`, `designation_master`, `workflow_approvals`).
    - Processing: JWT-injected `rootOrgId` multi-tenancy filter; multi-field employee discovery.
3. CBP PORTAL (Content Publisher Authoring Repository & Access Control)
    - Architecture: Content Builder Grid, Content Requests Pipeline, Access Control Finder.
    - Search Interfaces: Universal Content Repository Search, Karmayogi Access Control Search Tool.
    - Target Indices: ES Cluster A (`composite_search`, `content_draft`), Cluster B (`user`).
    - Processing: Automated exclusion of `status: "Retired"` archived courses; DO-ID query matching.
4. LEARNER PORTAL & MOBILE APP (Multi-Modal Discovery & Course Consumption)
    - Architecture: Multi-Select Category Pills UI, Sticky Facet Nav, Native Mobile View.
    - Search Interfaces: Persistent Header Bar, `/app/search` Page, Explore by Theme, Mobile Drawer.
    - Target Indices: ES Cluster A (`composite_search`, `events`, `agk_resources`, `marketplace`).
    - Processing: NLP query normalization, stop-word removal, automatic spelling correction,
      Last 5 Recent Searches popover, trending fallbacks, faceted filter aggregation.

## 6. Detailed High-Level Sequence Flows

### 6.1 Flow 1: Entity Creation, Ingestion & Real-Time Indexation

```mermaid
sequenceDiagram
    participant AA as Author/Admin
    participant UI as Portal UI
    participant DB as Cassandra/Postgres
    participant KB as Kafka CDC Bus
    participant IW as Ingestion Worker
    participant ES as ES Clusters (A/B)
    participant RC as Redis Cache
    AA->>UI: 1. Create/Update Entity
    UI->>DB: 2. Persist Entity Transaction
    DB->>KB: 3. Emit CDC Event (entity.mutation)
    KB->>IW: 4. Consume Msg
    IW->>IW: 5. Build NGrams & Token Mapping
    IW->>ES: 6. Bulk Index Document
    IW->>RC: 7. Invalidate Cache Entity Tags
    Note over RC: (Purge Old Keys)
    DB-->>UI: 200 OK Response
    UI-->>AA: Confirm Write
```

### 6.2 Flow 2: Learner Multi-Pill Search & Consumption Flow

```mermaid
sequenceDiagram
    participant L as Learner
    participant UI as Learner UI
    participant KG as Kong Gateway
    participant NLP as NLP Service
    participant RC as Redis Cache
    participant ESA as ES Cluster A
    participant CPL as Course Player
    L->>UI: 1. Focus Search
    UI->>UI: 2. Fetch Recents (Read LocalStorage)
    UI-->>L: Render Last 5
    L->>UI: 3. Type "publc pol" & Hit Enter (Multi-Pill Sel)
    UI->>KG: 4. POST /nlp/search
    KG->>NLP: 5. Enforce 100-Char Query Cap
    NLP->>RC: 6. Check Cache
    RC-->>NLP: Cache Miss
    NLP->>NLP: 7. Normalize & Spell Correct ("public policy")
    NLP->>ESA: 8. Execute DSL Query (Weighted Title #gt; Desc)
    ESA-->>NLP: 9. Return Search Results
    NLP->>RC: 10. Write Cache (TTL: 3600s)
    KG-->>UI: Return JSON Payload
    UI-->>L: 11. Render Page (Pills, Stacks)
    L->>UI: 12. Click Course Card
    UI->>CPL: 13. Open TOC Page
    L->>UI: 14. Click 'Enrol'
    UI->>CPL: 15. Stream Course
```

### 6.3 Flow 3: MDO Administrative Scoped User Search Flow

```mermaid
sequenceDiagram
    participant MA as MDO Admin
    participant UI as MDO Portal UI
    participant KG as Kong Gateway
    participant US as User Service
    participant ESB as ES Cluster B
    participant WF as Workflow Engine
    MA->>UI: 1. Open User Roster
    MA->>UI: 2. Enter "Director" Filter: "Pending"
    UI->>KG: 3. POST /user/search
    KG->>US: 4. Verify JWT Token & Extract rootOrgId
    US->>US: 5. Inject Tenant Filter Scoping
    US->>ESB: 6. Execute Multi-Field Query
    ESB-->>US: 7. Return Matches
    KG-->>UI: Paginated JSON (Page 1 of 50)
    UI-->>MA: 8. Render Table (Server Paged)
    MA->>UI: 9. Select User Row
    MA->>UI: 10. Click "Approve"
    UI->>WF:
    WF->>WF: 11. Activate User
```

## 7. Data Storage, Clustering & Ingestion Topology

```mermaid
---
title: "ELASTICSEARCH CLUSTERING TOPOLOGY"
---
flowchart TD
    R["SUNBIRD COMPOSITE SEARCH ROUTER"]
    A["ES CLUSTER A (CONTENT & ORG)<br/>Node Count: 6 Dedicated Nodes<br/>Primary Indices:<br/>- composite_search (Course catalog)<br/>- organisations (State/Central trees)<br/>- events (Webinars, talks)<br/>- agk_resources (Policy documents)<br/>Analyzers: Standard, Edge-NGram (2-15)<br/>Boosting: Name (3.0), Keywords (2.0),<br/>Description (1.0)"]
    B["ES CLUSTER B (USERS & AUTH)<br/>Node Count: 6 Dedicated Nodes<br/>Primary Indices:<br/>- user (Account records)<br/>- user-profile (Competencies, cadre)<br/>- designation_master (Titles, roles)<br/>- workflow_approvals (Pending states)<br/>Analyzers: Edge-NGram, Keyword Matching<br/>Hard Tenancy Boundary: rootOrgId"]
    R -->|"Target: Content, Org, Catalog"| A
    R -->|"Target: Users, Roles, Approvals"| B
```

## 8. Cross-Portal Component & Interface Matrix

| Portal | Search Interface Component | Backing API Endpoint | Data Source Index | Primary Filters | Sorting Capabilities |
|---|---|---|---|---|---|
| **SPV Portal** | Directory Table & Org Hierarchy Explorer | `POST /api/org/v1/search`<br>`POST /api/user/v1/search` | ES Cluster A (`organisations`) ES Cluster B (`user`) | Jurisdiction (State vs Central), Role, Status, Hierarchy Level (1–10) | Exact Match Priority, Alphabetical (A–Z), Created Date |
| **MDO Portal** | Universal Header & Approvals Grid | `POST /api/user/v1/search`<br>`POST /api/trainingplan/v1/search` | ES Cluster B (`user`, `user-profile`, `approvals`) | Tenancy (`rootOrgId`), Status (Pending, Verified), Group (A/B/C), Cadre | Exact Proximity Partial, Alphabetical, Submission Date |
| **CBP Portal** | Content Repository & Access Control Finder | `POST /api/content/v1/search`<br>`POST /api/user/v1/search` | ES Cluster A (`composite_search`) ES Cluster B (`user`) | Primary Category, Lifecycle Status (`status != "Retired"`), Competency Theme | Last Updated Descending, Title (A–Z), Status State |
| **Learner Web** | Multi-Select Category Pills & Facet Drawer | `POST /api/nlp/v1/search` | ES Cluster A (`composite_search`, `events`, `agk`, `marketplace`) | Categories (Content, Events, People, Marketplace, Communities, AGK), Duration, Rating, Language | Relevance (Weighted BM25), Newest Published, Alphabetical |
| **Mobile App** | Native Touch Search Drawer & Pill Bar | `POST /api/nlp/v1/search` | ES Cluster A (`composite_search`, `events`, `agk`, `marketplace`) | Mobile Categories, Touch Facets, Free vs Paid Marketplace | Relevance, Newest, Card Clamping (4 People Cards) |

## 9. Non-Functional & Operational Architecture

**OPERATIONAL ARCHITECTURE OVERVIEW**

1. Latency & Caching SLA:
    - Redis Query Cache Hit: P95 <= 150 ms.
    - Elasticsearch Direct / Filtered Query: P95 <= 1.8 s (under 500 req/sec load).
    - Suggestive Search Auto-Complete: P95 <= 250 ms (under 1,000 req/sec load).
2. System Resilience & Circuit Breaking:
    - Kong Gateway 100-character query cap protects Elasticsearch JVM heap from OOM crashes.
    - 30-second rolling window circuit breaker: If the NLP Search Service degrades (error rate > 5%), the Gateway bypasses NLP and falls back directly to Sunbird Search API.
3. Tenancy Isolation & Security:
    - Administrative searches automatically inject the authenticated user's `rootOrgId` claim.
    - Unauthenticated searches are restricted to public live course aliases, isolating retired or invite-only content.
4. Observability & Telemetry Streaming:
    - Real-time Kafka telemetry topics (`telemetry.search`) emit structured logs for all search events: `search_initiated`, `search_results_loaded`, `suggestive_search_selected`.
    - Apache Flink aggregates zero-result queries over 5-minute windows and dispatches them to Apache Druid for curriculum gap analytics.
