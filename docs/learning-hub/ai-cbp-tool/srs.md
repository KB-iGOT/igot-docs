# AI CBP Tool — Software Requirement Specification (SRS)

Functional requirements, validation rules, interfaces, quality attributes and acceptance criteria

| Document control | Value |
|---|---|
| Version | 0.1 — Draft for review |
| Date | 2026-10-14 |
| System | CBP-AI Tool |
| Basis | AI CBP Tool — How to Use Guide summarized in project context; feature context diagrams; validation/API flow discussions; related SDD v0.1 |
| Intended audience | Product owner, MDO/SPV stakeholders, business analysts, engineering, QA, security and operations |

**Document status.** This is a requirements baseline, not a statement that every feature is already implemented. Requirements marked “Proposed” or based on illustrative endpoints must be confirmed with stakeholders and the existing POC before acceptance.

## Document conventions and status

- Requirement IDs are stable identifiers intended for traceability to design, implementation and test cases.
- “Shall” means mandatory within the stated scope; “Should” is recommended; “TBD” requires a decision.
- The feature names and operational rules preserve the project’s CBP-AI workflow terminology.
- This document separates source-derived workflow constraints from proposed product/engineering requirements.

## Contents

- 1. Introduction
- 2. Overall description
- 3. User classes and permissions
- 4. Functional requirements
- 5. Business rules and validation matrix
- 6. External interface requirements
- 7. Data requirements
- 8. Non-functional requirements
- 9. Error handling and audit requirements
- 10. Acceptance criteria and test scenarios
- 11. Assumptions, dependencies and open questions
- Appendix A. Requirements traceability

## 1. Introduction

### 1.1 Purpose

This SRS specifies the expected behavior and quality requirements for the CBP-AI Tool. It is intended to align stakeholders and the delivery team on what the product must do before the existing POC is productionized with live data and released as a controlled MVP.

### 1.2 Product scope

The system supports authenticated users in selecting an organization context, managing source documents, generating and editing AI-assisted CBPs, mapping roles/designations and competencies, obtaining course recommendations, managing approval workflows, and exporting/finalizing outputs. Administrative workflows include hierarchy maintenance and designation request decisions.

### 1.3 Intended use

- MDO/department users prepare and manage CBP information and related role mappings.
- Authorized MDO leaders/approvers review submitted mapping requests.
- SPV administrators review new designation requests.
- System administrators manage access and monitor the service.
- Learner-facing course access is included only if confirmed in the MVP scope.

### 1.4 Definitions and abbreviations

| Term | Meaning / use in this SRS |
|---|---|
| CBP | Term used by the source workflow; official expansion should be confirmed by the product owner. |
| MDO | Ministry/Department organization or authorized MDO user, as applicable in the workflow. |
| SPV Admin | Administrator responsible for designation-request decisions in the workflow. |
| KCM | Competency alignment/master reference named in the workflow guide; exact authoritative system and API contract to be confirmed. |
| iGOT | External source for relevant organization, designation, competency and course master data where integrations are available. |
| POC | Existing proof of concept that must be inspected to confirm actual routes, schemas and behavior. |
| RBAC | Role-based access control. |
| LLM | Large language model used for AI-assisted processing. |

## 2. Overall description

### 2.1 Product perspective

The product is a web application with a frontend and a backend service (the related SDD proposes FastAPI). It relies on a persistent data store, document/object storage, AI processing and external master-data integrations. The exact technologies and integration availability must be confirmed against the POC and deployment decisions.

### 2.2 Product capabilities

- Authenticate users and enforce role- and organization-scoped access.
- Select a ministry/department context and manage documents.
- Validate source files and generate an initial AI-assisted CBP draft.
- Resolve unmatched roles and manage designation hierarchy and designation requests.
- Edit CBP data and align competencies with the relevant master reference.
- Generate and review course recommendations.
- Submit, review, track and where permitted revoke approval requests.
- View/download course lists, combined CBP/course outputs, localized outputs and finalized CBPs.
- Provide administrative functions, notifications, status, audit history and operational visibility.

### 2.3 MVP boundary

The project direction is to productionize the existing POC and launch a limited MVP. The initial geography, pilot organization(s), user volumes, exact included roles, learner-facing functionality and feature rollout sequence remain product decisions. The SRS covers the 18 workflow features to preserve traceability, but not all need be enabled in the first release.

### 2.4 Constraints

- Only official/public/text-searchable PDFs are identified by the source workflow guidance; acceptance of scanned PDFs and OCR support require confirmation.
- The document workflow specifies a maximum of 10 PDFs and less than 25 MB per PDF.
- A Work Allocation Order is mandatory before initial CBP generation.
- AI-generated drafts and course recommendations require human review.
- Submitted role mappings are locked while approval is pending.
- Approval requires a Training Plan and target completion date where specified by the source workflow; exact applicability should be confirmed.
- A rejection of a designation request requires a reason.
- Actual iGOT API availability and contracts are dependencies, not assumed facts.

## 3. User classes and permissions

| User class | Expected responsibilities | Access requirements |
|---|---|---|
| MDO / department user | Select context, upload documents, generate/edit CBP, map roles, request designations, request approvals, view/download outputs | Access only authorized organizations and permitted records |
| MDO leader / approver | Review mapping requests and approve/reject/return where workflow permits | Decision permissions scoped by organization and assigned approval role |
| SPV administrator | Review designation requests and approve/reject; maintain relevant master/hierarchy data where authorized | Privileged functions limited to designated SPV admins |
| Learner / employee | View recommended courses or learning resources if included | Read-only or learning-specific permissions; MVP inclusion TBD |
| System administrator | Manage users/roles, monitor service health, review operational logs/reports and settings | Privileged access; sensitive actions audited |

The exact role names, permission matrix, delegation rules and organization-scope model must be approved before production.

## 4. Functional requirements

Each requirement is independently testable. Requirements are grouped by feature. Unless stated otherwise, the system shall provide clear status and validation feedback and shall not silently discard user data on failure.

### 4.1 Authentication and platform access

| ID | Requirement |
|---|---|
| FR-AUTH-001 | The system shall allow an authorized user to authenticate using the configured identity mechanism. |
| FR-AUTH-002 | The system shall resolve the authenticated user’s role(s) and organization scope before granting access to protected features. |
| FR-AUTH-003 | The system shall reject invalid, expired or inactive sessions and provide a safe user-facing error. |
| FR-AUTH-004 | The system shall prevent access to records and actions outside the user’s assigned permissions and organization scope. |

### 4.2 Ministry / department context

| ID | Requirement |
|---|---|
| FR-ORG-001 | The system shall present the ministry/department options the user is authorized to access. |
| FR-ORG-002 | The system shall validate that a selected department belongs to the selected ministry/organization. |
| FR-ORG-003 | The system shall retain the selected organization context for subsequent requests and revalidate authorization server-side. |

### 4.3 Document management and validation

| ID | Requirement |
|---|---|
| FR-DOC-001 | The system shall allow authorized users to upload, list and manage source documents for a CBP workflow. |
| FR-DOC-002 | The system shall accept only the approved document formats; the source workflow identifies official/public, text-searchable PDFs. |
| FR-DOC-003 | The system shall reject a PDF that is 25 MB or larger, unless the product owner explicitly changes this source rule. |
| FR-DOC-004 | The system shall not allow more than 10 PDFs in the applicable document set. |
| FR-DOC-005 | The system shall require a Work Allocation Order before initial CBP generation. |
| FR-DOC-006 | The system shall validate file readability/text extraction and report files that cannot be processed. |
| FR-DOC-007 | The system shall record document metadata, processing status and storage reference without exposing private storage credentials. |

### 4.4 Initial CBP generation

| ID | Requirement |
|---|---|
| FR-CBP-001 | The system shall allow an authorized user to request an initial CBP draft from eligible source documents. |
| FR-CBP-002 | The system shall block or defer generation when mandatory documents or file validations are not satisfied. |
| FR-CBP-003 | The system shall preserve the source references used to generate a draft. |
| FR-CBP-004 | The system shall validate AI output against the expected structure before saving it as a draft. |
| FR-CBP-005 | The system shall identify AI-generated content as a draft requiring human review. |
| FR-CBP-006 | The system shall expose generation status and a safe failure reason when processing fails. |

### 4.5 Unmatched role mapping

| ID | Requirement |
|---|---|
| FR-ROLE-001 | The system shall show roles that could not be matched to the designation master. |
| FR-ROLE-002 | The system shall allow an authorized user to search the designation master and assign a valid designation. |
| FR-ROLE-003 | The system shall retain unmatched entries as unresolved rather than silently assigning an unsupported designation. |
| FR-ROLE-004 | The system shall record mapping status, the selected designation and relevant reviewer/audit metadata. |

### 4.6 New designation requests

| ID | Requirement |
|---|---|
| FR-DES-001 | The system shall allow an authorized user to submit a request for a designation not found in the master. |
| FR-DES-002 | The system shall check for an existing/duplicate designation before creating a request. |
| FR-DES-003 | The system shall route submitted designation requests to the authorized SPV review role. |
| FR-DES-004 | The system shall record the decision, decision timestamp and rejection reason when rejected. |
| FR-DES-005 | The system shall notify the requester of the decision or make the status available in the application. |

### 4.7 Designation hierarchy

| ID | Requirement |
|---|---|
| FR-HIER-001 | The system shall display the designation hierarchy available to the user’s authorized scope. |
| FR-HIER-002 | The system shall validate parent-child references before saving hierarchy changes. |
| FR-HIER-003 | The system shall reject circular hierarchy relationships. |
| FR-HIER-004 | The system shall record who changed the hierarchy and when. |

### 4.8 Add designation from master

| ID | Requirement |
|---|---|
| FR-MASTER-001 | The system shall allow authorized users to search and select a designation from the available master. |
| FR-MASTER-002 | The system shall validate the selected designation identifier and required attributes. |
| FR-MASTER-003 | The system shall prevent duplicate addition of the same designation to the relevant working set. |

### 4.9 Edit CBP and competency alignment

| ID | Requirement |
|---|---|
| FR-EDIT-001 | The system shall allow authorized users to view and edit a CBP draft. |
| FR-EDIT-002 | The system shall validate required fields and referenced competency identifiers before saving. |
| FR-EDIT-003 | The system shall support versioning or concurrency protection so one user does not silently overwrite another user’s edits. |
| FR-EDIT-004 | The system shall support competency alignment checks against the applicable KCM/master reference. |
| FR-EDIT-005 | The system shall retain a distinction between AI-generated content and human-reviewed changes where practicable. |

### 4.10 Course recommendations

| ID | Requirement |
|---|---|
| FR-COURSE-001 | The system shall generate course recommendations using available role, competency-gap and course-catalogue data. |
| FR-COURSE-002 | The system shall validate that the required role/competency inputs are available before recommendation generation. |
| FR-COURSE-003 | The system shall return course identifiers and available catalogue metadata for each recommendation. |
| FR-COURSE-004 | The system shall apply supported filters/eligibility rules and shall not fabricate catalogue courses when data is unavailable. |
| FR-COURSE-005 | The system shall mark recommendations as requiring review before they are treated as final. |

### 4.11 Submit role mappings for approval

| ID | Requirement |
|---|---|
| FR-APP-001 | The system shall allow authorized users to submit complete role mappings for approval. |
| FR-APP-002 | The system shall validate the submitter’s permission and mapping completeness. |
| FR-APP-003 | The system shall create an approval task and expose its status. |
| FR-APP-004 | The system shall prevent edits to submitted mappings while the approval is pending, according to the source workflow. |
| FR-APP-005 | The system shall notify the designated approver or expose an actionable pending task. |

### 4.12 Track and revoke approval requests

| ID | Requirement |
|---|---|
| FR-TRACK-001 | The system shall show the status and history of approval requests visible to the current user. |
| FR-TRACK-002 | The system shall allow revocation only when the request is in a state that permits revocation. |
| FR-TRACK-003 | The system shall record revocation actor, timestamp and reason where required. |
| FR-TRACK-004 | The system shall retain an audit history of request state transitions. |

### 4.13 View and download course list

| ID | Requirement |
|---|---|
| FR-CLIST-001 | The system shall display course-list data available from the connected catalogue or approved data store. |
| FR-CLIST-002 | The system shall allow an authorized user to download/export the displayed course list in the approved format. |
| FR-CLIST-003 | The system shall report when catalogue data is unavailable or stale according to the configured freshness policy. |

### 4.14 Combined CBP and course export

| ID | Requirement |
|---|---|
| FR-EXPORT-001 | The system shall create a combined output containing the applicable CBP and associated course list. |
| FR-EXPORT-002 | The system shall validate that required CBP and course data are available before export. |
| FR-EXPORT-003 | The system shall provide a secure download mechanism and enforce record-level authorization. |

### 4.15 Multiple-language output

| ID | Requirement |
|---|---|
| FR-LANG-001 | The system shall display the supported output languages configured for the product. |
| FR-LANG-002 | The system shall generate a localized CBP only for a supported target language. |
| FR-LANG-003 | The system shall preserve mandatory fields and document structure in localized output. |
| FR-LANG-004 | The system shall identify translated content as requiring review before official use. |

### 4.16 Finalize and download CBP

| ID | Requirement |
|---|---|
| FR-FINAL-001 | The system shall validate finalization prerequisites before finalizing a CBP. |
| FR-FINAL-002 | The system shall prevent finalization while required reviews, approvals or mandatory data are incomplete. |
| FR-FINAL-003 | The system shall create an identifiable final version and prevent accidental mutation of that version. |
| FR-FINAL-004 | The system shall allow authorized users to download the finalized CBP. |

### 4.17 MDO leader mapping review

| ID | Requirement |
|---|---|
| FR-MDO-REV-001 | The system shall show pending role-mapping requests to authorized MDO reviewers. |
| FR-MDO-REV-002 | The system shall display the mapping information and supporting data needed for review. |
| FR-MDO-REV-003 | The system shall allow an authorized reviewer to approve, reject or return a request where those decisions are supported by policy. |
| FR-MDO-REV-004 | The system shall validate required Training Plan and target completion date fields where applicable under the workflow. |
| FR-MDO-REV-005 | The system shall record reviewer identity, decision, timestamp and comments. |

### 4.18 SPV designation review

| ID | Requirement |
|---|---|
| FR-SPV-001 | The system shall show submitted designation requests to authorized SPV administrators. |
| FR-SPV-002 | The system shall validate request completeness and check for duplicate designations before approval. |
| FR-SPV-003 | The system shall require a rejection reason when a request is rejected. |
| FR-SPV-004 | The system shall record the decision and notify the requester or expose the updated status. |

### 4.19 Notifications, administration and audit

| ID | Requirement |
|---|---|
| FR-CROSS-001 | The system shall provide status notifications for relevant approval and designation-request events through the configured notification channel. |
| FR-CROSS-002 | A notification delivery failure shall not silently undo a successfully persisted business decision. |
| FR-CROSS-003 | The system shall provide authorized administrators with user/role management and system health/status functions within the approved scope. |
| FR-CROSS-004 | The system shall audit consequential actions including uploads, edits, mapping changes, approvals, rejections, revocations, finalization, exports and administrative changes. |
| FR-CROSS-005 | The system shall provide a correlation identifier for troubleshooting each API request or background operation. |

## 5. Business rules and validation matrix

| ID | Rule / validation | Expected behavior on NO | Source/status |
|---|---|---|---|
| BR-001 | File is an allowed PDF and is readable/text-searchable | Reject file or mark unprocessable with clear reason | Workflow guidance; confirm scanned-PDF/OCR policy |
| BR-002 | Each PDF is less than 25 MB | Reject upload | Workflow guidance |
| BR-003 | Document set contains no more than 10 PDFs | Reject additional upload or require user to remove files | Workflow guidance; confirm whether limit is per CBP or upload batch |
| BR-004 | Work Allocation Order is present before initial CBP generation | Block generation and identify missing requirement | Workflow guidance |
| BR-005 | AI-generated CBP structure passes schema validation | Retry safely if appropriate; otherwise retain source and show failure | Proposed engineering control |
| BR-006 | Designation exists in authoritative master for normal mapping | Keep role unmatched or route to new designation request | Workflow guidance |
| BR-007 | KCM/competency references align with valid master data | Flag/block invalid references based on policy; show correction path | Workflow guidance; exact KCM contract TBD |
| BR-008 | Course recommendations correspond to available catalogue records and supported filters | Do not invent courses; return no-results/dependency status | Workflow guidance + proposed control |
| BR-009 | Mappings are complete and submitter authorized | Do not create approval task; retain editable state | Proposed control |
| BR-010 | Mappings submitted for approval are locked while pending | Reject edit attempt and show current status | Workflow guidance |
| BR-011 | Training Plan and target completion date are present where required | Block submission/decision as applicable and identify missing fields | Workflow guidance; applicability TBD |
| BR-012 | Reviewer is authorized and request transition is valid | Reject decision; audit denied attempt where appropriate | Proposed control |
| BR-013 | Designation request is not duplicate and contains required fields | Reject or return for correction | Workflow guidance + proposed control |
| BR-014 | Designation rejection includes a reason | Prevent rejection submission until reason is provided | Workflow guidance |
| BR-015 | Finalization prerequisites are satisfied | Keep CBP in non-final state and list missing prerequisites | Proposed control |
| BR-016 | User has permission to access requested record/export | Deny access without disclosing restricted data | Proposed security requirement |

## 6. External interface requirements

### 6.1 User interface

- The UI shall show progress/status for document processing, CBP generation, recommendations, approvals and exports.
- The UI shall display field-level validation errors and explain how the user can correct them.
- The UI shall distinguish draft, pending approval, approved, rejected and finalized states.
- The UI shall disable or clearly block actions that are not allowed in the current state while the server remains the authoritative validator.
- The UI shall provide accessible labels, keyboard navigation and readable status/error messages.

### 6.2 Software interfaces

| Interface | Requirements |
|---|---|
| Identity provider | Use configured identity/session mechanism; exact OIDC/SSO or application login contract TBD. |
| iGOT organization/designation/competency/course APIs | Use documented endpoints, approved credentials, typed response validation, timeouts and clear dependency status. |
| Gemini LLM | Use approved model/configuration; constrain output to expected schema; handle rate limits/timeouts; retain minimal provenance and usage metadata. |
| PostgreSQL / pgvector | Persist transactional entities and audit data; use vector features only if required by the actual retrieval design. |
| Object storage (Local/GCS or selected provider) | Store originals and exports privately; authorize downloads; record checksum and metadata. |
| Email/notification service | Send workflow notifications; track attempts and retry transient failures. |

### 6.3 Proposed API interface catalogue

The paths below are illustrative logical operations and are not verified against the existing POC. Actual HTTP methods, names, payloads, response schemas and authentication requirements must be established from the repository and integration specifications.

| Feature area | Illustrative operations |
|---|---|
| Authentication/profile | POST /api/v1/auth/login; GET /api/v1/user/profile; POST /api/v1/token/refresh |
| Organization context | GET /api/v1/orgs; GET /api/v1/departments; POST /api/v1/context |
| Documents | POST /api/v1/documents; GET /api/v1/documents; DELETE /api/v1/documents/{id} |
| CBP | POST /api/v1/cbp/generate; GET /api/v1/cbp/{id}; PUT /api/v1/cbp/{id}; POST /api/v1/cbp/{id}/finalize |
| Role mapping/designations | GET /api/v1/role-mapping/unmatched; PUT /api/v1/role-mapping/{id}; GET /api/v1/designations; POST /api/v1/designation/requests |
| Hierarchy/competencies | GET /api/v1/hierarchy; PUT /api/v1/hierarchy; GET /api/v1/competencies |
| Courses | GET /api/v1/courses; GET /api/v1/courses/recommend; GET /api/v1/courses/export |
| Approvals | POST /api/v1/role-mapping/submit; GET /api/v1/approvals; PUT /api/v1/approvals/{id}/decision; POST /api/v1/approvals/{id}/revoke |
| Designation decisions | GET /api/v1/designation/requests; PUT /api/v1/designation/requests/{id}/decision |
| Exports/localization | GET /api/v1/cbp/{id}/download; POST /api/v1/cbp/{id}/translate; GET /api/v1/exports/{id} |
| Operations | GET /api/v1/health; GET /api/v1/metrics (restricted) |

## 7. Data requirements

The following data groups are required conceptually. This is not a final database schema; field definitions, retention and normalization should be agreed during detailed design.

| Data group | Minimum information / requirement |
|---|---|
| Users and permissions | Identity reference, active status, roles, organization scope and permission grants |
| Organization context | Ministry/department identifiers, parent-child relationship and source/sync metadata |
| Source documents | Owner, organization, file name, type, size, checksum, storage reference, document type, processing status |
| CBP and versions | CBP identifier, organization, owner, version, structured content, status, source documents, created/updated metadata |
| Role mappings | Source role text, designation reference, match/unmatched status, reviewer and timestamps |
| Competencies | Master identifier, name/metadata, source and sync timestamp; references from CBP versions |
| Course catalogue/recommendations | External course ID, title/URL/availability metadata, rank/rationale and recommendation review status |
| Approval workflows | Request type, requester, approver, items, status, decision, comments/reason and timestamps |
| Designation requests | Proposed designation details, requester, duplicate-check result, decision and rejection reason |
| Exports/localizations | CBP version, language, format, storage reference, checksum, status and expiry/retention metadata |
| Audit/integration events | Actor/action/entity, timestamp, request ID, provider operation, status, duration and safe error code |

### 7.1 Data quality and retention

- The system shall preserve traceability between a generated CBP and its source documents.
- The system shall distinguish generated drafts from reviewed/approved/final versions.
- The system shall record state changes and the actor responsible for consequential actions.
- The product owner shall define retention/deletion rules for source documents, generated artifacts, exports and audit records before production.
- The system shall avoid storing credentials or unnecessary sensitive document contents in logs.

## 8. Non-functional requirements

| ID | Requirement | Priority/status |
|---|---|---|
| NFR-SEC-001 | The system shall enforce authentication and server-side authorization on all protected operations. | Mandatory |
| NFR-SEC-002 | The system shall restrict records by organization scope and prevent insecure direct-object access. | Mandatory |
| NFR-SEC-003 | The system shall protect secrets and avoid exposing tokens, keys or raw provider errors to clients. | Mandatory |
| NFR-SEC-004 | The system shall protect data in transit using HTTPS in production and enable encryption at rest for managed persistence/storage. | Target for production |
| NFR-SEC-005 | The system shall validate uploaded file type, size and processing outcome before use. | Mandatory |
| NFR-REL-001 | The system shall handle external timeouts/rate limits with bounded retries where safe and clear failure states. | Mandatory |
| NFR-REL-002 | Retrying a create/submit operation shall not create duplicate approval tasks or designation requests when an idempotency mechanism is supported. | Proposed |
| NFR-OBS-001 | The system shall emit structured logs with a request/correlation ID for diagnosability. | Mandatory |
| NFR-OBS-002 | The system shall expose health/readiness checks to authorized monitoring. | Proposed |
| NFR-MNT-001 | The system should isolate provider-specific integration logic behind adapters. | Recommended |
| NFR-MNT-002 | The system shall maintain automated tests for business validation and workflow state transitions. | Mandatory |
| NFR-PERF-001 | The team shall define and approve response-time targets for interactive APIs and long-running AI/export jobs before production acceptance. | TBD |
| NFR-SCALE-001 | The deployment shall be capable of scaling API and long-running processing independently if workload requires it. | Proposed |
| NFR-REC-001 | The team shall define recovery-point and recovery-time objectives and test restore procedures before production launch. | TBD |
| NFR-USE-001 | The UI shall provide understandable validation messages, progress indication and current workflow status. | Mandatory |
| NFR-AI-001 | The system shall validate AI outputs and require human review before official finalization. | Mandatory |
| NFR-AI-002 | The system should record model/prompt version and relevant source references for AI-generated outputs where practicable. | Recommended |

## 9. Error handling, notifications and audit

### 9.1 Error response requirements

- Errors shall provide a stable machine-readable code and a safe human-readable message.
- Validation errors should identify the field or rule that failed where disclosure is safe.
- Errors shall include a request/correlation identifier where the request reached the application.
- Internal stack traces, secrets, prompts, tokens and private provider response details shall not be shown to end users.
- Long-running operations shall expose their state and a safe failure reason.

| Error class | Example | Expected system response |
|---|---|---|
| Validation | Unsupported PDF, file too large, missing Work Allocation Order | Reject request; explain correction |
| Authentication/authorization | Expired session, wrong role, wrong organization | Return unauthorized/forbidden response; do not expose restricted record data |
| Business state | Edit while mapping pending, invalid approval transition | Reject transition and return current state |
| Integration | iGOT unavailable, LLM rate limit, email outage | Apply safe retry/degradation; preserve persisted state |
| Processing | PDF extraction or export failure | Mark job failed; preserve source; allow safe retry where possible |
| Unexpected | Database or unhandled application error | Return generic error; log and alert |

### 9.2 Audit requirements

- Audit records shall cover uploads, CBP generation/editing, mapping changes, submission, approval/rejection/revocation, designation decisions, finalization, exports and privileged administration.
- Audit records should include actor, action, entity, timestamp, outcome and request ID; before/after values should be limited to what is necessary and permitted.
- Audit access shall be restricted to authorized roles.

## 10. Acceptance criteria and test scenarios

The following acceptance scenarios provide a baseline for QA/UAT. Final test data and exact role permissions must be agreed before sign-off.

| ID | Scenario | Expected result |
|---|---|---|
| AC-01 | Valid user logs in | User identity and permissions resolve; protected UI is accessible. |
| AC-02 | User attempts unauthorized organization access | Server denies access; no restricted data is returned. |
| AC-03 | User uploads a PDF below 25 MB and within the 10-file limit | File is validated and stored with metadata/status. |
| AC-04 | User uploads a file ≥25 MB, unsupported type, unreadable PDF or 11th PDF | Upload is rejected with a clear reason. |
| AC-05 | User requests CBP generation without Work Allocation Order | Generation is blocked and missing prerequisite is identified. |
| AC-06 | Valid source documents are processed | A structured draft is generated or a clear processing failure is shown; draft is not treated as final. |
| AC-07 | AI returns malformed/unexpected structure | Output is not saved as a valid draft without validation; safe failure/retry is recorded. |
| AC-08 | A role cannot be matched to master designation | It remains flagged as unmatched until resolved or routed to a request. |
| AC-09 | User submits role mappings for approval | Task is created and submitted mappings become locked while pending. |
| AC-10 | User attempts to edit pending mapping | Edit is rejected and pending status is displayed. |
| AC-11 | Unauthorized user tries to approve a request | Decision is denied and recorded as appropriate. |
| AC-12 | SPV rejects designation request without reason | Rejection is blocked until reason is supplied. |
| AC-13 | Course catalogue is unavailable | System shows dependency/no-results status and does not fabricate courses. |
| AC-14 | User finalizes CBP with unmet prerequisites | Finalization is blocked and unmet prerequisites are listed. |
| AC-15 | Notification provider fails after a decision is saved | Decision remains persisted; notification failure is visible/retryable. |
| AC-16 | User downloads another organization’s export | Access is denied. |
| AC-17 | External API times out | Request/job ends in a clear state; bounded retries do not duplicate business records. |
| AC-18 | Audit reviewer checks a consequential decision | Actor, timestamp, decision and request reference are available to authorized reviewers. |

## 11. Assumptions, dependencies and open questions

| ID | Open question / assumption | Owner / action |
|---|---|---|
| OQ-01 | What does CBP officially expand to, and are there required document templates? | Product owner to confirm |
| OQ-02 | Which features are mandatory in MVP, and are learner-facing features included? | Product owner / stakeholders |
| OQ-03 | Which ministries/departments and user volumes are in pilot scope? | Product owner / delivery lead |
| OQ-04 | What identity provider and login/session pattern does the POC use? | Engineering / security |
| OQ-05 | What are the real iGOT endpoints, auth, quotas, data freshness and sandbox access? | Integration owner |
| OQ-06 | What is the authoritative KCM/competency master and exact alignment rule? | Business owner / integration owner |
| OQ-07 | Does “text-searchable PDF” mean scanned PDFs are rejected, or should OCR be supported? | Product owner |
| OQ-08 | Is the 10-PDF limit per upload batch, per CBP, or per workflow? | Product owner |
| OQ-09 | Does the 25 MB limit mean strictly less than 25 MB? This SRS follows that reading. | Product owner |
| OQ-10 | When exactly are Training Plan and target completion date mandatory? | Approval-process owner |
| OQ-11 | What approval states, delegation, revoke rules and re-submission paths are allowed? | Process owner |
| OQ-12 | Which languages and export formats are officially supported? | Product owner |
| OQ-13 | What are retention, data residency and AI-provider data handling requirements? | Security/privacy/legal |
| OQ-14 | What are response-time, availability, RPO/RTO and pilot capacity targets? | Product owner / operations |
| OQ-15 | Which proposed API endpoints map to actual POC routes? | Engineering; inspect repository |
| OQ-16 | Which storage, queue/worker, monitoring and deployment platforms are selected? | Architecture / DevOps |

## Appendix A. Requirements traceability

| Workflow / feature | Requirement IDs | Primary acceptance coverage |
|---|---|---|
| Login and platform access | FR-AUTH-001–004; NFR-SEC-001–003 | AC-01, AC-02 |
| Organization selection | FR-ORG-001–003; NFR-SEC-002 | AC-02 |
| Document management | FR-DOC-001–007; BR-001–004 | AC-03–05 |
| Initial CBP generation | FR-CBP-001–006; BR-005 | AC-05–07 |
| Role mapping / designation master | FR-ROLE-001–004; FR-MASTER-001–003; BR-006 | AC-08 |
| Designation requests and hierarchy | FR-DES-001–005; FR-HIER-001–004; FR-SPV-001–004 | AC-12 |
| CBP editing / competency alignment | FR-EDIT-001–005; BR-007 | AC-06, AC-14 |
| Course recommendations and lists | FR-COURSE-001–005; FR-CLIST-001–003; BR-008 | AC-13 |
| Approval submit / review / tracking | FR-APP-001–005; FR-TRACK-001–004; FR-MDO-REV-001–005 | AC-09–11, AC-18 |
| Exports / localization / finalization | FR-EXPORT-001–003; FR-LANG-001–004; FR-FINAL-001–004 | AC-14, AC-16 |
| Notifications / administration / audit | FR-CROSS-001–005; NFR-OBS-001–002 | AC-15, AC-18 |

## Appendix B. Sign-off

| Role | Name | Decision / comments | Date |
|---|---|---|---|
| Product owner |  |  |  |
| Business / process owner |  |  |  |
| Solution architect |  |  |  |
| Engineering lead |  |  |  |
| QA lead |  |  |  |
| Security / operations |  |  |  |

*End of document*
