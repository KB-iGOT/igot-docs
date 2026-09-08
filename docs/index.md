# iGOT Karmayogi — Platform Documentation

Technical documentation for the iGOT Karmayogi platform, maintained as Markdown
(docs-as-code) and renderable as a static site. The visual **Docs Explorer**
(`karmayogi-docs-explorer.html`) is the functional front door; these pages are
the source of truth for the technical content behind it.

## Structure

Each feature folder carries the same five files:

| File | Audience | Content |
|---|---|---|
| `index.md` | everyone | What the feature is, in plain language |
| `use-cases.md` | product, QA, support | Actor-by-actor scenarios and edge cases |
| `apis.md` | engineers, integrators | Endpoints as called by the portals |
| `hld.md` | engineers, architects | Services, datastores, design decisions |
| `lld.md` | engineers | Data models, state machines, sequences |

## Platform

- [API Gateway & Routing](platform/api-gateway.md) — `/apis` → uiproxy, `/api` → Kong; how to trace any API to its service
- [Content Lifecycle](platform/content-lifecycle.md) — the create→review→publish→retire spine, **verified from knowledge-platform source**

## Main-page features

- [Explore Content](explore-content/index.md) — global search & discovery ✅

## Hubs

- [Learning Hub](learning-hub/index.md) — 6 content types documented
- Discussion Hub — *to be documented*
- Event Hub — *to be documented*
- Competency Hub — *to be documented*

## Verification policy

Every claim is tagged by where it came from. Facts read from the attached
repositories (`sunbird-cb-portal`, `sb-cb-ui-components`, `sunbird-cb-creationportal`,
`sunbird-cb-ext`, `cb-ext-course-service`) are stated plainly. Behaviour of
services **not** in the repo set (workflow service, LMS internals, assessment
service, publish pipeline jobs) is documented from client contracts only and marked
with a **Verification boundary** note. Do not remove those notes when editing —
tighten them by attaching the missing repo and verifying.
