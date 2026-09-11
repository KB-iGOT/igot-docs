# AI CBP Tool

An AI-assisted pipeline that turns a state/ministry department's own source
documents (Work Allocation Orders, ACBP plans, annual reports) into a
designation-by-designation Capacity Building Plan — role profile, competency
list, and a course list — that goes to an MDO admin for approval and
publishing on iGOT, or to an SPV admin if a designation name needs naming
approval first.

- **Repos**:
    - `cbp-ai-service` (traced at `origin/cbrelease-4.8.39`, commit `70d7175`)
      — the CBP-author-facing pipeline: documents → role mappings → course
      recommendations → CBP plan → approval submission.
    - `ai-cbp-mdo-service` (traced at `origin/cbrelease-4.8.39`, commit
      `88040de`) — the MDO admin's approve/reject/publish workflow and the
      SPV admin's designation-naming approval workflow.
    - `cbp-ai-ui` (traced at `origin/cbrelease-4.8.39`, commit `15a3b9a`) —
      the CBP author's web client; a thin Angular shell (login, session,
      routing) around a step-by-step wizard shipped as a private npm library,
      `@sunbird-cb/cbp-ai`, whose own source is not in any of these three
      repos.
- **Self-description in code**: `APP_NAME = "AI-Driven CBP Training Plan
  Creation System"` (`cbp-ai-service:src/core/configs.py:27`); referred to as
  "AI CBP tool" / "AI CBP Platform" in outbound approval-status emails
  (`cbp-ai-service:bulk_scripts/bulk_training_plan_approval.py:751-752`);
  `ai-cbp-mdo-service` self-describes as `APP_NAME = "AI CBP MDO Service"`
  (`ai-cbp-mdo-service:src/core/configs.py`).
- **Shape**: two independent FastAPI services that never call each other —
  they integrate entirely through **one shared Postgres database** — plus a
  thin Angular shell whose real feature UI is an external private library.
- **Status**: ✅ traced end-to-end across all three repos, including the
  approve/reject/publish step a single-repo trace of `cbp-ai-service` alone
  cannot see. ⚠️ what remains unverified is narrower than before: the MDO/SPV
  admin's own screens and the CBP author's step-by-step wizard both live
  outside these three repos (an MDO/SPV-facing frontend not given to this
  trace, and the private `@sunbird-cb/cbp-ai` library respectively) — see the
  honest gaps in [HLD](hld.md) and [LLD](lld.md).

## In one paragraph

A state or ministry uploads its Work Allocation Order (and other supporting
PDFs) into `cbp-ai-service`; the service summarizes each one with Gemini,
then uses those summaries to generate a hierarchical list of **role
mappings** — one per designation, each carrying role responsibilities,
activities, and a competency list (Behavioral / Functional / Domain). Each
role mapping's designation name is then reconciled against iGOT's own
designation master (exact match via iGOT's API, semantic match via a
Gemini-embedding + pgvector nearest-neighbor search); a name with no match
can be escalated to SPV admins. For every completed role mapping, a hybrid
vector-search-plus-LLM pipeline recommends courses, which a user can
supplement with iGOT-searched suggestions or fully manual entries; all three
course pools converge into one **CBP Plan** per role mapping. A batch of CBP
Plans is then sent for approval — `cbp-ai-service` snapshots the plan data
into shared database tables and emails the assigned MDO admin a review link.
From there, **`ai-cbp-mdo-service`** takes over: it reads those same
database rows, and its own API lets the MDO admin review, edit, approve or
reject each designation individually, and — on approval — call iGOT's own
CBP-plan create/publish API to actually publish it. A parallel, independent
flow in the same service lets an SPV admin approve or reject an
escalated designation name, creating it in iGOT's designation master on
approval. Neither service calls the other's API at any point; they
coordinate purely by reading and writing the same rows.

## How a CBP author experiences it

1. **Uploads source documents** for their state/ministry + department:
   Work Allocation Order, ACBP plan, annual reports (PDF only, up to 10 at a
   time), then triggers an AI summary of each.
2. **Generates role mappings**: one call kicks off a background job that
   reads the document summaries and produces a full designation hierarchy,
   each with a role profile and a competency list.
3. **Reconciles designations against iGOT**: automatically on the newest
   generation flow, or via a separate manual call — any name the matcher
   can't resolve can be escalated as a designation-approval request to an
   SPV admin.
4. **Generates course recommendations** per designation — a background job
   scores courses by hybrid vector similarity, reranks with Gemini, and
   keeps only courses above a relevancy floor.
5. **Builds the CBP Plan**: picks from the AI recommendation, from a
   separate iGOT course search, or adds a course manually — all three feed
   into one saved plan per designation.
6. **Sends the batch for approval**: bundles the state/ministry's completed
   plans into one approval request, snapshots them, and emails the assigned
   MDO admin a review link.
7. **Waits on the MDO admin's decision**: the actual review happens in a
   separate application (`ai-cbp-mdo-service`, behind its own MDO-facing
   screens — not part of this trace); the author sees the outcome only as an
   eventual status change and, on approval, a plan published to iGOT.

## How an MDO admin experiences it (via `ai-cbp-mdo-service`)

1. **Sees requests assigned to them** — a paginated list scoped to their own
   admin id, never another MDO's queue.
2. **Reviews one request's designations**, optionally editing a role's
   details or swapping a recommended course before deciding.
3. **Approves and publishes** — per designation, the service calls iGOT's
   CBP-plan create-then-publish API on the admin's behalf; a designation
   with no CBP plan data fails immediately without an iGOT call, and a
   failed publish can be retried individually without re-approving the rest.
4. **Rejects** — an entire request, or one designation at a time, with a
   required comment; rejecting every designation in a request completes it
   the same way approving the last one would.

## How an SPV admin experiences it (via `ai-cbp-mdo-service`)

1. **Sees every pending designation-naming request** — not scoped to one
   admin, unlike the MDO queue.
2. **Approves** — the service creates the designation in iGOT's master list
   first, and only marks the request approved once that succeeds (a
   designation iGOT reports as already present still counts as approved).
3. **Rejects**, with an optional comment.

## Actors

| Actor | Role |
|---|---|
| CBP author (state/ministry user) | Uploads documents, generates/edits role mappings and course recommendations, builds and submits CBP plans, via `cbp-ai-service` + `cbp-ai-ui` |
| Super Admin | Manages users/roles, views org-wide dashboards and gap analysis, account-lockout administration, in `cbp-ai-service` |
| MDO Admin / MDO Leader | Reviews, edits, approves/rejects, and publishes submitted CBP plans in `ai-cbp-mdo-service`; the screens they use are not part of this trace |
| SPV Admin | Approves or rejects an escalated designation-naming request in `ai-cbp-mdo-service`, creating the designation in iGOT's master list on approval; screens not part of this trace |
| Operator running `bulk_scripts/` | A human operator executing the offline onboarding pipeline (document copy → summarize → generate role mappings → recommend courses → submit for approval → publish) for a new state/ministry, stage by stage, from a jumphost — its final stage independently drives the same approve/publish transition `ai-cbp-mdo-service` drives live |

## The one decision that defines the feature

> Two backend services own this feature, and **they never call each other's
> API**. `cbp-ai-service` snapshots a role mapping and its CBP plan into
> `approval_requests`/`approval_request_items` rows and stops. `ai-cbp-mdo-service`
> declares those same tables `extend_existing=True` — a second SQLAlchemy
> model pointed at someone else's schema — and treats them as its own inbox:
> it reads rows `cbp-ai-service` never touches again, and writes status
> columns `cbp-ai-service` never reads back. There is no webhook, no polling
> client, no shared queue — the database row *is* the integration contract.
> The same is true one level down: neither service has a single orchestrating
> pipeline of its own. Document summarization, role-mapping generation,
> designation matching, course recommendation, and CBP-plan creation in
> `cbp-ai-service`, and per-item publish/reject in `ai-cbp-mdo-service`, are
> each independently triggered, chained only by foreign keys and precondition
> checks — not a workflow engine on either side.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the traced requirement
list.
