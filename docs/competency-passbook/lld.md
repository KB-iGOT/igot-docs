# Competency Passbook — Low-Level Design (LLD)

This Low-Level Design (LLD) covers the **complete end-to-end architecture** across both the **Creation Side** (Write / Ingestion / Pipeline) and the **Consumption Side** (Read / Serving / UI), synthesized strictly from the supplied Q2, Q11, and Q13 specifications and Jira work items—**excluding all Q14 items**.

### Referenced Scope & Traceability

- **Q2 Baseline (Consumption Foundation)**: `KB-293`, `KB-936`, `KB-940`, `KB-1102`, `KB-1103`, `KB-2928` (CBP Plan, Passbook Landing Page, Theme Cards, Category Tabs, Social Share).
- **Q11 Baseline (Enterprise Ingestion & Streaming Ledger)**: `KB-12698`, `KB-12699`, `KB-12975`, `KB-13285`, `KB-13319`, `KB-13500`, `BRD 684195843`, `FRS 684949506`, `SRS 777682945`, `Tech Spec 705757206`, `AI Mapping 760381444`.
- **Q13 Baseline (Designation CBP Gap Analysis & Dual-View)**: `Q13 PRD 1001783322`, `WIP Spec 172261415`, `PRD 1376190477`.

### Complete End-to-End LLD Diagram (Creation & Consumption)

```mermaid
flowchart TD
    %% =========================================================================
    %% CREATION SIDE (WRITE & INGESTION TRACK)
    %% =========================================================================
    subgraph CREATION_PIPELINE ["CREATION SIDE (Write, Ingestion & Processing Track)"]
        direction TB
        subgraph INGESTION_SOURCES ["1. Ingestion Channels & Creation Actors"]
            direction LR
            SRC_INTERNAL["iGOT Course Completion<br/><b>(Cert-Generator Job)</b><br/>• 100% progress & assessment pass<br/>• RCert issues SVG/PDF cert"]
            SRC_ATI["ATI / CTI Bulk Ingestion<br/><b>(MDO Admin Portal - KB-13500)</b><br/>• Excel roster upload (FR-6)<br/>• KCM hierarchy selection<br/>• Auto-generates iGOT cert"]
            SRC_SELF["Self-Declared Form<br/><b>(Web / Mobile - KB-13285, KB-13319)</b><br/>• Title, Org, Dates, Hours (FR-1)<br/>• Manual KCM Area/Theme/Sub-theme<br/>• File/URL proof attachment"]
            SRC_AI_POC["AI Competency Mapping POC<br/><b>(Gemini 2.5 - KB-12975, 760381444)</b><br/>• Text/Syllabus extraction<br/>• Semantic mapping to KCM JSON<br/>• Deterministic ID validation"]
        end
        subgraph WRITE_APIS ["2. Ingestion Gateways & Validation Services"]
            OBJ_STORE[("MinIO / AWS S3<br/>Evidence Vault<br/>(Presigned URL upload)")]
            ACHIEVE_SVC["Learner Achievement Service<br/><b>(/api/learner/achivement/create)</b><br/>• Validates dates, hours (1-100), title (10-70)<br/>• Checks mandatory evidence proof<br/>• Validates KCM hierarchy references"]
            KCM_MASTER[("PostgreSQL / KCM Master<br/>Canonical Competency Taxonomy<br/>(Area → Theme → Sub-theme)")]
        end
        subgraph EVENT_STREAMING ["3. Asynchronous Streaming Backbone (Apache Kafka & Flink)"]
            KAFKA_BUS["Kafka Topic: <b>user-competency-mapping-event</b><br/>• Partition Key: <code>userId</code><br/>• Schema: <code>{userId, contentId, contextType, certId}</code>"]
            KAFKA_DLQ["Kafka DLQ Topic: <b>user-competency-event.failed</b><br/>(Malformed payloads, unmapped schemas)"]
            subgraph FLINK_JOB ["Flink Job: user-competency-updater (KB-13316)"]
                FLINK_VAL["1. Schema Deserialization & Timestamp Validation"]
                FLINK_DEDUP["2. Stateful Keyed Deduplication<br/>(RocksDB: <code>userId#contentId</code>, TTL=14d)"]
                FLINK_TAX["3. Async KCM Taxonomy Resolver<br/>(Enrich AreaId, ThemeId, SubthemeId)"]
                FLINK_MUT["4. CQL Mutation Builder<br/>(Build frozen map entry)"]
            end
        end
        subgraph PERSISTENCE_TIER ["4. Master Datastores"]
            CASSANDRA_LEDGER[("Apache Cassandra 4.x<br/><b>Table: sunbird.user_competency_mapping</b><br/>PK: ((user_id), area_id, theme_id, subtheme_id)<br/>Col: competency_details (Nested Frozen Map)<br/><i>Read SLA &lt; 20ms</i>")]
            CASSANDRA_ACHIEVE[("Apache Cassandra 4.x<br/><b>Table: sunbird.user_achievements</b><br/>PK: ((user_id), achievement_id)<br/>Status: Direct ledger commit (No MDO gate)")]
        end
        %% Creation Connections
        SRC_SELF -->|1. Upload Evidence| OBJ_STORE
        SRC_SELF -->|2. POST Achievement Data| ACHIEVE_SVC
        SRC_ATI -->|POST Bulk Batch| ACHIEVE_SVC
        SRC_AI_POC -.->|Inferred KCM JSON Payload| ACHIEVE_SVC
        ACHIEVE_SVC <-->|Validate IDs| KCM_MASTER
        ACHIEVE_SVC -->|Save Transaction Record| CASSANDRA_ACHIEVE
        SRC_INTERNAL -->|Emit Event: iGOTCourses| KAFKA_BUS
        ACHIEVE_SVC -->|Emit Event: selfAchievemt / externalTraining| KAFKA_BUS
        KAFKA_BUS -->|Consume Stream| FLINK_VAL
        FLINK_VAL -.->|Invalid Schema| KAFKA_DLQ
        FLINK_VAL -->|Valid Record| FLINK_DEDUP
        FLINK_DEDUP -->|New Event| FLINK_TAX
        FLINK_TAX <-->|Query Taxonomy| KCM_MASTER
        FLINK_TAX --> FLINK_MUT
        FLINK_MUT -->|Async Bound CQL Append| CASSANDRA_LEDGER
    end
    %% =========================================================================
    %% CONSUMPTION SIDE (READ & SERVING TRACK)
    %% =========================================================================
    subgraph CONSUMPTION_PIPELINE ["CONSUMPTION SIDE (Read, Serving & Learner Experience Track)"]
        direction TB
        subgraph CLIENT_ENTRY ["5. Presentation Layer & Entry Points"]
            direction LR
            CBP_STRIP["Home: My CBP Plan Strip<br/><b>(KB-936)</b><br/>Shows required plan & jump link"]
            PASSBOOK_NAV["Profile Menu: Learner Passbook<br/><b>(SRS 777682945)</b><br/>Direct entry to passbook dashboard"]
            MOBILE_APP["iGOT Mobile Client (Flutter)<br/><b>(KB-13319)</b><br/>Native mobile passbook view"]
        end
        subgraph SERVING_ROUTING ["6. API Management & Gateway Tier"]
            UI_PROXY["Node.js UI-Proxy<br/>(<code>/apis/proxies/v8/learner/*</code>)"]
            KONG_GW["Kong API Gateway<br/>• Keycloak JWT validation<br/>• Rate limiting: 100 req/sec<br/>• Subject match check (userId == sub)"]
        end
        subgraph SERVING_SERVICES ["7. Serving Microservices & Resolution Engines"]
            COMP_API["Competency Serving Service<br/><b>(Spring Boot / Java)</b><br/>• Single-partition point query<br/>• Aggregates achievements"]
            AICBP_CONN["Designation CBP Plan Engine<br/><b>(Q13 PRD 1001783322)</b><br/>• Mapped via designationId & orgId<br/>• Redis Cache (TTL = 24h)<br/>• Computes role gap matrix"]
            LEGACY_FALLBACK["Legacy Enrollment API Fallback<br/>(<code>/user/enrollment/list</code>)<br/><i>Triggered only if Cassandra uninitialized</i>"]
        end
        subgraph PASSBOOK_VIEWS ["8. Passbook Dual-View & Interactive Surfaces"]
            VIEW_LANDING["Passbook Landing Overview (KB-940)<br/>• Metric cards: Total, Behavioural, Functional, Domain<br/>• Time filters: 30 days, 3 months, All time<br/>• Designation details card"]
            subgraph DUAL_VIEW_CONTAINER ["Dual-View Surface (Q13 PRD 1001783322 §7.1.1)"]
                TAB_ROLE["<b>'Required for My Role' Tab</b><br/>• Mandated role competencies (CBP)<br/>• Proficiency gaps (Target vs. Current)<br/>• Level-wise course pathways (Beg/Int/Adv)"]
                TAB_HAVE["<b>'Already Have' Tab</b><br/>• Non-role earned competencies<br/>• Self-declared + institutional records<br/>• Contributing course links & dates"]
            end
            VIEW_INNER["Competency Theme & Detail Page (KB-1102, KB-1103)<br/>• Sub-theme pill counters (Desktop: 10, Mobile: 3)<br/>• Filter tabs: All, Behavioural, Functional, Domain<br/>• Certificate viewer & Download modal"]
            VIEW_SHARE["Social & Public Verification (KB-2928)<br/>• Certificate share button on TOC & Passbook<br/>• Generates public verification URL"]
        end
        %% Consumption Connections
        CBP_STRIP -->|Navigate| UI_PROXY
        PASSBOOK_NAV -->|Navigate| UI_PROXY
        MOBILE_APP -->|Direct HTTPS| KONG_GW
        UI_PROXY --> KONG_GW
        KONG_GW --> COMP_API
        COMP_API -->|1. SELECT * WHERE user_id = ?| CASSANDRA_LEDGER
        COMP_API <-->|2. Fetch Role Mandate| AICBP_CONN
        COMP_API -.->|3. Lazy Migration Fallback| LEGACY_FALLBACK
        COMP_API -->|Format Dashboard JSON| VIEW_LANDING
        VIEW_LANDING --> TAB_ROLE
        VIEW_LANDING --> TAB_HAVE
        TAB_ROLE --> VIEW_INNER
        TAB_HAVE --> VIEW_INNER
        VIEW_INNER --> VIEW_SHARE
    end
    %% Inter-tier connection
    CASSANDRA_LEDGER -.->|Sub-20ms Partition Read| COMP_API
```

### End-to-End Sequence Diagram (Creation vs. Consumption)

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Civil Servant (Learner)
    actor MDO as MDO Administrator
    participant UI as Portal UI (Angular / Flutter)
    participant Gateway as Kong Gateway / UI-Proxy
    participant Svc as Learner Achievement Service
    participant S3 as S3 / MinIO Object Storage
    participant Kafka as Kafka (user-competency-mapping-event)
    participant Flink as Flink (user-competency-updater)
    participant Cassandra as Cassandra (user_competency_mapping)
    participant CompAPI as Competency Serving Service
    participant AICBP as AI-CBP / Redis Cache %% ------------------------------------------------------------- %% 1. CREATION / INGESTION SIDE %% -------------------------------------------------------------
    rect rgb(240, 248, 255)
        Note over Learner,Cassandra: ══════ CREATION SIDE: Write / Ingestion Flows (Q11 Baseline) ══════
        alt A. Self-Declared Learning (KB-12700, KB-13285, KB-13319)
            Learner->>UI: Fill "Add Achievement" form & select KCM Area/Theme/Sub-theme
            UI->>S3: Upload certificate proof (PDF/PNG) via presigned URL
            UI->>Gateway: POST /apis/proxies/v8/learner/achivement/create
            Gateway->>Svc: Validate fields (Hours: 1-100, Title: 10-70, Evidence URL)
            Svc->>Cassandra: Insert record into sunbird.user_achievements (Status: COMMITTED)
            Svc->>Kafka: Publish event (eventType=COMPETENCY_ACQUIRED, contextType=selfAchievemt)
        else B. ATI / CTI Institutional Bulk Upload (KB-12977, KB-13500)
            MDO->>UI: Upload training cohort Excel roster with KCM mappings
            UI->>Gateway: POST /apis/proxies/v8/learner/achivement/bulkUpload
            Gateway->>Svc: Parse roster, validate learner IDs, auto-issue iGOT certificates
            Svc->>Cassandra: Batch insert into sunbird.user_achievements
            Svc->>Kafka: Publish event batch (contextType=externalTraining)
        else C. Internal Course Completion
            Note over Svc,Kafka: Course Progress hits 100% -> RCert issues digital certificate
            Svc->>Kafka: Publish event (contextType=iGOTCourses, certId, contentId)
        end
        Kafka->>Flink: Consume stream partition (Key: userId)
        Flink->>Flink: 1. Validate schema & check RocksDB state (userId#contentId)
        Flink->>Flink: 2. Resolve canonical KCM taxonomy IDs
        Flink->>Cassandra: 3. Async CQL Collection Append to competency_details
        Cassandra-->>Flink: Acknowledge write (LOCAL_QUORUM)
    end %% ------------------------------------------------------------- %% 2. CONSUMPTION / SERVING SIDE %% -------------------------------------------------------------
    rect rgb(245, 255, 245)
        Note over Learner,AICBP: ══════ CONSUMPTION SIDE: Read / Serving Flows (Q2, Q11, Q13 PRD) ══════
        Learner->>UI: Access "Competency Passbook" (via Profile or My CBP Plan KB-936)
        UI->>Gateway: GET /apis/proxies/v8/learner/v1/passbook/dashboard
        Gateway->>CompAPI: Forward authenticated request (JWT with userId, designationId, orgId)
        par Read Earned Ledger (Cassandra)
            CompAPI->>Cassandra: SELECT * FROM user_competency_mapping WHERE user_id = ?
            Cassandra-->>CompAPI: Return partition rows (Execution latency < 20ms)
        and Read Role Mandate (AI-CBP / Redis)
            CompAPI->>AICBP: Get Designation Plan (designationId, orgId)
            AICBP-->>CompAPI: Return required competencies & level-wise courses
        end
        opt Cassandra Ledger Uninitialized (Fallback)
            CompAPI->>Gateway: Call Legacy Enrollment API (/user/enrollment/list)
            Gateway-->>CompAPI: Compute dynamic competencies client-side as fallback
        end
        CompAPI->>CompAPI: Synthesize Dual-View (Required vs. Already Have) & calculate progress %
        CompAPI-->>UI: Return unified Passbook Dashboard JSON
        UI-->>Learner: Render Passbook Landing Page (KB-940) with Area summary cards
        alt View: Required for My Role (Q13 PRD 1001783322 §7.1.1)
            Learner->>UI: Select "Required for My Role" tab
            UI-->>Learner: Display role gaps, required proficiency levels, & Beginner/Int/Adv course paths
        else View: Already Have (Q13 PRD 1001783322 §7.1.1)
            Learner->>UI: Select "Already Have" tab
            UI-->>Learner: Display earned non-role competencies, dates, & certificate links
        end
        opt Detail & Share (KB-1102, KB-1103, KB-2928)
            Learner->>UI: Click Competency Card -> Opens Inner Detail view (All/Behavioural/Domain tabs)
            Learner->>UI: Click "Share" button -> Generates public verification URL / social preview
        end
    end
```

### Low-Level Component Reference Matrix

| Subsystem | Component | Implementation Detail & Link Source Reference |
|---|---|---|
| **Creation (Write)** | **Self-Achievement Service** | Structured web/mobile entry form; enforces title (10–70 chars), hours (1–100), issue date constraints, and mandatory evidence upload. Implements direct ledger commit without MDO blocking approval. References: `KB-12700`, `KB-13285`, `KB-13319`, `FRS 684949506 FR-1`, `SRS 777682945 §6.1.1`. |
| **Creation (Write)** | **ATI / CTI Bulk Ingestion** | MDO portal interface allowing administrators to upload training rosters with KCM taxonomy tags; auto-issues platform-verified iGOT certificates. References: `KB-12977`, `KB-13500`, `FRS 684949506 FR-6`, `SRS 777682945 §6.1.4`. |
| **Creation (Write)** | **AI Mapping Automation** | Evaluates Gemini 2.5 Flash/Pro pipeline to match raw certificate/syllabus text against official KCM catalog JSON, validating exact reference IDs before attachment. References: `KB-12975`, `Tech Spec 760381444`. |
| **Creation (Stream)** | **Kafka & Flink Engine** | Topic `user-competency-mapping-event` partitioned by `userId`. Flink job `user-competency-updater` performs schema check, RocksDB deduplication (14d TTL), KCM resolution, and non-blocking Cassandra collection appends. References: `KB-13316`, `KB-13445`, `SRS 777682945 §8.2`. |
| **Storage (Ledger)** | **Cassandra Ledger** | `sunbird.user_competency_mapping` keyed on `((user_id), competency_area_id, competency_theme_id, competency_subtheme_id)` to keep each learner's record on a single partition for sub-20ms reads. References: `Tech Spec 777781250`, `API Contract 722206728`. |
| **Consumption (Read)** | **Passbook Landing & Summary** | Landing page displaying total competency counts, Area breakdown (Behavioural, Functional, Domain), time filters, and designation details. References: `KB-940`, `KB-936`, `FRS CBP 18841695`. |
| **Consumption (Read)** | **Dual-View Synthesis** | Synthesizes *Required for My Role* (gap analysis using designation plans from AI-CBP) vs. *Already Have* (earned credentials beyond role scope). References: `Q13 PRD 1001783322 §7.1.1`, `PRD 1376190477`. |
| **Consumption (Read)** | **Theme Cards & Sharing** | Detailed cards showing sub-theme pills, contributing courses, certificates, category filtering (All/Behavioural/Functional/Domain), and social sharing links. References: `KB-1102`, `KB-1103`, `KB-2928`. |
