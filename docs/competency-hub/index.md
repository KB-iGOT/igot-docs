# Competency Hub

The Behavioural/Functional/Domain competency taxonomy that content, learners,
designations, and MDO admin tooling all tag themselves against — plus the
Passbook, browse/search, and org-designation-mapping surfaces built on top
of it. There is no "Competency Service" anywhere in these repos; every piece
below either tags itself with an opaque competency array, proxies straight
through to an external framework service, or independently upserts a row
into one shared Cassandra table.

- **Repos** (traced at the commits below — see
  [As-Built Requirements](as-built-requirements.md) for full source
  citations):
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
      competency backend, ODCS bulk-upload processing (Kafka-driven,
      writes to an external FRAC framework), Work Allocation competency
      verification.
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
      content schema; no competency logic of its own.
    - `sunbird-course-service` (`cbrelease-4.8.41`, `bad54e9`) — passes two
      of those field names through an Elasticsearch field whitelist;
      nothing else.
    - `sunbird-devops` (`cbrelease-4.8.41`, `bc73939`) — confirms the real
      competency-taxonomy CRUD API is served by `fracentity-service`, a
      service outside all fourteen repos traced for this feature; also
      the Kafka/Kong/Druid wiring for everything above.
    - `sunbird-cb-workflow` (`cbrelease-4.8.39.2`, `8ae07a0`) — checked and
      confirmed to have **zero** competency involvement; listed here only
      because it was in scope and ruled out (see the honest gap below).
- **Not documented here — see [AI CBP Tool](../learning-hub/ai-cbp-tool/index.md)
  instead**: `cbp-ai-service`, `ai-cbp-mdo-service`, `cbp-ai-ui`. These
  three consume the same Behavioural/Functional/Domain taxonomy (sourced
  from a bundled KCM dataset, not the live FRAC API) to AI-generate and
  approve Capacity Building Plans — a distinct, already-documented feature
  that happens to share the same competency vocabulary. Re-explaining them
  here would duplicate, and risk drifting from, that existing trace.
- **Status**: ⚠️ thin, distributed system — no owning service; see the
  honest gaps in [HLD](hld.md) and [LLD](lld.md).

## In one paragraph

Every competency a Karmayogi sees — on a course, in their Passbook, in an
org's designation mapping — ultimately traces back to one external taxonomy:
a FRAC framework named `kcmfinal_fw` ("Karmayogi Competency Model"), read
over HTTP by nearly every repo in this trace but implemented by none of
them; `sunbird-devops` confirms the actual CRUD API lives in a
`fracentity-service` outside this feature's scope entirely. Content gets
tagged against that taxonomy through five versioned, unvalidated metadata
fields (`competencies` through `competencies_v6`) that `knowledge-platform`
reserves on its content schema but never structurally validates —
`competencies_v6` is the current "live" one, the only version copied
forward when a content item is versioned. A learner's own *acquired*
competencies are different: they live in one Cassandra table,
`user_competency_mapping`, written from two independent directions —
directly, when `cb-ext-course-service`'s `/learner/v1/competency/read` API
is hit for a brand-new user, and asynchronously, when
`knowledge-platform-jobs`'s `user-competency-updater` Flink job consumes a
`COMPETENCY_ACQUIRED` Kafka event fired by any of three certificate-
generator jobs every time a course, event, or self-declared achievement
produces a certificate. Learners browse and self-assess against the
taxonomy through a Competency Passbook (full implementations in both
`sunbird-cb-portal` and `igot_karmayogi_mobile`) and a Browse-by-Competency
directory; MDO admins map their organisation's designations to competencies
through an Excel bulk-upload ("ODCS") that `sunbird-cb-ext` processes
asynchronously over Kafka, writing the result back into the same external
FRAC framework as new "term" nodes. Every one of these paths is proxied
through `sunbird-cb-uiproxy`, which — uniquely among the repos here — has
its own dedicated FRAC-facing routers in addition to generic pass-through.

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

## How an MDO admin experiences it

1. **Bulk-uploads a designation↔competency mapping** — downloads a sample
   workbook, fills in which Competency Area/Theme/Sub-Theme applies to each
   of the organisation's designations, and uploads it.
2. **Waits on asynchronous processing** — the upload is queued to Kafka and
   processed by a background worker, which validates every row against the
   master competency framework and creates any new competency "term" nodes
   the mapping needs, directly in the external FRAC framework.
3. **Checks progress and downloads the result** — a status/progress
   endpoint reports how the batch is going; a completed run can be
   downloaded back out.
4. **Maps competencies onto Work Allocation roles** — separately from
   ODCS, an MDO admin can attach specific competencies (with a proficiency
   level) to a role/activity inside a Work Allocation or Work Order
   document, which gets verified against FRAC, indexed into Elasticsearch,
   and rendered into the Work Allocation PDF report.

## The one decision that defines the feature

> There is no Competency Service. What looks like one feature is really
> three independent, uncoordinated mechanisms that all happen to point at
> the same external taxonomy: content tags itself with an unvalidated JSON
> array (`competencies_v6`) that any client can read but no repo here
> defines the internal shape of; a learner's *acquired* competency record
> is written by two separate pipelines that never call each other — a
> synchronous first-touch write in `cb-ext-course-service` and an
> asynchronous, certificate-triggered write in `knowledge-platform-jobs` —
> into one shared Cassandra table neither pipeline owns exclusively; and an
> MDO admin's designation mapping is a Kafka-driven batch job in
> `sunbird-cb-ext` that mutates the *taxonomy itself* by creating new terms
> in an external FRAC framework this codebase never defines the schema of.
> The actual competency CRUD API — the one thing that would make this a
> single feature — is `fracentity-service`, confirmed by `sunbird-devops`'s
> Kong routing config to exist, and confirmed by every repo above to be
> entirely out of scope for this trace.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the traced
requirement list.
