# AI CBP Tool — Use Cases

All endpoints below are relative to `/api` (mounted at `src/api/__init__.py:8`,
version-prefixed at `src/api/v{1,2,3}/__init__.py`). The deployed
`OAuth2PasswordBearer` `tokenUrl` (`/cbp-tpc-ai/api/v1/auth/login`,
`src/api/dependencies.py:12-16`) suggests the service is actually mounted
behind a gateway under `/cbp-tpc-ai` in at least one environment — not
verified beyond that one string.

## Document journeys

### UC-1 · Upload source documents

A CBP author uploads up to 10 PDFs at a time for their
state-center/department, tagged by type (`Work Allocation Order`,
`Annual Reports`, `Other Document`). Duplicate `(scope, filename, uploader)`
combinations are rejected; each file is stored (local disk or GCS, per
`DOCUMENT_STORAGE_TYPE`) and gets its own `Document` row with
`summary_status = NOT_STARTED`.

- API: `POST /v1/files` — `src/api/v1/document_routes.py:51`

### UC-2 · Summarize a document

Summarization is not automatic on upload — it's a separate, idempotent
call. A background task reads the PDF bytes and sends them to Gemini
(`GEMINI_PRO_MODEL_NAME`) with a single generic summarization prompt (not
type-specific — the same prompt runs for a Work Allocation Order or an
annual report).

- API: `POST /v1/files/{file_id}/summary` — `src/api/v1/document_routes.py:303`
- **Non-obvious mechanism**: `document_type = "Work Allocation Order"` is
  just a label on the `Document` row; there is no WAO-specific extraction
  logic anywhere in the current codebase — a WAO-tagged file is summarized
  by the exact same code path as any other document type.

### UC-3 · Build a meta-summary across several documents

A user can request one synthesized summary spanning several already-summarized
documents that share a state-center/department scope.

- API: `POST /v1/meta-summaries` — `src/api/v1/meta_summary_routes.py:106`
- **Known bug**: if a referenced document isn't already `COMPLETED`, the
  handler tries to regenerate its summary by calling
  `_run_document_summary(doc.file_id)` **without `await` and without
  scheduling it as a background task** (`meta_summary_routes.py:47,49`) — the
  coroutine is created and immediately discarded, the document's summary
  never actually regenerates, and the whole meta-summary batch is marked
  `FAILED`. In practice: every input document must already have a
  `COMPLETED` summary before requesting a meta-summary.

## Role mapping journeys

### UC-4 · Generate role mappings from uploaded documents

The author triggers generation for a state-center(+department); a
placeholder `IN_PROGRESS` row is created immediately (locking that scope
against a second concurrent generation) and a background task does the real
work. Three versions coexist with materially different behavior:

- **v1** (`POST /v1/role-mapping/generate`, `src/api/v1/role_mappings.py:150`):
  single Gemini call, sourced from a dedicated `state_center_data` table's
  ACBP/work-allocation summaries (uploaded via a separate legacy endpoint,
  UC-9); on a prior failure it auto-deletes and retries.
- **v2** (`POST /v2/role-mapping/generate`, `src/api/v2/role_mappings.py:151`):
  single Gemini call, sourced from the generic `documents` table (all
  summarized document types concatenated, undifferentiated); same
  auto-retry-on-failure behavior as v1.
- **v3** (`POST /v3/role-mapping/generate`, `src/api/v3/role_mappings.py:163`):
  a three-pass pipeline — extract the designation hierarchy first (Work
  Allocation Order summaries only), generate FRAC competencies per
  designation batch in parallel, then reconcile every Behavioral/Functional
  competency against a fixed competency taxonomy (`data/competencies_level.json`),
  dropping anything that can't be resolved. Unlike v1/v2, an exception here
  propagates to a real `FAILED` status with the actual error message, a
  prior `FAILED` state is **not** auto-retried (returns `FAILED` as-is), and
  successful generation automatically kicks off iGOT designation matching
  (UC-5) for every new designation.

### UC-5 · Reconcile a designation against iGOT's designation master

Each role mapping's free-text designation name gets resolved to an iGOT
designation ID via two strategies run in sequence: an **exact match**
(proxied through iGOT's own `/api/designation/search`, matched
case-insensitively — not a local DB lookup) and, for names that don't match
exactly, a **semantic match** (Gemini `gemini-embedding-2` embeddings,
Redis-cached indefinitely, nearest neighbor via pgvector cosine distance
against a `designation_embeddings` table populated offline).

- API: `POST /v1/role-mapping/match-designations` — manual call, v1 only
  (`src/api/v1/role_mappings.py:329`)
- Automatic, fire-and-forget, immediately after v3 generation
  (`src/api/v3/role_mappings.py:115-143`) — v1 and v2 have no such
  automatic step.
- **Discrepancy found**: the acceptance threshold for the semantic match is
  documented in two places as `0.92` (`.env.example:26`, and the matcher's
  own docstrings) but defaults to `0.93` in the Pydantic settings field
  (`src/core/configs.py:35`) — the effective value depends on which `.env`
  is actually deployed.

### UC-6 · Escalate an unmatched designation

If a designation has no iGOT match, the author can submit it for naming
approval to SPV Admins (looked up via iGOT user-search and emailed a link).

- API: `POST /v1/designation-approval/create` — `src/api/v1/designation_approval.py:29`
- **Honest gap**: there is no approve/reject endpoint for this request
  anywhere in the repo. The model's `status` field only ever gets set to
  `pending` in code; a recently-added `actioned_by` column
  (`src/models/designation_approval.py:38`) is never written to by any
  traced code path. Whatever actually approves or rejects this request is
  outside this repo — or not yet built.

### UC-7 · Add one designation manually

A single new designation can be added outside the bulk-generation flow;
v2's version additionally reconciles the generated competencies against the
same KCM taxonomy used by v3's third pass.

- APIs: `POST /v1/role-mapping/add-designation`, `POST /v2/role-mapping/add-designation`

### UC-8 · Reorder, search, edit, delete role mappings

Standard CRUD plus a drag-and-drop reorder — all v1-only; v2 and v3 expose
no equivalent routes, so any UI built against v2/v3-generated data must fall
back to v1's endpoints for everything except generation itself.

- APIs: `PUT /v1/role-mapping/reorder`, `POST /v1/role-mapping/search`,
  `GET`/`PUT`/`DELETE /v1/role-mapping/{id}`

### UC-9 · Upload documents the legacy way (v1 role-mapping source only)

A separate, older upload path feeds v1 generation specifically: one ACBP
plan PDF and one Work Allocation Order PDF per state-center/department,
summarized via a hardcoded WAO-focused prompt distinct from the generic
document summarizer.

- API: `POST /v1/state-center-data/upload_documents_background` — `src/api/v1/state_center_data.py:81`

## Course and plan journeys

### UC-10 · Generate AI course recommendations

For a completed role mapping, a background job builds five search queries
(general + separate functional/behavioral competency queries), embeds them,
runs four parallel searches over a pgvector-backed course table (a 40%
keyword-embedding / 20% description-embedding / 40% combined-embedding
weighted hybrid score, plus keyword and competency-type bonuses), then
sends the merged candidate pool to Gemini for relevancy scoring and
reranking. Only courses scoring ≥80 relevancy survive into the stored
result.

- API: `POST /v1/course-recommendations/generate` — `src/api/v1/course_recommendation.py:598`
- **Non-obvious mechanism**: this runs as an in-process FastAPI
  `BackgroundTasks` job, not a task queue — there is no Celery/RQ worker
  anywhere in this repo despite a CRUD docstring mentioning one as a design
  note.

### UC-11 · Curate course suggestions straight from iGOT

Independent of the AI recommendation, a user can search iGOT's own content
catalog and save a plain list of course identifiers against a role mapping
— no scoring, no AI involvement.

- APIs: `POST /v1/course/suggestions`, `POST /v1/course/suggestions/save`

### UC-12 · Add a fully manual course

A user can add an external course (e.g. a non-iGOT platform link) by hand,
with its own relevancy/rationale/competency tags — entirely independent of
both the AI pipeline and iGOT's catalog.

- API: `POST /v1/user-added-courses`

### UC-13 · Build the CBP Plan

The author picks course identifiers; the save handler resolves each one
against, in order, the latest recommendation's filtered list, then a live
iGOT content search (tagging these with a fixed relevancy of 90), then the
user-added-courses table — concatenating all three into one plan. Creating
a CBP Plan requires a recommendation to already exist for that role
mapping; there is no draft/submitted/approved status on the plan record
itself.

- API: `POST /v1/cbp-plan/save` — `src/api/v1/cbp_plan.py:63`

### UC-14 · Send CBP plans for approval

A batch of completed role mappings (each with a saved CBP plan) is bundled
into one approval request; each is snapshotted into its own
`ApprovalRequestItem` (a frozen copy of the role/competency/plan data, not a
live reference), and the assigned MDO admin is emailed a link into a
separate MDO-facing review portal.

- API: `POST /v1/approval-requests/send` — `src/api/v1/approval_requests.py:45`

### UC-15 · Revoke a pending approval request

Only while the request is still `PENDING` — reverts it to `DRAFT`.

- API: `POST /v1/approval-requests/revoke` — `src/api/v1/approval_requests.py:344`

### UC-16 · (External) Approve, reject, and publish

Nothing in this repo's live API transitions an approval request to
`APPROVED` or `REJECTED`, and nothing calls whatever ultimately publishes a
plan to iGOT. The one place that logic exists in this repo is an offline
operator script that mirrors it directly against the shared database and an
external "CB ext course service" — see UC-19.

### UC-17 · View dashboards and gap analysis

Org-wide KPIs and a per-competency "no course recommended for this
competency" gap report, plus self-scoped equivalents for any authenticated
user looking at their own role mappings.

- APIs: `POST /v1/dashboard/cbp-summary-trends`, `/cbp-dashboard-metrics`,
  `/gap-analysis` (Super Admin only) · `/my-dashboard-metrics`,
  `/my-gap-analysis` (any user, self-scoped)

### UC-18 · Download a PDF report

Renders a CBP plan, ACBP plan (state/department, across all completed role
mappings, with optional Bhashini translation), or a single role mapping's
recommended-course view as a PDF (Jinja2 → HTML → Playwright/Chromium).

- APIs: `GET /v1/reports/cbp-plan/download`, `/acbp-plan/download`,
  `/course-recommendations/download`

## Operator journeys (offline `bulk_scripts/`)

### UC-19 · Bulk-onboard a state/ministry

A human operator runs a fixed six-stage pipeline from a jumphost, in order,
each stage its own standalone script reading an input Excel/CSV and writing
an outcome CSV: copy source documents into scope → summarize them →
generate v3 role mappings (a reduced two-pass version) → recommend courses
and save CBP plans → submit for approval (⚠️ **not safe to re-run** — no
dedup check, re-running duplicates requests and emails) → publish approved
plans to iGOT via the external CB-ext-course-service's `aicbp/create` +
`aicbp/publish` APIs (needs a live SSO token and, from outside the cluster,
a `kubectl port-forward`). This last stage is the only place in the entire
repo where an approval request is actually driven to `APPROVED` and pushed
to iGOT.

- Scripts: `bulk_scripts/batch_copy_all_documents.py`,
  `batch_document_summary.py`, `batch_rolemapping_generate.py`,
  `batch_generate_and_save_cbp_plan.py`, `batch_send_approval_requests.py`,
  `bulk_training_plan_approval.py`

### UC-20 · Re-match or hand-correct after the fact

Separate one-off tools: re-run designation matching for a list of role
mappings (`match_igot_designation.py`), bulk add/remove courses on an
existing recommendation or CBP plan
(`bulk_update_courses_by_role_mapping.py`), or clone a role mapping's FRAC
content to a new scope (`copy_role_mapping_by_designation.py`).

## Edge cases

| Situation | Behaviour |
|---|---|
| Meta-summary requested over a non-`COMPLETED` document | Silently fails to regenerate it (missing `await`) and marks the whole batch `FAILED` |
| Designation similarity threshold | Config default (`0.93`) disagrees with documented value (`0.92`) — effective value is whichever `.env` is actually deployed |
| v1/v2/v3 role-mapping endpoint surface | Not a superset — v2 has no search/reorder/match/CRUD routes, v3 has no routes beyond `generate` at all; a UI must call v1 for everything except generation |
| WAO-derived Domain competencies (per commit history) | Built, then disabled by config default, then fully deleted from the codebase before this branch's HEAD — WAO content today only enters competency generation as one undifferentiated document summary among others |
| `DesignationApproval.actioned_by` | Present on the model and response schema; no code path anywhere writes to it |
| `ApprovalRequest` status `APPROVED`/`REJECTED` | Never assigned by this repo's live API — only the offline `bulk_training_plan_approval.py` script sets it, by talking to a separate external service |
| Gemini client config (role-mapping v1/v2/v3) | v1 and v3 hardcode `location="us-central1"`; only v2 uses the configurable location/retry settings — an inconsistency across versions, not a documented design choice |
| Meta-summary model name | Hardcoded to `"gemini-2.5-pro"` in `meta_summary_routes.py`, independent of the configurable `GEMINI_PRO_MODEL_NAME` used everywhere else — a config change to that setting silently has no effect here |
| Course added to a CBP plan from iGOT search or a suggestion (not the AI recommendation) | Stamped with a fixed relevancy of 90 (`DEFAULT_RELEVANCY_SCORE`), not an AI-derived score |
| Designation-group-based course-mix ratio (Domain/Behavioral/Functional split) | Exists in code as a computed rule but is currently hardcoded to unused (`designation_group = None`) in the live recommendation pipeline |

> **Verification boundary:** all use cases above are traced to
> `cbp-ai-service` at `origin/cbrelease-4.8.39`, commit `119a42b`. The actual
> approve/reject/publish decision system (referred to in code/docs as the
> "MDO service" / "CB ext course service") is not present in this repo —
> only the calls made *into* it (from the notification email link and from
> `bulk_training_plan_approval.py`) are visible here. Attaching that
> system's own repo would close this gap.
