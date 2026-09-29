# Amrit Gyaan Kosh — APIs

Sources: `sunbird-cb-portal` (`origin/cbrelease-4.8.40`, commit `eafc3ea71c`),
`igot-mobile` (`origin/master`, commit `e0deaf599`), `sunbird-cb-ext`
(`origin/cbrelease-4.8.41`, commit `55e79421`). Paths on the web portal are as
called via the API gateway (`/apis/proxies/v8/…` prefix); paths on mobile are
appended to the app's configured `baseUrl`. Full request/response detail:
[LLD](lld.md#component-detail).

There is no "Amrit Gyaan Kosh" API family. Both clients compose generic
content-search and a sector-taxonomy endpoint; only the sector taxonomy API
is implemented in a repo covered by this trace (`sunbird-cb-ext`) — the
search endpoints both clients call were not found in any of the eight repos
analyzed.

## Content discovery (web portal)

| Method | Endpoint | Purpose | Caller |
|---|---|---|---|
| POST | `sunbirdigot/search` | Paged/filtered resource search (home strips, view-all grid) | `GyaanKarmayogiService.searchV6` |
| POST | `sunbirdigot/v4/search` | Facet counts + `exists` filter for the landing page | `AppGyaanKarmayogiService` (route resolver) |
| POST | `trending/content/search` | Trending-content strip | `GyaanKarmayogiService.trendingContentSearch` |
| GET | `catalog/v1/sector` | Sector/sub-sector taxonomy list | `AppGyaanKarmayogiService` (route resolver) |

### Verified search filter shape (web)

```jsonc
// POST sunbirdigot/v4/search — facets used by the route resolver
{
  "filters": { "status": ["Live"] },
  "exists": ["sectorDetails_v1.sectorName", "resourceCategory"],
  "facets": ["resourceCategory", "createdFor",
             "sectorDetails_v1.sectorName", "sectorDetails_v1.subSectorName"]
}
```

`resourceCategory`, `sectorDetails_v1.sectorName`/`subSectorName`,
`contextStateOrUTs`, `contextSDGs`, `contextYear` are the same field-name
constants declared in `gyaan-contants.model.ts` and reused by both the
facet call above and the view-all page's richer filter set.
`createdFor` filtering against the CBC org id (`environment.cbcOrg`) is what
distinguishes the "Case Studies" tab from "Other Resources" — it is not a
separate endpoint, just a filter value.

## Content discovery (mobile)

| Method | Endpoint | Purpose | Caller |
|---|---|---|---|
| POST | (composite search, `compositeV1Search`-style) | Resource search with sector/category/SDG/state/year filters | `GyaanKarmayogiApiService.getGyaanKarmayogiData` / `.getGyaanKarmaYogiResources` |
| GET | `{baseUrl}/assets/configurations/feature/knowledge-resource.json` | Remote feature config (`gyaanKarmayogiConfig`) — powers the "know more" info banner and the CBC org id used for the Case Studies filter | `GyaanKarmayogiService.getGyaanConfig` (10-minute cache) |

### Verified search filter shape (mobile)

```jsonc
// getGyaanKarmayogiData / getGyaanKarmaYogiResources — request filters
{
  "contentType": ["Resource"],
  "mimeType": ["application/pdf", "video/mp4", "text/x-url",
               "video/x-youtube", "audio/mpeg",
               "application/vnd.ekstep.content-collection"],
  "status": ["Live"],
  "sectorDetails_v1.sectorName": "<sectors>",
  "sectorDetails_v1.subSectorName": "<subSector>",
  "resourceCategory": "<resourceCategory>",
  "createdFor": "<createdFor>",
  "contextSDGs": "<contextSDGs>",
  "contextStateOrUTs": "<contextStateOrUTs>",
  "contextYear": "<contextYear>"
}
```

The mobile client's filter/field names match the web portal's field-name
constants closely (same underlying schema fields — see [LLD](lld.md)), but
the two clients were not found to share a common request-building module or
constants file — each repo declares its own copy of these field names.

## Sector/sub-sector taxonomy (`sunbird-cb-ext`)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/v1/catalog/sector` | List all sectors, with sub-sectors as children |
| GET | `/v1/catalog/sector/read/{sectorId}` | Read one sector by id |
| POST | `/v1/catalog/sector/create` | Create a sector taxonomy term |
| POST | `/v1/catalog/subsector/create` | Create a sub-sector term under a sector |

`CatalogController` / `CatalogServiceImpl` implement these by calling the
Knowledge-Mw "framework/term" API (`km.framework.term.search/read/create/
update.path`) against a dedicated taxonomy framework
(`sector.framework.name=sector-fw`, `sector.category.name=sector`,
config in `application.properties:146-158`). This is the confirmed backing
API behind the web portal's `catalog/v1/sector` call above. Whether this same
framework backs the `sectorDetails_v1` values returned by content search was
not directly verified — the field is written/read as opaque search metadata,
not cross-checked against `sector-fw` term ids in any repo analyzed.

## Verified NOT to exist

The following were explicitly searched for and confirmed absent:

- No route, controller or service named for "Amrit Gyaan Kosh"/"AGK"/"gyaan"
  in `sunbird-cb-uiproxy`, `sunbird-cb-ext` (beyond the catalog/sector API
  above), or `knowledge-platform`.
- No AGK-specific authoring API in `sunbird-cb-creationportal` — content is
  authored through the platform's generic content-creation flow, which has
  pre-existing `Resource`-type-aware form branches unrelated to any
  AGK-specific change (see [LLD](lld.md)).
- No involvement at all in `cb-ext-course-service` (`origin/cbrelease-4.8.41`,
  commit `f8ef968f2a`) or `sunbird-course-service`
  (`origin/cbrelease-4.8.41`, commit `38ec8c536d`) — both are course-
  enrollment/batch services with zero AGK-related code, config, or even a
  generic sector-tagging concept.

---

> **Verification boundary:** endpoints and payloads above are read from the
> calling code in `sunbird-cb-portal`, `igot-mobile` and `sunbird-cb-ext` at
> the commits listed above. The service that actually implements
> `sunbirdigot/search`, `sunbirdigot/v4/search`, `trending/content/search`
> and the mobile app's composite search call was **not found in any of the
> eight repos analyzed** for this feature — it is served by a search/
> knowledge-mw service outside this trace's scope. `sunbird-cb-uiproxy` was
> checked as a candidate gateway/proxy for these calls and found to expose
> only generically-named, differently-versioned search proxies
> (`composite/v4/search` via Kong, `searchV5`, `searchV6`) with no confirmed
> match to the `sunbirdigot/*` paths above — attach the actual search-service
> repo to close this gap.
