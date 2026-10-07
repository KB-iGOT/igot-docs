# AI Assessment Tool — Use Cases

## Access journey

### UC-1 · Get approved as an AI Assessment Creator

A user submits a workflow request with `serviceName = "ai_assessment"`.
Only a user holding `SPV Publisher` may initiate or approve/reject it
(`ai.assessment.initiate.roles` / `ai.assessment.approve.reject.roles`,
`sunbird-cb-workflow:Configuration.java:275-282`). On approval, a Kafka
consumer grants the requesting user the `AI_ASSESSMENT_CREATOR` role and
fires a notification (`WorkflowApplicationConsumer.java:50-75`,
`NotificationConsumer.java:88-89`). Without this role, every
`/ai-assessments/v1/*` call is rejected with `403`
(`ai-assessment-service:src/assessment/auth.py:110-112`).

- API: `POST /proxies/v8/workflow/aiAssessment/transition` ·
  `GET /proxies/v8/workflow/aiAssessment/search` ·
  `GET /proxies/v8/workflow/aiAssessment/getUserWF`

## Generation journeys

### UC-2 · Generate a course-based assessment (Practice / Final / Comprehensive)

The creator supplies one or more `course_ids`, an `assessment_type`
(`final`, `practice`, `comprehensive`), difficulty, and question-type
counts. The worker recursively walks each course's content tree, extracts
text from PDFs (`PyMuPDF`) and English VTT captions, deduplicates by content
hash, and builds one prompt whose "ASSESSMENT TYPE LOGIC" section changes
generation behavior per type — Comprehensive explicitly forces
cross-course/cross-module questions; Practice and Final differ only in the
prompt's framing, not in a separate code path.

- API: `POST /ai-assessments/v1/generate` (multipart)

### UC-3 · Generate a Standalone assessment from uploaded files

The creator uploads PDF/VTT files directly instead of referencing a course.
Generation is scoped **strictly** to the uploaded files — the prompt
explicitly instructs the model not to draw on outside course content for
this type.

- API: `POST /ai-assessments/v1/generate` (multipart, `files=[...]`,
  `assessment_type=standalone`)

### UC-4 · Generate a Competency-only assessment (no course, no files)

The creator selects a `competency_area`, one or more `competency_themes`,
and `competency_sub_themes` — required fields for this type
(`api.py:188-190`). With no `course_ids` supplied, the worker looks up
matching entries in the detailed KCM description dataset
(`resources/kcm_descriptions.json`) by `Area`/`Label` and injects them as the
sole source content, instead of any fetched course material
(`generator.py:272-294`).

- API: `POST /ai-assessments/v1/generate` (multipart,
  `assessment_type=competency`, no `course_ids`/`files`)

### UC-5 · Get an instant result via cache or clone

Before queuing anything, the API hashes the request's course IDs and
generation parameters. If the **same user** already has a completed job with
that hash, it's returned immediately. If a **different user** does, that
job's data is cloned into a brand-new row owned by the caller
(`db.py:115-134`) — no new Gemini call is made either way.

- API: `POST /ai-assessments/v1/generate` (same request, cache/clone path)

### UC-6 · Poll a generation job to completion

For a genuinely new request, the API creates a `PENDING` row and returns
immediately (README/architecture describe this as `202 Accepted`, though the
actual return statement does not set that status code explicitly — see the
[As-Built Requirements](as-built-requirements.md) known deviations). The
creator polls status until it's `COMPLETED` or `FAILED`.

- API: `GET /ai-assessments/v1/status/{job_id}`

### UC-7 · Edit a generated assessment

The owner can overwrite the stored `assessment_data` JSON in place — e.g.
correcting a question after review — as long as `user_id` matches the row's
owner; otherwise the update silently affects zero rows and the API returns
`404` (`db.py:136-144`).

- API: `PUT /ai-assessments/v1/update/{job_id}`

### UC-8 · Download the finished assessment

The creator downloads in one of five formats. `csv` uses the "V2" 7-option
schema (`QuestionType` remapped to `MCQ-SCA`/`MCQ-MCA`/`T/F`/`MTF`/`FTB`);
`csv_basic` is MCQ-only with a simpler 6-option schema; `pdf` embeds Noto
Sans fonts for seven Indic scripts; `docx` mirrors the PDF's content
structure. A non-`COMPLETED` job or a non-owner request is rejected (`404`
or `403`).

- API: `GET /ai-assessments/v1/download/{job_id}?format={json|csv|csv_basic|pdf|docx}`

### UC-9 · Generate in a non-English language

The creator sets `language` to one of 12 supported values. Generation is not
a translate-after-the-fact step — the LLM is instructed to produce every
JSON value directly in the target language as part of the same call.

- API: `POST /ai-assessments/v1/generate` (multipart, `language=<value>`)

### UC-10 · Review generation history

The creator lists every job they own or have cloned, with status, course
IDs/names, and generation parameters, for re-download or reference.

- API: `GET /ai-assessments/v1/history`

## Edge cases

| Situation | Behaviour |
|---|---|
| Requested `language` not in the API's own 12-value enum | Rejected at the API layer (Pydantic enum validation); note the prompt template's own "supported languages" text lists a *different* 10-value set (includes Urdu, omits Punjabi/Odia/Assamese) — a prompt/API mismatch, not a runtime bug, but confusing to a prompt maintainer |
| `language=odia` requested for a PDF download | No Odia-specific font file exists among the bundled Noto fonts — PDF rendering fidelity for Odia script is unverified and may degrade |
| Two identical requests in quick succession, different users | Second caller gets the first caller's result cloned to them, not a fresh generation — by design, not a race-condition bug |
| Worker crashes mid-generation | Job status is set to `FAILED` with the exception message, and a `FAILED` lifecycle event is still published — no automatic retry of the job itself (only LLM-call-level retries inside `generator.py`) |
| Job older than `CLEANUP_RETENTION_DAYS` (default 7) | Only the **on-disk course-content cache** for that job is deleted; the Postgres job row (including the completed `assessment_data`) is never deleted by this job, despite `.env.example`'s comment describing it as a "DB cleanup" |
| Non-owner calls `PUT .../update/{job_id}` or `GET .../download/{job_id}` | `404`/`403` — ownership is enforced per-call, not via a shared ACL list |
| `KARMAYOGI_API_KEY` unset at startup | Service raises at import time — every Karmayogi content-API call uses one shared service-account bearer token, not the calling user's own token |

> **Verification boundary:** these use cases are sourced from
> `ai-assessment-service`, `sunbird-cb-uiproxy`, and `sunbird-cb-workflow` at
> the commits listed on the [index](index.md) page. No UI trigger for these
> flows was found in `sunbird-cb-creationportal` or `cbp-ai-ui` — both were
> checked and confirmed to have no code-level connection to this feature.
> The bundled Streamlit UI (`ui/app.py`) and the standalone Kong/postman
> integration guide describe an equivalent flow but were not independently
> exercised.
