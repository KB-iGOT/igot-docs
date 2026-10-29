# Discussion Hub — High-Level Design (HLD)

**Discuss Hub and Community Subsystems Integration**

## 1. Document Overview and System Context

### 1.1 Purpose and Architectural Objective

This High-Level Design (HLD) defines the multi-tier system topology, service decomposition, component interaction patterns, integration interfaces, persistence architecture, and security boundaries for the **Discuss Hub** (`cb-discussion-service`) and **Community** (`cb-community-service`) subsystems.

The primary architectural objective is to establish a **federated, horizontally scalable, multi-tenant social learning ecosystem** that replaces the legacy NodeBB forum architecture (decommissioned in Q7). The design decouples organizational governance (Communities created by MDOs under SPV Topics) from high-concurrency social interactions (3-level threaded discussions, reactions, bookmarks, and automated multi-tier abuse moderation).

### 1.2 Upstream Specification Traceability

This HLD directly operationalizes the following approved baselines:

- **SRS Baseline**: SRS v2.4.0 (`FR-COMM-01` through `FR-COMM-05`, `FR-DISC-01` through `FR-DISC-05`, `FR-THRD-01` through `FR-THRD-03`, `FR-SOC-01` through `FR-SOC-04`, `FR-MOD-01` through `FR-MOD-06`, `FR-TEL-01` through `FR-TEL-02`).
- **Governing Epics**: [KB-7533: Q7 | Discuss Hub](https://karmayogibharat.atlassian.net/browse/KB-7533) (Open) (Q7 Overhaul), [KB-7534: Q7 | Discuss Hub | Backend and API implementation](https://karmayogibharat.atlassian.net/browse/KB-7534) (Open) (Backend APIs), [KB-7909: Q7 | Discuss Hub | Community Creation on MDO Portal](https://karmayogibharat.atlassian.net/browse/KB-7909) (KB Approved) (MDO Community Creation), [KB-7947: Q7 | Discuss Hub | Discuss Hub Consumption on Learner portal](https://karmayogibharat.atlassian.net/browse/KB-7947) (Prod Deployed) (Learner Portal Consumption), [KB-9261: Q8 | Discuss Hub | User tagging and three level replying](https://karmayogibharat.atlassian.net/browse/KB-9261) (KB Approved) (3-Level Replying), [KB-10497: Q9 | Discuss Hub](https://karmayogibharat.atlassian.net/browse/KB-10497) (KB Review) (Comment Flagging).
- **Technical Specifications**: [KB-7533 - Q7 | Discussion Hub](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/246055034/KB-7533+-+Q7+Discussion+Hub) and [cb-discussion-service](https://karmayogibharat.atlassian.net/wiki/spaces/TES/pages/387350530/cb-discussion-service).

## 2. Global Architecture and System Context

### 2.1 System Context Diagram (Level 1)

Discuss Hub and Community subsystems operate within the perimeter of the iGOT Karmayogi Bharat platform, exposing authenticated REST interfaces to client portals and consuming platform identity, taxonomy, and analytics pipelines.

```mermaid
graph TD
    subgraph Actors [Platform Actors]
        L[Learner / Civil Servant]
        M[MDO Administrator / Moderator]
        S[SPV Platform Administrator]
    end
    subgraph Boundaries [iGOT Karmayogi Bharat Subsystem Perimeter]
        subgraph Subsystems [Integrated Core Subsystems]
            COMM["cb-community-service<br/>(Java 17 / Spring Boot 3.2.x)"]
            DISC["cb-discussion-service<br/>(Java 17 / Spring Boot 3.2.x)"]
        end
        KONG["API Gateway / Node.js Reverse Proxy"]
        KEYCLOAK["Keycloak Identity Provider (Sunbird Auth)"]
        COMPETENCY["National Competency Framework (NCF v6) Service"]
        COURSE["Course Player / TOC Service"]
        KAFKA["Apache Kafka Event Bus (Telemetry & Events)"]
        BLOB["Object Store / S3-Compatible Storage"]
    end
    L -->|Browse, Join Communities, Post, Reply, Upvote, Flag| KONG
    M -->|Create/Publish Communities, Moderate Flagged Queues| KONG
    S -->|Define Master Topics, Review Global Flags| KONG
    KONG -->|/api/community/*| COMM
    KONG -->|/api/feedDiscussion/*| DISC
    COMM -->|Validate JWT Signature & Claims| KEYCLOAK
    DISC -->|Validate JWT Signature & Claims| KEYCLOAK
    COMM -->|"Fetch Competency Taxonomies (Area/Theme)"| COMPETENCY
    COURSE -->|Embed Discussion Widgets| DISC
    DISC -->|Emit Dwell Time, Reactions, Post Events| KAFKA
    DISC -->|Persist Document / Image Attachments| BLOB
    DISC -.->|Synchronous/Cached Membership Validation| COMM
```

## 3. Subsystem Decomposition and Internal Architecture

### 3.1 Service Responsibilities and Decoupling

To satisfy **CON-01** (Statelessness) and **CON-03** (Strict Relational Scoping):

1. `cb-community-service`:
  - Master custodian of Topic definitions (`topic_master`) and Community entities (`community_master`).
  - Governs Community lifecycles: `DRAFT` `PUBLISHED` `ARCHIVED`.
  - Enforces National Competency Framework (NCF v6) binding.
  - Manages User Membership Rosters (Join/Unjoin operations).

2. `cb-discussion-service`:
  - Master custodian of discussion nodes across the 3-level tree:
    - **Level 1** (`question`): PostgreSQL `discussion_entity`.
    - **Level 2** (`answerPost`): PostgreSQL `discussion_answer_post_reply`.
    - **Level 3** (`answerPostReply`): PostgreSQL `discussion_answer_post_reply`.

  - Handles user interactions: upvotes, downvotes, cross-community bookmarks.
  - Manages decentralized moderation: abuse reporting, dynamic community percentage threshold evaluation, and MDO moderation actions (`activatePost`, `removePost`).
  - Intercepts dwell-time metrics and streams telemetry payloads to Apache Kafka.

### 3.2 Component Interaction Architecture (Level 2)

The internal layering separates presentation routing, business orchestration, and polyglot persistence:

```mermaid
graph LR
    subgraph Gateway [Ingress & Proxy Layer]
        GW[Kong API Gateway / Reverse Proxy]
    end
    subgraph CommunitySvc [cb-community-service]
        CCtrl[Community & Topic Controllers]
        CSvc[Community Management Service]
        CMemb[Membership Manager]
        CRepo[Community Spring Data JPA]
    end
    subgraph DiscussionSvc [cb-discussion-service]
        DCtrl[Discussion & Threading Controllers]
        DSvc[Discussion Engine Service]
        ModSvc[Moderation & Flagging Engine]
        DRepo[Discussion JPA Repository]
        DClient[Cassandra Repository Client]
        ESClient[Elasticsearch RestHighLevel / Java Client]
    end
    subgraph DataTier [Polyglot Storage Layer]
        PG[(PostgreSQL Primary)]
        ES[(Elasticsearch Cluster)]
        CASS[(Apache Cassandra Cluster)]
        REDIS[(Redis Cache Cluster)]
    end
    GW -->|/api/community/*| CCtrl
    GW -->|/api/feedDiscussion/*| DCtrl
    CCtrl --> CSvc
    CCtrl --> CMemb
    CSvc --> CRepo
    CMemb --> CRepo
    CRepo -->|Relational/JSONB Reads/Writes| PG
    CSvc -->|Sync Community Documents| ES
    CMemb -->|Cache Active Membership Bitmaps| REDIS
    DCtrl --> DSvc
    DCtrl --> ModSvc
    DSvc --> DRepo
    DSvc --> DClient
    DSvc --> ESClient
    ModSvc --> DRepo
    ModSvc --> DClient
    ModSvc --> ESClient
    DRepo -->|Commit Master Discussion JSONB| PG
    DClient -->|Write User Votes, Bookmarks, Reports| CASS
    ESClient -->|Faceted Queries, Search & Feed Retrieval| ES
    DSvc -->|Cache Hot Global Feeds| REDIS
```

## 4. End-to-End Sequence Workflows

### 4.1 Community Creation and Publishing Workflow (MDO Portal)

MDO Administrators create and publish communities mapped to NCF v6 taxonomies under SPV Master Topics.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as MDO Administrator
    participant UI as MDO Management Portal
    participant Gateway as API Gateway / Proxy
    participant CommSvc as cb-community-service
    participant NCF as Competency Framework Svc
    participant PG as PostgreSQL
    participant ES as Elasticsearch
    Admin->>UI: Select Master Topic & Enter Details (Name, Guidelines, Banner)
    UI->>NCF: GET /api/competency/v6/taxonomy
    NCF-->>UI: Return Areas, Themes, Sub-Themes
    Admin->>UI: Map Competencies and Click "Publish Community"
    UI->>Gateway: POST /api/community/v1/create
    Gateway->>CommSvc: Validate Token & Payload
    CommSvc->>CommSvc: Validate Name Uniqueness under topicId (case-insensitive)
    CommSvc->>PG: INSERT INTO community_master (status='DRAFT', competencies_v6=JSONB)
    PG-->>CommSvc: Persisted communityId (UUID)
    UI->>Gateway: POST /api/community/v1/publish
    Gateway->>CommSvc: {communityId: UUID, accessLevel: 'public'}
    CommSvc->>PG: UPDATE community_master SET status='PUBLISHED'
    CommSvc->>ES: PUT /community_alias/_doc/{communityId}
    ES-->>CommSvc: 200 OK (Indexed)
    CommSvc-->>UI: HTTP 200 OK (Community Active)
```

### 4.2 Cross-Community Discussion and 3-Level Threading Workflow

Demonstrates the creation of a Level 1 post (`question`), an L2 comment (`answerPost`), and an L3 reply (`answerPostReply`).

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Authenticated Learner
    participant UI as Learner Portal / Mobile App
    participant Gateway as API Gateway
    participant DiscSvc as cb-discussion-service
    participant CommSvc as cb-community-service
    participant PG as PostgreSQL
    participant ES as Elasticsearch
    participant CASS as Apache Cassandra
    Note over Learner, DiscSvc: Level 1 Discussion Post Creation
    Learner->>UI: Click "Start Discussion", Select Community C1, Submit Text & Attachments
    UI->>Gateway: POST /api/feedDiscussion/create
    Gateway->>DiscSvc: Payload: {type: "question", communityId: "C1", description: "..."}
    DiscSvc->>CommSvc: Check Membership (userId, C1)
    CommSvc-->>DiscSvc: 200 OK (Active Member)
    DiscSvc->>DiscSvc: Validate Text (3-3000 chars), File (150KB-1MB), Profanity Filter
    DiscSvc->>PG: INSERT INTO discussion_entity (discussionId, data JSONB, status='active')
    DiscSvc->>ES: Index document into discussion_entity_alias
    DiscSvc-->>UI: HTTP 200 OK {discussionId: "D1"}
    Note over Learner, DiscSvc: Level 2 Comment ("answerPost")
    Learner->>UI: Submit Comment on Discussion D1
    UI->>Gateway: POST /api/feedDiscussion/answerPosts
    Gateway->>DiscSvc: {type: "answerPost", parentDiscussionId: "D1", description: "..."}
    DiscSvc->>PG: INSERT INTO discussion_answer_post_reply (answerPostId="A1", parentDiscussionId="D1")
    DiscSvc->>PG: UPDATE discussion_entity SET data = jsonb_set(answerPosts, +A1)
    DiscSvc->>ES: Partial Update D1 (Increment answerPostCount)
    DiscSvc-->>UI: HTTP 200 OK {answerPostId: "A1"}
    Note over Learner, DiscSvc: Level 3 Threaded Reply ("answerPostReply")
    Learner->>UI: Submit Reply targeting Comment A1
    UI->>Gateway: POST /api/feedDiscussion/answerPostReply/create
    Gateway->>DiscSvc: {type: "answerPostReply", parentAnswerPostId: "A1", parentDiscussionId: "D1"}
    DiscSvc->>PG: INSERT INTO discussion_answer_post_reply (replyId="R1", parentAnswerPostId="A1")
    DiscSvc->>ES: Index L3 node under parent thread
    DiscSvc-->>UI: HTTP 200 OK {answerPostReplyId: "R1"}
```

### 4.3 Abuse Reporting, Auto-Suppression, and Moderation Workflow

Demonstrates the multi-tier moderation cascade from user flagging to dynamic threshold suppression and MDO moderation.

```mermaid
sequenceDiagram
    autonumber
    actor Learner as Reporting Learner
    actor Mod as MDO Moderator
    participant Gateway as API Gateway
    participant DiscSvc as cb-discussion-service
    participant CommSvc as cb-community-service
    participant CASS as Apache Cassandra
    participant PG as PostgreSQL
    participant ES as Elasticsearch
    Learner->>Gateway: POST /api/feedDiscussion/report {discussionId: "D1", reportedDueTo: ["Spam"]}
    Gateway->>DiscSvc: Validate Request (Block if userId == createdBy)
    DiscSvc->>CASS: INSERT INTO sunbird.discussion_post_report_lookup_byuser (userid, discussionid)
    DiscSvc->>CASS: INSERT INTO sunbird.discussion_post_report_lookup_bypost (discussionid, userid)
    DiscSvc-->>Learner: HTTP 200 OK (Content instantly hidden for reporting user)
    Note over DiscSvc: Dynamic Threshold Evaluation
    DiscSvc->>CASS: COUNT unique users from report_lookup_bypost WHERE discussionid='D1'
    DiscSvc->>CommSvc: GET /api/community/v1/memberCount?communityId=C1
    CommSvc-->>DiscSvc: {totalMembers: 50}
    alt Unique Reports >= 10% (e.g., >= 5 reports) OR (TotalMembers <= 10 AND Reports >= 1)
        DiscSvc->>PG: UPDATE discussion_entity SET status='reported' WHERE discussionId='D1'
        DiscSvc->>ES: UPDATE discussion_entity_alias SET status='reported'
        Note over DiscSvc, ES: Post automatically hidden from all public feeds
    end
    Note over Mod, DiscSvc: MDO Moderation Queue Processing
    Mod->>Gateway: GET /api/feedDiscussion/search {status: "reported", communityId: "C1"}
    Gateway->>DiscSvc: Fetch flagged items
    DiscSvc->>ES: Query discussion_entity_alias WHERE status='reported'
    ES-->>DiscSvc: Return flagged records
    DiscSvc-->>Mod: Display flagged queue in MDO Portal
    alt Moderator Reinstates Content
        Mod->>Gateway: POST /api/feedDiscussion/admin/activatePost {discussionId: "D1"}
        Gateway->>DiscSvc: Forward activation
        DiscSvc->>PG: UPDATE discussion_entity SET status='active' WHERE discussionId='D1'
        DiscSvc->>ES: UPDATE discussion_entity_alias SET status='active'
    else Moderator Removes Content
        Mod->>Gateway: POST /api/feedDiscussion/admin/removePost {discussionId: "D1"}
        Gateway->>DiscSvc: Forward suppression
        DiscSvc->>PG: UPDATE discussion_entity SET isActive=false, status='suspended'
        DiscSvc->>ES: UPDATE discussion_entity_alias SET isActive=false, status='suspended'
        Note over DiscSvc: Cascading suppression hides all child L2 comments and L3 replies
    end
```

## 5. Persistence Architecture and Data Models

### 5.1 Polyglot Storage Strategy

The platform utilizes specialized persistence engines to support diverse access patterns:

- **PostgreSQL 15 (System of Record)**: Enforces ACID compliance, transactional integrity, foreign key relations, and flexible schema extensions via JSONB for nested discussions.
- **Elasticsearch 8.11 (Search & Facet Index)**: Powers sub-second keyword search, multi-community Global Feeds, and MDO moderation queues.
- **Apache Cassandra 4.1 (High-Throughput Interactions)**: Handles write-heavy, non-relational operations with zero lock contention (upvotes, downvotes, user bookmarks, and abuse flag audit trails).
- **Redis Cluster 7.x (In-Memory Cache)**: Buffers hot global feeds and user community membership bitmaps to minimize inter-service latency.

### 5.2 Logical Data Schema and Entity Relationships

```mermaid
erDiagram
    TOPIC_MASTER ||--o{ COMMUNITY_MASTER : "classifies"
    COMMUNITY_MASTER ||--o{ COMMUNITY_MEMBERS : "contains"
    COMMUNITY_MASTER ||--o{ DISCUSSION_ENTITY : "scopes"
    DISCUSSION_ENTITY ||--o{ DISCUSSION_ANSWER_POST_REPLY : "contains_l2_l3"
    DISCUSSION_ENTITY ||--o{ USER_POST_VOTES : "records"
    DISCUSSION_ENTITY ||--o{ USER_POST_BOOKMARKS : "saved_by"
    DISCUSSION_ENTITY ||--o{ REPORT_LOOKUP_BYPOST : "tracks_flags"
    TOPIC_MASTER {
        varchar topicId PK
        varchar topicTitle
        varchar topicDescription
        boolean isActive
        timestamp createdOn
    }
    COMMUNITY_MASTER {
        varchar communityId PK
        varchar topicId FK
        varchar communityName "UNIQUE per topicId"
        text communityDescription
        text communityGuidelines
        jsonb competencies_v6 "Area, Theme, Sub-theme"
        varchar communityAccessLevel "public"
        varchar status "DRAFT, PUBLISHED, ARCHIVED"
        varchar createdBy
        timestamp createdOn
        timestamp updatedOn
    }
    COMMUNITY_MEMBERS {
        varchar communityId PK, FK
        varchar userId PK
        varchar role "MEMBER, MODERATOR, ADMIN"
        timestamp joinedOn
    }
    DISCUSSION_ENTITY {
        varchar discussionId PK
        varchar communityId FK
        varchar type "question"
        jsonb data "Title, description HTML, media URLs"
        boolean isActive "Default true"
        varchar status "active, reported, suspended"
        int upVoteCount
        int downVoteCount
        int answerPostCount
        varchar createdBy
        timestamp createdOn
        timestamp updatedOn
    }
    DISCUSSION_ANSWER_POST_REPLY {
        varchar id PK "answerPostId or replyId"
        varchar parentDiscussionId FK
        varchar parentAnswerPostId "Null for L2, Populated for L3"
        varchar type "answerPost, answerPostReply"
        jsonb data "Text description HTML, media attachments"
        boolean isActive
        varchar status "active, reported, suspended"
        varchar createdBy
        timestamp createdOn
    }
    USER_POST_VOTES {
        varchar userId PK "Cassandra"
        varchar discussionId PK "Cassandra"
        varchar voteType "upvote, downvote"
        timestamp updatedOn
    }
    USER_POST_BOOKMARKS {
        varchar userId PK "Cassandra"
        varchar communityId PK "Cassandra"
        varchar discussionId PK "Cassandra"
        timestamp createdOn
    }
    REPORT_LOOKUP_BYPOST {
        varchar discussionId PK "Cassandra"
        varchar userId PK "Cassandra"
        varchar reasons "Spam, Harassment, Misinfo"
        timestamp reportedOn
    }
```

## 6. Access Control, Security, and Edge-Case Architecture

### 6.1 Authentication and Role-Based Authorization

1. **Bearer Token Validation**: Ingress proxies intercept incoming requests, validating the Keycloak JWT signature against the public certificate (`Sunbird Keycloak Realm`). The token payload exposes `userId` and platform roles (`PUBLIC`, `MDO_ADMIN`, `MDO_LEADER`).
2. **Community Membership Gating**:
  - For discussion authoring, L2 commenting, and L3 replying, `cb-discussion-service` verifies that the `userId` is an enrolled member of `communityId` by querying Redis cache key `comm:members:{communityId}:{userId}` with a database fallback.
  - Unauthenticated or non-member users receive an HTTP `403 Forbidden`.

3. **Course TOC Discussion Gating**:
  - When accessing discussions embedded in a Course Table of Contents (`/api/feedDiscussion/toc/*`), the service calls the Course Enrollment API.
  - If enrollment is verified, write capabilities are unlocked. Otherwise, the user is restricted to read-only access.

4. **MDO Moderation Access**:
  - Moderation operations (`/api/feedDiscussion/admin/*`) require the caller to possess `MDO_ADMIN`, `MDO_LEADER`, or explicitly assigned `MODERATOR` permissions within the target community.

### 6.2 Failure Handling and Circuit Breaking

- **Elasticsearch Degradation**: If Elasticsearch experiences downtime or ingestion lag, write transactions continue to execute synchronously against PostgreSQL. Feed queries fall back to direct PostgreSQL JSONB index queries with reduced pagination windows (capped at 10 items/page).
- **Cassandra Write Resilience**: Writes to `sunbird.user_post_votes` and `user_post_bookmarks` use Cassandra consistency level `LOCAL_QUORUM`. If Cassandra nodes become unavailable, votes are queued in Redis and drained via asynchronous recovery workers.
- **Malicious File Attachment Handling**: Media and document attachments uploaded during discussion creation are routed through validation logic enforcing file size bounds (150 KB to 1 MB) and MIME-type restrictions before storage URLs are generated.

## 7. Traceability: Requirements to High-Level Design

The following matrix confirms that all functional and non-functional requirements established in SRS v2.4.0 are fully realized in this architectural design:

| SRS Requirement ID | HLD Architectural Realization | Governing Components & Interfaces |
|---|---|---|
| **FR-COMM-01 / 02 / 03** | Enforced via `cb-community-service` controller validation and PostgreSQL unique constraints on `(topicId, lower(communityName))`. | `CommunityController`, `community_master`, `API-COMM-01` |
| **FR-COMM-04** | Serialized as structured JSONB in PostgreSQL and indexed in Elasticsearch under `competencies_v6` field. | `community_master.competencies_v6`, `API-COMM-01` |
| **FR-COMM-05** | Managed by `MembershipManager` writing membership states to PostgreSQL and caching active bits in Redis. | `community_members`, `API-COMM-03`, `API-COMM-04` |
| **FR-DISC-01 / 02** | Intercepted by `DiscussionValidator` checking Redis membership cache, string lengths (3-3000 chars), and profanity lists. | `DiscussionEngineService`, `API-DISC-01` |
| **FR-DISC-03** | Storage handler validating attachment types (PDF/Images) and file size bounds (150 KB - 1 MB). | `DiscussionEngineService`, Object Storage Gateway |
| **FR-DISC-04** | Ingestion pipeline profanity evaluation against configured dictionary lists before database commit. | `ProfanityFilterComponent`, `cb-discussion-service` |
| **FR-DISC-05** | Ownership verification comparing JWT `sub` claim with record `createdBy` attribute prior to update/soft-delete. | `discussion_entity`, `API-DISC-02`, `API-DISC-03` |
| **FR-THRD-01 / 02** | Relational mapping supporting L1 (`discussion_entity`), L2, and L3 (`discussion_answer_post_reply`) with depth ceiling logic. | `discussion_answer_post_reply`, `API-DISC-04`, `API-DISC-05` |
| **FR-THRD-03** | Regex token parser intercepting `@username` mentions and publishing notification events to Kafka. | Kafka Topic `notification.mentions` |
| **FR-SOC-01 / 02** | Cassandra tables `sunbird.user_post_votes` and `user_post_bookmarks` with aggregated denormalization in PostgreSQL/ES. | Cassandra Data Tier, `API-DISC-06`, `API-DISC-07` |
| **FR-SOC-03** | Elasticsearch query aggregating posts across joined community IDs extracted from caller context. | `discussion_entity_alias`, `API-DISC-09` |
| **FR-SOC-04** | Course enrollment verification interceptor gating write actions on TOC-embedded discussions. | Course Player Proxy Interceptor |
| **FR-MOD-01 / 02 / 03** | Cassandra abuse logging with immediate personal feed exclusion for the reporting user. | `discussion_post_report_lookup_*`, `API-DISC-08` |
| **FR-MOD-04 / 05 / 06** | Dynamic 10% threshold auto-suppression, cascading parent-child hides, and MDO moderation queue APIs. | `ModerationEngine`, `API-DISC-10`, `API-DISC-11` |
| **FR-TEL-01 / 02** | Client-side 3-second viewport dwell interceptor streaming structured telemetry envelopes to Kafka. | Kafka Topic `telemetry.raw`, `FR-TEL-01/02` |
| **NFR-PERF-01 / 02 / 03** | Redis caching for hot feeds, asynchronous Kafka emission, and optimized Elasticsearch indexes. | Multi-tier Caching & Async Processing |
| **NFR-SCAL-01 / 02** | Stateless pod design with Kubernetes HPA (4-32 pods) and partitioned storage layers. | GKE Deployment manifests |
| **NFR-SEC-01 / 02 / 03** | Keycloak JWT validation, OWASP HTML sanitization, and AES-256 at-rest encryption across PG/Cassandra/ES. | Security & Ingress Ingestion Gateways |
