# AI Assessment Tool — As-Built Requirements

Requirements reconstructed from the shipped implementation across
`ai-assessment-service` (`origin/cbrelease-4.8.37`, commit `82fef3e`),
`sunbird-cb-uiproxy` (`origin/cbrelease-4.8.41`, commit `423875a`),
`sunbird-cb-workflow` (`origin/cbrelease-4.8.39.2`, commit `8ae07a0`), and
`sunbird-devops` (`origin/cbrelease-4.8.41`, commit `978c17a12`) — what the
system does today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md), and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for the AI Assessment Tool was
available in any of the four repos. This document reconstructs requirements
**from the shipped implementation** — each requirement is traced to the
file(s)/line(s) that implement it.

Requirement IDs: `FR-0xx` (functional, `ai-assessment-service`), `FR-1xx`
(functional, `sunbird-cb-uiproxy`), `FR-2xx` (functional,
`sunbird-cb-workflow`), `NFR-xxx` (non-functional), `CON-xxx`
(constraint/assumption baked into the build).

## Functional requirements — `ai-assessment-service`

### Authentication and access

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL authenticate every `/ai-assessments/v1/*` call via header `x-authenticated-user-token`, an RS256 JWT verified against JWKS fetched from `{SUNBIRD_SSO_URL}realms/{SUNBIRD_SSO_REALM}/protocol/openid-connect/certs`. | `src/assessment/auth.py:12,38-58,99-104` |
| FR-002 | The system SHALL reject any request whose JWT lacks `AI_ASSESSMENT_CREATOR` (or the configured `REQUIRED_ROLE`) in its `user_roles` claim, with `403`. | `src/assessment/auth.py:64-66,110-112` |
| FR-003 | The system SHALL derive `user_id` from the JWT's `sub` claim, taking only the segment after the last `:` if the claim is in Sunbird's `f:provider_id:user_uuid` format. | `src/assessment/auth.py:143-146` |

### Generation request handling

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The system SHALL accept a `multipart/form-data` generation request supporting 5 assessment types (`practice`, `final`, `comprehensive`, `standalone`, `competency`) and 5 question types (MCQ, FTB, MTF, Multi-Choice, True/False). | `src/assessment/api.py:122` (route), `Language`/type enums `api.py:93-105` |
| FR-011 | The system SHALL require `competency_area`, `competency_themes`, and `competency_sub_themes` for `assessment_type=competency` requests. | `src/assessment/api.py:188-190` |
| FR-012 | The system SHALL compute a composite hash from course IDs and generation parameters and, on a match against the caller's own completed job, return that result without a new generation. | `architecture.md` "Composite Hash" description; `src/assessment/db.py:115-124` (`find_job_by_prefix`) |
| FR-013 | The system SHALL, on a hash match against another user's completed job, clone that result into a new row owned by the caller, without a new generation. | `src/assessment/db.py:126-134` (`create_completed_job`) |
| FR-014 | The system SHALL, on no cache/clone match, create a `PENDING` job row and publish an `ASSESSMENT_REQUESTED` event to the Kafka topic named by `KAFKA_REQUEST_TOPIC`. | `src/assessment/api.py:306,318-343`, `src/assessment/events.py:76-87` |
| FR-015 | The system SHALL support a `force` parameter to bypass the cache/clone shortcut. | `src/assessment/api.py` (`force` field on the generate request) |

### Background generation

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The worker SHALL consume `ASSESSMENT_REQUESTED` events, set job status `IN_PROGRESS`, fetch course content (or use uploaded files), call the generator, persist the result, and publish a lifecycle event. | `src/assessment/worker_service.py:33-146` |
| FR-021 | The worker SHALL fetch course PDFs and English-only VTT captions via the Karmayogi content and transcoder APIs, with a 3-tier (disk → GCS → API) cache. | `src/assessment/fetcher.py` (full file) |
| FR-022 | On any exception during processing, the worker SHALL set job status `FAILED` with the error message and still publish a lifecycle event with `status=FAILED`. | `src/assessment/worker_service.py:145-146` |
| FR-023 | The generator SHALL build one prompt per request from a single shared template, dynamically including per-type and per-question-type instructions, and enforce output structure via a JSON `response_schema`. | `src/assessment/generator.py:427-507,539-554` |
| FR-024 | The generator SHALL support an optional Bloom's-taxonomy percentage distribution, converting it into an exact ordered per-type assignment via largest-remainder rounding. | `src/assessment/generator.py:91-140,359-370` |
| FR-025 | The generator SHALL maintain a Gemini context cache of the detailed KCM competency-description dataset, reused across requests and recreated on cache-expiry. | `src/assessment/generator.py:63-89,556-560` |
| FR-026 | The generator SHALL retry transient Vertex AI failures (server errors, expired cache, rate limits) up to 3 times with exponential backoff. | `src/assessment/generator.py:509-529` |

### Job lifecycle and export

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The system SHALL let a caller poll job status, restricted to the job's owner. | `src/assessment/api.py:347-370` |
| FR-031 | The system SHALL let a job's owner overwrite its `assessment_data`. | `src/assessment/api.py:376-392`, `src/assessment/db.py:136-144` |
| FR-032 | The system SHALL export a `COMPLETED` job as JSON, a 7-option "V2" CSV, a basic MCQ-only CSV, a font-embedded PDF, or a DOCX file, restricted to the job's owner. | `src/assessment/api.py:396-463`, `src/assessment/exporters.py`, `src/assessment/exporters_csv_v2.py` |
| FR-033 | The system SHALL list a caller's own and cloned jobs with status, course info, and config. | `src/assessment/api.py:465-492` |
| FR-034 | The system SHALL run a daily scheduled job to delete file-system content-cache entries older than `CLEANUP_RETENTION_DAYS`. | `src/assessment/cleanup.py:18-92` |

## Functional requirements — `sunbird-cb-uiproxy`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-100 | The gateway SHALL proxy `POST /proxies/v8/ai/assessments/v1/generate` to the assessment service via Kong, using a dedicated multipart-reconstruction handler with a 5-minute socket timeout. | `src/proxies_v8/proxies_v8.ts:392-447` |
| FR-101 | The gateway SHALL generically proxy all other `/proxies/v8/ai/assessments/*` paths to Kong. | `src/proxies_v8/proxies_v8.ts:451-454` |
| FR-102 | The gateway SHALL proxy `/proxies/v8/workflow/aiAssessment/{transition,search,getUserWF}` to the workflow service, RBAC-checked against `AI_ASSESSMENT_CREATOR`/relevant roles. | `src/utils/whitelistApis.ts:7563-7583` |
| FR-103 | The gateway SHALL expose SSO-redirect constants (`AI_ASSESSMENT_PORTAL_HOST`) for a browser-based `aiassessmentlogin` redirect flow to the AI Assessment portal frontend. | `src/utils/env.ts:258-260`, `src/protectedApi_v8/resource.ts:127-138,196-202` |

## Functional requirements — `sunbird-cb-workflow`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-200 | The system SHALL expose `/aiAssessment/{transition,search,getUserWF}` for the `ai_assessment` service-name workflow. | `WorkFlowController.java:154-175` |
| FR-201 | The system SHALL restrict who may initiate vs. approve/reject an `ai_assessment` request to the `SPV Publisher` role, via configured role lists. | `AiAssessmentServiceImpl.java:64-93`, `Configuration.java:275-282` |
| FR-202 | On approval, the system SHALL publish a Kafka event that results in the requesting user being granted the `AI_ASSESSMENT_CREATOR` role. | `AiAssessmentServiceImpl.java:56-60`, `WorkflowApplicationConsumer.java:50-75` |
| FR-203 | On approval, the system SHALL send the requesting user a notification. | `NotificationConsumer.java:88-89` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | Generation SHALL run asynchronously via Kafka so the API remains responsive to other callers while a job is in progress. | `worker_service.py`, `events.py` |
| NFR-002 | Identical generation requests SHALL be served from cache/clone rather than re-invoking the LLM, to reduce Vertex AI cost and latency. | `db.py:115-134` |
| NFR-003 | The KCM competency reference dataset SHALL be Gemini-context-cached rather than resent on every call, to reduce token cost. | `generator.py:63-89` |
| NFR-004 | Content fetched from the Karmayogi platform SHALL be cached (disk, then GCS) to avoid repeated fetches for the same course. | `fetcher.py:26-73` |
| NFR-005 | PDF export SHALL correctly render 7 Indic scripts via embedded fonts. | `exporters.py:21,28-57` |

## Constraints and assumptions baked into the build

| ID | Constraint | Source |
|---|---|---|
| CON-002 | `GOOGLE_APPLICATION_CREDENTIALS` must be set for the Gemini client to initialize at all; without it, generation fails at call time, not at startup. | `generator.py:26-34,532-533` |
| CON-003 | `DOCUMENT_STORAGE_TYPE=gcs` is required for any multi-pod deployment, since local-disk caching assumes a single shared volume. | `DEPLOYMENT.md` §6 |
| CON-004 | The worker processes Kafka messages strictly one at a time — there is no configurable concurrency despite `.env.example` implying otherwise. | `worker_service.py:159` (`async for msg in consumer`) |
| CON-005 | `sunbird-cb-workflow` and `ai-assessment-service` are connected only via a JWT role claim — neither repo calls the other's API at runtime. | Absence of any cross-repo HTTP call in either codebase |

## Known deviations (inconsistent by accident, not by design)

| Area | Documented/claimed | Actual code |
|---|---|---|
| Completion event name | README: `ASSESSMENT_COMPLETED` | Code publishes `event_type: "ASSESSMENT_GENERATION_COMPLETED"` (`events.py:52`) |
| Async response status | `architecture.md` and the `/generate` docstring: `202 Accepted` | `api.py:345` does not set `status_code=202` explicitly |
| API version | `architecture.md` describes `/api/v2/generate`, `/api/v2/assessment/{job_id}` | Actual routes are all under `/ai-assessments/v1/*` — no `/v2/` path exists in code |
| KCM competency count | README/`architecture.md`: "110" definitions cached | `kcm_descriptions.json` has 109 entries (108 unique labels); `competencies.json` has 112 sub-themes |
| Cleanup job scope | `.env.example` comment: "removes old completed jobs from the DB" | `cleanup.py` only deletes file-system content-cache entries; no DB row is ever deleted |
| Worker port | `DockerfileWorker` declares `EXPOSE 8005` | No HTTP server exists in `worker_service.py` — nothing binds that port |
| Unused tuning env vars | `.env.example` documents `LOG_LEVEL`, `MAX_CONCURRENCY`, `WORKER_BATCH_SIZE`, `MAX_ATTEMPTS` | None of these are read anywhere in the Python source |
| Supported languages | Prompt template's own text (`prompts.yaml:71-75`) lists 10 languages including Urdu, excluding Punjabi/Odia/Assamese | API's `Language` enum (`api.py:93-105`) has 12 values including Punjabi/Odia/Assamese, excluding Urdu |
| Container health checks | — | Neither `Dockerfile` nor `DockerfileWorker` defines a `HEALTHCHECK`; only the app-level `/health` route exists, unwired to any Docker/K8s probe in this repo |

## Out of scope (not reconstructible, or ruled out, from these repos)

- **UI trigger point**: no code in any of the four traced repos lets a
  course author or platform user launch generation from within Karmayogi's
  own authoring or consumption apps. Only the bundled Streamlit reference
  UI (`ui/app.py`) was found.
- **`cbp-ai-ui`** (`origin/cbrelease-4.8.39`, commit `ab4e963`): checked and
  confirmed to have **no code-level connection** to this feature — it is
  exclusively the UI for the separate "AI CBP Tool" feature (Capacity
  Building Plan generation).
- **`sunbird-cb-creationportal`** (`origin/cbrelease-4.8.40`, commit
  `ab91df5d1`): checked and confirmed to have **no code-level connection**
  to this feature — its existing "Standalone Assessment" and "Comprehensive
  Assessment Program" flows are pre-existing, manually-authored platform
  content types, unrelated to AI generation.
- **Introducing commits for uiproxy/workflow/devops integration code**: the
  AI-assessment proxy routes, role-approval workflow, and Kong/Helm
  deployment config were all verified present at the traced commits, but
  were added by earlier commits in each repo's history (not independently
  traced here — see [HLD](hld.md) for the caveat on each).
- **Jenkins shared libraries** (`deploy-conf`, `central-pipeline-lib`): build
  and PR-validation behavior referenced by the Jenkinsfiles is external to
  this repo and unverifiable here.
- **The `google.genai`/Vertex AI SDK's own internals**: retry/quota/pricing
  behavior beyond what `generator.py` explicitly catches is not part of this
  trace.
