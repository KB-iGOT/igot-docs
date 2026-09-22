# Unenrollment of Courses — APIs

Verified from `sunbird-course-service › service/conf/routes`,
`CourseEnrollmentController.java`, `CourseEnrolmentActor.scala`,
`EventSetEnrolmentActor.scala`, `igot_karmayogi_mobile ›
toc_api_service.dart` / `api_endpoints.dart`, `sunbird-cb-portal ›
widget-content.service.ts`, `sunbird-cb-uiproxy › whitelistApis.ts` /
`proxies_v8.ts`, `cb-notification-wrapper ›
NotificationController.java`.

## Backend (sunbird-course-service, Java/Scala/Akka/Play)

| Method | Route | Handler | Actor operation |
|---|---|---|---|
| POST | `/v1/course/unenroll` | `CourseEnrollmentController.unenrollCourse` | `"unenrol"` → `CourseEnrolmentActor` |
| POST | `/v1/course/admin/unenroll` | `CourseEnrollmentController.adminUnenrollCourse` | `"unenrol"` → `CourseEnrolmentActor` (no confirmed caller in any traced client) |
| POST | `/v1/event/unenroll` | `CourseEnrollmentController.unenrollCourse` (same handler, standalone-event content) | `"unenrol"` |
| POST | `/v1/eventset/unenroll` | `EventSetEnrollmentController.unenroll` | `"unenrol"` → `EventSetEnrolmentActor` |
| POST | `/v1/batch/bulk/unenrollment` | `BulkUploadController.batchUnEnrollmentBulkUpload` | CSV bulk-unenroll upload — not traced beyond the route |

There is no `ActorOperations` enum entry for unenroll — the operation is
passed as the raw string `"unenrol"` from controller to actor and
pattern-matched as a string in Scala, unlike most other operations in this
codebase.

### Request body (course/event unenroll)

```jsonc
// POST /v1/course/unenroll
{
  "request": {
    "courseId": "...",     // or collectionId, normalized to courseId
    "batchId": "...",
    "userId": "..."        // admin route only — learner route derives this from auth context
  }
}
```

### Response

Success: generic `{"responseCode": "OK", ...}` envelope, no unenroll-specific
payload. Failure: one of the client errors below, via `ResponseCode`:

| ResponseCode | Message | Thrown when |
|---|---|---|
| `invalidCourseBatchId` | "Invalid course batch id." | Batch/course combination doesn't exist |
| `enrollmentTypeValidation` | (enrollment-type validation message) | Batch enrollmentType is neither `open` nor `invite-only` |
| `courseBatchAlreadyCompleted` | "Course batch is already completed." | Batch status is `Completed` / end date passed, **or** the learner's own course-completion status is already `COMPLETED` — both cases share this one message |
| `userNotEnrolledCourse` | "User is not enrolled to given course batch." | Learner has no active enrolment (never enrolled, or already unenrolled) |
| `accessDeniedToEnrolOrUnenrolCourse` | "User doesn't have access to this Course Id" | `ContentUtil.getContentRead` access check fails |

No response code exists for "certificate already issued" — that state is
never checked.

## Mobile → Backend

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/course/v2/unenroll` | Unenroll from a plain course, with reasons/comments |
| POST | `/api/course/v1/reenroll` | Re-enroll counterpart |
| POST | `/api/workflow/blendedprogram/unenrol` | Withdraw a still-pending blended-program enrolment request (a different feature — see [use-cases.md](use-cases.md) UC-7) |

```jsonc
// POST /api/course/v2/unenroll
{
  "request": {
    "courseId": "...",
    "batchId": "...",
    "reasons": ["Content is not relevant to my role", "..."],
    "comments": "optional free text, <=500 chars"
  }
}
```

> **Verification boundary:** `reasons`/`comments` are sent by mobile but
> are not read anywhere in the backend controller/validator/actor code
> traced — see [use-cases.md](use-cases.md) UC-4.

```jsonc
// POST /api/workflow/blendedprogram/unenrol  (mobile "withdraw", also used by web — see below)
{
  "rootOrgId": "...", "userId": "...", "state": "<current workflow status>",
  "action": "WITHDRAW", "applicationId": "<batchId>",
  "serviceName": "blendedprogram", "wfId": "..."
}
```

## Web → Backend (via sunbird-cb-uiproxy)

| Method | Frontend path | Proxy target | Purpose |
|---|---|---|---|
| POST | `apis/proxies/v8/workflow/blendedprogram/unenrol` | `{KONG_API_BASE}/workflow/blendedprogram/unenrol` (generic `/workflow/*` wildcard proxy, no dedicated handler) | Withdraw a pending blended-program enrolment request — **the only unenroll-labelled call web makes**; there is no web endpoint for unenrolling from a plain course |

Whitelist (`sunbird-cb-uiproxy/src/utils/whitelistApis.ts`):

```ts
'/proxies/v8/workflow/blendedprogram/unenrol': {
  checksNeeded: [CHECK.ROLE],
  ROLE_CHECK: [ROLE.PUBLIC],   // any authenticated session role — no elevated permission
},
```

A second, unrelated whitelist entry exists for mentoring-session unenroll
(`/proxies/v8/mentoring/v1/sessions/unEnroll/:id`) — a different feature
(1:1/group mentoring), not courses.

An admin batch-removal constant also exists in the uiproxy's authoring
routes:

```ts
batchRemoveUser: `${CONSTANTS.KONG_API_BASE}/course/v1/admin/unenrol`,
```

used by an admin batch-management handler — this is the uiproxy-side
counterpart of the backend's `/v1/course/admin/unenroll` route.

## Notification path (two independent systems)

**System 1 — actually wired, backend-native (email only):**

`CourseEnrolmentActor.unEnroll` → `notifyUser(userId, batchData,
JsonKey.REMOVE)` → Akka message `ActorOperations.COURSE_BATCH_NOTIFICATION`
→ `CourseBatchNotificationActor.courseBatchNotification()` → selects
template `OPEN_BATCH_LEARNER_UNENROL` / subject
`UNENROLL_FROM_COURSE_BATCH` → `sendMail` → `userOrgService
.sendEmailNotification(...)`. Gated by the property
`SUNBIRD_COURSE_BATCH_NOTIFICATIONS_ENABLED`.

**System 2 — declared but never triggered (in-app, cb-notification-\*):**

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/notifications/create` | Generic notification trigger (`cb-notification-wrapper`), would render `CONTENT_UN_ENROLLED`'s template ("You have successfully unenrolled from '{courseName}'.") and push to Kafka topic `dev.user.notification` for `cb-notification-service` to persist as an in-app row |

`CONTENT_UN_ENROLLED` / `CONTENT_RE_ENROLLED` exist as enum values in
**both** `cb-notification-service` and `cb-notification-wrapper`, but a
repo-wide grep across all ten repos scoped to this feature found **zero
callers** of `POST /notifications/create` with either subcategory — no
course-service integration, no test, no client. This is dead code, not a
live notification channel.

> **Verification boundary:** everything above traces to the seven repos
> listed in [index.md](index.md). The backend implementing
> `{KONG_API_BASE}/workflow/blendedprogram/*` (the workflow-approval
> service both web and mobile call for the blended-program withdraw path)
> is not present in any of the seven repos — only the calls into it are
> visible.
