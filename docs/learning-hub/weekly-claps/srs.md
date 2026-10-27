# Weekly Claps — Software Requirements Specification (SRS)

## 1. Introduction & Objectives

### 1.1 Purpose

The purpose of this SRS is to formally specify the business logic, functional criteria, system constraints, and integration boundaries for the **Weekly Claps (Engagement Streak)** module on the iGOT Karmayogi platform.

### 1.2 Scope

- **Engagement Tracking**: Capture user active app/portal engagement time per calendar week.
- **Streak Computation**: Calculate consecutive weeks of active engagement (streak count).
- **Visualization**: Display a 4-week rolling indicator (W1–W4 ticks/crosses) and a cumulative streak counter on learner dashboards across Web, M-Web, and Mobile Apps.
- **Downstream Integration**: Trigger in-app feedback/NPS prompts and telemetry events based on earned streaks.

## 2. Functional Requirements

### 2.1 Core Rules & Engagement Logic

| ID | Title | Requirement Description | Priority | Source Traceability |
|---|---|---|---|---|
| **FR-WC-01** | **Week Boundary Definition** | A tracking week shall strictly span from **Monday 00:00:00 to Sunday 23:59:59** (Indian Standard Time / Platform Timezone). | Critical | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384), [Weekly Claps - Data](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/15499739/Weekly+Claps+-+Data) |
| **FR-WC-02** | **Engagement Cutoff Threshold** | The minimum platform engagement required to qualify for a Weekly Clap is **60 minutes (3600 seconds)** in a given tracking week. This threshold must be configurable via system parameters without code re-deployment. | Critical | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384), [KY_FRS_LEA_LH_Learner_Home_page](https://karmayogibharat.atlassian.net/wiki/spaces/TPT/pages/6194373/KY_FRS_LEA_LH_Learner_Home_page) |
| **FR-WC-03** | **Batch Evaluation Execution** | An automated batch job shall execute once daily (nightly) to aggregate engagement time for active users from the start of the current week to the execution timestamp. | High | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384), [Weekly Claps - Data](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/15499739/Weekly+Claps+-+Data) |
| **FR-WC-04** | **Rolling 4-Week Display** | The UI shall display active status across the **last 4 calendar weeks** (W1, W2, W3, W4). If engagement in a week is , display a completed tick/green badge; otherwise, display an incomplete indicator/cross. | High | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384), [KY_FRS_LEA_LH_Learner_Home_page](https://karmayogibharat.atlassian.net/wiki/spaces/TPT/pages/6194373/KY_FRS_LEA_LH_Learner_Home_page) |
| **FR-WC-05** | **Streak Counter Incrementation** | If a learner achieves in consecutive weeks, the total claps counter (`total_claps`) increments by 1 for each successful week. | Critical | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) |
| **FR-WC-06** | **Streak Reset Rule** | If an active learner fails to meet the 60-minute cutoff in any week, their cumulative `total_claps` streak resets to **0**. Upon meeting the criteria in any subsequent week, the streak restarts at **1**. (Historical ticks for past completed weeks in W1–W4 remain preserved). | Critical | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) |
| **FR-WC-07** | **New User Initialization** | For first-time or newly registered learners, `total_claps` shall initialize to **0**, and all rolling weeks shall indicate unfulfilled status until qualifying activity occurs. | Medium | [KB-384: Q2 \| Activity sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) |
| **FR-WC-08** | **Info Tooltip /** **Modal** | The UI component shall feature an Information icon (`(i)`) that displays an explanatory modal describing weekly rules, the 60-minute cutoff, and streak mechanics. | Medium | [KB-384: Q2 \| Activity](https://karmayogibharat.atlassian.net/browse/KB-384)[sidebar \| Weekly Claps/Engagement streak](https://karmayogibharat.atlassian.net/browse/KB-384)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-384) |

### 2.2 Navigation, Layout & Telemetry Requirements

| ID | Title | Requirement Description | Priority | Source Traceability |
|---|---|---|---|---|
| **FR-WC-09** | **Profile Card Auto-Scroll Linking** | Clicking the "Weekly Claps" metric within the User Profile card (left sidebar) shall trigger smooth auto-scrolling directly to the Weekly Claps widget. | High | [KB-7862: Q7 \| Ad-Hoc \| Landing Page UI Update \| Learner Portal](https://karmayogibharat.atlassian.net/browse/KB-7862)[KB Approved](https://karmayogibharat.atlassian.net/browse/KB-7862), [KB-7900: Q7 \| Ad-Hoc \| Landing Page UI Fixes \| Learner Portal](https://karmayogibharat.atlassian.net/browse/KB-7900)[QA Deployed](https://karmayogibharat.atlassian.net/browse/KB-7900), [KB-8973: Q7 \| Ad-Hoc \| Landing Page UI Fixes \| Mobile APP](https://karmayogibharat.atlassian.net/browse/KB-8973)[Open](https://karmayogibharat.atlassian.net/browse/KB-8973) |
| **FR-WC-10** | **Collapsible Activities Section** | On web and mobile layouts, the "Show My Activities" container housing Weekly Claps shall support expanding and collapsing, defaulting to the expanded state. | Medium | [KB-7862: Q7 \| Ad-Hoc \| Landing Page UI Update \| Learner Portal](https://karmayogibharat.atlassian.net/browse/KB-7862)[KB Approved](https://karmayogibharat.atlassian.net/browse/KB-7862) |
| **FR-WC-11** | **Downstream Feed Trigger** | Upon successful completion of a weekly clap, a downstream process shall generate an `InAppReview` feed notification in the learner's feed store to solicit app reviews or NPS ratings. | High | [In-app Review Trigger based on weekly claps](https://karmayogibharat.atlassian.net/wiki/spaces/~5e9d528aeb50310c17bf543e/pages/55312431/In-app+Review+Trigger+based+on+weekly+claps) |
| **FR-WC-12** | **Telemetry Tracking** | The system shall emit telemetry impression events (`IMPRESSION`, `INTERACT`) when the Weekly Clap widget or related rating modals are rendered and accessed. | Medium | [KB-4569: Q4 \| Ad-Hoc Requests \| Telemetry enhancements \| Telemetry Impression implementation for Weekly Clap pop-up and Platform Rating](https://karmayogibharat.atlassian.net/browse/KB-4569)[pop-up.](https://karmayogibharat.atlassian.net/browse/KB-4569)[In-Progress](https://karmayogibharat.atlassian.net/browse/KB-4569) |
| **FR-WC-13** | **Streak Distribution Egestion** | The backend shall support batch extraction of user streak distributions (users with streaks of 2, 3, 4, ... 10, and >10 weeks) for data analytics. | Medium | [KB-2973: Q3 \| Ad-Hoc Requests \| Weekly Claps \| Data request for users and their Weekly Claps.](https://karmayogibharat.atlassian.net/browse/KB-2973)[In-Progress](https://karmayogibharat.atlassian.net/browse/KB-2973) |

## 3. Non-Functional Requirements (NFR)

- **NFR-01 (Scalability)**: The batch computation pipeline must process active telemetry events for over 3+ million civil servant profiles within a nightly execution window of .
- **NFR-02 (Low UI Latency)**: User statistics (`learner_stats`) queries on page load must return in under (p95) by utilizing Cassandra primary key lookups (`userid`).
- **NFR-03 (Fault Tolerance & Idempotency)**: Re-running the nightly aggregation job for the same week interval must yield identical results without duplicating counts or inflating streak values.
- **NFR-04 (Data Consistency)**: Engagement minutes aggregated in the analytical layer (Druid) must reconcile with values persisted in Cassandra within tolerance.
