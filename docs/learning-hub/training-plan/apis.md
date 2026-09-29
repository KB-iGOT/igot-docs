# Training Plan — APIs

Gateway prefixes stripped for readability; every endpoint below is
`{{host}}/apis/proxies/v8/...` unless marked otherwise. Verified from
`sunbird-cb-orgportal › traininig-plan.service.ts` / `training-plan-dashboard.service.ts`,
`sunbird-cb-portal › cbp-plan.component.ts`, `sunbird-cb-uiproxy ›
whitelistApis.ts` / `proxies_v8.ts`, `sunbird-cb-ext ›
CbPlanController.java`, and `cb-ext-course-service ›
CbPlanWithAccessSettings.java` (v2) / `CbPlanWithAccessSettingsV3.java` /
`CbPlanWithAccessSettingsV4.java`.

There is no single "Training Plan API." Four independent, simultaneously
live API generations exist behind the same `cbplan/*` path family, split
across two backend repos.

## Proxy layer (`sunbird-cb-uiproxy`)

```ts
// src/proxies_v8/proxies_v8.ts
proxiesV8.use('/cbplan/*', proxyCreatorSunbird(express.Router(), CONSTANTS.KONG_API_BASE))
```

Every `cbplan/*` call — v1 through v4 — is forwarded generically to the Kong
API gateway; uiproxy does not itself pick sunbird-cb-ext vs.
cb-ext-course-service as the target — that routing decision lives in Kong,
outside these 9 repos.

RBAC (`whitelistApis.ts`, repeated per version block): create/update/
publish/archive/read/list require role `MDO_ADMIN` or `MDO_LEADER`; the
learner-facing `user/v1/cbplan` and `.../user/dictionary` routes require
only `PUBLIC` (i.e. any authenticated user).

## v1 — `sunbird-cb-ext` (`CbPlanController`, base `/cbplan/v1`)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `cbplan/v1/create` | Create a plan as `DRAFT`, storing the whole payload as a `draftData` JSON blob |
| POST | `cbplan/v1/update` | Creator or `MDO_LEADER`-role only; on a `LIVE` plan, restricted to `name`/`assignmentTypeInfo`/`endDate`/`isApar`, and blocks un-setting `isApar` |
| POST | `cbplan/v1/publish` | Promotes draft fields onto the live row, sets `status=LIVE`; rebuilds `cb_plan_lookup` fan-out rows per assignee key |
| DELETE | `cbplan/v1/archive` | Sets `status=RETIRE` (terminal); deactivates all lookup rows |
| GET | `cbplan/v1/read/{cbPlanId}` | Enriches assignees (names/designations) and content (name, rating, duration, icon, etc., LIVE content only) |
| POST | `cbplan/v1/list` | Org-scoped list, requires `filters.status` |
| GET | `cbplan/v1/user/list` | Learner's own plans, resolved via `X-Auth-Token` |
| GET | `cbplan/v1/private/user/list` | Same, internal/service-to-service variant using `X-Auth-User-Id` directly |
| POST | `cbplan/v1/admin/requestcontent` | The only v1 endpoint still actively called by the current UI — files a content request and triggers a Kafka-driven provider-org email |

### Create/update payload (v1)

```jsonc
// POST cbplan/v1/create
{
  "request": {
    "name": "…",                 // required
    "contentType": "…",          // required
    "contentList": ["do_…"],     // required
    "assignmentType": "allUser | customUser | designation",
    "assignmentTypeInfo": ["…"], // user ids / designations, per assignmentType
    "endDate": "yyyy-MM-dd",     // required
    "isApar": false
  }
}
```

## v2 — `cb-ext-course-service` (`CbPlanWithAccessSettings`, base `/cbplan/v2`)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `cbplan/v2/create` | Create against `cb_plan_v2` |
| POST | `cbplan/v2/aicbp/create` | Admin/service creates a plan on a user's behalf — the AICBP entry point (also duplicated on v3, see below) |
| POST | `cbplan/v2/aicbp/publish` | Admin/service publishes on a user's behalf |
| POST | `cbplan/v2/update` | |
| POST | `cbplan/v2/publish` | |
| GET | `cbplan/v2/read/{cbPlanId}` | |
| GET | `cbplan/v2/migrate` | Runs `AccessSettingMigrationServiceImpl` — an access-setting-rules **re-indexing** utility (rebuilds an Elasticsearch index from `access_setting_rules`), **not** a v1→v2 data migration despite the name |
| POST | `cbplan/v2/search` | |
| DELETE | `cbplan/v2/archive` | |
| GET | `cbplan/v2/user/list` | |
| GET | `cbplan/v2/user/lookup` | |
| GET | `cbplan/v2/admin/user/list/{userId}` | |

## v3 — `cb-ext-course-service` (`CbPlanWithAccessSettingsV3`, base `/cbplan/v3`)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `cbplan/v3/create` | Against `cb_plan_v3` |
| POST | `cbplan/v3/update` | |
| POST | `cbplan/v3/publish` | |
| DELETE | `cbplan/v3/archive` | Per source javadoc, "version-agnostic" — same archive logic reused by v4 |
| GET | `cbplan/v3/read/{cbPlanId}` | |
| POST | `cbplan/v3/search` | Used by the learner-facing `cbp` portal (`fetchCbpPlanListV3`) |
| POST | `cbplan/v3/user/dictionary` | Per-user active-plan dictionary, grouped APAR/non-APAR |
| POST | `cbplan/v3/aicbp/create` | Confirmed as the endpoint `cbp-ai-service`'s bulk-approval pipeline calls directly |
| POST | `cbplan/v3/aicbp/publish` | Same |

## v4 — `cb-ext-course-service` (`CbPlanWithAccessSettingsV4`, base `/cbplan/v4`)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `cbplan/v4/create` | Reads/writes the **same** `cb_plan_v3` table as v3 (`cbplan.v4.plan.table=cb_plan_v3`) |
| POST | `cbplan/v4/update` | |
| POST | `cbplan/v4/publish` | |
| GET | `cbplan/v4/read/{cbPlanId}` | LIVE-only |
| GET | `cbplan/v4/admin/read/{cbPlanId}` | Any status — used by the Org Portal dashboard |
| POST | `cbplan/v4/search` | Used by the Org Portal dashboard and the Reusable-User-Groups `use-in-plan-dialog` (filtered to `status: ['draft']`) |
| DELETE | `cbplan/v4/archive` | |
| POST | `cbplan/v4/user/dictionary` | Per-user, filterable by plan year (financial year) |
| GET | `cbplan/v4/user/assessment/eligibility/{doId}` | Checks whether a Comprehensive Assessment `do_id` is unlocked for the caller via a `caLinkedId` match, across current + previous financial year |

v4's differentiator from v3 is **not** a new table — it's `userGroupId`
(resolved against `user_group_info`) replacing v3's inline
`userGroupCriteriaList`/`userGroupName` as the access-control model. Both
`readCbPlan`/`readCbPlanAdmin` are documented in source as working for
plans created by either generation.

## Cross-service link — Comprehensive Assessment (`cb-ext-course-service`)

| Direction | Mechanism | Purpose |
|---|---|---|
| Search-indexer Flink job → `CbPlanCaLinkConsumer` | Kafka topic `dev.trainingplan.ca.events`, group `cbPlanCaLinkConsumerGroup`; message `{eventType: ADD|REMOVE, trainingPlanId, caIdentifier}` | Mirrors a Comprehensive Assessment collection's `trainingPlan_v2` link onto the plan's own `calinkedid` column — compare-then-write, safe against redelivery/replay |

## Content-request notification (`sunbird-cb-ext`)

| Direction | Mechanism | Purpose |
|---|---|---|
| `CbPlanServiceImpl.requestCbplanContent` → `CbplanContentConsumer` | Kafka topic `dev.cbplan.content.request`, group `cbplanContentRequestAsyncHandlerGroup` | Async: looks up `CBP_ADMIN`s in the named provider org(s) via the LMS user-search endpoint, renders a Velocity-templated email (`cbplanContentRequestTemplate`, template row from Cassandra `email_template`), posts it to the platform's notification service |

## Bulk pipeline → backend (`cbp-ai-service`, direct HTTP, bypassing uiproxy)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `{CB_EXT_COURSE_SERVICE_URL}/cbplan/v3/aicbp/create` | Creates one `AICBP`-typed plan per designation (`contextData.accessControl.userGroups` scoped by designation+org) |
| POST | `{CB_EXT_COURSE_SERVICE_URL}/cbplan/v3/aicbp/publish` | Publishes it, tagging `targetedOrganisation` |

Auth here is a bare `x-authenticated-user-token` (the human approver's JWT,
fetched fresh per run via Keycloak password grant) — no service-to-service
token, no org header.

> **Verification boundary:** v1's Cassandra keyspace name was not located as
> an explicit string constant in the excerpts read — inferred to be the
> platform's standard `sunbird` keyspace by usage pattern alongside other
> `USER`-table lookups, not confirmed by a printed constant value. The exact
> Kong path-rewrite rule that picks `sunbird-cb-ext` vs.
> `cb-ext-course-service` per version prefix is outside these 9 repos and
> was not traced.
