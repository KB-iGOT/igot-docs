# Amrit Gyaan Kosh

A knowledge-resource discovery hub — PDFs, videos, audio clips and external
links — tagged by sector, sub-sector, resource category, SDGs, state/UT and
year, with a dedicated tab for case studies vetted by the Capacity Building
Commission (CBC). Shipped independently, in parallel, on the web portal and
the mobile app; there is no dedicated backend service of its own.

- **Also known as (in code)**: "Gyaan Karmayogi" / `gyaan-karmayogi` /
  `gyaan_karmayogi` — the official display name "Amrit Gyaan Kosh" and its
  abbreviation "AGK" appear only in route paths, telemetry ids, localization
  strings and a couple of UI-copy references; the module/class/file names
  throughout both codebases use "Gyaan Karmayogi"
- **Route**: `app/amrit-gyaan-kosh` (web portal — landing, view-all, and
  `player/{pdf|audio|youtube|video}/:resourceId`) and `/knowledgeResourcesPage`
  (mobile, hub tile labelled "AGK")
- **Who it's for**: any logged-in user; content
  itself is split into a CBC-authored "Case Studies" tab and an "Other
  Resources" tab by an org-id filter, not by user role
- **Status**: ⚠️ no dedicated backend anywhere in the eight repos analyzed —
  every repo either passes AGK's metadata fields through a generic
  content/search API, or has zero AGK-related code at all; see the honest gap
  below and [As-Built Requirements](as-built-requirements.md)

## In one paragraph

A user opens Amrit Gyaan Kosh from a spotlight tile (mobile) or a direct
route (web) and lands on a page that fetches sector/category facet counts and
the sector taxonomy in parallel, then renders a browsable, filterable
carousel of content split into "Case Studies" (content created by the CBC
org) and "Other Resources." From there they can search, filter by sector/
sub-sector/resource category/SDG/state-UT/year, open "view all" for an
infinite-scrolling grid, and open any resource in a player that picks a
PDF/audio/YouTube/video viewer based on the content's mime type. The content
itself is ordinary Sunbird "Resource"-type content, tagged with a handful of
schema fields (`resourceCategory`, `sectorDetails_v1`, `contextSDGs`,
`contextStateOrUTs`, `contextYear`) that were added to the content platform's
schemas generically, not as an AGK-specific data model.

## How a Karmayogi experiences it

1. **Finds it** — a hub tile labelled "AGK" on the mobile explore screen
   (icon + `amritGyaanKosh` telemetry id), or navigates directly to
   `app/amrit-gyaan-kosh` on the web portal; the web portal also deep-links
   into it from global search results and from the AI assistant (Sarthi/
   Support AI) when a search hit is Resource-type content.
2. **Lands on the home/landing screen**: sector and category facet chips,
   a content-strip carousel, and two tabs — Case Studies (CBC-org content)
   and Other Resources.
3. **Narrows down** by sector, sub-sector, resource category, SDG, state/UT
   or year, either inline (web) or via a bottom-sheet/modal filter panel
   (web mobile-width and native mobile app alike).
4. **Opens "view all"** for a paginated / infinite-scroll grid of everything
   matching the current filters.
5. **Opens a resource**, landing in a player chosen by mime type — PDF,
   audio, YouTube, or video — each a thin wrapper around a shared platform
   viewer library, not AGK-specific player code.
6. **Sees related resources** and sector/sub-sector tags alongside the
   player (web), or shares the resource externally (mobile).

## Actors

| Actor | Role |
|---|---|
| Any logged-in user | Browses, filters and opens content; no special role or membership flag required |
| Content author (creation portal) | Authors "Resource"-type content through the platform's generic, shared content-creation flow — there is no AGK-specific authoring screen |
| CBC (Capacity Building Commission) org | Its content is distinguished as "Case Studies" purely by an org-id filter (`createdFor`) read from remote config — not a role or permission, a data filter |
| Backend services (out of this trace) | The actual `sunbirdigot/search` / composite-search service that both clients call is not present in any of the eight repos analyzed — see [APIs](apis.md) |

## The one decision that defines the feature

> There is no "Amrit Gyaan Kosh service." The feature is a client-side
> composition (two independent client implementations, one per platform) over
> a handful of generic content-schema fields and a generic sector-taxonomy
> API — search this codebase for a dedicated AGK backend and you will not
> find one.

That single fact explains almost everything else worth knowing: why the web
and mobile implementations disagree on field/endpoint naming in places, why
content authoring has no AGK-specific screen, and why six of the eight
repos analyzed touch AGK only incidentally or not at all.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for what actually shipped.
