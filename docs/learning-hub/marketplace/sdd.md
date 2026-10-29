# Marketplace — Software Design Description (SDD)

## 1. Introduction & Architectural Tenets

### 1.1 Purpose

This Software Design Description (SDD) provides the complete structural, behavioral, interface, and data design for the **iGOT Karmayogi Marketplace** subsystem, tracing its architectural evolution from **Quarter 4 (Q4)** through **Quarter 13 (Q13)**. It translates the functional and non-functional requirements established in `SRS-IGOT-MP-Q4-Q13-V2.0` into concrete software components, service boundaries, sequence flows, database schemas (DDL), API contracts, and security architectures.

### 1.2 Architectural Principles

The Marketplace engineering architecture adheres to five core design principles:

1. **Federated Identity with Zero Credential Disclosure:** Civil servants authenticate natively via iGOT Keycloak; third-party education providers receive cryptographically signed SAML 2.0 assertions with pseudonymous identifiers (`sub` UUIDs). No government passwords or national identifiers (Aadhaar, PAN) are ever transmitted across external gateway boundaries.
2. **Fail-Safe Access Gating:** Access control evaluation (Minimum Karma Points, concurrent active caps, annual consumption quotas) operates on a **default-deny** paradigm. In the event of downstream service timeouts or database unreachability, the system rejects enrollment to prevent unmetered commercial seat leakage.
3. **Decoupled Asynchronous Consumption Pipeline:** High-volume telemetry, SCORM milestone pings, and external completion events are decoupled from synchronous user transactions using Apache Kafka (`dev.enrollment.progress`), protecting core learning databases from write contention.
4. **Separation of Gamification Concerns:** **Karma Points** serve as a non-spendable merit metric and access gating threshold; **Karma Coins** operate as spendable virtual tokens housed in an atomic, double-entry ledger (`user-karma-coin-wallet`) used exclusively for commercial seat redemption.
5. **Backward-Compatible Evolutionary Growth:** Capabilities introduced in later milestones (e.g., Q13 bulk publishing and seat caps) cleanly extend earlier foundational layers (Q10 SAML IdP broker and Q11 REST pull schedulers) without breaking existing partner contracts.

## 2. Chronological System Decomposition & Architectural Evolution

### 2.1 The Four Evolutionary Milestones (Q4 to Q13)

```mermaid
flowchart TD
    subgraph CSE["CHRONOLOGICAL SYSTEM EVOLUTION (Q4 TO Q13)"]
        A["[ Milestone 1: Q4–Q8 Early CIOS API & Manual Ingestion ]<br/>• Architecture: Point-to-point REST ingestion in cios-content-service and manual SQL/Cassandra seeds.<br/>• Sync Strategy: Daily scheduled SFTP batch drop parser for Harvard.<br/>• Curation: Manual aggregation of external links into blended courses (KB-6649, KB-8529)."]
        B["[ Milestone 2: Q10 Standards-Based Foundation, SAML 2.0 & Access Gating ]<br/>• Architecture: Public partner self-registration, administrative approval queue in cb-pores-service.<br/>• Federation: Keycloak (sunbird-auth) SAML 2.0 IdP broker with dynamic attribute mappers.<br/>• Governance: Policy engine in cb-ext-course-service evaluating Min Karma Points & concurrent caps.<br/>• Compliance: Un-bypassable learner data-sharing consent and commitment pledge modal."]
        C["[ Milestone 3: Q11–Q12 Multi-Provider Automation & Catalog Operations ]<br/>• Architecture: Automated REST pull engine with JOLT JSON mapping (CornellSchedulerService).<br/>• Connectivity: Heterogeneous connectors (Cornerstone LMS for World Bank OLC, Emeritus, Simplilearn).<br/>• Operational Control: Administrative status toggles (Activate/Deactivate) for partners and courses.<br/>• UX Enhancements: Branded partner banners and Table of Contents (TOC) guidance tips."]
        D["[ Milestone 4: Q13 Commercial Licensing, Bulk Publishing & Karma Wallet ]<br/>• Architecture: Multi-tier licensing models (Course Enrolment Licensing vs. User Licensing).<br/>• Catalog Curation: Commercial classification (PAID vs. FREE) with strict paid seat limits.<br/>• Pipeline: Bulk publishing pipeline with automated validation checklist and downloadable CSV error logs.<br/>• Gamification: Virtual currency redemption engine (user-karma-coin-wallet) debiting Karma Coins."]
        A --> B --> C --> D
    end
```

## 3. Comprehensive Modular Component Architecture

The diagram below details the 5-tier architecture connecting presentation portals, edge proxies, core microservices, polyglot data stores, and external partner LMS platforms.

```mermaid
flowchart TD
    subgraph Tier1 ["Tier 1: Presentation Tier (Client Applications)"]
        SPV_UI["SPV Admin & Publisher Portal (Angular SPA)\n- Partner Approval (Q10)\n- SAML 2.0 Config (Q10)\n- Min Karma / Caps (Q10)\n- Paid/Free Classify (Q13)\n- Bulk Publish CSV (Q13)"]
        LP_Web["Learner Web Portal (Angular SPA)\n- Partner Banners (Q11)\n- TOC Guidance Tips (Q11)\n- Consent & Pledge Modal (Q10)\n- Paid/Free Filters (Q13)\n- Karma Coin Redeem UI (Q13)"]
        LP_Mob["iGOT Mobile Client (Flutter)\n- Mobile Catalog Discovery\n- In-App Browser External Launch\n- Mobile Karma Wallet View"]
        Public_UI["Public Partner Self-Registration (Angular)\n- Institutional Verification Form (Q10)\n- Application Status Tracker (Q10)"]
    end
    subgraph Tier2 ["Tier 2: Edge Routing & Security Ingress Layer"]
        Kong_GW["Kong API Gateway\n- OAuth2 / JWT Validation\n- Rate Limiting & SSL Offloading\n- RBAC (SPV_ADMIN, SPV_PUBLISHER)"]
        UI_Proxy["sunbird-cb-uiproxy (Node.js / Express BFF)\n- Client Session Management\n- External Launch Interceptor\n- Consent Verification Guard"]
        Keycloak["sunbird-auth (Keycloak SPI Broker)\n- SAML 2.0 Web Browser SSO Broker\n- Attribute Mappers: sub, givenName, email"]
    end
    subgraph Tier3 ["Tier 3: Core Application Microservices Layer"]
        PoresSvc["cb-pores-service (Scala / Play)\n- Partner Registry & Approval Engine\n- Partner Tenancy & Status Management\n- Provider Settings Store"]
        CourseExtSvc["cb-ext-course-service (Node.js / Java)\n- Prerequisite Gating Evaluator\n- Min Karma Points Comparator\n- Concurrent & Annual Cap Engine\n- Licensing Model Manager (Q13)"]
        EnrollSvc["cb_external_enrollment_service (Java / Play)\n- External Enrolment Registry\n- Atomic Enrolment Counter Engine\n- Status Transition Manager"]
        ContentSvc["sunbird-content-service (Scala / Java)\n- Course Metadata CRUD\n- Paid vs Free Curation Flags\n- Bulk Publishing Validation Engine"]
        CIOSSvc["cios-content-service (Java / Spring Boot)\n- CornellSchedulerService (REST Pull)\n- JOLT JSON Transformation Pipeline\n- SFTP Daily Batch Drop Client\n- External Adapter Connectors"]
        WalletSvc["user-karma-coin-wallet (Node.js / Java)\n- Atomic Coin Balance Ledger\n- Point-to-Coin Conversion Engine\n- Course Redemption Debit Processor"]
    end
    subgraph Tier4 ["Tier 4: Streaming & Asynchronous Pipeline"]
        Kafka_Prog["Apache Kafka Bus\n- Topic: dev.enrollment.progress\n- Topic: telemetry.raw"]
        DownstreamConsumer["Downstream LMS Event Consumer\n- Enrolment Status Finalizer\n- Karma Reward Trigger Engine"]
    end
    subgraph Tier5 ["Tier 5: Polyglot Persistence & Caching Tier"]
        Cas_Provider[("Cassandra: sunbird.content_provider\n- Partner master records, tenancy, status")]
        Cas_Access[("Cassandra: sunbird.provider_access_settings\n- minkarmapoints, concurrent_cap, annual_cap")]
        Cas_Enrol[("Cassandra: sunbird.user_external_enrolments\n- Active/historical enrolments, status, pledge")]
        Cas_Counter[("Cassandra: sunbird.user_external_enrolments_counter\n- Atomic counter per partner & seat limit")]
        Cas_Wallet[("Cassandra: sunbird.user_karma_coin_wallet\n- Available coins, ledger audit records")]
        ES_Catalog[("Elasticsearch: composite-search\n- Live marketplace courses, commercial facets")]
        Redis_Cache[("Redis Distributed Cache\n- Cached partner settings, session state")]
    end
    subgraph ExternalTier ["Tier 6: External Education Provider Ecosystem"]
        Partner_SAML["Partner SAML 2.0 IdP / ACS Endpoint\n(Harvard, eCornell, Emeritus, Simplilearn)"]
        Partner_REST["Partner REST Ingestion / SFTP Servers\n(Daily CSV progress exports, catalog APIs)"]
    end
    %% Wiring: Tier 1 to Tier 2
    Public_UI --> Kong_GW
    SPV_UI --> Kong_GW
    LP_Web --> UI_Proxy
    LP_Mob --> UI_Proxy
    UI_Proxy --> Kong_GW
    %% Wiring: Tier 2 to Tier 3
    Kong_GW --> PoresSvc
    Kong_GW --> CourseExtSvc
    Kong_GW --> ContentSvc
    Kong_GW --> Keycloak
    UI_Proxy --> EnrollSvc
    UI_Proxy --> WalletSvc
    UI_Proxy --> CIOSSvc
    %% Wiring: Tier 3 to Tier 5
    PoresSvc --> Cas_Provider
    CourseExtSvc --> Cas_Access
    CourseExtSvc --> Redis_Cache
    EnrollSvc --> Cas_Enrol
    EnrollSvc --> Cas_Counter
    ContentSvc --> ES_Catalog
    WalletSvc --> Cas_Wallet
    CIOSSvc --> Cas_Enrol
    %% External Handoffs
    Keycloak <-->|SAML 2.0 Web SSO| Partner_SAML
    CIOSSvc <-->|REST Pull / SFTP Batch| Partner_REST
    %% Streaming Handoffs
    Partner_REST -.->|Webhook / Cron Event| CIOSSvc
    CIOSSvc -->|Publish Progress Event| Kafka_Prog
    Kafka_Prog --> DownstreamConsumer
    DownstreamConsumer --> Cas_Enrol
    DownstreamConsumer --> WalletSvc
```

## 4. Subsystem Detailed Designs (Chronological Architecture)

### 4.1 Partner Onboarding & Tenancy Subsystem (`cb-pores-service` — Q10)

- **Component Responsibility:** Manages public partner registration, institutional document validation, approval workflows, and tenant record provisioning.
- **Service Classes & Modules:**
  - `PartnerRegistrationController`: Exposes unauthenticated endpoint `POST /public/partner/register` validating applicant payload and PDF attachments.
  - `PartnerWorkflowService`: Governs the finite state transitions: `PENDING_APPROVAL` `ACTIVE` (or `REJECTED`).
  - `PartnerRepository`: Interacts with Cassandra table `sunbird.content_provider`.

```mermaid
flowchart TD
    F["[ Public Self-Reg Form ]"] --> C["[ PartnerRegistrationController ]"]
    C -->|"Validate Payload & PDF"| W["[ PartnerWorkflowService ]"]
    W -->|"PENDING_APPROVAL"| N["[ Emit Notification Event ]"]
    W -->|"APPROVED (SPV Admin)"| P["[ Provision Partner Tenancy ]"]
    P --> T[("[ sunbird.content_provider ]")]
```

### 4.2 Authentication & SAML 2.0 Identity Brokerage (`sunbird-auth` / Keycloak — Q10)

- **Component Responsibility:** Acts as an enterprise SAML 2.0 Service Provider / Identity Broker, bridging civil service sessions with third-party LMS platforms.
- **SAML Handshake Mechanics:**
  - Learner clicks an external course link.
  - `sunbird-cb-uiproxy` routes the request to Keycloak SAML redirect binding.
  - Keycloak builds a signed `<samlp:AuthnRequest>` containing the platform's `EntityID` and delivers it to the partner's Single Sign-On URL.
  - Upon authentication, Keycloak issues a `<saml:Assertion>` cryptographically signed with RSA-SHA256 containing mapped attributes (`sub`, `givenName`, `surname`, and `email`).

- **Attribute Mapper Implementation:** Implemented via Keycloak SPI user protocol mappers:
  ```json
  {
    "protocol": "saml",
    "protocolMapper": "saml-user-attribute-mapper",
    "name": "iGOT UUID Mapper",
    "config": {
      "user.attribute": "id",
      "attribute.name": "sub",
      "attribute.nameformat": "urn:oasis:names:tc:SAML:2.0:attrname-format:basic"
    }
  }
  ```

### 4.3 Policy Gating & Access Control Subsystem (`cb-ext-course-service` — Q10)

- **Component Responsibility:** Evaluates multi-dimensional fair-use access criteria before permitting course enrollment.
- **Evaluation Algorithm:**
  - Read `minkarmapoints`, `concurrent_cap`, and `annual_cap` from `sunbird.provider_access_settings` (cached in Redis with 1-hour TTL).
  - Query `sunbird.user_karma_points` for `userid`. If , immediately throw `ERR_KARMA_POINTS_SHORTFALL` (`HTTP 403`).
  - Query `sunbird.user_external_enrolments` for active enrollments (`status IN (0, 1)`). If active count , throw `ERR_CONCURRENT_LIMIT_REACHED` (`HTTP 403`).
  - Query total enrollments in the current Financial Year (April 1 to March 31). If count , throw `ERR_ANNUAL_LIMIT_REACHED` (`HTTP 403`).
  - If all evaluations pass, return `HTTP 200 OK` with an eligibility grant token.

### 4.4 Multi-Provider Ingestion & Automation Engine (`cios-content-service` — Q11–Q12)

- **Component Responsibility:** Ingests external course catalogs and consumption telemetry using scheduled REST pull workers and SFTP drop parsers.
- **Core Components:**
  - `CornellSchedulerService`: Quartz cron-triggered scheduler executing every 6 hours, querying eCornell catalog REST endpoints.
  - `JoltTransformationEngine`: Applies JSON-to-JSON transformations to normalize vendor schemas into the Sunbird Content Hierarchy model:

```mermaid
flowchart LR
    A["[ eCornell Raw JSON ]"] --> B["[ JOLT Specification ]"] --> C["[ Sunbird Course Metadata ]"]
```

- `HarvardSFTPClient`: Connects via JSch SSH/SFTP, ingests daily completion CSVs, matches student IDs, and pushes normalized events to Kafka.

### 4.5 Commercial Catalog & Bulk Publishing Engine (`sunbird-content-service` — Q13)

- **Component Responsibility:** Manages commercial metadata flags (`PAID` vs. `FREE`), seat limit quotas, and multi-course bulk publishing validation.
- **Validation Checklist Engine:**
  - Mandatory checks: `name.trim().length > 0`, `partnerId != null`, `pricingType IN ('PAID', 'FREE')`.
  - If `pricingType == 'PAID'`, verify `seatCapacity > 0` and `karmaCoinsRequired > 0`.
  - Generates an asynchronous bulk publish job. If any course fails validation, the job publishes valid items and aggregates failed rows into a downloadable CSV error report.

### 4.6 Karma Coin Wallet & Ledger Subsystem (`user-karma-coin-wallet` — Q13)

- **Component Responsibility:** Maintains the atomic balance of virtual Karma Coins, enforces monthly conversion quotas, and handles course redemption debits.
- **Ledger Accounting Pattern:** Double-entry ledger architecture ensuring coin conservation:
- **Atomic Batch Execution:**
  ```sql
  BEGIN BATCH
      UPDATE sunbird.user_karma_coin_wallet
      SET available_coins = available_coins - :coinsToDebit
      WHERE userid = :userId;

      INSERT INTO sunbird.karma_coin_ledger (userid, transaction_id, transaction_type, amount, reference_id, createdon)
      VALUES (:userId, :txnId, 'REDEEM_DEBIT', :coinsToDebit, :courseId, toTimestamp(now()));
  APPLY BATCH;
  ```

## 5. Detailed Behavioral Sequences & Control Flow

### 5.1 End-to-End Course Consumption & Redirection Sequence (Q10 SAML Flow)

This sequence details the interaction among the learner, BFF proxy, access policy evaluator, Keycloak broker, and external partner LMS.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Civil Service Learner
    participant LP as Learner Web Portal (Angular)
    participant Proxy as sunbird-cb-uiproxy (BFF)
    participant Access as cb-ext-course-service
    participant EnrollSvc as cb_external_enrollment_service
    participant Keycloak as Keycloak SAML Broker
    participant PartnerACS as External Partner ACS / LMS
    participant Cas as Cassandra DB %% 1. Pre-Check & Gating
    Learner->>LP: Click "Enrol / Launch" on Marketplace Course
    LP->>Proxy: POST /action/marketplace/v1/precheck {courseId, partnerId}
    Proxy->>Access: GET /accessSettings/v1/verify/{partnerId}/{userId}
    Access->>Cas: Read user_karma_points & user_external_enrolments
    Cas-->>Access: Karma Balance: 100 | Active Courses: 0
    Access-->>Proxy: 200 OK {eligible: true}
    Proxy-->>LP: 200 OK (Prerequisites Satisfied) %% 2. Mandatory Consent & Pledge
    LP-->>Learner: Render Consent for Data Sharing & Learning Commitment Modal
    Learner->>LP: Clicks "I Agree & Undertake Pledge"
    LP->>Proxy: POST /action/marketplace/v1/consent/accept {courseId}
    Proxy->>EnrollSvc: POST /cios-enroll/v1/enrol {courseId, partnerId}
    EnrollSvc->>Cas: INSERT INTO user_external_enrolments (userid, courseid, status: 1, consent_timestamp: now())
    EnrollSvc-->>Proxy: 200 OK (Enrolled) %% 3. SAML SSO Handshake
    LP->>Proxy: GET /action/marketplace/v1/launch/{courseId}
    Proxy->>Keycloak: Initiate SAML Browser SSO
    Keycloak->>Keycloak: Generate Signed SAML AuthnRequest (RS256)
    Keycloak-->>LP: Deliver SAML Auto-Submit Form (HTTP POST Binding)
    LP->>PartnerACS: Submit Signed SAML Response to Partner ACS URL
    PartnerACS->>PartnerACS: Verify XML DSig Signature & Map sub UUID
    PartnerACS-->>LP: Establish Partner Session & Render Course Workspace
```

### 5.2 Atomic Karma Coin Course Redemption Sequence (Q13 Flow)

This sequence tracks the validation, ledger debiting, and enrollment granting for paid marketplace courses.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Civil Servant
    participant LP as Learner UI (Angular)
    participant Proxy as sunbird-cb-uiproxy (BFF)
    participant Wallet as user-karma-coin-wallet
    participant Cas as Cassandra DB
    participant EnrollSvc as cb_external_enrollment_service
    Learner->>LP: Click "Redeem Course" (Cost: 100 Karma Coins)
    LP->>Proxy: POST /action/marketplace/v1/redeem {courseId, coinValue: 100}
    Proxy->>Wallet: POST /karma/wallet/redeem
    Wallet->>Cas: SELECT available_coins FROM user_karma_coin_wallet WHERE userid=:userId
    Cas-->>Wallet: available_coins = 150
    alt Insufficient Coins (e.g. available < 100)
        Wallet-->>Proxy: 400 Bad Request {err: "INSUFFICIENT_COINS", balance: 40}
        Proxy-->>LP: 400 Bad Request
        LP-->>Learner: Display Conversion Modal (Convert Points to Coins)
    else Sufficient Coins
        Wallet->>Cas: Execute Atomic Batch (Debit 100 Coins, write karma_coin_ledger)
        Cas-->>Wallet: Batch Applied Successfully
        Wallet->>EnrollSvc: Notify Entitlement Granted {userId, courseId, receiptId: "rcpt_98214"}
        EnrollSvc->>Cas: INSERT INTO user_external_enrolments (userid, courseid, redemption_ref: "rcpt_98214")
        EnrollSvc-->>Wallet: Entitlement Registered
        Wallet-->>Proxy: 200 OK {status: "SUCCESS", receiptId: "rcpt_98214", balance: 50}
        Proxy-->>LP: 200 OK
        LP-->>Learner: Display Redemption Success & "Start Course" Button
    end
```

### 5.3 Asynchronous Progress Ingestion & Reward Sequence (Q11–Q13 Kafka Pipeline)

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Civil Servant
    participant PartnerLMS as External Partner LMS
    participant CIOSSvc as cios-content-service
    participant Kafka as Kafka (dev.enrollment.progress)
    participant LMSConsumer as Downstream LMS Event Consumer
    participant Cas as Cassandra DB
    participant Wallet as user-karma-coin-wallet
    Learner->>PartnerLMS: Consumes learning content & passes final assessment
    PartnerLMS->>CIOSSvc: Completion Notification (REST Webhook or SFTP Drop)
    CIOSSvc->>CIOSSvc: Validate Payload Schema (ProgressFileValidation.json)
    CIOSSvc->>Kafka: Publish EXTERNAL_PROGRESS_UPDATE {userId, courseId, progress: 100}
    CIOSSvc-->>PartnerLMS: 202 Accepted
    Kafka->>LMSConsumer: Ingest Message
    LMSConsumer->>Cas: Query user_external_enrolments (Check current status)
    alt Already Marked Completed
        LMSConsumer-->>LMSConsumer: Idempotent Skip (Discard duplicate)
    else Status < 2 (In-Progress)
        LMSConsumer->>Cas: UPDATE user_external_enrolments SET status = 2, completedon = now()
        LMSConsumer->>Wallet: Emit Reward Event {userId, rewardType: "COURSE_COMPLETION", points: 25}
        Wallet->>Cas: UPDATE user_karma_points SET total_points = total_points + 25
        LMSConsumer-->>LMSConsumer: Commit Kafka Offset
    end
```

## 6. Physical Database Schemas & Data Architecture (Cassandra DDL)

The Marketplace persistence layer is implemented in Apache Cassandra (`sunbird` keyspace) to support high-throughput, horizontally scalable read/write operations.

```sql
-- Keyspace Definition
CREATE KEYSPACE IF NOT EXISTS sunbird WITH replication = {'class': 'NetworkTopologyStrategy', 'datacenter1': 3};

-- 1. Partner Master Registry (Provisioned Q10 via Self-Registration)
CREATE TABLE IF NOT EXISTS sunbird.content_provider (
    partnerid text,
    orgname text,
    entitytype text,  -- "ACADEMIC", "COMMERCIAL", "GOVERNMENT"
    nodal_name text,
    nodal_email text,
    website text,
    status text,  -- "PENDING_APPROVAL", "ACTIVE", "REJECTED", "DEACTIVATED"
    sso_enabled boolean,
    licence_type text,  -- "ENROLMENT" or "USER" (Introduced Q13)
    createdon timestamp,
    updatedon timestamp,
    PRIMARY KEY (partnerid)
);

-- 2. Partner Access & Gating Policies Store (Q10)
CREATE TABLE IF NOT EXISTS sunbird.provider_access_settings (
    partnerid text,
    minkarmapoints int,  -- Read-only eligibility threshold
    concurrent_cap int,
    -- Max active concurrent courses per learner (Default: 2)
    annual_cap int,
    -- Max courses per learner per Financial Year
    createdon timestamp,
    updatedon timestamp,
    PRIMARY KEY (partnerid)
);

-- 3. User External Enrolment Registry (Q10 Active & Historical Store)
CREATE TABLE IF NOT EXISTS sunbird.user_external_enrolments (
    userid text,
    courseid text,
    partnerid text,
    licencetype text,  -- "ENROLMENT" or "USER" (Q13)
    status int,  -- 0: Enrolled, 1: In-Progress, 2: Completed, 3: Suspended
    completionpercentage int,  -- 0 to 100%
    enrolleddate timestamp,
    completedon timestamp,
    consent_timestamp timestamp,
    -- Timestamp of data-sharing pledge confirmation (Q10)
    redemption_ref text,  -- Karma Coin redemption receipt ID (Q13)
    PRIMARY KEY ((userid), courseid, partnerid)
) WITH CLUSTERING ORDER BY (courseid ASC, partnerid ASC);
CREATE INDEX IF NOT EXISTS idx_user_ext_enrol_partner ON sunbird.user_external_enrolments (partnerid);
CREATE INDEX IF NOT EXISTS idx_user_ext_enrol_status ON sunbird.user_external_enrolments (status);

-- 4. External Enrolment Counter Table (Fast Atomic Quota Tracking)
CREATE TABLE IF NOT EXISTS sunbird.user_external_enrolments_counter (
    partnerid text,
    partition_key text,  -- "TOTAL_ENROLMENTS" or specific Course ID
    consumed_count counter,
    PRIMARY KEY (partnerid, partition_key)
);

-- 5. User Karma Coin Wallet Balance Store (Introduced Q13)
CREATE TABLE IF NOT EXISTS sunbird.user_karma_coin_wallet (
    userid text,
    available_coins int,
    total_converted_coins int,
    last_updated timestamp,
    PRIMARY KEY (userid)
);

-- 6. Karma Coin Double-Entry Ledger Store (Introduced Q13)
CREATE TABLE IF NOT EXISTS sunbird.karma_coin_ledger (
    userid text,
    transaction_id text,
    transaction_type text,  -- "CONVERT_CREDIT", "REDEEM_DEBIT", "CREDIT_REFUND"
    amount int,
    reference_id text,  -- Marketplace Course ID or Receipt ID
    createdon timestamp,
    PRIMARY KEY ((userid), transaction_id)
) WITH CLUSTERING ORDER BY (transaction_id DESC);
```

## 7. Concrete API Interface Specifications

### 7.1 Access Gating Verification API (`cb-ext-course-service` — Q10)

- **Endpoint:** `GET /accessSettings/v1/verify/{partnerId}/{userId}`
- **Headers:** `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- **Path Parameters:**
  - `partnerId` (string, required): Unique identifier of the content partner.
  - `userId` (string, required): iGOT User UUID.

- **Response Codes:**
  - `200 OK`: Learner satisfies all access gating criteria.
  - `403 Forbidden`: Learner violates one or more access policies.

#### Inbound Request Example:

```http
GET /accessSettings/v1/verify/eCornell_001/usr_91824719284712 HTTP/1.1
Host: portal.igotkarmayogi.gov.in
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6...
```

#### Success Response (`HTTP 200 OK`):

```json
{
  "id": "api.accessSettings.verify",
  "ver": "1.0",
  "ts": "2026-10-29T18:15:00.000Z",
  "params": {
    "status": "SUCCESSFUL",
    "resmsgid": "b1849201-9a72-4c81-b201-984729184712"
  },
  "responseCode": "OK",
  "result": {
    "eligible": true,
    "userKarmaPoints": 120,
    "minKarmaPointsRequired": 50,
    "activeConcurrentCourses": 1,
    "maxConcurrentAllowed": 2,
    "annualEnrolmentsConsumed": 2,
    "annualEnrolmentCap": 5
  }
}
```

#### Gating Shortfall Response (`HTTP 403 Forbidden`):

```json
{
  "id": "api.accessSettings.verify",
  "ver": "1.0",
  "ts": "2026-10-29T18:15:01.000Z",
  "params": {
    "resmsgid": "c2948102-8b81-4d92-a102-874829174821",
    "status": "FAILED",
    "err": "ERR_KARMA_POINTS_SHORTFALL",
    "errmsg": "Learner Karma Points balance (35) is below the required partner threshold (50)."
  },
  "responseCode": "FORBIDDEN",
  "result": {
    "eligible": false,
    "shortfallType": "MIN_KARMA_POINTS",
    "currentPoints": 35,
    "requiredPoints": 50
  }
}
```

### 7.2 Karma Coin Course Redemption API (`user-karma-coin-wallet` — Q13)

- **Endpoint:** `POST /karma/wallet/redeem`
- **Headers:** `Authorization: Bearer <JWT>`, `Content-Type: application/json`
- **Inbound Request Payload:**

```json
{
  "userId": "usr_91824719284712",
  "courseId": "do_CID1130982348712",
  "partnerId": "eCornell_001",
  "coinsRequired": 100
}
```

- **Success Response** (`HTTP 200 OK`):

```json
{
  "id": "api.karma.wallet.redeem",
  "ver": "1.0",
  "ts": "2026-10-29T18:16:00.000Z",
  "params": {
    "status": "SUCCESSFUL",
    "resmsgid": "d9847201-a129-4b82-c847-194820194822"
  },
  "responseCode": "OK",
  "result": {
    "redemptionStatus": "SUCCESS",
    "receiptId": "rcpt_982147192847",
    "coinsDebited": 100,
    "remainingCoinBalance": 50,
    "entitlementToken": "ent_ecornell_do_CID1130982348712"
  }
}
```

## 8. Non-Functional & Security Architecture

### 8.1 Security & Data Governance Controls

1. **Cryptographic SAML Signing:** All outbound `<samlp:Response>` and `<saml:Assertion>` envelopes are signed using **RSA-SHA256** signatures with 2048-bit X.509 certificates managed within Keycloak keystores and rotated annually.
2. **Data Minimization Guarantee:** Outbound SAML assertions strictly suppress government identifiers (Aadhaar, employee codes, salary bands). Outbound attributes are limited to:
  - Subject Identifier: Pseudonymous `sub` UUID.
  - Learner Display Name: `givenName` and `surname`.
  - Official Email: `email` (only when partner contract mandates LMS workspace creation).

3. **Double-Spending Prevention:** Karma Coin debits are bounded by Cassandra conditional writes (`LWT`) or atomic batches (`BEGIN BATCH ... APPLY BATCH`), guaranteeing zero balance overdraft under concurrent redemption requests.

### 8.2 High Availability & Fail-Safe Defaults

1. **Default-Deny Policy:** If `cb-ext-course-service` experiences network partitioning or Cassandra query timeouts during eligibility pre-check, the proxy returns `HTTP 503 Service Unavailable` with access denied, preventing unauthorized commercial seat leakage.
2. **Idempotent Kafka Pipelines:** Downstream consumers on `dev.enrollment.progress` utilize composite unique deduplication keys (`userid + courseid + partnerid`). Replay messages from Kafka partition rebalances are detected and safely skipped.

## 9. Requirements Traceability Matrix (SRS to SDD Components)

| SRS Requirement ID | Requirement Description | Phase Milestone | Engineering Subsystem | Primary Implementation Component / File | Persistence Table / Queue |
|---|---|---|---|---|---|
| **FR-M1-001** | CIOS Ingestion API | Q4 | Ingestion Engine | `cios-content-service` (`CiosIngestController`) | `sunbird.content_store` |
| **FR-M1-002** | Partner Blended Curation | Q6–Q8 | Content Curation | `cb-pores-service` & Content Portal | `sunbird.content_provider` |
| **FR-M1-003** | Harvard Daily SFTP Drop | Q8 | Ingestion Pipeline | `cios-content-service` (`HarvardSFTPClient`) | `sunbird.user_external_enrolments` |
| **FR-M2-001** | Public Self-Registration | Q10 | Onboarding Subsystem | `cb-pores-service` (`PartnerRegistrationController`) | `sunbird.content_provider` |
| **FR-M2-002** | SPV Partner Approval | Q10 | Tenancy Subsystem | `cb-pores-service` (`PartnerWorkflowService`) | `sunbird.content_provider` |
| **FR-M2-003** | SAML 2.0 IdP Configuration | Q10 | Authentication Broker | Keycloak SPI (`sunbird-auth`) | Keycloak Client Realm DB |
| **FR-M2-004** | User Attribute Mapping | Q10 | Federation Broker | Keycloak Protocol Mappers (`sunbird-auth`) | Keycloak Keystore |
| **FR-M2-005** | SSO Handshake Test Probe | Q10 | Administrative Ops | Keycloak Admin Client (`SPV_ADMIN`) | Ephemeral Probe Log |
| **FR-M2-006** | Minimum Karma Gating | Q10 | Access Policy Engine | `cb-ext-course-service` (`KarmaGatingValidator`) | `sunbird.user_karma_points` |
| **FR-M2-007** | Concurrent Enrolment Cap | Q10 | Access Policy Engine | `cb-ext-course-service` (`EnrolmentCapValidator`) | `sunbird.user_external_enrolments` |
| **FR-M2-008** | Annual Consumption Limit | Q10 | Access Policy Engine | `cb-ext-course-service` (`AnnualCapValidator`) | `sunbird.user_external_enrolments` |
| **FR-M2-009** | Consent & Pledge Modal | Q10 | Ingress / Client BFF | `sunbird-cb-uiproxy` (`ConsentGuardHandler`) | `sunbird.user_external_enrolments` |
| **FR-M3-001** | eCornell REST Pull Pipeline | Q11 | Automated Ingestion | `cios-content-service` (`CornellSchedulerService`) | `sunbird.content_store`, ES |
| **FR-M3-002** | Multi-Platform Adapters | Q12 | Ingestion Adapters | `cios-content-service` (`CornerstoneConnector`) | `sunbird.content_store` |
| **FR-M3-003** | Partner Status Toggles | Q11 | Catalog Operations | `cb-pores-service` & `sunbird-content-service` | `sunbird.content_provider` |
| **FR-M3-004** | Banners & TOC Guidance | Q11 | Presentation Layer | `sunbird-cb-uiproxy` (`TOCBannerDecorator`) | Client Application Cache |
| **FR-M4-001** | Enrolment vs User Licences | Q13 | Commercial Licensing | `cb-ext-course-service` (`LicenceModelManager`) | `sunbird.content_provider` |
| **FR-M4-002** | Paid/Free Classify & Caps | Q13 | Catalog Curation | `sunbird-content-service` (`PricingMetadataHandler`) | `sunbird.user_external_enrolments_counter` |
| **FR-M4-003** | Bulk Publishing Engine | Q13 | Publishing Pipeline | `content-publish-pipeline` (`BulkPublishWorker`) | CSV Output / Elasticsearch |
| **FR-M4-004** | Commercial Badges & Filters | Q13 | Learner Presentation | `sunbird-cb-uiproxy` & Angular Search Component | Elasticsearch `composite-search` |
| **FR-M4-005** | Karma Coin Course Redeem | Q13 | Virtual Wallet Engine | `user-karma-coin-wallet` (`RedemptionService`) | `sunbird.user_karma_coin_wallet` |
| **FR-M4-006** | Completion Karma Accrual | Q13 | Asynchronous Reward | `DownstreamLMSConsumer` & Kafka Event Bus | Kafka `dev.enrollment.progress` |
