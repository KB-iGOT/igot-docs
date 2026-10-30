# Multilingual — Low-Level Design (LLD) – Workflow & Interaction Diagrams

## 1.  End-to-End Multilingual Lifecycle Diagram

The master flow below details every operational and technical transition across the 8 stages of the multilingual course capability.

```mermaid
---
title: END-TO-END MULTILINGUAL LIFECYCLE FLOWCHART
---
flowchart TD
    subgraph S1["1. Base Course Creation"]
        A1["Creator selects Base<br/>Language (Default: EN)<br/>in Creation Modal"]
        A2["Full Metadata Defined<br/>(Request ID, Sectors,<br/>SDGs, Competencies)"]
        A3["Complete CQF Review &<br/>Publishing Cycle<br/>Base becomes #quot;Live#quot;"]
        A1 --> A2 --> A3
    end
    subgraph S2["2. Translation Variant Extension"]
        B1["Base Course is #quot;Live#quot;<br/>Creator clicks (...)<br/>#quot;Add New Language#quot;"]
        B2["Content Service Clones<br/>Structural Hierarchy<br/>(Modules & Resource<br/>node placeholders)"]
        B3["Lock Core Taxonomy:<br/>- Request ID & SDGs<br/>- Assessment Count<br/>Allow: Media & Texts"]
        B4["Creator localizes:<br/>- Video/Audio/SCORM<br/>- Question/Opt Texts<br/>- Localized Titles"]
        B5["Submit Child Variant<br/>for Review"]
        B1 --> B2 --> B3 --> B4 --> B5
    end
    subgraph S3["3. Independent Review & Curation"]
        C1["Reviewer Queue:<br/>Unified Multi-Lang<br/>Review Window"]
        C2["Base Course CQF:<br/>Verified & Passed<br/>(Child variants skip<br/>CQF check)"]
        C3{"Passes<br/>Review?"}
        C4["Child Status:<br/>#quot;Draft#quot;<br/>(Feedback<br/>logged)"]
        C5["Child Status:<br/>#quot;Approved#quot;<br/>(Base remains Live)"]
        C1 --> C2 --> C3
        C3 -->|"No"| C4
        C3 --> C5
    end
    A3 -->|"(Prerequisite for child)"| B4
    B5 --> C1
    subgraph S4["4. Course Publishing"]
        D1["SPV Publisher clicks<br/>#quot;Publish Language#quot;"]
        D2["Single Batch Check:<br/>NO batch created for<br/>child variant.<br/>Set compatibility=5"]
        D3["Update Parent Variant<br/>Array in ES & Neo4j#59;<br/>Child becomes #quot;Live#quot;"]
        D1 --> D2 --> D3
    end
    C5 --> D1
    subgraph S5["5. Discovery & Auto-Enrollment"]
        E1["Learner Catalog:<br/>Single Course Card:<br/>#quot;Available in X Langs#quot;"]
        E2["Click #quot;Enroll#quot;:<br/>Modal prompts user for<br/>preferred language"]
        E3["cb-ext AutoEnroll V2:<br/>Resolves Parent Batch<br/>POST /course/v2/enrol"]
        E4["Cassandra Record:<br/>user_courses row with<br/>enrolled_language"]
        E1 --> E2 --> E3 --> E4
    end
    subgraph S6["6. Consumption & Certification"]
        F1["Launch Course Player<br/>in Selected Language<br/>(e.g., Hindi)"]
        F2["Learner tracks<br/>progress independently<br/>in active language"]
        F3{"Switch<br/>Language?"}
        F4["Display Warning:<br/>#quot;Progress resets to<br/>0% in new language<br/>Historic progress<br/>preserved#quot;"]
        F5["User resumes or<br/>restarts progress"]
        F6["Reach 100% Completion<br/>in any language"]
        F7["Issue Certificate:<br/>Course Title locked<br/>to First-Completed<br/>Language"]
        F8["Ratings (>50% gating)<br/>saved and isolated<br/>per language"]
        F1 --> F2 --> F3
        F3 -->|"Yes"| F4 --> F5 --> F6
        F3 -->|"No"| F6
        F6 --> F7 --> F8
    end
    E4 --> F6
```

## 2. Stage 1: Multilingual Course Creation & Authoring

### 2.1 Detailed Workflow Flowchart

This flow shows the decision gates enforced by the frontend forms and backend validation services during initial course authoring.

```mermaid
flowchart TD
    A["Content Creator clicks #quot;Create Course#quot;"]
    B["Display Language Selection Modal<br/>(KB-9470: Default to English, list Indic<br/>languages supported by the platform)"]
    C["Creator populates Master Metadata:<br/>• Request ID, Course Name, Category<br/>• Sectors, SDGs, Target Competencies<br/>• Modules, Units, Assessments, Media Assets"]
    D["Base Language Submission & Review:<br/>Complete Content Quality Framework (CQF)<br/>Reviewer & Publisher approve Base Course"]
    E{"Base Status<br/>== #quot;Live#quot;?"}
    F["#quot;Add New Language#quot;<br/>action is DISABLED"]
    G["Action Menu (...) reveals #quot;Add New Language#quot;<br/>(KB-9471: Prerequisite validation passed)"]
    H["Creator selects Target Language (e.g., Hindi)"]
    I["Content Service executes Structural Clone:<br/>• Clones entire module tree & sequence index<br/>• Sets child compatibilityLevel = 5<br/>• Generates unique DO_IDs for child nodes"]
    J["LOCKED ATTRIBUTES<br/>• Request ID & SDGs<br/>• Sector & Competencies<br/>• Module Sequence & Counts<br/>• Assessment Question Count<br/>(KB-11053)"]
    K["LOCALIZABLE ATTRIBUTES<br/>• Course & Module Title<br/>• Description & Summary<br/>• Media Assets (MP4/Audio)<br/>• Assessment Question/Option<br/>Text & Duration"]
    A --> B --> C --> D --> E
    E -->|"No"| F
    E -->|"Yes"| G
    G --> H --> I
    I --> J
    I --> K
```

### 2.2 Sequence Diagram: Structural Cloning Process

This diagram maps the exact API communication between the Creator Workbench, `content-service`, and the underlying graph database.

```mermaid
sequenceDiagram
    participant UI as Creator UI (Angular)
    participant GW as API Gateway / Kong
    participant CS as Content Service (Java)
    participant NEO as Neo4j / Content Graph
    UI->>GW: 1. Click "Add New Language"<br/>Target: "hindi"
    GW->>CS: 2. POST /content/v1/create<br/>#123; parentId, lang: "hi" #125;
    CS->>NEO: 3. Fetch Base Course Graph
    NEO-->>CS: Return full base tree
    Note over CS: 4. Validate Base Status:<br/>Assert status == "Live"
    Note over CS: 5. Clone Structural Tree:<br/>- Copy module indices<br/>- Lock question counts<br/>- Clear binary media URLs
    CS->>NEO: 6. Persist Child Node:<br/>Create HAS_VARIANT edge
    NEO-->>CS: Save OK
    CS-->>GW: 7. Return 200 OK<br/>#123; childCourseId, status #125;
    GW-->>UI: 8. Render Child Tree Workbench<br/>(Display Locked Structure)
```

## 3. Stage 2: Curation, CQF Verification & Independent Review

### 3.1 State Transition Diagram (Language Variant FSM)

Each language variant follows its own lifecycle without impacting the base course or sibling translations.

```mermaid
flowchart TD
    A["BASE COURSE (EN)<br/>Permanent Status: #quot;Live#quot;"]
    subgraph LC["CHILD VARIANT LIFECYCLE (HINDI)"]
        B["Draft"]
        C["In-Review<br/>(Unified Tab View -<br/>KB-10914)"]
        D{" "}
        E["Approved<br/>(Ready for Publish)"]
        F["Live<br/>(compatibilityLvl=5)"]
        B -->|"Creator clicks<br/>#quot;Submit for Review#quot;"| C
        C -->|"Reviewer evaluates<br/>(CQF Bypassed - KB-11055)"| D
        D -->|"Reject/<br/>Reviewer Rejects:<br/>Localized feedback<br/>logged in DB"| B
        D -->|"Approve"| E
        E -->|"Publisher clicks<br/>#quot;Publish#quot;"| F
    end
    A --> B
```

### 3.2 Sequence Diagram: Unified Review & CQF Inheritance

Reviewers inspect translations in a single interface while CQF validation is bypassed for non-base variants ([KB-10914: Q8 | Multilingual Content Creation | Reviewer/Publisher View – Unified Review Experience](https://karmayogibharat.atlassian.net/browse/KB-10914) (Open), [KB-11055: Q8 | Multilingual Content Creation | CQF Behavior for New Languages](https://karmayogibharat.atlassian.net/browse/KB-11055) (Open)).

```mermaid
sequenceDiagram
    participant RW as Reviewer Workbench
    participant RS as Review Service
    participant CS as Content Service
    participant PG as PostgreSQL / Audit
    RW->>RS: 1. Open Review Workspace
    RS->>CS: 2. Fetch Multi-Lang Tabs
    CS-->>RS: Return #91;Base, Child-1#93;
    RS-->>RW: 3. Render Tabs:<br/>#91;English: Live#93;<br/>#91;Hindi: In-Review#93;
    RW->>RS: 4. Click "Hindi" Tab
    Note over RS: 5. Evaluate CQF Check:<br/>Check if parent != null<br/>Result: TRUE -> SKIP CQF<br/>Set cqf = "INHERITED"
    RS-->>RW: 6. Render Localized Content<br/>(CQF form hidden/passed)
    RW->>RS: 7. Action: #91;Approve Hindi#93;
    RS->>CS: 8. Update Child Status:<br/>Set status = "Approved"
    CS->>PG: 9. Record Review Audit
    CS-->>RS: 10. Emit Notification Event<br/>"Hindi variant ready"
    RS-->>RW: 11. Display Success Message
```

## 4. Stage 3: Publishing & Batch Isolation Architecture

### 4.1 Batch Isolation Decision Tree

This decision tree illustrates how the platform handles batch configuration between base courses and child language variants ([KB-9893: Q8 | Multilingual Content Creation | Publisher Flow](https://karmayogibharat.atlassian.net/browse/KB-9893) (Prod Deployed)).

```mermaid
flowchart TD
    A["SPV Publisher triggers Course Publishing Action"]
    B{"Is this Course<br/>a Child Language<br/>Variant?"}
    C["BASE COURSE PUBLISHING<br/>1. Validate Base Hierarchy<br/>2. Set compatibilityLevel=4<br/>3. Create Default Open Batch<br/>in Sunbird Course Service<br/>4. Generate Batch ID:<br/>e.g., #quot;013976923455...#quot;<br/>5. Index in Elasticsearch<br/>as Primary Search Root<br/>6. Status = #quot;Live#quot;"]
    D["CHILD VARIANT PUBLISHING<br/>1. Validate Parent Base is<br/>currently #quot;Live#quot;<br/>2. Set compatibilityLevel=5<br/>3. STRICT RULE:<br/>DO NOT create a batch<br/>for this child variant<br/>4. Append Variant Info to<br/>Parent's #quot;variants#quot; array<br/>5. Re-index Parent Document<br/>in Elasticsearch<br/>6. Status = #quot;Live#quot;"]
    A --> B
    B -->|"No"| C
    B -->|"Yes"| D
```

## 5. Stage 4: Learner Discovery & Language Selection

### 5.1 Search Aggregation & Single Card Flow

Shows how Elasticsearch composite search rolls multilingual variants into a single UI card ([KB-9510: Q8 | Multilingual Content Creation | Learner Portal | Multiple language visibility on course cards and TOC page](https://karmayogibharat.atlassian.net/browse/KB-9510) (Prod Deployed)).

```mermaid
sequenceDiagram
    participant FE as Learner Portal Frontend
    participant SM as Search Microservice
    participant ES as Elasticsearch (composite-search)
    FE->>SM: 1. Query: "Ethics" OR "नैतिकता"
    SM->>ES: 2. Multi-Match Query:<br/>Search 'name', 'description',<br/>and 'variants.*.name'
    ES-->>SM: 3. Return Parent Documents<br/>including nested variants
    Note over SM: 4. Parse Response:<br/>Parent DO_ID: do_11001<br/>Variants: #91;"hindi", "kannada"#93;
    SM-->>FE: 5. Render Single Course Card:<br/>"Ethics in Governance"<br/>Badge: "Available in 3 langs"
    FE->>SM: 6. User clicks language badge
    Note over FE: 7. Display Selection Dialog:<br/>- English (Original)<br/>- हिंदी (Hindi)<br/>- ಕನ್ನಡ (Kannada)
    Note over FE: 8. User picks preferred language
```

## 6. Stage 5: Language Auto-Enrollment V2 (`cb-ext` to Sunbird)

### 6.1 Complete Sequence Diagram: AutoEnroll V2

Maps the two-tier microservice execution from client interaction through Cassandra write operations (Confluence Page `445349895`).

```mermaid
sequenceDiagram
    participant LC as Learner Client
    participant GW as cb-ext Gateway
    participant CS as Sunbird Course-Service
    participant CA as Cassandra (user_courses)
    LC->>GW: 1. Click "Enroll Course"<br/>User selects "Hindi"
    LC->>GW: 2. GET /autoenrollment/#123;id#125;<br/>Header: language: hindi<br/>Header: wid: user_123
    Note over GW: 3. Fetch Course Hierarchy<br/>Resolve base DO_ID
    Note over GW: 4. Check Parent Batch:<br/>Find open active batch
    Note over GW: 5. Map Language Target:<br/>Match 'hindi' -> child_id
    GW->>CA: 6. Check Idempotency:<br/>Query existing enrollment
    CA-->>GW: Record found? No
    GW->>CS: 7. POST /api/course/v2/enrol<br/>#123; userId: "user_123",<br/>courseId: child_id,<br/>batchId: parent_batch,<br/>language: "hindi" #125;
    Note over CS: 8. Validate Open Batch
    CS->>CA: 9. Insert Record:<br/>userId, courseId,<br/>batchId, language
    CA-->>CS: Write SUCCESS
    CS-->>GW: 10. HTTP 200 OK Response
    GW-->>LC: 11. Response: SUCCESS<br/>#123; targetCourseId #125;
    Note over LC: 12. Navigate to Hindi Player
```

## 7. Stage 6: Learner Consumption & In-Player Language Switching

### 7.1 Language Switching Logic Flowchart

This flowchart defines the behavioral contract and warning prompts when a user changes language mid-course ([KB-9511: Q8 | Multilingual Content Creation | Course Consumption](https://karmayogibharat.atlassian.net/browse/KB-9511) (Prod Deployed)).

```mermaid
flowchart TD
    A["Learner is consuming course in Language A<br/>Current progress recorded in Cassandra: 45%"]
    B["Learner clicks Player Language Dropdown<br/>Selects Language B"]
    C["Intercept switch and trigger Warning Modal:<br/>#quot;Switching the language will reset your<br/>progress in this view. Course restarts at<br/>0% in selected language. Continue?#quot;"]
    D{"User Confirms<br/>Switch?"}
    E["Dismiss Modal#59;<br/>Resume Language A"]
    F["Retain Language A progress (45%) in DB<br/>Query DB for existing Language B progress"]
    G{"Has prior<br/>progress in<br/>Language B?"}
    H["Initialize Language B at 0%<br/>Load start of Module 1<br/>Record events under Lang B"]
    I["Display Resume Prompt:<br/>#quot;Continue where you left<br/>off in Language B at 20%?#quot;"]
    J["Resume exact module offset<br/>in Language B"]
    A --> B --> C --> D
    D -->|"No"| E
    D -->|"Yes"| F
    F --> G
    G -->|"No"| H
    G -->|"Yes (e.g., 20%)"| I
    I --> J
```

## 8. Stage 7: Assessment Execution & Question Locking

### 8.1 Assessment Validation Sequence

Ensures assessment parity across all language adaptations ([KB-11053: Q8 | Multilingual Content Creation | Assessment Settings and Behavior During Edit](https://karmayogibharat.atlassian.net/browse/KB-11053) (Prod Deployed)).

```mermaid
sequenceDiagram
    participant LC as Learner Client
    participant AS as Assessment Service
    participant CE as Content Engine
    participant CP as Cassandra Progress
    LC->>AS: 1. Launch Assessment Unit<br/>Language: "hindi"
    AS->>CE: 2. Load Assessment Schema
    CE-->>AS: 3. Enforce Parity Guard:<br/>Assert:<br/>Child Question Count ==<br/>Base Question Count
    AS-->>LC: 4. Deliver Localized QTI Form<br/>(Identical Question Count)
    LC->>AS: 5. Submit Answers (10/10)
    Note over AS: 6. Auto-Evaluate Score
    AS->>CP: 7. Emit ASSESSMENT Event<br/>tagged with:<br/>language: "hindi"
    AS-->>LC: 8. Return Result: 100% Passed
```

## 9. Stage 8: Course Completion, Dynamic Certificate & Isolated Ratings

### 9.1 Sequence Diagram: First-Completion Certificate Locking

Illustrates how the localized title is injected and locked to the first language completed ([KB-9542: Q8 | Multilingual Content Creation | Certificate Generation](https://karmayogibharat.atlassian.net/browse/KB-9542) (Prod Deployed)).

```mermaid
sequenceDiagram
    participant LA as Learner Activity
    participant FL as Flink Streaming Engine
    participant RC as Certificate Service (RC)
    participant CA as Cassandra (user_courses)
    LA->>FL: 1. Reaches 100% Completion<br/>in Hindi Variant
    FL->>RC: 2. Ingest Completion Event:<br/>#123; userId, baseId,<br/>lang: "hindi" #125;
    RC->>CA: 3. Check existing certs:<br/>Query issued_certificates
    CA-->>RC: Result: Empty (First)
    Note over RC: 4. Lock First-Completion:<br/>Target Language = HINDI
    Note over RC: 5. Fetch Hindi Title:<br/>"शासन में नैतिकता"
    Note over RC: 6. Render Certificate PDF:<br/>Inject Localized Title
    RC->>CA: 7. Store Issued Certificate:<br/>Update user_courses row
    CA-->>RC:
    RC-->>FL: 8. Certificate Generated
    FL-->>LA: 9. Download Certificate<br/>(Shows Hindi Course Title)
    Note over LA,CA: SUBSEQUENT COMPLETION
    LA->>FL: 10. Learner completes 100% in<br/>English version later
    FL->>RC: 11. Ingest Completion Event<br/>#123; lang: "english" #125;
    Note over RC: 12. Check existing certs:<br/>Found certificate record
    Note over RC: 13. Certificate LOCKED:<br/>DO NOT alter or reissue<br/>title remains HINDI
```

### 9.2 Rating Gating Decision Flowchart

The rating interface unlocks only after achieving 50% consumption in that language variant ([KB-9543: Q8 | Multilingual Content Creation | Separate rating for separate languages](https://karmayogibharat.atlassian.net/browse/KB-9543) (Open)).

```mermaid
flowchart TD
    A["Learner clicks #quot;Rate Course#quot; in active Language View"]
    B["Rating Microservice queries Cassandra consumption<br/>for: (userId, current_variant_do_id, active_language)"]
    C{"Is Progress<br/>>= 50% in this<br/>Language?"}
    D["Gating Lock Triggered:<br/>Disable Rating Form<br/>Display: #quot;You must complete<br/>at least 50% of the course<br/>in this language to rate.#quot;"]
    E["Gating Check Passed:<br/>Render 1-5 Star Input &<br/>Textual Review Area"]
    F["Learner submits Review"]
    G["Save in PostgreSQL:<br/>course_language_ratings<br/>Tagged with active language#59;<br/>Isolated from other variants"]
    A --> B --> C
    C -->|"No"| D
    C -->|"Yes"| E
    E --> F --> G
```

## 10. Technical Architecture & Cross-Component Data Mapping

### 10.1 Component Data Flow Diagram

This architectural diagram outlines data transformation across storage engines throughout the lifecycle.

```mermaid
flowchart TD
    subgraph ARCH["MULTILINGUAL STORAGE & PIPELINE ARCHITECTURE"]
        direction TB
        subgraph P1["CREATION & SKELETAL CLONING"]
            A1["Base Course (English)"]
            A2["Child Variant (Hindi)"]
            A3["Neo4j Knowledge Graph & PostgreSQL<br/>• (Course: do_11001)-[:HAS_VARIANT {compatibilityLevel: 5}]->(Variant: do_11002)<br/>• Locked attributes: requestId, competencies_v3, sectors, questionCounts"]
            A1 -->|"(Clone Hierarchy)"| A2
            A1 --> A3
            A2 --> A3
        end
        subgraph P2["PUBLISHING & SEARCH INDEXING"]
            B1["Elasticsearch Cluster (composite-search index)<br/>Document Root: Parent Course DO_ID<br/>Nested Object: #quot;variants#quot;: { #quot;hindi#quot;: { #quot;identifier#quot;: #quot;do_11002#quot;, #quot;status#quot;: #quot;Live#quot;} }<br/>Presentation: Single Card with #quot;Available in 2 languages#quot; badge"]
        end
        subgraph P3["AUTO-ENROLLMENT V2"]
            C1["Learner requests #quot;hindi#quot;"]
            C2["cb-ext Gateway"]
            C3["Sunbird Course Service"]
            C4["Cassandra Storage: sunbird.user_courses<br/>Partition Key: ((userid), courseid, batchid)<br/>Record: { enrolled_language: #quot;hindi#quot;, batchid: #quot;013976...#quot; (Parent Batch) }"]
            C1 --> C2 --> C3 --> C4
        end
        subgraph P4["CONSUMPTION & STATE ISOLATION"]
            D1["Learner switches between English and Hindi"]
            D2["Cassandra Storage: sunbird.user_content_consumption<br/>Clustering Key: (batchid, contentid, language)<br/>• Row 1: (..., content_01, #quot;english#quot;) -> progress: 50%<br/>• Row 2: (..., content_01, #quot;hindi#quot;) -> progress: 100%"]
            D1 --> D2
        end
        subgraph P5["COMPLETION & FEEDBACK"]
            E1["100% Milestone Reached"]
            E2["Sunbird-RC & PostgreSQL<br/>• issued_certificates: Course title locked to #quot;शासन में नैतिकता#quot; (Hindi First)<br/>• course_language_ratings: Hindi rating stored independently with 50% check guard"]
            E1 --> E2
        end
        A3 --> B1
        B1 --> C1
        C4 --> D1
        D2 --> E1
    end
```

## 11. Requirement-to-Diagram Traceability Matrix

| Requirement / Jira ID | Technical Capability Enforced | Primary Section Diagram Reference | Traceability & Enforced Behavior |
|---|---|---|---|
| [KB-9470: Q8 \| Multilingual content creation \| Course Language Selection](https://karmayogibharat.atlassian.net/browse/KB-9470) (Prod Deployed) | Mandatory Base Language Selection | Section 2.1 Creation Flowchart | Enforces initial base language modal before drafting can proceed. |
| [KB-9471: Q8 \| Multilingual content creation \| Module Template Consistency and Teacher's Notes](https://karmayogibharat.atlassian.net/browse/KB-9471) (Prod Deployed) | Module Skeletal Replication | Section 2.2 Sequence Diagram | Clones structural graph; disables structural additions in child. |
| [KB-9473: Q8 \| Multilingual content creation \| Review Process Management](https://karmayogibharat.atlassian.net/browse/KB-9473) (Prod Deployed) / [KB-9494: Q8 \| Multilingual content creation \| Content Review](https://karmayogibharat.atlassian.net/browse/KB-9494) (Prod Deployed) | Independent Review Workflow | Section 3.1 Variant Lifecycle FSM | Isolates approve/reject transitions per language variant. |
| [KB-10914: Q8 \| Multilingual Content Creation \| Reviewer/Publisher View – Unified Review Experience](https://karmayogibharat.atlassian.net/browse/KB-10914) (Open) | Unified Reviewer Workspace | Section 3.2 Sequence Diagram | Renders single window with language tabs for content inspection. |
| [KB-11053: Q8 \| Multilingual Content Creation \| Assessment Settings and Behavior During Edit](https://karmayogibharat.atlassian.net/browse/KB-11053) (Prod Deployed) | Assessment Structural Parity | Section 8.1 Assessment Flowchart | Question count locked to base; question and option texts localizable. |
| [KB-11055: Q8 \| Multilingual Content Creation \| CQF Behavior for New Languages](https://karmayogibharat.atlassian.net/browse/KB-11055) (Open) | CQF Inheritance Bypass | Section 3.2 Sequence Diagram | CQF enforced exclusively on base; automatically bypassed on children. |
| [KB-9893: Q8 \| Multilingual Content Creation \| Publisher Flow](https://karmayogibharat.atlassian.net/browse/KB-9893) (Prod Deployed) | Single-Batch Publisher Rule | Section 4.1 Decision Tree | Disallows batch generation on child variants (`compatibilityLevel = 5`). |
| [KB-9510: Q8 \| Multilingual Content Creation \| Learner Portal \| Multiple language visibility on course cards and TOC page](https://karmayogibharat.atlassian.net/browse/KB-9510) (Prod Deployed) | Single Card Catalog Footprint | Section 5.1 Search Sequence | Consolidates search results with an `"Available in X languages"` badge. |
| **Page 445349895** | AutoEnroll V2 Microservice API | Section 6.1 AutoEnroll Sequence | Orchestrates `cb-ext` language resolution into parent batch. |
| [KB-9511: Q8 \| Multilingual Content Creation \| Course Consumption](https://karmayogibharat.atlassian.net/browse/KB-9511) (Prod Deployed) | In-Player Switching Warning | Section 7.1 Consumption Flowchart | Triggers progress reset warning modal; isolates historic progress in DB. |
| [KB-9542: Q8 \| Multilingual Content Creation \| Certificate Generation](https://karmayogibharat.atlassian.net/browse/KB-9542) (Prod Deployed) | First-Completion Certificate Title | Section 9.1 Certificate Sequence | Injects dynamic localized title corresponding to first 100% completion. |
| [KB-9543: Q8 \| Multilingual Content Creation \| Separate rating for separate languages](https://karmayogibharat.atlassian.net/browse/KB-9543) (Open) | 50% Consumption Rating Gating | Section 9.2 Rating Flowchart | Unlocks rating form only after consumption in that language. |
| [KB-12918: Q11 \| Multilingual ACBP/CBP in AI CBP tool](https://karmayogibharat.atlassian.net/browse/KB-12918) (In-Progress) | AI CBP Multilingual Indic Plan | Section 1 Master Flowchart | Integrates Bhashini pipeline for Indic ACBP plan export (PDF delivered). |
