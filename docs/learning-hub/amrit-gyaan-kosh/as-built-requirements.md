# Amrit Gyaan Kosh — As-Built Requirements

Requirements reconstructed from the shipped implementation across
`sunbird-cb-portal` (`origin/cbrelease-4.8.40`, commit `eafc3ea71c`),
`igot-mobile` (`origin/master`, commit `e0deaf599`),
`sunbird-cb-creationportal` (`origin/cbrelease-4.8.40`, commit `1e6a35c52`),
`knowledge-platform` (`origin/cbrelease-4.8.41`, commit `ce1a624f77`) and
`sunbird-cb-ext` (`origin/cbrelease-4.8.41`, commit `55e79421`) — what the
system does today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for Amrit Gyaan Kosh was available in
any repo. This document reconstructs requirements **from the shipped
implementation** across all eight repos analyzed for this feature — it
states what the system actually does today, not what was originally
intended. Each requirement is traced to file(s)/line(s); requirements that
could not be traced to a specific line are marked accordingly.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Entry and access

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | On web, the system SHALL expose the feature at route `app/amrit-gyaan-kosh`, guarded by `GeneralGuard` and resolving `pageData`/`gyaanData` before load. | `src/app/app-routing.module.ts:167-179` |
| FR-002 | On web, the system SHALL fetch `/<sitePath>/feature/tenant-admin.json` as a second, module-level gate before rendering any AGK child route; a failed fetch SHALL redirect the user to `/`. | `gyaan-resolver.service.ts:13-34` |
| FR-003 | On mobile, the system SHALL render an "AGK" hub tile (icon, `telemetryId: amritGyaanKosh`) on the explore/hub grid, sourced from a remote `explore-hub-config` JSON with a bundled static fallback, gated per-entry by an `enabled` flag. | `explore_hub_config.dart:31-42`; `mobile_explore_screen.dart:134-139` |
| FR-004 | On mobile, tapping the AGK tile SHALL navigate to `/knowledgeResourcesPage`, resolving to the `GyaanKarmayogiV2` screen. | `app_routes.dart`; `routes.dart:226-227` |

### Content discovery — web

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The landing page SHALL fetch facet counts (`resourceCategory`, `createdFor`, `sectorDetails_v1.sectorName`/`subSectorName`) via `sunbirdigot/v4/search`, and the sector taxonomy via `catalog/v1/sector`, in parallel. | `app-gyaan-karmayogi.service.ts:20,34` |
| FR-011 | The landing page SHALL present two tabs — Case Studies (`contentType: ['Resource','Course']`, `createdFor` matching the CBC org) and Other Resources (`contentType: ['Resource']`) — and SHALL render content strips per selected sector/category. | `gyaan-karmayogi-home.component.ts` (tab logic, `callStrips`/`callPaticualrStrip`) |
| FR-012 | "View all" SHALL provide sector, sub-sector, resource-category, SDG, state/UT and year filters, paginating results via `searchV6` and extending the list on scroll. | `gyaan-karmayogi-view-all.component.ts:113-237,295-457,563-586` |
| FR-013 | On narrow viewports, filters SHALL open in a `MatBottomSheet` (`GyaanFilterComponent`). | `gyaan-karmayogi-view-all.component.ts:529-555` |
| FR-014 | Opening a resource SHALL route to `app/amrit-gyaan-kosh/player/<pdf\|audio\|youtube\|video>/<resourceId>`, chosen by the content's mime type. | `gyaan-karmayogi-routing.module.ts:53-114` |
| FR-015 | The player SHALL display sector/sub-sector tags parsed from `sectorDetails_v1`, and a related-resources strip filtered by the same sector/sub-sector/resourceCategory. | `gyaan-player.component.ts:142-273` |
| FR-016 | Global search results and the AI assistants (Sarthi, Support AI) SHALL deep-link Resource-type hits directly into the AGK player, bypassing the AGK home/view-all pages. | `course-content-card.component.ts:200-202`; `igot-sarthi.component.ts:702-703,777,1036-1056`; `support-ai.component.ts:811,1029,1043` |

### Content discovery — mobile

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The landing screen (`GyaanKarmayogiV2`) SHALL show a search/filter top bar, an optional "know more" info banner, a resource carousel, and two tabs (AGK Case Studies / Other Resources) split by the same `createdFor`-vs-CBC-org-id logic as web. | `gyaan_karmayogi_screen.dart:21-140` |
| FR-021 | The info banner (`AgkForm`) SHALL render only when the remote `knowledge-resource.json` config provides `knowMoreInfo`; otherwise it SHALL render nothing. | `agk_form.dart` |
| FR-022 | `FilterScreenV2` SHALL provide sector, sub-sector, resource-category, SDG, state/UT filters and a year range control. | `filter_screen.dart:15-30` |
| FR-023 | `ViewAllScreenV2` SHALL paginate `GyaanKarmayogiResource` results for the selected sector/sub-sector/category/tab. | `view_all_screen.dart` |
| FR-024 | `ResourceDetailsScreen` SHALL render a resource player, a sector/sub-sector display, and a share action. | `details_screen.dart` |
| FR-025 | The system SHALL emit an impression telemetry event on landing-screen load, tagged with page identifier `/app/amrit-gyaan-kosh/all`. | `telemetry_constants.dart:333`; `gyaan_karmayogi_screen.dart` (`_generateImpressionTelemetryData`) |

### Sector taxonomy (`sunbird-cb-ext`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The system SHALL expose `GET /v1/catalog/sector` (list, with sub-sectors as children), `GET /v1/catalog/sector/read/{sectorId}`, `POST /v1/catalog/sector/create`, `POST /v1/catalog/subsector/create`, all proxying to a Knowledge-Mw `framework/term` API against a dedicated `sector-fw` framework. | `CatalogController.java:14-49`; `CatalogServiceImpl.java:88,161,194,256`; `application.properties:146-158` |

### Content authoring (`sunbird-cb-creationportal`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | Content authoring for `Resource`-type content, including AGK content, SHALL use the platform's shared `additional-details` form, which marks `resourceCategory` required when `primaryCategory === Resource`, and retains `contextStateOrUTs`/`contextSDGs`/`contextYear`/`additionalTags` controls only for standalone-resource or case-study content. | `additional-details.component.ts:1241,2111-2130,2172-2178` |
| FR-041 | No dedicated AGK authoring screen exists; the only AGK-named artifact (`FORM_TYPES.AGK_PUBLIC_SURVEY`) SHALL remain commented out of the active form-types list and SHALL be used only to gate a submission-count UI element, not content creation. | `widget-content.model.ts:690-707`; `surveys-list.component.html:106` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | The web feature module SHALL be lazy-loaded, so a build failure in it surfaces only when a user navigates to `app/amrit-gyaan-kosh`. | `route-gyaan-karmayogi.module.ts` |
| NFR-002 | Mobile SHALL cache the remote AGK config (`knowledge-resource.json`) for 10 minutes before refetching. | `gyaan_karmayogi_service.dart:168-181` |
| NFR-003 | Neither client SHALL require the same schema-validation constraints on `resourceCategory`/`sectorDetails_v1`/`contextSDGs`/`contextStateOrUTs`/`contextYear` — the underlying content schema leaves all five unconstrained (plain strings / untyped object arrays). | `knowledge-platform` `schemas/content/1.0/schema.json:1494-1538` |
| NFR-004 | The web route SHALL be disableable platform-wide via `globalConfig.routes['amrit-gyaan-kosh']`, independent of the tenant-admin resolver gate (FR-002). | `src/app/guards/general.guard.ts` (~lines 44-64, `isBlockedUrl` / `globalConfig.routes` check) |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | The web and mobile clients each declare their own copy of the AGK field-name constants (`resourceCategory`, `sectorDetails_v1.*`, `contextSDGs`, etc.) — no shared library/constants file was found between the two repos. | A field rename in the content schema must be applied independently in both `gyaan-contants.model.ts` (web) and the mobile service layer, or the two clients silently diverge. | `gyaan-contants.model.ts`; `gyaan_karmayogi_service.dart` |
| CON-002 | The CBC org id used for the Case-Studies filter is configured independently per platform (`environment.cbcOrg` web; remote `cbcOrg` mobile). | The two clients can disagree on what counts as a Case Study if the values drift. | `gyaan-karmayogi-home.component.ts`; `feature_config_repository.dart:14,38,55,88` |
| CON-003 | The search endpoints both clients call (`sunbirdigot/search`, `sunbirdigot/v4/search`, and the mobile composite-search equivalent) are not implemented in any of the eight repos analyzed for this feature. | This document cannot describe server-side search/ranking/relevance behaviour for AGK content — only what the clients send and expect back. | See [APIs](apis.md) verification boundary |
| CON-004 | `sectorDetails_v1` has no nested schema — its object shape (`sectorName`/`subSectorName`) is a convention enforced only by client-side code, not by the content schema. | A malformed or differently-shaped object from an authoring bug would pass schema validation and only fail silently at render time on both clients. | `schemas/content/1.0/schema.json:1533-1538` |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | Web and mobile use differently-named/versioned search calls (`sunbirdigot/search` / `sunbirdigot/v4/search` vs. a `compositeV1Search`-style mobile call) for conceptually the same content discovery, with no shared client library. | FR-010/FR-012 vs. FR-020/FR-023 | [APIs](apis.md) |
| DEV-002 | Two independently configured CBC org-id values with no reconciliation mechanism found in either repo. | FR-011 vs. FR-020 | CON-002 |
| DEV-003 | Web access is gated twice (route guard + tenant-admin resolver); mobile access is gated once (hub-tile `enabled` flag) with no equivalent secondary guard found on the `/knowledgeResourcesPage` route itself. | FR-001/FR-002 vs. FR-003/FR-004 | `app-routing.module.ts`; `routes.dart` |

## Out of scope (not reconstructible from this repo set)

- The search/indexing service implementing `sunbirdigot/search`,
  `sunbirdigot/v4/search`, and the mobile composite-search endpoint —
  outside all eight repos analyzed.
- The knowledge-mw-service `framework/term` API and the `sector-fw`
  framework's actual term data — `sunbird-cb-ext` only proxies to it.
- `@ws/viewer` (web) and the native mobile player widgets' internal
  rendering behaviour — both platforms only dispatch to these, they don't
  implement playback.
- The process by which content becomes tagged with the CBC org id
  (`createdFor`) at authoring or import time — this document only captures
  how both clients filter on it after the fact.

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to the
> repos and commits listed at the top of this document. `cb-ext-course-service`
> (`origin/cbrelease-4.8.41`, commit `f8ef968f2a`) and `sunbird-course-service`
> (`origin/cbrelease-4.8.41`, commit `38ec8c536d`) were also analyzed in full
> and confirmed to have **zero** AGK-related code, config, or requirements —
> they are omitted from the tables above because there is nothing to state,
> not because they were skipped. No original spec/ticket existed to verify
> these requirements against; this document is reconstructed from shipped
> behaviour only. Attach the originating spec or the missing search-service
> repo, if either surfaces, to close the gaps noted above.
