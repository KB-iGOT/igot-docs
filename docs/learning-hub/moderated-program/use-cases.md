# Moderated Program — Generic Use Cases Specification Document

## 1. Executive Summary & Use Case Inventory Map

A **Moderated Program** (MDO-Specific Program) on the iGOT Karmayogi platform is a governed, parent curricular container whose visibility, eligibility, batch enrollment, and consumption are strictly bounded by institutional tenancy—specifically targeted Ministries, Departments, and Organizations (MDOs) and the **Verified Karmayogi** profile badge.

This document formalizes the complete lifecycle of Moderated Programs into concise, standardized operational use cases (**UC-X · Action**), tracing creation through batching, catalog discovery, access gating, consumption, and certification from **Q2 to Q13**.

**USE CASE INVENTORY MAP (Q2 - Q13)**

| USE CASE ID | USE CASE TITLE | LIFECYCLE STAGE | EVOLUTIONARY PHASE |
|---|---|---|---|
| **UC-01** | Create Program & Define MDO Cohort<br/>(Home MDO Lock & Verified Karmayogi Gating) | Creation | Q3<br/>(KB-1945) |
| **UC-02** | Bundle Courses & Validate Intersection<br/>(Component Parity & Overlap Math Engine) | Bundling & Publishing | Q3<br/>(KB-1945) |
| **UC-03** | Create & Manage Program Batches<br/>(Open Batch vs. Closed Batch Exclusivity) | Operations & Scheduling | Q3, Q6<br/>(KB-1946/7067 |
| **UC-04** | Discover Program in Catalog & Home Feed<br/>(Dynamic Search Gating & Karma Programs Strips) | Discovery & Search | Q4, Q7, Q8<br/>(KB-3756/9333 |
| **UC-05** | Access Table of Contents via Direct Link<br/>(Route Interception & Unbatched Preview Handling) | Gating & Preview | Q3, Q8<br/>(KB-1950/1072 |
| **UC-06** | Enrol in Program Batch<br/>(Tenancy Validation & Atomic Cascaded Course Joining) | Onboarding & Enrolment | Q3, Q8<br/>(KB-1950/8819 |
| **UC-07** | Consume Bundled Learning Curriculum<br/>(Media Player Telemetry & Leaf Unit Synchronization) | Consumption & Tracking | Q3, Q7<br/>(KB-1950) |
| **UC-08** | Complete Program & Receive Verifiable Credential<br/>(Hierarchical Rollup & QR-Coded SVG Certificate) | Completion & Credential | Q3, Q4<br/>(KB-1950/4493 |
| **UC-09** | Monitor Cohort Progress & Audit Program Analytics<br/>(Batch Progress Dashboard & Departmental Reporting) | Governance & Reporting | Q6, Q11–Q13<br/>(KB-13016/17) |

## 2. Detailed Generic Use Cases (UC-01 to UC-09)

### UC-01 · Create Program & Define MDO Cohort

- **Primary Actor:** Content Creator (CBP Author)
- **Secondary Actor:** Content Service (`content-service`), Keycloak Identity Service, Neo4j Graph Database
- **Trigger:** Content Creator initiates the authoring of an institution-specific capacity-building curriculum for designated ministries.
- **Summary:** The author configures the overarching program container in the Content Portal (`portal-v8-fe`), designating access settings as **"MDO Specific"**, locking their home organization as an unmodifiable tenant, selecting additional target ministries, and optionally toggling the **Verified Karmayogi** profile requirement.
- **Pre-conditions:**
  - Author is authenticated via Keycloak SSO with the `CONTENT_CREATOR` role.
  - The author's user profile has an active, resolved `rootOrgId` representing their home ministry.

- **Main Success Scenario (Basic Flow):**
  - Author accesses the Content Portal and clicks **Create New** **Program** card.
  - Author enters program metadata: Title, Description, Subtitle, and Primary Category (`Program`).
  - Under **Access Settings**, author selects `MDO Specific`.
  - The frontend UI auto-populates the author's home MDO (`rootOrgId`) in the target MDO list and locks it as a non-removable chip item.
  - Author searches and appends additional target MDOs (e.g., Department of Pharmaceuticals, Ministry of AYUSH).
  - Author toggles the **Verified Karmayogi Only** switch (`true`/`false`).
  - Author clicks **Save & Continue**.
  - Client issues HTTP `POST /apis/proxies/v8/action/content/v3/create`.
  - Kong Gateway validates the session JWT and injects `x-authenticated-userid` and `x-authenticated-rootorg`.
  - `ProgramHierarchyActor` creates a new `:Content:Program` node in Neo4j with properties: `accessSettings: "MDO Specific"`, `programType: "Moderated Program"`, `targetMDOs: [...]`, and `isVerifiedKarmayogiOnly: boolean`.
  - System returns HTTP `200 OK` with the generated digital object identifier (`do_id`).

- **Extensions & Alternative Flows:**
  - **4a. Attempt to remove Home MDO:**
    - *Condition:* Author attempts to click delete/remove on their home MDO chip.
    - *System Action:* Frontend intercepts action, blocks chip removal, and displays a toast message: *"Home MDO is mandatory and cannot be unselected."*

  - **8a. Missing Mandatory Metadata:**
    - *Condition:* Program title exceeds 120 characters or description is missing.
    - *System Action:* Backend returns HTTP `400 Bad Request` (`ERR_INVALID_METADATA`). Frontend highlights offending input fields.

- **Post-conditions:** Program container is persisted in Neo4j in `Draft` state, ready for component course bundling.
- **Evolution Milestone:** Introduced in **Q3** ([KB-1945: Q3 | Content Portal Redesign | Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed), `KB_FRS_CP Redesign`) as part of the Content Portal 3-card redesign.

### UC-02 · Bundle Courses & Validate Intersection

- **Primary Actor:** Content Creator / Content Publisher
- **Secondary Actor:** Content Service (`CourseIntersectionValidator`), Neo4j Knowledge Graph
- **Trigger:** Author bundles live courses into the Moderated Program and submits the container for publishing.
- **Summary:** The platform evaluates mathematical intersection rules across all bundled courses, ensuring that every bundled moderated course shares a non-empty common MDO cohort and adheres to the identical Verified Karmayogi qualification state.
- **Pre-conditions:**
  - Parent Moderated Program exists in `Draft` state.
  - All attached courses are in `Live` publication status.

- **Main Success Scenario (Basic Flow):**
  - Author opens the **Program Curriculum / Course Picker** drawer in the authoring portal.
  - Author selects a mix of standard open platform courses (`accessSetting = "All Users"`) and department-specific moderated courses (`accessSetting = "MDO Specific"`).
  - Client dispatches `POST /apis/proxies/v8/action/content/v3/publish`.
  - Content Service invokes `CourseIntersectionValidator` to evaluate the child hierarchy:
    - Open courses are validated for `Live` status (open access is constrained by the parent container).
    - For moderated courses, the validator verifies that `course.isVerifiedKarmayogiOnly == program.isVerifiedKarmayogiOnly`.
    - The validator executes mathematical set intersection across target MDOs:

1. The resulting intersection set is verified to be non-empty ().
2. The service writes directional graph relationships in Neo4j: `(:Content:Program)-[:hasSequence]->(:Content:Course)`.
3. Content node status transitions to `Live`.
4. System returns HTTP `200 OK`.

- **Extensions & Alternative Flows:**
  - **4a. Non-Live Child Course Bundled:**
    - *Condition:* One of the selected child courses is in `Draft` or `Under Review`.
    - *System Action:* Publishing is aborted with HTTP `400 Bad Request` (`ERR_COURSE_NOT_LIVE`). Author is prompted to publish or replace the draft course.

  - **4b. Empty MDO Intersection:**
    - *Condition:* Course A targets and Course B targets .
    - *System Action:* Publishing is rejected with HTTP `400 Bad Request` (`ERR_EMPTY_MDO_INTERSECTION`). UI modal alerts: *"Bundled courses have no overlapping MDOs."*

  - **4c. Qualification Parity Mismatch:**
    - *Condition:* Parent program is set to `Verified Karmayogi Only = true`, but an attached moderated course has `Verified Karmayogi Only = false`.
    - *System Action:* Validator rejects bundling with HTTP `400 Bad Request` (`ERR_QUALIFICATION_PARITY_MISMATCH`).

- **Post-conditions:** Moderated Program is live in the Knowledge Graph, awaiting batch scheduling by the Program Coordinator.
- **Evolution Milestone:** Engineered in **Q3** ([KB-1945: Q3 | Content Portal Redesign | Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed), `KB_FRS_CP Redesign`) to eliminate runtime mid-curriculum access barriers.

### UC-03 · Create & Manage Program Batches

- **Primary Actor:** Program Coordinator (Batch Manager)
- **Secondary Actor:** LMS Course Service (`CourseBatchManagementActor`), Cassandra Store, Elasticsearch
- **Trigger:** Program Coordinator prepares an operational batch for a published Moderated Program.
- **Summary:** The Program Coordinator configures an execution cohort, choosing between an **Open Batch** (unbounded, continuous enrollment) or **Closed Batches** (time-bounded calendar windows), while the platform strictly enforces mutual exclusivity between both batch types.
- **Pre-conditions:**
  - The Moderated Program is published and holds `Live` status in Neo4j.
  - Program Coordinator is authenticated with `PROGRAM_COORDINATOR` or `COURSE_MENTOR` roles for the target MDO.

- **Main Success Scenario (Basic Flow):**
  - **Path A (Open Batch Creation):**
    - Coordinator accesses `Manage > Batch Management` and selects the published program.
    - Coordinator selects **Open Batch** mode.
    - Client dispatches `POST /apis/proxies/v8/learner/course/v1/batch/create` with `enrollmentType: "open"`.
    - `CourseBatchManagementActor` verifies that zero closed batches exist for this program.
    - LMS persists the batch into Cassandra table `sunbird_courses.course_batch` with `createdfor = targetMDOs`, leaving `startdate` and `enddate` null.
    - Cassandra updates asynchronously sync to Elasticsearch index `course-batch`.
    - UI confirms open batch activation; Closed Batch creation options are permanently disabled.

  - **Path B (Closed Batch Creation):**
    - Coordinator selects **Closed Batch** mode.
    - Coordinator enters: `Batch Name`, `Start Date`, `End Date`, and `Enrollment End Date`.
    - Client dispatches `POST /apis/proxies/v8/learner/course/v1/batch/create` with `enrollmentType: "invite-only"`.
    - `CourseBatchManagementActor` validates:
      - Zero open batches exist for this program.
      - .

    - LMS writes the closed batch record into Cassandra.
    - Coordinator can subsequently instantiate additional concurrent or sequential closed cohorts.

- **Extensions & Alternative Flows:**
  - **4a. Mutual Exclusivity Violation (Closed requested when Open exists):**
    - *Condition:* Coordinator attempts to create a closed batch after an open batch has already been provisioned.
    - *System Action:* Backend aborts with HTTP `400 Bad Request` (`ERR_BATCH_EXCLUSIVE`). Frontend blocks submission with an explanatory tooltip.

  - **4b. Invalid Schedule Range:**
    - *Condition:* Coordinator inputs an `enrollmentEndDate` that occurs after `endDate`.
    - *System Action:* Actor rejects transaction with HTTP `400 Bad Request` (`ERR_INVALID_SCHEDULE_RANGE`).

- **Post-conditions:** Batch record is committed to Cassandra; program transitions from unbatched state to active enrollment state.
- **Evolution Milestone:** Introduced in **Q3** ([KB-1946: Q3 | Content Portal Redesign | Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed)); refined in **Q6** ([KB-7067: Q6 | Content Portal | Navigation and user experience for program coordinator](https://karmayogibharat.atlassian.net/browse/KB-7067) (Prod Deployed)) for improved coordinator calendar UX.

### UC-04 · Discover Program in Catalog & Home Feed

- **Primary Actor:** Civil Servant (Eligible or Ineligible Learner)
- **Secondary Actor:** Search Proxy Service (`MDOQueryTransformer`), Elasticsearch Cluster (`composite-search`), Homepage Playlist API
- **Trigger:** Civil servant logs in, browses the catalog, applies filters, or conducts keyword searches.
- **Summary:** The platform dynamically suppresses moderated programs from public search for non-targeted users, while surfacing them to authorized civil servants via faceted catalog checkboxes and personalized **Karma Programs** homepage strips.
- **Pre-conditions:**
  - Moderated Program is published with `status = "Live"`.
  - Learner is authenticated with Keycloak; JWT contains verified `rootOrgId`.

- **Main Success Scenario (Basic Flow):**
  - **Path A (Eligible Civil Servant):**
    - Civil servant belongs to a targeted MDO (e.g., MoHFW) and opens the Learner Portal or Mobile App.
    - Learner views the homepage: the **Karma Programs** horizontal strip queries `/api/user/v1/feed` and displays the program card.
    - Alternatively, learner searches for keywords or opens the filter drawer.
    - Learner checks **Programs** **Moderated Program** filter checkbox.
    - Client issues `POST /apis/proxies/v8/api/content/v1/search`.
    - `MDOQueryTransformer` injects a security filter clause:

7. Elasticsearch returns matching program cards; UI displays the program with an "MDO Exclusive" badge.

- **Path B (Ineligible Civil Servant):**
  - Civil servant from an unrelated department (e.g., Ministry of Railways) searches for identical keywords.
  - Injected filter evaluates to `false` for that moderated program.
  - The moderated program is completely suppressed from search hits, category listings, and homepage feeds.

- **Extensions & Alternative Flows:**
  - **2a. Mobile App Catalog Navigation:**
    - *Condition:* Learner accesses catalog via Flutter Mobile App.
    - *System Action:* Mobile filter drawer renders native "Moderated Program" checkbox ([KB-9337: Q8 | Course catalog | Mobile App](https://karmayogibharat.atlassian.net/browse/KB-9337) (Open)), calling search proxies with identical tenancy isolation.

- **Post-conditions:** Catalog discovery honors organizational boundaries with zero cross-tenant leakage.
- **Evolution Milestone:** Karma Programs discovery deployed in **Q4** ([KB-3756: Q4 | Karma Programs](https://karmayogibharat.atlassian.net/browse/KB-3756) (Prod Deployed), [KB-4493: Q4 l Karma Programs l Portal | Access Karma Programs](https://karmayogibharat.atlassian.net/browse/KB-4493) (Prod Deployed)); search filtering and mobile facets standardized in **Q7–Q8** ([KB-7869: Q7 | Search & listing | NLP & Elastic search | Learner Portal](https://karmayogibharat.atlassian.net/browse/KB-7869) (Prod Deployed)–[KB-7872: Q7 | Search & listing | Filters | Mobile App](https://karmayogibharat.atlassian.net/browse/KB-7872) (Prod Deployed), [KB-9333: Q8 | Implement Course Catalog Filters | Course Catelog | Learner Portal & Mobile App & M-Site](https://karmayogibharat.atlassian.net/browse/KB-9333) (Prod Deployed), [KB-9337: Q8 | Course catalog | Mobile App](https://karmayogibharat.atlassian.net/browse/KB-9337) (Open)).

### UC-05 · Access Table of Contents via Direct Link

- **Primary Actor:** Civil Servant (Eligible or Ineligible)
- **Secondary Actor:** Client Route Guard (`ModeratedProgramGuard`), Content Service, UI Modal Engine
- **Trigger:** Civil servant clicks a shared URL or navigates directly to a program Table of Contents (`/app/toc/{do_id}/overview`).
- **Summary:** Defense-in-depth route guards evaluate organizational claims before rendering, blocking unauthorized civil servants with a warning modal while adapting the Table of Contents (TOC) layout based on batch availability for eligible users.
- **Pre-conditions:**
  - Learner is authenticated via Keycloak.
  - Program metadata is resolved via `/action/content/v3/read/{id}`.

- **Main Success Scenario (Basic Flow):**
  - **Path A (Eligible Learner — Batch Active):**
    - Route guard validates that caller's `rootOrgId` .
    - Router resolves route; `TOCContainerComponent` renders the program curriculum hierarchy, competencies, and module breakdown.
    - System inspects Cassandra batch records:
      - If Open Batch is active: Action button displays `"Enrol in Program"`.
      - If Closed Batch is active (): Displays countdown and `"Enrol in Batch"`.

  - **Path B (Eligible Learner — Unbatched Program State):**
    - Program is `Live` in Neo4j, but the Program Coordinator has not yet provisioned a batch.
    - Route guard permits entry to the curriculum view.
    - `TOCContainerComponent` displays the syllabus, course descriptions, and competencies, but disables enrollment.
    - Action button renders disabled state displaying: `"No Active Batch Available"`.

  - **Path C (Ineligible Learner — Access Intercepted):**
    - Uninvited or non-targeted user pastes the direct link.
    - `ModeratedProgramGuard` detects caller's `rootOrgId` .
    - Route navigation is canceled; guard triggers `AccessDeniedDialogComponent`.
    - UI displays: *"Access Restricted: Your organization does not have access to this Moderated Program."*
    - Upon modal dismissal, router redirects the browser to `/app/home`.

- **Extensions & Alternative Flows:**
  - **3a. Closed Batch Enrollment Deadline Passed:**
    - *Condition:* Learner opens TOC of an active closed cohort, but .
    - *System Action:* Curriculum remains viewable; action button is disabled displaying: `"Enrollment Closed"`.

  - **1a. Unverified Civil Servant Accessing Verified-Only Program:**
    - *Condition:* Learner's MDO matches, but `isVerifiedKarmayogiOnly = true` and learner lacks a verified badge.
    - *System Action:* Route guard permits TOC preview but displays a warning chip: *"Verification required to enroll."*

- **Post-conditions:** Unauthorized users cannot inspect or download curriculum payloads; authorized users view actionable batch states.
- **Evolution Milestone:** Defined in **Q3** ([KB-1950: Q3 | Content Portal Redesign | Learner consumption for all types of content](https://karmayogibharat.atlassian.net/browse/KB-1950) (Prod Deployed), `KB_FRS_CP Redesign`); deep-link route guarding hardened in **Q8** ([KB-8819: Q8 | Learning Path | Access Control](https://karmayogibharat.atlassian.net/browse/KB-8819) (KB Approved)).

### UC-06 · Enrol in Program Batch

- **Primary Actor:** Eligible Civil Servant (Learner)
- **Secondary Actor:** LMS Course Service (`UserEnrolmentActor`), Cassandra Store, Kafka Stream
- **Trigger:** Learner clicks **"Enrol in Program"** or **"Enrol in Batch"** on the TOC overview screen.
- **Summary:** The platform validates organizational entitlement and verification status, atomically generating enrollment records across both the parent program container and all bundled child courses within a single Cassandra logged transaction.
- **Pre-conditions:**
  - Learner is eligible (MDO matches and Verified Karmayogi badge is active if required).
  - Batch is active and enrollment deadline has not lapsed.

- **Main Success Scenario (Basic Flow):**
  - Learner clicks **Enrol**.
  - Client issues HTTP `POST /apis/proxies/v8/learner/course/v1/enrol` with `courseId`, `batchId`, and `userId`.
  - Kong Gateway enriches headers with verified `rootOrgId`.
  - `UserEnrolmentActor` performs server-side entitlement checks:
    - Validates caller's `rootOrgId` against batch `createdFor`.
    - Validates that caller holds no prior active enrollment in another batch of the same program.

  - The actor queries Neo4j to retrieve the ordered list of child course IDs.
  - The actor prepares a logged Cassandra batch statement:
    - Inserts parent program enrollment into `sunbird_courses.user_enrolments` (`status: 1`, `active: true`, `progress: 0`).
    - For each child course, identifies its active batch and inserts a corresponding enrollment row.

  - Cassandra executes the atomic logged batch commit (`ConsistencyLevel.LOCAL_QUORUM`).
  - LMS emits an enrollment telemetry event to Kafka topic `{{env}}.telemetry.enrolment`.
  - System returns HTTP `200 OK` (`{"response": "SUCCESS"}`).
  - UI transitions dynamically: action button updates to **"Start Learning"**, and module launch controls unlock.

- **Extensions & Alternative Flows:**
  - **4a. Server-Side Tenancy Rejection:**
    - *Condition:* A compromised client invokes the enrollment API directly for an unauthorized program.
    - *System Action:* Backend detects tenancy mismatch, aborts transaction, and returns HTTP `403 Forbidden` (`ERR_MDO_ACCESS_DENIED`).

  - **4b. Verification Status Lapsed:**
    - *Condition:* Program requires Verified Karmayogi status, but caller's profile is unverified.
    - *System Action:* Backend returns HTTP `403 Forbidden` (`ERR_VERIFICATION_REQUIRED`). UI opens an alert modal prompting the user to complete verification with their MDO Admin.

- **Post-conditions:** Civil servant is officially enrolled across the parent program and all child courses; learning progression tracking begins.
- **Evolution Milestone:** Engineered in **Q3** ([KB-1950: Q3 | Content Portal Redesign | Learner consumption for all types of content](https://karmayogibharat.atlassian.net/browse/KB-1950) (Prod Deployed)); access control formalized under **Q8** ([KB-8819: Q8 | Learning Path | Access Control](https://karmayogibharat.atlassian.net/browse/KB-8819) (KB Approved), [KB-9603: Q8 | Access Control | User Group based Access Control](https://karmayogibharat.atlassian.net/browse/KB-9603) (Prod Deployed)).

### UC-07 · Consume Bundled Learning Curriculum

- **Primary Actor:** Enrolled Civil Servant (Learner)
- **Secondary Actor:** Content Media Player, LMS Course Service (`ContentConsumptionActor`), Cassandra Store
- **Trigger:** Enrolled civil servant launches and consumes videos, PDFs, interactive HTML5, or SCORM modules within bundled courses.
- **Summary:** The learner progresses through child courses sequentially or concurrently. As learning units are completed, telemetry heartbeats synchronize consumption states, updating child course progress and rolling up completion percentages into the parent program container.
- **Pre-conditions:**
  - Active enrollment exists in `sunbird_courses.user_enrolments`.
  - For closed batches, current timestamp falls within and .

- **Main Success Scenario (Basic Flow):**
  - Learner clicks **"Start Learning"** or **"Resume"** on the program TOC.
  - The portal loads the child course content player.
  - Learner consumes content assets (e.g., watches an MP4 lecture or reads a PDF guide).
  - The client media player generates telemetry events (`INTERACT`, `HEARTBEAT`, `IMPRESSION`) and dispatches `POST /apis/proxies/v8/learner/course/v1/content/state/update`.
  - `ContentConsumptionActor` updates Cassandra table `sunbird_courses.user_content_consumption`.
  - When all required units of a child course meet completion thresholds, the child course enrollment record updates to `status = 2` (Completed).
  - The system recalculates parent Moderated Program progress:

1. Cassandra updates `user_enrolments.progress` for the parent program row.
2. Learner views real-time progress bar increments on their dashboard and program TOC.

- **Extensions & Alternative Flows:**
  - **2a. Closed Batch Expiration During Consumption:**
    - *Condition:* Learner attempts to stream child content after the closed batch `endDate` has passed.
    - *System Action:* Player locks media playback and displays a notification: *"This cohort expired on [Date]. Content access is closed."*

  - **4a. Network Disconnection / Offline Playback (Mobile App):**
    - *Condition:* Learner consumes cached encrypted units on the Flutter mobile app while offline.
    - *System Action:* Telemetry events are queued locally in SQLite and flushed to the backend when network connectivity is re-established.

- **Post-conditions:** Progress is persisted in Cassandra; completed child modules unlock subsequent curricular units.
- **Evolution Milestone:** Delivered in **Q3** ([KB-1950: Q3 | Content Portal Redesign | Learner consumption for all types of content](https://karmayogibharat.atlassian.net/browse/KB-1950) (Prod Deployed)); player optimizations integrated in **Q7** ([KB-7854: Q7 | Search & listing | Learner Portal & Mobile App](https://karmayogibharat.atlassian.net/browse/KB-7854) (KB Approved)).

### UC-08 · Complete Program & Receive Verifiable Credential

- **Primary Actor:** Enrolled Civil Servant (Learner)
- **Secondary Actor:** LMS Course Service, Certificate Generator Service (`certificate-service`), Apache Kafka
- **Trigger:** Learner completes 100% of all child courses bundled within the Moderated Program.
- **Summary:** The platform evaluates terminal completion criteria across all child courses, marks the parent program enrollment completed (`status = 2`), triggers an asynchronous certificate event, and issues a cryptographically signed, verifiable digital certificate containing a QR code.
- **Pre-conditions:**
  - Learner is actively enrolled in the parent Moderated Program.
  - Every child course record in `sunbird_courses.user_enrolments` holds `status = 2`.

- **Main Success Scenario (Basic Flow):**
  - Learner completes the final module of the last remaining child course.
  - LMS Course Service detects that .
  - The service updates Cassandra table `sunbird_courses.user_enrolments` for the parent program:
    - Sets `status = 2` (Completed).
    - Sets `completedon = CurrentTimestamp`.
    - Sets `completionpercentage = 100`.

  - LMS emits an asynchronous event to Kafka topic `{{env}}.certificate.issue` containing `userId`, `courseId` (Program ID), `batchId`, and target MDO metadata.
  - `certificate-service` consumes the Kafka event.
  - The service populates the program's configured SVG/PDF certificate template with learner name, ministry, and completion date.
  - The service generates a W3C-compliant Verifiable Credential and encodes a cryptographically signed QR code onto the template.
  - The rendered certificate artifact is uploaded to cloud object storage.
  - The certificate reference is committed to Cassandra `user_enrolments.issued_certificates`.
  - Learner receives an in-app completion notification. The certificate becomes instantly viewable, downloadable, and exportable to DigiLocker from the learner's profile.

- **Extensions & Alternative Flows:**
  - **4a. Certificate Service Unavailable:**
    - *Condition:* Certificate generator encounters an outage or Kafka lag.
    - *System Action:* Program status remains successfully marked `Completed`. The certificate generation request is moved to a dead-letter/retry queue and retried with exponential backoff until rendered.

- **Post-conditions:** Program lifecycle concludes; civil servant holds a verifiable digital credential endorsed by their ministry and Karmayogi Bharat.
- **Evolution Milestone:** Core certification rolled out in **Q3** ([KB-1950: Q3 | Content Portal Redesign | Learner consumption for all types of content](https://karmayogibharat.atlassian.net/browse/KB-1950) (Prod Deployed)); mobile certificate downloads and DigiLocker syncing enhanced in **Q4–Q8** ([KB-4493: Q4 l Karma Programs l Portal | Access Karma Programs](https://karmayogibharat.atlassian.net/browse/KB-4493) (Prod Deployed), [KB-8819: Q8 | Learning Path | Access Control](https://karmayogibharat.atlassian.net/browse/KB-8819) (KB Approved)).

### UC-09 · Monitor Cohort Progress & Audit Program Analytics

- **Primary Actor:** Program Coordinator / MDO Administrator
- **Secondary Actor:** Reporting Service, Analytics Pipeline, Cassandra Database
- **Trigger:** Program Coordinator or MDO Leader tracks departmental adoption, completion metrics, and compliance logs.
- **Summary:** Authorized administrators inspect aggregate cohort completion percentages, enrollment conversions, and learner progress distributions across their department's moderated programs, with options to export audit reports.
- **Pre-conditions:**
  - User holds `PROGRAM_COORDINATOR`, `MDO_ADMIN`, or `MDO_LEADER` roles.
  - User's `rootOrgId` matches the program's target MDOs.

- **Main Success Scenario (Basic Flow):**
  - Administrator navigates to the **Program Operations / Batch Analytics** dashboard.
  - Client dispatches `GET /apis/proxies/v8/course/v1/batch/report/{batchId}`.
  - Reporting service queries aggregated views across Cassandra `user_enrolments` and `course_batch`.
  - System computes cohort metrics:
    - **Total Enrolled Learners:** .
    - **Completion Conversion Rate:** .
    - **Progress Distribution:** Categorized into Not Started (), In-Progress (), and Completed ().

  - UI renders interactive progress graphs, filterable by designation and sub-department.
  - Administrator clicks **Download Detailed Report (CSV)** to extract participant completion logs for departmental compliance auditing.

- **Extensions & Alternative Flows:**
  - **2a. Cross-Tenancy Access Attempt:**
    - *Condition:* An administrator from Department A attempts to query the analytics endpoint for a program cohort belonging strictly to Department B.
    - *System Action:* Gateway detects tenant mismatch and returns HTTP `403 Forbidden`. Zero participant data is leaked across organizational perimeters.

- **Post-conditions:** Departmental administrators obtain verifiable compliance audits without exposing cross-ministry data.
- **Evolution Milestone:** Basic coordinator reporting introduced in **Q6** ([KB-7067: Q6 | Content Portal | Navigation and user experience for program coordinator](https://karmayogibharat.atlassian.net/browse/KB-7067) (Prod Deployed)); peer validation and multi-tenant reporting optimizations deployed in **Q11–Q13** ([KB-13016: Q11 | Peer Validation | MDO Peer validation survey creation and listing](https://karmayogibharat.atlassian.net/browse/KB-13016) (Prod Deployed), [KB-13017: Q11 | Peer Validation | SPV Peer validation survey creation and listing](https://karmayogibharat.atlassian.net/browse/KB-13017) (Prod Deployed)).

## 3. Actor-to-Use-Case Interaction Matrix

| Actor / Entity | UC-01 Create | UC-02 Bundle | UC-03 Batch | UC-04 Discover | UC-05 TOC | UC-06 Enrol | UC-07 Consume | UC-08 Certify | UC-09 Report |
|---|---|---|---|---|---|---|---|---|---|
| **Content Creator** | **Primary** | **Primary** | Supporting | N/A | Viewer | N/A | N/A | N/A | Viewer |
| **Content Publisher** | Approver | **Primary** | N/A | N/A | Viewer | N/A | N/A | N/A | N/A |
| **Program Coordinator** | Supporting | Supporting | **Primary** | N/A | Viewer | N/A | N/A | N/A | **Primary** |
| **Eligible Learner** | N/A | N/A | N/A | **Primary** | **Primary** | **Primary** | **Primary** | **Primary** | N/A |
| **Ineligible Learner** | N/A | N/A | N/A | Blocked | Blocked | Blocked | Blocked | Blocked | N/A |
| **MDO Administrator** | Governance | Governance | Overseer | N/A | N/A | N/A | N/A | N/A | **Primary** |
| **Backend Services** | Executant | Executant | Executant | Executant | Executant | Executant | Executant | Executant | Executant |
