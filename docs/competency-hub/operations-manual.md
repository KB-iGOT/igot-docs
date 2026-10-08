# Operations Manual — Competency Hub

How to operate, support, and troubleshoot Competency Hub as it exists
today — a real taxonomy service (`frac-backend`) that most of the platform
doesn't actually call, a second taxonomy mirror most of it calls instead,
a public read-only third copy, and one shared Cassandra table two
pipelines write into independently.

**Operational implication:** there is no single log, dashboard, or admin
console for "competency" as a whole, and — critically — **fixing data in
one taxonomy does not fix it in the other.** Diagnosing an issue means
first identifying which of the mechanisms below is actually involved, and
specifically whether the report is about `frac-backend` data or
`kcmfinal_fw` data before touching anything.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Taxonomy source of truth #1 | `frac-backend` — real MySQL+ES service, port 8091, two-tier review workflow | Reached via `sunbird-cb-uiproxy`'s dedicated FRAC routers and `sunbird-cb-ext`'s Work Allocation verification; has its own operational surface (logs, DB, ES, Kafka producer) that IS in scope for this platform's ops team now |
| Taxonomy source of truth #2 | `kcmfinal_fw`, inside `knowledge-platform`'s generic Framework API | Reached by most read traffic (`framework/v1/read/kcmfinal_fw`) and ODCS's writes; a *different* system with its own ops surface, not covered in depth here |
| No sync between #1 and #2 | Confirmed absent by source search | A fix applied in one will not appear in the other — check which taxonomy a report is actually about before touching either |
| Public mirror | `frac-dictionary` — static site, rebuilt via a webhook `frac-backend` fires, reads Elasticsearch directly | If it's stale, the webhook or the rebuild pipeline is the first suspect, not `frac-backend`'s API |
| Content tagging | `competencies_v6` field, unvalidated | A malformed tag on a content item can render inconsistently across web/mobile with no server-side rejection to point to |
| Learner acquired-competency writes | Two independent paths: synchronous first-read (`cb-ext-course-service`) and async certificate-triggered (`knowledge-platform-jobs`) | A "missing competency in Passbook" report could be either pipeline failing — check both |
| ODCS taxonomy writes | Kafka-mediated async batch in `sunbird-cb-ext`, targeting `kcmfinal_fw` | Failures surface only via the progress-polling endpoint, not synchronously to the uploader |
| Caching | Redis (backend, 3600s default), in-memory (mobile, 4h), and `frac-backend`'s own boot-time full-cache (`ConfigurationPanel`) | Stale reads are a first suspect before assuming a write failed — three separate caches, not one |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `competencies_v6` | Current live content-tagging field | The one field content re-versioning explicitly copies forward; older versions (`competencies`, `_v3`, `_v5`) may still be present on legacy content and read by different clients |
| `user_id` (Cassandra `user_competency_mapping`) | Partition key for the learner's competency record | Both writers key off this — confirm it resolves consistently from the auth token on both write paths when investigating a discrepancy |
| `acquiredContextId` | Dedup key inside `competency_details` | The mechanism `user-competency-updater` uses to avoid duplicate entries when the same competency is earned twice from different content |
| `isFirstTimeUser` | Kafka event flag | Controls whether `user-competency-updater` does a full-history backfill vs. an incremental update — a wrongly-set flag can either skip history or repeat a backfill |
| ODCS tracking row status | Batch lifecycle state | The only place ODCS upload progress is recorded; exact enum values not enumerated in this trace (see LLD) |
| `status` / `secondaryStatus` (`frac-backend` `data_node`) | L1 / L2 review outcome | A node stuck as `UNVERIFIED` on one column but not the other tells you exactly which review gate it's waiting on |
| `Entities` type (`frac-backend`) | POSITION/ROLE/ACTIVITY/COMPETENCY/KNOWLEDGERESOURCE/COMPETENCIESLEVEL/COMPETENCYAREA/COMPETENCYTYPE/SECTOR | Only POSITION/ROLE/COMPETENCY/ACTIVITY nodes ever enter the review queue — the others are never "pending," by design |

## Operational workflows

**Taxonomy read path, `kcmfinal_fw`**: any client → `sunbird-cb-uiproxy` →
Kong pass-through → `knowledge-platform`'s Framework API. If a competency
picker is empty or stale across *all* clients simultaneously, suspect this
service or Kong routing.

**Taxonomy read/write path, `frac-backend`**: `sunbird-cb-uiproxy`'s
`competency.ts`/`frac.ts` → `frac-backend` directly (port 8091). Most reads
are served from `ConfigurationPanel`'s in-memory cache, not a live DB
query — `GET /frac/flushReloadCache` busts and reloads it (by type or in
full) if a change isn't showing up. New/edited nodes sit `UNVERIFIED` until
an `FRAC_REVIEWER_L1` then an `FRAC_REVIEWER_L2`/`FRAC_ADMIN` approve them
via `POST /frac/verifyDataNode` — an L2 rejection sends a node *back* to
the L1 queue, not to a dead end, which is worth knowing before assuming a
rejected node is gone for good.

**`frac-dictionary` rebuild path**: `frac-backend` writes a verified/
updated node into its `frac-dictionary` Elasticsearch index and calls a
webhook (`frac-dictionary-backend.../api/v1/site/update`); that triggers
`frac-dictionary`'s own `gatsby clean && gatsby build && ... deploy`
pipeline. If the public dictionary is stale, check whether that webhook
call actually fired and whether the rebuild pipeline succeeded — not
`frac-backend`'s REST API, which `frac-dictionary` never calls anyway.

**Passbook read path**: `cb-ext-course-service`'s
`/learner/v1/competency/read` → Redis cache check → Cassandra read on miss
→ on a brand-new user with no row, publishes `COMPETENCY_ACQUIRED` and
returns empty. A learner who "has no competencies" on first login is
expected behaviour until the backfill event is processed — not a bug by
itself.

**Passbook write path (passive)**: certificate/achievement issued →
`COMPETENCY_ACQUIRED` published by one of three certificate-generator jobs
→ `user-competency-updater` consumes, resolves the tag from content-service,
upserts Cassandra. If a learner completed a course but the competency never
appears, check in order: (1) did the certificate actually issue, (2) was
the event published (check the failed-topic dead-letter queue), (3) did
the content actually carry a `competencies_v6` tag, (4) did the Cassandra
write succeed.

**ODCS bulk upload**: upload accepted → Kafka event → async worker
validates and writes to `kcmfinal_fw` (via `knowledge-platform`'s Framework
API, **not** `frac-backend`) → tracking row updated → admin polls progress.
A stuck-"processing" batch means checking the Kafka consumer's health and
the Framework-publish call, not the upload API itself (which already
returned 200 before any of that ran).

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| GET | `apis/proxies/v8/learner/v1/competency/read` | Confirm what a specific learner's Passbook currently shows |
| GET | `apis/proxies/v8/framework/v1/read/kcmfinal_fw` | Confirm the `kcmfinal_fw` mirror is reachable and current |
| POST | `apis/protected/v8/frac/searchNodes` | Confirm `frac-backend` itself is reachable and current — a **different** health check from the row above |
| GET | `/frac/flushReloadCache` (direct to `frac-backend`, not proxied in this trace) | Force `frac-backend`'s in-memory cache to reload after a direct DB fix |
| GET | `/frac/getVerificationList` (direct to `frac-backend`) | Inspect a reviewer's pending queue for a type/department |
| POST | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/bulkUpload/{frameworkId}` | Reproduce an ODCS upload issue |
| GET | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/progress/details/bulkUpload/{orgId}` | Check a stuck or failed ODCS batch |
| GET | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/download/{fileName}` | Retrieve a processed batch for review |
| GET | `apis/proxies/v8/searchBy/v2/competency` | Validate the Browse-by-Competency directory independent of the Passbook |
| GET | `apis/proxies/v8/v1/search/competenciesByOrg/{orgId}` | Investigate an org "Competency Strength" discrepancy (mobile) |

## `frac-backend` configuration issues worth knowing about before you deploy it

- **Three different port numbers for the same service.** `server.port=8091`
  in `application.properties`, but the Kong config Kong actually routes
  `fracentity-service` to `:8083`, and the repo's own `Dockerfile`
  `EXPOSE`s `8090`. None of these were reconciled in this trace — if a
  fresh deploy doesn't come up reachable, check which of the three is
  wrong for your environment.
- **An unresolved git merge-conflict marker is checked into
  `application.properties` (lines 48-55)**, straddling the
  `accesstoken.publickey.basepath`/`sunbird_sso_url`/`sunbird_sso_realm`
  properties. As committed, this file will not parse cleanly — resolve the
  conflict before deploying from this exact commit.

## Caching and consistency

- Passbook reads cache in Redis (`user_competency_{userId}`, 3600s default)
  on `cb-ext-course-service` — a competency that was just written by
  `user-competency-updater` may not appear in the Passbook until the cache
  entry expires or is explicitly invalidated (no explicit invalidation call
  was found in this trace on the Cassandra-write side — **treat this as a
  potential stale-read gap, not confirmed either way**).
- Mobile caches the full competency framework in memory for 4 hours
  (`ApiTtl.competencyFramework`) — a taxonomy change (new theme, renamed
  area) can take up to that long to appear on a device that already loaded
  it.
- `sunbird-cb-ext`'s `SearchByService` caches browse/search facets in Redis
  with no TTL found in the traced code — refresh behaviour for that cache
  is unconfirmed.
- `frac-backend`'s `ConfigurationPanel` caches every node and mapping in
  memory at boot — this is the *primary* read path, not just an
  optimisation. A direct DB fix won't show up until `/frac/flushReloadCache`
  is called or the service restarts.
- `frac-dictionary` is only as fresh as its last successful webhook-
  triggered rebuild — there's no live-query fallback if that pipeline is
  broken; it just keeps serving the last successful build.

**Best practice**: for a "competency missing/wrong" report, first establish
*which* taxonomy the report is about (`frac-backend` or `kcmfinal_fw` —
they're not the same data), then check in order: taxonomy read (is it
right at the source?) → Cassandra row, if it's an acquired-competency
report (did the write happen?) → cache (is a stale value being served?) →
client rendering (is the client displaying what it received correctly?).

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Learner's Passbook is empty right after signup | Expected — first read triggers an async backfill | Kafka `COMPETENCY_ACQUIRED{isFirstTimeUser:true}` was published and consumed | Wait for the backfill; if still empty after a reasonable window, check the Kafka consumer |
| A specific course completion never shows up as a competency | Content isn't tagged, or the event/consumer chain broke | Does the content have a `competencies_v6` value? Was `COMPETENCY_ACQUIRED` published for that certificate? | Fix content tagging, or investigate the cert-generator → Kafka → `user-competency-updater` chain |
| Competency picker (most screens) is empty across every client | `kcmfinal_fw`/`knowledge-platform` Framework API unreachable | Kong routing for `framework/v1/read/kcmfinal_fw` | Escalate to the `knowledge-platform` team — not fixable in the client repos |
| FRAC-specific screens (profile-v3 self-attestation, Work Allocation) are empty | `frac-backend` itself unreachable — a **different** outage from the row above | `frac-backend` health on port 8091, Kong routing for `/competency/*` | Escalate to whoever owns `frac-backend`; confirming which taxonomy is down first saves a wrong escalation |
| A node exists in `frac-backend` but doesn't show up anywhere a Karmayogi would see it | It may simply be stuck `UNVERIFIED` — most read paths go through `kcmfinal_fw`, not `frac-backend`, anyway | `GET /frac/getVerificationList`; also confirm whether this node was ever supposed to be mirrored into `kcmfinal_fw` at all | Route to a reviewer if unverified; if it's a mirroring expectation, there's no confirmed sync path to check — see HLD |
| ODCS batch stuck in "processing" | Consumer not running, or the `kcmfinal_fw` Framework-publish call is failing mid-batch | Consumer health, Framework-publish call logs | Restart/check the consumer; inspect the specific row the batch stalled on |
| Same competency appears twice in a Passbook | Dedup-by-`acquiredContextId` didn't match (e.g. differing context ids for what should be the same source) | The two source events' `acquiredContextId` values | Data-fix at the source event, not the Cassandra row directly |
| Work Allocation save fails with a competency error | The attached competency couldn't be verified/created in `frac-backend` | `AllocationService.verifyCompetencyDetails` failure reason | Confirm the competency exists or is creatable in `frac-backend`; retry |
| A reviewer's rejected node "disappeared" | Expected for an L1 rejection (terminal); an L2 rejection instead sends it back to the L1 queue | Which review level rejected it, and the node's current `status`/`secondaryStatus` | Not a bug for L1; for L2, guide the reviewer to the L1 queue |
| Web's "Competencies" (assessment) tab 404s or doesn't appear | The route is intentionally disabled in current code | `app-routing.module.ts` — route is commented out | Not a bug — confirm with product whether this module should be re-enabled |
| `/competencyHub` deep link does nothing on mobile | Route constant declared but never wired into the route switch | `routes.dart` case list | Known gap — see Use Cases edge cases; needs a mobile code fix, not an ops workaround |
| Public FRAC Dictionary site is stale | Webhook didn't fire, or the Gatsby build/deploy pipeline failed | `frac-backend` webhook call logs; `frac-dictionary`'s own build/deploy logs | Not fixable by touching `frac-backend`'s API — `frac-dictionary` never reads it live |

**Diagnostic sequence**: identify which taxonomy/mechanism is involved
(`frac-backend` / `kcmfinal_fw` / acquired-competency write / ODCS write /
`frac-dictionary` mirror) → check the relevant Kafka topic or webhook if
the mechanism is async → check the store directly (Cassandra, or
`frac-backend`'s MySQL/ES) for the learner/org/node in question → only
then suspect client-side rendering.

## Known operational constraints

- **Two taxonomies, no sync mechanism.** Fixing a competency's name/area in
  `frac-backend` will not update `kcmfinal_fw`, and vice versa — confirmed
  by an exhaustive source search for any cross-reference between them; none
  exists in these 13 repos.
- No server-side structural validation of the `competencies_v6` tag
  format — malformed tags are stored and rendered as-is by whichever
  client reads them.
- No admin mechanism found to force-recompute or repair a learner's
  `user_competency_mapping` row short of a direct Cassandra intervention.
- No confirmed cache-invalidation call from the async
  `user-competency-updater` write path into `cb-ext-course-service`'s
  Redis cache — treat as a possible stale-read source until confirmed.
- ODCS batch status values and any retry/resume mechanism for a partially
  failed batch were not confirmed in this trace.
- `frac-backend` has three disagreeing port numbers across its own config
  (`8091`/`8083`/`8090`), an unresolved merge-conflict marker checked into
  `application.properties` —
  see "configuration issues" above before treating it as production-ready
  as-is.
- No competency self-assessment or gap-scoring engine exists in this
  feature; do not confuse learner questions about "competency assessment"
  with the AI CBP Tool's separate gap-analysis dashboard (see that
  feature's own Operations Manual).

**Operating model**: treat Competency Hub as several loosely-coupled
systems sharing a vocabulary, not one system — escalate each by its own
owning team, and always confirm which taxonomy a report concerns before
routing it.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| `kcmfinal_fw` taxonomy content (wrong/missing area, theme, sub-theme) | `knowledge-platform` team | The taxonomy read itself returns wrong data, reproducible outside these 13 repos |
| `frac-backend` data, review workflow, or its own config issues | `frac-backend` owner | A FRAC-specific screen is wrong, or a node is stuck in review |
| `frac-dictionary` staleness | `frac-backend` owner (webhook) + `frac-dictionary` owner (build pipeline) | The public site doesn't reflect a recently-verified node |
| Passbook read/cache behaviour | `cb-ext-course-service` team | The read API itself errors or the cache appears stuck |
| Certificate → competency backfill | `knowledge-platform-jobs` team | `COMPETENCY_ACQUIRED` events aren't being produced or consumed correctly |
| ODCS bulk-upload processing | `sunbird-cb-ext` team | A batch fails validation incorrectly or the FRAC-write step errors |
| Web Passbook/Browse-by-Competency rendering | Web portal team (`sunbird-cb-portal`) | Underlying data is correct but web display is wrong |
| Mobile Passbook/Explore rendering, or the orphaned `/competencyHub` route | Mobile team | Underlying data is correct but mobile display/navigation is wrong |
| Work Allocation competency mapping | `sunbird-cb-orgportal` / `sunbird-cb-ext` teams jointly | A role's competency mapping won't save or verify against `frac-backend` |

## FAQ

**Why does a learner see different competencies on web vs. mobile?** They
read the same backend data but through independently-written client code
with independent caching — a transient mismatch after a recent update is
expected; a persistent one warrants comparing each client's raw API
response.

**Is there a way to manually award a learner a competency?** No dedicated
admin API for this was found in any of the 13 repos — the only paths are
the automatic certificate-triggered pipeline and the learner's own
self-attestation (which is explicitly a "current/desired" declaration, not
a Passbook write).

**Why did an ODCS upload change the competency picker for everyone, not
just my org?** Because ODCS writes new terms directly into the shared,
platform-wide `kcmfinal_fw` taxonomy — it is not scoped per-organisation
at the taxonomy level, only the designation-mapping *association* is
org-scoped. Note this does **not** touch `frac-backend`'s own data at all.

**I fixed a competency in `frac-backend`'s admin tooling — why doesn't the
learner-facing picker show the fix?** Because most learner-facing pickers
read `kcmfinal_fw`, not `frac-backend`. There is no confirmed mechanism
that propagates a `frac-backend` change into `kcmfinal_fw` — this is the
single most likely cause of "I fixed it but nothing changed" reports for
this feature.

**Where does "Competency Hub" end and "AI CBP Tool" begin?** This feature
covers both taxonomies, content tagging, the learner's acquired-competency
Passbook, and org designation/role mapping. AI CBP Tool is a separate,
already-documented feature that uses the same Behavioural/Functional/
Domain vocabulary (from a *third*, static bundled dataset, not either live
taxonomy here) to AI-generate and approve Capacity Building Plans — see its
own [Operations Manual](../learning-hub/ai-cbp-tool/operations-manual.md)
for that side.

> **Verification boundary:** this manual is sourced from the 13 repos
> listed in the HLD/LLD, now including `frac-backend` and `frac-dictionary`
> in full. Still not directly observed: `knowledge-platform`'s Framework
> API operations in depth, the content-service component behind
> `competencies_v6`, the exact ODCS status-enum values, and — the one that
> matters most operationally — any confirmation of whether `frac-backend`
> and `kcmfinal_fw` are meant to be kept in sync by a process outside these
> repos, or have simply diverged. Attaching `knowledge-platform`'s
> Framework API source in the same depth as `frac-backend`, or asking its
> owning team directly, would close this gap.
