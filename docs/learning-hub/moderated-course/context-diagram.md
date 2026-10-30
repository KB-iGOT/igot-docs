# Moderated Course — System Context Diagram

## 1. Document Purpose & Architectural Scope

This document establishes the **System Context**, enterprise boundaries, external integrations, user persona touchpoints, and internal subsystem interactions governing the **Moderated Course** capability on the **iGOT Karmayogi Platform**.

Unlike standard public courses—which are globally discoverable, openly enrollable, and gated centrally by the Special Purpose Vehicle (SPV) Publisher queue—Moderated Courses introduce **sovereign departmental boundaries** and **cadre attestation controls**. This document details the architectural context across the complete platform lifecycle from **Creation & Publishing** through **Discovery, Enrolment, Consumption, Telemetry, and Unenrollment**, tracing its chronological evolution from **Q2 to Q13**.

## 2. Evolution of System Context (Q2 vs. Q13)

Between Q2 and Q13, the Moderated Course boundary transitioned from a basic departmental filtering mechanism to a multi-tiered, zero-trust access ecosystem.

```mermaid
flowchart TD
    subgraph Q2["Q2 CONTEXT (FOUNDATIONAL ERA)"]
        L2["Learner"] --> GW2["Gateway / UI"]
        GW2 --> S2["Search (Basic ES)"]
        S2 --> DB2[("Cassandra / Neo4j")]
        C2["Creator"] --> CBP2["CBP Portal"]
        CBP2 --> PUB2["Direct MDO Publish (KB-355)"]
        PUB2 --> DB2
        N2["* Scope: Single MDO gating, manual profile verification via extPatch, basic SPV bypass."]
    end
    subgraph Q13["Q13 CONTEXT (MATURE ENTERPRISE ERA)"]
        A1["Verified/Unverified Cadres"] --> GW13
        A2["MDO Creators & Publishers"] --> GW13
        A3["MDO Nodal Officers & Helpdesk"] --> GW13
        GW13["iGOT UNIFIED ENTERPRISE GATEWAY (sunbird-cb-uiproxy)<br/>- JWT Identity Introspection & Session Claim Injection"]
        GW13 --> SD["Search & Discovery<br/>- Wildcard [#quot;*#quot;]<br/>- Server Faceting"]
        GW13 --> PR["Publishing Router<br/>- Zero-SPV Gating<br/>- Schema Validator"]
        GW13 --> EB["Enrolment & Batch<br/>- Single-Batch Lock<br/>- Sprint 39 Audit"]
        SD --> MESH
        PR --> MESH
        EB --> MESH
        MESH[("DATA & EVENT MESH: Cassandra (user_enrolments_v2 + history) | ES | Flink | Kafka | Postgres")]
        ITSM["ITSM Chatbot Engine KB-14236"] -->|"Real-Time Diagnostics"| MESH
    end
    Q2 --> Q13
```

## 3. Diagram 1: Enterprise System Context Diagram (C4 Level 1)

This diagram details the top-level boundary of the iGOT Karmayogi Platform with respect to internal and external actors, governing bodies, administrative portals, and support services.

```mermaid
---
title: ENTERPRISE SYSTEM CONTEXT (LEVEL 1)
---
flowchart TD
    subgraph ACT["HUMAN ACTORS & ROLES"]
        CR["MDO Content Creator<br/>- Authors course curriculum<br/>- Configures accessSetting<br/>- Sets secureSettings orgs/badge"]
        PB["MDO Content Publisher<br/>- Reviews CQS quality metrics<br/>- Publishes directly (No SPV)<br/>- Audits departmental content"]
        AD["MDO Administrator<br/>- Nodal verification authority<br/>- Approves #quot;Verified Karmayogi#quot;<br/>- Tracks MDO CBP training plans"]
    end
    subgraph PAL1["PORTAL ACCESS LAYER"]
        CBP["CBP Authoring Portal (Angular)"]
        MDOP["MDO Administration Portal (Angular)"]
    end
    CR --> PAL1
    PB --> PAL1
    AD --> PAL1
    PAL1 -->|"HTTPS / REST (Keycloak Bearer JWT)"| GW
    subgraph PLAT["iGOT KARMAYOGI PLATFORM BOUNDARY"]
        GW["Unified API Gateway & Security Reverse Proxy (sunbird-cb-uiproxy)<br/>- Enforces TLS 1.3 termination, CORS policies, rate limiting, and route rewrites<br/>- Decodes Keycloak JWT tokens and queries Redis session state<br/>- Injects trusted identity headers: x-user-id, x-user-root-org-id, x-user-is-verified"]
        CS["Course & Batch<br/>Subsystem<br/>(sunbird-course-svc)<br/>- Auto-batch engine<br/>- Gated enrolment<br/>- Unenrollment audits"]
        CMS["Content Management<br/>Subsystem<br/>(sunbird-content-svc)<br/>- Node graph storage<br/>- Direct publish logic<br/>- Token-gated assets"]
        SDS["Search & Discovery<br/>Subsystem<br/>(search-service)<br/>- Server-side faceting<br/>- ES query sandboxing<br/>- Wildcard [*] parser"]
        STORE[("Core Storage & Event Pipeline<br/>- Cassandra (user_enrolments_v2, enrollment_history_by_action, enrollment_batch_lookup)<br/>- Elasticsearch (kp_content_alias, org_eligibility_alias)<br/>- PostgreSQL (User Profiles, MDO Organizational Master, Workflow Approvals)<br/>- Apache Kafka & Flink (dev.telemetry.raw -> Real-time Progress Computation)")]
        GW --> CS
        GW --> CMS
        GW --> SDS
        CS --> STORE
        CMS --> STORE
        SDS --> STORE
    end
    subgraph PAL2["PORTAL ACCESS LAYER "]
        LWP["Learner Web Portal (React SPA)"]
        MLA["Mobile Learning App (React Native)"]
    end
    PAL2 -->|"HTTPS / REST (Bearer JWT)"| PLAT
    EL["Eligible MDO Learner<br/>- Verified Karmayogi badge<br/>- Discovers protected courses<br/>- Consumes video / assessments"] --> PAL2
    IC["Ineligible Cross-MDO User<br/>- Authenticated citizen servant<br/>- Zero search visibility<br/>- Direct URL access restricted"] --> PAL2
    UU["Unverified Same-MDO User<br/>- Registered, unverified account<br/>- Moderated search filtered out<br/>- Prompted to request badge"] --> PAL2
```

## 4. Diagram 2: Business & Operational Context Diagram

This diagram maps the business lifecycle stages—from administrative course commissioning to consumption and operational support triage—against the organizational entities involved.

```mermaid
---
title: BUSINESS & OPERATIONAL CONTEXT DIAGRAM
---
flowchart TD
    subgraph P1["1. COMMISSION & AUTHORING PHASE"]
        NM["Nodal Ministry / Cadre Controlling Authority"] -->|"Defines capacity building requirements (e.g., Internal Vigilance, Procurement)"| CR["MDO Content Creator"]
        CR -->|"Uses CBP Studio to build curriculum<br/>Configures: accessSetting = #quot;mdoSpecific#quot;<br/>Sets Target Organizations: [Org_A, Org_B] OR Wildcard [#quot;*#quot;] (KB-15266)<br/>Toggles: #quot;Restrict to Verified Karmayogi Users#quot; = #quot;Yes#quot; (KB-743)"| RP["MDO Content Reviewer & Publisher"]
        RP -->|"Performs Course Quality Score (CQS) audit<br/>APPROVES & PUBLISHES DIRECTLY (KB-355: Bypasses central SPV queue)"| LIVE["Platform State: LIVE & AUTO-BATCH PROVISIONED"]
    end
    subgraph P2["2. CADRE ATTESTATION PHASE"]
        CSV["Civil Servant / Learner"] -->|"Enters Profile -> Inputs Cadre, Designation, Employee Code<br/>Submits: #quot;Earn Verified Karmayogi Badge#quot; request (KB-920)"| MA["MDO Administrator"]
        MA -->|"Reviews pending request in MDO Portal Verification Queue (KB-926)<br/>Confirms credentials -> Grants #quot;Verified Karmayogi#quot; status (KB-922)"| UPD["User Profile Updated: isVerifiedKarmayogi = true"]
    end
    subgraph P3["3. CONSUMPTION & MONITORING PHASE"]
        LDC["Learner Discovery & Consumption"] -->|"Search API filters catalog based on User Org + Verified Badge (KB-338)<br/>Anti-leak: Share button suppressed on Web and Mobile (KB-2559 / KB-3002)<br/>Learner enrolls -> Consumes assets -> Telemetry processed via Kafka/Flink<br/>Optional: Learner unenrolls -> Audited in Cassandra (Sprint 39 / KB-14518)"| OSG["Operational Support & Governance"]
        OSG --> ML["MDO Leadership: Tracks departmental compliance via CBP Dashboards"]
        OSG --> IT["ITSM Chatbot: Deterministically diagnoses access denials for users (KB-14236)"]
    end
    P1 ~~~ P2
    P2 ~~~ P3
```

## 5. Diagram 3: Frontend-to-Backend Subsystem Context Diagram

This diagram details the presentation components, gateway translation filters, backend services, and database tables that execute creation and consumption.

```mermaid
---
title: FRONTEND-TO-BACKEND SUBSYSTEM CONTEXT
---
flowchart TD
    subgraph PRES["[PRESENTATION LAYER]"]
        AUI["Authoring UI Components (Angular)<br/>- AuthoringAccessSettingComponent<br/>- MdoTypeaheadSelector<br/>- VerifiedToggleDirective<br/>- DirectPublishActionHandler (KB-355)"]
        LUI["Learner UI Components (React / RN)<br/>- SearchFilterFacetComponent<br/>- LearnHubStripRenderer<br/>- CourseTocGatingComponent<br/>- DomShareStripperDirective (KB-2559)"]
    end
    GW["[API GATEWAY & CLAIMS INJECTION LAYER: sunbird-cb-uiproxy]<br/>- Keycloak Token Decoding & Verification<br/>- Redis Session Cache Lookup -> Injects: X-User-Id, X-User-RootOrg-Id, X-User-IsVerified"]
    AUI -->|"HTTP Request / JSON Payload"| GW
    LUI -->|"HTTP Request / Query Params"| GW
    CONT["[CONTENT SUBSYSTEM: sunbird-content-service]<br/>- Validates accessSetting & secureSettings<br/>- Executes SPV bypass router (KB-355)<br/>- Writes Content Node to Neo4j & ES<br/>- Issues signed token for leaf playback"]
    DISC["[DISCOVERY: search-service]<br/>- Intercepts catalog search queries<br/>- Injects Boolean security clauses<br/>- Evaluates Wildcard [#quot;*#quot;] logic<br/>- Queries kp_content_alias"]
    ENR["[ENROLMENT: sunbird-course-service]<br/>- Evaluates user claims vs node<br/>- Auto-batch manager<br/>- Single active batch lock<br/>- Sprint 39 Unenrollment Controller"]
    GW -->|"(POST /content/v1/publish)"| CONT
    GW -->|"(POST /v4/search)"| DISC
    GW -->|"(POST /course/v1/enrol)"| ENR
    subgraph DATA["[DATA PERSISTENCE & PIPELINE MESH]"]
        ES[("Elasticsearch Cluster<br/>- kp_content_alias<br/>- org_eligibility_alias<br/>- Normalized [*] org indices")]
        CAS[("Apache Cassandra Cluster<br/>- user_enrolments_v2<br/>- enrollment_history_by_action<br/>- enrollment_batch_lookup")]
        PG[("PostgreSQL DB (User Directory)<br/>- user_profile<br/>- is_verified_karmayogi flag<br/>- workflow_request queue")]
        KAF["Streaming Ingestion (Apache Kafka Topic: dev.telemetry.raw)"]
        FLK["Apache Flink Telemetry Processor"]
        CAS --> KAF
        KAF --> FLK
    end
    CONT -->|"Index Synch"| ES
    DISC -->|"Facet Queries"| ES
    ENR -->|"Transaction Writes"| CAS
```

## 6. Diagram 4: Boundary & Data Flow Context (Creation vs. Consumption)

This diagram contrasts the data boundaries and information movement across the two primary workflows of the Moderated Course ecosystem.

```mermaid
---
title: BOUNDARY & LIFECYCLE DATA FLOWS
---
flowchart TD
    subgraph CRE["CREATION & PUBLISHING BOUNDARY (INBOUND CONTENT)"]
        AU["Author: CBP Studio"] -->|"1. POST /content/v1/create (accessSetting: #quot;mdoSpecific#quot;, secureSettings: #123;orgs, isVerified#125;)"| GW1["Gateway: sunbird-cb-uiproxy"]
        GW1 -->|"2. Routes to Content Service with Author Role Tokens"| CS1["Content Service: sunbird-content-service"]
        CS1 --> S3A["3A. Writes Node Graph to Neo4j / Transaction DB (Status: Draft)"]
        CS1 --> PUBA["MDO Content Publisher Action"]
        PUBA -->|"3B. POST /content/v1/publish (KB-355: Direct Go-Live)"| PE["Content Service Publishing Engine"]
        PE --> S4A["4A. Updates Status: #quot;Live#quot; in Graph Store"]
        PE --> S4B["4B. Indexes Node in Elasticsearch (kp_content_alias)"]
        PE --> S4C["4C. Emits ContentPublishEvent to Kafka Topic"]
        PE --> CRS1["Course Service: sunbird-course-service"]
        CRS1 --> S5["5. Auto-Batch Engine provisions single open batch (enrollment_batch_lookup)"]
    end
    subgraph CON["CONSUMPTION & LIFECYCLE BOUNDARY (OUTBOUND LEARNING)"]
        LW["Learner: Web / Mobile App"] -->|"1. POST /apis/proxies/v8/sunbirdigot/v4/search"| GW2["Gateway: sunbird-cb-uiproxy"]
        GW2 -->|"2. Injects Claims: X-User-RootOrg-Id: #quot;0138...#quot;, X-User-IsVerified: #quot;true#quot;"| SS["Search Service: search-service"]
        SS -->|"3. Appends Bool Clauses to ES Query (Matches secureSettings.org & badge)"| ESK[("Elasticsearch: kp_content_alias")]
        ESK -->|"4. Returns ONLY eligible course cards (Zero metadata leakage)"| CE["Learner: Clicks #quot;Enroll#quot;"]
        CE -->|"5. POST /apis/proxies/v8/course/v1/enrol"| CRS2["Course Service: sunbird-course-service"]
        CRS2 -->|"6. Re-evaluates claims vs content node<br/>7. Writes active row to Cassandra (sunbird_courses.user_enrolments_v2)"| PA["Learner: Plays Course Asset"]
        PA -->|"8. Streaming Telemetry (INTERACT / ASSESS) ---> Kafka ---> Flink<br/>9. Real-time progress updates written to Cassandra"| OU["Learner: Optional Unenrollment"]
        OU -->|"10. POST /course/v1/unenrol (Sprint 39 / KB-14518)"| U1[("Cassandra: user_enrolments_v2 (active = false)")]
        OU -->|"10. POST /course/v1/unenrol (Sprint 39 / KB-14518)"| U2[("Cassandra: enrollment_history_by_action (Append immutable audit row)")]
    end
    CRE ~~~ CON
```

## 7. Diagram 5: Security Context & Boundary Gating

This diagram details the defensive boundaries deployed across the ecosystem to prevent unauthorized discovery, deep-link traversal, and API manipulation.

**SECURITY ENVELOPE BOUNDARIES**

| ATTACK / LEAKAGE VECTORS | DEFENSIVE GATING CONTROLS ENFORCED |
|---|---|
| **Vector 1: Unverified Discovery**<br/>Unverified user browses search catalog attempting to view protected courses. | **BOUNDARY 1: SEARCH QUERY SANDBOXING**<br/>- Gateway injects x-user-is-verified header from session.<br/>- Search service appends mandatory bool query clause.<br/>- Protected nodes completely omitted from Elasticsearch hits. |
| **Vector 2: Deep-Link URL Sharing**<br/>Eligible learner copies course URL and sends to colleague via messaging/email. | **BOUNDARY 2: PRESENTATION LAYER SHARING STRIP**<br/>- DOM Share button removed for Moderated Courses (KB-2559).<br/>- Direct TOC URL hit validates profile vs secureSettings.<br/>- Ineligible user sees locked screen; leaf nodes blocked. |
| **Vector 3: Direct Enrolment API Injection**<br/>Malicious user issues manual POST call to /course/v1/enrol with known courseId. | **BOUNDARY 3: COURSE SERVICE ACCESS RE-EVALUATION**<br/>- Course Service ignores client-supplied eligibility claims.<br/>- Fetches authoritative course node from internal cache.<br/>- Validates user MDO and Verified badge.<br/>- Rejects unauthorized calls with HTTP 403 Forbidden. |
| **Vector 4: Direct Asset Streaming Access**<br/>User attempts direct GET call on video chunk or assessment hierarchy node. | **BOUNDARY 4: TOKEN-GATED ASSET PLAYBACK**<br/>- Hierarchy API confirms active enrolment in Cassandra.<br/>- Issues short-lived, signed token for video/document stream.<br/>- Unenrolled or unauthorized requests denied at asset edge. |

## 8. Diagram 6: External System Integrations & Triage Context

This diagram illustrates how external identity systems, departmental platforms, and support bots interface with the Moderated Course boundary.

```mermaid
---
title: EXTERNAL INTEGRATIONS CONTEXT
---
flowchart TD
    KC["Central Keycloak IAM<br/>(Gov Identity / SSO)"] -->|"OpenID Connect (OIDC) / OAuth 2.0 PKCE"| GW["API GATEWAY: sunbird-cb-uiproxy"]
    GW --> HR["Nodal Department HRMS / SPARROW Integration<br/>(Future Cadre Verification Synchronization)<br/>- Synchronizes government employee master records<br/>- Updates designations and MDO postings<br/>- Upgrades user to Verified Karmayogi in Postgres"]
    GW --> IT["ITSM Chatbot Diagnostic Engine (KB-14236)<br/>- Ingests user access denial queries<br/>- Calls /content/v1/access/read/#123;id#125;<br/>- Calls /api/user/v2/read/#123;userId#125;<br/>- Diagnoses MDO or Verification mismatch<br/>- Refers learner to Nodal MDO / YP"]
```
