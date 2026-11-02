# Registration — High Level Design (HLD)

## 1. ARCHITECTURAL DRIVERS & SYSTEM CONTEXT

### 1.1 Business & Architectural Context

The **Registration Subsystem** of the iGOT Karmayogi Platform is the distributed identity gateway responsible for ingesting, validating, credentialing, and provisioning civil servants, departmental cadres, public volunteers, and commercial capacity-building partners across the Indian civil services landscape.

Between **Release Q2 and Release Q13**, the architectural requirements shifted from a single, centralized email-domain-restricted registration form into a multi-portal, federated onboarding fabric. The system reconciles strict government administrative hierarchies with high-throughput self-service access and asynchronous batch ingestion pipelines.

### 1.2 Core Architectural Drivers

1. **Federated Identity & Centralized Sovereignty:** Identity lifecycles are decoupled into decentralized intake channels (Web, Mobile, MDO Custom Link, Bulk CSV, API) while maintaining unified credentialing in Keycloak IAM and single-source profile records in Apache Cassandra.
2. **Dynamic Administrative Governance:** Eliminating static configurations in favor of real-time administrative controls: dynamic Domain Whitelisting by the Special Purpose Vehicle (SPV), live Master Designation catalogs, and configurable Ministry/Department/Organization (MDO) Approval Queues.
3. **High-Throughput Asynchronous Ingestion:** Decoupling file-based batch uploads from synchronous web request threads via Apache Kafka to ingest up to 10,000 records per batch without API gateway timeouts.
4. **Acquisition Telemetry:** Comprehensive tracking via the `registrationMode` metadata schema across all Cassandra identity records and Kafka event buses.

### 1.3 System Context Diagram

```mermaid
flowchart TD
    subgraph External_Actors [External Actors & Identity Providers]
        CS[Civil Servants / Learners]
        MDO_A[MDO Administrators]
        SPV_A[SPV Governance Admins]
        EXT_P[Marketplace / EdTech Partners]
        VOL[Volunteers / Non-Gov Personnel]
        eHRMS[DoPT e-HRMS Service]
    end
    subgraph Ingestion_Surface [Portal Ingestion Surface]
        LP[Learner Web Portal /register]
        LMA[Learner Mobile App - Native/QR]
        MDOP[MDO Administration Portal]
        SPVP[SPV Governance Portal]
        MKTP[Marketplace Onboarding Portal]
    end
    subgraph Gateway_Layer [API Gateway & Ingress Layer]
        KONG[Kong API Gateway & Rate Limiter]
    end
    subgraph Microservices_Layer [Core Microservices Subsystem]
        UOS[User & Org Service - Sunbird Core]
        CRS[Custom Registration Service]
        BUS[Dynamic Bulk Upload Engine]
        OMS[Org Hierarchy & Search API]
        DMS[Master Designation Service]
        NOTIF[Communication & OTP Engine]
    end
    subgraph IAM_Security [Identity & Access Management]
        KC[(Keycloak IAM - Realm: sunbird)]
    end
    subgraph Message_Bus [Streaming & Event Bus]
        KAFKA{Apache Kafka Event Bus}
    end
    subgraph Data_Stores [Persistence Layer]
        CASS[(Apache Cassandra DB)]
        PG[(PostgreSQL - IAM / Partner DB)]
        REDIS[(Redis Cache Cluster)]
        ES[(Elasticsearch - Org Indices)]
    end
    CS --> LP & LMA
    MDO_A --> MDOP
    SPV_A --> SPVP
    EXT_P --> MKTP
    VOL --> LP & MDOP
    LP & LMA & MDOP & SPVP & MKTP -->|HTTPS / REST / JSON| KONG
    KONG --> UOS & CRS & BUS & OMS & DMS & NOTIF
    eHRMS -.->|Asynchronous Sync| UOS
    UOS & CRS & BUS --> KC
    UOS & CRS & BUS & DMS --> CASS
    KC --> PG
    OMS --> ES
    DMS & NOTIF --> REDIS
    BUS -->|Enqueues Batch Rows| KAFKA
    KAFKA -->|Worker Dequeue| UOS
```

## 2. END-TO-END LOGICAL & COMPONENT ARCHITECTURE

### 2.1 Layered Logical Architecture

The subsystem follows a decoupled, service-oriented multi-tier architectural pattern:

```mermaid
flowchart TD
    subgraph L1["PRESENTATION & INGESTION LAYER"]
        P1["• Learner Web (Angular/React)"]
        P2["• Learner Mobile App (Native Android/iOS with QR Scanner)"]
        P3["• MDO Management Portal"]
        P4["• SPV Governance Console"]
        P5["• Marketplace Partner Form"]
    end
    subgraph L2["INGRESS & API GATEWAY LAYER"]
        G1["• Kong Gateway Proxy Engine"]
        G2["• Rate Limiting Plugin (Max 3 OTP / 15 min per identifier)"]
        G3["• JWT Bearer Token Validation"]
        G4["• Route Whitelisting & CORS Policy Handler"]
    end
    subgraph L3["DOMAIN SERVICES & BUSINESS LOGIC"]
        D1["User & Org Management<br/>- Account Lifecycle<br/>- Org Hierarchy Mapping<br/>- Mode Telemetry Parser"]
        D2["Dynamic Bulk Engine<br/>- Sample Bundle Generator<br/>- Async Batch Streaming<br/>- Error CSV Generator"]
        D3["Communication & OTP Engine<br/>- 6-Digit Cryptographic OTP<br/>- SMS Gateway (NIC / CDAC)<br/>- SMTP Gateway (Gov Relay)"]
        D4["Custom Registration Engine<br/>- Org URL/QR Cryptography<br/>- MDO Action Queue Handler"]
        D5["Master Designation Service<br/>- Master Cadre Repository<br/>- Pub/Sub Redis Eviction"]
        D6["Marketplace Partner Review<br/>- KYC Dossier Handler<br/>- Gated Workflow Orchestrator"]
    end
    subgraph L4["SECURITY & IDENTITY MANAGEMENT LAYER"]
        S1["• Keycloak IAM (OIDC / OAuth2 Engine)"]
        S2["• Realm: 'sunbird'"]
        S3["• Role-Based Access Control (RBAC Engine)"]
        S4["• Argon2 Password Policy Encryption"]
    end
    subgraph L5["DATA & STREAMING PIPELINE LAYER"]
        T1[("• Apache Cassandra : User Profiles, Role Links, Org Nodes, Domain Whitelists")]
        T2[("• PostgreSQL : Keycloak Credentials, Marketplace Partner Applications")]
        T3[("• Redis Cluster : Active Designations (cache:designation:master), Transient OTPs (300s TTL)")]
        T4[("• Elasticsearch : Public Organization Hierarchy Search Index (org_hierarchy_v2)")]
        T5[("• Apache Kafka : Topics: bulk-user-ingestion, user-registration-events")]
    end
    L1 -->|"HTTPS / JSON (TLS 1.3)"| L2
    L2 --> L3
    L3 --> L4
    L4 --> L5
```

## 3. HIGH-LEVEL DESIGN: USER REGISTRATION (CORE PLATFORM IDENTITY)

**SECTION 3.1: USER REGISTRATION – CREATION ARCHITECTURE & END-TO-END FLOW**

### 3.1.1 Creation Architecture Component Interaction

User Registration provides the foundational identity creation mechanism. It captures demographic data, validates government email affiliations, checks one-time passwords, and orchestrates account generation between Keycloak IAM and Sunbird Cassandra stores.

### 3.1.2 Detailed Sequence Diagram: User Registration Creation

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Civil Servant
    participant Portal as Learner Web Portal
    participant Gateway as Kong API Gateway
    participant NotifySvc as Communication & OTP Service
    participant UserSvc as User & Org Service
    participant DesigSvc as Designation Master Service
    participant IAM as Keycloak IAM
    participant Cassandra as Cassandra DB
    participant Kafka as Kafka Event Bus
    Learner->>Portal: Initiates Registration (/register)
    Portal->>Gateway: GET /api/designation/v1/master/list
    Gateway->>DesigSvc: Read Active Designation Master
    DesigSvc-->>Portal: Returns Master List (Dropdown population)
    Learner->>Portal: Inputs Name, Mobile, Gov Email, Designation
    Portal->>Gateway: POST /api/otp/v1/generate {email, mobile}
    Gateway->>NotifySvc: Check Domain Whitelist & Generate OTP
    NotifySvc-->>Learner: SMS / Email Token Delivered (6-digit)
    Learner->>Portal: Inputs OTP & Clicks 'Verify'
    Portal->>Gateway: POST /api/otp/v1/verify {email, otp}
    Gateway->>NotifySvc: Verify token in Redis (300s TTL)
    NotifySvc-->>Portal: HTTP 200 OK {verificationToken: "SEC_JWT_TOK"}
    Learner->>Portal: Submits Registration Form
    Portal->>Gateway: POST /api/user/v1/create
    Note over Portal,Gateway: Payload contains verificationToken & registrationMode: "SELF"
    Gateway->>UserSvc: Ingest User Profile Payload
    UserSvc->>UserSvc: Validate verificationToken signature
    UserSvc->>IAM: REST Admin Call: Create Keycloak User
    IAM-->>UserSvc: Keycloak User ID Assigned (UUID)
    UserSvc->>Cassandra: Write user_profile & user_org_mapping
    UserSvc->>Kafka: Publish event user-registered {userId, registrationMode: "SELF"}
    UserSvc-->>Gateway: HTTP 201 Created {userId, status: "ACTIVE"}
    Gateway-->>Portal: Registration Success Payload
    Portal-->>Learner: Displays Success & Redirects to Keycloak Login
```

### 3.1.3 Interface & Payload Contracts

#### `POST /api/otp/v1/generate`

- **Consuming Component:** Learner Web Portal / Learner Mobile App
- **Header:** `Content-Type: application/json`

```json
{
  "request": {
    "email": "rajesh.kumar@nic.in",
    "phone": "9811223344",
    "type": "REGISTRATION"
  }
}
```

```json
{
  "id": "api.otp.generate",
  "ver": "1.0",
  "responseCode": "OK",
  "result": {
    "status": "SUCCESS",
    "txnId": "TXN-881293-OTP",
    "expiresIn": 300
  }
}
```

#### `POST /api/user/v1/create`

- **Consuming Component:** Learner Registration Frontend
- **Security Control:** Requires `verificationToken` obtained from successful OTP verification.

```json
{
  "request": {
    "firstName": "Rajesh",
    "lastName": "Kumar",
    "email": "rajesh.kumar@nic.in",
    "phone": "9811223344",
    "designation": "Deputy Secretary",
    "rootOrgId": "ORG-CAB-SEC-001",
    "registrationMode": "SELF",
    "verificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

```json
{
  "id": "api.user.create",
  "ver": "2.0",
  "responseCode": "CREATED",
  "result": {
    "userId": "usr-8a91bc7d-12de-4e32-9011-abcdef123456",
    "status": "ACTIVE"
  }
}
```

**SECTION 3.2: USER REGISTRATION – CONSUMPTION ARCHITECTURE & DOWNSTREAM WORKFLOWS**

### 3.2.1 Identity Consumption Architecture

Once provisioned, user identities are consumed across the platform:

1. **OIDC Authentication Flow:** The user authenticates against Keycloak using verified credentials. Keycloak injects claims (`rootOrgId`, `userId`, roles `['PUBLIC']`) into the signed JWT access token.
2. **e-HRMS Synchronisation Engine:** An integration pipeline periodically synchronizes service records (cadre, pay-band, employment status) with the Department of Personnel and Training (DoPT) e-HRMS system.

### 3.2.2 Sequence Diagram: Authentication & Downstream Service Ingestion

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Civil Servant
    participant Portal as Learner Web Portal
    participant KC as Keycloak IAM
    participant API as Core Content / Course API
    participant eHRMS as e-HRMS Connector Engine
    participant Cassandra as Cassandra User Store
    Learner->>Portal: Hits /login
    Portal->>KC: Redirects to Keycloak Auth Code Flow
    Learner->>KC: Submits Username + Password / Mobile OTP
    KC->>KC: Validate Cryptographic Hash & Account Status
    KC-->>Portal: Emits OIDC Access Token (JWT with sub, rootOrgId, roles)
    Portal->>API: GET /api/course/v1/enrolled-courses
    Note over Portal,API: Bearer Authorization: <JWT_TOKEN>
    API->>API: Introspect & Validate JWT Signature
    API-->>Portal: Serves Departmental Curated Content
    Note over eHRMS,Cassandra: Asynchronous Service Record Reconciliation
    eHRMS->>eHRMS: Poll / Ingest Daily e-HRMS Cadre Manifest
    eHRMS->>Cassandra: Update user_profile SET cadre = 'IAS', group = 'Group A'
```

## 4. HIGH-LEVEL DESIGN: SPV AND MDO REGISTRATION (ADMINISTRATIVE & CADRE SETUP)

**SECTION 4.1: SPV & MDO REGISTRATION – CREATION ARCHITECTURE & ADMINISTRATIVE SETUP**

### 4.1.1 Administrative Creation Architecture

SPV and MDO Registration establishes the organizational framework of the platform. The Special Purpose Vehicle (Karmayogi Bharat) provisions root organization nodes, whitelists authorized email domains, curates master designations, and seeds MDO Administrators.

### 4.1.2 High-Level Administrative Setup Workflow

```mermaid
sequenceDiagram
    autonumber
    actor SPVAdmin as SPV Administrator
    participant Portal as SPV Governance Portal
    participant Gateway as Kong Gateway
    participant OrgSvc as Org Hierarchy Service
    participant DesigSvc as Master Designation Service
    participant Redis as Redis Master Cache
    participant ES as Elasticsearch Org Index
    Note over SPVAdmin,ES: Step 1: Organizational Node Provisioning
    SPVAdmin->>Portal: Creates Ministry/Department Node
    Portal->>Gateway: POST /api/org/v1/create
    Gateway->>OrgSvc: Validate Parent ID & Hierarchy Depth
    OrgSvc->>OrgSvc: Generate Unique Org Identifier (e.g., ORG-MIN-0055)
    OrgSvc->>ES: Index Org Node in org_hierarchy_v2
    OrgSvc-->>Portal: HTTP 201 Created {orgId: "ORG-MIN-0055"}
    Note over SPVAdmin,Redis: Step 2: Domain Whitelist Registration
    SPVAdmin->>Portal: Approves New Email Domain ("finance.gov.in")
    Portal->>Gateway: POST /api/org/v1/domain/approve
    Gateway->>OrgSvc: Write to Cassandra approved_domains
    OrgSvc-->>Portal: HTTP 200 OK (Domain Whitelisted)
    Note over SPVAdmin,Redis: Step 3: Designation Master Registration
    SPVAdmin->>Portal: Registers Cadre Designation ("Under Secretary", Group A)
    Portal->>Gateway: POST /api/designation/v1/create
    Gateway->>DesigSvc: Commit Record to Cassandra designation_master
    DesigSvc->>Redis: Invalidate & Refresh Key cache:designation:master:list
    DesigSvc-->>Portal: HTTP 201 Created {designationId: "DESIG-404"}
```

**SECTION 4.2: SPV & MDO REGISTRATION – CONSUMPTION ARCHITECTURE & ACTION QUEUE WORKFLOWS**

### 4.2.1 Consumption Architecture: MDO Governance & Registration Approval

MDO Administrators manage departmental onboarding via the MDO Portal:

1. **Onboarding Action Lists:** A dedicated queue where MDO Admins review pending custom registration requests.
2. **Rejection Workflows with Reason Auditing:** Rejections require selecting an audited reason code (`INVALID_CADRE`, `UNKNOWN_EMPLOYEE`, `INCORRECT_UNIT`), which is communicated back to the user.

### 4.2.2 Sequence Diagram: MDO Action Queue Review & Approval

```mermaid
sequenceDiagram
    autonumber
    actor MDOAdmin as MDO Administrator
    participant Portal as MDO Management Portal
    participant Gateway as Kong Gateway
    participant CRSEngine as Custom Registration Service
    participant IAM as Keycloak IAM
    participant Cassandra as Cassandra DB
    participant Notify as Notification Engine
    actor Applicant as Pending Civil Servant
    MDOAdmin->>Portal: Navigates to "Pending User Registrations" Queue
    Portal->>Gateway: GET /api/registration/v1/requests?status=PENDING&orgId=ORG-MIN-0055
    Gateway->>CRSEngine: Query Cassandra registration_requests Table
    CRSEngine-->>Portal: Return Paginated Queue (Filtered by Date/Cadre)
    alt Administrator Approves Request
        MDOAdmin->>Portal: Clicks 'Approve' on Request REQ-991
        Portal->>Gateway: POST /api/registration/v1/requests/REQ-991/approve
        Gateway->>CRSEngine: Execute Approval Routine
        CRSEngine->>IAM: Create Keycloak Identity (status: ENABLED)
        IAM-->>CRSEngine: User UUID Allocated
        CRSEngine->>Cassandra: Write user_profile & Update Request status = 'APPROVED'
        CRSEngine->>Notify: Trigger Account Activation SMS/Email
        Notify-->>Applicant: Delivery of Credentials & Onboarding Welcome
    else Administrator Rejects Request
        MDOAdmin->>Portal: Clicks 'Reject' & Selects Reason: "INVALID_CADRE"
        Portal->>Gateway: POST /api/registration/v1/requests/REQ-991/reject {reason: "INVALID_CADRE"}
        Gateway->>CRSEngine: Update Request status = 'REJECTED', reason = 'INVALID_CADRE'
        CRSEngine->>Notify: Send Rejection Notification Email
        Notify-->>Applicant: "Registration Rejected: Designation does not match departmental cadre"
    end
```

## 5. HIGH-LEVEL DESIGN: BULK REGISTRATION (BATCH & PROGRAMMATIC ONBOARDING)

**SECTION 5.1: BULK REGISTRATION – CREATION ARCHITECTURE & ASYNCHRONOUS INGESTION**

### 5.1.1 Architectural Rationale & Asynchronous Redesign

As documented in **KB-1313**, synchronous CSV uploads caused database deadlocks, gateway timeouts, and dirty writes from unvalidated free-text fields. The redesign established an asynchronous, master-validated bulk upload engine:

- **Dynamic Template API:** Injects live Master Designations directly from Redis into downloadable templates.
- **Non-Blocking Message Pipeline:** Uploads publish rows directly to Kafka, returning an immediate tracking token (`processId`).
- **Scale Capability:** Supports batches up to 10,000 records for large-scale inductions (e.g., Rozgar Mela, volunteer cohorts).

### 5.1.2 Sequence Diagram: Bulk Ingestion Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Admin as MDO Administrator
    participant Portal as MDO Management Portal
    participant Gateway as Kong Gateway
    participant BulkSvc as Dynamic Bulk Upload Service
    participant Redis as Redis Master Cache
    participant Kafka as Kafka Event Topic (bulk-user-ingestion)
    participant Worker as Bulk Ingestion Stream Consumer
    participant IAM as Keycloak IAM
    participant Cassandra as Cassandra DB
    Admin->>Portal: Clicks "Download Bulk Upload Package"
    Portal->>Gateway: GET /api/user/v1/bulkupload/sample
    Gateway->>BulkSvc: Request Dynamic Template
    BulkSvc->>Redis: Read Active Designation Master List
    Redis-->>BulkSvc: Active Designations Data
    BulkSvc-->>Portal: Delivers ZIP (template.csv + MasterDesignations.xlsx)
    Note over Admin,Portal: Admin fills records into template.csv
    Admin->>Portal: Uploads CSV File (e.g., 5,000 employee records)
    Portal->>Gateway: POST /api/user/v1/bulkupload (Multipart FormData)
    Gateway->>BulkSvc: Stream File Payload
    BulkSvc->>BulkSvc: Validate File Headers, File Size & Structure
    BulkSvc->>Kafka: Publish Batch Event Envelope to bulk-user-ingestion
    BulkSvc-->>Portal: HTTP 202 Accepted {processId: "PRC-BATCH-55102", totalRows: 5000}
    Portal-->>Admin: Displays Batch Progress Tracker
    Note over Kafka,Cassandra: Asynchronous Batch Consumer Loop
    loop Stream Records Processing
        Worker->>Kafka: Consume Next Record Message
        Worker->>Worker: Validate Format, Email Regex & Check Designation against Master
        alt Valid Record
            Worker->>IAM: Create User Account
            Worker->>Cassandra: Write user_profile (registration_mode = 'BULK')
            Worker->>Worker: Increment Success Counter
        else Validation / Duplicate Failure
            Worker->>Worker: Log Row Error into Error Buffer
            Worker->>Worker: Increment Failure Counter
        end
    end
    Worker->>Cassandra: Update bulk_upload_process status = 'COMPLETED'
```

**SECTION 5.2: BULK REGISTRATION – CONSUMPTION ARCHITECTURE & ERROR RECONCILIATION**

### 5.2.1 Consumption Architecture: Batch Lifecycle & Error Reconciliation

MDO Administrators track batch execution and resolve failures through dedicated APIs:

- **Batch Status Polling:** Real-time polling via `GET /api/user/v1/bulkupload/status/{processId}`.
- **Error CSV Export:** Failed records are compiled into a downloadable CSV containing original inputs alongside an `ErrorReason` column for correction and re-upload.

```mermaid
flowchart TD
    T["BULK ERROR RECONCILIATION FLOW"]
    A["GET /api/user/v1/bulkupload/status/PRC-BATCH-55102<br/>Response: { status: #quot;COMPLETED_WITH_ERRORS#quot;, total: 5000, success: 4850, failed: 150 }"]
    B["GET /api/user/v1/bulkupload/error/PRC-BATCH-55102.csv<br/><br/>Row, FirstName, LastName, Email, Designation, ErrorReason<br/>14, Anil, Sharma, anil.s@invalid, Under Secretary, #quot;INVALID_EMAIL_FORMAT#quot;<br/>82, Pooja, Verma, pooja.v@nic.in, Chief Wizard, #quot;DESIGNATION_NOT_IN_MASTER#quot;<br/>112, Suresh, Patel, suresh.p@nic.in, Section Officer, #quot;DUPLICATE_MOBILE_NUMBER#quot;"]
    T -->|"Admin requests status"| A
    A -->|"Admin downloads error log"| B
```

## 6. HIGH-LEVEL DESIGN: SELF-REGISTRATION (MULTI-CHANNEL CHANNELS)

**SECTION 6.1: SELF-REGISTRATION – MULTI-CHANNEL CREATION ARCHITECTURE**

### 6.1.1 Multi-Channel Creation Architecture

Self-Registration serves five distinct entry channels across the ecosystem:

```mermaid
flowchart TD
    T["SELF-REGISTRATION CHANNEL TAXONOMY"]
    A["A. Standard Web Self-Reg<br/>• Public URL (/register)<br/>• Manual Org search dropdown<br/>• Strict Gov domain required"]
    B["B. Custom Link & QR Code<br/>• MDO-generated custom link<br/>• Pre-populated & locked Org node<br/>• Domain checks relaxed (KB9250)"]
    C["C. Mobile App Self-Reg<br/>• Native Android & iOS apps<br/>• Camera QR scan for custom URLs<br/>• Mode: 'MOBILE_APP'"]
    D["D. Marketplace Partner<br/>• Public EdTech intake form<br/>• Institutional KYC documents<br/>• SPV vetting console"]
    E["E. Volunteer Onboarding<br/>• Ministry-led initiatives<br/>• Personal email allowed<br/>• Linked to volunteer org"]
    T --> A
    T --> B
    T --> C
    T --> D
    T --> E
```

### 6.1.2 Sequence Diagram: Custom Self-Registration (MDO Link/QR Code)

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Field Civil Servant
    participant Mobile as Mobile Browser / Native App
    participant Gateway as Kong Gateway
    participant CRS as Custom Registration Service
    participant Notify as Notification Engine
    participant Cassandra as Cassandra DB
    Note over Learner,CRS: MDO Custom Link: /register?orgId=ORG-POLICE-04&deptId=DEPT-TRAFFIC
    Learner->>Mobile: Accesses Custom URL or Scans MDO QR Code
    Mobile->>Gateway: GET /api/registration/v1/custom/context?orgId=ORG-POLICE-04
    Gateway->>CRS: Validate Org ID and Fetch Hierarchy Metadata
    CRS-->>Mobile: Pre-populate & Lock: Ministry = "MHA", Org = "State Police"
    Learner->>Mobile: Enters Name, Personal/State Email, Mobile, Designation
    Mobile->>Gateway: POST /api/otp/v1/generate {email, mobile, bypassDomainCheck: true}
    Note over Mobile,Gateway: Per KB-9250: Domain whitelist check bypassed for custom links
    Gateway->>Notify: Generate & Dispatch OTP
    Notify-->>Learner: SMS OTP Delivered
    Learner->>Mobile: Enters OTP and submits
    Mobile->>Gateway: POST /api/registration/v1/custom/submit
    Gateway->>CRS: Validate Payload & Create Pending Request
    CRS->>Cassandra: Write registration_requests (status = 'PENDING_MDO_APPROVAL')
    CRS-->>Mobile: HTTP 202 Accepted {requestId: "REQ-CUSTOM-7718"}
    Mobile-->>Learner: "Registration Submitted! Awaiting MDO Nodal Officer Approval."
```

**SECTION 6.2: SELF-REGISTRATION – CONSUMPTION ARCHITECTURE & ACTIVATION HANDSHAKES**

### 6.2.1 Partner & Non-Government Onboarding Consumption (Marketplace Workflow)

Marketplace Partner self-registration provides external EdTech providers and universities with a gated onboarding path:

1. **Application Intake:** Partner submits organization registration proofs, PAN/TAN, and authorized signatory credentials.
2. **Review & Vetting Console:** SPV Administrators evaluate the submitted application in the SPV Portal.
3. **Automated CBP Provisioning:** Upon SPV approval, an organization node is generated, an administrator account is provisioned in Keycloak with `CBP_ADMIN` roles, and the partner is granted course authoring access on the CBP Portal.

### 6.2.2 State Transition Diagram: Registration Lifecycles

```mermaid
stateDiagram-v2
    [*] --> INITIATED : Access Registration URL / Scan QR state "Standard Self-Registration" as Std {
    INITIATED --> DOMAIN_CHECK : Enter Gov Email
    DOMAIN_CHECK --> OTP_DISPATCHED : Domain Whitelisted
    DOMAIN_CHECK --> DOMAIN_REJECTED : Domain Not Approved
    DOMAIN_REJECTED --> [*]
    OTP_DISPATCHED --> OTP_VERIFIED : Correct 6-digit Code
    OTP_VERIFIED --> PROVISION_CORE : Submit Form } state "Custom Self-Registration" as Cust {
    INITIATED --> ORG_PREPOPULATED : Context Ingested
    ORG_PREPOPULATED --> OTP_DISPATCHED_CUSTOM : Enter Email / Phone
    OTP_DISPATCHED_CUSTOM --> OTP_VERIFIED_CUSTOM : Correct Code
    OTP_VERIFIED_CUSTOM --> QUEUED_IN_MDO : Submit Registration
    QUEUED_IN_MDO --> MDO_APPROVED : Admin Review: Approve
    QUEUED_IN_MDO --> MDO_REJECTED : Admin Review: Reject (Reason Logged)
    MDO_REJECTED --> [*]
    MDO_APPROVED --> PROVISION_CORE } state "Marketplace Partner Self-Reg" as Mkt {
    INITIATED --> DOSSIER_SUBMITTED : Submit Legal & KYC Details
    DOSSIER_SUBMITTED --> SPV_KYC_REVIEW : Queued for SPV Admin
    SPV_KYC_REVIEW --> SPV_PARTNER_APPROVED : KYC Verification Passed
    SPV_KYC_REVIEW --> SPV_PARTNER_REJECTED : Deficient Documentation
    SPV_PARTNER_REJECTED --> [*]
    SPV_PARTNER_APPROVED --> PROVISION_PARTNER_CBP }
    PROVISION_CORE --> ACTIVE : Account Created in Keycloak & Cassandra
    PROVISION_PARTNER_CBP --> ACTIVE : Partner Granted 'CBP_ADMIN' Role
    ACTIVE --> [*]
```

## 7. CROSS-PORTAL INTEGRATION & INTERACTION ARCHITECTURE

### 7.1 Cross-Portal Interaction Matrix

| Subsystem Component | Learner Web Portal | Learner Mobile App | MDO Management Portal | SPV Governance Portal | CBP / Marketplace Portal |
|---|---|---|---|---|---|
| **Org Hierarchy Service** | Consumes `/org/v1/search` for public selection. | Consumes `/org/v1/search` via mobile views. | Reads/writes departmental sub-nodes. | Full administrative CRUD over all root nodes. | Reads partner node mappings. |
| **OTP & Domain Engine** | Invokes OTP generation with strict domain checks. | Invokes OTP generation; auto-extracts SMS codes. | Bypasses domain checks for custom link setups. | Manages domain approvals and whitelisting. | Validates partner business email addresses. |
| **Custom Link Generator** | Resolves custom parameters and pre-locks UI fields. | Resolves custom links via camera QR scanning. | Generates custom links and downloadable QR codes. | Oversees cross-organization custom link policies. | N/A |
| **Master Designation Service** | Populates standard designation dropdowns. | Populates standard designation dropdowns. | Maps departmental designations to master nodes. | Administrative CRUD over Master Designation list. | N/A |
| **Approval Engine** | Displays application status screens. | Displays application status screens. | Reviews, approves, or rejects pending requests. | Reviews Marketplace Partner applications. | N/A |

## 8. SECURITY, IDENTITY & CRYPTOGRAPHIC ARCHITECTURE

### 8.1 Keycloak IAM Integration

The platform utilizes **Keycloak IAM** as its single-source identity provider:

- **Realm Topology:** All registered identities reside in the `sunbird` realm.
- **Role Ingestion Matrix:**
  - Standard User / Self-Registration: Assigned `PUBLIC`, `CONTENT_CONSUMER`.
  - MDO Nodal Officer: Assigned `MDO_ADMIN`, `ORG_ADMIN`.
  - SPV Platform Administrator: Assigned `SPV_ADMIN`.
  - Marketplace Partner Admin: Assigned `CBP_ADMIN`, `CONTENT_CREATOR`.

- **Credential Cryptography:** Passwords are encrypted using Argon2 password hashing. In accordance with Q10 enhancements ([KB-11810: Q10 | Ad-Hoc | Enhancement to registration and password flow](https://karmayogibharat.atlassian.net/browse/KB-11810) (KB Review)), the platform utilizes two-stage registration where user passwords are set post-verification via time-limited, signed cryptographic tokens.

### 8.2 OTP Security Architecture

- **Token Entropy:** 6-digit numeric OTP generated via cryptographically secure pseudo-random number generators (`java.security.SecureRandom`).
- **Cache Management:** Stored in Redis with a 300-second (5-minute) TTL: `SET otp:rajesh@nic.in "<BCRYPT_HASH>" EX 300`.
- **Anti-Brute Force Protection:** Maximum 3 verification attempts allowed per transaction. Upon 3 failed attempts, the token is invalidated and the transaction locked for 15 minutes.

## 9. DATA PERSISTENCE, CACHING & EVENT BUS ARCHITECTURE

**PERSISTENCE ARCHITECTURE SCHEMAS**

```text
1. APACHE CASSANDRA CORE STORAGE

Table: sunbird.user_profile
├── id                : uuid (Partition Key)
├── root_org_id       : text
├── first_name        : text
├── last_name         : text
├── email             : text
├── phone             : text
├── designation       : text
├── cadre_group       : text
├── registration_mode : text [SELF, CUSTOM_SELF, BULK, MDO_ADMIN, API_HRMS]
├── status            : int [0: Pending Approval, 1: Active, 2: Inactive]
└── created_date      : timestamp

Table: sunbird.approved_domains
├── domain_name   : text (Partition Key)
├── org_id        : text
├── approved_by   : text
└── approval_date : timestamp

Table: sunbird.registration_requests
├── request_id       : text (Partition Key)
├── org_id           : text
├── applicant_data   : text (JSON Payload)
├── status           : text [PENDING, APPROVED, REJECTED]
├── rejection_reason : text
└── created_date     : timestamp

2. REDIS ACCELERATION CLUSTER

• Key: otp:{identifier}                 --> String (Bcrypt Hash)       | TTL: 300s
• Key: cache:designation:master:list    --> JSON Array of Cadre Masters | TTL: 3600s
• Key: ratelimit:{client_ip}:otp        --> Rate Counter               | TTL: 900s

3. APACHE KAFKA MESSAGE BUS

• Topic: bulk-user-ingestion     --> 12 Partitions | Key: orgId  | Retention: 7 Days
• Topic: user-registration-events --> 6 Partitions  | Key: userId | Retention: 30 Days
```

## 10. NON-FUNCTIONAL ARCHITECTURE, RESILIENCY & SCALABILITY

### 10.1 High Availability & Fault Tolerance

- **Stateless Service Nodes:** Microservices are deployed as stateless containers in Kubernetes (EKS), scaling horizontally via Horizontal Pod Autoscalers (HPA) targeting 70% average CPU utilization.
- **Graceful Degradation:** If the SMS gateway experiences carrier delays, the OTP engine automatically fails over to the secondary government email relay.
- **Asynchronous Resilience:** Bulk upload requests buffer immediately in Kafka partitions. If worker pods restart, consumer offsets ensure zero row loss.

### 10.2 Scalability Targets

- **Peak OTP Throughput:** Designed for 1,200 requests/second sustained during nationwide onboarding campaigns.
- **Bulk Ingestion Throughput:** Ingests and processes 10,000-row batch files within 15 minutes.
- **Search Latency:** Elasticsearch organization search queries resolve with p99 < 80ms under 500 concurrent lookups.
