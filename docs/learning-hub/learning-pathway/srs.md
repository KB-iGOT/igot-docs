# Learning Pathways — Software Requirements Specification (SRS)

## Learning Pathways — iGOT Karmayogi

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the formal, normative requirements for the **Learning Pathways** feature within the iGOT Karmayogi platform. It captures both functional capabilities and non-functional constraints governing pathway authoring, milestone sequencing, pre-assessment and milestone assessment evaluation, client-driven progression unlocking, certification, and skill badge credentialing.

This document serves as the contract and baseline specification for Product Owners, Business Analysts, Solution Architects, Frontend/Backend Developers, and QA Engineers.

### 1.2 Scope of the Document and System

The system specified herein is the **Learning Pathways Subsystem** of the iGOT Karmayogi digital learning infrastructure.

- **Included Scope:**
  - Authoring and publication workflow executed by the SPV Publisher role via the Content Creation Portal (`sunbird-cb-creationportal`).
  - Data modeling and content-tree aggregation across Neo4j graph nodes, Cassandra hierarchy stores, and Redis distributed caches (`knowledge-platform`).
  - Learner discovery, Table of Contents (TOC) rendering, and sequential progression unlocking on Web (`sunbird-cb-portal`) and Mobile (`igot_karmayogi_mobile`).
  - Credential generation (milestone achievement SVGs and pathway certificates) and Gamification Skill Badge attachment (Quarter 13).

- **Excluded Scope:**
  - Automated external multi-channel notifications (SMS, email, push).
  - Standalone custom certificate graphic layout designers.
  - Dynamic adaptive learning path sequencing algorithms (e.g., automated AI-driven curriculum mutation).
  - Non-linear or parallel milestone branch navigation.

### 1.3 Product Overview

Learning Pathways transitions iGOT Karmayogi from unguided, standalone course consumption into milestone-driven curricula termed "iGOT Specializations." A pathway bundles between 1 and 5 milestones preceded by a mandatory Pre-assessment. Each milestone encapsulates at least one mandatory course, zero or more optional courses, and a mandatory milestone assessment. Progression is strictly gated: learners unlock Milestone 1 only after clearing the Pre-assessment, and unlock Milestone only upon completing all mandatory courses and passing the assessment of Milestone .

### 1.4 Definitions, Acronyms, and Abbreviations

| Term / Acronym | Definition |
|---|---|
| **BRD** | Business Requirements Document |
| **CKEditor** | Rich-text editor integrated into the Creation Portal for formatted text entry |
| **Do ID** | Digital Object Identifier; unique alphanumeric content identifier (e.g., `do_1138...`) |
| **FRS** | Functional Requirements Specification |
| **iGOT** | Integrated Government Online Training platform |
| **Karma Points** | Platform gamification reward units granted for learning achievements |
| **Knowledge Platform (KP)** | Core Sunbird Scala/Play/Akka backend managing metadata, graphs, and search |
| **LLD** | Low-Level Design |
| **MDO** | Ministry, Department, or Organization within the Government of India |
| **Neo4j** | Graph database storing the canonical `Content` nodes and opaque metadata |
| **NFR** | Non-Functional Requirement |
| **Questionset** | Sunbird native assessment object encapsulating sections, questions, and scoring logic |
| **RTM** | Requirements Traceability Matrix |
| **SPV** | Special Purpose Vehicle (Karmayogi Bharat) |
| **SPV Publisher** | User role authorized to author, publish, modify, and retire Learning Pathways |
| **TOC** | Table of Contents |

### 1.5 References

1. **Jira Issues:**
  - [KB-11804: Q10 | Learner Pathways and iGOT Specialization](https://karmayogibharat.atlassian.net/browse/KB-11804) (Open): Q10 | Learner Pathways and iGOT Specialization *(Initiative)*
  - [KB-11806: Q10 | Learners Pathway](https://karmayogibharat.atlassian.net/browse/KB-11806) (KB Review): Q10 | Learners Pathway *(Epic)*
  - [KB-15017: Q13 | Skill Badges - Learner Pathways](https://karmayogibharat.atlassian.net/browse/KB-15017) (KB Review): Q13 | Skill Badges - Learner Pathways *(Epic)*
  - [KB-11953: Q10 | Learning Pathways| Creation of Learning Pathways](https://karmayogibharat.atlassian.net/browse/KB-11953) (Prod Deployed): Creation of Learning Pathways
  - [KB-11954: Q10 | Learning Pathways | Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed): Learning Structure
  - [KB-11955: Q10 | Learning Pathways | Preview Path](https://karmayogibharat.atlassian.net/browse/KB-11955) (Prod Deployed): Preview Path
  - [KB-11956: Q10 | Learning Pathways | Access Control](https://karmayogibharat.atlassian.net/browse/KB-11956) (Prod Deployed): Access Control
  - [KB-12111: Q10 | Learning Pathways | Content Portal](https://karmayogibharat.atlassian.net/browse/KB-12111) (Prod Deployed): Content Portal Management
  - [KB-12114: Q10 | Learning Pathways | Landing Page for the Learners](https://karmayogibharat.atlassian.net/browse/KB-12114) (Prod Deployed): Landing Page for Learners
  - [KB-12115: Q10 | Learning Pathways | Learner Pathway Progression & Unlocking](https://karmayogibharat.atlassian.net/browse/KB-12115) (Prod Deployed): Learner Pathway Progression & Unlocking
  - [KB-12117: Q10 | Learning Pathways | Learner Achievements and Certificate](https://karmayogibharat.atlassian.net/browse/KB-12117) (Prod Deployed): Learner Achievements and Certificate

2. **Requirements & Design Documents:**
  - [Q10 | BRD | Learning Pathways](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/507052069/Q10+BRD+Learning+Pathways)
  - [Q10 | FRS | Learner Pathways](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/568557572/Q10+FRS+Learner+Pathways)
  - [SRS - Q10 | Learning Pathway](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/735969281/SRS+-+Q10+Learning+Pathway)
  - [Q13 | BRD | Skill Badge - Learner Pathway](https://karmayogibharat.atlassian.net/wiki/spaces/TPT/pages/1248755721/Q13+BRD+Skill+Badge+-+Learner+Pathway)
  - [Learning Pathways — As-Built Requirements, HLD & LLD](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/1202814977/Learning+Pathways+As-Built+Requirements+HLD+LLD)
  - [High-Level Design — Learning Pathways](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/1202946071/High-Level+Design+Learning+Pathways)
  - [Low-Level Design — Learning Pathways](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/1202814990/Low-Level+Design+Learning+Pathways)

## 2. Overall Description

### 2.1 Product Perspective

Learning Pathways is an architectural overlay on top of the existing Sunbird Knowledge Platform. It does not introduce a separate microservice or isolated database schema. A Learning Pathway is persisted as a standard Neo4j `Content` node where `contentType =` `"Course"`, `primaryCategory = "Course"`, and `courseCategory = "Learning Pathway"`. The multi-level hierarchy (milestones, courses, and assessment configurations) is serialized as an opaque JSON string/array inside the `milestones_v1` node property.

Enriched pathway reads are executed by `ExtendedContentActor.extendedRead()`, which concurrently resolves course and assessment hierarchies and caches results in Redis. All progression evaluation (milestone lock/unlock logic) is executed client-side via Web and Mobile user interface layers by evaluating the user's generic course progress states against the pathway definition.

### 2.2 Product Functions (Functional Summary)

- **Authoring Wizard:** A 4-step sequential wizard (`Create Path` `Learning Structure` `Preview Path` `Access Control`).
- **Curriculum Structuring:** Configuration of 1 to 5 sequential milestones, deduplication of courses across milestones, selection of mandatory versus optional courses, and association of questionset assessments.
- **Gated Progression:** Pre-assessment gate for Milestone 1; mandatory course gates for milestone assessments; milestone completion gates for subsequent milestones.
- **Credentials & Certification:** Generation of milestone completion SVG certificates, overall pathway certificates, and issuance of Q13 Skill Badges upon 100% completion.
- **Lifecycle Administration:** Tabbed management interface for Draft and Live pathways with search, sort, pagination, and deletion prevention guards.

### 2.3 User Classes and Characteristics

- **SPV Publisher:** Administrative content creator possessing the `spv_publisher` role. High computer literacy, responsible for curriculum integrity, public tagging, and cohort access definition.
- **Learner (Civil Servant):** End user from any Ministry, Department, or Organization (MDO). Consumes content via web browser or mobile application. Requires guided step-by-step navigation and clear gating visual cues.
- **Platform Administrator / MDO Admin:** Oversees cohort-level access, tracks competency uptake, and monitors completion reporting via Looker.

### 2.4 Operating Environment

- **Web Client:** Modern Evergreen Browsers (Google Chrome 118+, Mozilla Firefox 122+, Microsoft Edge).
- **Mobile Client:** Native/Flutter application running on Android (versions up to 13) and iOS (versions up to 17).
- **Backend Tier:** Scala / Play Framework / Akka Actors running within containerized Kubernetes clusters.
- **Persistence & Caching Tier:** Neo4j (Graph Database), Apache Cassandra (Hierarchy Store), Redis (Distributed In-Memory Cache), Elasticsearch (Search Index).

### 2.5 Design and Implementation Constraints (CON)

- **CON-01 [Content Model Reuse]:** The system shall implement Learning Pathways using the existing Sunbird `Content` node schema without introducing custom relational tables.
- **CON-02 [Opaque JSON Storage]:** The pathway structure (milestones, course IDs, mandatory flags) shall be stored as a serialized JSON string/array within the `milestones_v1` property of the `Content` node.
- **CON-03 [Client-Side Progression]:** Progression state and lock/unlock indicators shall be computed exclusively within the client tier (Angular Web / Flutter Mobile) based on generic course consumption states (`/api/course/v5/content/state/read`). No dedicated pathway progress calculation microservice shall be introduced.
- **CON-04 [Single Milestone Assessment]:** Exactly one mandatory assessment shall be supported per milestone.
- **CON-05 [Live Structural Immutability]:** Once a pathway transitions to `status = "Live"`, structural fields (`milestones_v1`, courses, assessments) shall be immutable. Only descriptive metadata (descriptions, card image) may be updated.

### 2.6 Assumptions and Dependencies

- **DEP-01:** Course content curated into a pathway must be in `Live` status and publicly readable.
- **DEP-02:** Assessment questionsets referenced in pathways must be authored, validated, and published via the Questionset microservice.
- **DEP-03:** Batch cohort services (`/cohorts/course/getUsersForBatch/{id}`) must be operational to evaluate active user enrollment before permitting pathway deletion.
- **ASM-01:** Network connectivity is available during assessment submissions and progress sync to maintain accurate client state.

## 3. Specific System Requirements

### 3.1 External Interface Requirements

#### 3.1.1 User Interfaces (UI)

- **UI-01 [Creation Stepper]:** The Creation Portal shall display a horizontal 4-step wizard navigation bar indicating `Create Path` (Step 1), `Learning Structure` (Step 2), `Preview Path` (Step 3), and `Access Control` (Step 4). Direct jump navigation to Steps 2, 3, or 4 shall remain disabled until preceding steps satisfy validation.
- **UI-02 [Table of Contents (TOC) View]:** The learner web and mobile interfaces shall render the pathway TOC detailing the Pre-assessment, sequential milestones, nested courses (with "Mandatory" / "Optional" tags), milestone assessments, and visual lock icons (`Lock` vs. `Open`) reflecting calculated status.
- **UI-03 [Achievement Modal]:** Upon clearing a milestone assessment, the client UI shall render an interactive modal displaying the dynamic SVG milestone achievement certificate with direct download and social sharing actions.

#### 3.1.2 Software & API Interfaces (INT)

- **INT-01 [Content Creation API]:**
  - `POST /apis/proxies/v8/action/content/v3/create`
  - Payload: `{ request: { content: { name, description, purpose, appIcon, contentType: "Course", primaryCategory: "Course", courseCategory: "Learning Pathway" } } }`
  - Response: HTTP 200 with `{ result: { identifier, versionKey } }`.

- **INT-02 [Content Metadata & Milestone Update API]:**
  - `PATCH /apis/proxies/v8/action/content/v3/update/{id}`
  - Payload: Serialized metadata and the complete replacement array for `milestones_v1`.
  - Response: HTTP 200 with `{ result: { identifier, versionKey } }`.

- **INT-03 [Extended Content Read API]:**
  - `GET /apis/proxies/v8/extended/content/v1/read/{id}`
  - Purpose: Invokes `ExtendedContentActor.extendedRead()` to fan out reads across Neo4j and Cassandra, returning the complete resolved hierarchy including nested course objects and assessment schemas.
  - Caching: Caches aggregate response in Redis under `extended_read_content_{id}` with a TTL of 86,400 seconds.

- **INT-04 [Content Search API]:**
  - `POST /apis/proxies/v8/sunbirdigot/v4/search`
  - Filters: `{ request: { filters: { status: ["Live"], primaryCategory: ["Course"], visibility: ["Default"] } } }`
  - Purpose: Validates title uniqueness and retrieves live public courses for milestone curation.

- **INT-05 [Dynamic Achievement Generation API]:**
  - `POST /api/achievement/dynamic/v1/generate`
  - Purpose: Generates personalized SVG certificate payloads containing the learner's name, milestone title, completion date, and verification signature.

- **INT-06 [Active Cohort Verification API]:**
  - `GET /apis/protected/v8/cohorts/course/getUsersForBatch/{id}`
  - Purpose: Evaluates enrolled learner counts prior to executing a pathway retirement/deletion request.

- **INT-07 [Pathway Retirement API]:**
  - `GET /apis/proxies/v8/learningpathway/v1/retire/{id}`
  - Behavior: Transitions node status to `Retired` in Neo4j. *(Design deviation noted: HTTP GET used for destructive state change).*

### 3.2 System Functional Requirements

#### 3.2.1 Pathway Metadata Authoring (Step 1)

- **FR-META-001:** The Creation Portal shall permit only users authenticated with the `spv_publisher` role to access the Learning Pathway creation route (`/author/learning-path/create`).
- **FR-META-002:** The system shall enforce that `Pathway Title` is mandatory, contains between 10 and 70 characters, and permits only alphanumeric characters and the specific symbols: `.`, `-`, `_`, `$`, `/`, `:`, `[`, `]`, `!`.
- **FR-META-003:** Prior to allowing progression beyond Step 1, the Creation Portal shall invoke `POST .../sunbirdigot/v4/search` to verify that the entered `Pathway Title` is case-insensitively unique across all non-retired pathways.
- **FR-META-004:** The system shall enforce that `Description` is mandatory, accepts plain-text input, and contains between 250 and 1000 characters (excluding whitespace).
- **FR-META-005:** The system shall enforce that `Learning Outcome` is mandatory, accepts formatted text via CKEditor, and contains between 250 and 1000 plain-text characters (calculated after stripping all HTML markup).
- **FR-META-006:** The system shall enforce that `Card Image` (`appIcon`) is mandatory, accepts only JPEG, JPG, and PNG MIME types, and does not exceed 4 MB in file size.
- **FR-META-007:** Upon valid submission of Step 1, the system shall execute `POST .../action/content/v3/create` to instantiate the draft node in Neo4j and transition the wizard to Step 2.

#### 3.2.2 Pedagogical Curriculum & Milestone Structuring (Step 2)

- **FR-STRUCT-001:** The Creation Portal shall support the creation of a minimum of 1 and a maximum of 5 milestones per pathway.
- **FR-STRUCT-002:** The system shall disable the "Add Milestone" button once the milestone count reaches 5.
- **FR-STRUCT-003:** The Creation Portal shall support drag-and-drop reordering of milestones, updating each milestone's ordinal `index` attribute from 1 to .
- **FR-STRUCT-004:** For each milestone, the system shall require a mandatory `Milestone Name` (1 to 100 characters) and a mandatory `Milestone Description` (1 to 500 characters).
- **FR-STRUCT-005:** The system shall permit the author to curate courses into a milestone using a modal picker that queries live public courses via the Search API.
- **FR-STRUCT-006:** The system shall enforce that a course already selected in Milestone cannot be added to Milestone . Attempting to add a duplicate course shall display an inline error blocking selection.
- **FR-STRUCT-007:** The author shall be capable of toggling an added course as either `Mandatory` or `Optional`.
- **FR-STRUCT-008:** The system shall enforce that every milestone contains at least one course marked as `Mandatory`.
- **FR-STRUCT-009:** When the author saves milestone changes, the Creation Portal shall execute `PATCH .../action/content/v3/update/{id}`, replacing the entire `milestones_v1` metadata attribute with the updated JSON array.

#### 3.2.3 Assessment Configuration & Gating (Step 2)

- **FR-ASSESS-001:** The system shall require the configuration of exactly one `Pre-assessment` at the pathway root level.
- **FR-ASSESS-002:** The system shall persist the selected Pre-assessment identifier directly to the `preliminaryAssessment` property of the root content node via PATCH.
- **FR-ASSESS-003:** The system shall require the configuration of exactly one mandatory `Milestone Assessment` for each created milestone.
- **FR-ASSESS-004:** When moving from Step 2 to Step 3, the system shall execute `validateStepperTwo()`, verifying that referenced assessment questionsets exist in `Live` status and contain question. If invalid, navigation shall halt and errors shall display in a modal dialog.

#### 3.2.4 Read-Only Learner Preview (Step 3)

- **FR-PREV-001:** Step 3 shall render a simulated Table of Contents (TOC) replicating the learner consumption view by consuming data from `GET .../extended/content/v1/read/{id}`.
- **FR-PREV-002:** The preview interface shall display calculated cumulative durations, milestone hierarchies, course cards, and lock indicators in an immutable, read-only mode.
- **FR-PREV-003:** The "Start my journey" or "Enroll" call-to-action button shall be explicitly disabled during author preview.

#### 3.2.5 Enterprise Access Control Configuration (Step 4)

- **FR-ACC-001:** Step 4 shall integrate the `@sunbird-cb/access-settings` component, allowing the author to set pathway access to either `Public` or `Restricted`.
- **FR-ACC-002:** If `Restricted` access is selected, the system shall mandate the association of at least one target user group, MDO organization, or user role.
- **FR-ACC-003:** The "Publish" button shall remain disabled until access control settings are saved and confirmed (`accessSettingsEnabled = true`).
- **FR-ACC-004:** Upon author confirmation to publish, the system shall execute:
  - `POST .../questionset/v1/publish/{assessId}` for any draft assessments.
  - `POST .../action/content/v3/publish/{id}` for the pathway root node.

#### 3.2.6 Content Portal Lifecycle & Administration

- **FR-ADMIN-001:** The Content Portal dashboard (`/author/learning-path`) shall display separate tabs for `Live` and `Draft` pathways.
- **FR-ADMIN-002:** The dashboard shall provide search capability (triggered after characters), column sorting (by title, modified date), and server-side pagination with page sizes 10, 20, 30, and 50.
- **FR-ADMIN-003:** For pathways in `Live` status, the system shall permit edits only to `Description`, `Learning Outcome`, and `Card Image`. Structural modification of milestones, courses, and assessments shall be disabled.
- **FR-ADMIN-004:** Prior to permitting retirement or deletion of a live pathway, the dashboard shall invoke `GET .../cohorts/course/getUsersForBatch/{id}`.
- **FR-ADMIN-005:** If the active enrolled user count returned by the cohort service is , the system shall block deletion and display a modal stating that populated pathways cannot be retired.

#### 3.2.7 Learner Consumption, Table of Contents & Progress

- **FR-TOC-001:** When an authenticated learner navigates to an enrolled pathway, the client shall invoke `GET .../extended/content/v1/read/{id}` and `GET .../api/course/v5/content/state/read`.
- **FR-TOC-002:** The learner interface shall render an expandable milestone list displaying title, description, computed duration, and aggregated progress percentage.
- **FR-TOC-003:** Milestone progress percentage shall be computed strictly based on mandatory courses:
- **FR-TOC-004:** Optional courses shall display an "Optional" badge and shall not contribute to or block the calculated milestone completion percentage.

#### 3.2.8 Client-Side Milestone & Assessment Progression Engine

- **FR-PROG-001:** Upon initial enrollment, the client progression engine shall set `milestone[0].isLocked = true` if the Pre-assessment has not been completed.
- **FR-PROG-002:** Upon the learner achieving a passing score on the Pre-assessment, the client engine shall immediately set `milestone[0].isLocked = false`.
- **FR-PROG-003:** Within any unlocked milestone, the milestone assessment shall initially have `isAssessmentLocked = true`.
- **FR-PROG-004:** The client engine shall set `isAssessmentLocked = false` if and only if all mandatory courses in that milestone have achieved `completionPercentage = 100`.
- **FR-PROG-005:** For any milestone index , the client engine shall evaluate lock state as:<br><br>*(where status 2 indicates all mandatory courses completed AND milestone assessment passed).*
- **FR-PROG-006:** Progress state updates shall trigger reactive evaluation in the client UI without requiring a complete browser refresh or navigation reset.

#### 3.2.9 Achievement Credentialing & Certification

- **FR-CERT-001:** When a learner clears a milestone assessment, the client application shall trigger `POST /api/achievement/dynamic/v1/generate` to produce a dynamic milestone achievement SVG certificate.
- **FR-CERT-002:** The generated milestone achievement modal shall provide options to download the certificate asset and share the credential via system-supported channels.
- **FR-CERT-003:** Upon clearing the final milestone of the pathway (), the platform certificate service shall issue a canonical completion certificate and register the record within the learner's profile history.

#### 3.2.10 Q13 Gamification & Skill Badges Integration

- **FR-BADGE-001:** The system shall support associating pre-configured platform Skill Badges with a Learning Pathway during authoring.
- **FR-BADGE-002:** The completion criteria for pathway-linked Skill Badges shall be fixed to 100% full pathway completion; the criteria selection UI shall be permanently disabled/locked.
- **FR-BADGE-003:** When a learner achieves 100% completion across all milestones and assessments of a pathway, the Gamification Engine shall award the associated Skill Badge to the learner's Gamification profile.
- **FR-BADGE-004:** The SPV Publisher dashboard and Looker reporting feeds shall capture badge issuance metrics alongside pathway completion analytics.

### 3.3 Business Rules (BR)

| Rule ID | Statement / Description | Governing Context | Enforcement Point |
|---|---|---|---|
| **BR-001** | **Authoring Role Authorization:** Only users assigned the `spv_publisher` role are permitted to create, modify, publish, or retire Learning Pathways. | Authoring Access | Angular Route Guard (`learning-pathway.guard.ts`) |
| **BR-002** | **Mandatory Metadata Completeness:** A pathway cannot transition past Step 1 without valid Title, Description, Learning Outcome, and Card Image. | Step 1 Validation | Reactive FormArray Validators |
| **BR-003** | **Global Title Uniqueness:** No two pathways may share the same case-insensitive title across non-retired content records. | Step 1 Validation | Search Service Lookup (`/sunbirdigot/v4/search`) |
| **BR-004** | **Milestone Boundary Constraints:** A pathway must contain between 1 and 5 sequential milestones (). | Step 2 Structure | UI Button Disable & Stepper Validation |
| **BR-005** | **Mandatory Course Minimum:** Every milestone must contain at least one course designated as Mandatory (`isMandatory = true`). | Step 2 Structure | `validateStepperTwo()` Function |
| **BR-006** | **Global Course Deduplication:** A course cannot appear more than once within the same pathway across any milestone. | Step 2 Structure | Course Picker Client Filter |
| **BR-007** | **Course State Eligibility:** Courses added to a pathway must possess status `Live` and visibility `Default` (public). | Course Selection | Search Query Filter Payload |
| **BR-008** | **Single Assessment Constraint:** A milestone must link to exactly one mandatory assessment questionset. | Step 2 Structure | Stepper Validation Logic |
| **BR-009** | **Pre-Assessment Gate:** Milestone 1 remains locked until the root Pre-assessment is completed. | Consumption Engine | Client Progression Helper (`toc_helper.dart` / `viewer.component.ts`) |
| **BR-010** | **Milestone Assessment Gate:** A milestone assessment remains locked until all mandatory courses within that milestone are 100% complete. | Consumption Engine | Client Progression Helper |
| **BR-011** | **Sequential Progression Gate:** Milestone cannot be unlocked until Milestone achieves status 2 (all mandatory courses complete + assessment passed). | Consumption Engine | Client Progression Helper |
| **BR-012** | **Assessment Attempts & Cool-off:** Learners shall be limited to a maximum of 5 attempts per milestone assessment; exceeding 5 attempts shall trigger a 7-day cool-off period. *(Note: Traced as unimplemented in current codebase).* | Assessment Gating | `[TBD - Implementation Gap GAP-01]` |
| **BR-013** | **Access Confirmation Prerequisite:** A pathway cannot be published unless access control settings are explicitly saved and confirmed. | Step 4 Publishing | Publish Button Activation Guard |
| **BR-014** | **Live Structure Immutability:** Structural curriculum elements (milestones, courses, assessments) of a Live pathway cannot be modified or reordered. | Post-Publish Management | Dashboard UI Edit Restrictions |
| **BR-015** | **Active Enrollment Deletion Barrier:** A pathway with active enrolled learners () cannot be deleted or retired. | Lifecycle Operations | Delete Modal Guard (`/getUsersForBatch/{id}`) |
| **BR-016** | **Skill Badge Issuance Gate:** Skill Badges linked to pathways are awarded exclusively upon 100% completion of the entire pathway. | Gamification Subsystem | Badge Evaluation Engine |

### 3.4 Non-Functional Requirements (NFR)

#### 3.4.1 Performance & Capacity (NFR-PERF)

- **NFR-PERF-001 [API Latency]:** Under standard operating load, all pathway read APIs (`/extended/content/v1/read/{id}`) and update APIs shall respond within an average latency of **3 to 5 seconds** (per SRS §8.2).
- **NFR-PERF-002 [Concurrent User Support]:** The system architecture shall support up to **25,000 concurrent active users** distributed across browsing, TOC expansion, and course consumption workflows (SRS §8.2, §8.5).
- **NFR-PERF-003 [Cache Utilization]:** The `ExtendedContentActor` shall utilize Redis caching with a default Time-To-Live (TTL) of **86,400 seconds (24 hours)**. The cache hit ratio for enriched pathway reads shall exceed **90%** during peak hours `[TBD - Specific telemetry validation required]`.
- **NFR-PERF-004 [Cache Invalidation]:** Updates to a pathway's `milestones_v1`, `preliminaryAssessment`, or metadata shall synchronously evict the corresponding `extended_read_content_{id}` key from Redis.

#### 3.4.2 Availability & Reliability (NFR-REL)

- **NFR-REL-001 [Availability Target]:** The pathway services and web portals shall achieve a platform uptime of **99.5%** during scheduled business operations `[TBD - Target not formally stated in SRS; standard platform SLA applied]`.
- **NFR-REL-002 [Recovery Time Objective (RTO)]:** In the event of catastrophic failure, RTO for critical learning delivery and progress tracking shall not exceed **8 hours**; non-critical authoring services shall not exceed **48 hours** (SRS §8.4).
- **NFR-REL-003 [Data Loss Prevention]:** Draft authoring updates shall enforce optimistic locking via `versionKey` to prevent silent overwrites during concurrent administrative edits.

#### 3.4.3 Security & Access Integrity (NFR-SEC)

- **NFR-SEC-001 [RBAC Enforcement]:** All administrative authoring routes and APIs shall strictly authenticate the user's JWT bearer token and enforce the `spv_publisher` role.
- **NFR-SEC-002 [Input Sanitization]:** All rich-text content received from CKEditor (Learning Outcomes) shall be sanitized on the client and gateway layers to eliminate Cross-Site Scripting (XSS) vectors.
- **NFR-SEC-003 [Data Transport Security]:** 100% of network traffic between clients, API gateways, and backend actors shall be encrypted using TLS 1.2 or higher.

#### 3.4.4 Maintainability, Portability & Compatibility (NFR-COMP)

- **NFR-COMP-001 [Web Compatibility]:** The pathway authoring and learner web portals shall be fully functional across Mozilla Firefox 122+, Google Chrome 118+, and Microsoft Edge.
- **NFR-COMP-002 [Mobile Compatibility]:** The mobile TOC and achievement views shall execute natively across Android (API level 26 up to Android 13) and iOS (iOS 14 up to iOS 17).
- **NFR-COMP-003 [Telemetry Compliance]:** All user interactions (pathway enrollments, milestone unlocks, certificate downloads) shall dispatch Sunbird-compliant telemetry events (`INTERACT`, `ASSESS`, `PASS`) to the platform event pipeline.

### 3.5 Error Handling & Exceptional Scenarios (ERR)

- **ERR-001 [Duplicate Title Collision]:**
  - *Condition:* Author inputs a title that exists in Neo4j.
  - *System Response:* Creation Portal halts step advancement, focuses the title input, and renders an inline warning: `"A pathway with this title already exists. Please choose a unique title."`

- **ERR-002 [Invalid Assessment Structure]:**
  - *Condition:* Referenced questionset lacks questions or contains unweighted sections during Step 2 validation.
  - *System Response:* Wizard displays `ValidationErrorsDialogComponent` highlighting the defective questionset and blocks navigation to Step 3.

- **ERR-003 [Attempt to Retire Populated Pathway]:**
  - *Condition:* Author attempts to retire a Live pathway where enrolled user count .
  - *System Response:* System aborts retirement, prevents status update, and displays an alert indicating deletion is forbidden due to active learner enrollment.

- **ERR-004 [Eventual Consistency Index Lag]:**
  - *Condition:* Elasticsearch index delay causes recently published pathways to temporarily disappear from search.
  - *System Response:* The client UI introduces hardcoded synthetic delay buffers (4 seconds on publish, 5 seconds on retire) prior to initiating grid reload. *(Note: Documented technical debt item).*

- **ERR-005 [Certificate Service Communication Failure]:**
  - *Condition:* `POST /api/achievement/dynamic/v1/generate` returns HTTP 5xx or times out.
  - *System Response:* Mobile application captures exception, displays a non-blocking toast message (`"Unable to load achievement. Please check back later."`), and preserves the completed milestone state in local storage.

- **ERR-006 [Concurrent Authoring Conflict]:**
  - *Condition:* Multiple publishers attempt to update the same pathway simultaneously, resulting in a mismatched `versionKey`.
  - *System Response:* Knowledge Platform returns HTTP 400/409 Conflict. Client prompts author to reload latest server state.

## 4. Verification & Requirements Traceability Matrix (RTM)

### Verification Method Legend:

- **T (Test):** Verification through systematic execution of functional test procedures.
- **I (Inspection):** Verification through static inspection of code, schemas, or UI artifacts.
- **A (Analysis):** Verification through mathematical or logical evaluation of data and models.
- **D (Demonstration):** Verification through end-to-end operational walkthrough.

| Req ID | Requirement Summary | Source Doc | Jira Ticket | Verification Method | Implementation Status |
|---|---|---|---|---|---|
| **FR-META-001** | `spv_publisher` Role Access | Q10 BRD §6.1 | [KB-11953: Q10 \| Learning Pathways\| Creation of Learning Pathways](https://karmayogibharat.atlassian.net/browse/KB-11953) (Prod Deployed) | T / I | Confirmed by Code (`learning-pathway.guard.ts`) |
| **FR-META-002** | Title Validation (10–70 chars, regex) | FRS RQ-01 | [KB-11953: Q10 \| Learning Pathways\| Creation of Learning Pathways](https://karmayogibharat.atlassian.net/browse/KB-11953) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-META-003** | Title Uniqueness Check via Search | Q10 BRD §7.1 | [KB-11953: Q10 \|](https://karmayogibharat.atlassian.net/browse/KB-11953)[Learning Pathways\| Creation of Learning Pathways](https://karmayogibharat.atlassian.net/browse/KB-11953) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-META-004** | Description Length (250–1000 chars) | As-Built §1.1 | [KB-11953: Q10 \| Learning Pathways\| Creation of Learning Pathways](https://karmayogibharat.atlassian.net/browse/KB-11953) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-META-005** | Learning Outcome Plain-Text Count | As-Built §1.1 | [KB-11953: Q10 \| Learning Pathways\| Creation of Learning Pathways](https://karmayogibharat.atlassian.net/browse/KB-11953) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-META-006** | Card Image Upload & Size Limits | Q10 BRD §7.1 | [KB-11953: Q10 \| Learning Pathways\| Creation of Learning Pathways](https://karmayogibharat.atlassian.net/browse/KB-11953) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-META-007** | Root Content Node Creation API | SRS §5.1 | [KB-11953: Q10 \| Learning Pathways\| Creation of Learning Pathways](https://karmayogibharat.atlassian.net/browse/KB-11953) (Prod Deployed) | T / I | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-001** | Milestone Count Limits (1 to 5) | Q10 BRD §7.2 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-002** | Add Milestone Button Capping at 5 | SRS §3.3.2 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T / D | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-003** | Milestone Drag-and-Drop Reorder | FRS RQ-03 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod)[Deployed](https://karmayogibharat.atlassian.net/browse/KB-11954) | D | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-004** | Mandatory Milestone Name & Desc | FRS RQ-03 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-005** | Live Course Search Modal Picker | Q10 BRD §7.2 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T / D | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-006** | Cross-Milestone Course Deduplication | Q10 BRD §7.2 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-007** | Mandatory vs. Optional Course Toggle | FRS RQ-05 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | D | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-008** | Minimum 1 Mandatory Course per MS | FRS RQ-05 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-STRUCT-009** | `milestones_v1` Array Overwrite PATCH | LLD §2, §3 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T / I | Confirmed by As-Built Doc & Code |
| **FR-ASSESS-001** | Mandatory Root Pre-assessment | Q10 BRD §7.2 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-ASSESS-002** | Root PATCH for `preliminaryAssessment` | LLD §2 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | I | Confirmed by As-Built Doc & Code |
| **FR-ASSESS-003** | Mandatory Assessment per Milestone | Q10 BRD §7.2 | [KB-11954: Q10 \|](https://karmayogibharat.atlassian.net/browse/KB-11954)[Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-ASSESS-004** | Questionset Validation on Stepper 2 | As-Built §1.2 | [KB-11954: Q10 \| Learning Pathways \| Learning Structure](https://karmayogibharat.atlassian.net/browse/KB-11954) (Prod Deployed) | T / I | Confirmed by Code (`validateStepperTwo`) |
| **FR-PREV-001** | TOC Render via Extended Read API | HLD §2 | [KB-11955: Q10 \| Learning Pathways \| Preview Path](https://karmayogibharat.atlassian.net/browse/KB-11955) (Prod Deployed) | T / D | Confirmed by As-Built Doc & Code |
| **FR-PREV-002** | Read-Only Hierarchy Preview | FRS RQ-02 | [KB-11955: Q10 \| Learning Pathways \| Preview Path](https://karmayogibharat.atlassian.net/browse/KB-11955) (Prod Deployed) | D | Confirmed by As-Built Doc & Code |
| **FR-PREV-003** | Disabled CTA in Preview Mode | As-Built §1.3 | [KB-11955: Q10 \| Learning Pathways \| Preview Path](https://karmayogibharat.atlassian.net/browse/KB-11955) (Prod Deployed) | D | Confirmed by As-Built Doc & Code |
| **FR-ACC-001** | Public vs. Restricted Access Toggle | Q10 BRD §7.4 | [KB-11956: Q10 \| Learning Pathways \| Access Control](https://karmayogibharat.atlassian.net/browse/KB-11956) (Prod Deployed) | D | Confirmed by As-Built Doc & Code |
| **FR-ACC-002** | Mandatory Target Cohort Selection | SRS §5.4 | [KB-11956: Q10 \| Learning Pathways \| Access Control](https://karmayogibharat.atlassian.net/browse/KB-11956) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-ACC-003** | Publish Guard on Access Confirmation | As-Built §1.4 | [KB-11956: Q10 \| Learning Pathways \| Access Control](https://karmayogibharat.atlassian.net/browse/KB-11956) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-ACC-004** | Publish Sequence (Questionset + Node) | LLD §2 | [KB-11956: Q10 \| Learning Pathways \| Access](https://karmayogibharat.atlassian.net/browse/KB-11956) (Control)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-11956) | T / I | Confirmed by As-Built Doc & Code |
| **FR-ADMIN-001** | Tabbed Dashboard (Live / Draft) | Q10 BRD §7.6 | [KB-12111: Q10 \| Learning Pathways \| Content Portal](https://karmayogibharat.atlassian.net/browse/KB-12111) (Prod Deployed) | D | Confirmed by As-Built Doc & Code |
| **FR-ADMIN-002** | Dashboard Search, Sort, Pagination | FRS RQ-08 | [KB-12111: Q10 \| Learning Pathways \| Content Portal](https://karmayogibharat.atlassian.net/browse/KB-12111) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-ADMIN-003** | Immutability of Live Pathway Structure | SRS §5.5 | [KB-12111: Q10 \| Learning Pathways \| Content Portal](https://karmayogibharat.atlassian.net/browse/KB-12111) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-ADMIN-004** | Enrolled Learner Batch Check API | As-Built §1.5 | [KB-12111: Q10 \| Learning Pathways \| Content Portal](https://karmayogibharat.atlassian.net/browse/KB-12111) (Prod Deployed) | T / I | Confirmed by As-Built Doc & Code |
| **FR-ADMIN-005** | Deletion Block on Active Enrollments | As-Built §1.5 | [KB-12111: Q10 \| Learning Pathways \| Content Portal](https://karmayogibharat.atlassian.net/browse/KB-12111) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-TOC-001** | Learner TOC Data Orchestration | HLD §3b | [KB-12114: Q10 \| Learning Pathways \| Landing Page for the Learners](https://karmayogibharat.atlassian.net/browse/KB-12114) (Prod Deployed) | T / I | Confirmed by As-Built Doc & Code |
| **FR-TOC-002** | Expandable Milestone Accordions | FRS RQ-07 | [KB-12114: Q10 \| Learning Pathways \| Landing Page for the Learners](https://karmayogibharat.atlassian.net/browse/KB-12114) (Prod Deployed) | D | Confirmed by As-Built Doc & Code |
| **FR-TOC-003** | Mandatory-Only Progress Calculation | As-Built §1.6 | [KB-12115: Q10 \| Learning Pathways \| Learner Pathway Progression &](https://karmayogibharat.atlassian.net/browse/KB-12115) (Unlocking)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-12115) | A / T | Confirmed by Code (`toc_helper.dart`) |
| **FR-TOC-004** | Optional Course Tagging & Exemption | Q10 BRD §7.2 | [KB-12115: Q10 \| Learning Pathways \| Learner Pathway Progression & Unlocking](https://karmayogibharat.atlassian.net/browse/KB-12115) (Prod Deployed) | T / D | Confirmed by As-Built Doc & Code |
| **FR-PROG-001** | Initial Milestone 1 Lock Pending Pre-Ass | Q10 BRD §7.3 | [KB-12115: Q10 \| Learning Pathways \| Learner Pathway Progression & Unlocking](https://karmayogibharat.atlassian.net/browse/KB-12115) (Prod Deployed) | T | Confirmed by Code (`viewer.component.ts`) |
| **FR-PROG-002** | Milestone 1 Unlock upon Pre-Ass Clear | Q10 BRD §7.3 | [KB-12115: Q10 \| Learning Pathways \| Learner Pathway Progression & Unlocking](https://karmayogibharat.atlassian.net/browse/KB-12115) (Prod Deployed) | T | Confirmed by Code (`viewer.component.ts`) |
| **FR-PROG-003** | Initial Milestone Assessment Lock | FRS RQ-06 | [KB-12115: Q10 \| Learning Pathways \| Learner Pathway Progression & Unlocking](https://karmayogibharat.atlassian.net/browse/KB-12115) (Prod Deployed) | T | Confirmed by Code (`toc_helper.dart`) |
| **FR-PROG-004** | Assessment Unlock on Mandatory Done | FRS RQ-06 | [KB-12115: Q10 \| Learning Pathways \| Learner Pathway Progression & Unlocking](https://karmayogibharat.atlassian.net/browse/KB-12115) (Prod Deployed) | T | Confirmed by Code (`toc_helper.dart`) |
| **FR-PROG-005** | Sequential Milestone Unlock Gate | Q10 BRD §7.3 | [KB-12115: Q10 \| Learning Pathways \| Learner Pathway Progression & Unlocking](https://karmayogibharat.atlassian.net/browse/KB-12115) (Prod Deployed) | T | Confirmed by Code (`toc_helper.dart`) |
| **FR-PROG-006** | Reactive Client-Side State Transition | LLD §4 | [KB-12115: Q10 \| Learning Pathways \| Learner Pathway Progression & Unlocking](https://karmayogibharat.atlassian.net/browse/KB-12115) (Prod Deployed) | D | Confirmed by As-Built Doc & Code |
| **FR-CERT-001** | Milestone Dynamic SVG Cert Generation | Q10 BRD §7.8 | [KB-12117: Q10 \| Learning Pathways \| Learner Achievements and Certificate](https://karmayogibharat.atlassian.net/browse/KB-12117) (Prod Deployed) | T / I | Confirmed by Code (`/achievement/dynamic`) |
| **FR-CERT-002** | Achievement Modal Download & Share | FRS RQ-08 | [KB-12117: Q10 \| Learning Pathways \| Learner Achievements and Certificate](https://karmayogibharat.atlassian.net/browse/KB-12117) (Prod Deployed) | D | Confirmed by As-Built Doc & Code |
| **FR-CERT-003** | Final Pathway Master Certificate | Q10 BRD §7.8 | [KB-12117: Q10 \| Learning Pathways \| Learner Achievements and Certificate](https://karmayogibharat.atlassian.net/browse/KB-12117) (Prod Deployed) | T | Confirmed by As-Built Doc & Code |
| **FR-BADGE-001** | Q13 Skill Badge Attachment to Pathway | Q13 BRD BR-01 | [KB-15017: Q13 \| Skill Badges - Learner Pathways](https://karmayogibharat.atlassian.net/browse/KB-15017) (KB Review) | D | Confirmed by Jira / Product Releases |
| **FR-BADGE-002** | Fixed 100% Pathway Completion Criteria | Q13 BRD BR-02 | [KB-15017: Q13 \| Skill Badges - Learner Pathways](https://karmayogibharat.atlassian.net/browse/KB-15017) (KB Review) | T | Confirmed by Jira / Product Releases |
| **FR-BADGE-003** | Gamification Profile Badge Allocation | Q13 BRD BR-05 | [KB-15017: Q13 \| Skill Badges - Learner Pathways](https://karmayogibharat.atlassian.net/browse/KB-15017) (KB Review) | T | Confirmed by Jira / Product Releases |
| **FR-BADGE-004** | Looker & Dashboard Badge Metrics | Q13 BRD BR-07 | [KB-15017: Q13 \| Skill Badges - Learner Pathways](https://karmayogibharat.atlassian.net/browse/KB-15017) (KB Review) | T | Confirmed by Jira / Product Releases |
