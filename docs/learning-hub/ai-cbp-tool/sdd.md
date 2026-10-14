# AI CBP Tool — Software Design Document (SDD)

Feature-level architecture, interfaces, validation, data, security and deployment design

| Document control | Value |
|---|---|
| Version | 0.1 — Draft for review |
| Date | 2026-10-14 |
| System | CBP-AI Tool |
| Basis | Feature Context Diagrams, validation/API flow discussions, and AI CBP Tool — How to Use Guide as summarized in the project context |
| Audience | Product owner, solution architect, backend/frontend engineers, QA, DevOps and security reviewers |

**Important scope note.** This SDD is a design baseline, not a verified description of the running POC. Component boundaries and API paths below are proposed unless explicitly confirmed in the existing implementation. Validate routes, schemas, auth middleware, database tables, cloud services and integration contracts before implementation.

## Document status and conventions

- Status: Draft / Proposed design.
- “Must” indicates a design requirement derived from the workflow guidance; “should” indicates a recommended engineering practice.
- API endpoints are illustrative REST examples. They are not confirmed production routes.
- The term CBP is retained from the source workflow and should be expanded according to the program’s official terminology.

## Contents

- 1. Purpose and objectives
- 2. Scope and feature inventory
- 3. Architecture overview
- 4. Actors and external systems
- 5. Component design
- 6. End-to-end workflows and validation gates
- 7. API and integration design
- 8. Data design
- 9. Security and access control
- 10. Error handling and observability
- 11. Non-functional requirements
- 12. Deployment and environment design
- 13. Testing strategy
- 14. Risks, assumptions and open decisions
- Appendix A. Feature/API mapping
- Appendix B. Release readiness checklist

## 1. Purpose and objectives

This Software Design Document describes a proposed software design for the CBP-AI Tool. It converts the feature-level context diagrams into a technical baseline that can guide productionization of the existing proof of concept (POC), with live integrations replacing dummy data.

The tool supports users who manage relevant documents, generate and edit CBPs, map roles/designations and competencies, obtain course recommendations, submit approvals, and export/finalize CBP outputs. Administrative workflows cover hierarchy and designation management, review decisions, system monitoring and reporting.

### 1.1 Design objectives

- Separate the web UI, API/application services, AI processing, external integrations and persistence.
- Make validation and approval rules explicit, observable and testable.
- Replace mock data through controlled integration adapters rather than embedding external API assumptions throughout the application.
- Preserve traceability for generated drafts, human edits, approval decisions, and exported files.
- Support a small initial production rollout while allowing future scale-out.

## 2. Scope and feature inventory

| # | Feature | Primary capability |
|---|---|---|
| 1 | Login to platform | Authenticate users and resolve roles/permissions |
| 2 | Select ministry / department | Set authorized organization context |
| 3 | Manage relevant documents | Upload, list and delete source files; track metadata |
| 4 | Generate initial CBP draft | Extract source content and create AI-assisted draft |
| 5 | Manage unmatched role mapping | Resolve roles not matched to the designation master |
| 6 | Request new designation | Submit request for a designation not in master |
| 7 | Manage designation hierarchy | View/update hierarchy with integrity checks |
| 8 | Add designations from iGOT master | Search/select existing master designations |
| 9 | Edit the CBP | Edit draft sections and competency mappings |
| 10 | Generate course recommendations | Recommend catalogue courses for roles/competency gaps |
| 11 | Send role mappings for approval | Submit mappings into approval workflow |
| 12 | Track / revoke approval requests | Track status/history and revoke eligible requests |
| 13 | View / download course list | Display/export course catalogue results |
| 14 | Download combined CBP & courses | Create combined export |
| 15 | Download in multiple languages | Generate localized output |
| 16 | Finalize / download CBP | Validate readiness, finalize version and export |
| 17 | MDO admin / leader reviews mapping | Review submitted mappings and decide |
| 18 | SPV admin approves/rejects designation | Review designation requests and notify requester |
| Cross-cutting | System administration / reports | User administration, health, logs and analytics |

### 2.1 Out of scope for this draft

- Exact production API contracts, database DDL and UI wireframes; these require POC repository inspection.
- Guaranteed availability, latency or capacity targets; they must be agreed with product and operations.
- Final legal/privacy classification and retention period for uploaded government/organizational documents; policy owner confirmation is required.

## 3. Architecture overview

The proposed architecture is a layered web application. The browser UI calls a FastAPI service over HTTPS using JSON APIs. The service enforces identity, authorization, request validation, workflow rules and audit logging, then invokes domain services and adapters for persistence, AI, file storage and iGOT data.

| Layer | Responsibilities | Proposed implementation / boundary |
|---|---|---|
| Web UI | Login, dashboard, document workflows, CBP editor, role mapping, recommendations, approvals, exports, admin views | Existing frontend framework; confirm from POC |
| API edge | Routing, authentication, authorization, input validation, request IDs, rate limits and API error envelope | FastAPI routers / middleware |
| Application/domain services | CBP generation, document management, role mapping, hierarchy, competency gap analysis, course recommendations, approvals, exports | Python service modules with explicit interfaces |
| AI orchestration | Prompt templates, document context assembly, LLM calls, structured-output validation, retries and provenance | Gemini adapter; provider-specific details isolated |
| Integration adapters | iGOT organization/designation/competency/course APIs, email and object storage | Typed clients, timeouts, retries and contract tests |
| Persistence | Transactional records and vector retrieval where needed | PostgreSQL; pgvector only if semantic retrieval is required |
| File storage | Original uploads, generated exports and artifacts | Local storage for development; GCS/object storage for production |
| Operations | Logs, metrics, tracing, health checks, secrets and deployment configuration | Platform-specific tooling to be selected |

### 3.1 Logical system context

- Actors: MDO / department users, MDO leaders or approvers, SPV administrators, learners/employees if exposed by the product, and system administrators.
- External dependencies: iGOT organization/designation/competency/course APIs; Gemini LLM; object storage; email/notification provider; identity provider if external SSO is configured.
- Data stores: relational database for users, organizations, CBP versions, role mappings, approval workflow and audit events; object storage for documents and exports; pgvector only for embedding/vector-search use cases.

**Architecture decision.** Do not assume that all listed external services are already connected in the POC. Keep each dependency behind an adapter so it can be mocked in tests and replaced without changing domain logic.

## 4. Actors and external systems

| Actor / dependency | Purpose | Trust / failure considerations |
|---|---|---|
| MDO / department user | Uploads source documents, generates/edits CBP, maps roles, requests approvals, exports results | Must be restricted to assigned organization and permitted actions |
| MDO leader / approver | Reviews role mappings and makes approval decisions | Only authorized approvers may decide; decisions must be auditable |
| SPV administrator | Reviews designation requests and approves/rejects them | Rejection reason captured where required; duplicate checks against master |
| Learner / employee | May view course recommendations or learning resources if this role is in scope | Least-privilege read access; verify exact MVP audience |
| System administrator | Manages users/roles and views system health/logs/reports | Privileged actions require stronger controls and audit logging |
| iGOT APIs | Organization, designation, competency and course master data | Timeouts, rate limits, stale data, API version changes |
| Gemini / LLM | Document understanding, draft generation, matching and recommendation support | Treat output as untrusted; validate structure and require human review |
| Object storage | Original documents and generated files | Private access, encryption, malware scanning policy and retention |
| Email / notifications | Approval and status notifications | Notification failure must not silently roll back persisted workflow state |

## 5. Component design

| Component | Responsibilities |
|---|---|
| Authentication & User Management | Validate identity/session, resolve roles and organization scopes, enforce permissions. Prefer an established identity provider when available; do not implement password handling unless required. |
| Organization Context Service | Fetch/select ministry and department; validate that selected department belongs to ministry and the user can operate in that context. |
| Document Service | Validate upload count, file type, file size and mandatory Work Allocation Order; persist metadata and object location; manage status and deletion. |
| Document Processing Pipeline | Extract text from accepted PDFs, detect unreadable/scanned files, normalize text, capture extraction status and source references. OCR support is a separate decision. |
| CBP Generation Service | Prepare bounded document context, call AI adapter, validate structured output, store draft/version and return warnings and provenance. |
| Designation & Role Mapping Service | Search master designations, map roles, maintain unmatched queue, prevent duplicates and validate mapping rules. |
| Hierarchy Service | Read/update designation hierarchy; enforce parent-child integrity and reject cycles. |
| Competency / Gap Analysis Service | Resolve competency identifiers, compare role/CBP competencies with relevant KCM/master data and expose gaps for review. |
| Course Recommendation Service | Use approved competency/role inputs to query the course catalogue, apply filters/eligibility and return explainable recommendations. |
| Approval Workflow Service | Create tasks, track state transitions, enforce edit locks while pending, record decisions/reasons and publish notifications. |
| Export & Localization Service | Assemble CBP and course data, generate files, translate supported content where enabled, retain version/language metadata and store files. |
| Reporting & Admin Service | Provide scoped reports, health status, operational logs/metrics and user administration. |

### 5.1 Suggested module boundaries

| Module / package | Example contents |
|---|---|
| api/ | FastAPI app, routers, schemas, auth dependencies, error handlers |
| domain/ | Entities, enums, business rules and state transitions |
| services/ | Use cases/orchestration; no direct provider-specific API calls |
| repositories/ | Database persistence and query logic |
| integrations/igot/ | Organization, designation, competency and course clients |
| integrations/llm/ | Gemini client, prompt templates, output validators |
| integrations/storage/ | Object storage interface and providers |
| integrations/notifications/ | Email/notification adapter |
| workers/ | Long-running document extraction, generation and export tasks if asynchronous processing is required |
| tests/ | Unit, integration, API contract, security and end-to-end tests |

## 6. End-to-end workflows and validation gates

Every workflow should return a clear success or failure result and expose validation outcomes to the UI. The following gates translate the source workflow guidance into proposed implementation checks.

| Workflow | Gate / decision | YES path | NO path |
|---|---|---|---|
| Login | Credentials/session valid and account active? | Resolve roles and organization scope; issue/refresh session | Return generic authentication error; log security event |
| Organization context | Organization and department valid for user? | Save selected context | Reject selection; show allowed organizations |
| Document upload | PDF, readable, <25 MB, no more than 10 PDFs? | Store file and metadata; mark ready/pending extraction | Reject file with actionable reason |
| CBP generation | Mandatory Work Allocation Order present and processing successful? | Run extraction and AI draft generation | Block generation or mark processing failure; ask user to fix input |
| AI output | Output matches schema and required fields? | Persist draft and provenance; mark for human review | Retry safely where appropriate; otherwise return failure and keep source intact |
| Role mapping | Selected designation exists and mapping rules pass? | Save mapping | Keep item unmatched and explain issue |
| New designation | Duplicate absent and required fields complete? | Create request and route to SPV | Reject submission with field-level errors |
| Hierarchy update | Parent-child references valid and acyclic? | Persist new hierarchy/version | Reject update and report invalid relationship |
| Course recommendations | Role/competency input and catalogue data available? | Return filtered/ranked list with source metadata | Return no-results or dependency error; do not invent courses |
| Approval submit | Mappings complete and user authorized? | Create task, lock submitted mappings, notify approver | Reject submit; preserve editable state |
| Approval decision | Reviewer authorized and decision valid? | Persist decision, reason, timestamp and notify requester | Reject unauthorized/invalid transition |
| Finalize CBP | Required reviews/approvals and data complete? | Freeze final version and generate export | Keep draft status; list unmet prerequisites |
| Localization | Language supported and output structure valid? | Store localized artifact and review status | Return unsupported-language or generation error |

### 6.1 Workflow state recommendations

| Entity | Suggested states |
|---|---|
| Document | UPLOADED → VALIDATING → READY / REJECTED → PROCESSING → PROCESSED / FAILED → DELETED (soft-delete policy to confirm) |
| CBP draft | DRAFT → GENERATING → NEEDS_REVIEW → EDITED → SUBMITTED_FOR_APPROVAL → APPROVED / CHANGES_REQUESTED → FINALIZED |
| Role mapping | UNMATCHED → MAPPED → SUBMITTED → PENDING_APPROVAL → APPROVED / REJECTED / REVOKED |
| Designation request | DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED / CANCELLED |
| Export job | QUEUED → RUNNING → COMPLETED / FAILED → EXPIRED |

State names are proposals. The implementation should define permitted transitions centrally and enforce them transactionally rather than relying only on UI behavior.

## 7. API and integration design

Use versioned REST APIs (for example, /api/v1) with JSON request/response bodies, consistent error envelopes, pagination for collections, and request/correlation IDs. Long-running AI/document/export operations should return a job ID and status endpoint if they cannot reliably complete within the request timeout.

### 7.1 Illustrative endpoint catalogue

| Area | Method + path (illustrative) | Purpose |
|---|---|---|
| Authentication | POST /api/v1/auth/login | Authenticate / establish session, if application-managed |
| Profile | GET /api/v1/user/profile | Return current user, roles and scope |
| Organization | GET /api/v1/orgs; GET /api/v1/departments?orgId={id} | Read organization hierarchy |
| Context | POST /api/v1/context | Set active ministry / department context |
| Documents | POST /api/v1/documents; GET /api/v1/documents; DELETE /api/v1/documents/{id} | Upload and manage source documents |
| CBP | POST /api/v1/cbp/generate; GET /api/v1/cbp/{id}; PUT /api/v1/cbp/{id} | Generate/read/update CBP |
| CBP status | GET /api/v1/cbp/{id}/status | Read generation or finalization state |
| Designation | GET /api/v1/designations; POST /api/v1/designations | Search/select or add designation where permitted |
| Role mapping | GET /api/v1/role-mapping/unmatched; PUT /api/v1/role-mapping/{id}; POST /api/v1/role-mapping/submit | Manage and submit mappings |
| Hierarchy | GET /api/v1/hierarchy; PUT /api/v1/hierarchy; POST /api/v1/hierarchy/reorder | Read/update hierarchy |
| Competencies | GET /api/v1/competencies | Resolve competency master data |
| Courses | GET /api/v1/courses; GET /api/v1/courses/recommend; GET /api/v1/courses/export | Retrieve/recommend/export courses |
| Approvals | GET /api/v1/approvals; GET /api/v1/approvals/{id}; PUT /api/v1/approvals/{id}/decision; POST /api/v1/approvals/{id}/revoke | Track and decide approvals |
| Designation requests | POST /api/v1/designation/requests; GET /api/v1/designation/requests; PUT /api/v1/designation/requests/{id}/decision | Request and decide new designations |
| Exports | GET /api/v1/cbp/{id}/download; GET /api/v1/exports/{id} | Download completed artifacts |
| Localization | GET /api/v1/languages; POST /api/v1/cbp/{id}/translate | Create localized version |
| Admin/health | GET /api/v1/health; GET /api/v1/metrics | Health and metrics; restrict operational endpoints |

### 7.2 API response conventions

Success responses should return the resource or operation/job identifier, current state and relevant metadata. Errors should use a consistent structure such as:

| Field | Description |
|---|---|
| error.code | Stable machine-readable code, e.g. DOCUMENT_TOO_LARGE |
| error.message | Safe, user-readable explanation |
| error.details | Optional field-level validation errors; do not expose secrets |
| request_id | Correlation ID for support and log tracing |
| timestamp | UTC timestamp |

### 7.3 External integration safeguards

- Set explicit connection/read timeouts; use bounded retries with exponential backoff for transient failures.
- Use idempotency keys for retried operations that create requests, approval tasks or exports.
- Validate and normalize all external responses before storing or displaying them.
- Cache master data only with an explicit freshness policy and a way to refresh/invalidate it.
- Do not expose API keys, prompts containing sensitive source data, or raw provider errors to the browser.
- Record integration version, status, duration and correlation ID for troubleshooting.

## 8. Data design

The schema below is a conceptual model to be reconciled with the existing POC database. Normalize stable business entities and use explicit foreign keys and audit fields. Store large files in object storage rather than in database blobs.

| Entity / table (proposed) | Key fields / relationships |
|---|---|
| users | id, external_subject, display_name, email, status, created_at |
| roles / user_roles | role_id, user_id, organization_scope, permissions |
| organizations | id, external_org_id, name, parent_id, source, synced_at |
| documents | id, owner_id, organization_id, file_name, mime_type, size_bytes, storage_key, checksum, status, document_type |
| document_processing_runs | id, document_id, extractor_version, status, extracted_text_key, error_code, timestamps |
| cbp_records | id, organization_id, owner_id, title, current_version_id, status |
| cbp_versions | id, cbp_id, version_number, content_json, source_document_ids, ai_model, prompt_version, reviewer_id, created_at |
| designations | id, external_designation_id, name, parent_id, source, active |
| role_mappings | id, cbp_version_id, source_role_text, designation_id, status, confidence, reviewed_by |
| competencies | id, external_competency_id, name, source, synced_at |
| cbp_competencies | cbp_version_id, competency_id, source, review_status |
| courses | id, external_course_id, title, url, availability_status, metadata_json, synced_at |
| course_recommendations | id, cbp_version_id, course_id, rationale, rank, status, generated_at |
| approval_requests | id, request_type, requester_id, organization_id, status, submitted_at, decided_at |
| approval_items | id, approval_request_id, entity_type, entity_id, decision, comments |
| designation_requests | id, requester_id, proposed_designation, parent_id, status, rejection_reason |
| exports | id, cbp_version_id, language, format, storage_key, status, checksum, created_at, expires_at |
| audit_events | id, actor_id, action, entity_type, entity_id, before_after_summary, request_id, created_at |
| integration_runs | id, provider, operation, status, duration_ms, request_id, safe_error_code |

### 8.1 Data integrity and lifecycle

- Use transactions for workflow state transitions and related audit events.
- Apply unique constraints to external master identifiers and duplicate request keys where appropriate.
- Store timestamps in UTC and use explicit created_by / updated_by fields for mutable records.
- Use optimistic locking/version numbers for CBP editing to avoid overwriting concurrent changes.
- Define retention, archival and deletion policies for source documents and exports before production launch.
- Keep AI-generated content and human-reviewed/approved content distinguishable.

## 9. Security and access control

| Control area | Design requirement |
|---|---|
| Authentication | Use established SSO/OIDC or approved identity service if available; protect session/token lifecycle and refresh flows. |
| Authorization | Enforce RBAC plus organization-level scoping on every API, not only in UI navigation. |
| Least privilege | Separate MDO, approver, SPV admin, learner and system-admin permissions; restrict admin/report endpoints. |
| Transport/storage | HTTPS in transit; encryption at rest for database and object storage; private buckets/containers. |
| Secrets | Use a managed secret store/environment injection; never commit keys to source control or return them to clients. |
| File uploads | Validate MIME and file signature, size/count, filename/path safety and content processing outcome; consider malware scanning. |
| AI/LLM safety | Treat uploaded content and model output as untrusted; protect against prompt injection, data leakage and unsupported claims; constrain output schema. |
| Auditability | Record logins, uploads, edits, mapping changes, approvals/rejections, finalization, exports and admin actions. |
| Privacy | Minimize sensitive data sent to third-party AI services; confirm contractual, data residency and retention requirements. |
| Operational endpoints | Protect metrics, logs and admin functions; do not expose stack traces or internal service details. |

## 10. Error handling and observability

### 10.1 Error categories

| Category | Examples | Expected behavior |
|---|---|---|
| Input / validation | Invalid PDF, oversized file, missing Work Allocation Order, missing mandatory field | 4xx response with stable code and actionable correction |
| Authentication / authorization | Expired token, wrong role, organization scope mismatch | 401/403; avoid revealing restricted resource existence |
| Business state | Attempt to edit submitted mapping, invalid approval transition, finalize incomplete CBP | 409 or 422; return current state and unmet prerequisites |
| External dependency | iGOT timeout, catalogue unavailable, LLM rate limit, email provider failure | Bounded retry / graceful degradation; expose safe status |
| Processing | PDF extraction failure, malformed AI output, export generation failure | Mark operation failed; preserve inputs; allow safe retry |
| Unexpected system | Database outage, uncaught exception | Generic 500 response; structured server-side logs and alerting |

### 10.2 Logging and metrics

- Use structured logs with request_id, actor ID (or pseudonymous identifier), organization scope, feature, operation, status and duration.
- Never log passwords, bearer tokens, API keys, full document contents or unnecessary personal data.
- Track request rate, error rate, latency, queue depth, document processing time, AI usage/cost, external API failures and export failures.
- Provide liveness and readiness health checks; readiness should include critical dependency checks without leaking sensitive details.
- Create alerts for sustained error spikes, dependency failures, stuck jobs, storage exhaustion and unusual privileged activity.

## 11. Non-functional requirements

The following are proposed targets to confirm with product and operations before acceptance. They are not measured properties of the existing POC.

| Area | Proposed requirement / decision |
|---|---|
| Availability | Agree MVP service-hours and uptime target; document planned maintenance and dependency limitations. |
| Performance | Set target p95 latency for normal APIs; treat AI generation and exports as asynchronous if they exceed the API latency budget. |
| Scalability | Stateless API instances where practical; externalize session/state; scale workers separately from web/API. |
| Reliability | Timeouts, retries, idempotency and resumable job states for long-running operations. |
| Security | Complete threat model, access-control tests, dependency scanning and security review before production. |
| Maintainability | Typed schemas, modular adapters, API versioning, automated tests and documented configuration. |
| Accessibility/usability | Provide actionable validation messages, loading/progress state, and keyboard/screen-reader support appropriate to product needs. |
| Auditability | Trace all consequential workflow transitions and user decisions. |
| Recovery | Set RPO/RTO targets, test database restore and object-storage recovery. |
| Cost control | Track LLM token usage, external API usage, file storage and worker execution cost. |

## 12. Deployment and environment design

### 12.1 Environments

| Environment | Purpose | Rules |
|---|---|---|
| Local development | Fast iteration and automated tests | Use synthetic/test data and mock adapters; never copy production secrets |
| CI/test | Linting, unit/integration/contract tests and security scans | Reproducible build; ephemeral credentials |
| Staging/UAT | Validate live integration behavior and user acceptance | Production-like configuration; approved test data; external calls allow-listed |
| Production | Real users and live data | Managed secrets, TLS, monitoring, backups, least privilege and change control |

### 12.2 Proposed runtime topology

- Browser → HTTPS ingress/reverse proxy → FastAPI application.
- FastAPI → PostgreSQL for transactional data; pgvector extension only if semantic search is part of the implemented use case.
- FastAPI/workers → private object storage for uploads and exports.
- Workers (recommended for long-running tasks) → PDF extraction, LLM generation, translation and export generation.
- Integration adapters → iGOT APIs, Gemini API and notification provider using secrets injected at runtime.
- Centralized logs/metrics and alerting; automated database backups and documented restore procedures.

### 12.3 Configuration

Use environment-specific configuration for database URLs, provider endpoints, timeouts, feature flags, upload limits, allowed MIME types, maximum file count/size, model identifiers, prompt versions, storage buckets and email templates. Validate required configuration at startup and fail fast for missing production secrets.

## 13. Testing strategy

| Test level | Coverage examples | Acceptance evidence |
|---|---|---|
| Unit | Validators, role/permission rules, state transition rules, hierarchy cycle detection, file limits, course filtering | Automated test report; branch coverage target agreed by team |
| API integration | Request schemas, auth scopes, error envelopes, persistence and transactions | Contract tests and database integration test results |
| External contract | iGOT response schemas, Gemini structured output, storage and notification provider behavior | Mocks plus sandbox/live contract tests where available |
| Workflow end-to-end | Upload → generate → review/edit → mapping → approval → course list → final export | Repeatable scenarios for each role and negative paths |
| Security | IDOR/organization-scope tests, privilege escalation, upload abuse, secret leakage, injection handling | Security test report and resolved critical/high findings |
| Resilience | Timeouts, provider 429/5xx, DB outage, duplicate submissions, worker retry | Failure-injection evidence; no duplicate approvals/exports |
| UAT | MDO and SPV review of real workflows using approved test data | Signed acceptance criteria and defect disposition |

### 13.1 Minimum negative test cases

- Upload an unsupported file type, unreadable PDF, 25 MB-or-larger file, and an 11th PDF.
- Attempt CBP generation without the mandatory Work Allocation Order.
- Submit a role mapping with an unknown designation or invalid competency reference.
- Attempt to edit a mapping while approval is pending.
- Attempt approval as a user without reviewer permission.
- Reject a designation request without a reason.
- Finalize a CBP while required data or approvals are incomplete.
- Simulate iGOT/LLM/storage timeouts and retry the same request to verify idempotency.
- Attempt to access another organization’s CBP, documents, exports and reports.

## 14. Risks, assumptions and open decisions

| Item | Risk / uncertainty | Action required |
|---|---|---|
| Existing POC details | Actual framework modules, API routes, schemas and DB model have not been verified in this SDD | Inspect repository and produce route/schema inventory before finalizing design |
| iGOT integrations | API availability, auth, quotas, response schema and freshness are unknown | Obtain integration documentation, credentials and sandbox access |
| AI data governance | Uploaded documents may contain sensitive organizational information | Confirm approved model/provider, retention, region, and data-sharing policy |
| PDF extraction | Some PDFs may be scanned, encrypted or malformed | Decide whether OCR is required and define user-facing rejection behavior |
| Human review | AI output may be incomplete or incorrect | Require review before approval/finalization and retain provenance |
| Approval policy | Exact approver matrix and Training Plan / target completion date rules need confirmation | Document state-transition matrix with product/process owner |
| API examples | Endpoint names in context diagrams are illustrative | Align with existing routes or formally adopt a versioned API contract |
| Production hosting | Cloud/runtime, database hosting, queue and observability tools not confirmed | Select deployment platform and complete operational design |
| Data retention | Retention/deletion rules for source files, generated files and audit logs not confirmed | Obtain policy/legal approval and implement lifecycle jobs |
| MVP audience | Learner-facing functions and exact admin responsibilities may vary | Confirm roles and feature access for initial release |

## 15. Recommended implementation sequence

1. Baseline the existing POC: inventory routes, schemas, data models, authentication, dependencies and current tests.
2. Define the MVP feature boundary, roles, organization scope and acceptance criteria.
3. Create typed API contracts and central validation/state-transition modules.
4. Productionize document storage and PDF processing; enforce upload and mandatory-document rules.
5. Integrate iGOT master APIs through adapters and add contract tests.
6. Integrate AI generation with structured output validation, versioned prompts, provenance and human-review gates.
7. Implement role mapping, designation requests and approval workflows with audit events and notification retries.
8. Implement course recommendations and exports; make long-running operations observable and retryable.
9. Add security controls, logging/metrics, backups, CI/CD and staging/UAT.
10. Run end-to-end, failure-path and security tests; pilot with a limited authorized user group before wider rollout.

## Appendix A. Feature/API mapping

| Feature # | Main service | Illustrative APIs |
|---|---|---|
| 1 | Authentication | POST /auth/login; GET /user/profile; POST /token/refresh |
| 2 | Organization Context | GET /orgs; GET /departments; POST /context |
| 3 | Document Management | POST /documents; GET /documents; DELETE /documents/{id} |
| 4 | CBP Generation | POST /cbp/generate; GET /cbp/status |
| 5 | Role Mapping | GET /role-mapping/unmatched; PUT /role-mapping/{id} |
| 6 | Designation Request | POST /designation/requests; GET /designation/request-status |
| 7 | Hierarchy | GET /hierarchy; PUT /hierarchy; POST /hierarchy/reorder |
| 8 | Designation Selection | GET /designations; POST /role-mapping |
| 9 | CBP Editor | GET /cbp/{id}; PUT /cbp/{id}; GET /competencies |
| 10 | Recommendations | GET /courses/recommend; GET /courses |
| 11 | Approval Workflow | POST /role-mapping/submit; GET /approval/status |
| 12 | Approval Tracking | GET /approvals; POST /approvals/{id}/revoke |
| 13 | Course Export | GET /courses; GET /courses/export |
| 14 | Combined Export | GET /cbp/{id}/courses; GET /cbp/{id}/download |
| 15 | Localization | GET /languages; POST /cbp/{id}/translate |
| 16 | Finalization | POST /cbp/{id}/finalize; GET /cbp/{id}/download |
| 17 | Mapping Review | GET /approvals/pending; PUT /approvals/{id}/decision |
| 18 | Designation Approval | GET /designation/requests; PUT /designation/requests/{id}/decision |

## Appendix B. Production readiness checklist

- ☐ POC route and schema inventory reviewed; this SDD updated to match actual implementation.
- ☐ All external APIs and service credentials confirmed in a sandbox/staging environment.
- ☐ RBAC and organization-level authorization tests pass.
- ☐ PDF type/size/count and mandatory Work Allocation Order validations pass.
- ☐ AI output is schema-validated, traceable, and clearly marked as draft until reviewed.
- ☐ Approval state transitions, edit locks, rejection reasons and audit events tested.
- ☐ Database migrations, backups and restore procedure tested.
- ☐ Object storage permissions, encryption, retention and download authorization reviewed.
- ☐ Secrets, logs, metrics, alerts and health checks configured.
- ☐ Dependency timeout/retry/idempotency behavior tested.
- ☐ Security review and UAT completed; critical/high defects resolved or formally accepted.
- ☐ Rollback and incident-response procedures documented.

*End of document*
