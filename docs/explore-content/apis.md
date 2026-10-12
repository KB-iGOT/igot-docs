# Explore Content — APIs

Full path convention (see [API Gateway](../platform/api-gateway.md)):
portal → `{{host}}/apis/proxies/v8/…` (uiproxy) → Kong `{{host}}/api/composite/…` → `search-service:9000`.

| Portal call (`/apis/proxies/v8/…`) | Kong URI | Upstream (verified) | Purpose |
|---|---|---|---|
| `sunbirdigot/search` | `composite/v1/search` | `knowledge-mw-service:5000/v1/search` | Legacy composite search used by older strips |
| `sunbirdigot/read` | — | legacy read path | Legacy content read |
| `sunbirdigot/v4/search` | `composite/v4/search` | `search-service:9000/v4/search` | Authoring/admin search |
| `composite/v5/search` | `composite/v5/search` | `search-service:9000/v5/search` | Current learner search — JWT-aware (roles + org) |
| `composite/v4/bp/search` | `composite/v4/bp/search` | `search-service:9000/v4/bp/search` | Blended Program search for the PC console |

## search-service routes (verified from `conf/routes`)

| Method | Route | Controller |
|---|---|---|
| POST | `/v3/search` | `SearchController.search` — excludes `visibility: Private` |
| POST | `/v3/private/search` | `SearchController.privateSearch` |
| POST | `/v2/search/count` · `/v3/count` | `SearchController.count` |
| POST | `/v4/search` | `SearchController.searchV4` |
| POST | `/v5/search` | `ExtendedSearchController.searchV5` — parses JWT for `user_roles` + org |
| POST | `/v4/bp/search` | `ExtendedSearchController.blendedProgramSearch` |

## Request shape

```jsonc
// POST composite/v5/search
{ "request": {
    "query": "leadership",
    "filters": {
      "primaryCategory": ["Course", "Blended Program"],
      "status": ["Live"]
    },
    "facets": ["primaryCategory", "competencyArea"],
    "sort_by": { "lastPublishedOn": "desc" },
    "limit": 20, "offset": 0
} }
```
