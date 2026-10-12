# CHS / cb-core-data — APIs & Interfaces

This pipeline exposes no REST API of its own — it's a batch job invoked by
`spark-submit`/`python jobs/main.py`, not a service. What it *does* have is a fixed set of
integration points: systems it reads from, systems it writes to, and one outbound REST call.
Grouped below by direction, in place of the usual endpoint table. Gateway prefixes don't
apply here since none of this traffic goes through the platform's API gateway.

## Inbound (the one REST call this pipeline makes)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | Framework/FRAC backend (`api_url_template`, host from `fracBackendHost` config) | Resolves org-hierarchy data consumed by `org_hierarchy.py` / `orgHierarchyAll.py`. |

## Data sources read (Stage 0 extract)

| System | Protocol | What's read |
|---|---|---|
| Cassandra | Spark Cassandra connector | User, enrolment, org, karma-points, leaderboard and event data (~20 of the ~29 Stage 0 reads) |
| Elasticsearch | Spark ES connector + manual REST scroll (`dfutil/utils/utils.py`) | Course/program/event catalog, course-completion survey submissions (5 queries: `compositesearch`/`fs-forms`) |
| Postgres (app `sunbird` schema) | JDBC | Org hierarchy (`org_hierarchy_v4`), learner engagement stats (`learner_stats`), marketplace content metadata (`cios_content_entity`) |
| MongoDB | Spark Mongo connector | Survey question/status responses, in configurable batch sizes |
| Druid | REST (`dfutil/utils/utils.py::druidDFOption`) | Used by `dsrComputation(Updated).py`, `ministryMetrics.py`, `npsUpgraded.py`, the survey report jobs, `weeklyClaps.py`, `dashboardSync.py` |

## Outbound writes (Stage 2 sinks)

| System | Protocol | Purpose |
|---|---|---|
| Postgres (`warehouse` schema) | JDBC, full truncate-and-reload | 12 core BI tables — `user_detail`, `content`, `content_resource`, `assessment_detail`, `bp_enrolments`, `cb_plan`, `org_hierarchy`, `kcm_content_mapping`, `kcm_dictionary`, `events`, `events_enrolment`, `user_enrolments`. Two independent implementations coexist (`dataWarehouse.py`, `dataWarehouseBash.sh`) — which is production-live is not determinable from the repo. |
| BigQuery | `bq`/`gsutil` CLI, full delete-and-reload | Mirrors the same 12 tables (project `<GCP_PROJECT>`, dataset `<BQ_DATASET>`); table names diverge for events data (`events`/`events_enrolment` vs. `event_details`/`event_enrolment_details`). |
| Redis (main + a separate "karma points" instance) | `redis` client via `dfutil/utils/redis.py` | 50+ live-dashboard keys, per-user profile snapshots (`user:{user_id}`), ZIP-bundle passwords for the notification/portal layer. |
| Cassandra | Spark Cassandra connector / direct writes | Leaderboards, karma-points ledger (append-only), notification feeds (in-app review nudges, NPS prompts). |
| Kafka | Spark Kafka sink | Declared for `workFlowSummarizer.py` (not functionally active — no live data source wired in this branch) and several side-output topics; peer-validation and gamification-notification flows use a Postgres outbox instead, despite class naming. |
| Google Cloud Storage | `google-cloud-storage` SDK / `gsutil` | Password-protected per-org report ZIPs; BigQuery staging files. |

## Verified request/response shapes

No JSON request/response payloads apply — every integration above is a bulk table/file
read-write, not a request/response API call, with the exception of the FRAC call above (whose
request/response shape was not traced in this analysis).
