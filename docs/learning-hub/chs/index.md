# CHS — Analytics & Warehouse Pipeline

- **Repository**: `<ORG>/cb-core-data`, branch `cbrelease-4.8.40`
- **Who it's for**: no Karmayogi ever opens this directly — it runs unattended and shapes what four other groups see

## What it is

`cb-core-data` is a nightly batch pipeline, not a page or a button. It pulls a snapshot of
everything Cassandra, Elasticsearch, the app database, MongoDB and Druid know about users,
content and enrolments, joins it into a handful of reusable tables, and then runs a catalog
of ~46 independent jobs against those tables. Each job produces exactly one of: a per-org
compliance report, a row in the BI warehouse, a live-dashboard cache entry, or a direct write
to Cassandra/Redis/Kafka for another system to pick up.

**How the four groups that touch its output experience it:**

| Who | What they see |
|---|---|
| **MDO administrator** | Downloads a password-protected, per-org ZIP of compliance/enrolment CSV reports from cloud storage; the password is retrieved through the notification/portal layer, not embedded in the file. |
| **BI/Looker consumer** | Queries a Postgres/BigQuery warehouse of 12 core tables that this pipeline rebuilds from scratch on every run. |
| **Platform dashboard (live UI)** | Reads 50+ Redis keys this pipeline writes directly — karma points, leaderboards, campaign tickers — which is what makes the dashboard feel real-time even though the Postgres/BigQuery side is a nightly batch. |
| **Learner** | Never sees this repository, but every karma point, badge, leaderboard rank, weekly-streak ("claps") count, and org-level compliance number they or their MDO sees was computed here. |

**The one thing worth knowing about how it works:** every warehouse write is a full
truncate-and-reload, on every run — there is no incremental or upsert path anywhere in the
pipeline. That's simple to reason about (no partial-update bugs) but means a table is
genuinely empty for the duration of a failed or slow sync, not stale-but-present.

See [Use Cases](use-cases.md), [APIs & Interfaces](apis.md), [HLD](hld.md), [LLD](lld.md) and
the [Operations Manual](operations-manual.md) for the detail behind each of these.
