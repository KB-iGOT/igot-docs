# Competency Passbook — Context Diagrams

This page presents the **System Context Diagrams (C4 Level 1)** for the **Competency Passbook / Learner Passbook** platform, scoped strictly to the **Q2–Q13** baseline (incorporating `KB-293`, `KB-936`, `KB-940`, `KB-1102`, `KB-1103`, `KB-2928`, `KB-12698`, `KB-12699`, `KB-12975`, `KB-13285`, `KB-13319`, `KB-13500`, and Confluence specifications `684195843`, `684949506`, `777682945`, `705757206`, `760381444`, `1001783322`).

### 1. Overall System Context Diagram (C4 Level 1)

This diagram establishes the **System Boundary** of the Competency Passbook, identifying all human actors, internal platform collaborating services, and external integrations across both **Creation (Ingestion)** and **Consumption (Serving)** tracks.

```mermaid
C4Context
    title System Context Diagram (C4 Level 1) - iGOT Karmayogi Competency Passbook (Q2-Q13)
    %% Actors
    Person(learner, "Civil Servant / Learner", "Views role competencies, discovers gaps, tracks progression, self-declares external learning, and shares certificates.")
    Person(mdoAdmin, "MDO Administrator (ATI/CTI)", "Bulk-uploads institutional training cohorts and monitors ministry/cadre competency readiness.")
    Person(spvAdmin, "SPV Leadership / Platform Ops", "Monitors national capacity building KPIs, adoption metrics, and catalog health.")
    %% Main System Boundary
    Enterprise_Boundary(b0, "iGOT Karmayogi Platform Ecosystem") {
        System(passbookSys, "Competency Passbook Subsystem", "Pre-computes and aggregates learning achievements, maps competencies to KCM, visualizes designation gaps, and provides dual-view navigation.")
        System(userProfile, "User Identity & Profile Service", "Maintains user designations, ministry/department mapping, cadres, and groups.")
        System(courseEngine, "Course Progress & Assessment Engine", "Tracks batch enrollments, module completions, assessment scores, and triggers certificate issuance.")
        System(certSys, "Certificate Subsystem (RCert)", "Generates digitally signed PDF/SVG completion certificates with verifiable QR codes.")
        System(kcmCatalog, "KCM Master Catalog Service", "Authoritative master for the 3-tier Karmayogi Competency Model (Area, Theme, Sub-theme).")
        System(aiCbp, "AI-CBP Plan Engine (Q13)", "Maintains role-based Capacity Building Plans, required competency mixes, and level-wise course pathways.")
    }
    %% External Systems
    System_Ext(atiInstitutes, "ATIs / CTIs (Training Institutes)", "State & Central training institutes conducting offline in-service training.")
    System_Ext(publicVerify, "Public Certificate Verification", "Public web service resolving certificate validity for employers and social sharing (KB-2928).")
    System_Ext(ehrms, "Government HRMS / Service Book", "External civil service personnel repository (EHRMS/SPARROW) for career history.")
    %% Actor Relationships
    Rel(learner, passbookSys, "Explores role gaps, launches next-step courses, self-declares training with proof", "HTTPS / Angular & Flutter")
    Rel(mdoAdmin, passbookSys, "Bulk-uploads Excel training rosters, tags KCM competencies", "HTTPS / MDO Portal")
    Rel(spvAdmin, passbookSys, "Monitors national training adoption and capacity metrics", "HTTPS")
    %% Internal Subsystem Interactions
    Rel(passbookSys, userProfile, "Fetches user designation, cadre, and rootOrgId", "Internal REST")
    Rel(courseEngine, passbookSys, "Emits completion events upon 100% course finish", "Kafka (user-competency-mapping-event)")
    Rel(passbookSys, certSys, "Triggers auto-certificate issuance for ATI/CTI cohorts & fetches cert URLs", "REST / JSON")
    Rel(passbookSys, kcmCatalog, "Validates and enriches Area, Theme, and Sub-theme IDs", "Internal REST / Cache")
    Rel(passbookSys, aiCbp, "Retrieves mandated designation plans & level-wise course sequences (Q13)", "REST / Redis Cache")
    %% External System Interactions
    Rel(atiInstitutes, mdoAdmin, "Supplies offline cohort completion rosters", "Excel / Offline")
    Rel(passbookSys, publicVerify, "Publishes verification tokens for public/social sharing", "HTTPS / OpenGraph")
    Rel(ehrms, passbookSys, "Transmits civil service historical training records [Q11 Baseline]", "REST API Gateway")
    UpdateElementStyle(passbookSys, $bgColor="#0b5cbe", $fontColor="#ffffff", $borderColor="#073a7a")
```

### 2. Creation-Side Context Diagram: Ingestion, Validation & Streaming

This diagram focuses strictly on the **Write / Ingestion boundary**, illustrating how internal courses, institutional offline batches, self-declared achievements, and AI-mapped records flow into the persistent ledger.

```mermaid
flowchart TD
    subgraph CREATION_ACTORS ["Creation Sources & Ingestion Actors"]
        A1["Civil Servant (Learner)<br/><b>Self-Declaration (KB-12700, KB-13319)</b>"]
        A2["MDO Administrator<br/><b>ATI/CTI Bulk Upload (KB-12977, KB-13500)</b>"]
        A3["Assessment & Learning Service<br/><b>iGOT Course Completion (KB-1102)</b>"]
        A4["AI Mapping Pipeline (POC)<br/><b>Gemini 2.5 Evaluation (KB-12975)</b>"]
    end
    subgraph SYSTEM_BOUNDARY ["Competency Passbook Ingestion & Processing Subsystem"]
        direction TB
        subgraph INGESTION_GATE ["Ingestion & Verification Gateways"]
            GW_UPLOAD["S3/MinIO Evidence Vault<br/>(Presigned URL Upload)"]
            GW_API["Learner Achievement Service<br/>• Title length: 10-70 chars<br/>• Hours: 1-100 integer<br/>• Mandatory proof check<br/>• Direct commit (No MDO approval)"]
        end
        subgraph ASYNC_STREAMING ["Asynchronous Processing Engine"]
            KAFKA_TOPIC["Kafka Topic: <b>user-competency-mapping-event</b><br/>Partition Key: <code>userId</code>"]
            FLINK_PROC["Flink Job: <b>user-competency-updater</b><br/>• Structural validation<br/>• RocksDB Deduplication (14d TTL)<br/>• KCM Taxonomy Enrichment<br/>• Async CQL Mutation"]
            DLQ_TOPIC["Kafka Topic: <b>user-competency-event.failed</b><br/>(Dead-Letter Queue)"]
        end
        subgraph STORAGE_TIER ["Persistence Datastores"]
            CASS_ACHIEVE[("Cassandra: <b>user_achievements</b><br/>Transaction metadata")]
            CASS_LEDGER[("Cassandra: <b>user_competency_mapping</b><br/>Pre-computed read ledger")]
        end
    end
    subgraph EXT_MASTERS ["External Reference Systems"]
        KCM_SYS[("KCM Master Catalog<br/>(Area → Theme → Sub-theme)")]
        CERT_GEN["RCert Certificate Service<br/>(Issues signed digital certs)"]
    end
    %% Ingestion flows
    A1 -->|1. Upload Certificate File / URL| GW_UPLOAD
    A1 -->|2. POST Achievement + KCM Tags| GW_API
    A2 -->|POST Excel Roster + KCM Tags| GW_API
    A4 -.->|Inferred KCM JSON Payload| GW_API
    A3 -->|Course 100% Passed| CERT_GEN
    GW_API <-->|Validate KCM Nodes| KCM_SYS
    GW_API -->|Save Achievement Row| CASS_ACHIEVE
    GW_API -->|Publish selfAchievemt / externalTraining| KAFKA_TOPIC
    CERT_GEN -->|Publish iGOTCourses Event| KAFKA_TOPIC
    KAFKA_TOPIC -->|Stream Records| FLINK_PROC
    FLINK_PROC -.->|Malformed / Unmapped| DLQ_TOPIC
    FLINK_PROC <-->|Enrich Area/Theme/Subtheme IDs| KCM_SYS
    FLINK_PROC -->|Async Bound Collection Append| CASS_LEDGER
```

### 3. Consumption-Side Context Diagram: Serving, Gap Analysis & Navigation

This diagram isolates the **Read / Serving boundary**, capturing how the civil servant experiences the Passbook, how role gaps are dynamically resolved via the AI-CBP engine, and how certificates are shared.

```mermaid
flowchart TD
    subgraph CONSUMERS ["Consumers & Output Channels"]
        U1["Civil Servant (Web Browser)"]
        U2["Civil Servant (Mobile App - Flutter)"]
        U3["Public Verifier / Social Media<br/>(LinkedIn / Verification Portal - KB-2928)"]
    end
    subgraph SERVING_BOUNDARY ["Competency Passbook Serving & Navigation Subsystem"]
        direction TB
        subgraph GATEWAY ["API Gateway & Routing Layer"]
            PROXY["Kong API Gateway & Node.js UI-Proxy<br/>(Route: <code>/apis/proxies/v8/learner/*</code>)"]
        end
        subgraph SERVING_CORE ["Serving & Gap Resolution Logic"]
            SERV_API["Competency Serving Service (Spring Boot)<br/>• Single-partition point query<br/>• Sub-20ms database read latency"]
            GAP_ENGINE["Dual-View & Gap Synthesizer (Q13 PRD)<br/>• Required for Role vs. Already Have<br/>• Status: Not Started / In Progress / Completed<br/>• Next-Step Course Evaluator"]
            FALLBACK_HANDLER["Legacy Fallback Handler<br/>(Invokes <code>/user/enrollment/list</code> if DB uninitialized)"]
        end
        subgraph PASSBOOK_UI ["Frontend Presentation Views"]
            UI_HOME["My CBP Plan Strip (KB-936)"]
            UI_LANDING["Passbook Landing Overview (KB-940)<br/>• Total, Behavioural, Functional, Domain counters<br/>• Designation Details Card"]
            UI_ROLE["'Required for My Role' Tab (Q13)<br/>• Competency Gaps & Course Pathways"]
            UI_HAVE["'Already Have' Tab (Q13)<br/>• Self-declared & non-role accomplishments"]
            UI_DETAIL["Competency Detail View (KB-1102, KB-1103)<br/>• Sub-theme Pills, Course List, Certificate Link"]
        end
    end
    subgraph PLATFORM_DEPENDENCIES ["Platform Systems & Caching"]
        CASS_DB[("Cassandra: <b>user_competency_mapping</b><br/>Single-partition read per user")]
        REDIS_CACHE[("Redis Cache<br/>(Designation Plans, TTL=24h)")]
        AICBP_SVC["AI-CBP Plan Engine (Q13 PRD)<br/>Mandated Designation Matrices"]
    end
    %% Interactions
    U1 -->|1. Navigate to Passbook| PROXY
    U2 -->|1. Mobile HTTPS Request| PROXY
    PROXY --> SERV_API
    SERV_API -->|"Query Ledger (SLA &lt; 20ms)"| CASS_DB
    SERV_API <-->|Fetch Cached Role Matrix| REDIS_CACHE
    REDIS_CACHE <-->|Cache Miss: Query Plan| AICBP_SVC
    SERV_API -.->|Lazy Migration Trigger| FALLBACK_HANDLER
    SERV_API --> GAP_ENGINE
    GAP_ENGINE --> UI_LANDING
    UI_HOME --> UI_LANDING
    UI_LANDING --> UI_ROLE
    UI_LANDING --> UI_HAVE
    UI_ROLE --> UI_DETAIL
    UI_HAVE --> UI_DETAIL
    UI_DETAIL -->|Share Action| U3
```

### Key Contextual Boundaries & Interfaces Summary

| Interface / Boundary | Interacting Entities | Protocol & Format | Business Function & Link Reference |
|---|---|---|---|
| **Self-Declaration Input** | Learner Passbook Ingestion Service | HTTPS / Multipart Form | Submits external training metadata, selects KCM hierarchy, and uploads evidence files (`KB-12700`, `KB-13285`, `KB-13319`). |
| **Institutional Bulk Input** | MDO Admin Passbook Ingestion Service | HTTPS / Excel Batch | Bulk ingestion of ATI/CTI participant rosters with auto-generated iGOT certificates (`KB-12977`, `KB-13500`, `FRS FR-6`). |
| **Internal Completion Ingestion** | Course Engine Kafka Bus | Kafka Stream (JSON) | Asynchronous ingestion of completed iGOT courses (`user-competency-mapping-event`, `KB-13445`). |
| **Stream Processing Boundary** | Kafka Flink Cassandra | CQL / Binary Protocol | Deduplication (14d TTL), KCM resolution, and bound collection appends into `sunbird.user_competency_mapping` (`KB-13316`, `Page ID: 777781250`). |
| **Role Gap Integration** | Passbook Service AI-CBP / Redis | REST / JSON | Retrieves designation competency targets, proficiency levels, and level-wise course pathways (`Q13 PRD 1001783322`). |
| **Learner Serving Boundary** | Frontend Kong Cassandra | HTTPS / REST | Single-partition point query returning complete user competency ledger with database execution (`KB-940`, `API Contract 722206728`). |
| **Public Social** **Share** | Passbook Detail View Public Internet | HTTPS / OpenGraph | Generates social preview cards and public verification URLs for earned certificates (`KB-2928`). |
