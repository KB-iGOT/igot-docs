# Blended Program — Use Cases

API paths are written as the portals call them, with the gateway prefix
(`/apis/proxies/v8/…` on web, `/api/…` on mobile) stripped — see
[APIs](apis.md) for the full chain. "Web" means `sunbird-cb-portal` with its
`@sunbird-cb/toc` package; "mobile" means `igot_karmayogi_mobile`.

## Learner journeys

### UC-1 · Find a program and pick a batch (Learner)

A learner who is not yet enrolled sees the program's batches (all statuses
0, 1 and 2, newest first). Batches whose **enrolment end date** has passed
are not offered (web: dropped from the dropdown, day-inclusive; mobile:
removed from the in-memory list before counts are fetched). A batch with
**no** `enrollmentEndDate` is never enrollable on web. The default pick is
the first open batch on web, and the batch with the earliest open deadline
on mobile. Seat information comes from a per-batch status count: *enrolled*
is the number of `APPROVED` requests, *applied* is every status except
`WITHDRAWN`. The page warns at 80% full ("limited seats"), shows a "Full"
chip, and shows a program-level message when every active batch is full or
every enrolment window has closed.

- API: `POST learner/course/v1/batch/list` (web) · `POST course/v1/batch/list` (mobile) ·
  `POST workflow/blendedprogram/enrol/status/count`

### UC-2 · Clear the entry steps (Learner)

Before a request can be sent, up to four gates apply, in this order on web:

1. **Pre-enrolment requisites** — resources the author marked as
   pre-requisite (`preEnrolmentResources[]`). While a *mandatory* one is
   incomplete the request area and the seat counts are hidden and a
   "Pre-Enrollment Requisites" button takes the learner to it.
2. **Schedule-conflict check** (web only) — see the edge-case table: it is a
   client-side check that cannot see other programs.
3. **Profile form** — only if the batch sets `userProfileFileds` to anything
   other than `"Available user filled iGOT profile"`. The fields come from
   the batch's `bpEnrolMandatoryProfileFields`. If the batch has a
   `cadreList`, the learner's civil-service name must be in it, or the flow
   stops with an eligibility message (web does this only inside the profile
   step; mobile checks it whenever `cadreList` is non-empty).
4. **Program survey** — if the program has a `wfSurveyLink`.

Profile and survey answers are **saved before** the final confirmation, so
a learner who then cancels leaves them submitted. Closing either dialog with
the X aborts the request.

- API: `GET forms/v2/getFormById` · `POST forms/v2/saveFormSubmit` ·
  `POST content/v2/state/read` / `PATCH content/v2/state/update` (pre-requisite progress only)

### UC-3 · Request a seat (Learner)

A confirmation dialog states the batch dates. On confirm, the app calls the
enrol endpoint. The server re-checks everything the client cannot be
trusted with — volunteer eligibility, seat room (with a 20% over-subscription
buffer at this stage), schedule clash — and then writes a workflow row.
The response is immediate but the row is only `ENROLL_IS_IN_PROGRESS`: a
Kafka consumer moves it into the first approval state a moment later, and
the portal shows the pending state on its next fetch. The learner may be
told "Request sent successfully" a moment before the row reaches its first
approval state.

- API: `POST workflow/blendedprogram/enrol` (action `INITIATE`)

### UC-4 · Withdraw a pending request (Learner)

While the request is waiting for an approver the learner can withdraw it
(no reason is captured, on either client). Web disables the button once the
**first** approver of a two-step route has approved. Neither client offers a
withdraw after `APPROVED`. If the batch has already started and the request
is still not approved, web raises a "Request not approved — withdraw and
request another batch" prompt automatically. A withdrawal does **not**
un-enrol anyone: only a `REMOVED` row triggers an un-enrol call.

- API: `POST workflow/blendedprogram/unenrol` (action `WITHDRAW`, with `wfId`)

### UC-5 · Self-enrol by scanning a QR (Learner, mobile)

When the program's `selfEnrollment` flag is `Yes`, the mobile app replaces
the batch picker with a "scan to enrol" button. The QR (printed by the
coordinator) carries `{courseId, batchId}`; the app rejects it if the
course id differs or the batch isn't one of the program's batches, refuses
after the enrolment end date, refuses a full batch, and — if the batch has a
`latlong` — requires the phone to be within 1000 m of it. The profile form,
survey and confirmation sheet then run exactly as in UC-2, and the server
approves the request on the spot (no approver) and enrols the learner.

- API: `POST workflow/blendedprogram/qr/enrolments`

### UC-6 · Learn: self-paced content and sessions (Learner)

The **Start** button needs an `APPROVED` request *and* a batch in progress
(web: start date passed, end date not yet over, batch not completed). Until
then the page shows a countdown (to midnight of the start day, not to the
first session time). Content has two tabs — *Self-paced* and
*Instructor-led*; the latter lists the batch's `sessionDetails_v2` sorted by
date, with duration, type, handouts and resource links. Opening a session
(web) needs the learner to be enrolled; the batch-in-progress check only
greys the card.

- API: `POST learner/course/v4/user/enrollment/details` ·
  `POST read/content-progres/:courseId` · `PATCH content-progres/:contentId`

### UC-7 · Mark attendance by QR (Learner, mobile)

Attendance on mobile is a content-progress write on the **session node**.
The learner taps the session's QR icon; the app checks the session is live
(start to start + whole hours of the duration + 1 hour buffer), checks the
phone is within 1000 m of the batch `latlong`, scans a QR holding
`{courseId, batchId, sessionId}` and requires the session id and batch id
to match the tapped session. A batch with **no** `latlong` therefore cannot
mark attendance on mobile. On the web the learner only *sees* attendance
("marked @ time" when the session's status is 2).

- API: `PATCH course/v5/content/state/update` (`status 2`, `completionPercentage 100`)

### UC-8 · Submit an assignment (Learner)

The Assignment tab appears only for enrolled learners. The learner downloads
the assignment, uploads a **PDF** (web allows files under 6 MB by an integer
check, mobile 5 MB, the storage endpoint 5000 KB), previews it, and either
saves a draft or submits. Web makes a first-time learner press *Download*
before *Upload* becomes active, and its **Discard** button in the preview
actually saves a draft. Submitting notifies the instructor; once evaluated
the learner sees marks and feedback. There is no due date anywhere in the
learner code.

- API: `POST assignment/v1/search` · `POST forms/v2/submissions/search` ·
  `POST storage/v1/bp/assignment/answer/:contentId/:batchId/:formId` ·
  `PUT assignment/v1/submitDraft` · `POST assignment/v1/submit` ·
  `POST v1/notifyAssignment/submit`

## Approver & coordinator journeys (Creation Portal)

### UC-9 · Work the request queue (Program Coordinator)

The batch page's **New requests** tab lists `SEND_FOR_PC_APPROVAL` items for
the batch, oldest first. *Approve* asks "Are you sure?" and sends the
decision; *Reject* requires a reason (≤ 500 characters, HTML blocked).
For `twoStepPCAndMDOApproval` the success message adds "Further needs to be
approved by MDO admin". The console only acts on the PC step — it never
sends `SEND_FOR_MDO_APPROVAL` items. Tabs for *Rejected* requests and
*Approval status* (derived from the last `modification_history` entry) sit
next to it.

- API: `POST workflow/blendedprogram/searchV2/pc` · `POST workflow/blendedprogram/update/pc`

### UC-10 · Approve or reject in bulk by CSV (Program Coordinator)

The pending queue downloads as a CSV (`email, userName, wfId, userId,
action(approve/reject)`); the coordinator fills the `action` column and
uploads it back. The UI accepts ≤ 30 rows and requires the `userId` and
`wfId` headers. On the server every row is validated first (any bad row
rejects the whole file), then applied one by one, with the same seat, start
date and schedule rules as a single approval. The result comes back as a
CSV with an `Updated`/`Not updated` column.

- API: `POST workflow/blendedprogram/getUserApprovalDataInCsv` ·
  `POST workflow/blendedprogram/bulkApprovalDataFromCsv/:contentId`

### UC-11 · Act as MDO admin (MDO admin)

The workflow service has MDO-side endpoints (`update/mdo`, `searchV2/mdo`,
`read/mdo`, `remove/mdo`, `admin/enrol`) and the gateway whitelists them for
`MDO_ADMIN` / `MDO_LEADER`. **Verification boundary:** no screen in the
attached UI repos calls them — the Creation Portal console and the
`sb-cb-ui-components` service methods only call the `…/pc` variants — so
the MDO-side user interface (if one exists) is in a repo that was not
attached.

- API: `POST workflow/blendedprogram/update/mdo` · `searchV2/mdo` · `admin/enrol`

### UC-12 · Nominate learners (Program Coordinator, trainer, MDO admin)

A nomination places learners straight into a batch as `APPROVED`, bypassing
the approval route. The Creation Portal offers *Select learner* (search by
name or by organisation and designation) and *Bulk upload* (CSV with
exactly `Emailid` and `Mobilenumber` headers, ≤ 30 rows). The server caps a
call at 200 users, drops blank ids, the caller's own id and duplicates,
and per user returns `APPROVED`, `ALREADY_EXISTS`, `Batch Size Error`,
`Batch Start Date Error`, `SCHEDULE_CONFLICT`, `INVALID_APPROVAL_TYPE` or a
failure. A PC nomination **overrides** a pending MDO or self request for the
same learner; an MDO nomination overrides only a self request. The tab is
replaced by a notice once the enrolment end date has passed and is hidden
from instructors.

- API: `POST workflow/blendedprogram/nominate`

### UC-13 · Remove an enrolled learner (Program Coordinator, MDO admin)

Before the batch starts the coordinator can remove an approved learner from
the Learners tab. The row goes to `REMOVED` and the un-enrol is sent to the
course service. The web UI hides the remove icon after the batch start date.

- API: `POST workflow/blendedprogram/remove/approved/user` (header `isPc`)

### UC-14 · Mark attendance (Program Coordinator)

A session's attendance dialog opens from the batch's Sessions tab, enabled
from the **session's start date** until **batch end + 7 days**. The
coordinator marks each learner present or absent (bulk "all" buttons
exist); present writes `status 2 / 100%`, absent `0 / 0%` onto the session
node, then an "ATTENDANCE MARKED" email goes to each learner.

- API: `POST blendedprogram/v1/getUserContentProgress` ·
  `POST blendedprogram/v1/update/progress`

### UC-15 · Evaluate assignments and add new ones (Program Coordinator, instructor)

The Assignments tab lists a batch's assignments with pending-submission
counts; a coordinator adds an assignment as a PDF resource (≤ 5 MB, title
≤ 100 chars) and learners are told by notification. To evaluate, the
reviewer opens a learner's submission and enters marks (1–99 999, not above
the maximum) and feedback (≤ 500 chars). Deleting an assignment in the UI
removes it from the list only — nothing is sent to the server.

- API: `POST assignment/v1/create` · `POST v1/notifyAssignment/upload` ·
  `POST assignment/v1/feedback` · `POST v1/notifyAssignment/evaluate`

### UC-16 · Generate enrolment and consumption reports (Program Coordinator)

The Reports tab offers an **Enrollment Report** (v1) and a **Consumption
Report** (v2). Generation is asynchronous: a tracking row, a Kafka event, a
consumer that writes an Excel file. The UI has no status polling — the
coordinator presses refresh, which re-lists. The v2 report is an enrolment +
certificate report; it carries **no** session or attendance columns.
Attendance reporting is a separate nightly Spark job (see
[Operations Manual](operations-manual.md)).

- API: `POST bp/v1/generate/report` · `POST bp/v2/generate/report` ·
  `POST bp/v2/bpreport/list` · `GET bp/v1/bpreport/download/…`

## Authoring & batch management (Creation Portal)

### UC-17 · Author and publish the program (Author, reviewer, publisher)

Create the program from the "Program" tile with the *Blended Program* radio;
build the hierarchy (a Blended Program holds Modules, Resources, **Session
Templates** for offline sessions, and optional Pre/Final assessments — the
client strips the children of any Course node before saving); set
program-level fields (duration in days, director name, approval type,
self-enrolment flag, batch settings, up to 5 Program Coordinators); send
for review; review; publish (children first, then the parent). Reject
returns the program to Draft with a comment. A Live Blended Program is
retired only through the generic retire call — scheduled retirement is a
Course-only feature.

- API: `POST action/content/v3/create` · `PATCH action/content/v3/hierarchy/update` ·
  `POST action/content/v3/review/:id` · `publish/:id` · `reject/:id` ·
  `DELETE v1/content/retire`

### UC-18 · Staff the program (Program Coordinator, trainer)

The *Program Coordinator* page lists the program's coordinators; coordinators
and lead trainers can be added from the allowed types (the program's
`batchSettings`) and removed — unless they are the "Program Coordinator"
role, the caller themselves, or still own or co-train a batch that has not
ended.

- API: `POST program/coordinator/list/:doId` · `PUT program/coordinator/:doId` ·
  `GET program/coordinator/roles`

### UC-19 · Create a batch, with sessions (Program Coordinator, trainer)

The batch form takes name, size (1–200), start, end, **enrolment end**
(between today and the start date), venue address and `latlong` (required
when attendance is *Enable QR*, the default), state / district / PIN,
instructors, co-trainers, cadre restriction and the profile-field mode.
One session card per Session Template in the program collects date, start
and end time (inside the batch dates), facilitators, handouts and links.
Side effects: for programs created on or after `pbPhaseTwo`, a profile
survey form is created first; after the batch exists, co-trainers are added
to the program and the default certificate template is attached.

- API: `POST authApi/batch/create` · `POST forms/v2/createForm` ·
  `PUT program/coordinator/:doId` · `PATCH course/batch/cert/v1/template/add`

### UC-20 · Maintain a batch (Program Coordinator, trainer)

Name and size are locked on edit; changing the dates warns when sessions
fall outside them. Only the creator, a coordinator, or (for batch-owner
screens other than edit) a co-trainer may open a batch. A batch can be
deleted only **before its start date** — and deleting un-enrols every
learner and emails them. On an archived batch the only edit is adding
instructors.

- API: `PATCH authApi/batch/update` · `POST learner/course/v1/batch/delete`

### UC-21 · Print the QR codes (Program Coordinator)

Two different PDFs exist. The **self-enrolment QR** (only when the program
has `selfEnrollment = Yes`) carries `{courseId, batchId, selfEnrol:true}`;
the page shows only whether it has been generated. The **attendance QR** is
one page per offline session of the batch, each carrying
`{courseId, batchId, sessionId}`.

- API: `GET batch/v1/enrollment/qrcode/status|download/:doId/:batchId` ·
  `GET batchsesion/qrcode/:courseId/:batchId`

## Edge cases

| Situation | Behaviour |
|---|---|
| Learner is in another Blended Program with overlapping dates | The **web client check never fires**: it iterates the learner's enrolments, which the page fetches for this program only. The **server** is the real guard: a clash is rejected at enrol (HTTP 400 "Not allowed to enroll the user to the Blended Program since there is a schedule conflict") — and the same check runs on **every** later approve/withdraw call, where a hit silently turns the action into a **REJECT** |
| Existing batch fully encloses the new one | **Not detected** — the server tests only whether the existing batch's start or end falls inside the new batch |
| Batch full (learner request) | Server allows requests up to size + 20%; approval is capped hard at size (counting active enrolments). `currentBatchSize` of 0 or missing always reads as full |
| Batch full (nomination) | Hard cap, and the nominee's own pending requests are not counted |
| Batch full (the enrol call into the course service) | The workflow service re-checks the hard cap just before calling, but the course service's own single-user BP enrol does **not** check `currentBatchSize`; only its bulk-enrol paths do |
| Enrolment window | Web/mobile hide batches after `enrollmentEndDate`; the single BP enrol in the course service **ignores** `enrollmentEndDate` and closes at the end of the batch **start date** (IST) |
| Batch already started | Approvals are refused ("This batch is already in progress") unless the action is `REJECT`/`WITHDRAW`. `REMOVE` is *not* excluded, so removing an approved learner after start is blocked too |
| `currentBatchSize` stored as a JSON number | Treated as unreadable → batch reads as full. The Creation Portal stores it as a string |
| Volunteer role without an eligibility entry | HTTP 406 "User is not eligible to enrol into this course." |
| Withdrawal after approval | Not offered on web or mobile; and a `WITHDRAWN` row never un-enrols (only `REMOVED` does) |
| Reject with no reason | Blocked in the Creation Portal (reason required); the server itself does not require one |
| Duplicate request | The workflow service's ordinary learner enrol has **no** duplicate guard (admin enrol and QR enrol do). The web page renders from the latest request it can find; any other prevention would be outside the attached repos |
| Attendance | No time window on the server; the 7-day post-batch window is a Creation Portal button rule only; mobile's live-session window and 1 km fence are client-side |
| Batch with no `latlong` | No QR self-enrol geofence; **no mobile attendance** |
| Nominee already in the course on another batch | `ALREADY_EXISTS` |
| Assignment file | Extension-only check on the server (`pdf, doc, docx`); no content-type check; any signed-in user can read any answer file if they know the path |
