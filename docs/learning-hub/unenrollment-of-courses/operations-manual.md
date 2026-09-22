# Operations Manual — Unenrollment of Courses

How to operate, support, and troubleshoot unenrollment as it exists today —
a single boolean flip on the generic enrolment record, with a mobile-only
learner UI, one live email notification path, one dead in-app notification
path, and a reporting job of unverified schedule status.

**Operational implication:** most of what looks like "the unenroll feature"
from the outside is actually mobile-side UX polish sitting on top of a
thin, generic backend write. There is no separate unenroll subsystem to
check in isolation.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Backend write | `active: false` on `user_enrolments` + `enrollment_batch_lookup`, via the same actor as enroll | Any enroll-path Cassandra/DAO issue also affects unenroll |
| Client parity | Full UX on mobile only; web has no plain-course unenroll UI at all | A web-reported "I can't unenroll" ticket may simply mean the feature doesn't exist there — not a bug |
| Notifications | Two systems: a live email path (config-gated) and a fully-built-but-never-called in-app path | Don't assume an in-app "you've unenrolled" notification will appear — it can't, nothing triggers it |
| Reporting | `unenrollmentReport.py` reconstructs unenroll events from an audit table, but isn't wired into `jobs/main.py` | If MDOs report a missing/stale unenrollment report, first confirm whether this job actually runs anywhere, since static code doesn't show it being scheduled |
| Certification | Not checked at all during unenroll | A learner can be blocked from unenrolling by "already completed" even with no certificate ever issued |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `active` (user_enrolments) | `true` = enrolled, `false` = unenrolled | The entire state of this feature is this one column |
| `status` (user_enrolments) | `0/1/2` = not-started/in-progress/completed | `status == 2` is what blocks unenroll — check this first when a learner reports being unable to unenroll |
| `enrollmentType` (course_batch) | `open` / `invite-only` / other | Anything else blocks unenroll (and enroll) entirely |
| `workFlow.wfItem.currentStatus` (blended program, web/mobile only) | Approval-chain state | Governs whether the *different* "withdraw" action is even offered — irrelevant to plain-course unenroll |
| `SUNBIRD_COURSE_BATCH_NOTIFICATIONS_ENABLED` | Config flag | Whether the (only working) unenroll email fires at all |

## Operational workflows

**Learner-initiated unenroll (mobile only)**: menu eligibility check
(client-side) → confirmation sheet → mandatory reason capture → `POST
/api/course/v2/unenroll` → backend precondition chain → write → email
(if enabled). There is no "undo" — the only recovery is re-enrolling, which
is a fresh enroll, not a state restore.

**Admin-forced unenroll**: `POST /v1/course/admin/unenroll` exists and uses
the identical actor logic, but no traced UI calls it. If this route is
used operationally, it must be invoked directly (e.g. via an internal
tool or script) — the same precondition chain (including "already
completed") still applies.

**Web support requests**: since web has no plain-course unenroll UI, any
support request asking "how do I unenroll on the portal" for a plain
course has no self-service answer in the current build — route it to
either the admin-unenroll path or confirm whether the ask is actually
about the blended-program withdraw flow (a different feature).

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| POST | `/v1/course/unenroll` | Reproduce/diagnose a learner-reported unenroll failure |
| POST | `/v1/course/admin/unenroll` | Force-unenroll a learner directly (no confirmed UI wraps this) |
| POST | `/v1/eventset/unenroll` | Diagnose event-set unenroll — remember it does not touch `enrollment_batch_lookup` |
| POST | `apis/proxies/v8/workflow/blendedprogram/unenrol` | Diagnose a blended-program withdraw issue — a *different* feature/backend from the above |
| POST | `/notifications/create` | Exists but is not part of this feature's live path — do not expect it to be the cause of, or fix for, a missing unenroll notification |

## Notification troubleshooting

- **"Learner didn't get an unenroll email"**: check
  `SUNBIRD_COURSE_BATCH_NOTIFICATIONS_ENABLED` first, then confirm the
  `courseBatchNotification()` template resolution
  (`OPEN_BATCH_LEARNER_UNENROL` / `UNENROLL_FROM_COURSE_BATCH`) and the
  downstream email-sending dependency (`userOrgService
  .sendEmailNotification`). This is the *only* live channel.
- **"Learner expected an in-app notification"**: there isn't one. The
  `CONTENT_UN_ENROLLED` subcategory and its message template exist in
  `cb-notification-service`/`cb-notification-wrapper`, but nothing calls
  `POST /notifications/create` with it — treat any request to "fix" this
  notification as a feature request (wire up the trigger), not a bug in an
  existing path.

## Reporting troubleshooting

- **"The MDO unenrollment report is missing/stale"**: first confirm
  `unenrollmentReport.py` is actually being run — it is present and
  complete in `cb-core-data`, but is **not** imported/invoked from
  `jobs/main.py` (unlike its sibling `userEnrolment.py`, which is). If no
  external scheduler for this specific job is confirmed, the report may
  simply never run in the environment being investigated.
- The report's row-selection is an **inner join** against the
  `enrollment_history_by_action` audit table filtered to `action ==
  'UNENROLL'` — a learner who unenrolled won't appear if that audit row is
  missing, even if their `user_enrolments.active` flag is correctly
  `false`. Check the audit table directly if the two disagree.
- The job's warehouse output table, `unenrolled_user_audit`, is
  **explicitly not wired into `dataWarehouse.py`'s sync list** per the
  repo's own `docs/JOB_DETAILS.md` — don't expect this data to appear in a
  downstream warehouse/BI sync without separate work.

## Publishing/config checklist (before relying on this feature in an environment)

- [ ] Confirm `SUNBIRD_COURSE_BATCH_NOTIFICATIONS_ENABLED` is set as
      expected for the environment
- [ ] Confirm whether `unenrollmentReport.py` is scheduled by something
      outside this repo, if MDO reporting depends on it
- [ ] For mobile: confirm `showMenuIcon` remote config is `true` if the
      unenroll menu is expected to be visible
- [ ] Do not configure or expect an in-app "unenrolled" notification —
      that path has no trigger

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Learner can't find unenroll option (mobile) | Course completed, mid-player, featured, non-plain-course, or `showMenuIcon` off | `toc_appbar_widget.dart._buildActions` conditions | Confirm which gate is blocking it — most are by design |
| Learner can't unenroll on web | Feature doesn't exist for plain courses on web | Confirm the request isn't actually about blended-program withdraw | Explain the client gap; route to admin-unenroll if truly needed |
| Unenroll request fails with "already completed" | Course-completion status is `COMPLETED`, or batch has ended | `user_enrolments.status`, `course_batch.status`/end date | This is by design — no override exists |
| Unenroll request fails with "not enrolled" | No active enrolment row, or already unenrolled | `user_enrolments.active` | Confirm learner's actual enrolment state before assuming a bug |
| No unenroll email sent | Notification flag off or `sendEmailNotification` failure | `SUNBIRD_COURSE_BATCH_NOTIFICATIONS_ENABLED`, mail-sending logs | This is the only live notification channel — fix here, not in `cb-notification-*` |
| Expecting in-app unenroll notification | Feature was never wired up | `CONTENT_UN_ENROLLED` usage (there is none) | Log as a feature gap, not a defect |
| MDO unenrollment report missing | Job not scheduled, or audit row missing | `jobs/main.py` wiring, `enrollment_history_by_action` presence | Confirm scheduling externally; check audit table directly |
| EventSet child unenroll leaves batch lookup stale | By design — `EventSetEnrolmentActor` never updates `enrollment_batch_lookup` | Compare `user_enrolments` vs `enrollment_batch_lookup` for the child event | Expected behavior, not a bug, for event-set content |

**Diagnostic sequence**: confirm which client reported the issue (mobile
vs. web — they are different features) → confirm the actual unenroll
target (plain course vs. blended-program withdraw — different backends) →
check `active`/`status` on the enrolment row → check batch state → check
notification config only after confirming the write itself succeeded or
failed correctly.

## Known operational constraints

- No admin UI confirmed for the existing `/v1/course/admin/unenroll` route.
- No certificate-issued check — completion status alone gates unenroll.
- No distinct error message for "batch ended" vs. "you already completed
  this course" — both return `courseBatchAlreadyCompleted`.
- No Kafka instruction event on unenroll (asymmetric with enroll).
- No karma-points or certificate-revocation logic anywhere in this path,
  despite mobile UI copy suggesting a Karma Point deduction.
- Web has no plain-course unenroll capability at all.
- In-app unenroll notifications are fully modeled but never triggered.
- The MDO unenrollment report's scheduling status is unverified from
  static code.

**Operating model**: treat unenrollment as a thin business-rule layer on
top of the generic enrolment write, expressed through one client's UX
(mobile) and reused, unevenly, by two separate notification systems and
one reporting job.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Unenroll write failures, precondition errors | Course-service/backend team | Errors don't match the documented `ResponseCode` set, or writes silently fail |
| Mobile unenroll UX/menu gating | Mobile team | Menu visibility or confirmation/feedback flow behaves inconsistently with the gating rules above |
| Web plain-course unenroll requests | Product/web team | Confirm whether this is a known gap or a new requirement — it is currently absent by omission, not by a hidden config |
| Blended-program withdraw behaviour | Workflow-service owner (external to these repos) | Underlying enrolment data is correct but withdraw state/behaviour is wrong |
| Missing email notification | Course-service/notifications team | Config flag is on but no email sends |
| In-app notification requests | Notifications platform team | Only if a decision is made to actually wire up `CONTENT_UN_ENROLLED` — currently intentionally unimplemented |
| MDO unenrollment report gaps | Data platform team | After confirming scheduling status externally |

## FAQ

**Why can't a learner unenroll from a completed course?** By design — the
backend's precondition chain blocks it once course-completion status is
`COMPLETED`, with no override path found in any traced code.

**Why doesn't the web portal have an unenroll button for a plain course?**
It never was built there — an exhaustive grep of `sunbird-cb-portal` finds
only the unrelated blended-program withdraw flow. This is a client gap,
not a permissions or config issue.

**Why didn't the learner get an in-app "you unenrolled" notification?**
Because that channel (`CONTENT_UN_ENROLLED`) is fully defined but never
triggered anywhere in the ten repos scoped to this feature. Only the email
path is live.

**Is the MDO unenrollment CSV report guaranteed to run?** Not confirmed —
the job exists and is complete but isn't wired into `jobs/main.py`'s
orchestration, unlike comparable jobs. Confirm its scheduling externally
before treating a missing report as a bug in this codebase.

> **Verification boundary:** this manual is sourced from the same seven
> repos as the rest of this feature's docs. Deeper runbook detail for the
> external blended-program workflow service and for whatever scheduler (if
> any) runs `unenrollmentReport.py` would need those systems' own
> operations docs attached.
