# Operations Manual — AI CBP Tool

How to operate, support, and troubleshoot `cbp-ai-service` as it exists
today — a FastAPI monolith over Postgres/pgvector and Redis, calling
Google Gemini/Vertex AI and several iGOT-side services, plus a separate
directory of offline batch scripts for bulk onboarding.

**Operational implication:** most of the pipeline runs as in-process
background tasks, not a task queue — there is no worker fleet to check, but
also no retry/backoff infrastructure beyond what each endpoint implements
itself. And the approval loop is genuinely open: this service cannot tell
you whether a submitted CBP plan was approved, rejected, or published —
that state lives in a system outside this repo.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Background jobs | FastAPI `BackgroundTasks`, in-process | No separate worker process to restart; a job dies with the app process if it crashes mid-task |
| Primary storage | Postgres + pgvector, schema via `create_all` (no Alembic) | No migration history to roll back — only the current model files describe the schema |
| Course search tables | `course_metadata_weightage` (primary) / `course_metadata_v3` (legacy fallback) | Neither has an ORM model — populated/maintained only by `scripts/course_embedding_pipeline.py`, run separately from the app |
| Designation embeddings | `designation_embeddings`, populated **offline only** | If designation matching seems to be missing recent iGOT designations, the ingestion script needs a re-run, not an app restart |
| Email notifications | Outbound only, gated by `ENABLE_EMAIL_NOTIFICATION` | If notifications silently stop, check this flag before assuming the notification service is down |
| Approval loop | Create + email only; approve/reject/publish is external | Never search this repo for a "why wasn't this approved" bug — check with the MDO-portal team instead |
| Container | Runs as root (no `USER` in `Dockerfile` on this branch) | Flag for security review — a later `main`-branch change adds a non-root user but is not present here |

## Important configuration

| Setting | Meaning | Why it matters |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (`asyncpg` driver) | Required, no default — app fails to start without it |
| `GOOGLE_API_KEY` / `GOOGLE_PROJECT_ID` / `GOOGLE_APPLICATION_CREDENTIALS` | Gemini/Vertex AI credentials | Two auth modes coexist: Vertex (project/location) for generation, plain API-key mode for some embeddings — both must be valid |
| `GEMINI_PRO_MODEL_NAME` / `GEMINI_FLASH_MODEL_NAME` | Model names for generation | **Not** honored by `meta_summary_routes.py`, which hardcodes `"gemini-2.5-pro"` — a model-name change here silently won't affect meta-summaries |
| `GOOGLE_EMBEDDING_MODEL` / `EMBEDDING_OUTPUT_DIMENSIONALITY` | Embedding model + vector size | Must match the dimensionality of whatever populated `designation_embeddings` / `course_metadata_weightage`, or similarity search breaks silently (dimension mismatch errors) |
| `DESIGNATION_SIMILARITY_THRESHOLD` | Semantic-match acceptance cutoff | Config default (`0.93`) disagrees with the documented value (`0.92`, in `.env.example` and the matcher's own docstrings) — confirm the actual deployed value per environment before tuning match rates |
| `COURSE_RECOMMENDATION_MIN_RELEVANCY` (80) / `DEFAULT_RELEVANCY_SCORE` (90) | Recommendation cutoff / fixed score for non-AI-sourced plan courses | If recommendations look sparse, check this floor before assuming the search itself is broken |
| `ENABLE_EMAIL_NOTIFICATION`, `NOTIFICATION_BASE_URL`, `SPV_PORTAL_URL`, `MDO_PORTAL_URL` | Email gate + outbound targets | All default to empty/`False` — must be set per environment or approval/designation emails silently never send |
| `DOCUMENT_STORAGE_TYPE` | `local` or `gcp` | Determines whether uploaded PDFs live on local disk (`DOCUMENT_STORAGE_ROOT`) or GCS (`GCP_STORAGE_BUCKET`) |
| `ENABLE_TOKEN_BLACKLIST` | Session-backed JWT validation | If `True` (default), logout/session-cleanup actually invalidates tokens server-side; if disabled, a "logged out" JWT stays valid until expiry |
| `CB_EXT_COURSE_SERVICE_URL` | External publish-API base URL | Not part of the app's `Settings` — read directly from the environment only by `bulk_scripts/bulk_training_plan_approval.py`; irrelevant to the running API service |

## Operational workflows

**Document intake**: upload (`POST /files`) → explicitly trigger summary
(`POST /files/{id}/summary`, idempotent) → optionally build a meta-summary
across several documents (`POST /meta-summaries`). **Known bug**: if any
input document to a meta-summary isn't already `COMPLETED`, the code tries
to regenerate it but does so via an unawaited, unscheduled coroutine
(`src/api/v1/meta_summary_routes.py:47,49`) — the regeneration silently
never happens and the batch is marked `FAILED`. Support should always
confirm every input document's `summary_status` is `COMPLETED` before
diagnosing a meta-summary failure as anything else.

**Role-mapping generation**: pick the right version before troubleshooting
— v1/v2/v3 are different code paths, not different API versions of the
same logic. v1 and v2 auto-retry a prior `FAILED` state and swallow the
real Gemini error into a generic message; v3 does neither (it surfaces the
real error and requires a fresh `/generate` call to actually attempt a
retry — simply calling `/generate` again on a `FAILED` v3 mapping returns
the same `FAILED` state without retrying). Only v3 auto-runs iGOT
designation matching; v1 requires a separate manual call
(`POST /v1/role-mapping/match-designations`), and v2 has no matching
endpoint at all.

**Designation matching troubleshooting**: check strategy order — exact
match hits iGOT's live designation-search API (so a designation that
exists in iGOT but is momentarily unreachable will fall through to
semantic match, not fail outright); semantic match depends on Redis cache
freshness (cache entries never expire — a stale/renamed designation
embedding won't self-correct without a manual cache flush or table
refresh) and on the similarity threshold ambiguity noted above.

**Course recommendation troubleshooting**: this is a five-stage,
fully-parallel background task — an incomplete/`FAILED` result usually
means one of the parallel Gemini calls (query generation or the final
filter/rerank) errored; `error_message` on the `recommended_courses` row
carries the real exception text. There is no partial-progress
indicator — a job is either `IN_PROGRESS`, `COMPLETED`, or `FAILED`
wholesale.

**CBP Plan support**: remember a plan has no lifecycle status of its own —
"is this plan finalized" is not a question this table can answer; the only
lifecycle state lives one level up, on whatever `ApprovalRequest` (if any)
later snapshotted it. A course showing relevancy 90 in a plan does not mean
the AI scored it — it means it was added via iGOT search or a suggestion,
not the recommendation engine.

**Approval-request support**: this repo can confirm a request was created,
who it's assigned to (`mdo_id`), and whether it's still `PENDING`/`DRAFT` —
it cannot tell you whether the assigned MDO admin has reviewed it, approved
it, or published it to iGOT. For that, escalate to whoever owns the MDO
portal. The one place in this repo that actually performs that
approve+publish action is the offline `bulk_training_plan_approval.py`
script — used for bulk onboarding, not for resolving individual stuck
requests.

**Designation-approval support**: same caveat as above, one level down —
there is no approve/reject action anywhere in this repo's code for
`designation_approvals`. If a requester reports "my designation name was
never approved," the only things to check here are whether the request was
actually created and whether the SPV-admin notification email actually
sent (`ENABLE_EMAIL_NOTIFICATION`) — the resolution itself is out of scope
for this service.

## Offline bulk-onboarding pipeline (`bulk_scripts/`)

Run manually from a jumphost, in strict order, one stage at a time:

1. `batch_copy_all_documents.py` — seed source documents into the target user/scope.
2. `batch_document_summary.py` — summarize them (reuses the live app's own summarization code).
3. `batch_rolemapping_generate.py` — generate v3 role mappings (a reduced, two-pass version of the live pipeline).
4. `batch_generate_and_save_cbp_plan.py` — recommend courses and save CBP plans.
5. `batch_send_approval_requests.py` — submit for MDO approval. ⚠️ **Not safe to re-run** — no dedup check; re-running duplicates requests and emails.
6. `bulk_training_plan_approval.py` — publish approved plans to iGOT via the external CB-ext-course-service. Requires a live SSO token fetch and, if run outside the cluster, a `kubectl port-forward` to reach `CB_EXT_COURSE_SERVICE_URL`.

All scripts: dry-run by default (require an explicit `--execute` flag to
write anything), write one outcome CSV + one timestamped log per run, and
read all configuration from environment variables only (never CLI flags).
Except stage 5, all are safe to re-run (they check existing state and skip
or retry as appropriate). To check a long-running job: `ps aux | grep
<script>.py`; to stop one: `kill <PID>`, escalating to `kill -9` if needed
— safe mid-run, since the outcome CSV/log are flushed incrementally.
Diagnose a failed run from its outcome CSV's `status`/`error` columns
first, then the matching timestamped log for the full traceback.

## Publishing / go-live checklist (per state/ministry onboarding)

- [ ] Source documents (Work Allocation Order at minimum) uploaded and summarized (`summary_status = COMPLETED`)
- [ ] Role mappings generated and `status = COMPLETED` for every expected designation
- [ ] Designation matching run (manual for v1, automatic for v3) — check for any designations still missing an `igot_designation_id`
- [ ] Any unmatched designation either escalated via designation-approval or accepted as unmatched
- [ ] Course recommendations generated (`status = COMPLETED`) for every completed role mapping
- [ ] CBP plans saved for every role mapping intended for approval
- [ ] Approval request sent, assigned MDO admin confirmed correct
- [ ] (Bulk onboarding only) publish stage run and outcome CSV shows `APPROVED`/published for every expected item

## Known operational constraints

- No task queue — background jobs run in-process; a crashed app instance can leave a job stuck `IN_PROGRESS` with no automatic recovery.
- No migration tool — schema changes require reviewing model file diffs directly, not a migration log.
- No admin endpoint to force-approve, force-reject, or repair a stuck `ApprovalRequest`/`DesignationApproval` — those transitions don't exist in this repo at all.
- No dedup safeguard in `batch_send_approval_requests.py` — re-running it duplicates requests and emails.
- Container runs as root on this branch — no non-root user configured in `Dockerfile`.
- CORS is configured with `allow_origins=["*"]` and `allow_credentials=True` together (`src/main.py:48-54`) — a combination most browsers/spec guidance treat as unsafe; flag for security review rather than treating as an operational non-issue.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Document upload/summary/meta-summary failures | Backend team (this repo) | `summary_status`/meta-summary `status` is `FAILED` and the error is inside this codebase |
| Role-mapping generation failures | Backend team (this repo) | `role_mappings.status = FAILED` with an error message from Gemini or this codebase |
| Designation matching accuracy | Backend team (this repo) + iGOT designation-master owner | Confirm which side is at fault: iGOT search unreachable (exact-match side) vs. stale/incorrect embeddings (semantic side) |
| Course recommendation quality/failures | Backend team (this repo) | `recommended_courses.status = FAILED`, or relevancy floor tuning |
| Approval request stuck / not reviewed | MDO portal team (external) | Request is `PENDING` in this repo and the assigned MDO admin hasn't acted — not this repo's responsibility to resolve |
| Designation-naming request stuck | SPV portal team (external) / product owner | Same caveat — no resolution mechanism exists in this repo |
| Publish-to-iGOT failures (bulk pipeline) | Backend team (this repo) + CB-ext-course-service owner | `bulk_training_plan_approval.py`'s outcome CSV shows a failed `create`/`publish` call |

## FAQ

**Why does a CBP plan show no status?** Because there isn't one — lifecycle
tracking for a submitted plan lives on whatever `ApprovalRequest` later
referenced it, not on the plan row itself.

**Why can't support approve or reject a pending request from here?**
Because that action isn't implemented in this codebase. It happens in the
external MDO portal (for CBP approval requests) or wherever the SPV
process lives (for designation-naming requests) — neither of which is part
of this repo.

**Why did my meta-summary fail even though all my documents look fine?**
Check each input document's individual `summary_status` first — if any
weren't already `COMPLETED`, the meta-summary's own attempt to regenerate
them silently no-ops (a missing-`await` bug), and the whole batch fails.

**Why does the AI recommendation for a designation include so few courses
under a certain competency?** Check whether the designation-group-based mix
ratio matters here — it's computed in code but the classification call
feeding it is currently disabled, so results always reflect the
undifferentiated hybrid-search + LLM-rerank path, not a group-tuned mix.

> **Verification boundary:** this manual is sourced entirely from
> `cbp-ai-service` at `origin/cbrelease-4.8.39`, commit `119a42b`. Deeper
> runbook detail for the MDO portal, the SPV portal, and the CB-ext-course
> service would need those systems' own operations documentation attached —
> none of the three is present in this repo.
