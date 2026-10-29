# Curated Program — Software Requirements Specification (SRS)

**Curated Programs — iGOT Karmayogi Platform**

### Document Control & Metadata

- **Document Identifier**: `SRS-IGOT-CP-2026-V1.0`
- **Standard Compliance**: IEEE 29148:2018 (Systems and software engineering — Life cycle processes — Requirements engineering)
- **Target System**: iGOT Karmayogi Digital Workplace (CBP Content Portal, Learner Experience Portal, Assessment & LMS Subsystems)
- **Authoring Role**: Senior Product Analyst & Technical Documentation Specialist
- **Baseline Status**: Production Verified Baseline
- **Traceable Baselines**:
  - Jira Initiatives & Epics: [KB-301: Q2 | CBP Creation, Editing, Review, Publishing and Retiring](https://karmayogibharat.atlassian.net/browse/KB-301) (KB Approved), [KB-452: Q2 | CBP Publishing | Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), [KB-457: Q2 | CBP Editing | Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved), [KB-1936: Q3 | Content Portal Redesign | Content access settings, batch management and user consumption](https://karmayogibharat.atlassian.net/browse/KB-1936) (Prod Deployed), [KB-3489: Q4 | Karma Programs and Learner Homepage enhancements](https://karmayogibharat.atlassian.net/browse/KB-3489) (KB Approved), [KB-3756: Q4 | Karma Programs](https://karmayogibharat.atlassian.net/browse/KB-3756) (Prod Deployed), [KB-8064: Q8 | Access control & L2 Assessments](https://karmayogibharat.atlassian.net/browse/KB-8064) (Open), [KB-8065: Q8 | L2 Assessments/CAP | Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved), [KB-8066: Q8 | L2 Assessments/CAP | Learner consumption](https://karmayogibharat.atlassian.net/browse/KB-8066) (KB Approved)
  - Jira Stories & Subtasks: [KB-453: Q2 | CBP Publishing | CQS and Self Curation should be removed for content creator, content reviewer and publisher for invite only and curated program](https://karmayogibharat.atlassian.net/browse/KB-453) (Prod Deployed), [KB-454: Q2 | CBP Publishing | Update the subheading to suitable wording for curated program](https://karmayogibharat.atlassian.net/browse/KB-454) (Prod Deployed), [KB-466: Q2 | CBP Publishing | Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466), [KB-1945: Q3 | Content Portal Redesign | Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed), [KB-1946: Q3 | Content Portal Redesign | Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed), [KB-8841: Q8 | Learning Path | Curated Program | Add Final Assessment](https://karmayogibharat.atlassian.net/browse/KB-8841) (Prod Deployed), [KB-8842: Q8 | Learning Path | Curated Program | Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed), [KB-9043: Replicate the code of read,retake,submit and result API's from cb-ext-service in cb-ext-assessment service](https://karmayogibharat.atlassian.net/browse/KB-9043) (Done), [KB-9247: BE | Enhance content Flink job to use the compatibilityLevel value set from creation](https://karmayogibharat.atlassian.net/browse/KB-9247) (Done), [KB-9248: BE | Enhance Assessment V7 READ API - to return error for content locking](https://karmayogibharat.atlassian.net/browse/KB-9248) (Done), [KB-9600: User is able to consume final assessment without consuming course content in curated porgram](https://karmayogibharat.atlassian.net/browse/KB-9600) (Done), [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done), [KB-9742: UAT issue : Certificate is not getting generated in TOC page about tab once Curated program is consumed](https://karmayogibharat.atlassian.net/browse/KB-9742) (Done), [KB-9809: Certificate is not getting generated in TOC page about tab once Curated program is consumed by some users in both QA and UAT environment](https://karmayogibharat.atlassian.net/browse/KB-9809) (Fixed)
  - Engineering Trackers: [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review), [KBE-150: Should be able to review and publish the curated programs and display for the karmayogi learners to consume](https://karmayogibharat.atlassian.net/browse/KBE-150) (Review), [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review), [KBE-149: Should be able to view certificate on completion of the curated program](https://karmayogibharat.atlassian.net/browse/KBE-149) (To Do), [KBE-151: Able to view the detailed reports at the program/user level](https://karmayogibharat.atlassian.net/browse/KBE-151) (To Do)
  - Confluence Documents: Confluence Page 35062022 (*User manual - Content Portal v2.0*), Page 21266503 (*Key Features - Nov 2023*), Page 373915757 (*KB-8065 Q8 FRS L2 Assessments*), Page 373850243 (*KB-8065 Q8 BRD L2 Assessments*)

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the formal functional, business, system, and non-functional requirements for the **Curated Program** capability within the iGOT Karmayogi digital platform. It covers the full lifecycle from program initiation, course curation, review, publishing governance, automated batching, and learner discovery, through to gated Level-2 (L2) capstone assessment consumption, bi-directional progress tracking, and dual-certificate issuance.

### 1.2 Scope of the System

The system comprises the Content Portal (CBP UI) used by content creators, reviewers, and SPV publishers, the Learner Experience (Web/M-Site/Mobile App), and underlying microservices including the Content Service, LMS/Enrolment Service, Assessment Service (`cb-ext-assessment-service`), Certificate Service, and Telemetry/Analytics streaming pipelines.

Explicitly out of scope:

- Direct authoring of atomic learning objects (PDF, MP4, SCORM) within a Curated Program (resources must be authored within courses).
- In-place addition or deletion of child courses once a program is published to `Live` status (immutability rule).
- Manual subjective evaluation/grading of L2 assessments.

### 1.3 Definitions, Acronyms, and Abbreviations

- **BR**: Business Requirement
- **CAP**: Comprehensive Assessment Program
- **CBP**: Capacity Building Provider (Content Portal: `cbp.igotkarmayogi.gov.in`)
- **CQS**: Content Quality Score
- **DoPT**: Department of Personnel and Training, Government of India
- **FR**: Functional Requirement
- **FRAC**: Framework for Roles, Activities, and Competencies
- **L1 Assessment**: Level-1 (Course-level) Final Assessment embedded inside an individual course
- **L2 Assessment**: Level-2 (Program-level) Capstone Final Assessment attached to the root of a Curated Program
- **MDO**: Ministry, Department, or Organization
- **NFR**: Non-Functional Requirement
- **SPV**: Special Purpose Vehicle (Karmayogi Bharat)
- **TBD**: To Be Determined (indicates values or thresholds not explicitly specified in available artifacts)
- **TOC**: Table of Contents

## 2. Overall Description

### 2.1 Product Perspective

Curated Programs operate as Level-2 aggregates in the iGOT content taxonomy:

1. `Resource`: Leaf-level learning asset (video, document, quiz).
2. `Course`: Level-1 composite entity holding modules and resources, evaluated via an L1 assessment.
3. `Curated Program`: Level-2 composite entity curating multiple pre-published live courses into a unified competency pathway, optionally evaluated via an L2 capstone assessment.

The capability interfaces with:

- **Keycloak / Kong API Gateway**: Identity, OAuth2 authentication, and role authorization.
- **Sunbird Content & Hierarchy Service**: Metadata persistence in Cassandra and graph hierarchy in Neo4j.
- **Sunbird LMS / Enrolment Service**: Batch lifecycle and learner enrollment state tracking.
- **cb-ext-assessment-service**: Question set delivery and prerequisite locking enforcement.
- **Sunbird-RC Certificate Service**: Digital signature and credential minting.
- **Apache Kafka & Apache Flink**: Real-time event streaming and telemetry summarization.
- **PostgreSQL Data Warehouse**: Scheduled batch reporting for departmental and DoPT oversight.

### 2.2 User Characteristics and Roles

1. **Content Creator** (`CBP Creator`): Authors program metadata, curates live courses, configures L2 assessments, and submits for review.
2. **Content Reviewer** (`CBP Reviewer`): Validates pedagogical structure and either advances programs to publishing or rejects with feedback.
3. **SPV Publisher** (`SPV Publisher`): Karmayogi Bharat central publisher authorized to release public Curated Programs to the live catalog.
4. **Program Coordinator** (`Program Coordinator`): Manages invite-only/blended batches and learner rosters.
5. **Civil Service Learner**: Registered official who discovers programs, enrolls, consumes courses, completes locked L2 assessments, and earns certificates.
6. **Platform Administrator** (`SPV Admin`): Tags programs to curated strips (e.g., Karma Programs).

### 2.3 General Constraints

1. **Live Content Dependency**: Programs can ingest only courses currently in `Live` status (`status = "Live"`, `primaryCategory = "Course"`).
2. **Structural Immutability**: Once published, constituent courses cannot be added or deleted from within the program.
3. **Automated Batching**: Curated Programs (`access = "All users"`) require automated backend batch provisioning without manual coordinator intervention.

## 3. Business Requirements (BR)

- **BR-01: Structured Civil Service Competency Pathways**<br>The platform shall provide unified curricular groupings of discrete courses to eliminate learner fragmentation and align learning with civil service competencies defined in the FRAC dictionary.
- **BR-02: Content Verification Reusability & Governance Streamlining**<br>The platform shall eliminate redundant Content Quality Score (CQS) evaluations and automated profanity checks on Curated Programs, leveraging the pre-verified status of constituent live courses.
- **BR-03: Protection of Historical Progress and Credentials**<br>The platform shall enforce immutability of constituent course composition on published programs to prevent corruption or invalidation of in-progress and completed learner credentials.
- **BR-04: Holistic Competency Validation (DoPT Mandate)**<br>The platform shall enable program-level capstone assessments (L2) with mandatory prerequisite locking to verify cumulative learning across all constituent subjects.
- **BR-05: Dual Certification Model**<br>The platform shall provide learners with both modular recognition (individual Course Certificates) and curricular graduation recognition (Program Certificate).
- **BR-06: Cross-Institutional Curriculum Synergy**<br>The platform shall enable authorized creators from any MDO to bundle courses published by their own MDO as well as verified courses published by peer training institutions.

## 4. Functional Requirements (FR)

### 4.1 Program Initiation & Configuration

- **FR-INIT-001: Program Entity Initialization**<br>The system shall allow a user with the `CBP Creator` role to initiate a new Program entity by providing:
  - Program Title (String, mandatory, length 3 to 100 characters [TBD: max length verification])
  - Program Subtitle (String, mandatory, length 3 to 200 characters [TBD])
  - Primary Language (Dropdown, mandatory, defaults to "English")
  - Access Setting (Selection, mandatory; choosing "All users" shall classify the entity as a Curated Program)<br>*Traceability:* [KB-1945: Q3 | Content Portal Redesign | Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed)*, Page 35062022 §5.1*

- **FR-INIT-002: Unique Entity Persistence**<br>Upon initiation, the system shall persist the program record in Cassandra and Neo4j with:
  - Unique identifier format `do_PID...`
  - `status = "Draft"`
  - `contentType = "Program"`
  - `primaryCategory = "Curated Program"`<br>*Traceability:* [KB-1945: Q3 | Content Portal Redesign | Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed)*,* [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review)

- **FR-INIT-003: Metadata & Competency Configuration**<br>The system shall permit the creator to configure:
  - Program Description (Rich text, mandatory)
  - Learning Objectives (Rich text, optional)
  - Program Banner / Thumbnail (Image file, 16:9 aspect ratio, max size 2MB [TBD])
  - FRAC Competency Tagging (Selection of Competency Type, Competency Area, Theme, and Sub-theme from the FRAC dictionary)<br>*Traceability: Page 35062022 §5.10*

### 4.2 Content Selection & Curriculum Curation

- **FR-CUR-001: Live Course Search & Filtering**<br>The system shall allow creators to search and filter candidate courses for association. The search interface shall:
  - Return exclusively courses with `status = "Live"` and `primaryCategory = "Course"`
  - Provide a toggle filter between "My Courses" (scoped to creator's MDO) and "All Courses" (unrestricted catalog)<br>*Traceability:* [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review)*, Page 35062022 §5.2.3*

- **FR-CUR-002: Course Association by Reference**<br>The system shall associate selected courses to the program hierarchy by immutable reference (`do_CID...`). The system shall not duplicate underlying course assets, modules, or quizzes.<br>*Traceability:* [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review)
- **FR-CUR-003: Pedagogical Sequencing**<br>The system shall allow the creator to order constituent courses via drag-and-drop or explicit sequence indexing. The defined sequence shall govern the Table of Contents order presented to the learner.<br>*Traceability:* [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review)*, Page 35062022 §5.2.4*
- **FR-CUR-004: Minimum Content Association Rule**<br>The system shall prevent a creator from submitting a program for review if the program contains zero associated courses. The UI shall display an explicit validation error: *"Please add at least one live course to proceed."*<br>*Traceability: Page 35062022 §5.2.4*

### 4.3 Governance, Review & Publication

- **FR-GOV-001: CQS and Self-Curation Bypass**<br>The system shall omit Content Quality Score (CQS) questionnaires and automated PDF/media profanity scanning (Self-Curation) tabs from the Curated Program workflow across creation, review, and publishing screens.<br>*Traceability:* [KB-452: Q2 | CBP Publishing | Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved)*,* [KB-453: Q2 | CBP Publishing | CQS and Self Curation should be removed for content creator, content reviewer and publisher for invite only and curated program](https://karmayogibharat.atlassian.net/browse/KB-453) (Prod Deployed)
- **FR-GOV-002: Submit for Review Workflow**<br>The system shall transition a program from `Draft` to `Under Review` when the creator clicks "Send for Review", assigning the review task to the MDO's `CBP Reviewer` queue.<br>*Traceability:* [KB-452: Q2 | CBP Publishing | Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved)*, Page 35062022 §5.3*
- **FR-GOV-003: Reviewer Actions and Rejection Loop**<br>A user with the `CBP Reviewer` role shall be able to:
  - Approve: Transitions status to `Under Publish`
  - Reject: Mandates entry of feedback comments; transitions status back to `Draft` and alerts the creator<br>*Traceability: Page 35062022 §5.3.2*

- **FR-GOV-004: Recall to Draft**<br>The system shall allow the creator to invoke "Recall content to draft" when the program is in either `Under Review` or `Under Publish` status, returning it to `Draft` status for editing.<br>*Traceability: Page 21266503, Page 35062022 §5.2.1.8*
- **FR-GOV-005: SPV Publishing Authority**<br>The system shall restrict the final publication of Curated Programs (`access = "All users"`) to users possessing the `SPV Publisher` role. Standard institutional publishers shall be restricted from publishing public programs.<br>*Traceability: Page 35062022 §3,* [KB-452: Q2 | CBP Publishing | Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved)
- **FR-GOV-006: Automated Open Batch Provisioning**<br>Upon transition to `Live` status, the LMS service shall automatically provision an open, self-paced batch (`enrollmentType = "open"`, `status = 1`) associated with the program entity, without requiring manual batch creation by a Program Coordinator.<br>*Traceability:* [KB-1946: Q3 | Content Portal Redesign | Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed)*, Page 35062022 §5.5*

### 4.4 Discovery, Access & Enrolment

- **FR-DISC-001: Global Catalog Indexing**<br>Upon publishing, the system shall index the program in Elasticsearch within 60 seconds [TBD: exact SLA], making it searchable via title, description, and competency tags on the Learner Portal.<br>*Traceability:* [KBE-150: Should be able to review and publish the curated programs and display for the karmayogi learners to consume](https://karmayogibharat.atlassian.net/browse/KBE-150) (Review)
- **FR-DISC-002: Karma Programs Thematic Strip**<br>The system shall display eligible curated programs on the learner homepage within the "Karma Programs" strip when tagged with designated category identifiers by SPV administrators. If no programs are tagged or active, the strip shall remain hidden.<br>*Traceability:* [KB-3756: Q4 | Karma Programs](https://karmayogibharat.atlassian.net/browse/KB-3756) (Prod Deployed)*,* [KB-3759: Q4 l Karma Programs l Portal | Access Karma Programs | Product UI UX](https://karmayogibharat.atlassian.net/browse/KB-3759) (Done)
- **FR-ENROL-001: Self-Enrolment Execution**<br>The system shall permit any authenticated learner to self-enroll in an open Curated Program batch via `POST /action/course/v1/enrol`, creating a record in `sunbird.user_enrolment` with `status = 1` (In Progress).<br>*Traceability:* [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review)*,* [KB-1946: Q3 | Content Portal Redesign | Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed)
- **FR-ENROL-002: Existing Course Progress Association**<br>Upon program enrollment, if the learner already has prior consumption records in any of the constituent child courses, the system shall immediately reflect that existing progress within the program Table of Contents without requiring course re-enrollment.<br>*Traceability: Page 21266503,* [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done)

### 4.5 Learning Consumption & Progress Tracking

- **FR-CONS-001: Program Table of Contents Navigation**<br>The system shall render a Program Table of Contents (TOC) page displaying:
  - Overall Program Completion Percentage ()
  - Ordered list of constituent courses with individual status pills (`Not Started`, `In Progress`, `Completed`)
  - "Start" or "Resume" action buttons deep-linking into the course player<br>*Traceability:* [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review)

- **FR-CONS-002: Bi-Directional Telemetry & Progress Synchronization**<br>The system shall synchronize course consumption bidirectionally:
  - Course progress achieved while launched from the program TOC shall persist to `user_content_consumption`.
  - Course progress achieved independently on the standalone course page shall immediately reflect within the Curated Program TOC.<br>*Traceability: Page 21266503,* [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done)

- **FR-CONS-003: Program Progress Calculation**<br>The system shall calculate overall program progress as the arithmetic mean of all constituent child course completion percentages, excluding the L2 assessment until coursework is finished:<br><br>*(Where is the total count of constituent courses).*<br>*Traceability:* [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review)*,* [KB-8842: Q8 | Learning Path | Curated Program | Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed)

### 4.6 Level-2 (L2) Assessment & Gating

- **FR-ASM-001: L2 Assessment Attachment**<br>The system shall permit creators to create and attach an optional Level-2 Final Assessment at the root level of a Curated Program. The assessment entity shall be assigned `contextCategory = "Final Program Assessment"`.<br>*Traceability:* [KB-8065: Q8 | L2 Assessments/CAP | Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved)*,* [KB-8841: Q8 | Learning Path | Curated Program | Add Final Assessment](https://karmayogibharat.atlassian.net/browse/KB-8841) (Prod Deployed)
- **FR-ASM-002: Assessment Locking Modes**<br>The system shall provide two locking modes during program configuration:
  - `Default Unlock`: Content and assessment can be consumed in any order.
  - `Final Assessment Lock`: Sets program attribute `contextLockingType = "Course Assessment Only"`.<br>*Traceability:* [KB-8842: Q8 | Learning Path | Curated Program | Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed)*, Page 373915757 §4*

- **FR-ASM-003: Server-Side Gating Enforcement**<br>When `contextLockingType == "Course Assessment Only"`, the `cb-ext-assessment-service` shall intercept calls to `POST /v7/assessment/read`. It shall verify whether all constituent child courses have `status == 2` in `user_enrolment`.
  - If any course is incomplete (`status < 2`), the service shall reject the request with `HTTP 400 Bad Request` and body: *"User must complete all the children courses before starting on the Final Assessment."*
  - If all courses are complete (`status == 2`), the service shall return `HTTP 200 OK` with the QuestionSet payload.<br>*Traceability:* [KB-8842: Q8 | Learning Path | Curated Program | Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed)*,* [KB-9043: Replicate the code of read,retake,submit and result API's from cb-ext-service in cb-ext-assessment service](https://karmayogibharat.atlassian.net/browse/KB-9043) (Done)*,* [KB-9600: User is able to consume final assessment without consuming course content in curated porgram](https://karmayogibharat.atlassian.net/browse/KB-9600) (Done)

- **FR-ASM-004: Legacy Endpoint Interception**<br>The system shall block requests to legacy `cb-ext` assessment read endpoints attempting to fetch a QuestionSet with `contextCategory == "Final Program Assessment"`, returning `HTTP 400 Bad Request`: *"Trying to read invalid assessment type. Higher version API must be used."*<br>*Traceability:* [KB-8842: Q8 | Learning Path | Curated Program | Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed)
- **FR-ASM-005: L2 Assessment Evaluation**<br>The system shall evaluate submitted L2 assessment answers against creator-configured cut-off scores upon `POST /v7/assessment/submit`. If score , the assessment status shall be marked as Passed.<br>*Traceability:* [KB-8065: Q8 | L2 Assessments/CAP | Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved)*,* [KB-9248: BE | Enhance Assessment V7 READ API - to return error for content locking](https://karmayogibharat.atlassian.net/browse/KB-9248) (Done)

### 4.7 Completion, Certification & Maintenance

- **FR-CERT-001: Course-Level Certification**<br>Upon achieving `status = 2` for any individual constituent course, the system shall issue a digitally signed Course Certificate via the `sunbird-rc` certificate service, accessible immediately in the learner profile.<br>*Traceability:* [KBE-149: Should be able to view certificate on completion of the curated program](https://karmayogibharat.atlassian.net/browse/KBE-149) (To Do)
- **FR-CERT-002: Program-Level Completion Evaluation**<br>The system shall transition a Curated Program's enrollment record to `status = 2` (Completed) if and only if:
  - All constituent child courses have `status = 2`.
  - The attached L2 Final Assessment (if configured) has achieved a Passed result.<br>*Traceability:* [KB-8842: Q8 | Learning Path | Curated Program | Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed)*,* [KB-9742: UAT issue : Certificate is not getting generated in TOC page about tab once Curated program is consumed](https://karmayogibharat.atlassian.net/browse/KB-9742) (Done)

- **FR-CERT-003: Program Certificate Generation**<br>Upon program completion, the system shall emit an asynchronous event to Kafka (`course.completion`), prompting the certificate generator to mint a Program Certificate carrying the program title, issuer logo, completion date, and verifiable QR code.<br>*Traceability:* [KBE-149: Should be able to view certificate on completion of the curated program](https://karmayogibharat.atlassian.net/browse/KBE-149) (To Do)*,* [KB-9809: Certificate is not getting generated in TOC page about tab once Curated program is consumed by some users in both QA and UAT environment](https://karmayogibharat.atlassian.net/browse/KB-9809) (Fixed)
- **FR-MAINT-001: Immutability of Published Curricula**<br>When a Curated Program is in `Live` status:
  - The Content Portal UI shall disable and hide all controls for adding, deleting, or reordering child courses.
  - The backend hierarchy service shall reject any `PATCH` request targeting course list mutations on live program entities.<br>*Traceability:* [KB-457: Q2 | CBP Editing | Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved)*,* [KB-466: Q2 | CBP Publishing | Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466)

- **FR-MAINT-002: Metadata Editability on Live Programs**<br>The system shall permit creators to edit program metadata (title, subtitle, description, thumbnail, competency tags) on live programs. Edits shall require standard review and publishing approval before updating the public catalog.<br>*Traceability:* [KB-457: Q2 | CBP Editing | Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved)*,* [KB-466: Q2 | CBP Publishing | Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466)

## 5. Non-Functional Requirements (NFR)

### 5.1 Performance Requirements

- **NFR-PERF-001: Assessment Gating Verification Latency**<br>The `cb-ext-assessment-service` shall complete child course completion checks in Cassandra and return the assessment readiness response in under 95th percentile load.
- **NFR-PERF-002: TOC Page Load Time**<br>The Program TOC page shall render all constituent course cards, status badges, and overall progress in on standard broadband connections ().
- **NFR-PERF-003: Telemetry Ingestion Throughput**<br>The telemetry pipeline shall ingest player progress events at a peak rate of [TBD: production peak threshold] without event loss.

### 5.2 Security & Access Control

- **NFR-SEC-001: Role-Based Authorization Enforcement**<br>All modification endpoints (`/action/content/*`, `/action/questionset/*`) shall enforce JWT-based role verification at the Kong API Gateway. Unauthorized requests shall be rejected with `HTTP 403 Forbidden`.
- **NFR-SEC-002: Server-Side Assessment Lock Enforcement**<br>The system shall enforce L2 assessment gating strictly on the server side (`cb-ext-assessment-service`). Client-side state manipulation or direct API probing shall not permit question payload disclosure.
- **NFR-SEC-003: Integrity of Assessment Answers**<br>Question scoring and answer evaluation shall execute in an isolated backend runtime. Evaluation keys and answer rubrics shall not be transmitted to the client browser prior to submission.

### 5.3 Reliability, Availability & Fault Tolerance

- **NFR-REL-001: Idempotent Certificate Minting**<br>The certificate generation worker shall be strictly idempotent. In the event of Kafka message redelivery or worker retries, the system shall not generate duplicate certificate records or corrupt existing URLs.
- **NFR-REL-002: High Availability Target**<br>The Curated Program consumption services (TOC, player, assessment read) shall maintain operational availability during core learning hours (08:00 to 22:00 IST).

### 5.4 Maintainability & Extensibility

- **NFR-MAINT-001: Standard Schema Compatibility**<br>Program hierarchies shall comply with Sunbird 5.x/6.x composite hierarchy schemas, allowing standard Sunbird search, consumption, and LMS services to process program nodes seamlessly.

## 6. External Interface Requirements

### 6.1 User Interfaces

- **UI-CBP-01: Program Creation Form**: Tabbed interface featuring "Program Details", "Content Curation", "Program Settings", and "Review". CQS and profanity scan tabs shall be absent.
- **UI-LP-01: Program TOC Page**: Responsive desktop and mobile layout presenting course cards with status indicators (`Not Started`, `In Progress`, `Completed`), overall progress bar, and locked assessment card with prerequisite warning dialog.

### 6.2 Software Interfaces & APIs

#### API-01: Gated Level-2 Assessment Read

- **Endpoint**: `POST /v7/assessment/read`
- **Protocol**: HTTPS / JSON
- **Caller**: Learner Portal Assessment Player
- **Provider**: `cb-ext-assessment-service`
- **Authentication**: Bearer Token (User Session)
- **Request Payload**:
  ```json
  {
    "programId": "do_PID123456789",
    "assessmentId": "do_AID987654321"
  }
  ```
- **Success Response** (`200 OK`): Returns full QuestionSet schema.
- **Locked Error Response** (`400 Bad Request`):
  ```json
  {
    "id": "api.assessment.read",
    "ver": "7.0",
    "ts": "2026-10-29T15:55:00Z",
    "params": {
      "resmsgid": "uuid",
      "status": "FAILED",
      "err": "ASSESSMENT_LOCKED",
      "errmsg": "User must complete all the children courses before starting on the Final Assessment"
    },
    "responseCode": "CLIENT_ERROR",
    "result": {}
  }
  ```

#### API-02: Program Enrollment

- **Endpoint**: `POST /action/course/v1/enrol`
- **Protocol**: HTTPS / JSON
- **Caller**: Learner Portal
- **Provider**: LMS Enrolment Service
- **Request Payload**:
  ```json
  {
    "request": {
      "courseId": "do_PID123456789",
      "batchId": "013987654321098765",
      "userId": "usr_712020_..."
    }
  }
  ```
- **Success Response** (`200 OK`):
  ```json
  {
    "id": "api.course.enrol",
    "params": {
      "status": "SUCCESS"
    },
    "responseCode": "OK",
    "result": {
      "response": "SUCCESS"
    }
  }
  ```

## 7. Verification & Acceptance Criteria (Quality Matrix)

| Requirement ID | Verification Method | Acceptance / Pass Criteria | Associated Test Scenario / Defect |
|---|---|---|---|
| **FR-INIT-001** | Inspection & Test | Creator selects "All users"; program entity created with `primaryCategory = "Curated Program"`. | [KB-1945: Q3 \| Content Portal Redesign \| Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed) UAT Pass |
| **FR-CUR-001** | Automated Test | Search queries return only courses with `status = "Live"`. Draft or retired courses are absent. | [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review) Test Matrix |
| **FR-GOV-001** | Inspection | CQS and Self-Curation tabs are not rendered in Creator, Reviewer, or Publisher views. | [KB-453: Q2 \| CBP Publishing \| CQS and Self Curation should be removed for content creator, content reviewer and publisher for invite only and curated program](https://karmayogibharat.atlassian.net/browse/KB-453) (Prod Deployed) Verification Video |
| **FR-GOV-005** | Security Test | Attempting to publish via non-SPV Publisher account returns `HTTP 403 Forbidden`. | Page 35062022 §3 Security Audit |
| **FR-GOV-006** | Integration Test | Upon publish, an open batch is created in Cassandra `course_batch` table with `enrollmentType = "open"`. | [KB-1946: Q3 \| Content Portal Redesign \| Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed) Verification |
| **FR-CONS-002** | Functional Test | Completing Course 1 standalone immediately updates Course 1 pill on Program TOC to "Completed". | [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done) Regression Suite |
| **FR-ASM-003** | Security & API Test | Calling `POST /v7/assessment/read` when child courses are incomplete returns `HTTP 400 Bad Request`. | [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed), [KB-9600: User is able to consume final assessment without consuming course content in curated porgram](https://karmayogibharat.atlassian.net/browse/KB-9600) (Done) Fix Verified |
| **FR-CERT-002** | System Integration | Program `status = 2` is achieved only when all courses are complete and L2 assessment is passed. | [KB-9742: UAT issue : Certificate is not getting generated in TOC page about tab once Curated program is consumed](https://karmayogibharat.atlassian.net/browse/KB-9742) (Done) Test Case 04 |
| **FR-MAINT-001** | Boundary Test | In edit mode on live program, UI add/delete course buttons are disabled and backend rejects hierarchy mutations. | [KB-457: Q2 \| CBP Editing \| Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved), [KB-466: Q2 \| CBP Publishing \| Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466) Verification |

## 8. Requirements Traceability Matrix (RTM)

| Requirement ID | Requirement Summary | Business Rule | Primary Jira Sources | Documentation Source | Implementation Evidence / Status |
|---|---|---|---|---|---|
| **FR-INIT-001** | Program Entity Creation | BR-01 | [KB-1945: Q3 \| Content Portal Redesign \| Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed), [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review) | Doc 35062022 §5.1 | **Implemented** (CBP Web SPA) |
| **FR-INIT-002** | Hierarchy Persistence | BR-01 | [KB-1945: Q3 \| Content Portal Redesign \| Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed) | Doc 35062022 §5.1 | **Implemented** (Content Service) |
| **FR-INIT-003** | Metadata & Competencies | BR-01 | [KB-1945: Q3 \| Content Portal Redesign \| Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed) | Doc 35062022 §5.10 | **Implemented** (FRAC Integration) |
| **FR-CUR-001** | Live Course Filtering | BR-02, BR-06 | [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review) | Doc 35062022 §5.2.3 | **Implemented** (Content Search API) |
| **FR-CUR-002** | Association by Reference | BR-01, BR-03 | [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review) | Doc 35062022 §5.2.4 | **Implemented** (Neo4j Graph Store) |
| **FR-CUR-003** | Pedagogical Ordering | BR-01 | [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review) | Doc 35062022 §5.2.4 | **Implemented** (CBP Hierarchy UI) |
| **FR-CUR-004** | Min 1 Course Required | BR-01 | [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review) | Doc 35062022 §5.2.4 | **Implemented** (UI Form Validator) |
| **FR-GOV-001** | CQS & Profanity Bypass | BR-02 | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), [KB-453: Q2 \| CBP Publishing \| CQS and Self Curation should be removed for content creator, content reviewer and publisher for invite only and curated program](https://karmayogibharat.atlassian.net/browse/KB-453) (Prod Deployed) | Doc 21266503 | **Implemented** (CBP Workflow Config) |
| **FR-GOV-002** | Review Handoff | BR-02 | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved) | Doc 35062022 §5.3 | **Implemented** (Workflow Engine) |
| **FR-GOV-003** | Reviewer Approvals | BR-02 | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved) | Doc 35062022 §5.3.2 | **Implemented** (Workflow Engine) |
| **FR-GOV-004** | Recall to Draft | BR-02 | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved) | Doc 21266503, Doc 35062022 | **Implemented** (CBP Action Handler) |
| **FR-GOV-005** | SPV Publisher Authority | BR-02 | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), [KBE-150: Should be able to review and publish the curated programs and display for the karmayogi learners to consume](https://karmayogibharat.atlassian.net/browse/KBE-150) (Review) | Doc 35062022 §3 | **Implemented** (RBAC Enforcement) |
| **FR-GOV-006** | Auto Open Batching | BR-01 | [KB-1946: Q3 \| Content Portal Redesign \| Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed) | Doc 35062022 §5.5 | **Implemented** (LMS Auto-Provisioner) |
| **FR-DISC-001** | Search Indexing | BR-01 | [KBE-150: Should be able to review and publish the curated programs and display for the karmayogi learners to consume](https://karmayogibharat.atlassian.net/browse/KBE-150) (Review) | Doc 21266503 | **Implemented** (Elasticsearch Sync) |
| **FR-DISC-002** | Karma Programs Strip | BR-01 | [KB-3756: Q4 \| Karma Programs](https://karmayogibharat.atlassian.net/browse/KB-3756) (Prod Deployed), [KB-3759: Q4 l Karma Programs l Portal \| Access Karma Programs \| Product UI UX](https://karmayogibharat.atlassian.net/browse/KB-3759) (Done) | Production UI Baseline | **Implemented** (Learner Portal Strip) |
| **FR-ENROL-001** | Open Batch Enrolment | BR-01 | [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review), [KB-1946: Q3 \| Content Portal Redesign \| Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed) | Doc 35062022 §5.5 | **Implemented** (LMS Service) |
| **FR-ENROL-002** | Historical Progress Link | BR-03 | [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done) | Doc 21266503 | **Implemented** (Cassandra Linker) |
| **FR-CONS-001** | Program TOC View | BR-01 | [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review) | Doc 35062022 | **Implemented** (Learner Portal SPA) |
| **FR-CONS-002** | Bi-directional Sync | BR-03 | [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done) | Doc 21266503 | **Implemented** (Flink Summarizer) |
| **FR-CONS-003** | Progress Aggregation | BR-01 | [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review) | Doc 35062022 | **Implemented** (Hierarchy Evaluator) |
| **FR-ASM-001** | L2 Assessment Attach | BR-04 | [KB-8065: Q8 \| L2 Assessments/CAP \| Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved), [KB-8841: Q8 \| Learning Path \| Curated Program \| Add Final Assessment](https://karmayogibharat.atlassian.net/browse/KB-8841) (Prod Deployed) | Doc 373915757 | **Implemented** (Assessment Service) |
| **FR-ASM-002** | Locking Modes Setup | BR-04 | [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed) | Doc 373915757 §4 | **Implemented** (CBP Settings UI) |
| **FR-ASM-003** | Server-side Lock Gating | BR-04 | [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed), [KB-9600: User is able to consume final assessment without consuming course content in curated porgram](https://karmayogibharat.atlassian.net/browse/KB-9600) (Done) | Doc 373915757 §4 | **Implemented** (`cb-ext-assessment-service`) |
| **FR-ASM-004** | Legacy Endpoint Block | BR-04 | [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed) | Tech Note (Karthikeyan R.) | **Implemented** (cb-ext Interceptor) |
| **FR-ASM-005** | L2 Evaluation & Cut-off | BR-04 | [KB-8065: Q8 \| L2 Assessments/CAP \| Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved), [KB-9248: BE \| Enhance Assessment V7 READ API - to return error for content locking](https://karmayogibharat.atlassian.net/browse/KB-9248) (Done) | Doc 373850243 | **Implemented** (Evaluation Engine) |
| **FR-CERT-001** | Course Certificates | BR-05 | [KBE-149: Should be able to view certificate on completion of the curated program](https://karmayogibharat.atlassian.net/browse/KBE-149) (To Do) | Doc 21266503 | **Implemented** (`sunbird-rc-certs`) |
| **FR-CERT-002** | Program Completion Check | BR-04, BR-05 | [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed), [KB-9742: UAT issue : Certificate is not getting generated in TOC page about tab once Curated program is consumed](https://karmayogibharat.atlassian.net/browse/KB-9742) (Done) | Doc 373915757 | **Implemented** (LMS State Machine) |
| **FR-CERT-003** | Program Certificate Mint | BR-05 | [KBE-149: Should be able to view certificate on completion of the curated program](https://karmayogibharat.atlassian.net/browse/KBE-149) (To Do), [KB-9809: Certificate is not getting generated in TOC page about tab once Curated program is consumed by some users in both QA and UAT environment](https://karmayogibharat.atlassian.net/browse/KB-9809) (Fixed) | Doc 21266503 | **Implemented** (Async Certificate Job) |
| **FR-MAINT-001** | Live Immutability | BR-03 | [KB-457: Q2 \| CBP Editing \| Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved), [KB-466: Q2 \| CBP Publishing \| Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466) | Sprint 8 Baseline | **Implemented** (CBP UI & Content API) |
| **FR-MAINT-002** | Metadata-only Edits | BR-03 | [KB-457: Q2 \| CBP Editing \| Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved), [KB-466: Q2 \| CBP Publishing \| Editing a live program In-Progress](https://karmayogibharat.atlassian.net/browse/KB-466) | Sprint 8 Baseline | **Implemented** (Content Service) |
