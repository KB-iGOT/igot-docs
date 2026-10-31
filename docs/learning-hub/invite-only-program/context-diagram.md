# Invite-Only Program — System Context Diagram & Boundary Specification

### 1.2 Purpose and Scope

This System Context Document establishes the functional, structural, operational, and integration boundaries for the **Invite Only Program** across the iGOT Karmayogi platform. It maps:

1. External user personas and actors interacting across authoring, coordination, and consumption surfaces.
2. Ingress and perimeter security boundaries (Keycloak, API Gateway, Route Guards).
3. Core internal domain services and microservice boundaries.
4. Upstream and downstream enterprise dependencies (e-Office, NIC, SMS/Email dispatchers, Sunbird RC Credentialing, Kafka telemetry streaming, and ElasticSearch discovery).
5. The evolutionary shift in system context from early unsegregated catalogs (Q2) to an enterprise-governed closed-cohort engine (Q13).

## 2. Global Enterprise Context (Level 0 – System Boundary)

The Level 0 Context Diagram isolates the **iGOT Karmayogi Digital Learning Infrastructure** as a single black-box system, defining all inbound and outbound interactions with human actors, external enterprise directories, government infrastructure, and credentialing networks.

```mermaid
graph TD
    classDef actor fill:#205081,stroke:#fff,stroke-width:2px,color:#fff;
    classDef system fill:#0052cc,stroke:#fff,stroke-width:3px,color:#fff;
    classDef ext fill:#f4f5f7,stroke:#333,stroke-width:1px,color:#000;
    Creator[Content Creator / MDO Admin]:::actor
    Coord[Program Coordinator]:::actor
    Learner[Target Civil Servant / Invited Learner]:::actor
    PublicUser[Uninvited Civil Servant / Public Learner]:::actor
    Reviewer[Content Reviewer / Publisher]:::actor
    IGOT((iGOT Karmayogi Platform<br/>Invite Only Program Ecosystem)):::system
    KC[Keycloak IAM / Parichay SSO]:::ext
    NIC[NIC / e-Office / User Directory]:::ext
    SMS[CDAC / National SMS & Email Gateway]:::ext
    RC[Sunbird RC Digital Credential Engine]:::ext
    FLINK[National Learning Telemetry & Analytics Pipeline]:::ext
    %% Inbound Actor Interactions
    Creator -->|1. Drafts curriculum, selects 'Custom users', attaches child courses| IGOT
    Reviewer -->|2. Reviews curriculum; approves with CQS waived per KB-453| IGOT
    Coord -->|3. Creates closed batch, sets schedule, uploads bulk CSV roster| IGOT
    Learner -->|4. Authenticates, discovers assigned strip, consumes modules in TOC| IGOT
    PublicUser -->|5. Attempts keyword search or direct URL access| IGOT
    %% System Boundary Responses
    IGOT -->|6. Renders live TOC, streams assets, issues certificate| Learner
    IGOT -->|7. Enforces 403 Forbidden / Omits from catalog search results| PublicUser
    IGOT -->|8. Emits CSV error report & batch consumption metrics| Coord
    %% External Enterprise Integrations
    IGOT <-->|9. Validates Bearer JWTs, user roles, and MDO tenancy| KC
    IGOT <-->|10. Resolves Email/Mobile to unique platform user IDs| NIC
    IGOT -->|11. Dispatches invitation alerts & completion notifications| SMS
    IGOT -->|12. Triggers verifiable W3C digital certificate issuance| RC
    IGOT -->|13. Streams atomic player consumption telemetry events| FLINK
```

## 3. Detailed Enterprise Context (Level 1 – Subsystem Decomposition)

The Level 1 Context Diagram opens the system boundary, illustrating how external actors and third-party systems interact with discrete frontend presentation layers, security gateways, core backend services, and persistence tiers.

```mermaid
graph TB
    subgraph "External Actors & Roles"
        A_CREATOR[Content Creator]
        A_COORD[Program Coordinator]
        A_LEARNER[Invited Civil Servant]
        A_UNINVITED[Uninvited Civil Servant]
    end
    subgraph "Presentation Layer (Client Surfaces)"
        UI_CP[Content Portal Admin SPA<br/>Angular 15+]
        UI_WEB[Learner Web Portal<br/>Angular 15+ Micro-frontends]
        UI_MBL[Learner Mobile App<br/>Flutter / Dart Client]
    end
    subgraph "Edge Ingress & Perimeter Security"
        EDGE_GW[Kong API Gateway & Route Guards]
        IAM[Keycloak IAM / OAuth2 Provider]
    end
    subgraph "Core Microservices Domain"
        SVC_CONTENT[Content Service<br/>Taxonomy & Hierarchy Graph]
        SVC_BATCH[Batch Management Service<br/>Closed Cohort & Roster Engine]
        SVC_SEARCH[Search & Discovery Service<br/>Access-Controlled Query Interceptor]
        SVC_PROGRESS[Progress & Telemetry Service<br/>Hierarchical Rollup Engine]
        SVC_SURVEY[Peer Validation Service<br/>MDO / SPV Survey Workflows]
    end
    subgraph "Persistence, Caching & Streaming Layer"
        CACHE_REDIS[(Redis Multi-Cluster<br/>TOC & Progress Cache)]
        DB_CASS[(Apache Cassandra<br/>Batches, Rosters & Leaf Telemetry)]
        DB_PG[(PostgreSQL<br/>Containers & Relations)]
        IDX_ES[(ElasticSearch Cluster<br/>Protected Content Indexes)]
        BUS_KAFKA{Apache Kafka Message Bus<br/>Batch, Telemetry & Cert Topics}
        STORE_S3[(MinIO / S3 Object Storage<br/>Encrypted CSV Buffers & Logs)]
    end
    subgraph "External Government & Platform Services"
        EXT_NIC[NIC / e-Office Directory]
        EXT_SMS[National SMS/Email Gateway]
        EXT_RC[Sunbird RC Credentials]
    end
    %% Actor Connections
    A_CREATOR -->|Author & Submit| UI_CP
    A_COORD -->|Batch & Bulk CSV| UI_CP
    A_LEARNER -->|Browse & Consume| UI_WEB
    A_LEARNER -->|Mobile Consumption| UI_MBL
    A_UNINVITED -->|Direct URL Attempt| UI_WEB
    %% Presentation to Gateway
    UI_CP -->|HTTPS / REST| EDGE_GW
    UI_WEB -->|HTTPS / REST / WSS| EDGE_GW
    UI_MBL -->|HTTPS / REST| EDGE_GW
    %% Edge Security
    EDGE_GW <-->|Token Introspection & Claims| IAM
    %% Gateway to Microservices
    EDGE_GW -->|/api/content/*| SVC_CONTENT
    EDGE_GW -->|/api/course/v1/batch/*| SVC_BATCH
    EDGE_GW -->|/api/content/v1/search/*| SVC_SEARCH
    EDGE_GW -->|/api/course/v1/hierarchy/*<br/>/api/course/v1/content/state/*| SVC_PROGRESS
    EDGE_GW -->|/api/survey/*| SVC_SURVEY
    %% Microservices to Persistence & External
    SVC_CONTENT --> DB_PG
    SVC_CONTENT --> IDX_ES
    SVC_BATCH --> DB_CASS
    SVC_BATCH --> STORE_S3
    SVC_BATCH --> BUS_KAFKA
    SVC_BATCH <-->|Resolve Users| EXT_NIC
    SVC_SEARCH <-->|Active Batch Tokens| DB_CASS
    SVC_SEARCH --> IDX_ES
    SVC_PROGRESS --> CACHE_REDIS
    SVC_PROGRESS --> DB_CASS
    SVC_PROGRESS --> BUS_KAFKA
    BUS_KAFKA --> EXT_SMS
    BUS_KAFKA --> EXT_RC
    BUS_KAFKA --> SVC_SURVEY
```

## 4. End-to-End Contextual Workflows across Boundaries

### 4.1 Program Creation, CQS Bypass & Review Flow (Content Portal to Backend)

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Content Creator
    participant CP as Content Portal UI
    participant GW as Kong API Gateway
    participant CS as Content Service
    participant PG as PostgreSQL
    participant ES as ElasticSearch
    Creator->>CP: Access 'Create New' -> 'Program'
    CP-->>Creator: Render Creation Form (Access Setting Radios)
    Creator->>CP: Input Metadata, Select Access Setting: "Custom users"
    Note over CP,Creator: Select "Custom users" tags container permanently as "Invite Only Program"
    Creator->>CP: Click 'Save Draft'
    CP->>GW: POST /api/content/v1/create
    GW->>CS: Route Request with Creator Token
    CS->>PG: INSERT INTO content_hierarchy (access_setting='custom', category='Invite Only Program')
    CS-->>CP: 201 Created (identifier: do_PRG101)
    Creator->>CP: Attach Published Child Courses (do_CRS01, do_CRS02)
    CP->>GW: PATCH /api/content/v1/hierarchy/update
    GW->>CS: Verify child courses are Live
    CS->>PG: Commit Parent-Child Graph Edges
    Creator->>CP: Click 'Send for Review'
    CP->>GW: POST /api/content/v1/review
    GW->>CS: Execute Review Transition
    Note over CS: Evaluate CQS Bypass Engine (KB-453):<br/>Waive automated CQS linting and self-curation checklists
    CS->>PG: UPDATE content_hierarchy SET status='Live'
    CS->>ES: Index Program Document (visibility="Protected", accessSetting="custom")
    CS-->>CP: 200 OK (Program Published & Live)
```

### 4.2 Closed Batch Creation, Bulk CSV Roster Ingestion & Notification Flow

```mermaid
sequenceDiagram
    autonumber
    actor Coord as Program Coordinator
    participant CP as Content Portal (Batch Management)
    participant GW as Kong API Gateway
    participant BS as Batch Service
    participant S3 as MinIO / S3 Storage
    participant NIC as NIC / User Directory
    participant CASS as Cassandra Store
    participant KAFKA as Kafka Message Bus
    participant SMS as National SMS/Email Gateway
    Coord->>CP: Click 'Create Batch' on do_PRG101
    Note over Coord,CP: Batch Type locked to "Closed" / "Invite-Only" (KB-1946)
    Coord->>CP: Set Start, End, and Enrollment Cutoff Dates
    Coord->>CP: Upload UTF-8 CSV (Headers: 'Email id', 'Mobile number')
    CP->>GW: POST /api/course/v1/batch/bulk-upload (Multipart)
    GW->>BS: Process Binary Stream
    BS->>S3: Stage Encrypted CSV
    BS->>NIC: Resolve Identifiers against Directory
    NIC-->>BS: Return Matched User UUIDs
    BS-->>CP: Return Verification Summary (Success: 495, Failed: 5, ErrorReport: URL)
    Coord->>CP: Confirm Roster & Click 'Dispatch Invites'
    CP->>GW: POST /api/course/v1/batch/create
    GW->>BS: Commit Batch & Member Records
    BS->>CASS: INSERT INTO sunbird.course_batch (enrollmenttype='invite-only')
    BS->>CASS: BATCH INSERT INTO sunbird.user_courses (consumptionstarted=false)
    BS->>KAFKA: Publish BATCH_INVITATION_EVENT (batchId, userIds[])
    KAFKA->>SMS: Dispatch SMS/Email alerts to invited civil servants
    BS-->>CP: 200 OK (Batch Provisioned & Invites Dispatched)
```

### 4.3 Catalog Search Isolation vs. Direct Access Route Guard Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Civil Servant
    participant Client as Web / Flutter Client
    participant GW as Kong API Gateway
    participant SS as Search Service
    participant ES as ElasticSearch Cluster
    participant CS as Course / Hierarchy Service
    participant CASS as Cassandra Store
    alt Scenario A: Keyword Search Execution
        User->>Client: Search keywords "Executive Governance"
        Client->>GW: POST /api/content/v1/search (query, bearerToken)
        GW->>SS: Intercept Query & Extract userId from Token
        SS->>CASS: SELECT batchid FROM sunbird.user_courses WHERE userid='caller_id'
        CASS-->>SS: Return active enrolledBatchIds
        SS->>ES: Execute Query with Terms Filter (visibility="Default" OR batchId IN [...])
        ES-->>SS: Return Matching Documents
        SS-->>Client: Render Results (Invite-only items shown ONLY if user in batch)
    else Scenario B: Direct URL Access Attempt (Uninvited User)
        User->>Client: Navigate to /app/toc/do_PRG101?batchId=batch_999
        Client->>GW: GET /api/course/v1/hierarchy/do_PRG101?batchId=batch_999
        GW->>CS: Evaluate Route Guard Interceptor
        CS->>CASS: SELECT active, status FROM sunbird.user_courses WHERE batchid='batch_999' AND userid='caller_id'
        alt User Not in Batch Roster
            CASS-->>CS: Zero Records Found
            CS-->>GW: 403 Forbidden (ERR_UNAUTHORIZED_INVITE_PROGRAM)
            GW-->>Client: HTTP 403 (Display: "Access Restricted: You are not invited to this cohort")
        else User Exists in Batch
            CASS-->>CS: Active Roster Entry Found
            CS-->>Client: 200 OK (Deliver Hierarchy Payload & Progress)
        end
    end
```

### 4.4 Curriculum Consumption, Telemetry Aggregation & Credentialing Flow

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Active Cohort Participant
    participant Player as Content Player (Web/Mobile)
    participant GW as Kong API Gateway
    participant PS as Progress Service
    participant REDIS as Redis Cache Cluster
    participant CASS as Cassandra Store
    participant KAFKA as Kafka Message Bus
    participant RC as Sunbird RC Credentials
    participant SURV as Peer Validation Service
    Learner->>Player: Complete Module 1.1 (Video EOF Event)
    Player->>GW: PATCH /api/course/v1/content/state/update
    GW->>PS: Process Telemetry Payload (contentId, status: 2)
    PS->>CASS: UPDATE sunbird.user_content_consumption SET status=2
    PS->>CASS: UPDATE sunbird.user_courses SET consumptionstarted=true
    Note over PS,CASS: Flips anti-tamper lock#59; prevents administrative removal (KB-1946)
    PS->>PS: Calculate Hierarchical Progress Rollup
    PS->>CASS: UPDATE sunbird.user_courses SET progress=calculated_val
    PS->>REDIS: Invalidate & Refresh Cache Key (user:do_PRG101:progress)
    PS->>KAFKA: Publish TELEMETRY_PROGRESS_EVENT
    alt Program Progress Reaches 100%
        PS->>CASS: UPDATE sunbird.user_courses SET status=2 (Completed)
        PS->>KAFKA: Publish PROGRAM_COMPLETION_EVENT
        KAFKA->>RC: Trigger Digital Credential Engine
        RC->>RC: Generate Signed W3C Verifiable Credential with QR Code
        KAFKA->>SURV: Trigger MDO/SPV Peer Validation Survey (KB-13016)
        SURV-->>Learner: Dispatch Survey Prompt
        PS-->>Player: 200 OK (Acknowledge Telemetry Update & Emit Checkmark)
    end
```

## 5. Subsystem Boundary Responsibilities & Interface Contracts

**SUBSYSTEM BOUNDARY RESPONSIBILITY MATRIX**

| Subsystem Boundary | Core Architectural Responsibilities | External Protocols |
|---|---|---|
| Ingress & Security Boundary<br/>(Kong / Keycloak) | JWT Bearer Token introspection & claim decoding<br/>RBAC role verification (CREATOR, COORD, PUBLIC)<br/>Zero-Trust route interception on `/hierarchy/*` | HTTPS / TLS 1.3<br/>OAuth2 / OIDC<br/>mTLS |
| Authoring Boundary<br/>(Content Service) | Program container creation & taxonomy stamping<br/>Enforcing "custom" access setting immutability<br/>CQS bypass & self-curation waiver (KB-453) | REST / JSON<br/>SQL (PostgreSQL)<br/>ElasticSearch Index |
| Batch & Roster Boundary<br/>(Batch Service) | Mandatory closed batch creation<br/>Temporal invariant evaluation (Dates)<br/>Asynchronous multi-threaded bulk CSV ingestion<br/>Anti-tamper consumption de-enrollment lock | REST / JSON<br/>CQL (Cassandra)<br/>Multipart / S3 Buffer<br/>Kafka Event Producer |
| Discovery Boundary<br/>(Search Service) | Intercepting incoming search queries<br/>Dynamic terms filter injection via batch tokens<br/>Dynamic faceted content count aggregations | REST / JSON<br/>ElasticSearch DSL<br/>CQL (Cache Lookup) |
| Consumption Boundary<br/>(Progress Service) | Two-column (Desktop) & single-column (Mobile) TOC<br/>Leaf telemetry ingestion & hierarchical rollups<br/>Multi-tier Redis caching for p95 &lt; 800ms loads<br/>100% milestone triggers (Certs & Peer Surveys) | REST / WebSockets<br/>Redis RESP<br/>CQL (Cassandra)<br/>Kafka Event Producer |

## 6. External Boundary Dependencies & Integration Matrix

| External Dependency | Integration Type | Direction | Data Exchange / Payload Highlights | Failure Impact & Fallback Policy |
|---|---|---|---|---|
| **Keycloak IAM / Parichay** | REST / OIDC | Inbound / Outbound | Validates caller session; decodes `userId`, `roles`, and `rootOrgId` claims. | **Critical Failure:** 401 Unauthorized; platform access blocked. No fallback. |
| **NIC / National Directory** | REST / HTTPS | Outbound | Translates bulk CSV `Email id` and `Mobile number` to platform user UUIDs. | **Degraded Mode:** CSV rows marked unresolvable; error CSV generated; manual search fallback. |
| **National SMS / Email GW** | Kafka Consumer | Outbound | Delivers batch invitation links, schedule alerts, and survey completion reminders. | **Non-Critical:** Events queued in Kafka topic; silent enrollment preserved in Home Strips. |
| **Sunbird RC Credentialing** | Kafka Consumer | Outbound | Ingests `PROGRAM_COMPLETION_EVENT`; issues W3C signed PDF credentials with QR code. | **Asynchronous Retry:** Events held in Kafka consumer group; certificate dispatch re-attempted. |
| **Flink Analytics** **Pipeline** | Kafka Consumer | Outbound | Continuous streaming of atomic `user_content_consumption` state updates for MDO dashboards. | **Event Buffering:** Telemetry buffered in Kafka broker partitions; zero data loss during pipeline spikes. |

## 7. Evolutionary Context Progression (Q2 to Q13)

```mermaid
timeline
    title Invite Only Program Boundary & Context Evolution
    section Q2 Baseline
        KB-453 : CQS Bypass Engine waives quality linting
        KB-1072 : Competency mapping scripts integrated
    section Q3 CP Redesign
        KB-1936 : Content Portal Redesign Master Epic
        KB-1945 : "Custom users" access setting stamped
        KB-1946 : Closed batch model & Bulk CSV parser
        KB-1582 /
        KB-1587 : Unified TOC layout boundaries
    section Q4 Channel Routing
        KB-3756 /
        KB-4493 : Dedicated MDO Home Strips
        KB-4282 : Flutter Mobile client parity
        KB-2960 /
        KB-2968 : Single-button "Manage Invites" modal
    section Q7 Discovery Isolation
        KB-7869 /
        KB-7870 : ElasticSearch security query interceptors
        KB-7871 /
        KB-7872 : Dynamic faceted catalog counters
    section Q8-Q13 Scaling & Governance
        KB-9603 : User Group RBAC boundaries
        KB-13016 /
        KB-13017 : Post-program Peer Validation Surveys
        KB-15282 : Distributed Redis caching for TOC/Progress
```

### Contextual Shifts across Horizons

1. **Pre-Q3 vs. Post-Q3 Horizon:** In Q2, the program shared unsegregated boundaries with public courses, leading to accidental self-enrollments. In Q3, the system boundary decoupled open and closed content via the `accessSettings.userAccess = "custom"` classification and mandatory closed-batch rules.
2. **Pre-Q7 vs. Post-Q7 Horizon:** Prior to Q7, search indexing lacked user-level entitlement filtering, exposing metadata to uninvited civil servants. In Q7, a query interceptor was placed between the Gateway and ElasticSearch to inject user batch tokens, ensuring zero-leakage catalog discovery.
3. **Q8–Q13 Scaling Horizon:** High-volume national capacity drives required moving progress evaluation from synchronous database operations to multi-tier Redis caching (`KB-15282`) and Kafka-driven asynchronous survey and certificate pipelines.

## 8. Requirements Traceability Matrix (RTM)

| Requirement ID | Jira Reference | Context Boundary / Subsystem | Ingress / Egress Interface | Architectural Verification Method |
|---|---|---|---|---|
| **CTX-CREAT-01** | `KB-1945` | Content Authoring Boundary | `POST /api/content/v1/create` | Form schema test: Assert `accessSettings.userAccess = "custom"` |
| **CTX-CQS-01** | `KB-453` | Review & Curation Boundary | Review Workflow State Engine | Integration test: Assert CQS calculation is bypassed |
| **CTX-BATCH-01** | `KB-1946` | Batch Management Boundary | `POST /api/course/v1/batch/create` | Contract test: Reject any payload with `enrollmentType = "open"` |
| **CTX-BULK-01** | `KB-1946` | Batch Roster Boundary | `POST /api/course/v1/batch/bulk-upload` | Stress test: 5,000-row CSV upload with syntax verification |
| **CTX-LOCK-01** | `KB-1946` | Data Governance Boundary | `sunbird.user_courses` table | Invariant test: Block removal when `consumptionStarted = true` |
| **CTX-UX-UNIFY** | `KB-2960`, `KB-2968` | Content Portal UI Boundary | `Manage Invites` Unified Modal | UI end-to-end Cypress test on unified roster management |
| **CTX-SRCH-01** | `KB-7869`, `KB-7870` | Discovery Boundary | `POST /api/content/v1/search` | Query evaluation test: Assert uninvited user receives 0 results |
| **CTX-FACET-01** | `KB-7871`, `KB-7872` | Catalog Aggregation Boundary | ElasticSearch Facet Aggregations | API functional test: Assert facet count reflects active entitlements |
| **CTX-TOC-DESK** | `KB-1582` | Desktop Web Boundary | `GET /api/course/v1/hierarchy/*` | Visual regression test: Assert two-column split layout |
| **CTX-TOC-MOBL** | `KB-1587`, `KB-4282` | Mobile Client Boundary | Flutter Native Gateway API | Mobile Appium test: Assert single-column collapsible layout |
| **CTX-PERF-01** | `KB-15282` | Caching & Performance Boundary | Redis Multi-Cluster Cache | Distributed Locust load test () |
| **CTX-SURV-01** | `KB-13016`, `KB-13017` | Governance & Survey Boundary | Kafka Topic `program.completion` | Event integration test: Verify peer survey notification dispatch |
