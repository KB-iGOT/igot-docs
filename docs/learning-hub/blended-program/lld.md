# Blended Program — Low-Level Design (LLD)

## 1. System Decomposition & Module Organization

The Blended Program implementation is organized into four client channels, an API gateway perimeter, four core backend service domains, an asynchronous worker layer, and a polyglot persistence tier.

```mermaid
flowchart TD
    CLIENT["CLIENT CHANNELS<br/>- CBP Authoring Portal (Angular): Program container creation, competency mapping, batch setup<br/>- MDO Leadership Portal (Angular): Coordinator dashboard, bulk nomination approvals, exports<br/>- Learner Web Portal (Angular): Catalog discovery, batch enrollment, curriculum TOC, tasks<br/>- Learner Mobile Application (Flutter): Biometric/QR attendance, TOC, offline sync, submissions"]
    GW["API GATEWAY LAYER<br/>- Kong API Gateway: Token validation, route dispatching, request normalization, rate limits"]
    COURSE["Course Domain<br/>(course-service)<br/>- Program Ctrl<br/>- Batch Ctrl<br/>- Enrollment Ctrl<br/>- Search Adapter"]
    WF["Workflow Domain<br/>(workflow-service)<br/>- Nomination Ctrl<br/>- CSV Parser<br/>- Approval Engine<br/>- Count Cache Mgr"]
    ASG["Assignment Domain<br/>(assignment-service)<br/>- Assignment Ctrl<br/>- Submission Ctrl<br/>- Evaluator Ctrl<br/>- File Ref Mgr"]
    REP["Reporting Domain<br/>(bp-report-service)<br/>- Job Controller<br/>- Validator<br/>- Kafka Producer"]
    WORKER["Report Worker<br/>- DatasetAssembler<br/>- WorkbookBuilder<br/>- StorageUploader"]
    TIER["PERSISTENCE & STORAGE TIER<br/>- Apache Cassandra: sunbird_courses.course_batch, user_enrolments, bp_enrolment_report_v2<br/>- Elasticsearch 7.x: course-batch index (Strict mappings, raw sorting, computed counts)<br/>- PostgreSQL: wingspan.wf_status, session_attendance, assessment_scores, assignments<br/>- Redis Cluster: High-frequency active batch capacity counters (bp_active_count_{batchId})<br/>- Google Cloud Storage (GCS): Learner assignment submissions & multi-tab analytical Excel workbooks"]
    CLIENT -->|"HTTPS / Keycloak JWT Bearer"| GW
    GW --> COURSE
    GW --> WF
    GW --> ASG
    GW --> REP
    REP -->|"Kafka (bp-report)"| WORKER
    COURSE --> TIER
    WF --> TIER
    ASG --> TIER
    WORKER --> TIER
```

## 2. Evolution Summary by Release Band (Q2 to Q13)

```mermaid
flowchart LR
    Q1["Q2 - Q3<br/>Baseline BP<br/>& Forms"] --> Q2["Q4 - Q6<br/>Workflow &<br/>Bulk CSV"]
    Q2 --> Q3["Q8 - Q9<br/>Decoupling &<br/>Assignments"]
    Q3 --> Q4["Q10 - Q13<br/>Agility &<br/>Reporting V2"]
```

| Release Band | Functional Scope | Architectural & Design Impact | Core Modules Involved |
|---|---|---|---|
| **Q2–Q3** | Baseline Blended Program container; linked registration forms; basic CSV reports. | Established structural separation between parent program container and runtime batches. | CBP Portal, `course-service`, Cassandra |
| **Q4–Q6** | Nomination pipelines; bulk approval/rejection CSVs; custom profile field capture. | Relational workflow state introduced; delegated enrollment transitions to coordinator queues. | `workflow-service`, PostgreSQL, Redis |
| **Q8–Q9** | Direct publishing (CQF bypass); dedicated assignment microservice; multi-PC allocation. | Removed authoring review bottlenecks; decoupled assignment evaluation into a dedicated service. | `content-service`, `assignment-service`, GCS |
| **Q10–Q11** | Cross-MDO instructor allocation; mobile and web assignment delivery; asset proxying. | Multi-format media streaming via storage proxies; Cassandra read-path query optimization. | `cloud-storage-proxy`, Elasticsearch, Mobile App |
| **Q12–Q13** | Same-day batch lifecycle; batch cloning; asynchronous V2 reporting; pre-assessment decoupling. | Operational agility relaxed date constraints; dedicated Cassandra V2 report table isolated analytics. | `bp-report-service`, Kafka consumer, Cassandra |

## 3. End-to-End Frontend-to-Backend Flow Diagrams

### 3.1 Program Creation and Direct Publishing Flow

Content Creators author program metadata and competency mappings. The workflow transitions directly from Draft to Live, eliminating intermediate review bottlenecks.

```mermaid
sequenceDiagram
    participant CC as Content Creator
    participant PC as Program Coordinator
    participant UI as CBP Portal UI
    participant KG as Kong Gateway
    participant CS as course-service
    participant CA as Cassandra
    participant ES as Elasticsearch
    CC->>UI: 1. Define BP Metadata
    CC->>UI: 2. Assign Co-PCs
    CC->>UI: 3. Click Publish
    UI->>KG: POST /content/v3/pub
    KG->>CS: Forward Request
    CS->>CA: Persist Status (Live, No CQF)
    PC->>UI: 4. Setup Batch Dates & Instructors
    UI->>KG: POST /v1/batch/create
    KG->>CS: Forward Request
    CS->>CA: Write Batch Row (status: 0 or 1)
    CS->>ES: Async ES Sync (Akka Event Actor)
    CS-->>KG: Return Batch ID
    KG-->>UI: HTTP 200 OK
    UI-->>PC: 5. Batch Active Alert
```

### 3.2 Learner Enrollment, Nomination & Bulk CSV Approval Flow

Enforces cohort capacity limits and supports both direct nominations and bulk CSV approval workflows.

```mermaid
sequenceDiagram
    participant LA as Learner / Admin
    participant PC as Program Coordinator
    participant PO as Portal / Client
    participant WF as workflow-service
    participant DB as Cassandra / PG
    participant RC as Redis Cache
    LA->>PO: 1. Request Enrollment (Web / Mobile / QR)
    PO->>WF: POST /workflow/enrol
    WF->>DB: Create Workflow Record (SEND_FOR_PC_APPROVAL)
    PC->>PO: 2. Download CSV Queue
    PO->>WF: POST /getUserApprCSV
    WF->>DB: Query Pending Records
    WF-->>PO: Stream CSV Data
    PC->>PO: 3. Populate Actions (APPROVE / REJECT)
    PC->>PO: 4. Upload Approval CSV
    PO->>WF: POST /bulkApproval
    WF->>DB: Batch Update Workflow
    WF->>DB: Update user_enrolments (status: 1)
    WF->>RC: Invalidate & Recompute (Active Batch Count)
    WF-->>PO: HTTP 200 OK
    PO-->>PC: 5. Enrollment Complete
```

### 3.3 Learner Consumption, Assignment Submission & Grading Flow

Learners interact with the batch curriculum, submit drafts, finalize submissions, and receive graded evaluations.

```mermaid
sequenceDiagram
    participant LE as Learner
    participant UI as Learner TOC UI
    participant AS as assignment-service
    participant CSP as cloud-storage-proxy
    participant GCS as GCS
    participant IV as Instructor View
    LE->>UI: 1. Open Batch TOC
    UI->>AS: POST /assign/search
    AS-->>UI: Return Assignments
    LE->>UI: 2. Select Assignment
    LE->>UI: 3. Upload Solution Doc
    UI->>AS: Multipart Upload
    AS->>CSP: Stream Binary Stream
    CSP->>GCS: Put Object
    GCS-->>CSP: HTTP 200 OK
    CSP-->>AS: Return GCS File ID
    LE->>UI: 4. Save Draft / Submit
    UI->>AS: POST /assign/submit (status: SUBMITTED)
    AS->>CSP: Persist Submission
    Note over IV: Instructor
    IV->>AS: Fetch Pending Queue
    AS->>CSP: Read Answer Artifact
    CSP->>GCS: Stream Object
    Note over IV: (Evaluate)
    IV->>AS: POST /assign/feedback (Marks, Comments)
    AS-->>UI: Status: EVALUATED
    Note over AS: (status: EVALUATED)
    UI-->>LE: 5. Feedback Visible
```

### 3.4 Asynchronous Analytics & Multi-Tab Report Generation Flow

Isolates multi-store joins across Cassandra, PostgreSQL, and Elasticsearch from the transactional runtime path.

```mermaid
sequenceDiagram
    participant AD as MDO Admin / PC
    participant PO as Portal Client
    participant BR as bp-report-service
    participant KB as Kafka Broker
    participant WK as Async Report Worker
    participant GB as GCS Bucket
    AD->>PO: 1. Request Report (POST /v2/generate)
    PO->>BR: POST /v2/generate
    BR->>KB: Publish Message (Topic: bp-report)
    BR-->>PO: Request Queued
    KB->>WK: Consume Message (Parse contextType)
    WK->>WK: Extract Data (Cassandra, ES, PG)
    WK->>WK: Assemble 6 Sheets
    WK->>GB: Upload Workbook (GCS Storage)
    WK->>WK: Update DB Row (Status: Completed)
    AD->>PO: 2. Poll Status
    PO->>BR: POST /status
    BR-->>PO: Status: Ready
    AD->>PO: 3. Download Report
    PO->>BR: GET /download
    BR->>GB: Stream File from GCS Storage
```

## 4. State Machines & Lifecycle Transitions

### 4.1 Program Batch Lifecycle State Machine

```mermaid
flowchart TD
    DRAFT["DRAFT<br/>- Editable schedules, instructors, and session resources"]
    LIVE["LIVE / ONGOING<br/>- Open for enrollments, session attendance, assignments"]
    INACTIVE["INACTIVE<br/>- Eligible for cloning<br/>- Read-only analytics"]
    DELETED["DELETED<br/>- Invalidate enrollments<br/>- Notify active learners"]
    DRAFT -->|"Publish / Scheduled Start ($T_0$)"| LIVE
    LIVE -->|"Cohort End Date Passed"| INACTIVE
    LIVE -->|"Soft Delete"| DELETED
```

### 4.2 Learner Enrollment State Machine

```mermaid
flowchart TD
    REQ["REQUESTED<br/>- Learner initiated via portal"]
    PEND["PENDING_PC_APPROVAL<br/>- Stored in wingspan.wf_status"]
    APP["APPROVED / ACTIVE<br/>- user_enrolments.status = 1<br/>- Redis active count incremented"]
    REJ["REJECTED<br/>- State locked#59; learner<br/>may re-apply to others"]
    COMP["COMPLETED<br/>- user_enrolments.status = 2<br/>- Certificate issuance triggered"]
    REQ -->|"Approval Enforced on Batch"| PEND
    PEND -->|"Bulk CSV Approve"| APP
    PEND -->|"Bulk CSV Reject"| REJ
    APP -->|"All Mandatory Criteria Satisfied"| COMP
```

### 4.3 Assignment Submission State Machine

```mermaid
flowchart TD
    DRAFT["DRAFT<br/>- Mutable files and answers<br/>- Not visible to evaluators"]
    SUB["SUBMITTED<br/>- Terminal lock#59; immutable doc<br/>- Visible in evaluator queue"]
    EVAL["EVALUATED<br/>- Marks & feedback recorded<br/>- Progress rollup enabled"]
    DRAFT -->|"POST /v1/submit (Lock)"| SUB
    SUB -->|"POST /v1/feedback (Scoring)"| EVAL
```

## 5. Persistence Entities & Data Dictionaries

### 5.1 Apache Cassandra: Batch Table (`sunbird_courses.course_batch`)

- **Primary Key:** `(courseid, batchid)` with `CLUSTERING ORDER BY (batchid ASC)`
- **Operational Attributes:**
  - `status` *(int)*: `0` (Upcoming), `1` (Ongoing), `2` (Completed), `3` (Soft Deleted)
  - `enrollmenttype` *(text)*: `open` or `invite-only`
  - `startdate`, `enddate`, `enrollmentenddate` *(text)*: ISO formatted dates (`YYYY-MM-DD`)
  - `mentors` *(list<text>)*: Instructor account IDs
  - `createdfor` *(list<text>)*: Permitted target MDO IDs
  - `cert_templates` *(map<text, frozen<map<text, text>>>)*: Certificate SVG layout, signatories, and issuance criteria
  - `batch_attributes` *(map<text, text>)*: Dynamic batch properties
  - `enableqr` *(boolean)*: QR-code self-enrollment toggle

### 5.2 Apache Cassandra: Reporting V2 Table (`sunbird.bp_enrolment_report_v2`)

- **Primary Key:** `(orgid, courseid, batchid, reportrequester, contexttype)` with `CLUSTERING ORDER BY (courseid ASC, batchid ASC, reportrequester ASC, contexttype ASC)`
- **Operational Attributes:**
  - `contexttype` *(text)*: Disambiguates concurrent export scopes, preventing primary key collisions in Cassandra's upsert model
  - `approveduser`, `pendinguser`, `rejecteduser` *(int)*: Aggregated participant metrics
  - `downloadlink` *(text)*: Signed GCS download URL
  - `status` *(text)*: `SUBMITTED`, `PROCESSING`, `COMPLETED`, `FAILED`

### 5.3 PostgreSQL Relational Schemas

- **Workflow Table** (`wingspan.wf_status`):
  - `request_id` *(UUID, PK)*, `course_id` *(varchar)*, `batch_id` *(varchar)*, `user_id` *(varchar)*
  - `current_state` *(varchar)*: `SEND_FOR_PC_APPROVAL`, `APPROVED`, `REJECTED`
  - `actor_id` *(varchar)*, `updated_on` *(timestamp)*

- **Assignment Submissions Table** (`assignment_submissions`):
  - `submission_id` *(UUID, PK)*, `assignment_id` *(varchar)*, `batch_id` *(varchar)*, `user_id` *(varchar)*
  - `status` *(varchar)*: `DRAFT`, `SUBMITTED`, `EVALUATED`
  - `file_ref_id` *(varchar)*: GCS object reference
  - `marks_awarded` *(numeric)*, `evaluator_feedback` *(text)*

## 6. Algorithmic Guardrails & Business Calculations

### 6.1 Real-Time Cohort Fill Rate Calculation

To avoid database connection starvation, capacity validations evaluate against cached counters before initiating enrollment:<br>$$\text{AvailableCapacity}(B) = \text{MaxCapacity}(B) - \text{ActiveEnrollmentCount}(B)$$<br>Where $\text{ActiveEnrollmentCount}(B)$ is pulled directly from the Redis key `bp_active_count_{batchId}`. If $\text{AvailableCapacity}(B) \le 0$, self-enrollment requests fail fast with HTTP 409 (`BATCH_CAPACITY_EXCEEDED`).

### 6.2 Terminal Completion Rollup Condition

A learner achieves terminal program completion (`user_enrolments.status = 2`) when all mandatory cohort criteria are met:<br>$$\text{IsComplete}(u, P, B) \iff \left( \forall m \in \text{MandatoryModules}(P), , \text{Progress}(u, m) = 100% \right) \land \left( \forall a \in \text{MandatoryAssignments}(B), , \text{Status}(u, a) = \text{EVALUATED} \right)$$

- Optional pre-assessments (decoupled in Q13 via `KB-15810`) are excluded from this evaluation.

### 6.3 Deep Search Pagination Clamping

To prevent Elasticsearch cluster memory exhaustion, search pagination is bounded:<br>$$\text{MaxAccessibleOffset} = 10,000 - \text{limit}$$<br>Requests exceeding this boundary are clamped, requiring callers to narrow search filters (e.g., date ranges, MDO identifiers).

## 7. Operational Tasks & Engineering Playbook

| Domain | Responsible Actor | Primary System Touchpoints | Operational Action & Recovery Strategy |
|---|---|---|---|
| **Program Setup** | Content Creator / Publisher | CBP Portal, `course-service` | Design program hierarchy, map competencies, trigger direct publish. |
| **Batch Operations** | Program Coordinator | CBP Portal, `course-service`, ES | Configure schedules, clone inactive batches, attach session materials. |
| **Bulk Approvals** | Program Coordinator | `workflow-service`, PostgreSQL, Redis | Download pending candidates CSV, apply decisions, upload manifest. |
| **Assignment Lifecycle** | Instructor / Learner | `assignment-service`, GCS proxy | Distribute tasks, upload answers ($\le 5\text{ MB}$), record feedback. |
| **Analytical Exports** | MDO Admin / PC | `bp-report-service`, Kafka, GCS | Request multi-tab export; poll `/status` until download URL resolves. |
| **Index Reconciliation** | Platform SRE | Kafka consumer, Elasticsearch | Monitor lag; execute re-index scripts on document drift. |
| **Cache Recovery** | Platform SRE | Redis cluster | Invalidate and rebuild `bp_active_count_*` on manual DB updates. |
