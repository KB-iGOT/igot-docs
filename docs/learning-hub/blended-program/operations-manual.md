# Operations Manual — Blended Program

How to operate, support and troubleshoot Blended Program as it exists in the
code today. **Source of this manual:** the pinned repos on the
[overview](index.md). No runbook, on-call document, dashboard definition or
alert rule for this feature was attached to the analysis, so everything below
is derived from code and config; a check that needs a deployed environment is
marked as such.

**Operational implication:** Blended Program is not a product with its own
control plane. It is a normal course collection plus an approval row in
Postgres, an enrolment row in Cassandra, a counter in Redis and a status on a
session node. Almost every "wrong learner state" ticket is one of those four
disagreeing with each other, and **there is no admin override endpoint** that
repairs them — you correct the underlying record or you re-drive the
workflow.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Approval state | Postgres `wingspan.wf_status`, one row per request, `application_id = batchId` | The first place to look for "where is this learner's request" |
| Enrolment | Cassandra `user_enrolments_v2` + `enrollment_batch_lookup`, written by an HTTP call from the workflow service after approval | Approved-but-not-enrolled is possible — see Troubleshooting |
| Approval route | Rows in LMS `system_settings` (`oneStepMDOApproval`, `oneStepPCApproval`, `twoStepMDOAndPCApproval`, `twoStepPCAndMDOApproval`) | Changing who approves is a data change, not a deploy; **not in any repo** |
| Seat counters | `course_batch.batch_attributes.currentBatchSize` (string), live counts from Postgres and Cassandra, a Redis hash for the program page | Three sources that can disagree |
| Attendance | A progress status on the session node; asynchronous via Kafka for coordinators | No attendance table to correct; fix the status |
| Reports | In-product v1 / v2 (Kafka + Excel) and a nightly Spark CSV | They answer different questions; v2 has no attendance |
| Authoring | Generic content lifecycle through `knowledge-mw-service` | Not subject to Kong rate / ACL plugins |

## Important fields

| Field | Where | Meaning | Why it matters |
|---|---|---|---|
| `primaryCategory` / `courseCategory` | content | `Blended Program` | Extended-read counters key off `courseCategory`, bulk-enrol's seat cap keys off `courseCategory`, the Creation Portal off `primaryCategory` |
| `wfApprovalType` | program | Which of the four routes applies | Required at publish; locked when Live; blank breaks nomination (`INVALID_APPROVAL_TYPE`) |
| `selfEnrollment` | program | `"Yes"`/`"No"` string | Gates the self-enrolment QR and the mobile scan button |
| `wfSurveyLink`, `wfClientVersion` | program | Enrolment survey, renderer version (`1.1` = in-house form) | Missing `surveys/` in the link → undefined survey id |
| `preEnrolmentResources[]` | program | Pre-requisites (`isMandatory`) | Hides the request area until done; also validated by the course service on enrol |
| `programDuration` | program | Days | Shown on cards |
| `currentBatchSize` | batch attr | **String** seat cap | 0, empty, missing or a JSON number reads as **full** |
| `enrollmentEndDate` | batch | Last day to request | Web/mobile hide the batch after it; a missing value hides the batch on web |
| `startDate` / `endDate` | batch | Batch window | Approval is refused after the start day; start gating |
| `latlong` | batch attr | `"lat, long"` | Required for mobile attendance and the QR geofence (1000 m) |
| `sessionDetails_v2[]` | batch attr | Session plan | `sessionId` must equal the Offline Session node id, or attendance and the session card never match |
| `status` | wf row | State | See [LLD](lld.md#1-the-workflow-row-and-its-states) |
| `in_workflow` | wf row | Open vs terminal | Nominated rows are saved `APPROVED` **with** `in_workflow=true` |
| `service_name` | wf row | Approval type after the first hop | Rows can show `blendedprogram` or the approval type |

## Operational workflows

**Open a batch for enrolment.** Create the batch from the program's Batches
page: size 1–200 (stored as a string), start ≥ today, enrolment end between
today and the start date, venue + `latlong` unless attendance is "Disable
QR". Confirm afterwards that the default certificate template attached (the
UI says nothing if the `defaultCertTemplate` system setting is missing) and
that the program has at least one Program Coordinator.

**Change a batch.** Name and size are locked in the UI; a direct API update
can lower `currentBatchSize` below the approved count with no check. Date
changes beyond the existing sessions are refused by the UI. Editing
`sessionDetails_v2` **replaces** the whole array.

**Cancel a batch.** Allowed only before the start date. It deactivates
every enrolment in the batch and emails all learners; there is no
"unused batch" check, and the course-service actor does not check who is
calling.

**Remove an approved learner.** Before the batch starts only (UI), via
`remove/approved/user`. The row becomes `REMOVED` and an un-enrol is sent
to the course service. Withdrawn and rejected rows never un-enrol.

**Bulk-approve.** Download the pending CSV, fill `action`, upload (≤ 30 rows
in the UI). Any invalid row rejects the whole file; each valid row runs the
full seat / start-date / schedule checks, so a "Not updated" row usually
means one of those. The exported file name is fixed server-side; avoid
simultaneous exports.

**Nominate.** ≤ 200 users per call (UI: 30 per CSV). Per-user results are
returned; remember that a PC nomination silently marks an earlier MDO / self
request `WITHDRAWN` before it checks anything else.

**Run attendance.** The button is live from the session's start date until
**batch end + 7 days**. Marking is asynchronous: the response is 200 as soon as the event is queued,
and the learner email follows only when the course service accepts the write.

**Reports.** Pick Enrollment (v1) or Consumption (v2) in the Reports tab,
generate, then press refresh — there is no polling. The Spark attendance CSV
is daily (05:25) and covers the previous day's data.

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| POST | `workflow/blendedprogram/search` · `searchV2/pc` | Find a learner's request by batch / status |
| GET | `workflow/blendedprogram/read/pc/:wfId` | One raw row |
| POST | `workflow/blendedprogram/enrol/status/count` | Status counts for a batch (≈ 1.8 s local cache) |
| POST | `workflow/blendedprogram/v1/stats` | Per-batch new / learner / rejected counts for a program's active batches |
| POST | `workflow/blendedprogram/remove/approved/user` | Remove an approved learner |
| POST | `workflow/blendedprogram/update/pc` · `update/mdo` | Re-drive a stuck approval |
| POST | `workflow/blendedprogram/getUserApprovalDataInCsv` | Evidence for a support case |
| GET | `course/v1/batch/read/:batchId` | Confirm `batchAttributes` (size is a string? `sessionDetails_v2` present?) |
| GET | `extended/content/v1/read/:id` | Program as the portals see it (counters appear here) |
| POST | `blendedprogram/v1/getUserContentProgress` | Session status per learner (2 = present) |
| POST | `bp/v2/bpreport/list` | Report rows and `status` |
| POST | `program/coordinator/list/:programId` | Who coordinates a program |

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Learner says "request sent" but sees no pending request | The first Kafka hop has not happened or failed; the row is at `ENROLL_IS_IN_PROGRESS` | `wf_status` row for `(batchId, userId)`; consumer lag on `workflowContentTopic` | Restore the consumer; a row that cannot hop (bad approval config or missing `wfApprovalType`) stays stuck and still counts toward the 20% buffer |
| Request is `APPROVED` but the learner has no enrolment | The enrol callback failed, or the batch was full at callback time (it silently does nothing) | Cassandra `enrollment_batch_lookup` / `user_enrolments_v2` for the user and batch; workflow service logs for the course-service call | If the batch has room, re-drive approval; otherwise raise the size first. Rows approved through the generic endpoint are **not** reverted automatically |
| Approve returns "This batch is full" although seats look free | `currentBatchSize` is 0 / missing / a JSON number, or the hard cap (active enrolments) is reached | `GET course/v1/batch/read` — is the value a quoted string? | Correct the attribute (string); remember size cannot be edited in the UI |
| Approve returns "This batch is already in progress" | The start-date window: approvals stop after the start day (IST) | Batch `startDate` | Business decision; use nomination only if policy allows — nomination applies the same window |
| Approve **rejected** the request with "Conflict, User already enrolled to different Blended Program…" | The schedule-clash check runs on every update and turns the action into a REJECT | The learner's other active batches; compare dates (inclusive) | The learner must withdraw from the clashing batch and request again. An *enclosing* existing batch is not detected, so the opposite complaint ("it let a clash through") is also real |
| "Withdraw" button missing / disabled | After `APPROVED`, or after the first approver of a two-step route has acted (web) | Request status and `service_name` | By design; to release the seat use remove-approved |
| Learner cannot start the program | Needs `APPROVED` request **and** a batch in progress; on web also the TOC must have loaded the request | Request status; batch dates; `batchData.status` | Wait for start. The web page fetches the request *after* the batch list (it needs the batch ids), so confirm the request row exists and is `APPROVED` before suspecting the batch |
| Batch not offered to a learner | Enrolment window closed, or `enrollmentEndDate` missing (web), or `currentBatchSize` 0 | Batch attributes | Fix the dates / size |
| Learner reports "limited seats" or "full" wrongly | Client counts: "enrolled" = APPROVED only, "applied" = all but WITHDRAWN; Full chip uses strict equality | `enrol/status/count` for the batch | Informational; server decides at request time |
| Nominate says `SCHEDULE_CONFLICT` / `ALREADY_EXISTS` / `Batch Size Error` | See LLD §4 | Per-user result array | A PC nomination may already have withdrawn the earlier row — check `modification_history` |
| Nominate fails for every user with `INVALID_APPROVAL_TYPE` | The program has no `wfApprovalType` | Program read | Set the type (it is locked once Live: a content update is needed) |
| Coordinator cannot see the program in "My programs" | No document for them in ES `user_program_lookup_v1`, or the sync topic is lagging | `program/coordinator/list/:programId`; ES doc `_id = userId`; consumer on `cb.program.coordinator.sync` | Re-save the coordinator list (the sync fires on change); check the consumer |
| Coordinator service fails to start | Startup needs a role named "Program Coordinator"; shipped DDL does not seed it | `program_coordinator_role` rows | Insert the row |
| Attendance marked but learner card shows "unmarked" | Write is asynchronous / rejected downstream; `sessionId` mismatch; web caches progress | Session status via `getUserContentProgress`; compare `sessionDetails_v2[].sessionId` to the Offline Session node | Re-mark; confirm ids; note a bad `contentId` aborts the write silently |
| Mobile attendance / QR enrol refused | Session not live (start → start + whole hours + 1 h), phone > 1000 m from `latlong`, batch has no `latlong`, QR for another session / batch | Batch attrs; session time; location permission | Fix `latlong`; the QR PDF's `courseId` holds the program **name** (mobile ignores it) |
| QR self-enrol says expired | After `enrollmentEndDate` (mobile) or after the batch start day (server) | Dates | Business decision |
| Self-enrolment QR "not generated" | Generation flips `selfEnrolQrGenerated`; requires `selfEnrollment = Yes` | Program flag; batch attr | Generate it again from the batch page |
| Report "not available" after generating | v2 returns 200 with that text until a row completes; row `IN-PROGRESS` (hyphen) blocks re-requests | `bp/v2/bpreport/list`; Kafka consumer for `bp.report.generation` | Wait or reset the row; consumer failures leave the row at `IN-PROGRESS` |
| v2 report is missing the last learners | Defect: last page dropped when a batch has > 100 workflow rows | Row count vs report | Use v1 or the Spark CSV; engineering fix |
| Attendance missing from a report | v2 has none; the Spark CSV is previous-day data | Report type; time of day | Use the nightly CSV or the warehouse `bp_enrolments` |
| Assignment upload rejected | Extension not in `pdf,doc,docx`, > 5000 KB, or the web PDF-only / 5 MB check | File | Ask for a PDF under 5 MB |
| Learner cannot reach the assignment | Tab only shows for enrolled learners; web needs *Download* first | — | By design |
| Batch deleted by mistake | Delete un-enrols all learners and emails them | Course-service logs | Re-enrol via nominate once a replacement batch exists |
| Mobile "Request to enroll" does nothing | `requestToEnroll` throws an unhandled string on non-200 | Network log | Server message is not shown; reproduce via API |
| Program missing from Learn hub | Mobile home filter uses `batches.enrollmentEndDate`; search `courseCategory = blended program` | Content status Live; batches | Check publish and batch dates |

**Diagnostic sequence.** Identify the batch id and learner id →
`course/v1/batch/read` (size string, dates, `sessionDetails_v2`) →
`search`/`read` the workflow row (status, `service_name`,
`modification_history`) → check the Cassandra enrolment → check Kafka
consumers for the workflow topics → check the Redis counter and
`extended/content/v1/read` only for "counts on the program page look wrong".
The portals compare the *latest* request across **all** batches of the
program, so one old rejected row can mask a newer pending one in the UI.

Illustrative read-only check (table and column names are from the entity
and queries in the workflow repo; the Postgres DDL is not in any repo, so
verify before running):

```sql
-- requests that never left the entry state
SELECT wf_id, userid, application_id, current_status, lastupdated_on
FROM   wingspan.wf_status
WHERE  current_status IN ('ENROLL_IS_IN_PROGRESS','ADMIN_ENROLL_IS_IN_PROGRESS')
ORDER  BY lastupdated_on;

-- how many seats the request-time check sees for a batch
SELECT current_status, count(*) FROM wingspan.wf_status
WHERE  application_id = '<batchId>' GROUP BY current_status;
```

## Configuration

| Setting | Default | Effect | Where |
|---|---|---|---|
| `bp.batch.enrol.limit.buffer.size` | 20 (%) | Request-time over-subscription | workflow env |
| `bp.batch.full.validation.exclude.states` | `REJECT,WITHDRAW,REJECTED,WITHDRAWN,REMOVED` (devops adds `REMOVE`) | Which statuses are not seats / skip start-date checks | workflow env — **keep repo and env aligned: with and without `REMOVE` changes whether removal after start works** |
| `blended.program.enrol.*` messages | "This batch is full", "…already in progress", "Conflict, User already enrolled…" | User-visible messages | workflow env |
| `kafka.topics.workflow.request` / `.notification` | `workflowContentTopic` / `workflowNotificationTopic` (`{env}.` prefixed) | State hops and emails | workflow env |
| `enrol.status.count.local.cache.*` | `10000` / `30` | Count cache (unit bug → ≈ 1.8 s) | workflow env |
| `bp_batch_stats_cache_index` / `bp.batch.stats.cache.index` | 2 | Redis DB for the counters — **must match in course service, workflow and knowledge-platform** or counts read zero | three services |
| `extended.content.enrichment.fields` | repo omits `batches`; devops includes it | Whether the program page gets batch counters | knowledge-platform env |
| `admin_program_enroll_allowed_primary_category` | env includes `Blended Program` | Whether bulk enrol works for Blended Programs | course service env |
| `bp.assignment.answer.file.upload.*` | 5000 KB, `pdf,doc,docx` | Answer file limits | `sunbird-cb-ext` env |
| `kafka.topic.bp.report`, `bp.report.*` | see LLD | Report generation | `sunbird-cb-ext` env (a second deployment, `cb-ext-assessment-service`, carries the same keys — confirm which one runs the report) |
| `program.coordinator.*` | see LLD | Coordinator roles, sync topic, index | `sunbird-cb-ext` env |
| `progress.api.update.endpoint` | repo `/v1/…`, deployed `/v2/content/state/admin/update` | Which course-service route attendance uses; the `/v2` route needs a valid user token | `sunbird-cb-ext` env |
| `window.env.pbPhaseTwo` | deploy-time | Programs created before this date get no profile survey, cadre or custom fields | Creation Portal env |
| System settings `multilevelBPEnroll`-family, `bpEnrolMandatoryProfileFields`, `cadreConfig`, `defaultCertTemplate` | stored in LMS `system_settings` | Approval routes, profile-field master, cadre list, default certificate | database |
| `${sitePath}/feature/batch-approval-workflow-config.json`, `auth-create.json`, `certificate.json`, `feature/toc.json` | static assets | Approval-type choices, program-duration limits, certificate defaults, TOC texts and tabs | portal builds |

There is **no Blended-Program-specific feature flag** in the devops
templates. The mobile Assignment tab is controlled by a remote TOC config
entry (`blendedProgramAssignment`); a missing entry means enabled.

## Monitoring

Nothing in the repos defines a dashboard or alert for this feature. What the
code gives you to watch:

- **Kafka consumers** — `workflowContentTopic-consumer`,
  `workflowNotificationTopic-consumer`, the V2 pair, `bpReportGenerationGroup`,
  `updateContentProgressAsyncHandlerGroup`, `cb-ext-course-service-coordinator-sync`.
  There is no retry or dead-letter queue in code; a failed message is
  logged and dropped.
- **Stuck rows** — `ENROLL_IS_IN_PROGRESS` older than a few minutes;
  report rows left `IN-PROGRESS`.
- **Disagreement** — `APPROVED` rows without a matching
  `enrollment_batch_lookup` entry.
- **HTTP** — 400 "This batch is full", 400 "already in progress", 400
  schedule clash, 406 volunteer eligibility, 403 on nominate; uiproxy 403 for
  routes missing from the whitelist (`qr/enrolments`, `v1/attendance/update`
  and the dead Kong `update` / `remove` URIs).
- **Kong** — every route has its own hourly rate limit (e.g. `v1/stats`
  1000, `composite/v4/bp/search` 100000, the rest 5000) and request-size
  limit (bulk CSV: 1 MB; answer upload: 400 MB at Kong, 5000 KB in the app).

## Known operational constraints

- No admin endpoint to force-approve, un-reject, re-run a hop, or repair a
  counter; re-drive through the normal update call.
- The Redis counters only increment; they are display-only and drift.
- Roles listed in the approval JSON are not enforced by the workflow
  service — authorisation is the uiproxy whitelist and the Kong ACL, so a
  mis-set ACL is a security issue, not a UI issue.
- Single-user enrolment in the course service ignores `currentBatchSize`;
  protection is the workflow service and the portals.
- Attendance has no server-side role, ownership or time-window check.
- Assignment answer files can be read by any signed-in user who knows the
  path.
- Authoring calls skip Kong's plugins (they go to `knowledge-mw-service`).
- Anything derived from the live system-settings rows, the forms service or
  the downstream completion / certificate jobs cannot be verified from the
  repos.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Approval hops, seat / start-date / clash rules, nomination, QR enrol, emails | Workflow service team (`sunbird-cb-workflow`) | Row stuck, wrong state, wrong rejection reason, counts wrong |
| Enrolment record, batch CRUD, progress / attendance write, bulk enrol | Course-service team | Approved-but-not-enrolled, batch delete side effects, attendance not persisted |
| Reports, QR PDFs, attendance email, answer files, coordinator service | `sunbird-cb-ext` team | Report stuck, wrong PDF, coordinator sync, upload failures |
| Program page, batch picker, gates, status text | Web portal team (`sb-cb-ui-toc`) | Client logic wrong while server state is right |
| Authoring, batch / session forms, console | Creation Portal team | UI blocks a valid action |
| Mobile flows (QR, geofence, assignments) | Mobile team | Server state right, app wrong |
| Gateway whitelist / ACL / rate limits | Platform / devops (uiproxy, Kong) | 403 / 429 on a valid role |
| Search / coordinator lookup / counters on program read | Content-platform team | Index doc present but program not found; counters zero |
| Nightly Spark CSV / warehouse | Data engineering (`cb-core-data`) | Missing file, wrong attendance |
| System-settings rows (approval routes, profile fields, cadre, certificate) | LMS / platform admins | Route wrong, field list wrong |

## FAQ

**Why can a learner be "approved" but not enrolled?** Because approval and
enrolment are two steps joined by a Kafka message and an HTTP call. If the
call fails, or the hard seat cap is already reached when it runs, the
row stays `APPROVED` and nothing writes the enrolment (the Blended
Program endpoint at least reverts the row; the generic one does not).

**Why did approving someone reject them?** The schedule-conflict check runs
on every update call, not just at request time, and rewrites the action to
`REJECT`.

**Why do the seat numbers differ between the page, the approver and the
report?** The page counts `APPROVED` (enrolled) and everything but
`WITHDRAWN` (applied); the request-time check counts live rows plus a
20% buffer; the approval check counts active Cassandra enrolments; the
report counts `wf_status` rows.

**Is there an attendance table?** No. Attendance is `status 2` on the
session node's progress; correct it by re-marking.

**Can support change the approval route?** Only by editing the
system-settings rows, which are not in a repo. The route is chosen by the
program's `wfApprovalType`.

**Why does the Reports tab have no progress bar?** The UI never calls the
status endpoints; refresh re-lists.

> **Verification boundary:** this manual is sourced from the same repos as
> the rest of this feature's documentation. No operations / runbook source,
> on-call document, monitoring definition or deployed-environment access
> was attached, so thresholds, dashboard names and owners above are
> inferred from code ownership and service names — confirm owners with the
> platform team. Behaviour that depends on the stored `system_settings`
> rows, the Postgres / Cassandra DDL, the forms and assignment services and
> the downstream completion / certificate jobs is not verified.
