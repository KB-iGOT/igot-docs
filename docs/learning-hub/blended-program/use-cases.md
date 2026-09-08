# Blended Program — Use Cases

## Learner journeys

### UC-1 · Request enrolment into a batch

From the program's TOC page the learner picks an open batch and requests a
seat. Before the request goes out the portal checks for a **conflict** (an
active enrolment in another Blended Program blocks the request) and, if the
batch demands it, collects a **profile survey / questionnaire** first (driven
by `batchAttributes.userProfileFileds` or the program's `wfSurveyLink`). The
request creates a workflow application in state `INITIATE`, then moves to the
first approval step.

- API: `POST workflow/blendedprogram/enrol`

### UC-2 · Withdraw an enrolment request

Until approved (and, depending on program rules, after), the learner can
withdraw. The workflow moves to `WITHDRAWN`; the seat is released. The batch
card shows the request state throughout via the status-message mapping.

- API: `POST workflow/blendedprogram/unenrol` (action `WITHDRAW`)

### UC-3 · Learn: online modules + sessions

Once `APPROVED`, the learner is enrolled in the batch and the program appears
in My Learning. Online content progress is written per node; classroom/offline
sessions come from `batchAttributes.sessionDetails_v2`, and session completion
contributes to the overall completion percentage.

- APIs: `POST content/v2/state/read` · `GET learner/course/v4/user/enrollment/details/:userId`

### UC-4 · Submit a program assignment

Blended programs can carry assignments: the learner uploads an answer file,
submits a draft, then submits final; the coordinator side is notified and can
evaluate. Files live in the BP assignment store.

- APIs: `assignment/v1/submitDraft` · `assignment/v1/submit` · `storage/v1/bp/assignment/answer` · `v1/notifyAssignment/submit`

## Approver & admin journeys

### UC-5 · Approve or reject a request

Approvers see pending applications in their console and act on each. A
one-step batch needs only MDO *or* PC; a two-step batch chains both in the
configured order. Approval moves the workflow to the next state
(`SEND_FOR_PC_APPROVAL` or `APPROVED`); rejection ends it at `REJECTED`.

- APIs: `POST workflowhandler/transition` · `workflow/v2/userWFApplicationFieldsSearch` · `workflowhandler/applicationsSearch`

### UC-6 · Remove an enrolled learner

After approval, an admin can remove a learner from the batch; the workflow
records `REMOVED` and the seat frees up.

### UC-7 · Create and configure a batch

From the Creation Portal, a batch is opened as `enrollmentType: "invite-only"`
with name, start/end/enrolment-end dates, seat cap, venue address and
lat-long, QR attendance on/off, instructors, cadre list and profile-field
requirements. If custom profile fields are chosen, the portal **auto-creates a
survey form** and stamps its link into the batch; a **default certificate
template is auto-attached** on creation.

- APIs: `POST learner/course/v1/batch/create` · `forms/v2/createForm` · `course/batch/cert/v1/template/add`

### UC-8 · Generate the batch enrolment report

Requester role is validated (MDO/PC roles only), then the report is generated
**asynchronously**: a request row goes to `IN_PROGRESS`, a Kafka consumer
joins workflow state with enrolment data, and the finished file is downloaded
per org/course/batch.

- APIs: `POST bp/v2/generate/report` · `bp/v2/bpreport/status` · `GET bp/v1/bpreport/download/:orgId/:courseId/:batchId/:file`

## Authoring & batch management (Creation Portal)

### UC-9 · Create and publish the program itself

Create → build hierarchy → send to review → publish (with reject and retire
paths). Assessments attach as question sets with their own review/publish cycle.

- APIs: `action/content/create` · `content/hierarchy/update` · `content/v3/review/:id` · `content/v3/publish/:id`

### UC-10 · Nominate & bulk-enrol learners

Admins can **nominate** learners into a batch (select or bulk-upload — the
workflow is created on the learner's behalf) or bulk-enrol directly. Users can
also be added to or removed from a batch individually.

- APIs: `workflow/blendedprogram/nominate` · `program/v2/admin/bulkEnroll` · `authApi/batch/addUser` / `removeUser`

### UC-11 · Work the request queue in the Creation Portal

The program's detail page has a "New requests" console: approve (with the
next-step message when a second approval is pending) or reject **with a
mandatory reason**. The pending queue can be exported as CSV.

- APIs: `v1/blendedprogram/workflow/update` · `GET workflow/blendedprogram/getUserApprovalDataInCsv`

### UC-12 · Run sessions and mark attendance

Sessions (offline or online) live in the batch's session plan. Attendance is
taken by **QR code** (per batch, downloadable, with scan status) or manually
in the attendance dialog — and marking attendance is a **progress write**:
attended = status 2 / 100% on the session node. Marking is time-boxed after
the session date.

- APIs: `blendedprogram/v1/update/progress` · `GET batch/v1/enrollment/qrcode/download` / `status`

### UC-13 · Track learners and certify

Per-batch learner progress is read in bulk (v2 endpoint); certificates ride
the batch template attached at creation and can be re-issued.

- APIs: `authApi/batch/getUserProgressV2` · `course/batch/cert/v1/issue?reIssue=true`

### UC-14 · Maintain the batch over its life

Batch details and attributes are editable after creation; an unused batch can
be deleted. Mandatory-profile-field options, cadre lists and the default
certificate template come from system settings.

- APIs: `authApi/batch/update` · `learner/course/v1/batch/delete` · `data/v2/system/settings/get/…`

## Edge cases

| Situation | Behaviour |
|---|---|
| Learner already in another Blended Program | Blocked client-side with a conflict message before any workflow is created |
| Batch full | Approved count checked via the status-count API against `currentBatchSize`; CTA disabled |
| Enrolment window closed | `enrollmentEndDate` gates the request button |
| Survey required but not submitted | Enrol call not made until the form is completed |
| Duplicate request | Existing workflow application fetched on page load; UI renders current state |
| Attendance marked late | Attendance dialog disabled once the window after the session date passes |
| Rejection without a reason | Not possible — the reject dialog requires a reason |
