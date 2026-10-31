# Moderated Program — High-Level Design (HLD) Document

## 2. Executive Summary and Architecture Drivers

A **Moderated Program** on the iGOT Karmayogi platform is a governed, parent curricular container whose visibility, eligibility, batch enrollment, and consumption are strictly bounded by institutional tenancy—specifically targeted Ministries, Departments, and Organizations (MDOs) and the **Verified Karmayogi** profile badge.

```mermaid
flowchart LR
    subgraph MPP["MODERATED PROGRAM PARADIGM"]
        subgraph IT["Institutional Targeting"]
            A["MDO Specific Access<br/>Creator MDO + Targets<br/>All vs. Verified"]
        end
        subgraph CCI["Course Cohort Intersection"]
            B["Bundles Open Courses<br/>& Compatible Moderated<br/>Courses (Same MDOs)"]
        end
        subgraph BM["Batch Management"]
            C["Open Batch<br/>(Unbounded)<br/>OR<br/>Closed Batches<br/>(Time-Bounded)"]
        end
        A --> B
        B --> C
    end
```

### Key Architectural Drivers

1. **Multi-Tenant Data & Access Isolation:** Ensure that training content designed exclusively for specific ministries (e.g., MoHFW, NDMA, Ministry of Finance) cannot be discovered or enrolled in by non-targeted civil servants.
2. **Component Integrity (Intersection Math):** Prevent broken learner journeys by enforcing mathematical cohort parity across parent programs and child course modules:

1. **Operational Runtime Flexibility:** Provide Program Coordinators with the choice between continuous rolling cohorts (**Open Batch**) and calendar-bounded training windows (**Closed Batch**), enforcing mutual exclusivity at the state-machine level.
2. **Defense-in-Depth Security:** Intercept unauthorized access at all layers: Presentation route guards, Kong API Gateway header enforcement, and LMS Cassandra persistence gating.
3. **High-Concurrency Search & Discovery:** Optimize Elasticsearch query structures to execute dynamic MDO filtering with sub-350ms response times across 1M+ catalog entries.

## 3. System Context (C4 Level 1)

The System Context diagram establishes the boundaries of the Moderated Program subsystem, external user classes, client presentation surfaces, enterprise gateways, core services, and external integrations.

```mermaid
flowchart TD
    subgraph SH["STAKEHOLDERS & ACTORS"]
        A1["Content Creator<br/>(CBP Authoring UI)"]
        A2["Program Coordinator<br/>(Batch Scheduler)"]
        A3["Civil Servant<br/>(Web & App User)"]
    end
    subgraph PT["PRESENTATION TIER SURFACES"]
        P1["Content Authoring Portal<br/>(portal-v8-fe / Angular)"]
        P2["Program Coordinator Console<br/>(portal-v8-fe / Angular)"]
        P3["Learner Portal & Mobile<br/>(Angular SPA / Flutter)"]
    end
    A1 -->|"HTTPS / TLS 1.3"| P1
    A2 -->|"HTTPS / TLS 1.3"| P2
    A3 -->|"HTTPS / TLS 1.3"| P3
    GW["KONG ENTERPRISE API GATEWAY<br/>• Keycloak RS256 JWT Verification<br/>• Rate Limiting<br/>• Tenant Header Injection (rootOrgId)"]
    PT -->|"REST / JSON (Bearer JWT)"| GW
    subgraph AS["APPLICATION SERVICES LAYER"]
        S1["Content Service<br/>• Program Hierarchy<br/>• Intersection Engine"]
        S2["LMS Course Service<br/>• Batch State Machine<br/>• Cascaded Enrolments"]
        S3["Search & Feed Service<br/>• Elasticsearch Query Rewriter<br/>• Dynamic MDO Filter Injection"]
    end
    GW --> AS
    subgraph DS["POLYGLOT DATA STORAGE TIER"]
        D1[("Neo4j Knowledge Graph<br/>• Program Hierarchy<br/>• Component Sequences<br/>• Target MDO Attributes")]
        D2[("Apache Cassandra<br/>• sunbird_courses.course_batch<br/>• sunbird_courses.user_enrolments")]
        D3[("Elasticsearch Cluster<br/>• Index: composite-search<br/>• Index: course-batch<br/>(Tenant-filtered mappings)")]
    end
    S1 -->|"Cypher Queries"| D1
    S2 -->|"CQL Protocol v4"| D2
    S3 -->|"REST / Port 9200"| D3
```

## 4. Chronological Evolution of Architecture (Q2 to Q13)

**FEATURE EVOLUTION TIMELINE (Q2 - Q13)**

| QUARTER | JIRA ANCHOR | SUBSYSTEMS IMPACTED | ARCHITECTURAL MILESTONE |
|---|---|---|---|
| **Q2** | [KB-452] | Neo4j Knowledge Graph, Content Publishing Pipelines | Decoupled Course and Program publishing state machines. |
| **Q3** | [KB-1936] Parent<br/>[KB-1945],<br/>[KB-1946],<br/>[KB-1950] | portal-v8-fe, Content Service, sunbird-course-service, Cassandra Database | **Core Moderated Program Hub:**<br/>• 3-card creation modal.<br/>• MDO Specific access tag.<br/>• Home MDO locking.<br/>• Intersection validator engine.<br/>• Open vs. Closed batch model. |
| **Q4** | [KB-3756],<br/>[KB-4493],<br/>[KB-4288] | Learner Portal Feed, Dynamic Homepage Playlists | **Karma Programs Integration:** Surfaced programs on homepage strips with multi-MDO edge tags. |
| **Q6** | [KB-7067] | Coordinator Management UI portal-v8-fe | Grid refactoring; date picker validation ($\text{enroll}\le\text{end}$). |
| **Q7** | [KB-7854],<br/>[KB-7869]–[7872] | Elasticsearch Cluster, Search Proxy Service | • Query rewriting with NLP.<br/>• Dynamic targetMDOs filter injection into ES payloads. |
| **Q8** | [KB-8819],<br/>[KB-9603],<br/>[KB-9333], [9337] | Ingress Gateway (Kong), Mobile App Client (Flutter) | • Formalized User-Group gating.<br/>• Added Moderated Program facet checkbox in mobile app. |
| **Q11-13** | [KB-13016/17] | Cassandra Reporting, Analytics Pipelines, Peer Validation | Telemetry optimizations and MDO peer validation survey workflows |

## 5. Subsystem Decomposition & Component Design (C4 Level 2 & 3)

```mermaid
---
title: DETAILED SUBSYSTEM DECOMPOSITION
---
flowchart TD
    subgraph PT["PRESENTATION TIER (portal-v8-fe & Flutter Client)"]
        P1["ProgramEditorModule<br/>• Home MDO Lock Chip<br/>• VerifiedKarmayogiCtrl"]
        P2["BatchOperationsModule<br/>• OpenBatchToggle<br/>• DateRangePicker"]
        P3["TOCPlayerContainerComponent<br/>• ModeratedProgramGuard<br/>• Dynamic Action Button Machine"]
    end
    subgraph KG["KONG API GATEWAY"]
        K1["• AuthKeycloakPlugin: Validates Bearer token, verifies signature against JWKS<br/>• HeaderInjectionPlugin: Injects x-authenticated-userid and x-authenticated-rootorg"]
    end
    P1 -->|"HTTPS / RS256 JWT"| K1
    P2 -->|"HTTPS / RS256 JWT"| K1
    P3 -->|"HTTPS / RS256 JWT"| K1
    subgraph AS["APPLICATION SERVICES LAYER"]
        subgraph CS["Content Service"]
            C1["ProgramHierarchyActor"]
            C2["IntersectionValidator"]
            C1 --> C2
        end
        subgraph LS["LMS Course Service"]
            L1["CourseBatchMgmtActor"]
            L2["UserEnrolmentActor"]
            L1 --> L2
        end
        subgraph SP["Search Proxy Service"]
            Q1["MDOQueryTransformer"]
        end
    end
    K1 --> AS
    subgraph DS["DATA STORES"]
        D1[("Neo4j Knowledge Graph<br/>Node: :Content:Program<br/>Rel: [:hasSequence]")]
        D2[("Apache Cassandra DB<br/>Table: course_batch<br/>Table: user_enrolments")]
        D3[("Elasticsearch Cluster<br/>Index: composite-search<br/>Index: course-batch")]
    end
    CS -->|"Cypher"| D1
    LS -->|"CQL"| D2
    Q1 -->|"REST"| D3
```

### 5.1 Presentation Tier (`portal-v8-fe` & Flutter `mobile-app`)

- `ProgramEditorComponent`: Governs the creation flow. When `MDO Specific` is chosen, the component locks the creator's home `rootOrgId` as an undeletable chip, exposes the multi-MDO selector, and manages the binary `isVerifiedKarmayogiOnly` toggle.
- `BatchConfigComponent`: Interfaces with `sunbird-course-service` to enforce the mutual exclusivity invariant. If an open batch exists, closed batch creation controls are disabled.
- `ModeratedProgramGuard`: Angular route guard intercepting deep-link navigation. Evaluates caller claims and intercepts unauthorized direct URLs with HTTP 403, redirecting to the homepage.
- `TOCContainerComponent`: Dynamically evaluates program state:
  - *Unbatched:* Renders curriculum tree; disables enrollment (`"No Active Batch"`).
  - *Open Batch:* Enables continuous enrollment (`"Enrol in Program"`).
  - *Closed Batch:* Displays cohort countdown and start/end dates (`"Enrol in Batch"`).
  - *Expired:* Displays `"Enrollment Closed"`.

### 5.2 API Gateway & Ingress Layer (Kong)

- **Authentication Validation:** Kong validates Keycloak RS256 JWT tokens via public key endpoints.
- **Header Enrichment:** Kong injects validated claims downstream:
  - `x-authenticated-userid`: Caller UUID.
  - `x-authenticated-rootorg`: Tenant Org identifier.
  - `x-authenticated-user-roles`: Role list (`CONTENT_CREATOR`, `PROGRAM_COORDINATOR`).

- **Threat Mitigation:** Enforces IP rate limiting and rejects forged client tenancy headers.

### 5.3 Microservices Tier

1. **Content Service** (`content-service`):
  - Built on Play Framework 2.8 and Java 11.
  - `ProgramHierarchyActor.java`: Manages CRUD lifecycles in the Neo4j Knowledge Graph.
  - `CourseIntersectionValidator.java`: Implements mathematical intersection logic, ensuring that bundled moderated courses share common MDO sets and identical `isVerifiedKarmayogiOnly` settings.

2. **LMS Course Service** (`sunbird-course-service`):
  - Built with Akka Actors and Cassandra Java Driver.
  - `CourseBatchManagementActor.java`: Enforces batch state machine transitions, validating that and rejecting conflicting batch types.
  - `UserEnrolmentActor.java`: Executes atomic, cascaded enrollments in Cassandra table `sunbird_courses.user_enrolments` across the parent program and all child courses.

3. **Search Proxy Service** (`search-service`):
  - Node.js/Express service transforming search requests.
  - Injects tenant filter clauses into Elasticsearch payloads, suppressing department-specific content from unauthorized users.

## 6. End-to-End Architectural Workflows

### 6.1 Workflow 1: Program Authoring & Course Bundling with Intersection Validation

```mermaid
sequenceDiagram
    participant CR as Creator
    participant FE as portal-v8-fe
    participant CS as ContentService
    participant NEO as Neo4j Graph
    CR->>FE: 1. Selects MDO Specific, Target MDOs, & Courses
    FE->>CS: 2. POST /action/content/v3/create
    CS->>CS: 3. Evaluate Intersection: MDO_P ∩ MDO_C1 ∩ MDO_C2<br/>Verify Parity: isVerifiedKarmayogiOnly
    CS->>NEO: 4. Cypher: Create Nodes and #91;:hasSequence#93;
    NEO-->>CS:
    CS-->>FE: 5. HTTP 200 OK (do_id Generated)
    FE-->>CR: 6. Program Saved
```

### 6.2 Workflow 2: Program Coordinator Batch Provisioning (Mutual Exclusivity)

```mermaid
sequenceDiagram
    participant CO as Coordinator
    participant FE as portal-v8-fe
    participant LMS as LMS CourseService
    participant CAS as Cassandra
    CO->>FE: 1. Selects Open Batch
    FE->>LMS: 2. POST /course/v1/batch/create (type='open')
    LMS->>LMS: 3. Check Existing: Has Closed Batches? (No)
    LMS->>CAS: 4. INSERT course_batch (enrollmenttype=open)
    CAS-->>LMS:
    LMS-->>FE: 5. HTTP 200 OK
    FE-->>CO: 6. Batch Provisioned
    CO->>FE: 7. Later attempts to create Closed Batch
    FE->>LMS: 8. POST /course/v1/batch/create (type='close')
    Note over LMS: 9. Invariant Check:<br/>Open Batch Exists!<br/>REJECT Write
    LMS-->>FE: 10. HTTP 400 Bad Req (ERR_BATCH_EXCLUSIVE)
    FE-->>CO: 11. Creation Blocked
```

### 6.3 Workflow 3: Multi-Tenant Catalog Search & Elasticsearch Query Transformation

```mermaid
sequenceDiagram
    participant L as Learner
    participant FE as portal-v8-fe
    participant SP as Search Proxy
    participant ES as Elasticsearch
    L->>FE: 1. Executes Search: "Health Management"
    FE->>SP: 2. POST /content/v1/search (with JWT)
    SP->>SP: 3. Intercept & Unpack: caller.rootOrg = "org_mohfw_001"
    SP->>ES: 4. Inject Filter: targetMDOs CONTAINS "org_mohfw_001"
    ES-->>SP: 5. Matching Hit List
    SP-->>FE: 6. Filtered Results (Only Permitted MPs)
    FE-->>L: 7. Renders Catalog
```

### 6.4 Workflow 4: Learner TOC Gating, Verification Check & Cascaded Enrollment

```mermaid
sequenceDiagram
    participant L as Learner
    participant FE as portal-v8-fe
    participant CS as CourseService
    participant PE as ProfileEngine
    participant CAS as Cassandra
    L->>FE: 1. Clicks Program TOC
    FE->>FE: 2. Validate Tenant Org: rootOrg in targetMDOs
    FE-->>L: 3. Render TOC View (Batch Active)
    L->>FE: 4. Clicks "Enrol"
    FE->>CS: 5. POST /course/v1/enrol
    CS->>PE: 6. Check Verification isVerifiedOnly?
    PE-->>CS: 7. Status: Verified
    CS->>CAS: 8. Cascaded Writes:<br/>INSERT parent program into enrolments<br/>INSERT child course 1 into enrolments<br/>INSERT child course 2 into enrolments
    CAS-->>CS:
    CS-->>FE: 9. HTTP 200 OK (Enrolled: true)
    FE-->>L: 10. TOC Unlocked
```

### 6.5 Workflow 5: Consumption Telemetry, Progress Rollup & Certification

```mermaid
sequenceDiagram
    participant L as Learner
    participant MP as Media Player
    participant LMS as LMS CourseService
    participant DB as Cassandra DB
    participant CE as Certificate
    L->>MP: 1. Consumes Unit
    MP->>LMS: 2. Emits Telemetry (progress: 100%)
    LMS->>DB: 3. Update Unit State
    LMS->>LMS: 4. Check Child Course: All units done? (Yes)
    LMS->>DB: 5. Set Child Course status = 2
    LMS->>LMS: 6. Rollup Parent: All courses status=2? (Yes)
    LMS->>DB: 7. Set Program status = 2
    LMS->>CE: 8. Trigger Cert Job
    CE-->>LMS: 9. Save Certificate ID
    LMS->>DB:
    MP-->>L: 10. Program Complete & Cert
```

## 7. Data Architecture & Entity Relationship Model

```mermaid
---
title: ENTITY RELATIONSHIP DIAGRAM
---
flowchart TD
    MP["MODERATED PROGRAM<br/>identifier (PK)<br/>title<br/>programType=#quot;Moderated<br/>targetMDOs: [orgIds]<br/>isVerifiedKarmayogi"]
    CC["CHILD COURSE<br/>courseId (PK)<br/>contentType<br/>accessSettings<br/>targetMDOs: [orgIds]"]
    PB["PROGRAM BATCH<br/>batchId (PK)<br/>courseId (FK)<br/>batchType: open/close<br/>startDate / endDate<br/>enrollmentEndDate<br/>createdFor: [orgIds]"]
    UE["USER ENROLMENT<br/>userId (PK)<br/>batchId (PK)<br/>courseId<br/>status (0, 1, 2)<br/>active: boolean<br/>issuedCertificates"]
    MP -->|"1 N"| CC
    MP -->|"1 N"| PB
    PB -->|"1 N"| UE
```

### 7.1 Neo4j Graph Model (`Content` Node)

- **Labels:** `:Content:Program`
- **Properties:**
  - `identifier`: String (e.g., `"do_113892749102841856112"`, Primary Key)
  - `programType`: `"Moderated Program"`
  - `accessSetting`: `"MDO Specific"`
  - `targetMDOs`: List of Strings (`["org_mohfw_001", "org_dop_002"]`)
  - `isVerifiedKarmayogiOnly`: Boolean (`true` / `false`)
  - `status`: `"Draft"` | `"Review"` | `"Live"`

### 7.2 Cassandra Batch Store (`sunbird_courses.course_batch`)

```sql
CREATE TABLE sunbird_courses.course_batch (
    courseid text,
    batchid text,
    name text,
    description text,
    enrollmenttype text,  -- 'open' or 'invite-only' (Closed Batch)
    startdate text,  -- YYYY-MM-DD
    enddate text,  -- YYYY-MM-DD
    enrollmentenddate text,  -- YYYY-MM-DD createdfor set<text>,
    -- Target MDO tenant IDs mentors list<text>,
    -- Designated Program Coordinator UUIDs
    status int,  -- 0: Upcoming, 1: Ongoing, 2: Completed
    createddate timestamp,
    updateddate timestamp,
    PRIMARY KEY (courseid, batchid)
) WITH CLUSTERING ORDER BY (batchid ASC);
```

### 7.3 Cassandra Enrollment Ledger (`sunbird_courses.user_enrolments`)

```sql
CREATE TABLE sunbird_courses.user_enrolments (
    userid text,
    courseid text,  -- Program ID or Child Course ID
    batchid text,
    active boolean,
    completionpercentage int,  -- 0 to 100 issued_certificates list<frozen<map<text, text>>>,
    progress int,
    status int,  -- 0: Enrolled, 1: In-Progress, 2: Completed
    PRIMARY KEY (userid, courseid, batchid)
);
```

## 8. Interface Specifications & REST API Contracts

### 8.1 API Contract Summary

| Domain | Method | Endpoint | Consuming Client | Producer Service | Purpose |
|---|---|---|---|---|---|
| **Authoring** | `POST` | `/action/content/v3/create` | Content Portal | `content-service` | Creates draft Program container with `MDO Specific` access. |
| **Authoring** | `PATCH` | `/action/content/v3/update/{id}` | Content Portal | `content-service` | Updates MDO target lists and toggles Verified Karmayogi. |
| **Authoring** | `POST` | `/action/content/v3/publish` | Content Portal | `content-service` | Validates intersection math and sets status to `Live`. |
| **Batch** | `POST` | `/course/v1/batch/create` | Coordinator Console | `sunbird-course-service` | Creates Open or Closed batch under the Moderated Program. |
| **Enrollment** | `POST` | `/course/v1/``enrol` | Learner Web / App | `sunbird-course-service` | Validates eligibility and executes cascaded enrollment. |
| **Telemetry** | `POST` | `/course/v1/content/state/update` | Media Player | `sunbird-course-service` | Emits consumption telemetry for child course units. |
| **Search** | `POST` | `/api/content/v1/search` | Learner Web / App | `search-service` | Executes MDO-filtered faceted query on Elasticsearch. |

### 8.2 Sample Payload: Batch Creation (`POST /course/v1/batch/create`)

```json
{
  "request": {
    "courseId": "do_113892749102841856112",
    "name": "Health Policy Cohort 2026",
    "description": "Restricted cohort for MoHFW verified officers",
    "enrollmentType": "open",
    "createdFor": [
      "org_mohfw_001",
      "org_dop_002"
    ],
    "mentors": [
      "712020:2b1926b8-ba53-4277-9b45-3508667c6b3d"
    ]
  }
}
```

## 9. Security, Multi-Tenancy, and Governance Architecture

```mermaid
---
title: DEFENSE-IN-DEPTH SECURITY MODEL
---
flowchart TD
    subgraph L1["LAYER 1: CLIENT ROUTE GUARDS"]
        N1["Angular ModeratedProgramGuard & Flutter Interceptor:<br/>Checks cached session rootOrgId against program targetMDOs#59; blocks unauthorized direct URL navigation with an immediate redirect to /app/home."]
    end
    subgraph L2["LAYER 2: INGRESS GATEWAY ENFORCEMENT"]
        N2["Kong API Gateway:<br/>Authenticates RS256 JWT#59; strips untrusted client tenant headers#59; injects trusted x-authenticated-rootorg and x-authenticated-userid."]
    end
    subgraph L3["LAYER 3: SERVICE BUSINESS LOGIC GATING"]
        N3["Sunbird LMS Course Service:<br/>Authoritative validation: createdFor.contains(caller.rootOrgId).<br/>Profile verification check: isVerifiedKarmayogiOnly == caller.mandatoryFieldsVerified."]
    end
    N1 -->|"HTTPS / TLS 1.3"| N2
    N2 -->|"Internal Private Ingress"| N3
```

1. **Defense-in-Depth:** Presentation-layer route guards enhance user experience, but all authoritative entitlement checks execute server-side within `sunbird-course-service`.
2. **Profile Verification Integrity:** Server-side verification checks query the user registry directly using caller UUIDs, preventing header tampering.
3. **Multi-Tenant Data Isolation:** Cassandra writes partition records strictly by verified tenant context, preventing cross-ministry data leakage.

## 10. Operational, Scalability, and Non-Functional Architecture

1. **Elasticsearch High-Throughput Search:** Faceted search queries execute against Elasticsearch 7.x clusters utilizing boolean filter clauses. The injection of `targetMDOs` occurs in the search proxy before execution, ensuring sub-350ms response times at 2,500 requests/sec.
2. **Eventual Consistency & Indexing:** Cassandra writes trigger asynchronous Akka actor events syncing metadata to Elasticsearch (`course-batch`). System operations accommodate an eventual consistency SLA of 1–3 seconds.
3. **Deep Pagination Clamping:** Query pagination offsets are clamped at to protect cluster heap allocations.
4. **Idempotency Guarantees:** Batch creation and enrollment calls use UUIDv4 request keys, ensuring that client retries do not produce duplicate batches or fragmented enrollment records.

## 11. Engineering Workstream Breakdown & Deliverables

**ENGINEERING WORKSTREAM BREAKDOWN**

| TASK ID | REPOSITORY / WORKSTREAM | TARGET ESTIMATE | DELIVERABLE ARTIFACT / OUTCOME |
|---|---|---|---|
| TSK-01 | portal-v8-fe<br/>UI Authoring Module | Sprint 12 (Q3) | Develop MDO Specific authoring form, home MDO lock, and verified toggle. |
| TSK-02 | content-service<br/>Knowledge Graph Engine | Sprint 13 (Q3) | Implement CourseIntersectionHelper enforcing MDO intersection math. |
| TSK-03 | sunbird-course-service<br/>LMS Actor & Cassandra DAO | Sprint 14 (Q3) | Update CourseBatchManagementActor enforcing Open/Closed exclusivity. |
| TSK-04 | sunbird-course-service<br/>Enrollment Actor | Sprint 15 (Q3) | Build cascaded enrollment pipeline auto-joining bundled child courses. |
| TSK-05 | portal-v8-fe<br/>TOC Player Component | Sprint 18 (Q4) | Implement dynamic TOC states handling unbatched & expired cohorts. |
| TSK-06 | search-service<br/>Search Proxy Adapter | Sprint 22 (Q7) | Deploy Elasticsearch query rewriter injecting dynamic MDO filter clauses. |
| TSK-07 | mobile-app (Flutter)<br/>Mobile Cross-Platform App | Sprint 26 (Q8) | Native mobile catalog filter drawer supporting "Moderated Program" facet. |
