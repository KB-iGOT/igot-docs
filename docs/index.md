# iGOT Karmayogi — Platform Documentation

Technical documentation for the iGOT Karmayogi platform, maintained as Markdown
(docs-as-code) and renderable as a static site. The visual **Docs Explorer**
(`karmayogi-docs-explorer.html`) is the functional front door; these pages are
the source of truth for the technical content behind it.

## Structure

Each feature folder carries the same six files (newer features also add an
`as-built-requirements.md`):

| File | Audience | Content |
|---|---|---|
| `index.md` | everyone | What the feature is, in plain language |
| `use-cases.md` | product, QA, support | Actor-by-actor scenarios and edge cases |
| `apis.md` | engineers, integrators | Endpoints as called by the portals |
| `hld.md` | engineers, architects | Services, datastores, design decisions |
| `lld.md` | engineers | Data models, state machines, sequences |
| `operations-manual.md` | ops/support | Common issues, config, monitoring, escalation |

## Platform

- [API Gateway & Routing](platform/api-gateway.md) — `/apis` → uiproxy, `/api` → Kong; how to trace any API to its service
- [Content Lifecycle](platform/content-lifecycle.md) — the create→review→publish→retire spine, **verified from knowledge-platform source**

## Features

- [Explore Content](explore-content/index.md) — global search & discovery
- **Registration** — how users and organisations get onto the platform
    - [User Registration](learning-hub/user-onboarding/index.md) — public sign-up, department link/QR, admin-created users, SSO first login
    - [SPV & Admin Registration](learning-hub/spv-admin-registration/index.md) — the super-admin portal: organisations, first administrators, links, request review
    - [Bulk Registration](learning-hub/bulk-registration/index.md) — CSV-upload pipelines for onboarding users
- [Weekly Claps](learning-hub/weekly-claps/index.md) — a rolling engagement counter
- [Training Plan](learning-hub/training-plan/index.md) — MDO-authored targeted assignment (`CbPlan`)
- [CHS](learning-hub/chs/index.md) — backend batch pipeline feeding karma points, leaderboards, BI warehouse
- [AI CBP Tool](learning-hub/ai-cbp-tool/index.md) — AI-assisted competency-based program authoring
- [AI Assessment Tool](learning-hub/ai-assessment-tool/index.md) — Gemini-generated assessments from course content or KCM competency selections

## Hubs

- [Learning Hub](learning-hub/index.md) — 13 features documented
- [Competency Hub](competency-hub/index.md) — competency taxonomies, the Passbook, org-designation mapping
- [Discussion Hub](learning-hub/discussion-hub/index.md) — community-scoped Q&A/forum
- [Amrit Gyaan Kosh](learning-hub/amrit-gyaan-kosh/index.md) — knowledge-resource discovery hub
- [Event Hub](learning-hub/events-hub/index.md) — live/virtual event scheduling and participation

## Verification policy

Every claim is tagged by where it came from. Facts read from the attached
repositories (`sunbird-cb-portal`, `sb-cb-ui-components`, `sunbird-cb-creationportal`,
`sunbird-cb-ext`, `cb-ext-course-service`) are stated plainly. Behaviour of
services **not** in the repo set (workflow service, LMS internals, assessment
service, publish pipeline jobs) is documented from client contracts only and marked
with a **Verification boundary** note. Do not remove those notes when editing —
tighten them by attaching the missing repo and verifying.
