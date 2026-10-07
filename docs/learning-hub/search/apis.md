# Search — APIs

Verified from `nlp-search` (`origin/cbrelease-4.8.23.1`, commit `54073e5`),
`knowledge-platform` (`origin/cbrelease-4.8.41`, commit `38bf7d92`),
`knowledge-platform-jobs` (`origin/cbrelease-4.8.41`, commit `86aefb6a`), and
`sunbird-cb-uiproxy` (`origin/cbrelease-4.8.41`, commit `423875ac`). These
are independent services with independent path schemes; documented as
separate sections since nothing in any of the four repos unifies them under
one gateway definition visible from source.

## `nlp-search` — keyword extraction

App has no path prefix beyond what's shown; mounted directly (`src/main.py:5`).

| Method | Path | Handler | Purpose | Auth |
|---|---|---|---|---|
| GET | `/` | `src/main.py:7-9` | Welcome/liveness message | public |
| POST | `/nlp/search` | `src/search/router.py:8` → `src/search/llm_service.py:37` | Extracts keywords from `query` via Gemini; `synonyms:true` appends a synonym instruction to the prompt | **public** — no auth of any kind in-app |

Request: `{"query": str (1-400 chars), "synonyms": bool = false}`.
Success response: `{"data": {"keywords": [{"keyword": str, "priority": int}, ...]}}`.
No `response_model` is declared on the route, so error paths (see
[Operations Manual](operations-manual.md)) do not reliably produce the
documented shape or status code.

## `knowledge-platform` — `search-service`

Routes from `search-api/search-service/conf/routes:4-16`. `commonHeaders()`
(`SearchBaseController.scala:27-38`) maps `x-authenticated-user-orgid` →
internal channel context, falling back to `channel.default` config.

| Method | Path | Controller.method | Notes | Auth |
|---|---|---|---|---|
| GET | `/health` | `HealthController.health()` | Liveness | public |
| GET | `/service/health` | `HealthController.serviceHealth()` | Dependency (ES) health | public |
| POST | `/v3/search` | `SearchController.search()` | Public search; rejects `filters.visibility=Private` | header-based |
| POST | `/v3/private/search` | `SearchController.privateSearch()` | Channel-scoped; requires resolved `CHANNEL_ID` | header-based |
| POST | `/v2/search/count`, `/v3/count` | `SearchController.count()` | Count only | header-based |
| POST | `/v4/search` | `SearchController.searchV4()` | Disables the default "secureSettings" filter | header-based |
| POST | `/v5/search` | `ExtendedSearchController.searchV5()` | Adds JWT-derived `user_roles`/`org` context, response field-filtering | JWT (claims read, **not signature-verified** in this service) |
| POST | `/v4/bp/search` | `ExtendedSearchController.blendedProgramSearch()` | "Blended program" search; requires JWT `sub` claim | JWT (same caveat) |

`/v5` and `/v4/bp` decode the JWT payload from `x-authenticated-user-token`
or `Authorization: Bearer` by base64-decoding the middle segment **without
verifying its signature** (`ExtendedSearchController.scala:76-90`) — trust in
that header depends entirely on an upstream gateway having already
validated it; no such validation exists inside this repo.

Request envelope: `{id, ver, ts, params, request: {query, filters, sort_by,
facets, fields, exists, not_exists, limit, offset, mode, softConstraints,
aggregations, multiFilters}}`. Index searched: `compositesearch`
(`SearchConstants.java:6`, overridable via `compositesearch.index.name`).

## `knowledge-platform-jobs` — `search-indexer` (not an HTTP API)

No HTTP surface — this is a Flink streaming job triggered by Kafka, not a
request/response service. Included here because it's the write side of the
same index `search-service` reads.

| Trigger | Topic | Direction | Notes |
|---|---|---|---|
| Kafka consume | `sunbirddev.learning.graph.events` (`kafka.input.topic`) | in | Graph-transaction event (CREATE/UPDATE/DELETE) — `SearchIndexerStreamTask.scala:25` |
| Kafka produce | `sunbirddev.learning.events.failed` (`kafka.error.topic`) | out | Dead-letter sink for failed index writes |
| Kafka produce | `sunbirddev.trainingplan.ca.events` (`kafka.output.trainingplan.topic`) | out | Derived training-plan ADD/REMOVE events on `trainingPlan_v2` property change |
| ES write | `compositesearch` index, type `cs` | out | `ElasticSearchUtil.addDocument`/`bulkIndexWithIndexId` — `jobs-core/.../ElasticSearchUtil.scala:76-88,148-169` |

A second bulk-write path exists independent of Kafka: content-publish's
`CollectionPublisher.syncNodes()` bulk-indexes a collection's child/unit
nodes into the same `compositesearch` index at publish time
(`publish-pipeline/content-publish/.../CollectionPublisher.scala:558-583`).

## `sunbird-cb-uiproxy` — BFF surface

All paths mounted under `/protected/v8` (Keycloak-protected) or `/proxies/v8`
(Keycloak-protected + RBAC-whitelisted via `isAllowed()`,
`src/utils/apiWhiteList.ts`).

| Method | Path | Handler | Backend | Auth |
|---|---|---|---|---|
| POST | `/protected/v8/content/searchV5` | `content.ts:394-417` | `{SEARCH_API_BASE}/search5` | Keycloak session; **not in the RBAC whitelist** (relies on session gate alone) |
| POST | `/protected/v8/content/searchV6` | `content.ts:473-501` | `{SEARCH_API_BASE}/v6/search` | Keycloak session; not in RBAC whitelist |
| GET/POST | `/protected/v8/content/searchAutoComplete` | `content.ts:293-356` | Direct Elasticsearch query, index `searchautocomplete_${lang}` (`ES_BASE`) | Keycloak session |
| POST | `/protected/v8/content/searchRegionRecommendation` | `content.ts:419-471` | `{SEARCH_API_BASE}/search5`, retried with a `defaultLabel` filter on zero hits | Keycloak session; requires `org`/`rootOrg` headers |
| ALL | `/proxies/v8/nlp/*` | `proxies_v8.ts:1481-1483` | Passthrough to Kong (`KONG_API_BASE`) | Keycloak session + RBAC whitelist entry `ROLE.PUBLIC` for `/nlp/search` |
| ALL | `/proxies/v8/search/*` | `proxies_v8.ts:1499-1501` | Passthrough to Kong | Keycloak session; only specific sub-paths (e.g. `/search/v1/recent/*`) are individually whitelisted |

`proxyCreatorSunbird()` (`src/utils/proxyCreator.ts:300-341`) injects
`x-channel-id` and
`x-authenticated-user-*` headers derived from the Express session before
forwarding — this is the header-injection step both `/nlp/*` and
`/search/*` share with every other proxied route; no search-specific
reshaping happens in this layer.

## Frontend-consumed endpoint reference (as called by each client)

Endpoint constants as hardcoded per client (all resolvable/overridable via
each client's own remote tenant config at runtime — these are the code
defaults):

| Endpoint | Called by | Constant |
|---|---|---|
| `POST /apis/proxies/v8/nlp/search` | web portal (`search-v3`), mobile | `SEARCH_NLP` / `nlpSearch` |
| `POST /apis/proxies/v8/composite/v5/search` | web portal, mobile | `SEARCH_V5`/`COMPOSITE_SEARCH` |
| `POST /apis/proxies/v8/sunbirdigot/v4/search` | web portal, creation portal (course picker) | `SEARCH_V4`/`NEW_SEARCH` |
| `POST /apis/protected/v8/content/searchV6` | web portal (older), org portal, creation portal, admin portal | `SEARCH_V6` |
| `GET /apis/protected/v8/content/searchAutoComplete` | web portal (v1/v2), org portal, admin portal | `SEARCH_AUTO_COMPLETE` |
| `POST /apis/proxies/v8/user/v5/public/search` | web portal | `SEARCH_PEOPLE` |
| `POST /apis/proxies/v8/community/v1/search` | web portal | `SEARCH_COMMUNITY` |
| `POST /apis/proxies/v8/cios/v1/search/content` | web portal, mobile (external content) | `SEARCH_EXT_CONTENT`/`externalCourseSearch` |
| `POST /apis/proxies/v8/user/v1/search` | org portal, creation portal (collaborators), admin portal, training-plan wizard | `GET_ALL_USERS`/`SEARCH_USER_TABLE` |
| `POST /apis/proxies/v8/user/v3/search` | admin portal | `GET_ALL_USERS_V3` |
| `POST /apis/proxies/v8/competency/v4/search` | creation portal (tag suggestion) | `searchCompetency` |
| `POST /apis/proxies/v8/social/post/search` | org portal, admin portal | `SOCIAL_VIEW_SEARCH_RESULT` |
| `{POST,GET,DELETE} /apis/proxies/v8/search/v1/recent/*` | web portal, mobile | `RECENT_CREATE`/`RECENT_READ`/`RECENT_DELETE_BY_*` |

**Verification boundary:** the actual runtime host these proxy paths
resolve to (Kong's routing config, `SEARCH_API_BASE`'s deployed value) is
not present in any of the ten traced repos.
