# Blended Program

Instructor-led learning that mixes self-paced online content with scheduled
classroom sessions — batches with a seat limit, an approval step before a
learner gets a seat, attendance taken at each session, and assignments
handed in along the way.

- **Category**: `primaryCategory = "Blended Program"` (the same string is
  written to `courseCategory` when the program is created)
- **Consumption route**: the program's TOC page (`/app/toc/:id`) on web;
  the same TOC page inside the mobile app
- **Status**: ⚠️ fully built, but several rules that look enforced on screen
  are enforced only in one place (or nowhere) — see "The one decision" and
  the honest-gap lists in [LLD](lld.md) and
  [As-Built Requirements](as-built-requirements.md)

## Sourced from

Every fact in these pages is read from code at the commits below, unless it
carries a **Verification boundary** note.

| Repo | Branch | Commit |
|---|---|---|
| `sunbird-cb-portal` | `cbrelease-4.8.41` | `c12b4a9ed` |
| `sb-cb-ui-components` (source of the `@sunbird-cb/toc` and `@sunbird-cb/collection-v2` packages the portals pin) | `cbrelease-4.8.41` | `bc8c26b8d` |
| `sunbird-cb-creationportal` | `cbrelease-4.8.41.1` | `d55fb1d14` |
| `igot_karmayogi_mobile` | `master` | `7a3219157` (tag `iGotApp-v5.0.6-S40-adhoc-release`) |
| `sunbird-course-service` | `cbrelease-4.8.41.1` | `a0e86bee` |
| `sunbird-cb-workflow` | `cbrelease-4.8.41.1` | `927117d` |
| `sunbird-cb-ext` | `cbrelease-4.8.41` | `713ff3ce` |
| `cb-ext-config-service` | `cbrelease-4.8.39.2` | `0d1d9a2` |
| `knowledge-platform` | `cbrelease-4.8.41.0` | `36c5077b` |
| `cb-core-data` | `cbrelease-4.8.41` | `34f54b0` |
| `sunbird-devops` | `cbrelease-4.8.41` | `5ee2a6490` |

Read as supporting context only (**not** one of the pinned commits —
treat anything sourced from them as "at that SHA"): `sunbird-cb-uiproxy` at
`175d24c4` (tag `cbrelease-4.8.41_RC7`) for the gateway route map and role
whitelist, and `knowledge-mw-service` at `dbf19f1` (a 2021 `master`
checkout).

**Not available for this analysis:** `sb-cb-ext-service` and
`sunbird-content-service` (neither could be resolved to a repo the analyst
could clone), and `cb-ext-course-service` / the forms service (cited by an
earlier version of these pages for the assignment APIs). Where a request
ends up in one of them, the page says so.

**What "release" means here:** the commits are the tips of each repo's
newest `cbrelease-*` branch (or `master` for mobile), and for the forks they
are tagged `cbrelease-<n>_RC<m>` in KB-iGOT's own repo. That proves the
commit was cut as a release candidate; nothing in these repos proves it is
what is currently deployed in production.

## In one paragraph

A Blended Program is a course-like program that pairs online modules with
offline (classroom) sessions, run in **batches**. A learner opens the
program, picks a batch that still accepts enrolments and still has room,
completes whatever the batch asks for up front (pre-requisite reading, a
profile form, a short survey), and sends a request for a seat. Depending on
how the program was set up, the Program Coordinator, the MDO admin, or both
in a fixed order must approve it; until then the learner can withdraw. Once
approved — and once the batch has started — the learner works through the
online content and attends the sessions; attendance is recorded by the
coordinator, or by the learner scanning a session QR code on the mobile app
while standing at the venue. Assignments are handed in as PDFs and evaluated with marks and feedback,
and a batch certificate follows. Coordinators can also skip
the request step entirely by nominating learners, or (when the program
allows it) by printing a self-enrolment QR code for people in the room.

## How a Karmayogi experiences it

1. **Finds the program** in search or on the Learn hub and opens its page.
2. **Picks a batch.** Only batches whose enrolment window is still open are
   offered. The page warns when seats are running low (80% full) and when a
   batch is full or when every batch is full.
3. **Clears the entry steps**, if the batch has any: pre-requisite resources
   or an assessment the program marks mandatory, a short profile form, a
   program survey, and — for batches restricted to certain services — an
   eligibility check against the learner's own profile.
4. **Confirms the request.** A final dialog states the batch dates. If the
   learner's dates overlap another Blended Program batch they are already
   in, the request is refused with a "schedule conflict" message.
5. **Waits for approval.** The page shows where the request is (waiting for
   the MDO, waiting for the Program Coordinator, approved, rejected). The
   learner can **withdraw** while it is pending. On the web they cannot
   withdraw once it is approved, nor once the first of two approvers has
   already said yes.
6. **Starts learning** once the request is approved *and* the batch is
   running. A countdown shows the days left to the start. The program has
   two tabs of content: *Self-paced* and *Instructor-led* (the sessions).
7. **Attends sessions.** Each session shows its date, time, duration,
   handouts and links. After the session the card shows "attendance marked"
   with the time. On mobile the learner can mark their own attendance by
   scanning the session QR, but only while the session is live and the phone
   is within about a kilometre of the venue.
8. **Submits assignments** (PDF only, up to about 5 MB), saves a draft, then
   submits; marks and feedback appear once the instructor evaluates.
9. **Finishes** and collects the batch certificate.

## Actors

| Actor | Role |
|---|---|
| Karmayogi | The learner: requests a seat, withdraws, learns, attends, hands in assignments |
| MDO admin | An approver for their own organisation's learners; can also remove learners and enrol people directly |
| Program Coordinator (PC) | Owns the program's batches; approver; marks attendance; nominates learners; pulls reports |
| Lead trainer / co-trainer (`bp_program_trainer`) | A coordinator-level role scoped to chosen batches; National and State lead-trainer types, at most 5 of each per batch |
| Instructor (`program_instructor`) | Named on a batch; sees only their own batches; lands on the assignments screen for archived batches; blocked from the learners, reports and nominate screens |
| Author / reviewer / publisher | Build the program and move it through review to publish |

## The one decision that defines the feature

> A seat is a **request**, not a booking: for the ordinary path the learner
> asks and someone else decides — and the checks that look like they live
> on the learner's screen mostly don't. The browser's "you clash with another
> program" check can never fire (it only ever sees the program you are
> already looking at), and a full batch is stopped by the server, not the
> button. The only reliable gatekeepers are the approvers and the server.

The exceptions — nomination by a coordinator and QR self-enrolment — put a
learner straight into the batch with no approver, which is why they carry
their own checks (seat limits, schedule clash, one batch per course).

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md),
[LLD](lld.md) and [As-Built Requirements](as-built-requirements.md) for the
full picture, and the [Operations Manual](operations-manual.md) for running
it day to day.
