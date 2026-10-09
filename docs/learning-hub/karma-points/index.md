# Karma Points

A recognition system that credits a Karmayogi with points for learning
engagement — enrolling, completing, rating, attending events, logging in — and
lets them convert those points into **Karma Coins** in a wallet.

- **Ledger**: Cassandra `user_karma_points` (per-credit rows) and
  `user_karma_points_summary` (running total)
- **Computed by**: two Flink jobs in `knowledge-platform-jobs`
  (`karma-points-persist-processor` v1, `karma-points-processor-v2`)
- **Consumption routes**: web profile (`/app/person-profile/karma-points`,
  `/app/person-profile/karma-wallet`), mobile profile/achievement hub, public
  Hall of Fame
- **Status**: ✅ end-to-end traced; ⚠️ several client/processor value mismatches — see
  [As-Built Requirements](as-built-requirements.md)

## In one paragraph

Nothing in the learner-facing services calculates a point. Course-service,
LMS-service, and cb-ext only **emit events** to a Kafka topic
(`{env}.karma.points.unified.v2.event`); a Flink job consumes them, decides
whether and how many points to award, and writes a ledger row plus a running
total in Cassandra. cb-ext then **reads** that ledger back for the web and
mobile apps, serves leaderboards, and runs the Karma Coin wallet — where a
learner converts unconverted points into coins (capped at 300 points a month)
through another Kafka round-trip back into the same Flink job.

## How a Karmayogi experiences it

1. **Earns passively**: first login, first course enrolment, course completion,
   rating a course, attending an event — no action needed.
2. **Claims** ACBP points: for a course on their MDO's Annual Competency
   Building Plan, a Claim button appears after completion if the ACBP bonus is
   not yet credited.
3. **Watches the total** on the profile strip, the achievement hub, and the
   history page (`/app/person-profile/karma-points`), newest first.
4. **Ranks**: a monthly learner leaderboard inside their MDO, and a public Hall
   of Fame of top MDOs, both refreshed once a month.
5. **Converts** points to Karma Coins in the Karma Wallet (1 point → 1 coin,
   300 points a month).
6. **Loses points** if they un-enrol from the first-enrolled course — the
   unenrol confirmation warns "deduct Karma Points (if applicable)".

## Actors

| Actor | Role |
|---|---|
| Karmayogi | Earns, claims, converts, views history and rank |
| MDO / organisation | Appears in Hall of Fame; sets the ACBP plan that drives the ACBP bonus |
| System (Flink jobs) | Awards, reverses, converts — the only writer of the ledger |

## The one decision that defines the feature

> Points are not computed where the action happens. Producers emit
> loosely-typed Kafka events and a single keyed Flink job owns every ledger
> write — so idempotency, caps and reversal live in one place, and the
> request-path services never block on points.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, [As-Built Requirements](as-built-requirements.md)
for traceable requirements, and the [Operations Manual](operations-manual.md)
for running it day to day.
