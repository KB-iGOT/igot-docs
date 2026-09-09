# Operations Manual — Peer Validation

How to operate, support, and troubleshoot Peer Validation — a feature split
across three independently-owned backends (`form-service`,
`cb-notification-service`, `sunbird-cb-ext`) with no single owning service
and no shared transaction boundary between them.

**Operational implication:** a single user-visible request can require
checking up to three different backend deployments and three different
data stores (an Elasticsearch document, two Cassandra tables, and a
generic notifications table) to get the full picture.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Ownership | Split across 3 backend services, no single "peer validation service" | Triage may need logs from more than one deployment |
| State source of truth | 3 independently-updated stores | The same logical request can look different depending which store you query |
| Expiry | Computed at read time only, never persisted | A request can display `EXPIRED` via the list API while its Cassandra row still says `PENDING` |
| Cleanup job trigger | External HTTP call; no scheduler exists in any of these repos; the endpoint requires no auth header | Cleanup only runs when something external calls it |
| Report storage | CSV lands in a "public" cloud container; only its tracking row TTLs out after 24h | The file itself is never deleted by any code path found |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `peer_validation_requests.status` / `peer_validation_reviews.status` | PENDING / SUBMITTED / APPROVED / REJECTED / free-form | First thing to check when triaging "did the action register" |
| `user_survey_report.status` | IN_PROGRESS / COMPLETED / FAILED | Tells whether a report request is stuck |
| `user_survey_report.errormessage` | Populated only on FAILED | First place to look when a report fails |
| `FormSubmissionDocument.peerReviews[].status` | "NA" until a peer acts, then APPROVED/REJECTED | The per-peer decision record — lives in Elasticsearch, not Cassandra |
| `peer_validation_cleanup_failures.failure_reason` | Recorded as `"DELETED: <table>"` per successful deletion | Despite the name, this table logs cleanup **deletions**, not failures — a real processing failure only shows in application logs |

## Operational workflows

**Submit**: learner opens the survey prompt → fills questions → optionally
attaches a PDF/MP4 → names 2–3 peers → submit creates the Elasticsearch
document and fires the notification events.

**Assign**: there's no separate admin-driven assignment step — the learner
names their own peers at submission time.

**Decide**: a named peer opens the request, reviews the submission and any
attachment, and approves or rejects — a one-shot, unchangeable action.

**Escalate**: no workflow exists. If a peer never acts, the request stays
`PENDING` until the (display-only) expiry window passes — nothing
reminds, reassigns, or escalates it.

**Close**: there's no explicit "close" action — a request rests once it
reaches SUBMITTED (request side) or APPROVED/REJECTED (review side), or is
removed by the daily cleanup job.

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| GET | `v1/notifications/peervalidation/list` | Diagnose "user says they don't see the request" |
| PATCH | `v1/notifications/v2/read` | Understand what values the client can actually send here |
| POST | `v1/notifications/cleanup/peer-validations` | Force the daily cleanup to run — blocks until the full scan finishes; needs no auth token |
| GET | `peerValidation/v1/list/report` | Check whether a stuck report is IN_PROGRESS/FAILED |
| POST | `storage/v1/peervalidation/report/download` | Manually retrieve a completed report if the UI download fails |

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Request shows EXPIRED but the peer can still act on it | Expiry is display-only, computed at read time | Query the raw Cassandra `status` directly | Expected as-built behaviour — document for support, not a bug |
| Report stuck IN_PROGRESS indefinitely | A malformed Kafka payload was silently dropped, or the consumer stopped before its shutdown hook ran | Check the `report.download.requests` topic; check the tracking row's age vs. the 24h TTL | If the TTL is close to expiring, re-trigger (respecting the 1h/24h throttle) |
| Peer review "won't save" | Already APPROVED/REJECTED (terminal-state guard) | Check the current status directly | Confirm with the user whether they already decided — there's no override |
| Cleanup job deletes nothing | Kafka topic retention shorter than the lookback window — the job replays yesterday's topic, it doesn't query Cassandra directly | Compare topic retention to the configured lookback (default 1 day) | Increase topic retention if cleanup must reliably find prior-day events |
| Two admins in the same department both see the same report request | The report list isn't scoped to who requested it | Confirm via the tracking row's requester field | Expected as-built behaviour |
| Download works without an expected access prompt | Reports/attachments resolve into a public cloud container with a raw stored URL | Check whether the URL is signed/expiring or a bare public path | Confirm the intended access model with the storage/infra team |

## Checklists

**Running the cleanup job manually:**
- [ ] Confirm intent — deletion is not soft or reversible
- [ ] Confirm Kafka topic retention covers the target day (the job replays the previous day's topics)
- [ ] Expect the call to block until the job finishes, not return an async 202
- [ ] Check the cleanup-failures table afterward for expected deletion counts (remember: it logs deletions, not failures)
- [ ] Note the endpoint takes no auth token — apply any network-level restriction your environment needs

**Manually re-triggering a stuck/failed report:**
- [ ] Confirm the existing tracking row's status and error message, if any
- [ ] If IN_PROGRESS and older than 1 hour, a new request is already allowed
- [ ] If COMPLETED within the last 24 hours, a new request will be refused (409)
- [ ] After re-triggering, poll the report-list endpoint — generation is fully asynchronous

## Known operational constraints

- No escalation or reminder workflow for an unreviewed request.
- No resubmission workflow after a rejected review.
- No scheduler for the cleanup job anywhere in these repos — it depends on
  an external trigger.
- No per-requester scoping on the report list — any admin in a department
  sees every report request for it.
- No confirmed signed/expiring URL scheme for downloaded reports or
  attachments — they resolve into a configured public cloud container.
- No automatic deletion of generated CSV files — only the tracking row
  expires.
- No shared RBAC module across the three backend services — each
  re-implements its own role/org check independently.
- A learner naming themselves, or the same peer twice, is not blocked.

**Operating model**: treat Peer Validation as three loosely-correlated
subsystems, not one feature with one log to check — triage by comparing the
Elasticsearch submission document (the most authoritative source for "did
they submit / what did the peer decide") against the Cassandra tracking
rows it should be mirrored into.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Survey creation/state-machine/validation | form-service team | Create/update/publish/archive/end fails unexpectedly, or trigger-window/question-cap rules need changing |
| Notification not received / status stuck | cb-notification-service team | The tracking row doesn't match the expected state, or a consumer's error topic shows failures |
| Report generation/download | sunbird-cb-ext team | A tracking row shows FAILED, or download 404s/403s unexpectedly |
| Gateway routing/role-check | sunbird-cb-uiproxy team | A request never reaches the backend, or an expected role gets a 403 |
| Web wizard/dialog | sunbird-cb-portal team | Submission UI breaks, wrong step order, client/server validation mismatch |
| Mobile wizard/notification | igot_karmayogi_mobile team | The mobile submission wizard, review screen, or notification popup misbehaves |
| Admin dashboard behaviour | Owner of `@sunbird-cb/consumption` | The issue is in the actual MDO/SPV screens, not the routing wrapper — those screens ship in an external, unvendored library |

## FAQ

**A learner submitted, but the named peer says they never got a
notification. Where do I look first?** Check the peer's row in the
notification-tracking table for that request. If it's missing entirely,
check whether the submission event actually reached the notification
service — the bulk-create step can silently skip a user who has
notifications disabled.

**The report says COMPLETED but the admin can't download it.** Check
whether the tracking row has already TTL'd out of Cassandra (24h) — if so,
the list endpoint won't show it even though the file may still exist in
cloud storage.

**Can a rejected submission be resubmitted?** No — a rejected review is
terminal in the current implementation; there's no path that lets the
learner submit again for the same request.

**Why do the MDO and SPV admin portals seem to behave slightly
differently even though their routing code looks nearly identical?** They
pin two different versions of the external `@sunbird-cb/consumption`
library, which is where the actual dashboard/create-edit screens live —
these two repos only wire routes to it.

> **Verification boundary:** this manual is sourced from the same repos as
> the rest of this feature's docs. Deeper operational detail for the
> external `@sunbird-cb/consumption` library and Kong's own routing rules
> would need those systems' own documentation attached.
