# Course — Context Diagram & System Boundary Architecture

## 1. Executive Summary & Context Scope

### 1.1 Purpose & Scope

This Context Diagram and System Boundary Document establishes the structural, environmental, and behavioral boundaries of the **General Platform Course** capability (`primaryCategory: "Course"`, `contentType: "Course"`) within the broader iGOT Karmayogi digital architecture. It models the complete lifecycle from **Quarter 2 (Q2)** through **Quarter 13 (Q13)**, documenting:

1. **External Stakeholders & Human Actors:** Course Creators, Certified Reviewers, Karmayogi Bharat SPV Central Publishers, and Public Official Learners across web and mobile surfaces.
2. **External Enterprise Systems & Identity Providers:** Parichay (e-Gov Single Sign-On), Keycloak IAM, the National Framework for Roles, Activities, and Competencies (FRAC v3/v5) taxonomy service, Digilocker, and the Sunbird RC Verifiable Credential Registry.
3. **Internal Microservice Ecosystem Boundaries:** The operational perimeter of Sunbird Content, Course, Batch, CQF, In-Video Interaction (Q11), and Telemetry Processing microservices.
4. **Data Stores, Event Streaming & CDN Infrastructures:** Cloud object stores (S3/MinIO), Neo4j graph nodes, Apache Cassandra runtime tables, ElasticSearch clusters, and Apache Kafka/Flink event streaming pipelines.

### 1.2 Evolutionary Context (Q2 to Q13)

- **Q2–Q3 (Foundational Monolith):** Basic boundaries connecting monolithic Angular web templates to Sunbird Content Service v1 with manual open batch creation.
- **Q4–Q5 (Static Quality Checklists):** Addition of MDO Reviewer rejection loops and FRAC v3 competency metadata bindings.
- **Q6 (The Modular Revamp):** Introduction of the Angular 14+ Content Builder Portal (CBP), Configurable CQF schema ingestion, and SPV Publisher gatekeeping (KB-6276, KB-6407, KB-6847, KB-7066).
- **Q7–Q8 (Automated Batching):** Integration of background batch orchestrators and distributed Redis locking engines to enforce single active open batches.
- **Q9–Q10 (AI Augmentation & Decoupling):** Integration with Python LLM orchestration services for automated course structuring and metadata rewriting (KB-8909, KB-9851).
- **Q11 (Active Video Telemetry):** Integration of the native Q11 interactive video timeline overlay engine, replacing legacy SCORM packages.
- **Q12 (Lifecycle Expansion):** Introduction of learner-driven self-serve unenrollment and re-enrollment mechanics (KB-14109, KB-14518, KB-14523).
- **Q13 (Discovery Hardening):** Deployment of responsive multi-select category search pills (`Course`) and background deduplication reconcilers (KB-15689, KAR-1351).

## 2. High-Level Context Diagram (System Boundary Level 0)

The Level 0 Context Diagram establishes the highest-level operational boundary of the **iGOT Course Ecosystem**, representing all external human actors, upstream enterprise identities, external registries, and downstream consumption surfaces.

```mermaid
flowchart LR
    UP["UPSTREAM IDENTITY & TAXONOMY<br/>Parichay (NIC SSO)<br/>Keycloak Identity Provider<br/>DoPT / FRAC Competency Repository (v3 / v5 Taxonomy)"]
    CR["COURSE CREATOR<br/>(Ministry / Department /<br/>Training Institution)"]
    RV["CONTENT REVIEWER<br/>(Certified Departmental<br/>Review Officer)"]
    SPV["SPV CENTRAL PUBLISHER<br/>(Karmayogi Bharat SPV<br/>Central Authority)"]
    CORE["iGOT KARMAYOGI<br/>GENERAL COURSE<br/>MANAGEMENT SYSTEM<br/>(Boundary Core:<br/>CBP, Ingress Gateway,<br/>Microservices Cluster,<br/>Datastores & CDN)"]
    LRN["CIVIL SERVANT /<br/>LEARNER<br/>Web Portal & Mobile<br/>(Flutter iOS/Android)"]
    KF["KAFKA / FLINK STREAM<br/>TELEMETRY ENGINE"]
    RC["SUNBIRD RC CREDENTIAL<br/>REGISTRY & DIGILOCKER"]
    ST[("STORAGE & ANALYTICS CLOUD<br/>AWS S3 / MinIO Object Storage (Binaries & Manifests)<br/>ElasticSearch Cluster (Composite Search Catalogue)<br/>Neo4j Graph Database (Hierarchy & Taxonomy)<br/>Apache Cassandra (Batch States & User Progress)")]
    UP -->|"User Auth Tokens / Roles<br/>Competency Mappings"| CORE
    CR -->|"1. Author Hierarchy"| CORE
    CR -->|"2. Upload MP4/HTML5/PDF"| CORE
    CR -->|"3. Run Mandatory CQF"| CORE
    RV -->|"4. Audit Preview & CQF"| CORE
    RV -->|"5. Approve / Line Remarks"| CORE
    SPV -->|"6. Verify Platform CQF"| CORE
    SPV -->|"7. Publish to Live"| CORE
    LRN -->|"8. Discover Course"| CORE
    LRN -->|"9. 1-Click Auto Enrol"| CORE
    LRN -->|"10. Stream MP4 Video"| CORE
    LRN -->|"11. Answer Q11 Quizzes"| CORE
    CORE -->|"12. Receive Certificate"| LRN
    CORE -->|"13. Emit Raw Telemetry<br/>(telemetry.raw)"| KF
    CORE -->|"14. Register Credentials<br/>(Verifiable Ed25519 Certs)"| RC
    CORE --> ST
```

## 3. Detailed Process Context Diagram (Level 1 Decomposition)

The Level 1 Context Diagram zooms into the operational boundary of the **General Course Management System**, delineating the interaction paths between frontends, the security/ingress boundary, distinct core microservices, and persistence engines.

```mermaid
---
title: "LEVEL 1 PROCESS CONTEXT: GENERAL COURSE LIFECYCLE"
---
flowchart LR
    subgraph FE["FRONTEND CLIENT BOUNDARY"]
        CBP["Content Builder Portal (CBP)<br/>(Angular 14+ Desktop Surface)<br/>- Basic Info (10-70 char regex)<br/>- Hierarchy Tree Builder (Units)<br/>- Media Uploader (#lt;= 400MB)<br/>- Competency v5 Mapping Dropdown<br/>- Timeline Interaction Editor"]
        CQFC["CQF Evaluation Console (CBP)<br/>- Section Breakdown View<br/>- Interactive Scoring Rubric<br/>- Reviewer Line-Item Remarks Form<br/>- Bulk CSV Schema Manager"]
        SPVD["SPV Publishing Dashboard (CBP)<br/>- Pre-Publish Quality Audit"]
        LP["Learner Web Portal (Angular)<br/>Learner Mobile App (Flutter)<br/>- Multi-Select Pills (Course)<br/>- 1-Click #quot;Enrol Now#quot; Action<br/>- Unenrollment Dashboard Modal"]
        CPE["Course Player Engine<br/>- Native HTML5 Video Player<br/>- In-Video Auto-Pause Overlay<br/>- Real-Time Telemetry Dispatcher"]
    end
    subgraph GWZ["SECURITY & API GATEWAY"]
        GW1["Nginx Ingress / Kong Gateway<br/>- TLS 1.3 Termination<br/>- Session Token (connect.sid)<br/>- Route Guards & Rate Limiting"]
        GW2["Forward to CQF Service<br/>(Inspects Role & Permissions)"]
        GW3["Validate SPV_PUBLISHER Role<br/>(Rejects if MDO Publisher)"]
        GW4["Validate User Bearer JWT<br/>Forward /course/v1/enrol<br/>Forward /course/v1/unenroll"]
        GW5["Fetch /video/v1/interactions<br/>Forward In-Video Quiz Checks<br/>Forward Telemetry Packets"]
    end
    subgraph BE["BACKEND SERVICE BOUNDARY"]
        CS["Sunbird Content Service<br/>- Content CRUD (/action/content/v3)<br/>- Hierarchy Packaging Worker<br/>- State Transition Engine"]
        NEO[("Neo4j Graph Database<br/>- Course / Module / Unit / Resource<br/>- Taxonomy & FRAC Competencies")]
        CQFS["CQF Evaluation Service<br/>- Mathematical Evaluator (Score #gt;= 50%)"]
        CQA[("Cassandra: sunbird_cqf.assessments")]
        CBS["Sunbird Course & Batch Service<br/>- Single Open Auto-Batch Resolver<br/>- Distributed Redis Concurrency Lock<br/>- Unenrollment Handler (KB-14518)"]
        CBD[("Cassandra: sunbird.course_batch<br/>Cassandra: sunbird.user_enrolments_v2")]
        Q11["Q11 Video Interaction Service<br/>- Timeline Manifest Provider<br/>- Server-Side Quiz Grader"]
        KBUS["Apache Kafka Bus"]
    end
    subgraph ASYNC["ASYNCHRONOUS EVENT STREAMING & STORAGE PERIMETER"]
        KT1["Kafka: telemetry.raw"]
        KT2["Kafka: content.publish"]
        KT3["Kafka: dev.user.unenroll"]
        FL["Apache Flink Streaming<br/>(Progress Aggregator)"]
        ES[("ElasticSearch Cluster<br/>(composite-search index)")]
        RD[("Redis In-Memory Cache<br/>(Active Dashboard Sessions)")]
        OBJ[("Cloud Object Store (AWS S3 / MinIO): Media Binaries, toc.json Manifests, Verifiable Certs")]
        KT1 -->|"Stream Ingestion"| FL
        KT2 -->|"Sync Catalog"| ES
        KT3 -->|"Evict Cache"| RD
    end
    CBP -->|"HTTPS<br/>REST Calls"| GW1
    GW1 --> CS
    CS -->|"Mutates Nodes / Hierarchy"| NEO
    CBP -->|"Launch CQF Test"| CQFC
    CQFC -->|"HTTPS<br/>POST /cqf"| GW2
    GW2 --> CQFS
    CQFS -->|"Writes Assessment Audits"| CQA
    CQFC -->|"Central Publish"| SPVD
    SPVD -->|"HTTPS<br/>POST /pub"| GW3
    GW3 --> CQA
    LP -->|"HTTPS<br/>REST Calls"| GW4
    GW4 --> CBS
    CBS -->|"Reads/Writes Batch Data"| CBD
    LP -->|"Play Stream & Overlays"| CPE
    CPE -->|"HTTPS<br/>GET /stream"| GW5
    GW5 --> Q11
    CPE -->|"Emit Telemetry Packets"| KT1
    GW5 -->|"Forward Stream"| ASYNC
    Q11 -->|"Formative Telemetry"| KBUS
    KBUS --> ASYNC
```

## 3. Data Flow Context Diagrams (DFD Level 1 & Level 2)

### 3.1 DFD Level 1: Course Authoring, Quality Validation & Live Deployment

```mermaid
flowchart TD
    CRE["Creator"]
    P1("1.0 Initiate Shell")
    P2("2.0 Upload Binaries")
    P3("3.0 Structure Tree")
    P4("4.0 Execute CQF")
    NEO[("Neo4j Graph DB")]
    S3[("S3 Object Store")]
    QS[("Cassandra: sunbird_cqf.questionset")]
    CALC["Computes Overall Score % = SUM(Section_Score * Weight / 100)"]
    BLOCK["BLOCK Review Submission"]
    PERSIST["PERSIST Evaluation"]
    ASM[("Cassandra: assessments")]
    P5("5.0 Maker-Checker Audit")
    REV["Reviewer"]
    R1["Inspects Player Preview & Creator CQF Report"]
    R2["Inputs Mandatory Per-Question Remarks"]
    DEC{"Decision:"}
    MD["Mutate State to Draft"]
    MS["Mutate State to SentToPublish"]
    SPV["SPV Publisher"]
    P6("6.0 Central Publish Live")
    ES[("ElasticSearch Cluster")]
    CB[("Cassandra: course_batch")]
    KCP[("Kafka: content.publish")]
    CRE --> P1
    P1 -->|"Writes Draft Node"| NEO
    P1 --> P2
    P2 -->|"Stream Payload (#lt;=400MB)"| S3
    P2 --> P3
    P3 -->|"Validates 10-70 Char Regex"| NEO
    P3 --> P4
    QS -->|"Read Schema"| P4
    P4 --> CALC
    P4 -->|"IF Score #lt; 50%"| BLOCK
    P4 -->|"IF Score #gt;= 50%"| PERSIST
    PERSIST --> ASM
    PERSIST --> P5
    P5 --> REV
    REV --> R1
    REV --> R2
    REV --> DEC
    DEC -->|"REJECT"| MD
    MD --> NEO
    DEC -->|"APPROVE"| MS
    MS --> NEO
    MS --> SPV
    SPV --> P6
    P6 -->|"Mutate State to Live"| NEO
    P6 -->|"Compile toc.json"| S3
    P6 -->|"Ingest Document"| ES
    P6 -->|"Auto-Create Batch"| CB
    P6 -->|"Emit Event"| KCP
```

### 3.2 DFD Level 2: Learner Discovery, 1-Click Enrolment, Playback & Full Lifecycle

```mermaid
flowchart TD
    LRN["Learner Portal / App"]
    P1("1.0 Search with #quot;Course#quot; Pill")
    ES[("ElasticSearch")]
    P2("2.0 Click #quot;Enrol Now#quot;")
    RLOCK[("Redis Concurrency Registry")]
    CB[("Cassandra: course_batch")]
    UE[("Cassandra: user_enrolments_v2")]
    P3("3.0 Launch Course Player")
    TOC[("S3: do_..._toc.json")]
    CDN[("CDN / S3 MP4 Stream")]
    Q11T["Q11 Service: Timeline JSON"]
    P4("4.0 Trigger In-Video Quiz")
    Q1["Auto-Pause Playhead at Marker Timestamp"]
    Q2["Display Responsive HTML5 Quiz Card"]
    IVS["In-Video Interaction Svc"]
    Q3["If Correct: Unlock Controls & Resume Playback"]
    P5("5.0 Emit Telemetry Events")
    KT[("Kafka: telemetry.raw")]
    FL["Apache Flink Aggregator"]
    UC[("Cassandra: user_consumption")]
    BA["BRANCH A: COMPLETION<br/>Condition: Progress == 100% & Pass Quiz"]
    BB["BRANCH B: UNENROLLMENT<br/>Learner Clicks #quot;Unenroll from Course#quot;"]
    P6("6.0 Issue Verifiable Credential<br/>- Generate PDF/SVG with Ed25519 QR")
    RC[("Sunbird RC Registry")]
    S3S[("S3 Store")]
    P7("7.0 Process Self-Serve Unenrollment")
    VC["Validate Category == #quot;Course#quot;"]
    RCACHE[("Redis Cache")]
    KU[("Kafka: dev.user.unenrolment.event")]
    RR["RE-ENROLLMENT RECOVERY"]
    RS["Sets active = true<br/>Restores Progress from user_consumption"]
    LRN --> P1
    P1 -->|"Query"| ES
    P1 -->|"Returns Faceted Course List"| P2
    P2 -->|"Acquire Lock"| RLOCK
    P2 -->|"Query Active Open Batch"| CB
    P2 -->|"Insert Enrolment (active = true)"| UE
    P2 -->|"Release Lock"| RLOCK
    P2 --> P3
    P3 -->|"Fetch Manifest"| TOC
    P3 -->|"Stream Media"| CDN
    P3 -->|"Fetch Markers"| Q11T
    P3 --> P4
    P4 --> Q1
    P4 --> Q2
    P4 -->|"Validate Answer"| IVS
    P4 --> Q3
    P4 --> P5
    P5 -->|"Dispatch START, ASSESS, END"| KT
    KT --> FL
    FL -->|"Update Leaf Counters"| UC
    FL -->|"Update Progress %"| UE
    FL --> BA
    FL --> BB
    BA --> P6
    P6 -->|"Register in"| RC
    P6 -->|"Upload Certificate to"| S3S
    BB --> P7
    P7 --> VC
    P7 -->|"Update active = false"| UE
    P7 -->|"Decrement Learner Count"| CB
    P7 -->|"Evict User Dashboard Cache"| RCACHE
    P7 -->|"Emit Bus Event"| KU
    P7 --> RR
    RR -->|"Learner Re-enrols"| RS
```

## 4. External Boundary Interface & Interaction Matrix

| External System / Actor | Interface Protocol | Boundary Direction | Consumed / Produced Data Artifacts | Security & Auth Guard | Jira Traceability |
|---|---|---|---|---|---|
| **Parichay / Keycloak** | OAuth2 / OIDC | Inbound to Gateway | User profile, unique identity token, organizational roles (`CONTENT_CREATOR`, `SPV_PUBLISHER`). | Encrypted session cookie (`connect.sid`), Bearer JWT | KB-6847, KB-7066 |
| **FRAC Competency Svc** | REST / JSON | Inbound to CBP | Hierarchical competency taxonomy (Areas, Themes, Sub-themes) for competency tagging. | Internal Microservice Token (Mutual TLS) | KB-8066, KB-6276 |
| **Cloud S3 / MinIO** | S3 API / HTTPS | Bi-Directional | Uploads raw MP4, MP3, HTML5 zips; stores pre-compiled `do_..._toc.json` manifests. | AWS Signature v4, IAM Bucket Policies | PRD 271450154 |
| **Apache Kafka Bus** | TCP / Kafka Wire | Outbound from Core | Dispatches events: `telemetry.raw`, `content.publish`, `dev.user.unenrolment.event`. | SASL_PLAINTEXT, ACL per microservice | KB-1950, KB-14518 |
| **Apache Flink Cluster** | Kafka Consumer | Bi-Directional | Ingests raw telemetry events; performs stateful windowed progress aggregation into Cassandra. | Kafka Kerberos / Internal network boundary | KB-1950, KB-6847 |
| **ElasticSearch** | REST / HTTPS | Inbound / Outbound | Ingests denormalized course documents; executes multi-select faceted search queries. | Basic Auth / Shield Role-Based Security | KB-15689, KAR-1351 |
| **Sunbird RC Registry** | REST / HTTPS | Outbound from Core | Registers issued digital credentials; generates verifiable PDF/SVG certificates with QR codes. | OAuth2 Service Credentials | PRD 271450154 |
| **Digilocker** | REST / Open API | Outbound to Govt | Syncs issued completion certificates to the citizen's national Digilocker repository. | Signed JWT / Public Key Cryptography | PRD 271450154 |

## 5. Security Boundaries, Network Segregation & Trust Zones

```mermaid
---
title: SECURITY BOUNDARIES & TRUST ZONES
---
flowchart TD
    subgraph Z1["UNTRUSTED PUBLIC ZONE: INTERNET"]
        Z1N["- Public Officials, Training Officers, Creators, Reviewers on Web and Mobile<br/>- Protocols: TLS 1.3 / HTTPS Only (Port 443)"]
    end
    subgraph Z2["DMZ & INGRESS BOUNDARY: NETWORK SECURITY LAYER"]
        Z2N["- Cloudflare / AWS Shield: DDoS Mitigation, Web Application Firewall (WAF)<br/>- Nginx Ingress Controller: Reverse Proxy, CORS Policy, Rate Limiting (100 req/min per IP)<br/>- Keycloak / Parichay Authentication Filter: Session Validation, JWT Signature Verification"]
    end
    subgraph Z3["TRUSTED APPLICATION ZONE: MICROSERVICES CLUSTER"]
        Z3N["- Sunbird Content Service, Course/Batch Service, CQF Engine, Q11 Video Interaction Service<br/>- Intra-service communication: mTLS over Private Cluster IPs<br/>- Strict Role-Based Access Control (RBAC):<br/>* Creator Operations: Enforce CONTENT_CREATOR role in JWT<br/>* Reviewer Operations: Enforce CONTENT_REVIEWER role in JWT<br/>* Live Publishing Operations: Enforce SPV_PUBLISHER role (Strictly rejects MDO Publishers)"]
    end
    subgraph Z4["RESTRICTED DATA ZONE: INTERNAL PERSISTENCE & STREAMING ENGINE"]
        Z4N["- Strictly isolated from direct Internet routing#59; accessible only via authorized VPC subnets<br/>- Neo4j Graph DB: Database authentication credentials managed via HashiCorp Vault<br/>- Apache Cassandra: Multi-datacenter replication#59; parameterized CQL queries<br/>- ElasticSearch Cluster: Dedicated ingest and master nodes with index-level read/write ACLs<br/>- Apache Kafka Cluster: Encrypted event bus topics with partitioned consumer isolation"]
    end
    Z1 --> Z2
    Z2 -->|"Private Kubernetes Service Network (VPC / CNI)"| Z3
    Z3 --> Z4
```

## 6. Implementation Task Breakdown & System Context Tracing

```mermaid
flowchart TD
    W1["1. INGRESS & BOUNDARY SECURITY WORKSTREAM<br/>Task 1.1: Configure Nginx Ingress routes for /action/content/v3 and /cqf (KB-6276)<br/>Task 1.2: Implement Parichay/Keycloak JWT claims verifier for SPV_PUBLISHER (KB-7066)<br/>Task 1.3: Set up distributed Redis lock registry for single active open batch enrolment"]
    W2["2. AUTHORING & GOVERNANCE CONTEXT WORKSTREAM<br/>Task 2.1: Implement CBP 3-step wizard boundary components in Angular 14 (KB-6847)<br/>Task 2.2: Enforce frontend/gateway title regex: ^[a-zA-Z0-9\.\-\_\$\/\:\[\]\'\ \!]+$<br/>Task 2.3: Build CQF bulk CSV schema ingestion pipeline and Cassandra mutator (KB-6408)<br/>Task 2.4: Deploy mathematical CQF evaluation engine enforcing #gt;= 50% pass gate (KB-6409)"]
    W3["3. RUNTIME CONSUMPTION CONTEXT WORKSTREAM<br/>Task 3.1: Build multi-select category search filter pills (Course) in UI (KB-15689)<br/>Task 3.2: Implement 1-click open batch assignment handler in Course Service (KB-1950)<br/>Task 3.3: Embed Q11 native video timeline overlay engine and auto-pause gates (Q11 BRD)<br/>Task 3.4: Configure Apache Flink streaming consumer on Kafka topic telemetry.raw"]
    W4["4. LIFECYCLE EXTENSION CONTEXT WORKSTREAM<br/>Task 4.1: Deploy /course/v1/unenroll handler for Course category (KB-14518)<br/>Task 4.2: Build learner dashboard confirmation modal with progress loss warnings (KB-14520)<br/>Task 4.3: Implement Kafka event publisher on topic dev.user.unenrolment.event<br/>Task 4.4: Deploy progress restoration engine for re-enrolling learners (KB-14523)"]
    W1 --> W2
    W2 --> W3
    W3 --> W4
```

## 7. Master Context Traceability Matrix

| System Context Boundary / Interaction | Primary Jira Reference | Parent Initiative / Epic | Source Component | Target Component | Production Implementation Status |
|---|---|---|---|---|---|
| **CBP Authoring Boundary (3-Step Wizard)** | KB-6847 | KB-6276 | Content Creator Web | Content Service | **Fully Implemented** |
| **Validation Bounds (10–70 Chars, )** | KB-6847 | PRD 271450154 | CBP Web Client | API Gateway | **Fully Implemented** |
| **CQF Schema Bulk CSV Ingestion** | KB-6408 | KB-6407 | SPV Publisher Portal | CQF Microservice | **Fully Implemented** |
| **Mathematical CQF Gating ()** | KB-6409 | KB-6407 | CQF Microservice | Content Service | **Fully Implemented** |
| **Maker-Checker Review & Remarking** | KB-6547, KB-7066 | KB-6276 | Reviewer Console | Cassandra `assessments` | **Fully Implemented** |
| **Central SPV Publisher Authorization** | KB-7066, KB-7126 | KB-6649 | SPV Publisher Console | Neo4j `:Course` | **Fully Implemented** |
| **Open Auto-Batch Orchestration** | KB-1950, KB-8065 | KB-1936 | Course Service | Cassandra `course_batch` | **Fully Implemented** |
| **Multi-Select Category Search Pills** | KB-15689, KAR-1351 | KB-15189 | Learner Portal Search | ElasticSearch Cluster | **Fully Implemented** |
| **Q11 Native Video Interaction Overlays** | Q11 BRD | TPT/499974191 | HTML5 Course Player | Video Interaction Svc | **Partially Implemented (Phase 1)** |
| **Self-Serve Course Unenrollment** | KB-14109, KB-14518 | KB-14109 | Learner Dashboard | Cassandra / Kafka Bus | **Fully Implemented** |
| **Re-enrollment Progress Recovery** | KB-14523 | KB-14109 | Course Service | Cassandra Consumption | **Fully Implemented** |

## 8. Conclusion

This Context Diagram and System Boundary Architecture Document defines the comprehensive environmental parameters, external entity interfaces, and internal microservice boundaries for the **Course – General Platform Course Creation & Management** capability across its evolutionary progression from **Quarter 2 through Quarter 13**.

By standardizing validation constraints across ingress boundaries, establishing mathematical Course Quality Framework gates (), decoupling video interactivity via native Q11 timeline overlays, automating open batch creation with concurrency-safe Redis locks, and providing complete lifecycle autonomy via self-serve unenrollment and re-enrollment, the architecture guarantees:

1. **Clear Environmental Segregation:** Deterministic boundaries separating untrusted public users, secure DMZ gateways, trusted internal microservices, and restricted persistence backends.
2. **Pedagogical and Structural Integrity:** Automated gating mechanisms preventing unverified or non-compliant courses from entering public indexing.
3. **Resilient Public Infrastructure:** Non-blocking asynchronous event processing, zero duplicate active batch rows, and sub-second multi-tier responsiveness capable of scaling to millions of civil servants across India.
