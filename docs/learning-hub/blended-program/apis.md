# Blended Program — APIs

All paths are as the portals call them, with the gateway prefix removed for
readability: web calls leave on `/apis/proxies/v8/…` (or `/apis/protected/v8/…`
and `/apis/authApi/…`); the **mobile app calls `/api/…` straight at Kong**
and never touches the uiproxy. Sources are cited per section; every route
below was matched to a controller or a Kong entry in the pinned commits
listed on the [overview](index.md) unless it carries a boundary note.

## How a call travels

```text
Browser  →  /apis/*  →  Nginx  →  ui-proxies:3003  →  Kong (KONG_API_BASE)  →  upstream service
Mobile   →  /api/*   →  Nginx  →  Kong                                        →  upstream service
Authoring (/apis/proxies/v8/action/*) →  ui-proxies  →  knowledge-mw-service:5000   (bypasses Kong)
```

- Nginx: `/apis/` → `http://ui-proxies:3003`, `/api/` → `http://kong`
  (`sunbird-devops › kubernetes/helm_charts/core/nginx-public-ingress/values.j2`).
- uiproxy forwards `/workflow/*`, `/blendedprogram/*`, `/batchsesion/*`,
  `/bp/*`, `/storage/*`, `/assignment/*`, `/course/*`, `/learner/*`,
  `/program/*` to Kong, and applies a **whitelist with per-route role
  lists** (`PORTAL_API_WHITELIST_CHECK` defaults to `true`; a path not in the
  list is a 403). `sunbird-cb-uiproxy › src/proxies_v8/proxies_v8.ts`,
  `src/utils/whitelistApis.ts`.
- Kong route entries live in
  `sunbird-devops › ansible/roles/kong-api/defaults/main.yml`; every Blended
  Program route there carries `jwt, cors, statsd, acl, rate-limiting,
  request-size-limiting`.
- Upstreams: workflow routes → `workflow-handler-service:5099`
  (**identified as `sunbird-cb-workflow`** by port and by a one-to-one match
  of `@RequestMapping("/v1/blendedprogram/workflow")`); `sb-cb-ext-service:7001`
  routes → **matched to `sunbird-cb-ext` by controller path only**; LMS
  routes → `lms-service:9000` (`sunbird-course-service`).

> **Verification boundary:** the uiproxy commit read (`175d24c4`,
> `cbrelease-4.8.41_RC7`) is not one of the pinned commits; every
> whitelist/role statement below is "at that SHA". That `sb-cb-ext-service`
> *is* the `sunbird-cb-ext` image, and that a given Kong route behaves as
> its `strip_uri: true` suffix-append implies, are inferred, not read.

## Discovery & batches

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `learner/course/v1/batch/list` (web) · `course/v1/batch/list` (mobile) | Batches of a program: `{request:{filters:{courseId, status:["0","1","2"]}, sort_by:{createdDate:"desc"}}}` |
| GET | `course/v1/batch/read/:batchId` | One batch incl. `batchAttributes` (web, via `WidgetContentService`) |
| POST | `learner/course/v4/user/enrollment/details[/:userId]` | The learner's enrolment(s) for the program; body `{request:{retiredCoursesEnabled:true, courseId:[programId]}}`. Kong → LMS `/v3/user/enrol/courses/details` |
| GET | `learner/course/v2/user/enrollment/list/:userId?…&batchDetails=…batchAttributes` | My Learning; `batchAttributes` in `batchDetails` is how `sessionDetails_v2` reaches the client |
| POST | `composite/v4/bp/search` | Coordinator/trainer program list — filtered server-side to the caller (see [LLD](lld.md#coordinator-scoped-program-search)). Roles `PROGRAM_COORDINATOR`, `BP_PROGRAM_TRAINER` |
| GET | `extended/content/v1/read/:id` | Program read; for Blended Programs the response gains per-batch counters from Redis |
| POST | `read/content-progres/:courseId` | Per-node progress incl. offline sessions (→ Kong `course/v1/content/state/read`) |
| PATCH | `content-progres/:contentId` | Per-node progress write (→ Kong `course/v1/content/state/update`) |
| POST | `content/v2/state/read` · PATCH `content/v2/state/update` | **Pre-enrolment resources only** |
| POST | `course/v1/reenroll` | Re-enrol an inactive child course (portal resolver) |

Sources: `sb-cb-ui-components › sb-cb-ui-toc/…/widget-content.service.ts`,
`app-toc.service.ts`; `sunbird-cb-portal › src/app/services/app-enrollment-resolver.service.ts`;
`igot_karmayogi_mobile › lib/services/_services/learn_service.dart`.

## Enrolment workflow — learner

All served by `sunbird-cb-workflow › BPWorkFlowController`
(`/v1/blendedprogram/workflow`). Role column is the uiproxy whitelist.

| Method | Endpoint | Role (uiproxy) | Purpose |
|---|---|---|---|
| POST | `workflow/blendedprogram/enrol` | PUBLIC | Request a seat. Writes a `wf_status` row at `ENROLL_IS_IN_PROGRESS` and publishes to Kafka; returns `{message, data:{status, wfIds}}` |
| POST | `workflow/blendedprogram/unenrol` | PUBLIC | Any non-role-tagged transition; the portals use it for `WITHDRAW` (needs `wfId`) |
| POST | `workflow/blendedprogram/user/search` | PUBLIC | The caller's own requests for the given `applicationIds` (batch ids) |
| POST | `workflow/blendedprogram/enrol/status/count` | PUBLIC | `[{currentStatus, statusCount}]` per batch (cached ≈ 1.8 s) |
| POST | `workflow/blendedprogram/qr/enrolments` | **not whitelisted in uiproxy** — mobile calls Kong directly | Self-enrol by QR; auto-approves |

## Approvals, nomination & removal — coordinator / MDO

| Method | Endpoint | Role (uiproxy) | Purpose |
|---|---|---|---|
| POST | `workflow/blendedprogram/search` | PC, BP trainer, MDO admin/leader, program instructor | List requests by status / dept / applicationIds |
| POST | `workflow/blendedprogram/searchV2/pc` | PC, BP trainer | Multi-status, multi-batch list (the Creation Portal's request queue) |
| POST | `workflow/blendedprogram/searchV2/mdo` | MDO admin/leader | **Same function as the PC variant** in code |
| POST | `workflow/blendedprogram/update/pc` | PC, BP trainer | Approve / reject as PC |
| POST | `workflow/blendedprogram/update/mdo` | MDO admin/leader | Approve / reject as MDO |
| GET | `workflow/blendedprogram/read/pc/:wfId` · `read/mdo/:wfId` | PC / MDO | One row, un-enriched |
| POST | `workflow/blendedprogram/admin/enrol` | MDO admin/leader, community moderator | Enrol a **list** of users on an MDO's behalf (`ADMIN_ENROLL_IS_IN_PROGRESS`) |
| POST | `workflow/blendedprogram/remove/approved/user` (header `isPc`) | PC, trainer, MDO | Remove an approved learner (`REMOVE`) |
| POST | `workflow/blendedprogram/remove/pc` · `remove/mdo` | PC / MDO | Older remove routes — see boundary note below |
| POST | `workflow/blendedprogram/nominate` | PC, BP trainer | Nominate (auto-approve) up to 200 users |
| POST | `workflow/blendedprogram/getUserApprovalDataInCsv` | PC, trainer, MDO | **POST** — pending queue as CSV |
| POST | `workflow/blendedprogram/bulkApprovalDataFromCsv/:contentId` | PC, trainer, MDO | Multipart `file`; the uiproxy re-posts straight to `kong:8000` |
| POST | `workflow/blendedprogram/v1/stats` | CBP admin, PC, trainer | Counts per active batch (Kong rewrites to workflow `/stats`) |

> **Boundary — routes that do not line up.** Kong defines
> `workflowBlendedProgramUpdate` and `workflowBlendedProgramRemove` (URIs
> `/workflow/blendedprogram/update` and `/remove`) pointing at workflow
> paths that **do not exist** in `BPWorkFlowController`, and neither is in
> the uiproxy whitelist. The Creation Portal's `UPDATE_REQUEST`
> (`/v1/blendedprogram/workflow/update`) matches no uiproxy mapping or Kong
> URI, and has no caller. There is no `workflowhandler/…` prefix in Kong
> (the prefix is `/workflow`). `read/{wfId}/{applicationId}` exists on the
> controller but has no Kong route. `remove/pc` and `remove/mdo` appear to
> fail before the transition (see [LLD](lld.md#known-defects)). The
> `uiproxy` key for `searchV2` is lower-case while Kong's URI is `searchV2`;
> no caller of either casing was found in the attached repos.

## Sessions, attendance & QR

| Method | Endpoint | Role (uiproxy) | Purpose |
|---|---|---|---|
| POST | `blendedprogram/v1/update/progress` | PC, BP trainer | Coordinator marks attendance → `sunbird-cb-ext` `POST /content/progress/v1/ext/update` (asynchronous: 200 once queued, whatever happens downstream) |
| POST | `blendedprogram/v1/getUserContentProgress` | PC, BP trainer | Learners' session progress → `/content/progress/v1/read/getUserDetails` |
| POST | `blendedprogram/v1/attendance/update` | **not whitelisted in uiproxy** (Kong ACL `illumineAccess`) | External (Illumine) attendance: marks the **first session** of the learner's active batch |
| PATCH | `course/v5/content/state/update` | learner | **Mobile's** QR attendance — a plain progress write on the session id |
| GET | `batchsesion/qrcode/:courseId/:batchId` | PUBLIC | PDF with one session QR per offline session |
| GET | `batch/v1/enrollment/qrcode/status/:doId/:batchId` | — | `{selfEnrolQrGenerated}` boolean (self-enrolment QR) |
| GET | `batch/v1/enrollment/qrcode/download/:doId/:batchId` | — | Self-enrolment QR PDF; requires program `selfEnrollment = "Yes"` and flips `selfEnrolQrGenerated` |

## Batch management

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/apis/authApi/batch/create` | Create (uiproxy rewrites to Kong `course/v1/batch/create` → LMS `/v1/course/batch/create`). **Not** `learner/course/v1/batch/create` |
| PATCH | `/apis/authApi/batch/update` | Edit (→ Kong `course/v1/batch/update`) |
| POST | `learner/course/v1/batch/delete` | Delete (Blended Program only; before the start date) |
| GET | `/apis/authApi/readbatch/:id` | Read a batch (→ Kong `course/v1/batch/read/:id`) |
| POST | `course/v1/batch/getParticipants` | Learner list (custom uiproxy handler: Kong `participants/list` then `user/v1/search`) |
| GET | `/apis/protected/v8/cohorts/course/getUsersForBatch/:batchId` | Learner list (alternate) |
| POST | `/apis/authApi/batch/getUserProgress` · `getUserProgressV2` | Per-batch learner progress |
| PATCH | `/apis/authApi/batch/addCert` · `course/batch/cert/v1/template/add` | Attach certificate template |
| POST | `/apis/protected/v8/cohorts/course/batch/cert/issue` | Issue / re-issue (uiproxy → Kong `course/batch/cert/v1/issue?reIssue=true`) |
| GET | `data/v1/system/settings/get/defaultCertTemplate` | Default certificate template |
| GET | `data/v2/system/settings/get/bpEnrolMandatoryProfileFields` · `…/cadreConfig` | Profile-field master list / cadre list |
| POST | `forms/v2/createForm` | Create (or update-in-place via existing id) the batch's profile survey |

Source: `sunbird-cb-creationportal › …/content-detail/services/content-batch.service.ts`,
`certificate.service.ts`; `sunbird-cb-uiproxy › src/authoring/content/index.ts`,
`src/protectedApi_v8/cohorts.ts`.

## Nomination & enrol of invite-only programs (not Blended Program)

`program/v2/admin/bulkEnroll`, `authApi/batch/addUser|removeUser` and
`program/v1/admin/enrol` are wired to the *Manage Learner Invitations*
dialog, which the Creation Portal shows for **Program** and invite-only
**Standalone Assessment** — not for Blended Program. Kong sends
`/program/v2/admin/bulkEnroll` to LMS `/v3/program/admin/bulkEnroll`; the
category gate `admin_program_enroll_allowed_primary_category` includes
`Blended Program` only in the deployed env template, not in the repo
default. Treat Blended Program nomination as `…/nominate` only.

## Assignments

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `assignment/v1/search` | `{query:"", filters:{"additionalProperties.batchId":"<id>"}}` |
| POST | `assignment/v1/create` | Create (Creation Portal): `{title, contextType:"assignment", additionalProperties:{batchId, courseId, assignmentUrl, description}}` |
| POST | `forms/v2/submissions/search` | The learner's own status, or pending counts (`groupBy:"formId"`) |
| POST | `storage/v1/bp/assignment/answer/:contentId/:batchId/:formId` | Multipart `file` → `sunbird-cb-ext` `StorageController`; extensions `pdf, doc, docx`; 5000 KB |
| GET | `storage/v1/bp/assignment/answer/read/file?contentId&batchId&formId&fileName` | **GET**; blob |
| PUT | `assignment/v1/submitDraft` | `{submitUrl, formId}` |
| POST | `assignment/v1/submit` | `{submitUrl, formId}` |
| POST | `assignment/v1/feedback` | Evaluate: `{formId, contextId, marksGiven, maximumMarks, instructorFeedback, submittedBy}` |
| POST | `v1/notifyAssignment/submit` · `upload` · `evaluate` | Notifications → `cb-ext-course-service` |

Kong sends `assignment/*` to the forms service
(`forms_service_url/forms/v2/search|submitDraft|submit|feedback`) and
`notifyAssignment/*` to `cb_ext_course_service_url`.

> **Verification boundary:** the forms service and `cb-ext-course-service`
> were not attached, so the assignment draft / submit / evaluate behaviour
> and the notification templates are known only from the callers and the
> Kong map. The learner client calls `notifyAssignment/submit`; the Creation
> Portal viewer's method named `notifyAssignmentUpload` actually posts to
> `…/evaluate`.

## Reports

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `bp/v1/generate/report` | **Enrollment Report** — `{request:{orgId, courseId, batchId, reportRequester, surveyId?}}` |
| POST | `bp/v2/generate/report` | **Consumption Report** |
| POST | `bp/v1/bpreport/status` · `bp/v2/bpreport/status` | Row status (defined, unused by the UI) |
| POST | `bp/v2/bpreport/list` | Rows of both versions |
| GET | `bp/v1/bpreport/download/:orgId/:courseId/:batchId/:fileName` | Download xlsx (token check only) |
| GET | `storage/v1/reportInfo/:orgId` · `storage/v1/report/:reportType/:date/:orgId/:file` | Nightly Spark `BlendedProgramReport.csv` (`blended-program-report-mdo` / `-cbp`) |

All `bp/*` routes need the user token; generate and status additionally
require the caller's root org to equal the request `orgId` (the v1 download
checks the token only). Allowed `reportRequester`: `MDO_ADMIN`, `MDO_LEADER`,
`PROGRAM_COORDINATOR` (a `BP_PROGRAM_TRAINER` value is rejected as invalid
although the gateway lets that role through).

## Program coordinators

Served by `sunbird-cb-ext › ProgramCoordinatorController`.

| Method | Endpoint | Purpose |
|---|---|---|
| PUT | `program/coordinator/:programId` | Body `[{userId, roleId?/roleName, status:1\|0, isCoTrainer?}]`; caller needs role `PROGRAM_COORDINATOR` |
| POST | `program/coordinator/list/:programId` | `{request:{limit, offset, sortBy, sortDirection, roleName:[…]}}` |
| GET | `program/coordinator/roles` | Role catalogue |
| PUT | `program/admin/coordinator/upsert/:programId` | Admin variant — used by the Creation Portal editor to persist the ≤ 5 coordinators |
| GET | `v1/program/:programId/coordinators` | Any authenticated user |

## Program authoring lifecycle

Authoring calls go to **knowledge-mw-service** (uiproxy `/action/*`), not
Kong, except `updateReviewStatus` and `hierarchyUpdate`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `action/content/v3/create` | Create the program (`primaryCategory` and `courseCategory` both `"Blended Program"`) |
| PATCH | `action/content/v3/update/:id` | Edit metadata; `private/content/v4/update/:id` (reviewer) and `private/content/v4/system/update/:id` (Live publisher) |
| PATCH | `action/content/v3/hierarchy/update` | Save structure |
| GET | `action/content/v3/read/:id?mode=edit` · `…/hierarchy/:id?mode=edit` | Editor reads |
| POST | `action/content/v3/review/:id` → `publish/:id` / `reject/:id` | Review cycle; `questionset/v1/*` for attached assessments |
| DELETE | `v1/content/retire` | Un-publish a Live program (the *scheduled* retirement flow is Course-only) |

The routes behind these live in `knowledge-platform › content-service`
(`/content/v3/create|update|review|publish|reject|retire|hierarchy/…`) and are
generic — no create / review / publish / retire code branches on "Blended
Program". See [Content Lifecycle](../../platform/content-lifecycle.md).

## Verified payloads

```jsonc
// POST workflow/blendedprogram/enrol  (web and mobile send the same fields)
{
  "rootOrgId": "<user rootOrgId>",
  "userId": "<userId>",
  "state": "INITIATE",
  "action": "INITIATE",               // WITHDRAW on unenrol, which also sends "wfId"
  "actorUserId": "<userId>",
  "applicationId": "<batchId>",       // the batch IS the application
  "serviceName": "blendedprogram",
  "courseId": "<program do_id>",
  "deptName": "<user department>",
  "updateFieldValues": [ { "toValue": { "name": "<first name>" } } ]
}
// 200 → { "message": "Application status changed to ENROLL_IS_IN_PROGRESS",
//         "data": { "status": "ENROLL_IS_IN_PROGRESS", "wfIds": "<uuid>" }, "status": 200 }
// on unenrol, "state" is the CURRENT status (e.g. SEND_FOR_MDO_APPROVAL)
```

```jsonc
// POST workflow/blendedprogram/update/pc  — Creation Portal "New requests"
{
  "state": "SEND_FOR_PC_APPROVAL", "action": "APPROVE",     // or REJECT
  "wfId": "<latest wfInfo.wfId>", "applicationId": "<batchId>",
  "userId": "<learner>", "actorUserId": "<wfInfo.actorUUID>",
  "serviceName": "blendedprogram", "rootOrgId": "<wfInfo.rootOrg>",
  "courseId": "<program>", "deptName": "<wfInfo.deptName>",
  "comment": "<reject reason, <=500 chars>",                 // REJECT only
  "updateFieldValues": [ { "toValue": { "name": "<first_name>" } } ]
}
```

```jsonc
// POST workflow/blendedprogram/nominate
{ "batchId": "<id>", "courseId": "<id>", "serviceName": "blendedprogram",
  "deptName": "<rootOrg>", "userIds": ["<id>", "..."] }          // <= 200 server-side, 30 in the UI
// 200 → { "message": "Nomination workflow processing complete",
//         "data": [ { "userId": "...", "status": "APPROVED", "wfId": "..." } ] }
```

```jsonc
// POST workflow/blendedprogram/qr/enrolments      (mobile → Kong directly)
{ "courseId": "<program>", "batchId": "<batch>" }
```

```jsonc
// POST workflow/blendedprogram/enrol/status/count  and  user/search
{ "serviceName": "blendedprogram", "applicationStatus": "",
  "applicationIds": ["<batchId>"], "limit": 100, "offset": 0 }
// user/search body: {"applicationIds":[all batch ids],"serviceName":"blendedprogram","limit":100,"offset":0}
```

```jsonc
// POST authApi/batch/create  — as built by content-create-batch-bp
{ "request": {
    "courseId": "<program do_id>", "name": "<batchName>", "description": "Batch for <program name>",
    "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "enrollmentEndDate": "YYYY-MM-DD",
    "enrollmentType": "invite-only",
    "createdBy": "<userId>", "createdFor": ["<rootOrgId>"], "mentors": ["<userId>"],
    "batchAttributes": {
      "enableQR": true, "currentBatchSize": "<string, 1-200>",
      "batchLocationDetails": "<address>", "latlong": "<lat, long>",
      "state": "…", "district": "…", "pincode": "…",           // optional
      "sessionDetails_v2": [ /* see LLD */ ],
      "instructors": [ {"id":"…","name":"…","email":"…"} ], "instructorsUserId": ["…"],
      "cadreList": ["<service display name>"],
      "userProfileFileds": "Available user filled iGOT profile | Full iGOT profile | Custom iGOT profile",
      "bpEnrolMandatoryProfileFields": [ {"displayName":"…","field":"…"} ],
      "profileSurveyLink": "<karmYogi>surveys/<formId>", "profileSurveyId": "<formId>"
    },
    "coTrainers": ["<userId>"]                                  // top-level, NOT in batchAttributes
} }
```

```jsonc
// POST blendedprogram/v1/update/progress  — coordinator marks attendance (Creation Portal)
{ "request": [ { "userId": "<learner>",
    "contents": [ { "contentId": "<sessionId>", "batchId": "<id>", "courseId": "<id>",
                    "status": 2, "completionPercentage": 100 } ] } ] }   // absent: 0 and 0
```

```jsonc
// PATCH course/v5/content/state/update  — mobile QR attendance
{ "request": { "userId": "<wid>", "contents": [ {
    "batchId": "…", "completionPercentage": 100.0, "contentId": "<sessionId>", "courseId": "…",
    "status": 2, "lastAccessTime": "<utc yyyy-MM-dd HH:mm>:00+0000", "progressdetails": {"spentTime": 0} } ] } }
```

```jsonc
// POST forms/v2/saveFormSubmit  — profile form and survey
{ "formId": "<profileSurveyId | survey id>", "version": 4, "status": "SUBMITTED",
  "contextId": "<program id>", "contextName": "<program name>",
  "responses": [ { "questionId": "…", "question": "…", "answer": "…", "answerType": "text" } ] }
// contextId is the PROGRAM id, not the batch id; "version": 4 is hard-coded in both clients' profile submit
```

## Endpoints named in earlier versions of this page that were not found

`POST workflowhandler/transition`, `POST workflowhandler/applicationsSearch`,
`POST v1/blendedprogram/workflow/update`, `POST workflow/v2/userWFApplicationFieldsSearch`
(in the portal this is the **profile-field** approval API), `GET
workflow/blendedprogram/getUserApprovalDataInCsv` (it is POST),
`POST learner/course/v1/batch/create` (the portal uses `authApi/batch/create`),
`POST authApi/batch/update` (it is PATCH), `GET learner/course/v4/user/enrollment/details/:userId`
(it is POST with a body), `POST course/v1/batch/read` (web uses GET with the
id in the path), and `action/content/create` / `action/content/hierarchy/update`
without `v3`. Generic `POST workflow/transition` and `workflow/v2/transition`
do exist in Kong and the workflow service but record no
`modification_history` and are not called by any Blended Program screen.

> **Verification boundary:** facts above are read from `sunbird-cb-workflow`,
> `sunbird-cb-ext`, `sunbird-course-service`, `knowledge-platform`,
> `sunbird-devops`, `sunbird-cb-portal`, `sb-cb-ui-components`,
> `sunbird-cb-creationportal` and `igot_karmayogi_mobile`. Not analysed from
> source: `sb-cb-ext-service` (identified with `sunbird-cb-ext` by
> controller paths only), `sunbird-content-service`, the forms service,
> `cb-ext-course-service`, `@sunbird-cb/micro-surveys`, and the
> `knowledge-mw-service` that is actually deployed (the checkout read is a
> 2021 `master`). Attach those repos to close the gaps. The Creation Portal
> pins `@sunbird-cb/toc 0.1.11` while this analysis read 0.1.12.
