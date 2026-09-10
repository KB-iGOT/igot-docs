# AI CBP Tool — As-Built Requirements

Requirements reconstructed from the shipped implementation in
`cbp-ai-service` (`origin/cbrelease-4.8.39`, commit `119a42b`) — what the
system does today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for the AI CBP Tool was available in
the repo. This document reconstructs requirements **from the shipped
implementation** — it states what the system actually does today
(as-built), not what was originally intended. Each requirement is traced to
the file(s)/line(s) that implement it, so it can be used as:

- A baseline for QA test-case authoring against current behavior.
- An audit artifact for handover / knowledge transfer.
- A reference point to distinguish **intentional behavior** from **defects**
  going forward (defects are called out explicitly under Known deviations).

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Authentication and access

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL authenticate users via username/password against a locally-stored `users` table, issuing a JWT access+refresh token pair on success. | `src/api/v1/auth.py:42-153`, `src/core/security.py:45-125` |
| FR-002 | The system SHALL lock an account after `MAX_LOGIN_ATTEMPTS` (default 5) failed logins for `LOGIN_LOCKOUT_MINUTES` (default 15), tracked per username in `login_attempts`. | `src/api/v1/auth.py:75-112`, `src/core/configs.py:126-133` |
| FR-003 | The system SHALL back JWT validity with a server-side `user_sessions` row per token pair when `ENABLE_TOKEN_BLACKLIST` is true, so logout or session cleanup immediately invalidates an otherwise-unexpired token. | `src/core/security.py:163-197,317-346` |
| FR-004 | The system SHALL gate role/user administration, account-lockout management, and org-wide dashboards behind a `"Super Admin"` role check, distinct from ordinary authenticated-user access. | `src/api/dependencies.py:180-213`; e.g. `src/api/v1/users.py:21`, `dashboard.py:15` |

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
| FR-023 | v3 SHALL run a three-pass pipeline: (1) extract the designation hierarchy from Work-Allocation-Order summaries only, (2) generate FRAC competencies per designation batch in parallel, (3) reconcile Behavioral/Functional competencies against `data/competencies_level.json`, dropping unresolvable entries and passing Domain competencies through unchanged. | `src/services/v3/role_mapping_service.py:259-458,525-675` |
| FR-024 | On a background-task exception, v1 and v2 SHALL swallow the real error and set a generic failure message; v3 SHALL propagate and store the actual exception text. | `src/api/v1/role_mappings.py:94-131` (pattern), `src/api/v3/role_mappings.py:39-159` |
| FR-025 | Calling `/generate` again after a prior `FAILED` state SHALL auto-delete and retry in v1/v2, but SHALL return the existing `FAILED` result unchanged in v3. | `src/api/v1/role_mappings.py:195-198` (v1/v2 pattern), `src/api/v3/role_mappings.py:205-210` |
| FR-026 | Only v3's background task SHALL automatically run iGOT designation matching for every newly-completed, unmatched designation; v1 and v2 SHALL require a separate, manual call. | `src/api/v3/role_mappings.py:115-143` |
| FR-027 | v1 SHALL expose full CRUD, search, and reorder endpoints for role mappings; v2 SHALL expose only `generate` and `add-designation`; v3 SHALL expose only `generate`. | `src/api/v1/role_mappings.py` (12 routes), `src/api/v2/role_mappings.py` (2 routes), `src/api/v3/role_mappings.py` (1 route) |

### Designation matching

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The system SHALL first attempt an exact match of a designation name against iGOT's designation-search API (case-insensitive), before attempting any semantic match. | `src/services/designation_matcher_service.py:85-127` |
| FR-031 | For names not exactly matched, the system SHALL embed the name with Gemini (`GOOGLE_EMBEDDING_MODEL`), using a Redis cache (no expiry) keyed by lowercased designation name to avoid re-embedding. | `src/services/designation_matcher_service.py:24-73` |
| FR-032 | The system SHALL accept a semantic match only when cosine similarity (via pgvector's `<=>` operator against `designation_embeddings`) meets or exceeds `DESIGNATION_SIMILARITY_THRESHOLD`. | `src/services/designation_matcher_service.py:129-172`, `src/core/configs.py:35` |
| FR-033 | `designation_embeddings` SHALL be populated exclusively by an offline ingestion script, never by the live API. | `scripts/ingest_designation_embeddings.py` |
| FR-034 | A designation with no iGOT match SHALL be escalatable via a designation-approval request, notifying SPV admins by email; duplicate requests (same role mapping, user, name, and wing/division/section, excluding already-rejected ones) SHALL be rejected with a conflict. | `src/api/v1/designation_approval.py:29-107`, `src/crud/designation_approval.py:13-32` |

### Course recommendation, suggestion, and manual courses

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The system SHALL generate AI course recommendations for a role mapping as a background task: build 5 search queries (general + functional + behavioral), embed them, run 4 parallel searches against `course_metadata_weightage` (hybrid weighted vector score: 40% keywords / 20% description / 40% combined), merge with keyword and competency-type bonuses, then rerank/score via Gemini. | `src/api/v1/course_recommendation.py:372-596`, `src/crud/course_recommendation.py:212-360` |
| FR-041 | Only courses scoring `relevancy >= COURSE_RECOMMENDATION_MIN_RELEVANCY` (default 80) SHALL be persisted in the recommendation's `filtered_courses`. | `src/api/v1/course_recommendation.py:541-573`, `src/core/configs.py:169` |
| FR-042 | The system SHALL provide an independent, non-AI course-suggestion path that proxies iGOT's own content search and saves a plain list of course identifiers per role mapping. | `src/api/v1/course_suggestion.py:21-115` |
| FR-043 | The system SHALL provide a fully manual course-entry path (`user_added_courses`), independent of both the AI recommendation and iGOT's catalog. | `src/api/v1/user_added_courses.py:23-83` |
| FR-044 | Deleting a single course by identifier SHALL auto-detect whether it lives in the recommendation, the suggestion list, or the user-added list, and remove it from whichever it's found in first, in that priority order. | `src/api/v1/course_recommendation.py:805-926` |

### CBP Plan and approval

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-050 | The system SHALL require an existing course recommendation for a role mapping before a CBP Plan can be created for it. | `src/api/v1/cbp_plan.py:104-110` |
| FR-051 | Saving a CBP Plan SHALL resolve each requested course identifier against, in order: the latest recommendation's `filtered_courses`, then a live iGOT content search (tagged with `DEFAULT_RELEVANCY_SCORE`, default 90), then `user_added_courses` — concatenating all matches into one `selected_courses` array. | `src/api/v1/cbp_plan.py:63-181` |
| FR-052 | The `CBPPlan` model SHALL carry no status/lifecycle field of its own. | `src/models/cbp_plan.py:10-78`, `src/schemas/cbp_plan.py:25-38` |
| FR-053 | Sending role mappings for approval SHALL require every target role mapping to be `COMPLETED` and to have a saved CBP plan, and SHALL snapshot each into a frozen `ApprovalRequestItem` (not a live reference) before creating one `ApprovalRequest` with `status = PENDING`. | `src/api/v1/approval_requests.py:45-182` |
| FR-054 | Sending for approval SHALL email the assigned MDO admin/leader a deep link into an external MDO-facing review portal. | `src/services/notification_service.py:140-231` |
| FR-055 | A `PENDING` approval request SHALL be revocable back to `DRAFT`; no other status transition SHALL be reachable through this repo's API. | `src/api/v1/approval_requests.py:344-402`, `src/crud/approval_request.py:141-178` |

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
| FR-071 | Only the final stage (`bulk_training_plan_approval.py`) SHALL actually drive an `ApprovalRequest`/item to `APPROVED` and call the external CB-ext-course-service's publish API — no code elsewhere in the repo SHALL do so. | `bulk_scripts/bulk_training_plan_approval.py:531-727` |
| FR-072 | The approval-submission stage (`batch_send_approval_requests.py`) SHALL NOT be idempotent — the system SHALL provide no dedup check against already-submitted requests. | `bulk_scripts/README.md:524-526` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | Role-mapping generation and course recommendation SHALL run as in-process FastAPI background tasks, not a separate task-queue worker. | Absence of Celery/RQ anywhere in `src/`; `src/api/v1/course_recommendation.py:657-664` |
| NFR-002 | Background-task database access SHALL use its own, independently-managed session (`sessionmanager.session()`) rather than the request-scoped session, so the task can complete after the originating request/response cycle ends. | `src/crud/course_recommendation.py:16-21,30-36,158-187` |
| NFR-003 | Heavy I/O-bound steps (embedding generation, DB searches, LLM calls) within the recommendation and role-mapping pipelines SHALL be parallelized via `asyncio.gather` rather than run sequentially. | `src/api/v1/course_recommendation.py:422-428,439-464,534-537`; `src/services/v3/role_mapping_service.py:320-458` |
| NFR-004 | The database schema SHALL be created idempotently at every app startup (`Base.metadata.create_all`) rather than managed through tracked migrations. | `src/main.py:18-24` |
| NFR-005 | All feature-initiated outbound HTTP calls to iGOT, Gemini, and the notification service SHALL be async (`httpx`/`aiohttp`/`google-genai` async clients), consistent with the app's fully-async request/response and background-task model. | `src/services/notification_service.py:6`, `src/services/translation_service.py`, `google.genai` `.aio` client usage throughout `src/api/v1/course_recommendation.py`, `role_mappings.py` |
| NFR-006 | API documentation (`/docs`, `/redoc`, `/openapi.json`) SHALL be disabled when `ENVIRONMENT = production`. | `src/main.py:42-44` |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | `course_metadata_weightage` and `course_metadata_v3` (both pgvector-backed) have no SQLAlchemy model and are not part of `Base.metadata.create_all` — they exist only because an offline pipeline script created them. | A fresh environment that never runs `scripts/course_embedding_pipeline.py` will have a fully working app with course recommendation silently returning nothing, because the search table doesn't exist. | `src/crud/course_recommendation.py:212-360`, absence of a matching model in `src/models/` |
| CON-002 | `designation_embeddings` is likewise populated only by an offline script (`scripts/ingest_designation_embeddings.py`), never by the live API. | Semantic designation matching depends entirely on that script having been run and kept reasonably current against iGOT's designation master. | `src/services/designation_matcher_service.py:129-172` |
| CON-003 | The Dockerfile on this branch has no `USER` instruction — the application container runs as root. | Security posture differs from later `main`-branch history, which adds a non-root user; that change is not present on `cbrelease-4.8.39`. | `Dockerfile` (repo root, this branch) |
| CON-004 | CORS is configured with `allow_origins=["*"]` and `allow_credentials=True` simultaneously. | This combination is spec-discouraged and may behave inconsistently across browsers/clients; flagged as a build-time constraint, not a deliberate security posture. | `src/main.py:48-54` |
| CON-005 | `CB_EXT_COURSE_SERVICE_URL` (the external publish-API base URL) is read directly from the OS environment by `bulk_scripts/bulk_training_plan_approval.py` and is not part of the FastAPI app's `Settings` class. | The live API service has no awareness of, or dependency on, this URL at all — it only matters when running the offline bulk-publish script. | `bulk_scripts/bulk_training_plan_approval.py:1032`; absence from `src/core/configs.py` |
| CON-006 | The Gemini client for role-mapping v1 and v3 hardcodes `location="us-central1"` and `vertexai=True`; only v2 uses the configurable `GOOOGLE_PROJECT_LOCATION_GLOBAL`/`GOOGLE_GENAI_USE_VERTEXAI` settings. | A region or Vertex/API-key mode change via config affects v2 generation only — v1/v3 require a code change to relocate. | `src/api/v1/role_mappings.py:38-42`, `src/api/v2/role_mappings.py:36-40`, `src/api/v3/role_mappings.py:32-35` |

## Known deviations (inconsistent by accident, not by design)

These are behaviors present in the as-built system that appear to be
unintended inconsistencies rather than deliberate requirements. Listed here
so they are not mistaken for intended behavior when used as a QA/test
baseline.

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | The meta-summary handler's attempt to regenerate a non-`COMPLETED` input document's summary calls an async function without `await` and without scheduling it as a background task — the regeneration never actually happens, and the batch is marked `FAILED` instead. | Sits underneath FR-013 | `src/api/v1/meta_summary_routes.py:47,49` |
| DEV-002 | `DESIGNATION_SIMILARITY_THRESHOLD`'s Pydantic default (`0.93`) disagrees with its documented value (`0.92`, in `.env.example` and the matcher service's own docstrings). | FR-032 | `src/core/configs.py:35` vs. `.env.example:26` |
| DEV-003 | `DesignationApproval.actioned_by` was added to the model and response schema, but no code path anywhere writes to it — there is no corresponding approve/reject action that would populate it. | Sits underneath FR-034 | `src/models/designation_approval.py:38`, `src/schemas/designation_approval.py:22` |
| DEV-004 | `ApprovalRequestListResponse`'s docstring describes possible statuses as "draft, pending, published, rejected," but the actual `ApprovalStatus` enum has no `PUBLISHED` value. | Sits underneath FR-053/FR-055 | `src/api/v1/approval_requests.py:203` vs. `src/schemas/comman.py:14-19` |
| DEV-005 | The meta-summary generator hardcodes its Gemini model name, independent of the `GEMINI_PRO_MODEL_NAME` setting every other Gemini call in the app respects. | FR-014 | `src/api/v1/meta_summary_routes.py:81` |
| DEV-006 | The designation-group-based Domain/Behavioral/Functional course-mix ratio is fully implemented as a scoring rule, but the classification call that would feed it a real value is commented out — the pipeline always runs with `designation_group = None`. | Sits underneath FR-040 | `src/api/v1/course_recommendation.py:182-186,531` |
| DEV-007 | v1 and v3's role-mapping Gemini client hardcodes a Vertex AI region/mode; v2's equivalent client is fully config-driven — an inconsistency across versions rather than a documented per-version design choice. | CON-006 | `src/api/v1/role_mappings.py:38-42`, `src/api/v3/role_mappings.py:32-35` vs. `src/api/v2/role_mappings.py:36-40` |

## Out of scope (not reconstructible from this repo)

- The MDO portal's approval/rejection/publish UI and logic for
  `ApprovalRequest` — this repo only creates the request and emails a link
  into that portal.
- The SPV portal's (or any) approval/rejection logic for
  `DesignationApproval` — no such transition exists in this repo at all.
- The "CB ext course service" that actually publishes an approved plan to
  iGOT (`/cbplan/v2/aicbp/create`, `/aicbp/publish`) — only the offline
  bulk script's calls *into* it are visible here.
- The exact schema/validation contract for `bkConfig`-style external
  payloads is not applicable here, but the equivalent gap exists for
  `cbp_plans.selected_courses` and `role_mappings.competencies` — both
  unvalidated JSONB whose real shape is defined only by whichever code path
  currently writes them.
- The process by which `course_metadata_weightage`/`course_metadata_v3` and
  `designation_embeddings` are kept up to date in a given environment
  (cadence, scheduling, ownership) — the scripts exist in this repo, but
  nothing here documents how/when they are actually run operationally
  outside of the bulk-onboarding README.

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to
> `cbp-ai-service` at `origin/cbrelease-4.8.39`, commit `119a42b`, at the
> file:line cited in its Source column — no requirement here is inferred
> without a citation. No original spec/ticket existed to verify these
> against (see Purpose and method); this document is reconstructed from
> shipped behaviour, not compared to an approved requirement set. The MDO
> portal, SPV portal, and CB-ext-course service are external systems not
> present in this repo — attaching their source, or an originating spec if
> one surfaces, would convert the relevant sections from as-built to a gap
> analysis.
