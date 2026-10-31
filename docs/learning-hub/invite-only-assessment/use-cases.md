# Invite-Only Assessment — Use Cases

## 1. Document Control & Executive Summary

### 1.1 Document Control

- **Document Title:** Generic Use Cases: Invite-Only Assessment End-to-End Lifecycle and Enterprise Evolution
- **Platform:** iGOT Karmayogi Bharat
- **Evolutionary Scope:** Q2 through Q13 Quarterly Milestones
- **Target Audience:** Solution Architects, Product Owners, Business Analysts, Frontend/Backend Engineers, DevOps/QA Engineers, and Departmental Program Coordinators

### 1.2 Executive Summary & Context

An **Invite-Only Assessment** is an evaluation asset designed for targeted, high-stakes, and time-bound evaluations across Ministries, Departments, and Organizations (MDOs). Unlike open standalone assessments that automatically provision open batches for universal enrollment, Invite-Only Assessments enforce strict catalog shielding, bypass automated post-publish batch generation, and delegate batch creation, sub-daily scheduling, and cohort invitation to authorized Program Coordinators (PCs).

This document establishes the canonical suite of **Generic Use Cases** spanning the entire product lifecycle from **Q2 to Q13**:

1. **Creation & Authoring Lifecycle (CBP):** Schema validation (`courseCategory: "Invite-Only Assessment"`), multi-tier evaluation models (Question Weightage with EMDH difficulty bands vs. Option Weightage for psychometrics), sectional time-bounds, and negative marking.
2. **Publishing & Asynchronous Pipelines:** Kafka event emission and Apache Flink stream processing (`BatchCreation.scala`) that suppresses automatic batch creation.
3. **Coordination & Cohort Administration:** Program Coordinator workspaces (`KB-7067`, `KB-2960`), sub-daily temporal scheduling (`KB-5570` with start/end timestamps and duration buffers), bulk CSV cohort parsing with instant error logging (`KB-8351`), and roster immutability locks (`KB-8365`, `KB-8400`).
4. **Learner Discovery & Pre-Assessment:** Catalog isolation shielding assessments from public search (`KB-9333`, `KB-9337`), assigned content consolidation (`KB-9789`), 48h/24h real-time countdown clocks, and instructions acceptance gates.
5. **Runtime Consumption & Exam Engine:** High-concurrency test player, 3x combinatorial randomization (pools, sequences, options), single-sitting session enforcement, and dual LocalStorage-Redis resilience against network failure.
6. **Evaluation & Scoring:** V6 Submit API evaluation, negative marking deductions, immediate score summary rendering, and psychometric trait computation.
7. **Reporting & Governance:** CBP Provider Dashboards (`KB-6378`), standalone assessment ETL pipelines, and masked-PII CSV audit reports for departmental leadership.

## 2. Actor Profiles & Stakeholder Persona Matrix

**ACTOR ROLES & ACCESS PERIMETER MATRIX**

| Actor Role | Surface / Client | Primary Responsibilities & Permitted Actions |
|---|---|---|
| **Content Creator** | Content Builder Portal (CBP Web) | Authors question items; configures EMDH difficulty bands; selects Custom Users access mode; establishes sections, cutoffs, durations, and negative marking ratios. |
| **Content Reviewer & Publisher** | Content Builder Portal (CBP Web) | Validates rubric integrity, syllabus alignment, and media assets; executes formal publish action to make content live. |
| **Program Coordinator (PC)** | Program Coordinator Hub ("Manage Content" Web) | Manages batch scheduling; configures start/end dates & times; enforces enrollment duration buffers; ingests cohorts via CSV or single modal; downloads error logs; monitors attendance. |
| **Invited Learner** | Learner Web Portal & Mobile App | Discovers test via "Scheduled Assessments" / "My Assigned"; views 48h/24h countdowns; accepts instructions; executes single-sitting attempt; reviews immediate scores/insights. |
| **Non-Invited Learner** | Learner Web Portal & Mobile App | Attempting to browse or launch tests outside cohort roster.<br/>Shielded from discovery; direct URL access yields HTTP 403. |
| **MDO / SPV Admin** | Admin Analytics Console (Web) | Audits departmental performance metrics; tracks completion rates; downloads masked-PII evaluation reports for cadres. |

## 3. Evolutionary Roadmap of Use Cases (Q2 – Q13)

**USE CASE EVOLUTION ACROSS QUARTERLY RELEASES**

| Epoch | Evolutionary Milestones | Impacted Use Cases |
|---|---|---|
| **Q2 – Q4** | Schema Baseline & Pipeline Decoupling | • UC-AUTH-01: Authoring with Custom Users Mode<br/>• UC-PUB-01: Flink Auto-Batch Suppression<br/>• UC-PLAY-01: Standard Standalone Delivery |
| **Q5 – Q8** | Authoring Richness & Coordination Workspaces | • UC-AUTH-02: Sectional & Negative Scoring<br/>• UC-COORD-01: PC Hub & Single Modal Invites<br/>• UC-COORD-02: CSV Bulk Ingestion & Error Logs<br/>• UC-COORD-03: Active Roster Immutability Lock<br/>• UC-PLAY-02: 3x Combinatorial Randomization |
| **Q9 – Q11** | Temporal Governance, Access Control & Resumption | • UC-COORD-04: Sub-Daily Batch Scheduling<br/>• UC-DISC-01: Dynamic Countdown Ribbon (48h/24h)<br/>• UC-PLAY-03: Single-Sitting State Resumption<br/>• UC-PLAY-04: Auto-Submission on Window Expiry<br/>• UC-EVAL-01: V6 Algorithmic Evaluation Submit |
| **Q12 – Q13** | Enterprise Shielding, Analytics & Scaled Concurrency | • UC-DISC-02: Catalog Search & Filter Isolation<br/>• UC-REP-01: Provider Dashboard & Masked CSV<br/>• UC-SEC-01: Direct Link URL Interception (403) |

## 4. Primary Use Case Inventory

**PRIMARY USE CASE INVENTORY**

| Use Case ID | Use Case Name | Primary Actor |
|---|---|---|
| **UC-AUTH-01** | Author Invite-Only Assessment Questionset & Metadata | Content Creator |
| **UC-AUTH-02** | Configure Sectional Time-Bounds, Rubrics & Penalties | Content Creator |
| **UC-PUB-01** | Publish Content & Suppress Automated Batch Provisioning | Content Publisher / Flink |
| **UC-COORD-01** | Schedule Sub-Daily Batch with Start & End Time Windows | Program Coordinator |
| **UC-COORD-02** | Ingest Learner Cohort via CSV & Audit Ingestion Errors | Program Coordinator |
| **UC-COORD-03** | Modify Cohort Roster & Enforce Active Attempt Locks | Program Coordinator |
| **UC-DISC-01** | Discover Scheduled Assessment & Track Countdown Clocks | Invited Learner |
| **UC-DISC-02** | Shield Invite-Only Assessment from Public Catalog Search | Non-Invited Learner |
| **UC-PLAY-01** | Gate Assessment Launch via Mandatory Instructions Check | Invited Learner |
| **UC-PLAY-02** | Consume Randomized Questions under Single-Sitting Rules | Invited Learner |
| **UC-PLAY-03** | Recover Assessment State Across Network Disconnections | Invited Learner |
| **UC-PLAY-04** | Trigger Auto-Submission upon Window / Timer Expiration | Learner Client Runtime |
| **UC-EVAL-01** | Evaluate Responses, Deduct Penalties & Present Results | Evaluation Engine / Client |
| **UC-REP-01** | Generate MDO Cadre Analytics & Masked-PII CSV Reports | MDO / Department Admin |
| **UC-SEC-01** | Intercept Unauthorized Direct URL Launch Attempts | Security Gateway (Kong) |

## 5. Detailed Use Case Specifications

### 5.1 Authoring & Configuration Use Cases

#### Use Case: UC-AUTH-01 — Author Invite-Only Assessment Questionset & Metadata

- **Primary Actor:** Content Creator
- **Secondary Actors:** Content & Taxonomy Service, Neo4j Graph DB
- **Evolutionary Baseline:** Q4 (`KB-3958`, `KB-3959`, `sunbird-cb-ext-schema`)
- **Pre-conditions:** Creator is authenticated in CBP with `CONTENT_CREATOR` role in Keycloak.
- **Trigger:** Creator clicks `Create Content` -> `Assessment` in the CBP workspace.

**Main Success Scenario:**

1. Creator navigates to Assessment Metadata configuration.
2. Under "Access Settings", Creator selects `Custom Users`.
3. System automatically sets `courseCategory` to `"Invite-Only Assessment"` and renders an advisory banner: *"Batch creation, scheduling, and cohort enrollment are delegated to Program Coordinators."*
4. Creator defines root properties: `name`, `description`, `expectedDuration` (e.g., 3600s), and `maxAssessmentRetakeAttempts` (e.g., 0).
5. Creator selects `assessmentType`:
  - If `questionWeightage`: Enables marks, sectional cutoffs, and negative marking.
  - If `optionWeightage`: Enables psychometric scoring (locks sections to 1, disables pass/fail cutoffs).

6. Creator clicks `Save Draft`.
7. System serializes metadata against `sunbird-cb-ext-schema` and executes `POST /apis/proxies/v8/cqfquestionset/questionset/create`.
8. Backend creates a Questionset node in Neo4j with properties: `courseCategory: "Invite-Only Assessment"`, `status: "Draft"`, and returns generated `identifier` (e.g., `do_1141410889336094721230`).

**Extensions & Alternative Flows:**

- *3a. Creator attempts to switch access settings to "All Users":* System warns that the assessment category will revert to public `Standalone Assessment`, re-enabling automated public batch provisioning.

**Post-conditions:** Questionset node persisted in Neo4j in `Draft` state; `courseCategory` permanently tagged as `"Invite-Only Assessment"`.

#### Use Case: UC-AUTH-02 — Configure Sectional Time-Bounds, Rubrics & Penalties

- **Primary Actor:** Content Creator
- **Secondary Actors:** Neo4j Knowledge Graph
- **Evolutionary Baseline:** Q4–Q5 (`KB-3958`, `KB-3963`, Confluence FRS `85295123`)
- **Pre-conditions:** Assessment created in Draft mode under `questionWeightage`.
- **Trigger:** Creator enters Section & Question Configuration editor.

**Main Success Scenario:**

1. Creator adds sections (supported: 1 to 6 sections).
2. For each section, Creator configures:
  - Section Title (e.g., "Section A: Constitutional Framework").
  - `sectionTimeBound`: Configured as `Yes` or `No`.
  - `expectedDuration`: Section duration in seconds (mandatory if time-bound).
  - `sectionalPassPercentage`: Minimum cutoff threshold (e.g., 60%).
  - `negativeMarkingPercentage`: Penalty ratio (`0%`, `25%`, `50%`, `75%`, `100%`).
  - `questionTagging`: Difficulty bands (`Easy`, `Medium`, `Difficult`, `HotS`).

3. Creator authors/attaches questions across supported formats: Single Choice MCQ, Multi Choice MCQ, Match the Following, Fill in the Blanks, Paragraph Comprehension, and Audio/Video questions (up to 400 MB).
4. Creator enables 3x Randomization flags:
  - Dynamic question pool sampling (`sampleSize`).
  - Intra-section question shuffling.
  - Intra-question option permutation.

5. Creator clicks `Save & Send for Review`.

**Extensions & Alternative Flows:**

- *2a. Sectional duration exceeds total assessment duration:* System blocks save action with validation error: *"Sum of section durations cannot exceed total expected duration."*

**Post-conditions:** Neo4j hierarchy updated with `(:QuestionSet)-[:HAS_SECTION]->(:Section)-[:CONTAINS]->(:Question)` relationships; status transitions to `InReview`.

### 5.2 Publishing & Post-Publish Pipeline Use Cases

#### Use Case: UC-PUB-01 — Publish Content & Suppress Automated Batch Provisioning

- **Primary Actor:** Content Publisher
- **Secondary Actors:** Content Service, Apache Kafka, Apache Flink (`BatchCreation.scala`), Cassandra DB
- **Evolutionary Baseline:** Q4 (`KB-3958`, `KB-3959`, Confluence `89751668`)
- **Pre-conditions:** Assessment reviewed and approved; status is `Reviewed`.
- **Trigger:** Publisher clicks `Publish` in CBP console.

**Main Success Scenario:**

1. Publisher verifies question distribution, scoring rubrics, and access settings.
2. Publisher clicks `Publish Content`.
3. Content Service updates Neo4j node status to `Live` and emits an event to Kafka topic `postpublish.events`.
4. Apache Flink streaming consumer `BatchCreation.scala` ingests event payload:
  ```json
  {
    "identifier": "do_1141410889336094721230",
    "courseCategory": "Invite-Only Assessment",
    "status": "Live"
  }
  ```
5. Flink processor evaluates `courseCategory`:
  - Checks: `StringUtils.containsIgnoreCase(courseCategory, "Invite-Only")`.
  - Evaluates to `TRUE`.

6. Flink processor sets `trackable = false` and terminates batch creation flow.
7. System logs: *"Asset is categorized as Invite-Only Assessment. Auto-batch creation SUPPRESSED."*
8. Zero records inserted into Cassandra `sunbird.course_batch`.

**Extensions & Alternative Flows:**

- *5a. Content is categorized as standard "Course Assessment":* Flink evaluates check as `FALSE` and executes standard CQL insert provisioning an open batch (`enrollmentType: "open"`).

**Post-conditions:** Assessment is `Live` in Neo4j; no automated batch exists in Cassandra; asset awaits Program Coordinator scheduling.

### 5.3 Batch Coordination & Cohort Administration Use Cases

#### Use Case: UC-COORD-01 — Schedule Sub-Daily Batch with Start & End Time Windows

- **Primary Actor:** Program Coordinator (PC)
- **Secondary Actors:** Batch Management Service, Cassandra DB
- **Evolutionary Baseline:** Q4–Q9 (`KB-5350`, `KB-5570`, `KB-7067`, Confluence FRS `85295123`)
- **Pre-conditions:** PC is assigned to target MDO; assessment is `Live` under `Invite-Only Assessment`.
- **Trigger:** PC navigates to "Manage Content" hub (`KB-7067`) -> selects assessment -> clicks `Create Batch`.

**Main Success Scenario:**

1. PC enters Batch Details: Name (e.g., "Cadre_Batch_2026") and Description.
2. PC sets temporal boundaries:
  - `startDate`: `2026-06-10` | `startTime`: `10:00:00` (IST).
  - `endDate`: `2026-06-10` | `endTime`: `12:00:00` (IST).

3. System verifies temporal constraints:
  - Window duration () Assessment Duration ().
  - End DateTime is in the future.

4. System automatically computes Enrollment Cutoff Buffer:
5. PC clicks `Create Batch`.
6. Batch Service executes CQL insert:
  ```sql
  INSERT INTO sunbird.course_batch (course_id, batch_id, name, enrollment_type, start_date, end_date, start_time, end_time, status) VALUES ('do_1141410889336094721230', '01408031797522432048', 'Cadre_Batch_2026', 'invite-only', '2026-06-10', '2026-06-10', '10:00:00', '12:00:00', 1);
  ```
7. System returns success message and displays newly generated `batchId`.

**Extensions & Alternative Flows:**

- *3a. Configured window duration is less than total test duration:* System rejects submission with error: *"Configured batch window (1 hour) cannot be shorter than the assessment duration (1.5 hours)."*
- *3b. End DateTime is before Start DateTime:* System blocks submission with error: *"End Date/Time must be after Start Date/Time."*

**Post-conditions:** Batch persisted in Cassandra `sunbird.course_batch` with `enrollment_type = "invite-only"`; batch is ready for learner cohort ingestion.

#### Use Case: UC-COORD-02 — Ingest Learner Cohort via CSV & Audit Ingestion Errors

- **Primary Actor:** Program Coordinator (PC)
- **Secondary Actors:** User Management Service, Cassandra DB, Ingestion Parser
- **Evolutionary Baseline:** Q3–Q6 (`KB-2960`, `KB-7067`, `KB-8351`)
- **Pre-conditions:** Active batch created; current timestamp is before Enrollment Cutoff Buffer.
- **Trigger:** PC opens batch -> clicks `Manage learner invites` modal (`KB-2960`).

**Main Success Scenario:**

1. PC selects "Bulk Upload (CSV)" tab inside the unified modal.
2. PC uploads CSV roster containing candidate identifiers (`userId` or verified government emails).
3. Ingestion parser verifies candidate records against Keycloak identity database.
4. System partitions records into:
  - *Valid Records:* Active, verified user UUIDs.
  - *Erroneous Records:* Malformed UUIDs, unregistered emails, duplicate rows.

5. For valid records, system executes batch CQL insert into Cassandra:
  ```sql
  INSERT INTO sunbird.user_enrolments (user_id, course_id, batch_id, active, status, enrolled_date) VALUES (?, 'do_1141410889336094721230', '01408031797522432048', true, 0, toTimestamp(now()));
  ```
6. System updates batch enrollment counter (`KB-8350`).
7. If any rows fail validation, system activates the "Errors" tab (`KB-8351`), displaying row-by-row failure reasons.
8. PC clicks `Download Error Log` to extract CSV audit of rejected rows.

**Extensions & Alternative Flows:**

- *2a. PC uploads CSV after Enrollment Cutoff Buffer has lapsed:* System blocks upload with error: *"Enrollment window has closed. Invitations cannot be added within [Duration] of batch end time."*
- *4a. All rows are valid:* System directly displays success toast: *"Successfully enrolled N candidates."* Errors tab remains hidden.

**Post-conditions:** Valid candidates enrolled in Cassandra `sunbird.user_enrolments` with `status = 0` (Not Started); error log generated for administrative remediation.

#### Use Case: UC-COORD-03 — Modify Cohort Roster & Enforce Active Attempt Locks

- **Primary Actor:** Program Coordinator (PC)
- **Secondary Actors:** User Management Service, Cassandra DB
- **Evolutionary Baseline:** Q6 (`KB-7067`, `KB-8365`, `KB-8400`)
- **Pre-conditions:** Learner roster populated; assessment window is active or approaching.
- **Trigger:** PC attempts to un-enroll/remove a candidate from the batch roster.

**Main Success Scenario:**

1. PC navigates to "Manage learner invites" modal -> selects "Enrolled Learners" list.
2. PC locates candidate and toggles the switch to `Remove` (or clicks `Delete`).
3. Backend service queries Cassandra `sunbird.user_enrolments`:
  ```sql
  SELECT status
  FROM sunbird.user_enrolments
  WHERE user_id = :userId
    AND course_id = :courseId
    AND batch_id = :batchId;
  ```
4. Cassandra returns `status = 0` (Not Started).
5. System marks enrollment as inactive:
  ```sql
  UPDATE sunbird.user_enrolments SET active = false WHERE user_id = :userId AND course_id = :courseId AND batch_id = :batchId;
  ```
6. Candidate is removed from active roster; enrolled count decrements by 1 (`KB-8350`).

**Extensions & Alternative Flows:**

- *4a. Candidate has already started or finished assessment (*`status = 1` or `status = 2`):
  - System blocks deletion.
  - UI displays error dialog (`KB-8365`, `KB-8400`): *"Cannot remove learner from roster: Assessment attempt is already in progress or completed."*
  - Learner's enrollment status and submission records remain locked and preserved.

**Post-conditions:** Unattempted candidates are successfully de-enrolled; active/completed attempts remain protected from administrative tampering.

### 5.4 Discovery & Pre-Assessment Use Cases

#### Use Case: UC-DISC-01 — Discover Scheduled Assessment & Track Countdown Clocks

- **Primary Actor:** Invited Learner
- **Secondary Actors:** Learner Portal / Mobile App Client, Redis Session Cache
- **Evolutionary Baseline:** Q9–Q11 (`KB-9789`, Confluence `802717699`, FRS `85295123`)
- **Pre-conditions:** Learner is enrolled in an active Invite-Only batch (`active = true`, `status = 0`).
- **Trigger:** Learner logs in to Learner Web Portal or Mobile App.

**Main Success Scenario:**

1. Learner client requests assigned content via `GET /cbplan/v2/user/list`.
2. Portal identifies active Invite-Only assessment batch.
3. System renders dedicated "Scheduled Assessments" card on the Home Dashboard (positioned below Weekly Claps).
4. System calculates temporal offset against server timestamp:
  - *Phase A (Between 48h and 24h before Start):* Renders static banner: *"Scheduled on [Date] at [Time]"*.
  - *Phase B (Within 24h of Start):* Renders real-time countdown timer ticking down: `Starts in HH:mm:ss`.

5. Assessment card displays: Title, Duration, Question Count, and Pass Percentage.
6. The `Start Assessment` action button remains in a `DISABLED` state.
7. Assessment also appears under "My Assigned Content" workspace (`KB-9789`) with status badge: `Not Started`.

**Extensions & Alternative Flows:**

- *6a. Wall-clock reaches Start Time (10:00:00 IST):*
  - Countdown clock reaches `00:00:00`.
  - System transitions card state to `Active`.
  - `Start Assessment` action button transitions to `ENABLED` (clickable).

**Post-conditions:** Learner is visually notified of upcoming exam; launch button remains protected until official start timestamp.

#### Use Case: UC-DISC-02 — Shield Invite-Only Assessment from Public Catalog Search

- **Primary Actor:** Non-Invited Learner
- **Secondary Actors:** Search & Catalog Service, Elasticsearch Cluster
- **Evolutionary Baseline:** Q8–Q12 (`KB-9333`, `KB-9337`)
- **Pre-conditions:** Assessment is published (`Live`), but candidate is NOT in the batch roster.
- **Trigger:** Non-invited learner browses course catalog or enters search queries (e.g., "Cadre Assessment").

**Main Success Scenario:**

1. Learner enters search term "Cadre Assessment" in portal search bar.
2. Web/Mobile client dispatches query to `/apis/proxies/v8/composite/v3/search`.
3. Search Service intercepts query and injects mandatory shielding filter:
  ```json
  {
    "query": {
      "bool": {
        "must": [
          {
            "match": {
              "name": "Cadre Assessment"
            }
          }
        ],
        "must_not": [
          {
            "term": {
              "courseCategory.keyword": "Invite-Only Assessment"
            }
          }
        ]
      }
    }
  }
  ```
4. Elasticsearch executes search against `composite_search_index`.
5. System returns matching public courses and assessments; Invite-Only Assessment is omitted from search hits.
6. Catalog filter facets (Categories, Content Types) exclude Invite-Only assessment counts.

**Extensions & Alternative Flows:**

- *1a. Learner browses Catalog Filter Tree on Mobile App:* Mobile client enforces identical shielding logic (`KB-9337`), preventing discovery across all mobile viewports.

**Post-conditions:** Confidential cadre assessment remains invisible to uninvited platform users.

### 5.5 Runtime Assessment Consumption Use Cases

#### Use Case: UC-PLAY-01 — Gate Assessment Launch via Mandatory Instructions Check

- **Primary Actor:** Invited Learner
- **Secondary Actors:** API Gateway (Kong), CQF Delivery Service
- **Evolutionary Baseline:** Q4–Q9 (`KB-4604`, `KB-6557`, Confluence SRS `87392295`)
- **Pre-conditions:** Start Time reached; `Start Assessment` button is enabled.
- **Trigger:** Learner clicks `Start Assessment`.

**Main Success Scenario:**

1. Learner clicks `Start Assessment`.
2. System intercepts launch and opens mandatory "Assessment Instructions Modal".
3. Modal displays:
  - Total Questions and Total Marks.
  - Total Duration and Sectional Time Limits (if applicable).
  - Negative Marking Rules (e.g., *"25% marks deducted per incorrect answer"*).
  - Single-Sitting Notice: *"Once started, timer cannot be paused. Closing browser will not extend duration."*

4. `Proceed to Assessment` CTA button is rendered in a `DISABLED` state.
5. Learner reads instructions and clicks checkbox: *"I have read and understood the instructions."*
6. `Proceed to Assessment` CTA becomes `ENABLED`.
7. Learner clicks `Proceed to Assessment`.
8. Client requests hierarchy: `GET /api/player/questionset/v5/hierarchy/{assessmentId}`.
9. System launches fullscreen test player.

**Extensions & Alternative Flows:**

- *5a. Learner closes modal without checking T&C:* Assessment attempt does not initialize; timer does not start; status remains `Not Started`.

**Post-conditions:** Learner enters active exam environment; attempt state transitions to `In Progress`.

#### Use Case: UC-PLAY-02 — Consume Randomized Questions under Single-Sitting Rules

- **Primary Actor:** Invited Learner
- **Secondary Actors:** CQF Test Player, Redis Session Cache, LocalStorage Journal
- **Evolutionary Baseline:** Q4–Q9 (`KB-3958`, Confluence SRS `87392295`)
- **Pre-conditions:** Hierarchy delivered with answer keys stripped; 3x randomization applied.
- **Trigger:** Player initializes question rendering.

**Main Success Scenario:**

1. Player renders 3x randomized question set:
  - Sampled questions from section bank.
  - Shuffled question sequence within sections.
  - Shuffled options within each MCQ item.

2. System initializes `LocalJournalManager` in browser `localStorage`.
3. System starts non-pausable countdown timer synchronized against backend clock.
4. System displays Question Palette with standard color-coded states:
  - *Green:* Answered.
  - *Red:* Not Answered.
  - *Purple:* Marked for Review.
  - *Grey:* Skipped / Unvisited.

5. Dynamic timer color reflects urgency: Green (> 50%), Amber (20–50%), Pulsing Red (< 20%).
6. Learner selects answers, clicks `Save & Next`, or toggles `Mark for Review`.
7. Each answer selection updates local journal and dispatches background heartbeat to Redis (`cqf:session:{userId}:{assessmentId}`).
8. If assessment has sectional time bounds (`sectionTimeBound = Yes`):
  - Section navigation tabs are locked.
  - When section timer lapses, player automatically submits section and advances to the next section.

**Extensions & Alternative Flows:**

- *8a. Section is not time-bound:* Learner clicks `Next Section`; system prompts confirmation modal warning that previous sections cannot be re-entered if forward-only progression is configured.

**Post-conditions:** Responses continuously cached in local storage journal and Redis session store.

#### Use Case: UC-PLAY-03 — Recover Assessment State Across Network Disconnections

- **Primary Actor:** Invited Learner
- **Secondary Actors:** LocalJournalManager, Redis Session Cache, Gateway
- **Evolutionary Baseline:** Q5–Q9 (Confluence SRS `87392295`)
- **Pre-conditions:** Attempt in progress; active session journal exists in `localStorage`.
- **Trigger:** Learner experiences network dropout, accidental browser refresh, or tab closure.

**Main Success Scenario:**

1. Learner loses internet connection during active attempt.
2. Learner continues answering questions; `LocalJournalManager` logs responses and timestamps locally in encrypted `localStorage`.
3. Learner re-opens browser or re-establishes connectivity and reloads assessment URL.
4. Player initializes and detects local journal matching `cqf_journal_{assessmentId}`.
5. Player sends reconciliation ping to server: `GET /apis/protected/v8/user/evaluate/assessment/heartbeat`.
6. Gateway returns current server timestamp header (`X-Server-Timestamp`).
7. Player computes elapsed wall-clock duration:
8. System verifies `Remaining Duration > 0`.
9. Player re-populates answers from local journal into UI state, restores question palette color codes, sets timer to calculated remaining duration, and resumes test from the active question.

**Extensions & Alternative Flows:**

- *8a. Elapsed duration exceeds total duration during disconnection:*
  - System detects `Remaining Duration <= 0`.
  - Player immediately invokes Use Case `UC-PLAY-04` (Auto-Submission), packages existing local answers, and dispatches final payload to backend.

**Post-conditions:** Test session resumed without data loss; timer reflects true wall-clock decrement.

#### Use Case: UC-PLAY-04 — Trigger Auto-Submission upon Window / Timer Expiration

- **Primary Actor:** Learner Client Runtime
- **Secondary Actors:** CQF Evaluation Service, Cassandra DB, Kafka Bus
- **Evolutionary Baseline:** Q4–Q9 (Confluence FRS `85295123`, SRS `87392295`)
- **Pre-conditions:** Assessment attempt active; global timer reaches `00:00:00` OR batch end time reached.
- **Trigger:** Timer tick event reaches zero.

**Main Success Scenario:**

1. Countdown timer hits `00:00:00`.
2. Test player immediately freezes UI inputs (disables radio buttons, checkboxes, text fields).
3. System displays modal: *"Time has expired. Packaging and submitting your responses..."*
4. Player compiles all answered questions from `LocalJournalManager` into V6 Submit contract payload.
5. Client dispatches `POST /apis/protected/v8/user/evaluate/assessment/submit/v6`.
6. Evaluation Service processes payload, grades answers against golden answer keys, and returns evaluation summary.
7. Player purges local journal from `localStorage`.
8. Player transitions to Result / Summary screen.

**Extensions & Alternative Flows:**

- *5a. Client network drops at exact moment of timer expiry:*
  - Local journal persists compiled submission payload.
  - Player initiates exponential backoff retry loop.
  - Backend provides a 15-minute tolerance grace period past batch end time to accept in-flight submissions before locking attempt permanently.

**Post-conditions:** Final responses submitted; attempt marked as `Completed` in Cassandra; local cache purged.

### 5.6 Evaluation, Scoring & Results Use Cases

#### Use Case: UC-EVAL-01 — Evaluate Responses, Deduct Penalties & Present Results

- **Primary Actor:** CQF Evaluation Engine
- **Secondary Actors:** Learner Client, Cassandra DB, Kafka Bus
- **Evolutionary Baseline:** Q4–Q5 (Confluence `171704641`, `175702042`)
- **Pre-conditions:** V6 submission payload received by Evaluation Service.
- **Trigger:** Ingestion of submission payload at `/apis/protected/v8/user/evaluate/assessment/submit/v6`.

**Main Success Scenario:**

1. Evaluation Service retrieves golden answer keys and rubric weights from Neo4j/Redis cache.
2. System iterates through submitted sections:
  - For each correct question: Adds configured marks based on difficulty band (`Easy`, `Medium`, `Difficult`, `HotS`).
  - For each incorrect question: Deducts negative marks based on section ratio (e.g., of question marks).
  - For skipped/blank questions: Allocates marks (no penalty).

3. System computes section totals, clamping section earned marks at to prevent negative sectional tallies.
4. System computes overall score percentage and evaluates pass/fail status against configured `scoreCutoffType` (AssessmentLevel or SectionLevel).
5. Evaluation Service persists evaluation outcomes into Cassandra:
  - Updates `sunbird.user_enrolments` -> `status = 2` (Completed).
  - Inserts into `sunbird.assessment_evaluations` (attempt ID, score, pass status, section breakdown).

6. System emits telemetry event to Kafka topic `assessment.submit.event`.
7. Evaluation Service returns evaluation JSON to client:
  - Overall Score, Percentage, Total Marks, Time Taken.
  - Accuracy Breakdown: Correct, Incorrect, Blank counts.
  - Section-wise results with Pass/Fail badges.

8. Learner client renders rich summary card.

**Extensions & Alternative Flows:**

- *7a. Metadata configures* `showMarks: "No"`: System suppresses score percentages and sectional breakdowns; renders neutral acknowledgment: *"Assessment submitted successfully. Results will be communicated by your department administrator."*
- *7b. Assessment is* `optionWeightage` (Psychometric): System computes behavioral trait dimensions; suppresses pass/fail badges; renders personality/competency profile.

**Post-conditions:** Attempt permanently evaluated and persisted; learner progress closed; telemetry emitted.

### 5.7 Reporting & Governance Use Cases

#### Use Case: UC-REP-01 — Generate MDO Cadre Analytics & Masked-PII CSV Reports

- **Primary Actor:** MDO / Department Administrator
- **Secondary Actors:** Analytics & Reporting ETL Service, Elasticsearch, Cassandra DB
- **Evolutionary Baseline:** Q5–Q13 (`KB-6378`, Confluence FRS `85295123`)
- **Pre-conditions:** Batch assessment window completed; candidate attempts evaluated.
- **Trigger:** Admin accesses "Assessment Reports" tab in CBP Admin Console.

**Main Success Scenario:**

1. Admin navigates to Provider Dashboard (`KB-6378`).
2. Dashboard segments assessment metrics by category: `Open`, `Moderated`, and `Invite-Only`.
3. Admin selects Invite-Only Assessment batch and reviews high-level KPIs: Total Invited, Participation Rate, Pass Percentage, Average Score, and Sectional Drop-offs.
4. Admin clicks `Export Cadre Evaluation Report (CSV)`.
5. Standalone Assessment ETL pipeline queries Cassandra `sunbird.assessment_evaluations` and `sunbird.user_enrolments`.
6. System applies PII Masking Algorithms:
  - Candidate Email: Masked (e.g., `v*l@gov.in`).
  - Candidate Mobile: Masked (e.g., `+91-**7890`).

7. ETL compiles CSV dataset containing: Learner UUID, Masked Email, Department Name, Batch ID, Attempt Date, Total Score, Pass Status, Time Taken, and Section-wise Marks.
8. System delivers encrypted CSV file download to admin browser.

**Extensions & Alternative Flows:**

- *3a. Batch has 0 completed attempts:* Export button is disabled; dashboard displays banner: *"No completed evaluation records found for this cohort."*

**Post-conditions:** Departmental audit report generated in compliance with government data protection standards.

### 5.8 Security & Edge-Case Use Cases

#### Use Case: UC-SEC-01 — Intercept Unauthorized Direct URL Launch Attempts

- **Primary Actor:** Non-Invited Learner (Adversarial / Unauthorized)
- **Secondary Actors:** Kong API Gateway, EnrolmentGatekeeper Middleware, Cassandra DB
- **Evolutionary Baseline:** Q8–Q12 (`KB-9603`, `KB-9789`)
- **Pre-conditions:** Non-invited learner acquires direct URL or identifier (`do_1141410889336094721230`) through external sharing.
- **Trigger:** Learner pastes URL into browser or executes API call: `GET /api/player/questionset/v5/hierarchy/do_1141410889336094721230`.

**Main Success Scenario:**

1. Request reaches Kong API Gateway with learner's valid Keycloak Bearer Token.
2. Gateway extracts `userId` (`wid`) and parses target `assessmentId`.
3. `EnrolmentGatekeeperMiddleware` intercepts request and queries Cassandra:
  ```sql
  SELECT active, status
  FROM sunbird.user_enrolments
  WHERE user_id = :callerWid
    AND course_id = :assessmentId;
  ```
4. Cassandra returns empty result set (user is not enrolled in any batch for this assessment).
5. Gateway halts request execution; does NOT forward call to CQF Delivery Service.
6. Gateway returns HTTP 403 Forbidden with security payload:
  ```json
  {
    "id": "api.player.hierarchy",
    "ver": "5.0",
    "responseCode": "FORBIDDEN",
    "params": {
      "status": "FAILED",
      "errmsg": "Access Denied: You are not enrolled in an authorized batch for this Invite-Only Assessment."
    }
  }
  ```
7. Learner client renders Access Denied error screen with navigation redirect to Home Dashboard.
8. System logs unauthorized access attempt to Elasticsearch audit index.

**Extensions & Alternative Flows:**

- *4a. Learner is enrolled, but* `active = false` (previously de-enrolled): Gateway returns HTTP 403 Forbidden with message: *"Your invitation to this assessment has been revoked by the program coordinator."*

**Post-conditions:** Assessment content and question bank remain protected from unauthorized inspection.

## 6. End-to-End Requirements-to-Use-Case Traceability Matrix

**TRACEABILITY MATRIX: USE CASES TO JIRA REQUIREMENTS, CODE & APIS**

| Use Case ID | Primary Jira | Release Epoch | Primary API / Component | Implementation Artifact |
|---|---|---|---|---|
| **UC-AUTH-01** | [KB-3958](https://karmayogibharat.atlassian.net/browse/KB-3958), [KB-3959](https://karmayogibharat.atlassian.net/browse/KB-3959) | Q4 Baseline | POST /questionset/create | AssessmentConfig.ts,<br/>sunbird-cb-ext-schema |
| **UC-AUTH-02** | [KB-3958](https://karmayogibharat.atlassian.net/browse/KB-3958), [KB-3963](https://karmayogibharat.atlassian.net/browse/KB-3963) | Q4–Q5 | POST /questionset/update | SectionConfig.ts,<br/>Neo4j Hierarchy Graph |
| **UC-PUB-01** | [KB-3958](https://karmayogibharat.atlassian.net/browse/KB-3958), [KB-3959](https://karmayogibharat.atlassian.net/browse/KB-3959) | Q4 Baseline | Kafka postpublish.event | BatchCreation.scala<br/>(Flink Stream Job) |
| **UC-COORD-01** | [KB-5350](https://karmayogibharat.atlassian.net/browse/KB-5350), [KB-5570](https://karmayogibharat.atlassian.net/browse/KB-5570) | Q4–Q9 | POST /course/batch/create | BatchController.ts,<br/>Cassandra course_batch |
| **UC-COORD-02** | [KB-2960](https://karmayogibharat.atlassian.net/browse/KB-2960), [KB-8351](https://karmayogibharat.atlassian.net/browse/KB-8351) | Q3–Q6 | POST /batch/users/add | ManageInvitesModal.ts,<br/>CSV Parser Pipeline |
| **UC-COORD-03** | [KB-8365](https://karmayogibharat.atlassian.net/browse/KB-8365), [KB-8400](https://karmayogibharat.atlassian.net/browse/KB-8400) | Q6 | POST /batch/users/remove | Roster Immutability Check (status > 0) |
| **UC-DISC-01** | [KB-9789](https://karmayogibharat.atlassian.net/browse/KB-9789), FRS 85295123 | Q9–Q11 | GET /cbplan/v2/user/list | ScheduledCardComponent,<br/>48h/24h Countdown Clock |
| **UC-DISC-02** | [KB-9333](https://karmayogibharat.atlassian.net/browse/KB-9333), [KB-9337](https://karmayogibharat.atlassian.net/browse/KB-9337) | Q8–Q12 | POST /composite/v3/search | Elasticsearch Filter must_not Interceptor |
| **UC-PLAY-01** | [KB-4604](https://karmayogibharat.atlassian.net/browse/KB-4604), [KB-6557](https://karmayogibharat.atlassian.net/browse/KB-6557) | Q4–Q9 | Instructions Modal UI | T&C Checkbox Gatekeeper |
| **UC-PLAY-02** | [KB-3958](https://karmayogibharat.atlassian.net/browse/KB-3958), SRS 87392295 | Q4–Q9 | GET /v5/hierarchy/{id} | HierarchyReadActor,<br/>3x Randomization Engine |
| **UC-PLAY-03** | SRS 87392295 | Q5–Q9 | Heartbeat Sync / WS | LocalJournalManager.ts,<br/>Redis Session Cache |
| **UC-PLAY-04** | FRS 85295123,<br/>SRS 87392295 | Q4–Q9 | POST /submit/v6 | Auto-Submit Trigger on Timer Tick Zero |
| **UC-EVAL-01** | Confluence 171704641 | Q4–Q5 | POST /submit/v6 | EvaluationActor.java,<br/>Cassandra evaluations |
| **UC-REP-01** | [KB-6378](https://karmayogibharat.atlassian.net/browse/KB-6378) | Q5–Q13 | Admin ETL Export API | Masked-PII CSV Pipeline,<br/>Provider Dashboard |
| **UC-SEC-01** | [KB-9603](https://karmayogibharat.atlassian.net/browse/KB-9603), [KB-9789](https://karmayogibharat.atlassian.net/browse/KB-9789) | Q8–Q12 | Kong Reverse Proxy Gate | EnrolmentGatekeeper<br/>(HTTP 403 Enforcer) |

## 7. Quality & Verification Acceptance Criteria

Each generic use case must pass standard verification criteria before release sign-off:

1. **Pipeline Decoupling Verification** (`UC-PUB-01`): Ingest 100 consecutive publish events with `courseCategory: "Invite-Only Assessment"`. Confirm through Cassandra queries that zero batches are automatically provisioned.
2. **Sub-Daily Cutoff Boundary Verification** (`UC-COORD-01`, `UC-COORD-02`): Configure a test batch with `endTime` set to 1 hour in the future and duration set to 60 minutes. Attempt to invite a user at . Verify that the API rejects the request with `ERR_ENROLMENT_WINDOW_EXPIRED`.
3. **Roster Immutability Protection** (`UC-COORD-03`): Initiate an assessment attempt with candidate User A (transitioning status to ). Attempt de-enrollment via API. Verify response returns HTTP 400 and preserves user records.
4. **Resumption Integrity Verification** (`UC-PLAY-03`): Simulate network severance at question 15 with 18 minutes remaining. Wait 5 minutes offline. Reconnect and verify the player resumes at question 15 with exactly 13 minutes remaining and all previous answers intact.
5. **Catalog Isolation Verification** (`UC-DISC-02`, `UC-SEC-01`): Execute automated web/mobile crawler testing to confirm that uninvited authenticated sessions cannot discover invite-only items in search hits or launch tests via direct URI injection.
