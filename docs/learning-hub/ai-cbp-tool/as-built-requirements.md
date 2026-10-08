# AI CBP Tool — As-Built Requirements

Requirements reconstructed from the shipped implementation across
`cbp-ai-service` (`origin/cbrelease-4.8.39`, commit `70d7175`),
`ai-cbp-mdo-service` (`origin/cbrelease-4.8.39`, commit `88040de`), and
`cbp-ai-ui` (`origin/cbrelease-4.8.39`, commit `15a3b9a`) — what the system
does today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for the AI CBP Tool was available in
any of the three repos. This document reconstructs requirements **from the
shipped implementation** — it states what the system actually does today
(as-built), not what was originally intended. Each requirement is traced to
the file(s)/line(s) that implement it, so it can be used as:

- A baseline for QA test-case authoring against current behavior.
- An audit artifact for handover / knowledge transfer.
- A reference point to distinguish **intentional behavior** from **defects**
  going forward (defects are called out explicitly under Known deviations).

Requirement IDs: `FR-xxx` (functional, `cbp-ai-service`), `FR-1xx`
(functional, `ai-cbp-mdo-service`), `FR-2xx` (functional, `cbp-ai-ui`),
`NFR-xxx` (non-functional), `CON-xxx` (constraint/assumption baked into the
build).

## Functional requirements — `cbp-ai-service`

### Authentication and access

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL authenticate users via username/password against a locally-stored `users` table, issuing a JWT access+refresh token pair on success. | `src/api/v1/auth.py:42-153`, `src/core/security.py:45-125` |
| FR-004 | The system SHALL gate role/user administration and org-wide dashboards behind a `"Super Admin"` role check, distinct from ordinary authenticated-user access. | `src/api/dependencies.py:180-213`; e.g. `src/api/v1/users.py:21`, `dashboard.py:15` |

### Document intake and summarization

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The system SHALL accept 1–10 PDF files per upload call, scoped to a state-center(+department) and tagged with one `document_type` (`Work Allocation Order`, `Annual Reports`, `Other Document`), rejecting duplicate `(scope, filename, uploader)` combinations. | `src/api/v1/document_routes.py:51-178`, `src/schemas/document.py:8-11` |
| FR-011 | The system SHALL NOT auto-trigger summarization on upload — summarization SHALL require an explicit, idempotent call per document. | `src/api/v1/document_routes.py:303-336` |
| FR-012 | The system SHALL summarize a document by sending its raw PDF bytes plus one generic summarization prompt to Gemini (`GEMINI_PRO_MODEL_NAME`), regardless of the document's declared `document_type`. | `src/api/v1/document_routes.py:224-300`, `src/prompts/prompts.py:569` |
| FR-013 | The system SHALL allow synthesizing one meta-summary across multiple documents that share a single state-center/department scope. | `src/api/v1/meta_summary_routes.py:105-168` |
| FR-014 | The meta-summary generator SHALL use a hardcoded model name (`"gemini-2.5-pro"`), independent of the `GEMINI_PRO_MODEL_NAME` setting used elsewhere. | `src/api/v1/meta_summary_routes.py:81` |
| FR-015 | Deleting a document SHALL also update or delete any meta-summary batches that reference it. | `src/api/v1/document_routes.py:338-400` |

### Role mapping generation

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The system SHALL provide three independent role-mapping generation implementations (v1, v2, v3), each creating an `IN_PROGRESS` placeholder row immediately and completing the actual generation in a background task. | `src/api/v1/role_mappings.py:150-254`, `src/api/v2/role_mappings.py:151-249`, `src/api/v3/role_mappings.py:163-260` |
| FR-021 | v1 SHALL source generation context from a dedicated `state_center_data` table (one ACBP-plan/work-allocation-order summary per scope) plus optional ad-hoc file uploads. | `src/api/v1/role_mappings.py:149-254` |
| FR-022 | v2 SHALL source generation context from the generic `documents` table, concatenating all summarized document types without filtering by type. | `src/services/v2/role_mapping_service.py` (`get_documents_summary`) |
| FR-023 | v3 SHALL run a three-pass pipeline: (1) extract the designation hierarchy from Work-Allocation-Order summaries only, (2) generate FRAC competencies per designation batch in parallel, (3) reconcile Behavioral/Functional competencies against `data/withidentifier_competencies.json`, dropping unresolvable entries and passing Domain competencies through unchanged. | `src/services/v3/role_mapping_service.py:259-458,525-675` |
| FR-024 | On a background-task exception, v1 and v2 SHALL swallow the real error and set a generic failure message; v3 SHALL propagate and store the actual exception text. | `src/api/v1/role_mappings.py:94-131` (pattern), `src/api/v3/role_mappings.py:39-159` |
| FR-025 | Calling `/generate` again after a prior `FAILED` state SHALL auto-delete and retry in v1/v2, but SHALL return the existing `FAILED` result unchanged in v3. | `src/api/v1/role_mappings.py:195-198` (v1/v2 pattern), `src/api/v3/role_mappings.py:205-210` |
| FR-026 | Only v3's background task SHALL automatically run iGOT designation matching for every newly-completed, unmatched designation; v1 and v2 SHALL require a separate, manual call. | `src/api/v3/role_mappings.py:115-143` |
| FR-027 | v1 SHALL expose full CRUD, search, and reorder endpoints for role mappings; v2 SHALL expose only `generate` and `add-designation`; v3 SHALL expose only `generate`. | `src/api/v1/role_mappings.py` (12 routes), `src/api/v2/role_mappings.py` (2 routes), `src/api/v3/role_mappings.py` (1 route) |
| FR-028 | v2's `add-designation` SHALL reconcile its generated competencies via v3's own KCM-reconciliation function against whatever taxonomy file v3 currently loads, rather than maintaining an independent reconciliation path. | `src/api/v2/role_mappings.py:377` calling `role_mapping_service_v3.reconcile_role_mappings_with_kcm` |

### Designation matching

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The system SHALL first attempt an exact match of a designation name against iGOT's designation-search API (case-insensitive), before attempting any semantic match. | `src/services/designation_matcher_service.py:85-127` |
| FR-031 | For names not exactly matched, the system SHALL embed the name with Gemini (`GOOGLE_EMBEDDING_MODEL`), using a Redis cache (no expiry) keyed by lowercased designation name to avoid re-embedding. | `src/services/designation_matcher_service.py:24-73` |
| FR-032 | The system SHALL accept a semantic match only when cosine similarity (via pgvector's `<=>` operator against `designation_embeddings`) meets or exceeds `DESIGNATION_SIMILARITY_THRESHOLD`. | `src/services/designation_matcher_service.py:129-172`, `src/core/configs.py:35` |
| FR-033 | `designation_embeddings` SHALL be populated exclusively by an offline ingestion script, never by the live API. | `scripts/ingest_designation_embeddings.py` |
| FR-034 | A designation with no iGOT match SHALL be escalatable via a designation-approval request, notifying SPV admins by email; duplicate requests (same role mapping, user, name, and wing/division/section, excluding already-rejected ones) SHALL be rejected with a conflict. `cbp-ai-service` creates this request but never transitions it — see FR-120/FR-121. | `src/api/v1/designation_approval.py:29-107`, `src/crud/designation_approval.py:13-32` |

### Course recommendation, suggestion, and manual courses

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The system SHALL generate AI course recommendations for a role mapping as a background task: build 5 search queries (general + functional + behavioral), embed them, run 4 parallel searches against `course_metadata_weightage` (hybrid weighted vector score: 40% keywords / 20% description / 40% combined), merge with keyword and competency-type bonuses, then rerank/score via Gemini. | `src/api/v1/course_recommendation.py:372-596`, `src/crud/course_recommendation.py:212-360` |
| FR-041 | Only courses scoring `relevancy >= COURSE_RECOMMENDATION_MIN_RELEVANCY` (default 80) SHALL be persisted in the recommendation's `filtered_courses`. | `src/api/v1/course_recommendation.py:541-573`, `src/core/configs.py:169` |
| FR-042 | The system SHALL provide an independent, non-AI course-suggestion path that proxies iGOT's own content search and saves a plain list of course identifiers per role mapping. | `src/api/v1/course_suggestion.py:21-115` |
| FR-043 | The system SHALL provide a fully manual course-entry path (`user_added_courses`), independent of both the AI recommendation and iGOT's catalog. | `src/api/v1/user_added_courses.py:23-83` |
| FR-044 | Deleting a single course by identifier SHALL auto-detect whether it lives in the recommendation, the suggestion list, or the user-added list, and remove it from whichever it's found in first, in that priority order. | `src/api/v1/course_recommendation.py:805-926` |

### CBP Plan and approval submission

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-050 | The system SHALL require an existing course recommendation for a role mapping before a CBP Plan can be created for it. | `src/api/v1/cbp_plan.py:104-110` |
| FR-051 | Saving a CBP Plan SHALL resolve each requested course identifier against, in order: the latest recommendation's `filtered_courses`, then a live iGOT content search (tagged with `DEFAULT_RELEVANCY_SCORE`, default 90), then `user_added_courses` — concatenating all matches into one `selected_courses` array. | `src/api/v1/cbp_plan.py:63-181` |
| FR-052 | The `CBPPlan` model SHALL carry no status/lifecycle field of its own — that question is answered by `ai-cbp-mdo-service`'s copy of the data once submitted (FR-1xx). | `src/models/cbp_plan.py:10-78`, `src/schemas/cbp_plan.py:25-38` |
| FR-053 | Sending role mappings for approval SHALL require every target role mapping to be `COMPLETED` and to have a saved CBP plan, and SHALL snapshot each into a frozen `ApprovalRequestItem` (not a live reference) before creating one `ApprovalRequest` with `status = PENDING`. | `src/api/v1/approval_requests.py:45-182` |
| FR-054 | Sending for approval SHALL email the assigned MDO admin/leader a deep link into an external MDO-facing review portal (the portal application itself is not present in any of the three traced repos). | `src/services/notification_service.py:140-231` |
| FR-055 | A `PENDING` approval request SHALL be revocable back to `DRAFT` by `cbp-ai-service`'s own API; no other status transition SHALL be reachable through this repo's API. `ai-cbp-mdo-service` never reads or writes the `revoked_at` column it otherwise mirrors. | `src/api/v1/approval_requests.py:344-402`, `src/crud/approval_request.py:141-178`; absence of `revoked_at` usage in `ai-cbp-mdo-service` |

### Dashboards and reports

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-060 | The system SHALL provide org-wide CBP KPIs, trend, and gap-analysis endpoints restricted to `Super Admin`, and self-scoped equivalents open to any authenticated user. | `src/api/v1/dashboard.py:15-136` |
| FR-061 | Gap analysis SHALL count competencies (by Behavioral/Functional/Domain) that have no matching course among a role mapping's recommended courses. | `src/crud/dashboard.py:317-411` |
| FR-062 | The system SHALL render CBP-plan, ACBP-plan, and course-recommendation reports as PDFs (Jinja2 HTML templates converted via Playwright/Chromium), with optional Bhashini-based translation for the CBP/ACBP reports. | `src/api/v1/reports.py:269-426` |

### Offline bulk-onboarding tooling

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-070 | The repo SHALL provide a separate, standalone six-stage script pipeline (`bulk_scripts/`) for bulk state/ministry onboarding: copy documents → summarize → generate role mappings → recommend courses and save CBP plans → submit for approval → publish. | `bulk_scripts/README.md`, `bulk_scripts/*.py` |
| FR-071 | Only the final stage (`bulk_training_plan_approval.py`) SHALL actually drive an `ApprovalRequest`/item to `APPROVED` from within `cbp-ai-service`, calling a separately-configured downstream publish target (`CB_EXT_COURSE_SERVICE_URL`) than the one `ai-cbp-mdo-service`'s live API uses (`KB_BASE_URL`) — no other code in either repo SHALL do so via this specific target. | `bulk_scripts/bulk_training_plan_approval.py:531-727` |
| FR-072 | The approval-submission stage (`batch_send_approval_requests.py`) SHALL NOT be idempotent — the system SHALL provide no dedup check against already-submitted requests. | `bulk_scripts/README.md:524-526` |

## Functional requirements — `ai-cbp-mdo-service`

### MDO approval workflow

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-100 | The system SHALL scope an MDO admin's approval-request list and detail views to requests where `mdo_id` matches the caller's own id, derived from the JWT `sub` claim. | `src/crud/mdo_approval_request.py:45,130-133` |
| FR-101 | The system SHALL treat `MDO_ADMIN` and `MDO_LEADER` identically for authorization and data scoping — there SHALL be no broader view for one role over the other. | `src/api/v1/mdo_approval.py` (`require_role(['MDO_ADMIN','MDO_LEADER'])` applied uniformly) |
| FR-110 | Publishing SHALL row-lock the target request (`SELECT ... FOR UPDATE`, scoped by `id` AND `mdo_id`) and require it to currently be `PENDING`. | `src/crud/mdo_approval_request.py:157-175` |
| FR-111 | For each `PENDING` item in a publish call, the system SHALL extract course identifiers from the item's `cbp_plan_data`, and — if any exist — call iGOT's CBP-plan create API followed by its publish API; an item with no extractable course data SHALL fail locally without an iGOT call. | `src/services/igot_service.py:14-109`, `src/controller/mdo_approval.py:85-96` |
| FR-112 | The parent `ApprovalRequest` SHALL be marked `APPROVED` as soon as at least one item's publish succeeds, even if other items in the same request failed. | `src/controller/mdo_approval.py:204-222`, `src/crud/mdo_approval_request.py:200-215` |
| FR-113 | If every eligible item in a publish call fails, the system SHALL return an error and SHALL NOT modify the parent request's status. | `src/controller/mdo_approval.py:208-212` |
| FR-114 | A previously-`FAILED` item SHALL be individually retryable, reusing the plan name/due date stored on its own `mdo_approval` audit row from the original attempt. | `src/api/v1/mdo_approval.py:167`, `src/crud/mdo_approval_request.py:653-720` |
| FR-115 | Rejecting an entire request SHALL require a comment of 1–500 non-blank characters, and SHALL move every item under it to `REJECTED`. | `src/schemas/mdo_approval.py:10-13`, `src/crud/mdo_approval_request.py:259-313` |
| FR-116 | Rejecting a single item SHALL recompute the parent request's status from the remaining items' statuses (`REJECTED` if none pending and none approved; `APPROVED` if none pending and at least one approved; otherwise unchanged) rather than setting it directly. | `src/crud/mdo_approval_request.py:315-408` |
| FR-117 | Editing an item's designation/role fields SHALL require the target item itself to be `PENDING`, in addition to the parent request being `PENDING`. | `src/crud/mdo_approval_request.py:594-651` |
| FR-118 | Adding or removing a course from an item's `cbp_plan_data` SHALL require only the parent request to be `PENDING` — not the item's own status. | `src/crud/mdo_approval_request.py:447-593` |
| FR-119 | Every publish/reject/retry action SHALL queue a background email to the original requester (resolved via the mirrored `users` table), gated by `ENABLE_EMAIL_NOTIFICATION`. | `src/controller/mdo_approval.py:224-299` |

### SPV designation-approval workflow

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-120 | Approving a designation-naming request SHALL call iGOT's designation-create API before writing anything to the database; the database record SHALL be left unchanged if that call fails. | `src/controller/designation_approval.py:69-108` |
| FR-121 | An iGOT response indicating the designation already exists ("Already Present") SHALL still be treated as a successful approval. | `src/services/igot_service.py:190-197`, `src/controller/designation_approval.py:100-108` |
| FR-122 | Approving or rejecting SHALL stamp `actioned_by` with the acting SPV admin's id — the same column `cbp-ai-service`'s own code never writes. | `src/crud/designation_approval.py:181-207` (approve), similar path for reject |
| FR-123 | The designation-approval list view SHALL be visible to `SPV_ADMIN`, `MDO_ADMIN`, and `MDO_LEADER` alike, and SHALL NOT be scoped to a specific admin's id — but approve/reject actions SHALL be restricted to `SPV_ADMIN` only. | `src/api/v1/designation_approval.py:27,37,76,124` |

### Shared iGOT proxy

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-130 | The system SHALL provide its own, independent proxy endpoints for iGOT course-content search and designation search, separate from `cbp-ai-service`'s equivalents. | `src/api/v1/kb_apis.py:25,67` |

## Functional requirements — `cbp-ai-ui`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-200 | The shell SHALL authenticate against `cbp-ai-service`'s own local username/password login (`cbp-tpc-ai/api/v1/auth/login`) — not an iGOT SSO/OAuth redirect. | `src/app/components/login/login.component.ts:43-129`, `shared.service.ts:500-515` |
| FR-201 | The shell SHALL delegate the entire step-by-step CBP-authoring wizard to a lazily-loaded, privately-published Angular library (`@sunbird-cb/cbp-ai@0.1.117`) at the `/ai` route, rather than implementing those screens itself. | `src/app/app-routing.module.ts:24-29`, `package.json:22` |
| FR-202 | The shell SHALL centralize every backend call through one root-injected `SharedService`, resolving the backend base URL at runtime from a static asset (`assets/jsonfiles/configurations.json`), not from an Angular build-time environment file. | `src/app/modules/shared/services/shared.service.ts`, `init.service.ts:33-64` |
| FR-203 | The shell's course-suggestion search SHALL call iGOT's content-search API directly via a hardcoded absolute URL, bypassing `cbp-ai-service`'s own `/course/suggestions` proxy for that specific call. | `shared.service.ts:451-474` |
| FR-204 | On receiving a `401`, the shell SHALL clear all local session state and auto-reload the app after a fixed delay, without waiting for user confirmation. | `src/app/interceptors/auth.interceptor.ts:68-124` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | Role-mapping generation and course recommendation (`cbp-ai-service`) SHALL run as in-process FastAPI background tasks, not a separate task-queue worker. | Absence of Celery/RQ anywhere in `cbp-ai-service/src/`; `src/api/v1/course_recommendation.py:657-664` |
| NFR-002 | `cbp-ai-service` background-task database access SHALL use its own, independently-managed session (`sessionmanager.session()`) rather than the request-scoped session, so the task can complete after the originating request/response cycle ends. | `src/crud/course_recommendation.py:16-21,30-36,158-187` |
| NFR-003 | Heavy I/O-bound steps within `cbp-ai-service`'s recommendation and role-mapping pipelines SHALL be parallelized via `asyncio.gather` rather than run sequentially. | `src/api/v1/course_recommendation.py:422-428,439-464,534-537`; `src/services/v3/role_mapping_service.py:320-458` |
| NFR-004 | Neither backend's database schema SHALL be managed through tracked migrations — both SHALL be created idempotently at every app startup (`Base.metadata.create_all`). | `cbp-ai-service:src/main.py:18-24`, `ai-cbp-mdo-service:src/main.py:16-37` |
| NFR-005 | `ai-cbp-mdo-service`'s approve/publish action SHALL execute the iGOT create-then-publish round-trip synchronously within the request, not as a background job — only the resulting notification email SHALL be backgrounded. | `ai-cbp-mdo-service:src/controller/mdo_approval.py:143-231,224-299` |
| NFR-008 | `ai-cbp-mdo-service` SHALL NOT expose a health/liveness endpoint of any kind. | Absence confirmed by exhaustive search of `ai-cbp-mdo-service/src/` for health/ping/readiness/liveness routes |
| NFR-009 | Neither `ai-cbp-mdo-service` nor `cbp-ai-ui` SHALL carry an automated test suite that meaningfully exercises this feature — the former has none at all, and the latter's suite is unmodified framework boilerplate asserting text that does not exist in the current app. | `ai-cbp-mdo-service`: absence of any `*test*` path; `cbp-ai-ui:src/app/app.component.spec.ts:24-30`, `e2e/src/app.e2e-spec.ts:12-13` |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | `course_metadata_weightage` and `course_metadata_v3` (both pgvector-backed, in `cbp-ai-service`) have no SQLAlchemy model and are not part of `Base.metadata.create_all`. | A fresh environment that never runs `scripts/course_embedding_pipeline.py` will have a fully working app with course recommendation silently returning nothing, because the search table doesn't exist. | `src/crud/course_recommendation.py:212-360`, absence of a matching model in `src/models/` |
| CON-002 | `designation_embeddings` is likewise populated only by an offline script (`scripts/ingest_designation_embeddings.py`), never by the live API. | Semantic designation matching depends entirely on that script having been run and kept reasonably current against iGOT's designation master. | `src/services/designation_matcher_service.py:129-172` |
| CON-005 | `CB_EXT_COURSE_SERVICE_URL` (`cbp-ai-service`'s offline bulk script's publish target) is read directly from the OS environment and is not part of either backend's `Settings` class; its relationship to `ai-cbp-mdo-service`'s `KB_BASE_URL` publish target is unconfirmed. | Two independently-configured code paths (one per repo) can each drive an `ApprovalRequest` to `APPROVED` against what may or may not be the same downstream system. | `cbp-ai-service:bulk_scripts/bulk_training_plan_approval.py:1032`; `ai-cbp-mdo-service:src/services/igot_service.py:27-159` |
| CON-006 | `cbp-ai-service`'s Gemini client for role-mapping v1 and v3 hardcodes `location="us-central1"` and `vertexai=True`; only v2 uses the configurable location/mode settings. | A region or Vertex/API-key mode change via config affects v2 generation only — v1/v3 require a code change to relocate. | `src/api/v1/role_mappings.py:38-42`, `src/api/v3/role_mappings.py:32-35` vs. `src/api/v2/role_mappings.py:36-40` |
| CON-007 | The two backend services integrate exclusively through shared Postgres tables (`extend_existing=True` mirrors in `ai-cbp-mdo-service`), with no API contract, shared schema definition, or contract test between the two repos. | A model change in either repo's mirror of a shared table can silently desynchronize from the other's expectations — there is no mechanism that would catch this at build or deploy time. | `ai-cbp-mdo-service:src/models/mdo_approval.py:1-4,20,86-89` (mirror docstrings) |
| CON-011 | `cbp-ai-ui`'s `Dockerfile` builds with the plain `ng build` script, not `build:prod` — Angular's `production` configuration and environment-file replacement are not applied unless overridden elsewhere in CI. | The shipped bundle may not reflect the intended production build settings (bundle budgets, `environment.prod.ts`) unless the deployment pipeline overrides the Docker image's build step. | `cbp-ai-ui:Dockerfile` (build stage), `package.json:6-7` |
| CON-012 | The actual screens for document upload, role-mapping review/edit, course selection, and CBP/ACBP export are implemented entirely inside the private `@sunbird-cb/cbp-ai` library — not reconstructible from any of the three traced repos. | Any as-built claim about those screens' exact behavior in this document is sourced from the shell's own Help-Sidebar copy or its API client's call sites, never from the screens' own code. | `cbp-ai-ui:package.json:22`, `app-routing.module.ts:24-29` |

## Known deviations (inconsistent by accident, not by design)

These are behaviors present in the as-built system that appear to be
unintended inconsistencies rather than deliberate requirements. Listed here
so they are not mistaken for intended behavior when used as a QA/test
baseline.

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | The meta-summary handler's attempt to regenerate a non-`COMPLETED` input document's summary calls an async function without `await` and without scheduling it as a background task — the regeneration never actually happens, and the batch is marked `FAILED` instead. | Sits underneath FR-013 | `cbp-ai-service:src/api/v1/meta_summary_routes.py:47,49` |
| DEV-002 | `DESIGNATION_SIMILARITY_THRESHOLD`'s Pydantic default (`0.93`) disagrees with its documented value (`0.92`, in `.env.example` and the matcher service's own docstrings). Still present at the currently-traced commit. | FR-032 | `cbp-ai-service:src/core/configs.py:35` vs. `.env.example:26` |
| DEV-003 | ~~`DesignationApproval.actioned_by` was added to the model and response schema, but no code path anywhere writes to it.~~ **Resolved by cross-repo trace**: `ai-cbp-mdo-service`'s approve/reject endpoints write this column, against the same `designation_approvals` table `cbp-ai-service` only reads from its own side. Not a defect once both repos are in view — only appeared to be one from a single-repo trace of `cbp-ai-service` alone. | Sits underneath FR-034 (`cbp-ai-service`), resolved by FR-122 (`ai-cbp-mdo-service`) | `cbp-ai-service:src/models/designation_approval.py:38` vs. `ai-cbp-mdo-service:src/crud/designation_approval.py:181-207` |
| DEV-004 | `ApprovalRequestListResponse`'s docstring (`cbp-ai-service`) describes possible statuses as "draft, pending, published, rejected," but the actual `ApprovalStatus` enum has no `PUBLISHED` value on either backend. | Sits underneath FR-053/FR-055/FR-112 | `cbp-ai-service:src/api/v1/approval_requests.py:203` vs. `src/schemas/comman.py:14-19` (both repos define the same four values) |
| DEV-005 | The meta-summary generator hardcodes its Gemini model name, independent of the `GEMINI_PRO_MODEL_NAME` setting every other Gemini call in `cbp-ai-service` respects. | FR-014 | `cbp-ai-service:src/api/v1/meta_summary_routes.py:81` |
| DEV-006 | The designation-group-based Domain/Behavioral/Functional course-mix ratio is fully implemented as a scoring rule in `cbp-ai-service`, but the classification call that would feed it a real value is commented out — the pipeline always runs with `designation_group = None`. | Sits underneath FR-040 | `cbp-ai-service:src/api/v1/course_recommendation.py:182-186,531` |
| DEV-007 | v1 and v3's role-mapping Gemini client hardcodes a Vertex AI region/mode; v2's equivalent client is fully config-driven — an inconsistency across versions rather than a documented per-version design choice. | CON-006 | `cbp-ai-service:src/api/v1/role_mappings.py:38-42`, `src/api/v3/role_mappings.py:32-35` vs. `src/api/v2/role_mappings.py:36-40` |
| DEV-008 | `ai-cbp-mdo-service`'s `pyproject.toml` declares `name = "cbp-ai-service"` and a matching description, not its own actual name — apparently copy-pasted from the sibling repo and never updated. | — | `ai-cbp-mdo-service:pyproject.toml:2-4` vs. `build.sh:9` (`name=ai-cbp-mdo-service`) |
| DEV-009 | `ai-cbp-mdo-service`'s item-mutation endpoints are inconsistently validated: `items/update` requires the target item to be `PENDING`; `course/add`/`course/remove` check only the parent request's status. | FR-117 vs. FR-118 | `ai-cbp-mdo-service:src/crud/mdo_approval_request.py:594-651` vs. `:447-593` |
| DEV-010 | `ai-cbp-mdo-service`'s `course/add` always appends to the first record in `cbp_plan_data` even when multiple records exist, silently never targeting later ones. | Sits underneath FR-118 | `ai-cbp-mdo-service:src/crud/mdo_approval_request.py:505` |
| DEV-012 | `ai-cbp-mdo-service`'s designation-approval email template filename literally contains `" copy"` (`designation_approval_request_email copy.html`), loaded verbatim at runtime — a likely unfinished rename left in a path treated as a stable interface. | — | `ai-cbp-mdo-service:src/services/notification_service.py:53` |
| DEV-013 | `ai-cbp-mdo-service`'s `ApprovalRequestRead.revoked_at` column is mirrored from `cbp-ai-service`'s schema but never read or written by any code in this repo — a dead field on this side of the integration. | Sits underneath FR-055 | `ai-cbp-mdo-service:src/models/mdo_approval.py:63` |
| DEV-014 | `cbp-ai-ui`'s test suite (`app.component.spec.ts`, `e2e/src/app.e2e-spec.ts`) asserts against the string `"sunbird-cb-staticweb app is running!"` and a `title` of `'sunbird-cb-staticweb'` — leftover from a prior/parallel project name, with no matching markup in the current `app.component.html`; these tests cannot pass as written. | NFR-009 | `cbp-ai-ui:src/app/app.component.spec.ts:24-30`, `src/app/app.component.ts:16`, `e2e/src/app.e2e-spec.ts:12-13` |
| DEV-015 | `cbp-ai-ui` has several fully-built but unreachable UI paths: the "How to use" chip triggers a direct PDF download instead of opening the fully-implemented `HelpSidebarComponent`; the dashboard route exists and is wired but its triggering button is commented out; `InitialScreenComponent` and `DirectiveModule` are declared but never imported into any active module. | — | `cbp-ai-ui:src/app/app.component.ts:232-243` (help), `:223-225` + `app.component.html:29-34` (dashboard), `src/app/modules/initial-screen/` and `directive.module.ts` (orphaned) |
| DEV-016 | `cbp-ai-ui`'s `MultilingualTranslationService` hardcodes only `['en','hi']` as supported languages, while `app.constant.ts`'s `LANGUAGES` list separately declares `be, en, hi, ka, mr, ta` as active — two different, disagreeing sources of truth for the same concern. | — | `cbp-ai-ui:multilingual-translation.service.ts:9` vs. `app.constant.ts:769-820` |

## Out of scope (not reconstructible from any of the three repos)

- The MDO admin's and SPV admin's own frontend applications — whatever
  renders `ai-cbp-mdo-service`'s API for those two roles is not present in
  `cbp-ai-service`, `ai-cbp-mdo-service`, or `cbp-ai-ui`.
- The CBP author's actual step-by-step wizard screens (document upload,
  role-mapping review, course-recommendation review, CBP/ACBP export) —
  these ship inside the private `@sunbird-cb/cbp-ai` npm library, whose
  source is not in `cbp-ai-ui` or either backend repo.
- Whether `bulk_scripts/bulk_training_plan_approval.py`'s
  `CB_EXT_COURSE_SERVICE_URL` and `ai-cbp-mdo-service`'s `KB_BASE_URL` are
  the same physical downstream publish service.
- The exact schema/validation contract for `cbp_plan_data` as passed
  between the two backends — both `cbp_plans.selected_courses`
  (`cbp-ai-service`) and `approval_request_items.cbp_plan_data`
  (mirrored/mutated by `ai-cbp-mdo-service`) are unvalidated JSON whose real
  shape is defined only by whichever code path currently reads or writes
  it, on either side.
- The process by which `course_metadata_weightage`/`course_metadata_v3` and
  `designation_embeddings` are kept up to date in a given environment
  (cadence, scheduling, ownership) — the scripts exist in `cbp-ai-service`,
  but nothing in any of the three repos documents how/when they are
  actually run operationally outside of the bulk-onboarding README.

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to the
> repo named in its ID prefix or Source column, at the commit listed at the
> top of this page — no requirement here is inferred without a citation. No
> original spec/ticket existed to verify these against (see Purpose and
> method); this document is reconstructed from shipped behaviour across
> three repos, not compared to an approved requirement set. The MDO/SPV
> admin's own frontend and the private `@sunbird-cb/cbp-ai` library remain
> external to this trace — attaching either, or an originating spec if one
> surfaces, would convert the relevant sections from as-built to a gap
> analysis.
