# Explore Content — Low-Level Design

## Request lifecycle inside search-service

1. Play controller (`SearchController` / `ExtendedSearchController`) wraps
   the body into an internal `Request` with `ApiId.APPLICATION_SEARCH`.
2. Guards run: public search rejects `filters.visibility: Private`
   (`ERR_ACCESS_DENIED`); v4/v5 set `isSecureSettingsDisabled = true`; v5
   extracts `user_roles` and org from the JWT
   (`x-authenticated-user-token` or `Authorization: Bearer`).
3. `SearchManager` dispatches to the **`SearchActor`** (Akka), operations:
   `INDEX_SEARCH`, `COUNT`, `METRICS`, `GROUP_SEARCH_RESULT_BY_OBJECTTYPE`.
4. `search-core › SearchProcessor` builds the Elasticsearch DSL from the
   `SearchDTO` (filters → bool clauses, `exists`/`not_exists`, `like`
   operations, facets → aggregations) against index **`compositesearch`**
   (config `compositesearch.index.name`), type `cs`.
5. Result transformers map ES hits/aggregations back to the API shape.

## Filter → query mechanics (verified in `SearchActor` / `SearchProcessor`)

| Request element | Becomes |
|---|---|
| `query` | Full-text match across indexed fields |
| `filters.<prop>: [values]` | Term filters |
| `exists` / `not_exists` | Field-existence clauses |
| `facets: [...]` | ES aggregations returned as facet buckets |
| `sort_by` | ES sort |
| `limit` / `offset` | Pagination (service-side caps apply) |

## Configuration that matters

| Config | Meaning |
|---|---|
| `compositesearch.index.name` | ES index (default `compositesearch`) |
| Kong `search_url` | `http://search-service:9000` — the upstream for v4/v5/bp |
| Kong `knowledge_mw_service_url` | `http://knowledge-mw-service:5000` — v1 legacy upstream |
| uiproxy `KONG_API_BASE` | Where `/apis/proxies/v8` traffic is forwarded (`{{host}}/api`) |

> **Verification boundary:** verified from `sunbird-cb-portal`,
> `sunbird-cb-uiproxy`, `sunbird-devops` (Kong map) and
> `knowledge-platform › search-api`. Not verified: the indexing jobs that
> feed `compositesearch` (publish pipeline repo not attached), and
> knowledge-mw's v1 relay target (configured in its `sb_content_provider`
> module env). Raise these with the doc owner before treating them as fact.
