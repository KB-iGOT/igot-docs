# Operations Manual — AI CBP Tool

How to operate, support, and troubleshoot the AI CBP Tool as it exists
today — two independent FastAPI services (`cbp-ai-service`,
`ai-cbp-mdo-service`) that share one Postgres database and never call each
other's API, plus `cbp-ai-ui`, a thin Angular shell around a private,
unavailable feature library.

**Operational implication:** because the two backends never call each
other, there is no single place to check "did this approval go through" —
`cbp-ai-service` can only tell you a request exists and its last-known
status; `ai-cbp-mdo-service` is what actually changes that status. A
support engineer investigating a stuck approval needs **both** services'
logs/DB access, not just the one the ticket happened to name.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Inter-service integration | No API call between `cbp-ai-service` and `ai-cbp-mdo-service` — both point at the same `approval_requests`/`approval_request_items`/`users` tables | A schema change to these tables in one repo's models must be manually kept in sync with the other's mirror — there is no shared migration or contract test |
| Background jobs (`cbp-ai-service`) | FastAPI `BackgroundTasks`, in-process | No separate worker process to restart; a job dies with the app process if it crashes mid-task |
| Background jobs (`ai-cbp-mdo-service`) | None for the core publish/approve logic — the iGOT round-trip happens synchronously inside the request; only the outcome email is backgrounded | A slow/unresponsive iGOT `cbplan/v2/create` or `publish` call blocks the MDO admin's own request, not a worker |
| Primary storage (both) | Postgres, schema via `create_all` (no Alembic in either repo) | No migration history to roll back on either side — only the current model files describe the schema |
| Course search tables (`cbp-ai-service`) | `course_metadata_weightage` (primary) / `course_metadata_v3` (legacy fallback) | Neither has an ORM model — populated/maintained only by `scripts/course_embedding_pipeline.py`, run separately from the app |
| Designation embeddings (`cbp-ai-service`) | `designation_embeddings`, populated **offline only** | If designation matching seems to be missing recent iGOT designations, the ingestion script needs a re-run, not an app restart |
| Email notifications (both) | Outbound only, each independently gated by its own `ENABLE_EMAIL_NOTIFICATION` flag | The two services can have notifications enabled/disabled independently of each other — check the right one |
| Approval loop | Closed, but **per item, not per request** — `ai-cbp-mdo-service`'s publish can leave a request `APPROVED` with some items still `FAILED` | Never assume "request shows APPROVED" means every designation actually published — check item-level status |
| Health checks | `cbp-ai-service` has `GET /api/v1/health`; `ai-cbp-mdo-service` has **no health/liveness endpoint at all** | Liveness probes for `ai-cbp-mdo-service` cannot use an HTTP health check the way `cbp-ai-service`'s can |
| `cbp-ai-ui` deployment | Built with `ng build` (not `--configuration production`) inside its `Dockerfile`, served via Apache HTTPD (`httpd:alpine`) from `dist/cbp-ai-ui`, expected under a `/training-pla-ai/` sub-path | The Docker image as written does not apply Angular's `production` build configuration/environment file unless CI overrides the build command — worth confirming per environment |
| `cbp-ai-ui` backend URL | Read at runtime from a static JSON asset (`assets/jsonfiles/configurations.json`'s `portalURL`), not from an Angular environment file | Switching `cbp-ai-ui` to point at a different backend means replacing this JSON asset in the deployed build, not rebuilding with a different `--configuration` |

## Important configuration — `cbp-ai-service`

| Setting | Meaning | Why it matters |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (`asyncpg` driver) | Required, no default — app fails to start without it. **Same physical database `ai-cbp-mdo-service` must also be pointed at** for the two services to actually share rows |
| `GOOGLE_API_KEY` / `GOOGLE_PROJECT_ID` / `GOOGLE_APPLICATION_CREDENTIALS` | Gemini/Vertex AI credentials | Two auth modes coexist: Vertex (project/location) for generation, plain API-key mode for some embeddings — both must be valid |
| `GEMINI_PRO_MODEL_NAME` / `GEMINI_FLASH_MODEL_NAME` | Model names for generation | **Not** honored by `meta_summary_routes.py`, which hardcodes `"gemini-2.5-pro"` — a model-name change here silently won't affect meta-summaries |
| `GOOGLE_EMBEDDING_MODEL` / `EMBEDDING_OUTPUT_DIMENSIONALITY` | Embedding model + vector size | Must match the dimensionality of whatever populated `designation_embeddings` / `course_metadata_weightage`, or similarity search breaks silently (dimension mismatch errors) |
| `DESIGNATION_SIMILARITY_THRESHOLD` | Semantic-match acceptance cutoff | Config default (`0.93`) disagrees with the documented value (`0.92`, in `.env.example` and the matcher's own docstrings) — confirm the actual deployed value per environment before tuning match rates |
| `COURSE_RECOMMENDATION_MIN_RELEVANCY` (80) / `DEFAULT_RELEVANCY_SCORE` (90) | Recommendation cutoff / fixed score for non-AI-sourced plan courses | If recommendations look sparse, check this floor before assuming the search itself is broken. `ai-cbp-mdo-service` has its **own**, independently-configured `DEFAULT_RELEVANCY_SCORE` (also default 90) for courses it adds during MDO review — the two settings are not shared |
| `ENABLE_EMAIL_NOTIFICATION`, `NOTIFICATION_BASE_URL`, `SPV_PORTAL_URL`, `MDO_PORTAL_URL` | Email gate + outbound targets | All default to empty/`False` — must be set per environment or approval/designation emails silently never send |
| `DOCUMENT_STORAGE_TYPE` | `local` or `gcp` | Determines whether uploaded PDFs live on local disk (`DOCUMENT_STORAGE_ROOT`) or GCS (`GCP_STORAGE_BUCKET`) |
| `CB_EXT_COURSE_SERVICE_URL` | External publish-API base URL | Not part of the app's `Settings` — read directly from the environment only by `bulk_scripts/bulk_training_plan_approval.py`; irrelevant to the running API service; **not confirmed** to be the same downstream target as `ai-cbp-mdo-service`'s `KB_BASE_URL` |

## Important configuration — `ai-cbp-mdo-service`

| Setting | Meaning | Why it matters |
|---|---|---|
| `DATABASE_URL` | Postgres connection string, required, no default | **Must point at the same physical database as `cbp-ai-service`** — if it doesn't, MDO admins will simply see no requests, with no error to indicate why |
| `KB_BASE_URL` (default `https://<PORTAL_HOST_DEV>`) | Base URL for every outbound iGOT call: CBP-plan create/publish, designation create, content/designation search| A wrong value here breaks the publish flow |
| `ENABLE_EMAIL_NOTIFICATION`, `NOTIFICATION_BASE_URL` | Email gate + target, independent of `cbp-ai-service`'s own equivalents | Must be set per environment or MDO/SPV outcome emails silently never send, even if `cbp-ai-service`'s own flag is on |
| `DEFAULT_RELEVANCY_SCORE` (90) | Score stamped on a course added during MDO review via `course/add` | Independent of `cbp-ai-service`'s same-named, same-default setting |

## Important configuration — `cbp-ai-ui`

| Setting | Meaning | Why it matters |
|---|---|---|
| `assets/jsonfiles/configurations.json` → `portalURL` | Runtime backend base URL, fetched at app-init | The actual environment switch — not `environment.ts`/`environment.prod.ts`, which carry no API URL at all |
| `assets/jsonfiles/configurations.json` → `isMaintenancePage` | Intended maintenance-mode flag | Not actually wired to anything in the code reviewed — the maintenance check inspects the URL for `/maintenance` directly, ignoring this field |

## Operational workflows — `cbp-ai-service` (author side)

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
same logic. `cbp-ai-ui`'s shipped client calls **v3** for generation, so
production generation failures should be triaged as v3 issues first. v1
and v2 auto-retry a prior `FAILED` state and swallow the real Gemini error
into a generic message; v3 does neither (it surfaces the real error and
requires a fresh `/generate` call to actually attempt a retry — simply
calling `/generate` again on a `FAILED` v3 mapping returns the same
`FAILED` state without retrying). Only v3 auto-runs iGOT designation
matching; `cbp-ai-ui` additionally exposes a manual re-match call (v1's
`match-designations`) from its own UI.

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

**CBP Plan support**: remember a plan has no lifecycle status of its own on
the `cbp-ai-service` side — the real lifecycle question ("was this
approved, rejected, or published") is answered by
`ai-cbp-mdo-service`'s copy of the data, not this table. A course showing
relevancy 90 in a plan does not mean the AI scored it — it means it was
added via iGOT search or a suggestion, not the recommendation engine.

**Approval-request support (author side)**: `cbp-ai-service` can confirm a
request was created, who it's assigned to (`mdo_id`), and its
last-known `status`/`DRAFT` state — for the actual review/approve/reject/
publish history, escalate to whoever operates `ai-cbp-mdo-service` (see
below), since that's the service actually driving those transitions.

## Operational workflows — `ai-cbp-mdo-service` (MDO / SPV side)

**Publish troubleshooting**: a "publish" call is per-item, not
all-or-nothing.
- If the whole call returns `400`: no item in the request was still
  `PENDING` — likely a duplicate publish attempt on an already-processed
  request.
- If it returns `502`: **every** eligible item failed its iGOT round-trip —
  the request itself is left `PENDING`, unchanged; check `KB_BASE_URL`
  reachability first.
- If it returns success but the response shows `items_failed > 0`: the
  request is now `APPROVED` regardless, with the failed items sitting
  `FAILED` — use `/publish/retry` per item rather than re-running the whole
  publish (which will no-op for already-non-`PENDING` items).
- An item with `error = "No CBP Plan found for this item."` never reached
  iGOT at all — the problem is upstream, in what `cbp-ai-service` snapshotted
  into `cbp_plan_data`, not in `ai-cbp-mdo-service` or iGOT.

**Reject troubleshooting**: rejecting the whole request requires a 1–500
character comment (empty/whitespace-only is rejected by validation);
rejecting a single item recomputes the parent request's status from
whatever items remain — if a requester reports "my request shows APPROVED
but I only rejected some items," that's expected: it means at least one
other item in the same request is `APPROVED`.

**Item edit / course add-remove troubleshooting**: `items/update` requires
the *target item* to still be `PENDING`; `course/add`/`course/remove`
check only the *parent request's* status, so they can technically still
succeed against an already-`APPROVED`/`REJECTED`/`FAILED` item as long as
the request itself is `PENDING` (e.g., other items in the same request
still pending review) — this is an as-built asymmetry, not a bug to "fix"
without checking with the doc owner first. A course added via `course/add`
always lands on the **first** record in `cbp_plan_data` — if a request's
item has multiple plan records (not the common case), later records are
never targeted by this endpoint.

**SPV designation-approval troubleshooting**: approval calls iGOT *before*
touching the database — if a requester reports "my designation was
approved but doesn't show up in iGOT," check for an "Already Present"
response first (which is treated as success but adds no new designation);
if approval fails outright, the database record stays `PENDING` and is
safe to retry. Reject never calls iGOT.

**No health endpoint**: `ai-cbp-mdo-service` has no `/health` or equivalent
route — liveness/readiness checks against this service must rely on a TCP
check or an actual API call, not an HTTP health probe.

## Offline bulk-onboarding pipeline (`bulk_scripts/`, in `cbp-ai-service`)

Run manually from a jumphost, in strict order, one stage at a time:

1. `batch_copy_all_documents.py` — seed source documents into the target user/scope.
2. `batch_document_summary.py` — summarize them (reuses the live app's own summarization code).
3. `batch_rolemapping_generate.py` — generate v3 role mappings (a reduced, two-pass version of the live pipeline).
4. `batch_generate_and_save_cbp_plan.py` — recommend courses and save CBP plans.
5. `batch_send_approval_requests.py` — submit for MDO approval. ⚠️ **Not safe to re-run** — no dedup check; re-running duplicates requests and emails.
6. `bulk_training_plan_approval.py` — publish approved plans to iGOT via `CB_EXT_COURSE_SERVICE_URL`, a **separate, independently-configured target from `ai-cbp-mdo-service`'s own `KB_BASE_URL`** used for the same conceptual action online. Requires a live SSO token fetch and, if run outside the cluster, a `kubectl port-forward`.

All scripts: dry-run by default (require an explicit `--execute` flag to
write anything), write one outcome CSV + one timestamped log per run, and
read all configuration from environment variables only (never CLI flags).
Except stage 5, all are safe to re-run (they check existing state and skip
or retry as appropriate). To check a long-running job: `ps aux | grep
<script>.py`; to stop one: `kill <PID>`, escalating to `kill -9` if needed
— safe mid-run, since the outcome CSV/log are flushed incrementally.
Diagnose a failed run from its outcome CSV's `status`/`error` columns
first, then the matching timestamped log for the full traceback. **This
stage bypasses `ai-cbp-mdo-service` entirely** — it writes `APPROVED`
directly to the shared database and calls a different downstream publish
target, so a bulk-published plan will never appear in `ai-cbp-mdo-service`'s
own audit table (`mdo_approval`).

## Publishing / go-live checklist (per state/ministry onboarding)

- [ ] Source documents (Work Allocation Order at minimum) uploaded and summarized (`summary_status = COMPLETED`)
- [ ] Role mappings generated and `status = COMPLETED` for every expected designation
- [ ] Designation matching run (manual for v1, automatic for v3) — check for any designations still missing an `igot_designation_id`
- [ ] Any unmatched designation either escalated via designation-approval or accepted as unmatched
- [ ] Course recommendations generated (`status = COMPLETED`) for every completed role mapping
- [ ] CBP plans saved for every role mapping intended for approval
- [ ] Approval request sent, assigned MDO admin confirmed correct
- [ ] MDO admin has reviewed/published in `ai-cbp-mdo-service` (or, for bulk onboarding, the publish stage ran and its outcome CSV shows a successful publish for every expected item)

## Known operational constraints

- No task queue on the `cbp-ai-service` side — background jobs run in-process; a crashed app instance can leave a job stuck `IN_PROGRESS` with no automatic recovery.
- No migration tool on either backend — schema changes require reviewing model file diffs directly, not a migration log, and the two services' mirrored tables have no shared source of truth.
- No admin endpoint anywhere (either repo) to force-approve, force-reject, or repair a stuck `ApprovalRequest`/`DesignationApproval` beyond `ai-cbp-mdo-service`'s own approve/reject/retry endpoints.
- No dedup safeguard in `batch_send_approval_requests.py` — re-running it duplicates requests and emails.
- `ai-cbp-mdo-service` has no test suite and no health endpoint at all (confirmed absent, not just unlisted).
- `cbp-ai-ui`'s own unit/E2E test suite is largely unmodified Angular-CLI boilerplate asserting text (`'sunbird-cb-staticweb app is running!'`) that doesn't exist in the current app — it does not exercise this feature at all, and some specs cannot pass as written.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Document upload/summary/meta-summary failures | `cbp-ai-service` team | `summary_status`/meta-summary `status` is `FAILED` and the error is inside that codebase |
| Role-mapping generation failures | `cbp-ai-service` team | `role_mappings.status = FAILED` with an error message from Gemini or that codebase |
| Designation matching accuracy | `cbp-ai-service` team + iGOT designation-master owner | Confirm which side is at fault: iGOT search unreachable (exact-match side) vs. stale/incorrect embeddings (semantic side) |
| Course recommendation quality/failures | `cbp-ai-service` team | `recommended_courses.status = FAILED`, or relevancy floor tuning |
| Approval request stuck as `PENDING`, MDO admin hasn't acted | MDO admin / `ai-cbp-mdo-service` operations team | Confirm in `ai-cbp-mdo-service`'s own data whether the request was ever opened, before assuming it's lost |
| Approval request `APPROVED` but some items `FAILED` | `ai-cbp-mdo-service` team | Check `mdo_approval` rows with `igot_cbp_plan_id IS NULL` for that request; retry via `/publish/retry` |
| Designation-naming request stuck | SPV admin / `ai-cbp-mdo-service` operations team | Confirm the request is genuinely still `PENDING` in the shared table, not just unreflected in whatever frontend the SPV admin uses (not part of this trace) |
| Publish-to-iGOT failures (bulk pipeline) | `cbp-ai-service` team + CB-ext-course-service owner | `bulk_training_plan_approval.py`'s outcome CSV shows a failed `create`/`publish` call — remember this is a **different** downstream target from `ai-cbp-mdo-service`'s own publish calls |
| `cbp-ai-ui` shell issues (login, routing, session expiry) | `cbp-ai-ui` team | Bug is in `app.component.*`, or `shared.service.ts` |
| CBP author's actual wizard screens (upload UI, role-mapping editor, course selection) | Owner of the `@sunbird-cb/cbp-ai` library (not this repo) | Bug is in a screen this trace cannot see the source of |

## FAQ

**Why does a CBP plan show no status?** Because there isn't one on the
`cbp-ai-service` side — lifecycle tracking for a submitted plan lives in
`ai-cbp-mdo-service`'s copy of the data, not on the `cbp_plans` row itself.

**Why can't `cbp-ai-service` support tell me if a request was approved or
rejected?** Because that transition doesn't happen in that codebase — it
happens in `ai-cbp-mdo-service`, reading and writing the same database
rows. Check there (or its own escalation path) for the actual decision
history.

**Why did my meta-summary fail even though all my documents look fine?**
Check each input document's individual `summary_status` first — if any
weren't already `COMPLETED`, the meta-summary's own attempt to regenerate
them silently no-ops (a missing-`await` bug), and the whole batch fails.

**An MDO admin says a request shows `APPROVED` but one designation never
got published — is that a bug?** No — publish is per-item. Check that
item's own status; if it's `FAILED`, use `/publish/retry` for that one
item rather than re-running the whole publish.

**Why does the AI recommendation for a designation include so few courses
under a certain competency?** Check whether the designation-group-based mix
ratio matters here — it's computed in code but the classification call
feeding it is currently disabled, so results always reflect the
undifferentiated hybrid-search + LLM-rerank path, not a group-tuned mix.

> **Verification boundary:** this manual is sourced from `cbp-ai-service`
> (`origin/cbrelease-4.8.39`, `70d7175`), `ai-cbp-mdo-service`
> (`origin/cbrelease-4.8.39`, `88040de`), and `cbp-ai-ui`
> (`origin/cbrelease-4.8.39`, `15a3b9a`). Deeper runbook detail for the
> MDO/SPV admin's own frontend, and for the private `@sunbird-cb/cbp-ai`
> library, would need those systems' own source or operations
> documentation attached — neither is present in any of the three repos.
