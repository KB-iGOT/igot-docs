---
name: igot-doc
description: >-
  Generate iGOT Karmayogi platform documentation in the team's established
  style — code-verified feature docs (Overview, Use Cases, APIs, HLD, LLD,
  Operations Manual) as Markdown, wired into the visual Docs Explorer. Use
  this skill whenever the
  user asks to "generate documentation" for an iGOT/Karmayogi feature, hub,
  content type or service, asks to document APIs/HLD/LLD, asks to add a
  feature to the docs explorer or the docs/ markdown tree, or asks to update
  or fix any existing iGOT documentation page — even if they don't name this
  skill. Requires access to the iGOT repos and the iGOT-Doc folder.
---

# iGOT Documentation Generator

You are producing documentation for the iGOT Karmayogi platform in a house
style the team has already agreed on. The two non-negotiables that make this
documentation trustworthy, and that distinguish it from generic AI output:

1. **Everything is traced from source.** Endpoints, payloads, state machines,
   config values — read them out of the repos, never from memory of what
   Sunbird "usually" looks like. If you didn't see it in code, don't state it
   as fact.
2. **Unverified claims are labelled, not omitted and not disguised.** When a
   behaviour can only be inferred from a client contract (the serving repo
   isn't available), document it *and* mark it with a **Verification
   boundary** note naming what repo would close the gap.

## The documentation system (two surfaces, one source)

- `iGOT-Doc/docs/**` — Markdown tree, the **source of truth for technical
  content** (APIs, HLD, LLD). Vanilla CommonMark + Mermaid, renderable on
  GitHub / MkDocs / Starlight. `mkdocs.yml` at the root lists the nav.
- `iGOT-Doc/web/` — the **Docs Explorer**, a React + TypeScript app (Vite):
  home dashboard, sidebar navigation (hubs that group features are
  dropdowns), and a page per feature with a tab per document. **Tech tabs
  render the markdown files directly; functional panels (Overview, Use Cases
  where authored as cards) are HTML fragments in
  `web/src/content/features/<id>/<tab>.html`.** The feature list, tabs and Key
  Links live in `web/src/data/features.json`; which hub lists a feature is in
  `web/src/data/hubs.json`. Never write tech content into the HTML fragments.

There is no rebuild step to commit: the app reads `docs/` at build time, and
`cd web && npm run dev` shows markdown edits live. CI builds and publishes
`web/dist/` (`.github/workflows/docs.yml`).

## Workflow for "generate documentation for <feature>"

### 1 · Research first (never write before this is done)

Locate the feature in the repos the user has connected. Proven starting
points:

| Question | Where to look |
|---|---|
| What features/routes exist in the portal? | `sunbird-cb-portal/src/app/app-routing.module.ts`; feature modules in `project/ws/app/src/lib/routes/` |
| What APIs does the frontend call? | `API_END_POINTS` constants in `sb-cb-ui-components/*/library/**/_services/widget-content.service.ts`, `services/app-toc.service.ts`, and per-feature `services/*.service.ts` |
| Authoring / admin-side APIs? | `sunbird-cb-creationportal/project/ws/author/src/lib/constants/apiEndpoints.ts` and `.../content-detail/services/*.service.ts` |
| Request payload shapes? | The component that builds the request (grep the service method name, read the caller) |
| Backend behaviour? | Controllers in `sunbird-cb-ext`, `cb-ext-course-service` (`@PostMapping` etc.); Play `conf/routes` + actors in `knowledge-platform`; schemas in `knowledge-platform/schemas/` |
| Enums / categories / workflow states? | `widget-content.model.ts` (`ECourseCategory`, `WFBlendedProgramStatus`, approval types) |

Useful grep patterns: `API_END_POINTS`, `apis/proxies/v8`, `@PostMapping`,
`primaryCategory`, the feature's display name. Record file paths as you go —
they become the "verified from" citations.

**A use case must have a portal caller.** Before an API goes into
`use-cases.md` (or a UC card in the explorer), confirm it is called from at
least one of the six frontend repos: `sunbird-cb-portal`,
`sunbird-cb-orgportal`, `sunbird-cb-adminportal`, `sunbird-cb-creationportal`,
`sunbird-cb-multitenant-staticweb`, `sb-cb-ui-components`. Grep the endpoint
path in each (`API_END_POINTS` constants, `*.service.ts`, mobile-app services
when the mobile repo is attached) **and then confirm a component actually
invokes the service method** — portals carry dead `API_END_POINTS`
constants and wrapper methods nobody calls (e.g. `org/v1/list` in the
learner portal's sign-up, welcome and profile services). A constant or
wrapper with no `*.component.ts` caller is not a caller; record it as a
DEV item instead. Cite the invoking component (file:lines) on a
`- Portal caller:` line under the UC. An endpoint that exists in a backend
controller or Kong but has no caller in those repos is **not a use case** —
leave it out of `use-cases.md` and, if worth recording, list it in
`as-built-requirements.md` as a DEV/boundary item ("no confirmed caller") or
in `apis.md` under internal calls. Background consumers triggered by a
portal-called API (a Kafka job behind an upload) stay in, cited to the
triggering caller. If one of the six repos is not attached, say so in the
use-cases preamble rather than assuming coverage.

**Trace the calls *around* a framework/taxonomy API, not just the API.**
When a feature drives the Sunbird framework APIs (`framework/v1/term/*`,
`publish`, `copy`, `retire`) or any other generic platform API, the feature's
real behaviour is usually in what the portal calls immediately **before** and
**after** — an `org/v1/read` to decide whether the tree exists, an
`org/ext/v2/update` / `v1/org/update` that writes attributes onto the
organisation (or user) record, a re-read after publish. Document each action
as an ordered call list and state explicitly whether the org/user record is
touched and with which keys. Attribute writes on the organisation object are
load-bearing for other features (sign-up pickers, reports, role scoping), so
"no record update" is itself a finding worth a DEV item. For the organisation
record specifically, check learner-service's
`cassandratablecolumn.properties` for which attributes exist and remember
that `org/update` is a pass-through — whoever PATCHes an attribute owns it.

**Verify the gateway path for every API you document.** Portal calls leave on
two prefixes and the docs must state the full chain
(see `docs/platform/api-gateway.md`):

- `{{host}}/apis/…` → Nginx → **sunbird-cb-uiproxy** (route mappings in
  `src/proxies_v8/proxies_v8.ts`, allow-list in `src/utils/whitelistApis.ts`;
  it forwards to Kong via `KONG_API_BASE`)
- `{{host}}/api/…` → Nginx → **Kong** (mapping:
  `sunbird-devops/ansible/roles/kong-api/defaults/main.yml`, entries are
  `uris → upstream_url` with jwt/cors/acl plugins)

Trace: portal path → uiproxy mapping → Kong URI → `upstream_url` → the
serving repo's route/controller. **If you cannot identify the backend service
or the implementation, raise the question** — in the doc's boundary note and
to the doc owner — never guess.

If a needed repo is not connected, say so, document from the client contract,
and add the boundary note. Do not silently guess.

### 2 · Write the markdown set

Create `docs/learning-hub/<feature-slug>/` (or the matching hub folder) with
exactly six files. Follow the shapes below — existing folders (
`blended-program/` is the fullest reference) show the style in situ.

**`index.md`** — plain language for non-technical readers, and strictly
**user-first**: describe what the feature does *for the user* and how they
experience it (a "How a Karmayogi experiences it" step sequence works well).
No API names, no service names, no architecture in the overview — that
material belongs in `apis.md`/`hld.md`/`lld.md`; end with a one-line pointer
to them. Keep light facts as bullets (routes, who it's for), an actors table
when several roles are involved, and the one design decision that defines
the feature *only if it can be said in user terms*. The same rule governs the
explorer's Overview tab. (Blended Program's overview is the reference:
batches, attendance and approvals as a person meets them — not workflows and
tables.)

**`use-cases.md`** — numbered `### UC-n · Title (Actor)` sections grouped by
journey (learner / approver-admin / authoring). Each: 2–4 sentences of
behaviour, then an `- API:` line with the endpoint(s) in backticks. End with
an **Edge cases** table (Situation | Behaviour) — the edge cases come from
real guards you found in code (conflict checks, seat caps, date windows,
mandatory reasons), not imagination.

**`apis.md`** — tables grouped by concern, columns `Method | Endpoint |
Purpose`. Strip gateway prefixes (`/apis/proxies/v8/…`) for readability and
say so once at the top, with the source files cited. Include verified request
payloads as ` ```jsonc ` blocks with comments — only payloads read from the
code that builds them.

**`hld.md`** — a Mermaid `flowchart LR` of the topology (clients → gateway →
services → datastores), a Responsibilities table (Component | Owns | Repo),
and "Key design decisions" as short bold-led paragraphs explaining *why*
(async by construction, config-not-code, etc.).

**`lld.md`** — the deep mechanics: state machines as Mermaid
`stateDiagram-v2`, sequence flows as `sequenceDiagram`, persistence schemas
as tables (verified column lists), attribute/config tables with defaults,
verified payloads. Close with the **Verification boundary** blockquote:

```markdown
> **Verification boundary:** facts above are read from <repos>. Not analysed
> from source: <service> — behaviour inferred from client contracts. Attach
> that repo to close the gap.
```

**`operations-manual.md`** — the sixth file, audience is ops/support staff
keeping the feature running in production, not developers. Cover: common
support issues and their verified fix/workaround, configuration (feature
flags, env vars, admin-console toggles) with defaults, monitoring/alerts
(what to watch and where), and the escalation path/ownership. Source it from
runbooks, support playbooks, or on-call docs the same way as everything
else — verified facts only, boundary-noted where no such source is attached.
If nothing is attached yet, write the honest stub (see CAP's stub-plus
convention) rather than inventing procedures.

### 3 · Wire into the explorer

- An existing feature picks up new markdown automatically if its tab in
  `web/src/data/features.json` points at the path
  (`"source": { "type": "markdown", "path": "learning-hub/<slug>/<file>.md" }`).
- A brand-new feature needs: an entry in `features.json` (id, title, summary,
  icon, tabs and each tab's source), a listing under the right hub in
  `hubs.json` (that places it in the sidebar dropdown, the hub's list page and
  its breadcrumb), and its `mkdocs.yml` nav entry. Copy an existing feature's
  entry as the pattern.
- Check it with `cd web && npm run build` (type-checks too) and open the page
  in `npm run dev`.

### 4 · Verify before delivering

- Every endpoint in the docs exists in a file you actually read this session.
- Every endpoint in `use-cases.md` has a `Portal caller:` line pointing at a
  file in one of the six frontend repos (see research step 1).
- Mermaid parses: **no semicolons inside node/note text** (they terminate
  statements and break the diagram — this bit us once).
- Rebuild ran clean; if a browser check is possible, confirm the new tabs
  render and no `.md-missing` boxes appear.
- Boundary notes present wherever a serving repo wasn't available.

## Style rules that keep the docs recognisable

- **Tone**: plain, specific, engineer-to-engineer. Overviews readable by
  ministry stakeholders; LLDs debuggable at 2am. Prefer "the batch is the
  workflow application" over abstract description.
- **Surface the non-obvious mechanism** — the fact a reader wouldn't guess is
  the most valuable line ("attendance is a progress write", "a child course
  completed standalone still counts toward the program"). Hunt for one per
  feature.
- **Tables over prose** for endpoint lists, configs, schemas, edge cases.
- **Cite sources inline**: `verified from \`repo › path/file.ts\``.
- **Honest thinness**: if the code shows little (as with Comprehensive
  Assessment Program), say the page is a stub-plus and what would deepen it —
  never pad.
- **Visual work** (explorer, mockups) uses the platform's own design tokens
  from `sb-cb-ui-components/sb-cb-ui-design-system/src/styles/_ws-vars.scss`:
  blue `#1B4CA1`, orange `#EF951E`, Lato, tint `#E8EDF6`. Amber = feature/
  learner-facing accents, indigo = service/technical, green = verified.
- Diagrams and images in the explorer get the Zoom popup automatically; author them at
  natural size and don't add zoom UI yourself. **Keep a single diagram under
  ~2000 px natural width** (check with a local Mermaid render: viewBox width);
  a topology that needs five LR subgraphs and twenty cross-subgraph edges
  renders at 4000 px with 16 px labels and is unreadable at any zoom. Split it
  — request path (clients → gateway → services) in one diagram, services →
  async/stores in another — and let the Responsibilities table be the
  authoritative list.

## Maintaining this skill (important)

This file is a **living convention document**. When the documentation owner
(Karthik) gives a new instruction that changes the style, structure, or
process — in any session — apply it to the work *and* update this file:
amend the relevant section and add a dated line to the changelog below. That
is how the whole team's output stays consistent. When in doubt whether a
one-off request is a new convention, ask: "should this become the standard?"

### Changelog

- **2026-10-22** · Explorer migrated to React (`web/`, branch
  `react-migration`). The static single-file explorer, its template and its
  build tools (`tools/build_docs_explorer.py`, `tools/layout_hub_ring.py`)
  were removed; hub rings were replaced by sidebar dropdowns and list pages,
  so bubble placement no longer applies. Feature wiring is now data
  (`web/src/data/features.json`, `hubs.json`); CI builds `web/dist/`.

- **2026-10-15** · Diagram width rule (above) and a popup fix: the zoom popup
  now pins the freshly rendered SVG to its viewBox size (Mermaid emits
  `width=100%` + `max-width`, which collapsed inside the `max-content` box so
  "100%" was a fraction of natural size), zoom ceiling 400% → 800%, fit floor
  0.3 → 0.15. Triggered by the Organisation Hierarchy HLD topology being
  unreadable at 400%; it was split into two diagrams (1240×304 and 1265×799).

- **2026-10-14 (5)** · When a feature's org-record writes go through a
  service's generic controller (here `sunbird-cb-ext` `ExtendedOrgController`),
  document the **whole controller** — every route, its Kong mapping, its
  verified behaviour and its web caller — in a dedicated `apis.md` section,
  since the unrelated-looking siblings are where the surprises sit (a POST to
  a PATCH route, a Kong URI pointing at a different service, an allow-list
  that differs between repo and Helm env). Triggered by Organisation
  Hierarchy DEV-013..017.

- **2026-10-14 (4)** · New research rule: when a feature uses framework /
  generic platform APIs, trace the portal's before/after calls around them
  (org read, org update, re-read) and record per action whether the org or
  user record is written and with which keys. Triggered by Organisation
  Hierarchy: the tree view's add/rename flows never update the org record,
  its retire flow only clears `parentPathId`, and `hierarchyLevel` has no
  writer anywhere — while the public sign-up pickers filter on both
  (DEV-011/012, CON-006/007).

- **2026-10-14 (3)** · Sharpened the portal-caller rule: a service-file
  constant or wrapper method does not count — the invoking component must be
  found and cited. Triggered by Organisation Hierarchy UC-12 having been
  attributed to the learner portal's public sign-up on the strength of
  `signup.service.ts` constants that no component calls; the live sign-up
  uses `org/hierarchy/{ministry,state,}/search` (learner-service → ES
  `parentPathId` wildcard), now UC-13. Also: `sunbird-cb-multitenant-staticweb`
  is a tenant landing page with no feature APIs (only `form/read`), so a zero
  hit there is expected, not a gap.

- **2026-10-14 (2)** · Use-case admission rule: an API is a use case only if a
  caller exists in one of the six portal repos (`sunbird-cb-portal`,
  `sunbird-cb-orgportal`, `sunbird-cb-adminportal`, `sunbird-cb-creationportal`,
  `sunbird-cb-multitenant-staticweb`, `sb-cb-ui-components`); every UC now
  carries a `Portal caller:` line and the verify checklist checks for it.
  Applies to all features going forward. Triggered by Organisation Hierarchy's
  UC-11/UC-12 having been admitted on backend evidence alone (both turned out
  to have callers — reports filter and public sign-up — and were re-cited).

- **2026-10-14** · Added Organisation Hierarchy (`docs/org-hierarchy/`, top-level
  folder per the non-learning-hub convention) to the **Features** ring via
  `SIMPLE_RINGS` (9 bubbles, r=276 still passes `--check`). Scope decision by
  the owner: the page documents the **production path only** — cb-pores
  framework creation, cb-ext bulk upload + the two Kafka consumers,
  `org_hierarchy_v4` / `mdo_children_lookup` / `org/level/hierarchy` — and
  deliberately excludes the unwired `cb-org-hierarchy-service` repo
  (standalone Neo4j+APOC service on branch `cbrelease-4.8.34`, Helm chart but
  no Kong route or portal caller); it also carries no code-review findings,
  as-built divergences only. First feature whose index.md lists three
  unreconciled stores for the same question — recorded as DEV items, not
  prose.

- **2026-10-05** · Hub restructure. AI CBP Tool and AI Assessment Tool moved
  from the Learning Hub to **Features**; Events Hub moved out of the Learning
  Hub to the landing-level **Event Hub** (a one-feature hub that opens its page
  directly, like Discussion Hub). **Features** gained a nested **Registration**
  bubble (a sub-hub view, `v-registration`) holding User Registration (docs
  folder `user-onboarding/`), SPV & Admin Registration and Bulk Registration.
  New convention: bubble placement for **all** ring views is now computed by
  `tools/layout_hub_ring.py` -- the Learning Hub ring from `FEATURES`, the
  Features and Registration rings from `SIMPLE_RINGS` (marker pairs
  `RING:<key>:BEGIN/END`) -- instead of hand-bisecting spokes, which overlaps
  once a ring has more than a dozen bubbles. Feature pages' Back button label
  is now set at open time from the hub the user came from (`data-hub-name`),
  so a moved feature never says "Back to Learning Hub". Markdown folders do
  not move when a bubble moves; only `mkdocs.yml` nav and the template do.

- **2026-09-09 (4)** · Added Bharat Kalp (`docs/learning-hub/bharat-kalp/`) in
  parallel with Peer Validation on a separate branch; merging both into the
  hub landed two independent, non-adjacent bisections rather than one, so
  they were kept as-is (Bharat Kalp bisects the Curated Program↔Blended
  Program gap at 0°) instead of recomputing the ring as an evenly-spaced
  N-gon — the resulting spacing (30°/60° gaps, no crowding on either side)
  didn't warrant the disruption of repositioning the other seven spokes.
  Hub count bumped to 9 features.

- **2026-09-09 (3)** · Diagram legibility: global Mermaid config
  (`mermaid.initialize` in the template) sets `fontSize: 17px`,
  `flowchart.rankSpacing: 130`, `flowchart.nodeSpacing: 60` — applies to
  every diagram in every feature's HLD/LLD, not per-feature. For an
  unusually wide diagram (many parallel nodes in one rank), add a
  per-diagram `%%{init: {"flowchart": {"rankSpacing": N}}}%%` line as the
  first line inside that one ` ```mermaid ` block rather than changing the
  global default — keeps other diagrams from being over-stretched. Also:
  `.mfig > svg` no longer force-shrinks to the column width
  (`max-width:100%` → `max-width:none` + `overflow-x:auto` on `.mfig`) — a
  wide diagram scrolls at natural size instead of squeezing illegible.
  Triggered by the Peer Validation topology diagram being unreadable at
  default spacing/width-capping.

- **2026-09-09 (2)** · Added Peer Validation (`docs/learning-hub/peer-validation/`),
  sourced from a code-tracing research report the doc owner produced with a
  separate Claude analysis session across 8 repos (3 backends, 3 web
  frontends, 1 mobile app — no dedicated Peer Validation service; state is
  split across Elasticsearch and two independent Cassandra tables). Mobile
  facts were folded inline into each file rather than kept as a separate
  "mobile" section, matching the single-narrative style used elsewhere.
  Bubble placed by bisecting the CAP↔Standalone Assessment gap per the
  placement convention above.

- **2026-09-09** · Hub-ring bubble placement convention: new spokes are
  placed by bisecting the angle between the two nearest existing spokes at
  the hub's existing radius (not eyeballed), with exactly one dashed
  connector line per spoke and the hub's feature count bumped. Triggered by
  the Learning Pathway bubble initially overlapping Course and needing a
  manual reposition.

- **2026-09-08 (2)** · Added Learning Pathway (`docs/learning-hub/learning-pathway/`)
  as the first feature sourced from the team's own Confluence
  As-Built/HLD/LLD/Operations Manual pages (space `TES`) rather than a fresh
  repo trace — those pages were themselves produced by the same research
  discipline, so they were used directly as the verified source, re-shaped
  into this repo's six-file/tab convention. Confirms Confluence pages
  following this team's documentation style are an acceptable primary
  source alongside direct repo tracing.

- **2026-09-08** · Six-file structure: added `operations-manual.md` (ops/
  support runbook: common issues, config, monitoring, escalation) as the
  sixth file and explorer tab for every feature, applied retroactively to
  all seven existing features as honest stubs pending real runbook sources.
  Feature set is open-ended — Discussion Hub, Event Hub, Competency Hub, and
  further sub-features will be added as source material is supplied.

- **2026-08-28 (3)** · Overview discipline: overviews (index.md and the
  explorer's Overview tab) are user-benefit only — no API names, no service
  names, no architecture; those live in APIs/HLD/LLD with a pointer.
  Triggered by the Explore Content overview being written too technically.

- **2026-08-28 (2)** · Gateway-path convention: every documented API must
  state its full chain (portal → `/apis` uiproxy → `/api` Kong →
  `upstream_url` → serving repo), verified against `proxies_v8.ts` and the
  Kong `kong-api/defaults/main.yml` map; unidentifiable backends are raised
  as questions, never guessed. Landing taxonomy: the main page shows hubs
  *and* main-page features (center caption counts both, e.g.
  "4 hubs · 1 feature"); main-page features (first: Explore Content,
  `docs/explore-content/`) open their feature page directly and their back
  button returns to the landing. Non-learning-hub features live in their own
  top-level `docs/<slug>/` folder.

- **2026-08-28** · Initial version, distilled from the founding session:
  dual-surface system (markdown source of truth + visual explorer);
  five-file-per-feature structure; verification-boundary discipline;
  research-first from connected repos; UC-card and API-table formats;
  functional tabs stay authored HTML, tech tabs render markdown (reverted
  from all-markdown by owner's request); Mermaid semicolon rule; diagram
  zoom-popup + desktop screen-fit added to the explorer; brand tokens from
  `_ws-vars.scss`.
