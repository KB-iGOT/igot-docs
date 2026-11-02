# Organisation Hierarchy — System Context Diagram Document

## 1. Document Control & Executive Summary

### 1.1 Document Purpose

This System Context Diagram Document establishes the enterprise boundary models, external interfaces, actor roles, communication channels, and data flow topologies for the **Organisation Hierarchy** capability across the iGOT Karmayogi digital learning and civil service governance platform.

It captures the complete lifecycle across both **Creation/Curation** and **Platform-Wide Consumption**, tracing its evolution from the initial relational, single-table model in **Quarter** **2 (Q2 2023)** to the distributed, multi-tenant taxonomy engine ( to ) operating across four distinct portals in **Quarter 13 (Q13 2026)**.

### 1.2 Target Audience

- **Enterprise & System Architects:** Blueprint for system boundaries, microservice trust zones, and external data exchange contracts.
- **Product Managers & Business Analysts:** Reference for actor roles, portal responsibilities, and administrative boundaries.
- **Engineering Teams (Frontend, Backend, SRE):** Operational overview of gateways, streaming buses, and data lakes.
- **Government Stakeholders (Karmayogi Bharat SPV, CBC, DoPT):** Overview of data ownership, tenancy isolation, and ministerial reporting lines.

## 2. Global System Context Diagram (Level 1 — C4 Model)

The global system context diagram illustrates the boundary of the iGOT Karmayogi Organisation Hierarchy subsystem, its external human actors, consuming portals, and supporting enterprise platforms.

```mermaid
---
title: GLOBAL SYSTEM CONTEXT DIAGRAM (C4 LEVEL 1)
---
flowchart TD
    subgraph ACT["EXTERNAL HUMAN ACTORS"]
        A1["Central SPV Admin<br/>(Global Curation &<br/>National Governance)"]
        A2["SPV State Admin<br/>(State Boundary<br/>Hierarchy Curation)"]
        A3["L0 MDO Leader<br/>(Ministry Authority &<br/>Delegated Management)"]
        A4["MDO / Unit Admin<br/>(Department Operator<br/>& Downward Transfer)"]
    end
    subgraph PPC["PORTAL PRESENTATION CHANNELS"]
        P1["SPV Portal<br/>(Central/State Hierarchy)"]
        P2["MDO Portal<br/>(L0-L10 Admin & Transfers)"]
        P3["CBP Portal<br/>(ODCS & Training Plans)"]
    end
    A1 -->|"HTTPS / Web"| P1
    A2 -->|"HTTPS / Web"| P1
    A3 -->|"HTTPS / Web"| P2
    A4 -->|"HTTPS / Web"| P2
    CORE["iGOT KARMAYOGI ORGANISATION HIERARCHY SUBSYSTEM<br/>(CORE SYSTEM BOUNDARY)<br/><br/>- Validates multi-level hierarchy trees (L0 to L10 Single-Parent Invariant)<br/>- Manages taxonomy framework, level categories, node terms, and directed associations<br/>- Executes full-tree bulk Excel uploads, structural replacements, and acyclic validations<br/>- Manages child unit instantiation, designation masters, and personnel bulk reallocation<br/>- Serializes compiled hierarchy graphs and caches them across Cassandra and Redis<br/>- Streams Change Data Capture (CDC) events to Kafka for analytics and downstream systems"]
    P1 -->|"REST / JSON (TLS 1.3, Bearer JWT, X-Channel-Id)"| CORE
    P2 -->|"REST / JSON (TLS 1.3, Bearer JWT, X-Channel-Id)"| CORE
    P3 -->|"REST / JSON (TLS 1.3, Bearer JWT, X-Channel-Id)"| CORE
    K["APACHE KAFKA EVENT PIPELINE<br/>- Topic: telemetry.org.mutations<br/>- Topic: analytics.cdc.hierarchy"]
    BQ["GOOGLE BIGQUERY (BQ) LAKEHOUSE<br/>- igot_analytics.org_hierarchy<br/>- Materialized ancestor paths"]
    IAM["KEYCLOAK / SUNBIRD IAM<br/>- JWT Token Issuance<br/>- Tenancy claim signing"]
    CORE -->|"Event Streaming"| K
    CORE -->|"Analytical Ingestion"| BQ
    CORE -->|"Identity & Profiles"| IAM
    subgraph DPC["DOWNSTREAM PLATFORM CONSUMERS"]
        D1["Learner Portal<br/>(CSR & Profile Scoping)"]
        D2["Open Reporting APIs<br/>(National Governance APIs)"]
        D3["External BI Tools<br/>(Ministerial Dashboards)"]
    end
    K -->|"Downstream Consumption"| DPC
```

## 3. Evolutionary Context Diagrams (Q2 to Q13 Progression)

The boundary and integration context progressed through five distinct evolutionary phases between Q2 2023 and Q13 2026:

### 3.1 Phase I: Flat Entity Relational Context (Q2–Q4 2023–2024)

- **Architecture State:** Organizations existed as isolated rows in a relational PostgreSQL table with basic text tags (`ministry_name`, `dept_name`).
- **Context Boundary:** All changes were manual or handled via ad-hoc SQL scripts ([KB-838: Q2 | Ad-Hoc Requests | Cleaning up MDO Hierarchy.](https://karmayogibharat.atlassian.net/browse/KB-838) (Open), [KB-1312: Org Hierarchy | Hierarchy cleanup activity and corresponding access to Orgs.](https://karmayogibharat.atlassian.net/browse/KB-1312) (Open)). A flat data warehouse table was updated via nightly batch ETL jobs ([KB-428: Q2 l Data Warehousing l Org hierarchy fields](https://karmayogibharat.atlassian.net/browse/KB-428) (Prod Deployed), [KB-5057: Q4 | Ad-Hoc Requests | Data Warehouse, Operational Reports and Full exhausts enhancements | Org Hierarchy Table.](https://karmayogibharat.atlassian.net/browse/KB-5057) (Open)).

```mermaid
---
title: PHASE I CONTEXT (Q2-Q4 2023-2024)
---
flowchart TD
    U["SPV Admin User"]
    subgraph RMB["RELATIONAL MONOLITHIC BOUNDARY"]
        PG[("PostgreSQL Database<br/>- Table: organisation<br/>- Flat string ministry tags")]
        ETL["Nightly Batch ETL Job<br/>- Flat extraction<br/>- Static warehouse tables"]
        PG --> ETL
    end
    U -->|"Manual Requests / SQL Scripts"| RMB
    DASH["Static DWH Reporting Dashboards"]
    ETL --> DASH
```

### 3.2 Phase II: Graph Exploration Context (Q7 Early 2025)

- **Architecture State:** Proof-of-concept testing Neo4J property graphs to evaluate recursive tree traversal up to 10 levels deep ([KB-8441: Q7 | Tech Debt | Org Hierarchy Enhancements](https://karmayogibharat.atlassian.net/browse/KB-8441) (In Progress), [KB-8442: Explore Neo4J to store org hierarchy](https://karmayogibharat.atlassian.net/browse/KB-8442) (Internal Review)).
- **Context Boundary:** An external graph database was evaluated alongside the transactional store. Due to operational and synchronization overhead, the team decided to standardize on Sunbird’s native Framework Taxonomy Service.

```mermaid
---
title: PHASE II CONTEXT (Q7 2025)
---
flowchart TD
    U["Engineering Architects"]
    subgraph EPB["EVALUATION & PROOF-OF-CONCEPT BOUNDARY"]
        PG[("PostgreSQL Core Store<br/>(Transactional Org Master)")]
        NEO[("Neo4J Property Graph Database<br/>(Recursive Depth & Path Benchmarks)")]
        PG -->|"Dual Write"| NEO
    end
    U -->|"Benchmarking Queries"| EPB
    DEC["Technical Decision: Retain Sunbird Framework Engine<br/>Dropped Neo4J to reduce infrastructure complexity"]
    NEO --> DEC
```

### 3.3 Phase III: Centralized SPV Framework Taxonomy Context (Q8 Mid 2025)

- **Architecture State:** Introduced the multi-tier Sunbird Framework Service over Cassandra and Elasticsearch ([KB-8018: Q8 | Organisation Hierarchy Update | SPV Admin & SPV State | AdminSPV Portal](https://karmayogibharat.atlassian.net/browse/KB-8018) (KB Approved), [KB-8975: Q8 | Organization Hierarchy management](https://karmayogibharat.atlassian.net/browse/KB-8975) (Open)).
- **Context Boundary:** The SPV Portal served as the central point for building hierarchies, supporting full-tree Excel bulk imports ([KB-9737: Q8 | Bulk Upload & Download | Org Hierarchy Management | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9737) (Prod Deployed)), card-based UI browsing ([KB-9033: Q8 | Organisation Hierarchy Management | SPV Admin | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9033) (Prod Deployed)), and SPV State Admin regional scoping ([KB-9197: Q8 | Organisation Hierarchy Access Management | SPV & State Admin | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9197) (Prod Deployed)).

```mermaid
---
title: PHASE III CONTEXT (Q8 2025)
---
flowchart TD
    A1["Central SPV Admin<br/>(National Scope)"]
    A2["SPV State Admin<br/>(Assigned State Scope)"]
    PORTAL["ADMIN SPV PORTAL BOUNDARY<br/>- Card-Based Hierarchy UI (L1-L10)<br/>- Full-Tree Bulk Upload & Download"]
    A1 -->|"HTTPS"| PORTAL
    A2 -->|"HTTPS"| PORTAL
    subgraph STB["SUNBIRD TAXONOMY SERVICE BOUNDARY"]
        TE["Taxonomy Engine<br/>- Frameworks, Categories<br/>- Term Associations (Edges)"]
        CE[("Cassandra & Elasticsearch<br/>- Serialized Framework JSON Trees<br/>- Subtree Search Indices")]
        TE --> CE
    end
    PORTAL -->|"REST API (X-Channel-Id, X-State-Id)"| STB
```

### 3.4 Phase IV: Decentralized MDO Delegation Context (Q9 Late 2025)

- **Architecture State:** Administrative tools were added directly to the MDO Portal ([KB-10500: Q9 | Org hierarchy Management & Impacted Areas](https://karmayogibharat.atlassian.net/browse/KB-10500) (KB Review), [KB-10501: Q9 | L0 hierarchy Management | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10501) (KB Review)).
- **Context Boundary:** MDO Leaders gained self-service capabilities to create child organizations () ([KB-10512: Q9 | Child Organization Creation Capability Dev Completed](https://karmayogibharat.atlassian.net/browse/KB-10512)), configure child unit designation masters ([KB-10515: Q9 | Enable Child Org Data Management | MDO Portal Code](https://karmayogibharat.atlassian.net/browse/KB-10515) (Review)), manage bulk user transfers via CSV ([KB-10514: Q9 | Create Bulk User Transfer Feature (Add/Update) | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10514) (DEV IN PROGRESS)), and run MDO-scoped Excel uploads ([KB-10533: Q9 | Bulk Upload | Organisation Hierarchy Management Dev Completed](https://karmayogibharat.atlassian.net/browse/KB-10533)), with all changes tracked via Kafka telemetry ([KB-10535: Q9 | Data Tracking | Org Hierarchy Management | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10535) (DEV IN PROGRESS)).

```mermaid
---
title: PHASE IV CONTEXT (Q9 2025)
---
flowchart TD
    A1["L0 MDO Leader<br/>(Full Ministry Hierarchy)"]
    A2["MDO / Unit Admin<br/>(Assigned Subtree Governance)"]
    PORTAL["MDO PORTAL BOUNDARY<br/>- Delegated Child Org Creation ($L_1$)<br/>- Child Unit Data & Designation Mgmt<br/>- Streaming Bulk User Transfers (CSV)<br/>- Ministry-Scoped Full-Tree Uploads"]
    A1 -->|"HTTPS"| PORTAL
    A2 -->|"HTTPS"| PORTAL
    SVC["SUNBIRD TAXONOMY & USER-ORG SVC<br/>- Edge creation, term validation<br/>- Relational organization registration"]
    KAFKA["APACHE KAFKA EVENT BROKER<br/>- Topic: telemetry.org.mutations<br/>- Real-time audit trail logs"]
    PORTAL -->|"REST Mutations"| SVC
    PORTAL -->|"Kafka Telemetry Events"| KAFKA
```

### 3.5 Phase V: Platform-Wide Consumption & Analytics Context (Q10–Q13 2025–2026)

- **Architecture State:** Enterprise-scale consumption architecture connecting all platform surfaces to the compiled hierarchy engine.
- **Context Boundary:** Synchronizes changes to BigQuery via Kafka CDC pipelines ([KB-9801: Q8 | Organisation Hierarchy Sync with BQ for reporting | Organisation Hierarchy Management](https://karmayogibharat.atlassian.net/browse/KB-9801) (Open), [KB-10534: Q9 | Organisation Hierarchy Sync with BQ for reporting | Organisation Hierarchy Management](https://karmayogibharat.atlassian.net/browse/KB-10534) (In-Progress)), supports Custom Self-Registration landing URLs ([KB-10574: Q9 | Custom Self registration Functionality | Org Hierarchy Management](https://karmayogibharat.atlassian.net/browse/KB-10574) (Open)), powers Open Reporting APIs ([KB-10576: Q9 | Open APIs for reporting](https://karmayogibharat.atlassian.net/browse/KB-10576) (Prod Deployed)), enables multi-tier Annual Training Plan targeting ([KB-10577: Q11 | Ad-Hoc | CA and APAR Enhancements |Org Hierarchy in Training Plan Creation | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10577) (Open)), and drives top-down ODCS competency cascading ([KB-10578: Q9 | ODCS effectiveness for Child Organisations | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10578) (Open)).

```mermaid
---
title: PHASE V CONTEXT (Q10-Q13 2025-2026)
---
flowchart TD
    ENG["COMPILED TAXONOMY & CHANGE CAPTURE ENGINE<br/>(Sunbird Framework Svc, Cassandra Store, Kafka CDC Pipelines, Redis Distributed Cache)"]
    CBP["CBP CAPACITY PLANNING<br/>- Top-down ODCS competency cascade<br/>- Multi-tier Annual Training Plans"]
    LPE["LEARNER PROFILE ENGINE<br/>- Custom Self-Registration<br/>- Inherited domain access"]
    BQ[("GOOGLE BIGQUERY<br/>- Materialized<br/>ancestor paths")]
    ENG -->|"Event CDC Stream"| CBP
    ENG -->|"Read Graph Tree"| LPE
    ENG -->|"BQ"| BQ
    BI["National Ministerial BI"]
    ORA["Open Reporting APIs"]
    BQ --> BI
    BQ --> ORA
```

## 4. Frontend-to-Backend Structural Context Diagram (C4 Level 2)

This container context diagram illustrates the boundary between the browser presentation layer, gateway routing filters, backend microservices, caching layers, and persistence tiers.

```mermaid
---
title: FRONTEND-TO-BACKEND CONTAINER CONTEXT DIAGRAM (C4 LEVEL 2)
---
flowchart TD
    subgraph T1["BROWSER CLIENT PRESENTATION TIER (Angular 14+ SPA Architecture)"]
        subgraph M1["ORGANISATION HIERARCHY PRESENTATION MODULE"]
            C1["HierarchyTreeViewComponent<br/>- Horizontal virtual columns<br/>- Context action menus & cards"]
            C2["HierarchySideDrawerComponent<br/>- Searchable typeahead picker<br/>- Edge linking & validation"]
            C3["BulkOperationsModalComponent<br/>- Streaming XLSX/CSV file parser<br/>- Error report download generator"]
            SS["HierarchyStateService (RxJS Reactive Store: activeFramework$, selectedNodeChain$, levelBuckets$)"]
            C1 --> SS
            C2 --> SS
            C3 --> SS
        end
    end
    subgraph T2["API INGRESS & TENANCY ENFORCEMENT TIER"]
        GW["KONG / NGINX API GATEWAY (K8s Ingress Controller)<br/>- Verifies RSA-256 JWT signatures against Keycloak JWKS<br/>- Extracts user claims and injects headers: X-Channel-Id, X-State-Id, X-Authenticated-User-Token<br/>- Boundary Filter: Blocks SPV State Admins from accessing Central Government or out-of-state resources (HTTP 403 Forbidden)"]
    end
    subgraph T3["INTERNAL CLUSTER MICROSERVICES TIER"]
        FW["SUNBIRD FRAMEWORK & TAXONOMY SERVICE<br/>- Framework Compilation Engine (DAG validation)<br/>- Category Engine (Levels L1 through L10)<br/>- Term & Association Engine (Parent-Child Edges)"]
        UO["USER-ORG MANAGEMENT SERVICE<br/>- Core Organisation Registration<br/>- Child Unit Designation & Role Configuration<br/>- Bulk User Transfer Engine (CSV streaming processor)"]
    end
    subgraph T4["STORAGE & CACHING PERSISTENCE TIER"]
        CS[("APACHE CASSANDRA CLUSTER<br/>- Serialized JSON trees<br/>- Term association edges")]
        RD[("REDIS DISTRIBUTED CACHE<br/>- Compiled framework<br/>trees (24h TTL)")]
        PG[("POSTGRESQL DATABASE<br/>- Relational org master<br/>- Designation master")]
        KF["APACHE KAFKA CLUSTER<br/>- Topic: telemetry.org.mutations<br/>- Topic: analytics.cdc.hierarchy"]
    end
    subgraph T5["ANALYTICAL LAKEHOUSE TIER"]
        BQ[("GOOGLE BIGQUERY (BQ) DATA LAKE<br/>- Table: igot_analytics.org_hierarchy_flattened (Materialized root-to-leaf paths for national roll-up reports)")]
    end
    M1 -->|"HTTPS Requests"| GW
    GW -->|"Internal Routing"| J1((" "))
    J1 -->|"REST"| FW
    J1 -->|"REST"| UO
    FW -->|"Read/Write"| CS
    FW -->|"Cache"| RD
    UO -->|"Relational Write"| PG
    UO -->|"Audit Event"| KF
    KF -->|"CDC Ingestion"| BQ
```

## 5. Actor & Boundary Context Diagram

This diagram maps human administrative roles to permitted boundary operations, gateway enforcement rules, and restricted portal functions.

```mermaid
---
title: ACTOR & BOUNDARY CONTEXT DIAGRAM
---
flowchart LR
    A1["CENTRAL SPV ADMIN<br/>- Global administrative scope<br/>- Sets up foundational frameworks"] --> P1["PERMITTED BOUNDARY INTERACTIONS<br/>- Read/Write access across all Central Ministries and State Government trees<br/>- Full-tree bulk upload, download, and replacement across all jurisdictions"]
    A2["SPV STATE ADMIN<br/>- State-level governance scope<br/>- Isolated from other states"] --> P2["PERMITTED BOUNDARY INTERACTIONS<br/>- Read/Write access limited to organizations within assigned stateId<br/>- Central Government access blocked at API Gateway (HTTP 403 Forbidden)"]
    A3["L0 MDO LEADER<br/>- Ministry-level executive scope<br/>- Manages child units and users"] --> P3["PERMITTED BOUNDARY INTERACTIONS<br/>- Full control over assigned Ministry hierarchy branch ($L_0 \dots L_{10}$)<br/>- Create child orgs ($L_1$), configure designations, and transfer users"]
    A4["MDO / SUB-UNIT ADMIN<br/>- Department-level operational<br/>administrative scope"] --> P4["PERMITTED BOUNDARY INTERACTIONS<br/>- Read-only view of organization subtree from assigned node downwards<br/>- Authorized to reallocate users downward within assigned department branch"]
    A5["CBP / CBC PLANNER<br/>- Capacity building planner scope<br/>- Curates competency frameworks"] --> P5["PERMITTED BOUNDARY INTERACTIONS<br/>- Read-only consumption of organization trees to target training programs<br/>- Cascades ODCS competency models down through subordinate departments"]
    A6["CIVIL SERVANT / LEARNER<br/>- End-user learner profile scope<br/>- Onboarded via CSR or bulk moves"] --> P6["PERMITTED BOUNDARY INTERACTIONS<br/>- Linked to a specific organization#59; inherits ancestor domain permissions<br/>- Consumes courses cascaded from parent Ministry or department branches"]
```

## 6. End-to-End Creation & Management Context Diagram

This diagram details the components and data flows involved in creating, modifying, and replacing organizational structures, child departments, and user assignments.

```mermaid
---
title: CREATION & MANAGEMENT CONTEXT DIAGRAM
---
flowchart TD
    subgraph S1["ADMINISTRATIVE CREATION INITIATION"]
        FL["Flow A: Delegated Child Org Creation ($L_0$ MDO Leader creates new Department node)<br/>Flow B: Interactive UI Edge Association (Administrator connects parent and child nodes)<br/>Flow C: Destructive Full-Tree Bulk Upload (Administrator uploads spreadsheet replacing hierarchy)<br/>Flow D: Streaming Bulk User Transfer (Administrator moves users between departments via CSV)"]
    end
    subgraph S2["API GATEWAY & TENANCY INGRESS FILTER"]
        GW["Kong Ingress Controller: Validates JWT token, verifies tenancy boundaries, extracts X-Channel-Id, and forwards requests"]
    end
    subgraph S3["CORE SERVICE EXECUTION"]
        UO["USER-ORG MANAGEMENT SERVICE<br/>- Checks department name uniqueness within root scope<br/>- Creates organization record in PostgreSQL (status='Live')<br/>- Reassigns user organization mappings from CSV input<br/>- Manages local designation master lists"]
        TX["SUNBIRD TAXONOMY & FRAMEWORK ENGINE<br/>- Registers node terms under level categories ($L_1-L_{10}$)<br/>- Creates parent-child associations (PATCH /term/update)<br/>- Bulk Ingestion: Replaces all edges and verifies DAG rules<br/>- Compilation: Validates single parent and cycle rules"]
    end
    subgraph S4["STORAGE TIERS"]
        PG[("POSTGRESQL RELATIONAL MASTER<br/>- Table: organisation_master<br/>- Table: org_designation_master")]
        CR[("CASSANDRA & REDIS CACHE<br/>- Stores compiled hierarchy JSON trees<br/>- Caches trees in Redis for fast read access")]
    end
    subgraph S5["EVENT BROKER & CHANGE DATA CAPTURE"]
        KF["APACHE KAFKA MESSAGE BROKER<br/>- Topic: telemetry.org.mutations (Emits structural change events and audit trails)<br/>- Topic: analytics.cdc.hierarchy.sync (Streams user transfer events to data lakes)"]
    end
    subgraph S6["DATA LAKE STORAGE"]
        BQ[("GOOGLE BIGQUERY DATA LAKEHOUSE<br/>- Updates flattened hierarchy path records: root_org_id, org_id, level_depth, ancestor_path")]
    end
    FL -->|"HTTPS REST Calls"| GW
    GW -->|"Flow A & D Calls"| UO
    GW -->|"Flow B & C Calls"| TX
    UO -->|"Relational Persistence"| PG
    TX -->|"Graph Compilation"| CR
    PG --- J1((" "))
    CR --- J1
    J1 -->|"Emits Mutation CDC Events"| KF
    KF -->|"Real-time Ingestion Pipeline"| BQ
```

## 7. End-to-End Consumption Context Diagram

This diagram illustrates how compiled hierarchy data flows downstream into capacity planning, learner onboarding, training plans, and national analytics.

```mermaid
---
title: PLATFORM CONSUMPTION CONTEXT DIAGRAM
---
flowchart TD
    subgraph SRC["COMPILED HIERARCHY TRUTH SOURCE"]
        ENG["SUNBIRD FRAMEWORK CACHING ENGINE<br/>- Stores verified, compiled hierarchy trees in Redis and Cassandra (GET /apis/proxies/v8/framework/v1/read/{code})"]
    end
    subgraph DC["DOWNSTREAM CONSUMERS"]
        CBP["CBP PORTAL (PLANNING)<br/><br/>1. ODCS Competency Cascade<br/>- Ministry competency models cascade down to child departments<br/><br/>2. Annual Training Plan Scope<br/>- Multi-select tree picker resolves all descendant users across units"]
        LRN["LEARNER PORTAL<br/><br/>1. Custom Self-Registration<br/>- Department registration URLs resolve department branding and policies<br/><br/>2. Inherited Course Discovery<br/>- Courses scoped to parent Ministries cascade down to child unit learners"]
        ANA["ANALYTICS & BIGQUERY<br/><br/>1. BigQuery Sync Worker<br/>- Ingests Kafka events<br/>- Flattens JSON trees into materialized paths<br/><br/>2. Multi-Tier Reporting<br/>- Prefix-matching queries aggregate completions across administrative subtrees"]
        REP["OPEN REPORTING APIS<br/><br/>1. National Governance<br/>- Secure REST access to compiled trees<br/>- Roll-up reporting by state and ministry<br/><br/>2. Ministerial Dashboards<br/>- Feeds external BI tools and dashboards"]
    end
    ENG -->|"Read Compiled Tree"| CBP
    ENG -->|"Read Compiled Tree"| LRN
    ENG -->|"Stream CDC Events"| ANA
    ENG -->|"REST Read"| REP
```

## 8. Data Flow & Integration Context Matrix

This matrix defines all data flows between subsystems, identifying source and destination boundaries, protocols, data payloads, and synchronization schedules.

| Flow ID | Source Component | Destination Component | Protocol / API / Event | Exchanged Data Payload | Cadence / Trigger | Architectural Intent |
|---|---|---|---|---|---|---|
| **DF-01** | MDO / SPV Portal | Kong API Gateway | HTTPS / TLS 1.3 (REST) | Framework mutation payload with Bearer JWT token | User-initiated on tree edit | Secure ingress routing with tenant claims |
| **DF-02** | Kong API Gateway | Framework Service | HTTP / REST (Internal) | Term association definitions and level categories | Synchronous proxy forward | Internal cluster routing for graph updates |
| **DF-03** | MDO Portal | User-Org Service | HTTPS / Multipart Form | Excel/CSV file streams (up to 100 MB) | User-initiated bulk upload | Full-tree uploads and bulk user transfers |
| **DF-04** | User-Org Service | PostgreSQL Database | TCP / JDBC (Port 5432) | Relational SQL parameters (`organisation_master`) | Transactional write | Persists organization profiles and designations |
| **DF-05** | Framework Service | Cassandra Cluster | TCP / CQL (Port 9042) | Serialized compiled framework JSON structures | On framework publication | Stores compiled hierarchy trees |
| **DF-06** | Framework Service | Redis Cache Cluster | TCP / RESP (Port 6379) | Serialized compiled framework JSON (24h TTL) | On publication / cache miss | In-memory caching for sub-500ms tree reads |
| **DF-07** | Framework Service | Kafka Event Bus | TCP / Kafka Protocol | Event envelope on `telemetry.org.mutations` topic | Asynchronous on tree change | Broadcasts structural change notifications |
| **DF-08** | User-Org Service | Kafka Event Bus | TCP / Kafka Protocol | User movement records on `analytics.cdc.hierarchy` | Asynchronous on user move | Broadcasts user reassignment events |
| **DF-09** | Kafka Event Bus | BigQuery Sink Worker | TCP / Kafka Consumer | Consumes compiled tree and user transfer events | Continuous stream processing | Ingests change events for analytical processing |
| **DF-10** | BigQuery Worker | Google BigQuery | HTTPS / Google Cloud API | Insert rows into `org_hierarchy_flattened` | Micro-batch (target min) | Maintains flattened paths for analytics |
| **DF-11** | CBP Portal | Framework Service | HTTPS / REST (Internal) | `GET /framework/v1/read/{frameworkCode}` | On training plan creation | Resolves descendant units for training plans |
| **DF-12** | Learner Portal | Org Master Service | HTTPS / REST (Internal) | Custom slug lookup (`/api/org/resolve/{slug}`) | On CSR landing page load | Resolves department branding and domain rules |
| **DF-13** | External Consumers | Open Reporting APIs | HTTPS / REST (TLS 1.3) | `GET /open/reports/v1/org-tree` with Bearer token | Scheduled / On-demand | Provides external access for national reporting |

## 9. Security, Multi-Tenancy & External Boundary Context

This section outlines the platform's multi-tenant boundary model and security controls.

```mermaid
---
title: SECURITY & TENANCY CONTEXT DIAGRAM
---
flowchart TD
    subgraph PUB["PUBLIC / UNTRUSTED NETWORK ZONE"]
        BR["Browser Clients: SPV Portal, MDO Portal, CBP Portal, Learner Portal"]
    end
    subgraph DMZ["DMZ / INGRESS CONTROL BOUNDARY"]
        KONG["KONG REVERSE PROXY & API GATEWAY<br/>- Validates Keycloak JWT signatures and checks token expiration<br/>- Extracts tenant identity (channel) and state scope (stateId)<br/>- Blocks cross-boundary access (e.g., State Admin accessing Central Government endpoints)<br/>- Injects verified headers: X-Channel-Id, X-State-Id, X-Authenticated-User-Token"]
    end
    subgraph INT["INTERNAL TRUSTED WORKLOAD ZONE (Kubernetes Namespace: igot-core)"]
        MS["Internal Microservices: Sunbird Framework Service, User-Org Management Service, Ingestion Workers<br/>- Microservices trust gateway headers and enforce tenancy boundaries on all operations<br/>- Relational database updates are scoped by root organization (root_org_id = caller_channel)<br/>- Outgoing database and cache connections use mTLS encryption"]
    end
    BR -->|"HTTPS / TLS 1.3 (Public Internet)"| KONG
    KONG -->|"Verified Cluster Network Traffic"| MS
```

### 9.1 Boundary Enforcement Rules

1. **Zero-Trust Ingress Verification:** No client can communicate directly with internal microservices; all traffic must pass through the Kong API Gateway.
2. **State Administrative Boundary Isolation:** An SPV State Admin cannot view, create, or modify organizations outside their assigned state jurisdiction (`X-State-Id`). The gateway intercepts out-of-scope requests and returns `HTTP 403 Forbidden`.
3. **Ministry Tenancy Scoping:** An MDO Leader cannot perform operations outside their Ministry's channel boundary (`X-Channel-Id`). Attempts to link nodes to another ministry's framework are rejected by the validation engine.
4. **Audit Logging:** All administrative operations (node creation, edge links, delinking, bulk uploads, user transfers) generate immutable audit logs sent to Kafka and stored in PostgreSQL.

## 10. Requirement-to-Context Traceability (Q2 – Q13)

This matrix maps system context elements to Jira delivery tickets, Confluence functional specifications, and verified platform behaviors across all project quarters:

**REQUIREMENT-TO-CONTEXT TRACEABILITY MATRIX**

| Requirement ID | Context Capability | Jira Source Reference | Implementing Boundary | Target Data & Integration Channel |
|---|---|---|---|---|
| REQ-CTX-ORG-001 | Delegated Child Org Create | KB-10512 | User-Org Service | PostgreSQL organisation_master |
| REQ-CTX-ORG-002 | Duplicate Name Check | KB-10512 | Relational Master DB | Case-insensitive unique constraint index |
| REQ-CTX-ORG-003 | Subtree Delinking Workflow | KB-9033, KB-10513 | Sunbird Framework Svc | Cascading term association cleanup |
| REQ-CTX-HIER-001 | Cascading Card UI View | KB-9033, KB-10513 | Angular Presentation | Dynamic virtual columns ($L_1-L_{10}$) |
| REQ-CTX-HIER-002 | Parent-Child Edge Linking | KB-9033, KB-10513 | Sunbird Framework Svc | Directed edges in term_association |
| REQ-CTX-HIER-004 | Max Depth ($L_{10}$) Limit | KB-9740, KB-10501 | Taxonomy Validation Eng | Graph validation schema ($\le 10$ levels) |
| REQ-CTX-BULK-001 | Template Export with Masters | KB-9737, KB-10533 | Bulk Operations Worker | Dynamic Excel workbook generation |
| REQ-CTX-BULK-003 | Full-Tree Bulk Overwrite | KB-9737, KB-10533 | Taxonomy Compilation Eng | Complete graph replacement workflow |
| REQ-CTX-USER-001 | Bulk User Reallocation CSV | KB-10514 | User-Org Service | Streaming CSV processor & profile updates |
| REQ-CTX-SEC-001 | State Admin Boundary Guard | KB-9197 | Kong Gateway Ingress | Cryptographic token claims validation |
| REQ-CTX-INT-001 | BigQuery Analytics Sync | KB-9801, KB-10534 | Analytics Pipeline | Kafka CDC stream: analytics.cdc.sync |
| REQ-CTX-INT-002 | Open Reporting REST APIs | KB-10576 | Reporting Service | REST API: /open/reports/v1/org-tree |
| REQ-CTX-INT-003 | Training Plan Tree Scoping | KB-10577 | CBP Module | Hierarchical multi-select tree picker |
| REQ-CTX-INT-004 | ODCS Competency Cascading | KB-10578 | Competency Service | Event-driven competency model cascading |
| REQ-CTX-INT-005 | Custom Self-Registration | KB-10574 | Learner Ingress Proxy | Slug-to-organization resolution mapping |

## 11. Appendices & References

### 11.1 Primary Confluence Requirements & Technical Documents

- [SRS - Organisation Hierarchy | MDO Admin & MDO Leader | MDO Portal](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/517931009/SRS+-+Organisation+Hierarchy+MDO+Admin+MDO+Leader+MDO+Portal)
- [SRS - Organisation Hierarchy Update | SPV Admin & SPV State | AdminSPV Portal](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/416317441/SRS+-+Organisation+Hierarchy+Update+SPV+Admin+SPV+State+AdminSPV+Portal)
- [Organisation Hierarchy View](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/396328967/Organisation+Hierarchy+View)
- [L0 Hierarchy Management- MDO Portal](https://karmayogibharat.atlassian.net/wiki/spaces/KQAS/pages/503612134/L0+Hierarchy+Management-+MDO+Portal)
- [Organization Hierarchy update SPV Admin](https://karmayogibharat.atlassian.net/wiki/spaces/KQAS/pages/417071170/Organization+Hierarchy+update+SPV+Admin)

### 11.2 Jira Reference Inventory

- **Initiatives & Epics:** [KB-8975: Q8 | Organization Hierarchy management](https://karmayogibharat.atlassian.net/browse/KB-8975) (Open), [KB-8018: Q8 | Organisation Hierarchy Update | SPV Admin & SPV State | AdminSPV Portal](https://karmayogibharat.atlassian.net/browse/KB-8018) (KB Approved), [KB-10500: Q9 | Org hierarchy Management & Impacted Areas](https://karmayogibharat.atlassian.net/browse/KB-10500) (KB Review), [KB-10501: Q9 | L0 hierarchy Management | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10501) (KB Review), [KB-10502: Q9 | Org hierarchy Impacted areas](https://karmayogibharat.atlassian.net/browse/KB-10502) (KB Review), [KB-8441: Q7 | Tech Debt | Org Hierarchy Enhancements](https://karmayogibharat.atlassian.net/browse/KB-8441) (In Progress), [KB-4441: Q4 | Ad-Hoc Requests | Organisation rename and Hierarchy cleanup.](https://karmayogibharat.atlassian.net/browse/KB-4441) (In Progress).
- **Delivery Stories:** [KB-9033: Q8 | Organisation Hierarchy Management | SPV Admin | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9033) (Prod Deployed), [KB-9197: Q8 | Organisation Hierarchy Access Management | SPV & State Admin | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9197) (Prod Deployed), [KB-9737: Q8 | Bulk Upload & Download | Org Hierarchy Management | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9737) (Prod Deployed), [KB-9738: Q8 | Org Search Funcationality | Organisation Hierarchy Management](https://karmayogibharat.atlassian.net/browse/KB-9738) (Prod Deployed), [KB-9740: Q8 | Manage Hierarchy Levels/Layers & Renaming | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9740) (To Do), [KB-9790: Q8 | Organisation Hierarchy View | SPV & State Admin | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9790) (To Do), [KB-9795: Q8 | Organisation Specific Page Redirection | Organisation Hierarchy Management | SPV Portal](https://karmayogibharat.atlassian.net/browse/KB-9795) (Prod Deployed), [KB-9801: Q8 | Organisation Hierarchy Sync with BQ for reporting | Organisation Hierarchy Management](https://karmayogibharat.atlassian.net/browse/KB-9801) (Open), [KB-10512: Q9 | Child Organization Creation Capability Dev Completed](https://karmayogibharat.atlassian.net/browse/KB-10512), [KB-10513: Q9 | Implement Org-Specific Hierarchy Management | MDO Portal Dev Completed](https://karmayogibharat.atlassian.net/browse/KB-10513), [KB-10514: Q9 | Create Bulk User Transfer Feature (Add/Update) | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10514) (DEV IN PROGRESS), [KB-10515: Q9 | Enable Child Org Data Management | MDO Portal Code](https://karmayogibharat.atlassian.net/browse/KB-10515) (Review), [KB-10533: Q9 | Bulk Upload | Organisation Hierarchy Management Dev Completed](https://karmayogibharat.atlassian.net/browse/KB-10533), [KB-10534: Q9 | Organisation Hierarchy Sync with BQ for reporting | Organisation Hierarchy Management](https://karmayogibharat.atlassian.net/browse/KB-10534) (In-Progress), [KB-10535: Q9 | Data Tracking | Org Hierarchy Management | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10535) (DEV IN PROGRESS), [KB-10574: Q9 | Custom Self registration Functionality | Org Hierarchy Management](https://karmayogibharat.atlassian.net/browse/KB-10574) (Open), [KB-10575: Q9 | MDO Reports | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10575) (In-Progress), [KB-10576: Q9 | Open APIs for reporting](https://karmayogibharat.atlassian.net/browse/KB-10576) (Prod Deployed), [KB-10577: Q11 | Ad-Hoc | CA and APAR Enhancements |Org Hierarchy in Training Plan Creation | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10577) (Open), [KB-10578: Q9 | ODCS effectiveness for Child Organisations | MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-10578) (Open), [KB-15967: Tech Debt | Org Hierarchy Enhancements](https://karmayogibharat.atlassian.net/browse/KB-15967) (Open).
- **Ad-Hoc & Infrastructure Tickets:** [KB-428: Q2 l Data Warehousing l Org hierarchy fields](https://karmayogibharat.atlassian.net/browse/KB-428) (Prod Deployed), [KB-838: Q2 | Ad-Hoc Requests | Cleaning up MDO Hierarchy.](https://karmayogibharat.atlassian.net/browse/KB-838) (Open), [KB-1312: Org Hierarchy | Hierarchy cleanup activity and corresponding access to Orgs.](https://karmayogibharat.atlassian.net/browse/KB-1312) (Open), [KB-5057: Q4 | Ad-Hoc Requests | Data Warehouse, Operational Reports and Full exhausts enhancements | Org Hierarchy Table.](https://karmayogibharat.atlassian.net/browse/KB-5057) (Open), [KB-8442: Explore Neo4J to store org hierarchy](https://karmayogibharat.atlassian.net/browse/KB-8442) (Internal Review).

### 11.3 Technical Glossary

- **C4 Model:** A standard software architecture modeling framework that visualizes systems at four levels: Context, Containers, Components, and Code.
- **CDC (Change Data Capture):** An architectural pattern that tracks database mutations and streams them to downstream data lakes or caches.
- **DAG (Directed Acyclic Graph):** A directed graph with no closed loops or cycles. In this platform, hierarchies are constrained to DAGs where each node has at most one parent.
- **Materialized Path:** A hierarchical data pattern where a node stores its entire ancestor path as a delimited string (e.g., `/L0/L1/L2`), enabling fast subtree queries without recursive joins.
- **Sunbird Framework:** The master taxonomy container representing an organization tree (`<channelId>_org_hierarchy`).
- **Sunbird Category:** An administrative level () within a taxonomy framework.
- **Sunbird Term:** An individual administrative organization node within a category.
- **Sunbird Term Association:** A directed parent-child edge linking two terms within a framework.
- **MDO:** Ministry, Department, and Organisation.
- **SPV:** Special Purpose Vehicle (Karmayogi Bharat central governance team).
- **ODCS:** Organizational Development & Competency Sub-framework.
- **CSR:** Custom Self-Registration.
