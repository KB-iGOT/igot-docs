# Search

Platform-wide search on iGOT Karmayogi: an Elasticsearch-backed content/people/
community search (`knowledge-platform`'s `search-service`) fronted by every
portal and the mobile app, plus an independent LLM keyword-extraction step
(`nlp-search`) that two of those five clients — the learner web portal and
the mobile app — call *before* they search, to turn a free-text query into a
normalized keyword.

- **Repos**:
    - `nlp-search` (traced at `origin/cbrelease-4.8.23.1`, commit `54073e5`)
      — a small FastAPI service that extracts search keywords from a query
      via Gemini (Vertex AI).
    - `knowledge-platform` (traced at `origin/cbrelease-4.8.41`, commit
      `38bf7d92`) — `search-api`'s `search-service`: the Play/Akka HTTP
      service that executes searches against Elasticsearch.
    - `knowledge-platform-jobs` (traced at `origin/cbrelease-4.8.41`, commit
      `86aefb6a`) — the Kafka-driven Flink `search-indexer` job that writes
      content into the `compositesearch` Elasticsearch index `search-service`
      reads from.
    - `sunbird-cb-uiproxy` (traced at `origin/cbrelease-4.8.41`, commit
      `423875ac`) — the BFF/proxy layer: direct `searchV5`/`searchV6`/
      `searchAutoComplete` handlers, plus generic `/nlp/*` and `/search/*`
      passthrough proxies to Kong.
    - `sunbird-devops` (traced at `origin/cbrelease-4.8.41`, commit
      `7618c887`) — Elasticsearch (7.10.2) provisioning, the `nlp-search-service`
      and `core/search` Helm charts, and Kong routing config.
    - `sunbird-cb-portal` (traced at `origin/cbrelease-4.8.41`, commit
      `c184fd79`) — the main learner portal; its `search-v3` module calls
      `nlp-search` before every content search.
    - `sunbird-cb-orgportal` (traced at `origin/cbrelease-4.8.41`, commit
      `089324e1`) — MDO/SPV admin portal; content search, social search, and
      admin user search — no NLP call.
    - `sunbird-cb-creationportal` (traced at `origin/cbrelease-4.8.40`,
      commit `514e3264`) — content-author portal; "my content" and
      content-picker search, plus a competency/taxonomy search used for tag
      suggestion instead of NLP — no NLP call.
    - `sunbird-cb-adminportal` (traced at `origin/cbrelease-4.8.41`, commit
      `4a35703e`) — system/platform-admin portal ("spv"); content search,
      social search, admin user search — no NLP call.
    - `igot_karmayogi_mobile` (traced at `master`, commit `e0deaf59`, tag
      `iGotApp-v5.0.5-S40`) — the Flutter app; calls `nlp-search` before
      every content/people/community/event/resource search, same pattern as
      the web portal.
- **Self-description in code**: `search-service` self-identifies only by its
  Play app name in `application.conf`; `nlp-search`'s README calls itself
  "NLP Search Service"; none of the five frontends name a unified "Search"
  feature in code — each treats it as its own `search`/`search-v2`/`search-v3`
  route module.
- **Shape**: two independent backends that never call each other —
  `nlp-search` (LLM keyword extraction) and `knowledge-platform`'s
  `search-service` (Elasticsearch query execution) — stitched together only
  at the client layer. `uiproxy` fronts both with auth-header injection and
  RBAC whitelisting, then hands off to Kong, which resolves the actual
  downstream host.
- **Status**: ✅ traced end-to-end across all ten repos — API surface,
  query-DSL construction, the indexing pipeline that feeds the search index,
  and every frontend's call pattern. ⚠️ Kong's own routing config (which
  host `/nlp/search` and `/search/*` actually resolve to) lives outside all
  ten repos and could not be traced; see the honest gaps below and in
  [HLD](hld.md).

## In one paragraph

A user types a query into one of five clients. On the learner web portal
(`sunbird-cb-portal`, `search-v3`) and the mobile app
(`igot_karmayogi_mobile`), the client first calls `nlp-search`'s
`POST /nlp/search` — an LLM (Gemini, via Vertex AI) extracts a ranked list of
keywords from the raw query, and the client uses the top-priority keyword,
**not the user's raw text**, as the actual search term. The three
admin/authoring portals (`sunbird-cb-orgportal`, `sunbird-cb-creationportal`,
`sunbird-cb-adminportal`) skip this step entirely and search on the raw
query. Whichever term is used, the client then calls one of several versioned
content-search endpoints (`v4`/`v5`/`v6`/`composite/v5`) — reached either
directly or through `sunbird-cb-uiproxy`'s proxy/BFF layer — which land on
`knowledge-platform`'s `search-service`. That service translates the request
into an Elasticsearch query (filters, facets, sort, free-text `multi_match`)
against the `compositesearch` index and returns results. That index is kept
current by a completely separate pipeline: `knowledge-platform-jobs`'
Kafka-driven `search-indexer` Flink job consumes graph-transaction events
whenever content is created/updated/published and upserts the corresponding
Elasticsearch document — `search-service` itself is read-only against the
index it searches.

## How a learner experiences it (web portal / mobile)

1. **Types a query** into the search box (web: `SearchInputHomeV4Component`;
   mobile: `SearchPage`).
2. **The client silently calls `nlp-search`** with the raw text
   (`POST /nlp/search` or `/api/nlp/search`), gets back a ranked keyword
   list, and picks the top-priority one.
3. **The extracted keyword — not what was typed — becomes the query** sent
   to category-scoped searches: courses/content (`composite/v5`, `v4`
   search), people, community, events, external content — run in parallel,
   one call per category.
4. **Sees faceted results** — language, content type, organisation, resource
   category, and more — with the ability to refine via `filters`, sort, and
   an in-dropdown live "all results" typeahead as they type.
5. **Recent searches are persisted server-side**, not on-device — read/create/
   delete calls to `/search/v1/recent/*`, keyed to the account.

## How an org admin, content author, or platform admin experiences it

Each of the three admin-facing portals runs its own copy of the same
content/social search UI shape (learning, knowledge, social tabs — or, for
the creation portal, "my content"/content-picker), but **none of them call
`nlp-search`** — the raw typed text goes straight to the content-search
endpoint. The creation portal substitutes an independent competency/taxonomy
search (`competency/v4/search`) for tag/keyword suggestion during authoring,
which is unrelated to `nlp-search`'s LLM pipeline. Each portal additionally
exposes its own admin **user** search (`user/v1/search` or `v3/search`),
which is a wholly separate query surface from content search — it searches
the platform's user directory, not Elasticsearch's `compositesearch` index.

## Actors

| Actor | Role |
|---|---|
| Learner (web) | Types a query in `sunbird-cb-portal`; gets NLP-normalized results across courses, people, communities, events |
| Learner (mobile) | Same flow as web, via `igot_karmayogi_mobile`'s Flutter search screen |
| Org (MDO/SPV) admin | Searches content and platform users in `sunbird-cb-orgportal`, and courses/assignees when building a Training/CBP Plan — no NLP step |
| Content author | Searches their own draft/published content and existing courses to attach to a collection, in `sunbird-cb-creationportal` — tag suggestion via competency search, not NLP |
| System/platform admin | Searches content, social posts, and the full user directory in `sunbird-cb-adminportal` — no NLP step |
| Content-publish pipeline (`knowledge-platform-jobs`) | Not a human actor — consumes graph-transaction Kafka events and keeps the `compositesearch` Elasticsearch index that every search above ultimately reads from |

## The one decision that defines the feature

> `nlp-search` and `knowledge-platform`'s `search-service` are two backends
> that **never call each other**, and — cross-repo confirmed by grepping all
> ten repos for `nlp` — nothing in `knowledge-platform` or
> `knowledge-platform-jobs` references `nlp-search` at all. The only place
> the two are stitched together is client-side, and only in two of five
> clients: `sunbird-cb-portal`'s `search-v3` and `igot_karmayogi_mobile`
> both call `nlp-search` first and substitute its extracted keyword for the
> user's raw query before calling content search. The three admin/authoring
> portals never make that first call. So "search" is not one pipeline with
> an optional enhancement — it is two independently deployed, independently
> versioned systems (LLM keyword extraction; Elasticsearch content search),
> and whether a user's literal words or an LLM's guess at their intent is
> what actually gets searched depends entirely on which of the five
> frontends they're using.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the traced requirement
list.
