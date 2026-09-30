# iGOT Karmayogi — Platform Documentation

Documentation and related project assets for the **iGOT-Doc** initiative:
code-verified technical documentation for the iGOT Karmayogi platform,
maintained as Markdown (docs-as-code) and paired with a visual, interactive
**Docs Explorer**.

## Published site

The **Docs Explorer** is published at **https://kb-igot.github.io/igot-docs/**
by `.github/workflows/docs.yml`: on every push to `main` that touches `docs/`,
`tools/` or the explorer template, it runs `tools/build_docs_explorer.py` and
deploys the result as the site's `index.html` (so the published copy always
reflects `docs/`, whether or not the committed `karmayogi-docs-explorer.html`
was rebuilt).

One-time setup: repo **Settings → Pages → Source: GitHub Actions**. Because this
repo is private, Pages needs a GitHub Pro / Team / Enterprise plan; on Enterprise
the site can be restricted to org members under the same Pages setting,
otherwise it is publicly readable once enabled.

## What's in this repo

| Path | What it is |
|---|---|
| [`docs/`](docs/index.md) | The Markdown documentation tree — source of truth for all technical content (APIs, HLD, LLD, use cases, operations manuals). Vanilla CommonMark + Mermaid; renders on GitHub, MkDocs, or Astro Starlight/Docusaurus unchanged. |
| `karmayogi-docs-explorer.html` | The built, static **Docs Explorer** — an orbit-style home page → hub ring → feature pages with tabs. The functional front door for browsing the docs visually. |
| `karmayogi-docs-explorer.template.html` | Source template for the explorer (authored HTML for Overview/Use Cases panels; APIs/HLD/LLD/Operations Manual tabs render the Markdown files directly). Edit this, not the built HTML. |
| `mkdocs.yml` | Site nav/config for rendering `docs/` as a static site with MkDocs Material. |
| `tools/build_docs_explorer.py` | Rebuilds `karmayogi-docs-explorer.html` from the template after any Markdown change. |
| `tools/layout_hub_ring.py` | Auto-lays-out the Learning Hub's hub-ring bubbles (one ring, radius grows with feature count) and rewrites the `HUB-RING:BEGIN/END` block in the template. Run this after adding/removing a Learning Hub feature, then rebuild the explorer. |
| `igot-doc-skills.md` | The house style guide / working convention for generating and updating this documentation (research discipline, six-file feature structure, verification-boundary rules, explorer wiring). |
| `_to_delete/` | Staged for removal — not part of the active documentation set. |

## Documentation structure

Each documented feature lives in its own folder under `docs/` and carries the
same six files (newer features also add an `as-built-requirements.md`):

| File | Audience | Content |
|---|---|---|
| `index.md` | everyone | What the feature is, in plain language — user-first, no API/architecture detail |
| `use-cases.md` | product, QA, support | Actor-by-actor scenarios, edge cases |
| `apis.md` | engineers, integrators | Endpoints as called by the portals |
| `hld.md` | engineers, architects | Services, datastores, design decisions |
| `lld.md` | engineers | Data models, state machines, sequences |
| `operations-manual.md` | ops/support | Common issues, config, monitoring, escalation |

### Platform

- [API Gateway & Routing](docs/platform/api-gateway.md) — `/apis` → uiproxy, `/api` → Kong; how to trace any API to its service
- [Content Lifecycle](docs/platform/content-lifecycle.md) — the create→review→publish→retire spine

### Main-page features

- [Explore Content](docs/explore-content/index.md) — global search & discovery
- [Bulk Registration](docs/learning-hub/bulk-registration/index.md) — three independent, largely disconnected CSV-upload pipelines for onboarding users
- [Weekly Claps](docs/learning-hub/weekly-claps/index.md) — a rolling engagement counter — five separate widget implementations, one backend endpoint
- [Training Plan](docs/learning-hub/training-plan/index.md) — MDO-authored targeted assignment (`CbPlan`) — four live table generations at once
- [CHS](docs/learning-hub/chs/index.md) — backend batch pipeline feeding karma points, leaderboards, BI warehouse

These five sit under the explorer's **Features** bubble. Their Markdown folders
still live under `docs/learning-hub/` for historical reasons.

### Hubs

- [Competency Hub](docs/competency-hub/index.md) — two parallel competency taxonomies (`frac-backend` and a Knowledge Platform mirror), the Passbook, browse/search and org-designation mapping
- [Discussion Hub](docs/learning-hub/discussion-hub/index.md) — community-scoped Q&A/forum — Questions, Answer Posts and nested Answer Post Replies
- [Amrit Gyaan Kosh](docs/learning-hub/amrit-gyaan-kosh/index.md) — a knowledge-resource discovery hub (PDFs, videos, case studies) with no backend service of its own
- Event Hub (platform-wide) — *not yet documented*

### Learning Hub

The consumption surface of iGOT Karmayogi — content published from the
Creation Portal, batches and enrolments in the LMS, per-node progress state,
with content-type-specific twists:

| Content type | The twist |
|---|---|
| [Course](docs/learning-hub/course/index.md) | none — the baseline: direct enrolment |
| [Curated Program](docs/learning-hub/curated-program/index.md) | auto-assigned batch, roll-up progress |
| [Blended Program](docs/learning-hub/blended-program/index.md) | approval workflow between request and enrolment |
| [My Assigned Courses](docs/learning-hub/my-assigned-courses/index.md) | rules engine resolves what the org pushed |
| [Standalone Assessment](docs/learning-hub/standalone-assessment/index.md) | assessment engine replaces the player |
| [Comprehensive Assessment Program](docs/learning-hub/comprehensive-assessment-program/index.md) | mandated assessment over shared rails |
| [Learning Pathway](docs/learning-hub/learning-pathway/index.md) | milestones gate each other — sequential unlock |
| [Peer Validation](docs/learning-hub/peer-validation/index.md) | a named colleague, not a machine, approves completion |
| [Bharat Kalp](docs/learning-hub/bharat-kalp/index.md) | cohort-gated microsite, not a content type on the shared rails |
| [AI CBP Tool](docs/learning-hub/ai-cbp-tool/index.md) | AI-assisted competency-based program authoring |
| [Events Hub](docs/learning-hub/events-hub/index.md) | live/virtual event scheduling and participation |
| [Search](docs/learning-hub/search/index.md) | global content discovery across the composite search APIs |
| [AI Assessment Tool](docs/learning-hub/ai-assessment-tool/index.md) | Gemini-generated assessments from a course's PDFs/captions or KCM competency selections alone |
| [Marketplace](docs/learning-hub/marketplace/index.md) | partner/external content ecosystem — separate storage, enrollment and entitlement stack from native Course |
| [Unenrollment of Courses](docs/learning-hub/unenrollment-of-courses/index.md) | learner-initiated withdrawal — one flag flip, wired up differently per client |
| [Moderated Content](docs/learning-hub/moderated-content/index.md) | org-scoped visibility via `courseCategory` + `secureSettings`, riding the generic review workflow — plus an unrelated ML profanity check on discussion posts |

## Viewing the docs

**As a static site (MkDocs):**

```bash
pip install mkdocs-material
mkdocs serve
```

**As the visual Docs Explorer:** open `karmayogi-docs-explorer.html` directly
in a browser, or serve the repo root with any static file server.

**On GitHub:** the Markdown under `docs/` renders as-is, including Mermaid
diagrams.

## Contributing to the docs

This repo follows a strict, code-verified documentation discipline — see
[`igot-doc-skills.md`](igot-doc-skills.md) for the full convention. In short:

1. **Everything is traced from source** — endpoints, payloads, state machines,
   and config values are read from the connected repos, never assumed.
2. **Unverified claims are labelled, not omitted** — behavior inferred only
   from client contracts is documented and tagged with a **Verification
   boundary** note naming the repo that would close the gap.
3. After editing any Markdown, rebuild the explorer:

   ```bash
   python3 tools/build_docs_explorer.py
   ```

4. New Learning Hub features need a Markdown folder under `docs/learning-hub/`,
   an entry in `mkdocs.yml`'s nav, a feature-tab block in
   `karmayogi-docs-explorer.template.html`, and an entry in
   `tools/layout_hub_ring.py`'s `FEATURES` list (then re-run that script to
   place the new hub-ring bubble before rebuilding the explorer).

Do not remove Verification boundary notes when editing — tighten them by
attaching the missing repo and re-verifying instead.
