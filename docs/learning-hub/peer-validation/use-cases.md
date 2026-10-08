# Peer Validation — Use Cases

## Learner journeys

### UC-1 · Get prompted and fill the survey

Once the configured number of days has passed since course completion (a
30–60 day window, set per survey), the learner is prompted with a survey —
web and mobile both surface this as a dashboard item / notification popup,
each with its own independent client implementation reaching the same
backend contract.

- API: `POST /forms/peersurvey/submit`

### UC-2 · Attach optional proof

The learner can attach one PDF (≤2MB) or one MP4 (≤200MB) as supporting
evidence. Both web and mobile enforce the same size thresholds
independently — there's no shared validation code between them.

- API: `POST /peersurvey/upload`

### UC-3 · Name peer reviewers

The learner picks 2–3 peers (the server itself would accept up to 5 — the
2–3 limit is a client-side choice, enforced independently and identically
by both web and mobile UIs).

### UC-4 · Wait for and receive a decision

The learner sees their request's status on their dashboard (pending vs.
decided). If too much time passes, the request can show as **expired** —
but this is calculated fresh every time the list is viewed, not stored
anywhere, so the same request can look "expired" one moment and still be
actionable the next if a peer happens to act on it late.

- API: `GET /v1/notifications/peervalidation/list`

## Peer journeys

### UC-5 · Review a named submission

A peer opens their incoming-request tab, reads the learner's answers and
any attached proof, and approves or rejects.

- **Non-obvious mechanism**: this decision is one-shot. Once a peer
  approves or rejects, the system refuses to let that same decision be
  changed — there is no "undo" or "re-review" path.
- API: `POST /forms/peersurvey/submit` (with a review action)

## Admin journeys (MDO / SPV)

### UC-6 · Configure a validation survey for a course

An MDO admin attaches a peer-validation survey to one of their live
courses: how many days after completion it triggers, how far back it looks
for eligible completions, and up to two custom questions on top of the
system-provided ones.

- API: `POST /mdo/peersurvey/create`

### UC-7 · Configure system-wide (SPV)

An SPV admin can do the same thing across every department at once — and,
unlike an MDO admin, isn't restricted to only their own department's
surveys when searching or generating reports.

- API: `POST /spv/peersurvey/create`

### UC-8 · Publish, end, and archive a survey

A survey moves one-way through Draft → Active → Ended → Archived; there's
no path back to an earlier state once moved forward.

- APIs: publish/end/archive endpoints, one per transition

### UC-9 · Pull a completion report

An admin generates a CSV of who submitted, who reviewed, and the outcome,
for their courses' surveys. Generation happens in the background — the
admin has to check back rather than being notified when it's ready.

- APIs: report-initiate, report-status, report-download

## Edge cases

| Situation | Behaviour |
|---|---|
| Peer rejects the submission | Final — there's no built-in way to resubmit for the same request today |
| Request sits unreviewed indefinitely | It can display as "expired" on next view, but nothing actually escalates it, reminds the peer, or reassigns it — there's no escalation path at all |
| Peer decides after their request already shows "expired" | Still succeeds — expiry is a display calculation only, not an enforced cutoff |
