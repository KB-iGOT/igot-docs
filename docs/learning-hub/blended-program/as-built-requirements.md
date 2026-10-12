# Blended Program — As-Built Requirements

Requirements reconstructed from the shipped implementation across 11 repos
at the commits listed in [index.md](index.md) — what the system does today,
not what was originally intended. Companion to the [HLD](hld.md),
[LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements or specification document for Blended Program was
available in any repo. The requirements below are **reconstructed from
code**: each one traces to the file and function that implements it. Where
a behaviour could only be inferred (for example, depends on the approval
JSON stored in the LMS `system_settings` table, which is in no repo), the
requirement is moved to the *Boundary* list at the end instead of being
asserted.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint or defect baked into the build — behaviour a reader
would not assume). Source shorthand: **WF** `sunbird-cb-workflow`
(`BPSI` = `BPWorkFlowServiceImpl`), **CS** `sunbird-course-service`,
**EXT** `sunbird-cb-ext`, **CP** `sunbird-cb-creationportal`, **TOC**
`sb-cb-ui-components › sb-cb-ui-toc`, **MOB** `igot_karmayogi_mobile`,
**KP** `knowledge-platform`, **DEV** `sunbird-devops`.

## Functional requirements

### Authoring

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The Creation Portal SHALL create a Blended Program through `POST action/content/v3/create` with `primaryCategory` and `courseCategory` both `"Blended Program"` and `cumulativeTracking: true`. | CP `create-course-popup.component.ts:503-538`; `editor.service.ts:319-399` |
| FR-002 | The system SHALL require, before a program is sent for review or published: name, thumbnail, description, learning outcome, keywords, competencies, reviewer, authors, license, `programDuration > 0`, `wfApprovalType`, knowledge level, target audiences, at least one learning resource, and at least one Program Coordinator. | CP `validate-content.service.ts:168-494` |
| FR-003 | The editor SHALL enforce that a Pre Assessment is the first item and a Final Assessment the last, and SHALL refuse a Module with no children. | CP `validate-content.service.ts:200-208`; `new-course.component.ts` `validateCheck` |
| FR-004 | The editor SHALL strip the children of every Course node from the hierarchy before saving a Blended Program. | CP `store.service.ts:977-1000` |
| FR-005 | The editor SHALL provide a *Session Template* (`primaryCategory "Offline Session"`, `mimeType "application/offline"`) with a name (≥ 10 chars), instructions, a `hh:mm` duration and a `contentUploadEnabled` toggle. | CP `resource-content.component.ts:99-132, 512, 684` |
| FR-006 | The editor SHALL store pre-requisites as `preEnrolmentResources[]` (`isMandatory`, `identifier`, `mimeType`, …) via `PATCH action/content/v3/update/:id`. | CP `basic-details.component.ts:2304-2341` |
| FR-007 | The editor SHALL expose program fields `programDuration`, `programDirectorName`, `programDirectoryDesignation`, `selfEnrollment` (`"Yes"`/`"No"`), `wfApprovalType` and `batchSettings`, and SHALL lock `wfApprovalType` once the program is Live. | CP `additional-details.component.ts:2242-2255, 663-667` |
| FR-008 | The editor SHALL allow at most 5 Program Coordinators, persisted after the content update through `PUT program/admin/coordinator/upsert/:doId` as a diff against the stored list. | CP `additional-details.component.ts:137`; `new-course.component.ts:3783-3850` |
| FR-009 | Publishing SHALL publish child resources first and then the parent; rejecting SHALL set each child back through `reject` with the reviewer's comment (default "Content Rejected"). | CP `new-course.component.ts:3056-3315` |
| FR-010 | A Live Blended Program SHALL be un-published through `DELETE v1/content/retire`; scheduled retirement SHALL be offered for `primaryCategory = "Course"` only. | CP `my-content.service.ts:285-300`; `contents.component.ts:1353-1356` |
| FR-011 | The content schemas SHALL list `"Blended Program"` in the `courseCategory` enum of the content, collection and questionset schemas; `primaryCategory` SHALL remain an unconstrained string. | KP `schemas/{content,collection,questionset}/1.0/schema.json` |

### Batches and sessions

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | A batch SHALL be created through `POST authApi/batch/create` (uiproxy → Kong `course/v1/batch/create`) with `enrollmentType "invite-only"`, `createdBy` the caller, `mentors` the caller, and optional top-level `coTrainers`. | CP `content-create-batch-bp.component.ts:754-880`; uiproxy `authoring/content/index.ts` |
| FR-021 | The batch form SHALL require name, size (integer 1–200, stored as a **string**), start date ≥ today, end date ≥ start, enrolment end date between today and the start date, and `latlong` plus address when attendance mode is *Enable QR* (the default). | CP `content-create-batch-bp.component.ts:188-366` |
| FR-022 | The course service SHALL, for a Blended Program batch, require `batchAttributes.currentBatchSize` to be present, a string and an integer ≥ 1, else `INVALID_FIELD_CURRENT_BATCH_SIZE`. | CS `CourseBatchManagementActor.java:146-153` |
| FR-023 | The course service SHALL set a new batch's status to `STARTED` if its start date is today (IST), otherwise `NOT_STARTED`, and SHALL NOT append a Blended Program batch to the program's `batches` array. | CS `CourseBatchManagementActor.java:175-177, 386-402` |
| FR-024 | A session card SHALL exist for every Session Template in the program and SHALL collect date (inside the batch dates), 24-hour start / end time, facilitators, handouts and links into `sessionDetails_v2[]`. | CP `content-create-session.component.ts:584-691` |
| FR-025 | After a batch is created the portal SHALL, in order: create the profile survey form (programs created on or after `pbPhaseTwo`), create the batch, add chosen co-trainers to the program, and attach the default certificate template. | CP `content-create-batch-bp.component.ts:437-732` |
| FR-026 | The course service SHALL authorise a batch update only for `createdBy` or a mentor, SHALL **merge** `batchAttributes` into the stored map, and SHALL restrict an expired batch to `instructorsUserId` / `instructors`. | CS `CourseBatchManagementActor.java:222-290, 1352-1385, 520-531` |
| FR-027 | The system SHALL allow deleting a batch only for Blended Programs and only before the start date, SHALL deactivate every enrolment in the batch and SHALL email the learners. | CS `CourseBatchManagementActor.java:901-976` |
| FR-028 | The Creation Portal SHALL gate batch screens with `BatchOwnerGuard`: creator; or `bp_program_trainer` who is a listed co-trainer (not on edit); or a user with the "Program Coordinator" role in the program's coordinator list. | CP `batch-owner.guard.ts:63-105` |
| FR-029 | The Creation Portal SHALL allow deleting a batch only while `today <= startDate` and the deleter's root org is in `createdFor`. | CP `content-batches.component.ts:607-615` |

### Learner enrolment — web (`@sunbird-cb/toc`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | For an unenrolled learner the page SHALL list the program's batches (status filter `["0","1","2"]`, `createdDate desc`) and SHALL hide any batch whose `enrollmentEndDate` (day granularity, inclusive) has passed or is absent. | TOC `app-toc-home-v2.component.ts:973-1090` |
| FR-041 | The page SHALL display seat state from `enrol/status/count`: *enrolled* = `APPROVED` count, *applied* = all statuses except `WITHDRAWN`; "Full" when `enrolled >= currentBatchSize` for the selected batch; "limited seats" from 80%. | TOC `app-toc-banner.component.ts:1036-1087`; `app-toc-home-v2.component.ts:1006-1019` |
| FR-042 | The request flow SHALL run, in order: client conflict check → profile form → program survey → confirmation → `enrol`. | TOC `app-toc-banner.component.ts:583-672` |
| FR-043 | The profile form SHALL open only if `userProfileFileds` is set and is not `"Available user filled iGOT profile"`, SHALL render `bpEnrolMandatoryProfileFields`, and SHALL submit to `forms/v2/saveFormSubmit` with `formId = profileSurveyId`, `version 4`, `contextId = program id`. | TOC `enroll-profile-form.component.ts`; `app-toc-banner.component.ts:539-578` |
| FR-044 | When `cadreList` is non-empty (profile-form branch) the page SHALL block enrolment unless the learner's `cadreDetails.civilServiceName` is in the list. | TOC `app-toc-banner.component.ts:539-556` |
| FR-045 | The page SHALL send `POST workflow/blendedprogram/enrol` with state and action `INITIATE`, `applicationId = batchId`, `serviceName "blendedprogram"`, and show the server's `errmsg` on failure. | TOC `app-toc-banner.component.ts:620-672` |
| FR-046 | The page SHALL offer *Withdraw* only while the request is pending, disabled once the first approver of a two-step route has acted; withdrawal SHALL post action `WITHDRAW` with the current state and `wfId`. | TOC `app-toc-banner.component.ts:105-119, 878-894` |
| FR-047 | The page SHALL show *Start* only for an `APPROVED` request in a batch in progress, and a countdown until the start date otherwise. | TOC `app-toc-home-v2.component.ts:307-335, 679-725` |
| FR-048 | The page SHALL list sessions from `sessionDetails_v2` sorted by date, and SHALL show attendance as marked iff the matching progress `completionStatus === 2`; it SHALL NOT offer an action to mark attendance. | TOC `app-toc-sessions-new.component.ts:30-55`; `attendance-card.component.html` |
| FR-049 | The Assignment tab SHALL show only for enrolled learners; upload SHALL accept PDF only, with an integer-MB check `> 5`; the preview's *Submit* SHALL post `assignment/v1/submit` then `notifyAssignment/submit`. | TOC `app-toc-batch-assignments`, `app-toc-assignment-viewerV2` |
| FR-050 | The page SHALL gate the request area behind mandatory pre-enrolment resources, and SHALL treat them as complete when the count of returned progress rows equals the count of resources. | TOC `app-toc-home-v2.component.ts:2028-2105` |
| FR-051 | The portal SHALL request `batchDetails=…batchAttributes` on the enrolment list so `sessionDetails_v2` reaches the client, and SHALL fetch enrolment details with `POST learner/course/v4/user/enrollment/details/{userId}`. | portal `widget-user.service.ts:19-25`; `app-enrollment-resolver.service.ts:96-110` |

### Learner enrolment — mobile

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-060 | The app SHALL list batches with `POST course/v1/batch/list`, remove batches whose enrolment window has passed (a date-only value ends at 23:59:59.999 local), and fetch per-batch counts only when the learner is not enrolled and pre-enrolment resources are complete. | MOB `course_toc_controller.dart:258-577` |
| FR-061 | The app SHALL choose the default batch as the one with the earliest enrolment deadline that has not passed. | MOB `toc_repository.dart:99-157` |
| FR-062 | The app SHALL treat a batch as full when `enrolledCount >= currentBatchSize` and warn from 80%. | MOB `enroll_blended_program_button.dart:755-775` |
| FR-063 | The app SHALL check `cadreList` against the profile's `civilServiceName` (normalised) whenever `cadreList` is non-empty and SHALL stop with an eligibility message on failure. | MOB `enroll_blended_program_button.dart:477-540` |
| FR-064 | The app SHALL show the pre-enrolment survey sheet in one of four shapes depending on the presence of `wfSurveyLink` and `bpEnrolMandatoryProfileFields`, and SHALL submit the profile survey with `formId = profileSurveyId` and `version 4`. | MOB `pre_enrollment_survey_form_bottomsheet.dart`; `survey_form_repository.dart:16-161` |
| FR-065 | The app SHALL request a seat with `POST workflow/blendedprogram/enrol` (same body as web) and withdraw with `…/unenrol` (action `WITHDRAW`, `wfId`, no reason), offered only in `SEND_FOR_MDO_APPROVAL` / `SEND_FOR_PC_APPROVAL`. | MOB `toc_api_service.dart:527-667` |
| FR-066 | When the program's `selfEnrollment` is true the app SHALL replace the batch picker with a QR scan that validates `courseId` and `batchId`, the enrolment end date, the seat state and, when `latlong` is set, a 1000 m radius, then `POST workflow/blendedprogram/qr/enrolments {courseId,batchId}`. | MOB `scan_to_enroll_blended_program.dart:112-150`; `enroll_blended_program_button.dart:822-916` |
| FR-067 | The app SHALL mark attendance only when the session is live (start → start + whole-hour duration + 1 h), the device is within 1000 m of `latlong`, and the scanned QR's `sessionId` and `batchId` match, by `PATCH course/v5/content/state/update` with `contentId = sessionId`, `status 2`, `completionPercentage 100`. | MOB `attendence_marker.dart:81-150`; `mark_attendence.dart`; `learn_service.dart:450-494` |
| FR-068 | The app SHALL show the Assignment tab when enrolled and the remote TOC config does not disable `blendedProgramAssignment`; upload SHALL be PDF only, 5 MB; draft = `PUT submitDraft`, submit = `POST submit` then `notifyAssignment/submit`. | MOB `course_toc_controller.dart:638-643`; `blended_program_assignment*.dart`; `toc_constants.dart:69` |

### Workflow service — rules

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-080 | A learner enrol SHALL validate state, application id, actor, user and `updateFieldValues` (HTTP 400 with the listed messages), run the volunteer gate (HTTP 406), the seat check (HTTP 400 "This batch is full"), the schedule check (HTTP 400), then insert a `wf_status` row at `ENROLL_IS_IN_PROGRESS` and publish to Kafka. | WF BPSI:95-137, 961-991, 1036-1058 |
| FR-081 | The request-time seat check SHALL allow `live requests < size + 20%` (`bp.batch.enrol.limit.buffer.size`), counting every status not in `bp.batch.full.validation.exclude.states`. | WF BPSI:302-322, 523-530 |
| FR-082 | The approval-time seat check SHALL use the count of active `enrollment_batch_lookup` rows against the size with no buffer; size 0 or absent SHALL read as full. | WF BPSI:302-322 |
| FR-083 | Every update action other than `REMOVE` SHALL run the schedule-conflict check, and on a hit SHALL rewrite the action to `REJECT`, set the configured reason, execute the transition and return HTTP 400. | WF BPSI:157-164 |
| FR-084 | Updates SHALL be refused after the batch's start date (IST, inclusive of the start day) unless the action is `REJECT` or `WITHDRAW`, with "This batch is already in progress". | WF BPSI:147-151, 378-413 |
| FR-085 | The first Kafka consumer hop SHALL read the program's `wfApprovalType`, load that route from the system settings and move the row to the state the named action leads to, setting `service_name` to the approval type. | WF BPSI:881-913 |
| FR-086 | When a row is `APPROVED` the service SHALL call the course service's Blended Program enrol (with `enrolled_date`) if state is `SEND_FOR_PC_APPROVAL` and serviceName is `blendedprogram`, otherwise the generic admin enrol; on failure of the Blended Program call it SHALL revert the row to `SEND_FOR_PC_APPROVAL`. | WF BPSI:197-241, 1939-1947 |
| FR-087 | When a row is `REMOVED` the service SHALL call `POST /v1/course/admin/unenroll`. | WF BPSI:847-874 |
| FR-088 | `POST nominate` SHALL derive the caller's role (PC / trainer, MDO, else HTTP 403), cap the list at 200 after dropping blanks, self and duplicates, apply the override matrix, validate start date, hard seat cap, existing enrolment and schedule clash, and write the row `APPROVED` directly. | WF BPSI:1617-1804, 1848-1930 |
| FR-089 | `POST qr/enrolments` SHALL require `selfEnrollment == "Yes"`, reject once the IST date is after the batch start date, reject duplicates and a second batch of the same course, apply the seat check, write `APPROVED` with `in_workflow=false`, and call the enrol synchronously. | WF `QrCodeSelfEnrolmentServiceImpl.java:52-155` |
| FR-090 | `POST admin/enrol` SHALL take a list and create `ADMIN_ENROLL_IS_IN_PROGRESS` rows with `isNominatedByMdo:true`. | WF BPSI:541-586 |
| FR-091 | `POST remove/approved/user` SHALL require an `APPROVED` row (exactly one) and run a `REMOVE` transition for the PC or MDO role named by header `isPc`. | WF BPSI:1513-1575 |
| FR-092 | The service SHALL export the pending queue as CSV and SHALL accept a bulk approve / reject CSV, validating all rows before applying any. | WF BPSI:1153-1424 |
| FR-093 | The service SHALL email learners and approvers when the state definition has `isNotificationEnable`, including the reject / conflict reason. | WF `NotificationServiceImpl.java`; `NotificationConsumer.java` |
| FR-094 | The service SHALL record `modification_history` only for `REMOVE`, `REJECT`, `APPROVE` and only when a user id is supplied. | WF `WorkflowServiceImpl.java:298-316` |

### Course service

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-100 | The single-user Blended Program enrol SHALL accept enrolment until the end of the batch start date (IST). | CS `ExtendedCourseEnrollmentActor.scala:1269-1411` |
| FR-101 | The enrol SHALL honour `lastEnrollmentDate`, mandatory `preEnrolmentResources` and, if `accessSettingsEnabled`, batch-keyed access rules. | CS `CourseEnrollmentRequestValidator.java:190-260` |
| FR-102 | On enrol the course service SHALL increment the Redis hash `bp:batch:enrollment:stats:{batchId}.approved`, never decrement it on un-enrol. | CS `ExtendedCourseEnrollmentActor.scala:55-58, 1949-1971` |
| FR-103 | Bulk enrol of a Blended Program SHALL reject the whole request when `active participants + requested > currentBatchSize` and SHALL return `BATCH_SIZE_NOT_DEFINED` when the size is not numeric. | CS `ExtendedCourseEnrollmentActor.scala:1415-1530` |
| FR-104 | The learner self-unenrol path SHALL allow only `Course` and `Moderated Course`. | CS `externalresource.properties:276` |
| FR-105 | The course service SHALL cache a program's learning-hours duration at `bp:{courseId}:{batchId}:duration` and recompute it on batch update. | CS `CourseBatchUtil.java:333-371` |

### Attendance, assignments, QR, coordinators

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-110 | `POST /content/progress/v1/ext/update` SHALL enqueue the body to Kafka and return HTTP 200 once queued (500 only if the push throws); the consumer SHALL `PATCH` the course service's admin content-state route and, on `OK`, email the learner ("ATTENDANCE MARKED"). | EXT `ContentProgressServiceImpl.java:64-84`; `UpdateContentProgressConsumer.java:74-230` |
| FR-111 | `POST /content/progress/v1/ext/attendance/update` SHALL map an external content id to the program, take the user's active batch and mark the **first** session present. | EXT `ContentProgressServiceImpl.java:231-360` |
| FR-112 | `POST /content/progress/v1/read/getUserDetails` SHALL return per-learner session statuses for given content ids (batchId, courseId, contentId mandatory). | EXT `ContentProgressServiceImpl.java:95-204` |
| FR-113 | The session QR PDF SHALL contain one page per `Offline` session with a QR of `{courseId, batchId, sessionId}`. | EXT `PdfGeneratorServiceImpl.java:394-460` |
| FR-114 | The self-enrolment QR SHALL be available only when the program's `selfEnrollment` is `"Yes"`, SHALL carry `{courseId, batchId, selfEnrol:true}` and SHALL set `selfEnrolQrGenerated` in `batch_attributes`. | EXT `PdfGeneratorServiceImpl.java:722-852` |
| FR-115 | The answer-file endpoint SHALL accept `pdf, doc, docx` up to 5000 KB and store under `bp-assignment/{contentId}/{batchId}/{formId}/{epoch}_{name}`. | EXT `StorageServiceImpl.java:817-893` |
| FR-116 | The Program Coordinator service SHALL store coordinators in Postgres, add / remove with `status` 1 / 0, require the caller to hold `PROGRAM_COORDINATOR`, and publish `COORDINATOR_LIST_SYNCED` to Kafka. | EXT `ProgramCoordinatorController`, `ProgramCoordinatorServiceImpl` |
| FR-117 | The sync consumer SHALL maintain ES `user_program_lookup_v1` documents `{userId, programIds[], updatedOn}`. | EXT `ProgramCoordinatorSyncService.java:95-103` |
| FR-118 | `POST /v4/bp/search` SHALL restrict results to the program ids in the caller's lookup document. | KP `SearchProcessor.java:1075-1114`; `ExtendedSearchController.scala:92-117` |
| FR-119 | Extended read of a program with `courseCategory "Blended Program"` SHALL add `totalApprovedCount`, `totalPendingCount`, `totalWithdrawnCount`, `totalRejectedCount` to each batch's attributes from Redis. | KP `ExtendedContentActor.scala:1910-1963` |

### Reporting

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-130 | v1 and v2 report generation SHALL validate the request and the caller's root org, write a tracking row, publish a Kafka event and return `IN-PROGRESS`; an existing `IN-PROGRESS` row SHALL short-circuit. | EXT `BPReportsServiceImpl.java:81-149`; `BPReportsServiceV2Impl.java:123-208` |
| FR-131 | v1 SHALL build an Excel report from `wf_status`, the user profile and survey answers; v2 SHALL add certificate status, program / org / instructor data and 44 columns, with no session, attendance or progress columns. | EXT `BPReportConsumer.java`; `BPReportsServiceV2Impl.java:397-1062` |
| FR-132 | The nightly job SHALL emit `BlendedProgramReport.csv` per MDO and CBP provider and the `bp_enrolments` warehouse table, reporting attendance when the component status is `2`. | `cb-core-data › jobs/stage-2/blendedReport.py` |

### Gateway

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-141 | Kong SHALL route `/workflow/blendedprogram/*` to `workflow-handler-service:5099/v1/blendedprogram/workflow/*` and `/blendedprogram/*`, `/batchsesion/*`, `/bp/*`, `/storage/v1/bp/*` to `sb-cb-ext-service:7001`. | DEV `kong-api/defaults/main.yml` |
| FR-142 | The uiproxy SHALL route `/action/*` to `knowledge-mw-service`, not Kong. | uiproxy `proxies_v8.ts:538-540` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | Enrolment and reports SHALL be asynchronous (Kafka); the client receives success before the first state hop or before a report exists. | WF BPSI:135; EXT `BPReportConsumer.java` |
| NFR-002 | Kafka messages SHALL be fire-and-forget with no retry or dead-letter handling in code. | WF `Producer`; consumers |
| NFR-004 | Status counts SHALL be cached locally for ≈ 1.8 s (unit defect) keyed by the first application id; extended read SHALL be cached in Redis for 86400 s with batch counters added after the cache write. | WF `LRUCache.java:28,46`; KP `ExtendedContentActor.scala:60,1343-1380` |
| NFR-005 | Report builds SHALL page Postgres at 100 rows and Cassandra / ES in chunks of 100. | EXT `application.properties:693-698` |
| NFR-006 | Date comparisons SHALL use `Asia/Kolkata`. | WF `application.properties` (`sunbird_time_zone`) |
| NFR-007 | Pagination of workflow lists SHALL default to limit 20, max 50, offset 0. | WF `application.properties:24-26` |

## Constraints and defects baked into the build

| ID | Constraint / defect | Source |
|---|---|---|
| CON-001 | The approval state machine and its role lists are not in code; they are LMS `system_settings` rows. | WF BPSI:921-951; `WorkflowServiceImpl.java:445-456` |
| CON-002 | `currentBatchSize` must be a string in `batch_attributes`; a JSON number makes the batch read as full. | WF BPSI:261-282 |
| CON-003 | The web conflict check iterates only the current program's enrolments and can never fire across programs; the server check is inclusive-endpoint based and misses an enclosing batch. | TOC `app-toc-banner.component.ts:587-601`; WF BPSI:838 |
| CON-004 | The server's conflict check runs on approve and withdraw and converts the action into `REJECT`. | WF BPSI:157-164 |
| CON-005 | Nominated and QR-enrolled rows bypass the approval route; a PC nomination can set an earlier row `WITHDRAWN` before later checks fail. | WF BPSI:1657-1804 |
| CON-006 | A `WITHDRAWN` or `REJECTED` row never un-enrols; only `REMOVED` does. | WF BPSI:351-375, 847-874 |
| CON-007 | `/remove/pc` and `/remove/mdo` likely throw (`ClassCastException`); `/remove/approved/user` is blocked once the batch starts or is full. | WF BPSI:647, 383 |
| CON-009 | The 7-day post-batch attendance rule is a Creation Portal button rule; mobile adds a live window and a 1000 m fence. | EXT `ContentProgressServiceImpl.java:64-84`; CP `content-sessions.component.ts:79-90` |
| CON-010 | A batch without `latlong` cannot mark attendance on mobile. | MOB `attendence_marker.dart:81-150` |
| CON-011 | The session QR's `courseId` holds the program name. | EXT `PdfGeneratorServiceImpl.java:445` |
| CON-012 | The v2 report loses the last page for batches with more than 100 rows and carries no attendance. | EXT `BPReportsServiceV2Impl.java:471-486` |
| CON-014 | The program-coordinator service refuses to start without a "Program Coordinator" role row that the shipped DDL does not seed. | EXT `ProgramCoordinatorServiceImpl`; `application.properties:733` |
| CON-016 | Kong routes `…/workflow/blendedprogram/update` and `/remove`, and the Creation Portal's `/v1/blendedprogram/workflow/update`, have no matching controller. | DEV `main.yml:10312,10330`; CP `content-batch.service.ts:15` |
| CON-017 | The web Withdraw is unavailable after `APPROVED`; mobile has none either; no withdraw reason is captured. | TOC `app-toc-banner.component.html`; MOB `withdraw_request_button.dart` |
| CON-018 | Profile-survey submission hard-codes `version 4` and uses the program id as the context; the batch id is not on the submission. | TOC `enroll-profile-form.component.ts:1437`; MOB `survey_form_repository.dart:141-142` |
| CON-019 | Custom profile fields, cadre list and automatic survey creation work only for programs created on or after `pbPhaseTwo`. | CP `content-create-batch-bp.component.ts:396-405` |
| CON-020 | `bp.batch.full.validation.exclude.states` differs between the repo default and the devops env (`REMOVE`). | WF `application.properties:104`; DEV `workflow-handler-service-env.j2:92` |

## Boundary — not verifiable from the attached repos

- The stored approval JSON: states, transitions, `isNotificationEnable`, who
  may perform which action, and whether `WITHDRAW` is permitted from
  `APPROVED`, `REJECTED` or `REMOVED`.
- Which `serviceName` and state the portal sends on a PC approve (it decides
  the enrol endpoint and the start-date branch).
- Completion roll-up ("online and offline") and certificate issuance.
- The forms / assignment service, `cb-ext-course-service`, `sb-cb-ext-service`,
  `sunbird-content-service`, `@sunbird-cb/micro-surveys`.
- Postgres and Cassandra DDL for the workflow and report tables.
- The deployed uiproxy and `knowledge-mw-service` commits.
- Message texts held in `formsConfig` / `feature/toc.json`.
- Whether a MDO-side console exists outside the attached UI repos.

> **Verification boundary:** this document is reconstructed from the repos
> named in [index.md](index.md). No specification, ticket or acceptance
> test was available; "SHALL" statements describe observed behaviour, not
> agreed intent. Defects (`CON-xxx`) are code-read and were not executed.
