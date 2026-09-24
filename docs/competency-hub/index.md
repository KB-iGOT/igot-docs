# Competency Hub

The Behavioural/Functional/Domain competency taxonomy that content, learners,
designations, and MDO admin tooling all tag themselves against — plus the
Passbook, browse/search, and org-designation-mapping surfaces built on top
of it, the review-and-verification backend that actually owns the taxonomy,
and a public read-only mirror of it. Unlike most features documented in this
site, this one turned out to have **two** systems of record instead of one —
see "The one decision that defines the feature" below.

- **Repos** (traced at the commits below — see
  [As-Built Requirements](as-built-requirements.md) for full source
  citations):
    - `frac-backend` (`cbrelease-4.8.10`, `6fa1954`, tagged
      `cbrelease-4.8.10_RC1`) — the actual competency-taxonomy system of
      record: one generic `DataNode` model (Competency, CompetencyArea,
      Role, Activity, Position, KnowledgeResource, Sector, ...), a
      two-tier (L1/L2) verification workflow, MySQL + Elasticsearch +
      Kafka. This is what the other repos call `FRAC_API_BASE`/
      `fracentity-service` without ever containing its code.
    - `frac-dictionary` (`cbrelease-4.8.8`, `3eb7e05`) — a public,
      unauthenticated static (Gatsby) site that browses the same
      Competency/Role/Activity/Position data — but reads it straight from
      Elasticsearch, never calling `frac-backend`'s REST API.
    - `sunbird-cb-portal` (`cbrelease-4.8.41`, `2c8cc4d`) — Competency
      Passbook, Browse-by-Competency directory, self-attested
      current/desired competencies, content-authoring competency tagging.
    - `sunbird-cb-orgportal` (`cbrelease-4.8.41`, `0725ce0`) — ODCS
      (Org Designation↔Competency) bulk-mapping UI, Work Allocation Tool
      competency-to-role mapping, community/event/content-request
      competency tagging widgets.
    - `sunbird-cb-uiproxy` (`cbrelease-4.8.41`, `c620db2`) — the API
      gateway: two hand-written FRAC proxy routers plus ~20 generic
      pass-through routes, every one individually role-gated.
    - `sunbird-cb-ext` (`cbrelease-4.8.41`, `f001170`) — browse/search-by-
      competency backend, ODCS bulk-upload processing (Kafka-driven),
      Work Allocation competency verification.
    - `cb-ext-course-service` (`cbrelease-4.8.41`, `b1ca807`) — the
      learner's own `/learner/v1/competency/read` API, backed by
      Cassandra + Redis + a `COMPETENCY_ACQUIRED` Kafka event.
    - `igot_karmayogi_mobile` (`master`, `e0deaf5`, tag
      `iGotApp-v5.0.5-S40`) — a full, dedicated Competency Passbook
      feature module, plus Explore-by-Competency and org "Competency
      Strength" views.
    - `knowledge-platform-jobs` (`cbrelease-4.8.41`, `5395bdf`) — the
      `user-competency-updater` Flink job: the only code that actually
      *writes* a learner's acquired-competency record from certificate/
      achievement events.
    - `knowledge-platform` (`cbrelease-4.8.41`, `38bf7d9`) — reserves five
      versioned, unvalidated `competencies*` metadata fields on the
      content schema, **and** hosts the generic Framework/Category/Term
      taxonomy API that a `kcmfinal_fw` framework rides on — see the gap
      below for why that matters.
    - `sunbird-course-service` (`cbrelease-4.8.41`, `bad54e9`) — passes two
      of those field names through an Elasticsearch field whitelist;
      nothing else.
    - `sunbird-devops` (`cbrelease-4.8.41`, `bc73939`) — the Kafka/Kong/
      Druid wiring for everything above, and the Kong config that
      confirmed `fracentity-service` was worth chasing down in the first
      place.
    - `sunbird-cb-workflow` (`cbrelease-4.8.39.2`, `8ae07a0`) — checked and
      confirmed to have **zero** competency involvement; listed here only
      because it was in scope and ruled out.
- **Not documented here — see [AI CBP Tool](../learning-hub/ai-cbp-tool/index.md)
  instead**: `cbp-ai-service`, `ai-cbp-mdo-service`, `cbp-ai-ui`. These
  three consume the same Behavioural/Functional/Domain vocabulary (sourced
  from a bundled, static KCM dataset checked into `cbp-ai-service` — a
  *third* copy of the taxonomy, alongside `frac-backend`'s own and the
  `kcmfinal_fw` mirror below) to AI-generate and approve Capacity Building
  Plans — a distinct, already-documented feature. Re-explaining them here
  would duplicate, and risk drifting from, that existing trace.
- **Status**: ⚠️ the taxonomy itself is now traced to a real system of
  record (`frac-backend`), but a second, separately-maintained copy of it
  lives inside Knowledge Platform's generic taxonomy API with no sync path
  visible in any of the 13 repos here — see the honest gaps in
  [HLD](hld.md) and [LLD](lld.md).

## In one paragraph

There turn out to be **two** competency taxonomies, not one. The first is
`frac-backend`: a single Spring Boot service, one generic `DataNode` model
tagged by type (Competency, CompetencyArea, Role, Activity, Position,
KnowledgeResource, Sector, ...), assembled into a
Position→Role→{Competency→CompetencyLevel, Activity→KnowledgeResource}
hierarchy via a parent/child mapping table, MySQL-backed with an
Elasticsearch layer for search/feedback/ratings, and — the single biggest
thing invisible from every other repo in this trace — a genuine two-tier
review workflow (an L1 "technical review" then an L2 "review board", each
gate tracked by its own status column) before a node counts as verified.
`sunbird-cb-uiproxy`'s two hand-written FRAC routers, and most of what a
Karmayogi or MDO admin does with "competency" day to day, talk to this
service — reachable at `FRAC_API_BASE`, routed by Kong as `fracentity-
service`. The second is a `kcmfinal_fw` **framework** living inside
`knowledge-platform`'s generic, content-agnostic Framework/Category/Term
API — the same API every other taxonomy on the platform (course subject,
board, medium) is built from. This is what `apis/proxies/v8/framework/v1/
read/kcmfinal_fw` actually reads, what content's `competencies_v6` field is
presumably validated against, and — confirmed directly in `sunbird-cb-ext`
— what the ODCS bulk-upload's "framework term create/update/publish" calls
write new designation-mapping terms into. **No code in any of the 13 repos
here moves data between these two taxonomies.** Layered on top: a learner's
own *acquired* competencies live in a third, unrelated store — one
Cassandra table, `user_competency_mapping` — written either synchronously
on a learner's first Passbook read (`cb-ext-course-service`) or
asynchronously off a `COMPETENCY_ACQUIRED` Kafka event fired by a
certificate-generator job (`knowledge-platform-jobs`'
`user-competency-updater`). And a fourth, read-only copy exists in
`frac-dictionary`, a public unauthenticated static site that mirrors
`frac-backend`'s Elasticsearch data directly (bypassing its REST API
entirely) for SEO-friendly public browsing.

## How a Karmayogi experiences it

1. **Sees competencies on content** — course/content cards and the
   Table-of-Contents view render whatever `competencies_v6` array is tagged
   on that item; there's no dedicated "competency badge" endpoint, just this
   one metadata field, read the same way on web and mobile.
2. **Opens their Competency Passbook** — a Behavioural/Functional/Domain
   breakdown of every competency they've acquired, each grouped by Area →
   Theme → Sub-Theme, tagged by source (iGOT Learning, Self Declared, or
   ATI/CTI Reported on mobile).
3. **Browses the competency directory** — a standalone "Browse by
   Competency" surface (two generations exist on web, v1 and v2; the mobile
   equivalent is "Explore by Competency") lets a learner find content by
   competency rather than by course.
4. **Self-attests current vs. desired competencies** — during profile
   setup on web (`app/setup`), a Karmayogi can declare which competencies
   they already hold and which they want to grow into, at their own
   assessed proficiency level; this is opt-in self-reporting, not a scored
   test.
5. **Earns a competency passively** — whenever they earn a certificate
   (course completion, event, or a manually-added achievement), the
   competency tagged on that content is upserted into their passbook
   automatically, with no explicit "claim this competency" action required.
6. **Can also browse the public FRAC Dictionary** — a separate,
   unauthenticated site (`frac-dictionary`) mirrors the same Competency/
   Role/Activity/Position data for anyone, logged in or not; it's a
   distinct product from the in-app Passbook/browse experience above, not
   a step in the same flow.

## How an MDO admin experiences it

1. **Bulk-uploads a designation↔competency mapping** — downloads a sample
   workbook, fills in which Competency Area/Theme/Sub-Theme applies to each
   of the organisation's designations, and uploads it.
2. **Waits on asynchronous processing** — the upload is queued to Kafka and
   processed by a background worker, which validates every row against the
   `kcmfinal_fw` framework and creates any new designation-mapping terms it
   needs there — **in Knowledge Platform's generic taxonomy API, not in
   `frac-backend`**, despite both being called "the FRAC framework" in
   casual naming.
3. **Checks progress and downloads the result** — a status/progress
   endpoint reports how the batch is going; a completed run can be
   downloaded back out.
4. **Maps competencies onto Work Allocation roles** — separately from
   ODCS, an MDO admin can attach specific competencies (with a proficiency
   level) to a role/activity inside a Work Allocation or Work Order
   document, which gets verified against `frac-backend` (the real one this
   time), indexed into Elasticsearch, and rendered into the Work Allocation
   PDF report.

## How a FRAC reviewer experiences it (new in this pass — `frac-backend`)

1. **Sees a review queue** — every new/edited Competency, CompetencyArea,
   Role, Position, or Activity node starts `UNVERIFIED` and appears in a
   reviewer's inbox, scoped by department/type.
2. **L1 "technical review"** — an `FRAC_REVIEWER_L1` user approves (which
   promotes the node into the L2 queue) or rejects it (terminal — it never
   reaches L2).
3. **L2 "review board"** — an `FRAC_REVIEWER_L2` or `FRAC_ADMIN` user gives
   the final approval (node is now fully live), or rejects it — which,
   distinctly from an L1 rejection, sends it *back* to the L1 queue rather
   than killing it outright.
4. **A rejected node's creator gets an email** with a deep link back into
   the FRAC authoring UI (a frontend not present in any of the 13 repos
   traced here).

## The one decision that defines the feature

> The taxonomy has a real owner after all — `frac-backend` — but almost
> nothing in this trace talks to it directly, and it isn't even the only
> copy. Most clients read competency data through `apis/proxies/v8/
> framework/v1/read/kcmfinal_fw`, which resolves to a **separate**
> Framework/Term taxonomy inside `knowledge-platform`'s generic content-
> categorisation API — the same mechanism used for course subject/board/
> medium, repurposed here to also hold a competency taxonomy. `sunbird-cb-
> uiproxy`'s two hand-written FRAC routers and `sunbird-cb-ext`'s Work
> Allocation verification calls *do* talk to the real `frac-backend`; the
> ODCS bulk-upload's "framework term create/update/publish" calls write
> into the `kcmfinal_fw` mirror instead. No code anywhere in these 13 repos
> reads from one and writes to the other, or shows any reconciliation
> between them. Layer on a third copy — a static JSON dataset bundled
> directly into `cbp-ai-service` for AI CBP Tool's LLM prompts — and a
> fourth — `frac-dictionary`'s own Elasticsearch mirror, updated by a
> webhook `frac-backend` fires on verify/update — and "the competency
> taxonomy" turns out to be four differently-synchronized copies of what a
> single feature would normally keep in one place.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the traced
requirement list.
