# Moderated Assessment — System Context Diagram & Boundary Architecture Specification

## 2. Purpose, Scope & System Boundary Definition

### 2.1 Purpose

This document defines the **System Context Architecture** for the **Moderated Assessment Subsystem** within the iGOT Karmayogi digital learning and competency-building platform. It delineates external user personas, third-party enterprise integrations, peripheral platform subsystems, operational trust boundaries, and network data flows governing the entire lifecycle from assessment authoring to proctored learner consumption and certified competency reporting.

### 2.2 System Boundary & Scope

The **Moderated Assessment Subsystem Boundary** encompasses:

- **Authoring & Ingestion Perimeter:** Tools for creating rich question banks (SCQ, MCQ, FTB inline dropdowns, and media up to 400 MB), schema sanitization, and workflow moderation.
- **Access Control & Gating Engine:** Whitelisting algorithms verifying Ministry, Department, and Organization (MDO) hierarchies, cadre, designation groups, and Verified Karmayogi claims.
- **Prerequisite Assessment Locking:** Dependency validation engines that enforce 100% completion of foundational learning modules in Curated Programs before unlocking L2 evaluations.
- **Zero-Knowledge Player Runtime:** Single-sitting execution, server-side timer synchronization, autosave telemetry, and answer obfuscation.
- **Server-Side Grading & Credentialing:** Server-side negative marking algorithms, Cassandra persistence, and event-driven certificate triggers.

## 3. Architectural Context Evolution (Q2 Baseline vs. Q13 Modern Architecture)

### 3.1 Q2 Baseline Context: Shared LMS Monolith & Open Proxy

In Quarter 2 (Q2), assessment execution operated without dedicated moderation or cohort-isolation boundaries:

- Assessments were authored as generic quizzes or open standalone tests.
- The platform automatically triggered public, self-enrollment batch generation via Flink streaming jobs.
- Catalog visibility was open; assessments appeared across platform-wide search results regardless of learner department or competency path.
- Grading was partially delegated to client runtimes, risking key exposure and local clock tampering.

```mermaid
---
title: Q2 BASELINE CONTEXT TOPOLOGY
---
flowchart LR
    U["All Users / Public"]
    B["Web Browser"]
    K["Kong API Gateway"]
    C["Monolithic Course Service"]
    E[("Public Elasticsearch<br/>(Unrestricted Search)")]
    U --> B
    B --> K
    K --> C
    C --> E
```

### 3.2 Q13 Target Architecture: Decoupled, Proctored & Cohort-Gated Ecosystem

By Quarter 13 (Q13), the platform completed a micro-architectural transformation driven by targeted Epics ([KB-1936: Q3 | Content Portal Redesign | Content access settings, batch management and user consumption](https://karmayogibharat.atlassian.net/browse/KB-1936) (Prod Deployed), [KB-3958: Q4 | Assessments Creation and Consumption](https://karmayogibharat.atlassian.net/browse/KB-3958) (Prod Deployed), [KB-8065: Q8 | L2 Assessments/CAP | Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved), [KB-9603: Q8 | Access Control | User Group based Access Control](https://karmayogibharat.atlassian.net/browse/KB-9603) (Prod Deployed), [KB-13097: Q11 |Tech Debt | Frontend and Backend Service enhancement](https://karmayogibharat.atlassian.net/browse/KB-13097) (Open)):

- **Decoupled Assessment Microservice:** Dedicated `cb-ext-assessment-service` enforcing zero-knowledge payload delivery.
- **Suppressed Auto-Batching:** Stream-level interception in Apache Flink blocks automatic open batch creation for `courseCategory = "Moderated Assessment"`.
- **Prerequisite Assessment Locking:** L2 assessments inside Curated Programs remain locked until upstream module completion is verified.
- **Strict Cohort Whitelisting:** Multi-attribute access matching MDO IDs, designation groups, and verified credentials.

```mermaid
---
title: Q13 TARGET CONTEXT TOPOLOGY
---
flowchart LR
    T["Target MDO Cohort"]
    P["Zero-Knowledge Player"]
    G["mTLS Gateway"]
    A["Assessment Microservice"]
    PE["Prerequisite Evaluator"]
    R[("Redis Session Lock")]
    S["Server Grading Core"]
    CR[("Cassandra Ring")]
    T --> P
    P --> G
    G --> A
    A --> S
    S --> R
    R --> PE
    S --> CR
```

## 4. Primary System Actors & External Stakeholders

**ACTOR ROLE & INTERACTION MODEL**

| Actor / Persona | Operational Responsibility | Target Surface / Interface |
|---|---|---|
| **Content Creator**<br/>(ATIs, CTIs, MDO SMEs) | Ingests CSVs, drafts questions, configures pass mark (>=50%), defines negative marking. | CBP Content Builder Portal<br/>(Angular 15+ Web) |
| **Content Reviewer**<br/>(Quality Auditors) | Audits question difficulty, verifies answer keys, approves or rejects with remarks. | CBP Review & Moderation Canvas<br/>(Angular 15+ Web) |
| **Content Publisher**<br/>(SPV Administrator) | Issues final publishing token, transitions state to Live, confirms access policies. | CBP Publishing Workspace<br/>(Angular 15+ Web) |
| **Program Coordinator**<br/>(MDO Admin) | Creates manual batches, maps whitelisted cohorts, uploads participant lists. | MDO Administration Portal<br/>(Angular 15+ Web) |
| **Target Civil Servant**<br/>(Learner) | Discovers eligible tests, signs honor code, completes single-sitting exams, views scores. | Learner Portal & Mobile App<br/>(Angular 15+ Web / Flutter 3.x Mobile) |
| **Department Auditor**<br/>(DoPT / SPV Leadership) | Monitors completion rates, reviews score distributions, exports audit CSVs. | National Training Dashboard<br/>(Metabase / Custom Angular Views) |

## 5. Connected External Systems & Enterprise Integrations

```mermaid
flowchart LR
    IDP["Government Identity Provider<br/>(Parichay / Jan Parichay / NIC)"]
    UID["National Aadhaar<br/>Verification (UIDAI<br/>e-KYC Gateway)"]
    CDN["Object Storage CDN<br/>(GCS / AWS S3 via<br/>Cloudflare Edge)"]
    NEO["Neo4j Competency<br/>Taxonomy Graph<br/>(DoPT Framework)"]
    PLAT["iGOT KARMAYOGI PLATFORM<br/>MODERATED ASSESSMENT SUBSYSTEM<br/><br/>- Authoring & Ingest Pipelines<br/>- Cohort Whitelisting & Gating<br/>- Single-Sitting Zero-Knowledge Core<br/>- Server-Side Scoring Core"]
    DL["DigiLocker / CASS<br/>Certificate Engine<br/>(Signed PDF / QR)"]
    SMS["Telecom SMS/WhatsApp<br/>Notification Gateway<br/>(Exam Reminders)"]
    NTA["National Training<br/>Analytics Dashboard<br/>(DoPT APAR / SPV)"]
    IDP -->|"OIDC / OAuth 2.0 (RS256)"| PLAT
    UID --> PLAT
    CDN --> PLAT
    NEO --> PLAT
    PLAT --> DL
    PLAT --> SMS
    PLAT --> NTA
```

1. **Government Identity Provider (Parichay / NIC SSO):** Authenticates civil servants via OpenID Connect (OIDC), providing signed JWT assertions with user ID, department code, and designation.
2. **Aadhaar e-KYC Verification Gateway:** Validates government profile authenticity, populating the `isVerified: true` claim required for Verified Karmayogi gating ([KB-9603: Q8 | Access Control | User Group based Access Control](https://karmayogibharat.atlassian.net/browse/KB-9603) (Prod Deployed)).
3. **DigiLocker National Credential Registry:** Ingests digitally signed XML/PDF certificates emitted upon successful evaluation.
4. **Cloud CDN & Object Storage (GCS / S3):** Distributes static media question prompts (MP4 videos up to 400 MB, audio clips, and reference PDFs) via signed time-limited URLs ([KB-3971: Q4 | Assessments | Adding Questions | Fill in the blanks](https://karmayogibharat.atlassian.net/browse/KB-3971) (Prod Deployed)).
5. **Neo4j Competency Taxonomy Service:** Maps assessment questions to national civil service behavioral, domain, and functional competencies.
6. **National Training Analytics & DoPT Dashboard:** Consumes assessment completion records for annual performance appraisals (APAR) and cross-ministry training metrics ([KB-15322: Q13 | MDO Portal | APAR Creation Enhancements - Phase 2](https://karmayogibharat.atlassian.net/browse/KB-15322) (Prod Deployed)).

## 6. Level 1: Enterprise System Context Diagram

This C4 Level 1 diagram illustrates the boundary between primary human actors, external enterprise systems, and the iGOT Karmayogi Moderated Assessment Subsystem.

```mermaid
---
title: "C4 LEVEL 1: ENTERPRISE SYSTEM CONTEXT"
---
flowchart TD
    A1["Content Creator<br/>(ATI/CTI Authors)"]
    A2["Content Reviewer<br/>(Quality Auditors)"]
    A3["Content Publisher<br/>(SPV Administrators)"]
    A4["Program Coordinator<br/>(MDO Administrators)"]
    A5["Target Civil Servant<br/>(Enrolled Learners)"]
    subgraph PP["iGOT KARMAYOGI PRESENTATION PORTALS"]
        CBP["CBP Content Builder Portal (Angular 15+)<br/>- Rich Question Canvas (SCQ/MCQ/FTB/Media)<br/>- Whitespace Auto-Trim Validation Engine<br/>- Cascading Access Policy Configurator"]
        LP["Learner Portal (Web & Flutter Mobile)<br/>- #quot;My Assigned Content#quot; Discovery Strip<br/>- Program TOC & Prerequisite Gating State<br/>- Zero-Knowledge Single-Sitting Test Player"]
    end
    GW["SECURITY PERIMETER & API GATEWAY (KONG / NGINX INGRESS)<br/><br/>- OIDC Identity Token Validation (Parichay RS256 Verification against Public Key Ring)<br/>- Web Application Firewall (WAF): Rate Limiting (100 req/s), SQLi/XSS Inspection, File Scanning<br/>- API Reverse Proxying & Internal Path Routing (/apis/proxies/v8/action/assessment/*)"]
    subgraph CC["iGOT KARMAYOGI CORE APPLICATION COMPUTE CLUSTER"]
        UP["cb-ext-userprofile<br/>- MDO Hierarchy Resolution<br/>- Verified Profile Auditing<br/>- Cadre & Designation Rules"]
        CS["cb-ext-course-service<br/>- Curated Program Hierarchy<br/>- Leaf Node Completion DAG<br/>- Ephemeral JWT Signer"]
        AS["cb-ext-assessment-service<br/>- Obfuscated QuestionSet Delivery Core<br/>- Single-Sitting Redis Distributed Lock<br/>- Server-Side Evaluation Engine (Negative Marks)"]
        SS["cb-search-service<br/>- Faceted Filter Proxy<br/>- MDO Whitelist Matcher"]
        ES["cb-enrollment-service<br/>- Manual Cohort Assigner<br/>- Batch Deduplication Job"]
        CRS["CertRegistry Service<br/>- Digital Signature Generator (PKCS#35;7)<br/>- PDF Certificate Rendering Engine"]
    end
    subgraph ST["STREAMING, ANALYTICS & PERSISTENCE TIER"]
        KF["Apache Kafka Event Hub<br/>- Topic: content.publish.pipeline<br/>- Topic: telemetry.assess.raw<br/>- Topic: cert.generation.trigger"]
        FL["Apache Flink Streaming Mesh<br/>- BatchCreationSuppressorJob (Drops Auto-Batch)<br/>- TelemetryDeduplicationJob (Syncs State)<br/>- RealTimeAnalyticsJob (Rolls Up Performance)"]
        PG[("PostgreSQL 14 Cluster<br/>- Master Question Banks & Stems<br/>- Ground-Truth Answer Keys (Server Only)<br/>- Access Control Policies & Whitelists")]
        CA[("Cassandra 4.x Ring<br/>- sunbird.user_enrolments_v2 (Prerequisite State)<br/>- sunbird.assessment_attempt_records (Attempt Logs)<br/>- sunbird.telemetry_assess_state (Autosave Drawer)")]
    end
    A1 -->|"(Ingest CSV)"| CBP
    A2 -->|"(Audit Keys)"| CBP
    A3 -->|"(Publish Live)"| CBP
    A4 -->|"(Assign Batches)"| PP
    A5 -->|"(Take Exam)"| LP
    CBP -->|"HTTPS / TLS 1.3 Strict"| GW
    LP -->|"HTTPS / TLS 1.3 Strict"| GW
    GW -->|"Internal Private Network (mTLS)"| CC
    UP --> SS
    CS --> ES
    AS --> CRS
    CC -->|"Event Streams & Telemetry"| ST
    KF --> FL
    KF --> PG
    FL --> CA
```

## 7. Level 2: Subsystem Interaction & Boundary Context Diagrams

### 7.1 Authoring, Bulk Ingestion & Moderation Lifecycle Context

This context boundary diagram illustrates how question banks are authored, validated, sanitized, reviewed, and published without triggering public batching.

```mermaid
flowchart TD
    AU["Author / SME"]
    BP["Ingestion Boundary: BulkUploadParser"]
    DR[("Draft Assessment Entity<br/>(PostgreSQL Master Store)")]
    RV["Content Reviewer"]
    RC["Review & Audit Controller"]
    SP["SPV Publisher"]
    PO["Publishing Orchestrator"]
    FJ["Apache Flink Stream Job<br/>- Check: courseCategory == #quot;Moderated Assessment#quot;<br/>- Action: Suppress Public Batch"]
    AU -->|"(1) Uploads CSV Question Matrix"| BP
    BP -->|"(2) Whitespace Auto-Trim (KB-13076)<br/>(3) Schema Validation (Marks #gt;= 50%)"| DR
    DR -->|"(4) Submit for Review"| RC
    RC -->|"(5) Read Obfuscated Review Tree"| RV
    RV -->|"(6) Approve"| SP
    SP -->|"(7) Execute Live Transition"| PO
    PO -->|"(8) Persist State: LIVE<br/>(9) Dispatch Kafka Event: #quot;content.publish.pipeline#quot;"| FJ
```

### 7.2 Access Control, Whitelisting & User Segmentation Context

This context boundary defines how learner discovery requests are evaluated against multi-tiered organizational attributes.

```mermaid
flowchart TD
    REQ["Learner Session Request: GET /catalog"]
    KG["Kong API Gateway Edge<br/>(Extracts Parichay Profile Claims)"]
    ACG["Access Control Gatekeeper Microservice"]
    PEE["Profile Evaluation Engine:<br/>- Authenticated Org ID (e.g., org_dopt_01)<br/>- Designation Group (e.g., Joint Secretary, UnderSec)<br/>- Verified Karmayogi Status (isVerified == true)"]
    POL["Stored Assessment Access Policy:<br/>- Allowed Orgs: [org_dopt_01, org_railways_02]<br/>- Require Verified Badge: TRUE<br/>- Designation Groups: UnderSec AND Above"]
    RES{"(3) Access Resolution"}
    MT["Match = TRUE"]
    MF["Match = FALSE"]
    EX["Expose Card in Catalog<br/>(HTTP 200 with Card)"]
    MK["Mask Card Completely<br/>(HTTP 200 Empty / HTTP 403 Forbidden)"]
    REQ --> KG
    KG --> ACG
    ACG -->|"(1) Query User Attributes"| PEE
    PEE -->|"(2) Compare Against Whitelist Policy"| POL
    POL --> RES
    RES --> MT
    RES --> MF
    MT --> EX
    MF --> MK
```

### 7.3 Curated Program Gating & Prerequisite Locking Context (L2 Assessments)

This context boundary illustrates the dependency validation engine gating final assessments within Curated Programs.

```mermaid
flowchart TD
    A["Learner Clicks Curated Program TOC"] --> B["Curated Program TOC Controller"]
    B -->|"(1) Query Enrolled Course Progress"| C[("Cassandra: sunbird.user_enrolments_v2")]
    C -->|"(2) Return Upstream Module Metrics"| D["Program DAG State Analysis:<br/>Course 01: Foundational Governance → 100% Done<br/>Course 02: Public Procurement → 100% Done<br/>Course 03: Service Conduct Rules → 60% Done"]
    D -->|"(3) Prerequisite Evaluation"| E["Courses Incomplete"]
    D -->|"(3) Prerequisite Evaluation"| F["All Courses 100% Complete"]
    E --> G["Render TOC: LOCKED<br/>Disable Start CTA<br/>Microcopy: #quot;Complete Course 03 to unlock#quot;"]
    F --> H["Issue Ephemeral Token<br/>Sign HMAC-SHA256 Token (120s TTL)<br/>Enable #quot;Start Assessment#quot; CTA"]
```

### 7.4 High-Integrity Single-Sitting Runtime & Telemetry Context

This context boundary details runtime test delivery: single-sitting enforcement, countdown synchronization, and continuous autosave state logging.

```mermaid
flowchart TD
    A["Learner Launches Exam (Supplies JWT Token)"] --> B["API Gateway Session Terminus"]
    B --> C["Session Manager & Redis Lock Engine"]
    C -->|"(1) Acquire Single-Sitting Lock: SET assessment:session:{userId}:{attemptId} ACTIVE EX {duration}<br/>(2) Initialize Authoritative Server Clock: ServerTimestamp = NOW(), ExpiresAt = NOW() + (Duration * 60)"| D["QuestionSet Obfuscation Service"]
    D -->|"(3) Retrieve Master JSON from PostgreSQL<br/>(4) Strip All Ground-Truth Answer Keys<br/>(5) Randomize Question & Option Sequences"| E["Render Player in Angular / Flutter UI"]
    E --> F["Active Exam Runtime Loop:<br/>Client Timer Syncs via Heartbeat<br/>Answers Emitted to Cassandra<br/>Navigation Drawer Updates State"]
    F -->|"(6) Learner Submits or Timer Hits 00:00"| G["Server-Side Scoring Engine"]
    G -->|"(7) Compare Selected Options vs. Ground Truth<br/>(8) Apply Formula: FinalScore = (Correct * Marks) - (Incorrect * NegMarks)<br/>(9) Determine PASSED / FAILED against overallPassMarks"| H[("Cassandra Attempt Storage")]
    H --> I["Emit Kafka Event: #quot;cert.generation.trigger#quot;"]
```

### 7.5 Server-Side Evaluation, Certification & Analytics Context

This context boundary defines the automated grading, certification dispatch, and dashboard rollup data pipelines.

```mermaid
flowchart TD
    LCT["Learner Completes Test"]
    SEE["Server Evaluation Engine"]
    KAF["Apache Kafka: assessment.submit.events"]
    FJ["Apache Flink Stream Job: AnalyticsRollup"]
    CRT[("Cassandra Rollup Tables<br/>(Attempt History & Audit)")]
    ERI[("Elasticsearch Rollup Index<br/>(Aggregate Histograms)")]
    PDS["Provider Dashboard Service"]
    PORTAL["MDO / ATI Administrator Portal<br/>- Offering Breakdown Pills (Live, Draft, Retired)<br/>- Pass/Fail Ratios & Cohort Score Distributions<br/>- Departmental Audit CSV / XLS Data Exports"]
    LCT --> SEE
    SEE -->|"(1) Graded Outcome"| KAF
    KAF --> FJ
    FJ -->|"(2) Stateful Window Aggregation"| CRT
    FJ -->|"(2) Stateful Window Aggregation"| ERI
    CRT -->|"(3) Query Analytics"| PDS
    ERI -->|"(3) Query Analytics"| PDS
    PDS --> PORTAL
```

## 8. Data Flow Context Matrix (Inbound vs. Outbound Boundary Interactions)

**DATA FLOW & BOUNDARY PROTOCOL MATRIX**

| Flow ID | Source System | Destination System | Protocol / Wire | Payload & Data Elements | Security & Encryption |
|---|---|---|---|---|---|
| **F-01** | Content Creator (CBP) | Kong API Gateway | HTTPS / REST | Multi-part CSV / JSON<br/>Question stems, options | TLS 1.3, Bearer JWT |
| **F-02** | Kong API Gateway | cb-ext-assessment | mTLS / REST | Sanitized QuestionSet<br/>with ground-truth keys | Internal Mesh mTLS |
| **F-03** | cb-ext-assessment | PostgreSQL Master | JDBC / HikariCP | Ingested nodes, sections,<br/>ground truth, access rules | Encrypted EBS / LUKS |
| **F-04** | cb-ext-assessment | Apache Kafka Cluster | Kafka TCP | "content.publish.pipeline"<br/>Event with category meta | TLS Auth, SASL/SCRAM |
| **F-05** | Learner Portal / App | Kong API Gateway | HTTPS / REST | OIDC auth token, profile<br/>lookup, catalog request | TLS 1.3, RS256 Tokens |
| **F-06** | cb-ext-course | Cassandra Ring | CQL (Binary) | Query module progress in<br/>user_enrolments_v2 | Encrypted at rest,<br/>Private VPC subnets |
| **F-07** | cb-ext-course | Learner Player Client | HTTPS / REST | Ephemeral launch token<br/>with 120-second TTL | Signed HMAC-SHA256,<br/>Short-lived TTL |
| **F-08** | cb-ext-assessment | Redis Sentinel Ring | Redis Binary | Distributed session lock<br/>with examination duration | In-memory AUTH,<br/>Isolated Redis subnet |
| **F-09** | cb-ext-assessment | Learner Player Client | HTTPS / REST | Obfuscated question array,<br/>server timestamps (no keys | Zero-knowledge,<br/>No keys in payload |
| **F-10** | Learner Player Client | cb-ext-assessment | HTTPS / REST | Selected option IDs, time<br/>spent, answer submission | TLS 1.3, Nonce validation |
| **F-11** | cb-ext-assessment | Cassandra Ring | CQL (Binary) | Writes attempt record and<br/>final evaluation status | ChaCha20 encrypted<br/>JSON string blob |
| **F-12** | cb-ext-assessment | Apache Kafka Cluster | Kafka TCP | "cert.generation.trigger"<br/>with score and status | TLS Auth, SASL/SCRAM |
| **F-13** | CertRegistry Worker | DigiLocker Connector | HTTPS / REST | Signed PDF certificate,<br/>candidate Aadhaar ref | PKCS#7 Digital Sign,<br/>Government e-Sign API |

## 9. Security, Perimeter & Trust Boundary Architecture

```mermaid
---
title: OPERATIONAL TRUST ZONES
---
flowchart TD
    subgraph Z1["ZONE 1: PUBLIC UNTRUSTED BOUNDARY"]
        N1["Learner Web Browsers (Angular 15+) & Mobile Devices (Flutter 3.x Native Dart)<br/>Content Creator / MDO Admin Workspaces<br/>Threat Model: Cross-Site Scripting (XSS), Local Clock Tampering, DOM Inspection, MitM"]
    end
    subgraph Z2["ZONE 2: PERIMETER DEMILITARIZED ZONE (DMZ)"]
        N2["Cloudflare Edge CDN & WAF<br/>Kong API Gateway Cluster / NGINX Public Ingress Controller<br/>Enforcement: Rate Limiting (Token Bucket), OIDC RS256 Verification, Session Terminus"]
    end
    subgraph Z3["ZONE 3: TRUSTED PRIVATE COMPUTE CLUSTER"]
        N3["Kubernetes Compute Nodes (Isolated Private Subnet / VPC)<br/>Microservices: cb-ext-assessment, cb-ext-course, cb-ext-userprofile, CertRegistry<br/>Redis Sentinel Distributed Lock Cluster<br/>Zero-Knowledge Serialization Engine (Omits answer keys from client DTOs)"]
    end
    subgraph Z4["ZONE 4: SECURE STATE & PERSISTENCE ZONE"]
        N4["PostgreSQL 14 Master Ring (Master ground truth answer keys, access policies)<br/>Apache Cassandra 4.x Ring (User enrollments, attempt audit logs, telemetry state)<br/>Apache Kafka Cluster (Internal event streams, cert triggers, audit pipelines)<br/>Encryption: Block-level LUKS AES-256 storage, ChaCha20 application-level encryption"]
    end
    Z1 -->|"HTTPS / TLS 1.3 Encrypted"| Z2
    Z2 -->|"Mutual TLS (mTLS) Mesh"| Z3
    Z3 -->|"Private VPC Peering / Dedicated Ports"| Z4
```

### 9.1 Zero-Knowledge Data Boundary Design

- Ground truth answer keys (`answer_key` JSONB in PostgreSQL) never cross the boundary from Zone 3 to Zone 1.
- During learner assessment initialization, Jackson serialization filters dynamically strip all validation properties, sending only randomized option IDs, obfuscated stems, and difficulty metadata to the client.

### 9.2 Anti-Tampering & Clock Boundary Enforcement

- Examination countdown limits are governed entirely within Zone 3. The client receives an authoritative `expiresAt` epoch timestamp.
- Client heartbeat requests emit every 60 seconds. If the delta between client device time and the server timestamp exceeds seconds, the server forces a clock resynchronization.

## 10. Traceability Matrix: Requirements, Evolution to Context Boundaries

| Requirement & Evolution Epic | Jira Reference | Context Architecture Boundary / Entity | Target Subsystem / Integration | Verification Method |
|---|---|---|---|---|
| **Moderated Assessment Category Isolation** | [KB-1936: Q3 \| Content Portal Redesign \| Content access settings, batch management and user consumption](https://karmayogibharat.atlassian.net/browse/KB-1936) (Prod Deployed), [KB-2044: Q3 \| Content Portal Redesign \| Create assessment](https://karmayogibharat.atlassian.net/browse/KB-2044) (Prod Deployed) | Ingestion & Publishing Boundary | `cb-ext-assessment` / PostgreSQL Master | Metadata Assertion Test |
| **Auto-Batch Suppression Pipeline** | [KB-3958: Q4 \| Assessments Creation and Consumption](https://karmayogibharat.atlassian.net/browse/KB-3958) (Prod Deployed), [KB-3959: Q4 \| Assessments \| Assessment creation - for Invite only users](https://karmayogibharat.atlassian.net/browse/KB-3959) (Prod Deployed) | Streaming Event Boundary | Apache Flink `BatchCreationSuppressorJob` | Stream Processing Test |
| **Pass Mark Floor 50% Rule** | [KB-11683: Content Creator - Passing criteria for courses should not be below 50%](https://karmayogibharat.atlassian.net/browse/KB-11683) (Prod Deployed) | Ingestion Pre-Flight Boundary | CBP Form Validation / Ingestion Gateway | Unit Validation Suite |
| **Bulk CSV Auto-Trim Sanitization** | [KB-13076: Q11 \| Ad-Hoc \| Comprehensive Assessments and APAR Enhancements](https://karmayogibharat.atlassian.net/browse/KB-13076) (Open) | Ingestion Boundary | `BulkUploadParser` Subsystem | Malformed CSV Ingest Test |
| **MDO Cohort Whitelisting** | [KB-1950: Q3 \| Content Portal Redesign \| Learner consumption for all types of content](https://karmayogibharat.atlassian.net/browse/KB-1950) (Prod Deployed), [KB-9603: Q8 \| Access Control \| User Group based Access Control](https://karmayogibharat.atlassian.net/browse/KB-9603) (Prod Deployed) | Security Perimeter / Gateway | `AccessControlGatekeeper` / Redis | Mock HTTP 403 Audit |
| **Faceted Elasticsearch Cataloging** | [KB-7869: Q7 \| Search & listing \| NLP & Elastic search \| Learner Portal](https://karmayogibharat.atlassian.net/browse/KB-7869) (Prod Deployed), [KB-7871: Q7 \| Search & listing \| Filters \| Learner Portal](https://karmayogibharat.atlassian.net/browse/KB-7871) (Prod Deployed) | Discovery Boundary | `cb-search-service` / Elasticsearch | Query Benchmark Suite |
| **Curated Program L2 Gating / Locking** | [KB-8065: Q8 \| L2 Assessments/CAP \| Creation of L2 Assessments/CAP](https://karmayogibharat.atlassian.net/browse/KB-8065) (KB Approved), [KB-8841: Q8 \| Learning Path \| Curated Program \| Add Final Assessment](https://karmayogibharat.atlassian.net/browse/KB-8841) (Prod Deployed) | Program Dependency Boundary | `cb-ext-course` / Cassandra `user_enrolments` | Incomplete DAG Test |
| **Single-Sitting Session Lock (No Pause)** | [SRS - Assessments](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/87392295) | Runtime Player Boundary | Redis Sentinel (`SET session:* ACTIVE EX`) | Concurrency Test (JMeter) |
| **Server-Side Scoring & Negative Marks** | [KB-3958: Q4 \| Assessments Creation and Consumption](https://karmayogibharat.atlassian.net/browse/KB-3958) (Prod Deployed) | Evaluation Compute Boundary | Server Evaluation Core / PostgreSQL | Scoring Logic Check |
| **Gated Certificate Issuance Trigger** | [KB-8841: Q8 \| Learning Path \| Curated Program \| Add Final Assessment](https://karmayogibharat.atlassian.net/browse/KB-8841) (Prod Deployed), [KBN-8807: GCPQA \| Deployment /config changes of cb-ext-assessment service Closed](https://karmayogibharat.atlassian.net/browse/KBN-8807) | Credentialing Boundary | `CertRegistry` / DigiLocker Connector | End-to-End Pipeline Test |
| **Provider Dashboard Rollup Metrics** | [KB-5761: Q5 \| Enhancement \| ATIs, CTIs and Content Provider Digitization](https://karmayogibharat.atlassian.net/browse/KB-5761) (KB Approved), [KB-6378: Q5 \| Content Portal \| Dashboard for content provider Need Information](https://karmayogibharat.atlassian.net/browse/KB-6378) | Reporting & Analytics Boundary | Flink Analytics Job / Elasticsearch | Metabase Dashboard Test |
| **Kubernetes Actuator Autoscaling (HPA)** | [KB-13097: Q11 \|Tech Debt \| Frontend and Backend Service enhancement](https://karmayogibharat.atlassian.net/browse/KB-13097) (Open) | Cloud Infrastructure Boundary | Kubernetes HPA Controller / Spring Actuator | Load Test () |
