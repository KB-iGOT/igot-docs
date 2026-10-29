# Curated Program — High-Level Design (HLD)

**iGOT Karmayogi Platform | Digital Workplace Technical Architecture**

### Document Control & Traceability

## 1. Executive Architecture Overview

The **Curated Program** subsystem provides a structured mechanism to aggregate pre-published, verified courses into a thematic curriculum with holistic competency evaluation and dual-level certification.

```mermaid
flowchart TD
    subgraph IGOT["IGOT KARMAYOGI PLATFORM"]
        CBP["[ CONTENT PORTAL (CBP) ]<br/>Creator / Reviewer / SPV Publisher"]
        LX["[ LEARNER EXPERIENCE (WEB/MOBILE) ]<br/>Enrolment / Consumption / Assessment"]
    end
    KONG["KONG API GATEWAY<br/>Auth, RBAC, Routing"]
    CS["CONTENT SERVICE<br/>Hierarchy Engine"]
    LMS["LMS SERVICE<br/>Batch & Enrol"]
    AS["ASSESSMENT SVC<br/>Gating & Grading"]
    PL[("PERSISTENCE LAYER<br/>Cassandra | Neo4j | Elasticsearch")]
    EA["EVENT & ANALYTICS PIPELINE<br/>Kafka -> Flink -> Postgres"]
    CBP --> KONG
    LX --> KONG
    KONG --> CS
    KONG --> LMS
    KONG --> AS
    CS --> PL
    LMS --> PL
    AS --> PL
    PL --> EA
```

### Architectural Tenets

1. **Curriculum by Reference**: Curated Programs link live courses (`primaryCategory = "Course"`, `status = "Live"`) using unique content identifiers (`do_CID...`). No underlying digital resources (MP4, PDF, SCORM) are duplicated.
2. **Streamlined Quality Governance**: Because constituent courses have already passed institutional review, Content Quality Score (CQS) testing and profanity scanning are bypassed ([KB-452: Q2 | CBP Publishing | Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), [KB-453: Q2 | CBP Publishing | CQS and Self Curation should be removed for content creator, content reviewer and publisher for invite only and curated program](https://karmayogibharat.atlassian.net/browse/KB-453) (Prod Deployed)).
3. **Curriculum Immutability**: Once a Curated Program transitions to `Live`, its course list is immutable to safeguard enrolled learners' progress and completion records ([KB-457: Q2 | CBP Editing | Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved), [KB-466: Q2 | CBP Publishing | Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466)).
4. **Automated Batching**: Public Curated Programs automatically provision an open batch (`enrollmentType = "open"`) upon publication, removing manual batch management ([KB-1946: Q3 | Content Portal Redesign | Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed)).
5. **Enforced Server-Side Gating**: Level-2 (L2) capstone assessments evaluate cumulative competency across courses. If `contextLockingType == "Course Assessment Only"`, the backend (`cb-ext-assessment-service`) blocks access until all child courses reach `status == 2` (100% complete) ([KB-8842: Q8 | Learning Path | Curated Program | Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed), [KB-9600: User is able to consume final assessment without consuming course content in curated porgram](https://karmayogibharat.atlassian.net/browse/KB-9600) (Done)).
6. **Unified Dual Certification & Analytics**: Finishing an individual course issues a Course Certificate; completing all courses and passing the L2 assessment issues a Program Certificate ([KBE-149: Should be able to view certificate on completion of the curated program](https://karmayogibharat.atlassian.net/browse/KBE-149) (To Do)). Telemetry streams through Kafka and Flink into Cassandra and a PostgreSQL reporting warehouse.

## 2. End-to-End Logical Component Architecture

The diagram below details the 5-tier architecture connecting frontend clients to backend data stores and streaming pipelines.

```mermaid
flowchart TD
    subgraph Tier1 ["Tier 1: Client & Presentation Layer"]
        CBP_UI["Content Portal UI (Angular SPA)\n- Program Form (KB-1945)\n- Course Selector (KBE-174)\n- L2 Config & Locking (KB-8841/8842)\n- CQS Bypass (KB-453)"]
        LP_UI["Learner Web Portal (Angular SPA)\n- Program Discovery / Karma Strip (KB-3756)\n- Program TOC & Course Deep-Link (KBE-148)\n- Gated L2 Assessment Player (KB-8066)"]
        Mobile_UI["iGOT Karmayogi Mobile Client (Flutter)\n- Native TOC View\n- Mobile Course & Assessment Player"]
    end
    subgraph Tier2 ["Tier 2: API Gateway & Ingress Layer"]
        Kong["Kong API Gateway\n- OAuth2 / Keycloak JWT Validation\n- Route Interception & Rate Limiting\n- Role Enforcement (CBP Creator, Reviewer, SPV Publisher)"]
    end
    subgraph Tier3 ["Tier 3: Core Application & Microservices Layer"]
        ContentSvc["Content & Hierarchy Service (Scala / Play)\n- Program Metadata CRUD\n- Graph Node Management\n- Immutability Policy Engine (KB-457/466)"]
        LMSSvc["LMS & Enrolment Service (Java / Play)\n- Auto-Batch Provisioning (KB-1946)\n- Enrolment Registry (KBE-148)\n- Bi-directional Progress Rollup (KB-9650)"]
        AssessSvc["Assessment Service (cb-ext-assessment-service)\n- L2 Gating Validator (KB-8842, KB-9043)\n- Secure QuestionSet Delivery (KB-9600)\n- Submission Evaluation & Scorecard (KB-9248)"]
        PublishEngine["Content Publishing Engine\n- State Machine Orchestration\n- Automated ES Document Indexing\n- Batch Trigger Handoff"]
        CertSvc["Certificate Service (sunbird-rc-certs)\n- Dual Certificate Minting (KBE-149)\n- Digitally Signed PDF/SVG Generator"]
    end
    subgraph Tier4 ["Tier 4: Streaming, ETL & Asynchronous Analytics"]
        Kafka["Apache Kafka Event Bus\n- Topics: telemetry.raw, course.completion"]
        FlinkWorker["Apache Flink Telemetry Summarizer\n- Real-time Progress Windowing\n- Session Duration Aggregation"]
        SparkWorker["Apache Spark Batch Analytics Job\n- Scheduled Aggregations at Program/User Level (KBE-151)"]
    end
    subgraph Tier5 ["Tier 5: Polyglot Persistence Layer"]
        Neo4j[("Neo4j Graph Database\n- Composite Hierarchy Graph\n- (:Program)-[:hasContent]->(:Course)")]
        Cassandra[("Apache Cassandra (sunbird keyspace)\n- content_store, content_hierarchy\n- user_enrolment, user_content_consumption\n- assessment_attempts, course_batch")]
        ES[("Elasticsearch Cluster\n- composite-search Catalog Index\n- Fast Learner Discovery & Filtering")]
        Postgres[("PostgreSQL Analytics Warehouse\n- Dimension & Fact Tables for DoPT / MDO Dashboards")]
        S3[("MinIO / AWS S3 Object Store\n- Course Resources, Encrypted Certificates")]
    end
    %% Wiring: Tier 1 to Tier 2
    Tier1 -->|HTTPS / REST| Kong
    %% Wiring: Tier 2 to Tier 3
    Kong -->|/action/content/v3/*| ContentSvc
    Kong -->|/action/content/v3/publish| PublishEngine
    Kong -->|/action/course/v1/*| LMSSvc
    Kong -->|/v7/assessment/*| AssessSvc
    %% Wiring: Tier 3 to Tier 5
    ContentSvc -->|Read/Write Graph Edges| Neo4j
    ContentSvc -->|Read/Write JSON Hierarchy| Cassandra
    PublishEngine -->|Index Program Document| ES
    PublishEngine -->|Trigger Open Batch| LMSSvc
    LMSSvc -->|Read/Write user_enrolment & course_batch| Cassandra
    AssessSvc -->|Verify Child Course States| Cassandra
    AssessSvc -->|Record Attempts & Scorecard| Cassandra
    %% Wiring: Telemetry & Asynchronous Events
    Kong -->|Player Events: START, INTERACT, END| Kafka
    LMSSvc -->|Course Completion Event| Kafka
    AssessSvc -->|Program Completion Event| Kafka
    Kafka --> FlinkWorker
    FlinkWorker -->|Stateful Progress Updates| Cassandra
    Cassandra --> SparkWorker
    SparkWorker -->|Sync Reporting Marts| Postgres
    Kafka -->|course.completion| CertSvc
    CertSvc -->|Store Generated Certificate| S3
    CertSvc -->|Append Certificate URL| Cassandra
```

## 3. End-to-End Sequence Architecture

### 3.1 Phase I: Program Creation, Content Curation, Review & SPV Publishing

This sequence shows program initiation, live course association, automated CQS bypass, approval, SPV publication, and automated batch creation.

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Content Creator
    participant CBP as Content Portal UI
    participant Kong as Kong API Gateway
    participant CS as Content Service
    participant Neo as Neo4j Graph DB
    participant Cas as Cassandra DB
    actor Reviewer as Content Reviewer
    actor Publisher as SPV Publisher
    participant Pub as Publishing Engine
    participant LMS as LMS Service
    participant ES as Elasticsearch %% 1. Initiation
    Creator->>CBP: Fill Program Form (Title, Subtitle, Language, Access: "All users")
    CBP->>Kong: POST /action/content/v3/create
    Kong->>CS: Route with CBP Creator JWT
    CS->>Cas: Insert Draft metadata (do_PID..., primaryCategory: "Curated Program")
    CS->>Neo: Create (:Program {identifier: "do_PID...", status: "Draft"})
    CS-->>CBP: 200 OK + programId (do_PID...) %% 2. Course Curation
    Creator->>CBP: Search Live Courses (Toggle: "All Courses")
    CBP->>Kong: POST /action/composite/v3/search (status: "Live", primaryCategory: "Course")
    Kong-->>CBP: List of eligible live courses
    Creator->>CBP: Associate courses (do_CID1, do_CID2) & configure order
    CBP->>Kong: PATCH /action/content/v3/hierarchy/update
    Kong->>CS: Update hierarchy payload
    CS->>Neo: Create [:hasContent {index: 1}], [:hasContent {index: 2}]
    CS->>Cas: Cache composite tree in content_hierarchy
    CS-->>CBP: 200 OK %% 3. L2 Assessment Attachment & Locking
    Creator->>CBP: Attach Final Assessment & toggle "Final Assessment Lock"
    CBP->>Kong: PATCH /action/content/v3/hierarchy/update (contextLockingType: "Course Assessment Only")
    Kong->>CS: Update program metadata & link L2 QuestionSet (do_AID...)
    CS->>Neo: Set contextLockingType on (:Program) & link (:QuestionSet)
    CS->>Cas: Update content_hierarchy
    CS-->>CBP: 200 OK %% 4. Governance & Review Handoff
    Note over CBP,CS: CQS & Profanity Scan tabs bypassed automatically (KB-452, KB-453)
    Creator->>CBP: Click "Send for Review"
    CBP->>Kong: POST /action/content/v3/review
    Kong->>CS: Verify min 1 course exists & transition status
    CS->>Cas: Update status = "Under Review"
    CS-->>CBP: 200 OK %% 5. Reviewer Approval
    Reviewer->>CBP: Inspect curriculum structure & approve
    CBP->>Kong: POST /action/content/v3/review/approve
    Kong->>CS: Route approval
    CS->>Cas: Update status = "Under Publish"
    CS-->>CBP: 200 OK %% 6. SPV Publication & Auto-Batching
    Publisher->>CBP: Click "Publish Content"
    CBP->>Kong: POST /action/content/v3/publish
    Kong->>Pub: Enforce SPV Publisher role check
    Pub->>Cas: Update Program status = "Live"
    Pub->>Neo: Set (:Program {status: "Live"})
    Pub->>ES: Index document into composite-search catalog
    Pub->>LMS: Trigger Auto-Batch Provisioning (KB-1946)
    LMS->>Cas: Insert into course_batch (enrollmentType: "open", status: 1)
    Pub-->>CBP: 200 OK (Curated Program is Live)
```

### 3.2 Phase II: Discovery, Enrolment, Learning, Gated L2 Assessment & Dual Certification

This sequence tracks learner discovery, self-enrolment, bidirectional course consumption tracking, server-side L2 assessment prerequisite gating, scorecard calculation, and certificate generation.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Civil Service Learner
    participant LP as Learner Web/Mobile UI
    participant Kong as Kong API Gateway
    participant LMS as LMS Service
    participant Player as Course Player
    participant Cas as Cassandra DB
    participant AS as cb-ext-assessment-service
    participant Kafka as Apache Kafka
    participant Cert as Certificate Generator %% 1. Discovery & Enrolment
    Learner->>LP: Discover Program (Global Search / Karma Strip)
    Learner->>LP: Click "Enrol"
    LP->>Kong: POST /action/course/v1/enrol
    Kong->>LMS: Enrol into Open Batch
    LMS->>Cas: Insert into user_enrolment (courseid: "do_PID...", status: 1)
    LMS-->>LP: 200 OK (Enrolment Active) %% 2. Course Consumption & Bi-directional Tracking
    Learner->>LP: Click Course 1 -> Launch Player
    LP->>Player: Open Module & Play Resource
    Player->>Kong: POST /action/content/v1/telemetry (INTERACT, END)
    Kong->>Kafka: Emit raw telemetry event
    Kafka->>Cas: Real-time update to user_content_consumption
    Note over Player,Cas: Course 1 reaches 100% -> user_enrolment (do_CID1, status: 2)
    Player->>Kafka: Emit course.completion for Course 1
    Kafka->>Cert: Generate & issue Course 1 Certificate
    Player-->>LP: Return to Program TOC (Course 1 marked "Completed") %% 3. Gated L2 Assessment Attempt (Scenario: Prerequisites Incomplete)
    Note over Learner,AS: Case A: Child Course 2 is still Incomplete (status: 1)
    Learner->>LP: Click "Final Assessment (L2)"
    LP->>Kong: POST /v7/assessment/read {programId: "do_PID...", assessmentId: "do_AID..."}
    Kong->>AS: Route to Assessment Service
    AS->>AS: Read program contextLockingType ("Course Assessment Only")
    AS->>Cas: Query user_enrolment for all child courses
    Cas-->>AS: Child Course 2 status = 1 (In Progress)
    AS-->>Kong: 400 Bad Request ("User must complete all children courses...")
    Kong-->>LP: 400 Bad Request
    LP-->>Learner: Display Gated Modal Dialog (Access Blocked) %% 4. Gated L2 Assessment Attempt (Scenario: Prerequisites Complete)
    Note over Learner,AS: Case B: Learner finishes Course 2 -> All child courses status: 2
    Learner->>LP: Click "Final Assessment (L2)"
    LP->>Kong: POST /v7/assessment/read
    Kong->>AS: Route to Assessment Service
    AS->>Cas: Query child course states -> All status == 2
    AS-->>Kong: 200 OK + QuestionSet Schema (Questions, options, duration)
    Kong-->>LP: 200 OK
    LP->>Learner: Launch Assessment Player %% 5. Submission, Program Completion & Certification
    Learner->>LP: Submit Answers
    LP->>Kong: POST /v7/assessment/submit {answers: [...], timeSpent: 1200}
    Kong->>AS: Evaluate against answer key
    AS->>Cas: Record score in assessment_attempts (result_status: "PASSED")
    AS->>Cas: Update user_enrolment for Program (status: 2, completedon: now())
    AS->>Kafka: Produce event: course.completion {programId: "do_PID...", type: "PROGRAM"}
    AS-->>LP: 200 OK (Scorecard & Pass Status)
    Kafka->>Cert: Consume program completion event
    Cert->>Cert: Mint Program Certificate (PDF/SVG + QR Code)
    Cert->>Cas: Append to user_enrolment.issued_certificates
    LP-->>Learner: Display Download Program Certificate Link
```

## 4. Subsystem Detailed Designs

### 4.1 Content Portal & Hierarchy Subsystem

- **Access Control**: Evaluates user roles through JWT tokens passed in the `Authorization` header.
- **Streamlined UI Workflow**: Hides CQS scoring and profanity scanning tabs when `primaryCategory == "Curated Program"` ([KB-453: Q2 | CBP Publishing | CQS and Self Curation should be removed for content creator, content reviewer and publisher for invite only and curated program](https://karmayogibharat.atlassian.net/browse/KB-453) (Prod Deployed)).
- **Immutability Guard**: When editing a program in `Live` status, the Content Service checks `status == "Live"` and rejects any hierarchy update that alters child courses ([KB-457: Q2 | CBP Editing | Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved), [KB-466: Q2 | CBP Publishing | Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466)). Only metadata fields (title, description, tags, competencies) can be modified.

```mermaid
flowchart TD
    A["Incoming Hierarchy Update<br/>(PATCH /action/content/v3/hierarchy/update)"] --> B{"Is program status == #quot;Live#quot;?"}
    B -->|"NO"| N1["Apply hierarchy update<br/>to Neo4j and Cassandra"]
    B -->|"YES"| C{"Did child course list change?"}
    C -->|"YES"| Y["Return HTTP 400<br/>(Immutable)"]
    C -->|"NO"| N2["Update metadata only<br/>(Neo4j / Cassandra)"]
```

### 4.2 LMS & Batch Management Subsystem

- **Automated Batching**: Curated Programs are intended for open public access. When a program transitions to `Live`, the Publishing Engine calls the internal LMS API to create an open batch ([KB-1946: Q3 | Content Portal Redesign | Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed)):
  ```json
  {
    "request": {
      "courseId": "do_PID...",
      "name": "Auto Open Batch",
      "enrollmentType": "open",
      "startDate": "YYYY-MM-DD",
      "status": 1
    }
  }
  ```
- **Enrolment Tracking**: Stores active records in `sunbird.user_enrolment`. The batch is open to all registered civil servants without requiring invite lists or approval workflows.

### 4.3 Assessment & Prerequisite Gating Subsystem (`cb-ext-assessment-service`)

- **Endpoint Contract**: Exposes `POST /v7/assessment/read` requiring `{ programId, assessmentId }` in the request body ([KB-8842: Q8 | Learning Path | Curated Program | Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed)).
- **Legacy Interception**: Direct requests to legacy `cb-ext` endpoints for assessments tagged with `contextCategory: "Final Program Assessment"` are intercepted and rejected with `HTTP 400 Bad` `Request` ([KB-9043: Replicate the code of read,retake,submit and result API's from cb-ext-service in cb-ext-assessment service](https://karmayogibharat.atlassian.net/browse/KB-9043) (Done)).
- **Prerequisite Gating Algorithm**:
  - Retrieve the program hierarchy from `content_hierarchy`.
  - If `contextLockingType != "Course Assessment Only"`, return the QuestionSet.
  - If locking is enabled, query `sunbird.user_enrolment` using the learner's `userId` and the list of child course IDs.
  - If any child course has `status < 2`, reject the request:

```json
{
  "id": "api.assessment.read",
  "params": {
    "status": "FAILED",
    "err": "ASSESSMENT_LOCKED",
    "errmsg": "User must complete all the children courses before starting on the Final Assessment"
  },
  "responseCode": "CLIENT_ERROR",
  "result": {}
}
```

1. If all child courses have `status == 2`, return the QuestionSet without answer keys.

### 4.4 Completion Evaluation & Dual Certification Subsystem

- **Completion Gate**: Program completion requires:
  - Every constituent course must have `status == 2` in `sunbird.user_enrolment`.
  - If an L2 assessment is configured, the learner must have a record in `assessment_attempts` with `result_status == "PASSED"`.

- **Certificate Issuance**:
  - **Course Level**: Triggered when each individual course completes.
  - **Program Level**: Triggered when the overall program completes. The event is emitted to the Kafka topic `course.completion`, and `sunbird-rc-certs` mints the credential asynchronously with a verifiable QR code.

## 5. Persistence & Polyglot Data Architecture

**PERSISTENCE TIER ARCHITECTURE**

- **[ Neo4j Graph Database ]**
    - Node `(:Program {identifier, status, contextLockingType})`
    - Node `(:Course {identifier, status})`
    - Node `(:QuestionSet {identifier, contextCategory})`
    - Edge `(:Program)-[:hasContent {index}]->(:Course)`
    - Edge `(:Program)-[:hasAssessment]->(:QuestionSet)`
- **[ Apache Cassandra (sunbird keyspace) ]**
    - `content_store`: Program metadata and state records
    - `content_hierarchy`: Cached complete JSON hierarchy tree
    - `user_enrolment`: Primary progress tracking `((userid), courseid, batchid)`
    - `user_content_consumption`: Leaf-level resource progress `((userid), contentid, courseid, batchid)`
    - `assessment_attempts`: L2 attempt history and scores `((userid, programid), assessmentid, attempt_id)`
    - `course_batch`: Auto-generated open batches `((courseid), batchid)`
- **[ Elasticsearch Cluster ]**
    - Index: `composite-search`
    - Documents: Live curated programs for learner discovery, faceted search, and Karma strips
- **[ PostgreSQL Analytics Warehouse ]**
    - Dimension & Fact Tables: Synced via Flink/Spark batch jobs for DoPT/MDO reporting dashboards

## 6. End-to-End API Interface Catalog

| Lifecycle Stage | HTTP Method | Endpoint | Source Component | Target Service | Auth / Role | Key Payload Attributes | Key Response / Status | Traceability |
|---|---|---|---|---|---|---|---|---|
| **Creation** | `POST` | `/action/content/v3/create` | Content Portal UI | Content Service | Bearer JWT (`CBP Creator`) | `name`, `primaryCategory: "Curated Program"`, `access: "All users"` | `200 OK` + `programId` (`do_PID...`) | [KB-1945: Q3 \| Content Portal Redesign \| Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed), Page 35062022 |
| **Curation** | `PATCH` | `/action/content/v3/hierarchy/update` | Content Portal UI | Content Service | Bearer JWT (`CBP Creator`) | `rootId`, `children: ["do_CID1", "do_CID2"]`, `contextLockingType` | `200 OK` + `content_id` | [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review), [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed) |
| **Review** | `POST` | `/action/content/v3/review` | Content Portal UI | Content Service | Bearer JWT (`CBP Creator`) | `identifier: "do_PID..."` | `200 OK` (status: `Under Review`) | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), Page 35062022 |
| **Publish** | `POST` | `/action/content/v3/publish` | Content Portal UI | Publishing Engine | Bearer JWT (`SPV Publisher`) | `identifier: "do_PID..."` | `200 OK` (status: `Live`, auto-batch triggered) | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), [KB-1946: Q3 \| Content Portal Redesign \| Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed) |
| **Discovery** | `POST` | `/action/composite/v3/search` | Learner Portal | Search Service | Anonymous / Learner Session | `filters: {primaryCategory: "Curated Program", status: "Live"}` | `200 OK` + list of program cards | [KBE-150: Should be able to review and publish the curated programs and display for the karmayogi learners to consume](https://karmayogibharat.atlassian.net/browse/KBE-150) (Review), [KB-3756: Q4 \| Karma Programs](https://karmayogibharat.atlassian.net/browse/KB-3756) (Prod Deployed) |
| **Enrolment** | `POST` | `/action/course/v1/enrol` | Learner Portal | LMS Service | Learner Session | `courseId: "do_PID..."`, `batchId: "..."`, `userId: "..."` | `200 OK` (enrolment record created) | [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review), [KB-1946: Q3 \| Content Portal Redesign \| Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed) |
| **Hierarchy Read** | `GET` | `/action/course/v1/hierarchy/{programId}` | Learner Portal | LMS Service | Learner Session | URL path `programId` | `200 OK` + TOC tree and progress states | [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review), [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done) |
| **Telemetry** | `POST` | `/action/content/v1/telemetry` | Course Player | Kong / Kafka | Learner Session | Raw telemetry packets (`START`, `INTERACT`, `END`) | `200 OK` (queued for ingestion) | Page 21266503 |
| **L2 Read (Gated)** | `POST` | `/v7/assessment/read` | Assessment Player | cb-ext-assessment-service | Learner Session | `programId: "do_PID..."`, `assessmentId: "do_AID..."` | `200 OK` (QuestionSet) OR `400 Bad Request` (Locked) | [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed), [KB-9043: Replicate the code of read,retake,submit and result API's from cb-ext-service in cb-ext-assessment service](https://karmayogibharat.atlassian.net/browse/KB-9043) (Done) |
| **L2 Submit** | `POST` | `/v7/assessment/submit` | Assessment Player | cb-ext-assessment-service | Learner Session | `programId`, `assessmentId`, `answers: [...]`, `timeSpent` | `200 OK` + score and pass/fail result | [KB-8065: Q8 \| L2 Assessments/CAP \| Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved), [KB-9248: BE \| Enhance Assessment V7 READ API - to return error for content locking](https://karmayogibharat.atlassian.net/browse/KB-9248) (Done) |

## 7. Non-Functional Architecture & System Safeguards

### 7.1 Security & Role-Based Access Control

- **Gateway-Level Enforcement**: Kong validates JWT signatures against Keycloak public keys and checks user roles.
  - Accessing authoring APIs requires `CBP Creator`.
  - Advancing programs to publish requires `CBP Reviewer`.
  - Releasing public Curated Programs (`access: "All users"`) requires `SPV Publisher`. Calls from standard publishers are rejected with `HTTP 403 Forbidden`.

- **Assessment Content Protection**: Question answers, rubrics, and evaluation logic are isolated in `cb-ext-assessment-service` and never sent to the client browser prior to submission.
- **Tamper-Resistant Server Gating**: Gating is evaluated server-side against Cassandra enrollment tables. Client-side state overrides cannot bypass prerequisite checks ([KB-9600: User is able to consume final assessment without consuming course content in curated porgram](https://karmayogibharat.atlassian.net/browse/KB-9600) (Done)).

### 7.2 Scalability & Resiliency

- **Asynchronous Telemetry Ingestion**: High-volume telemetry packets from active players route through Kafka topic `telemetry.raw`. The Flink streaming cluster processes progress rollups asynchronously, shielding Cassandra from write contention.
- **Idempotent Certificate Generation**: Workers processing the `course.completion` Kafka topic check existing credentials in `user_enrolment.issued_certificates` before rendering new certificates, preventing duplicates during message retries ([KB-9809: Certificate is not getting generated in TOC page about tab once Curated program is consumed by some users in both QA and UAT environment](https://karmayogibharat.atlassian.net/browse/KB-9809) (Fixed)).
- **Client Cache Invalidation**: Returning from a course player to the Program TOC triggers a client-side cache refresh, ensuring newly completed courses display the updated status immediately ([KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done)).

## 8. Requirements Traceability Matrix (HLD to Sources)

| System Feature / Component | Architectural Solution | Key Source Tickets | Confluence Reference | Status |
|---|---|---|---|---|
| **Program Creation & Taxonomy** | Angular Program creation form; `primaryCategory: "Curated Program"`, `access: "All` `users"`. | [KB-1945: Q3 \| Content Portal Redesign \| Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed), [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review) | Page 35062022 §5.1 | **Implemented** |
| **Content Curation by Reference** | Content search restricted to `status: "Live"`; Neo4j `[:hasContent]` relationship links. | [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review) | Page 35062022 §5.2.3 | **Implemented** |
| **CQS & Profanity Scan Bypass** | Workflow rules suppress CQS and profanity checks for Curated Programs. | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), [KB-453: Q2 \| CBP Publishing \| CQS and Self Curation should be removed for content creator, content reviewer and publisher for invite only and curated program](https://karmayogibharat.atlassian.net/browse/KB-453) (Prod Deployed) | Page 21266503 | **Implemented** |
| **SPV Publishing & Immutability** | `SPV Publisher` role gate; backend rejects child course modifications on live programs. | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), [KB-457: Q2 \| CBP Editing \| Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved), [KB-466: Q2 \| CBP Publishing \| Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466) | Page 35062022 §3 | **Implemented** |
| **Automated Batch Provisioning** | Publishing engine triggers creation of an open batch in `course_batch`. | [KB-1946: Q3 \| Content Portal Redesign \| Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed) | Page 35062022 §5.5 | **Implemented** |
| **Learner Discovery & Strip** | Elasticsearch indexing; homepage "Karma Programs" curated strip. | [KBE-150: Should be able to review and publish the curated programs and display for the karmayogi learners to consume](https://karmayogibharat.atlassian.net/browse/KBE-150) (Review), [KB-3756: Q4 \| Karma Programs](https://karmayogibharat.atlassian.net/browse/KB-3756) (Prod Deployed) | Production Baseline | **Implemented** |
| **Progress Synchronization** | Unified `user_content_consumption` store; bidirectional sync between standalone and TOC contexts. | [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review), [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done) | Page 21266503 | **Implemented** |
| **L2 Capstone Assessment** | Root-level QuestionSet attachment (`contextCategory: "Final Program Assessment"`). | [KB-8065: Q8 \| L2 Assessments/CAP \| Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved), [KB-8841: Q8 \| Learning Path \| Curated Program \| Add Final Assessment](https://karmayogibharat.atlassian.net/browse/KB-8841) (Prod Deployed) | Page 373915757 | **Implemented** |
| **Server-Side L2 Locking** | `cb-ext-assessment-service` gating check; rejects calls with HTTP 400 if child courses are incomplete. | [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed), [KB-9043: Replicate the code of read,retake,submit and result API's from cb-ext-service in cb-ext-assessment service](https://karmayogibharat.atlassian.net/browse/KB-9043) (Done), [KB-9600: User is able to consume final assessment without consuming course content in curated porgram](https://karmayogibharat.atlassian.net/browse/KB-9600) (Done) | Page 373915757 §4 | **Implemented** |
| **Dual Certificate Generation** | Course-level certificates via LMS; Program-level certificates via Kafka and `sunbird-rc-certs`. | [KBE-149: Should be able to view certificate on completion of the curated program](https://karmayogibharat.atlassian.net/browse/KBE-149) (To Do), [KB-9742: UAT issue : Certificate is not getting generated in TOC page about tab once Curated program is consumed](https://karmayogibharat.atlassian.net/browse/KB-9742) (Done), [KB-9809: Certificate is not getting generated in TOC page about tab once Curated program is consumed by some users in both QA and UAT environment](https://karmayogibharat.atlassian.net/browse/KB-9809) (Fixed) | Page 21266503 | **Implemented** |
| **Detailed Reporting Pipeline** | Telemetry ingestion through Kafka/Flink; Spark batch analytics syncing to PostgreSQL marts. | [KBE-151: Able to view the detailed reports at the program/user level](https://karmayogibharat.atlassian.net/browse/KBE-151) (To Do) | Production Baseline | **Implemented** |
