# Operations Manual — AI Assessment Tool

How to operate, support, and troubleshoot the AI Assessment Tool as it
exists today — three independently-deployed workloads
(`ai-assessment-service` API, its Kafka worker, and a Streamlit reference
UI), fronted by Kong routes defined in `sunbird-devops`, gated by a role
granted through an unrelated approval workflow in `sunbird-cb-workflow`.

**Operational implication:** the API and worker are separate failure
domains. The API can be fully healthy (accepting requests, serving cached
results) while the worker is down — new generation jobs will simply queue
in Kafka and never move past `PENDING` until the worker recovers.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| API process | FastAPI, `uvicorn`, port 8000 | Serves all sync paths: auth, cache/clone check, status, update, download, history |
| Worker process | `aiokafka` consumer, no HTTP server | `DockerfileWorker` declares `EXPOSE 8005` but nothing binds it — don't expect a worker health endpoint |
| Streamlit UI | Port 8501, calls the API via `API_URL` env var | Reference client only; not the platform's authoring UI |
| Storage | Single Postgres table `interactive_assessments` | Job status, full result JSON, and token usage all live in one row — no separate cache tier to invalidate |
| Content cache | Local disk → GCS → Karmayogi API, three tiers | A "slow" first generation for a course is expected; repeats should be fast |
| Cleanup scheduler | Runs **inside the API process** (APScheduler), daily | If the API is down at the scheduled hour, that day's cleanup simply doesn't run — no catch-up logic |
| Role gate | `AI_ASSESSMENT_CREATOR`, granted via `sunbird-cb-workflow` approval | This service has no idea *why* a caller has the role — role issues are a `sunbird-cb-workflow`/SSO problem, not this service's |

## Deployment topology (from `sunbird-devops`)

Three separate Helm-chart deployments: `ai-assessment-service` (API),
`ai-assessment-worker-service` (worker), `ai-ui-assessment-service`
(Streamlit UI). Kong exposes the API under prefix `/ai/assessments`,
upstreamed to `http://ai-assessment-service:8000`. Default resource
requests/limits (both API and worker charts): CPU request 100m / limit 1,
memory request 200Mi / limit 1024Mi, `replicaCount` default 1, rolling
update 25%/25%.

**Note:** the specific commit this feature is traced at
(`sunbird-devops` `978c17a12`) only added unrelated ITSM-Aurora Kong routes
— the AI-assessment deployment config above was verified present *at* that
commit, but was introduced by earlier commits. Treat this section as "what's
deployed today," not "what this commit changed."

## Configuration reference

| Env var | Default | Purpose |
|---|---|---|
| `KARMAYOGI_API_KEY` | — (required, raises at startup if unset) | Service-account bearer token for Karmayogi content-API calls |
| `KARMAYOGI_BASE_URL` | `https://igotkarmayogi.gov.in` | Content search API host |
| `LEARNING_AI_BASE_URL` | `https://learning-ai.prod.karmayogibharat.net` | Transcoder-stats API host (VTT discovery) |
| `SUNBIRD_SSO_URL` / `SUNBIRD_SSO_REALM` | — | JWKS + issuer validation source |
| `REQUIRED_ROLE` | `AI_ASSESSMENT_CREATOR` | Role claim gating every `/ai-assessments/v1/*` call |
| `DATABASE_URL` | local dev Postgres URL | Job store connection string |
| `GENAI_MODEL_NAME` | `gemini-2.5-pro` (repo default; seen as `gemini-3.1-flash-lite` in one traced devops env template) | Vertex AI model identifier |
| `GOOGLE_PROJECT_ID` / `GOOGLE_LOCATION` | — / `us-central1` | Vertex AI project/region |
| `GOOGLE_APPLICATION_CREDENTIALS` | — | GCP service-account key path; generation silently cannot run without it (`client=None` in code) |
| `DOCUMENT_STORAGE_TYPE` | `local` | `local` for single-node Compose; `gcs` required for any multi-pod (Kubernetes) deployment |
| `GCS_CREDENTIALS` / `GCS_BUCKET_NAME` / `GCS_*_PREFIX` | — | Only relevant when `DOCUMENT_STORAGE_TYPE=gcs` |
| `KAFKA_BOOTSTRAP_SERVERS` | `localhost:9092` | Shared by API (producer) and worker (consumer) |
| `KAFKA_REQUEST_TOPIC` | `assessment.request` | API → worker handoff |
| `KAFKA_TOPIC` | `assessment.lifecycle.events` | Worker → downstream consumers (completion/failure events) |
| `KAFKA_GROUP_ID` | `assessment_worker_group` | Worker consumer-group ID |
| `CLEANUP_RETENTION_DAYS` | 7 | Age threshold for **file-system** content-cache deletion — does **not** delete DB job rows, despite `.env.example`'s comment |
| `CLEANUP_SCHEDULE_HOUR` / `_MINUTE` | 3 / 0 | Daily cleanup time (API-process local time) |
| `LOG_LEVEL`, `MAX_CONCURRENCY`, `WORKER_BATCH_SIZE`, `MAX_ATTEMPTS` | documented in `.env.example` | **Not read anywhere in code** — do not expect these to have any effect; the worker processes one message at a time with no configurable concurrency |

## Operational workflows

**Standing up locally**: `docker-compose up -d --build` brings up Postgres,
Kafka, Zookeeper, API, worker, and UI together, using local-disk storage
(`DOCUMENT_STORAGE_TYPE=local`) since the API and worker share a Compose
volume for `INTERACTIVE_COURSES_PATH`.

**Standing up in Kubernetes**: set `DOCUMENT_STORAGE_TYPE=gcs` — pods don't
share a volume, so the three-tier content cache falls back to GCS as the
shared tier instead of a local mount. Generated output files (CSV/PDF/DOCX/
JSON) are written to `/tmp` per request and streamed directly back — they
are never persisted to GCS and need no shared volume.

**A generation job is stuck in `PENDING`**: check the worker pod/process is
actually running and consuming `assessment.request` — the API has no
fallback path if the worker is down; the job will sit `PENDING` forever
until a worker consumes it (there's no queue-depth alert traced in these
repos).

**A generation job is stuck in `IN_PROGRESS`**: check worker logs for a
Vertex AI error (quota, `429`/`RESOURCE_EXHAUSTED`, or a cache-expiry loop)
— `tenacity` retries up to 3 times with backoff before giving up and marking
the job `FAILED`; if it's neither `FAILED` nor progressing, the worker
process itself may have crashed mid-job without the exception handler
running (check for OOM-kills against the 1024Mi memory limit, especially
for large multi-course `comprehensive` requests).

**A user reports 403 despite "having the role"**: this service only checks
the JWT's `user_roles` claim — it never calls `sunbird-cb-workflow`. Escalate
to confirm the role grant actually completed (check
`GET /proxies/v8/workflow/aiAssessment/getUserWF`) and that the user has a
fresh token (an old token issued before role grant won't carry the claim).

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| GET | `/health` | Basic liveness check (API process only, not worker) |
| GET | `/ai-assessments/v1/status/{job_id}` | Diagnose a specific stuck/failed job |
| GET | `/ai-assessments/v1/history` | Confirm what a user's account actually has generated |
| GET | `proxies/v8/workflow/aiAssessment/getUserWF` | Confirm role-grant status for an access-denied report |
| GET | `proxies/v8/workflow/aiAssessment/search` | Find pending/approved/rejected role requests |

## Caching and consistency

- **Result cache**: identical request hash + same user → instant return of
  the existing row. Identical hash + different user → cloned into a new row
  for that user. "Instant" results are not automatically suspicious — this
  is by design, not a sign of a stale cache.
- **Content cache**: a course's fetched PDFs/VTTs persist on disk (or GCS)
  indefinitely until `CLEANUP_RETENTION_DAYS` passes since last modified —
  if a course's content changed on the platform but a regeneration still
  uses old text, suspect a stale content cache first, since there's no
  content-version invalidation trigger traced anywhere in `fetcher.py`.
- **KCM Gemini cache**: process-local, in-memory reference to a Vertex
  `CachedContent` object — restarting the API/worker process forces
  recreation on next use; this is expected and not an error.

## Publishing/download checklist

- [ ] Job `status` is `COMPLETED` before attempting download
- [ ] Caller is the job's `user_id` (or the row was cloned to them)
- [ ] Requested `format` is one of `json`/`csv`/`csv_basic`/`pdf`/`docx`
- [ ] For `language` outside the common set, confirm PDF rendering
      separately — Odia/Assamese have no dedicated bundled font

## Known operational constraints

- No admin/ops endpoint to force-retry a `FAILED` job — the caller must
  resubmit (which, if `force` isn't set, may just return the same failed
  state via the cache path — confirm whether `force=true` is needed).
- No DB-row cleanup of any kind — `interactive_assessments` grows
  unbounded; only the file-system content cache is pruned.
- No worker-side health/readiness endpoint — liveness must be inferred from
  Kafka consumer-group lag or job-status progression, not from an HTTP
  check.
- No per-user rate limiting traced in this service itself (the gateway's
  Kong config may apply its own, per `sunbird-devops`, but that's outside
  this repo).

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Role grant/approval not completing | `sunbird-cb-workflow` / SPV Publisher process owner | `getUserWF` shows no approved state despite an approval being reported |
| Gateway route / RBAC on `/ai/assessments/*` | `sunbird-cb-uiproxy` gateway team | Requests never reach the API at all (check Kong/gateway logs before this service's logs) |
| Generation quality / prompt behavior | `ai-assessment-service` owning team | Output is malformed, off-topic, or violates the requested Bloom's/question-type spec |
| Vertex AI quota / auth failures | GCP project owner | Repeated `429`/`RESOURCE_EXHAUSTED` or credential errors in worker logs |
| Deployment/Helm/Kong config | `sunbird-devops` infra owner | Pods won't start, routes 404/502, resource limits too tight |

## FAQ

**Why did a user get a result instantly for a request that should take
minutes?** Cache hit or clone — check `history` for another row with the
same generation parameters; this is expected behavior, not a bug.

**Why does the worker seem idle with jobs piling up?** Check it's actually
subscribed to `assessment.request` under `assessment_worker_group` — there
is no auto-scaling or concurrency knob in code (`MAX_CONCURRENCY` etc. are
unused), so one stuck/slow job blocks the next in that consumer's stream.

**Why didn't the DB shrink after the cleanup job ran?** Because it only
deletes file-system content cache, never DB rows — this is a real gap
between the `.env.example` comment and the actual `cleanup.py` behavior.

> **Verification boundary:** this manual is sourced from
> `ai-assessment-service`, `sunbird-cb-uiproxy`, `sunbird-cb-workflow`, and
> `sunbird-devops` at the commits on the [index](index.md) page. Not
> verified: live Kong dashboard configuration, actual Kafka topic
> partitioning/retention settings, GCP quota/billing alerts, and the Jenkins
> shared-library build pipelines — these would need those systems' own
> operational documentation attached.
