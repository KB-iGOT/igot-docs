# Weekly Claps — Software Design Document (SDD)

## 1. Architectural Overview & Component Decomposition

The Weekly Claps subsystem consists of four decoupled layers:

1. **Telemetry Ingestion & Aggregation Layer**: Ingests heartbeat/session packets into Apache Kafka, streaming to Apache Druid into the `summary-events` datasource.
2. **Batch Computation & Business Rules Engine**: An Apache Spark / scheduled Python ETL job executing nightly to compute weekly thresholds and perform temporal column shifts.
3. **Operational Datastore Layer**: Apache Cassandra keyspace `sunbird` storing denormalized learner aggregates (`learner_stats`) and user interaction feeds (`feed`).
4. **Presentation & Interaction Layer**: Angular-based learner dashboard consuming user stats via backend service endpoints, rendering streak metrics, tooltips, and deep navigation.

## 2. Database & Data Store Schemas

### 2.1 Cassandra Primary Store: `sunbird.learner_stats`

Stores the rolling 4-week engagement stats and total streak counts for every learner.

```sql
CREATE TABLE sunbird.learner_stats (
    userid text PRIMARY KEY,
    claps_updated_this_week boolean,
    last_updated_on text,
    total_claps int,
    w1 map<text, float>,
    w2 map<text, float>,
    w3 map<text, float>,
    w4 map<text, float>
);
```

#### Field Data Dictionary:

- `userid` (*text*): Unique UUID of the authenticated learner (Partition Key).
- `total_claps` (*int*): Cumulative consecutive weeks meeting the cutoff. Resets to 0 upon missing a week.
- `claps_updated_this_week` (*boolean*): Indicates whether the 60-minute threshold was fulfilled during the ongoing week cycle.
- `last_updated_on` (*text*): Timestamp (ISO-8601 string) of the most recent job update.
- `w1`, `w2`, `w3`, `w4` (*map<text, float>*): Chronological weekly records:
  - `w4`: Current/most recent week.
  - `w3`: Previous week (1 week ago).
  - `w2`: 2 weeks ago.
  - `w1`: 3 weeks ago (oldest week in the 4-week window).
  - Map Keys:
    - `"timespent"`: Total active engagement in minutes (`float`).
    - `"numberOfSessions"`: Total discrete application sessions recorded (`float`).

### 2.2 Druid Source Data Model: `summary-events`

Analytical datasource storing session summaries aggregated from raw telemetry.

**Aggregation Query**:

```sql
SELECT
    uid AS userid,
    SUM(total_time_spent) / 60.0 AS platformEngagementTime,
    COUNT(*) AS sessionCount
FROM "summary-events"
WHERE dimensions_type = 'app'
  AND __time >= TIMESTAMP '${weekStart}'
  AND __time < TIMESTAMP '${weekEnd}'
  AND uid IS NOT NULL
GROUP BY 1;
```

- `${weekStart}`: Monday 00:00:00 (e.g., `2026-10-19 00:00:00`).
- `${weekEnd}`: Sunday 23:59:59 (e.g., `2026-10-25 23:59:59`).

### 2.3 Cassandra Feed Store: `sunbird.feed`

Used by the downstream in-app review triggering system.

```sql
CREATE TABLE sunbird.feed (
    userid text,
    id text,
    action text,
    category text,
    createdby text,
    createdon timestamp,
    expireon timestamp,
    priority int,
    status text,
    updatedby text,
    updatedon timestamp,
    version text,
    PRIMARY KEY (userid, id)
);
```

#### In-App Review Record Structure:

```json
{
  "userid": "<user-uuid>",
  "id": "<generated-uuid>",
  "category": "InAppReview",
  "createdby": "weekly_claps",
  "createdon": "2026-10-26T01:00:00.000Z",
  "priority": 1,
  "status": "unread",
  "action": "{}",
  "version": "v1"
}
```

## 3. Algorithm & Batch Logic

### 3.1 Weekly Shifting Logic (Sunday Midnight Transition)

At the boundary of a new week (Sunday 23:59:59 -> Monday 00:00:00), the historical window shifts forward by one week:

```python
# Shifting Spark / DataFrame columns
shifted_df = current_learner_stats.select(
    col("userid"),
    col("w2").alias("w1"),   # Week -2 shifts to Week -3
    col("w3").alias("w2"),   # Week -1 shifts to Week -2
    col("w4").alias("w3"),   # Previous current week shifts to Week -1
    lit(None).alias("w4")    # Initialized empty for the new week
)
```

### 3.2 Daily Engagement & Streak Update Algorithm

```python
CUTOFF_MINUTES = 60.0

def process_daily_claps(user_stats, current_week_engagement):
    time_spent = current_week_engagement.get("platformEngagementTime", 0.0)
    sessions = current_week_engagement.get("sessionCount", 0)

    # Update current week (w4) metrics
    user_stats["w4"] = {
        "timespent": float(time_spent),
        "numberOfSessions": float(sessions)
    }

    # Check if threshold met in the current week
    if time_spent >= CUTOFF_MINUTES:
        if not user_stats.get("claps_updated_this_week", False):
            user_stats["total_claps"] = user_stats.get("total_claps", 0) + 1
            user_stats["claps_updated_this_week"] = True
    else:
        user_stats["claps_updated_this_week"] = False

    return user_stats

def process_week_end_reset(user_stats):
    # Evaluated at Sunday 23:59:59
    # If the user completed the week without reaching 60 minutes, reset streak
    w4_time = user_stats.get("w4", {}).get("timespent", 0.0)
    if w4_time < CUTOFF_MINUTES:
        user_stats["total_claps"] = 0

    # Reset flag for upcoming week
    user_stats["claps_updated_this_week"] = False
    return user_stats
```

## 4. Operational Support, Auditing & Troubleshooting (SOP)

When learners report discrepancies in their claps counter or weekly ticks, the IT Support / KBNOC teams execute the following standard operating procedure:

1. **Step 1: Inquire Telemetry (Analytical Ground Truth)**<br>Run the Druid SQL query for the requested `userid` and week range:
  ```sql
  SELECT
      uid AS userid,
      SUM(total_time_spent) / 60.0 AS platformEngagementTime,
      COUNT(*) AS sessionCount
  FROM "summary-events"
  WHERE dimensions_type = 'app'
    AND __time >= TIMESTAMP '2026-10-19 00:00:00'
    AND __time <= TIMESTAMP '2026-10-25 23:59:59'
    AND uid = '<target_user_id>'
  GROUP BY 1;
  ```
2. **Step 2: Inspect Operational Record in Cassandra**<br>Query the Cassandra datastore:
  ```sql
  SELECT
      userid,
      total_claps,
      claps_updated_this_week,
      w1,
      w2,
      w3,
      w4
  FROM sunbird.learner_stats
  WHERE userid = '<target_user_id>';
  ```
3. **Step 3: Discrepancy Reconciliation**
  - If `platformEngagementTime` in Druid but `w4['timespent']` in Cassandra does not match or `claps_updated_this_week` is `false`, escalate to **Data Engineering** to investigate batch pipeline delays.
  - If Druid reflects , clarify the platform engagement rules with the user.

## 5. Requirements Traceability Matrix (RTM)

| Requirement ID | Jira Ticket | Functional Spec | Design / Code Component | Verification Method |
|---|---|---|---|---|
| **FR-WC-01** (Week Window) | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) | KY_FRS_LEA_LH Sec 2.1 | Batch Job Temporal Window (`Monday 00:00 to Sunday 23:59`) | Unit & ETL Schedule Test |
| **FR-WC-02** (60-min Cutoff) | [KB-384: Q2 \| Activity sidebar](https://karmayogibharat.atlassian.net/browse/KB-384)[\| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) | KY_FRS_LEA_LH LEA-LH-BR6-FR2 | `CUTOFF_MINUTES =` `60.0` configuration | Automated Integration Test |
| **FR-WC-04** (4-Week Rolling UI) | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) | KY_FRS_LEA_LH Sec 2.1 | `sunbird.learner_stats` (`w1..w4` columns) & UI component | Frontend UI Automated Tests |
| **FR-WC-05** (Streak Increment) | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) | KY_BRD_LEA_LH Scope 3 | `total_claps = total_claps + 1` | Spark Batch Regression Suite |
| **FR-WC-06** (Streak Reset) | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) | KY_FRS_LEA_LH Sec 2.1 | `process_week_end_reset` (`total_claps = 0`) | End-of-week Simulation Tests |
| **FR-WC-09** (Auto-Scroll Nav) | [KB-7862: Q7 \| Ad-Hoc \| Landing Page UI Update \| Learner Portal](https://karmayogibharat.atlassian.net/browse/KB-7862)[KB Approved](https://karmayogibharat.atlassian.net/browse/KB-7862), [KB-7900: Q7 \| Ad-Hoc \| Landing Page UI Fixes \| Learner Portal](https://karmayogibharat.atlassian.net/browse/KB-7900)[QA Deployed](https://karmayogibharat.atlassian.net/browse/KB-7900), [KB-8973: Q7 \| Ad-Hoc \| Landing Page UI Fixes \| Mobile APP](https://karmayogibharat.atlassian.net/browse/KB-8973)[Open](https://karmayogibharat.atlassian.net/browse/KB-8973) | FRS Updates | Angular Profile Card Click Handler & Viewport Scroll | End-to-End Cypress / Appium |
| **FR-WC-11** (In-App Review Feed) | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) | Confluence Page 55312431 | Spark Feed Generator -> `sunbird.feed` | Integration Job Execution Test |
| **FR-WC-12** (Telemetry Events) | [KB-4569: Q4 \| Ad-Hoc Requests \| Telemetry enhancements \| Telemetry Impression implementation for Weekly Clap pop-up and Platform Rating pop-up.](https://karmayogibharat.atlassian.net/browse/KB-4569)[In-Progress](https://karmayogibharat.atlassian.net/browse/KB-4569) | FRS Telemetry Spec | Frontend Telemetry Dispatcher (`IMPRESSION`) | Telemetry Pipeline Validation |
| **FR-WC-13** (Data Egestion) | [KB-2973: Q3 \| Ad-Hoc Requests \| Weekly Claps \| Data request for users and their Weekly Claps.](https://karmayogibharat.atlassian.net/browse/KB-2973)[In-Progress](https://karmayogibharat.atlassian.net/browse/KB-2973) | Analytics Spec | Egestion Query Script (User streak distributions) | Data Warehouse Export Check |
