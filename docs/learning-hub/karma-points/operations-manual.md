# Operations Manual — Karma Points

## System overview

| Layer | Component | Notes |
|---|---|---|
| Producers | course-service, lms-service, sb-cb-ext, certificate-generator | Emit only; never write points |
| Transport | Kafka `{env}.karma.points.unified.v2.event` (key = userId) | Plus `karma.coin.wallet.redeem`, `user.claim.acbp.karma.points`, `…unified.v2.failed`, `user.paid.course.enrolment` |
| Processor | Flink `karma-points-processor-v2` (+ `karma-points-persist-processor` v1) | 1 replica, parallelism 1 by default |
| Store | Cassandra `sunbird`, Redis | See [LLD](lld.md) |
| Read | sb-cb-ext via Kong / uiproxy | |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `user_karma_points_summary.total_points` | Running total | What every UI total ultimately shows |
| `…summary.addinfo.claimedNonACBPCourseKarmaQuota` | Non-ACBP completions this month | ≥ 4 stops further non-ACBP awards |
| `user_karma_points_credit_lookup` | Dedup index | A missing lookup row causes a double award on replay; an orphan row blocks an award |
| `user_karma_coin_lookup.addinfo.status` | Conversion state | PROCESSING stuck = job failure |
| `user_karma_coin_wallet` | earned / redeemed | Balance = earned − redeemed |

## Operational workflows

**"My points didn't arrive."** Find the producer event: was it emitted
(course-service/LMS/cb-ext logs)? Is the job consuming (lag, below)? Then check
`user_karma_points_credit_lookup` for the key — if a row exists the job treated it as a
duplicate. Check the failed topic for `DataQualityException` rejections.

**"Points total wrong / mismatched."** Compare `user_karma_points_summary.total_points`
with the sum of `user_karma_points.points`. The summary update is a non-atomic
read-modify-write; `KARMA_POINTS_ADJUSTMENT` changes only the summary.

**Conversion stuck at PROCESSING.** Check `user_karma_coin_lookup` for the
`userId|POINTS_CONVERSION|requestId` row. A frozen plan in `addinfo` resumes on replay.
If cb-ext returned 500 after the lock was set, the Redis lock remains up to 900 s and
counts against the user's balance and cap — wait or delete
`CB_EXT_karmaCoinConvertLock:<userId>:<requestId>`.

**Redeem history shows nothing for today.** `POST /karmapoints/read` with `offset=0`
uses start-of-today as the cursor and excludes today's credits.

**Bulk event attendance.** Upload CSV (`userid, contentid, batchid`) to
`/user/event/postConsumption`. Re-uploading re-emits events; dedup is the job's.

## Monitoring

- Grafana `kp-flink-jobs-metrics-dashboard.json`, panel "Karma Points Persist Processor":
  `…karma_points_persist_processor_{total_events_count, failed_events_count,
  skipped_event_count, db_update_count, db_read_count, cache_hit_cout (sic), cache_miss_count}`
  and `KafkaConsumer_records_lag_max`.
- Lag dashboards: `kafka_consumergroup_lag{consumergroup="prod-karma-points-processor-group"}`.
  **No alert rules for karma were found.**
- No dashboard or deploy entry named `karma-points-processor-v2` exists in DevOps.

## Configuration knobs

| Setting | Where | Value |
|---|---|---|
| Topic | `karma_points_unified_event_topic` (course, LMS, cb-ext) | `{env}.karma.points.unified.v2.event` |
| Envelope version | `kafka_event_envelope_version` | 2 |
| Registration mapping | `karma_points_registration_event_types` (LMS) | `selfRegisterUser:SELF_REGISTRATION,singleUserCreate:SELF_REGISTRATION,customRegisterUser:CUSTOM_REGISTRATION,bulkUserCreate:BULK_REGISTRATION` |
| Monthly coin cap | `karma.coin.monthly.cap` | 300 |
| Conversion rate | `karma.coin.conversion.rate` | 1 (applied in the pending view; credit amount is the job's) |
| History page size | `karma.points.limit` | 10 |
| Point values & capping | job `karmapoints{}` block (Helm `values.j2`) | see [As-Built](as-built-requirements.md) |
| Assessment threshold | `assessmentHighScoreThreshold` | 75 |
| Leaderboard cache | `redis.user.insights.leaderboard.ttl/index` | 3600 / 2 |

## Failure semantics (job V2)

| Failure | Behaviour |
|---|---|
| `DataQualityException` (missing type, bad user, bad payload, unknown type) | Logged, published to `…unified.v2.failed`, event acknowledged, no retry |
| `SystemException` (Cassandra, Redis, HTTP) | Rethrown → task fails → Flink restart from checkpoint (fixed delay 240 s in Helm) |
| Cassandra transient error | One retry, then `CassandraException` |
| Redis mirror failure | Logged, not thrown |
| Redis dedup failure | Fails open to Cassandra |

V1 has no try/catch and no failed topic — any exception restarts the job.

## Known operational constraints

- **No DDL in repo** — table schemas must be confirmed in the Cassandra cluster.
- **Helm key placement**: `requestClaimTtlSeconds`, dedup flags and `transactionId{}`
  sit under different blocks than the code reads, so deployed values likely fall back
  to code defaults (INFERRED).
- **`ClaimKarmaPoints` trusts the body userId** — no check against the caller.
- **Hall of Fame `/read`** loops back month-by-month with no lower bound; an empty
  table never terminates (INFERRED).
- **`setIfAbsent` fails open** on Redis errors — duplicate conversions are then possible.
- **Event-certificate karma path is disabled** (emit call commented out).
- **Two processors deployed** — confirm which producers still feed V1 before changing either.

## Escalation

| Symptom | Owner |
|---|---|
| Missing events | Course / LMS / cb-ext service owners |
| Job lag, restarts, failed topic growth | Data pipeline (Flink) |
| Wrong totals, stuck conversions | Data pipeline + Cassandra admins |
| Leaderboard not refreshed on the 1st | Leaderboard job owners (outside these repos) |

## FAQ

**Is the Karma Coin the same as a Karma Point?** No. Points are earned; coins are
converted 1:1 (rate configurable) and spent on paid courses.

**Why does the app say 15 for an ACBP course?** Client copy; the job awards 5 + 5.
See the mismatch table in the As-Built doc.

**Can points be negative?** Reversal zeroes the first-enrolment row and subtracts it
from the summary; nothing in the code floors the summary itself at 0 in V2 reversal.
Verify before promising otherwise.
