# Curated Program — System Context Diagram (Level-0)

**iGOT Karmayogi Platform | Architecture Specification**

### 1. Architectural Narrative & System Boundaries

The **Curated Program System Context (C4 Level-1 / IEEE 1016 System Context)** defines the boundaries of the iGOT Karmayogi Curated Program subsystem. It illustrates the primary human actors, external governance and competency bodies, adjacent storage and analytics systems, and the bidirectional flow of control, data, and telemetry across the platform boundary.

```mermaid
flowchart TD
    HA["[ Human Actors: Creators, Reviewers, Publishers, Learners, Coordinators ]"]
    subgraph PB["iGOT KARMAYOGI PLATFORM BOUNDARY"]
        PRL["[ Presentation Layer ]"] --> AGT["[ API Gateway Tier (Kong) ]"]
        AGT --> CM["[ Core Microservices: Content, LMS, Assessment (L2 Gating), Certs ]"]
        CM --> SP["[ Streaming & Polyglot Persistence: Cassandra, Neo4j, ES, Kafka, Flink ]"]
    end
    FR["[ FRAC Competency Dict ]"]
    DA["[ DoPT & MDO Analytics ]"]
    HA -->|"(HTTPS / REST / JWT)"| PRL
    SP -->|"(FRAC Taxonomy Sync)"| FR
    SP -->|"(ETL / Reporting Marts)"| DA
```

### 2. Comprehensive System Context Diagram

```mermaid
flowchart TB
    %% External Human Actors
    subgraph Actors ["Human Actors & Operational Roles"]
        Creator["Content Creator\n(MDO / Training Institute)\n[Authoring, Course Curation, L2 Config]"]
        Reviewer["Content Reviewer\n(MDO Review Queue)\n[Quality & Structure Approval]"]
        SPVPublisher["SPV Central Publisher\n(Karmayogi Bharat)\n[Catalog Gatekeeper, Release to Live]"]
        Learner["Civil Service Learner\n(Central & State Cadres)\n[Discovery, Enrolment, Learning, L2 Exam]"]
        ProgCoord["Program Coordinator\n(MDO Admin)\n[Attendance, Batch Analytics]"]
    end
    %% Platform Boundary
    subgraph iGOT_Boundary ["iGOT Karmayogi Platform Boundary (System Under Consideration)"]
        subgraph Ingress ["Edge & Gateway Tier"]
            Gateway["Kong API Gateway\n- OAuth2 / Keycloak JWT Enforcement\n- RBAC (Creator, Reviewer, SPV Publisher)\n- Rate Limiting & SSL Offloading"]
        end
        subgraph ClientApps ["Presentation Applications Tier"]
            CBP_SPA["Content Portal (CBP UI)\n- Angular 12+ SPA\n- Program Form, Course Selector\n- CQS & Profanity Scan Bypass"]
            Learner_Web["Learner Web Experience\n- Angular 12+ Responsive Web\n- TOC View, Course Player"]
            Learner_App["iGOT Karmayogi Mobile Client\n- Flutter Android & iOS Apps\n- Offline Caching, Gated L2 Player"]
        end
        subgraph CoreSubsystem ["Curated Program Core Microservices Tier"]
            ContentEngine["Content & Hierarchy Service\n(Scala / Play)\n- Neo4j Graph Mapper\n- Immutability Policy Engine"]
            LMSEngine["LMS & Enrolment Engine\n(Java / Play)\n- Auto-Batch Provisioner (Open Batch)\n- Enrolment Registry & Progress Rollup"]
            AssessEngine["cb-ext-assessment-service\n(Node.js & Java Runtime)\n- Server-side L2 Prerequisite Locking\n- Gated QuestionSet Delivery & Grading"]
            CertEngine["sunbird-rc-certs Service\n(Java / Spring Boot)\n- Course Certificate Minting\n- Program Capstone Certificate Generator"]
        end
        subgraph EventDataTier ["Streaming & Real-Time Data Pipeline Tier"]
            KafkaBus["Apache Kafka Event Bus\n- Topics: telemetry.raw, course.completion"]
            FlinkPipeline["Apache Flink Streaming Worker\n- Real-time Consumption Summarizer\n- Duration & Session Aggregations"]
        end
        subgraph PolyglotStores ["Internal Polyglot Persistence Tier"]
            Neo4jGraph[("Neo4j Knowledge Graph\n- Composite Curriculum Topologies\n- (:Program)-[:hasContent]->(:Course)")]
            CassandraCluster[("Apache Cassandra DB\n- user_enrolment (Status 0, 1, 2)\n- content_hierarchy (Cached JSON)\n- assessment_attempts, course_batch")]
            ElasticCluster[("Elasticsearch Cluster\n- composite-search Catalog\n- Homepage Karma Programs Strip Index")]
            ObjectStore[("MinIO / S3 Object Store\n- Digital Assets, Encrypted PDF Certificates")]
        end
    end
    %% External Systems & Governance
    subgraph ExternalSystems ["External Systems & Governance Authorities"]
        FRAC_Dict["FRAC Competency Framework\n(DoPT Competency Dictionary)\n- Competency Types, Areas, Themes, Sub-themes"]
        DoPT_Gov["DoPT / MDO Monitoring Systems\n- Central Civil Service Capacity Reports\n- National Training Tracker & Compliance"]
        Postgres_DW[("PostgreSQL Analytics Warehouse\n- Dimensional Reporting Marts\n- User, Program & Assessment Fact Tables")]
        SparkBatch["Apache Spark ETL Engine\n- Scheduled Aggregation Jobs (KBE-151)"]
    end
    %% Actor Interactions
    Creator -->|1. Authors Program, Curates Live Courses, Configures L2 Lock| CBP_SPA
    Reviewer -->|2. Reviews Structure & Pedagogical Sequence| CBP_SPA
    SPVPublisher -->|3. Approves Public Release to Live Catalog| CBP_SPA
    ProgCoord -->|Inspects Batch Rosters & Metrics| CBP_SPA
    Learner -->|Discovers Program & Enrols| Learner_Web
    Learner -->|Consumes Modules, Takes Locked L2, Downloads Certs| Learner_App
    %% Presentation to Gateway
    CBP_SPA -->|HTTPS REST with JWT Token| Gateway
    Learner_Web -->|HTTPS REST with JWT Token| Gateway
    Learner_App -->|HTTPS REST with Mobile Session| Gateway
    %% Gateway to Internal Services
    Gateway -->|/action/content/v3/*| ContentEngine
    Gateway -->|/action/course/v1/*| LMSEngine
    Gateway -->|/v7/assessment/*| AssessEngine
    Gateway -->|Raw Player Telemetry| KafkaBus
    %% External System Integrations
    ContentEngine <-->|Validates Competency Taxonomy| FRAC_Dict
    %% Service to Storage Integrations
    ContentEngine -->|Maintains Structural Relationships| Neo4jGraph
    ContentEngine -->|Persists Program Metadata & Cache| CassandraCluster
    ContentEngine -->|Indexes Published Programs| ElasticCluster
    LMSEngine -->|Provisions Open Batches & Reads User State| CassandraCluster
    LMSEngine -->|Publishes Course Completion Events| KafkaBus
    AssessEngine -->|"Validates Child Course Completion State (Lock Check)"| CassandraCluster
    AssessEngine -->|Persists Attempt Scores & Emits Program Completion| KafkaBus
    AssessEngine -->|Records Passed Attempt| CassandraCluster
    %% Streaming & Async Jobs
    KafkaBus -->|telemetry.raw| FlinkPipeline
    FlinkPipeline -->|Updates user_content_consumption| CassandraCluster
    KafkaBus -->|course.completion| CertEngine
    CertEngine -->|Mints Digitally Signed PDF/SVG with QR| ObjectStore
    CertEngine -->|Appends Certificate URL| CassandraCluster
    %% Downstream Analytics Pipeline
    CassandraCluster --> SparkBatch
    SparkBatch -->|Nightly ETL Batch Aggregations| Postgres_DW
    Postgres_DW -->|Generates National Executive Dashboards| DoPT_Gov
```

### 3. Contextual Entity Interface & Data Boundary Matrix

| Interface Boundary | Inbound / Outbound Data | Interaction Pattern | Target System / Component | Security & Governance Control | Jira / Spec Reference |
|---|---|---|---|---|---|
| **Creator / Reviewer CBP UI** | Program metadata, Live course links, L2 QuestionSet association, locking flags | Synchronous HTTPS / REST | Content Portal (`cbp.igotkarmayogi.gov.in`) | OAuth2 / Keycloak JWT (`CBP Creator`, `CBP Reviewer`) | [KB-1945: Q3 \| Content Portal Redesign \| Create program](https://karmayogibharat.atlassian.net/browse/KB-1945) (Prod Deployed), [KBE-174: Ability to create a curated program and add live courses](https://karmayogibharat.atlassian.net/browse/KBE-174) (Review), [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved) |
| **SPV Publisher Content Service** | Publish trigger, immutability state activation, auto-batch trigger | Synchronous HTTPS / REST | Kong Gateway Content Service | Enforces central `SPV Publisher` role (regular publishers rejected) | [KB-452: Q2 \| CBP Publishing \| Course vs Program publishing flow for SPV](https://karmayogibharat.atlassian.net/browse/KB-452) (KB Approved), [KB-457: Q2 \| CBP Editing \| Program Editing](https://karmayogibharat.atlassian.net/browse/KB-457) (KB Approved), [KB-1946: Q3 \| Content Portal Redesign \| Batch management for program](https://karmayogibharat.atlassian.net/browse/KB-1946) (Prod Deployed) |
| **Content Service FRAC Dictionary** | Competency Area, Theme, Sub-theme taxonomy validation | Synchronous Internal REST | External FRAC Dictionary Service | Read-only taxonomy lookup & mapping validation | Page 35062022 §5.10 |
| **Learner LMS Enrolment Service** | Program enrollment, TOC progress retrieval, bi-directional progress queries | Synchronous HTTPS / REST | Kong Gateway LMS Service | Authenticated user session, Open Batch verification | [KBE-148: Should be able to view and consume the curated programs](https://karmayogibharat.atlassian.net/browse/KBE-148) (Review), [KB-9650: Regression : The progress of the course content is not reflecting immediately in TOC page content tab when comes back from the player page. It reflects only after page reload.](https://karmayogibharat.atlassian.net/browse/KB-9650) (Done) |
| **Learner cb-ext-assessment-service** | Gated assessment read (`/v7/assessment/read`), attempt answer submission | Synchronous HTTPS / REST | Kong Gateway Assessment Service | Server-side gating verification (`contextLockingType: "Course Assessment Only"`) | [KB-8842: Q8 \| Learning Path \| Curated Program \| Add Final Assessment Locking](https://karmayogibharat.atlassian.net/browse/KB-8842) (Prod Deployed), [KB-9043: Replicate the code of read,retake,submit and result API's from cb-ext-service in cb-ext-assessment service](https://karmayogibharat.atlassian.net/browse/KB-9043) (Done), [KB-9600: User is able to consume final assessment without consuming course content in curated porgram](https://karmayogibharat.atlassian.net/browse/KB-9600) (Done) |
| **Player Telemetry Pipeline** | Interactive player events (`START`, `INTERACT`, `END`), duration, milestones | Asynchronous Stream | Kong Gateway Kafka (`telemetry.raw`) | Rate-limited telemetry ingestion, zero data loss buffer | Page 21266503, [KBE-151: Able to view the detailed reports at the program/user level](https://karmayogibharat.atlassian.net/browse/KBE-151) (To Do) |
| **Assessment / LMS Cert Service** | Program & Course completion triggers (`course.completion`) | Asynchronous Event | Kafka `sunbird-rc-certs` | Idempotent consumer, SHA-256 digital signature, verifiable QR | [KBE-149: Should be able to view certificate on completion of the curated program](https://karmayogibharat.atlassian.net/browse/KBE-149) (To Do), [KB-9809: Certificate is not getting generated in TOC page about tab once Curated program is consumed by some users in both QA and UAT environment](https://karmayogibharat.atlassian.net/browse/KB-9809) (Fixed) |
| **Cassandra Analytics Warehouse** | Completed user records, assessment attempt scores, completion timestamps | Asynchronous Batch ETL | Spark Batch Job PostgreSQL Marts | Role-based data redaction, DoPT compliance auditing | [KBE-151: Able to view the detailed reports at the program/user level](https://karmayogibharat.atlassian.net/browse/KBE-151) (To Do), Page 373850243 |

### 4. Key Architectural Insights Highlighted by Context

1. **Clear Trust Boundaries**: Public access to Curated Programs requires authorization from the central `SPV Publisher`, preventing regional training institutes from releasing unverified public curricula.
2. **Autonomous Gating Enforcement**: The `cb-ext-assessment-service` acts as an independent enforcement boundary. It cross-examines learner progress directly against Cassandra before dispensing exam question payloads, securing evaluation integrity against client tampering.
3. **Decoupled Telemetry & Credentials**: Player activity updates streaming buffers (Kafka/Flink) and asynchronous certificate workers (`sunbird-rc-certs`), ensuring high learner concurrency does not degrade core platform responsiveness.
