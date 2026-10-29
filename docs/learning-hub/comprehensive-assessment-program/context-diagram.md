# Comprehensive Assessment — Context Diagrams

## 1. High-Level Enterprise System Context (C4 Model - Level 0)

This Level-0 context diagram establishes the platform boundary of the **iGOT Karmayogi CA & APAR Subsystem**, mapping all external actors, consuming statutory government systems, identity providers, and data warehousing sinks.

```mermaid
---
title: LEVEL-0 ENTERPRISE CONTEXT DIAGRAM
---
flowchart TD
    IAM["Parichay SSO / IAM<br/>(Govt of India Auth Bus)"]
    MDO["MDO & CCA Admins<br/>- Ministry Coordinators<br/>- Cadre Authorities<br/>(DoPT, MHA, MoEFCC)"]
    CSL["Civil Service Learners<br/>- All India Services(IAS)<br/>- Central Secretariat<br/>- State Services(BAS/BSS)"]
    CCA["Content Creators & AI<br/>- Assessment Designers<br/>- AI Assessment Tool<br/>(Context Metadata)"]
    subgraph SB["iGOT KARMAYOGI: CA & APAR SUBSYSTEM BOUNDARY"]
        CT["[Creation & Targeting]<br/>- Reusable User Groups<br/>- Training Plan V4<br/>- Kafka CA Decoupled Linkage"]
        CE["[Consumption Engine]<br/>- Two-Tier Redis Cache<br/>- Prerequisite Course Gating<br/>- Window Time-Bound Check"]
        SBS["[Scoring & Best Score]<br/>- 50% Threshold Gate<br/>- Never-Decrease Best Merge<br/>- TOC Read-Path Bypass"]
        NAD["[Nightly Aggregation & Diagnostic Engine]<br/>- 09:30 AM Daily Consolidated Batch ETL<br/>- Diagnostic Fault Attribution (OK, PROFILE_INCOMPLETE, etc.)"]
    end
    EXT["External Statutory APAR Platforms<br/>- NIC SPARROW (Tables 11A/B & 12A/B)<br/>- DoPT e-HRMS (Appraisal Module)<br/>- State e-PAR Systems (State Cadres)"]
    BI["Data Warehousing & BI<br/>- Google BigQuery Compliance Datasets<br/>- MDO Executive Monitoring Dashboards"]
    IAM -->|"OAuth2 / JWT"| CSL
    MDO --> CSL
    CCA --> CSL
    MDO -->|"Plan & Cohort Authoring"| CT
    CSL -->|"Course & CA Consumption"| CE
    CCA -->|"Assessment Bundles"| SBS
    NAD -->|"Automated REST Pull (/api/apar/v2/*)"| EXT
    NAD -->|"Daily Analytical Sync (11:00 AM)"| BI
```

## 2. Detailed Subsystem System Context Diagram (Level 1)

This diagram details the interaction boundaries between the frontend clients, API gateway, core backend microservices, message brokers, caching/persistence tiers, and external integrations.

```mermaid
graph TB
    %% External Actors
    subgraph Actors["External Human Actors"]
        Admin["MDO Admin / CCA Authority<br/>(DoPT, MHA, State Depts)"]
        Learner["Civil Service Learner<br/>(AIS, CSS, State BAS/BSS)"]
        Creator["Content Creator / AI Tool<br/>(Assessment Authoring)"]
    end
    %% External Auth Provider
    subgraph Identity["Identity & Authentication"]
        SSO["Parichay SSO / Keycloak IAM<br/>(Issues signed JWT Bearer tokens)"]
    end
    %% Edge / Gateway Boundary
    subgraph GatewayBoundary["API Gateway & Ingress Layer"]
        Kong["Kong API Gateway & Security Proxy<br/>- JWT validation & rootOrg injection<br/>- Rate limiting (100 req/min for dictionary)<br/>- Reverse proxy routing"]
    end
    %% iGOT Core Platform Boundary
    subgraph SubsystemBoundary["iGOT Karmayogi Platform Boundary (Target Subsystem)"]
        subgraph IngressControllers["Frontend Presentation Tier"]
            AdminUI["MDO / Admin Portal<br/>(Angular Web Client)"]
            LearnerWeb["Learner Portal Web<br/>(Angular Client - My iGOT)"]
            LearnerMobile["Learner Mobile App<br/>(Flutter Engine)"]
            ContentStudio["Content Creator Studio<br/>(Angular Client)"]
        end
        subgraph CoreServices["Domain Microservices Tier"]
            CourseExt["cb-ext-course-service (Port 9000)<br/>- User Group Controller (/usergroup/v1/*)<br/>- Training Plan V4 Controller (/cbplan/v4/*)<br/>- User Dictionary Service (Redis L1/L2)<br/>- Prerequisite Eligibility Evaluator"]
            CourseCore["sunbird-course-service (Core Actor)<br/>- ContentStateUpdateActor (/state/update)<br/>- BestScoreMergeEngine (Never-decrease MAX)<br/>- CourseEnrollmentActor (TOC read patch)"]
            AsmtSvc["cb-ext-assessment-service (Port 9000)<br/>- Question Delivery Engine (Keys redacted)<br/>- Submission Evaluator & 50% Threshold Gate<br/>- Post-Attempt Result DTO Formatter"]
            KafkaConsumer["CbPlanCaLinkConsumer (Async Worker)<br/>- Ingests topic cbplan.ca.link<br/>- Idempotent CA-link updater<br/>- Redis namespace cache evictor"]
            BatchSync["Nightly APAR Consolidation Engine<br/>- 09:30 AM IST cron job<br/>- Diagnostic Code Resolver"]
            AparGateway["APAR REST Integration Gateway<br/>- Exposes /api/apar/v2/status<br/>- Exposes /api/apar/v2/bulk-status"]
        end
        subgraph StorageTier["Persistence, Cache & Messaging Tier"]
            Cassandra[("Apache Cassandra Cluster<br/>- sunbird.cb_plan_v3<br/>- sunbird.user_group_info<br/>- sunbird.user_content_consumption_v2<br/>- sunbird.apar_officer_annual_summary")]
            Elasticsearch[("Elasticsearch 7.x Cluster<br/>- cb_plan_v2 (Plan Index)<br/>- usergroup (Cohort Index)")]
            Redis[("Redis In-Memory Cluster<br/>- cbplan:v4:userlookup:* (1-hr TTL)<br/>- user:basicProfile:* (2-hr TTL)")]
            Kafka[("Apache Kafka Message Bus<br/>- Topic: cbplan.ca.link<br/>- Topic: telemetry.raw")]
        end
    end
    %% External Systems Tier
    subgraph DownstreamSystems["External Statutory & Analytical Consumers"]
        SPARROW["NIC SPARROW Platform<br/>(Auto-fills Tables 11A/B & 12A/B)"]
        EHRMS["DoPT e-HRMS / State e-PAR<br/>(Read-Only Statutory Dossier)"]
        BigQuery[("Google BigQuery Data Warehouse<br/>(Daily MDO Compliance Datasets)")]
    end
    %% Relationships - Actors to UI
    Admin -->|Curates plans & cohorts| AdminUI
    Learner -->|Consumes courses & CAs| LearnerWeb
    Learner -->|Mobile consumption| LearnerMobile
    Creator -->|Publishes L2 CAs with metadata| ContentStudio
    Identity -.->|Token handshake| Kong
    %% UI to Gateway
    AdminUI --> Kong
    LearnerWeb --> Kong
    LearnerMobile --> Kong
    ContentStudio --> Kong
    %% Gateway to Microservices
    Kong -->|/usergroup/v1/*, /cbplan/v4/*| CourseExt
    Kong -->|/v1/assessment/*| AsmtSvc
    Kong -->|TOC enrollment queries| CourseCore
    %% Internal Microservice Interactions
    ContentStudio -->|Publishes Live CA| Kafka
    Kafka -->|Topic: cbplan.ca.link| KafkaConsumer
    KafkaConsumer -->|Update calinkedid| Cassandra
    KafkaConsumer -->|Update doc| Elasticsearch
    KafkaConsumer -->|Evict org dictionary| Redis
    CourseExt -->|Transactional Pre-Commit| Elasticsearch
    CourseExt -->|Insert / Update| Cassandra
    CourseExt -->|L1 Cache Lookup| Redis
    AsmtSvc -->|Unconditional State Update| CourseCore
    CourseCore -->|Read / Merge Best Score| Cassandra
    %% Batch Aggregation & Downstream
    BatchSync -->|Daily scan 09:30 AM| Cassandra
    BatchSync -->|Insert aggregated snapshots| Cassandra
    BatchSync -->|Export daily diff 11:00 AM| BigQuery
    AparGateway -->|Read snapshot by eHrmsId| Cassandra
    SPARROW -->|Pull 10:00 AM /api/apar/v2/status| AparGateway
    EHRMS -->|Pull /api/apar/v2/status| AparGateway
```

## 3. Subsystem Context Boundaries & Protocol Matrix

The following matrix documents the interaction contracts crossing the subsystem boundary:

| Boundary Interface | Source Component | Target Component | Transport Protocol | Payload / Schema | Security & Governance Gates | Related Jira / Task |
|---|---|---|---|---|---|---|
| **IF-01: Ingress Auth** | Client Portals | Kong Gateway | HTTPS / REST | Bearer JWT Header (`x-authenticated-user-token`) | Keycloak verification; role extraction (`MDO_ADMIN`, `CCA_ADMIN`). | `KB-10686` |
| **IF-02: User Group API** | Admin UI | `cb-ext-course-service` | HTTPS / REST | JSON: `{ userGroupName, criteria: [...] }` | Evaluated as AND within criteria, OR across groups; fail-closed deletion lock. | `KB-13866` |
| **IF-03: Plan Lifecycle** | Admin UI | `cb-ext-course-service` | HTTPS / REST | JSON: `{ name, contentList, userGroupIds, endDate }` | Transactional Elasticsearch pre-commit; staged mutation via `draftData`. | `KB-11524`, `KB-13077` |
| **IF-04: CA** **Decoupling** | Content Studio | Kafka Broker | Kafka TCP | Topic `cbplan.ca.link`: `{ action, cbPlanId, caLinkedId }` | Asynchronous decoupled linking; triggers org-scoped Redis eviction. | `cbrelease-``4.8.41` |
| **IF-05: Discovery Dict** | Learner Web / App | `cb-ext-course-service` | HTTPS / REST | POST: `{ planYear: "2026-27" }` | Two-tier resolution: Redis L1 () Cassandra profile fallback L2. | `KB-10684`, `KB-13086` |
| **IF-06: Prereq Gating** | Learner Web / App | `cb-ext-course-service` | HTTPS / REST | GET: `/assessment/eligibility/{doId}` | Validates 50% mandatory course quota satisfied & active window dates. | `KB-8065`, `KB-8066` |
| **IF-07: Submission** | Assessment Player | `cb-ext-assessment-service` | HTTPS / REST | POST: `{ submissionId, responses: [...] }` | Strips answer keys; server-side 50% pass threshold check. | `KB-12764`, `KB-13093` |
| **IF-08: State Merge** | Assessment Svc | `sunbird-course-service` | HTTP / REST | POST: `/v1/content/state/update` | Unconditional invocation; executes never-decrease Best Score merge. | `KB-15848`, Tech Design |
| **IF-09: TOC Read Path** | Learner UI | `sunbird-course-service` | HTTPS / REST | Akka Request: `getCourseTOC` | Bypasses completed-course skip-read optimization for CA content types. | `KB-15848` |
| **IF-10: Statutory Sync** | NIC SPARROW / e-HRMS | APAR Gateway | HTTPS / REST | GET: `/api/apar/v2/status?eHrmsId=...` | Sub-second SLA (); read-only auto-fill of Tables 11A/B & 12A/B. | `KB-10681`, `BRD-1031307285` |
| **IF-11: Data** **Pipeline** | Batch Worker | Google BigQuery | Cloud API / ETL | Streaming / Micro-batch JSON Rows | Exports compliance denominators and learner highest scores daily. | `KB-12923`, `KB-13111` |

## 4. Contextual Fault & Diagnostic Flow

When external consumers (SPARROW, e-HRMS, or Officers) interface with the system boundary, every request evaluates to exactly one deterministic diagnostic state:

```mermaid
flowchart TD
    A["[SPARROW / e-HRMS Calls /api/apar/v2/status]"] --> B{"Is eHRMS ID mapped?"}
    B -->|"No"| IM["[IDENTIFIER_MISMATCH]<br/>HTTP 404 / Diagnostic"]
    B -->|"Yes"| C{"Are mandatory profile<br/>fields populated?"}
    C -->|"No"| PI["[PROFILE_INCOMPLETE]<br/>Missing Cadre/Batch"]
    C -->|"Yes"| D{"Did user match an<br/>active APAR Plan?"}
    D -->|"No"| NP["[NO_APAR_PLAN]<br/>No plan for cadre"]
    D -->|"Yes"| E{"Has assessment window<br/>closed without pass?"}
    E -->|"Yes"| WC["[CA_WINDOW_CLOSED]<br/>Appraisal deadline passed"]
    E -->|"No"| OK["[OK]<br/>Tables 11 & 12 populated"]
```
