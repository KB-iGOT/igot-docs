# AI CBP Tool — APIs

Verified from `cbp-ai-service` (`origin/cbrelease-4.8.39`, commit
`70d7175`), `ai-cbp-mdo-service` (`origin/cbrelease-4.8.39`, commit
`88040de`), and `cbp-ai-ui` (`origin/cbrelease-4.8.39`, commit `15a3b9a`).
These are two independent FastAPI services with two independent path
schemes — they are documented as separate sections below, since nothing in
either repo unifies them under one gateway.

## `cbp-ai-service` — author-facing pipeline

All paths below are relative to the app; the app itself is mounted with
`root_path = settings.APP_ROOT_PATH` (`src/main.py:37-46`). `cbp-ai-ui`'s own
client confirms this service is reachable at a `cbp-tpc-ai/api/v{1,2,3}/...`
gateway path in at least one environment
(`cbp-ai-ui:src/app/modules/shared/services/shared.service.ts:9-62`,
`API_END_POINTS`) — a fact the previous single-repo trace could only infer
from one `tokenUrl` string and is now cross-repo confirmed.

Path construction: `/api` (`src/api/__init__.py:8`) + `/v1`, `/v2`, or `/v3`
(`src/api/v{1,2,3}/__init__.py:7` or `:4`) + the router's own prefix (if
any) + the route path. Auth column values refer to dependencies in
`src/api/dependencies.py`: `active` = `get_current_active_user` (any
authenticated, active user), `admin` = `require_role("Super Admin")`,
`token` = `get_current_user_with_token`, `public` = no auth.

### Auth — `/api/v1/auth`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/login` | `src/api/v1/auth.py:42` | Form login (username/password); brute-force lockout via `LoginAttempt`; returns JWT access+refresh pair, persists a `UserSession` row | public |
| POST | `/refresh` | `src/api/v1/auth.py:157` | Exchanges a valid refresh token for a new access token | public |
| POST | `/logout` | `src/api/v1/auth.py:207` | Deletes the session row for the current token (blacklists it) | token |
| POST | `/unlock-account/{username}` | `src/api/v1/auth.py:252` | Clears an account's failed-login counter | admin |
| GET | `/account-status/{username}` | `src/api/v1/auth.py:305` | Reports lockout state/attempt counts for an account | admin |
| POST | `/cleanup-expired-sessions` | `src/api/v1/auth.py:350` | Deletes DB session rows whose refresh token has expired | admin |

`cbp-ai-ui` confirms `/login` and `/logout` are called exactly as documented
(`LOGIN`/`LOGOUT` constants, `shared.service.ts:9-10`, `performLogin()`/
`logout()`, `:500-523`) plus a third call not previously listed here:
`GET /api/v1/users/me` (`GET_USER_PROFILE`, `shared.service.ts:11`,
`getUserProfile()`, `:616-627`) — this is `cbp-ai-service`'s own users
endpoint (see the roles/users table below), confirmed as the profile call
the UI actually makes right after login.

### Organization lookups — `/api/v1`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| GET | `/state-center/` | `src/api/v1/state_center.py:18` | Proxies iGOT `POST {KB_BASE_URL}/api/org/v1/search` to list ministries/states | active |
| GET | `/department/state-center/{state_center_id}` | `src/api/v1/department.py:19` | Proxies the same iGOT org-search API to list departments under a ministry/state | active |
| POST | `/kb/designation/search` | `src/api/v1/designation.py:15` | Raw passthrough of a designation search to iGOT's designation-master API | active |
| GET | `/health` | `src/api/v1/health.py:21` | Liveness check — app version + UTC timestamp | public |

### Roles &amp; users — `/api/v1`

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

### Documents &amp; summaries — `/api/v1`

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

`cbp-ai-ui` confirms `POST /files`, `GET /files`, `POST /files/{id}/summary`,
`DELETE /files/{id}`, `GET /files/{id}/download`, `DELETE
/files/{id}/summary` are all called by name (`shared.service.ts:757-845`).

### Role mapping — v1 (`/api/v1/role-mapping`, full CRUD surface)

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

`cbp-ai-ui` calls `match-designations` (`getMatchedRoleMapping()`), `reorder`
(`updateDesignationHierarchy()`), and the state-center(+department) GETs
(`getRoleMappingByStateCenter()`/`...AndDepartment()`) — but calls **v3**,
not v1, for the generate step itself (see below).

### Role mapping — v2 (`/api/v2/role-mapping`, generate + add-designation only)

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/generate` | `src/api/v2/role_mappings.py:151` | Same background-generation pattern as v1, but takes a required `org_type` and pulls context from the generic `documents` table instead of files/legacy summaries | active |
| POST | `/add-designation` | `src/api/v2/role_mappings.py:327` | Generates one designation using multi-document summaries against `data/competencies.json`, then reconciles the result via v3's own `reconcile_role_mappings_with_kcm` (`src/api/v2/role_mappings.py:377`) against whatever taxonomy v3 currently loads (`data/withidentifier_competencies.json`) | active |

`cbp-ai-ui` calls **this** `add-designation` (v2), not v1
(`addDesignation()`, `shared.service.ts:492-498`).

### Role mapping — v3 (`/api/v3/role-mapping`, generate only)

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/generate` | `src/api/v3/role_mappings.py:163` | Three-pass pipeline: extract designation hierarchy (Work-Allocation-Order summaries only) → batch-generate FRAC competencies in parallel → reconcile Behavioral/Functional competencies against `data/withidentifier_competencies.json`. Auto-runs iGOT designation matching on success; a prior `FAILED` state is returned as-is, not retried | active |

`cbp-ai-ui`'s `generateRoleMapping()` (`shared.service.ts:298-361`) calls
**this** endpoint — the shipped author UI drives v3, not v1 or v2, for
initial generation.

### Course recommendation, suggestion &amp; user-added courses — `/api/v1`

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

`cbp-ai-ui` confirms `course-recommendations/generate`, `course/suggestions/save`,
and `user-added-courses` are all called by name — but for the actual iGOT
course *search* (as opposed to saving a result), `cbp-ai-ui` bypasses
`/course/suggestions` entirely and calls a hardcoded
`https://portal.igotkarmayogi.gov.in/api/content/v1/search` directly
(`getIGOTSuggestedCourses()`, `shared.service.ts:451-474`).

### CBP Plan — `/api/v1/cbp-plan`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/save` | `src/api/v1/cbp_plan.py:63` | Resolve selected course identifiers against the latest recommendation, iGOT search, and user-added courses; persist a new CBP plan | active |
| GET | `/` | `src/api/v1/cbp_plan.py:184` | Fetch the CBP plan for a role mapping | active |
| PUT | `/{cbp_plan_id}` | `src/api/v1/cbp_plan.py:208` | Re-resolve and overwrite `selected_courses` on an existing plan | active |
| DELETE | `/{cbp_plan_id}/course/{course_identifier}` | `src/api/v1/cbp_plan.py:321` | Remove one course from a plan | active |
| DELETE | `/role-mapping/{role_mapping_id}` | `src/api/v1/cbp_plan.py:407` | Delete the CBP plan(s) tied to a role mapping | active |

### Approval workflow — `/api/v1`

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| POST | `/approval-requests/send` | `src/api/v1/approval_requests.py:45` | Validate + snapshot completed role mappings (with CBP plans) into one approval request; emails the assigned MDO admin | active |
| GET | `/approval-requests/list` | `src/api/v1/approval_requests.py:188` | Paginated/filterable list of the caller's submitted requests | active |
| GET | `/approval-requests/{request_id}` | `src/api/v1/approval_requests.py:267` | Full detail of one approval request | active |
| POST | `/approval-requests/revoke` | `src/api/v1/approval_requests.py:344` | Revert a `pending` request to `draft` (400 otherwise) | active |
| POST | `/approval-requests/mdo-admins` | `src/api/v1/approval_requests.py:405` | Look up MDO_ADMIN/MDO_LEADER users for a department via iGOT user-search | active |
| POST | `/designation-approval/create` | `src/api/v1/designation_approval.py:29` | Submit an unmatched designation name for SPV-admin naming approval; emails SPV admins | active |
| GET | `/designation-approval/search` | `src/api/v1/designation_approval.py:115` | Paginated search of the caller's designation-approval requests | active |

**No endpoint in `cbp-ai-service` transitions an `ApprovalRequest` or
`DesignationApproval` to `APPROVED`/`REJECTED`** — that happens in
`ai-cbp-mdo-service`, below, against the same database rows.

### Dashboards &amp; reports — `/api/v1`

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

`cbp-ai-ui` confirms all four dashboard variants exist as distinct constants
(`shared.service.ts:52-55`) though no live UI code path in the shell calls
the admin or self-scoped dashboards — the dashboard route itself is
reachable only via a commented-out button (see Operations Manual).

### External integrations (outbound, not endpoints on this service)

| Target | Used for | Config |
|---|---|---|
| iGOT KB API (`{KB_BASE_URL}`) | Org search, designation search, content search, user search | `KB_BASE_URL`, `KB_AUTH_TOKEN` — `src/core/configs.py:72-73` |
| Google Gemini / Vertex AI (`google-genai`) | Document/meta summarization, role-mapping generation, designation embedding, course-query generation and reranking | `GOOGLE_PROJECT_ID`, `GOOGLE_API_KEY`, `GEMINI_PRO_MODEL_NAME`, `GEMINI_FLASH_MODEL_NAME`, `GOOGLE_EMBEDDING_MODEL` — `src/core/configs.py:42-70` |
| Notification service (`{NOTIFICATION_BASE_URL}/v2/notification/send`) | Designation-approval and CBP-approval emails | `NOTIFICATION_BASE_URL`, `ENABLE_EMAIL_NOTIFICATION`, `SPV_PORTAL_URL`, `MDO_PORTAL_URL` — `src/core/configs.py:172-187` |
| Bhashini (`{BHASHINI_CONFIG_API_URL}` → dynamic `callbackUrl`) | ACBP/CBP report translation | `BHASHINI_*` — `src/core/configs.py:136-165` |
| GCS (optional) | Document storage | `DOCUMENT_STORAGE_TYPE=gcp`, `GCP_STORAGE_BUCKET` — `src/core/configs.py:81-99` |
| CB ext course service (`{CB_EXT_COURSE_SERVICE_URL}/cbplan/v2/aicbp/{create,publish}`) | Publishing an approved CBP plan to iGOT, from the offline bulk pipeline only | Read only by `bulk_scripts/bulk_training_plan_approval.py` via a bare env var — **not** part of the FastAPI app's `Settings` class. **Not confirmed** to be the same physical service as `ai-cbp-mdo-service`'s own `{KB_BASE_URL}/api/cbplan/v2/{create,publish}` calls below — the two live under different env-var names in different repos and were not cross-verified against each other. |

## `ai-cbp-mdo-service` — MDO / SPV approval backend

Paths below are relative to `/v1` (`src/api/__init__.py:6-8`,
`src/api/v1/__init__.py:10-14`), plus `settings.APP_ROOT_PATH` at the ASGI
level (default empty). **No client in any of the three traced repos calls
this service** — its public-facing gateway path (analogous to
`cbp-ai-service`'s inferred `cbp-tpc-ai` prefix) is unverified. Auth is a
custom `x-authenticated-user-token` header, RS256-verified against
`{KB_BASE_URL}/auth/realms/sunbird/protocol/openid-connect/certs`
(`core/auth.py:12,49-116`) — not a standard `Authorization: Bearer` header,
and not the same mechanism `cbp-ai-service` uses for its own end users.
There is **no health/liveness endpoint** anywhere in this service.

### MDO approval — `/v1/mdo` (`src/api/v1/mdo_approval.py`)

| Method | Path | Line | Purpose | Roles |
|---|---|---|---|---|
| GET | `/approval-requests/list` | `:38` | Paginated list of requests assigned to the caller's own `mdo_id` | `MDO_ADMIN`, `MDO_LEADER` |
| GET | `/approval-requests/read/{request_id}` | `:82` | Full detail of one request, all items included | same |
| POST | `/approval-requests/publish` | `:114` | Approve + publish every `PENDING` item: per item, extract course ids from `cbp_plan_data`, call iGOT create-then-publish; parent → `APPROVED` if ≥1 item succeeds, `502` (request left `PENDING`) if all fail | same |
| POST | `/approval-requests/publish/retry` | `:167` | Retry one previously-`FAILED` item using its own stored plan name/due date | same |
| POST | `/approval-requests/reject` | `:199` | Reject an entire `PENDING` request (required comment, 1–500 chars) | same |
| POST | `/approval-requests/items/reject` | `:249` | Reject one item; recomputes the parent request's status from the remaining items | same |
| PUT | `/approval-requests/items/update` | `:311` | Edit a `PENDING` item's designation/role fields | same |
| POST | `/approval-requests/course/add` | `:375` | Search iGOT content and append matched courses to an item's `cbp_plan_data` (always the first record) | same |
| POST | `/approval-requests/course/remove` | `:446` | Remove one course by identifier from an item's `cbp_plan_data` | same |

### SPV designation approval — `/v1/designation` (`src/api/v1/designation_approval.py`)

| Method | Path | Line | Purpose | Roles |
|---|---|---|---|---|
| GET | `/approval-requests/list` | `:27` | Global (not admin-scoped) paginated list of designation-naming requests | `SPV_ADMIN`, `MDO_ADMIN`, `MDO_LEADER` (view only for the latter two) |
| POST | `/approval-requests/approve` | `:71` | Call iGOT `POST /api/designation/create` first; only on success (or an "Already Present" response) mark the request `APPROVED` and stamp `actioned_by` | `SPV_ADMIN` only |
| POST | `/approval-requests/reject` | `:119` | Mark `REJECTED` with an optional comment; no iGOT call | `SPV_ADMIN` only |

### Karmayogi Bharat proxy — no prefix (`src/api/v1/kb_apis.py`)

| Method | Path | Line | Purpose | Roles |
|---|---|---|---|---|
| POST | `/course/suggestions` | `:25` | Proxies `{KB_BASE_URL}/api/content/v1/search` | `MDO_ADMIN`, `MDO_LEADER` |
| POST | `/designation/search` | `:67` | Proxies `{KB_BASE_URL}/api/designation/search` | same |

### External integrations (outbound, not endpoints on this service)

| Target | Used for | Config |
|---|---|---|
| iGOT KB API (`{KB_BASE_URL}`) | CBP-plan create/publish (`/api/cbplan/v2/{create,publish}`), designation create (`/api/designation/create`), content/designation search, JWKS certs for auth | `KB_BASE_URL`, `KB_AUTH_TOKEN` |
| Notification service (`{NOTIFICATION_BASE_URL}/v2/notification/send`) | Approval/rejection emails for both the MDO and SPV flows | `NOTIFICATION_BASE_URL`, `ENABLE_EMAIL_NOTIFICATION` |
| Shared Postgres database | `approval_requests`, `approval_request_items`, `users` (mirrored, `extend_existing=True`); `role_mappings` (no ORM model — raw SQL only); `mdo_approval`, `designation_approvals` (owned outright) | `DATABASE_URL` |

**Note**: `settings.REQUIRED_ROLES` (default `["MDO_ADMIN","MDO_LEADER"]`,
`configs.py:25`) is defined but never referenced anywhere in the codebase —
every route's required-role list is a hardcoded literal at the call site
instead.

## `cbp-ai-ui` — client integration only

`cbp-ai-ui` exposes no API of its own; it is documented here only as a
cross-check on the `cbp-ai-service` endpoints above, and as evidence of
which endpoints it does *not* call.

- Every business-domain call in `cbp-ai-ui` targets the `cbp-tpc-ai/api/v{1,2,3}/...`
  prefix on one configured host, read at runtime from a static asset
  (`assets/jsonfiles/configurations.json`'s `portalURL` field), not from
  Angular's build-time `environment.ts` files
  (`cbp-ai-ui:src/app/modules/shared/services/init.service.ts:33-64`).
- `cbp-ai-ui` never calls `ai-cbp-mdo-service` directly — the closest it
  gets is `POST cbp-tpc-ai/api/v1/approval-requests/mdo-admins` and
  `POST .../approval-requests/send`, both `cbp-ai-service` endpoints.
- `cbp-ai-ui` calls one hardcoded absolute iGOT URL
  (`https://portal.igotkarmayogi.gov.in/api/content/v1/search`) directly,
  bypassing its own backend's proxy for that one search.
- The actual request/response bodies for most of the ~40 endpoints in
  `SharedService` are untyped (`Observable<any>`) — there is no
  compile-time contract between `cbp-ai-ui` and `cbp-ai-service` for any of
  these calls; what's documented above is only what's visibly built into
  each request body in `shared.service.ts`.
- The step-by-step feature screens that would exercise most of these
  endpoints are not in this repo — see the Verification boundary below.

> **Verification boundary:** every route above is traced to its handler
> file:line in the repo named in its section heading, at the commit listed
> at the top of this page. Request/response Pydantic schema field lists for
> `cbp-ai-service` are in `src/schemas/`, one file per resource. Not
> resolved by this trace: whether `ai-cbp-mdo-service` sits behind the same
> gateway/host as `cbp-ai-service` (no client in any of the three repos
> calls it), whether `CB_EXT_COURSE_SERVICE_URL` and `KB_BASE_URL` are the
> same physical downstream service, and the actual request/response
> contracts used by the CBP author's real wizard screens, which live in the
> unavailable `@sunbird-cb/cbp-ai` library rather than `cbp-ai-ui` itself.
