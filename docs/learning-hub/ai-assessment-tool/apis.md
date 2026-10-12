# AI Assessment Tool — APIs

Verified from `ai-assessment-service:src/assessment/api.py`,
`sunbird-cb-uiproxy:src/proxies_v8/proxies_v8.ts` +
`src/utils/whitelistApis.ts`, and
`sunbird-cb-workflow:WorkFlowController.java`. Direct-to-service paths
(prefix `/ai-assessments/v1/...`) are what `api.py` itself defines; the
gateway exposes the same surface under
`{{host}}/apis/proxies/v8/ai/assessments/v1/...` via Kong.

## Access-approval workflow (`sunbird-cb-workflow`, gatewayed via `sunbird-cb-uiproxy`)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `proxies/v8/workflow/aiAssessment/transition` | Initiate, approve, or reject an `ai_assessment` role request (role-gated: initiate/approve differ by `ai.assessment.initiate.roles` vs. `ai.assessment.approve.reject.roles`, both restricted to `SPV Publisher`) |
| GET | `proxies/v8/workflow/aiAssessment/search` | Search existing `ai_assessment` workflow requests |
| GET | `proxies/v8/workflow/aiAssessment/getUserWF` | Get a specific user's `ai_assessment` workflow state |

On approval, `WorkflowApplicationConsumer` (Kafka topic `ai.assessment.topic`)
grants the requesting user the `AI_ASSESSMENT_CREATOR` role — this is not a
synchronous API call, it's an async side effect of the transition above.

## Generation engine (`ai-assessment-service`, gatewayed via `sunbird-cb-uiproxy`)

Router prefix `/ai-assessments/v1`. Generation routes use header
`x-authenticated-user-token` (a Sunbird-SSO JWT with role
`AI_ASSESSMENT_CREATOR`).

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Redirects to `/docs` |
| GET | `/health` | `{"status": "healthy", "service": "assessment-generator"}` |
| POST | `/ai-assessments/v1/generate` | Generate an assessment — cache-hit/clone returns immediately (200-shaped body); a genuinely new request queues a job (`PENDING`) and returns immediately without an explicit `status_code=202` set in code, despite the docstring claiming 202 |
| GET | `/ai-assessments/v1/status/{job_id}` | Poll job status; `404` if not found |
| PUT | `/ai-assessments/v1/update/{job_id}` | Overwrite `assessment_data` for a job the caller owns |
| GET | `/ai-assessments/v1/download/{job_id}?format=...` | Download a `COMPLETED` job's result; `format` ∈ `csv`, `csv_basic`, `json`, `pdf`, `docx` |
| GET | `/ai-assessments/v1/history` | List every job the caller owns or has cloned |

The gateway also proxies `POST .../generate` through a dedicated
multipart-reconstruction handler with a 5-minute socket timeout
(`sunbird-cb-uiproxy:proxies_v8.ts:392-447`), because generation requests
carry file uploads and can run long; all other `/ai/assessments/*` paths use
a generic proxy pass-through to Kong (`proxies_v8.ts:451-454`). A related
`/ai/cbp/*` proxy group exists alongside it (`proxies_v8.ts:456-459`) but
belongs to the separate AI CBP Tool feature, not this one.

### `POST /ai-assessments/v1/generate` — request (multipart/form-data)

| Field | Type | Notes |
|---|---|---|
| `course_ids` | list of strings | omit for `standalone`/`competency` types |
| `assessment_type` | enum | `practice`, `final`, `comprehensive`, `standalone`, `competency` |
| `difficulty` | enum | drives default Bloom's distribution if `blooms_config` is omitted |
| `total_questions` | int | overall count, distributed per `question_type_counts` |
| `question_type_counts` | JSON string | e.g. `{"mcq": 5, "ftb": 2, "mtf": 0, "multichoice": 0, "truefalse": 3}` — a 0/absent type is explicitly excluded from generation |
| `time_limit` | int | minutes |
| `topic_names` | string | free-text topic hints |
| `language` | enum | 12 values: english, hindi, tamil, telugu, kannada, malayalam, marathi, bengali, gujarati, punjabi, odia, assamese |
| `blooms_config` | JSON string | e.g. `{"Analyze": 40, "Apply": 30, ...}`; percentages converted into an exact per-question-type, per-position Bloom's-level assignment |
| `enable_blooms` | bool | if false, Bloom's tagging is disabled outright |
| `course_weightage` | JSON string | per-course weighting for multi-course requests |
| `course_names` | string | free-text, used for display/labeling only |
| `competency_area` | string | required for `assessment_type=competency` |
| `competency_themes` | string | required for `assessment_type=competency` |
| `competency_sub_themes` | string | required for `assessment_type=competency` |
| `additional_instructions` | string | free-text, appended to the prompt |
| `files` | list of files | PDF/VTT uploads, required for `standalone` |
| `force` | bool | bypass the cache/clone shortcut and force a fresh generation |

### Verified response shape (`assessment_data`, all formats derive from this)

```jsonc
{
  "blueprint": {
    "assessment_scope_summary": "…",
    "courses_covered": ["Course A", "Course B"],
    "unified_competency_map": {
      "functional": ["Project Management", "Agile"],
      "behavioral": ["Teamwork"]
    },
    "smart_learning_objectives": ["…"],
    "blooms_taxonomy_mapping": { "Analyze": "40%" }
  },
  "questions": {
    "Multiple Choice Question": [
      {
        "question_id": "uuid",
        "question_text": "…",
        "options": [{ "text": "A", "index": 0 }],
        "correct_option_index": 2,
        "reasoning": {
          "learning_objective_alignment": "…",
          "competency_alignment": { "kcm": { "competency_area": "…" } },
          "blooms_level_justification": "…",
          "relevance_percentage": 95
        }
      }
    ],
    "FTB Question": [],
    "MTF Question": [],
    "Multi-Choice Question": [],
    "True/False Question": []
  }
}
```

The `questions` object always has exactly these five fixed keys
(`prompts.yaml:284-289`), with empty arrays for any type not requested.

### External APIs this service calls (not gateway-facing, worker-side)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `{KARMAYOGI_BASE_URL}/api/content/v1/search` | Fetch course/module metadata by identifier, using a service-account token (`KARMAYOGI_API_KEY`) |
| GET | `{LEARNING_AI_BASE_URL}/api/kb-pipeline/v3/transcoder/stats?resource_id={id}` | Discover VTT caption URLs for a course video |

> **Verification boundary:** the `/proxies/v8/ai/assessments/*` and
> `/proxies/v8/workflow/aiAssessment/*` gateway routes were verified present
> in `sunbird-cb-uiproxy` at the traced commit, but the code that *added*
> them predates that commit (see [As-Built Requirements](as-built-requirements.md)
> for the citation trail). No API surface for triggering generation was found
> in `sunbird-cb-creationportal` or `cbp-ai-ui` at their traced commits.
