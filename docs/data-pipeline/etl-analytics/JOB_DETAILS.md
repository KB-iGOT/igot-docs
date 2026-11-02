# cb-core-data — Job Details

Exhaustive per-job reference for every job in the pipeline, as it exists on
branch **`cbrelease-4.8.41`**, checked against the code on 2026-11-02. Jobs
changed since `cbrelease-4.8.39.3` carry a **"Changed since 4.8.39.3"** list
with the commits involved; jobs added since then carry **"Added since
4.8.39.3"**. Jobs that are no longer used are marked as such and kept for
reference. For the big picture first, read [`ARCHITECTURE.md`](ARCHITECTURE.md);
for an interactive, searchable version of this same content, open
[`Data-pipeline-overview.html`](Data-pipeline-overview.html).

**Two jobs currently fail as committed** (details in their sections):
`dashboardSync.py` imports `constants.QueryConstants_updated`, which is not
in the repository, and `userEnrolment.py` calls `assessmentDFUtil` without
importing it.

**Read-type key:** `Cassandra` · `Elasticsearch` · `Postgres(app)` = app DB,
schema `sunbird` · `Postgres(warehouse)` = warehouse DB, schema `warehouse` ·
`Redis` · `MongoDB` · `Druid` · `REST API` · `Parquet(raw)` = Stage-0 cache
under `data-res/pq_files/cache_pq/` · `Parquet(computed)` = Stage-1 output
under `output/computed/` · `Parquet(warehouse)` = local mirror of the
warehouse DB under `warehouseReportDir`.

---

## Table of contents

- [Stage 0 — Extract](#stage-0--extract)
- [Stage 1 — Prejoin](#stage-1--prejoin)
  - [Shared `dfutil` library modules](#shared-dfutil-library-modules)
- [Stage 2 — Warehouse & Dashboard Sync](#stage-2--warehouse--dashboard-sync)
- [Stage 2 — Compliance & Enrolment Reports](#stage-2--compliance--enrolment-reports)
- [Stage 2 — Gamification & Scoring](#stage-2--gamification--scoring)
- [Stage 2 — Leaderboards & Campaigns](#stage-2--leaderboards--campaigns)
- [Stage 2 — Surveys & Export](#stage-2--surveys--export)
- [Stage 2 — Looker Dashboards (ClickHouse)](#stage-2--looker-dashboards-clickhouse)

---

## Stage 0 — Extract

### Data Exhaust — `jobs/stage-0/dataExhaust.py`

**Business purpose:** The single entry point for every raw external system.
Reads Cassandra, Elasticsearch and Postgres directly and writes each result
straight to Parquet — nothing downstream ever opens a live connection to a
source system again.
**How it's run:** `spark-submit jobs/stage-0/dataExhaust.py`, no CLI args.

**Reads (~29 total):**

| # | Type | Source | Notes |
|---|---|---|---|
| 1 | Cassandra | `cassandraUserEnrolmentsTable` (course keyspace) | → `enrolment` cache |
| 2 | Cassandra | `cassandraCourseBatchTable` (course keyspace) | → `batch` cache |
| 3 | Cassandra | `cassandraFrameworkHierarchyTable`, filtered `identifier='kcmfinal_fw'` | → `kcmV6` cache |
| 4 | Cassandra | `cassandraQuestionSetHierarchyTable`, JSON-parsed | → `questionsetHierarchy` cache |
| 5 | Cassandra | `cassandraUserAssessmentTable` | → `userAssessmentRaw` cache |
| 6 | Cassandra | `cassandraContentHierarchyTable` | → `hierarchy` cache |
| 7 | Cassandra | `cassandraRatingSummaryTable` | → `ratingSummary` cache |
| 8 | Cassandra | `cassandraAcbpTable` | → `acbp` cache |
| 9 | Cassandra | `cassandraRatingsTable` | → `rating` cache |
| 10 | Cassandra | `cassandraUserRolesTable` | → `role` cache |
| 11 | Elasticsearch | `compositesearch` — 7 primary categories (Course, Program, Blended Program, …) | → `esContent` cache |
| 12 | Cassandra | `cassandraOrgTable` | → `org` cache, and joined into `orgHierarchy` |
| 13 | Postgres(app) | `appOrgHierarchyTable` (`org_hierarchy_v4`) | → `orgCompleteHierarchy` cache (raw) + joined into `orgHierarchy` |
| 14 | Postgres(app) | `dwLearnerStatsTable` (`learner_stats`) | → `weeklyClaps` cache |
| 15 | Postgres(app) | `cios_content_entity` | → `externalContent` cache |
| 16 | Cassandra | `sunbird_courses.user_external_enrolments` | → `externalCourseEnrolments` cache |
| 17 | Cassandra | `sunbird_courses.enrollment_history_by_action` | → `unenrolledUserAudit` cache |
| 18 | Cassandra | `cassandraOldAssesmentTable`, **safe-columns-only read** (avoids a known timestamp-overflow bug) | → `oldAssessmentDetails` cache |
| 19 | Cassandra | `cassandraUserTable` | → `user` cache |
| 20 | Cassandra | `cassandraLearnerLeaderBoardTable` | → `learnerLeaderBoard` cache |
| 21 | Cassandra | `cassandraKarmaPointsTable` | → `userKarmaPoints` cache |
| 22 | Cassandra | `cassandraKarmaPointsSummaryTable` | → `userKarmaPointsSummary` cache |
| 23 | Elasticsearch | `compositesearch`, `objectType='Event'` | → `eventDetails` cache |
| 24 | Cassandra | `user_entity_enrolments` (course keyspace), joined with #23 | → `eventEnrolmentDetails` cache |
| 25 | Cassandra | `cassandraUserExtendedProfileTable` | → `userExtendedProfile` cache |
| 26 | Elasticsearch | `compositesearch`, Course Assessment + Final Program Assessment | → `esFinalAssessment` cache |
| 27 | Elasticsearch | `compositesearch`, Course Assessment | → `esCourseAssessment` cache (ad hoc path, not a named constant) |
| 28 | Cassandra | `sunbird_courses.access_setting_rules_v2` | → `accessControlSettings` cache (ad hoc path; feeds `capAllotment.py`) |
| 29 | Elasticsearch | `fs-forms-data-alias-v2` (IGOT ES host) | → `courseCompletionSurvey` cache |

**Joins (4 total):**

| # | Left | Right | Type | Key | Why |
|---|---|---|---|---|---|
| 1 | Cassandra `org` | Postgres `org_hierarchy_v4` | LEFT | `sborgid` | attach ministry/dept hierarchy to the cassandra org record |
| 2 | (1) | ministry lookup (self) | LEFT | `l1mapid` | resolve ministry name |
| 3 | (2) | department lookup (self) | LEFT | `l2mapid` | resolve department name |
| 4 | Event enrolments | Event details | LEFT | `event_id` | attach event duration |

**Processing:** Flattens nested ES JSON (speakers, recorded links, badge
metadata); formats durations as `HH:MM:SS`; the org-hierarchy join runs
three times (self, ministry, department) to build a flat mdo→ministry→dept
row. No Mongo or Druid reads happen here — those are specific to certain
Stage 2 jobs (Mongo: `surveyQuestionReport.py`/`surveyStatusReport.py`;
Druid: `dsrComputation(Updated).py`, `ministryMetrics.py`, `npsUpgraded.py`,
`surveyQuestionReport.py`, `surveyStatusReport.py`, `weeklyClaps.py`,
`dashboardSync.py`).

**Writes:** 27 raw Parquet caches under `data-res/pq_files/cache_pq/` — one
folder per row above. No CSV, no warehouse, no Redis, no Kafka.

**Downstream:** Every Stage 1 step and most Stage 2 jobs read from these
caches directly or via Stage 1's computed tables.

---

## Stage 1 — Prejoin

### Prejoin & Compute — `jobs/stage-1/prejoinData.py`

**Business purpose:** Orchestrates 18 join/derive steps (see table below),
turning Stage 0's per-table raw caches into the small set of denormalized
"computed" tables that nearly every Stage 2 job reads from.
**How it's run:** `spark-submit jobs/stage-1/prejoinData.py`, no CLI args;
runs each step via a `run_stage()` wrapper that times and logs it, raising
on the first failure.

**The 18 steps:**

| # | Step | Function | Needs config? |
|---|---|---|---|
| 1 | Clean/derive assessment pass-fail | `assessmentDFUtil.parse_raw_assessment_data` | Yes |
| 2 | Org + hierarchy | `userDFUtil.preComputeOrgWithHierarchy` | No |
| 3 | Content ratings & summary | `contentDFUtil.preComputeRatingAndSummaryDataFrame` | No |
| 4 | Course/program catalog (ES) | `contentDFUtil.preComputeAllCourseProgramESDataFrame` | No |
| 5 | Content master table | `contentDFUtil.preComputeContentDataFrame` | No |
| 6 | Content hierarchy | `contentDFUtil.precomputeContentHierarchyDataFrame` | No |
| 7 | Assessment ES frame | `assessmentDFUtil.precomputeAssessmentEsDataframe` | No |
| 8 | External/marketplace content | `contentDFUtil.preComputeExternalContentDataFrame` | No |
| 9 | User profile master | `userDFUtil.preComputeUser` | No |
| 10 | Enrolment master table | `enrolmentDFUtil.preComputeEnrolment` | No |
| 11 | External enrolment | `enrolmentDFUtil.preComputeExternalEnrolment` | No |
| 12 | User × org master | `userDFUtil.preComputeOrgHierarchyWithUser` | No |
| 13 | Enrolment-warehouse frame | `enrolmentDFUtil.preComputeUserEnrolmentWarehouseData` | No |
| 14 | User-warehouse frame | `userDFUtil.preComputeUserWarehouseData` | No |
| 15 | Content-warehouse frame | `contentDFUtil.preComputeContentWarehouseData` | No |
| 16 | Direct warehouse Parquet writes | `contentDFUtil.writeWarehouseParquetFiles` | Yes |
| 17 | Legacy assessment data | `assessmentDFUtil.precomputeOldAssessmentDataframe` | No |
| 18 | ACBP allocation engine | `acbpDFUtil_v3.preComputeACBPData` | No |

**Downstream:** `USER_ORG_COMPUTED_FILE`, `CONTENT_COMPUTED_PARQUET_FILE` and
`ENROLMENT_COMPUTED_PARQUET_FILE`/`ENROLMENT_WAREHOUSE_COMPUTED_PARQUET_FILE`
are each read by 15–20 of the 40 Stage 2 jobs.

### Shared `dfutil` library modules

These are not independently-run jobs — they're the library code Stage 1
calls, and several are also called directly by Stage 2 report jobs. Listed
here because "how many joins" and "what does it read/write" apply to them
just as much as to a standalone job.

#### `dfutil/user/userDFUtil.py`

**Purpose:** User profile parsing, org-hierarchy attachment, the master USER_ORG_COMPUTED table, the user-warehouse builder, and the per-user content/event learning-hours helpers that userReport.py calls. 8 joins.

**Changed since 4.8.39.3:**
- 0ea0051 (2026-08-28): removed the category == Course condition from the total_content_duration sum in appendContentDurationCompletionForEachUser
- Correction to existing docs: join 8 (event details) is LEFT, not INNER; userReport.py does not call preComputeUserWarehouseData

**Reads (2):**
- `Parquet(raw)` — USER_PARQUET_FILE, ROLE_PARQUET_FILE, USER_KARMA_POINTS_PARQUET_FILE, CLAPS_PARQUET_FILE, ORG_PARQUET_FILE, ORG_HIERARCHY_PARQUET_FILE, EVENT_ENROLMENT_PARQUET_FILE
- `Parquet(computed)` — ORG_COMPUTED, USER_COMPUTED, USER_ORG_COMPUTED_FILE, ENROLMENT_WAREHOUSE_COMPUTED, CONTENT_COMPUTED

**Joins (8):**
- LEFT · user ⋈ role (concatenated) on userID
- LEFT · + karma points (summed) on userID
- LEFT · + weekly claps on userID
- LEFT · org ⋈ org-hierarchy on orgID=userOrgID
- INNER · user ⋈ org on userOrgID=usermergedOrgID — produces USER_ORG_COMPUTED_FILE
- LEFT · enrolment ⋈ content-duration on content_id (appendContentDurationCompletionForEachUser)
- LEFT · user master ⋈ enrolment aggregates on userID (same helper)
- LEFT · user frame ⋈ event aggregates on userID (appendEventDurationCompletionForEachUser)

**Processing:**
- Parses the nested profileDetails JSON (personal/employment/professional/cadre details) into flat columns
- preComputeOrgHierarchyWithUser produces USER_ORG_COMPUTED_FILE, the most-read table in the repo
- CHANGED: appendContentDurationCompletionForEachUser now sums courseDuration for every completed, certificated enrolment regardless of category (category == Course condition removed); the caller's content_duration_df decides which categories count. Result in hours (bround 2)
- preComputeUserWarehouseData still pre-filters CONTENT_COMPUTED to courseCategory = Course, so its output is unaffected by the change; it adds no external-content hours, so its learning hours differ from userReport.py's user_detail
- appendEventDurationCompletionForEachUser: event hours = sum of event_duration_seconds for completed events with a certificate_id, in hours

**Writes:**
- **Parquet:** USER_SELECT, USER_COMPUTED, ORG_SELECT, ORG_HIERARCHY_SELECT, ORG_COMPUTED, USER_ORG_COMPUTED, USER_WAREHOUSE_COMPUTED

**Downstream:** USER_ORG_COMPUTED_FILE is read by most Stage 2 jobs. USER_WAREHOUSE_COMPUTED is read by dashboardSync.py and odcsRecommendation.py. userReport.py calls appendContentDurationCompletionForEachUser and appendEventDurationCompletionForEachUser directly (it does not call preComputeUserWarehouseData).

#### `dfutil/content/contentDFUtil.py`

**Purpose:** Builds the master content catalog (course/program metadata plus ratings plus org), the content-warehouse table, and the flattened content hierarchy (parent plus 4 child levels in one wide row) used by userReport.py's learning-hours calculation. 11 joins.

**Changed since 4.8.39.3:**
- 0ea0051 (2026-08-28) and ecf1852 (2026-09-01): added parent_batches, parent_milestones_v1, parent_preliminary_assessment_id to CONTENT_HIERARCHY_FLATTENED (new safe_raw_field helper); schema inference switched from 30% sample to full scan

**Reads (2):**
- `Parquet(raw)` — ESCONTENT_PARQUET_FILE, RATING_SUMMARY_PARQUET_FILE, RATING_PARQUET_FILE, EXTERNAL_CONTENT_PARQUET_FILE, HIERARCHY_PARQUET_FILE
- `Parquet(computed)` — ALL_COURSE_PROGRAM_COMPUTED, CONTENT_RATING_COMPUTED, ORG_COMPUTED, CONTENT_COMPUTED, CONTENT_HIERARCHY_SELECT, ENROLMENT_COMPUTED, BATCH_SELECT, EXTERNAL_ENROLMENT_COMPUTED, EXTERNAL_CONTENT_COMPUTED

**Joins (9):**
- LEFT · content ⋈ content-rating on courseID
- LEFT · + org on courseOrgID — produces CONTENT_COMPUTED
- LEFT · enrolment ⋈ resource-count on courseID
- LEFT · content ⋈ completion aggregates on courseID
- INNER then LEFT · Blended Program subset ⋈ batch data on courseID
- OUTER · marketplace content ⋈ marketplace enrolment aggregates on content_id
- LEFT · + SCORM-detection flags on courseID
- LEFT · event enrolments ⋈ karma points on (user_id, event_id)
- LEFT · addHierarchyColumn / addCourseOrgDetails helper joins (identifier, courseOrgID)

**Processing:**
- precomputeContentHierarchyDataFrame writes CONTENT_HIERARCHY_SELECT, then infers the hierarchy JSON schema with spark.read.json and flattens parent plus first..fourth level children (explode_outer on children, NULL columns where a level has none) for 23 fields (identifier, primaryCategory, duration, mimeType, name, leafNodesCount, ..., publish_type, leafNodes) into one row per root_content_id leaf path
- CHANGED: schema inference now scans all non-null hierarchy rows (infer_hierarchy_schema default sample_fraction changed from 0.3 to None), so rarely present nested fields are no longer missed; costs a full JSON pass
- NEW parent-only columns: parent_batches (raw struct array, via new safe_raw_field helper that keeps the native type), parent_milestones_v1 (raw), parent_preliminary_assessment_id (string via safe_field); NULL string if absent from the inferred schema
- preComputeContentWarehouseData unions platform content with marketplace content into the warehouse-shaped frame
- writeWarehouseParquetFiles writes org_hierarchy, event_details and event_enrolment_details straight to warehouseReportDir
- Minor: helper functions (infer_hierarchy_schema, safe_field, get_struct_type, has_children, safe_raw_field) carry a no-op module-level @staticmethod decorator

**Writes:**
- **Parquet:** ALL_COURSE_PROGRAM_COMPUTED, RATING_SUMMARY_COMPUTED, RATING_COMPUTED, CONTENT_RATING_COMPUTED, EXTERNAL_CONTENT_COMPUTED, CONTENT_HIERARCHY_SELECT, CONTENT_COMPUTED, CONTENT_WAREHOUSE_COMPUTED, CONTENT_HIERARCHY_FLATTENED (output/computed/content_hierarchy_flattened; now with parent_batches, parent_milestones_v1, parent_preliminary_assessment_id)
- **Warehouse / Postgres:** warehouse/org_hierarchy, warehouse/event_details, warehouse/event_enrolment_details (direct writes)

**Downstream:** CONTENT_COMPUTED_PARQUET_FILE is read by many Stage 2 jobs. CONTENT_HIERARCHY_FLATTENED_PARQUET_FILE is read only by userReport.py, which uses the three new parent columns for Blended Program offline sessions and Learning Pathway durations.

#### `dfutil/enrolment/enrolmentDFUtil.py` — 6 joins

**Used by:** Stage 1 (steps 10, 11, 13); `preComputeUserOrgEnrolment` is
also called directly by `courseReport.py` and `unenrollmentReport.py`.

| # | Left | Right | Type | Key | Why |
|---|---|---|---|---|---|
| 1 | enrolment | batch | LEFT | `courseID`,`batchID` | attach batch name/dates |
| 2 | (1) | user rating | LEFT | `userID`,`courseID` | attach rating — produces `ENROLMENT_COMPUTED_PARQUET_FILE` |
| 3 | (2) | karma points | LEFT | `userID`,`courseID` | attach karma earned per enrolment |
| 4 | enrolment | content org (shared helper) | LEFT | `courseID` | attach content metadata |
| 5 | (4) | user org | LEFT | `userID` | attach user/org profile |
| 6 | external content | external enrolment | INNER | `content_id` | build marketplace enrolment frame, unioned into `ENROLMENT_WAREHOUSE_COMPUTED_PARQUET_FILE` |

**Writes:** `ENROLMENT_SELECT`, `BATCH_SELECT`, `ENROLMENT_COMPUTED`,
`EXTERNAL_ENROLMENT_COMPUTED`, `ENROLMENT_WAREHOUSE_COMPUTED`.

#### `dfutil/assessment/assessmentDFUtil.py`

**Purpose:** Assessment scoring engine: decides pass/fail using section-level or overall-result cutoffs, cleans the userAssessment raw cache, and holds reusable join helpers that assessment report jobs call directly. New since 4.8.39.3: a helper that synthesizes Standalone Assessment enrolment rows for user_enrolments.

**Changed since 4.8.39.3:**
- c29fd2b (2026-09-15): added standalone_assessment_enrolments_dataframe (about 114 lines) to synthesize Standalone Assessment enrolment rows for user_enrolments

**Reads (5):**
- `Parquet(raw)` — ESCONTENT_PARQUET_FILE (via contentDFUtil.esContentDataFrame, for precomputeAssessmentEsDataframe)
- `Parquet(raw)` — QUESTIONSET_HIERARCHY_PARQUET_FILE, ASSESSMENT_DATA_RAW_PARQUET_FILE (userAssessmentRaw), OLD_ASSESSMENT_PARQUET_FILE
- `Parquet(raw)` — HIERARCHY_PARQUET_FILE, USER_ASSESSMENT_PARQUET_FILE (cleaned userAssessment cache) - new reads in standalone_assessment_enrolments_dataframe
- `Parquet(computed)` — ALL_COURSE_PROGRAM_COMPUTED_PARQUET_FILE, USER_ORG_COMPUTED_FILE
- `Parquet(computed)` — ALL_ASSESSMENT_COMPUTED_PARQUET_FILE, ORG_COMPUTED_PARQUET_FILE - new reads in standalone_assessment_enrolments_dataframe

**Joins (15):**
- LEFT · old-assessment ⋈ course on courseID
- LEFT · + user-org on userID
- LEFT · assessment ⋈ org on assessOrgID (transform_assessment_data)
- LEFT · df ⋈ hierarchy on identifier (shared add_hierarchy_column helper)
- INNER · user-attempt ⋈ assessment-children on assessChildID
- LEFT · + assessment details on assessID
- LEFT · + course details on courseID
- LEFT · + user-org on userID
- LEFT · course ⋈ rating on (courseID, categoryLower)
- LEFT · course ⋈ org on courseOrgID
- INNER · section-wise results ⋈ questionset hierarchy on assessChildID=questionsetID
- LEFT · raw attempts ⋈ section-derived results on (assessChildID, userID, assessStartTimestamp) — keeps every raw attempt
- NEW INNER · raw user attempts ⋈ Standalone Assessment children on assessChildID — attaches parent assessID, drops non-standalone attempts
- NEW LEFT ANTI · in-progress picks ⋈ completed rows on (content_id, userID) — a user with a completed row is not also listed in-progress
- (standalone helper also reuses add_hierarchy_column and transform_assessment_data joins above)

**Processing:**
- Section-level cutoff: pass requires every section to pass. Overall-result cutoff: pass requires the overall score to meet the configured minimum
- parse_raw_assessment_data writes its output back into the raw cache directory (<baseCachePath>/userAssessment) rather than output/computed
- NEW standalone_assessment_enrolments_dataframe: filters ALL_ASSESSMENT_COMPUTED to assessCategory = Standalone Assessment and excludes .img ids; one row per (userID, parent assessID) across all child assessments
- Completed branch: highest-scored SUBMITTED attempt (by assessOverallResult, or assessTotalSectionMarks when sectional); enrolled_on/last_accessed = assessEndTime; certificate_generated Yes if assessPass = 1; progress 100
- In-progress branch: users with only non-SUBMITTED attempts; latest by assessStartTime; enrolled_on/last_accessed = assessStartTime; certificate_generated No; progress 0
- Output columns: content_id, userID, enrolled_on_epoch, last_accessed_epoch, user_consumption_status, certificate_generated, content_progress_percentage, batchID ('Not Available'), enrolment_status ('enrolled'); no parquet written by this helper

**Writes:**
- **Parquet:** ALL_ASSESSMENT_COMPUTED_PARQUET_FILE, OLD_ASSESSMENT_COMPUTED_PARQUET_FILE; raw cache: <baseCachePath>/userAssessment (cleaned, overwritten)

**Downstream:** Stage 1 (prejoinData.py) runs parse_raw_assessment_data, precomputeAssessmentEsDataframe and precomputeOldAssessmentDataframe. Helpers are imported by assessmentReport.py, courseBasedAssessmentReport.py, odcsRecommendation.py, dashboardSync.py, and now userEnrolment.py (standalone_assessment_enrolments_dataframe, though userEnrolment.py lacks the import).

#### `dfutil/enrolment/acbp/acbpDFUtil_v3.py`

**Purpose:** The ACBP allocation engine: resolves which users are mandated onto which Live competency-based training plan by matching plan userGroup criteria (org, designation, cadre, group, batch, service, central deputation, explicit users, all users, plus org-defined custom fields) against every user. Plan parsing is in Spark; matching runs in DuckDB, chunked, for scale.

**Changed since 4.8.39.3:**
- 2381822 (2026-09-02): added planyear and plantype to the plan select and draft select (deployed alongside the ansible switch to cb_plan_v3)
- b8dcf16 (2026-09-07): same columns, final form; no change to matching logic

**Reads (3):**
- `Parquet(raw)` — ACBP_PARQUET_FILE (Stage-0 dump of Cassandra table config.cassandraAcbpTable, now cb_plan_v3)
- `Parquet(raw)` — userExtendedProfile (hardcoded path /home/analytics/pyspark/data-res/pq_files/cache_pq/userExtendedProfile; contexttype = orgAdditionalProperties for custom fields)
- `Parquet(computed)` — USER_ORG_COMPUTED_FILE

**Joins (4):**
- About 40 SQL joins in DuckDB. Org-scoped plans: rootorgid and alluser are one INNER match each; user/customuser, designation, cadre, group, batch, service and isoncentraldeputation are one INNER match plus one LEFT rootorgid-scoping guard each; custom fields add INNER user_custom_fields + INNER criteria + LEFT guard. Run per 2M-user chunk
- Global (no orgID) plans: the same INNER + LEFT guard pattern for user/customuser, designation, cadre, group, batch, service, isoncentraldeputation and custom fields, combined with UNION ALL (no rootorgid or alluser branch)
- INNER · complete matches ⋈ criteria group count on (acbpID, criteria_group_id) — keeps groups where every criterion type matched
- INNER · qualified pairs ⋈ users on userID and ⋈ plan_info on acbpID — chunked 2M pairs at a time to build the output rows

**Processing:**
- Regex pre-pass wraps scalar criteriaValue JSON values into arrays before parsing contextdata
- AND within a userGroup (matched distinct criteria types must equal the group's total), OR between userGroups
- Draft plans take name, assignmentType, assignmentTypeInfo, endDate and contentList from draftdata; allocatedOn is null for drafts
- CHANGED (2381822, b8dcf16): planyear and plantype are now selected from the Cassandra row and carried on both non-draft and draft plan rows into ACBP_SELECT_FILE. They are not carried into ACBP_COMPUTED_FILE
- DuckDB memory limit = 60% of free RAM (minimum 8GB), 8 threads; temp work in <repo>/temp_acbp_duckdb, deleted at the end
- Global plans have no alluser branch, so a global plan whose only criterion is alluser allocates nobody
- Legacy acbpDFUtil.py (non-v3) is still imported by dfexportutil.py but never called. 98d43e0 added planyear to it, which has no effect

**Writes:**
- **Parquet:** ACBP_SELECT_FILE (all plans, now with planyear and plantype); ACBP_COMPUTED_FILE (final user x plan allocation list, single part-00000.parquet)

**Downstream:** Called from Stage 1 prejoinData.py (ACBP Enrolment Computation). ACBP_COMPUTED_FILE is read by acbpReport.py, userEnrolment.py, unenrollmentReport.py and l2Assessments.py; ACBP_SELECT_FILE by acbpReport.py.

#### `dfutil/dfexport/dfexportutil.py` — 0 joins

**Used by:** ~15 Stage 2 report jobs, for CSV export.

The shared report-writing layer. `write_csv_per_mdo_id`/
`write_csv_per_mdo_id_duckdb` implement a hybrid strategy: orgs with ≤100,000
rows are written directly via Spark `partitionBy` + CSV; larger orgs are
routed through a temp partitioned-Parquet → DuckDB → CSV conversion,
parallelized across workers. `write_single_csv_duckdb` produces one combined
CSV (for a central/admin view); `write_csv_combined` does both at once. This
is the mechanism behind the `<output_dir>/mdoid=<org_id>/<report>.csv`
folder convention used by nearly every report job below.

#### `dfutil/utils/{utils.py, redis.py, QueryExecutor.py}`

Low-level helpers, not independently run: `utils.py` wraps Druid REST calls
(`druidDFOption`), generic HTTP, GCS sync/zip (`sync_reports`,
`zip_and_sync_reports`), Elasticsearch reads (`read_elasticsearch_data[_scroll]`,
a manual REST implementation, not always the Spark ES connector), Cassandra
writes and Kafka dispatch. `redis.py` wraps the Python `redis` client with
single-key get/update, hash-map get/update/dispatch, DataFrame→Redis-hash
dispatch, and batched pipelined bulk updates — supporting both the main
Redis instance and a separate "karma points" Redis instance
(`redisKpHost`). `QueryExecutor.py` is a generic ad hoc "run N queries, save
to CSV/JSON" helper, not part of the main call graph.

##### `dfutil/utils/utils.py` — current state

**Purpose:** Low-level helpers, not independently run: Druid REST/SQL calls, generic HTTP, GCS sync and zip-and-sync of report folders, Elasticsearch reads (manual REST, including scroll), Cassandra read/write, and Kafka dispatch of DataFrames.

**Changed since 4.8.39.3:**
- 1041b38 (2026-09-30, optimisation phase 1): added dispatch_df_to_kafka_updated (confluent_kafka, to_json serialization, coalesce to 4 partitions, lz4 batching) and adopted it in dashboardSync.py for the user course program progress topic; whitespace cleanup in zip_and_sync_reports

**Reads (4):**
- `Druid` — druidDFOption / druidSQLAPI (caller-supplied query)
- `Elasticsearch` — read_elasticsearch_data, read_elasticsearch_data_scroll (caller-supplied index)
- `Cassandra` — read_cassandra_table (caller-supplied keyspace/table)
- `REST API` — api() generic HTTP

**Joins (1):**
- 0 — helper module, no DataFrame joins

**Processing:**
- sync_reports / zip_and_sync_reports: zip a report folder (removing .crc files and stale zip), clear the folder, move the zip inside it and upload to GCS (google.cloud.storage)
- dispatch_df_to_kafka (unchanged): kafka-python KafkaProducer per partition, json.dumps(row.asDict()) per row; used by peerValidationNotificationSender.py
- NEW dispatch_df_to_kafka_updated(df, topic, broker_list, num_partitions=4): serializes each row with Spark to_json(struct(*cols)) keeping null fields, coalesces to at most num_partitions partitions, and sends with a confluent_kafka Producer (lz4 compression, linger.ms 100, batch.size 1 MB, acks 1, large buffers), polling every 50000 messages and flushing per partition; delivery failures are only printed
- Used by dashboardSync.py to dispatch the user course/program progress DataFrame to config.userCourseProgramProgress via config.dpBrokerList
- read_elasticsearch_data_scroll is defined twice in the file (pre-existing); the later definition wins
- Rest of the diff is whitespace-only changes in zip_and_sync_reports

**Writes:**
- **Kafka:** dispatch_df_to_kafka_updated: dashboardSync.py -> topic config.userCourseProgramProgress (dev default dev.dashboards.user.course.program.progress); dispatch_df_to_kafka: peerValidationNotificationSender.py -> config.peerValidationKafkaTopic
- **Other:** GCS uploads via sync_reports / zip_and_sync_reports; Cassandra via writeToCassandra

**Downstream:** Imported by many jobs for Druid/ES/GCS helpers; the new Kafka helper is used only by dashboardSync.py.

---

## Stage 2 — Warehouse & Dashboard Sync

### Data Warehouse Sync (Postgres) — `jobs/stage-2/dataWarehouse.py`

**Business purpose:** Reads the local Parquet snapshots that other report
jobs stage under `warehouseReportDir` and JDBC-writes each straight into the
Postgres **warehouse** schema.
**How it's run:** standalone, no CLI args.

**Reads (12):** `warehouse/{user_detail, content, assessment_detail,
bp_enrolments, content_resource, cb_plan, org_hierarchy, kcm_content_mapping,
kcm_dictionary, event_details, event_enrolment_details, user_enrolments}`.

**Joins:** 0 — no dataframe joins at all.

**Writes:** 12 Postgres tables, `mode="overwrite"` — a full truncate and
reload every run, not incremental. (`course_completion_survey_details`'s
push line exists in the source but is commented out.)

**Downstream:** `bq-scripts.sh` mirrors the same tables into BigQuery.

### Data Warehouse Sync (DuckDB) — `jobs/stage-2/dataWarehouseBash.sh`

**Business purpose:** A bash/DuckDB reimplementation of the exact same
responsibility as `dataWarehouse.py`, with explicit column casts and dedup
logic the Spark version lacks — more schema-safe. **Both exist in this
branch**; which one actually runs in production isn't visible from the repo.
**How it's run:** shell script; shells out to
`python3 -c "from jobs.config import get_environment_config"` to read
Postgres connection details.

**Reads:** the same `warehouse/<table>/*.snappy.parquet` folders, via
DuckDB `read_parquet()`.
**Joins:** 0 — straight `TRUNCATE` + `INSERT` per table.
**Processing:** lightweight → heavyweight execution order; `content` is
deduplicated via `ROW_NUMBER()` — **fixed in 4.8.39.3** to add an
explicit `ORDER BY last_published_on DESC`, making the dedup deterministic
(previously unordered, so which of two duplicate rows survived was
arbitrary); `bp_enrolments`/`assessment_detail`/`user_enrolments` filter
out rows with NULL foreign keys before insert; `user_enrolments` (~19GB) is
deliberately loaded last. **Added in 4.8.39.3:** per-table and total
execution timing, logged to stdout with a summary table printed at the end
— a lightweight bash-level addition, unrelated to the separate
(never-merged) Python profiling branch.
**Writes:** the same 12 Postgres tables, via
`ATTACH ... TYPE postgres; TRUNCATE pg.<table>; INSERT INTO pg.<table> ...`.

### Dashboard Sync (Redis-only) — `jobs/stage-2/dashboardSync.py`

**Purpose:** The engine behind the live admin/learner dashboard. Runs DuckDB SQL over the warehouse-computed Parquet tables (plus a few Spark/Druid steps) and writes every metric into Redis, never Postgres. It ends by streaming one Kafka message per enrolment row to the userCourseProgramProgress topic for Druid ingest.

**Changed since 4.8.39.3:**
- 1041b38 (2026-09-30) optimisation phase 1: base_data enrolment-user-content-org join is now materialized once as a DuckDB table; Redis-only queries use the pandas path with Redis.dispatch; same Redis key names and value formats
- 1041b38: query library import switched from constants.QueryConstants to constants.QueryConstants_updated, a module that is not committed, so the job breaks at import
- 1041b38: process_trending reverted. The 7-day enrolment window is removed (back to all-time counts); Trending Programs is restored and lhp_trending across:programs is written again; the call moved from process_data into update_learner_home_page_data
- 1041b38: process_certifications call re-enabled, but its outputs are still print-only (no Redis writes)
- 1041b38: Kafka dispatch switched from dispatch_df_to_kafka (kafka-python, one producer per partition) to dispatch_df_to_kafka_updated (confluent_kafka, lz4, 4 partitions); checkpoint replaced by cache; driver memory 20g to 80g

**Reads (5):**
- `Parquet(computed)` — ENROLMENT_WAREHOUSE_COMPUTED_PARQUET_FILE, USER_WAREHOUSE_COMPUTED_PARQUET_FILE, CONTENT_WAREHOUSE_COMPUTED_PARQUET_FILE (read by Spark in process_trending, process_certifications and the Kafka phase, and by DuckDB through the query library)
- `Parquet(computed)` — CONTENT_COMPUTED_PARQUET_FILE (competency coverage, plus the Live courses under 30 min list)
- PQ/PQr (through DuckDB SQL in the query library, per constants/QueryConstants.py): ORG_COMPUTED, USER_ORG_COMPUTED_FILE, USER_COMPUTED, RATING_COMPUTED, RATING_SUMMARY_COMPUTED, RATING_PARQUET_FILE, EVENT_PARQUET_FILE, EVENT_ENROLMENT_PARQUET_FILE, EXTERNAL_COURSE_ENROLMENTS_PARQUET_FILE
- `Druid` — nps-upgraded-users-data datasource (NPS score for platformRatingSurveyId)
- Config: hardcodeTrendingCourses / hardCodedCoursesIds (default_config.py sets hardcodeTrendingCourses True and lists 5 course ids)

**Joins (6):**
- INNER/LEFT · base_data = enrolment ⋈ user ⋈ content (INNER), ⋈ org (LEFT), now materialized ONCE per run as a DuckDB table (ensure_base_data runs QueryConstants.BASE_DATA_BODY) instead of a CTE repeated in ~13 queries
- Many SQL joins across ~40 named DuckDB queries (overall, MDO-wise, CBP-wise, top-5/top-10, ratings, events, NLW, reviews)
- LEFT (pandas merge) · CBP_WISE_COMPREHENSIVE ⋈ LIVE_COURSE_MODERATED_COUNT_BY_ORG on courseOrgID — adds the live course/moderated-course count per CBP
- INNER (positional) · competency area ⋈ theme ⋈ sub-theme posexplode on (courseID, pos), then LEFT content ⋈ competency on courseID — competency coverage per course org
- INNER · enrolment warehouse ⋈ content warehouse on content_id (process_trending) — enrolment counts per Live Course/Program
- INNER · enrolment warehouse ⋈ user warehouse on user_id ⋈ content warehouse on content_id (process_certifications) — weekly certificate counts

**Processing:**
- Run order: dashboard_update_time, then dashboardRedisUpdates, then update_learner_home_page_data, then cbp_top_10_reviews, then the Kafka phase. process_org_user_data (phase 1) is still defined but its call is commented out, so its keys are not written
- Performance rewrite (1041b38): DuckDB set to 16 threads and a 64GB memory limit. Queries that only feed Redis now come back as pandas DataFrames and go straight out through Redis.dispatch (helper _dispatch_pdf_as_map), skipping the old pandas to Spark to collect round trip. NaN values are turned back into the string None so Redis values stay byte-identical. Empty results are skipped with a warning
- Metric groups written to Redis: MDO admin count; overall enrolment funnel (unique users enrolled, not started, started, in progress, completed; total enrolments and completions including external content); per-MDO funnel and active users in the last 12 months; per-CBP (course org) enrolments, completions, certificates, moderated-course enrolments/certificates/live count/average rating; top courses by org; live course/program enrolment counts; NLW and event metrics (NLW enrolments, certificates issued yesterday and during NLW, events published, event enrolments and completions); top-10 courses/programs/assessments by completion per course org; NPS from Druid; competency coverage per course org (COMAREA-000001/2/3 mapped to Behavioural/Domain/Functional); certificates and core competencies per MDO; courses enrolled/completed at least once (overall, with id lists, and per MDO); top-5 users, courses and content by completion, content by enrolment, courses by rating (overall and per org), MDOs by completion and by live courses; total ratings and rating spread per course org; trending events per MDO and featured events overall; top-10 user reviews per course org
- Learner home page: Live Course-category content under 30 minutes (courseDuration < 1800s, excluding _rc ids), sorted by rating descending, written as a comma list to lhp_trending field across:under_30_mins
- process_trending is called again from update_learner_home_page_data (no longer directly from process_data). Trending courses = top 10% of Live Courses by ALL-TIME enrolment count (the 7-day enrolled_on window is gone), unless hardcodeTrendingCourses is set, in which case hardCodedCoursesIds is written. Trending programs = top 10% of Live Programs by all-time enrolment, and is computed and written again
- TRENDING_COURSES_BY_ORG and TRENDING_PROGRAMS_BY_ORG still run in DuckDB, but their results are only shown, not written to Redis
- process_certifications is now called, but every Redis write in it is a print statement (yesterday values are mocked as 0), so it runs Spark counts with no output. process_learning_hours is still commented out
- lhp_lastRunDate guard is disabled: last_run_date is hard-set to an empty string, so the home-page block runs every time
- Kafka phase: enrolment warehouse rows (userID, courseID, batchID, epoch timestamps, progress code 0/1/2, completion %, status, with content/user fields left null) are cached, counted, stamped with the run timestamp, and sent one message per row through dispatch_df_to_kafka_updated (confluent_kafka, lz4, coalesced to 4 partitions)
- Bug: imports constants.QueryConstants_updated, but that module is not in the repo or anywhere in git history (only constants/QueryConstants.py exists, and it has no BASE_DATA_BODY). As committed, the job fails at import with ModuleNotFoundError
- Bug: get_nps_score calls self._empty_df, which is not defined in this class. If Druid returns nothing, NPS raises AttributeError (caught and logged, so the key is skipped)
- dashboardRedisUpdates wraps each section in try/except and only logs failures, so a failed metric silently leaves its old Redis value in place
- The module docstring still says Redis operations are commented out; that is only true for the learning-hours and certification blocks
- Spark driver memory raised from 20g to 80g; enrolment repartition changed from 200 by content_id to 32; checkpoint() replaced by cache()

**Writes:**
- **Redis:** Plain keys: dashboard_update_time, dashboard_org_with_mdo_admin_count, dashboard_unique_users_{enrolled,not_started,started,in_progress,completed}_count, dashboard_{not_started,started,in_progress}_count, lp_completed_count, dashboard_enrolment_count, dashboard_completed_count; Per-MDO hashes (field = userOrgID): dashboard_{enrolment_count,enrolment_content,enrolment_unique_user_count,not_started_count,started_count,in_progress_count,completed_count,certificates_generated_count,core_competencies,courses_completed_at_least_once}_by_user_org, dashboard_active_users_last_12_months_by_org, dashboard_top_5_users_by_completion_by_org, dashboard_top_5_courses_by_completion_by_org, dashboard_trending_events_by_mdo; Per-CBP hashes (field = courseOrgID): dashboard_{content_completed_count,enrolment_count,enrolment_content,certificates_generated_count,course_moderated_course_enrolment_count,course_moderated_course_certificates_generated_count,live_course_moderated_course_count,course_moderated_course_average_rating,competencies_count,content_total_ratings,content_ratings_spread,top_5_content_by_completion,top_5_content_by_enrolments,top_5_content_by_rating}_by_course_org, dashboard_top_10_courses_by_completion_by_course_org (field = courseOrgID_content), dashboard_competency_coverage_by_org, cbp_top_10_users_reviews_by_org; Hash live_course_program_enrolment_count (field = courseID); Course lists: dashboard_courses_enrolled_in_at_least_once (+ _id_list), dashboard_courses_completed_at_least_once (+ _id_list); Leaderboard JSON: dashboard_top_5_courses_by_rating, dashboard_top_5_mdo_by_completion, dashboard_top_5_mdo_by_live_courses; NLW/events: dashboard_content_enrolment_nlw_count, dashboard_events_enrolment_count, dashboard_events_published_count, dashboard_content_certificates_generated_yday_nlw_count, dashboard_event_certificates_generated_yday_nlw_count, dashboard_content_only_certificates_generated_yday_nlw_count, dashboard_events_completed_count, dashboard_content_certificates_generated_nlw_count, dashboard_overall_featured_events; dashboard_nps_across_platform; Learner home page: hash lhp_trending fields across:under_30_mins, across:courses, across:programs (restored); keys lhp_mostEnrolledTag, lhp_lastRunDate
- **Kafka:** config.userCourseProgramProgress topic on dpBrokerList: one JSON message per enrolment-warehouse row, sent with confluent_kafka

**Downstream:** Every real-time counter and leaderboard on the admin/learner dashboard and learner home page reads these Redis keys directly. The userCourseProgramProgress Kafka stream feeds Druid ingest (the code comment says 'Kafka dispatches for druid ingest').

### Postgres → Parquet Exporter — `jobs/stage-2/postgresToParquet.py`

> **No longer used — replaced by [`org_hierarchy_new.py`](#org-hierarchy-sync-consolidated--jobsstage-2org_hierarchy_newpy).** Kept below for reference.

**Purpose:** Added in 4.8.39.3. Runs the usual warehouse flow in reverse —
reads a Postgres table (default `org_hierarchy_new`, the table the
org-hierarchy jobs above just rebuilt) and writes it back out to a local
Parquet file. Reads like an ops/diagnostic export utility rather than a
report or sync job proper: an `argparse` CLI (`--table`, `--schema`,
`--output-dir`, `--filename`, `--chunk-size`, `--compression`), not a
`main()` with no arguments like every other job in this repo.

**Reads (1):** any Postgres app-schema table via CLI args, default
`org_hierarchy_new` / schema `public`.

**Joins:** 0.

**Processing:** Fully config-driven Postgres connection
(`config.dwPostgresHost`/`appPostgresSchema`/`appPostgresUsername`/
`appPostgresCredential`) — no hardcoded credentials. Supports chunked reads
for large tables via `pd.read_sql_query(..., chunksize=...)`. Logs table
shape, column list, dtypes, and null-counts-per-column before writing —
useful as a data-quality spot-check, not just an export.

**Writes:** `<output-dir>/<filename-or-table>.parquet`, Snappy-compressed by
default (configurable: gzip/brotli/lz4/zstd/none). Defaults to
`./output/org_hierarchy_new.parquet`.

**Downstream:** not referenced by any other job in this repo — appears to
be a standalone ops/diagnostic tool rather than a wired pipeline step.

---

## Stage 2 — Compliance & Enrolment Reports

### ACBP Compliance Report — `jobs/stage-2/acbpReport.py`

**Purpose:** Tracks which courses each employee was assigned through an Annual Competency-Based Plan and whether they finished before the due date. Also builds the cb_plan warehouse table and an APAR export that links completions to competency areas for HR appraisal.

**Changed since 4.8.39.3:**
- 98d43e0 (2026-09-01): added planyear -> plan_year to cb_plan (and switched the Cassandra source to cb_plan_v3 in default_config)
- b8dcf16 (2026-09-07): added plantype -> plan_type to cb_plan; cleaned up imports
- 1041b38 (2026-09-30): moved CSV export to polarsCSVExport.py (plain parquet), dropping the combined CSVs; removed coalesce(1); new Spark settings; stage timing. Also reverted plan_year/plan_type out of cb_plan and restored the old imports, apparently by accident

**Reads (8):**
- `Parquet(computed)` — USER_ORG_COMPUTED_FILE (user, org and additionalProperties.externalSystem/externalSystemId)
- `Parquet(computed)` — CONTENT_HIERARCHY_SELECT_PARQUET_FILE
- `Parquet(computed)` — ALL_COURSE_PROGRAM_COMPUTED_PARQUET_FILE (Course, Program, Blended Program, Curated Program, Standalone Assessment)
- `Parquet(computed)` — ORG_SELECT_PARQUET_FILE
- `Parquet(computed)` — ENROLMENT_COMPUTED_PARQUET_FILE (enrolment_status = enrolled)
- `Parquet(computed)` — ACBP_COMPUTED_FILE (user x plan allocations from acbpDFUtil_v3)
- `Parquet(computed)` — ACBP_SELECT_FILE (plan-level rows; now carries planyear and plantype, but this job does not select them)
- `Parquet(warehouse)` — warehouse/kcm_dictionary, warehouse/kcm_content_mapping

**Joins (6):**
- LEFT · ACBP allocations (exploded acbpCourseIDList) ⋈ course details on courseID
- LEFT · + enrolments on (courseID, userID) — completion status and timestamps
- LEFT · ACBP-select (exploded) ⋈ course details on courseID — cb_plan warehouse rows
- LEFT · KCM mapping ⋈ KCM dictionary on competency_area_id (twice, second pass after dedup) — competency areas per course
- LEFT · APAR-flagged allocations ⋈ user externalSystem fields on userID
- LEFT · + aggregated competency areas on courseID = course_id

**Processing:**
- Allocation rows keep Live plans only, one row per (userID, courseID) with the latest completionDueDate
- SLA metric: completed (dbCompletionStatus = 2) AND courseCompletedTimestamp < completionDueDate + 86400 seconds (1-day grace)
- Three-tier Ministry -> Department -> Organization fallback display logic
- assignment_type_mapping translates ACBP rule keys (rootorgid, user, customuser, alluser, designation, cadre, group, batch, service, isprofileverified, isoncentraldeputation) into warehouse names (mdo_id, user, designation, cadre, groups, cadre_batch, civil_services, is_verified_karmayogi, is_on_central_deputation); alluser plans show allotment_to = AllUser
- assignmentTypeInfo pipe-segments are JSON arrays; each is parsed and re-joined as quoted, comma-separated values
- APAR export: Live plans with isapar = true, active users only, deduped on (user_id, content_id); competency_type = comma-joined competency areas; parichay_id is always null
- CHANGED (1041b38): CSV writing moved to polarsCSVExport.py. Enrolment and user-summary reports are written as plain parquet under localReportDir/temp/cbp-enrolment-report-plain/{today} and temp/cbp-summary-report-plain/{today}. The old dfexportutil.write_csv_combined calls also wrote a single combined CSV under acbpReportPath/{today}/CBPEnrollmentReport and CBPUserSummaryReport; nothing writes that combined CSV any more
- CHANGED (1041b38): coalesce(1) removed on cb_plan and apar_cbp_enrollment writes; commented kafkaDispatch line removed; Spark stays local[*] with 120 shuffle partitions and 120g driver
- Bug / regression: 1041b38 removed the plan_year and plan_type columns that 98d43e0 and b8dcf16 had added to cb_plan. It also restored the bulk imports that b8dcf16 had cleaned up. At HEAD the cb_plan warehouse table does not contain plan_year or plan_type, even though ACBP_SELECT_FILE carries planyear and plantype
- dfexportutil and pandas are still imported but unused

**Writes:**
- **Parquet:** localReportDir/temp/cbp-enrolment-report-plain/{today}; localReportDir/temp/cbp-summary-report-plain/{today} (both inputs to polarsCSVExport.py, deleted by it after export)
- **Report / CSV:** CBPEnrollmentReport.csv per mdoid under localReportDir/standalone-reports/cbp-report-mdo-enrolment/{today} and CBPUserSummaryReport.csv per mdoid under standalone-reports/cbp-report-mdo-summary/{today} — produced by polarsCSVExport.py; the combined single CSVs under standalone-reports/cbp-report/{today} are no longer produced
- **Warehouse / Postgres:** warehouseReportDir/cb_plan (dwCBPlanTable): org_id, created_by, cb_plan_id, plan_name, allotment_type, allotment_to, content_id, allocated_on, due_by, status, isapar, data_last_generated_on — synced to Postgres and BigQuery; warehouseReportDir/cbp_enrollments (Parquet only, not synced); warehouseReportDir/apar_cbp_enrollment (dwAparCBPEnrollmentTable, Parquet only, not synced)

**Downstream:** cb_plan is read by l2Assessments.py, synced to Postgres by dataWarehouse.py / dataWarehouseBash.sh and loaded to BigQuery by bq-scripts.sh. polarsCSVExport.py produces the cbp-report-mdo-enrolment and cbp-report-mdo-summary folders, which zipUpload.py bundles (pysparkDirectoriesToSelect).

### Standalone Assessment Report — `jobs/stage-2/assessmentReport.py`

**Purpose:** For assessments not embedded in a course, reports each
learner's latest attempt, score, pass/fail and attempt count.

**Reads (7):** `ALL_ASSESSMENT_COMPUTED` (Standalone Assessment only),
`ORG_COMPUTED`, `CONTENT_COMPUTED`, `RATING_SUMMARY_COMPUTED`,
`USER_ORG_COMPUTED_FILE`, `HIERARCHY_PARQUET_FILE`, `USER_ASSESSMENT_PARQUET_FILE`.

**Joins (9):** assessment ⋈ hierarchy `LEFT assessID` · course ⋈ hierarchy
`LEFT courseID` · course ⋈ org `LEFT courseOrgID` · course ⋈ rating
`LEFT (courseID,categoryLower)` · attempt ⋈ assessment-children
`INNER assessChildID` · + assessment details `LEFT assessID` · + course
details `LEFT courseID` · + user-org `LEFT userID` · + latest-attempt
(broadcast) `INNER (assessChildID,userID,assessEndTimestamp)`.

**Fixed in 4.8.39.3:** the `Percentage_Of_Score` output column now reads
from `assessOverallResult` instead of `assessPassPercentage` — those are two
different numbers (the score a learner actually achieved vs. the minimum
threshold needed to pass), so every report run before this fix showed the
pass threshold in a column labeled as the learner's score.

**Writes:** CSV `StandaloneAssessmentReport.csv` per MDO, under
`standaloneAssessmentReportPath`. No warehouse write. Two dead
`kafkaDispatch()` lines.

**Downstream:** `user-assessment-report-cbp` folder, bundled by
`zipUpload.py` for content providers.

### Bharat Kalp Report — `jobs/stage-2/bharatKalpReport.py`

**Purpose:** For the "Bharat Kalp" talks/podcast initiative, records which
eligible members enrolled in which Bharat-Kalp-tagged courses/events.
Warehouse-only, no CSV.

**Reads (5):** live CMS API (`bharatKalpCoursesApiUrl` — eligible courses +
event tags, refetched every run, not hardcoded), `warehouse/user_enrolments`,
`warehouse/event_details`, `warehouse/event_enrolment_details`,
`USER_COMPUTED` (filtered `isBharatKalpMember`).

**Joins (4):** event enrolments ⋈ eligible members (broadcast)
`INNER user_id` · + events (tag-filtered) `INNER event_id` · course
enrolments ⋈ eligible members (broadcast) `INNER user_id` · + BK course
list (broadcast, from API) `INNER content_id`.

**Processing:** Raises an error rather than silently producing an empty
report if the CMS API returns zero courses or tags.

**Writes:** warehouse `bk_course_enrolments`, `bk_event_enrolments` —
Parquet only, not yet wired into `dataWarehouse.py`.

### Blended Program Report — `jobs/stage-2/blendedReport.py`

**Purpose:** For programs mixing online modules with in-person sessions,
tracks progress and attendance at the individual-component level, including
offline-session attendance that page-view data can't capture.

**Reads (5):** `USER_ORG_COMPUTED_FILE`, `CONTENT_COMPUTED` (Blended
Program), `BATCH_SELECT`, `ENROLMENT_COMPUTED` (enrolled),
`CONTENT_HIERARCHY_SELECT`.

**Joins (12):** batch attach `LEFT` · coordinator-name attach `LEFT` ·
program×batch ⋈ enrolments `INNER` (scoping) · user-org ⋈ completion
`RIGHT` · program ⋈ hierarchy (broadcast) `LEFT` (component walk) ·
completion ⋈ children `LEFT` · + session detail `LEFT` · child-batch
resolution `LEFT` (×2) · + content-status map `LEFT`.

**Processing:** Flattens arbitrarily nested `Program → Course Unit →
Learning Resource` structures into one component list. Offline-session
attendance is derived from the physical session's start date, not a digital
access timestamp. Splits into two exports from the same rows: `-mdo`
(learner's own org, unmasked PII) and `-cbp` (provider org, masked PII).

**Writes:** CSV `BlendedProgramReport.csv` ×2 families. Warehouse:
`bp_enrolments` (synced).

**Downstream:** `blended-program-report-mdo`/`-cbp` folders, bundled
separately by `zipUpload.py`.

### CAP Access-Control Resolver — `jobs/stage-2/capAllotment.py`

**Purpose:** Resolves admin-configured Comprehensive Assessment Program
access-control rules (org + designation, OR cadre-batch tag, etc.) against
the real user base — exactly who can see which CAP. Warehouse-only.

**Reads (3):** `warehouse/content` (**hard dependency: requires
`courseReport.py` to have run first**), raw `accessControlSettings`,
`warehouse/user_detail` (read directly via DuckDB, filtered `status=1`).

**Joins:** ~11-way SQL fan-out in DuckDB, one criteria-type block per
(`rootorgid`, `user`/`customuser`/`alluser`, `designation`, `group`, `tag`,
`cadre`, `civil_service_type`, `service`, `batch`,
`isoncentraldeputation`, `isprofileverified`, `profilestatus`) — each an
INNER match join + LEFT org-scoping guard, the same engine pattern as
`acbpDFUtil_v3.py`.

**Processing:** A regex pre-pass wraps bare scalar `criteriaValue` JSON
fields into arrays before parsing — defends against an inconsistent
upstream shape.

**Writes:** warehouse `cap_allocation_meta`, `cap_allocation_user_wise` —
Parquet only, not yet wired into `dataWarehouse.py` (the newest/most
in-progress feature in this group — no consumer wired anywhere in the repo
yet).

### Course-Based Assessment Report — `jobs/stage-2/courseBasedAssessmentReport.py`

**Purpose:** Reports each learner's assessment attempt, score, pass/fail and retakes for assessments inside courses, programs and standalone assessments, merged with legacy pre-migration assessment data and split into Government and Non-Government (VOLUNTEER) outputs. It also builds the assessment_detail warehouse table, which since September 2026 has an assessment_sub_type column.

**Changed since 4.8.39.3:**
- c8a055c (2026-09-01): excludes assessIDs ending in .img; retakes and latest-attempt window now keyed by (assessID, assessChildID, userID) instead of (assessChildID, userID); assessment_sub_type gains Standalone Assessment
- c29fd2b (2026-09-15): assessment_sub_type gains Pre Enrolment Assessment
- 1041b38 (2026-09-30): deterministic tie-breakers on best and latest attempt windows; deterministic legacy dedup plus left_anti merge replaces union + dropDuplicates; caching with forced materialisation; CSV export moved to polarsCSVExport.py via plain parquet under temp/cba-report-plain; coalesce(1) removed from warehouse write; esCourseAssessment join broadcast; local-cluster Spark config; stage timing logs; debug show/print calls removed

**Reads (10):**
- `Parquet(computed)` — ALL_ASSESSMENT_COMPUTED_PARQUET_FILE (assessCategory in Course, Standalone Assessment, Blended Program, Curated Program; assessID not ending in .img)
- `Parquet(raw)` — HIERARCHY_PARQUET_FILE
- `Parquet(computed)` — ORG_COMPUTED_PARQUET_FILE
- `Parquet(raw)` — USER_ASSESSMENT_PARQUET_FILE (assessUserStatus = SUBMITTED)
- `Parquet(computed)` — CONTENT_COMPUTED_PARQUET_FILE (category in Course, Program, Blended Program, Standalone Assessment, Curated Program)
- `Parquet(computed)` — RATING_SUMMARY_COMPUTED_PARQUET_FILE
- `Parquet(computed)` — USER_ORG_COMPUTED_FILE
- `Parquet(computed)` — OLD_ASSESSMENT_COMPUTED_PARQUET_FILE (legacy assessments)
- `Parquet(raw)` — FINAL_ASSESSMENT_PARQUET_FILE
- `Parquet(raw)` — baseCachePath/esCourseAssessment (ad hoc path, no constant; minimumPassPercentage)

**Joins (9):**
- LEFT · assessments ⋈ hierarchy on assessID (assessmentDFUtil.add_hierarchy_column) — children, competencies, L2 children
- LEFT · course/program details ⋈ hierarchy and org, then ⋈ rating summary (assessmentDFUtil helpers)
- INNER · best attempt per user ⋈ assessment children on assessChildID (user_assessment_children_dataframe)
- LEFT · + assessment details, course details with rating, user-org (user_assessment_children_details_dataframe)
- LEFT · latest row ⋈ retakes count on (assessID, assessChildID, userID) — key widened from (assessChildID, userID) in c8a055c
- LEFT_ANTI · deduped legacy rows ⋈ new-schema keys on (userID, assessment_id, course_id) — new in 1041b38, keeps a legacy row only if no new row exists
- INNER · FINAL_ASSESSMENT ⋈ best-attempt user assessments on Identifier = assessChildID — ES final-assessment rows for the warehouse
- LEFT (broadcast) · warehouse rows ⋈ esCourseAssessment on assessment_id = identifier — minimum pass percentage override
- LEFT · warehouse rows ⋈ ALL_ASSESSMENT_COMPUTED on content_id = assessID — assessCourseCategory for assessment_sub_type

**Processing:**
- Best attempt per (userID, assessChildID): basic assessments rank by assessOverallResult, sectional (assessTotalSectionMarks not null) by section marks; ties now broken by latest assessEndTimestamp then assessStartTimestamp (tie-breakers added in 1041b38)
- Legacy merge: legacy rows are deduped per (userID, assessment_id, course_id) by latest last_attempted_date, highest score, then a sha2 hash of the remaining columns for a deterministic pick; then legacy rows whose key already exists in the new data are dropped (left_anti). This replaces the earlier union + dropDuplicates, which picked arbitrarily (1041b38)
- Ministry/Department/Organisation three-tier fallback from ministry_name, dept_name and userOrgName
- Report rows only for userStatus = 1. Exact-match Non-Govt split: Designation trimmed and upper-cased equal to VOLUNTEER, or any comma-separated Roles element equal to VOLUNTEER; not a substring match. Legacy rows carry no roles, so they are classified by Designation only
- For orgs with both Govt and Non-Govt users, Non-Govt rows get mdoid suffixed with _non_govt so they land in a separate mdoid=<id>_non_govt folder
- assessment_sub_type (warehouse only): Comprehensive Assessment Program, Standalone Assessment (c8a055c) or Pre Enrolment Assessment (c29fd2b) from assessCourseCategory, otherwise assessment_type
- cut_off_percentage replaced by esCourseAssessment minimumPassPercentage when that is present and > 0
- Warehouse rows deduped to one per (user_id, content_id, assessment_id), highest score_achieved then latest completion_date
- CHANGED (1041b38): no in-job CSV export. Govt and Non-Govt report DataFrames are written as plain parquet to localReportDir/temp/cba-report-plain/{today}/govt and /non_govt (each skipped when there are no rows); polarsCSVExport.py writes UserAssessmentReport.csv per mdoid. fullReportDF, mdoReportDF and warehouseDF are now cached and materialised with count(); coalesce(1) removed from the assessment_detail write; Spark on local-cluster[4, 6, 40000], 38g executors, 16g driver, 3g maxResultSize, 128 shuffle partitions
- Bug: retakes is effectively always 1 for new-schema rows. userAssessmentDF is already cut to one best attempt per (userID, assessChildID) before retakes = countDistinct(assessStartTime) is computed. This was already the case before f80eb91
- Bug: in assessment_detail, time_spent_by_the_user for report-derived rows is filled from assessment_duration (the expected duration), not the actual time spent. Only the ES final-assessment rows compute the real end minus start
- Note: fullReportNewDF and the legacy rows are combined with positional union(). Column 3/4 (assessID, assessOrgID) receive courseOrgID and assessChildID from legacy rows; these columns are not used in any output
- ES final-assessment warehouse rows hardcode number_of_retakes = 0
- dfexportutil is still imported but no longer used

**Writes:**
- **Parquet:** localReportDir/temp/cba-report-plain/{today}/govt and /non_govt (plain report parquet, input to polarsCSVExport.py, deleted by that job after export)
- **Report / CSV:** UserAssessmentReport.csv per mdoid under localReportDir/standalone-reports/cba-report/{today}/ (mdoid=<id> for Govt, and mdoid=<id>_non_govt for Non-Govt users when the org has both) — produced by polarsCSVExport.py
- **Warehouse / Postgres:** warehouseReportDir/assessment_detail (dwAssessmentTable): user_id, content_id, assessment_id, assessment_name, assessment_type, assessment_sub_type, assessment_duration, time_spent_by_the_user, completion_date, score_achieved, overall_score, cut_off_percentage, total_question, number_of_incorrect_responses, number_of_retakes, pass, data_last_generated_on — synced to Postgres and BigQuery

**Downstream:** assessment_detail is read by l2Assessments.py, synced to Postgres by dataWarehouse.py / dataWarehouseBash.sh (the Bash loader names assessment_sub_type explicitly) and loaded to BigQuery by bq-scripts.sh. The plain parquet is consumed by polarsCSVExport.py, whose cba-report output is bundled by zipUpload.py.

### Course Completion Survey Report — `jobs/stage-2/courseCompletionSurveyReport.py`

**Purpose:** Turns raw end-of-course survey submissions (design/content/
delivery/relevance ratings) into a readable one-row-per-submission report,
plus a slim structured warehouse table.

**Reads (1):** `COURSE_COMPLETION_SURVEY_PARQUET_FILE`, filtered to
configured `formIds`.

**Joins:** 0 — single-source explode + pivot only.

**Processing:** `explode(responses)` then `groupBy(...).pivot("question")`
turns long/EAV-shaped survey data back into a wide, one-row-per-submission
report.

**Writes:** CSV `completionSurvey.csv`, grouped by `formId` — the only job
in the repo partitioned by form rather than by org. Warehouse:
`course_completion_survey_details` written as Parquet, but its
`dataWarehouse.py` push line is **commented out** — not currently synced.

**Downstream:** `course-completion-survey-report` folder bundled by
`zipUpload.py`.

### Course / Content Report — `jobs/stage-2/courseReport.py`

**Purpose:** The master content-inventory report: metadata plus enrolment/completion/certificate counts for every course, program, final assessment and marketplace item. It writes the content and content_resource warehouse tables directly, and since 1041b38 writes the per-MDO report as a plain parquet that polarsCSVExport.py later turns into ContentReport.csv files.

**Changed since 4.8.39.3:**
- 1041b38 (2026-09-30, optimisation phase 1): CSV export moved out of the job to polarsCSVExport.py (plain parquet at temp/course-report-plain/{today}); removed distinct-org collect; removed coalesce(1) on both warehouse writes; removed cache/persist; switched to local-cluster Spark master with new memory/partition settings; added stage timing logs. Business logic (columns, filters, joins) is unchanged.

**Reads (8):**
- `Parquet(computed)` — CONTENT_COMPUTED_PARQUET_FILE (filtered to config.courseCategoriesToSelect on courseCategory)
- `Parquet(computed)` — CONTENT_HIERARCHY_SELECT_PARQUET_FILE
- `Parquet(computed)` — ENROLMENT_COMPUTED_PARQUET_FILE (enrolment_status = enrolled)
- `Parquet(computed)` — BATCH_SELECT_PARQUET_FILE
- `Parquet(computed)` — EXTERNAL_ENROLMENT_COMPUTED_PARQUET_FILE (marketplace enrolments)
- `Parquet(computed)` — EXTERNAL_CONTENT_COMPUTED_PARQUET_FILE (marketplace content)
- `Parquet(computed)` — ORG_SELECT_PARQUET_FILE (orgId, orgName for final-assessment provider names)
- `Parquet(raw)` — FINAL_ASSESSMENT_PARQUET_FILE (ES final assessments)

**Joins (7):**
- INNER · content hierarchy ⋈ course details on courseID — scopes resource extraction to selected categories (Program, Curated Program, Course)
- LEFT · enrolments ⋈ courseResourceCount on courseID — needed by calculateCourseProgress
- LEFT · course details ⋈ completion aggregates on courseID — attaches enrolled/in-progress/not-started/completed/certificate counts
- INNER · Blended Program courses ⋈ batches on courseID, then broadcast LEFT onto all content on courseID — batch id/name/dates for Blended Programs only
- OUTER · marketplace content ⋈ marketplace enrolment aggregates on content_id
- LEFT · platform content ⋈ SCORM flags on courseID
- LEFT · ES final assessments ⋈ org select on content_provider_id — provider name

**Processing:**
- Resource extraction walks the content-hierarchy JSON with category-specific logic: Programs and Curated Programs take first-level children, Courses descend one more level when the first-level child is a Course Unit; resource duration falls back to expectedDuration
- Course progress computed via enrolmentDFUtil.calculateCourseProgress, then aggregated per courseID (earliest/latest completion, status counts, certificates issued)
- fullDF keeps only courseStatus in Live, Draft, Retired, Review; Content_Retired_On is lastStatusChangedOn for Retired content
- Content_Provider falls back to contentCreator when courseOrgName is null, empty or a single space
- SCORM detection: flag = 1 if any level-1 or level-2 hierarchy child has a mimeType ending in html-archive
- Warehouse content table = platform content + ES final assessments (unionByName) + marketplace content (positional union); marketplace rows get placeholder Not Available / null batch, rating and resource fields, content_sub_type External Content, scorm_flag 0
- Per-MDO report rows = platform content + marketplace content, partition key mdoid = courseOrgID
- CHANGED (1041b38): no longer exports CSV in-job. The old distinct-mdoid collect plus dfexportutil.write_csv_per_mdo_id_duckdb call is gone; the report DataFrame is written as plain parquet to localReportDir/temp/course-report-plain/{today} and the separate polarsCSVExport.py job splits it per mdoid into ContentReport.csv
- CHANGED (1041b38): coalesce(1) removed from the content and content_resource warehouse writes (multi-file parquet now); cache/persist calls removed; Spark now runs on local-cluster[4, 8, 38000] with 36g executors, 16g driver, 128 shuffle partitions, AQE skew-join enabled; per-stage timing printed
- dfexportutil, utils and pandas are still imported but no longer used; report_path is computed but unused

**Writes:**
- **Parquet:** localReportDir/temp/course-report-plain/{today} (plain report parquet, input to polarsCSVExport.py, deleted by that job after export)
- **Report / CSV:** ContentReport.csv per MDO under localReportDir/standalone-reports/course-report/{today}/mdoid=<id>/ — produced by polarsCSVExport.py from the plain parquet, not by this job
- **Warehouse / Postgres:** warehouseReportDir/content (dwCourseTable) — synced to Postgres by dataWarehouse.py / dataWarehouseBash.sh and loaded to BigQuery by bq-scripts.sh; warehouseReportDir/content_resource (dwContentResourceTable) — synced to Postgres and BigQuery

**Downstream:** warehouse/content is read by capAllotment.py, l2Assessments.py, courseHealthMetrics.py (hardcoded /home/analytics/pyspark/warehouse/content), dataWarehouse.py/dataWarehouseBash.sh and bq-scripts.sh. warehouse/content_resource is read by courseHealthMetrics.py, programProgressSyncList_v5.py, the Postgres syncs and bq-scripts.sh. The plain parquet is consumed by polarsCSVExport.py, whose course-report output folder is bundled by zipUpload.py.

---

## Stage 2 — Gamification & Scoring

### Daily Summary Report (live) — `jobs/stage-2/dsrComputation.py`

**Purpose:** Computes daily platform-wide KPIs for the admin dashboard summary cards and appends a daily row to the Postgres dsr_metrics_history table. The KPIs are registrations, enrolments, completions, certificates, live courses/publishers/hours, department onboarding, MAU and users logged in yesterday. Since d889039, enrolment, completion and registration counts include all users (Volunteer/Non-Govt users are no longer excluded). The two Druid metrics (MAU and logged in yesterday) still exclude volunteers.

**Changed since 4.8.39.3:**
- d889039 (2026-09-10) removed the volunteer filter: the userDF exclusion line is commented out, so enrolment, completion, event, registration and certificate counts now include Volunteer/Non-Govt users. The volunteer flag and the Druid MAU/DAU anti-joins were left in place, so those two metrics still exclude volunteers

**Reads (5):**
- `Parquet(raw)` — USER_PARQUET_FILE (recursiveFileLookup)
- `Parquet(computed)` — EVENT_ENROLMENT_PARQUET_FILE, ENROLMENT_WAREHOUSE_COMPUTED_PARQUET_FILE, EXTERNAL_ENROLMENT_COMPUTED_PARQUET_FILE (read, unused), CONTENT_WAREHOUSE_COMPUTED_PARQUET_FILE (read twice), EXTERNAL_CONTENT_COMPUTED_PARQUET_FILE (read, unused)
- `Elasticsearch` — org_v4/_count with status=1 (direct REST POST, not the Spark connector)
- `Druid` — telemetry-events-syncts distinct actor_id for the 30-day MAU and yesterday's logins (IMPRESSION/INTERACT/START/END, actor_type User, IST day boundaries)
- `Postgres(warehouse)` — dsr_metrics_history (read before write; aborts if the read fails)

**Joins (6):**
- LEFT · user ⋈ volunteer flag by designation on user_id — the flag is still computed, but now only feeds the volunteer id list
- INNER · event enrolments ⋈ user ids on user_id — no longer a govt-only filter; it now only drops events whose user is missing from the user parquet
- INNER · content enrolments ⋈ active users (status=1) on userID
- LEFT · enrolments ⋈ content on content_id, then INNER ⋈ users with an mdo_id — unique users enrolled in Live/Retired Courses
- LEFT_ANTI · Druid MAU actor_ids ⋈ volunteer user ids
- LEFT_ANTI · Druid yesterday-login actor_ids ⋈ volunteer user ids

**Processing:**
- Volunteer rule (exact, case-insensitive 'VOLUNTEER' in any profiledetails designation or in roles) is still evaluated, but the userDF filter that removed those users is commented out (d889039). So all user-table metrics now count volunteers, while MAU and DAU still exclude them
- Completions = certificateID longer than 5 chars; certificates yesterday = content first_completed_on yesterday plus event completed_on_datetime yesterday
- Live courses: content_status Live with sub-type Course, Moderated Course or External Content (count and distinct publishers). Duration in hours uses only Course and Moderated Course
- Dept orgs onboarded = ES active org count minus hardcoded CENTRAL_MINISTRIES_COUNT=94 minus STATE_UT_COUNT=36
- Indian-numbering formatter (comma every 2 digits after the last 3, e.g. 12,34,567); format_count is defined twice (identical)
- History write: the existing table minus today's row is cached and materialized before a truncate+overwrite, so reruns are safe; numeric columns are cast to long
- Bug: if the Druid MAU query returns None the code calls self._empty_df, which is not defined, so it raises AttributeError (the yesterday-login path builds its empty DataFrame inline correctly)

**Writes:**
- **Warehouse / Postgres:** dsr_metrics_history — Postgres warehouse DB, full truncate+overwrite of history plus today's row (17 columns: date, central_depts, dept_orgs, states_uts, course_publishers, courses_published, course_duration_hours, course_enrolments, course_completions, event_enrolments, event_completions, users_registered_total, new_user_registrations, users_enrolled_one_course, certificates_issued, users_logged_in, mau); not in bq-scripts.sh
- **Redis:** 18 keys: dashboard_{enrolment_count,unique_users_enrolled_count,completed_count,events_enrolment_count,events_completed_count,new_users_registered_yesterday,courses_published_live_count,course_publisher_count,courses_published_live_duration,dept_org_onboarded_count,user_loggedin_yesterday_count}_updated_format, mdo_total_registered_officer_count_updated_format, lp_completed_yesterday_count (+ _updated_format), lp_monthly_active_users (+ _updated_format), dashboard_central_ministries_count, dashboard_state_ut_count

**Downstream:** Admin dashboard summary cards (Redis *_updated_format keys). dsr_metrics_history keeps the day-by-day KPI history.

### DSR + WFS Pre-trigger Validation — `jobs/stage-2/dsrValidation.py`

**Purpose:** Operational sanity-check script run before the 8 AM Daily Summary Report is sent: it reads today's row and the previous 5 days from dsr_metrics_history (written by dsrComputation.py) and applies per-metric consistency rules, then separately checks the WorkFlowSummaryModel (WFS) job log against Druid. Produces a combined text report and exits non-zero only if the DSR checks are CRITICAL.

**Added since 4.8.39.3:**
- Added in c8a055c (2026-09-01, Varsha Mahuli) as the 'dsrWfs Validation script'; no later changes.

**Reads (3):**
- `Postgres(warehouse)` — dsr_metrics_history (warehouse DB) - today's row (date = local today) and the latest 5 earlier rows; 16 metric columns matching dsrComputation's schema
- Other: WFS job logs /mount/data/analytics/scripts/logs/joblog.log (today) and joblog-MM-DD-YYYY-1.log (previous 7 days) - last JOB_END line with edata.data.model=WorkFlowSummaryModel (status, inputEvents, outputEvents, date)
- `Druid` — COUNT(*) on telemetry-events-syncts and summary-events for the WFS data date (IST day boundaries); COUNT(*) GROUP BY context_pdata_id on telemetry-events-syncts for the data date and each of the 7 prior days; hardcoded router host &lt;DRUID_HOST&gt; (config.sparkDruidRouterHost ignored)

**Joins (1):**
- 0 - no DataFrame joins; Postgres rows and Druid counts are collected to the driver and compared in plain Python

**Processing:**
- Validates DSR output against its own history, not against source data: it does not recompute any DSR metric, it checks that dsrComputation's numbers are internally consistent and in line with recent days.
- Rules per metric: cumulative counts (central_depts, states_uts, course_publishers, courses_published, users_registered_total, users_enrolled_one_course) must not decrease; course/event enrolments and completions must strictly increase; dept_orgs may move up to 50 (SAFE), 100 (REVIEW), else CRITICAL.
- course_duration_hours must increase when courses_published increases; new_user_registrations is cross-checked against the day-over-day delta of users_registered_total (30 percent review, 60 percent critical).
- certificates_issued is checked vs its 5-day average (increases capped at REVIEW) and vs the day-over-day delta of course+event completions (~1 certificate per completion); users_logged_in is CRITICAL if below 10 percent of average (Druid outage signature); mau uses a symmetric 20/40 percent band.
- Overall DSR status is the worst metric status; banner text maps SAFE / NEEDS REVIEW / CRITICAL to 'safe to trigger', 'human should glance', 'DO NOT TRIGGER' for the 8 AM DSR.
- WFS checks: job status SUCCESS, input/output event counts vs 7-day log average (20/40 percent), log counts vs Druid counts (5/15 percent), and Web/Android/iOS event split vs each platform's own history with a near-zero (5 percent) CRITICAL rule.
- WFS findings never block the DSR; an escalation label (URGENT if raw-telemetry mismatch or a platform split is CRITICAL, else STANDARD) is added to the WFS section.
- Raises ValueError if dsr_metrics_history has no row for today's date, so it must run after dsrComputation.py on the same calendar day.
- SparkSession (4g/4g, Postgres JDBC package) is created at module import time, not in main().
- Dead code: OUTPUT_FILE_NAME, WFS_OUTPUT_FILE_NAME, write_report_to_file() and ensure_parent_dir() are defined but never used; only the combined report is written.

**Writes:**
- **Report / CSV:** combined_validation_report.txt - plain text, written to the current working directory (relative path), containing the DSR section and the WFS section; also printed to stdout
- **Other:** Process exit: raises SystemExit('DSR validation: CRITICAL issues found - do not trigger 8 AM DSR.') when DSR status is CRITICAL, intended as a gate for whatever triggers the DSR send

**Downstream:** Human operators / a wrapper that decides whether to trigger the 8 AM DSR, based on the exit status and report file. No caller in this repo.

### Daily Summary Report (deprecated) — `jobs/stage-2/dsrComputationUpdated.py`

**Purpose:** An abandoned rewrite computing a smaller KPI subset from
different upstream tables — no Volunteer filtering, no Postgres history, no
MAU/DAU.

**Reads (6):** `USER_PARQUET_FILE` (active), `ENROLMENT_SELECT` (a
different source than the live job), `EXTERNAL_COURSE_ENROLMENTS`,
`ESCONTENT_PARQUET_FILE` (raw), a live external portal search API
(**hardcoded bearer token in source**), Redis (`external_course_count_current`,
a rough yesterday-count proxy).

**Joins (4, two pairs duplicated):** content ⋈ enrolment `LEFT`, ⋈ active
users `INNER` — computed twice, once for enrolments and once for
completions.

**Writes:** Redis keys with typos preserved from source
(`yerterday_course_completion`, `sers_registered_yersterday`) — no overlap
with the live job's key set.

### Content Health Score (CHS) — `jobs/stage-2/courseHealthMetrics.py`

**Purpose:** Computes a monthly 0-100 Content Health Score for every Live, non-SCORM Course / Moderated Course published at least 90 days ago, from six banded metrics (five 'dynamic' learner-behaviour metrics plus one 'static' structural metric). Writes the current snapshot plus a 6-month trend to Redis, a flat parquet, and a monthly row to a Postgres history table (class name org.ekstep.analytics.dashboard.health.ContentHealthMetricsModel, i.e. a port of a Scala model).

**Added since 4.8.39.3:**
- Added in c8a055c (2026-09-01, Varsha Mahuli) 'cba changes w.r.t anshu's data request + chs and dsrWfs Validation scripts'; no later changes.

**Reads (9):**
- `Parquet(warehouse)` — warehouse/user_enrolments (config.warehouseReportDir/dwEnrollmentsTable; written by userEnrolment.py) - enrolled_on, first_completed_on
- `Parquet(warehouse)` — warehouse/content_resource (config.warehouseReportDir/dwContentResourceTable; written by courseReport.py) - resource_id, resource_duration
- `Parquet(warehouse)` — /home/analytics/pyspark/warehouse/content (hardcoded absolute path; same table courseReport.py writes as dwCourseTable) - content_status, content_type, last_published_on, content_duration
- `Parquet(raw)` — /home/analytics/pyspark/data-res/pq_files/cache_pq/consumption_v2 (hardcoded, no constant; Cassandra sunbird_courses.user_content_consumption_v2 cached by programProgressSyncList_v5.py), filtered to status=2
- `Parquet(raw)` — RATING_PARQUET_FILE - activityid, rating, updatedon
- `Parquet(computed)` — CONTENT_HIERARCHY_SELECT_PARQUET_FILE - hierarchy JSON for SCORM detection
- `CSV` — /home/analytics/pyspark/data_res/pq_files/cache_pq/feedback_sentiment (header CSV with content_id, score 1-5; no producer in this repo; optional, metric zeroed if missing)
- `Druid` — telemetry-events-syncts, eid=END, edata_type=Player, SUM(edata_duration) per object_rollup_l1 (course) and actor_id, one query per calendar month over the last 3 months, via config.sparkDruidRouterHost
- `Postgres(warehouse)` — course_health_metrics_history (warehouse DB, read before write) - prior months for last-month score, last 6 months and trend

**Joins (9):**
- OUTER · level-1 SCORM flags ⋈ level-2 SCORM flags on courseID - courses with an html-archive child at hierarchy level 1 or 2 are SCORM
- LEFT_ANTI · live courses ⋈ SCORM ids on content_id - exclude SCORM courses from scoring
- INNER · enrolments ⋈ live course ids on content_id - completion-rate and drop-off population
- INNER (broadcast) · consumption ⋈ course resources on (contentid=resource_id, courseid=content_id) - completed resources per user
- LEFT · enrolments ⋈ completed-resource counts on (user_id, content_id); INNER (broadcast) ⋈ total resources per course - drop-off
- INNER · ratings ⋈ live course ids on activityid - average rating
- INNER · content_resource ⋈ live course ids - resource length; INNER sentiment CSV ⋈ live course ids - sentiment
- INNER · Druid avg time ⋈ expected content_duration on content_id - time spent
- LEFT x6 · live course ids ⋈ each metric frame on content_id, then LEFT ⋈ last-month score, last-6-month scores, trend details - final per-course row

**Processing:**
- Scope: content_status Live, content_type Course or Moderated Course, last_published_on at least 90 days before today, minus SCORM courses.
- Six metrics, each banded to a 1-5 score and weighted as score/5 x weight: completion_rate 5, dropoff_rate 15, avg_rating 10, feedback_sentiment 10, time_spent 10 (dynamic, max 50) and resource_length 10 (static, max 10).
- total_health_score = (dynamic_sum/50) x 50 + (resource_length_weighted/10) x 50, so the single static metric (resource length) carries half of the 0-100 score while the five dynamic metrics share the other half - not the per-metric weights the constants suggest.
- Completion rate: completions / enrolments for enrolments between the start of the month 3 months back and the end of last month (3 full previous months), bands >70, >=50, >=30, >=15 percent.
- Drop-off: a user counts as dropped off only if they completed exactly 1 resource of a course with more than 1 resource; users with 0 completed resources are not drop-offs. Uses the same 3-month enrolment window; constants DROPOFF_DAYS=30 and WINDOW_DAYS=90 are defined but never used.
- Average rating: last calendar month's ratings, banded against the platform mean and standard deviation of per-course averages (mean+SD, +0.3SD, -0.3SD, -SD). If last month has no ratings it falls back to updatedon >= last_month_start - 60 days with no upper bound (comment says 90 days).
- Red flag: total_ratings x 0.05 > 20 AND count of 1-2 star ratings >= 20; propagated into avg_rating and health_score JSON.
- Resource length: percent of resources under 600 s and count over 1800 s. The band-3 and band-2 conditions use OR, so any course not reaching band 3 has outlier_count >= 3 and lands in band 2 - score 1 is effectively unreachable.
- Feedback sentiment: score taken as-is from the external CSV (no computation here); its 'value' field is hardcoded 0.0. Comment says 'Parquet' but the code reads CSV, and the path uses data_res (underscore) whereas every other cache path in the repo uses data-res.
- Time spent: avg over users of summed Player END edata_duration for the last 3 months, divided by course content_duration (HH:MM:SS parsed). Bands use between() with integer edges (80-120, 60-79/121-140, ...) on a 2-decimal value, so values like 79.5 or 120.5 fall through to score 1.
- diff_percentage = percent change vs last month's total_health_score from Postgres; last_6_month_score and trend_details are built from up to 6 prior calculated_month values in Postgres.
- Redis write uses redis-py directly (dfutil Redis helper is imported but unused), db 12 hardcoded, pipelined HSET in batches of 500 after collect() of all rows to the driver; no DEL or TTL, so courses that drop out of scope keep stale hashes.
- Postgres write calls write_postgres_table with the default mode overwrite and no truncate option, so Spark drops and recreates course_health_metrics_history each run containing ONLY the current month's rows. History therefore never accumulates beyond one month: diff_percentage works for one month back, but last_6_month_score and trend_details can hold at most one prior month.
- Run period is derived from UTC now: calculated_month = first of current month, windows = previous 3 complete months, so the job is designed to run once a month early in the month; nothing in the repo schedules it.
- Spark session asks for 180g executor / 60g driver memory and pulls the Postgres JDBC driver via PYSPARK_SUBMIT_ARGS.

**Writes:**
- **Parquet:** /home/analytics/pyspark/warehouse/content_health_score (hardcoded, overwrite) - one row per course with metric values, weighted scores, total_health_score, health_score_red_flag, calculated_at; not in bq-scripts.sh
- **Warehouse / Postgres:** course_health_metrics_history - Postgres warehouse DB (jdbc .../warehouse, default schema), columns content_id, calculated_month (yyyy-MM-01 string), metrics (JSON string); mode overwrite without truncate, so the table is dropped and recreated with the current month only
- **Redis:** course_metrics:{content_id} (db 12) - hash with fields completion_rate, dropoff_rate, avg_rating, resource_length, feedback_sentiment, time_spent, health_score, last_6_month_score, trend_details, each a JSON string (name, overview, maxWeight, type, score, value, weighted_score, plus metric-specific extras)

**Downstream:** No consumer in this repo. The Redis hash layout (per-metric name/overview/maxWeight JSON, trend_details keyed by MMM-yyyy) is shaped for a UI/content API to read directly; the parquet and Postgres table have no readers other than this job itself.

### Gamification Dashboard — `jobs/stage-2/gamification/dashboard.py`

**This file is empty (0 lines) in this branch.** No logic to describe.

### Gamification Badge KPIs — `jobs/stage-2/gamificationJob.py`

**Purpose:** Aggregates course-badge metadata with enrolment/completion
data into badge-program KPIs (created, live, awarded, active learners,
earning rate) with month-over-month trend, plus a per-MDO CSV.

**Reads (5):** `ENROLMENT_COMPUTED` (enrolled), `EXTERNAL_ENROLMENT_COMPUTED`,
`EXTERNAL_CONTENT_COMPUTED`, `ALL_COURSE_PROGRAM_COMPUTED`,
`USER_ORG_COMPUTED_FILE`.

**Joins (4):** UNION platform ⋈ external enrolment · UNION internal ⋈
external badge metadata · broadcast `LEFT` enrolment ⋈ content-badge
metadata `content_id` (primary enrichment) · `INNER` reporting ⋈
user-master `userID`.

**Processing:** `SparkSession` is built at **module import time**, not
inside `main()` — importing this file anywhere eagerly launches a
90g-executor Spark session. Imports `broadcast()` only from
`duckdb.experimental.spark.sql.functions`, never native PySpark. Badge
leaderboard via `dense_rank` on award count.

**Writes:** Parquet `GAMIFICATION_BADGE_USER_ENROLMENT_PARQUET_FILE` (a
hard dependency for `gamificationNotificationProducer.py` and
`userReport.py`); CSV `GamificationReport.csv` per MDO; Redis — 7 keys
matching `gamification/prerequisites.md`'s spec exactly (badge counts,
earning rate, performance rate, content completion rate).

### Gamification Notification Consumer — `jobs/stage-2/gamificationNotificationConsumer.py`

**Purpose:** Delivers pending badge-reminder notifications by claiming a
batch from a Postgres queue table and POSTing each to the Notification
microservice. **Despite the name, this is a Postgres outbox worker, not a
Kafka consumer** — no Kafka client exists in this file.

**Reads (1):** Postgres `config.dwnotificationQueue` —
`SELECT ... FOR UPDATE SKIP LOCKED` batch-claim pattern. Pure Python, no
Spark.

**Joins:** 0.

**Writes:** Updates `status`/`error_message` on the same queue table (no
new rows); HTTP POST to the Notification microservice.

> **Bug:** `config.dwnotificationQueue` and `gamificationNotificationBatchSize`
> are not defined anywhere in `config.py`, `default_config.py`, or the
> Ansible template — would raise `AttributeError` unless supplied externally.

### Gamification Notification Producer — `jobs/stage-2/gamificationNotificationProducer.py`

**Purpose:** Finds learners in-progress on a badge course whose earning
deadline is exactly N days away, and inserts one reminder row per eligible
user+course into the same Postgres queue the Consumer drains.

**Reads (2):** `GAMIFICATION_BADGE_USER_ENROLMENT_PARQUET_FILE` (in-progress
+ deadline set), the Postgres queue (for dedup).

**Joins (1):** `LEFT_ANTI` eligible users ⋈ existing queue rows on
`notification_id`.

**Processing:** `notification_id = md5(userID + content_id)` — deterministic
idempotency key. Fires on an exact-day match, not a rolling window.

**Writes:** `INSERT` into the Postgres notification queue (append).

### In-App Review Nudge — `jobs/stage-2/inappReview.py`

**Purpose:** Generates an in-app "rate the app" nudge for every user whose
weekly-claps record updated today.

**Reads (1):** `CLAPS_PARQUET_FILE`. **Joins:** 0.

**Writes:** Cassandra `sunbird_notifications.notification_feed` (append),
expiring at end of the current ISO week.

### Karma Points Ledger — `jobs/stage-2/karmaPoints.py`

> **No longer used.** Kept below for reference.

**Purpose:** Computes last month's karma-point score for rating a course
(+2) and completing a course (+10 with a graded assessment, +5 without,
capped at each user's first 4 completions/month), then updates a running
per-user total.

**Reads (5):** `RATING_PARQUET_FILE` (Cassandra TimeUUID decoded via a
custom UDF), `USER_ASSESSMENT_PARQUET_FILE`, `CONTENT_COMPUTED`,
`ENROLMENT_COMPUTED`, `USER_KARMA_POINTS_SUMMARY_PARQUET_FILE`
(self-referencing feedback loop with its own Cassandra output).

**Joins (4):** rating ⋈ course details `LEFT` · completion ⋈ course
details `INNER` · + has-assessment flag `LEFT` · new points `FULL OUTER`
existing running total on `userid`.

**Writes:** Cassandra ×3 — `user_karma_points` ledger, `_credit_lookup`,
`_summary` (cumulative) — **not** the Postgres warehouse.

### Knowledge & Competency Mapping (Stage 2C) — `jobs/stage-2/kcmReport.py`

**Purpose:** Links every Live or Retired course-like item to its competency taxonomy (Area, Theme, Sub-theme) and reconciles it against the KCM-v6 dictionary. Moderated Courses are now included. Runs standalone and as Stage 2C of jobs/main.py.

**Changed since 4.8.39.3:**
- 3494b4c (2026-09-22) added 'Moderated Course' to the category filter, so Moderated Courses now appear in kcm_content_mapping and ContentCompetencyMapping.csv

**Reads (2):**
- `Parquet(computed)` — CONTENT_COMPUTED_PARQUET_FILE — categories Course, Program, Blended Program, CuratedCollections, Standalone Assessment, Curated Program, Moderated Course; courseStatus Live/Retired; competency ref-id arrays, parsed as real arrays or as string-encoded arrays
- `Parquet(raw)` — KCMV6_PARQUET_FILE (hierarchy JSON with categories[0]=areas, [1]=themes, [2]=sub-themes)

**Joins (5):**
- INNER · area posexplode ⋈ theme posexplode ⋈ sub-theme posexplode on (courseID, pos) — lines up the Nth area/theme/sub-theme for each course
- LEFT · course details ⋈ competency-joined on courseID — keeps courses with no competencies
- FULL OUTER · KCM area→theme ⋈ KCM theme→sub-theme on (themeID, themeName)
- LEFT · master sub-theme list ⋈ area-theme-subtheme on subThemeID — every sub-theme appears even with no area/theme link
- INNER · content mapping ⋈ competency details on (area, theme, sub-theme ids) — builds the CSV report

**Processing:**
- Positionally explodes the parallel Area/Theme/SubTheme arrays so the Nth entry of each lines up for a course
- Reconciles the master sub-theme dictionary so every sub-theme appears even with zero mapped courses
- competency_theme_type is the literal string 'Null'
- On any exception it prints and calls sys.exit(1)

**Writes:**
- **Report / CSV:** ContentCompetencyMapping.csv (config.kcmReport) under localReportDir/kcmReportPath/{today}/ContentCompetencyMapping, a single file made by copying the part file
- **Warehouse / Postgres:** kcm_content_mapping (config.dwKcmContentTable) and kcm_dictionary (config.dwKcmDictionaryTable) as Parquet under warehouseReportDir. Both are then synced to Postgres (dataWarehouseBash.sh) and BigQuery (bq-scripts.sh)

**Downstream:** l2Assessments.py and acbpReport.py both read kcm_dictionary and kcm_content_mapping from warehouseReportDir.

### L2 / Comprehensive Assessment (APAR+CAP) — `jobs/stage-2/l2Assessments.py`

**Purpose:** A unified report combining APAR-mandated CBP course
consumption with Comprehensive Assessment Program exam attempts.

**Reads (10):** `warehouse/kcm_dictionary`, `kcm_content_mapping` (from
`kcmReport.py`), `warehouse/user_enrolments`, `ACBP_COMPUTED_FILE`,
`warehouse/content`, `warehouse/assessment_detail`, `warehouse/org_hierarchy`,
`warehouse/user_detail`, `warehouse/cb_plan`, ad hoc `esCourseAssessment`.

**Joins (12):** user×org `LEFT` · live-ES-min-pass-% override `LEFT` · KCM
reconciliation `INNER`(unused/dead)+`LEFT`(used) · APAR branch (5 joins:
plan→enrolment→content→user→cbplan→competency) · CAP branch (3 joins:
content→enrolment→assessment→user).

**Processing:** CAP dedup keeps the best attempt per (user, content,
assessment) — highest score first, tie-broken Pass over Fail.

**Writes:** Parquet to a **hardcoded absolute path**
(`/mount/data/analytics/igot-reports/assessment-report-apar/parquet`) — not
built from config, unlike every other job in the repo. A commented-out CSV
write references a developer's personal home directory. No warehouse write,
no CSV via the standard mechanism.

---

## Stage 2 — Leaderboards & Campaigns

### Learner Leaderboard — `jobs/stage-2/learnerLeaderboard.py`

**Purpose:** Monthly per-org "top learners" leaderboard ranked by karma
points earned last month, with rank movement vs. last month.

**Reads (3):** `USER_KARMA_POINTS_PARQUET_FILE` (previous month),
`USER_ORG_COMPUTED_FILE`, `LEARNER_LEADERBOARD_PARQUET_FILE` (prior
Cassandra snapshot).

**Joins (3):** orgs with `>10` users only `INNER` (privacy floor) · org
members ⋈ karma points `LEFT` · current ⋈ prior rank `LEFT userid`.

**Added in 4.8.39.3:** the final DataFrame gains a `job_execution_datetime`
column (`current_timestamp()`) before the Cassandra write — a run-audit
timestamp, not a behavior change.

**Writes:** Cassandra `learner_leaderboard` + `_lookup` (append). No
Postgres/Redis/Kafka.

### Ministry Leaderboard — `jobs/stage-2/ministryLeaderboard.py`

**Purpose:** Rolls up "top learners" to every level of the ministry/
department/org hierarchy simultaneously, using an embedded DuckDB database
for the hierarchy fan-out.

**Reads (3, loaded into DuckDB):** `USER_ORG_COMPUTED_FILE`,
`ORG_COMPLETE_HIERARCHY_PARQUET_FILE`, `USER_KARMA_POINTS_PARQUET_FILE`
(previous month, filtered in DuckDB).

**Joins (5, DuckDB SQL):** hierarchy × distinct-MDOs `INNER`, then a
3-level self-join chain rolling users up to MDO / department / ministry, ×
karma aggregate `INNER`.

**Processing:** One row per user **per hierarchy level** (MDO, dept,
ministry) via `UNION ALL`, so one `dense_rank()` produces independent
leaderboards at every level at once.

**Writes:** Postgres **app schema** `slw_mdo_top_learners`, JDBC
overwrite+truncate.

> **Bug:** the job's own log lines say "Writing to Cassandra" — it actually
> writes to Postgres. Stale comments, not a functional Cassandra path.

### Ministry Metrics — `jobs/stage-2/ministryMetrics.py`

**Purpose:** Refreshes four at-a-glance counters (24h active users, total
registered, certificates issued, enrolments) rolled up to ministry,
department and org level.

**Reads (4):** `ENROLMENT_WAREHOUSE_COMPUTED`, `USER_COMPUTED` (active),
`ORG_HIERARCHY_PARQUET_FILE` (raw), Druid (24h active users).

**Joins (11):** active-users × Druid `INNER` · × org-hierarchy `LEFT` ·
enrolment × users `INNER` × org-hierarchy `LEFT` · userCount computed 3×
(ministry/dept/org) × org-hierarchy `LEFT` (×3) · each metric ×
ministryNames `INNER` (×4, to resolve the Redis field key).

**Processing:** "One code path, three grain levels" — every metric computed
identically at ministry/department/org grain, then unioned.

**Writes:** Redis 4 hashes — `dashboard_rolled_up_login_percent_last_24_hrs`,
`_user_count`, `_certificates_generated_count`, `_enrolment_content_count`.

### National Learning Week Leaderboard — `jobs/stage-2/nationalLearningWeek.py`

**Purpose:** For a fixed campaign window, computes a per-capita
karma-points leaderboard bucketed by org size, separately for "state" and
"centre" MDOs, plus a live daily certificate/learning-hours ticker.

**Reads (8):** `warehouse/org_hierarchy`, `USER_ORG_COMPUTED_FILE`,
`ENROLMENT_WAREHOUSE_COMPUTED`, `CONTENT_WAREHOUSE_COMPUTED`,
`GAMIFICATION_BADGE_USER_ENROLMENT_PARQUET_FILE`,
`USER_KARMA_POINTS_PARQUET_FILE`, `EVENT_PARQUET_FILE`,
`eventEnrolmentDetails` (read via a literal path, not the shared constant).

**Joins (16):** content/event-hours attach `LEFT`/`INNER` · state-hierarchy
resolution `INNER` (×2) · karma+hours attach `LEFT` (×4, state & centre
separately) · fixed-population override `LEFT` (a per-state **hardcoded
target population** overriding the actual registered-user count as the
per-capita denominator!) · org-name resolution `LEFT` · 4 sequential
per-user stat joins.

**Processing:** A real historical bug was fixed here and documented
inline — a lowercase `"xs"` bucket fallback used to create a phantom
rank-1 partition. Contains a leftover hardcoded single-user debug
`.show()` call in the production path.

**Writes:** Parquet `warehouse/nlw_mdo_leaderboard`; Cassandra
`"nlw_mdo_leaderboard"` (hardcoded literal, not config-driven); Postgres
app-schema `"nlw_user_leaderboard"` (same caveat); Redis
`lhp_certifications`/`lhp_learningHours` hashes (merge mode, using Redis
itself as the yesterday/today rollover memory).

### NPS Survey Trigger — `jobs/stage-2/npsUpgraded.py`

**Purpose:** Identifies users who should be prompted for the platform
NPS/rating survey — enrolled, completed, or rated a course in the last 15
days, and haven't already seen the prompt.

**Reads (4):** Druid (already-shown-popup users, 15-day),
`ENROLMENT_COMPUTED` (15-day), `RATING_PARQUET_FILE` (15-day, TimeUUID
decoded), Cassandra `user_feed` (`category=NPS2`, existing).

**Joins:** 0 conventional — eligibility is set algebra (`unionByName` +
`dropDuplicates`, then `.subtract()` for exclusions).

**Writes:** Cassandra `user_feed` (NPS2 entries) + `notification_feed_history`
audit copy.

> **Bug:** the file has two consecutive
> `if __name__=="__main__": main()` blocks — the entire pipeline and its
> Cassandra writes run **twice** per invocation.

### ODCS Content Recommendation — `jobs/stage-2/odcsRecommendation.py`

**Purpose:** Ranks each org's own courses by completion rate, rating and
volume, caching a top-15 list per org.

**Reads (4):** `ENROLMENT_WAREHOUSE_COMPUTED`, `CONTENT_WAREHOUSE_COMPUTED`,
`USER_WAREHOUSE_COMPUTED`, `RATING_PARQUET_FILE` (Course only).

**Joins (4):** enrolments × content `INNER` · + user `INNER` (mdo_id) · +
completion-% `LEFT` · + rating `LEFT`.

**Writes:** Redis `odcs_course_recomendation` (typo preserved from
source), field = `mdo_id`.

### Org Hierarchy Sync (original) — `jobs/stage-2/org_hierarchy.py`

**Purpose:** Fully rebuilds the ministry/department/org hierarchy lookup
in Postgres. **Plain Python, not PySpark.** Still used internally. Its two former
sibling variants (below) have been replaced by `org_hierarchy_new.py`.

**Reads (2):** Elasticsearch `org_v4` index (hardcoded host), an external
FRAC framework REST API (hardcoded prod host).

**Joins:** 0 — row-by-row Python dict-walking, not Spark.

**Processing:** Unconditionally `TRUNCATE`s 3 Postgres tables at the start
of every run — full refresh, no incremental mode.

**Writes:** Postgres app schema `org_hierarchy_new`, `org_hierarchy_lookup`,
`mdo_children_lookup`.

> **Security flag — PARTIALLY FIXED in 4.8.39.3:** the hardcoded live
> bearer token was removed and replaced with a commented-out placeholder,
> and a stray `cookie` header was deleted. The hardcoded Postgres password
> (`"<PASSWORD>"`) and both the Elasticsearch (`<ES_HOST>`) and Postgres
> (`<POSTGRES_HOST>`) hostnames are still hardcoded directly in source. The
> sibling job below, `orgHierarchyAll.py`, fully resolves this — but
> `org_hierarchy.py` itself still has the gap.

### Org Hierarchy Sync (config-driven rewrite) — `jobs/stage-2/orgHierarchyAll.py`

> **No longer used — replaced by [`org_hierarchy_new.py`](#org-hierarchy-sync-consolidated--jobsstage-2org_hierarchy_newpy).** Kept below for reference.

**Purpose:** A fully config-driven rewrite of `org_hierarchy.py`'s exact
same responsibility — identical function set (`fetch_es_data`,
`parse_framework_data`, `insert_to_postgres`, `parse_pg_timestamp`,
`build_flat_descendant_map`, `insert_mdo_children_lookup`,
`find_and_insert_all_children`, `process_frameworks`,
`insert_hierarchy_lookup`), same 3 target tables, but every hardcoded value
replaced by a config lookup.

**Reads (2):** Elasticsearch `org_v4` index, via
`config.sparkElasticsearchConnectionHost`/`Port`; the FRAC framework API via
`config.api_url_template` (new config key, also added to
`jobs/config.py`/`config.py.j2` in 4.8.39.3) — no hardcoded host or
token.

**Joins:** 0 — row-by-row Python dict-walking, not Spark.

**Processing:** Postgres connection built entirely from
`config.dwPostgresHost`/`appPostgresSchema`/`appPostgresUsername`/
`appPostgresCredential` — no hardcoded credentials anywhere in this file.
Otherwise identical logic to `org_hierarchy.py`.

**Writes:** the same 3 Postgres app-schema tables as `org_hierarchy.py`.

> **Observation:** the framework-API call in this file
> (`requests.get(url)`) sends **no** `Authorization` header at all — a
> stricter fix would have replaced the hardcoded bearer token with a
> config-driven one, but this version sends none. Whether the endpoint
> genuinely requires no auth, or this was dropped as a side effect of
> removing the hardcoded credential, isn't determinable from the repo.

### Org Hierarchy Sync (empty-framework patch) — `jobs/stage-2/orgHerarchyUpdatedEmpty.py`

> **No longer used — replaced by [`org_hierarchy_new.py`](#org-hierarchy-sync-consolidated--jobsstage-2org_hierarchy_newpy).** Kept below for reference.

**Purpose:** A narrower variant that (a) also queries two specific
hardcoded org identifiers directly, in addition to the usual state/ministry
query (a code comment references "karmayogi bharat" and "karyogi prorambh
trainee"), and (b) — the "Empty" in the filename — inserts a default
all-`NULL` hierarchy row for any org whose framework has no `LevelOne`
terms, instead of silently skipping it the way the other two variants do.

**Reads (2):** Elasticsearch `org_v4` index (config-driven, same as
`orgHierarchyAll.py`) via two separate scroll queries — the standard
state/ministry filter, and a second query filtered to the 2 hardcoded org
IDs; the FRAC framework API via `config.api_url_template`.

**Joins:** 0. Both ES result sets are unioned and deduplicated by
`identifier` in pandas before processing.

**Processing:** Only `TRUNCATE`s and writes `org_hierarchy_new` — the calls
that would populate `org_hierarchy_lookup` and `mdo_children_lookup`
(`insert_hierarchy_lookup`, `find_and_insert_all_children`) are commented
out in `process_frameworks`, and the corresponding `TRUNCATE` statements for
those two tables are commented out too — so this variant deliberately
leaves those two tables untouched.

**Writes:** Postgres app schema `org_hierarchy_new` only.

**Downstream (all three org-hierarchy variants):** other services needing
"children of MDO X" lookups or the flattened ministry→department→org path;
not read by any other job in this repo (those read org hierarchy from
Parquet caches instead).

### Org Hierarchy Sync (consolidated) — `jobs/stage-2/org_hierarchy_new.py`

**Purpose:** The single replacement for orgHierarchyAll.py, orgHerarchyUpdatedEmpty.py and postgresToParquet.py, which used to run in sequence. One plain-Python process (no Spark) rebuilds the two Postgres lookup tables and writes org_hierarchy_new straight to Parquet.

**Reads (3):**
- `Elasticsearch` — org_v4 index — state/ministry orgs with an orgHierarchyFrameworkId (config-driven host/port)
- `Elasticsearch` — org_v4 index — second query for 2 hardcoded org ids (used for org_hierarchy_new only)
- `REST API` — framework API via config.api_url_template, one call per org (1 s delay between calls)

**Joins (2):**
- 0 — row-by-row Python dict-walking, not Spark
- Union + dedup on identifier · main ES org set ∪ hardcoded-org set (stage B only)

**Processing:**
- Stage A — TRUNCATEs org_hierarchy_lookup and mdo_children_lookup, then rebuilds them from the plain ES org set (no hardcoded ids, no empty-framework fix). Batched inserts via execute_values; mdo_children_lookup upserts on mdo_id
- Stage A builds a flat "every descendant at any depth" map per org for mdo_children_lookup, and an mdo → parent-department row per level for org_hierarchy_lookup
- Stage B — builds org_hierarchy_new rows in memory from the main + hardcoded org set, walking each framework into L1–L10 (id, name) columns. Orgs whose framework has no LevelOne terms still get one all-null row
- Stage C — writes the stage B rows to Parquet with pandas/pyarrow (snappy). No round trip through Postgres, which postgresToParquet.py used to do
- Postgres org_hierarchy_new is no longer written — Parquet only
- Same behaviour as before, kept on purpose: the Parquet output includes the 2 hardcoded orgs and empty-framework orgs, which the two Postgres lookup tables do not

**Writes:**
- **Parquet:** /home/analytics/pyspark/warehouse/org_hierarchy_new/part-00000.snappy.parquet — fixed file name, overwritten each run
- **Warehouse / Postgres:** org_hierarchy_lookup, mdo_children_lookup — Postgres app schema

**Downstream:** The Parquet sits under the warehouse directory for downstream Parquet readers; the Postgres lookup tables serve "children of MDO X" lookups for other services.

### Peer Validation — Eligible Users — `jobs/stage-2/peerValidationEligibleUsers.py`

**Purpose:** Determines which learners should be asked to complete a
peer-review survey for a course they just finished, and enqueues eligible
(user, form) pairs into a Postgres queue.

**Reads (6):** Postgres `peer_validation_notification_queue` (dedup),
`peer_validation_form_state` (watermark), Elasticsearch `fs-forms-alias-v2`
(peerValidationSurvey forms), `ENROLMENT_COMPUTED` (certified+completed),
`USER_ORG_COMPUTED_FILE`, `CONTENT_COMPUTED`.

**Joins (5):** forms × history `LEFT` · enrolment × user-org `LEFT` · +
forms (exploded) `INNER course_id` · + course details `LEFT` · eligible
`LEFT_ANTI` existing queue.

**Processing:** Incremental watermark window (scans only since
`last_processed_date + 1` after the first run); `notification_id =
md5(user_id + form_id)` idempotency key.

**Writes:** `INSERT` into `peer_validation_notification_queue` (dw schema,
append).

### Peer Validation — Notification Sender — `jobs/stage-2/peerValidationNotificationSender.py`

**Purpose:** Drains PENDING rows from the peer-validation queue, POSTs
them in batches to the Notification API, and advances each form's watermark
once its notifications are confirmed sent.

**Reads (2):** the same Postgres queue (PENDING), `peer_validation_form_state`.

**Joins (1):** `LEFT_ANTI` untouched forms ⋈ newly-advanced forms —
preserves prior watermarks before the union+overwrite.

**Processing:** Kill-switch config (`apiBasedNotificationEnabled`) allows
dry-run mode.

**Writes:** Per-row `UPDATE` of status on the queue; full `OVERWRITE` of
`form_state`; Kafka topic `peerValidationKafkaTopic`; HTTP POST to the
Notification API.

> **Config gap:** the Kafka broker config `kpBrokerList` has no dev
> fallback default in `default_config.py`, unlike `brokerList` — it can
> silently fail outside a fully templated deployment.

### Content Status Validation (v5) — `jobs/stage-2/programProgressSyncList_v5.py`

**Purpose:** Designed to cross-check denormalized completion status
against the row-level Cassandra consumption table and flag mismatches — but
**the entire validation pipeline is dead code** in this branch.

**Reads (1 live):** Cassandra `user_content_consumption_v2` — the only
read that actually executes.

**Joins:** 0 live (the dormant code contains ~15 joins across PySpark and
DuckDB, never called).

> **Critical finding:** lines ~839–933 (course validation, DuckDB program
> validation, 3 cert-readiness metrics, all report writing) are wrapped in
> an unused Python triple-quoted string literal — syntactically valid,
> never executes. No `_v1`–`_v4` files exist anywhere in the repo; this job
> is absent even from `bq-scripts.sh`.

**Writes:** Parquet `consumption_v2` — a refreshed cache of the Cassandra
table; the only thing that actually happens.

---

## Stage 2 — Surveys & Export

### Survey Question Report — `jobs/stage-2/surveyQuestionReport.py`

**Purpose:** Generates one CSV per survey "solution" with every question
response, enriched with respondent profile fields. Column layout is driven
entirely by a MongoDB config document.

**Reads (4):** MongoDB `reportConfigCollection` (dynamic column config),
`solutions` (end-dates); Druid `sl-survey` — distinct submission IDs, then
batched row data.

**Joins:** 0 — Druid filtering substitutes for joins.

**Processing:** Batches Druid queries by submission ID to avoid overloading
Druid. Column set, profile fields and sort order all come from Mongo — ops
can add columns without a code change.

**Writes:** One CSV per solution, zipped and synced to GCS under
`standalone-reports/ml-report`.

### Survey Status Report — `jobs/stage-2/surveyStatusReport.py`

**Purpose:** Intended to report survey completion status, but is a near
byte-for-byte copy of `surveyQuestionReport.py`.

**Reads (4):** identical to `surveyQuestionReport.py` — still queries the
MongoDB config document named `"surveyQuestionReport"` (not
`"surveyStatusReport"`), still uses `SurveyQuestionReportBatchSize` (not the
dedicated `SurveyStatusReportBatchSize` config that exists).

**Writes:** the identical output folder `SurveyQuestionsReport` — running
both jobs on the same day targets the same folder.

### Unenrolment Report — `jobs/stage-2/unenrollmentReport.py`

**Purpose:** Per-org report of every user unenrolled from a course — who
unenrolled them, when, why, and how far they'd progressed.

**Reads (4 + ACBP):** `UNENROLMENT_AUDIT_PARQUET_FILE` (UNENROLL only),
`ENROLMENT_COMPUTED` (enrolled), `USER_ORG_COMPUTED_FILE`,
`CONTENT_COMPUTED`, `ACBP_COMPUTED_FILE`.

**Joins (4):** enrolment × content `LEFT` · + user-org `LEFT` · +
ACBP-mandate flag `LEFT` · + unenrolment audit `INNER` — this inner join
**is** the row filter limiting the report to actually-unenrolled rows.

**Writes:** CSV `UnenrollmentReport.csv` per MDO. Warehouse:
`unenrolled_user_audit` — Parquet, not yet in `dataWarehouse.py`'s sync
list.

### User Activity Fact Table — `jobs/stage-2/userActivity.py`

**Purpose:** Builds one unified "what did this user consume and when" fact
table, combining content and event activity. Warehouse-only, no CSV.

**Reads (7, 3 dead/unused):** `USER_ORG_COMPUTED_FILE`; `warehouse/content`,
`warehouse/user_enrolments` (cross-job dependency on `userEnrolment.py`);
`EVENT_PARQUET_FILE`, `EVENT_ENROLMENT_PARQUET_FILE`. (`ORG_COMPUTED`,
`USER_COMPUTED`, `ORG_HIERARCHY_SELECT` are read but never used downstream.)

**Joins (3):** event-enrolments × events (broadcast) `LEFT` · + user-org
(broadcast) `LEFT` · enrolments × content (broadcast) `LEFT`.

**Writes:** warehouse `user_activity` — Parquet, not currently synced by
`dataWarehouse.py`.

### User Data → Redis — `jobs/stage-2/userDataToRedis.py`

**Purpose:** Pushes a lightweight per-user profile snapshot into Redis so
front-end services can render user cards without hitting Cassandra/Postgres
on every request.

**Reads (1):** `USER_SELECT_PARQUET_FILE`. **Joins:** 0.

**Processing:** `repartition(500)` + `foreachPartition` with pipelined
batched `SET` (25,000/batch).

**Writes:** Redis `user:{user_id}` → JSON profile snapshot, overwritten
every run, no TTL.

> **Bug:** uses a plain `redis.Redis` client without selecting
> `config.redisDB` — always writes DB 0 regardless of the configured DB
> index.

### User Enrolment Report (Stage 2D) — `jobs/stage-2/userEnrolment.py`

**Purpose:** The canonical who-is-enrolled-in-what report for every org, platform and marketplace content combined, split Govt vs Non-Govt, and the producer of the user_enrolments warehouse table. Part of jobs/main.py's orchestrated pipeline. On this branch user_enrolments also gained synthesized rows for Standalone Assessments.

**Changed since 4.8.39.3:**
- c29fd2b (2026-09-15): Standalone Assessment enrolment rows added to user_enrolments via new assessmentDFUtil.standalone_assessment_enrolments_dataframe; debug count prints removed. The same commit's assessment_sub_type change (adds Pre Enrolment Assessment alongside Standalone Assessment) is in jobs/stage-2/courseBasedAssessmentReport.py, not in this file

**Reads (7):**
- `Parquet(raw)` — UNENROLMENT_AUDIT_PARQUET_FILE (action=UNENROLL, latest per user/course/batch via row_number)
- `Parquet(computed)` — ENROLMENT_COMPUTED_PARQUET_FILE
- `Parquet(computed)` — USER_ORG_COMPUTED_FILE
- `Parquet(computed)` — CONTENT_COMPUTED_PARQUET_FILE (category in Course, Program, Blended Program, CuratedCollections, Curated Program)
- `Parquet(computed)` — EXTERNAL_ENROLMENT_COMPUTED_PARQUET_FILE, EXTERNAL_CONTENT_COMPUTED_PARQUET_FILE
- `Parquet(computed)` — ACBP_COMPUTED_FILE
- Via assessmentDFUtil.standalone_assessment_enrolments_dataframe (new): PQ ALL_ASSESSMENT_COMPUTED_PARQUET_FILE, PQ ORG_COMPUTED_PARQUET_FILE, PQr HIERARCHY_PARQUET_FILE, PQr USER_ASSESSMENT_PARQUET_FILE (cleaned userAssessment cache)

**Joins (7):**
- LEFT · enrolment ⋈ content on courseID (enrolmentDFUtil.preComputeUserOrgEnrolment)
- LEFT · + user-org on userID (same helper)
- INNER · external content ⋈ external enrolment on content_id
- LEFT · marketplace enrolments ⋈ user-org on userID
- LEFT · platform ⋈ ACBP mandate on (userID, userOrgID, courseID)
- LEFT · + latest unenrolment audit on (userID, courseID, batchID) — keeps enrolled and unenrolled rows
- Standalone assessment joins happen inside assessmentDFUtil.standalone_assessment_enrolments_dataframe (see dfutil-assessment)

**Processing:**
- Govt/Non-Govt split by exact (trimmed, case-insensitive) VOLUNTEER match on designation or any role; Non-Govt rows of orgs that also have Govt users go to mdoid=<org>_non_govt
- Each CSV write is skipped if its subset is empty (guards a KeyError in write_csv_per_mdo_id_duckdb)
- NEW: Standalone Assessment enrolments synthesized from assessment attempts (one row per user per parent assessment): completed if any SUBMITTED attempt (best-scored attempt, enrolled_on = its end time, certificate_generated from assessPass, progress 100), else in-progress (latest attempt, progress 0); batch_id 'Not Available', enrolment_status 'enrolled', karma_points 0, user_rating 'Not Available', certificate_id '', live_cbp_plan_mandate false, completion/certificate date columns null
- Standalone rows are added to the warehouse user_enrolments output only, not to ConsumptionReport.csv
- Bug: userEnrolment.py calls assessmentDFUtil.standalone_assessment_enrolments_dataframe but never imports assessmentDFUtil (imports are contentDFUtil, enrolmentDFUtil, userDFUtil, dfexportutil only), so as written the job raises NameError at that line before any output is written
- Removed the enrolled/unenrolled/marketplace count summary prints (several extra Spark count actions)

**Writes:**
- **Report / CSV:** standalone-reports/user-enrollment-report/<date>/mdoid=<org>[ _non_govt]/ConsumptionReport.csv (Govt and Non-Govt)
- **Warehouse / Postgres:** warehouse/user_enrolments (config.dwEnrollmentsTable) = platform UNION marketplace UNION standalone-assessment rows

**Downstream:** user_enrolments is synced to Postgres by dataWarehouse.py and read by userActivity.py, dsrComputation.py, nationalLearningWeek.py, odcsRecommendation.py, ministryMetrics.py and dashboardSync.py; CSVs bundled by zipUpload.py. Those consumers will now also see Standalone Assessment rows.

### User Report (Stage 2A) — `jobs/stage-2/userReport.py`

**Purpose:** The canonical per-user profile and activity report for every org: karma points, badges, enrolment/completion counts, learning hours, and dynamically pivoted org-specific custom fields. Part of jobs/main.py's orchestrated pipeline. Writes the user_detail warehouse table. Its content learning-hours calculation was reworked again since 4.8.39.3 (per-category duration rules, Learning Pathway support, offline Blended Program sessions).

**Changed since 4.8.39.3:**
- 0ea0051 (2026-08-28) learning hour changes: switched enrolment source to ENROLMENT_COMPUTED with derived consumption status; added Learning Pathway, Blended Program course-unit and offline-session durations, esFinalAssessment fallback; Total_Learning_Hours rounded to 2 dp
- ecf1852 (2026-09-01) learning hour fixes: refinements to the above (try_build guards, child-category filter now != Course, caching/unpersist)
- Correction to existing docs: there is no DOB column in the current code (not present at f80eb91 either)

**Reads (9):**
- `Parquet(computed)` — USER_ORG_COMPUTED_FILE (user master)
- `Parquet(computed)` — ENROLMENT_COMPUTED_PARQUET_FILE (courseID, userID, dbCompletionStatus, certificateID; replaces the previous ENROLMENT_WAREHOUSE_COMPUTED_PARQUET_FILE read; status derived via enrolmentDFUtil.withUserCourseCompletionStatusColumn)
- `Parquet(computed)` — GAMIFICATION_BADGE_USER_ENROLMENT_PARQUET_FILE (distinct badge count per user)
- `Parquet(computed)` — CONTENT_HIERARCHY_FLATTENED_PARQUET_FILE (root_content_id, courseCategory, parent_duration, first_level_child_identifier/primaryCategory/duration, second_level_child_identifier/duration, parent_batches, parent_milestones_v1, parent_preliminary_assessment_id)
- `Parquet(raw)` — FINAL_ASSESSMENT_PARQUET_FILE (esFinalAssessment: identifier, expectedDuration) - new
- `Parquet(raw)` — EXTERNAL_CONTENT_PARQUET_FILE (cios_data.content.duration)
- `Parquet(raw)` — EXTERNAL_COURSE_ENROLMENTS_PARQUET_FILE (status=2 with non-empty issued_certificates)
- `Parquet(raw)` — EVENT_ENROLMENT_PARQUET_FILE (via userDFUtil.appendEventDurationCompletionForEachUser)
- `Parquet(raw)` — USER_EXTENDED_PROFILE (contexttype=orgAdditionalProperties, org custom fields)

**Joins (14):**
- LEFT (broadcast) · first-level hierarchy rows ⋈ esFinalAssessment on first_level_child_identifier=identifier — fallback child duration (expectedDuration) for Comprehensive Assessment Program / Curated Program children with null duration
- LEFT · per-root aggregates ⋈ first-level selected-duration sums on (root_content_id, courseCategory)
- LEFT (broadcast) · Learning Pathway preliminary assessment id ⋈ esFinalAssessment on identifier — preliminary assessment expectedDuration
- OUTER · Learning Pathway milestone durations ⋈ preliminary-assessment durations on root_content_id
- LEFT · root aggregates ⋈ Blended Program course-unit (second-level) durations on root_content_id
- LEFT · + Blended Program offline batch session durations on root_content_id
- LEFT · + Learning Pathway durations on root_content_id — produces content_duration_df (content_id, courseDuration, category)
- LEFT · external enrolments ⋈ external content on content_id — per-user external duration
- LEFT · enrolment ⋈ content_duration_df on content_id (userDFUtil.appendContentDurationCompletionForEachUser)
- LEFT · user master ⋈ per-user enrolment aggregates on userID (same helper)
- LEFT · + external duration on userID
- LEFT · + event aggregates on userID (userDFUtil.appendEventDurationCompletionForEachUser)
- LEFT · warehouse frame ⋈ badge counts on user_id
- LEFT · per-org user slice ⋈ pivoted custom fields on userID (only orgs with custom fields)

**Processing:**
- SparkSession built at module import time (same pattern as gamificationJob.py)
- Enrolments now come from ENROLMENT_COMPUTED (platform only); user_consumption_status = not-enrolled/not-started/in-progress/completed from dbCompletionStatus NULL/0/1/else; rows are distinct()
- Content categories considered for duration: Course, Pre Enrolment Assessment, Moderated Course, Moderated Assessment, Invite-Only Assessment, Standalone Assessment, Multilingual Course, Blended Program, Comprehensive Assessment Program, Curated Program, Learning Pathway (new)
- courseDuration rules: Blended Program = sum of first-level children whose primaryCategory is not Course + sum of second-level child durations under first-level Course Unit children + offline batch session durations (batches[].batchAttributes.sessionDetails_v2 where sessionType=Offline; sessionDuration text like 'X hr Y min' parsed to seconds)
- Comprehensive Assessment Program / Curated Program = sum of first-level children whose primaryCategory is not Course (child filter widened from the earlier Course Assessment-only rule); a null child duration falls back to esFinalAssessment expectedDuration
- Learning Pathway = sum of milestones_v1[].assessmentDetail.duration + preliminary assessment expectedDuration from esFinalAssessment
- All other listed categories use parent_duration (max per root)
- try_build helper wraps the offline-session, milestone and preliminary-assessment builders: if a nested field is missing from the inferred hierarchy schema (AnalysisException) it substitutes an empty DataFrame so the job does not fail
- total_content_duration (hours, bround 2) = sum of courseDuration for completed enrolments with a certificateID, across all categories above (the helper's category == Course restriction was removed in userDFUtil)
- total_external_content_duration (hours) = sum of external content duration for completed (status=2) certificated marketplace enrolments
- Total_Learning_Hours = event hours + content hours + external hours, now rounded with bround(..., 2)
- Course_Enrolments / Course_Completions now count platform enrolments only, since ENROLMENT_COMPUTED replaced ENROLMENT_WAREHOUSE_COMPUTED
- Perf split (documented as fixing a 30-min to 3-hour regression): orgs with custom fields go through a per-org pivot path (up to 8 parallel workers); orgs without use bulk write_csv_per_mdo_id_duckdb
- Govt/Non-Govt split by exact VOLUNTEER match on designation or any role; orgs with both get an extra mdoid=<org>_non_govt folder
- Bug (possible): for Blended Program a first-level Course Unit's own duration is included in selected_child_duration (primaryCategory != Course) and its second-level children are also summed in course_unit_duration, which may double count if the unit duration already aggregates its children
- Minor: base_hierarchy_df and root_agg_df are unpersist()-ed at the end but never cached (harmless no-op)

**Writes:**
- **Report / CSV:** standalone-reports/user-report/<date>/mdoid=<org>[ _non_govt]/UserReport.csv (Govt and Non-Govt)
- **Warehouse / Postgres:** warehouse/user_detail (config.dwUserTable); warehouse/userCustomFields (user_id, mdo_id, attribute_name, attribute_value); warehouse/user_custom_report/<org>[_non_govt]_custom_report.parquet (per org with custom fields)

**Downstream:** user_detail is synced to Postgres by dataWarehouse.py and loaded to BigQuery by bq-scripts.sh; CSVs bundled by zipUpload.py. Hard dependency on contentDFUtil's CONTENT_HIERARCHY_FLATTENED_PARQUET_FILE (including its new parent_batches, parent_milestones_v1, parent_preliminary_assessment_id columns) and on the Stage-0 esFinalAssessment cache.

### Weekly Claps (engagement streak) — `jobs/stage-2/weeklyClaps.py`

**Purpose:** A streak mechanic: if a user's weekly time on the app crosses a threshold (cutoffTime, default 60 minutes), they earn a clap for the week. State is tracked in a rolling w1 to w4 window plus a running total_claps.

**Changed since 4.8.39.3:**
- 0eb7a56 (2026-09-18) weekly claps engagement is now fetched from Druid in batches of 200,000 rows with LIMIT/OFFSET pagination (_fetch_batched_offset), replacing a single query capped at limit=1000000. The single query could cut off results once more than 1M users were active in a week

**Reads (2):**
- `Parquet(raw)` — CLAPS_PARQUET_FILE (prior state, itself sourced from Postgres learner_stats via Stage 0)
- `Druid` — summary-events with dimensions_type='app', SUM(total_time_spent)/60 and session count per uid (UUID-shaped uids only) for the current IST week up to yesterday, now fetched in pages of 200,000 rows with LIMIT/OFFSET

**Joins (1):**
- FULL OUTER · existing claps ⋈ this-week engagement on userid — brand-new users still get a row

**Processing:**
- Batched Druid fetch (0eb7a56): _fetch_batched_offset adds LIMIT 200000 OFFSET n to the GROUP BY query and loops until a batch is short or empty, then unions the batches. An empty result gives an empty DataFrame with the expected schema
- w4 = this week's (timespent rounded to minutes, numberOfSessions), with nulls set to 0
- Mid-week: if w4 timespent >= cutoffTime and claps_updated_this_week is false, total_claps +1 and the flag is set
- Week-end rollover (yesterday is the week's last day and has not been processed yet): shift w2 to w1, w3 to w2, w4 to w3. total_claps resets to 0 if the finished week was below the cutoff (otherwise +1 if not already counted). Then reset the flag and w4, and stamp last_updated_on
- Null-safe defaults for new users; w1 to w4 are serialised to JSON strings before writing
- Bug: the LIMIT/OFFSET pages have no ORDER BY, so Druid does not guarantee the same row order across pages, and rows can be duplicated or missed between batches. Each batch is also counted twice (df.count() called twice)

**Writes:**
- **Warehouse / Postgres:** learner_stats (config.dwLearnerStatsTable) — Postgres app DB, overwrite+truncate. A closed read-modify-write loop: this job writes what Stage 0 reads again next run
- **Other:** Debug CSV /tmp/weeklyClaps{today} (coalesce 1, header)

**Downstream:** Feeds back into Stage 0's next-run cache (CLAPS_PARQUET_FILE). inappReview.py reads CLAPS_PARQUET_FILE for users updated today.

### Workflow Summarizer — `jobs/stage-2/workFlowSummarizer.py`

**Purpose:** A Python re-implementation of a Scala telemetry-session-
summarization model, referenced in config as `WFS_MODEL_CONFIG`. **Its
`main()` only exercises the algorithm against an empty test RDD in this
branch** — no real data source is wired up.

**Reads:** none in practice (`sc.parallelize([])`). **Joins:** 0.

**Processing:** The state-machine session reconstruction (idle-time/
session-break detection) is fully implemented as a library, just never
called with real data here. No Kafka dispatch happens despite config
declaring a sink.

**Writes:** none.

### Polars Per-Org CSV Export — `jobs/stage-2/polarsCSVExport.py`

**Purpose:** Standalone, Spark-free post-processing step that reads the plain parquet written by the Course, ACBP and CBA report jobs and splits each into one CSV per mdoid using Polars partition_by(), writing mdoid=<id>/<report>.csv folders. It replaces the in-job DuckDB per-org CSV export (dfexportutil.write_csv_per_mdo_id_duckdb) for those three report jobs only.

**Added since 4.8.39.3:**
- Added in 1041b38 (2026-09-30, Varsha Mahuli) 'optimisation phase - 1 updates and new org hierarchy bug fix', together with changes to courseReport.py, acbpReport.py and courseBasedAssessmentReport.py that replaced their DuckDB per-org CSV writes with plain parquet writes to temp/*-plain/{today}.

**Reads (3):**
- `Parquet(computed)` — {localReportDir}/temp/cba-report-plain/{today}/govt and .../non_govt (from courseBasedAssessmentReport.py)
- `Parquet(computed)` — {localReportDir}/temp/cbp-enrolment-report-plain/{today} and {localReportDir}/temp/cbp-summary-report-plain/{today} (from acbpReport.py)
- `Parquet(computed)` — {localReportDir}/temp/course-report-plain/{today} (from courseReport.py)

**Joins (1):**
- 0 - pure split of each parquet by mdoid, no joins

**Processing:**
- Report registry get_reports() lists 5 entries (CBA Govt, CBA Non-Govt, ACBP CBP Enrolment, ACBP CBP Summary, Course Report), all partitioned on mdoid with 16 writer threads; output paths and CSV filenames come from config (cbaReportPath/cbaReport, acbpMdoEnrolmentReportPath/cbpEnrolmentReport, acbpMdoSummaryReportPath/cbpSummaryReport, courseReportPath/courseReport).
- Reads {path}/*.parquet (glob, to skip Spark .crc files), does one partition_by(mdoid), then writes each group's CSV in a ThreadPoolExecutor.
- Each distinct output_dir is rm -rf'd once up front before any writes, so CBA govt and non-govt (which share one output dir, non-govt orgs suffixed _non_govt by the CBA job) do not wipe each other.
- Deletes the source plain parquet after a successful export unless --no-cleanup; --only <text> filters reports by name; reports whose parquet is missing are skipped with a message.
- {today} is datetime.now() at run time, so it must run on the same calendar day as the upstream Spark jobs or it will find no parquet (and will still have wiped today's output dirs).
- Output dirs are cleaned even for reports later skipped for missing parquet, so a run before the upstream job finishes deletes any existing CSVs for that day.
- Upstream job comments and log lines call it polars_csv_export.py, but the file in the repo is polarsCSVExport.py.

**Writes:**
- **Report / CSV:** {localReportDir}/{cbaReportPath}/{today}/mdoid=<id>/{cbaReport} (govt and _non_govt folders); {localReportDir}/{acbpMdoEnrolmentReportPath}/{today}/mdoid=<id>/{cbpEnrolmentReport}; {localReportDir}/{acbpMdoSummaryReportPath}/{today}/mdoid=<id>/{cbpSummaryReport}; {localReportDir}/{courseReportPath}/{today}/mdoid=<id>/{courseReport}
- **Other:** Deletes the temp/*-plain/{today} parquet directories after export

**Downstream:** Same consumers as the previous in-job CSVs from courseReport.py, acbpReport.py and courseBasedAssessmentReport.py (per-MDO report folders picked up by the report upload/packaging steps). Nothing in the repo invokes it; those three jobs only print 'Next step: run polars_csv_export.py'.

### Zip, Password & Upload — `jobs/stage-2/zipUpload.py`

**Purpose:** The terminal packaging step: gathers every report job's per-org
CSV output, generates one password-protected ZIP per org (shared across a
ministry), stores the passwords in Redis, and uploads everything to GCS.

**Reads:** `warehouse/org_hierarchy` (drives password grouping); the
filesystem tree of every report job's dated `mdoid=<org>` output folder,
per config's bundle lists.

**Joins:** 0 — Spark only reads `org_hierarchy`; the rest is filesystem/OS
work.

**Processing:** Password grouping priority: ministry > department >
individual org — orgs under the same ministry share one password.

**Writes:** password-protected `reports.zip` per org, uploaded to GCS;
Redis `CB_EXT_{mdoid}_password` → the password string (read by the
notification/portal layer).

> **Bug:** the disabled `createFullReport` branch references two undefined
> names (`password`, `part2_start`) — a `NameError` risk, currently inert
> only because that flag defaults `False` everywhere.

**Downstream:** the fan-in consumer of `userReport.py` and
`userEnrolment.py`'s CSV outputs, among others.

---

## Stage 2 — Looker Dashboards (ClickHouse)

Four scripts feed four Looker dashboards (MDO, Content, IGOT, AI CBP). Three more build
intermediate tables for them and aren't dashboards themselves. The ClickHouse bash script
runs last and loads all four dashboards' Parquet output into the ClickHouse warehouse
database. These jobs are documented from team notes; where a script's reads or joins
aren't known yet, that's stated.

### National Priority Mapping (MDO dashboard intermediate) — `dashboard_national_priority_mapping.py`

**Purpose:** Builds an intermediate table for the MDO dashboard. It is not a dashboard itself; its output is consumed by the MDO dashboard script.

**Reads:** not yet documented.

**Joins:** not yet documented.

**Processing:**
- Produces the national priority mapping used when building the MDO dashboard's per-user enrolment data

**Writes:**
- **Parquet:** Intermediate national priority mapping table

**Downstream:** Read by dashboard_user_enrolments_custom_updated.py (MDO dashboard).

### Org Hierarchy (MDO + IGOT dashboard intermediate) — `dashboard_l_org_hierarchy.py`

**Purpose:** Builds an intermediate org-hierarchy table shared by two dashboards. It is not a dashboard itself.

**Reads:** not yet documented.

**Joins:** not yet documented.

**Processing:**
- Produces the org hierarchy used to roll dashboard data up by organisation

**Writes:**
- **Parquet:** Intermediate org hierarchy table

**Downstream:** Read by dashboard_user_enrolments_custom_updated.py (MDO dashboard) and dashboard_myigot.py (IGOT dashboard).

### KCM (Content dashboard intermediate) — `dashboard_kcm.py`

**Purpose:** Builds an intermediate competency (KCM) table for the Content dashboard. It is not a dashboard itself.

**Reads:** not yet documented.

**Joins:** not yet documented.

**Processing:**
- Produces the competency mapping behind the Content dashboard's competency tags

**Writes:**
- **Parquet:** Intermediate KCM table

**Downstream:** Read by dashboard_content_custom.py (Content dashboard).

### MDO Dashboard — User Enrolments — `dashboard_user_enrolments_custom_updated.py`

**Purpose:** Feeds the MDO dashboard, which shows each user's enrolment, completion and assessment activity.

**Reads (2):**
- Intermediate: national priority mapping (dashboard_national_priority_mapping.py)
- Intermediate: org hierarchy (dashboard_l_org_hierarchy.py)

**Joins:** not yet documented.

**Processing:**
- Builds one row set per user covering enrolments, completions and assessment activity

**Writes:**
- **Parquet:** user_enrolments_custom

**Downstream:** Loaded into the ClickHouse warehouse database by the ClickHouse load script; powers the MDO dashboard.

### Content Dashboard — `dashboard_content_custom.py`

**Purpose:** Feeds the Content dashboard, which shows how each course or event performs using enrolments, completions, ratings, learning hours and competency tags.

**Reads (1):**
- Intermediate: KCM table (dashboard_kcm.py)

**Joins:** not yet documented.

**Processing:**
- Computes per course / event: enrolments, completions, ratings and learning hours
- Attaches competency tags from the KCM intermediate table

**Writes:**
- **Parquet:** content_custom

**Downstream:** Loaded into the ClickHouse warehouse database by the ClickHouse load script; powers the Content dashboard.

### IGOT Dashboard — My iGOT — `dashboard_myigot.py`

**Purpose:** Feeds the IGOT dashboard, which shows what content each user has been assigned through learning plans and how far they have progressed.

**Reads (1):**
- Intermediate: org hierarchy (dashboard_l_org_hierarchy.py)

**Joins:** not yet documented.

**Processing:**
- Lists content assigned to each user through learning plans
- Computes each user's progress against that assigned content

**Writes:**
- **Parquet:** myigot

**Downstream:** Loaded into the ClickHouse warehouse database by the ClickHouse load script; powers the IGOT dashboard.

### AI CBP Dashboard Fact Model — `AICBPDashboardFactModel`

**Purpose:** Feeds the AI CBP dashboard, which tracks the AI-assisted competency-based plan funnel along with learner coverage and competency gaps.

**Reads:** not yet documented.

**Joins:** not yet documented.

**Processing:**
- Tracks the funnel stages: role mappings generated → courses recommended → plans saved → sent for approval → created → published
- Computes learner coverage and competency gaps

**Writes:**
- **Parquet:** 7 parquet folders:; 1. Plan facts; 2. Funnel stage counts; 3. Recommended-course competency map; 4. Saved-course map; 5. Learner coverage map; 6. Org and department user summary; 7. Competency master list

**Downstream:** Loaded into the ClickHouse warehouse database by the ClickHouse load script; powers the AI CBP dashboard.

### ClickHouse Load (bash) — `ClickHouse bash script`

**Purpose:** Runs last among the dashboard jobs and loads the output of all four dashboard scripts into the ClickHouse warehouse database.

**Reads (4):**
- Parquet: user_enrolments_custom (MDO dashboard)
- Parquet: content_custom (Content dashboard)
- Parquet: myigot (IGOT dashboard)
- Parquet: the 7 AI CBP folders (AI CBP dashboard)

**Joins (1):**
- 0 — load only

**Processing:**
- Must run after the four dashboard scripts have finished writing their parquet output

**Writes:**
- **Other:** ClickHouse warehouse database tables for the MDO, Content, IGOT and AI CBP dashboards

**Downstream:** The Looker dashboards read from these ClickHouse tables.
