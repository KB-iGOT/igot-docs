# Moderated Course — Low-Level Design (LLD)

## 1. Document Overview & Scope

This Low-Level Design (LLD) document provides detailed architectural flow specifications, algorithmic logic, internal class/module designs, request/response contracts, and database execution flows for the **Moderated Course** subsystem on the **iGOT Karmayogi Platform**.

It translates the High-Level Design into concrete engineering artifacts across the entire lifecycle:

1. **Creation & Configuration Flow:** Frontend state models, form validation routines, access setting configuration (`secureSettings`), and direct decentralized publishing logic (bypassing the SPV queue).
2. **Identity & Attestation Flow:** Learner verification request interceptors, workflow queue generation, and MDO Admin approval state transitions.
3. **Consumption & Discovery Flow:** Gateway claim injection, server-side Elasticsearch query clauses, batch validation, Cassandra transaction pipelines, telemetry stream progress calculation, and Sprint 39 unenrollment audit persistence.

## 2. Low-Level Component Hierarchy

```mermaid
flowchart TD
    subgraph PL["PRESENTATION LAYER (ANGULAR / REACT)"]
        P1["AuthoringAccessComponent<br/>- accessSetting Form Builder<br/>- MDO Typeahead & Wildcard<br/>- Verified Toggle Model"]
        P2["LearnerSearchComponent<br/>- Dynamic Facet Interceptor<br/>- Strip Card Renderer<br/>- Multi-Pill Category State"]
        P3["CourseTocComponent<br/>- Gated Enroll Button<br/>- DOM Share Strip Guard<br/>- Player Launch Guard"]
    end
    subgraph GW["API GATEWAY (NODE.JS / PROXY)"]
        G1["SessionProfileClaimsFilter<br/>- Keycloak JWT Signature Introspector<br/>- Redis Session Cache Fetcher<br/>- Downstream Header Mutator (x-user-id, x-user-root-org-id, x-user-is-verified)"]
    end
    subgraph CMS["CONTENT MICROSERVICE"]
        C1["ContentPublishRouter<br/>- SPV Bypass Guard<br/>- secureSettings Serial"]
        C2["HierarchyAssetGatekeeper<br/>- Leaf Node Tokenizer"]
    end
    subgraph SS["SEARCH SERVICE"]
        S1["EsSecurityQueryBuilder<br/>- Bool Clause Injector<br/>- Wildcard Evaluator<br/>- Facet Sanity Engine"]
    end
    subgraph CRS["COURSE MICROSERVICE"]
        R1["BatchEnrollmentManager<br/>- AccessSettings Evalu<br/>- Single Batch Lock"]
        R2["UnenrollmentController<br/>- History Audit Writer"]
    end
    subgraph DT["PERSISTENCE & PIPELINES (DATA TIER)"]
        D1[("Elasticsearch: kp_content_alias<br/>- Node index with secureSettings<br/>- Wildcard query routing")]
        D2[("Cassandra: sunbird_courses<br/>- user_enrolments_v2<br/>- enrollment_history_by_action<br/>- enrollment_batch_lookup")]
        D3["Kafka / Apache Flink Engine<br/>- 30-sec tumbling window<br/>- Leaf progress aggregator<br/>- Certificate event issuer"]
    end
    PL -->|"HTTP / REST"| GW
    GW --> CMS
    GW --> SS
    GW --> CRS
    CMS --> DT
    CRS --> DT
```

## 3. Subsystem 1: Course Creation, Configuration & Publishing

### 3.1 Flow Diagram: Authoring Form & Access Configuration

```mermaid
flowchart TD
    A["Author opens CBP Studio"] --> B["Selects Category: #quot;Moderated Course#quot;"]
    B --> C["Form Controller checks accessSetting"]
    C -->|"accessSetting = #quot;open#quot;"| D["Public Course Config"]
    C -->|"accessSetting = #quot;mdoSpecific#quot;"| E["Render MDO Multi-Select Typeahead"]
    E --> F{"Did User check #quot;Select All MDOs#quot;?"}
    F -->|"YES"| G["Set secureSettings.organisation = [#quot;*#quot;]<br/>KB-15266 Payload Optimization"]
    F -->|"NO"| H["Fetch selected MDO rootOrgIds<br/>Assign array of Org IDs"]
    G --> I["Render #quot;Verified Only#quot; Toggle<br/>(Default = #quot;Yes#quot; / Checked)"]
    H --> I
    I --> J["Validate Schema Constraints"]
    J --> K["Save Draft / Update Metadata Node"]
```

### 3.2 Form Model & Validation State Controller

```typescript
/**
 * Authoring Access Configuration Model
 * Location: src/app/routes/authoring/models/access-settings.model.ts
 */
export interface ISecureSettings {
  isVerifiedKarmayogi: 'Yes' | 'No';
  organisation: string[]; // Holds MDO rootOrgIds or ["*"] for wildcard
  version: number;
}

export interface IContentMetadataNode {
  identifier: string;
  name: string;
  contentType: 'Course' | 'Program';
  courseCategory: 'Moderated Course' | 'Moderated Program' | 'Moderated Assessment';
  accessSetting: 'open' | 'mdoSpecific';
  secureSettings: ISecureSettings;
  status: 'Draft' | 'Review' | 'Live' | 'Retired';
  createdFor: string[];
}

/**
 * Validator rule executed prior to form submission
 */
export function validateModeratedCourseAccess(node: IContentMetadataNode): { isValid: boolean; error?: string } {
  if (node.courseCategory === 'Moderated Course' || node.courseCategory === 'Moderated Program') {
    if (node.accessSetting !== 'mdoSpecific') {
      return { isValid: false, error: 'Moderated courses must have accessSetting set to mdoSpecific' };
    }
    if (!node.secureSettings || !node.secureSettings.organisation || node.secureSettings.organisation.length === 0) {
      return { isValid: false, error: 'Target MDO selection is required. Choose at least one MDO or select All' };
    }
    if (!node.secureSettings.isVerifiedKarmayogi) {
      return { isValid: false, error: 'Verified Karmayogi requirement flag must be specified' };
    }
  }
  return { isValid: true };
}
```

### 3.3 Flow Diagram: Decentralized Publishing Engine ([KB-355: Q2 | CBP Publishing | SPV shall have the sole authority to publish the CBP on iGOT except in the case when the CBP is a Moderated Course.](https://karmayogibharat.atlassian.net/browse/KB-355) (Prod Deployed))

```mermaid
flowchart TD
    A["Content Submitted for Review"] --> B["MDO Content Reviewer Approves"]
    B --> C["Content Sent to Publish Queue"]
    C --> D{"ContentPublishRouter inspects courseCategory"}
    D -->|"courseCategory == #quot;Course#quot;"| E["Route to Central SPV Queue<br/>SPV Publisher Approval Required"]
    D -->|"courseCategory == #quot;Moderated Course#quot;"| F["BYPASS Central SPV Queue<br/>MDO Content Publisher Authorized"]
    E --> G["Set Status = #quot;Live#quot; in Graph Store"]
    F --> G
    G --> H["Update Elasticsearch: kp_content_alias"]
    H --> I["Emit CoursePublishEvent to Kafka"]
    I --> J["Auto-Batch Engine: Provision 1 Open Batch<br/>Populate createdFor with secureSettings.organisation<br/>Write mapping to enrollment_batch_lookup"]
```

## 4. Subsystem 2: Identity & Verified Karmayogi Attestation

### 4.1 Flow Diagram: Two-Phase Profile Verification Workflow

```mermaid
sequenceDiagram
    participant L as Learner UI (Profile)
    participant G as Gateway Filter
    participant W as cb-ext Workflow Engine
    participant M as MDO Admin UI (Inbox)
    L->>G: 1. Check "Earn Badge"<br/>(PATCH /extPatch)<br/>isVerified: true
    G->>W: 2. Inspect Payload
    Note over G: Strip direct verified<br/>flag manipulation
    W->>M: 3. Intercept & Create<br/>Workflow Task Instance<br/>(Status: PENDING)
    W-->>G: 
    G-->>L: 202 Accepted (Queued)<br/>"Request submitted"
    Note over M: [MDO Admin Action]<br/>- Verifies Designation<br/>- Verifies Employee ID
    M->>W: 4. Transition: APPROVE<br/>(POST /workflow/v1)
    W->>W: 5. Commit to Storage:<br/>PostgreSQL user_profile<br/>SET is_verified = true<br/>Flush Redis Token Cache
    L->>G: 6. Subsequent Login<br/>(Search Unlocked)
    G->>W: Injects Verified Claim<br/>x-user-is-verified: true
```

### 4.2 API Contract & Schema: Profile Patch Interceptor

```http
// Inbound Request to Gateway:
PATCH /apis/proxies/v8/user/v1/extPatch

{
  "id": "api.user.extPatch",
  "ver": "1.0",
  "ts": "2026-10-30T13:37:00Z",
  "request": {
    "userId": "usr_993847291048",
    "profileDetails": {
      "mandatoryFieldsCompleted": true,
      "employeeCode": "NIC-992811",
      "designation": "Under Secretary",
      "cadre": "CSS",
      "departmentName": "Department of Personnel and Training"
    },
    "verificationRequest": {
      "optedIn": true,
      "requestedAt": "2026-10-30T13:37:00Z"
    }
  }
}

// Outbound Response from Workflow Engine:
{
  "id": "api.user.extPatch",
  "ver": "1.0",
  "ts": "2026-10-30T13:37:01Z",
  "responseCode": "ACCEPTED",
  "result": {
    "workflowId": "wf_inst_883719203847",
    "status": "INITIATED",
    "targetApproverRole": "MDO_ADMIN",
    "targetOrgId": "01381906916850892825",
    "message": "Verification request successfully routed to your departmental administrator."
  }
}
```

## 5. Subsystem 3: Discovery & Elasticsearch Security Query Engine

### 5.1 Flow Diagram: Server-Side Query Generation

```mermaid
flowchart TD
    A["Learner performs Catalog Search or opens Learn Hub"] --> B["API Gateway intercepts request: Extracts JWT Claims<br/>- userId = #quot;usr_993847291048#quot;<br/>- userRootOrgId = #quot;01381906916850892825#quot;<br/>- isVerifiedUser = true"]
    B --> C["SearchService: Injects Security Clauses into Elasticsearch DSL"]
    C --> ES
    subgraph ES["Elasticsearch Boolean Logic Evaluation"]
        E1["MUST MATCH: status = #quot;Live#quot;<br/><br/>SHOULD (At least one must match):<br/>1. Normal Public Courses:<br/>MUST_NOT: courseCategory = #quot;Moderated Course#quot;<br/><br/>2. Moderated Courses (Authorized Only):<br/>MUST: courseCategory = #quot;Moderated Course#quot;<br/>AND MUST (Org Match):<br/>secureSettings.organisation CONTAINS userRootOrgId<br/>OR secureSettings.organisation CONTAINS #quot;*#quot;<br/>AND MUST (Verification Match):<br/>secureSettings.isVerifiedKarmayogi = #quot;No#quot;<br/>OR (secureSettings.isVerifiedKarmayogi = #quot;Yes#quot;<br/>AND isVerifiedUser == true)"]
    end
    ES --> D[("Query executed on kp_content_alias / org_eligibility_alias")]
    D --> F["Result Set serialized: Ineligible courses 100% excluded<br/>Zero Metadata Leakage to Frontend Client"]
```

### 5.2 Elasticsearch Query Builder Implementation

```java
/**
 * Elasticsearch Access Security Filter Builder
 * Component: search-service / QueryBuilder
 */
public class ModeratedCourseSecurityFilterBuilder {

    public static BoolQueryBuilder buildSecurityClause(String userRootOrgId, boolean isVerifiedKarmayogi) {
        BoolQueryBuilder rootBool = QueryBuilders.boolQuery();

        // Branch 1: Public Non-Moderated Content
        BoolQueryBuilder publicContentBranch = QueryBuilders.boolQuery()
                .mustNot(QueryBuilders.termQuery("courseCategory.raw", "Moderated Course"))
                .mustNot(QueryBuilders.termQuery("courseCategory.raw", "Moderated Program"));

        // Branch 2: Moderated Content Scoped Access
        BoolQueryBuilder moderatedContentBranch = QueryBuilders.boolQuery()
                .must(QueryBuilders.boolQuery()
                        .should(QueryBuilders.termQuery("courseCategory.raw", "Moderated Course"))
                        .should(QueryBuilders.termQuery("courseCategory.raw", "Moderated Program"))
                        .minimumShouldMatch(1)
                );

        // Sub-Branch 2A: Organization Check (Target Org OR Wildcard "*")
        BoolQueryBuilder orgMatchClause = QueryBuilders.boolQuery()
                .should(QueryBuilders.termQuery("secureSettings.organisation.raw", "*")) // KB-15266 Wildcard
                .should(QueryBuilders.termQuery("secureSettings.organisation.raw", userRootOrgId))
                .minimumShouldMatch(1);
        moderatedContentBranch.must(orgMatchClause);

        // Sub-Branch 2B: Verification Check
        if (!isVerifiedKarmayogi) {
            // Unverified users can ONLY see moderated courses that explicitly do NOT require verification
            moderatedContentBranch.must(QueryBuilders.termQuery("secureSettings.isVerifiedKarmayogi.raw", "No"));
        } else {
            // Verified users can view both verified-only and non-verified moderated courses
            moderatedContentBranch.must(QueryBuilders.boolQuery()
                    .should(QueryBuilders.termQuery("secureSettings.isVerifiedKarmayogi.raw", "Yes"))
                    .should(QueryBuilders.termQuery("secureSettings.isVerifiedKarmayogi.raw", "No"))
                    .minimumShouldMatch(1)
            );
        }

        // Combine using SHOULD: Content is returned if it is public OR if it matches user's moderated scope
        rootBool.should(publicContentBranch);
        rootBool.should(moderatedContentBranch);
        rootBool.minimumShouldMatch(1);

        return rootBool;
    }
}
```

## 6. Subsystem 4: Consumption, Enrolment & Direct Access Gating

### 6.1 Flow Diagram: Direct URL Navigation & TOC Action Control

```mermaid
flowchart TD
    A["Learner navigates to /app/toc/{courseId}/overview"] --> B["TOC Component fetches Content Access Metadata<br/>GET /apis/proxies/v8/content/v1/access/read/{courseId}"]
    B --> C{"Is courseCategory == #quot;Moderated Course#quot;?"}
    C -->|"NO"| D["Standard Display"]
    C -->|"YES"| E["Evaluate UI Gating"]
    E --> F["DOM Security Execution<br/>- STRIP Share Icon from DOM<br/>(KB-2559 / KB-3002)<br/>- Block Clipboard URL Generation"]
    E --> G["Eligibility Evaluation<br/>- Compare User Org vs secureSettings<br/>- Compare User Badge vs secureSettings"]
    G -->|"Eligible"| H["Render Active TOC<br/>Enable #quot;Enroll#quot; CTA<br/>Allow Player Launch"]
    G -->|"Ineligible"| I["Render Locked TOC<br/>- Disable #quot;Enroll#quot; CTA<br/>- Display Alert: #quot;Restricted to MDO Cadre#quot;<br/>- Provide Link to Chatbot"]
```

### 6.2 Flow Diagram: Batch Enrolment Validation Pipeline (`/course/v1/enrol`)

```mermaid
sequenceDiagram
    participant L as Learner UI
    participant G as Gateway Proxy
    participant C as Course Service
    participant D as Cassandra (DB)
    L->>G: 1. POST /course/enrol<br/>(courseId, batchId)
    G->>C: 2. Inject Headers<br/>x-user-root-org-id<br/>x-user-is-verified
    C->>C: 3. Read Node Meta<br/>from Redis Cache
    C->>C: 4. Execute Gating:<br/>Is Org in List?<br/>Is Badge Valid?
    Note over C: [Validation Result]
    alt FAILED
        C-->>G: 5A. 403 Forbidden<br/>USER_NOT_ELIGIBLE
        G-->>L: Display Error Toast<br/>"Access Restricted"
    else PASSED
        C->>D: 5B. Single Batch Lock<br/>(enrollment_batch_lookup)
        C->>D: 6. Insert Row:<br/>user_enrolments_v2<br/>status = 1, progress = 0
        D-->>C: 
        C-->>G: 7. 200 OK SUCCESS
        G-->>L: Update UI to "Enrolled"<br/>(Enrolment Confirmed)
    end
```

## 7. Subsystem 5: Telemetry Pipeline, Progress & Unenrollment Lifecycle

### 7.1 Telemetry Processing & Progress Calculation

```mermaid
flowchart TD
    subgraph TPP["TELEMETRY PROGRESSION PIPELINE"]
        A["Learner Consumes Video / PDF / Assessment in Content Player"]
        B["Gateway Ingestion Endpoint: POST /apis/proxies/v8/telemetry"]
        C["Apache Kafka Topic: dev.telemetry.raw"]
        D["Apache Flink Streaming Progress Aggregator Job<br/>1. Ingests raw telemetry events partitioned by userId.<br/>2. Reconciles leaf-node identifiers against course structure graph in Neo4j/Cache.<br/>3. Computes progress = (completedLeafNodesCount / totalLeafNodesCount) * 100.<br/>4. Writes updated progress state to Cassandra table user_enrolments_v2.<br/>5. If progress == 100:<br/>- Emits Kafka event: dev.course.completion<br/>- Dispatches async trigger to Certificate Generation Service"]
        A -->|"Emits Sunbird Telemetry v3 Events:<br/>- START (Session opened)<br/>- INTERACT (Video seek, pause, slide transition)<br/>- ASSESS (Question submitted, score computed)<br/>- END (Asset completed)"| B
        B --> C
        C --> D
    end
```

### 7.2 Flow Diagram: Unenrollment & Cassandra Audit Pipeline ([KB-14518: Q12 | Unenrollment from Courses | Web Portal](https://karmayogibharat.atlassian.net/browse/KB-14518) (Prod Deployed))

```mermaid
sequenceDiagram
    participant L as Learner UI
    participant C as Course Service
    participant E as Cassandra (Enrolment)
    participant H as Cassandra (History Audit)
    L->>C: 1. Click "Unenroll"<br/>POST /course/v1/unenrol<br/>#123;courseId, batchId#125;
    C->>C: 2. Validate Policy:<br/>Inspect configuration:<br/>course_unenroll_allowed<br/>Contains "Moderated"?<br/>(Allow if true)
    C->>E: 3. Execute Soft Delete<br/>UPDATE user_enrolments_v2<br/>SET active = false
    C->>H: 4. Write Audit History<br/>INSERT INTO<br/>enrollment_history_by_action<br/>(action = "UNENROL")
    C->>C: 5. Publish Kafka Event<br/>#91;Topic: dev.user.unenrol#93;
    C-->>L: 200 OK (Unenrolled)
```

### 7.3 Database Execution Schema & Concrete Statements

#### Soft-Delete Update in `sunbird_courses.user_enrolments_v2`:

```sql
UPDATE sunbird_courses.user_enrolments_v2
SET active = false
WHERE userid = 'usr_993847291048'
  AND courseid = 'do_1139946938317127681396'
  AND batchid = '013994701293847291';
```

#### Immutable Audit Insert in `sunbird_courses.enrollment_history_by_action`:

```sql
INSERT INTO sunbird_courses.enrollment_history_by_action (
    userid, action, actiondate, batchid, courseid, progress, reason
) VALUES (
    'usr_993847291048', 'UNENROL', toTimestamp(now()), '013994701293847291',
    'do_1139946938317127681396', 45, ['Accidental enrollment by user']
);
```

## 8. Subsystem 6: Automated ITSM Chatbot Verification Engine ([KB-14236: Unable to find Moderated Courses / Unable to enroll in the course / Unable to find the course/ Unable to search external course/event](https://karmayogibharat.atlassian.net/browse/KB-14236) (Prod Deployed))

### 8.1 Algorithmic Decision Flow for Support Inquiries

```mermaid
flowchart TD
    A["Learner inputs: #quot;Why can't I access Course X?#quot;"] --> B["ITSM Chatbot intercepts query with courseId & userId"]
    B --> C["Step 1: Call GET /content/v1/access/read/{courseId}"]
    C --> D{"Is courseCategory == #quot;Moderated Course#quot;?"}
    D -->|"NO"| E["Standard Course Logic<br/>(Check batch dates, quota)"]
    D -->|"YES"| F["Step 2: Call GET /user/v2/read/{userId}"]
    F --> G["Evaluate MDO & Badge Rules"]
    G --> H["User MDO != secureSettings.org<br/>AND org != #quot;*#quot;"]
    G --> I["User is NOT Verified<br/>AND secureSettings.isVerified == #quot;Yes#quot;"]
    H --> J["BOT RESPONSE: Root Cause Found<br/>#quot;This course is restricted to officials<br/>of [Department Name]. Your account belongs<br/>to [User Dept Name].#quot;"]
    I --> K["BOT RESPONSE: Root Cause Found<br/>#quot;This course requires a Verified Karmayogi badge.<br/>Your profile is currently unverified.#quot;"]
    J --> L["Provide Direct CTA: #quot;Earn Badge#quot;<br/>(Redirect to Profile Completion Screen)"]
    K --> M["Display Escalation CTA: #quot;Contact Nodal Officer / YP#quot;"]
```

## 9. Failure Modes, Edge Cases & Circuit Breaker Logic

| Failure Mode | Triggering Condition | Subsystem Impact | Concrete Mitigation & System Recovery |
|---|---|---|---|
| **Circuit Breaker: Elasticsearch Timeout** | Search cluster p95 latency under heavy load. | Discovery / Learn Hub | Gateway triggers resilience fallback: Disables moderated query facets and returns cached standard public catalog with toast: *"Specialized courses temporarily unavailable."* |
| **Wildcard Index Collision** | Course created with both explicit MDO IDs AND wildcard `["*"]` in array. | Search & Enrolment | Pre-save interceptor normalizes payload: If `organisation` contains `*`, it truncates the array to `["*"]` to ensure deterministic query execution ([KB-15266: Moderated Content - Enhancements in SecureSettings.organisation when selecting all organisation](https://karmayogibharat.atlassian.net/browse/KB-15266) (Open)). |
| **Inter-Departmental User Transfer** | Official moves from Ministry A to Ministry B; `rootOrgId` changes. | Consumption / Active Player | On next login, session cache refreshes. Gateway immediately blocks search and batch operations for Ministry A courses. Active player sessions terminate upon next token refresh. |
| **Duplicate Batch Creation Attempt** | Admin attempts to create second batch for a Moderated Course. | Course Service | `enrollment_batch_lookup` enforces a database-level uniqueness constraint. Rejects call with `HTTP 409 Conflict` (`BATCH_ALREADY_EXISTS_FOR_MODERATED_COURSE`). |
| **Unenrollment on Completed Course** | User attempts to unenroll after reaching 100% progress and receiving certificate. | Unenrollment Controller | Controller verifies `progress < 100` and `issued_certificates` is empty. If certificate exists, rejects request with `HTTP 400 Bad Request` (`CANNOT_UNENROL_COMPLETED_COURSE`). |
