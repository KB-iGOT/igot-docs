# Software Requirements Specification (SRS) — Standalone Assessment

**Document Identifier:** iGOT-SRS-STA-2026-V1.0<br>**Feature Name:** Standalone Assessment<br>**Platform:** iGOT Karmayogi Platform<br>**Standard Baseline:** IEEE 29148:2018-Inspired Requirements Engineering Specification<br>**Preparation Date:** 23 October 2026<br>**Document State:** Final Deliverable for Step 4 (Complete, Implementation-Aligned SRS)<br>**Target Audience:** Product Owners, Solution Architects, Technical Leads, Software Engineers, and QA Automation Specialists

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the complete functional and non-functional requirements for the **Standalone Assessment** feature on the **iGOT Karmayogi** digital platform. It establishes the binding technical and functional baseline for software engineering, API development, test case authoring, quality assurance verification, and administrative platform governance.

### 1.2 Scope

The scope encompasses the entire software lifecycle of independent, competency-linked assessments decoupled from courseware modules:

- **Catalog Discovery:** Unauthenticated public listings on web and mobile landing pages.
- **Authoring & Validation:** Content Portal authoring workflows (Basic vs Advanced), Content Quality Framework (CQF) validation gates, multi-language support, and optional practice assessment attachments.
- **Question Engineering:** Support for 6 distinct question formats, paragraph-based reading comprehension (), and embedded multimedia attachments ( MP3 audio, MP4 video, and images).
- **Evaluation & Scoring:** Dual evaluation modes—**Question Weightage** (marks-based, proficiency/EMDH tagging, negative marking , sectional cutoffs) and **Option Weightage** (psychometric/behavioral trait evaluation).
- **Delivery Engine:** 3x Randomization (options, questions, pools), multi-section timebounds, persistent countdown timers, auto-submission on expiration, and state preservation upon network/power loss.
- **Batch Administration:** Automated post-publish open-batch generation for public assessments, code-level Flink batch suppression for invite-only assessments, and closed-batch scheduling (Start/End DateTime, enrollment cutoffs, single-action roster management).
- **Credentialing & Analytics:** Strict passing-score certificate generation gates, zero Karma Points allocation, Table of Contents (TOC) historical insights access, and ClickHouse data warehouse ingestion.

### 1.3 Definitions, Acronyms, and Abbreviations

- **ACBP:** Annual Capacity Building Plan.
- **CQF:** Content Quality Framework (mandatory quality test required prior to publishing).
- **EMDH:** Easy, Medium, Difficult, Higher Order Thinking Skills (cognitive difficulty tagging).
- **Flink:** Apache Flink (distributed stream processing engine governing post-publish batch generation).
- **iGOT:** Integrated Government Online Training platform.
- **KCM:** Karmayogi Competency Model.
- **MDO:** Ministry, Department, or Organization.
- **MSQ:** Multiple Selection Question (multiple correct answer choices).
- **MCQ:** Multiple Choice Question (single correct answer choice).
- **Option Weightage:** Psychometric evaluation mode where point values are assigned to individual response choices.
- **Program Coordinator (PC):** Administrative role managing batch scheduling, invitations, and learner rosters.
- **Question Weightage:** Marks-based evaluation mode where points are assigned to question difficulty levels.
- **Standalone Assessment:** An evaluation entity existing independently of any course, module, or reading material.

### 1.4 References

1. `KB_BRD_CP Redesign` (Confluence Page ID: 21332163)
2. `KB_FRS_CP Redesign` (Confluence Page ID: 22217482)
3. `KB_BRD_CP_Assessment` (Confluence Page ID: 75890969)
4. `KB_FRS_CP_Assessment` (Confluence Page ID: 85295123)
5. `Standalone Assessments - Invite-Only Enhancements doc` (Confluence Page ID: 89751668)
6. `SRS - Assessments` (Confluence Page ID: 87392295)
7. `KB-6276 | KB_BRD_Content Portal UI/UX` (Confluence Page ID: 253132802)
8. `KB-6276 | KB_FRS_Content portal UI/UX Revamp` (Confluence Page ID: 254083073)
9. `SRS - Content Portal | UI/UX Revamp` (Confluence Page ID: 274628785)
10. Jira Feature Tickets: `KB-764`, `KB-1039`, `KB-1040`, `KB-1936`, `KB-2044`, `KB-2960`, `KB-3958`, `KB-3959`, `KB-3963`, `KB-4212`, `KB-5350`, `KB-5867`, `KB-6426`, `KB-6276`, `KB-7067`, `KB-7466`, `KB-8936`, `KB-9230`, `KB-11429`, `KB-11431`, `KB-15641`.

### 1.5 Document Conventions

- Requirements statements use the strict keyword **"shall"** to denote mandatory, contractually testable criteria.
- Recommendations or optional configurations use **"should"** or **"may"**.
- Every requirement is tagged with a unique, persistent identifier (`FR-xxx` for functional, `BR-xxx` for business rules, `NFR-xxx` for non-functional).
- Missing or unverified targets are explicitly marked as `[To be defined]`.

## 2. Product Overview

### 2.1 Product Perspective

The Standalone Assessment engine is an autonomous subsystem operating within the iGOT Karmayogi digital architecture:

- Upstream interfaces connect to the **Content Portal** (`/curate`, `/review`, `/publish`) for authoring, reviewing, and publishing.
- Interacts horizontally with the **Sunbird QuestionSet / Content Service** via extension schemas (`schemas/questionset/1.0/schema.json` and `schemas/question/1.0/schema.json`).
- Integrates with the **Knowledge Platform Flink Stream Engine** (`BatchCreation.scala`) to control batch provisioning.
- Connects downstream to the **Learner Test Player** (Web and Flutter Mobile), **RC Certificate Service**, and **ClickHouse Analytical Store**.

### 2.2 Product Functions Summary

### 2.3 User Classes and Characteristics

- **Learner (Civil Servant):** Central, AIS, and State civil servants. Consumes assessments voluntarily or via departmental mandates. Variable digital literacy; accesses platform via desktop web and mobile devices.
- **Content Creator:** Instructional designers and subject matter experts authoring question banks, tagging competencies, and setting passing cutoffs.
- **Content Reviewer:** Senior evaluators executing mandatory Content Quality Framework (CQF) scoring checks.
- **Content Publisher:** Authorized personnel performing final administrative publication.
- **Program Coordinator:** Departmental training coordinators scheduling closed batches, setting date-time windows, and uploading CSV attendee rosters.
- **SPV / MDO Administrator:** Executive stakeholders analyzing raw performance exports.

### 2.4 Operating Environment

- **Web Client:** Modern web browsers (Google Chrome , Mozilla Firefox , Safari , Edge ).
- **Mobile Client:** Android OS (Version 8.0 to 13+) and iOS (Version 13.0 to 17+).
- **Application Servers:** Kubernetes containerized microservices running on Java/J2EE (OpenJDK 11/17) and Node.js runtimes behind Nginx web servers.
- **Persistence Layer:** PostgreSQL (relational metadata), Apache Cassandra (learner attempt telemetry), ClickHouse (analytics), and Redis (caching).

### 2.5 Design and Implementation Constraints

- **Immutability of Published Content:** Once an assessment is moved to `Live`, question items, marks, and passing percentages are permanently locked against in-place edits *(Source:* `KB_FRS_CP_Assessment`).
- **File Upload Limitations:** Multimedia files are capped at ; question images are restricted to *(Source:* `KB_FRS_CP_Assessment`).
- **Section Capacity Limits:** Advanced assessments support a minimum of 1 and a maximum of 6 sections *(Source:* `KB-3963`).
- **Re-attempt Boundaries:** Allowed re-attempts are constrained to an integer range between 0 and 5 *(Source:* `KB-3963`).

## 3. External Interface Requirements

### 3.1 User Interfaces

- **UI-01: Content Creator Wizard:** Angular micro-frontend providing multi-step wizard navigation (`Basic Info`, `Assessment Settings`, `Add Questions`, `Quality Check`, `Summary`). Supports rich-text editors (Bold, Italic, Bullets, Tables; custom fonts and font-sizes suppressed).
- **UI-02: Learner Test Player:** High-performance, responsive player interface featuring:
  - Top navigation strip displaying total questions and overall countdown timer.
  - Adaptive timer color coding: Green ( time remaining), Orange (), Red ().
  - Interactive question palette indicating visited (Red), answered (Green), marked for review (Purple), and unvisited (Grey) states.
  - Action controls: *Clear Response*, *Mark for Review & Next*, *Save & Next*, and *Submit Test*.

- **UI-03: Result & Insights Dashboard:** Post-submission view displaying total score, time taken, accuracy percentage ( to 2 decimal places), sectional performance, and question-level review (Right/Wrong/Unattempted).

### 3.2 Software Interfaces

- **SI-01: NIC Parichay Identity Gateway:** REST / OpenID Connect interface validating RS256-signed JWT assertions for user identity, role claims, and session tokens.
- **SI-02: Sunbird Content Service** (`/action/content/v3/*`): Ingests assessment metadata, collection structures, and transitions content status (`Draft` `Review` `Live`).
- **SI-03: Sunbird QuestionSet Service** (`/action/questionset/v1/*`): Ingests question sets conforming to `schemas/questionset/1.0/schema.json` and evaluates answer manifests.
- **SI-04: Post-Publish Flink Job** (`BatchCreation.scala`): Consumes Kafka publication events; reads `courseCategory`; suppresses open-batch creation if `courseCategory == "Invite-Only Assessment"`.
- **SI-05: RC Certificate Engine:** Listens for `assessment.passed` events; generates digitally signed PDF certificates using decoupled standalone templates.

### 3.3 Communication Interfaces

- All client-to-server and server-to-server external communications shall enforce HTTPS over TLS using TCP/IP.
- Internal microservice event distribution shall utilize Apache Kafka with SASL/SCRAM authentication over private subnets.

## 4. Functional Requirements

### Submodule 1: Public Catalog Discovery & Unauthenticated Access

#### FR-001: Public Catalog Metadata Listing

- **Title:** Unauthenticated Public Catalog Listing
- **Description:** The system shall display published Standalone Assessments in the public, unauthenticated landing page catalog on both web and mobile channels.
- **Requirement Type:** Functional Requirement
- **Priority:** Medium
- **Actor:** Unauthenticated Visitor / Learner
- **Preconditions:** Standalone Assessment is in `Live` state and configured with `All Users` access.
- **Expected Behavior:** The system shall display the assessment card within the "See All" content repository, rendering Title, Subtitle, Thumbnail, Duration, and Language without requiring user login.
- **Postconditions:** User can view public metadata and click to initiate login/enrollment.
- **Acceptance Criteria:**
  - Assessment metadata is queryable without an active session token.
  - Clicking the card prompts authentication via Parichay SSO.

- **Source Reference:** `KB-764`, `KB-1039`, `KB-1040`.
- **Verification Method:** Web and Mobile UI functional inspection.
- **Status:** Confirmed.

### Submodule 2: Authoring, Access Settings & Quality Review

#### FR-002: Standalone Assessment Content Type Selection

- **Title:** Independent Assessment Card Selection
- **Description:** The system shall provide a dedicated "Assessment" card on the Content Portal `/curate` page, allowing content creators to author assessments decoupled from courses or programs.
- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Content Creator (`ACT-02`)
- **Preconditions:** Creator is authenticated with the `CONTENT_CREATOR` role.
- **Expected Behavior:** When the creator selects "Assessment", the system shall launch the standalone assessment authoring flow, presenting mandatory basic fields (Title, Subtitle, Language, Thumbnail, and Access Setting).
- **Postconditions:** Draft assessment record initialized in PostgreSQL store.
- **Acceptance Criteria:**
  - Title enforces a minimum of 10 and maximum of 70 characters.
  - Thumbnail upload validates JPEG/PNG formats with size .

- **Source Reference:** `KB-1936`, `KB-2044`, `KB_BRD_CP Redesign`.
- **Verification Method:** Form validation boundary testing.
- **Status:** Confirmed.

#### FR-003: Access Setting Classification

- **Title:** Tri-Modal Access Classification
- **Description:** The system shall enforce tri-modal access classification during initial assessment creation:
  - `All Users` Classifies assessment as an Open *Standalone Assessment*.
  - `MDO Specific` Classifies assessment as a *Moderated Assessment* restricted to selected ministries.
  - `Custom Users` Classifies assessment as an *Invite-Only Assessment* requiring closed-batch scheduling.

- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Content Creator (`ACT-02`)
- **Preconditions:** Creator is on the basic information authoring screen.
- **Expected Behavior:** The system shall persist the chosen access mode to the content metadata schema. Once saved, the access mode cannot be altered across open and custom categories.
- **Postconditions:** `courseCategory` metadata attribute assigned.
- **Acceptance Criteria:**
  - Selecting `Custom Users` assigns `courseCategory = "Invite-Only Assessment"`.
  - Setting locks upon initial draft save.

- **Source Reference:** `KB-1936`, `KB-3959`, `Invite-Only doc`.
- **Verification Method:** Metadata persistence integration test.
- **Status:** Confirmed.

#### FR-004: Authoring Flow Tiering (Basic vs Advanced)

- **Title:** Basic vs Advanced Final Assessment Authoring
- **Description:** The system shall support two distinct final assessment creation modes:
  - **Basic Mode (Default):** Flat question structure, overall passing criteria, single duration timer.
  - **Advanced Mode:** Multi-section structure (1–6 sections), Sectional Passing %, Sectional Timebound, and Question/Option weightage selection.

- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Content Creator (`ACT-02`)
- **Preconditions:** Basic assessment metadata is saved.
- **Expected Behavior:** When the creator toggles to "Advanced Mode", the system shall reveal section builder controls, sectional cutoffs, and weightage configuration fields.
- **Postconditions:** Assessment schema updated to advanced structure.
- **Acceptance Criteria:**
  - Basic mode restricts section count to 1.
  - Advanced mode permits section configuration up to 6.

- **Source Reference:** `KB-7466`, `KB-6276 FRS`.
- **Verification Method:** UI toggle functional test.
- **Status:** Confirmed.

#### FR-005: Optional Practice Assessment Attachment

- **Title:** Optional Practice Assessment Attachment
- **Description:** The system shall allow content creators to optionally attach a Practice Assessment alongside the Final Assessment, but shall not block submission if a practice assessment is omitted.
- **Requirement Type:** Functional Requirement
- **Priority:** Medium
- **Actor:** Content Creator (`ACT-02`)
- **Preconditions:** Creator is on the assessment structure builder screen.
- **Expected Behavior:** The system shall enable advancing to settings and CQF review regardless of whether a Practice Assessment has been uploaded.
- **Postconditions:** Practice assessment attached if created; omitted cleanly if skipped.
- **Acceptance Criteria:**
  - "Next" button remains enabled without a practice test.
  - Practice tests suppress marks and pass/fail indicators.

- **Source Reference:** `KB-11431`, `KB_FRS_CP_Assessment`.
- **Verification Method:** End-to-end authoring workflow test.
- **Status:** Confirmed.

#### FR-006: Content Quality Framework (CQF) Review Gate

- **Title:** Mandatory CQF Review Gate
- **Description:** The system shall block content creators from submitting assessments for final review, and reviewers from forwarding to publishers, until a formal Content Quality Framework (CQF) evaluation test is completed and achieves the minimum passing score.
- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Content Creator (`ACT-02`), Content Reviewer (`ACT-03`)
- **Preconditions:** Assessment questions and metadata are populated.
- **Expected Behavior:** Clicking "Send for Review" triggers a validation check. If CQF is incomplete or failing, the system shall block submission and display: *"To proceed further minimum quality score is required."*
- **Postconditions:** Content status transitions to `Under Review`.
- **Acceptance Criteria:**
  - Unscored drafts cannot be submitted to review queues.
  - Reviewer must pass CQF before enabling "Send to Publisher".

- **Source Reference:** `KB-6276 FRS`, `SRS - Content Portal UI/UX`.
- **Verification Method:** Automated workflow intercept test.
- **Status:** Confirmed.

### Submodule 3: Question Engineering & Multimedia Management

#### FR-007: Supported Question Formats

- **Title:** Question Formats Ingestion
- **Description:** The system shall support creation and evaluation across 6 distinct question formats:
  - Single-Choice MCQ (2 to 10 choices; exactly 1 correct).
  - Multiple-Choice MSQ (2 to 10 choices; 2 or more correct).
  - True / False (Pre-defined True/False options; text only).
  - Match the Following (Two-column item matching).
  - Fill-in-the-Blanks (Dropdown selection menu per blank).
  - Paragraph / Reading Comprehension (Master passage characters linked to multiple child questions).

- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Content Creator (`ACT-02`)
- **Preconditions:** Section is created and open for question addition.
- **Expected Behavior:** Creator selects format, enters question text via rich-text editor, defines choices, designates correct keys, and saves to section manifest.
- **Postconditions:** Question entity persisted with unique `questionId`.
- **Acceptance Criteria:**
  - Single-choice MCQ enforces exactly one radio selection.
  - True/False blocks multimedia attachment icons.
  - Paragraph question anchors all child questions to the master text.

- **Source Reference:** `KB-3958`, `KB_BRD_CP_Assessment`, `KB_FRS_CP_Assessment`.
- **Verification Method:** Format-by-format automated unit test.
- **Status:** Confirmed.

#### FR-008: Multimedia Question Attachments

- **Title:** Multimedia Question Ingestion & Playback
- **Description:** The system shall allow content creators to attach audio (MP3), video (MP4), or image files (JPEG, PNG) to question stems up to a maximum file size of .
- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Content Creator (`ACT-02`), Learner (`ACT-01`)
- **Preconditions:** Creator is authoring an MCQ, MSQ, or Match question.
- **Expected Behavior:** Creator uploads media file; system validates format and file size (), stores media in cloud storage, and renders native audio/video/image player components during learner test taking.
- **Postconditions:** Media URL bound to question schema.
- **Acceptance Criteria:**
  - Uploads exceeding are rejected with an explicit error alert.
  - Learner player streams media seamlessly without buffer stalling.

- **Source Reference:** `KB-3958`, `KB-6447`, `KB-6558`, `KB_FRS_CP_Assessment`.
- **Verification Method:** Media upload and playback stress testing.
- **Status:** Confirmed.

#### FR-009: Rich Text Formatting Boundaries

- **Title:** Rich Text Formatting Restrictions
- **Description:** The question editor shall provide standard rich-text formatting (Bold, Italic, Underline, Bullets, Numbering, Tables), but shall strictly suppress font-family and font-size customization to preserve UI uniformity across web and mobile viewports.
- **Requirement Type:** Functional Requirement
- **Priority:** Medium
- **Actor:** Content Creator (`ACT-02`)
- **Preconditions:** Rich text editor active.
- **Expected Behavior:** The editor sanitizes input, permitting semantic HTML tags (`<b>`, `<i>`, `<u>`, `<ul>`, `<ol>`, `<table>`) while stripping arbitrary inline styles, custom fonts, and external scripts.
- **Postconditions:** Sanitized HTML string stored in question payload.
- **Acceptance Criteria:**
  - Pasted rich text from external processors strips font family attributes.
  - Tables render responsively across mobile screens.

- **Source Reference:** `KB-3963`, `KB_FRS_CP_Assessment`.
- **Verification Method:** Input sanitization and cross-device rendering test.
- **Status:** Confirmed.

### Submodule 4: Scoring, Weightage & Evaluation Engine

#### FR-010: Question Weightage Mode & Difficulty Tagging

- **Title:** Question Weightage Evaluation
- **Description:** In Question Weightage mode, the system shall assign marks to individual questions based on cognitive difficulty tagging:
  - Scheme A: Proficiency Level 1, Level 2, Level 3, Level 4.
  - Scheme B: Easy, Medium, Difficult, Higher Order Thinking Skills (HOTS).

- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Content Creator (`ACT-02`)
- **Preconditions:** Assessment type is set to `Question Weightage`.
- **Expected Behavior:** Creator specifies mark values per difficulty tier; system auto-calculates total sectional marks and total examination marks. Marks are non-editable at the individual question level, deriving directly from tier definitions.
- **Postconditions:** `questionLevelDefinition` metadata saved to QuestionSet schema.
- **Acceptance Criteria:**
  - Total marks auto-calculate as .
  - Overall Passing Percentage field accepts numeric values only ().

- **Source Reference:** `KB-3963`, `schemas/questionset/1.0/schema.json`.
- **Verification Method:** Scoring calculation automated test.
- **Status:** Confirmed.

#### FR-011: Option Weightage Mode (Psychometric Evaluation)

- **Title:** Option Weightage Psychometric Evaluation
- **Description:** In Option Weightage mode, the system shall assign numerical weight values to individual answer choices within Single-Choice MCQs, calculating cumulative trait scores rather than binary pass/fail outcomes.
- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Content Creator (`ACT-02`)
- **Preconditions:** Assessment type is set to `Option Weightage`.
- **Expected Behavior:** System implicitly restricts the assessment to exactly 1 section, hides passing percentage fields, captures numerical weights per option, and records raw dimensional totals upon submission.
- **Postconditions:** Option weight array stored in question payload.
- **Acceptance Criteria:**
  - Result screen displays cumulative score without "Passed" or "Failed" badges.
  - Multi-section addition controls are disabled.

- **Source Reference:** `KB-3963`, `KB_BRD_CP_Assessment`, `KB_FRS_CP_Assessment`.
- **Verification Method:** Psychometric response evaluation test.
- **Status:** Confirmed.

#### FR-012: Configurable Negative Marking

- **Title:** Negative Marking Penalty Calculation
- **Description:** The system shall deduct points for incorrect answers based on a creator-selected penalty rate: of the question's point value.
- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Content Creator (`ACT-02`), Scoring Engine
- **Preconditions:** Question Weightage mode active; negative marking configured.
- **Expected Behavior:** When a learner submits an incorrect response, the engine deducts:<br><br>Total test score shall be floored at (cannot be negative).
- **Postconditions:** Net score recorded in attempt summary.
- **Acceptance Criteria:**
  - Correct answer adds full question marks.
  - Wrong answer deducts exact configured percentage.
  - Unanswered questions incur deduction.

- **Source Reference:** `KB-3963`, `KB_FRS_CP_Assessment`.
- **Verification Method:** Mathematical scoring verification unit tests.
- **Status:** Confirmed.

#### FR-013: Sectional Passing Cutoffs & Timebounds

- **Title:** Sectional Passing & Duration Constraints
- **Description:** In Advanced mode with multiple sections, the system shall enforce independent sectional passing percentages and sectional time limits.
- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Content Creator (`ACT-02`), Learner (`ACT-01`)
- **Preconditions:** Assessment contains sections.
- **Expected Behavior:**
  - If a learner fails any sectional cutoff, the overall result shall be marked `Failed` even if the cumulative score exceeds the overall passing percentage.
  - When a sectional timer expires, the player shall automatically lock the current section and advance to the next section without allowing backward navigation.

- **Postconditions:** Sectional scores and cutoff flags recorded.
- **Acceptance Criteria:**
  - Failing section cutoff marks test `Failed` with message: *"You could not pass section: [Section Name]"*.
  - Completed section cannot be re-opened.

- **Source Reference:** `KB-3963`, `KB_FRS_CP_Assessment`.
- **Verification Method:** Sectional progression and scoring logic tests.
- **Status:** Confirmed.

### Submodule 5: Randomization, Delivery & Player Resilience

#### FR-014: 3x Randomization Engine

- **Title:** Multi-Level 3x Randomization
- **Description:** The system shall execute 3-tier randomization during test player initialization:
  - **Option Randomization:** Shuffles answer choices for each question using permutation logic.
  - **Question Sequence Randomization:** Shuffles the presentation order of questions within each section.
  - **Question Pool Randomization:** Dynamically extracts a random subset of questions from a larger configured section bank.

- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Learner (`ACT-01`), Player Engine
- **Preconditions:** Assessment configured with `randomization = "Yes"`.
- **Expected Behavior:** Each candidate launch generates a unique test form instance. In paragraph questions, all child questions shall remain grouped with their parent passage.
- **Postconditions:** Randomized form mapping persisted to candidate attempt session.
- **Acceptance Criteria:**
  - Two concurrent candidates receive distinct question sequences and option layouts.
  - Paragraph comprehension questions remain contiguous.

- **Source Reference:** `KB-3958`, `KB-5279`, `KB-6557`, `KB_FRS_CP_Assessment`.
- **Verification Method:** Statistical permutation distribution tests.
- **Status:** Confirmed.

#### FR-015: Disruption-Tolerant Session Resilience

- **Title:** Session State Recovery on Network/Power Interruption
- **Description:** The system shall persist test attempt state in real time, allowing learners to resume an active assessment following network loss, browser crash, or power outage.
- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Learner (`ACT-01`)
- **Preconditions:** Candidate has an active, unsubmitted attempt session.
- **Expected Behavior:** Upon reconnecting, clicking "Resume Assessment" restores the candidate to the exact question index where they disconnected, preserving all previously saved selections and resuming the timer from the exact elapsed timestamp.
- **Postconditions:** Attempt session re-bound to active socket/player.
- **Acceptance Criteria:**
  - Saved answers are completely intact upon session restore.
  - Timer does not reset or grant extra time.

- **Source Reference:** `KB_FRS_CP_Assessment` (Section 14).
- **Verification Method:** Chaos network disconnect and session resume tests.
- **Status:** Confirmed.

#### FR-016: Re-attempt Execution & Limit Enforcement

- **Title:** Bounded Re-attempt Controls
- **Description:** The system shall enforce creator-configured re-attempt limits between 0 and 5.
- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Learner (`ACT-01`)
- **Preconditions:** Assessment submitted; result screen rendered.
- **Expected Behavior:** If `attempts_made < max_attempts`, the result screen shall display a "Re-attempt Test" button. Clicking the button initiates a fresh randomized attempt. If attempts reach the limit, the button is disabled.
- **Postconditions:** New attempt record initialized; attempt counter incremented.
- **Acceptance Criteria:**
  - When limit , re-attempt button is never rendered.
  - Attempt 6 is blocked when limit .

- **Source Reference:** `KB-3963`, `KB_FRS_CP_Assessment`.
- **Verification Method:** Attempt counter boundary testing.
- **Status:** Confirmed.

### Submodule 6: Invite-Only Batch Management & Scheduling

#### FR-017: Post-Publish Flink Batch Suppression

- **Title:** Invite-Only Auto-Batch Suppression
- **Description:** The post-publish Flink stream processing job shall inspect the `courseCategory` attribute of newly published assessments and suppress automatic open-batch generation when `courseCategory == "Invite-Only Assessment"`.
- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** System (Flink Stream Job)
- **Preconditions:** Assessment transitions to `Live` status.
- **Expected Behavior:** Flink job executes `BatchCreation.scala`. If `courseCategory` contains `"Invite-Only"`, it sets `trackable = false`, bypassing auto-batch creation and leaving batch creation exclusively to Program Coordinators.
- **Postconditions:** Assessment published without public batches.
- **Acceptance Criteria:**
  - Zero open batches created in Cassandra/PostgreSQL for invite-only assessments.
  - Assessment remains hidden from general public enrollment catalogs.

- **Source Reference:** `KB-4212`, `BatchCreation.scala`, `Invite-Only doc`.
- **Verification Method:** Kafka event injection and Flink output audit.
- **Status:** Confirmed.

#### FR-018: Time-Bounded Closed Batch Scheduling

- **Title:** Scheduled Closed Batch Administration
- **Description:** The system shall allow Program Coordinators to create scheduled closed batches for invite-only assessments, specifying Batch Name, Start DateTime, End DateTime, and Enrollment Cutoff DateTime.
- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Program Coordinator (`ACT-05`)
- **Preconditions:** Standalone Assessment is in `Live` state with `courseCategory = "Invite-Only Assessment"`.
- **Expected Behavior:** Program Coordinator sets dates; system validates that `end_datetime > start_datetime` and `enrollment_datetime <= end_datetime - duration`.
- **Postconditions:** Closed batch record persisted; invitation schedule queued.
- **Acceptance Criteria:**
  - Learners cannot launch the assessment prior to `start_datetime`.
  - Assessment auto-closes when `end_datetime` elapses.

- **Source Reference:** `KB-5350`, `KB-7067`, `Invite-Only doc`.
- **Verification Method:** Date-time scheduling boundary tests.
- **Status:** Confirmed.

#### FR-019: Single-Action Learner Roster Management

- **Title:** Unified Learner Roster Management
- **Description:** The Program Coordinator console shall provide a unified interface to add and remove learners from an invite-only batch via directory filters (Organization, Designation, Verified Karmayogi) or bulk CSV upload (Email ID, Mobile Number).
- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Program Coordinator (`ACT-05`)
- **Preconditions:** Closed batch is created and open for configuration.
- **Expected Behavior:** System validates CSV rows, verifies unique email/mobile entries, adds eligible learners to batch rosters, and prevents removal of any learner who has already commenced an attempt.
- **Postconditions:** Batch enrollment roster updated; invite notifications triggered.
- **Acceptance Criteria:**
  - Invalid email formats in CSV generate downloadable error reports.
  - Commenced learners cannot be removed from batch rosters.

- **Source Reference:** `KB-2960`, `KB_FRS_CP Redesign`.
- **Verification Method:** Roster modification and CSV ingestion tests.
- **Status:** Confirmed.

### Submodule 7: Post-Exam Analytics, Credentialing & Data Warehousing

#### FR-020: Passing-Only Certificate Issuance

- **Title:** Passing-Score Certificate Issuance Gate
- **Description:** The system shall issue a completion certificate **strictly when the candidate achieves an overall score greater than or equal to the passing percentage** (`score >= pass_percentage`).
- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Certificate Service (`DEP-05`), Learner (`ACT-01`)
- **Preconditions:** Assessment submitted and scored.
- **Expected Behavior:** If candidate passes, certificate engine generates a digitally signed PDF certificate. If candidate fails, zero certificates are generated.
- **Postconditions:** Certificate record attached to user profile.
- **Acceptance Criteria:**
  - Candidate scoring on a pass cutoff receives no certificate.
  - Candidate scoring receives certificate download link instantly.

- **Source Reference:** `KB-8936`, `KB-9230`.
- **Verification Method:** Automated scoring cutoff verification tests.
- **Status:** Confirmed.

#### FR-021: Zero Karma Points Allocation Policy

- **Title:** Zero Karma Points Policy for Standalone Assessments
- **Description:** The platform shall award **zero Karma Points** for standalone assessment attempts and completions, regardless of score achieved.
- **Requirement Type:** Functional Requirement
- **Priority:** Critical
- **Actor:** Gamification Engine
- **Preconditions:** Assessment completed and submitted.
- **Expected Behavior:** System writes progress completion records while passing `karmaPoints = 0` to transactional ledgers.
- **Postconditions:** Learner Karma Points balance remains unchanged.
- **Acceptance Criteria:**
  - Karma Point ledger registers points for standalone evaluations.

- **Source Reference:** `KB-8936`, `KB-9230`.
- **Verification Method:** Transactional ledger audit test.
- **Status:** Confirmed.

#### FR-022: Table of Contents (TOC) Historical Insights Access

- **Title:** Post-Completion Insights Review from TOC
- **Description:** The system shall enable civil servants to revisit their performance summary, report card, and question-level insights directly from the assessment TOC page post-completion.
- **Requirement Type:** Functional Requirement
- **Priority:** High
- **Actor:** Learner (`ACT-01`)
- **Preconditions:** Learner has completed at least one attempt.
- **Expected Behavior:** Clicking "View Insights" on the TOC redirects to the player interface in read-only review mode, rendering question status (Right/Wrong/Unattempted), accuracy percentage, and time taken per question. Only analytics from the **most recent attempt** shall be displayed.
- **Postconditions:** Performance dashboard rendered.
- **Acceptance Criteria:**
  - Insights accessible indefinitely after attempt completion.
  - Retaking the assessment overwrites TOC insights with latest attempt metrics.

- **Source Reference:** `KB-11429`.
- **Verification Method:** Historical TOC navigation test.
- **Status:** Confirmed.

#### FR-023: Data Warehouse Enrolments & Taxonomy Ingestion

- **Title:** Analytics Enrolments & Sub-type Mapping
- **Description:** The analytical data ingestion pipeline shall capture all standalone assessment enrollments within the central `enrolments` table and record `assessment_sub_type` in `assessment_details` schemas.
- **Requirement Type:** Functional Requirement
- **Priority:** Medium
- **Actor:** System (ETL / Data Pipeline)
- **Preconditions:** Assessment attempt completed.
- **Expected Behavior:** Pipeline maps transactional attempt records into analytical ClickHouse tables, categorizing records under `assessment_sub_type = "STANDALONE"`.
- **Postconditions:** Analytical records queryable for MDO/SPV reports.
- **Acceptance Criteria:**
  - Standalone evaluations appear in ClickHouse enrolment reports.

- **Source Reference:** `KB-15641`.
- **Verification Method:** Database ETL pipeline verification test.
- **Status:** Confirmed.

## 5. Business Rules Register

| Rule ID | Rule Statement & Operational Logic | Applicable Module | Source Reference |
|---|---|---|---|
| **BR-001** | **Category Immutability:** Access selection (`All Users`, `MDO Specific`, `Custom Users`) locks upon initial draft save and cannot be mutated across open/custom boundaries. | Content Authoring | `KB_BRD_CP Redesign` |
| **BR-002** | **Batch Suppression Mandate:** When `courseCategory == "Invite-Only Assessment"`, automated open-batch creation in Flink is strictly suppressed (`trackable = false`). | Post-Publish Pipeline | `KB-4212`, `BatchCreation.scala` |
| **BR-003** | **Section Capacity Constraint:** Advanced assessments support between 1 and 6 sections inclusive. Section counts outside this range are invalid. | Advanced Authoring | `KB-3963` |
| **BR-004** | **Option Weightage Invariance:** Option Weightage assessments are implicitly restricted to 1 section; sectional cutoffs and pass/fail labels are disabled. | Advanced Authoring | `KB-3963`, `KB_FRS_CP_Assessment` |
| **BR-005** | **Score Floor Enforcement:** Applying negative marking () shall never reduce a candidate's overall test score below . | Scoring Engine | `KB-3963`, `KB_FRS_CP_Assessment` |
| **BR-006** | **Contiguous Paragraph Grouping:** 3x Randomization shall shuffle question sequences within sections but must keep reading comprehension child questions anchored to their parent passage. | Test Player Engine | `KB_FRS_CP_Assessment` |
| **BR-007** | **Sectional Navigation Lock:** When sectional timers are active, candidates cannot advance until duration expires (or confirm via irreversible modal). Returning to prior sections is blocked. | Test Player Engine | `KB_FRS_CP_Assessment` |
| **BR-008** | **Session State Persistence:** Interrupted examination sessions (network or power failure) must restore exact question index, elapsed time, and saved choices upon resume. | Test Player Engine | `KB_FRS_CP_Assessment` (s. 14) |
| **BR-009** | **Certificate Cutoff Gate:** Digital completion certificates are generated **strictly when candidate score passing cutoff percentage**. Failing candidates receive zero certificates. | Certification Engine | `KB-8936`, `KB-9230` |
| **BR-010** | **Zero Karma Points Invariant:** Standalone Assessments award **0 Karma Points**, preventing gamification distortions. | Gamification Ledger | `KB-8936`, `KB-9230` |
| **BR-011** | **Re-attempt Upper Bound:** Content creators configure allowed re-attempts between 0 and 5. Re-attempt button disables when count is exhausted. | Evaluation & Results | `KB-3963` |
| **BR-012** | **Practice Test Decoupling:** Attaching a Practice Assessment is optional and does not block final assessment submission or publishing. | Authoring Workflow | `KB-11431` |
| **BR-013** | **Commenced Learner Lock:** Program Coordinators cannot remove a learner from an invite-only batch roster once that learner has commenced an attempt. | Batch Management | `KB-2960`, `KB_FRS_CP Redesign` |

## 6. Role-Based Access Requirements & Permissions Matrix

| Functional Operation | Learner (`ACT-01`) | Content Creator (`ACT-02`) | Content Reviewer (`ACT-03`) | Content Publisher (`ACT-04`) | Program Coordinator (`ACT-05`) | SPV / MDO Admin (`ACT-06`) |
|---|---|---|---|---|---|---|
| **Discover Public Assessments** | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| **Attempt Open Assessments** | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| **Attempt Scheduled** **Invites** | Allowed (If on Roster) | Denied | Denied | Denied | Denied | Denied |
| **Create / Edit Draft Assessment** | Denied | Allowed (Own Org) | Denied | Denied | Denied | Denied |
| **Execute CQF Review Test** | Denied | Allowed (Self-Check) | Allowed | Denied | Denied | Denied |
| **Publish Assessment to Live** | Denied | Denied | Denied | Allowed | Denied | Denied |
| **Create Closed Batch & Schedule** | Denied | Denied | Denied | Denied | Allowed | Allowed |
| **Manage Batch Invitee Rosters** | Denied | Denied | Denied | Denied | Allowed | Allowed |
| **Export Raw CSV Analytics** | Denied | Denied | Denied | Denied | Allowed (Batch) | Allowed (Global) |
| **View Historical TOC Insights** | Allowed (Self Only) | Denied | Denied | Denied | Denied | Allowed (Audit) |

## 7. Data Requirements

### 7.1 Business Entities and Attribute Schemas

- **ENT-01: Assessment Header** (`questionset`): `assessment_id` (UUID, PK), `title` (VarChar 70), `subtitle` (VarChar 255), `description` (Text), `course_category` (Enum: `Standalone Assessment`, `Moderated Assessment`, `Invite-Only Assessment`), `assessment_type` (Enum: `Question Weightage`, `Option Weightage`), `duration_seconds` (Integer), `overall_pass_marks` (Numeric), `negative_marking_rate` (Enum: `0%`, `25%`, `50%`, `75%`, `100%`), `max_reattempts` (SmallInt, ), `randomization` (Boolean), `org_id` (UUID), `status` (Enum: `Draft`, `Review`, `Live`, `Retired`).
- **ENT-02: Section Manifest** (`section`): `section_id` (UUID, PK), `assessment_id` (UUID, FK), `section_name` (VarChar 128), `passing_percentage` (Numeric), `duration_seconds` (Integer), `sequence_order` (SmallInt, ).
- **ENT-03: Question Item** (`question`): `question_id` (UUID, PK), `section_id` (UUID, FK), `question_type` (Enum: `SINGLE_MCQ`, `MULTI_MSQ`, `TRUE_FALSE`, `MATCH`, `FILL_BLANKS`, `PARAGRAPH`), `question_text` (HTML Sanitized), `cognitive_level` (Enum: `PROF_1` to `PROF_4` or `EASY`, `MEDIUM`, `DIFFICULT`, `HOTS`), `media_url` (VarChar 512), `media_type` (Enum: `AUDIO`, `VIDEO`, `IMAGE`, `NONE`), `mark_value` (Numeric), `option_payload` (JSONB: choices, option weights, correct flags).
- **ENT-04: Batch Roster Entity:** `batch_id` (UUID, PK), `assessment_id` (UUID, FK), `batch_name` (VarChar 128), `start_datetime` (Timestamp), `end_datetime` (Timestamp), `enrollment_cutoff` (Timestamp), `roster_user_ids` (Array of UUIDs).
- **ENT-05: Learner Attempt Record:** `attempt_id` (UUID, PK), `assessment_id` (UUID, FK), `user_id` (UUID, FK), `attempt_number` (SmallInt), `raw_score` (Numeric), `accuracy_percentage` (Numeric 5,2), `pass_status` (Enum: `PASSED`, `FAILED`), `time_taken_seconds` (Integer), `submitted_at` (Timestamp), `is_latest` (Boolean).

## 8. Non-Functional Requirements

### 8.1 Performance Requirements

- **NFR-001 (Player Response Latency):** Question rendering, option selection, and state persistence operations shall respond in () under normal load *(Source:* `SRS - Assessments`, Section 9.2).
- **NFR-002 (Scoring & Report Card Computation):** The scoring engine shall process answer manifests, compute sectional cutoffs, and render the final report card within upon submission.

### 8.2 Scalability & Concurrency Requirements

- **NFR-003 (Concurrent Examination Capacity):** The system shall sustain up to concurrent examination attempts in the production environment without service degradation *(Source:* `SRS - Assessments`, Section 9.5).
- **NFR-004 (Bulk Ingestion Scaling):** The Program Coordinator bulk invitation parser shall process CSV roster uploads of up to learner records within .

### 8.3 Availability & Reliability Requirements

- **NFR-005 (Operational Uptime):** The assessment delivery service shall maintain operational uptime during business hours.
- **NFR-006 (Recovery Time Objective):** Recovery Time Objective (RTO) for business-critical assessment submission services shall be in the event of major infrastructure failure *(Source:* `SRS - Assessments`, Section 9.4).

### 8.4 Security & Privacy Requirements

- **NFR-007 (Transport Encryption):** All communications shall enforce TLS encryption in transit *(Source:* `SRS - Assessments`, Section 9.3).
- **NFR-008 (Database Auditability):** Immutable, tamper-evident audit logs shall record all administrative question updates, CQF approvals, and batch roster mutations *(Source:* `SRS - Assessments`, Section 9.3).
- **NFR-009 (OWASP Top 10 Compliance):** All input interfaces shall protect against Cross-Site Scripting (XSS), SQL Injection, and Broken Object Level Authorization (BOLA).

### 8.5 Usability & Accessibility Requirements

- **NFR-010 (Accessibility Compliance):** The learner test player interface shall conform to Web Content Accessibility Guidelines (WCAG 2.1 Level AA) and Guidelines for Indian Government Websites (GIGW) *(Source:* `KB_BRD_CP_Assessment`).
- **NFR-011 (Color Blindness Visual Cues):** Timer alerts (Green, Orange, Red) and question palette states shall be paired with distinct textual and icon indicators to support color-blind users.

## 9. Requirements Traceability Matrix

| Requirement ID | Requirement Description | Source Documents | Source Jira Tickets | Implemented Subsystem | Verification Method |
|---|---|---|---|---|---|
| **FR-001** | Public unauthenticated catalog listing. | `KB_BRD_CP Redesign` | `KB-764`, `KB-1039`, `KB-1040` | Public Discovery Portal | Functional UI Test |
| **FR-002** | Independent assessment creation card. | `KB_BRD_CP Redesign`, `FRS` | `KB-1936`, `KB-2044` | Content Creation Wizard | API & UI Test |
| **FR-003** | Tri-modal access setting classification. | `KB_BRD_CP Redesign`, `Invite-Only` | `KB-1936`, `KB-3959` | Metadata Service | Schema Audit |
| **FR-004** | Basic vs Advanced authoring tiering. | `KB-6276 BRD/FRS` | `KB-6276`, `KB-7466` | Content Authoring Core | Workflow Verification |
| **FR-005** | Optional practice assessment upload. | `KB-11431`, `KB_FRS_Assess``ment` | `KB-11431` | Assessment Form Handler | Negative Form Test |
| **FR-006** | Mandatory CQF review validation gate. | `KB-6276 FRS`, `SRS UI/UX` | `KB-6276`, `KB-7466` | CQF Review Interceptor | State Machine Test |
| **FR-007** | Support for 6 distinct question formats. | `KB_BRD_CP_Assessment`, `FRS` | `KB-3958` | QuestionSet Core Service | Format Unit Tests |
| **FR-008** | Multimedia attachments (). | `KB_FRS_CP_Assessment` | `KB-3958`, `KB-6447`, `KB-6558` | Asset Upload Gateway | File Boundary Test |
| **FR-009** | Rich text formatting boundaries. | `KB-3963`, `KB_FRS_CP_Assessment` | `KB-3963` | Question Editor UI | Sanitizer Security Test |
| **FR-010** | Question Weightage mode & EMDH tagging. | `KB-3963`, `schemas/questionset` | `KB-3958`, `KB-3963` | Scoring Rules Engine | Algorithmic Unit Test |
| **FR-011** | Option Weightage psychometric mode. | `KB-3963`, `KB_BRD_CP_Assessment` | `KB-3963`, `KB-3973` | Assessment Engine | Psychometric Test |
| **FR-012** | Configurable negative marking (). | `KB-3963`, `KB_FRS_CP_Assessment` | `KB-3963` | Scoring Rules Engine | Scoring Boundary Test |
| **FR-013** | Sectional passing cutoffs and timers. | `KB-3963`, `KB_FRS_CP_Assessment` | `KB-3963` | Test Player Engine | Sectional E2E Test |
| **FR-014** | 3x Randomization (options, sequence, pool). | `KB_FRS_CP_Assessment` | `KB-3958`, `KB-5279`, `KB-6557` | Randomization Worker | Permutation Test |
| **FR-015** | Disruption-tolerant session resilience. | `KB_FRS_CP_Assessment` (s. 14) | `KB-3958` | Session State Store | Network Chaos Test |
| **FR-016** | Re-attempt limit enforcement (). | `KB-3963`, `KB_FRS_CP_Assessment` | `KB-3963` | Evaluation Controller | Attempt Counter Test |
| **FR-017** | Flink post-publish batch suppression. | `Invite-Only doc`, `BatchCreation` | `KB-4212` | Flink `BatchCreation.scala` | Kafka Event Test |
| **FR-018** | Time-bounded closed batch scheduling. | `KB-5350`, `Invite-Only doc` | `KB-5350`, `KB-7067` | Batch Scheduling Svc | Scheduling E2E Test |
| **FR-019** | Single-action roster management. | `KB-2960`, `KB_FRS_CP Redesign` | `KB-2960` | Cohort Admin Console | UI Usability Test |
| **FR-020** | Passing-score certificate issuance gate. | `KB-8936`, `KB-9230` | `KB-8936`, `KB-9230` | Certificate Engine | Certificate Rule Test |
| **FR-021** | Zero Karma Points allocation invariant. | `KB-8936`, `KB-9230` | `KB-8936`, `KB-9230` | Gamification Ledger | Ledger Audit Test |
| **FR-022** | Revisit report card & insights from TOC. | `KB-11429` | `KB-11429` | TOC Player Analytics | TOC Review Test |
| **FR-023** | ClickHouse enrolment table ingestion. | `KB-15641` | `KB-15641` | Analytics ETL Pipeline | ClickHouse DDL Test |

## 10. Open Issues & Unresolved Requirements

| Issue ID | Domain | Unresolved Technical Requirement | Impact if Unresolved | Planned Resolution |
|---|---|---|---|---|
| **ISS-01** | Analytics | Option Weightage visualization: Missing formal schema for rendering multidimensional psychometric radar charts. | Learners receive raw numeric totals without psychological trait interpretations. | Define trait-mapping metadata schema in `question/1.0`. |
| **ISS-02** | Engine | Retake cooldown policy: Lack of documented waiting periods between failed attempts. | Learners can exhaust all 5 re-attempts immediately within minutes. | Propose configurable `cooldown_minutes` attribute in QuestionSet. |
| **ISS-03** | Player | Sectional early exit: FRS text contradicts whether learners can exit a timed section early. | Inconsistent navigation button behaviors across web and mobile. | Enforce strict linear duration by default; allow skip only if explicitly flagged. |
| **ISS-04** | Data | Teradata audit role: `SRS - Assessments` cites Teradata for audits, but production uses ClickHouse. | Inconsistent operational monitoring architecture. | Deprecate Teradata reference; align formal baseline to ClickHouse and PostgreSQL. |

## 11. Acceptance Criteria Sign-Off Baseline

- [x] **Catalog Discovery:** Standalone assessments are discoverable in public catalog listings without authentication.
- [x] **Authoring Modes:** Content Creators can author both Basic (single section) and Advanced (up to 6 sections) assessments.
- [x] **Evaluation Versatility:** Both Question Weightage (with negative marking) and Option Weightage (psychometric) are supported.
- [x] **Engine Rigor:** 3x Randomization, sectional cutoffs, and session resilience operate without data loss.
- [x] **Batch Isolation:** Post-publish Flink job suppresses batch generation for invite-only assessments.
- [x] **Credentialing Integrity:** Certificates are generated strictly on passing score; zero Karma Points are awarded.
