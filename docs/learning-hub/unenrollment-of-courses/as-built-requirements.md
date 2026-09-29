# Unenrollment of Courses — As-Built Requirements

Requirements reconstructed from the shipped implementation across 7 repos
(branches/commits listed in [index.md](index.md)) — what the system does
today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for unenrollment was available in
any of the 7 repos. This document reconstructs requirements **from the
shipped implementation** across the enrolment/business-rule layer
(`sunbird-course-service`), the two front-end clients
(`igot_karmayogi_mobile`, `sunbird-cb-portal`), the BFF proxy
(`sunbird-cb-uiproxy`), the reporting pipeline (`cb-core-data`), and the
notification services (`cb-notification-service`,
`cb-notification-wrapper`). Each requirement traces to file(s)/function(s)
that implement it.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Backend business rules

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL support unenrolling a learner from a course via `POST /v1/course/unenroll`, resolving the acting user id from the auth context (`REQUESTED_FOR` or `REQUESTED_BY`) rather than trusting a body field. | `CourseEnrollmentController.unenrollCourse:124-143` |
| FR-002 | The system SHALL also support an admin-initiated variant via `POST /v1/course/admin/unenroll`, which reads `userId` directly from the request body and skips the `validateRequestedBy` check. | `CourseEnrollmentController.adminUnenrollCourse:216-230` |
| FR-003 | The system SHALL reject an unenroll request missing `courseId`/`collectionId`, `batchId`, or `userId` with `mandatoryParamsMissing`, applying identical validation to enroll and unenroll (no unenroll-specific field rules exist). | `CourseEnrollmentRequestValidator.commonValidations:28-41` |
| FR-004 | The system SHALL reject unenroll when the referenced batch does not exist (`invalidCourseBatchId`), when the batch's `enrollmentType` is neither `open` nor `invite-only` (`enrollmentTypeValidation`), or when the batch is completed or past its end date (`courseBatchAlreadyCompleted`). | `CourseEnrolmentActor.validateEnrolment:306-322` |
| FR-005 | The system SHALL reject unenroll when the learner has no active enrolment record (`userNotEnrolledCourse`), covering both "never enrolled" and "already unenrolled" cases with one error. | `CourseEnrolmentActor.validateEnrolment:306-322` (the `!isEnrol && (enrolmentData==null \|\| !enrolmentData.isActive)` branch) |
| FR-006 | The system SHALL reject unenroll once the learner's own course-completion status is `COMPLETED` (status value 2), reusing the same `courseBatchAlreadyCompleted` error as the batch-ended case. | `CourseEnrolmentActor.validateEnrolment:306-322`; confirmed by `CourseEnrolmentTest.scala:139-149` |
| FR-007 | The system SHALL recompute the learner's course-completion status live (via a content/leaf-node search) immediately before running the precondition chain, rather than trusting the last persisted status. | `CourseEnrolmentActor.getUpdatedStatus:510-518`, called from `unEnroll:132-155` |
| FR-008 | The system SHALL require a content-access check (`ContentUtil.getContentRead`) to pass before writing the unenroll, rejecting with `accessDeniedToEnrolOrUnenrolCourse` otherwise. | `CourseEnrolmentActor.unEnroll:132-155` |
| FR-009 | On a successful unenroll, the system SHALL set `active=false` on the learner's `user_enrolments` row and on their `enrollment_batch_lookup` row, as an UPDATE (never an INSERT), and SHALL NOT modify any other field (status, progress, completedOn). | `CourseEnrolmentActor.unEnroll`/`upsertEnrollment:132-155,324-348`; `UserCoursesDao.updateV2`; `BatchUserDaoImpl.updateBatchLookupRecord:91-102` |
| FR-010 | The system SHALL invalidate the learner's Redis enrolment-list cache key on successful unenroll. | `CourseEnrolmentActor.unEnroll:132-155` (`cacheUtil.delete(getCacheKey(userId))`) |
| FR-011 | The system SHALL emit a telemetry AUDIT event on successful unenroll, correlated to the course (`correlation="unenrol"`) and the batch. | `CourseEnrolmentActor.generateTelemetryAudit:389-401` |
| FR-012 | The system SHALL support unenrolling from a standalone "event" content type via the identical `unenrollCourse` handler, routed at `POST /v1/event/unenroll`. | `service/conf/routes:94` |
| FR-013 | The system SHALL support unenrolling from an `EventSet`'s child events via `POST /v1/eventset/unenroll`, resolving each child event id and applying the same precondition chain individually per child, EXCEPT that the enrollment-type check only blocks `invite-only` (not requiring exactly `open`/`invite-only`). | `EventSetEnrolmentActor.unEnroll:83-106`, `validateEnrolment:108-123` |
| FR-014 | `EventSet` unenroll SHALL update only the `user_enrolments` row per child event and SHALL NOT update any `enrollment_batch_lookup` row, unlike course unenroll. | `EventSetEnrolmentActor.upsertEnrollment:125-131` (no `batchUserDao` call present) |
| FR-015 | The system SHALL support a CSV-driven bulk-unenrollment upload via `POST /v1/batch/bulk/unenrollment`. | `service/conf/routes:30`, `BulkUploadController.batchUnEnrollmentBulkUpload` |

### Notifications

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | On successful unenroll, the system SHALL conditionally send an email notification to the learner, gated by the `SUNBIRD_COURSE_BATCH_NOTIFICATIONS_ENABLED` property, using template `OPEN_BATCH_LEARNER_UNENROL` / subject `UNENROLL_FROM_COURSE_BATCH`. | `CourseEnrolmentActor.notifyUser:377-387`; `CourseBatchNotificationActor.courseBatchNotification:64-131` |
| FR-021 | A separate notification taxonomy SHALL define an in-app "unenrolled" notification subcategory (`CONTENT_UN_ENROLLED`) with a rendered message template (`"You have successfully unenrolled from '{courseName}'."`), triggerable via `POST /notifications/create` and delivered through Kafka topic `dev.user.notification` to an in-app Cassandra row. | `cb-notification-wrapper NotificationSubCategory.java:47`; `NotificationController.java`; `cb-notification-service Consumer.java`+`NotificationServiceImpl.bulkCreateNotifications` |

### Mobile client

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The mobile app SHALL offer an unenroll action only for content whose `courseCategory` is exactly `"course"`, only while actively enrolled, not completed, not featured, not in player mode, and only when the remote-config flag `showMenuIcon` is true. | `toc_appbar_widget.dart._buildActions:105-160` |
| FR-031 | Selecting unenroll SHALL first present a confirmation bottom sheet stating the impact (removal from My Learning, possible Karma Point deduction, updated Reports/Org Dashboard), requiring a checkbox to be checked before "Continue" is enabled. | `unenroll_confirmation_bottom_sheet.dart` |
| FR-032 | Confirming SHALL present a mandatory reason-selection bottom sheet (5 fixed multi-select reasons) plus an optional ≤500-character comment; the submit action SHALL remain disabled until at least one reason is selected. | `unenroll_feedback_bottom_sheet.dart:39-45,157-170` |
| FR-033 | The mobile app SHALL call `POST /api/course/v2/unenroll` with `courseId`, `batchId`, the selected `reasons`, and the `comments` text, as one combined request. | `toc_api_service.dart:797-817`; `api_endpoints.dart:204` |
| FR-034 | On a successful unenroll response, the mobile app SHALL fire a telemetry INTERACT event (`subType="unenroll"`, `pageIdentifier` naming the course) and refresh local enrolment/progress state by re-fetching enrolment info; it SHALL NOT navigate away from the current page. | `course_toc_page.dart._onUnenrollConfirmed:339-368` |
| FR-035 | On a failed unenroll response, the mobile app SHALL display the backend's error message (or a generic failure string) via a toast-style messenger, with no retry action offered. | `toc_repository.dart.unenrollCourse:213-235`; `course_toc_page.dart:359-362` |
| FR-036 | The mobile app SHALL support a structurally separate "withdraw" action for a blended program's still-pending enrolment request, offered only while the workflow status is `SEND_FOR_MDO_APPROVAL` or `SEND_FOR_PC_APPROVAL`, via a plain confirmation dialog (no reason capture, no telemetry) calling `POST /api/workflow/blendedprogram/unenrol`. | `enroll_blended_program_button.dart:260-304`; `api_endpoints.dart:104-105` |

### Web client

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The web portal SHALL NOT offer any unenroll action for a plain course — no such UI, service method, or endpoint call exists anywhere in `sunbird-cb-portal`. | Confirmed absent by exhaustive case-insensitive repo grep |
| FR-041 | The web portal SHALL offer a "Withdraw" action only for a blended program whose enrolment workflow has been initiated and whose current status is none of `REJECTED`/`REMOVED`/`WITHDRAWN`/`APPROVED`, calling `POST apis/proxies/v8/workflow/blendedprogram/unenrol`. | `app-toc-banner.component.ts:417-436`; template gate at `app-toc-banner.component.html:106-109` |
| FR-042 | The web "Withdraw" button SHALL be disabled (though still visible) while the request sits at the *other* approver's stage in a two-step MDO↔PC approval chain. | `app-toc-banner.component.ts.disableWithdrawnBtn:780-796` |
| FR-043 | On a successful web withdraw, the portal SHALL update only its own local workflow-status object and show a success toast; it SHALL NOT trigger any parent-page refetch (the parent only refetches on the mirror `INITIATE` action) and SHALL NOT navigate away. | `app-toc-banner.component.ts:554-568`; `app-toc-home.component.ts:1745-1749` |

### BFF proxy

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-050 | The uiproxy SHALL whitelist `POST /proxies/v8/workflow/blendedprogram/unenrol` for any authenticated session holding the `PUBLIC` role, with no elevated permission required, and forward it via the generic `/workflow/*` wildcard proxy to `{KONG_API_BASE}/workflow/blendedprogram/unenrol`. | `whitelistApis.ts:2467-2474`; `proxies_v8.ts:642-644` |
| FR-051 | The uiproxy SHALL expose an admin batch-removal endpoint constant pointing at `{KONG_API_BASE}/course/v1/admin/unenrol`, used by an admin batch-management handler. | `src/authoring/content/index.ts:30,294` |

### Reporting

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-060 | The data pipeline SHALL produce a per-MDO CSV report (`UnenrollmentReport.csv`) of every unenroll event, by inner-joining currently-enrolled-flagged rows against the `UNENROLL`-filtered `enrollment_history_by_action` audit table, carrying unenroll reason/comment/date/actor columns through to output. | `cb-core-data jobs/stage-2/unenrollmentReport.py:83-107,153,185-236` |
| FR-061 | The pipeline SHALL also write a warehouse Parquet table `unenrolled_user_audit` from the same job. | `unenrollmentReport.py:298-309`; `jobs/default_config.py:69` |
| FR-062 | The pipeline's `userEnrolment.py` job SHALL separately derive an `is_enrolled`/`enrolment_status` column per row from the completion-status field (null/`not-enrolled` ⇒ unenrolled) via a LEFT join to the deduplicated unenrolment audit, keeping both enrolled and unenrolled rows in one output — a different selection strategy from `unenrollmentReport.py`'s INNER join. | `jobs/stage-2/userEnrolment.py:84-94,237,387-391,437` |
| FR-063 | The canonical enrolled/unenrolled flag used elsewhere in the pipeline SHALL be derived directly from the Cassandra `user_enrolments_v2` table's `active` boolean column. | `dfutil/enrolment/enrolmentDFUtil.py:68-77` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | Unenroll validation at the controller layer SHALL be identical to enroll validation — no additional required fields, formats, or unenroll-specific request schema. | `CourseEnrollmentRequestValidator.validateUnenrollCourse:24-26` |
| NFR-002 | The `/proxies/v8/workflow/blendedprogram/unenrol` uiproxy route SHALL require only session authentication plus the baseline `PUBLIC` role — no MDO/admin-tier permission is enforced at the gateway for this action. | `whitelistApis.ts:2467-2474` |
| NFR-003 | The mobile blended-program withdraw path (`requestUnenroll`) SHALL swallow its own exceptions and return `null` on failure, with no error surfaced to the UI. | `toc_api_service.dart:658-663` |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | No `ActorOperations` enum entry exists for unenroll — the operation is passed as the raw string `"unenrol"` end to end. | Any future refactor of `ActorOperations` risks silently breaking unenroll routing if this string isn't included. | `CourseEnrollmentController.java:126`; `CourseEnrolmentActor.scala:87`; absent from `ActorOperations.java` |
| CON-002 | Nothing in the traced unenroll path touches a karma-points table, event, or service, despite mobile's confirmation-sheet copy stating Karma Points "may be deducted." | The mobile-displayed impact statement may overstate what actually happens server-side. | Confirmed absent by grep across `CourseEnrolmentActor.scala`/`EventSetEnrolmentActor.scala` |
| CON-003 | No certificate-issued check exists anywhere in the unenroll precondition chain — only course-completion status is checked. | A learner blocked from unenrolling by "already completed" may never have received a certificate at all; the two concepts aren't linked in code. | `CourseEnrolmentActor.validateEnrolment:306-322` |
| CON-004 | `unenrollmentReport.py` is not imported or invoked from `jobs/main.py`, unlike its sibling `userEnrolment.py`. | The MDO unenrollment CSV report's production schedule/execution cannot be confirmed from this repo alone. | `cb-core-data jobs/main.py` (job not present); contrast with `userEnrolment.py` wiring |
| CON-005 | `enrolmentDFUtil.py` contains dead code referencing a constant (`ENROLMENT_UNENROLLED_PARQUET_FILE`) that is not defined anywhere in `ParquetFileConstants.py`. | Any attempt to un-comment that code path would fail immediately with a `NameError`/import error. | `dfutil/enrolment/enrolmentDFUtil.py:108-111`; absent from `constants/ParquetFileConstants.py` |
| CON-006 | The `NotificationSubCategory.CONTENT_UN_ENROLLED`/`CONTENT_RE_ENROLLED` values and their message templates exist in both notification repos but have zero callers anywhere across all ten repos scoped for this feature. | The in-app unenroll notification is entirely inert — wiring it up would require adding a new caller from `sunbird-course-service`, which does not exist today. | Confirmed absent by cross-repo grep for `CONTENT_UN_ENROLLED`/`notifications/create` |
| CON-007 | `cb-notification-service`'s own `NotificationType` enum supports only `IN_APP`, while `cb-notification-wrapper`'s equivalent enum also models `SMS`/`EMAIL`/`PUSH`. | Even if the in-app unenroll notification were wired up and a caller requested SMS/EMAIL/PUSH, the consuming service could only ever persist an in-app row — no other channel is implemented end-to-end. | `cb-notification-service NotificationType.java` vs. `cb-notification-wrapper NotificationType.java` |
| CON-008 | Web has no plain-course unenroll UI; the only unenroll-labelled web action is the blended-program workflow withdrawal, a structurally different feature calling a different (external, untraced) backend. | Any product requirement assuming feature parity between mobile and web for course unenrollment is not met by the current build. | Confirmed absent by exhaustive `sunbird-cb-portal` grep |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | `enroll()` emits a Kafka instruction event to `kafka_user_enrolment_event_topic`; `unEnroll()` in the same actor does not, with no comment explaining the asymmetry. | Sits underneath FR-009 | `CourseEnrolmentActor.scala` enroll block (~117-126) vs. `unEnroll` (132-155) |
| DEV-002 | Both "batch already ended" and "learner already completed the course" return the identical `courseBatchAlreadyCompleted` error code/message — a caller cannot distinguish the two failure reasons programmatically. | Sits underneath FR-004/FR-006 | `CourseEnrolmentActor.validateEnrolment:306-322` |
| DEV-003 | Mobile sends `reasons`/`comments` fields on every unenroll call, but no field of that name appears anywhere in the backend's request validator or actor logic — the fields are not confirmed to be persisted, read, or even acknowledged server-side. | Sits underneath FR-033 | `toc_api_service.dart:797-817` vs. `CourseEnrollmentRequestValidator.java`, `CourseEnrolmentActor.scala` |
| DEV-004 | `cb-notification-wrapper`'s `isOrgSearchRequired` EnumSet includes `CONTENT_UN_ENROLLED`/`CONTENT_RE_ENROLLED` alongside genuinely broadcast-style categories (e.g. `EXTERNAL_TRAINING`) — org/role broadcast search doesn't semantically fit a single learner's individual unenroll notification, suggesting copy-paste inclusion rather than deliberate design. | Sits underneath FR-021 | `NotificationServiceImpl.java:171-214` |
| DEV-005 | `EventSetEnrolmentActor.unEnroll` never updates `enrollment_batch_lookup`, while `CourseEnrolmentActor.unEnroll` always does — the two "unenroll" implementations leave a related table in structurally different states for what a caller might otherwise treat as the same operation on different content types. | Sits underneath FR-009/FR-014 | `CourseEnrolmentActor.unEnroll:132-155` vs. `EventSetEnrolmentActor.upsertEnrollment:125-131` |

## Out of scope (not reconstructible from these 7 repos)

- The backend implementing `{KONG_API_BASE}/workflow/blendedprogram/*`
  (enrol and unenrol) — both web and mobile call into it for the
  blended-program withdraw flow, but its implementation is not present in
  any of the 7 repos.
- The write path that populates `sunbird_courses
  .enrollment_history_by_action` (the audit table both the reporting job
  and, presumably, the notification/telemetry ecosystem depend on) — only
  its read side (via `dataExhaust.py` and the two stage-2 report jobs) was
  traced.
- Any external scheduler (Airflow or otherwise) that might invoke
  `unenrollmentReport.py` outside this repository's own `jobs/main.py`.
- Any downstream consumer of the Kafka topic (`dev.user.notification`)
  the notification pipeline would use if `CONTENT_UN_ENROLLED` were ever
  wired up — only the (currently unused) producer/consumer code exists.
- Whether `POST /v1/course/admin/unenroll` and `POST /v1/batch/bulk
  /unenrollment` are invoked from any internal admin tool outside these 7
  repos.

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to one
> of the 7 repos listed in [index.md](index.md) at the file/function cited
> in its Source column — no requirement here is inferred without a
> citation. No original spec/ticket existed to verify these against (see
> Purpose and method); this document is reconstructed from shipped
> behaviour, not compared to an approved requirement set. Attaching the
> blended-program workflow service, the audit-table write path, and the
> downstream Kafka consumers listed under Out of scope would convert
> several open questions here (especially DEV-003's reasons/comments
> destination and CON-004's job-scheduling gap) from "unverified" to
> "confirmed."
