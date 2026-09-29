# Training Plan

An MDO-authored, targeted assignment of content to a group of Karmayogis —
internally called **CbPlan** ("Capacity Building Plan") everywhere in code;
"Training Plan" only appears as UI copy and folder names. Unlike Learning
Pathway, a Training Plan is **not** a generic Content node — it is a
first-class Cassandra entity with its own dedicated table family, its own
versioned service layer, and its own Kafka-driven side effects.

- **Internal name**: `CbPlan` / `cbplan` (API paths, DB tables, Kafka topics)
- **Primary authoring surface**: `sunbird-cb-orgportal` → `training-plan` module
- **Learner-facing surface**: `sunbird-cb-portal` → `cbp` module (`CbpPlanComponent`)
- **Status**: ⚠️ not one backend, but **four coexisting API/table generations**
  (v1 → v2 → v3 → v4) reachable simultaneously through the same proxy — see
  the honest gap below and [As-Built Requirements](as-built-requirements.md)

## In one paragraph

An MDO Admin or MDO Leader builds a Training Plan in the Org Portal: a
title, a set of courses (optionally flagged "APAR" — mandatory,
performance-linked content — and, within that, a "gating" subset that must
be finished before a linked Comprehensive Assessment unlocks), a target
audience picked through the platform's Reusable User Groups mechanism, and
an end date. Publishing it fans the plan out into per-assignee lookup rows
so a Karmayogi's dashboard can find "plans that apply to me" without
scanning every plan in the org. The learner sees their assigned plans —
bucketed into Upcoming / Overdue / APAR / Completed — in the public portal's
`cbp` module. Separately, an entirely different pipeline exists: an AI
service (`cbp-ai-service`) generates designation-wise "AICBP" plans in bulk
and an operator publishes them directly against the backend, bypassing the
Org Portal UI entirely. And running underneath all of this, in parallel, are
**four independently-tabled generations of the same feature** — `cb_plan`
(v1, in `sunbird-cb-ext`), `cb_plan_v2`, and `cb_plan_v3` (shared by both the
v3 and v4 API surfaces, in `cb-ext-course-service`) — all still whitelisted
and reachable today.

## How this plays out for each actor

1. **MDO Admin/Leader authors a plan** (Org Portal, `training-plan` stepper):
   title → content selection (+ optional APAR/gating rules) → target
   audience (via Reusable User Groups, scoped `context.type: 'training-plan'`)
   → end date/APAR year → save as draft or publish.
2. **A provider org gets asked for missing content**: if the author can't
   find suitable content, a "Request for new content" form fires an email
   (via Kafka + a Cassandra-templated notification) to every `CBP_ADMIN` in
   the target provider org(s).
3. **A provider-side reviewer actions the request** in the Admin Portal's
   `request` screens (mark invalid / publish), which routes into the
   Creation Portal's `cbp/demand-details-form` to fulfill it — this link is
   **inferred from routing/table-naming**, not fully traced end to end (see
   verification boundary).
4. **Publishing fans the plan out**: one lookup row per user/designation/
   user-group key is written so learner-side reads are O(1) per learner,
   not a scan over all plans.
5. **A Karmayogi sees their assigned plans** in the `cbp` portal module,
   bucketed by status/urgency, cross-referenced against their own enrolment
   state pulled from an IndexedDB cache.
6. **Separately, Platform Ops runs a 7-stage AI pipeline** (`cbp-ai-service`)
   that drafts "AICBP" plans per designation and bulk-publishes them by
   calling `cb-ext-course-service`'s `aicbp/create`+`aicbp/publish` endpoints
   directly — no Org Portal step, no uiproxy hop.

## Actors

| Actor | Role |
|---|---|
| MDO Admin / MDO Leader | Authors, edits, publishes, retires Training Plans for their own org, in the Org Portal |
| Karmayogi (learner) | Views and consumes plans assigned to them, in the public portal's `cbp` module |
| Provider-org CBP Admin | Receives and actions "request new content" emails; reviews/publishes/rejects requested content in the Admin Portal's `request` screens |
| Platform Ops | Runs the `cbp-ai-service` bulk pipeline that drafts and bulk-publishes AI-generated ("AICBP") plans per designation |

## The one decision that defines the feature

> A Training Plan was deliberately built as its own Cassandra entity, not a
> reuse of the generic Content graph — but that decision was then repeated
> three more times without retiring what came before it. `sunbird-cb-ext`
> still serves a fully-functional **v1** (`cb_plan`/`cb_plan_lookup`,
> simple `allUser`/`customUser`/`designation` targeting) behind
> `/cbplan/v1/...`. `cb-ext-course-service` separately serves **v2**
> (`cb_plan_v2`, adds the AICBP endpoints and an access-setting migration
> utility), and **v3/v4** (`cb_plan_v3` — confirmed by config
> (`cbplan.v4.plan.table=cb_plan_v3`) to be the *same table* for both API
> versions; v4 layers reusable-user-group targeting on top of v3's data).
> All four are still whitelisted in `sunbird-cb-uiproxy` today. The Org
> Portal's own service file calls all four families side by side.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the reconstructed
requirement set with every known deviation called out.

> **Verification boundary:** sourced from 9 repos, each checked out at the
> commit resolved as "the release branch with the latest commit" at analysis
> time (native repos: branch tip; forked repos: branch tip, confirmed
> tagged, so no fallback to an earlier tagged commit was needed):
> `cb-ext-course-service` (`cbrelease-4.8.41`, `fd08b74`), `sunbird-cb-ext`
> (`cbrelease-4.8.41`, `55e7942`, tag `cbrelease-4.8.41_RC8`),
> `sunbird-cb-uiproxy` (`cbrelease-4.8.41`, `175d24c`, tag
> `cbrelease-4.8.41_RC7`), `sunbird-cb-orgportal` (`cbrelease-4.8.41`,
> `9329075b`, tag `cbrelease-4.8.41_RC17`), `sunbird-cb-portal`
> (`cbrelease-4.8.41`, `31a57e9bb`, tag `cbrelease-4.8.41_RC20`),
> `sunbird-cb-adminportal` (`cbrelease-4.8.41`, `4a35703e`, tag
> `cbrelease-4.8.41_RC1`), `sunbird-cb-creationportal` (`cbrelease-4.8.40`,
> `1e6a35c5`), `cbp-ai-service` (`cbrelease-4.8.39`, `eecf278`), and
> `cbp-ai-ui` (`cbrelease-4.8.40`, `ab4e963`). Two of the nine repos were
> analyzed and found **not functionally connected** to this feature despite
> matching a naive text search: `sunbird-cb-creationportal`'s only hit is a
> Learning Pathway breadcrumb method named `backToTrainingPlans()` (no
> CbPlan API call anywhere in the file); `cbp-ai-ui`'s only hit is a single
> help-sidebar sentence of UI copy. Both are named in this documentation set
> for completeness but not modeled as components of the feature. The link
> from the content-request email to the Admin Portal's `request` screens and
> onward to the Creation Portal's `demand-details-form` is inferred from
> table/route naming, not confirmed by a shared identifier traced end to
> end — see the HLD's verification boundary.
