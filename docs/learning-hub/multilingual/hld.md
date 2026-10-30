# Multilingual — High-Level Design (HLD)

## 2. Architectural Drivers & Core Design Principles

**HIGH-LEVEL ARCHITECTURAL PILLARS**

| | |
|---|---|
| 1. Unified Identity Footprint | Single parent course DO_ID in catalog search; child variants mapped to parent without catalog duplication. |
| 2. Skeletal Immutability & Parity | Cloned structural hierarchy (modules, sequences, QTI question counts) guarantees equal educational rigor across languages. |
| 3. Single-Batch Cohort Governance | Course batches configured strictly on the base course; child variants operate at compatibilityLevel = 5 under parent batch. |
| 4. Asynchronous Lifecycle Isolation | Review, reject, and publish workflows operate per language variant without stalling the parent or other sibling variants. |
| 5. Dynamic Title & State Isolation | Independent progress tracking in Cassandra per language; first-completed language locks the dynamic certificate title string. |

## 3. System Context (C4 Level 1)

The following diagram illustrates how external user personas interact with the iGOT Karmayogi Multilingual Ecosystem, the boundary of the core platform, and external integrations (Bhashini, Keycloak, Object Storage, and Analytics).

```mermaid
flowchart TD
    subgraph UP["USER PERSONAS"]
        P1["Content Creator<br/>(CBP Author)"]
        P2["Reviewer/<br/>Publisher"]
        P3["Learner<br/>(Web / Mobile)"]
    end
    subgraph PB["iGOT KARMAYOGI PLATFORM BOUNDARY"]
        GW["Unified API Gateway & Reverse Proxy (NGINX / Kong)<br/>• Route Distribution • SSL Termination • Rate Limiting • Header Injection"]
        AUTH["Authoring & Curation Services<br/>• Content Service (Hierarchy Graph)<br/>• Review & Approval Engine<br/>• Assessment Builder & CQF Engine"]
        LRN["Learner & Consumption Services<br/>• cb-ext Gateway (AutoEnroll V2)<br/>• Course Service (Batch Management)<br/>• Content Player & Telemetry Engine"]
        PERS[("Enterprise Persistence, Search & Analytics Tier<br/>• Cassandra (Keyspace: sunbird) • PostgreSQL • Neo4j • Elasticsearch 7.x")]
        GW --> AUTH
        GW --> LRN
        AUTH --> PERS
        LRN --> PERS
    end
    EXT["EXTERNAL INTEGRATIONS<br/>• Keycloak: OAuth2 / OpenID Connect Identity Provider<br/>• Bhashini / IndicTrans2: Government Language Translation Gateway (AI CBP KB-12918)<br/>• S3-Compatible Object Store (MinIO/Azure Blob): Binary Media & SCORM Artifacts<br/>• Apache Flink Streaming Engine: Real-Time Event Processing & Progress Aggregations"]
    P1 -->|"HTTPS/WSS<br/>(JWT Auth)"| GW
    P2 -->|"HTTPS/WSS<br/>(JWT Auth)"| GW
    P3 -->|"HTTPS/WSS<br/>(JWT Auth)"| GW
    PB -->|"External System Connectors"| EXT
```

## 4. Container & Component Architecture (C4 Level 2 & 3)

The architecture is partitioned into four primary layers: **Presentation Tier**, **API Gateway & Routing Tier**, **Application Microservices Tier**, and **Persistence Tier**.

```mermaid
flowchart TD
    subgraph T1["1. PRESENTATION TIER"]
        CCP["Content Creation Portal (Angular)<br/>• Base Language Selector Modal<br/>• #quot;Add New Language#quot; Kebab Action<br/>• Module Skeletal Tree Builder<br/>• Localized Assessment Editor"]
        RPW["Reviewer / Publisher Workbench<br/>• Unified Multi-Language Tabs<br/>• CQF Verification (Base Only)<br/>• Granular Approve/Reject Form<br/>• compatibilityLevel = 5 Enforcer"]
        LWP["Learner Web Portal (Angular)<br/>• Single Card Search Badge<br/>• Pre-Enroll Language Picker<br/>• In-Player Switch Alert Modal<br/>• Localized Cert & Rating Gating"]
    end
    subgraph T2["2. API GATEWAY & ROUTING TIER"]
        GW["• Kong / NGINX Ingress: SSL Termination, CORS Handling, Bearer Token Validation<br/>• Keycloak Node-BFF: Extracts Auth Token -> Injects User Headers (wid, rootorg, locale)"]
    end
    subgraph T3["3. APPLICATION MICROSERVICES TIER"]
        subgraph T3L[" "]
            CBX["cb-ext Microservice (Node.js / Express)<br/>• GET /cohorts/user/autoenrollment/{id}<br/>• Language header resolution (e.g., lang: hindi)<br/>• Batch lookup & child variant mapping"]
            CRS["Sunbird Course Service (Java / Play)<br/>• POST /api/course/v2/enrol<br/>• Batch Validation (Active & Open)<br/>• compatibilityLevel Enforcement (Parent=4, Child=5)"]
            RAT["Rating & Feedback Microservice<br/>• Gated 50% Consumption Validator<br/>• Language-Isolated Rating Upsert"]
            CBX -->|"(Internal RPC/HTTP)"| CRS
            CRS --> RAT
        end
        subgraph T3R[" "]
            CS["Sunbird Content Service (Java / Play)<br/>• Hierarchy Read/Write & Skeletal Cloner<br/>• Locked Taxonomies Validator<br/>• CQF Status Inheritor Engine"]
            CERT["Sunbird-RC Certificate Service<br/>• Dynamic Localized Title Injector<br/>• First-Completed Language Evaluator"]
            TEL["Telemetry & Flink Stream Engine<br/>• Language-tagged Consumption Events<br/>• Real-time Completion Processor"]
            CS --> CERT
            CERT --> TEL
        end
    end
    subgraph T4["4. PERSISTENCE & DATA TIER"]
        CAS[("Cassandra Cluster (sunbird)<br/>• user_courses (Batch enrollments)<br/>• user_content_consumption<br/>(Progress isolated by lang)")]
        PG[("PostgreSQL (igot_schema)<br/>• course_language_ratings<br/>• review_comments & audit logs<br/>• cbp_plan_multilingual_artifacts")]
        ESN[("Elasticsearch 7.x & Neo4j<br/>• composite-search index<br/>(Parent doc + nested child)<br/>• Graph nodes: Parent-Variant")]
    end
    T1 -->|"(HTTPS)"| GW
    GW --> T3L
    GW --> T3R
    T3L --> T4
    T3R --> T4
```

## 5. End-to-End Interaction & Execution Flows

### 5.1 Stage 1: Multilingual Course Authoring & Skeletal Cloning Flow

When a Content Creator extends an approved, Live base course into another official language ([KB-9470: Q8 | Multilingual content creation | Course Language Selection](https://karmayogibharat.atlassian.net/browse/KB-9470) (Prod Deployed), [KB-9471: Q8 | Multilingual content creation | Module Template Consistency and Teacher's Notes](https://karmayogibharat.atlassian.net/browse/KB-9471) (Prod Deployed)):

```mermaid
sequenceDiagram
    participant CC as Content Creator
    participant FE as Creator Portal (FE)
    participant CS as Content-Service
    participant DB as Neo4j / ES Database
    Note over CC: 1. Open Live Course Action (...)
    CC->>FE: 2. Click "Add New Language"
    Note over FE: 3. Display Language Modal<br/>(English, Hindi, etc.)
    CC->>FE: 4. Select Target Lang (e.g. HI)
    FE->>CS: 5. POST /content/v1/create<br/>{ parentId, lang: "hi" }
    Note over CS: 6. Read Base Hierarchy Graph<br/>Validate status == "Live"
    Note over CS: 7. Clone Structural Skeleton:<br/>- Replicate Module Nodes<br/>- Replicate Sequence / Index<br/>- Lock Question Counts<br/>- Lock Taxonomy Metadata
    Note over CS: 8. Generate Child Variant DO<br/>compatibilityLevel = 5
    CS->>DB: Persist Cloned Hierarchy
    CS-->>FE: 9. Return New Child Variant
    FE-->>CC: 10. Render Localized Workbench
    Note over CC: 11. Upload Localized MP4/SCORM<br/>12. Localize Question Texts
    CC->>FE: 13. Click "Submit for Review"
    FE->>CS: 14. POST /review/{child_id}
    Note over CS: 15. Transition Status: Draft<br/>-> In-Review (Isolated)
```

### 5.2 Stage 2: Independent Curation & Approval Pipeline

Content Reviewers verify translated variants independently without impacting the published base course ([KB-9473: Q8 | Multilingual content creation | Review Process Management](https://karmayogibharat.atlassian.net/browse/KB-9473) (Prod Deployed), [KB-9494: Q8 | Multilingual content creation | Content Review](https://karmayogibharat.atlassian.net/browse/KB-9494) (Prod Deployed), [KB-10914: Q8 | Multilingual Content Creation | Reviewer/Publisher View – Unified Review Experience](https://karmayogibharat.atlassian.net/browse/KB-10914) (Open), [KB-11055: Q8 | Multilingual Content Creation | CQF Behavior for New Languages](https://karmayogibharat.atlassian.net/browse/KB-11055) (Open)):

```mermaid
sequenceDiagram
    participant RW as Reviewer Workbench
    participant RS as Review Service
    participant CS as Content Service
    participant NS as Notification Service
    RW->>RS: 1. Open Review Queue<br/>Unified Course View
    RS->>CS: 2. Fetch Multi-Lang Tabs<br/>[EN: Live] [HI: In-Review
    RW->>RS: 3. Select "Hindi" Tab
    Note over RS: 4. Evaluate CQF Checkpoint<br/>Detect child variant -><br/>Bypass CQF Evaluation<br/>(Inherited from Base)
    Note over RW: 5. Perform Linguistic Review<br/>Verify Localized Assets
    RW->>RS: 6. Action: [Approve] / [Reject]
    Note over RS: 7. If Rejected:<br/>Status -> "Draft"<br/>Attach localized comment<br/>Base remains "Live"
    RS->>CS: 8. If Approved: Status -> "Approved"
    CS->>NS: 9. Emit Bell Notification<br/>To Creator: "Hindi Ready"
```

### 5.3 Stage 3: Publishing & Batch Isolation Architecture

Publishing adheres to the single-batch governance rule ([KB-9893: Q8 | Multilingual Content Creation | Publisher Flow](https://karmayogibharat.atlassian.net/browse/KB-9893) (Prod Deployed)):

```mermaid
sequenceDiagram
    participant SP as SPV Publisher
    participant PS as Publisher Service
    participant CS as Course Service
    participant DB as Cassandra / ES
    Note over SP: 1. Open Approved Course List<br/>2. Select Hindi Child Variant
    SP->>PS: 3. Click "Publish"
    Note over PS: 4. Validate Parent State<br/>Verify Base is Live
    Note over PS: 5. Enforce Batch Rule:<br/>DO NOT create batch for<br/>child language variant
    Note over PS: 6. Set compatibilityLevel=5
    PS->>CS: 7. Update Parent Course Node<br/>Append to variants array
    CS->>DB: 8. Update Neo4j Graph &<br/>Re-index Parent in ES with<br/>"variants.hindi: Live"
    PS-->>SP: 9. Variant Live in Catalog
```

### 5.4 Stage 4: Single-Card Catalog Discovery & User Language Selection

In the Learner Portal, search queries resolve to the unified course entity ([KB-9510: Q8 | Multilingual Content Creation | Learner Portal | Multiple language visibility on course cards and TOC page](https://karmayogibharat.atlassian.net/browse/KB-9510) (Prod Deployed)):

```mermaid
sequenceDiagram
    participant LP as Learner Portal (Client)
    participant SG as Search Gateway
    participant ES as Elasticsearch Composite Index
    LP->>SG: 1. Search: "Ethics" or "नैतिकता"
    SG->>ES: 2. Multi-match Query<br/>(Matches parent or child title)
    ES-->>SG: 3. Return Parent Document with<br/>nested variants array
    Note over LP: 4. Render Single Course Card:<br/>"Ethics in Public Service"<br/>Badge: [Available in 2 languages]
    LP->>SG: 5. Click "Available in 2 languages"
    Note over LP: 6. Display Language Modal:<br/>- English (Original)<br/>- हिंदी (Hindi)
    Note over LP: 7. Learner selects preferred language
```

### 5.5 Stage 5: Language Auto-Enrollment V2 Execution

The unified auto-enrollment execution maps the learner into the parent batch with a language preference tag (Confluence Page `445349895`):

```mermaid
sequenceDiagram
    participant LB as Learner Browser / App
    participant CB as cb-ext Microservice
    participant CS as Sunbird Course-Service
    participant CA as Cassandra Cluster
    LB->>CB: 1. GET /autoenrollment/{baseId}<br/>Header: language: hindi<br/>Header: wid: #lt;user_uuid#gt;
    Note over CB: 2. Read Base Metadata<br/>3. Resolve Active Batch ID<br/>4. Map 'hindi' -> child_id
    CB->>CS: 5. POST /api/course/v2/enrol<br/>{ userId,<br/>courseId: child_id,<br/>batchId: parent_batch,<br/>language: "hindi" }
    Note over CS: 6. Validate Open Batch
    CS->>CA: 7. Upsert user_courses<br/>enrolled_language=hi
    CA-->>CS: 
    CS-->>CB: 8. HTTP 200 OK
    CB-->>LB: 9. Response: SUCCESS<br/>Route to Hindi Player
```

### 5.6 Stage 6: Learner Consumption & In-Player Language Switching

The learner consumes content and can switch languages with progress isolation guards ([KB-9511: Q8 | Multilingual Content Creation | Course Consumption](https://karmayogibharat.atlassian.net/browse/KB-9511) (Prod Deployed)):

```mermaid
sequenceDiagram
    participant LP as Learner Player (Web/Mobile)
    participant CS as Content-Service
    participant CP as Cassandra Progress Store
    Note over LP: 1. Load Player in Hindi<br/>2. Consumes Modules (Reaches 40%)
    LP->>CP: 3. Emit Telemetry Progress (Hindi: 40%)
    Note over LP: 4. Learner clicks Language Dropdown<br/>5. Selects "English"
    Note over LP: 6. Display Warning Modal:<br/>"Switching language will reset your<br/>progress in the current view.<br/>Continue?" [Cancel] [Switch]
    Note over LP: 7. Learner clicks [Switch]
    LP->>CS: 8. GET /hierarchy/{base_en_id}
    LP->>CP: 9. Query Existing English Progress
    CP-->>LP: 10. Found English Progress = 0%
    Note over LP: 11. Load English Course from Start (0%)<br/>(Hindi 40% remains saved in DB)
    Note over LP,CP: [LATER SESSION]
    Note over LP: 12. Learner switches back to "Hindi"
    LP->>CP: 13. Query Existing Hindi Progress
    CP-->>LP: 14. Found Hindi Progress = 40%
    Note over LP: 15. Prompt: "Continue where you left<br/>off in Hindi at 40%?"
    Note over LP: 16. Learner clicks [Resume]<br/>17. Player resumes exact video position
```

### 5.7 Stage 7: Certification & First-Completion Locking

The certification engine binds the dynamic title to the first completed language ([KB-9542: Q8 | Multilingual Content Creation | Certificate Generation](https://karmayogibharat.atlassian.net/browse/KB-9542) (Prod Deployed)):

```mermaid
sequenceDiagram
    participant LA as Learner Activity
    participant TF as Telemetry / Flink Pipeline
    participant CE as Certificate Engine (RC)
    participant ST as Storage / Cert Store
    LA->>TF: 1. Completes Final Assessment<br/>in Hindi (Progress = 100%)
    TF->>CE: 2. Ingest 100% Event<br/>tagged with lang: hindi
    Note over CE: 3. Check existing cert record<br/>for (userId, courseId)<br/>Result: None found
    Note over CE: 4. First Completion = HINDI<br/>5. Fetch Localized Title:<br/>"शासन में नैतिकता"
    CE->>ST: 6. Generate Certificate:<br/>- Standard National Layout<br/>- Title in HINDI
    CE-->>TF: 
    TF-->>LA: 7. Download Certificate<br/>(Shows Hindi Course Title)
    Note over LA,ST: [SUBSEQUENT EVENT]
    LA->>TF: 8. Learner later completes<br/>English version to 100%
    TF->>CE: 9. Emit 100% Completion (EN)
    Note over CE: 10. Check cert record:<br/>Certificate ALREADY issued<br/>Lock initial certificate#59;<br/>DO NOT overwrite title.
```

### 5.8 Stage 8: Post-Completion Isolated Language Rating

Ratings remain strictly isolated per language variant with a 50% consumption gating rule ([KB-9543: Q8 | Multilingual Content Creation | Separate rating for separate languages](https://karmayogibharat.atlassian.net/browse/KB-9543) (Open)):

```mermaid
sequenceDiagram
    participant LC as Learner Client
    participant RM as Rating Microservice
    participant CC as Cassandra Consumption
    participant PG as PostgreSQL (Ratings)
    LC->>RM: 1. Click "Rate Course" in Hindi TOC
    RM->>CC: 2. Query consumption percentage<br/>for (userId, child_id, hindi)
    CC-->>RM: 3. Return progress = 65%
    Note over RM: 4. Verify progress >= 50%<br/>Validation PASS
    RM-->>LC: 5. Display Rating Form (1-5 Stars)
    LC->>RM: 6. Submit: 5 Stars + "उत्कृष्ट"
    RM->>PG: 7. Upsert Rating Record:<br/>{ userId, parentId,<br/>variantId, lang: "hindi",<br/>stars: 5, review: "..." }
    RM-->>LC: 8. Success Confirmation
```

## 6. Detailed Component Responsibilities & Interface Specifications

### 6.1 Component Matrix

| Component Name | Subsystem / Layer | Primary Architectural Responsibility | Upstream Invocations | Downstream Invocations | Persistence Stores |
|---|---|---|---|---|---|
| `cb-ext` Gateway | API Orchestration | AutoEnroll V2 execution, language header resolution, and parent cohort mapping | Learner Web / Mobile Portals | Sunbird Course Service | Redis (Cache) |
| **Content Service** | Core Engine | Hierarchy tree management, skeletal cloning, taxonomy field locking | Creator Workbench, Reviewer UI | Neo4j Knowledge Graph | PostgreSQL, Neo4j |
| **Course Service** | Core Engine | Batch lifecycle enforcement, enrollment persistence, and compatibility control | `cb-ext` Microservice | Sunbird Cassandra Cluster | Cassandra (`sunbird`) |
| **Review Engine** | Curation | Multi-language review tab management, CQF bypass rule for translations | Reviewer Workbench | Content Service | PostgreSQL |
| **Assessment Service** | Evaluation | QTI schema evaluation, question count locking, time limit localization | Learner Player, Creator UI | Content Service | Cassandra / Object Store |
| **Certificate Service** | Certification | Sunbird-RC dynamic localized title injection based on first-completion | Flink Streaming Consumer | Certificate Vault / S3 | Cassandra, PostgreSQL |
| **Rating Service** | Feedback | 50% consumption gating rule enforcement and language-isolated rating persistence | Learner Portal | Course Service, Cassandra | PostgreSQL |
| **AI CBP Translator** | AI Services | Multilingual translation of Annual Capacity Building Plans into 11 Indic scripts | AI CBP Workbench | Bhashini Gateway, Vertex AI | PostgreSQL |

## 7. Data Architecture & Relational Graph Mapping

### 7.1 Cross-Store Data Distribution

```mermaid
flowchart TD
    subgraph NEOG["NEO4J / ELASTICSEARCH GRAPH"]
        BASE["Course Node (Base Language: English)<br/>DO_ID: do_11434858012230451212<br/>compatibilityLevel = 4<br/>batches = [#quot;0139769234555371524#quot;]"]
        VAR["Course Variant Node (Target: Hindi)<br/>DO_ID: do_114351316566654976145<br/>parent = do_11434858012230451212<br/>compatibilityLevel = 5<br/>batches = [] (No child batches)"]
        BASE -->|"HAS_VARIANT"| VAR
    end
    subgraph CASS["CASSANDRA (WIDE-COLUMN)"]
        UC["Table: sunbird.user_courses<br/>• PK: ((userid), courseid, batchid)<br/>• enrolled_language = #quot;hindi#quot;<br/>• certificates = [{ courseTitle: #quot;शासन में... }]"]
        UCC["Table: sunbird.user_content_consumption<br/>• PK: ((userid, courseid), batchid, contentid, language)<br/>• progress = 100, status = 2"]
    end
    subgraph PG["POSTGRESQL (RELATIONAL)"]
        CLR["Table: igot_schema.course_language_ratings<br/>• PK: id (UUID)<br/>• FK: parent_course_id, variant_course_id<br/>• language = #quot;hindi#quot;, rating = 5"]
        CPM["Table: igot_schema.cbp_plan_multilingual_artifacts<br/>• PK: (plan_id, language, document_format)<br/>• document_format = #quot;PDF#quot; (CSV deferred)"]
    end
    NEOG --> CASS
    NEOG --> PG
```

## 8. Deployment Topology & High Availability Architecture

The deployment architecture uses a **Multi-Availability Zone (AZ) Kubernetes Cluster** managed via Helm charts and Ansible playbooks, ensuring fault tolerance and zero-downtime rolling upgrades.

```mermaid
flowchart TD
    subgraph TOPO["MULTI-AZ KUBERNETES PRODUCTION TOPOLOGY"]
        subgraph DC["AZURE CLOUD / MEGHRAJ DATA CENTER"]
            LB["External Cloud Load Balancer (Azure Application Gateway / Layer 7)<br/>• Geo-redundant Anycast IP • SSL Offloading • WAF Threat Prevention"]
            subgraph AZ1["Availability Zone 1"]
                IN1["Ingress Controller Pod (NGINX)"]
                CB1["cb-ext Microservice (HPA: 4-12)"]
                SB1["Sunbird Content & Course Pods"]
                CA1[("Cassandra Node 1 (AZ1 Rack)")]
                PG1[("PostgreSQL Primary (Read/Write)")]
                IN1 --> CB1 --> SB1 --> CA1
            end
            subgraph AZ2["Availability Zone 2"]
                IN2["Ingress Controller Pod (NGINX)"]
                CB2["cb-ext Microservice (HPA: 4-12)"]
                SB2["Sunbird Content & Course Pods"]
                CA2[("Cassandra Node 2 (AZ2 Rack)")]
                PG2[("PostgreSQL Standby (Read-Replica)")]
                IN2 --> CB2 --> SB2 --> CA2
            end
            LB --> IN1
            LB --> IN2
            CA1 <-->|"Sync Rep"| CA2
            PG1 -->|"Async Stream"| PG2
        end
    end
```

## 9. Security, Identity & Non-Functional Specifications

**NON-FUNCTIONAL SPECIFICATIONS & GUARDS**

| Architectural Vector | System Metric / Benchmark | Engineering Implementation Guard |
|---|---|---|
| **Scalability** | 25,000 peak concurrent learners switching languages simultaneously | Horizontally auto-scaled cb-ext pods; Redis 7 cluster caching for course metadata. |
| **Latency Targets** | p95 < 200ms (AutoEnroll V2 API)<br/>p95 < 120ms (Hierarchy Resolution) | Read-aside caching on Elasticsearch docs; Asynchronous batch status checks. |
| **Data Partitioning** | Zero cross-lingual progress bleed across switches | Composite clustering keys in Cassandra partitioned strictly by language. |
| **Identity Security** | Zero-trust header propagation | Keycloak JWT verification at Ingress; Header sanitization of x-authenticated-*. |
| **Availability** | 99.9% uptime SLA | Multi-AZ deployment topology; PgBouncer connection pooling; circuit breaker retry. |

## 10. Requirement-to-Architecture Traceability Matrix

| Business Requirement | FRS / SRS Reference | System Design Component | Jira Enabler | Status |
|---|---|---|---|---|
| **Mandatory Base Language** | FRS `MUL_CON_CRE_BR1_FR1` | Course Creation Modal (Angular) | [KB-9470: Q8 \| Multilingual content creation \| Course Language Selection](https://karmayogibharat.atlassian.net/browse/KB-9470) (Prod Deployed) | **Prod Deployed** |
| **Module Skeletal Cloning** | BRD `MUL_CON_CRE_BR2` | Content Service Hierarchy Engine | [KB-9471: Q8 \| Multilingual content creation \| Module Template Consistency and Teacher's Notes](https://karmayogibharat.atlassian.net/browse/KB-9471) (Prod Deployed) | **Prod Deployed** |
| **CQF Single Enforcement** | FRS `MUL_CON_CRE_BR3_FR2` | Review Workflow & CQF Engine | [KB-11055: Q8 \| Multilingual Content Creation \| CQF Behavior for New Languages](https://karmayogibharat.atlassian.net/browse/KB-11055) (Open) | **Prod Deployed** |
| **Assessment Question Lock** | Story [KB-11053: Q8 \| Multilingual Content Creation \| Assessment Settings and Behavior During Edit](https://karmayogibharat.atlassian.net/browse/KB-11053) (Prod Deployed) | QTI Assessment Builder Component | [KB-11053: Q8 \| Multilingual Content Creation \| Assessment Settings and Behavior During Edit](https://karmayogibharat.atlassian.net/browse/KB-11053) (Prod Deployed) | **Prod Deployed** |
| **Single-Batch Governance** | Story [KB-9893: Q8 \| Multilingual Content Creation \| Publisher Flow](https://karmayogibharat.atlassian.net/browse/KB-9893) (Prod Deployed) | Sunbird Course Service Publisher | [KB-9893: Q8 \| Multilingual Content Creation \| Publisher Flow](https://karmayogibharat.atlassian.net/browse/KB-9893) (Prod Deployed) | **Prod Deployed** |
| **Single-Card Discovery** | FRS `MUL_CON_CRE_BR6_FR1` | Search Gateway & Elasticsearch | [KB-9510: Q8 \| Multilingual Content Creation \| Learner Portal \| Multiple language visibility on course cards and TOC page](https://karmayogibharat.atlassian.net/browse/KB-9510) (Prod Deployed) | **Prod Deployed** |
| **AutoEnroll V2 Gateway** | Confluence Page `445349895` | `cb-ext` Microservice Gateway | Page `445349895` | **Prod Deployed** |
| **In-Player Progress Warning** | FRS `MUL_CON_CRE_BR7_FR2` | Content Player Controller | [KB-9511: Q8 \| Multilingual Content Creation \| Course Consumption](https://karmayogibharat.atlassian.net/browse/KB-9511) (Prod Deployed) | **Prod Deployed** |
| **Dynamic Title Certificate** | BRD `MUL_CON_CRE_BR8` | Sunbird-RC Certificate Service | [KB-9542: Q8 \| Multilingual Content Creation \| Certificate Generation](https://karmayogibharat.atlassian.net/browse/KB-9542) (Prod Deployed) | **Prod Deployed** |
| **Gated 50% Rating Engine** | Story [KB-9543: Q8 \| Multilingual Content Creation \| Separate rating for separate languages](https://karmayogibharat.atlassian.net/browse/KB-9543) (Open) | Rating Microservice & PostgreSQL | [KB-9543: Q8 \| Multilingual Content Creation \| Separate rating for separate languages](https://karmayogibharat.atlassian.net/browse/KB-9543) (Open) | **Open** |
| **Indic ACBP AI Tool** | Story [KB-12918: Q11 \| Multilingual ACBP/CBP in AI CBP tool](https://karmayogibharat.atlassian.net/browse/KB-12918) (In-Progress) | AI CBP Service + Bhashini Gateway | [KB-12918: Q11 \| Multilingual ACBP/CBP in AI CBP tool](https://karmayogibharat.atlassian.net/browse/KB-12918) (In-Progress) | **In-Progress** |
