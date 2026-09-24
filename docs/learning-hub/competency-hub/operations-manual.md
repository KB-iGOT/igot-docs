# Operations Manual — Competency Hub

How to operate, support, and troubleshoot Competency Hub as it exists
today — a distributed set of independent readers and writers around one
external taxonomy and one shared Cassandra table, not a single owned
service.

**Operational implication:** there is no single log, dashboard, or admin
console for "competency" as a whole. Diagnosing an issue means first
identifying which of the three independent mechanisms — taxonomy read,
acquired-competency write, or ODCS taxonomy write — is actually involved.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Taxonomy source of truth | External `fracentity-service` / FRAC framework (`kcmfinal_fw`) | Not observable from any of these ten repos' logs — taxonomy issues (wrong theme name, missing area) need that service's own operations access |
| Content tagging | `competencies_v6` field, unvalidated | A malformed tag on a content item can render inconsistently across web/mobile with no server-side rejection to point to |
| Learner acquired-competency writes | Two independent paths: synchronous first-read (`cb-ext-course-service`) and async certificate-triggered (`knowledge-platform-jobs`) | A "missing competency in Passbook" report could be either pipeline failing — check both |
| ODCS taxonomy writes | Kafka-mediated async batch in `sunbird-cb-ext` | Failures surface only via the progress-polling endpoint, not synchronously to the uploader |
| Caching | Redis (backend, 3600s default) and in-memory (mobile, 4h) | Stale reads are a first suspect before assuming a write failed |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `competencies_v6` | Current live content-tagging field | The one field content re-versioning explicitly copies forward; older versions (`competencies`, `_v3`, `_v5`) may still be present on legacy content and read by different clients |
| `user_id` (Cassandra `user_competency_mapping`) | Partition key for the learner's competency record | Both writers key off this — confirm it resolves consistently from the auth token on both write paths when investigating a discrepancy |
| `acquiredContextId` | Dedup key inside `competency_details` | The mechanism `user-competency-updater` uses to avoid duplicate entries when the same competency is earned twice from different content |
| `isFirstTimeUser` | Kafka event flag | Controls whether `user-competency-updater` does a full-history backfill vs. an incremental update — a wrongly-set flag can either skip history or repeat a backfill |
| ODCS tracking row status | Batch lifecycle state | The only place ODCS upload progress is recorded; exact enum values not enumerated in this trace (see LLD) |

## Operational workflows

**Taxonomy read path**: any client → `sunbird-cb-uiproxy` → either
`competency.ts`/`frac.ts` (direct to FRAC) or generic Kong pass-through →
`fracentity-service`/FRAC. If a competency picker is empty or stale across
*all* clients simultaneously, suspect the external framework service or
Kong routing, not any of these ten repos.

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
validates and writes to FRAC → tracking row updated → admin polls progress.
A stuck-"processing" batch means checking the Kafka consumer's health and
the FRAC framework-publish call, not the upload API itself (which already
returned 200 before any of that ran).

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| GET | `apis/proxies/v8/learner/v1/competency/read` | Confirm what a specific learner's Passbook currently shows |
| GET | `apis/proxies/v8/framework/v1/read/kcmfinal_fw` | Confirm the taxonomy itself is reachable and current |
| POST | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/bulkUpload/{frameworkId}` | Reproduce an ODCS upload issue |
| GET | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/progress/details/bulkUpload/{orgId}` | Check a stuck or failed ODCS batch |
| GET | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/download/{fileName}` | Retrieve a processed batch for review |
| GET | `apis/proxies/v8/searchBy/v2/competency` | Validate the Browse-by-Competency directory independent of the Passbook |
| GET | `apis/proxies/v8/v1/search/competenciesByOrg/{orgId}` | Investigate an org "Competency Strength" discrepancy (mobile) |

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

**Best practice**: for a "competency missing/wrong" report, check in this
order — taxonomy read (is it right at the source?) → Cassandra row (did
the write happen?) → cache (is a stale value being served?) → client
rendering (is the client displaying what it received correctly?).

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Learner's Passbook is empty right after signup | Expected — first read triggers an async backfill | Kafka `COMPETENCY_ACQUIRED{isFirstTimeUser:true}` was published and consumed | Wait for the backfill; if still empty after a reasonable window, check the Kafka consumer |
| A specific course completion never shows up as a competency | Content isn't tagged, or the event/consumer chain broke | Does the content have a `competencies_v6` value? Was `COMPETENCY_ACQUIRED` published for that certificate? | Fix content tagging, or investigate the cert-generator → Kafka → `user-competency-updater` chain |
| Competency picker is empty across every client | Taxonomy source unreachable | `fracentity-service`/FRAC health, Kong routing for `/competency/*` | Escalate to the taxonomy-service owner — not fixable in these ten repos |
| ODCS batch stuck in "processing" | Consumer not running, or a FRAC-write call is failing mid-batch | Consumer health, FRAC framework-publish call logs | Restart/check the consumer; inspect the specific row the batch stalled on |
| Same competency appears twice in a Passbook | Dedup-by-`acquiredContextId` didn't match (e.g. differing context ids for what should be the same source) | The two source events' `acquiredContextId` values | Data-fix at the source event, not the Cassandra row directly |
| Work Allocation save fails with a competency error | The attached competency couldn't be verified/created in FRAC | `AllocationService.verifyCompetencyDetails` failure reason | Confirm the competency exists or is creatable in FRAC; retry |
| Web's "Competencies" (assessment) tab 404s or doesn't appear | The route is intentionally disabled in current code | `app-routing.module.ts` — route is commented out | Not a bug — confirm with product whether this module should be re-enabled |
| `/competencyHub` deep link does nothing on mobile | Route constant declared but never wired into the route switch | `routes.dart` case list | Known gap — see Use Cases edge cases; needs a mobile code fix, not an ops workaround |

**Diagnostic sequence**: identify which mechanism is involved (taxonomy
read / acquired-competency write / ODCS taxonomy write) → check the
relevant Kafka topic if the mechanism is async → check Cassandra directly
for the learner/org in question → only then suspect client-side rendering.

## Known operational constraints

- No dedicated competency database owned by any of these ten repos — the
  real taxonomy CRUD lives in `fracentity-service`, outside this trace.
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
- No competency self-assessment or gap-scoring engine exists in this
  feature; do not confuse learner questions about "competency assessment"
  with the AI CBP Tool's separate gap-analysis dashboard (see that
  feature's own Operations Manual).

**Operating model**: treat Competency Hub as three loosely-coupled
mechanisms sharing a vocabulary, not one system — escalate each by its own
owning team.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Taxonomy content (wrong/missing area, theme, sub-theme) | `fracentity-service`/FRAC owner | The taxonomy read itself returns wrong data, reproducible outside these ten repos |
| Passbook read/cache behaviour | `cb-ext-course-service` team | The read API itself errors or the cache appears stuck |
| Certificate → competency backfill | `knowledge-platform-jobs` team | `COMPETENCY_ACQUIRED` events aren't being produced or consumed correctly |
| ODCS bulk-upload processing | `sunbird-cb-ext` team | A batch fails validation incorrectly or the FRAC-write step errors |
| Web Passbook/Browse-by-Competency rendering | Web portal team (`sunbird-cb-portal`) | Underlying data is correct but web display is wrong |
| Mobile Passbook/Explore rendering, or the orphaned `/competencyHub` route | Mobile team | Underlying data is correct but mobile display/navigation is wrong |
| Work Allocation competency mapping | `sunbird-cb-orgportal` / `sunbird-cb-ext` teams jointly | A role's competency mapping won't save or verify against FRAC |

## FAQ

**Why does a learner see different competencies on web vs. mobile?** They
read the same backend data but through independently-written client code
with independent caching — a transient mismatch after a recent update is
expected; a persistent one warrants comparing each client's raw API
response.

**Is there a way to manually award a learner a competency?** No dedicated
admin API for this was found in any of the ten repos — the only paths are
the automatic certificate-triggered pipeline and the learner's own
self-attestation (which is explicitly a "current/desired" declaration, not
a Passbook write).

**Why did an ODCS upload change the competency picker for everyone, not
just my org?** Because ODCS writes new terms directly into the shared,
platform-wide FRAC taxonomy — it is not scoped per-organisation at the
taxonomy level, only the designation-mapping *association* is org-scoped.

**Where does "Competency Hub" end and "AI CBP Tool" begin?** This feature
covers the taxonomy, content tagging, the learner's acquired-competency
Passbook, and org designation/role mapping. AI CBP Tool is a separate,
already-documented feature that uses the same Behavioural/Functional/
Domain vocabulary (from a bundled dataset, not the live FRAC API) to
AI-generate and approve Capacity Building Plans — see its own
[Operations Manual](../ai-cbp-tool/operations-manual.md) for that side.

> **Verification boundary:** this manual is sourced from the ten repos
> listed in the HLD/LLD. `fracentity-service`'s own operations behaviour,
> the content-service component behind `competencies_v6`, and the exact
> ODCS status-enum values were not directly observed — attaching those
> repos, or their teams' own runbooks, would close the remaining gaps.
