# Amrit Gyan Kosh (AGK) — Software Requirements Specification (SRS)

## 1. Introduction & Objectives

### 1.1 Purpose

The purpose of this Summary SRS is to provide a unified, testable specification of the functional, non-functional, and business rules governing the **Amrit Gyan Kosh (AGK)** module. It formalizes the creation, governance, categorization, discovery, and consumption of **Case Studies** and **Knowledge Resources** across the iGOT Karmayogi ecosystem.

### 1.2 Scope & Boundaries

- **In Scope:**
  - **CBP Portal (Authoring):** Addition of "Case Study" as a primary content type; 5-stage creation lifecycle; multi-dimensional metadata tagging (Year, SDGs, State/UT); upload and association of instructional materials ("Teacher’s Notes" / `referenceNodes`); role-based restriction on "Karmayogi Talks"; decoupling of case studies from generic resource creation.
  - **Learner Portal (Consumption - Web & Mobile):** Rebranding of Gyaan Karmayogi to Amrit Gyaan Kosh; dedicated Hub experience with dual content tabs ("AGK Case Studies" and "Other Resources"); multi-facet filtering; Table of Contents (TOC) layout; certificate-free consumption with Karma point allocation.
  - **Public Consumption:** Non-logged-in access and download capability for universities, research bodies, and external institutions.
  - **Multilingual Expansion:** Base-language CQF validation, metadata inheritance, and localized adaptation of titles, descriptions, and instructional notes.

- **Out of Scope:**
  - Automated machine translation services (all translations are curated by content creators).
  - Issuance of course-style completion certificates for standalone Case Studies.

### 1.3 Target Actors & Roles

| Actor / Role | Description & Primary Permissions |
|---|---|
| **CBP Content** **Creator** | Creates and curates Case Studies, configures metadata, and uploads Teacher’s Notes PDFs in the CBP Portal. |
| **CBC / KB Creator** | Specialized creator affiliated with the Competency Building Commission (CBC) or Karmayogi Bharat (KB); exclusively authorized to create "Karmayogi Talks". |
| **CBP Reviewer / Publisher** | Validates Case Study quality, verifies Content Quality Framework (CQF) compliance, and approves content for publication. |
| **Learner (Authenticated)** | Enrolls in and consumes Case Studies, accesses reference materials, and receives platform Karma points. |
| **Mentor** | Evaluates or guides learners using instructional Teacher’s Notes linked to Case Studies. |
| **Public / Anonymous User** | Unauthenticated user accessing published AGK resources and Teacher’s Notes via public portal routes. |

## 2. Functional Requirements (FR)

### 2.1 Content Authoring & Creation (CBP Portal)

#### `AGK-FR-001`: Primary Category "Case Study"

- **Source:** SRS §6.1.1; Jira [KB-7213: Q6 | Amrit Gyaan Kosh l Add New Category "Case Study"](https://karmayogibharat.atlassian.net/browse/KB-7213)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-7213)
- **Description:** The CBP Portal shall display "Case Study" as a primary top-level content option under `My Content > Create New`, alongside Course, Program, Assessment, and Resource.
- **Preconditions:** User is logged in with `Content Creator` role.
- **Expected Outcome:** Selecting "Case Study" initializes a dedicated case study creation entity with `primaryCategory = "Case Study"`.

#### `AGK-FR-002`: 5-Stage Case Study Creation Lifecycle

- **Source:** SRS §6.1.2; Jira [KB-7215: Q6 | Amrit Gyaan Kosh l Case Study Creation Flow](https://karmayogibharat.atlassian.net/browse/KB-7215)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-7215)
- **Description:** The system shall guide creators through a sequential 5-step workflow:
  - *Case Study Details* (Name, Description, Subtitle, Thumbnail, Category)
  - *Case Study Settings* (Metadata Tagging, Teacher’s Notes, Licensing, Access Setting)
  - *Case Study Quality* (Content Quality Framework - CQF checklist)
  - *Self-Curation* (Creator verification of completeness)
  - *Summary & Submission* (Review and dispatch to Publisher)

- **Validation:** Transition to review requires completion of all mandatory fields across stages.

#### `AGK-FR-003`: Decoupling from Generic Resources

- **Source:** SRS §6.1.6; Jira [KB-7216: Q6 | Amrit Gyaan Kosh l Modification to Existing Resources - Remove Case Study Creation Flow](https://karmayogibharat.atlassian.net/browse/KB-7216)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-7216)
- **Description:** The system shall remove "Case Study" as an option under generic Resource creation (`Resource (PDF)` / `Resource (Link)`), enforcing that all Case Studies originate exclusively through the dedicated workflow.

#### `AGK-FR-004`: Enhanced Metadata Tagging

- **Source:** SRS §6.1.3; Jira [KB-7217: Q6 | Amrit Gyaan Kosh l Enhanced Metadata Tagging](https://karmayogibharat.atlassian.net/browse/KB-7217)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-7217); Tech Doc `TES/221675560`
- **Description:** Under the Case Study Settings tab, the system shall provide multi-select metadata fields:
  - **Year** (`contextYear`): Dropdown populated with years from `2000` to `current year` (non-mandatory, multiple selections allowed).
  - **SDGs** (`contextSDGs`): Dropdown populated with the 17 UN Sustainable Development Goals retrieved from system settings (non-mandatory, multiple selections allowed).
  - **State/UTs** (`contextStateOrUTs`): Dropdown populated with 36 States/UTs plus "Pan India" retrieved from system settings (non-mandatory, multiple selections allowed).

- **Storage:** Values shall be stored in collection and content metadata arrays.

#### `AGK-FR-005`: Teacher’s Section & Instructional Assets (`referenceNodes`)

- **Source:** SRS §6.1.4; Jira [KB-7220: Q6 | Amrit Gyaan Kosh l Teacher’s Section in Case Studies](https://karmayogibharat.atlassian.net/browse/KB-7220)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-7220); Tech Doc `TES/221675560`
- **Description:** The Case Study Settings tab shall feature a "Teacher's Section" located above the Stakeholders section. Creators can upload one or more PDF documents representing instructional guides or pedagogical frameworks.
- **Storage:** Attached PDFs shall be stored as child reference resources within the `referenceNodes` array of the parent case study collection.

#### `AGK-FR-006`: Governance & Karmayogi Talks Restrictions

- **Source:** SRS §6.1.5; Jira [KB-7221: Q6 | Amrit Gyaan Kosh l Restriction on Karmayogi Talks Creation](https://karmayogibharat.atlassian.net/browse/KB-7221)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-7221)
- **Description:** The system shall restrict the creation of "Karmayogi Talks" resources exclusively to content creators affiliated with **Competency Building Commission (CBC)** or **Karmayogi Bharat (KB)** root organizations. Creators from other MDOs shall have this category hidden or disabled.

### 2.2 Discovery & Learner Consumption (Learner Portal)

#### `AGK-FR-007`: Rebranded Hub Navigation

- **Source:** SRS §6.2.1; Jira [KB-7212: Q6 | Amrit Gyaan Kosh l Rename Gyaan Karmayogi to Amrit Gyaan Kosh](https://karmayogibharat.atlassian.net/browse/KB-7212)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-7212)
- **Description:** The Learner Portal navigation shall display "Amrit Gyaan Kosh" in the top navigation bar, replacing the legacy "Gyaan Karmayogi" label across Web and Mobile applications.

#### `AGK-FR-008`: AGK Hub Page & Multi-Facet Filtering

- **Source:** SRS §6.2.2; Jira [https://karmayogibharat.atlassian.net/browse/KB-7279](https://karmayogibharat.atlassian.net/browse/KB-7279)[Can't find link](https://karmayogibharat.atlassian.net/browse/KB-7279)
- **Description:** The AGK landing page shall provide:
  - Dual primary tabs: **AGK Case Studies** and **Other Resources**.
  - Curated content strips (e.g., "Recently Added", "CBC Curated").
  - Multi-facet filtering panel supporting: *Year*, *SDGs*, *States and UTs*, *Sectors*, and *Subsectors*.
  - Search results updating dynamically based on selected facets.

#### `AGK-FR-009`: Consumption Experience & Karma Point Attribution

- **Source:** SRS §6.2.3; Jira [KB-7219: Q6 | Amrit Gyaan Kosh l Case Study Accessibility & Certificates](https://karmayogibharat.atlassian.net/browse/KB-7219)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-7219)
- **Description:**
  - Case Studies shall be consumed within the standard player interface.
  - Standalone Case Studies **shall not issue course completion certificates**.
  - Upon 100% completion of all contents in a Case Study, the system shall attribute **Karma points** to the learner's profile via the platform gamification pipeline.

#### `AGK-FR-010`: Table of Contents (TOC) & Teacher’s Note Download

- **Source:** SRS §6.2.2; Jira [KB-10201: Q8 | Ad-Hoc | Updating the TOC experience of standalone resource/Amrit gyan kosh](https://karmayogibharat.atlassian.net/browse/KB-10201)[Prod Deployed](https://karmayogibharat.atlassian.net/browse/KB-10201), [KB-7384: Q6 | Amrit Gyan Kosh l Teacher's note tab in TOC page](https://karmayogibharat.atlassian.net/browse/KB-7384)[Done](https://karmayogibharat.atlassian.net/browse/KB-7384)
- **Description:** The Case Study TOC page shall contain tabs for *About*, *Content*, and *Teacher's Notes*. Authorized users can view and download attached instructional PDF assets individually or collectively.

#### `AGK-FR-011`: Public & Unauthenticated Consumption

- **Source:** Jira [KB-10525: Q10 | Ad-Hoc | AGK for public](https://karmayogibharat.atlassian.net/browse/KB-10525)[KB Review](https://karmayogibharat.atlassian.net/browse/KB-10525), [KB-10526: Q10 | Ad-Hoc | AGK creation check](https://karmayogibharat.atlassian.net/browse/KB-10526)[QA Deployed](https://karmayogibharat.atlassian.net/browse/KB-10526), [KB-10527: Q10 | Ad-Hoc | AGK consumption by non-logged users](https://karmayogibharat.atlassian.net/browse/KB-10527)[QA Deployed](https://karmayogibharat.atlassian.net/browse/KB-10527); QA Signoff `KQAS/651591687`
- **Description:** Case Studies flagged as public during creation (`isPublic = true`) shall be accessible to non-logged-in users. The system shall bypass mandatory login and enrollment checks, allowing direct consumption of case study content and reference assets.

### 2.3 Multilingual Authoring & Curation

#### `AGK-FR-012`: Base-Language Lockdown & CQF Inheritance

- **Source:** Multilingual SRS `TES/480575492` §3.3.1; Jira [KB-12738: Q11 | Feature Enhancements | Multi-Lingual AGK](https://karmayogibharat.atlassian.net/browse/KB-12738) (Open), [KB-12740: Q11 | Feature Enhancements | Multi-Lingual AGK](https://karmayogibharat.atlassian.net/browse/KB-12740) (Open)
- **Description:**
  - Creators author and publish the Case Study in a **Base Language** (e.g., English) first.
  - Content Quality Framework (CQF) validation occurs strictly at the Base Language review stage.
  - Subsequent multilingual variants (e.g., Hindi, Tamil) **inherit CQF approval** and do not trigger re-evaluation.
  - Core classification metadata (`contextYear`, `contextSDGs`, `contextStateOrUTs`, `resourceCategory`) is **immutable** across secondary language versions.
  - Translatable fields are strictly confined to `name` (Title), `description`, `referenceNodes` (localized PDFs), and localized media assets.

## 3. Business Rules (BR)

| Rule ID | Rule Name | Description |
|---|---|---|
| **AGK-BR-001** | **Exclusive Talks Creation** | Only users belonging to `Competency Building Commission` or `Karmayogi Bharat` can create resources under the category "Karmayogi Talks". |
| **AGK-BR-002** | **Zero-Certificate Rule** | No completion certificate shall be generated or attached to Case Study entities upon completion. Progress state transitions directly to `Completed` with Karma points. |
| **AGK-BR-003** | **Structural Metadata Immutability** | Once published in the Base Language, metadata attributes (`contextSDGs`, `contextYear`, `contextStateOrUTs`) cannot differ across language variants. |
| **AGK-BR-004** | **Decoupled Category Enforcement** | Case Studies cannot be created as sub-elements or attachments within standard learning resources; they must use the dedicated collection model. |
| **AGK-BR-005** | **Public Access Whitelist** | Non-logged-in access is permitted only when `isPublic = true` or `accessSetting = "allUsers"`. Restricted/MDO-specific case studies require authenticated SSO. |

## 4. Non-Functional Requirements (NFR)

- **Performance** (`AGK-NFR-001`): Average response time for Hub loading and search queries shall remain within **3 to 5 seconds** under normal load conditions (SRS §9.2).
- **Scalability & Concurrency** (`AGK-NFR-002`): System shall accommodate **25,000 concurrent active users** in the Production environment, with an 80/20 distribution between core transactions (browsing, consumption) and secondary workflows (SRS §9.5).
- **Security & Compliance** (`AGK-NFR-003`): System components shall adhere to the **OWASP Top 10** guidelines. Network traffic must use HTTPS/TLS 1.3. User role permissions must be strictly verified on all proxy and backend mutation endpoints (SRS §9.3).
- **High Availability & Recovery** (`AGK-NFR-004`): Recovery Time Objective (RTO) shall be **8 hours** for core production services (SRS §9.4).
- **Cross-Platform Compatibility** (`AGK-NFR-005`):
  - Web: Chrome 118+, Firefox 122+, Edge (Evergreen).
  - Mobile: Android 13+ (Flutter), iOS 17+.
