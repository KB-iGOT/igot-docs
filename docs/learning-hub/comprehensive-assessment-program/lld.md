# Comprehensive Assessment — Low-Level Design (LLD)

**Comprehensive Assessment (CA) & APAR Integration**

## 1. Feature-to-Task Architectural Flow Map

**FEATURE TO IMPLEMENTATION TASK MAP**

- **ADMIN CREATION FLOWS (Flow 1 & Flow 2)**
    - KB-13866 / BRD-1031307285: User Group (AND-of-OR) Targeting Engine
    - KB-11524 / KB-13077: Selective CA Course Mapping & Live Plan Staging (draftData)
    - KB-12934: Retake Limit Bounding (9 to 19 attempts)
    - KB-15357: AI Assessment Context Metadata (Sector & Target Audience)
    - cbrelease-4.8.41: Transactional ES Pre-Commit & Event-Driven CA Linkage (Kafka)
- **LEARNER DISCOVERY & CONSUMPTION FLOWS (Flow 3 & Flow 4)**
    - KB-10684 / KB-13086: My iGOT Dictionary, 2-Tier Redis Cache & Course CA Tile Badges
    - KB-8065 / KB-8066: Scheduled Window & Prerequisite 50% Course Completion Gating
    - KB-12764: Server-Side 50% Pass Threshold & Certificate Issuance Blocker
    - KB-13093 / KB-13449: Post-Attempt Item-Level Result Review Screen (Web & Flutter)
    - KB-13402: Persistent Failure Retake Prompt Modal Interceptor
    - KB-15848 / Tech Design: Never-Decrease Best-Score Merge & TOC Read-Path Bypass
- **STATUTORY REPORTING & APAR FLOW (Flow 5)**
    - KB-10681 / KB-10686: SPARROW Tables 11A/B & 12A/B REST Integration (/api/apar/v2/*)
    - KB-12923 / KB-13111: BigQuery Real-Time Compliance Analytics ETL
    - BRD-1031307285: Automated Diagnostic Error Code Attribution

## 2. Flow Diagram 1: Administrative Creation & Targeting Plane

### Covers: `KB-13866` (User Groups), `KB-11524` (Course CA Flags), `KB-12934` (Retakes), `KB-13077` (Staging), and `cbrelease-4.8.41` (Transactional ES)

```mermaid
flowchart TD
    subgraph UI_Admin["MDO / CCA Admin Web Portal (Angular)"]
        A1["1. Navigate to User Groups<br/>Define Criteria (Cadre, Batch, Desig, Deputation)"]
        A2["3. Create APAR Training Plan<br/>Select Courses, Toggle Mandatory/CA Flags<br/>Set Retakes (9-19) & EndDate"]
        A3["5. Edit Active Live Plan<br/>Update Metadata / Add Courses"]
        A4["7. Click 'Publish Plan'"]
    end
    subgraph Course_Svc["cb-ext-course-service (Spring Boot / Play)"]
        B1["UserGroupController<br/>POST /usergroup/v1/create"]
        B2["Validate Org Scoping<br/>& Name Uniqueness"]
        B3["CbPlanV4Controller<br/>POST /cbplan/v4/create"]
        B4["Validate Retake Range<br/>(min: 9, max: 19)"]
        B5["Execute ES Pre-Commit Index<br/>cb_plan_v2"]
        B6{"ES Pre-Commit<br/>Successful?"}
        B7["Insert Cassandra Plan<br/>status='draft'"]
        B8["Rollback ES & Throw 500<br/>ERR_ES_TIMEOUT"]
        B9["CbPlanV4Controller<br/>POST /cbplan/v4/update"]
        B10["Stage Edits into 'draftdata'<br/>Live plan untouched"]
        B11["CbPlanV4Controller<br/>POST /cbplan/v4/publish"]
        B12["Flush draftdata to Production<br/>Set status='Live'"]
        B13["Evict Org Redis Cache<br/>cbplan:v4:userlookup:orgId:*"]
    end
    subgraph Storage_Creation["Data Tier (Cassandra & Elasticsearch)"]
        C1[("Cassandra<br/>user_group_info")]
        C2[("Elasticsearch<br/>usergroup index")]
        C3[("Elasticsearch<br/>cb_plan_v2 index")]
        C4[("Cassandra<br/>cb_plan_v3")]
        C5[("Redis Cluster<br/>Dictionary Namespace")]
    end
    A1 -->|POST payload| B1
    B1 --> B2
    B2 -->|INSERT usergroupid UUID| C1
    B2 -->|INDEX Document| C2
    A2 -->|POST payload| B3
    B3 --> B4
    B4 --> B5
    B5 --> C3
    C3 --> B6
    B6 -->|"Yes"| B7
    B7 -->|INSERT Row| C4
    B6 -->|"No"| B8
    A3 -->|POST updates| B9
    B9 --> B10
    B10 -->|UPDATE draftdata| C4
    A4 -->|POST /publish| B11
    B11 --> B12
    B12 -->|UPDATE status='Live'| C4
    B12 --> B13
    B13 -->|DEL Keys| C5
```

## 3. Flow Diagram 2: Content Authoring & Event-Driven CA Linkage

### Covers: `KB-8065` (CAP Program Content), `KB-15357` (AI Metadata), and `cbrelease-4.8.41` (Kafka Consumer)

```mermaid
flowchart TD
    subgraph Creator_Studio["Content Creator Studio / AI Assessment Tool"]
        D1["Author Comprehensive Assessment<br/>Input: Questions (MCQ/SCQ), Pass Mark=50%"]
        D2["KB-15357: Inject Context Metadata<br/>Input: Sector & Target Audiences"]
        D3["Click 'Publish Assessment'"]
    end
    subgraph Content_Core["Content Service & Event Bus"]
        E1["Content Actor<br/>Transitions Assessment to 'Live'<br/>Assigns do_id"]
        E2["Kafka Producer<br/>Topic: cbplan.ca.link"]
    end
    subgraph Async_Worker["cb-ext-course-service (Worker Node)"]
        F1["CbPlanCaLinkConsumer<br/>Ingests Kafka Message<br/>{action: 'ADD', cbPlanId, caLinkedId}"]
        F2["Idempotent DB Updater"]
        F3["Elasticsearch Sync Worker"]
        F4["Redis Cache Eviction Interceptor"]
    end
    subgraph Storage_Linkage["Persistence Tier"]
        G1[("Cassandra<br/>sunbird.cb_plan_v3")]
        G2[("Elasticsearch<br/>cb_plan_v2")]
        G3[("Redis Cache<br/>cbplan:v4:userlookup:*")]
    end
    D1 --> D2
    D2 --> D3
    D3 --> E1
    E1 -->|Emit Event| E2
    E2 -->|Async Consume| F1
    F1 --> F2
    F2 -->|UPDATE calinkedid| G1
    F1 --> F3
    F3 -->|UPDATE doc.caLinkedId| G2
    F1 --> F4
    F4 -->|Invalidate Org Keys| G3
```

## 4. Flow Diagram 3: Runtime Discovery & Prerequisite Gating

### Covers: `KB-10684` (Learner Routing), `KB-13086` (Course CA Badge), `KB-8066` (Locking), and `KB-13866` (AND-of-OR Evaluation)

```mermaid
flowchart TD
    subgraph Learner_UI["Learner Dashboard / Mobile App (My iGOT Tab)"]
        H1["1. Officer Logs into Portal / App"]
        H2["2. Request 'My iGOT' Dashboard<br/>POST /cbplan/v4/user/dictionary"]
        H3["Render APAR Training Plan Card<br/>Badge Courses with 'APAR' & 'CA' pills<br/>Display CA Tile (Locked or Active)"]
        H4["4. Click 'Start Assessment'<br/>GET /assessment/eligibility/{doId}"]
        H5["Show Locked Modal Alert<br/>'Complete prerequisite courses (X of Y)'"]
        H6["Launch Assessment Player"]
    end
    subgraph Gateway["Kong API Gateway"]
        I1["Validate Bearer JWT<br/>Extract userId, rootOrgId"]
    end
    subgraph Course_Ext["cb-ext-course-service"]
        J1["UserDictionaryService<br/>Check L1 Redis Cache"]
        J2{"Redis Cache Hit?<br/>cbplan:v4:userlookup:*"}
        J3["Return Cached Dictionary (<50ms)"]
        J4["L2 Cassandra Fallback:<br/>Fetch Profile (Cadre, Batch, Deputation)"]
        J5{"Profile Fields<br/>Complete?"}
        J6["Emit DIAGNOSTIC:<br/>PROFILE_INCOMPLETE<br/>Return Empty Plan"]
        J7["Fetch Candidate Plans & User Groups"]
        J8["AccessRuleEvaluator<br/>Run AND-of-OR Algorithm"]
        J9["Set Redis Cache (TTL: 3600s)<br/>Return Evaluated Dictionary"]
        J10["AssessmentEligibilityController<br/>Check Prerequisite Courses"]
        J11{"Mandatory Courses<br/>>= 50% Completed?"}
        J12{"Window Open?<br/>startDate <= Now <= endDate"}
    end
    subgraph Data_Discovery["Storage Tier"]
        K1[("Redis Cluster")]
        K2[("Cassandra: user & profile")]
        K3[("Cassandra: cb_plan_v3 & user_group_info")]
        K4[("Cassandra: user_content_consumption_v2")]
    end
    H1 --> H2
    H2 --> I1
    I1 --> J1
    J1 --> K1
    K1 --> J2
    J2 -->|"Yes"| J3
    J3 --> H3
    J2 -->|"No"| J4
    J4 --> K2
    K2 --> J5
    J5 -->|"No"| J6
    J6 --> H3
    J5 -->|"Yes"| J7
    J7 --> K3
    K3 --> J8
    J8 --> J9
    J9 --> K1
    J9 --> H3
    H3 --> H4
    H4 --> J10
    J10 --> K4
    K4 --> J11
    J11 -->|"No"| H5
    J11 -->|"Yes"| J12
    J12 -->|"No"| H5
    J12 -->|"Yes"| H6
```

## 5. Flow Diagram 4: Assessment Attempt, Best-Score Merge & Feedback

### Covers: `KB-12764` (Pass Threshold), `KB-13093` / `KB-13449` (Result Screens), `KB-13402` (Retake Pop-up), `KB-15848` (Best Score), and `Tech Design 1355612176`

```mermaid
flowchart TD
    subgraph Asmt_Player["Assessment Player (Web Angular / Mobile Flutter)"]
        L1["Officer Submits Answers<br/>POST /v1/assessment/submit"]
        L2["Display Result Screen (KB-13093)<br/>Show Overall Pass/Fail, Percentage Score,<br/>Item marks (Correct/Incorrect - keys hidden)"]
        L3["Trigger Failure Modal (KB-13402)<br/>Options: 'Re-attempt Now' or 'Remind Later'"]
        L4["Navigate to Table of Contents (TOC) Page<br/>GET Course TOC Data"]
        L5["Render Prominently on TOC:<br/>'Your Best Score: 80%'<br/>'Passing Mark: 50%' | Attempts Remaining: N"]
    end
    subgraph Asmt_Service["cb-ext-assessment-service"]
        M1["AssessmentExecutionController<br/>Idempotency Check via submissionId"]
        M2["EvaluationService<br/>Evaluate answers against Server Keys<br/>Calculate Score Percentage"]
        M3["Audit Log to user_assessment_data_v2"]
        M4["Unconditional Call to Course Service<br/>POST /v1/content/state/update<br/>Payload: {userId, contentId, score, status}"]
        M5{"Score >= 50%<br/>Threshold Gate?"}
        M6["Trigger cert-service<br/>Generate / Update CAP Certificate"]
        M7["Block Certificate Generation<br/>Set Flag: Retake Required"]
    end
    subgraph Core_Course["sunbird-course-service (Core Actor)"]
        N1["ContentStateUpdateActor<br/>Read user_content_consumption_v2"]
        N2["BestScoreMergeEngine<br/>Extract progressDetails: {current, best}"]
        N3["Compute Never-Decrease Formula:<br/>new_current = incoming_score<br/>new_best = MAX(existing_best, incoming_score)"]
        N4["Write Merged JSON back to Cassandra<br/>user_content_consumption_v2.progressdetails"]
        N5["CourseEnrollmentActor (KB-15848 Patch)<br/>Check: Is Content 'ComprehensiveAssessmentProgram'?"]
        N6{"Is CA Content?"}
        N7["Bypass Completed-Course Skip Optimization!<br/>Unconditionally read progressdetails"]
        N8["Use Cached Enrollment Record"]
    end
    subgraph Data_Consumption["Data Stores"]
        O1[("Cassandra<br/>user_assessment_data_v2")]
        O2[("Cassandra<br/>user_content_consumption_v2")]
    end
    L1 --> M1
    M1 --> M2
    M2 --> M3
    M3 --> O1
    M2 --> M4
    M4 --> N1
    N1 --> O2
    O2 --> N2
    N2 --> N3
    N3 --> N4
    N4 --> O2
    N4 --> M5
    M5 -->|"Yes"| M6
    M5 -->|"No"| M7
    M6 --> L2
    M7 --> L2
    L2 -->|If Failed| L3
    L4 --> N5
    N5 --> N6
    N6 -->|"Yes"| N7
    N7 --> O2
    O2 --> L5
    N6 -->|"No"| N8
```

## 6. Flow Diagram 5: Nightly Batch Aggregation & Statutory APAR Sync

### Covers: `KB-10681` (APAR API), `KB-12923` / `KB-13111` (BigQuery ETL), and `BRD-1031307285` (Diagnostics & SPARROW Tables 11 & 12)

```mermaid
flowchart TD
    subgraph Scheduled_Batch["Nightly Consolidation Engine (Cron Job)"]
        P1["Trigger Execution at 09:30 AM IST<br/>DailySnapshotJob.executeConsolidation()"]
        P2["Scan Cassandra user_content_consumption_v2<br/>Fetch completions over last 24 hours"]
        P3["Compile Officer Annual Metrics:<br/>- Prescribed vs Completed Mandatory Courses<br/>- 50% Quota Satisfied (true/false)<br/>- CA Attempt Status & Highest/Best Score"]
        P4["Diagnostic Code Decision Tree"]
        P5{"Evaluate Diagnostic State"}
        P6["Code: OK"]
        P7["Code: NO_APAR_PLAN"]
        P8["Code: PROFILE_INCOMPLETE"]
        P9["Code: CA_WINDOW_CLOSED"]
        P10["Code: IDENTIFIER_MISMATCH"]
        P11["Batch Insert into Snapshot Store<br/>sunbird.apar_officer_annual_summary"]
        P12["Export Daily Diff to Google BigQuery<br/>(Execution at 11:00 AM IST)"]
    end
    subgraph External_APAR["External Statutory Systems (10:00 AM IST Sync)"]
        Q1["NIC SPARROW Gateway / e-HRMS<br/>GET /api/apar/v2/status?eHrmsId=10928391"]
        Q2["APAR REST API Gateway<br/>Reads apar_officer_annual_summary"]
        Q3["Auto-populate SPARROW Appraisal Dossier<br/>(Fields Rendered Read-Only)"]
        Q4["Table 11A / 12A: Mandatory Courses<br/>Lists Course Names, Competencies, Dates"]
        Q5["Table 11B / 12B: Comprehensive Assessment<br/>Displays: Applicable, Status (Passed), Best Score, Date"]
        Q6["Render Diagnostic Warning Banner<br/>(e.g., 'Profile Incomplete in iGOT')"]
    end
    subgraph Data_APAR["Persistence & Warehousing"]
        R1[("Cassandra<br/>user_content_consumption_v2")]
        R2[("Cassandra<br/>apar_officer_annual_summary")]
        R3[("Google BigQuery<br/>Compliance Datasets")]
    end
    P1 --> P2
    P2 --> R1
    R1 --> P3
    P3 --> P4
    P4 --> P5
    P5 -->|Everything Valid| P6
    P5 -->|No matching plan| P7
    P5 -->|Missing Cadre/eHRMS| P8
    P5 -->|Deadline passed without pass| P9
    P5 -->|eHRMS not mapped to iGOT| P10
    P6 --> P11
    P7 --> P11
    P8 --> P11
    P9 --> P11
    P10 --> P11
    P11 --> R2
    P11 --> P12
    P12 --> R3
    Q1 --> Q2
    Q2 --> R2
    R2 --> Q3
    Q3 --> Q4
    Q3 --> Q5
    Q3 -->|If diagnostic != OK| Q6
```

## 7. Task-Level Cross-Reference Matrix

| Jira Task / Ticket | Flow Diagram Ref | Execution Subsystem | Core Technical Logic Implemented |
|---|---|---|---|
| `KB-8065` | **Flow 2** | Content Creation | Level-2 Comprehensive Assessment Program (CAP) content model and window dates. |
| `KB-8066` | **Flow 3** | Learner Dashboard | Prerequisite course locking logic; Scheduled Assessments portal UI. |
| `KB-10681` | **Flow 5** | Downstream Sync | Initial APAR reporting API `/report/org/enrolment/{orgId}` and SPARROW integration. |
| `KB-10684` | **Flow 3** | Discovery Engine | Profile-driven dual routing for Central Deputation vs Cadre Controlling Authority plans. |
| `KB-10686` | **Flow 1 & 5** | Master Initiative | CCA organizational privileges; end-to-end statutory SPARROW pipeline. |
| `KB-11524` | **Flow 1** | Training Plan Service | Selective CA flagging on individual courses; course deduplication with max date override. |
| `KB-12764` | **Flow 4** | Assessment Service | Server-side 50% pass threshold check blocking certificate generation on failure. |
| `KB-12923` | **Flow 5** | Analytics Pipeline | Scheduled ETL loading from Cassandra to Google BigQuery datasets. |
| `KB-12934` | **Flow 1** | Content Portal Form | Form field validation bounding configurable assessment retakes between 9 and 19. |
| `KB-13076` | **Flow 1** | Content Management | Operational fixes: org search, CSV question auto-trim, and question-type labeling. |
| `KB-13077` | **Flow 1** | Training Plan Service | Staging column `draftData` for live plan mutations; start-date locking for active CAs. |
| `KB-13086` | **Flow 3** | Learner Portal | Visual "APAR" and "Comprehensive Assessment" badges on course tiles and TOC headers. |
| `KB-13093` | **Flow 4** | Web Assessment Player | Post-assessment review screen displaying item-level correct/incorrect marks (answers hidden). |
| `KB-13111` | **Flow 5** | Analytics Pipeline | Data pipeline extracting learner highest scores to reporting pipelines and BigQuery. |
| `KB-13194` | **Flow 4** | Assessment Engine | Master revaluation epic covering result screen redesigns and mobile parity. |
| `KB-13402` | **Flow 4** | Learner Interceptor | Persistent failure modal dialogue with "Re-attempt Now" and "Remind Me Later" CTAs. |
| `KB-13449` | **Flow 4** | Flutter Mobile App | Mobile Flutter implementation of the item-level post-assessment result review screen. |
| `KB-13866` | **Flow 1 & 3** | Decoupled Architecture | Reusable User Groups (`/usergroup/v1/*`), V4 Plan APIs, and State Civil Services (`BAS`/`BSS`). |
| `KB-15357` | **Flow 2** | AI Assessment Studio | Ingestion of `Sector` and `Target Audiences` metadata to guide AI question generation. |
| `KB-15848` | **Flow 4** | Core Course Actor | `BestScoreMergeEngine` and `CourseEnrollmentActor` TOC read-path patch. |
