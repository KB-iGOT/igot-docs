# 1. Course (General Platform Course Creation & Management)

Standard, self-paced digital learning collections discoverable across the open platform catalog by any authenticated civil servant.

- **UC-1.1 · Create & Publish Course**
  - **Actor:** Content Creator / SPV Publisher
  - **Flow:** Creator authors course units, modules, and learning resources (video, PDF, audio, SCORM) in the Content Creator Portal (CBP). The course category defaults to `"Course"`, with Access Settings set to `"All Users"`. Upon review and approval, the content is published with `status = "Live"`, and the Flink post-publish processor triggers automatic creation of an open batch (`enrollmentType = "open"`).

- **UC-1.2 · Discover Course**
  - **Actor:** Learner (Civil Servant)
  - **Flow:** Learner searches the platform catalog, browses competency hubs, or views curated carousels. Elasticsearch indexes match keyword, competency, or topic queries and surface the course with metadata, description, duration, and provider details.

- **UC-1.3 · Enrol in Course**
  - **Actor:** Learner
  - **Flow:** Learner navigates to the Course Table of Contents (TOC) page and clicks **"Enrol"**. LMS Course Service validates active open batches and records an enrollment entry in Cassandra (`sunbird_courses.user_enrolments` with `status: 1` [In-Progress]).

- **UC-1.4 · Consume Course Content**
  - **Actor:** Enrolled Learner
  - **Flow:** Learner accesses video, document, or HTML5 assets. As units are played or read, the client player fires consumption telemetry (`INTERACT`, `HEARTBEAT`). Progress syncs via `PATCH /course/v1/content/state/update`, updating unit status and aggregate course completion percentage.

- **UC-1.5 · Take Course Assessment**
  - **Actor:** Enrolled Learner
  - **Flow:** Learner opens the embedded end-of-course assessment or module quizzes. The CQF assessment runner presents questions, records responses, calculates score against the configured pass threshold, and writes evaluation status to the attempt store.

- **UC-1.6 · Complete & Receive Certificate**
  - **Actor:** Enrolled Learner / Platform Certificate Service
  - **Flow:** Upon reaching 100% content consumption and satisfying assessment pass criteria, the LMS Course Service marks the course enrollment as `status: 2` (Completed). If a certificate template is configured, the certificate engine generates a cryptographically verifiable QR-coded digital certificate, accessible under the user profile.

- **UC-1.7 · Track Course Progress & Analytics**
  - **Actor:** MDO Admin / Platform Manager
  - **Flow:** Administrators access platform dashboards to monitor total enrollments, active in-progress learners, drop-off rates, and completion numbers broken down by ministry, department, and cadre.

### Comparative Summary Matrix

| Lifecycle Stage | Course (General) | Multilingual Course | Moderated Course | Invite-Only Course / Batch |
|---|---|---|---|---|
| **Creation & Ingestion** | Open metadata; auto-batch enabled via Flink | Localized units/transcripts linked to language group | Rubrics, reviewer roles, and milestone criteria configured | "Custom Users" selected; Flink auto-batch suppressed |
| **Discovery** | Public search & catalog recommendation | Filtered or boosted by learner's preferred language | Discoverable in catalog with "Application Required" tag | Excluded from public search; surfaced only in invited feed |
| **Access & Enrollment** | Immediate self-enrollment | Immediate self-enrollment with language selection | Pre-approval required or open with gated milestones | Restricted to whitelisted UUIDs in `participantlist` |
| **Consumption & Runner** | Standard self-paced media streaming | Dynamic audio/subtitle switching inside player | Subjective project uploads & artifact attachments | Single-sitting timed exam; 3X shuffle; negative marking |
| **Evaluation Gate** | Objective automated quizzes | Localized objective quizzes | Manual grading by assigned assessor/moderator | Automated scoring with negative penalty calculation |
| **Direct Link Security** | Open to all authenticated users | Open to all authenticated users | Prompts user to apply if not approved | Route guard blocks uninvited users with HTTP 403 modal |
