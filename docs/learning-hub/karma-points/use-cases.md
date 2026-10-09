# Karma Points — Use Cases

## Learner journeys

### UC-1 · Earn points automatically

Each trigger below produces a Kafka event; the Flink job decides the award.
Values are the **processor's** (`karma-points-processor-v2` defaults, matched
by the Helm values) — see the mismatch note in
[As-Built Requirements](as-built-requirements.md).

| Trigger | Event type | Points | Dedup |
|---|---|---|---|
| First login (web) | `FIRST_LOGIN` | 5 | once per user |
| First login (mobile) | `FIRST_LOGIN_MOBILE` | 5 | once per user |
| Self / custom / bulk registration | `SELF_REGISTRATION` · `CUSTOM_REGISTRATION` · `BULK_REGISTRATION` | 5 each | once per type per user |
| First course enrolment | `FIRST_ENROLMENT` | 5 | once per user (re-awarded only after a reversal) |
| Course completion | `COURSE_COMPLETION` | 5 (+5 if ACBP, decaying when late) | per course |
| Learning Pathway completion | `COURSE_COMPLETION` | 10 | per pathway |
| Curated Program completion | `COURSE_COMPLETION` | 10, max 2 a month | per program |
| Course rating (no comment) | `RATING` | 2 | per course |
| Event attended | `EVENT_ATTENDED` | 5 | per event |
| Survey submission, course time spent, engagement streak, verified profile, assessment passed / high score (>75) | matching event type | 2 · 5 · 10 · 10 · 5 · 5 | per key |

- Non-ACBP course completions stop earning after **4 a month** (cap flag on).

### UC-2 · Claim ACBP points

For a course on the learner's ACBP plan whose end date has not passed, a
**Claim** button appears after completion if the ACBP bonus has not been
credited. Claiming emits a Kafka message; the job credits the ACBP quota.

- API: `POST /api/claimkarmapoints` (web proxy: `/apis/proxies/v8/claimkarmapoints`)

### UC-3 · View the total and history

The profile strip, achievement hub, nav bar and profile stat tiles show the
total (from the cached enrolment summary). The history page lists credits newest
first, paged by `credit_date`.

- APIs: `POST /karmapoints/read` · `POST /user/totalkarmapoints` · enrolment summary

### UC-4 · See what a course will earn

The course About tab shows "Earn N Karma Points" messages by learner state (not
enrolled, enrolled, rated, completed). For a learning pathway: "Earn 25 Karma
Points by completing this learning pathway" (mobile).

- API: `POST /karmapoints/user/course/read` (reads whether ACBP was already credited)

### UC-5 · See rank and Hall of Fame

- Monthly learner leaderboard within the learner's MDO, top 3 podium plus 3
  neighbours: `GET /halloffame/learnerleaderboard`.
- Public Hall of Fame of top MDOs for the previous month, grouped by MDO size:
  `POST /halloffame/read` (unauthenticated).

### UC-6 · Convert points to Karma Coins

In the Karma Wallet the learner enters points to convert (≤ monthly remaining and
≤ unconverted points) and confirms. The call returns `202 PROCESSING`
immediately; the Flink job credits the wallet.

- APIs: `GET /karmawallet/v1/summary` · `POST /karmawallet/v1/redeem`

### UC-7 · View wallet transactions

Earned/Redeemed tabs, period filter (Recent = 30 days, Current Month, Last
Month, Last 3/6 Months, Custom — up to 1 year back). In-flight conversions
and pending paid-course enrolments appear as `IN_PROGRESS`.

- API: `POST /karmawallet/v1/transactions`

### UC-8 · Spend coins on a paid external course

For a restricted external course the app asks the deduction rule and shows a
consent sheet ("Redeem N Karma Coins to unlock this course"). Redemption itself
is a `COINS_REDEMPTION` event handled by the Flink job.

- API: `POST /api/cios-enroll/v1/karmapoints/deductionrule`

### UC-9 · Lose points on unenrol

Un-enrolling emits `UNENROLMENT`; the job zeroes the first-enrolment credit and
subtracts it from the total (no-op if already 0).

## Operator journeys

### UC-10 · Adjust points manually

A `KARMA_POINTS_ADJUSTMENT` event (`data.user_id`, `data.points` ± non-zero)
changes only `total_points` in the summary — no ledger row. No producer in these
repos emits it.

### UC-11 · Bulk-credit event attendance

A CSV upload (`userid, contentid, batchid`) to `POST /user/event/postConsumption`
completes event enrolments and emits `EVENT_ATTENDED` for each.

## Edge cases

| Situation | Behaviour |
|---|---|
| Re-enrol in same course | `FIRST_ENROLMENT` emitted again; job skips unless the earlier credit was reverted |
| History page, offset 0 | Cursor = start of today → today's credits excluded from the first page |
| History older than 2023-12-01 | Never returned (hard-coded cut-off) |
| Convert while another conversion pending | Pending locks are counted against balance and cap |
| Redis down during convert | Duplicate-conversion guard fails open |
| Kafka push fails after lock set | 500 returned, lock stays up to 900 s |
| Data-quality-bad event (V2) | Published to `…unified.v2.failed`, not retried |
| System failure (V2) | Job fails and replays from checkpoint |
| Event-cert generator | Karma emit call is commented out — no event-certificate karma from that path |
