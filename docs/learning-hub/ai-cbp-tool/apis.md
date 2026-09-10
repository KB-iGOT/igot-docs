# AI CBP Tool — APIs

Verified from `cbp-ai-service` at `origin/cbrelease-4.8.39` (commit
`119a42b`). All paths below are relative to the app; the app itself is
mounted with `root_path = settings.APP_ROOT_PATH` (`src/main.py:37-46`), and
the deployed `OAuth2PasswordBearer` `tokenUrl`
(`/cbp-tpc-ai/api/v1/auth/login`, `src/api/dependencies.py:12`) suggests at
least one environment fronts this service under a `/cbp-tpc-ai` gateway
prefix — not otherwise confirmed in this repo.

Path construction: `/api` (`src/api/__init__.py:8`) + `/v1`, `/v2`, or `/v3`
(`src/api/v{1,2,3}/__init__.py:7` or `:4`) + the router's own prefix (if
any) + the route path. Auth column values refer to dependencies in
`src/api/dependencies.py`: `active` = `get_current_active_user` (any
authenticated, active user), `admin` = `require_role("Super Admin")`,
`token` = `get_current_user_with_token`, `public` = no auth.

## Auth — `/api/v1/auth`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/login` | `src/api/v1/auth.py:42` | Form login (username/password); brute-force lockout via `LoginAttempt`; returns JWT access+refresh pair, persists a `UserSession` row | public |
| POST | `/refresh` | `src/api/v1/auth.py:157` | Exchanges a valid refresh token for a new access token | public |
| POST | `/logout` | `src/api/v1/auth.py:207` | Deletes the session row for the current token (blacklists it) | token |
| POST | `/unlock-account/{username}` | `src/api/v1/auth.py:252` | Clears an account's failed-login counter | admin |
| GET | `/account-status/{username}` | `src/api/v1/auth.py:305` | Reports lockout state/attempt counts for an account | admin |
| POST | `/cleanup-expired-sessions` | `src/api/v1/auth.py:350` | Deletes DB session rows whose refresh token has expired | admin |

## Organization lookups — `/api/v1`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| GET | `/state-center/` | `src/api/v1/state_center.py:18` | Proxies iGOT `POST {KB_BASE_URL}/api/org/v1/search` to list ministries/states | active |
| GET | `/department/state-center/{state_center_id}` | `src/api/v1/department.py:19` | Proxies the same iGOT org-search API to list departments under a ministry/state | active |
| POST | `/kb/designation/search` | `src/api/v1/designation.py:15` | Raw passthrough of a designation search to iGOT's designation-master API | active |
| GET | `/health` | `src/api/v1/health.py:21` | Liveness check — app version + UTC timestamp | public |

## Roles &amp; users — `/api/v1`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/roles` | `src/api/v1/roles.py:19` | Create a role (rejects duplicate name) | admin |
| GET | `/roles` | `src/api/v1/roles.py:68` | List roles, paginated | admin |
| GET | `/roles/{role_id}` | `src/api/v1/roles.py:94` | Fetch one role + assigned-user count | admin |
| PUT | `/roles/{role_id}` | `src/api/v1/roles.py:135` | Update a role | admin |
| DELETE | `/roles/{role_id}` | `src/api/v1/roles.py:189` | Delete a role — blocked if any user is assigned | admin |
| POST | `/users` | `src/api/v1/users.py:21` | Create a user (unique username, valid role, hashed password) | admin |
| GET | `/users/me` | `src/api/v1/users.py:127` | Caller's own profile | active |
| GET | `/users/{user_id}` | `src/api/v1/users.py:154` | Fetch any user by id | active |
| PUT | `/users/{user_id}` | `src/api/v1/users.py:182` | Update a user | admin |
| DELETE | `/users/{user_id}` | `src/api/v1/users.py:238` | Soft-delete a user (`is_active=False`) | admin |
| GET | `/users` | `src/api/v1/users.py:269` | Paginated user listing | admin |

## Documents &amp; summaries — `/api/v1`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/state-center-data/upload_documents_background` | `src/api/v1/state_center_data.py:81` | Legacy single ACBP-plan + Work-Allocation-Order PDF upload feeding v1 role-mapping generation only | admin |
| GET | `/state-center-data` | `src/api/v1/state_center_data.py:161` | Fetch stored ACBP/WAO summaries for a scope | admin |
| DELETE | `/state-center-data` | `src/api/v1/state_center_data.py:195` | Clear one legacy document's filename+summary | admin |
| POST | `/files` (`files` prefix) | `src/api/v1/document_routes.py:51` | Upload up to 10 PDFs, typed (`Work Allocation Order` / `Annual Reports` / `Other Document`) | active |
| GET | `/files` | `src/api/v1/document_routes.py:181` | List/filter documents | active |
| POST | `/files/{file_id}/summary` | `src/api/v1/document_routes.py:303` | Idempotently trigger a background Gemini PDF summary | active |
| GET | `/files/{file_id}` | `src/api/v1/document_routes.py:403` | Fetch one document's metadata (+ optional summary) | active |
| DELETE | `/files/{file_id}/summary` | `src/api/v1/document_routes.py:421` | Clear only the summary, keeping the file | active |
| GET | `/files/{file_id}/download` | `src/api/v1/document_routes.py:459` | Stream the raw PDF | active |
| PATCH | `/files/document-type` | `src/api/v1/document_routes.py:494` | Change a file's `document_type` (uploader-owned only) | active |
| DELETE | `/files/{file_id}` | `src/api/v1/document_routes.py:339` | Delete a file; blocked while summary `IN_PROGRESS`; cleans up referencing meta-summaries | active |
| POST | `/meta-summaries` | `src/api/v1/meta_summary_routes.py:106` | Aggregate several documents' summaries into one synthesized meta-summary | active |
| GET | `/meta-summaries` | `src/api/v1/meta_summary_routes.py:171` | List meta-summary batches | active |
| GET | `/meta-summaries/{request_id}` | `src/api/v1/meta_summary_routes.py:200` | Fetch one meta-summary batch | active |
| DELETE | `/meta-summaries/{request_id}` | `src/api/v1/meta_summary_routes.py:214` | Delete a meta-summary batch record | active |

## Role mapping — v1 (`/api/v1/role-mapping`, full CRUD surface)

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/generate` | `src/api/v1/role_mappings.py:150` | Background-generate designations/competencies from legacy ACBP/WAO summaries + optional ad-hoc file uploads; auto-retries a prior `FAILED` state | active |
| POST | `/match-designations` | `src/api/v1/role_mappings.py:329` | Exact + semantic match unmatched designation names against the iGOT designation master; bulk-persists matches | active |
| POST | `/add-designation` | `src/api/v1/role_mappings.py:469` | Gemini-generate one new designation's role/competencies against the flat `data/competencies.json` taxonomy | active |
| POST | `/search` | `src/api/v1/role_mappings.py:540` | Paginated/filterable/sortable search, with matched/unmatched counts | active |
| PUT | `/reorder` | `src/api/v1/role_mappings.py:597` | Bulk `sort_order` update for drag-and-drop reordering; blocked while any mapping is `IN_PROGRESS` | active |
| GET | `/reorder/list` | `src/api/v1/role_mappings.py:660` | Lightweight `COMPLETED`-only list for the reorder UI | active |
| GET | `/{role_mapping_id}` | `src/api/v1/role_mappings.py:701` | Fetch one role mapping owned by the caller | active |
| GET | `/state-center/{state_center_id}` | `src/api/v1/role_mappings.py:731` | List `COMPLETED` role mappings for a state/center | active |
| GET | `/state-center/{state_center_id}/department/{department_id}` | `src/api/v1/role_mappings.py:756` | Same, scoped to a department | active |
| PUT | `/{role_mapping_id}` | `src/api/v1/role_mappings.py:781` | Partial update of a role mapping's fields/competencies | active |
| DELETE | `/{role_mapping_id}` | `src/api/v1/role_mappings.py:835` | Delete one role mapping; blocked while `IN_PROGRESS` | active |
| DELETE | `/` | `src/api/v1/role_mappings.py:882` | Bulk-delete role mappings for a state-center(+department) | active |

## Role mapping — v2 (`/api/v2/role-mapping`, generate + add-designation only)

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/generate` | `src/api/v2/role_mappings.py:151` | Same background-generation pattern as v1, but takes a required `org_type` and pulls context from the generic `documents` table instead of files/legacy summaries | active |
| POST | `/add-designation` | `src/api/v2/role_mappings.py:327` | Generates one designation using multi-document summaries against the leveled `data/competencies_level.json`, then reconciles the result against the KCM taxonomy (v3's reconciliation logic, reused here) | active |

## Role mapping — v3 (`/api/v3/role-mapping`, generate only)

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/generate` | `src/api/v3/role_mappings.py:163` | Three-pass pipeline: extract designation hierarchy (Work-Allocation-Order summaries only) → batch-generate FRAC competencies in parallel → reconcile Behavioral/Functional competencies against `data/competencies_level.json`. Auto-runs iGOT designation matching on success; a prior `FAILED` state is returned as-is, not retried | active |

## Course recommendation, suggestion &amp; user-added courses — `/api/v1`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/course-recommendations/generate` | `src/api/v1/course_recommendation.py:598` | Background hybrid-vector-search + Gemini course recommendation for a role mapping | active |
| GET | `/course-recommendations/bulk-status` | `src/api/v1/course_recommendation.py:678` | Lists in-progress recommendation jobs for a scope | active |
| GET | `/course-recommendations` | `src/api/v1/course_recommendation.py:716` | Fetch the recommendation record for a role mapping | active |
| DELETE | `/course-recommendations/role-mapping/{role_mapping_id}` | `src/api/v1/course_recommendation.py:743` | Delete all recommendation data for a role mapping | active |
| DELETE | `/course-recommendations/{role_mapping_id}/course/{course_id}` | `src/api/v1/course_recommendation.py:805` | Remove one course, auto-detecting whether it lives in recommendations, suggestions, or user-added courses | active |
| POST | `/course/suggestions` | `src/api/v1/course_suggestion.py:21` | Proxies a free-form course search to iGOT content search | active |
| POST | `/course/suggestions/save` | `src/api/v1/course_suggestion.py:64` | Save a plain (non-AI-scored) list of course identifiers against a role mapping | active |
| GET | `/course/suggestions/{role_mapping_id}` | `src/api/v1/course_suggestion.py:115` | Resolve saved suggestion identifiers into full course detail via iGOT | active |
| DELETE | `/course/suggestions/{role_mapping_id}` | `src/api/v1/course_suggestion.py:176` | Delete the whole suggestion record for a role mapping | active |
| DELETE | `/course/suggestions/{role_mapping_id}/course/{course_identifier}` | `src/api/v1/course_suggestion.py:217` | Remove a single suggested course identifier | active |
| POST | `/user-added-courses` | `src/api/v1/user_added_courses.py:23` | Add a manually-entered external course to a role mapping | active |
| GET | `/user-added-courses/role-mapping/{role_mapping_id}` | `src/api/v1/user_added_courses.py:83` | List user-added courses for a role mapping | active |
| GET | `/user-added-courses/{course_id}` | `src/api/v1/user_added_courses.py:128` | Fetch one user-added course | active |
| PUT | `/user-added-courses/{course_id}` | `src/api/v1/user_added_courses.py:167` | Update a user-added course | active |
| DELETE | `/user-added-courses/{course_id}` | `src/api/v1/user_added_courses.py:211` | Delete one user-added course | active |
| DELETE | `/user-added-courses/role-mapping/{role_mapping_id}` | `src/api/v1/user_added_courses.py:258` | Bulk-delete user-added courses for a role mapping | active |

## CBP Plan — `/api/v1/cbp-plan`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/save` | `src/api/v1/cbp_plan.py:63` | Resolve selected course identifiers against the latest recommendation, iGOT search, and user-added courses; persist a new CBP plan | active |
| GET | `/` | `src/api/v1/cbp_plan.py:184` | Fetch the CBP plan for a role mapping | active |
| PUT | `/{cbp_plan_id}` | `src/api/v1/cbp_plan.py:208` | Re-resolve and overwrite `selected_courses` on an existing plan | active |
| DELETE | `/{cbp_plan_id}/course/{course_identifier}` | `src/api/v1/cbp_plan.py:321` | Remove one course from a plan | active |
| DELETE | `/role-mapping/{role_mapping_id}` | `src/api/v1/cbp_plan.py:407` | Delete the CBP plan(s) tied to a role mapping | active |

## Approval workflow — `/api/v1`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/approval-requests/send` | `src/api/v1/approval_requests.py:45` | Validate + snapshot completed role mappings (with CBP plans) into one approval request; emails the assigned MDO admin | active |
| GET | `/approval-requests/list` | `src/api/v1/approval_requests.py:188` | Paginated/filterable list of the caller's submitted requests | active |
| GET | `/approval-requests/{request_id}` | `src/api/v1/approval_requests.py:267` | Full detail of one approval request | active |
| POST | `/approval-requests/revoke` | `src/api/v1/approval_requests.py:344` | Revert a `pending` request to `draft` (400 otherwise) | active |
| POST | `/approval-requests/mdo-admins` | `src/api/v1/approval_requests.py:405` | Look up MDO_ADMIN/MDO_LEADER users for a department via iGOT user-search | active |
| POST | `/designation-approval/create` | `src/api/v1/designation_approval.py:29` | Submit an unmatched designation name for SPV-admin naming approval; emails SPV admins | active |
| GET | `/designation-approval/search` | `src/api/v1/designation_approval.py:115` | Paginated search of the caller's designation-approval requests | active |

**No endpoint in this repo transitions an `ApprovalRequest` or
`DesignationApproval` to `APPROVED`/`REJECTED`** — see [LLD](lld.md) and
[Use Cases UC-16](use-cases.md#uc-16-external-approve-reject-and-publish).

## Dashboards &amp; reports — `/api/v1`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/dashboard/cbp-summary-trends` | `src/api/v1/dashboard.py:25` | Org-wide CBP-count time series (monthly/quarterly) | admin |
| POST | `/dashboard/cbp-dashboard-metrics` | `src/api/v1/dashboard.py:51` | Org-wide aggregate CBP KPIs, incl. competency-type breakdown | admin |
| POST | `/dashboard/gap-analysis` | `src/api/v1/dashboard.py:72` | Org-wide count of competencies with no matched recommended course | admin |
| POST | `/dashboard/my-dashboard-metrics` | `src/api/v1/dashboard.py:96` | Same KPIs, scoped to the caller | active |
| POST | `/dashboard/my-gap-analysis` | `src/api/v1/dashboard.py:118` | Gap analysis scoped to the caller's own role mappings | active |
| GET | `/reports/course-recommendations/download` | `src/api/v1/reports.py:269` | PDF of one role mapping's saved CBP plan/course list | active |
| GET | `/reports/cbp-plan/download` | `src/api/v1/reports.py:388` | PDF of all completed role mappings for a scope (optional Bhashini translation) | active |
| GET | `/reports/acbp-plan/download` | `src/api/v1/reports.py:409` | Same, with CBP plan data loaded inline | active |

## External integrations (outbound, not endpoints on this service)

| Target | Used for | Config |
|---|---|---|
| iGOT KB API (`{KB_BASE_URL}`) | Org search, designation search, content search, user search | `KB_BASE_URL`, `KB_AUTH_TOKEN` — `src/core/configs.py:72-73` |
| Google Gemini / Vertex AI (`google-genai`) | Document/meta summarization, role-mapping generation, designation embedding, course-query generation and reranking | `GOOGLE_PROJECT_ID`, `GOOGLE_API_KEY`, `GEMINI_PRO_MODEL_NAME`, `GEMINI_FLASH_MODEL_NAME`, `GOOGLE_EMBEDDING_MODEL` — `src/core/configs.py:42-70` |
| Notification service (`{NOTIFICATION_BASE_URL}/v2/notification/send`) | Designation-approval and CBP-approval emails | `NOTIFICATION_BASE_URL`, `ENABLE_EMAIL_NOTIFICATION`, `SPV_PORTAL_URL`, `MDO_PORTAL_URL` — `src/core/configs.py:172-187` |
| Bhashini (`{BHASHINI_CONFIG_API_URL}` → dynamic `callbackUrl`) | ACBP/CBP report translation | `BHASHINI_*` — `src/core/configs.py:136-165` |
| GCS (optional) | Document storage | `DOCUMENT_STORAGE_TYPE=gcp`, `GCP_STORAGE_BUCKET` — `src/core/configs.py:81-99` |
| CB ext course service (`{CB_EXT_COURSE_SERVICE_URL}/cbplan/v2/aicbp/{create,publish}`) | Publishing an approved CBP plan to iGOT | Read only by `bulk_scripts/bulk_training_plan_approval.py` via a bare env var — **not** part of the FastAPI app's `Settings` class |

> **Verification boundary:** every route above is traced to its handler
> file:line in `cbp-ai-service` at commit `119a42b`. Request/response Pydantic
> schema field lists are in `src/schemas/`, one file per resource, matching
> each router's imports. The service(s) behind `NOTIFICATION_BASE_URL`,
> `MDO_PORTAL_URL`, `SPV_PORTAL_URL`, and `CB_EXT_COURSE_SERVICE_URL` are not
> present in this repo — only the outbound calls into them are visible here.
