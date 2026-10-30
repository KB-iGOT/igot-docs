# Moderated Course — High-Level Design (HLD)

## 1. Executive & Architectural Summary

The **Moderated Course** capability is an enterprise-grade access-control, content governance, and publishing framework on the **iGOT Karmayogi Platform**. It solves two core architectural and administrative challenges:

1. **Content Sovereignty & Access Gating:** Enforcing strict boundaries so that specialized or sensitive departmental learning is restricted to authorized cadres based on **Ministry/Department/Organization (MDO)** association and an authoritative, MDO-vetted **"Verified Karmayogi"** badge.
2. **Decentralized Operational Velocity:** Bypassing central SPV publishing gating to allow individual MDO Content Publishers to approve and push departmental learning live immediately.

This HLD document details the comprehensive evolution from **Q2 through Q13**, presenting end-to-end architecture, context diagrams, microservice interconnections, sequence workflows, data flows, and security boundaries spanning both **Creation (Authoring/Publishing)** and **Consumption (Discovery/Enrollment/Playback/Telemetry/Unenrollment)** from frontend to backend.

## 2. Evolution Roadmap & Architectural Timeline (Q2 to Q13)

```mermaid
---
title: FEATURE EVOLUTION ROADMAP (Q2 - Q13)
---
flowchart TD
    subgraph SQ2["Q2 (Sprint 8 - Late 2023)"]
        Q2["• KB-337 / KB-338: Verified Karmayogi Gating<br/>• KB-355: Decentralized MDO Publishing (Bypass SPV)<br/>• KB-922 / KB-926: Asynchronous Profile Verification Workflow"]
    end
    subgraph SQ37["Q3 - Q7 (2024)"]
        Q37["• KB-2219: Taxonomy Extension<br/>- Moderated Programs<br/>- Moderated Assessments<br/>• KB-2559 / KB-3002: Anti-Leak Sharing Suppression (DOM Share icon stripped on Web & Mobile)"]
    end
    subgraph SQ810["Q8 - Q10 (2025)"]
        Q810["• Batch Governance: Single active batch invariant per MDO<br/>• enrollment_batch_lookup integration in Cassandra<br/>• org_eligibility_alias in ES<br/>• Daily deduplication jobs"]
    end
    subgraph SQ1112["Q11 - Q12 (Mid 2026 - Lifecycle)"]
        Q1112["• KB-14518 / Sprint 39: Moderated Course Unenrollment<br/>• Cassandra Audit Logging: enrollment_history_by_action<br/>• KB-14236: Deterministic ITSM Chatbot Access Triage"]
    end
    subgraph SQ13["Q13 (Late 2026 - Scalability)"]
        Q13["• KB-15266: Wildcard [#quot;*#quot;] Org Payload Compression<br/>• Multi-select Category Pills UI<br/>• Zero-leak Search Strip Performance Optimizations"]
    end
    Q2 --> Q37
    Q37 --> Q810
    Q810 --> Q1112
    Q1112 --> Q13
```

## 3. Diagram 1: High-Level System Context Diagram (C4 Level 1)

This diagram establishes the external actors, client surfaces, core platform boundaries, and enterprise integration touchpoints.

```mermaid
---
title: SYSTEM CONTEXT DIAGRAM (LEVEL 1)
---
flowchart TD
    subgraph ACT["ACTORS / ROLES"]
        A1["CBP Content Creator<br/>& Author"]
        A2["MDO Content Reviewer<br/>& Publisher"]
        A3["MDO Administrator<br/>(Nodal Approver)"]
    end
    subgraph PT["PORTAL / CLIENT TIER"]
        P1["CBP Authoring Portal"]
        P2["MDO Admin Portal"]
        P3["Learner Web & Mobile App"]
    end
    A1 --> PT
    A2 --> PT
    A3 --> PT
    subgraph PB["iGOT KARMAYOGI PLATFORM BOUNDARY"]
        GW["API Gateway & Security Proxy (sunbird-cb-uiproxy)<br/>- Token validation, Keycloak signature verification, Profile Claims Injection"]
        CS["Course & Batch<br/>Microservice<br/>(sunbird-course-svc)"]
        CM["Content Management<br/>Microservice<br/>(sunbird-content-svc)"]
        SD["Search & Discovery<br/>Microservice<br/>(search-service)"]
        DB[("Core Persistence Layer<br/>- Cassandra (user_enrolments_v2, enrollment_history_by_action, batch_lookup)<br/>- Elasticsearch (kp_content_alias, org_eligibility_alias)<br/>- PostgreSQL (User Profiles, MDO Directory, Workflow State Store)")]
        ST["Streaming Telemetry & Asynchronous Workers (Kafka + Apache Flink Pipeline)<br/>- dev.telemetry.raw -> Real-time Leaf Node Progress Evaluation -> Certificate Generation"]
        GW --> CS
        GW --> CM
        GW --> SD
        CS --> DB
        CM --> DB
        SD --> DB
        DB --> ST
    end
    PT -->|"HTTPS / TLS 1.3<br/>Authenticated via Bearer JWT"| GW
    KC["Keycloak IAM<br/>- Identity Tokens, Realm Roles,<br/>User Account Lifecycle"]
    IT["ITSM Chatbot Engine<br/>- KB-14236 Deterministic<br/>Access Verification"]
    PB --> KC
    PB --> IT
```

## 4. Diagram 2: Multi-Tier Microservice Architecture (C4 Level 2)

This diagram details the concrete microservices, internal communication pathways, protocols, and data stores across both creation and consumption paths.

```mermaid
---
title: CONTAINER & MICROSERVICE ARCHITECTURE
---
flowchart TD
    subgraph FE["FRONTEND WEB & MOBILE CONTAINERS"]
        F1["CBP Creation App (Angular SPA)<br/>- Metadata & secureSettings Builder<br/>- Direct MDO Publisher Routing"]
        F2["MDO Admin Portal (Angular SPA)<br/>- Verification Workflow Inbox<br/>- Cadre Mapping & Roster"]
        F3["Learner Web / Mobile (React/RN)<br/>- Search Strips & Category Hub<br/>- TOC Player & Gated Enroll CTA"]
    end
    GW["API GATEWAY CONTAINER: sunbird-cb-uiproxy<br/>- Keycloak Token Decoding & Verification<br/>- Session Profile Cache Lookup (Redis)<br/>- Claims Injection Headers: X-User-Id, X-User-RootOrg-Id, X-User-IsVerified"]
    F1 --> GW
    F2 --> GW
    F3 -->|"HTTPS / REST (JWT)"| GW
    CT["CONTENT SERVICE<br/>(sunbird-content-service)<br/>- Node CRUD & Hierarchy Generator<br/>- Direct MDO Publishing Engine<br/>- Token-gated leaf asset delivery"]
    SS["SEARCH SERVICE<br/>(search-service)<br/>- Query Parser & Facet Filter<br/>- SecureSettings Evaluator<br/>- kp_content_alias Search"]
    CO["COURSE SERVICE<br/>(sunbird-course-service)<br/>- Auto-Batch Engine & Single-Batch<br/>- MDO & Badge Enrolment Gatekeeper<br/>- Sprint 39 Unenrollment Controller"]
    GW -->|"(Creation / Publishing)"| CT
    GW -->|"(Discovery)"| SS
    GW -->|"(Enrol / Unenrol)"| CO
    subgraph DBT["DATABASE & PERSISTENCE TIER"]
        ES[("Elasticsearch Cluster<br/>- kp_content_alias (Content Nodes)<br/>- org_eligibility_alias<br/>- Wildcard #quot;*#quot; index evaluation")]
        CA[("Apache Cassandra Cluster<br/>- user_enrolments_v2<br/>- enrollment_history_by_action<br/>- enrollment_batch_lookup")]
        PG[("PostgreSQL DB (User Directory)<br/>- User Master Profile records<br/>- is_verified_karmayogi flag<br/>- Workflow request state engine")]
    end
    CT --> DBT
    SS --> DBT
    CO --> DBT
    subgraph TEL["TELEMETRY, EVENT STREAMING & ASYNCHRONOUS PIPELINE"]
        T1["Learner Player Telemetry"] --> T2["Kafka: dev.telemetry.raw"]
        T2 --> T3["Apache Flink Cluster"]
        T3 --> T4["user_enrolments_v2 (Progress)"]
        U1["Unenrollment Event"] --> U2["Kafka: dev.user.unenrolment.event"]
        U2 --> U3["Audit & Telemetry Consumers"]
    end
    CA --> TEL
```

## 5. Diagram 3: End-to-End Course Creation & Publishing Flow

This sequence diagram illustrates the complete workflow when an MDO Content Creator authors a course, configures access parameters, and passes it through the decentralized publishing pipeline (bypassing central SPV).

```mermaid
---
title: COURSE CREATION & PUBLISHING SEQUENCE DIAGRAM
---
sequenceDiagram
    participant CC as Content Creator
    participant RV as MDO Content Reviewer
    participant PB as MDO Content Publisher
    participant UI as CBP Authoring UI
    participant GW as API Gateway
    participant CS as Content Service
    participant ES as Search (ES)
    participant CO as Course Service
    CC->>UI: 1. Create Course<br/>(Title, Curriculum)
    CC->>UI: 2. Configure Access<br/>accessSetting: mdo<br/>secureSettings: #123;<br/>org: #91;MDO_1, MDO_2#93;,<br/>isVerified: "Yes"<br/>#125;
    CC->>UI: 3. Save as Draft
    UI->>GW: POST /content/v1<br/>(Payload + Claims)
    GW->>CS: Validate JWT<br/>Forward Request
    CS->>ES: Persist Node<br/>(Status: Draft)
    CS-->>GW: 200 OK Response
    GW-->>UI: Draft Created
    CC->>UI: 4. Send for Review
    UI->>GW: POST /review
    GW->>CS:
    CS->>CS: State Transition<br/>(Under Review)
    RV->>GW: 5. Approves CQS Quality Score & Content
    GW->>CS:
    PB->>UI: 6. Trigger Publish<br/>(Direct Go-Live)
    UI->>GW: POST /publish<br/>(KB-355: Bypasses<br/>Central SPV)
    GW->>CS:
    CS->>CS: Update Status:<br/>"Live"
    CS->>ES: Index Node<br/>(kp_content)
    ES->>CO: Sync Alias
    CS->>CO: Emit Publish Event to Kafka
    CO->>CO: Auto-Batch Engine:<br/>Create open batch<br/>Bind to MDO list<br/>Persist lookup
    CO-->>CS:
    CS-->>GW: 200 OK Response
    GW-->>UI: Published (Live)
```

## 6. Diagram 4: Learner Profile Verification Flow (Verified Karmayogi)

This diagram details the asynchronous attestation flow that upgrades a learner from an unverified self-registered account to an authoritative **"Verified Karmayogi"** eligible for moderated courses ([KB-920](https://karmayogibharat.atlassian.net/browse/KB-920), [KB-922](https://karmayogibharat.atlassian.net/browse/KB-922), [KB-926](https://karmayogibharat.atlassian.net/browse/KB-926)).

```mermaid
---
title: VERIFIED KARMAYOGI PROFILE ATTESTATION WORKFLOW
---
sequenceDiagram
    participant L as Learner Web UI
    participant GW as API Gateway
    participant US as User Microservice
    participant WF as Workflow Service
    participant MA as MDO Admin Portal
    L->>GW: 1. Complete Profile<br/>(Designation, Cadre,<br/>Employee ID, MDO)
    L->>GW: 2. Click "Earn Badge"<br/>(Request Verification)
    GW->>US: PATCH /extPatch<br/>#123; isVerified: true #125;
    US->>WF: Security Guard:<br/>Block direct patch#59;<br/>Instantiate workflow
    WF->>MA: Create Pending Task<br/>(Inbox: New Request)
    US-->>GW: 202 Accepted
    GW-->>L: Request Queued
    GW-->>L: Toast: Pending Admin
    Note over MA: MDO Administrator
    MA->>WF: Reviews Credentials
    MA->>WF: Transition: APPROVE<br/>POST /workflow/v1
    WF->>US: Persist Verified<br/>isVerified = true<br/>(Postgres & Redis)
    L->>GW: 3. Next Session Login
    GW->>US: GET /user/profile
    US-->>GW: Profile Payload<br/>#123; isVerified: true #125;
    GW-->>L: Renders Verified Badge & Unlocks Moderated Search
```

## 7. Diagram 5: End-to-End Learner Consumption Lifecycle

This comprehensive sequence diagram illustrates the learner's journey through **Discovery, Enrolment, Playback, Telemetry Ingestion, Completion, and Unenrollment**.

```mermaid
---
title: END-TO-END LEARNER CONSUMPTION LIFECYCLE
---
sequenceDiagram
    participant L as Learner Client
    participant GW as API Gateway
    participant SS as Search Service
    participant CS as Course Service
    participant CP as Content Player
    participant FC as Flink / Cassandra
    Note over L,FC: 1. DISCOVERY PHASE
    L->>GW: POST /v4/search<br/>(Category Filters)
    GW->>SS: Injects Identity<br/>Claims: #123;Org, Badge#125;
    SS->>CS: Evaluates ES Query<br/>Matches secureSetts
    CS-->>SS: Only Allowed Nodes
    SS-->>GW: Filtered Results
    GW-->>L: Returns Course Cards<br/>(Share icon HIDDEN)
    Note over L,FC: 2. ENROLMENT PHASE
    L->>GW: Click "Enroll"
    GW->>CS: POST /course/enrol<br/>(courseId, batchId)
    CS->>CS: Validate Claims:<br/>- UserOrg in SecSet<br/>- Badge Verified
    CS->>CS: Single-Batch Check
    CS->>FC: Write Cassandra<br/>user_enrolments_v2
    Note over FC: Insert:<br/>user_enrolments_v2
    CS-->>GW: 200 OK SUCCESS
    GW-->>L: Enrolled Successfully
    Note over L,FC: 3. CONSUMPTION & PROGRESS
    L->>GW: Launch Player
    GW->>CP: GET /hierarchy<br/>(Validate Enrolment)
    CP->>CP: Stream Assets<br/>(Signed URLs)
    CP-->>GW:
    GW-->>L: TOC & Resource URLs
    L->>GW: Emit Telemetry Progress<br/>(INTERACT, ASSESS)
    GW->>CP:
    CP->>FC: Kafka Stream<br/>dev.telemetry
    FC->>FC: Flink updates %<br/>in Cassandra
    Note over L,FC: 4. UNENROLLMENT (Sprint 39)
    L->>GW: Click "Unenroll"
    GW->>CS: POST /course/unenrol
    CS->>FC: Set active = false
    Note over FC: Cassandra:<br/>user_enrolments_v2
    CS->>FC: Append Audit Log
    Note over FC: (enrollment_history)<br/>history_by_action
    CS-->>GW: 200 OK Response
    GW-->>L: Unenrolled Confirmed
```

## 8. Diagram 6: Security & Access Control Boundaries

This diagram illustrates how four defensive layers isolate unauthorized users from viewing or consuming restricted content.

```mermaid
---
title: FOUR-TIER ZERO-TRUST SECURITY ENVELOPE
---
flowchart TD
    X1["UNAUTHORIZED ACTOR<br/>- No active session token"]
    X2["CROSS-MDO ACTOR<br/>- Authenticated#59; foreign MDO"]
    X3["UNVERIFIED SAME-MDO ACTOR<br/>- Valid MDO#59; unverified profile"]
    L1["LAYER 1: API GATEWAY AUTHENTICATION & CLAIM INJECTION (sunbird-cb-uiproxy)<br/>- Validates Bearer JWT signature against Keycloak Public Key Cache.<br/>- Injects trusted internal headers: x-user-id, x-user-root-org-id, x-user-is-verified.<br/>- Drops any client-spoofed claims."]
    L2["LAYER 2: SEARCH QUERY SANDBOXING & FACET ENFORCEMENT (search-service)<br/>- Intercepts POST /v4/search. Injects mandatory Elasticsearch bool filter:<br/>MUST NOT match Moderated Course UNLESS:<br/>(secureSettings.organisation CONTAINS user.rootOrgId OR #quot;*#quot;)<br/>AND (secureSettings.isVerifiedKarmayogi == #quot;No#quot; OR user.isVerified == true)<br/>- Cross-MDO and Unverified users receive ZERO search hits (Total Information Concealment)."]
    L3["LAYER 3: BATCH ENROLMENT & TOC GATING (sunbird-course-service)<br/>- If a direct URL is entered by an unauthorized user:<br/>* TOC CTA displays restriction notice#59; leaf node hierarchy generation is blocked.<br/>* POST /course/v1/enrol evaluates courseCategory against user claims.<br/>* Rejects illegal calls with HTTP 403 Forbidden (USER_NOT_ELIGIBLE_FOR_MODERATED_COURSE)."]
    L4["LAYER 4: ASSET DELIVERY & TELEMETRY STREAM GATING (sunbird-content-service)<br/>- Content player assets (video chunks, PDFs, Assessment question items) stream only via short-lived signed URLs.<br/>- Signed tokens issued only after verifying active = true in Cassandra user_enrolments_v2.<br/>- DOM Share icon suppressed to prevent unauthorized deep-link distribution (KB-2559 / KB-3002)."]
    X1 --> L1
    X2 --> L1
    X3 --> L1
    L1 --> L2
    L2 --> L3
    L3 --> L4
```

## 9. Diagram 7: Data Flow Diagram (DFD Level 1)

This diagram details the movement and transformation of data across creation, publication, indexing, enrollment, telemetry, and unenrollment audit pipelines.

```mermaid
---
title: DATA FLOW DIAGRAM (LEVEL 1)
---
flowchart TD
    CBP["CBP Authoring Tool"]
    P1["Process 1.0<br/>Content Authoring & Ingestion"]
    P2["Process 2.0<br/>Search Index Synchronization"]
    P3["Process 3.0<br/>Batch Provisioning Engine"]
    DES[("(D_ES) Elasticsearch: kp_content")]
    DCB[("(D_CASS) Cassandra: batch_lookup")]
    P4["Process 4.0<br/>Learner Discovery Gating"]
    P5["Process 5.0<br/>Enrolment & Lifecycle Gate"]
    DPG[("(D_PG) PostgreSQL: User Directory")]
    LP["Learner Portal / Mobile App"]
    P6["Process 6.0<br/>Telemetry Progress Processing"]
    DUE[("(D_CASS) user_enrolments_v2 & history")]
    CBP -->|"(D1) Course Metadata & secureSettings JSON"| P1
    P1 -->|"(D2) Live Content Event Payload"| P2
    P1 -->|"(D2) Live Content Event Payload"| P3
    P2 -->|"(D3) Index Document"| DES
    P3 -->|"(D4) Single Open Batch Record"| DCB
    P4 -->|"(D5) Filtered Search Query"| DES
    DCB -->|"(D6) Batch Validation"| P5
    DPG -->|"(D7) User Profile & Claims"| P4
    LP -->|"(D8) Enrol / Unenrol Call"| P5
    LP -->|"(D9) Telemetry Events (INTERACT, ASSESS)"| P6
    P6 -->|"(D10) Progress % Update / Audit Row"| DUE
```

## 10. Diagram 8: Telemetry, Streaming & Progress Calculation Architecture

This diagram illustrates how learner interactions are converted into progress tracking, certificate generation, and compliance reporting.

```mermaid
---
title: STREAMING TELEMETRY & PROGRESS PIPELINE
---
flowchart TD
    CP["Content Player (Web / Android / iOS)<br/>- Emits Sunbird Telemetry v3 JSON:<br/>START, INTERACT, ASSESS, END"]
    IG["Ingestion Gateway (telemetry-service)<br/>- Validates event schema & envelope"]
    K1["Apache Kafka Topic: dev.telemetry.raw"]
    FL["Apache Flink Streaming Processing Cluster<br/>- 30-Second Tumbling Window Aggregation<br/>- Filters events by courseCategory == #quot;Moderated Course#quot;<br/>- Calculates unique leaf-node completions against content hierarchy graph<br/>- Derives completionpercentage = (completedLeafNodes / totalLeafNodes) * 100"]
    CA[("Cassandra: user_enrolments_v2<br/>- progress: #lt;integer#gt;<br/>- completionpercentage: #lt;double#gt;<br/>- lastreadcontentid: #lt;string#gt;")]
    K2["Apache Kafka: dev.course.completion"]
    CG["Certificate Generation Service<br/>- Issues encrypted, verifiable credential<br/>- Updates issued_certificates in Cassandra"]
    CP -->|"POST /apis/proxies/v8/telemetry"| IG
    IG -->|"High-throughput event ingestion"| K1
    K1 -->|"Stream Consumer Group"| FL
    FL -->|"Updates Progress"| CA
    FL -->|"When progress == 100%"| K2
    K2 --> CG
```

## 11. Diagram 9: Component Interaction & Data Invariant Model

This entity-relationship and state invariant diagram illustrates the structural integrity guarantees enforced across the Moderated Course ecosystem.

```mermaid
---
title: DATA MODEL & SYSTEM INVARIANTS
---
flowchart TD
    CN["CONTENT_NODE (Elasticsearch/Neo4j)<br/>PK identifier : string<br/>name : string<br/>courseCategory : string<br/>accessSetting : #quot;mdo...#quot;<br/>secureSettings : jsonb<br/>- organisation : [#quot;*#quot;]<br/>- isVerified : #quot;Yes#quot;<br/>status : #quot;Live#quot;"]
    CB["COURSE_BATCH (Cassandra)<br/>PK batchId : string<br/>FK courseId : string<br/>enrollmentType : #quot;open#quot;<br/>createdFor : list#lt;str#gt;<br/>status : int"]
    UP["USER_PROFILE (PostgreSQL)<br/>PK id : string<br/>root_org_id : string<br/>is_verified_karmayogi : boolean<br/>designation : string<br/>department_name : string"]
    UE["USER_ENROLMENTS_V2 (Cassandra)<br/>PK userId : string<br/>PK courseId : string<br/>PK batchId : string<br/>active : boolean<br/>progress : int<br/>completionpercentage : double"]
    WR["WORKFLOW_REQUEST (PostgreSQL)<br/>PK workflowId : string<br/>FK userId : string<br/>requestType : #quot;VERIFY#quot;<br/>status : #quot;APPROV#quot;<br/>approvedBy : string"]
    EH["ENROLLMENT_HISTORY_BY_ACTION (Cass)<br/>PK userId : string<br/>PK action : string<br/>PK actiondate : timestamp<br/>courseId : string<br/>progress : int"]
    CN ---|"1 — 1"| CB
    CN ---|"1 — *"| UP
    CB ---|"1 — *"| UE
    UP ---|"1 — *"| UE
    UP ---|"1 — *"| WR
    UE ---|"1 — *"| EH
```

**SYSTEM INVARIANTS & INTEGRITY CONSTRAINTS:**

1. Single Batch Rule: Exactly one active batch per Moderated Course (verified via enrollment_batch_lookup).
2. Publishing Authority: Moderated Courses bypass SPV queue; status transition to Live requires MDO Publisher role.
3. Wildcard Normalization: secureSettings.organisation containing "*" satisfies all authenticated user org queries.
4. Unenrollment Audit: Every unenrollment must append an immutable action row to enrollment_history_by_action.
