# CHS / cb-core-data — Operations Manual

> **Scope caveat:** the external scheduler that actually runs this pipeline (documented
> elsewhere as Airflow) is not part of this repository, so exact cron timing, DAG
> definitions, and which of several duplicate jobs is actually live in production cannot be
> confirmed from source alone. Called out explicitly below wherever that applies.

## Common support issues and verified fixes

| Symptom | Likely cause | Verified fix / workaround |
|---|---|---|
| Warehouse table (Postgres or BigQuery) missing or empty when a dashboard/report is checked | `dataWarehouse.py`/`dataWarehouseBash.sh` or `bq-scripts.sh` failed partway through their full-replace cycle — both are destructive-then-rebuild | Re-run the sync script for the affected system. There is no partial-restore path; re-running is the correct recovery, not a manual patch. |
| Live dashboard looks stale | `dashboardSync.py` hasn't run recently or failed | Re-run `dashboardSync.py` alone — it's independent of the Postgres/BigQuery path and cheaper to re-run than the full warehouse sync. |
| Weekly-claps / streak data looks wrong for a user | Stage 0 was accidentally re-run twice in one day after `weeklyClaps.py` already executed, closing a read-modify-write loop on `learner_stats` | Check run history for a double Stage 0 run before assuming a logic bug in `weeklyClaps.py`. |
| NPS notification counts look inflated | `npsUpgraded.py` has two consecutive `if __name__=="__main__"` blocks and runs its whole pipeline twice per invocation | Known issue — treat any NPS anomaly as likely caused by this until the file is fixed. |
| Gamification notification job fails immediately | `gamificationNotificationConsumer.py`/`Producer.py` reference config keys (`dwnotificationQueue`, `gamificationNotificationBatchSize`, `gamificationNotificationEligibilityDays`) that don't exist in `config.py`, `default_config.py`, or the Ansible template | Not runnable in a real deployment until those keys are added — this is a config gap, not a job-logic bug. |
| An org-hierarchy sync produces unexpected results | Three uncoordinated jobs (`org_hierarchy.py`, `orgHierarchyAll.py`, `orgHerarchyUpdatedEmpty.py`) write the same 3 Postgres tables with no cross-reference | Confirm with the owning team which one is actually scheduled before debugging further — don't assume it's the one you expect. |

## Configuration

- **`jobs/config.py`** is generated at deploy time from `ansible/roles/pyspark-deploy/templates/config.py.j2`, combined with a private, vault-encrypted environment inventory not in this repository. It is not directly runnable as checked into git.
- **`jobs/default_config.py`** is a local-dev fallback with real internal-network default hosts baked in — never treat these as production values.
- **To operate this pipeline in any environment, you need access to the private Ansible inventory/vault** — this document cannot enumerate its contents.

## Execution model

**No in-repo scheduler exists.** Two patterns:

- **Orchestrated subset**: `python jobs/main.py` runs `prejoinData` → `userReport` →
  `assessmentReport` → `kcmReport` → `userEnrolment` in sequence, logs per-stage duration, and
  re-raises on any exception (non-zero exit, no auto-retry).
- **Everything else** (Stage 0 and ~41 standalone Stage 2 jobs): `spark-submit
  jobs/stage-2/<jobName>.py`, individually, in an order the operator must derive from the
  dependency list below — nothing in the codebase enforces it.

**Recommended run order** (derived from data dependencies, not an in-repo guarantee):

```
1. dataExhaust.py                          (Stage 0 - must run first, every time)
2. prejoinData.py                          (Stage 1 - depends on Stage 0's caches)
3. userReport.py, assessmentReport.py,
   kcmReport.py, userEnrolment.py          (via jobs/main.py, or standalone in this order)
4. courseReport.py                          (before capAllotment.py)
5. capAllotment.py                          (depends on courseReport.py's content write)
6. l2Assessments.py                         (depends on kcmReport.py)
7. gamificationJob.py                       (before gamificationNotificationProducer.py)
8. Remaining Stage 2 jobs                   (largely independent of each other)
9. dataWarehouse.py OR dataWarehouseBash.sh (confirm which is live - do not run both
                                              against the same target unknowingly)
10. bq-scripts.sh                           (BigQuery mirror)
11. dashboardSync.py                        (Redis - independent of the Postgres/BigQuery sync)
12. zipUpload.py                            (must run after userReport.py and userEnrolment.py)
13. cleanup.sh                              (housekeeping)
```

## Warehouse sync operations

- **Postgres**: two competing implementations exist in this branch — `dataWarehouse.py`
  (Spark/JDBC) and `dataWarehouseBash.sh` (DuckDB/bash, with explicit casts/dedup the Spark
  version lacks). **Confirm with the owning team which is actually cron-scheduled** before
  operating this pipeline for real — running both against the same target risks a `TRUNCATE`
  race. `user_enrolments` (~19GB) is deliberately loaded last; preserve that ordering if the
  script is ever modified.
- **BigQuery** (`bq-scripts.sh`): a full destructive replace every run (delete → recreate →
  load) for the same 12 tables. No rollback step — re-running the script for the affected
  table(s) is the recovery path.
- **Redis** (`dashboardSync.py`): independent of both syncs above; the fastest lever to
  refresh the live dashboard if the Postgres/BigQuery sync is delayed or failing.

## Credentials & secrets

- Ansible Vault (`--vault-password-file`) protects `secrets.yml` — DB credentials, the GCP
  service-account key, and other sensitive template variables.
- The GCP service account is written to `jobs/gcp_service_account.json` on the target host,
  mode `0640` — verify ownership/permissions after any manual deploy.
- **Known hardcoded-credential risk:** `org_hierarchy.py` still hardcodes a Postgres password
  and ES/Postgres hostnames in source. If this job is the one actually scheduled in
  production, treat its credential as compromised-by-exposure and prioritize migrating to
  `orgHierarchyAll.py` or patching it directly.

## Housekeeping (`cleanup.sh`)

Intended to run after each day's pipeline completes (not itself scheduled in-repo).
**Active today:** logs to `cleanup.log`; removes yesterday's dated report folders (12 report
types, 1-day retention); removes `standalone-reports/merged` and `warehouse/fullReport`
unconditionally. **Disabled in this branch:** download-staging copy, dated backup ZIP,
log-file retention — if disk usage grows unexpectedly, check
`/home/analytics/pyspark/logs/data-products/` first, since nothing currently prunes it.

## Monitoring & alerts

There is no dedicated monitoring/alerting code in this repository — visibility is limited to
each job's stdout/stderr (as captured by whatever wraps `spark-submit` in the external
scheduler) plus `cleanup.log`. When a run fails, identify the failing stage from
`jobs/main.py`'s per-stage duration summary (for the orchestrated chain) or the standalone
job's own traceback, then check the Known Issues list (`lld.md` §8) before deep-diving —
several failure modes are already documented.

## Rerun / idempotency

- Stage 0 and Stage 1 fully overwrite their outputs on every run — safe to re-run from
  scratch, **except** the `weeklyClaps.py`/`learner_stats` loop noted above.
- Every warehouse sync is a full truncate + reload — re-running a failed sync is the correct
  recovery and won't create duplicates, but the target table is briefly empty/rebuilding
  during the rerun; avoid re-running during hours when dashboards/BI tools are actively used,
  if that can be scheduled around.
- Cassandra/Redis writes from Stage 2 jobs are mostly append or overwrite-by-key — check the
  specific job's write mode before assuming a rerun is side-effect-free (`karmaPoints.py`,
  `learnerLeaderboard.py` are append-mode and could double-count on a naive rerun).
- `postgresToParquet.py` is a read-only diagnostic export — safe to run at any time.

## Escalation / ownership

Not recorded in the source repository. At minimum, capture: who owns the external Airflow
scheduler configuration, who holds Ansible Vault access per environment, and who to contact
to confirm which of the duplicate warehouse-sync / org-hierarchy jobs is production-scheduled.
