# Registration — System Context Diagram & Architectural Interaction Document

## 1. GLOBAL SYSTEM CONTEXT OVERVIEW (Q2 – Q13)

### 1.1 Architectural Purpose & Context

The **Registration Ecosystem** of the iGOT Karmayogi Platform functions as the national civil service identity and organization federation gateway. Between **Release Q2 and Release Q13**, the ecosystem evolved from a centralized, email-domain-restricted registration form into a multi-channel, federated onboarding platform.

It manages:

1. **Creation:** Administrative provisioning of Ministries, Departments, and Organizations (MDOs); dynamic email domain approvals by the Special Purpose Vehicle (SPV); Designation Master curation; multi-channel user data ingestion (Learner Web, Mobile App QR, MDO Custom Links, Bulk CSV/XLSX, Marketplace KYC, APIs); and credential issuance.
2. **Consumption:** Federated authentication through Keycloak IAM (OIDC); personnel record synchronisation with DoPT's e-HRMS; MDO administrative approval queues; asynchronous batch ingestion through Apache Kafka; and access enablement for downstream course consumption and capacity-building workflows across the Capacity Building Provider (CBP) Portal.

### 1.2 Enterprise Global Context Diagram (C4 Level 1)

```mermaid
flowchart TD
    %% Styling Definitions
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef boundaryStyle fill:#F7FAFC,stroke:#2B6CB0,stroke-width:3px,stroke-dasharray: 5 5,color:#2D3748;
    classDef platformStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef externalStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef gatewayStyle fill:#FEFCBF,stroke:#D69E2E,stroke-width:2px,color:#744210;
    subgraph ACTORS [Human Actors & External Organizations]
        CS["Civil Servant / Individual Learner\n[Cadres: Central, State, Autonomous]"]:::actorStyle
        MDO_A["MDO Administrator / Nodal Officer\n[Ministry / Department Admin]"]:::actorStyle
        SPV_A["SPV Governance Administrator\n[Karmayogi Bharat Super Admin]"]:::actorStyle
        MKT_P["Marketplace Training Partner\n[Universities, EdTech, Private Institutes]"]:::actorStyle
        VOL_U["Civil Defense / Public Volunteer\n[Non-Government Personnel]"]:::actorStyle
    end
    subgraph EXT_SYSTEMS [External Integrated Systems]
        eHRMS["DoPT e-HRMS Service\n[Central Civil Service Cadre Records]"]:::externalStyle
        SMS_GW["NIC / CDAC SMS Gateway\n[Telecommunications Relay]"]:::externalStyle
        MAIL_GW["Gov Mail SMTP Relay\n[NIC Email Gateway]"]:::externalStyle
    end
    subgraph IGOT_PLATFORM [iGOT Karmayogi Enterprise Platform Boundary]
        GW["Kong Ingress & API Gateway\n[Rate Limiting, Routing, JWT Validation]"]:::gatewayStyle
        subgraph INGESTION_SURFACE [Portal & Mobile Ingestion Channels]
            LP["Learner Web Portal\n[/register, Login, Profile]"]:::platformStyle
            LMA["Learner Mobile App\n[Android/iOS, Native QR, SMS API]"]:::platformStyle
            MDOP["MDO Management Portal\n[Approvals, Bulk, Custom Links]"]:::platformStyle
            SPVP["SPV Governance Portal\n[Domain Whitelist, Masters, KYC]"]:::platformStyle
            CBPP["CBP / Marketplace Portal\n[Course Authoring, Partner Console]"]:::platformStyle
        end
        subgraph CORE_IDENTITY [Core Identity & Registration Engine]
            REG_ENG["Registration & Org Services\n[Sunbird Core / User Microservices]"]:::platformStyle
            IAM["Keycloak IAM Subsystem\n[Realm: sunbird, OIDC, RBAC]"]:::platformStyle
            ASYNC_ENG["Dynamic Bulk & Ingestion Engine\n[Apache Kafka Async Processing]"]:::platformStyle
        end
        subgraph DATA_STORES [Enterprise Persistence Subsystem]
            DB_CASS[("Apache Cassandra\n[Profiles, Hierarchies, Requests]")]:::externalStyle
            DB_IAM[("PostgreSQL\n[Keycloak IAM, Partner KYC DB]")]:::externalStyle
            CACHE_REDIS[("Redis Cache Cluster\n[Active Masters, Transient OTPs]")]:::externalStyle
            ES_SEARCH[("Elasticsearch Cluster\n[Org Search Index: org_hierarchy_v2]")]:::externalStyle
        end
    end
    %% Actor Interactions to Portals
    CS -->|1. Public Self-Reg / Profile Updates| LP
    CS -->|2. Mobile Self-Reg & QR Scan| LMA
    MDO_A -->|3. Custom Links, Approvals, Bulk Files| MDOP
    SPV_A -->|4. Root Orgs, Whitelisting, Masters, KYC| SPVP
    MKT_P -->|5. Partner KYC Intake / Login| CBPP
    VOL_U -->|6. Volunteer Intake / QR Scan| LP
    %% Portals to API Gateway
    LP & LMA & MDOP & SPVP & CBPP -->|HTTPS / REST / JSON| GW
    %% Gateway to Internal Services
    GW -->|Route REST Ingress| REG_ENG
    GW -->|Async File Payloads| ASYNC_ENG
    %% Core Services Interconnections
    REG_ENG <-->|JIT Provisioning & RBAC| IAM
    REG_ENG <-->|Org Search & Lookup| ES_SEARCH
    REG_ENG <-->|Active Designation / OTP Cache| CACHE_REDIS
    REG_ENG <-->|Profile & Org Persistence| DB_CASS
    IAM <-->|User Credentials & Realms| DB_IAM
    ASYNC_ENG <-->|Batch Enqueue / Dequeue| REG_ENG
    %% External Systems Interconnections
    eHRMS -.->|Automated Cadre Sync Events| REG_ENG
    REG_ENG -->|Dispatch OTP & Alerts| SMS_GW
    REG_ENG -->|Dispatch Activation Emails| MAIL_GW
    SMS_GW -.->|Inbound SMS OTP Delivery| CS
    MAIL_GW -.->|Inbound Email Activation Links| CS & MKT_P
```

## 2. CONTEXT DIAGRAMS PER REGISTRATION TYPE (CREATION & CONSUMPTION)

To satisfy the multi-stream operational model, context and boundary interactions are decomposed into four independent registration streams, with each stream evaluated across two dedicated dimensions:

- **Sub-Section X.1: Creation Context (Ingress, Validation, Ingestion & Provisioning)**
- **Sub-Section X.2: Consumption Context (Identity Federation, Action Workflows, Sync & Downstream Access)**

**SECTION 2.1: USER REGISTRATION (CORE PLATFORM IDENTITY)**

### 2.1.1 User Registration – Creation Context Diagram

Captures the direct creation of an individual civil servant identity: personal demographic capture, government email verification, cryptographic OTP generation, and account generation between Keycloak IAM and Cassandra data stores.

```mermaid
flowchart TD
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef sysStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef extStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef boundaryStyle fill:#FFFFFF,stroke:#4A5568,stroke-width:2px,stroke-dasharray: 4 4;
    ACTOR_CS["Civil Servant / User"]:::actorStyle
    subgraph BOUNDARY_CREATION ["User Registration - Creation Subsystem Boundary"]
        UI_REG["Learner Web Portal\n[/register Form & Modal]"]:::sysStyle
        GW_KONG["Kong API Gateway\n[Rate Limiter, CORS, Routing]"]:::sysStyle
        SVC_USER["User Management Service\n[Sunbird User Controller]"]:::sysStyle
        SVC_NOTIF["Notification & OTP Service\n[HMAC Token Signer]"]:::sysStyle
        SVC_DESIG["Master Designation Service\n[Cadre Validator]"]:::sysStyle
        CACHE_REDIS[("Redis Cache\n[OTP Token (300s TTL)]")]:::extStyle
        IAM_KC["Keycloak IAM\n[Realm: sunbird, User API]"]:::sysStyle
        DB_CASS[("Apache Cassandra\n[user_profile, user_org_mapping]")]:::extStyle
        BUS_KAFKA{{"Kafka Event Bus\n[topic: user-registration-events]"}}:::extStyle
    end
    EXT_SMS["National SMS Gateway\n[CDAC / NIC Gateway]"]:::extStyle
    EXT_SMTP["Gov SMTP Mail Server\n[Secure NIC Mail Relay]"]:::extStyle
    %% Flow Interactions
    ACTOR_CS -->|1. Hits /register & selects Designation| UI_REG
    UI_REG -->|2. GET /designation/v1/master/list| GW_KONG
    GW_KONG -->|3. Route Designation Lookup| SVC_DESIG
    SVC_DESIG -.->|Read Master Cache| CACHE_REDIS
    ACTOR_CS -->|4. Inputs Gov Email & Mobile| UI_REG
    UI_REG -->|5. POST /otp/v1/generate| GW_KONG
    GW_KONG -->|6. Route OTP Request| SVC_NOTIF
    SVC_NOTIF -->|7. Store Bcrypt OTP Hash| CACHE_REDIS
    SVC_NOTIF -->|8. Dispatch SMS Token| EXT_SMS
    SVC_NOTIF -->|9. Dispatch Email Token| EXT_SMTP
    EXT_SMS -.->|10. SMS Delivered| ACTOR_CS
    EXT_SMTP -.->|11. Email Delivered| ACTOR_CS
    ACTOR_CS -->|12. Inputs Received OTP| UI_REG
    UI_REG -->|13. POST /otp/v1/verify| GW_KONG
    GW_KONG -->|14. Verify Hash & Sign JWT| SVC_NOTIF
    SVC_NOTIF -->|15. Return verificationToken| UI_REG
    ACTOR_CS -->|16. Submits Complete Registration| UI_REG
    UI_REG -->|17. POST /user/v1/create + verificationToken| GW_KONG
    GW_KONG -->|18. Process Profile Payload| SVC_USER
    SVC_USER -->|"19. JIT User Provisioning (Admin REST)"| IAM_KC
    IAM_KC -->|20. Keycloak UUID Assigned| SVC_USER
    SVC_USER -->|21. Batch Insert Profile & Mode: SELF| DB_CASS
    SVC_USER -->|22. Emit USER_REGISTERED Event| BUS_KAFKA
    SVC_USER -->|23. HTTP 201 Created| UI_REG
```

#### Key Technical Tasks & Interfaces (Creation)

- `TASK-UR-CR-01` (Q2 Baseline): Implement `/api/user/v1/create` orchestration with Keycloak Admin Client and Cassandra schema definition ([KB-949: Q2 | Ad-Hoc Requests | User Onboarding, Creation and Profile changes.](https://karmayogibharat.atlassian.net/browse/KB-949) (KB Review)).
- `TASK-UR-CR-02` (Q7 Telemetry): Add Cassandra column `registration_mode` and enforce mandatory ingestion validation (`SELF`, `BULK`, `CUSTOM_SELF`) ([KB-8017: Q7 | Ad-Hoc | Enhancement | Data Tracking | User registration | Mode of Registration](https://karmayogibharat.atlassian.net/browse/KB-8017) (KB Approved)).
- `TASK-UR-CR-03` (Q10 Master Designation): Integrate `MasterDesignationDropdownComponent` to consume live designations, replacing free-text fields ([KB-12113: Q10 | Ad-hoc | Add designation on registration page](https://karmayogibharat.atlassian.net/browse/KB-12113) (Prod Deployed)).
- `TASK-UR-CR-04` (Q10 Credential Decoupling): Remove plain password inputs from registration forms; generate signed temporary password tokens sent via email ([KB-11810: Q10 | Ad-Hoc | Enhancement to registration and password flow](https://karmayogibharat.atlassian.net/browse/KB-11810) (KB Review)).

### 2.1.2 User Registration – Consumption Context Diagram

Illustrates how provisioned user accounts are consumed: authentication through Keycloak IAM, session context generation, cadre reconciliation with DoPT e-HRMS, and authorization across platform microservices.

```mermaid
flowchart TD
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef sysStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef extStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef boundaryStyle fill:#FFFFFF,stroke:#4A5568,stroke-width:2px,stroke-dasharray: 4 4;
    ACTOR_CS["Civil Servant / User"]:::actorStyle
    EXT_EHRMS["DoPT e-HRMS System\n[Central Cadre Repository]"]:::extStyle
    subgraph BOUNDARY_CONSUMPTION ["User Registration - Consumption Subsystem Boundary"]
        LP["Learner Web Portal\n[/login, /dashboard, Profile]"]:::sysStyle
        GW["Kong Ingress Gateway\n[JWT Signature Validator]"]:::sysStyle
        IAM_KC["Keycloak IAM\n[OIDC Realm: sunbird]"]:::sysStyle
        MAPPER["SunbirdUserTokenMapper\n[Keycloak Custom SPI Plugin]"]:::sysStyle
        SVC_COURSE["Course & Assessment APIs\n[Competency Engine]"]:::sysStyle
        CONSUMER_EHRMS["e-HRMS Sync Consumer\n[Spring Kafka Consumer]"]:::sysStyle
        DB_CASS[("Apache Cassandra\n[user_profile Table]")]:::extStyle
        BUS_KAFKA{{"Kafka Event Bus\n[topic: ehrms-service-record-sync]"}}:::extStyle
    end
    %% Authentication & Authorization Ingress
    ACTOR_CS -->|1. Hits /login with Credentials| LP
    LP -->|2. Redirects to OIDC Auth Code Flow| IAM_KC
    IAM_KC -->|3. Validate Password Hash| IAM_KC
    IAM_KC -->|4. Trigger Custom Token Mapper| MAPPER
    MAPPER -->|5. Query User Profile & Org Link| DB_CASS
    DB_CASS -->|6. Return rootOrgId, designation, mode| MAPPER
    MAPPER -->|7. Inject Custom Claims into JWT| IAM_KC
    IAM_KC -->|8. Emit Signed JWT Access Token| LP
    %% Consuming Downstream APIs
    LP -->|"9. GET /api/course/v1/enrolled-courses (Bearer JWT)"| GW
    GW -->|10. Introspect JWT Signature & Pass Claims| SVC_COURSE
    SVC_COURSE -->|11. Return Departmental Learning Assets| LP
    %% Asynchronous e-HRMS Cadre Consumption
    EXT_EHRMS -.->|12. Emit Daily Cadre Sync Manifest| BUS_KAFKA
    BUS_KAFKA -->|13. Dequeue Cadre Event Payload| CONSUMER_EHRMS
    CONSUMER_EHRMS -->|14. Execute Master of Record Rule| DB_CASS
    NOTE_33["Locks Cadre, PayScale & sets is_ehrms_linked = true"]
    CONSUMER_EHRMS -.- NOTE_33
```

#### Key Technical Tasks & Interfaces (Consumption)

- `TASK-UR-CS-01` (Q3 Token Claims): Develop `SunbirdUserTokenMapper` Keycloak SPI to project Cassandra organizational contexts (`rootOrgId`, `roles`, `registrationMode`) into JWT access tokens.
- `TASK-UR-CS-02` (Q4 Cadre Sync): Build `EHrmsSyncConsumer` Kafka listener and Cassandra migration for `is_ehrms_linked` locking ([KB-1678: Q3 | User Profile | Addition of e-HRMS profile for Users onboarded on e-HRMS.](https://karmayogibharat.atlassian.net/browse/KB-1678) (Prod Deployed)).

**SECTION 2.2: SPV AND MDO REGISTRATION (ADMINISTRATIVE & CADRE SETUP)**

### 2.2.1 SPV & MDO Registration – Creation Context Diagram

Illustrates the creation of organizational structures: root node provisioning by SPV Super Administrators, email domain whitelisting, Designation Master catalog management, and initial MDO Administrator role delegation.

```mermaid
flowchart TD
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef sysStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef extStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef boundaryStyle fill:#FFFFFF,stroke:#4A5568,stroke-width:2px,stroke-dasharray: 4 4;
    ACTOR_SPV["SPV Governance Admin\n[Karmayogi Bharat Super Admin]"]:::actorStyle
    subgraph BOUNDARY_ADMIN_CREATION ["SPV & MDO Registration - Administrative Creation Boundary"]
        PORTAL_SPV["SPV Governance Portal\n[Admin Org & Domain Consoles]"]:::sysStyle
        GW_KONG["Kong API Gateway\n[Admin Route Guard]"]:::sysStyle
        CTRL_ORG["OrgAdminController\n[/api/org/v1/* Routes]"]:::sysStyle
        SVC_ORG["OrgHierarchyManagementService\n[Tree Builder & Domain Handler]"]:::sysStyle
        SVC_DESIG["DesignationMasterServiceImpl\n[Master Cadre Manager]"]:::sysStyle
        SYNC_ES["OrgElasticsearchSyncService\n[Search Index Manager]"]:::sysStyle
        DB_CASS[("Apache Cassandra\n[org_hierarchy, approved_domains]")]:::extStyle
        CACHE_REDIS[("Redis Cluster\n[Key: cache:designation:master:list]")]:::extStyle
        IDX_ES[("Elasticsearch\n[Index: org_hierarchy_v2]")]:::extStyle
        PUB_SUB{{"Redis Pub/Sub Bus\n[topic: cache:evict]"}}:::extStyle
    end
    %% Administrative Node Creation
    ACTOR_SPV -->|1. Creates Ministry Node: POST /org/v1/create| PORTAL_SPV
    PORTAL_SPV -->|2. Ingest Org Payload| GW_KONG
    GW_KONG -->|3. Route Admin Request| CTRL_ORG
    CTRL_ORG -->|4. Validate Depth & Cyclic Tree| SVC_ORG
    SVC_ORG -->|5. INSERT Org Hierarchy Record| DB_CASS
    SVC_ORG -->|6. Trigger Search Index Ingestion| SYNC_ES
    SYNC_ES -->|7. Index Document| IDX_ES
    %% Domain Whitelisting Ingress
    ACTOR_SPV -->|8. Approves Gov Domain: POST /org/v1/domain/approve| PORTAL_SPV
    PORTAL_SPV -->|9. Ingest Domain Approval| GW_KONG
    GW_KONG -->|10. Route Domain Request| CTRL_ORG
    CTRL_ORG -->|"11. whitelistDomain() Execution"| SVC_ORG
    SVC_ORG -->|"12. INSERT INTO approved_domains (domain, org_id)"| DB_CASS
    %% Master Designation Ingress
    ACTOR_SPV -->|13. Registers Cadre: POST /designation/v1/create| PORTAL_SPV
    PORTAL_SPV -->|14. Ingest Designation Payload| GW_KONG
    GW_KONG -->|15. Route Designation Request| CTRL_ORG
    CTRL_ORG -->|"16. addMasterDesignation() Execution"| SVC_DESIG
    SVC_DESIG -->|17. INSERT INTO designation_master| DB_CASS
    SVC_DESIG -->|18. DEL Active Key & Invalidate| CACHE_REDIS
    SVC_DESIG -->|19. PUBLISH 'DESIGNATION_UPDATED'| PUB_SUB
```

#### Key Technical Tasks & Interfaces (Creation)

- `TASK-SPV-CR-01` (Q2 Whitelist): Build `DomainApprovalHandler` and automated persistence into Cassandra `approved_domains` ([KB-396: Q2 | Self Registration | Auto-addition of Domain in the approved list post SPV approval.](https://karmayogibharat.atlassian.net/browse/KB-396) (Prod Deployed)).
- `TASK-SPV-CR-02` (Q6 Designations): Implement `DesignationMasterServiceImpl` with Redis Pub/Sub cache eviction ([KB-6423: Q6 | Self registration | SPV | Designation master on behalf of organisation](https://karmayogibharat.atlassian.net/browse/KB-6423) (Prod Deployed)).
- `TASK-SPV-CR-03` (Q12 Volunteer Tree): Extend `OrgHierarchyManagementService` to support non-government Volunteer Organization structures under supervisory ministries ([KB-13968: Q12 | iGOT for Non-Govt Users/ Volunteer Body](https://karmayogibharat.atlassian.net/browse/KB-13968) (Prod Deployed)).

### 2.2.2 SPV & MDO Registration – Consumption Context Diagram

Illustrates how MDO administrators consume the organizational hierarchy: managing local approval queues, reviewing pending learner applications, logging audited rejection reason codes, and issuing approved credentials.

```mermaid
flowchart TD
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef sysStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef extStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef boundaryStyle fill:#FFFFFF,stroke:#4A5568,stroke-width:2px,stroke-dasharray: 4 4;
    ACTOR_MDO["MDO Nodal Administrator\n[Department Admin User]"]:::actorStyle
    APPLICANT["Applicant Civil Servant\n[Pending Approval User]"]:::actorStyle
    subgraph BOUNDARY_MDO_CONSUMPTION ["SPV & MDO Registration - Administrative Consumption Boundary"]
        PORTAL_MDO["MDO Management Portal\n[Action Lists & Request Queue UI]"]:::sysStyle
        GW_KONG["Kong Ingress Gateway\n[RBAC Header Inspection]"]:::sysStyle
        HANDLER_APP["RegistrationApprovalHandler\n[State Transition Engine]"]:::sysStyle
        IAM_KC["Keycloak Admin REST Client\n[Account Enabler API]"]:::sysStyle
        SVC_NOTIF["Notification Engine\n[Alert Dispatcher]"]:::sysStyle
        DB_CASS[("Apache Cassandra\n[registration_requests, user_profile]")]:::extStyle
    end
    EXT_SMS["NIC SMS Gateway"]:::extStyle
    EXT_SMTP["Gov SMTP Mail Server"]:::extStyle
    %% Fetching Request Queue
    ACTOR_MDO -->|1. Opens Approval Queue: GET /requests?orgId=X| PORTAL_MDO
    PORTAL_MDO -->|2. Ingest Action Queue Request| GW_KONG
    GW_KONG -->|3. Route Query| HANDLER_APP
    HANDLER_APP -->|4. SELECT FROM registration_requests WHERE status = 'PENDING'| DB_CASS
    DB_CASS -->|5. Returns Paginated Records| HANDLER_APP
    HANDLER_APP -->|6. Displays Candidate Dossiers| PORTAL_MDO
    %% Administrative Action: Approval Branch
    ACTOR_MDO -->|7a. Clicks 'Approve' on Request REQ-991| PORTAL_MDO
    PORTAL_MDO -->|8a. POST /requests/REQ-991/approve| GW_KONG
    GW_KONG -->|9a. Execute Approval Routine| HANDLER_APP
    HANDLER_APP -->|"10a. Create Keycloak Identity (Enabled: true)"| IAM_KC
    IAM_KC -->|11a. Keycloak UUID Allocated| HANDLER_APP
    HANDLER_APP -->|12a. UPDATE status = 'APPROVED' & Write user_profile| DB_CASS
    HANDLER_APP -->|13a. Trigger Welcome Credentials| SVC_NOTIF
    SVC_NOTIF -->|14a. Dispatch Credentials| EXT_SMTP
    EXT_SMTP -.->|15a. Delivers Login Link| APPLICANT
    %% Administrative Action: Rejection Branch
    ACTOR_MDO -->|7b. Clicks 'Reject' with Reason: 'INVALID_CADRE'| PORTAL_MDO
    PORTAL_MDO -->|"8b. POST /requests/REQ-991/reject {reason: 'INVALID_CADRE'}"| GW_KONG
    GW_KONG -->|9b. Execute Rejection Routine| HANDLER_APP
    HANDLER_APP -->|"10b. Enforce Non-Null Reason (KBE-98) & UPDATE status = 'REJECTED'"| DB_CASS
    HANDLER_APP -->|11b. Trigger Rejection Alert| SVC_NOTIF
    SVC_NOTIF -->|12b. Dispatch Rejection SMS / Email| EXT_SMS
    EXT_SMS -.->|13b. 'Rejected: Invalid Departmental Cadre'| APPLICANT
```

#### Key Technical Tasks & Interfaces (Consumption)

- `TASK-MDO-CS-01` (Q6 Queue): Build `MDOActionQueueComponent` supporting pagination, cadre filtering, and bulk selection ([KB-7127: Q6 | Custom Self Registration | MDO Portal | Onboarding Action list](https://karmayogibharat.atlassian.net/browse/KB-7127) (Not Required)).
- `TASK-MDO-CS-02` (Q6 Rejection Audit): Enforce non-null `rejection_reason` payload validations in `RegistrationApprovalHandler` ([KBE-98: Self registration|Ability to provide reject reason for the self registration requests](https://karmayogibharat.atlassian.net/browse/KBE-98) (QA In Progress)).
- `TASK-MDO-CS-03` (Q7 Role Governance): Implement role delegation logic allowing MDO Admins to approve external users with restricted `PUBLIC` role scopes ([KBE-143: MDO Admin onboarding PUBLIC role users](https://karmayogibharat.atlassian.net/browse/KBE-143) (QA In Progress)).

**SECTION 2.3: BULK REGISTRATION (BATCH & ASYNCHRONOUS INGESTION)**

### 2.3.1 Bulk Registration – Creation Context Diagram

Illustrates the asynchronous batch ingestion pipeline: dynamic sample generation (`/sample`) containing live Master Designations, batch CSV uploads, payload validation, and streaming into Apache Kafka message topics.

```mermaid
flowchart TD
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef sysStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef extStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef boundaryStyle fill:#FFFFFF,stroke:#4A5568,stroke-width:2px,stroke-dasharray: 4 4;
    ACTOR_MDO["MDO Nodal Administrator\n[Department Admin User]"]:::actorStyle
    subgraph BOUNDARY_BULK_CREATION ["Bulk Registration - Creation Subsystem Boundary"]
        PORTAL_MDO["MDO Management Portal\n[Bulk Upload Console]"]:::sysStyle
        GW_KONG["Kong API Gateway\n[File Boundary & Stream Router]"]:::sysStyle
        CTRL_BULK["BulkUploadController\n[/api/user/v1/bulkupload/* Routes]"]:::sysStyle
        SVC_SAMPLE["DynamicSampleGeneratorService\n[POI Engine: ZIP Bundle]"]:::sysStyle
        PRODUCER_BULK["BulkUploadIngestionProducer\n[Kafka Stream Producer]"]:::sysStyle
        CACHE_REDIS[("Redis Cache\n[Active Designation Catalog]")]:::extStyle
        DB_CASS[("Apache Cassandra\n[bulk_upload_process Table]")]:::extStyle
        BUS_KAFKA{{"Apache Kafka Topic\n[bulk-user-ingestion (12 Partitions)]"}}:::extStyle
    end
    %% Sample Package Download Flow
    ACTOR_MDO -->|1. Clicks 'Download Sample Package'| PORTAL_MDO
    PORTAL_MDO -->|2. GET /api/user/v1/bulkupload/sample| GW_KONG
    GW_KONG -->|3. Route Sample Request| CTRL_BULK
    CTRL_BULK -->|"4. generateSamplePackage() Execution"| SVC_SAMPLE
    SVC_SAMPLE -->|5. Read Active Master Designations| CACHE_REDIS
    CACHE_REDIS -->|6. Returns Master JSON| SVC_SAMPLE
    SVC_SAMPLE -->|7. Generate template.csv + MasterDesignations.xlsx| SVC_SAMPLE
    SVC_SAMPLE -->|8. Streams ZIP Stream Binary| PORTAL_MDO
    PORTAL_MDO -->|9. Admin Downloads Zip Package| ACTOR_MDO
    %% Multipart Batch Upload Flow
    ACTOR_MDO -->|"10. Uploads Completed CSV (Up to 10k Rows)"| PORTAL_MDO
    PORTAL_MDO -->|"11. POST /user/v1/bulkupload (Multipart FormData)"| GW_KONG
    GW_KONG -->|12. Route Multipart File Payload| CTRL_BULK
    CTRL_BULK -->|"13. ingestBatchFile() Execution"| PRODUCER_BULK
    PRODUCER_BULK -->|14. Validate Headers, Structure & Limit <= 10k| PRODUCER_BULK
    PRODUCER_BULK -->|15. Initialize Process: INSERT bulk_upload_process| DB_CASS
    PRODUCER_BULK -->|16. Stream Enveloped Messages to Topic| BUS_KAFKA
    PRODUCER_BULK -->|"17. Return 202 Accepted {processId: 'PRC-8812'}"| CTRL_BULK
    CTRL_BULK -->|18. HTTP 202 Accepted| PORTAL_MDO
    PORTAL_MDO -->|19. Displays Async Execution Progress Bar| ACTOR_MDO
```

#### Key Technical Tasks & Interfaces (Creation)

- `TASK-BR-CR-01` (Q2 Deprecation): Deprecate synchronous, unvalidated bulk CSV upload endpoints ([KB-1313: User Registration and Onboarding | Put Bulk Upload on hold.](https://karmayogibharat.atlassian.net/browse/KB-1313) (Open)).
- `TASK-BR-CR-02` (Q10 Dynamic Sample): Build `DynamicSampleGeneratorService` using Apache POI to inject live Redis master designations into template ZIPs ([Design Document: User Bulk Upload Sample File API](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/1243512856)).
- `TASK-BR-CR-03` (Q12 Scaling): Optimize Kafka partition batch listener concurrency to support 10,000-record batch files ([KB-13968: Q12 | iGOT for Non-Govt Users/ Volunteer Body](https://karmayogibharat.atlassian.net/browse/KB-13968) (Prod Deployed)).

### 2.3.2 Bulk Registration – Consumption Context Diagram

Illustrates how the asynchronous bulk worker processes uploaded records: schema and duplicate validation, Keycloak account creation, error buffering in Cassandra, and error log reconciliation exports.

```mermaid
flowchart TD
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef sysStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef extStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef boundaryStyle fill:#FFFFFF,stroke:#4A5568,stroke-width:2px,stroke-dasharray: 4 4;
    ACTOR_MDO["MDO Nodal Administrator\n[Department Admin User]"]:::actorStyle
    subgraph BOUNDARY_BULK_CONSUMPTION ["Bulk Registration - Consumption Subsystem Boundary"]
        PORTAL_MDO["MDO Management Portal\n[Batch Status & Error Log UI]"]:::sysStyle
        GW_KONG["Kong Ingress Gateway\n[API Router]"]:::sysStyle
        BUS_KAFKA{{"Apache Kafka Topic\n[bulk-user-ingestion (12 Partitions)]"}}:::extStyle
        WORKER_BULK["BulkUserIngestionConsumer\n[Spring Kafka Consumer Worker]"]:::sysStyle
        ENGINE_VAL["RowValidationEngine\n[Cadre & Regex Checker]"]:::sysStyle
        CACHE_REDIS[("Redis Cache\n[Active Masters]")]:::extStyle
        IAM_KC["Keycloak Admin Client\n[REST IAM Provider]"]:::sysStyle
        DAO_ERR["BulkUploadErrorLogDao\n[Streaming Exporter]"]:::sysStyle
        DB_CASS[("Apache Cassandra\n[bulk_upload_process, bulk_error_log, user_profile]")]:::extStyle
        SVC_NOTIF["Notification Engine\n[Batch Welcome Dispatcher]"]:::sysStyle
    end
    EXT_SMS["National SMS Gateway"]:::extStyle
    %% Kafka Consumer Processing Loop
    BUS_KAFKA -->|1. Poll Batch Event Row| WORKER_BULK
    WORKER_BULK -->|"2. validateRow(rawData)"| ENGINE_VAL
    ENGINE_VAL -->|3. Check Designation against Master| CACHE_REDIS
    %% Successful Record Branch
    ENGINE_VAL -->|4a. Row Valid & Non-Duplicate| WORKER_BULK
    WORKER_BULK -->|5a. Provision User Account| IAM_KC
    WORKER_BULK -->|"6a. INSERT user_profile (mode: BULK)"| DB_CASS
    WORKER_BULK -->|7a. UPDATE success_count counter| DB_CASS
    WORKER_BULK -->|8a. Trigger Welcome Credentials| SVC_NOTIF
    SVC_NOTIF -->|9a. Deliver Onboarding Alert| EXT_SMS
    %% Error Record Branch
    ENGINE_VAL -->|4b. Validation Failure / Duplicate Identity| WORKER_BULK
    WORKER_BULK -->|"5b. INSERT bulk_error_log (processId, row, error)"| DAO_ERR
    DAO_ERR -->|6b. Persist Error Row| DB_CASS
    WORKER_BULK -->|7b. UPDATE failure_count counter| DB_CASS
    %% Consumption: Admin Error Reconciliation
    ACTOR_MDO -->|10. Polls Status: GET /bulkupload/status/PRC-8812| PORTAL_MDO
    PORTAL_MDO -->|11. Ingest Status Request| GW_KONG
    GW_KONG -->|12. Return Execution Counters| DB_CASS
    DB_CASS -->|"13. {status: COMPLETED, success: 4850, failed: 150}"| PORTAL_MDO
    ACTOR_MDO -->|14. Clicks 'Download Error CSV'| PORTAL_MDO
    PORTAL_MDO -->|15. GET /bulkupload/error/PRC-8812.csv| GW_KONG
    GW_KONG -->|16. Trigger Streaming Export| DAO_ERR
    DAO_ERR -->|17. SELECT FROM bulk_error_log WHERE process_id = 'PRC-8812'| DB_CASS
    DAO_ERR -->|18. Streams Reconciled CSV with ErrorDetails Column| PORTAL_MDO
```

#### Key Technical Tasks & Interfaces (Consumption)

- `TASK-BR-CS-01` (Q10 Status API): Implement `GET /user/v1/bulkupload/status/{processId}` polling endpoints.
- `TASK-BR-CS-02` (Q10 Error Exporter): Implement `BulkUploadErrorLogDao` and streaming CSV export controller ([Design Document: User Bulk Upload Sample File API](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/1243512856)).
- `TASK-BR-CS-03` (Q10 Batch Welcome): Implement automated SMS/Email activation dispatch upon successful batch row completion.

**SECTION 2.4: SELF-REGISTRATION (MULTI-CHANNEL CHANNELS)**

### 2.4.1 Self-Registration – Multi-Channel Creation Context Diagram

Illustrates intake across five self-registration vectors: standard public web registration, custom organization link/QR intake, native mobile app onboarding, Marketplace Partner KYC intake, and Volunteer Body onboarding.

```mermaid
flowchart TD
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef sysStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef extStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef boundaryStyle fill:#FFFFFF,stroke:#4A5568,stroke-width:2px,stroke-dasharray: 4 4;
    ACTOR_FIELD["Field Officer / Learner"]:::actorStyle
    ACTOR_MKT["Marketplace Training Partner"]:::actorStyle
    subgraph BOUNDARY_SELF_CREATION ["Self-Registration - Multi-Channel Creation Boundary"]
        APP_MOBILE["Learner Mobile App\n[Camera QR Scanner & Intent]"]:::sysStyle
        PORTAL_MKT["Marketplace Portal\n[/partner/register Console]"]:::sysStyle
        GW_KONG["Kong Ingress Gateway\n[Route Whitelist, CORS, Rate Limit]"]:::sysStyle
        SVC_CUSTOM["CustomRegistrationLinkService\n[AES-GCM Resolver & QR Gen]"]:::sysStyle
        ENGINE_VAL["RegistrationValidationEngine\n[KB-9250 Domain Relaxation]"]:::sysStyle
        CTRL_MKT["MarketplacePartnerController\n[KYC Intake Handler]"]:::sysStyle
        SVC_NOTIF["Notification Engine\n[OTP Generator]"]:::sysStyle
        DB_CASS[("Apache Cassandra\n[registration_requests Table]")]:::extStyle
        DB_PG[("PostgreSQL\n[marketplace.partner_registration]")]:::extStyle
    end
    EXT_SMS["National SMS Gateway"]:::extStyle
    %% Vector B & C: Custom Link / Mobile QR Scanning
    ACTOR_FIELD -->|1a. Scans MDO QR / Hits Custom URL| APP_MOBILE
    APP_MOBILE -->|"2a. GET /custom/context?orgId={ENC_TOKEN}"| GW_KONG
    GW_KONG -->|3a. Route Context Request| SVC_CUSTOM
    SVC_CUSTOM -->|4a. Decrypt AES-GCM & Lock Org Node| SVC_CUSTOM
    SVC_CUSTOM -->|5a. Return Pre-populated Org Context| APP_MOBILE
    ACTOR_FIELD -->|6a. Inputs Personal Email & Mobile| APP_MOBILE
    APP_MOBILE -->|"7a. POST /otp/v1/generate (customOrgId set)"| GW_KONG
    GW_KONG -->|8a. Route to Validation Engine| ENGINE_VAL
    ENGINE_VAL -->|9a. Execute KB-9250: Bypass .gov Domain Check| SVC_NOTIF
    SVC_NOTIF -->|10a. Dispatch OTP| EXT_SMS
    EXT_SMS -.->|11a. Deliver Token| ACTOR_FIELD
    ACTOR_FIELD -->|12a. Verifies OTP & Clicks Submit| APP_MOBILE
    APP_MOBILE -->|13a. POST /registration/v1/custom/submit| GW_KONG
    GW_KONG -->|14a. Route Submission Payload| SVC_CUSTOM
    SVC_CUSTOM -->|"15a. INSERT registration_requests (status = 'PENDING')"| DB_CASS
    SVC_CUSTOM -->|"16a. HTTP 202 Accepted {requestId: 'REQ-7712'}"| APP_MOBILE
    %% Vector D: Marketplace Partner KYC Intake
    ACTOR_MKT -->|1b. Submits Legal Entity KYC & Proofs| PORTAL_MKT
    PORTAL_MKT -->|2b. POST /api/partner/v1/register| GW_KONG
    GW_KONG -->|3b. Route Partner Ingestion| CTRL_MKT
    CTRL_MKT -->|"4b. INSERT partner_registration (status = 'PENDING_REVIEW')"| DB_PG
    CTRL_MKT -->|"5b. Return HTTP 201 Created {refNumber: 'MKT-REF-9012'}"| PORTAL_MKT
```

#### Key Technical Tasks & Interfaces (Creation)

- `TASK-SR-CR-01` (Q6 Custom Link): Build `CustomRegistrationLinkService` and ZXing QR generation utilities ([KB-6187: Q6 | Custom Self Registration Onboarding optimization](https://karmayogibharat.atlassian.net/browse/KB-6187) (KB Review), [KB-7025: Q6 | Self registration | MDO | Create custom registration link](https://karmayogibharat.atlassian.net/browse/KB-7025) (Prod Deployed)).
- `TASK-SR-CR-02` (Q8 Domain Bypass): Implement domain relaxation branching in `RegistrationValidationEngine` ([KB-9250: Q8 | Ad-Hoc | Removal of Email Domain Validation for Custom Self-Registration](https://karmayogibharat.atlassian.net/browse/KB-9250) (QA In Progress)).
- `TASK-SR-CR-03` (Q10 Marketplace Intake): Create `MarketplacePartnerController` and PostgreSQL table `partner_registration` ([KB-11937: Q10 | Marketplace | Marketplace Partner Onboarding on iGOT via Self-Registration](https://karmayogibharat.atlassian.net/browse/KB-11937) (KB Review)).

### 2.4.2 Self-Registration – Consumption Context Diagram

Illustrates how self-registered profiles and approved partner identities are consumed: native Android deep-linking and SMS retriever binding, SPV partner application vetting, automated CBP organization provisioning, and `CBP_ADMIN` access enablement.

```mermaid
flowchart TD
    classDef actorStyle fill:#2D3748,stroke:#1A202C,stroke-width:2px,color:#FFFFFF;
    classDef sysStyle fill:#EBF8FF,stroke:#3182CE,stroke-width:2px,color:#2B6CB0;
    classDef extStyle fill:#EDF2F7,stroke:#4A5568,stroke-width:2px,color:#1A202C;
    classDef boundaryStyle fill:#FFFFFF,stroke:#4A5568,stroke-width:2px,stroke-dasharray: 4 4;
    ACTOR_SPV["SPV Governance Admin\n[Karmayogi Bharat Reviewer]"]:::actorStyle
    ACTOR_MKT["Marketplace Partner Admin\n[EdTech Institute Owner]"]:::actorStyle
    subgraph BOUNDARY_SELF_CONSUMPTION ["Self-Registration - Consumption Subsystem Boundary"]
        PORTAL_SPV["SPV Governance Portal\n[Marketplace Review Console]"]:::sysStyle
        PORTAL_CBP["CBP / Content Portal\n[Course Authoring Environment]"]:::sysStyle
        GW_KONG["Kong Ingress Gateway\n[Security Layer]"]:::sysStyle
        ORCH_PARTNER["PartnerApprovalOrchestrator\n[Multi-System Provisioner]"]:::sysStyle
        SVC_ORG["Org Hierarchy Service\n[Node Generator]"]:::sysStyle
        IAM_KC["Keycloak IAM\n[Admin REST Provider]"]:::sysStyle
        DB_PG[("PostgreSQL\n[partner_registration Table]")]:::extStyle
        DB_CASS[("Apache Cassandra\n[org_hierarchy Table]")]:::extStyle
    end
    EXT_SMTP["Gov SMTP Mail Server"]:::extStyle
    %% Review and Approval Workflow
    ACTOR_SPV -->|1. Evaluates Dossier & Approves: POST /partner/v1/REF-9012/approve| PORTAL_SPV
    PORTAL_SPV -->|2. Ingest Partner Approval| GW_KONG
    GW_KONG -->|3. Route to Orchestrator| ORCH_PARTNER
    ORCH_PARTNER -->|4. UPDATE partner_registration SET status = 'APPROVED'| DB_PG
    %% Automated Partner CBP Provisioning
    ORCH_PARTNER -->|"5. Create Partner Org Node (orgType = 'MARKETPLACE_PARTNER')"| SVC_ORG
    SVC_ORG -->|6. INSERT INTO org_hierarchy| DB_CASS
    SVC_ORG -->|7. Org Node Allocated: ORG-MKT-9012| ORCH_PARTNER
    ORCH_PARTNER -->|8. Create Keycloak Identity with Realm Role 'CBP_ADMIN'| IAM_KC
    IAM_KC -->|9. Keycloak User UUID Allocated| ORCH_PARTNER
    %% Partner Activation & Downstream Consumption
    ORCH_PARTNER -->|10. Dispatch One-Time Activation Link| EXT_SMTP
    EXT_SMTP -.->|11. Delivers Activation Email| ACTOR_MKT
    ACTOR_MKT -->|12. Sets Password & Logs in to CBP Portal| PORTAL_CBP
    PORTAL_CBP -->|13. OIDC Authentication with Role 'CBP_ADMIN'| IAM_KC
    PORTAL_CBP -->|14. Grants Course Publishing & Competency Authoring Access| ACTOR_MKT
```

#### Key Technical Tasks & Interfaces (Consumption)

- `TASK-SR-CS-01` (Q6 Mobile App): Implement native Android deep-link handling and SMS Retriever API integration ([KB-7054: Q6 | Self Registration | Learner | Mobile App based Registration](https://karmayogibharat.atlassian.net/browse/KB-7054) (Prod Deployed)).
- `TASK-SR-CS-02` (Q10 Partner Provisioning): Build `PartnerApprovalOrchestrator` to automate Keycloak `CBP_ADMIN` role assignment and CBP Portal access ([KB-11986: Q10 | Marketplace | Marketplace Partner Self registration and Track application status](https://karmayogibharat.atlassian.net/browse/KB-11986) (Prod Deployed)).

## 3. COMPONENT INGRESS/EGRESS INTERFACE MATRIX

| Subsystem Component | Primary Ingress Consumers | Consumed Ingress Endpoints | Egress Dependencies & Integrations | External Data Store / Cache / Queue |
|---|---|---|---|---|
| **Notification & OTP Engine** | Learner Web Portal, Mobile App | `POST /api/otp/v1/generate`<br>`POST /api/otp/v1/verify` | NIC SMS Gateway, CDAC Relay, Gov SMTP Mail Relay | Redis Cluster (`otp:{id}`), Cassandra (`approved_domains`) |
| **User & Org Service Core** | Learner Web Portal, API Gateway | `POST /api/user/v1/create`<br>`POST /api/org/v1/search` | Keycloak Admin REST Client, Elasticsearch Index Manager | Cassandra (`user_profile`), Elasticsearch (`org_hierarchy_v2`) |
| **Org Admin & Governance** | SPV Governance Portal | `POST /api/org/v1/create`<br>`POST /api/org/v1/domain/approve`<br>`POST /api/designation/v1/create` | Redis Pub/Sub Cluster (`topic:cache:evict`) | Cassandra (`org_hierarchy`, `approved_domains`, `designation_master`) |
| **Custom Registration Link Engine** | MDO Portal, Learner Mobile App | `GET /api/registration/v1/custom/context`<br>`POST /api/registration/v1/custom/submit` | AES-GCM 256 Cryptographic Engine, ZXing QR Library | Cassandra (`registration_requests`) |
| **MDO Approval State Engine** | MDO Management Portal | `GET /api/registration/v1/requests`<br>`POST /api/registration/v1/requests/{id}/action` | Keycloak Admin REST Client, Notification Engine | Cassandra (`registration_requests`, `user_profile`) |
| **Dynamic Bulk Upload Engine** | MDO Management Portal | `GET /api/user/v1/bulkupload/sa``mple`<br>`POST /api/user/v1/bulkupload`<br>`GET /api/user/v1/bulkupload/status/{id}` | Apache POI Streaming Engine, Apache Kafka Producer | Redis (`cache:designation:mas``ter:list`), Kafka (`bulk-user-ingestion`), Cassandra (`bulk_upload_process`) |
| **Marketplace Review Engine** | Marketplace Portal, SPV Portal | `POST /api/partner/v1/register`<br>`POST /api/partner/v1/{refNum}/approve` | Keycloak Admin REST Client, Org Hierarchy Engine | PostgreSQL (`marketplace.partner_registration`), Cassandra (`org_hierarchy`) |
| **e-HRMS Sync Connector** | DoPT e-HRMS Service Bus | Kafka Topic: `ehrms-service-record-sync` | Cassandra User Profile DAO (Master of Record Engine) | Cassandra (`user_profile.is_ehrms_linked`) |
