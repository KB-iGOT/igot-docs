# Invite-Only Course / Batch — High-Level Design (HLD)

## 1. Executive Summary & Architectural Scope

### 1.1 Executive Summary

The **Invite-Only Course / Batch** subsystem on the iGOT Karmayogi platform provides a secure, entitlement-gated access control architecture for civil services learning programs and high-stakes standalone assessments. Unlike standard platform courses—which are publicly discoverable and support self-enrollment—invite-only resources require explicit administrative nomination, automated batch suppression at the ingestion tier, defense-in-depth routing validation, and restricted single-sitting assessment consumption.

This High-Level Design (HLD) defines the global system topology, component boundaries, asynchronous event processing pipelines, data storage models, and cross-tier network interactions from **Quarter 2 (Q2)** through **Quarter 13 (Q13)**.

### 1.2 System Scope

The architecture spans three core resource domains:

1. **Invite-Only Courses:** Full hierarchical course collections gated at the root catalog level, requiring cohort-specific batch assignment.
2. **Invite-Only Batches:** Discrete, schedule-bounded cohorts configured under standard or blended programs with explicit participant whitelisting (`participantList`).
3. **Standalone Invite-Only Assessments:** Decoupled evaluation modules authored with randomized question weightage, negative marking penalties, and auto-batch suppression, delivered through a single-sitting examination runner.

## 2. Evolutionary Architecture Progression (Q2 – Q13)

```mermaid
---
title: "EVOLUTION ROADMAP: PHASES & CAPABILITIES"
---
flowchart TD
    P1["Phase 1: Q2 – Q4 Baseline Closed Batches (KB-453)<br/>• Core Sunbird LMS: enrollmentType enum (#quot;open#quot; vs #quot;invite-only#quot;).<br/>• Cassandra storage: participantList text arrays in sunbird_courses.course_batch.<br/>• Manual participant addition via portal UI#59; courses still remained publicly searchable."]
    P2["Phase 2: Q5 – Q7 Blended Learning & Capacity Bound Scheduling (KB-2960)<br/>• Support for offline classroom & blended learning batches.<br/>• Extension of batchAttributes map for physical venue geo-coordinates and seat quotas.<br/>• Direct association of digital completion certificates to closed batch completions."]
    P3["Phase 3: Q8 – Q10 Standalone Assessments & Flink Event Gating (KB-2968, KB-3959)<br/>• sunbird-cb-ext-schema extension: #quot;Invite-Only Assessment#quot; in courseCategory.<br/>• Flink stream processor (BatchCreation.scala) intercepts publish events to suppress automatic open-batch instantiation.<br/>• CQF Assessment engine: Negative marking percentages and question difficulty stratification"]
    P4["Phase 4: Q11 – Q13 Hardened Route Gating & Unified Feeds (KB-1072, KB-6276)<br/>• Frontend route guards: Direct URL interception rendering #quot;You are not invited#quot; modal.<br/>• Tenant isolation: createdFor MDO boundary validation for coordinator batch operations.<br/>• Unified reporting APIs aggregating multi-category progress feeds across learner dashboards."]
    P1 --> P2
    P2 --> P3
    P3 --> P4
```

## 3. High-Level Architectural Diagrams & System Topologies

### 3.1 System Context Diagram (Level 0 / Level 1)

The context diagram depicts external actors, user surfaces, the API gateway, and platform core services.

```mermaid
flowchart TD
    USERS["EXTERNAL / INTERNAL USERS"]
    subgraph PRES["PRESENTATION TIER (PORTALS)"]
        UI1["Content Creator Portal<br/>(CBP Authoring Canvas)"]
        UI2["Program Coordinator Console<br/>(Batch & Cohort Manager)"]
        UI3["Learner Web / Mobile App<br/>(Consumption & Runner)"]
    end
    subgraph GW["API GATEWAY TIER"]
        KONG["Kong Enterprise API Gateway / OpenResty<br/>• Keycloak Token Decryption<br/>• Rate Limiting<br/>• Ingress Path Routing"]
    end
    subgraph MS["MICROSERVICES TIER"]
        CS["CONTENT SERVICE<br/>• Metadata Validator<br/>• Publishing Engine"]
        LMS["LMS COURSE SERVICE<br/>• Batch State Machine<br/>• Participant Whitelist"]
        CQF["CQF ASSESSMENT SERVICE<br/>• Randomized Test Engine<br/>• Negative Marking Evaluator"]
    end
    FLINK["APACHE FLINK STREAM<br/>• post-publish-processor<br/>• BatchCreation.scala<br/>(Auto-Batch Suppression)"]
    subgraph PERS["PERSISTENCE TIER"]
        NEO[("Neo4j Graph Store<br/>• Hierarchy / Content<br/>• Category Metadata")]
        CAS[("Cassandra DB Cluster<br/>• sunbird_courses<br/>(course_batch, etc.)")]
        PG[("PostgreSQL & ES Cluster<br/>• Assessment Attempt Records<br/>• Analytics & Discovery Index")]
    end
    USERS -->|"Course Author"| UI1
    USERS -->|"Coordinator"| UI2
    USERS -->|"Candidate"| UI3
    PRES -->|"HTTPS / REST / Keycloak JWT"| KONG
    KONG --> CS
    KONG --> LMS
    KONG --> CQF
    CS -->|"Kafka (content.publish)"| FLINK
    FLINK --> NEO
    LMS --> CAS
    CQF --> PG
```

### 3.2 Multi-Tier Layered Architecture

The platform enforces a four-tier architecture separating presentation, gateway routing, service orchestration, and polyglot persistence:

```mermaid
flowchart TD
    L1["1. PRESENTATION LAYER<br/>• Angular / React Micro-frontends (portal-v8-fe)<br/>• Mobile Client (Flutter / Android / iOS Native Shell)<br/>• Route Interceptors: InviteOnlyGuard, Instruction Acknowledgment Modals"]
    L2["2. INGRESS & SECURITY LAYER<br/>• Kong API Gateway: Session validation, Keycloak token verification<br/>• Custom Plugins: Header enrichment (x-authenticated-userid, x-authenticated-rootorg)<br/>• Defense-in-Depth Route Gating (blocks direct requests lacking matching batch entitlements)"]
    L3["3. APPLICATION & MICROSERVICE LAYER<br/>• Content Service: Validates courseCategory against sunbird-cb-ext-schema<br/>• Knowledge Platform Flink Jobs: Intercepts post-publish events#59; evaluates trackable<br/>• LMS Course Service: Enforces enrollmentType: #quot;invite-only#quot;, participantList validation<br/>• CQF Assessment Service: Question weighting, 3X option randomization, single-sitting timer<br/>• Notification Service: Dispatches in-app / email notices upon cohort whitelisting"]
    L4["4. PERSISTENCE & STREAMING LAYER<br/>• Apache Kafka: Event topics (kafka.content.publish, kafka.telemetry)<br/>• Apache Cassandra: Primary LMS store (sunbird_courses.course_batch, user_enrolments)<br/>• Neo4j Graph Database: Digital object hierarchies (do_id, MIME types, taxonomy nodes)<br/>• PostgreSQL: Assessment attempt logs, submission telemetry, score calculation history<br/>• Elasticsearch: Tenant-isolated faceted search indexes"]
    L1 --> L2
    L2 --> L3
    L3 --> L4
```

## 4. End-to-End Enterprise Flow: Creation to Consumption

The end-to-end lifecycle spans four coordinated stages: Authoring & Categorization, Ingestion & Batch Suppression, Cohort Scheduling, and Gated Consumption.

```mermaid
flowchart TD
    subgraph S1["STAGE 1: AUTHORING (CBP)"]
        A1["• Content Creator sets Access: #quot;Custom Users#quot;.<br/>• Schema marks: courseCategory: #quot;Invite-Only Assessment#quot; or #quot;Invite-Only Program#quot;.<br/>• Defines pass marks, duration & negative marks.<br/>• Submits for Review."]
        O1["Drafting Complete"]
        A1 --> O1
    end
    subgraph S2["STAGE 2: INGESTION (FLINK)"]
        A2["• SPV Approves & Publishes<br/>• Kafka event published to content.publish topic.<br/>• Flink BatchCreation.scala detects #quot;Invite-Only#quot;.<br/>• Auto-batch creation bypassed (trackable=false).<br/>• Content node written to Neo4j graph store."]
        O2["Auto-Batch Suppressed"]
        A2 --> O2
    end
    subgraph S3["STAGE 3: SCHEDULING (COORD)"]
        A3["• Program Coordinator opens Scheduling Console.<br/>• Configures active window: startDate / endDate.<br/>• Uploads Candidate Cohort (CSV or UUID list).<br/>• LMS persists whitelist in Cassandra participantList.<br/>• Notifications triggered."]
        O3["Cohort Whitelisted"]
        A3 --> O3
    end
    subgraph S4["STAGE 4: CONSUMPTION (LEARNER)"]
        A4["• Invited Learner logs in#59; course appears in feed.<br/>• Uninvited Learner attempts direct link navigation.<br/>• Guard calls batch/read.<br/>• Uninvited: 403 Forbidden -#gt; #quot;Not Invited#quot; modal.<br/>• Invited: Acknowledges modal -#gt; Starts exam."]
        O4["Single-Sitting Exam Done"]
        A4 --> O4
    end
```

## 5. Subsystem Component Design

### 5.1 Authoring & Ingestion Subsystem (CBP to Flink)

#### Functional Flow & Responsibilities

1. **Access Setting Selection:** The Content Creator Portal provides an authoring toggle between public access (`All Users`) and restricted access (`Custom Users`).
2. **Taxonomy Schema Ingestion:** The `content-service` enforces schema constraints from `sunbird-cb-ext-schema`. For assessments, the schema validates:
  - `negativeMarkingPercentage`
  - `randomization`
  - `questionLevelDefinition`: JSON map with integer weightages across `easy`, `medium`, `tough`, `hard`, and `hot`.

3. **Flink Stream Pipeline Interception:** When a published content event lands on `kafka.content.publish`, the Apache Flink `post-publish-processor` runs `BatchCreation.scala`:

```mermaid
flowchart TD
    A["Content Publish Event Received"]
    B["Read #quot;courseCategory#quot; Field"]
    C{"Does #quot;courseCategory#quot; Contain #quot;Invite-Only#quot; (Case-Insensitive)?"}
    Y["Set trackable = false<br/>Log Suppression Event<br/>Skip Batch Creation"]
    N["Set trackable = true<br/>Invoke Course Service<br/>POST /v1/batch/create"]
    YE["Await Manual Scheduling"]
    NE["Open Batch Active"]
    A --> B
    B --> C
    C -->|"YES"| Y
    C -->|"NO"| N
    Y --> YE
    N --> NE
```

### 5.2 Cohort Scheduling Subsystem (Coordinator to LMS)

#### Functional Flow & Responsibilities

1. **Batch Instantiation:** Because automated batch generation was bypassed by Flink, the Program Coordinator explicitly instantiates a batch via the scheduling UI.
2. **Scheduling Validations:** The backend enforces temporal validity rules:
  - must match the coordinator's authorized MDO organization identifier.

3. **Cohort Whitelisting Ingestion:** The coordinator uploads participant identifiers (email/UUID list). The system parses and deduplicates records, invoking `POST /apis/proxies/v8/learner/course/v1/batch/participants/add`. The list is committed directly to Cassandra:

```sql
UPDATE sunbird_courses.course_batch
SET participantlist = participantlist + ['usr_id_01', 'usr_id_02'],
    updateddate = '2026-10-30 16:30:00+0530'
WHERE courseid = 'do_1140166196245217281288'
  AND batchid = '0139872149817234';
```

### 5.3 Consumption & Gating Subsystem (Learner to Engine)

#### Functional Flow & Responsibilities

1. **Search Catalog Filtering:** The Elasticsearch search query pipeline filters out any content where `courseCategory` contains `"Invite-Only"`, unless the learner's `userId` matches an active batch enrollment.
2. **Deep-Link Route Guarding** (`InviteOnlyGuard`): When a learner navigates directly to a URL (e.g., `/app/toc/do_1140166196245217281288/overview`), the client router executes a pre-activation check against the LMS:
  - **Invited Learner:** `userId` exists in `participantList`. System returns `200 OK`; TOC and player render normally.
  - **Uninvited Learner:** `userId` not found in `participantList`. System returns `403 Forbidden`; router halts navigation and renders the **"You are not invited"** modal.

3. **Single-Sitting Assessment Execution:**
  - Once launched, the CQF service creates an active attempt session with an immutable start timestamp.
  - Questions and multiple-choice options undergo seed-based 3X randomization.
  - Pausing is prohibited; navigating away or closing the tab submits the exam automatically.
  - Final score computation applies negative marking:

## 6. End-to-End Sequence Diagram

```mermaid
sequenceDiagram
    participant CA as Content Author
    participant CBP as CBP Portal
    participant KG as Kong Gateway
    participant CF as Content / Flink
    participant CS as Course Service
    participant LP as Learner Portal
    participant AS as Assessment Svc
    CA->>CBP: 1. Set "Custom" & Publish
    CBP->>KG: 2. POST /publish
    KG->>CF: 3. Ingest Event
    Note over CF: 4. Flink check:<br/>Invite-Only?<br/>Trackable=false<br/>(Bypass batch)
    Note over CA,AS: Coordinator Configures Batch & Whitelist
    KG->>CS: 5. POST /batch/create & /add
    Note over CS: 6. Commit to<br/>Cassandra<br/>participantList
    Note over CA,AS: Learner Navigates via Direct Link
    LP->>KG: 7. GET /batch/read
    KG->>CS: 8. Check Whitelist in Cassandra
    KG-->>LP: 9. Case A: Not Whitelisted -> 403 Forbidden
    Note over LP: Render "Not<br/>Invited" Modal
    KG-->>LP: 10. Case B: Whitelisted -> 200 OK
    KG->>AS: 11. POST /action/assessment/v3/start
    AS-->>KG: 12. Randomized Test & Timer
    KG->>AS: 13. POST /action/assessment/v3/submit
    AS-->>KG: 14. Compute Net Score & Save
```

## 7. Data Architecture & Persistence Topology

```mermaid
flowchart TD
    subgraph PT["PERSISTENCE TOPOLOGY"]
        NEO["Neo4j Knowledge Graph<br/>• Node: Content (do_id)<br/>• courseCategory: #quot;Invite-Only#quot;<br/>• mimeType: questionset<br/>• accessSettings: #quot;Custom Users#quot;"]
        CAS[("Apache Cassandra Cluster<br/>• Keyspace: sunbird_courses<br/>• Table: course_batch<br/>- enrollmenttype: #quot;invite-only#quot;<br/>- participantlist: list#lt;text#gt;<br/>• Table: user_enrolments")]
        ES["Elasticsearch Discovery Cluster<br/>• Index: composite-search<br/>• Suppressed from global public<br/>catalog search results<br/>• Surfaced only in user feed"]
        PG[("PostgreSQL Relational Cluster<br/>• Table: assessment_attempts<br/>• Table: assessment_submissions<br/>• Stores answers, duration,<br/>penalty deductions, pass state")]
        NEO --> ES
        CAS --> PG
    end
```

### 7.1 Primary Entity Relationships

```mermaid
flowchart TD
    CN["CONTENT_NODE<br/>* identifier (do_id)<br/>courseCategory<br/>mimeType<br/>trackable<br/>negativeMarkingPct<br/>overallPassMarks"]
    CB["COURSE_BATCH<br/>* courseid (FK)<br/>* batchid (PK)<br/>enrollmenttype<br/>startdate / enddate<br/>participantlist (List)<br/>createdfor (MDO Org)"]
    UE["USER_ENROLMENT<br/>* userid (PK)<br/>* courseid (FK, PK)<br/>* batchid (FK, PK)<br/>status (0, 1, 2)<br/>completionpercentage<br/>enrolleddate"]
    CN ---|"1 : N"| CB
    CB ---|"1 : N"| UE
```

## 8. Network, Security, and Infrastructure Architecture

### 8.1 Network Ingress & Gateway Routing

All traffic from web and mobile clients routes through standard ingress controllers to the Kong Enterprise API Gateway:

- **SSL/TLS Termination:** TLS 1.3 enforced at Kong ingress.
- **Authentication Plugin:** Intercepts incoming `Authorization: Bearer <JWT>` tokens, validates signatures against Keycloak public keys, and decodes user identity claims.
- **Header Enrichment:** Kong injects verified claims into downstream request headers:
  - `x-authenticated-userid`: Civil servant user UUID.
  - `x-authenticated-rootorg`: Tenant MDO organization identifier.

### 8.2 Security & Access Control Policies

```mermaid
flowchart TD
    subgraph SDL["SECURITY DEFENSE LAYERS"]
        L1["Layer 1: Ingress Authentication (Kong + Keycloak)<br/>Validates JWT token integrity and expiration. Unauthenticated requests rejected with 401."]
        L2["Layer 2: MDO Tenancy Validation (Course Service)<br/>Ensures Coordinators can only manage batches for their assigned MDO (createdFor boundary match)."]
        L3["Layer 3: Participant Whitelist Gating (LMS & Client Route Guard)<br/>Deep links evaluate userId in participantList. Non-whitelisted users receive 403 Forbidden."]
        L4["Layer 4: Anti-Tamper Assessment Engine (CQF Service)<br/>Prevents answer tampering, validates timer bounds, and enforces single-sitting completion."]
        L1 ~~~ L2
        L2 ~~~ L3
        L3 ~~~ L4
    end
```

## 9. Traceability Matrix & Architectural Invariants

| Invariant / Requirement | Description | Enforcing Component | Persistence Target |
|---|---|---|---|
| **INV-01: Zero Public Discovery** | Invite-only content must not appear in open public catalog search queries. | `content-service` / Elasticsearch filter | `composite-search` index |
| **INV-02: Auto-Batch Suppression** | Ingestion pipeline must bypass open batch generation for invite-only assets. | `post-publish-processor` (`BatchCreation.scala`) | Kafka stream event state |
| **INV-03: Temporal Scheduling** | Enrollment and consumption must strictly respect `startDate` and `endDate`. | `sunbird-course-service` | `sunbird_courses.course_batch` |
| **INV-04: Deep-Link Gating** | Uninvited learners accessing direct URLs must be blocked with an informative modal. | `portal-v8-fe` (`InviteOnlyGuard`) & Course Service | Client router state |
| **INV-05: Single-Sitting Integrity** | Assessments cannot be paused or restarted after initiation. | `cqf-assessment-service` | PostgreSQL `assessment_attempts` |
| **INV-06: Strict Negative Marking** | Penalties must deduct from score based on configured percentage. | `cqf-assessment-service` scoring engine | PostgreSQL `assessment_submissions` |
