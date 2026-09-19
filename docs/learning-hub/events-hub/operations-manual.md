# Operations Manual — Events Hub

How to operate, support, and troubleshoot Events Hub as it exists today —
a content type (`Event`/`EventSet`) layered on Course-style enrollment
infrastructure, but with **three separate enrollment implementations**
and **duplicated certificate/karma-point logic** rather than one unified
pipeline.

**Operational implication:** never assume "check the enrollment table"
has one answer. Which table holds a given user's enrollment for a given
event depends on which of the three enrollment endpoints was used.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Content storage | Neo4j graph node, same as Course/Collection | Content-level issues (name, schedule, status) are graph-engine issues, not a bespoke Event DB |
| EventSet children | Full Event nodes, torn down and recreated on every EventSet update | A "failed" EventSet update can leave orphaned or missing child Events — check the EventSet's hierarchy read after any update |
| Enrollment | Three separate code paths, two separate tables (`user_entity_enrolments` vs. the Course enrolment table) | Support must know which endpoint the client used before querying enrollment state |
| Consumption | Shared table with Course (`user_content_consumption`) | Consumption issues affecting both courses and events at once point at this shared table |
| Certification | Four independent trigger points, all hard-coding 100% completion | A "wrongly issued" certificate complaint is not a computation bug — the system never checks real completion at issuance time |
| Karma points | Two independently-written Kafka producers, no idempotency check in this codebase | Re-running a bulk-onboard or reconciliation job can double-award points unless the downstream consumer de-dupes |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `objectType` (`Event`/`EventSet`) | Content-type discriminator | Drives which actor handles the node |
| `trackable.enabled`/`autoBatch` | Governs auto-batch creation | `knowledge-platform-jobs`' post-publish `BatchCreation` reads this |
| `status` | Lifecycle state | EventSet: `Draft/Live/Retired` only. Event: also `SentToPublish/Rejected/Cancelled` — but the transition into `SentToPublish` was not found in any traced create path (see As-Built) |
| `schedule.value` (EventSet) | Occurrence list driving child-Event generation | The schema file names this field `nonRecurringDetails` — **do not trust the schema for this field**, trust the actor code |
| `versionKey` | Optimistic-concurrency token | Required on every Event update |
| `batchAttributes` (event_batch) | Batch-level config (start/end time, duration, min completion %) | Drives certificate-eligibility checks downstream |

## Operational workflows

**Authoring (Org Portal)**: create → `event/v4/create` → **immediate**
`event/v4/publish` with `status:"Live"`. There is no observed
"submit for review" step in this flow — if a support ticket says an event
"disappeared into review," check whether it was actually created through
a different path than the standard Org Portal form.

**Review (Creation Portal)**: dashboard queries `status:'SentToPublish'`
as "New Requests." If nothing ever lands there, the discrepancy above is
the first thing to check — confirm with the backend/content team whether
something server-side sets that status independently of the client
request.

**Enrollment triage**: determine which endpoint the client used
(`/v1/event/enroll`, `/v2/event/enroll`, or `/v1/eventset/enroll`) before
querying enrollment state — each writes a different table:

- `/v2/event/enroll` → Cassandra `user_entity_enrolments`
- `/v1/eventset/enroll` → the Course enrolment table (`UserCoursesDao`),
  keyed by `eventId` as if it were a `courseId`
- `/v1/event/enroll` → same Course enrolment table, via the fully generic
  Course actor

**Bulk onboarding (cb-ext)**: upload triggers async Kafka processing
(`dev.public.user.event.bulk.onboard`) — check job status via `GET
/user/event/bulkonboard/status/{eventId}` before assuming a stuck upload
failed; the consumer is fire-and-forget (`CompletableFuture.runAsync`)
with only log-level error surfacing, so a partial failure won't show up
as an API error to the uploader.

**Post-consumption reconciliation (cb-ext, manual/on-demand only)**:
`POST /user/event/postConsumption` recomputes completion from the event
batch's actual end time, then issues a certificate (if none exists) and
**always** re-pushes a karma-point event — running this twice for the
same rows will double-award points, since there is no idempotency guard.
The companion `/updateStatus` endpoint has a known operator-precedence
bug (see Troubleshooting) — verify its output manually before trusting a
bulk status-reset.

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| GET | `event/v4/read/{id}` (knowledge-platform) | Confirm stored Event metadata/status |
| GET | `eventset/v4/hierarchy/{id}` | Live-read an EventSet's current children — no cache to worry about being stale |
| GET | `user/event/read/{userId}?eventId=&batchId=` | Check enrollment via the "v2" path's table |
| POST | `/v1/user/event/state/read` (course-service) | Check consumption/progress |
| GET | `/user/event/bulkonboard/status/{eventId}` | Diagnose a bulk-onboard job |
| GET | `/user/event/bulkonboard/download/{fileName}` | Retrieve the per-row result CSV (Status/Error columns) |
| POST | `/user/event/postConsumption/updateStatus` | Corrective rollback for wrongly-completed enrollments — verify output manually (see bug below) |

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Event created but never appears in Creation Portal review queue | Org Portal create flow publishes directly, bypassing any `SentToPublish` state | Event's `status` field | Escalate to backend/content team — this is the primary known deviation in this feature |
| "Is this user enrolled?" gives conflicting answers across surfaces | Enrollment written to one of two tables depending on which endpoint was used | Which enroll endpoint the client called | Check `user_entity_enrolments` **and** the Course enrolment table before concluding "not enrolled" |
| EventSet update leaves stale/missing child events | Update tears down and recreates all children; a mid-operation failure can leave a partial state | `eventset/v4/hierarchy/{id}` vs. expected schedule | Compare live hierarchy to intended schedule; may need manual child recreation |
| Certificate issued despite low/no actual attendance | Every issuance path hard-codes 100% completion | Which of the 4 trigger points fired | Not a bug in computation — there is no computation; escalate as a product gap if this needs fixing |
| Karma points awarded twice for the same event | Bulk-onboard or post-consumption reconciliation re-run without a de-dup guard | Kafka publish history on `dev.karma.points.unified.v2.event` for the affected user/event/batch | No repo-level fix available in `sunbird-cb-ext` alone — de-dup must happen downstream, or avoid re-running the same CSV/reconciliation job |
| `postConsumption/updateStatus` behaves inconsistently | Operator-precedence bug in `processRecordForStatus` — the intended `status==2 AND no-cert` check actually short-circuits incorrectly and can NPE on a null `issuedCertificates` list | Application logs for NPEs during this call | Treat output as unverified; check affected rows manually before trusting a bulk reset |
| Standalone Event update/publish/retire/discard rejected with "part of an Event Set" | Correct, intentional behaviour | Confirm the Event has an inbound `EventSet` relation | Route the change through the parent EventSet's own APIs instead |
| Event batch dates/mentors need correcting post-creation | `EventBatchDao` has no `update()` method — only create + cert-template mutation | Confirm no update path exists | This is a genuine capability gap, not a misconfiguration — escalate as a feature request if needed |

## Known operational constraints

- No single source of truth for "is this user enrolled" — three
  enrollment paths, two tables.
- No way to update an event batch's core fields (dates, mentors,
  enrollment type) after creation — only certificate templates are
  mutable post-create.
- No idempotency protection for karma-point awarding within
  `sunbird-cb-ext` — safe re-run of bulk/reconciliation jobs is not
  guaranteed.
- No server-side check of actual attendance/consumption before
  certificate issuance, on any of the four trigger points.
- EventSet hierarchy reads always hit Neo4j directly — no caching layer
  to consider when diagnosing read-path slowness, unlike Course.
- A hardcoded API key exists in `sunbird-cb-uiproxy`'s
  `event-external.ts` — flagged for the security/platform team, not an
  operational workaround.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Event/EventSet content CRUD, publish, hierarchy | Content platform team (`knowledge-platform`) | Graph-level create/update/publish fails or hierarchy is inconsistent |
| Enrollment discrepancies across the three paths | Course/enrollment backend team (`sunbird-course-service`) | Enrollment state disagrees between surfaces |
| Bulk onboarding, calendar bulk-upload, karma points, post-consumption reconciliation | `sunbird-cb-ext` service owner | Kafka-driven bulk jobs stall or produce wrong per-row results |
| Org Portal authoring / Creation Portal review disagreement on status | Frontend + backend jointly | The `SentToPublish` gap needs a real design decision, not a one-sided fix |
| Certificate correctness | Cross-team (course-service + cb-ext + downstream cert registry) | Any request to make certificate issuance actually check completion |

## FAQ

**Why does checking one enrollment table sometimes miss a user who I know
enrolled?** Because there is no single enrollment table for events —
check which endpoint was used first.

**Why did a bulk-onboard CSV upload not error out even though some rows
failed?** The consumer is fire-and-forget; per-row failures are recorded
in the result CSV (download via the status/download endpoints), not
surfaced as an API-level error.

**Can I manually force an event into the Creation Portal's review
queue?** Only by directly setting its `status` to `SentToPublish` via a
generic content update — no UI flow currently produces that state.

> **Verification boundary:** sourced from the same 8 repos as the rest of
> this feature's docs. Not analysed: the Kong gateway configuration
> connecting uiproxy to cb-ext, any downstream consumer of the
> karma-points/certificate-issuance Kafka topics, and the external
> certificate-registry service itself. Attaching those systems' own
> operations docs would close these gaps.