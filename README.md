# iGOT Karmayogi — Platform Documentation

Documentation and related project assets for the **iGOT-Doc** initiative:
code-verified technical documentation for the iGOT Karmayogi platform,
maintained as Markdown (docs-as-code) and presented by the **Docs Explorer**,
a React app in [`web/`](web/README.md).

## Published site

The **Docs Explorer** is published at **<DOCS_SITE_URL>**
by `.github/workflows/docs.yml`: on every push to `main` that touches `docs/`
or `web/`, it builds the React app (`npm run build` in `web/`) and deploys
`web/dist/`. The build reads the Markdown in `docs/` directly, so the published
site always reflects `docs/`; nothing generated is committed.

One-time setup: repo **Settings → Pages → Source: GitHub Actions**. Because this
repo is private, Pages needs a GitHub Pro / Team / Enterprise plan; on Enterprise
the site can be restricted to org members under the same Pages setting,
otherwise it is publicly readable once enabled.

## What's in this repo

| Path | What it is |
|---|---|
| [`docs/`](docs/index.md) | The Markdown documentation tree — source of truth for all technical content (APIs, HLD, LLD, use cases, operations manuals). Vanilla CommonMark + Mermaid; renders on GitHub, MkDocs, or Astro Starlight/Docusaurus unchanged. |
| [`web/`](web/README.md) | The **Docs Explorer**: a React + TypeScript app (Vite). Home dashboard, sidebar navigation, and a page per feature with a tab per document; it renders the Markdown in `docs/` directly. Feature list, tabs and Key Links are in `web/src/data/`; hand-authored Overview / Use Cases panels in `web/src/content/`. |
| `igot-architecture-overview.html` | Redirect to the explorer's Platform Overview page (`#/platform-overview`, built in `web/src/pages/PlatformOverviewPage.tsx`), kept so old links still work. |
| `mkdocs.yml` | Site nav/config for rendering `docs/` as a static site with MkDocs Material. |
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

### Features

- [Explore Content](docs/explore-content/index.md) — global search & discovery
- **Registration** — how users and organisations get onto the platform
    - [User Registration](docs/learning-hub/user-onboarding/index.md) — public sign-up, department link/QR, admin-created users, SSO first login
    - [SPV & Admin Registration](docs/learning-hub/spv-admin-registration/index.md) — the super-admin portal: organisations, first administrators, links, request review
    - [Bulk Registration](docs/learning-hub/bulk-registration/index.md) — three independent, largely disconnected CSV-upload pipelines for onboarding users
- [Weekly Claps](docs/learning-hub/weekly-claps/index.md) — a rolling engagement counter — five separate widget implementations, one backend endpoint
- [Competency Passbook](docs/competency-passbook/index.md) — a learner's required vs. earned competencies, fed by a real-time Kafka/Flink ledger
- [Training Plan](docs/learning-hub/training-plan/index.md) — MDO-authored targeted assignment (`CbPlan`) — four live table generations at once
- [CHS](docs/learning-hub/chs/index.md) — backend batch pipeline feeding karma points, leaderboards, BI warehouse
- [AI CBP Tool](docs/learning-hub/ai-cbp-tool/index.md) — AI-assisted competency-based program authoring
- [AI Assessment Tool](docs/learning-hub/ai-assessment-tool/index.md) — AssessAI: generate, review, edit and export curriculum-aligned assessments from course material or KCM selections
- [AI Tutor](docs/learning-hub/ai-tutor/index.md)
- [Organisation Hierarchy](docs/org-hierarchy/index.md) — a ministry/state's organisations as a ten-level tree, built as a Sunbird framework — tree-view edits or a replace-the-whole-tree spreadsheet upload; four unreconciled stores

These sit under **Features** in the explorer's sidebar (Registration is a
dropdown holding its three children). Their Markdown folders still live under
`docs/learning-hub/` for historical reasons.

### Hubs

- [Discussion Hub](docs/learning-hub/discussion-hub/index.md) — community-scoped Q&A/forum — Questions, Answer Posts and nested Answer Post Replies
- [Amrit Gyaan Kosh](docs/learning-hub/amrit-gyaan-kosh/index.md) — a knowledge-resource discovery hub (PDFs, videos, case studies) with no backend service of its own
- [Event Hub](docs/learning-hub/events-hub/index.md) — live/virtual event scheduling and participation

### Learning Hub

The consumption surface of iGOT Karmayogi — content published from the
Creation Portal, batches and enrolments in the LMS, per-node progress state,
with content-type-specific twists:

| Content type | The twist |
|---|---|
| [Course](docs/learning-hub/course/index.md) | none — the baseline: direct enrolment |
| [Curated Program](docs/learning-hub/curated-program/index.md) | auto-assigned batch, roll-up progress |
| [Blended Program](docs/learning-hub/blended-program/index.md) | approval workflow between request and enrolment |
| [Standalone Assessment](docs/learning-hub/standalone-assessment/index.md) | assessment engine replaces the player |
| [Comprehensive Assessment Program](docs/learning-hub/comprehensive-assessment-program/index.md) | mandated assessment over shared rails |
| [Learning Pathway](docs/learning-hub/learning-pathway/index.md) | milestones gate each other — sequential unlock |
| [Peer Validation](docs/learning-hub/peer-validation/index.md) | a named colleague, not a machine, approves completion |
| [Bharat Kalp](docs/learning-hub/bharat-kalp/index.md) | cohort-gated microsite, not a content type on the shared rails |
| [Search](docs/learning-hub/search/index.md) | global content discovery across the composite search APIs |
| [Marketplace](docs/learning-hub/marketplace/index.md) | partner/external content ecosystem — separate storage, enrollment and entitlement stack from native Course |
| [Unenrollment of Courses](docs/learning-hub/unenrollment-of-courses/index.md) | learner-initiated withdrawal — one flag flip, wired up differently per client |
| [Moderated Content](docs/learning-hub/moderated-content/index.md) | org-scoped visibility via `courseCategory` + `secureSettings`, riding the generic review workflow — plus an unrelated ML profanity check on discussion posts |

## Viewing the docs

**As a static site (MkDocs):**

```bash
pip install mkdocs-material
mkdocs serve
```

**As the Docs Explorer (React):**

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

`npm run build` writes the static site to `web/dist/`. See [`web/README.md`](web/README.md).

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
3. Markdown edits show up in the explorer as they are: there is no rebuild step
   to commit (`npm run dev` reloads them live).

4. New features need a Markdown folder under `docs/learning-hub/`, an entry in
   `mkdocs.yml`'s nav, an entry in `web/src/data/features.json` (its tabs and
   where each tab's content lives), and a listing under the right hub in
   `web/src/data/hubs.json` (which decides its sidebar dropdown, list page and
   breadcrumb). See [`web/README.md`](web/README.md).

Do not remove Verification boundary notes when editing — tighten them by
attaching the missing repo and re-verifying instead.
