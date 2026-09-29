# Unenrollment of Courses

A learner-initiated withdrawal from a course/batch they're actively enrolled
in — flips one boolean, blocked once the course is completed, and lands
very differently depending on which client the learner is standing in.

- **Backend discriminator**: none — reuses the generic enrolment write path,
  toggling `active: false` on the same `user_enrolments` row created at
  enroll time.
- **Consumption route**: mobile app only, for a plain `Course`; web exposes
  no equivalent action for a plain course at all.
- **Status**: ⚠️ split feature — fully wired on mobile (confirm → capture
  reason → call), backend-complete but notification path is two competing
  systems (one live, one dead), reporting pipeline job exists but isn't
  scheduled anywhere.

## Sourced from

| Repo | Branch | Commit |
|---|---|---|
| `sunbird-course-service` | `cbrelease-4.8.16` | `3e1f840c` |
| `igot_karmayogi_mobile` | `4.8.40` | `e3ac9d487` |
| `sunbird-cb-portal` | `cbrelease-4.8.16.2` | `5ecde2a6e` |
| `sunbird-cb-uiproxy` | `cbrelease-4.8.16` | `53095b8` |
| `cb-core-data` | `cbrelease-4.8.40` | `8e34a94` |
| `cb-notification-service` | `cbrelease-4.8.39` | `88430ce` |
| `cb-notification-wrapper` | `cbrelease-4.8.39` | `9a99b1d` |

Also checked and confirmed to have **no** unenrollment-specific code:
`cb_external_enrollment_service`, `knowledge-platform-jobs`,
`sunbird-devops` (the latter's OPA policy and i18n label files are cited
where relevant, but neither implements the feature).

## In one paragraph

A learner who wants out of a course they're enrolled in hits `POST
/v1/course/unenroll` (course-service). The backend refuses if the batch has
ended, if the learner isn't actually enrolled, or — the one hard business
rule — if the learner has already **completed** the course. Otherwise it
flips `active` to `false` on the enrolment row and its per-batch lookup row,
invalidates a Redis cache, and fires an audit-trail Cassandra write plus an
email notification. Nothing about certificates, karma points, or batch
participant counts is touched. On **mobile**, this whole chain has a real,
polished UI: a confirmation sheet with a mandatory "I understand" checkbox,
then a mandatory reason-picker before the call is made. On **web**, there is
no such UI for a plain course at all — the only "unenroll"-labelled action
on web is withdrawing a still-pending blended-program enrolment request,
which is a structurally different feature (a workflow-approval withdrawal,
not this endpoint). A separate reporting job reconstructs "who unenrolled,
when, why" from the same audit trail the backend writes to, for MDO-level
CSV reports — but that job isn't wired into the pipeline's own orchestrator,
so whether it runs in production is unverified from these repos.

## How a Karmayogi experiences it (mobile — the only full path)

1. **Opens the overflow menu** on a course's TOC page — only present for a
   plain `Course` (not blended/curated/pathway/assessment), only while
   actively enrolled, not completed, not mid-player, and only if the
   `showMenuIcon` remote config flag is on.
2. **Confirms intent**: a bottom sheet states the impact — course drops out
   of My Learning, Karma Points may be deducted, org dashboard/reports
   update — and requires ticking "I understand" before Continue is enabled.
3. **Picks a reason** (mandatory, multi-select — irrelevant, too
   hard/easy, no time, poor quality, enrolled by mistake) with an optional
   500-char comment. This step cannot be skipped; "Yes, un-enroll" stays
   disabled with zero reasons selected.
4. **Fires the call**: `POST /api/course/v2/unenroll` with courseId,
   batchId, and the selected reasons/comment.
5. **Sees the result** inline — a toast on failure, a silent state refresh
   (re-fetch enrolment info) on success; no explicit navigation away from
   the page.

See [Use Cases](use-cases.md) for web's structurally different
blended-program withdrawal, and the backend rules that make some of the
mobile UI's messaging (e.g. Karma Point deduction) unverifiable from the
services traced.

## Actors

| Actor | Role |
|---|---|
| Karmayogi (learner) | Initiates unenroll from their own enrolment, on mobile |
| MDO admin | Can force-unenroll a learner via a separate admin endpoint (not exposed in any traced UI) |

## The one decision that defines the feature

> There is no dedicated "unenrollment service" or table — unenrolling a
> learner from a course is exactly one field flip (`active: false`) on the
> same generic enrolment record used to represent enrollment, reusing the
> enrol code path's validation and DAO layer almost line for line. The
> entire feature's complexity lives in the mobile client's confirmation/
> feedback UX and in the fact that web never got the equivalent UI built.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md), [LLD](lld.md)
and [As-Built Requirements](as-built-requirements.md) for the full picture,
and the [Operations Manual](operations-manual.md) for running it day to day.
