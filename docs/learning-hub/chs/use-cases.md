# CHS / cb-core-data — Use Cases

Grouped by the actor who actually touches the pipeline's output (the `Learner` is affected
but never interacts with it directly, so is covered in the edge cases below rather than as
its own use case).

### MDO Administrator

**UC-1 · Download a compliance/enrolment report bundle.** Once the relevant Stage 2 report
job has run, an MDO admin's per-org CSVs (ACBP compliance, assessments, blended-program
attendance, course/content, etc.) are packaged into one password-protected ZIP per org
(passwords are grouped ministry > department > org) and uploaded to cloud storage.
- API: `jobs/stage-2/zipUpload.py` (packaging) → GCS upload; password retrieved via the
  notification/portal layer from Redis, not embedded in the ZIP.

**UC-2 · View org-scoped dashboard metrics.** The admin-facing dashboard reads counters,
rollups and leaderboards keyed by ministry/org ID directly from Redis, not from the
Postgres/BigQuery warehouse.
- API: `jobs/stage-2/ministryMetrics.py`, `dashboardSync.py` (Redis hash writes keyed by
  ministry ID).

### BI / Looker Consumer

**UC-3 · Query the BI warehouse.** BI tools query 12 core Postgres tables
(`user_detail`, `content`, `assessment_detail`, `user_enrolments`, etc.), or their BigQuery
mirror, both rebuilt from scratch on every pipeline run.
- API: `jobs/stage-2/dataWarehouse.py` / `dataWarehouseBash.sh` (Postgres), `bq-scripts.sh`
  (BigQuery).

### Platform Dashboard (live UI)

**UC-4 · Read near-real-time counters.** The live admin/learner dashboard reads 50+
`dashboard_*` Redis keys — daily KPIs, leaderboards, campaign tickers — computed straight
from Stage 1's tables via DuckDB, independent of the (slower) Postgres/BigQuery sync.
- API: `jobs/stage-2/dashboardSync.py`, `constants/QueryConstants.py`.

### Pipeline Operator

**UC-5 · Run the orchestrated core chain.** `jobs/main.py` chains Stage 1 and 4 Stage 2 jobs
(user report → assessment report → competency mapping → enrolment report) in one invocation,
logging per-stage duration and re-raising on first failure.
- API: `python jobs/main.py`.

**UC-6 · Run every other job independently.** The remaining ~41 Stage 2 jobs (and Stage 0)
have no in-repo scheduler or orchestration — each is invoked as its own `spark-submit`, in an
order the operator must derive from the table-name dependency list, since nothing in the
codebase enforces it.
- API: `spark-submit jobs/stage-2/<jobName>.py`.

### Downstream Notification / Portal System

**UC-7 · Consume outbox-style notification events.** Peer-validation eligibility and
gamification notifications are produced and consumed through a Postgres-table outbox/queue
pattern (append by producer, per-row update by consumer) — despite class names suggesting
Kafka.
- API: `jobs/stage-2/peerValidationEligibleUsers.py` → `peerValidationNotificationSender.py`;
  `gamificationNotificationProducer.py` → `gamificationNotificationConsumer.py`.

## Edge cases

| Situation | Behaviour |
|---|---|
| A warehouse sync (Postgres or BigQuery) fails partway through | The target table is genuinely empty/absent until the next successful run — every sync is a destructive truncate-then-reload with no atomic swap and no rollback step. |
| Stage 0 is re-run twice in the same day, after `weeklyClaps.py` has already executed | The second Stage 0 run picks up `weeklyClaps.py`'s own write to `learner_stats`, not the original state — a closed read-modify-write loop, not a bug in either job alone. |
| Two org-hierarchy jobs (`org_hierarchy.py`, `orgHierarchyAll.py`, `orgHerarchyUpdatedEmpty.py`) are run against the same target | All three write the same 3 Postgres tables with no cross-coordination; whichever ran last wins, and the repo gives no signal which is "the real one" in production. |
| A gamification notification job is deployed without the missing config keys (`dwnotificationQueue`, `gamificationNotificationBatchSize`, `gamificationNotificationEligibilityDays`) | The job cannot run at all in a real deployment — the config keys it needs don't exist in `config.py`, `default_config.py`, or the Ansible template. |
| `npsUpgraded.py` is invoked normally | Its pipeline (including Cassandra writes) executes **twice** per invocation, due to two consecutive `if __name__=="__main__"` blocks in the file — inflates write volume and notification counts. |
| An operator relies on `dataWarehouse.py`'s log claiming a Cassandra write for `ministryLeaderboard.py` | The log message is wrong — the job actually writes to Postgres (`slw_mdo_top_learners`), not Cassandra. |
