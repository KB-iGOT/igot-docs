# Amrit Gyaan Kosh — Use Cases

## Web portal journeys (`sunbird-cb-portal`)

### UC-1 · Land on the AGK home page

A user opens `app/amrit-gyaan-kosh` (redirects to its `all` child route).
`GyaanResolverService` first fetches a tenant feature-flag JSON
(`/<sitePath>/feature/tenant-admin.json`) as a page-availability gate; on
failure it redirects to `/`. `GyaanKarmayogiHomeComponent` then issues two
parallel calls — facet counts (`sunbirdigot/v4/search`, faceted on
`resourceCategory`, `createdFor`, `sectorDetails_v1.sectorName/subSectorName`)
and the sector taxonomy list (`catalog/v1/sector`) — and renders sector/
category filter dropdowns plus content-strip carousels split across two tabs:
Case Studies (`contentType: ['Resource','Course']`, filtered to the CBC org
via `createdFor`) and Other Resources (`contentType: ['Resource']`).

- APIs: `GET apis/proxies/v8/catalog/v1/sector` ·
  `POST apis/proxies/v8/sunbirdigot/v4/search`

### UC-2 · Filter by sector, sub-sector or category

Selecting a sector/sub-sector/category in the dropdown filters re-issues the
facet/strip queries (`searchV6`) and re-renders the strips for the current
tab. A 700ms debounce (`timeOutDuration`) prevents refetching on every
keystroke/selection tick.

### UC-3 · Open "view all"

`viewAllSector()` navigates to `app/amrit-gyaan-kosh/view-all`, which loads a
richer facet set (content type, sector, sub-sector, resource category, SDGs,
state/UT, year) and paginates results via `searchV6`, extending the list on
scroll (infinite scroll).

- API: `POST apis/proxies/v8/sunbirdigot/search`

### UC-4 · Apply advanced filters

On narrow viewports the filter set opens in a `MatBottomSheet`
(`GyaanFilterComponent`) — checkboxes for sector/sub-sector/category/state,
SDG checkboxes, and a year range slider (`ngx-slider`). Selections emit a
`filterChange` event consumed by the view-all page to re-query.

### UC-5 · Open a resource

Clicking a card routes to `app/amrit-gyaan-kosh/player/<pdf|audio|youtube|video>/<resourceId>`,
chosen by the content's mime type. `GyaanPlayerComponent` builds breadcrumbs,
parses `sectorDetails_v1` to show sector/sub-sector tags, and fetches a
"related resources" strip filtered by the same sector/sub-sector/
resourceCategory. Each of the four sub-routes is a thin wrapper delegating to
a shared viewer-library component (`@ws/viewer`'s Youtube/Audio/Video/Pdf
modules) — no AGK-specific player logic exists beyond mime-type dispatch.

### UC-6 · Reach AGK content from outside the module

Two other places in the portal deep-link directly into the AGK player rather
than routing through the AGK home/view-all pages:

- Global search results (`search-v3` course-content-card): a Resource-type
  hit builds `app/amrit-gyaan-kosh/player/<resourceType>/<identifier>`
  directly.
- The AI assistants (`igot-sarthi`, `support-ai`): build the same player URL
  with extra query params (`primaryCategory=Learning Resource`,
  `from=globalSearch`, `playerPreview=true`, plus `st`/`et` for a time offset
  or `pn` for a page number) when surfacing a Resource-type result in chat.
- Bharat Kalp's "see all" content browser also deep-links resource cards
  into `app/amrit-gyaan-kosh/player/...` the same way.

## Mobile app journeys (`igot-mobile`)

### UC-7 · Enter AGK from the explore hub

The explore/hub grid renders a tile from the remote (or locally-bundled
fallback) `explore-hub-config` JSON — title "AGK", `telemetryId:
"amritGyaanKosh"`, `navigationRoute: "/knowledgeResourcesPage"`. Tapping it
opens `GyaanKarmayogiV2`, which fires an impression telemetry event
(`pageIdentifier: amrit-gyaan-kosh/all`) on load.

### UC-8 · Browse the landing screen

The landing screen shows a search/filter top bar, an optional "know more"
info banner (`AgkForm`, populated from a remote `knowledge-resource.json`
config — renders nothing if that config has no `knowMoreInfo`), a resource
carousel, and two tabs — "AGK Case Studies" and "Other Resources" — split by
the same CBC-org (`createdFor`) logic as the web portal, using an org id
sourced from remote config (`amritGyaanOrgId`, default `cbcOrg`).

### UC-9 · Filter and view all

`FilterScreenV2` presents sector/sub-sector/resource-category/SDG/state-UT
filters plus a year slider. `ViewAllScreenV2` takes the selected sector/
sub-sector/category and tab index, paginating through
`GyaanKarmayogiResource` results.

### UC-10 · Open a resource

`ResourceDetailsScreen` fetches resource detail, renders a player
(`resource_player.dart`) plus a sector/sub-sector display
(`sector_subsector_view.dart` — also reused, independent of AGK, in the
general course "About" tab wherever `sectorDetails` is present), and offers a
share action.

## Edge cases

| Situation | Behaviour |
|---|---|
| Tenant feature-flag fetch fails (web) | `GyaanResolverService` redirects the user to `/` — the whole module is gated on this one config fetch succeeding |
| `globalConfig.routes['amrit-gyaan-kosh']` disabled (web) | `GeneralGuard` blocks the route entirely, independent of the tenant-admin resolver |
| Remote `explore-hub-config` omits or disables the AGK entry (mobile) | The app falls back to a locally bundled static config; if that entry's `enabled` is `false`, the hub tile simply doesn't render |
| `AgkForm`'s remote config has no `knowMoreInfo` (mobile) | The info banner renders nothing (`SizedBox()`) rather than an empty placeholder |
| A resource has no `sectorDetails_v1` | Sector/sub-sector display sections are skipped, both in the web player and the mobile "About"/details screens |
| Web and mobile disagree on the search endpoint/field naming | Web calls `sunbirdigot/search` / `sunbirdigot/v4/search`; mobile's service layer calls a `compositeV1Search`-style endpoint with its own field list — both send largely the same filter fields (`resourceCategory`, `sectorDetails_v1.*`, `createdFor`, `contextSDGs`, `contextStateOrUTs`, `contextYear`), but neither repo's client code was found to share a common request-building module |

See [LLD](lld.md) and [Operations Manual](operations-manual.md) for the
mechanics and troubleshooting behind each of these.

---

> **Verification boundary:** use cases above are traced to `sunbird-cb-portal`
> (`origin/cbrelease-4.8.40`, commit `eafc3ea71c`) and `igot-mobile`
> (`origin/master`, commit `e0deaf599`). The serving side of every endpoint
> they call (`sunbirdigot/search`, `sunbirdigot/v4/search`, the mobile
> composite-search equivalent, and the tenant-admin/explore-hub-config
> feature-flag JSONs) was not located in any of the eight repos analyzed —
> see [APIs](apis.md) for the full list of what was and wasn't found.
