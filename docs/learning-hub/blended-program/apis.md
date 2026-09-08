# Blended Program — APIs

All paths are as called by the portals via the API gateway
(`/apis/proxies/v8/…` and `/apis/protected/v8/…` prefixes stripped for
readability). Sources: `sb-cb-ui-toc › widget-content.service.ts`,
`app-toc.service.ts`, `sunbird-cb-creationportal` services, and
`sunbird-cb-ext › BPReportsController`.

## Discovery & batches

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `learner/course/v1/batch/list` | List batches for a program |
| POST | `course/v1/batch/read` | Read one batch incl. `batchAttributes` |
| POST | `learner/course/v1/batch/create` | Create a batch |

## Enrolment workflow (learner)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `workflow/blendedprogram/enrol` | Create the enrolment request workflow |
| POST | `workflow/blendedprogram/unenrol` | Withdraw (action `WITHDRAW`, with `wfId`) |
| POST | `workflow/blendedprogram/user/search` | User's workflow application(s) for this program |
| POST | `workflow/blendedprogram/enrol/status/count` | Approved/pending counts — seat-cap check |

```jsonc
// POST workflow/blendedprogram/enrol — as built by app-toc-banner
{
  "rootOrgId": "<user rootOrgId>",
  "userId": "<userId>",
  "state": "INITIATE",
  "action": "INITIATE",            // or "WITHDRAW" on unenrol, with "wfId"
  "actorUserId": "<userId>",
  "applicationId": "<batchId>",    // the batch is the application
  "serviceName": "blendedprogram",
  "courseId": "<program do_id>",
  "deptName": "<user department>",
  "updateFieldValues": [ { "toValue": { "name": "<first name>" } } ]
}
// 200 → result.status "OK", result.data.status = new workflow state
```

## Approvals (MDO / PC consoles)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `workflowhandler/transition` | Move an application to the next state |
| POST | `workflow/v2/userWFApplicationFieldsSearch` | Approver queue with user fields |
| POST | `workflowhandler/applicationsSearch` | Search applications by service/state |
| POST | `v1/blendedprogram/workflow/update` | Approve/reject from the Creation Portal console |
| GET | `workflow/blendedprogram/getUserApprovalDataInCsv` | Export pending queue as CSV |

## Batch management & nomination (Creation Portal)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `authApi/batch/update` · `learner/course/v1/batch/delete` | Edit / delete a batch |
| POST | `workflow/blendedprogram/nominate` | Admin nominates learners |
| POST | `program/v2/admin/bulkEnroll` | Direct bulk enrolment |
| POST | `authApi/batch/addUser` · `removeUser` | Add / remove an individual learner |
| POST | `blendedprogram/v1/update/progress` | Mark session attendance (status 2 / 100%) |
| GET | `batch/v1/enrollment/qrcode/download/:doId/:batchId` · `…/qrcode/status/…` | QR code and scan status |
| POST | `authApi/batch/getUserProgress` · `getUserProgressV2` | Per-batch learner progress |
| POST | `course/batch/cert/v1/template/add` · `cert/v1/issue?reIssue=true` | Certificate template; issue / re-issue |
| GET | `data/v1/system/settings/get/defaultCertTemplate` · `data/v2/…/bpEnrolMandatoryProfileFields` · `…/cadreConfig` | Batch configuration settings |
| POST | `forms/v2/createForm` | Auto-create the batch's profile survey |

## Progress, assignments, certificates (learner side)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `learner/course/v4/user/enrollment/details/:userId` | Enrolments incl. batch and progress |
| POST | `content/v2/state/read` · PATCH `content/v2/state/update` | Per-node progress (`cb-ext-course-service › CourseController`) |
| POST | `assignment/v1/search` · `submitDraft` · `submit` | BP assignment lifecycle |
| POST | `storage/v1/bp/assignment/answer` · `…/answer/read/file` | Assignment answer files |
| POST | `v1/notifyAssignment/upload` · `evaluate` · `submit` | Assignment notifications (`NotificationController`) |
| GET | `cohorts/course/batch/cert/download/:certId` | Certificate download |

## Reports (sunbird-cb-ext)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `bp/v2/generate/report` (v1 available) | Kick off async report; roles validated |
| POST | `bp/v2/bpreport/status` · `bp/v2/bpreport/list` | Poll status / list reports |
| GET | `bp/v1/bpreport/download/:orgId/:courseId/:batchId/:fileName` | Download the file |

## Program authoring lifecycle

**Verified against `knowledge-platform › content-service` routes** — see
[Content Lifecycle](../../platform/content-lifecycle.md) for the full route
table and state machine.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `action/content/create` | Create the BP collection |
| PATCH | `action/content/hierarchy/update` (v2 available) | Save program structure |
| POST | `action/content/v3/review/:id` → `publish/:id` / `reject/:id` | Review → publish cycle |
| POST | `questionset/v1/create · review · publish` | Attached assessments |
| POST | `forms/tagFormToCourse/:id` · `untagFormToCourse/:id` | Tag the program-level enrolment survey |
