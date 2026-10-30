# Multilingual — System Context & Architecture Boundary

## 2. Enterprise System Context Diagram (C4 Level 1)

The following diagram maps the global system boundary of the **iGOT Karmayogi Multilingual Ecosystem**, delineating the human user personas, internal platform capabilities, external government infrastructure integrations, and persistence tiers.

```mermaid
---
title: ENTERPRISE SYSTEM CONTEXT (C4 - LEVEL 1)
---
flowchart TD
    subgraph ACT["ACTORS & STAKEHOLDERS"]
        A1["Content Creator<br/>(Author/CBP MDO)"]
        A2["Reviewer &<br/>SPV Publisher"]
        A3["Civil Service<br/>Learner (Web/App)"]
    end
    subgraph CORE["iGOT KARMAYOGI PLATFORM CORE SYSTEM BOUNDARY"]
        GW["Unified API Gateway & Reverse Proxy (NGINX / Kong Ingress)<br/>• SSL Offload • URL Rewriting • Header Sanitization (x-authenticated-user-token) • Rate Limiting"]
        S1["Content Authoring & Curation Subsystems<br/>• Course Creation Modal ([KB-9470])<br/>• Skeletal Replication Engine ([KB-9471])<br/>• Assessment Lock Engine ([KB-11053])<br/>• Unified Review Workspace ([KB-10914])"]
        S2["Cohort & Auto-Enrollment Subsystems<br/>• cb-ext Gateway Service (Node.js)<br/>• Sunbird Course Service (enrollV2)<br/>• Parent Batch Governor ([KB-9893])<br/>• Language Router & Resolvers"]
        S3["Learner Delivery Subsystems<br/>• Composite Search UI<br/>• In-Player Switch ([KB-9511])<br/>• Dynamic Cert ([KB-9542])<br/>• Gated Ratings ([KB-9543])"]
        DB[("Core Persistence & Search Engines<br/>• Apache Cassandra 4.x (sunbird keyspace: user_courses, user_content_consumption)<br/>• PostgreSQL 14+ (igot_schema: course_language_ratings, cbp_plan_multilingual_artifacts)<br/>• Elasticsearch 7.x (composite-search: nested multilingual variant indexes)<br/>• Neo4j Knowledge Graph (Content Model: Course-[:HAS_VARIANT]->Variant)")]
    end
    subgraph EXT["EXTERNAL ENTERPRISE INTEGRATIONS"]
        E1["Keycloak Identity Management<br/>• OAuth2.0 / OpenID Connect Provider<br/>• Single Sign-On (SSO) & RBAC Profiles"]
        E2["Bhashini / IndicTrans2 Gateway<br/>• Indic Language Translation API<br/>• AI CBP Multilingual Generation"]
        E3["S3 / Azure Blob Storage<br/>• Video / Audio Media Assets<br/>• SCORM Bundles & Certificates"]
        E4["Apache Flink Analytics Stream<br/>• Real-time Telemetry Pipeline<br/>• Language-tagged Consumption Events"]
        E5["SPV Notification Service<br/>• In-App Bell Alerts<br/>• Reviewer & Publisher Email Relays"]
        E6["NIC / National Portal<br/>• APAR / SPARROW Linkages<br/>• Cadre-wide Capacity Audits"]
    end
    A1 -->|"HTTPS / TLS 1.3<br/>(Bearer Auth Tokens)"| GW
    A2 -->|"HTTPS / TLS 1.3<br/>(RBAC Role Headers)"| GW
    A3 -->|"HTTPS / TLS 1.3<br/>(State / Cadre Sessions)"| GW
    GW --> S1
    GW --> S2
    GW --> S3
    S1 --> DB
    S2 --> DB
    S3 --> DB
    CORE -->|"Integrations via REST / mTLS"| EXT
```

## 3. Detailed Subsystem Boundaries & Interaction Flows

### 3.1 Course Authoring & Structural Replication Boundary

The boundary separates the Content Creator's workstation from the core Content Service, graph engine, and object store.

```mermaid
---
title: AUTHORING & SKELETAL REPLICATION SUBSYSTEM BOUNDARY
---
sequenceDiagram
    participant CW as Content Creator Workbench
    participant GW as NGINX / Gateway
    participant CS as Sunbird Content Service
    participant NEO as Neo4j & Object Store
    CW->>GW: 1. Initiate Course Draft<br/>Select Base Language #40;EN#41;
    GW->>CS: 2. POST /content/v1/create<br/>#123; primaryLanguage: "en" #125;
    CS->>NEO: 3. Create Root Node<br/>Persist Base Course Graph
    NEO-->>CS: 
    CS-->>GW: 
    GW-->>CW: 
    Note over CW,NEO: #91;AFTER BASE COURSE IS "LIVE"#93;
    CW->>GW: 4. Click #40;...#41; "Add New Language"<br/>Select Language: "Hindi"
    GW->>CS: 5. POST /content/v1/create<br/>#123; parent: do_base,<br/>language: "hindi" #125;
    CS->>NEO: 6. Traversal & Skeleton Clone:<br/>- Clone Module Hierarchy<br/>- Set compatibilityLevel=5<br/>- Lock Question Count #40;QTI#41;<br/>- Clear Media Asset URLs
    NEO-->>CS: Child Node Created #40;Draft#41;
    CS-->>GW: 8. Return Cloned Variant Schema
    GW-->>CW: 7. Cloned Structural View<br/>#40;Taxonomy & Modules Locked#41;
    CW->>GW: 9. Upload Localized MP4 Assets<br/>Translate Question Texts
    GW->>CS: 10. PUT /content/v1/upload
    CS->>NEO: 11. Write Localized Media Files
    NEO-->>CS: 
    CW->>GW: 12. Submit Hindi Variant for Review
    GW->>CS: 13. POST /review/#123;variant_id#125;
    Note over CS: 14. Status -> "In-Review"<br/>#40;Base remains "Live"#41;
```

### 3.2 Curation, CQF Verification & Publishing Boundary

Defines the boundary between Content Reviewers, SPV Publishers, the Review Workflow Engine, and the Search indexing engine.

```mermaid
---
title: CURATION & PUBLISHING GOVERNANCE BOUNDARY
---
sequenceDiagram
    participant RP as Reviewer / Publisher
    participant GW as Gateway Layer
    participant RS as Review / Publish Service
    participant ES as Elasticsearch & Neo4j
    RP->>GW: 1. Open Review Queue<br/>Unified Multi-Language View
    GW->>RS: 2. GET /content/v1/review-tabs
    RS->>ES: 3. Fetch Parent & Child Tree
    ES-->>RS: 
    RS-->>GW: 
    GW-->>RP: 4. Render Tabs:<br/>#91;EN: Live#93; #91;HI: In-Review#93;
    Note over RP: 5. Inspect Hindi Variant:<br/>CQF Checkpoint Bypassed<br/>#40;Inherited from Base Course#41;
    RP->>GW: 6. Click #91;Approve#93;
    GW->>RS: 7. POST /content/v1/approve
    Note over RS: 8. Status -> "Approved"
    Note over RP,ES: #91;PUBLISHER INTERACTION#93;
    RP->>GW: 9. Publisher clicks "Publish"
    GW->>RS: 10. POST /content/v1/publish
    Note over RS: 11. Enforce Batch Rule:<br/>- DO NOT create batch for<br/>child variant<br/>- compatibilityLevel = 5
    RS->>ES: 12. Update Parent Document:<br/>Append to variants array
    ES-->>RS: Elasticsearch Index Updated
    RS-->>GW: 
    GW-->>RP: 13. Publishing Confirmed
```

### 3.3 Learner Discovery & Auto-Enrollment V2 Boundary

Maps the interaction between the Learner Client (Web/Mobile), the `cb-ext` orchestrator, Sunbird Course Service, and Cassandra.

```mermaid
---
title: LEARNER DISCOVERY & AUTO-ENROLLMENT V2 BOUNDARY
---
sequenceDiagram
    participant LP as Learner Portal / App
    participant GW as NGINX Gateway
    participant CB as cb-ext Microservice
    participant SC as Sunbird Course / Cassandra
    LP->>GW: 1. Search Query: "Ethics"
    GW->>CB: 2. Query Elasticsearch<br/>#40;composite-search#41;
    CB-->>GW: 
    GW-->>LP: 3. Render Unified Course Card:<br/>"Ethics in Governance"<br/>Badge: "Available in 2 langs"
    Note over LP: 4. Click Enroll -> Select "Hindi"
    LP->>GW: 5. GET /cohorts/autoenrollment/#123;id#125;<br/>Header: language: hindi<br/>Header: wid: #lt;user_id#gt;
    GW->>CB: 6. Proxy to cb-ext
    Note over CB: 7. Resolve Parent Base Course<br/>8. Resolve Active Parent Batch<br/>9. Map Language -> Child DO_ID<br/>10. Check Cassandra Idempotency
    CB->>SC: 11. POST /api/course/v2/enrol<br/>#123; userId,<br/>courseId: child_id,<br/>batchId: parent_batch,<br/>language: "hindi" #125;
    Note over SC: 12. Upsert user_courses record:<br/>enrolled_language = "hindi"
    SC-->>CB: 
    CB-->>GW: 14. Relayed HTTP 200 OK
    GW-->>LP: 13. Return Success Envelope<br/>Route to Hindi TOC/Player
```

### 3.4 Consumption, Language Switching & State Isolation Boundary

Controls the boundary between the media player, telemetry pipeline, and progress persistence.

```mermaid
---
title: CONSUMPTION & PROGRESS ISOLATION BOUNDARY
---
sequenceDiagram
    participant CP as Course Player Component
    participant GW as NGINX Gateway
    participant CS as Content / Course Service
    participant CA as Cassandra Consumption Store
    Note over CP: 1. Consuming in Hindi #40;40%#41;
    CP->>GW: 2. Emit Telemetry Progress
    GW->>CS: 3. Ingest Progress Event
    CS->>CA: 4. Upsert Cassandra:<br/>user_content_consumption<br/>#40;..., lang: "hindi", 40%#41;
    CA-->>CS: 
    Note over CP: 5. User selects "English" Dropdown<br/>6. Display Warning Dialog:<br/>"Progress resets to 0% in EN"<br/>7. User confirms #91;Switch Language#93;
    CP->>GW: 8. GET /hierarchy/#123;en_do_id#125;
    GW->>CS: 9. Fetch English Hierarchy
    CS->>CA: 10. Query English Progress:<br/>Check #40;userId, course, "en"#41;
    CA-->>CS: Result: 0% #40;Unstarted#41;
    CS-->>GW: 12. Return English Tree
    GW-->>CP: 11. Load English Player from Start<br/>#40;Hindi 40% remains safe in DB#41;
```

### 3.5 Dynamic Certification & Rating Gating Boundary

Governs the final evaluation, dynamic certificate generation, and localized review submission.

```mermaid
---
title: CERTIFICATION & LOCALIZED RATING BOUNDARY
---
sequenceDiagram
    participant LP as Learner Portal UI
    participant FT as Flink Telemetry
    participant RC as Sunbird-RC Cert Service
    participant PG as PostgreSQL / Cert Vault
    LP->>FT: 1. Completes Final Assessment<br/>in Hindi Variant #40;100%#41;
    FT->>RC: 2. Evaluate Completion Criteria<br/>tagged with: language=hindi
    RC->>PG: 3. Query Issued Certs:<br/>Check existing cert records
    PG-->>RC: Result: None #40;First Finish#41;
    Note over RC: 4. Dynamic Title Resolution:<br/>Resolve: "शासन में नैतिकता"<br/>5. Render Certificate PDF
    RC->>PG: 6. Persist Issued Certificate
    PG-->>RC: 
    RC-->>FT: 8. Emit Certificate Ready Event
    FT-->>LP: 7. Certificate Available<br/>#40;Title printed in Hindi#41;
    Note over LP,PG: #91;RATING & FEEDBACK GATING#93;
    LP->>RC: 9. Click "Rate Course" in Hindi
    Note over RC: 10. Gating Validation:<br/>Verify consumption >= 50%<br/>Result: 100% -> PASS
    RC-->>LP: 11. Render 1-5 Star Form
    LP->>RC: 12. Submit: 5 Stars + Review
    RC->>PG: 13. Persist Localized Rating:<br/>course_language_ratings<br/>#40;userId, child_id, "hindi"#41;
    PG-->>RC: 
    RC-->>LP: 14. Submission Success
```

## 4. External Interfaces & Protocol Specifications

**EXTERNAL PROTOCOL & INTERFACE SPECIFICATIONS**

| Target Interface | Protocol / Port | Data Format | Security & Boundary Controls |
| --- | --- | --- | --- |
| **Keycloak IdP** | HTTPS / 443 | JSON / JWT | OAuth2 OpenID Connect; Bearer token validation at API Gateway; Token exchange injecting wid, rootorg, locale headers. |
| **Bhashini Gateway** (AI CBP [KB-12918]) | HTTPS / 443 | JSON / REST | IndicTrans2 API; Encrypted API-key authentication; used for Indic Capacity Building Plan translation (11 Indic languages). |
| **Object Store** (Media & Bundles) | HTTPS / 443 | S3 API / Binary | MinIO / Azure Blob; Pre-signed PUT/GET URLs; binary isolation of localized MP4, MP3, and SCORM ZIP packages. |
| **Kafka Event Bus** | TCP / 9092 | Apache Avro | Telemetry pipeline; SASL/SCRAM authenticated; topics: telemetry.raw, learning.events, certificate.issue. |
| **Cassandra Pool** | TCP / 9042 | CQL Binary v4 | Encrypted client-to-node communication; partitioned by userid and clustered by courseid, batchid, and language. |

## 5. Security Architecture, Trust Boundaries & Threat Analysis

**SECURITY BOUNDARIES & THREAT MITIGATIONS**

| Security Boundary | Identified Threat Vector | Architecture Guard & Mitigation Design |
| --- | --- | --- |
| **Ingress Layer** | Parameter tampering & header spoofing (wid, rootorg, locale) | NGINX strips inbound x-authenticated-* headers from public internet; Node-BFF securely injects validated session attributes. |
| **Skeletal Cloner** | Unauthorized structural deviations & assessment tampering in translations | Hierarchy engine strictly blocks structural additions or deletions in child variants (disableAddQuestion = true - [KB-11053]). |
| **AutoEnroll V2** | Cross-cadre batch injection & cohort exhaustion | Gateway checks learner enrollment eligibility against active parent open batch before dispatching payload to Sunbird enrollV2. |
| **State Store** | Cross-language progress contamination (e.g., Hindi progress leaking to EN) | Cassandra clustering keys partitioned strictly on composite (batchid, contentid, language) preventing state overwrites. |
| **Cert Engine** | Title injection spoofing or malicious override of issued certificates | Sunbird-RC dynamically fetches validated course name directly from trusted Neo4j content metadata; certificates locked after issue. |

## 6. Requirement-to-Context Verification Matrix

| Jira Enabler / Doc Reference | Architectural Capability Implemented | Primary Context Boundary Diagram | Verification & Test Evidence |
|---|---|---|---|
| [KB-9470: Q8 \| Multilingual content creation \| Course Language Selection](https://karmayogibharat.atlassian.net/browse/KB-9470) (Prod Deployed) | Mandatory Base Language Modal | Section 3.1 Authoring Boundary | QA Suite Test 1.1–1.3 (Page `470777876`) |
| [KB-9471: Q8 \| Multilingual content creation \| Module Template Consistency and Teacher's Notes](https://karmayogibharat.atlassian.net/browse/KB-9471) (Prod Deployed) | Structural Module Replication | Section 3.1 Authoring Boundary | QA Suite Test 2.1–2.18 (Page `470777876`) |
| [KB-11053: Q8 \| Multilingual Content Creation \| Assessment Settings and Behavior During Edit](https://karmayogibharat.atlassian.net/browse/KB-11053) (Prod Deployed) | Assessment Parity & Question Count Lock | Section 3.1 Authoring Boundary | Jira [KB-11053: Q8 \| Multilingual Content Creation \| Assessment Settings and Behavior During Edit](https://karmayogibharat.atlassian.net/browse/KB-11053) (Prod Deployed) Acceptance Criteria |
| [KB-10914: Q8 \| Multilingual Content Creation \| Reviewer/Publisher View – Unified Review Experience](https://karmayogibharat.atlassian.net/browse/KB-10914) (Open) | Unified Multi-Language Review Workspace | Section 3.2 Curation Boundary | QA Suite Test 5.1–5.17 (Page `470777876`) |
| [KB-11055: Q8 \| Multilingual Content Creation \| CQF Behavior for New Languages](https://karmayogibharat.atlassian.net/browse/KB-11055) (Open) | CQF Single Enforcement on Base Course | Section 3.2 Curation Boundary | QA Suite Test 15.1–15.2 (Page `470777876`) |
| [KB-9893: Q8 \| Multilingual Content Creation \| Publisher Flow](https://karmayogibharat.atlassian.net/browse/KB-9893) (Prod Deployed) | Single-Batch Publisher Rule (`level = 5`) | Section 3.2 Curation Boundary | QA Suite Test 11.1–11.25 (Page `470777876`) |
| [KB-9510: Q8 \| Multilingual Content Creation \| Learner Portal \| Multiple language visibility on course cards and TOC page](https://karmayogibharat.atlassian.net/browse/KB-9510) (Prod Deployed) | Single Card Footprint & Language Badge | Section 3.3 Discovery Boundary | QA Suite Test 7.1–7.9 (Page `470777876`) |
| **Page 445349895** | AutoEnroll V2 API Gateway Orchestration | Section 3.3 Discovery Boundary | Confluence Page `445349895` Contract |
| [KB-9511: Q8 \| Multilingual Content Creation \| Course Consumption](https://karmayogibharat.atlassian.net/browse/KB-9511) (Prod Deployed) | In-Player Switching Warning & State Isolation | Section 3.4 Consumption Boundary | QA Suite Test 8.1–8.12 (Page `470777876`) |
| [KB-9542: Q8 \| Multilingual Content Creation \| Certificate Generation](https://karmayogibharat.atlassian.net/browse/KB-9542) (Prod Deployed) | First-Completion Localized Certificate Title | Section 3.5 Certification Boundary | QA Suite Test 9.1–9.13 (Page `470777876`) |
| [KB-9543: Q8 \| Multilingual Content Creation \| Separate rating for separate languages](https://karmayogibharat.atlassian.net/browse/KB-9543) (Open) | 50% Consumption Gating for Ratings | Section 3.5 Certification Boundary | QA Suite Test 10.1–10.12 (Page `470777876`) |
| [KB-12918: Q11 \| Multilingual ACBP/CBP in AI CBP tool](https://karmayogibharat.atlassian.net/browse/KB-12918) (In-Progress) | AI CBP Multilingual Indic Plan Generation | Section 2 Enterprise Context | Jira [KB-12918: Q11 \| Multilingual ACBP/CBP in AI CBP tool](https://karmayogibharat.atlassian.net/browse/KB-12918) (In-Progress) Deployment Logs |
