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
- `iGOT-Doc/karmayogi-docs-explorer.html` — the visual explorer (orbit home →
  hub ring → feature pages with tabs). **Functional content (home, heroes,
  Overview tab, Use Cases tab) is authored HTML in
  `karmayogi-docs-explorer.template.html`; the APIs / HLD / LLD tabs render
  the markdown files directly.** Never write tech content into the HTML.

After editing any markdown, rebuild the explorer:

```bash
cd iGOT-Doc && python3 tools/build_docs_explorer.py
```

(Optional `--mermaid tools/mermaid.min.js` inlines the diagram renderer for
offline/NIC hosting; default uses the CDN with a graceful fallback.)

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

- The tech tabs pick up the new markdown automatically **if** the feature's
  page exists in the template with `data-md` placeholders pointing at the new
  paths.
- A brand-new feature also needs, in `karmayogi-docs-explorer.template.html`:
  a bubble on the hub ring (`onclick="openFeature('<id>')"`), and an `fdoc`
  block (hero + authored-HTML Overview and Use Cases panels + four `mdwrap`
  tech panels: APIs, HLD, LLD, Operations Manual). Copy an existing `fdoc` as
  the pattern; keep the hero chips factual (Category / Route / verification
  status).
- **Placing the new bubble** (a hub with N existing spokes gains an N+1th —
  the ring is never redrawn from scratch, each addition just adds one more
  spoke): the hub center for Learning Hub is `(720, 505)`; existing spokes
  sit on a radius of ~310px, 60° apart. Pick the empty gap between two
  adjacent spokes closest to where the new feature conceptually belongs,
  and bisect their angle rather than guessing pixels:
  1. Find the two neighbouring spokes' centers (`left+width/2`,
     `top+height/2`).
  2. Compute the new center as their angular midpoint at the same ~310px
     radius from the hub center (e.g. Learning Pathway sits between Course
     `(720,195)` and Comprehensive Assessment Program `(452,350)`, both 310px
     out at 60° apart, so it landed at `(565,237)` — the 30°-bisector at the
     same radius).
  3. Convert to `left`/`top` by subtracting half the bubble's width/height
     (128px bubbles → subtract 64).
  4. Add one dashed connector `<line x1="720" y1="505" x2="<center-x>"
     y2="<center-y>" stroke="#1B4CA138" stroke-width="1.5"
     stroke-dasharray="4 6"/>` inside `.orbitbg` — every spoke has exactly
     one connector line back to the hub center, no exceptions.
  5. Bump the hub's `<div class="sub">N features</div>` count.
  Never place a bubble by eyeballing free space — it will overlap or drift
  off-center the way the first Learning Pathway placement did (caught and
  fixed 2026-09-09). If a hub is gaining several features at once, prefer
  recomputing all spokes as an evenly-spaced N-gon over serially bisecting
  gaps, since repeated bisection crowds one side of the ring.
- Rebuild with `tools/build_docs_explorer.py` and update `mkdocs.yml` nav.

### 4 · Verify before delivering

- Every endpoint in the docs exists in a file you actually read this session.
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
- Diagrams in the explorer get the Zoom popup automatically; author them at
  natural size and don't add zoom UI yourself.

## Maintaining this skill (important)

This file is a **living convention document**. When the documentation owner
(Karthik) gives a new instruction that changes the style, structure, or
process — in any session — apply it to the work *and* update this file:
amend the relevant section and add a dated line to the changelog below. That
is how the whole team's output stays consistent. When in doubt whether a
one-off request is a new convention, ask: "should this become the standard?"

### Changelog

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
