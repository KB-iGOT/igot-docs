# AI CBP Tool

An AI-assisted pipeline that turns a state/ministry department's own source
documents (Work Allocation Orders, ACBP plans, annual reports) into a
designation-by-designation Capacity Building Plan — role profile, competency
list, and a course list — ready to be sent to an MDO admin for approval and
publishing on iGOT.

- **Repo**: `cbp-ai-service` (traced at `origin/cbrelease-4.8.39`, commit
  `119a42b`)
- **Self-description in code**: `APP_NAME = "AI-Driven CBP Training Plan
  Creation System"` (`src/core/configs.py:27`); referred to as "AI CBP tool" /
  "AI CBP Platform" in outbound approval-status emails
  (`bulk_scripts/bulk_training_plan_approval.py:751-752`)
- **Shape**: a FastAPI service (Postgres + pgvector, Redis, Google
  Gemini/Vertex AI, GCS) plus a separate directory of offline batch scripts
  (`bulk_scripts/`) that re-implement parts of the same pipeline for bulk
  onboarding
- **Status**: ⚠️ two of the pipeline's stages hand off to systems **outside**
  this repo — see the honest gaps below

## In one paragraph

A state or ministry uploads its Work Allocation Order (and other supporting
PDFs); the service summarizes each one with Gemini, then uses those
summaries to generate a hierarchical list of **role mappings** — one per
designation, each carrying role responsibilities, activities, and a
competency list (Behavioral / Functional / Domain). Each role mapping's
designation name is then reconciled against iGOT's own designation master
(exact match via iGOT's API, semantic match via a Gemini-embedding +
pgvector nearest-neighbor search). For every completed role mapping, a
hybrid vector-search-plus-LLM pipeline recommends courses, which a user can
supplement with iGOT-searched suggestions or fully manual entries; all three
course pools converge into one **CBP Plan** per role mapping. A batch of CBP
Plans can then be sent for approval — which snapshots the plan data and
emails the relevant MDO admin — but the actual approve/reject/publish
decision is made by a system outside this repo (the MDO portal), which this
codebase only reaches via an approval-status email and, for bulk
onboarding, an offline script that talks to that decision system's publish
API directly.

## How a CBP author experiences it

1. **Uploads source documents** for their state/ministry + department:
   Work Allocation Order, ACBP plan, annual reports (PDF only, up to 10 at a
   time), then triggers an AI summary of each.
2. **Generates role mappings**: one call kicks off a background job that
   reads the document summaries and produces a full designation hierarchy,
   each with a role profile and a competency list.
3. **Reconciles designations against iGOT**: automatically on the newest
   generation flow, or via a separate manual call — any name the matcher
   can't resolve can be escalated as a designation-approval request.
4. **Generates course recommendations** per designation — a background job
   scores courses by hybrid vector similarity, reranks with Gemini, and
   keeps only courses above a relevancy floor.
5. **Builds the CBP Plan**: picks from the AI recommendation, from a
   separate iGOT course search, or adds a course manually — all three feed
   into one saved plan per designation.
6. **Sends the batch for approval**: bundles the state/ministry's completed
   plans into one approval request, snapshots them, and emails the assigned
   MDO admin a review link.
7. **Waits on an external decision**: approving, rejecting, and publishing
   to iGOT happens in a system this repo does not contain — this repo's own
   API has no endpoint that performs that transition.

## Actors

| Actor | Role |
|---|---|
| CBP author (state/ministry user) | Uploads documents, generates/edits role mappings and course recommendations, builds and submits CBP plans |
| Super Admin | Manages users/roles, views org-wide dashboards and gap analysis, account-lockout administration |
| SPV Admin (external, notified only) | Receives an email when a designation name can't be auto-matched and needs manual naming approval — no approve/reject endpoint for this exists in this repo |
| MDO Admin / MDO Leader (external, notified only) | Receives an email with a deep link to review a submitted CBP approval request in a separate MDO-facing portal; the approve/reject/publish action itself happens there, not in this repo |
| Operator running `bulk_scripts/` | A human operator executing the offline onboarding pipeline (document copy → summarize → generate role mappings → recommend courses → submit for approval → publish) for a new state/ministry, stage by stage, from a jumphost |

## The one decision that defines the feature

> There is no single orchestrating engine. Document summarization, role-mapping
> generation, designation matching, course recommendation, and CBP-plan
> creation are five separately-triggered steps, each with its own status
> field, chained together only by foreign keys and precondition checks in the
> API layer — a CBP Plan cannot be created until a recommendation exists; an
> approval request cannot be sent until a CBP Plan exists. And the chain
> breaks entirely at the last link: this repo can create and email an
> approval request, but nothing in its live API ever marks one `APPROVED` or
> `REJECTED` — that transition, and the actual publish-to-iGOT call, belongs
> to a separate MDO-facing system that only an offline script
> (`bulk_scripts/bulk_training_plan_approval.py`) in this repo mirrors.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the traced requirement
list.
