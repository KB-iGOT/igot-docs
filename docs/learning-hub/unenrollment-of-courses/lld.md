# Unenrollment of Courses — LLD

Reverse-engineered from code. Where a client sends data the backend doesn't
read, or a job exists but isn't scheduled, the as-built reality is
documented explicitly rather than assumed.

## Storage reality

**Cassandra (`sunbird_courses` keyspace)** — no new tables; unenroll writes
to the exact same tables enroll does:

| Table | Constant | Written by unenroll | What changes |
|---|---|---|---|
| `user_enrolments` | `USER_ENROLMENTS` | `UserCoursesDao.updateV2` | `active` → `false` (only field set) |
| `enrollment_batch_lookup` | `ENROLLMENT_BATCH` | `BatchUserDao.updateBatchLookupRecord` | `active` → `false` — **not** written for EventSet unenroll |
| `enrollment_history_by_action` | (audit table, read-only from unenroll's perspective) | — | Presumed source of the `UNENROLL` action rows the reporting job reads; the write path into this table was not located inside `CourseEnrolmentActor.unEnroll` itself — it is written by some other component not traced in this pass |

**Redis** — one cache key per user (`<userId>:user-enrolments`), deleted
(not updated) on every unenroll via `cacheUtil.delete`.

**No participant-count field, no certificate table, no karma-points table**
is touched anywhere in the unenroll write path.

```mermaid
flowchart TB
    Req["POST /v1/course/unenroll {courseId, batchId, userId}"]
    Read1[("user_enrolments - read current row")]
    Read2[("CourseBatch - read via CourseBatchDao")]
    Read3[("enrollment_batch_lookup - read via BatchUserDao")]
    Recalc["getUpdatedStatus - live content search recomputes completion status BEFORE validation"]
    Validate{"validateEnrolment isEnrol=false"}
    Write1[("user_enrolments - active=false")]
    Write2[("enrollment_batch_lookup - active=false")]
    CacheDel[("Redis - delete cache key")]
    Email["CourseBatchNotificationActor - email, live"]
    Telem["Telemetry AUDIT event - correlation=unenrol"]
    Err["ProjectCommonException - client error"]

    Req --> Read1 & Read2 & Read3
    Read1 --> Recalc --> Validate
    Validate -- fail --> Err
    Validate -- pass --> Write1 --> Write2 --> CacheDel --> Email
    Write2 --> Telem
```

## Precondition chain — `validateEnrolment(batchData, enrolmentData, isEnrol=false)`

Evaluated in this order (`CourseEnrolmentActor.scala`):

1. `batchData == null` → `invalidCourseBatchId`
2. Batch `enrollmentType` not `open`/`invite-only` → `enrollmentTypeValidation` (same rule applies to enroll)
3. Batch `status == 2` (Completed) or end date passed → `courseBatchAlreadyCompleted`
4. *(enroll-only, skipped here since `isEnrol=false`)* enrollment-window-closed check
5. `enrolmentData == null || !enrolmentData.isActive` → `userNotEnrolledCourse`
6. `enrolmentData.getStatus == COMPLETED (2)` → `courseBatchAlreadyCompleted` (same message as step 3 — no distinct code for "you already finished this course")

Then, outside `validateEnrolment` but still gating the write:
`ContentUtil.getContentRead(courseId, headers)` must return `true`, else
`accessDeniedToEnrolOrUnenrolCourse`.

**No check exists** for certificate-issued state, attempt limits, or a
cool-off period anywhere in this chain.

## Sequence: course unenroll, end to end

```mermaid
flowchart TD
    Start(["Learner confirms unenroll"]) --> API["POST /v1/course/unenroll"]
    API --> Ctrl["CourseEnrollmentController.unenrollCourse - normalize courseId/userId"]
    Ctrl --> ValReq["validateRequestedBy + validateUnenrollCourse - courseId/batchId/userId mandatory only"]
    ValReq --> Actor["CourseEnrolmentActor ! unenrol"]
    Actor --> Reads["Read CourseBatch + UserCourses + BatchUser"]
    Reads --> Recalc["getUpdatedStatus - live ES/content search recalculates completion"]
    Recalc --> Precond{"validateEnrolment precondition chain"}
    Precond -- fail --> ClientErr["Client error response - see apis.md table"]
    Precond -- pass --> Access{"ContentUtil.getContentRead"}
    Access -- false --> Denied["accessDeniedToEnrolOrUnenrolCourse"]
    Access -- true --> Upsert["upsertEnrollment isNew=false - UPDATE only, never INSERT"]
    Upsert --> W1["user_enrolments.active=false"]
    Upsert --> W2["enrollment_batch_lookup.active=false"]
    W2 --> CacheDel["Redis cache key deleted"]
    CacheDel --> Success["200 OK response"]
    Success --> Telemetry["Telemetry AUDIT event fired"]
    Success --> NotifyCheck{"SUNBIRD_COURSE_BATCH_NOTIFICATIONS_ENABLED?"}
    NotifyCheck -- yes --> Email["Email sent - template OPEN_BATCH_LEARNER_UNENROL"]
    NotifyCheck -- no --> NoEmail["No notification"]
```

Note the complete absence of a Kafka `InstructionEventGenerator` call in
this chain — `enroll()` has one (to `kafka_user_enrolment_event_topic`),
`unEnroll()` does not, visible directly by their code being adjacent in the
same file.

## Sequence: EventSet unenroll (structural difference)

```mermaid
flowchart TD
    Start(["POST /v1/eventset/unenroll"]) --> GetChildren["EventContentUtil.getChildEventIds"]
    GetChildren --> Loop["For each child event id"]
    Loop --> SynthBatch["getFixedBatch - CourseBatch synthesized in-memory, not read from Cassandra"]
    SynthBatch --> Precond2{"validateEnrolment - same chain, but only rejects inviteOnly type"}
    Precond2 -- pass --> Upsert2["upsertEnrollment isNew=false"]
    Upsert2 --> W3["user_enrolments.active=false ONLY"]
    W3 -.->|"no equivalent write"| SkipBatchLookup["enrollment_batch_lookup NOT touched"]
    W3 --> Notify2["notifyUser REMOVE - same email path"]
    Loop -->|next child| Loop
```

## Module map

```mermaid
flowchart TB
    subgraph Mobile["igot_karmayogi_mobile"]
        M1["toc_appbar_widget.dart - menu gate + orchestration"]
        M2["unenroll_confirmation_bottom_sheet.dart"]
        M3["unenroll_feedback_bottom_sheet.dart"]
        M4["course_toc_page.dart - _onUnenrollConfirmed"]
        M5["toc_repository.dart -> toc_api_service.dart"]
        M1 --> M2 --> M3
        M4 --> M5
    end

    subgraph Web["sunbird-cb-portal"]
        W1["app-toc-banner.component.ts - blended-program WITHDRAW only"]
        W2["widget-content.service.ts - enrollAndUnenrollUserToBatchWF"]
        W1 --> W2
    end

    subgraph Backend["sunbird-course-service"]
        B1["CourseEnrollmentController"]
        B2["CourseEnrollmentRequestValidator"]
        B3["CourseEnrolmentActor.unEnroll"]
        B4["EventSetEnrolmentActor.unEnroll"]
        B5["CourseBatchNotificationActor"]
        B1 --> B2 --> B3 --> B5
    end

    subgraph Reporting["cb-core-data"]
        R1["unenrollmentReport.py - orphaned from jobs/main.py"]
        R2["userEnrolment.py - part of jobs/main.py"]
    end

    M5 -->|"REST /api/course/v2/unenroll"| B1
    W2 -->|"REST /workflow/blendedprogram/unenrol - different backend, not traced"| GW2["(not in these repos)"]
    R1 -->|"reads audit trail"| B3
```

No shared library exists between mobile and web for unenroll — they aren't
even the same feature on the two clients (mobile: plain-course unenroll;
web: blended-program workflow withdrawal).

## State model

**Enrolment `active` flag** (the entire state machine — no richer enum
exists):

```mermaid
stateDiagram-v2
    [*] --> Active: enroll (active=true)
    Active --> Inactive: unenroll (active=false), blocked if status=COMPLETED
    Inactive --> Active: re-enroll
    Active --> [*]: course completed (status=COMPLETED) - unenroll now blocked
```

**Course-completion status**, read (not written) by unenroll's
precondition check: `NOT_STARTED (0)` / `IN_PROGRESS (1)` /
`COMPLETED (2)` — recomputed live via `getUpdatedStatus` immediately before
the precondition check runs, so it reflects a fresh calculation, not
necessarily the value most recently persisted.

**Blended-program workflow status** (separate state machine entirely,
governing UC-6/UC-7's "withdraw", not this feature's core `active` flag):
`SEND_FOR_MDO_APPROVAL` / `SEND_FOR_PC_APPROVAL` / `APPROVED` / `REJECTED`
/ `REMOVED` / `WITHDRAWN` — withdraw is offered only pre-`APPROVED`, and
disabled mid-flight in a two-step approval chain while sitting at the
other approver's stage. The service that owns this state machine is
external to all seven repos traced.

## Validation reality

| Rule | Enforced | Where |
|---|---|---|
| courseId/collectionId, batchId, userId required | Backend | `CourseEnrollmentRequestValidator.commonValidations` |
| Batch exists | Backend | `validateEnrolment` step 1 |
| Batch enrollmentType open/invite-only | Backend | `validateEnrolment` step 2 |
| Batch not completed / not past end date | Backend | `validateEnrolment` step 3 |
| Currently actively enrolled | Backend | `validateEnrolment` step 5 |
| Course not already completed by learner | Backend | `validateEnrolment` step 6 |
| Content access granted | Backend | `ContentUtil.getContentRead` |
| Certificate not yet issued | **Not enforced anywhere** | — |
| Reasons/comments format or presence | Frontend only (mobile) | `unenroll_feedback_bottom_sheet.dart` — not read by backend |
| Attempt limit / cool-off before re-unenrolling | **Not found on any tier** | — |
| Menu-item eligibility (completed/player/featured/category) | Frontend only (mobile) | `toc_appbar_widget.dart._buildActions` |

> **Verification boundary:** facts above are read from
> `sunbird-course-service`, `igot_karmayogi_mobile`, `sunbird-cb-portal`,
> `sunbird-cb-uiproxy`, `cb-core-data`, `cb-notification-service`, and
> `cb-notification-wrapper`. Not analysed from source: the write path that
> actually populates `enrollment_history_by_action` (only its read side is
> traced, via the reporting job), and the external
> `{KONG_API_BASE}/workflow/blendedprogram/*` service backing the
> blended-program withdraw flow used by both web and mobile. Attaching
> those would close the two biggest remaining gaps in this trace.
