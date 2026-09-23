# Search — Use Cases

Traced across ten repos (see [index](index.md) for the exact commit pinned
per repo). Endpoints below are relative to each service's own mount path;
where a client reaches a backend through `sunbird-cb-uiproxy`, the proxy hop
is called out explicitly.

## NLP keyword extraction (learner clients only)

### UC-1 · Extract a search keyword from free text

Before running any content search, the learner web portal and the mobile
app both send the user's raw query to `nlp-search`, which uses an LLM
(Gemini, via Vertex AI) to extract a ranked list of keywords and picks the
top-priority one as the actual search term.

- API: `POST /nlp/search` — `nlp-search:src/search/router.py:8` →
  `src/search/llm_service.py:37`. Request: `{"query": str, "synonyms": bool}`.
  Response: `{"data": {"keywords": [{"keyword": str, "priority": int}]}}`.
- Web portal call site: `GbSearchService.nlpSearch()` posting to
  `/apis/proxies/v8/nlp/search` —
  `sunbird-cb-portal:project/ws/app/src/lib/routes/search-v3/services/gb-search.service.ts:28,149-155`,
  invoked from `SearchInputHomeV4Component.searchInNLP()`
  (`search-input-home-v4.component.ts:778-795`) on every search submit,
  *before* `processSearchText()` builds the actual search request.
- Mobile call site: `SearchService.nlpSearch()` posting `{query, synonyms:
  false}` to `/api/nlp/search` —
  `igot_karmayogi_mobile:lib/features/search/data/services/search_service.dart:12-22`,
  called from `SearchResultPage._computeKeywordAndRecord()`
  (`search_result_page.dart:313-324`) as soon as the results page opens.
- **Non-obvious mechanism**: the extracted keyword — not the user's typed
  text — is what's actually sent to every downstream content/people/
  community/event search on both clients. A user searching "certificate
  courses for accountants" is really searching on whatever single keyword
  the LLM ranked highest.
- **Not called at all** by `sunbird-cb-orgportal`, `sunbird-cb-creationportal`,
  or `sunbird-cb-adminportal` — confirmed by a repo-wide grep for `nlp` in
  each (zero matches in all three). These three portals send the user's raw
  typed text straight to content search.
- Reachability: `sunbird-cb-uiproxy` proxies `ALL /proxies/v8/nlp/*` to
  Kong (`proxies_v8.ts:1481-1483`), whitelisted with `ROLE_CHECK:
  [ROLE.PUBLIC]` (`whitelistApis.ts:5545-5551`) — any authenticated session,
  no elevated role required. What Kong forwards this to is outside all ten
  repos (see Verification boundary in [HLD](hld.md)).

### UC-2 · No-auth exposure of the NLP endpoint

`nlp-search`'s `/nlp/search` route itself has **no authentication of any
kind** at the application layer — no middleware, no `Depends()` dependency,
no header check anywhere in the three Python files that make up the service
(`main.py`, `search/router.py`, `search/llm_service.py`). Any caller that can
reach the container directly (bypassing uiproxy/Kong) can invoke it for
free. Whatever perimeter auth exists is enforced upstream (Kong, uiproxy's
Keycloak/whitelist gate), not by this service itself.

## Content search (all five frontends)

### UC-3 · Search courses/content (learner)

The learner's primary content search, run per-category in parallel by
`LearnSearchComponent` (web) once the NLP keyword is resolved.

- Web: `GbSearchService.searchCoursesv5()` → `POST
  /apis/proxies/v8/composite/v5/search` (constant `SEARCH_V5`/
  `COMPOSITE_SEARCH`, `gb-search.service.ts:20-40`), or `searchCoursesv4()`
  → `POST /apis/proxies/v8/sunbirdigot/v4/search`.
- Mobile: `SearchService.getCompositeSearchDataV5()` → `POST
  /api/composite/v5/search` (`api_endpoints.dart:163`), with a
  remote-config override read from `searchConfig?.apiEndpoints.compositeSearch`
  — `search_service.dart:421-495`.
- Backend: **inferred, not directly confirmed** — `knowledge-platform`'s
  `search-service` exposes matching routes `POST /v4/search` and `POST
  /v5/search`
  (`SearchController.searchV4()`/`ExtendedSearchController.searchV5()`,
  `knowledge-platform:search-api/search-service/conf/routes:4-16`), and the
  client-side path suffixes (`v4/search`, `v5/search`) line up with them.
  But the actual Kong routing config that would prove
  `composite/v5/search`/`sunbirdigot/v4/search` resolve to *this* service
  (rather than some other backend behind the same gateway) is not present
  in any of the ten repos — see the Verification boundary in [HLD](hld.md).
  `/v4` disables the "secure settings" default filter; `/v5` adds
  JWT-derived `user_roles`/`org` context and response field-filtering.
- Query construction: `SearchActor.getSearchDTO()` maps the wire-level
  `filters`/`query`/`sort_by`/`facets` into ES query terms
  (`SearchActor.java:99-333`); `SearchProcessor.processSearchQuery()` builds
  the actual `SearchSourceBuilder` (`SearchProcessor.java:233-329`), free
  text becoming a `multiMatchQuery` across a boosted field list
  (`SearchProcessor.java:647-669`).
- Index: `compositesearch` (`SearchConstants.java:6` in `knowledge-platform`;
  same literal in `knowledge-platform-jobs:search-indexer/src/main/resources/search-indexer.conf:19`).

### UC-4 · Search content (org admin / platform admin)

`sunbird-cb-orgportal` and `sunbird-cb-adminportal` both run the same
`routes/search/{learning,knowledge,social}` module shape.

- `LearningComponent.getResults()` → `SearchServService.searchV6Wrapper()`
  → `POST /apis/protected/v8/content/searchV6` (constant `SEARCH_V6`) —
  identical endpoint constant and request shape in both
  `sunbird-cb-orgportal:project/ws/app/src/lib/routes/search/apis/search-api.service.ts:35`
  and `sunbird-cb-adminportal`'s equivalent file.
- Backend: `sunbird-cb-uiproxy:src/protectedApi_v8/content.ts:473-501`
  (`searchV6()`) POSTs directly to `CONSTANTS.SEARCH_API_BASE + '/v6/search'`
  — no Kong hop for this one, but `SEARCH_API_BASE` is a generic env var
  (`src/utils/env.ts:109,118`); nothing in `uiproxy`'s own config names it
  "knowledge-platform" explicitly, though the `/v6/search` suffix matches
  `search-service`'s own route name exactly. Injects `rootOrg` and `uuid`
  into the request body before forwarding.
- No NLP step precedes this call in either portal (confirmed absent by
  repo-wide grep).

### UC-5 · Search content while authoring (content author)

`sunbird-cb-creationportal`'s "My Content" screen and content-picker
dialogs (for adding existing courses to a collection/program).

- My Content: `all-content.component.ts:650` `fetchContent()` →
  `my-content.service.ts:311` `getSearchBody()` → `fetchFromSearchV6()` →
  `POST {AUTHORING_SEARCH_BASE}v6/search/auth` or `.../v6/search/admin`
  (role-gated, `apiEndpoints.ts:31-32`).
- Content picker (adding courses to a collection): `courses-selector.component.ts:359`
  `getCourseApi()` → `POST {PROXY_SLAG_V8}sunbirdigot/v4/search`
  (`NEW_SEARCH`, `apiEndpoints.ts:12`), with tab-specific filters
  (`createdBy`, `courseCategory`).
- **No NLP call anywhere in this repo** (confirmed absent by grep). Keyword/
  tag suggestion during authoring instead goes through an unrelated
  competency-search path — see UC-8.

### UC-6 · Autocomplete / typeahead

Two distinct mechanisms coexist across the codebase, not a single shared
autocomplete API:

- **Direct ES autocomplete** (used by all three admin-facing portals, plus
  the web portal's older `search`/`search-v2` modules): `GET
  /apis/protected/v8/content/searchAutoComplete?q=...&l=...`
  (`SEARCH_AUTO_COMPLETE`), which `sunbird-cb-uiproxy` resolves to a
  **direct Elasticsearch query** against a per-language index
  `searchautocomplete_${lang}` (`content.ts:293-356`) — not a proxy to
  `search-service`.
- **Live-results dropdown** (web portal's active `search-v3`,
  `SearchInputHomeV4Component.searchFromQuery()`,
  `search-input-home-v4.component.ts:628-732`): fires on every debounced
  keystroke directly against the category-specific search endpoints (UC-3),
  not a dedicated autocomplete endpoint — the "autocomplete" here is really
  a live preview of full search results.

### UC-7 · Recent searches

Persisted server-side on every client that has the feature — no client
keeps recent-search history in local storage (confirmed by grep for
`localStorage`/Hive/SharedPreferences on both web and mobile; zero hits
tied to search history).

- Endpoints (identical shape on web and mobile):
  `POST /search/v1/recent/create`, `GET .../recent/read`, `DELETE
  .../recent/delete`, `DELETE .../recent/delete/timestamp/{id}`.
- Web: `GbSearchService.recentCreate/recentRead/...`
  (`gb-search.service.ts:158-186`), fired after every successful NLP search.
- Mobile: `SearchRepository.createRecentSuggestion()`/`getRecentSearch()`
  (`search_repository.dart`), same trigger point.
- The record stores both the raw query and the NLP-extracted keyword
  (`nlpSearchQuery` field) on clients that call NLP — on admin portals,
  which have no equivalent recent-search UI in the traced code, this
  endpoint is not exercised by search at all.

### UC-8 · Tag/keyword suggestion while authoring (content author only)

Not part of the NLP pipeline — a completely separate, non-LLM search used
only in `sunbird-cb-creationportal`'s content-metadata editor.

- `edit-meta.component.ts:555` wires a Material autocomplete on
  `competencyCtrl.valueChanges` (500ms debounce) →
  `competence.service.ts:44` `fetchAutocompleteCompetencyV2()` → `POST
  {PROXY_SLAG_V8}/competency/v4/search` with a composite `{searches:
  [{type:'COMPETENCY', field:'name', keyword}, {type:'COMPETENCY',
  field:'status', keyword:'VERIFIED'}]}` payload.
- Selected suggestions are pushed into the content form's `keywords` field
  as chips — functionally similar end-user outcome to `nlp-search`'s
  keyword extraction, but sourced from a curated competency taxonomy, not
  an LLM.

## Admin user search (separate from content search on every admin portal)

### UC-9 · Search the platform's user directory

A distinct query surface from everything above — searches user accounts,
not Elasticsearch's `compositesearch` content index.

- `sunbird-cb-orgportal`: `AllUsersComponent.getUsers()` →
  `UsersService.getAllKongUsers()` → `POST /apis/proxies/v8/user/v1/search`
  (`GET_ALL_USERS`), body `{request: {filters: {rootOrgId, status}, query,
  limit, offset}}`.
- `sunbird-cb-adminportal`: `search-panel.component.ts` emits a typed
  `searchType` (`name|email|phone|userId|roles|...`) → `list-user.component.ts`
  maps it to a specific field path (`SEARCH_FIELD_MAPPINGS`) → same `POST
  /apis/proxies/v8/user/v1/search` endpoint, but only free-texts the query
  when `searchType === 'name'`; every other type is an exact-field filter.
- Neither of these calls `search-service`, `nlp-search`, or the
  `compositesearch` index — this is a fully independent search path that
  happens to share the "search" name and, in some cases, the `/user/v1/search`
  endpoint's underlying implementation (which is itself outside all ten
  traced repos — see [HLD](hld.md) Verification boundary).

## Query builder for training/CBP plans (org admin only)

### UC-10 · Search courses and assignees when building a program

`sunbird-cb-orgportal`'s Training Plan wizard exposes two more independent
search calls, neither NLP-backed:

- Course search: `training-plan/components/search/search.component.ts:127-177`
  `getContent()` → `POST apis/proxies/v8/sunbirdigot/search`
  (`GET_ALL_CONTENT`), filtered by `courseCategory`/`organisation`/
  competency taxonomy.
- Assignee search: `getCustomUsers()` (same file, lines 179-235) → `POST
  apis/proxies/v8/user/v1/search` (`GET_ALL_USERS`) — the same admin
  user-search endpoint as UC-9, reused here to find candidates for a
  program.
