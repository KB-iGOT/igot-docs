# cb-core-data — Architecture

> **Scope note:** this document describes the pipeline as it exists on
> **`cbrelease-4.8.41`**, checked against the code on 2026-11-02. Since
> `cbrelease-4.8.39.3`, 4 jobs were added (`org_hierarchy_new.py`,
> `courseHealthMetrics.py`, `dsrValidation.py`, `polarsCSVExport.py`), 4 are
> no longer used (`karmaPoints.py`, `orgHierarchyAll.py`,
> `orgHerarchyUpdatedEmpty.py`, `postgresToParquet.py`), and 18 files changed.
> The Looker dashboard (ClickHouse) jobs are documented from team notes.
>
> **Two jobs currently fail as committed:** `dashboardSync.py` imports
> `constants.QueryConstants_updated`, which is not in the repository, and
> `userEnrolment.py` calls `assessmentDFUtil` without importing it. See
> [`JOB_DETAILS.md`](JOB_DETAILS.md).
>
> A companion interactive view of everything in this document —
> filterable/searchable by job, plus an Analytics page listing every output —
> lives at [`docs/Data-pipeline-overview.html`](Data-pipeline-overview.html).
> Full per-job detail (every read, join and write) is in
> [`JOB_DETAILS.md`](JOB_DETAILS.md). Every named Parquet/warehouse table is
> catalogued in [`DATA_DICTIONARY.md`](DATA_DICTIONARY.md).

## What this repository is

`cb-core-data` is the analytics pipeline behind **Karmayogi Bharat / iGOT**, a
learning platform for Indian government employees. It is a batch,
PySpark-based ETL system (with DuckDB used for the heaviest SQL joins) that:

1. pulls raw activity data out of the platform's operational stores
   (Cassandra, Elasticsearch, Redis, MongoDB, Druid, Postgres),
2. joins that raw data into a small set of reusable, denormalized tables, and
3. runs ~47 active, requirement-specific jobs on top of those tables —
   each one producing a CSV report, a Postgres/BigQuery warehouse table, a
   Redis cache entry, a Kafka event, a ClickHouse table for the Looker
   dashboards, or some combination of those.

There is no single "main.py that runs everything." `jobs/main.py` exists and
orchestrates four of the Stage 2 jobs in sequence, but in practice each job
under `jobs/stage-0/`, `jobs/stage-1/` and `jobs/stage-2/` is its own
`spark-submit`-able script with its own `main()`. What ties them together is
not code — it's the shared set of Parquet table names in
`constants/ParquetFileConstants.py` that most of them read from or write to.

## The three stages

```
   Cassandra · Elasticsearch · Postgres(app) · MongoDB · Druid · REST APIs
                                  │
                                  ▼
   STAGE 0 — Extract        dataExhaust.py
   One job. ~29 reads, 4 joins. Writes 27 raw Parquet caches under
   data-res/pq_files/cache_pq/<name>/ — one folder per source table/query.
                                  │
                                  ▼
   STAGE 1 — Prejoin         prejoinData.py  (+ 7 dfutil library modules)
   One orchestrator running 18 steps. ~45 joins across those steps. Writes
   ~27 computed Parquet tables under output/computed/<name>/ — these are
   the tables almost every Stage 2 job reads from.
                                  │
                                  ▼
   STAGE 2 — Reports, warehouse & cache      ~47 active jobs
   Each job reads Stage 1's computed tables (sometimes going back to
   Cassandra/Postgres/Redis/Druid directly), does its own joins, and
   produces ONE of: a per-org CSV report, a warehouse table, a Redis
   cache entry, a Kafka message, or a Cassandra write.
                                  │
          ┌──────────────┬───────┴──────┬──────────────────┬──────────────────┐
          ▼              ▼              ▼                  ▼                  ▼
   Postgres warehouse  BigQuery     Redis (dashboard)  GCS (zipped,       ClickHouse
   (dataWarehouse.py/  (bq-         (dashboardSync.py  password-          (Looker dashboard
   *Bash.sh)           scripts.sh)  + several others)  protected CSVs,    scripts + ClickHouse
                                                       via polarsCSVExport bash load)
                                                       + zipUpload.py)
```

### Stage 0 — Extract (`jobs/stage-0/dataExhaust.py`)

The single point where every raw external system enters the pipeline. One
class, `DataExhaustModel`, with one `process_data()` method that runs ~29
reads in sequence:

- **Cassandra** — the bulk of the reads: enrolments, course batches,
  content/framework/questionset hierarchy, ratings, ACBP plans, user roles,
  org records, karma points, learner-leaderboard snapshot, extended user
  profiles, old (pre-migration) assessments, external/marketplace
  enrolments, unenrolment audit history, CAP access-control rules.
- **Elasticsearch** — 5 separate `compositesearch`/`fs-forms` queries: course
  catalog, events, final/standalone assessment metadata, course-completion
  survey submissions.
- **Postgres (app schema, `sunbird`)** — org hierarchy
  (`org_hierarchy_v4`), learner engagement stats (`learner_stats`),
  marketplace content (`cios_content_entity`).

Every read is written straight to Parquet under
`data-res/pq_files/cache_pq/<name>/`, with **zero transformation** beyond
column renaming and light JSON parsing — the goal of this stage is purely to
get a fast, disk-local snapshot of "what does the source system say right
now," so Stage 1 and Stage 2 never need a live connection to Cassandra,
Elasticsearch or the app database. The only real joins in this stage attach
Postgres's org hierarchy onto Cassandra's org table (3 joins) and attach
event metadata onto event enrolments (1 join).

### Stage 1 — Prejoin (`jobs/stage-1/prejoinData.py`)

A thin orchestrator (159 lines) that runs 18 steps, each a function call into
one of seven shared library modules under `dfutil/`:

| # | Step | Module |
|---|---|---|
| 1 | Clean/derive assessment pass-fail logic | `assessmentDFUtil.parse_raw_assessment_data` |
| 2 | Org + hierarchy | `userDFUtil.preComputeOrgWithHierarchy` |
| 3 | Content ratings & summary | `contentDFUtil.preComputeRatingAndSummaryDataFrame` |
| 4 | Course/program catalog (from ES) | `contentDFUtil.preComputeAllCourseProgramESDataFrame` |
| 5 | Content master table | `contentDFUtil.preComputeContentDataFrame` |
| 6 | Content hierarchy | `contentDFUtil.precomputeContentHierarchyDataFrame` |
| 7 | Assessment ES frame | `assessmentDFUtil.precomputeAssessmentEsDataframe` |
| 8 | External/marketplace content | `contentDFUtil.preComputeExternalContentDataFrame` |
| 9 | User profile master | `userDFUtil.preComputeUser` |
| 10 | Enrolment master table | `enrolmentDFUtil.preComputeEnrolment` |
| 11 | External enrolment | `enrolmentDFUtil.preComputeExternalEnrolment` |
| 12 | User × org master (`USER_ORG_COMPUTED_FILE`) | `userDFUtil.preComputeOrgHierarchyWithUser` |
| 13 | Enrolment-warehouse frame | `enrolmentDFUtil.preComputeUserEnrolmentWarehouseData` |
| 14 | User-warehouse frame | `userDFUtil.preComputeUserWarehouseData` |
| 15 | Content-warehouse frame | `contentDFUtil.preComputeContentWarehouseData` |
| 16 | Direct warehouse Parquet writes (org, events) | `contentDFUtil.writeWarehouseParquetFiles` |
| 17 | Legacy assessment data | `assessmentDFUtil.precomputeOldAssessmentDataframe` |
| 18 | ACBP allocation engine | `acbpDFUtil_v3.preComputeACBPData` |

Two tables produced here matter more than the rest, because nearly
everything downstream reads them:

- **`USER_ORG_COMPUTED_FILE`** — every user, joined to their organization,
  ministry and department. The single most-read table in the repository.
- **`CONTENT_COMPUTED_PARQUET_FILE`** — every course/program, joined to its
  rating and org.
- **`ENROLMENT_COMPUTED_PARQUET_FILE`** and **`ENROLMENT_WAREHOUSE_COMPUTED_PARQUET_FILE`**
  — the enrolment/completion facts, in two shapes (an internal "computed"
  shape most report jobs use, and a warehouse-column-named shape that
  `dashboardSync.py`'s whole SQL library is built on).

The **ACBP allocation engine** (step 18) deserves a special note: unlike
every other step, it runs in **DuckDB, not Spark**, because it has to match
every user against every criterion (org, designation, cadre, group, batch,
service, custom fields…) of every active training plan — roughly 40 SQL
joins across 9 criteria types, run twice (once for org-scoped plans, once
for plans with no org restriction), chunked 2 million users at a time. The
same engine pattern is reused by `capAllotment.py` in Stage 2 for CAP
access-control resolution.

### Stage 2 — Reports, warehouse & cache (~47 active jobs)

Every job here is independent — none of them import each other, and most
have their own `SparkSession`. What connects them is shared table names.
They fall into six groups (also used as the filter categories in the
interactive HTML view). Jobs no longer used are listed separately below.

| Group | Jobs | What it's for |
|---|---|---|
| **Warehouse & dashboard sync** | `dataWarehouse.py`, `dashboardSync.py` (plus `dataWarehouseBash.sh`, the deprecated DuckDB alternative) | Push computed tables into Postgres/BigQuery and Redis |
| **Compliance & enrolment reports** | `acbpReport`, `assessmentReport`, `bharatKalpReport`, `blendedReport`, `capAllotment`, `courseBasedAssessmentReport`, `courseCompletionSurveyReport`, `courseReport` | Per-MDO CSVs on training compliance, content and assessments |
| **Gamification & scoring** | `dsrComputation`, `dsrValidation` *(new)*, `courseHealthMetrics` *(new — Content Health Score)*, `gamificationJob`, `gamificationNotification{Producer,Consumer}`, `inappReview`, `kcmReport`, `l2Assessments` | Daily KPIs and their pre-send check, monthly content health scores, badges, competency mapping |
| **Leaderboards & campaigns** | `learnerLeaderboard`, `ministryLeaderboard`, `ministryMetrics`, `nationalLearningWeek`, `npsUpgraded`, `odcsRecommendation`, `org_hierarchy`, `org_hierarchy_new` *(new)*, `peerValidation{EligibleUsers,NotificationSender}` | Rankings, campaign metrics, notification triggers, org-hierarchy rebuilds |
| **Surveys & export** | `surveyQuestionReport`, `surveyStatusReport`, `unenrollmentReport`, `userActivity`, `userDataToRedis`, `userEnrolment`, `userReport`, `weeklyClaps`, `polarsCSVExport` *(new)*, `zipUpload` | Survey exports, the two "core" user reports, per-org CSV export and final packaging |
| **Looker dashboards (ClickHouse)** | `dashboard_user_enrolments_custom_updated`, `dashboard_content_custom`, `dashboard_myigot`, `AICBPDashboardFactModel`, intermediates `dashboard_national_priority_mapping`, `dashboard_l_org_hierarchy`, `dashboard_kcm`, and the ClickHouse bash load | Parquet for the MDO, Content, IGOT and AI CBP dashboards, loaded into ClickHouse |

**No longer used:** `karmaPoints.py`, `orgHierarchyAll.py`,
`orgHerarchyUpdatedEmpty.py` and `postgresToParquet.py` (the last three
replaced by `org_hierarchy_new.py`), plus the already-inactive
`dsrComputationUpdated.py`, `gamification/dashboard.py`,
`programProgressSyncList_v5.py` and `workFlowSummarizer.py`.

**New since 4.8.39.3:**
- `org_hierarchy_new.py` consolidates the three scripts that ran in sequence
  into one plain-Python job: it rebuilds the Postgres `org_hierarchy_lookup`
  and `mdo_children_lookup` tables and writes `org_hierarchy_new` as Parquet,
  which `bq-scripts.sh` loads to BigQuery.
- `polarsCSVExport.py` — `courseReport.py`, `acbpReport.py` and
  `courseBasedAssessmentReport.py` now write plain Parquet under
  `temp/*-plain/{today}`; this Spark-free step splits it into per-MDO CSVs
  with Polars and deletes the Parquet. It must run the same day, after those
  three jobs and before `zipUpload.py`. Nothing in the repo invokes it (the
  jobs print "run polars_csv_export.py", an outdated filename), and Polars is
  not in `requirements.txt`.
- `courseHealthMetrics.py` — the monthly Content Health Score (see below).
- `dsrValidation.py` — a pre-send check run before the 8 AM Daily Summary
  Report: compares today's `dsr_metrics_history` row against the previous 5
  days and checks the workflow-summary log against Druid. Exits with an
  error only when the DSR checks are critical.

Two jobs are explicitly part of an orchestrated sequence, not standalone:
`jobs/main.py` runs Stage 1, then `userReport.py` ("Stage 2A"),
`assessmentReport.py` ("Stage 2B"), `kcmReport.py` ("Stage 2C") and
`userEnrolment.py` ("Stage 2D") in that order. Every other Stage 2 job is
invoked on its own.

## How the warehouse actually gets updated

This pipeline has **two separate "warehouse" concepts** and it's easy to
conflate them:

1. **Postgres/BigQuery data warehouse** — a set of 12 tables (`user_detail`,
   `content`, `content_resource`, `assessment_detail`, `bp_enrolments`,
   `cb_plan`, `org_hierarchy`, `kcm_content_mapping`, `kcm_dictionary`,
   `events`, `events_enrolment`, `user_enrolments`) that BI/Looker dashboards
   query. Individual report jobs (`courseReport.py`, `userReport.py`,
   `userEnrolment.py`, etc., plus `contentDFUtil.writeWarehouseParquetFiles`
   in Stage 1) each stage their own slice of this as local Parquet under
   `warehouseReportDir` (`<BASE_DIR>/warehouse/<table>/`). Two separate jobs
   then push that Parquet into the real databases:
   - **`dataWarehouse.py`** — Spark, JDBC `mode="overwrite"` — i.e. a full
     truncate-and-reload of every table, every run. No incremental/upsert
     logic anywhere.
   - **`dataWarehouseBash.sh`** — a DuckDB/bash reimplementation of the same
     12 tables (`ATTACH ... TYPE postgres; TRUNCATE; INSERT`), with explicit
     column casts and dedup that `dataWarehouse.py` lacks. **Both exist in
     this branch** — which one is actually cron-scheduled in production
     cannot be determined from the repository alone.
   - **`bq-scripts.sh`** then does the equivalent for BigQuery: for the same
     12 tables plus `org_hierarchy_new` (13 in all), stage to GCS → drop the
     BigQuery table → recreate it empty → `bq load` the staged Parquet →
     clean up the staging files. Also a full replace every run.

2. **Redis "warehouse"** (informal) — the live dashboard's cache.
   `dashboardSync.py` reads the same warehouse-computed Parquet tables via
   DuckDB SQL (the query library in `constants/QueryConstants.py`) and
   writes **50+ keys** into Redis — org counts, leaderboards, trending
   content, certification counts, campaign tickers. It **never writes to
   Postgres**. Since commit 1041b38 it builds the enrolment ⋈ user ⋈ content
   ⋈ org join once per run as a DuckDB table, and imports its queries from
   `constants/QueryConstants_updated.py` — a file that is not committed, so
   the job cannot run from this repository as it stands. This is what makes the admin/learner dashboard feel
   real-time: the UI reads Redis, not the database.

A handful of newer warehouse outputs (`cbp_enrollments`, `apar_cbp_enrollment`,
`bk_course_enrolments`/`bk_event_enrolments`, `cap_allocation_meta`/
`cap_allocation_user_wise`, `user_activity`, `unenrolled_user_audit`,
`userCustomFields`) are written as Parquet by their respective jobs but are
**not yet referenced** by `dataWarehouse.py` or `bq-scripts.sh` — see the
Data Dictionary for the full picture.

3. **ClickHouse** — the Looker dashboard scripts write Parquet for the MDO,
   Content, IGOT and AI CBP dashboards, and a ClickHouse bash script runs
   last and loads it into the ClickHouse warehouse database. These scripts
   are documented from team notes.

## Cross-job dependencies worth knowing about

Because there's no orchestration DAG in this repo, the only way to know
"job B needs job A to have run first" is to trace shared table names by
hand. The dependencies that matter most:

- **`courseReport.py` → `capAllotment.py`, `l2Assessments.py`,
  `courseHealthMetrics.py`** — they read the `content` warehouse table that
  courseReport.py alone writes.
- **`courseReport.py`, `acbpReport.py`, `courseBasedAssessmentReport.py` →
  `polarsCSVExport.py` → `zipUpload.py`** — the three reports' per-MDO CSVs
  only exist once polarsCSVExport.py has run, on the same day.
- **`dsrComputation.py` → `dsrValidation.py`** — the validation reads
  today's `dsr_metrics_history` row and fails if it isn't there yet.
- **`kcmReport.py` → `l2Assessments.py`, `acbpReport.py`** — both read
  `kcm_dictionary` and `kcm_content_mapping`.
- **`userEnrolment.py` → `userActivity.py`, `dsrComputation.py`,
  `nationalLearningWeek.py`, `odcsRecommendation.py`, `ministryMetrics.py`,
  `dashboardSync.py`** — `user_enrolments` is one of the most widely-read
  warehouse tables in the whole pipeline.
- **`gamificationJob.py` → `gamificationNotificationProducer.py`,
  `userReport.py`** — both read the badge-enrolment Parquet gamificationJob
  writes.
- **`peerValidationEligibleUsers.py` → `peerValidationNotificationSender.py`**
  — a Postgres-table outbox/queue pattern, not Kafka despite the class
  names.
- **`gamificationNotificationProducer.py` → `gamificationNotificationConsumer.py`**
  — the same outbox pattern.
- **`userReport.py` + `userEnrolment.py` → `zipUpload.py`** — zipUpload is
  the fan-in consumer of report jobs' CSV output folders.
- **`weeklyClaps.py` → `dataExhaust.py` (next run)** — a closed
  read-modify-write loop: this job updates Postgres `learner_stats`, and
  Stage 0 reads that same table fresh at the start of the *next* pipeline
  run.
- **`contentDFUtil`'s new hierarchy-flattening step → `userReport.py`** —
  added in 4.8.39.3: `userReport.py`'s reworked learning-hours calculation
  now hard-depends on the new `CONTENT_HIERARCHY_FLATTENED_PARQUET_FILE`
  that Stage 1's `contentDFUtil.precomputeContentHierarchyDataFrame` writes.
- **`assessmentDFUtil.standalone_assessment_enrolments_dataframe` →
  `userEnrolment.py`** — standalone assessment rows in `user_enrolments`
  come from this new helper.
- **Org hierarchy** — `org_hierarchy_new.py` and the original
  `org_hierarchy.py` (still used internally) both rebuild
  `org_hierarchy_lookup` and `mdo_children_lookup`, with no coordination
  between them. `org_hierarchy_new.py`'s Parquet then feeds BigQuery via
  `bq-scripts.sh`.
- **Looker dashboards** — `dashboard_national_priority_mapping.py` and
  `dashboard_l_org_hierarchy.py` → MDO dashboard script;
  `dashboard_l_org_hierarchy.py` → IGOT dashboard script; `dashboard_kcm.py`
  → Content dashboard script; all four dashboard scripts → ClickHouse bash
  load.

## Analytics outputs

What the pipeline delivers, and to whom. The interactive page has the full
version, with storage details per output.

| # | Output | Job(s) | Refresh | Stored in | Used by |
|---|---|---|---|---|---|
| 1 | Operational reports (CSV) | One Spark job per report | Daily | GCS (zipped, per MDO) + Postgres warehouse | MDO and SPV admins (download) |
| 2 | Platform analytics | `dashboardSync` | Daily | Redis | Platform APIs → portal UI |
| 3a | DSR | `dsrComputation` | Daily | Email | Stakeholders |
| 3b | Peer Validation weekly report | `peerValidationWeeklyReq` | Weekly, Monday | Email (+ zipped CSVs) | Stakeholders |
| 3c | Monthly report data | `monthlyRequests` | Monthly, last day | Email / shared files | Stakeholders |
| 4 | Warehouse in BigQuery | Warehouse push to BQ | Daily | BigQuery | Looker dashboards, ad hoc BQ queries |
| 5 | Sparrow feed | Sparrow transform job + shell script | Daily | GCS parquet → BigQuery | Sparrow APIs |
| 6 | Weekly claps | `weeklyClaps` | Daily (cumulative for the week) | Postgres | Claps API → portal UI |
| 7 | Landing page analytics | Ansible script (reads ES) | Every 4 hours | Landing page data | Public landing page (not logged in) |
| 8 | Content Health Score (CHS) | `courseHealthMetrics` | Monthly | Redis (current month) + Postgres (monthly history) | Content API → portal UI (per content) |

Marketplace courses are part of the operational reports (row 1); there is no
separate marketplace report. Operational reports are: User (`userReport.py`),
Content (`courseReport.py`), Consumption (`userEnrolment.py`), ACBP
(`acbpReport.py`), Blended program (`blendedReport.py`), Assessment
(`assessmentReport.py`), Course Based Assessment
(`courseBasedAssessmentReport.py`) and Gamification (`gamificationJob.py`).

**Code check on row 8 (2026-11-02):** `courseHealthMetrics.py` writes
`course_health_metrics_history` in overwrite mode, so today Postgres holds
only the latest month, not every month.

## Technology stack

| Layer | Technology |
|---|---|
| Compute | Apache Spark (PySpark), local mode (`local[*]`/`local[N]`) |
| Heavy SQL / high-cardinality joins | DuckDB (ACBP/CAP allocation engines, `dashboardSync.py`'s query library, warehouse export scripts, most CSV writers) |
| Sources | Cassandra, Elasticsearch, Redis, MongoDB, Druid, Postgres (two logical databases: app `sunbird` schema and warehouse `warehouse` schema) |
| Sinks | Postgres (warehouse schema), BigQuery, Redis, Cassandra, Kafka, GCS, ClickHouse (Looker dashboards) |
| Intermediate storage | Parquet (Snappy-compressed), on local disk |
| Report delivery | CSV (per-MDO split by DuckDB, or by Polars for the Course, ACBP and assessment reports), zipped and password-protected per organization, uploaded to GCS |
| CI/CD | Jenkins (build: zip + archive artifact; deploy: download artifact + `ansible-playbook`) |
| Config management | Ansible (templates `jobs/config.py` from a private inventory at deploy time) |
| Scheduling | **Not present in this repository.** `gamification/prerequisites.md` and a `unifiedParquetPath: 'airflowData/'` config constant both point to an external Airflow instance. No cron/systemd file exists anywhere in the repo. |

See [`Data-pipeline-overview.html`](Data-pipeline-overview.html) for the full,
end-to-end deployment timeline (commit → Jenkins build → Jenkins deploy →
Ansible → external scheduler → Stage 0/1/2 → warehouse/BigQuery sync →
ClickHouse load → per-org CSV export → zip/upload → cleanup), and [`JOB_DETAILS.md`](JOB_DETAILS.md) for the
per-job reference this document summarizes.
