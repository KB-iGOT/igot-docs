# Operations Manual — Training Plan

How to operate, support, and troubleshoot Training Plan (`CbPlan`) as it
exists today — four coexisting API/table generations behind one feature
name, plus a separate AI bulk-publish pipeline that talks to the backend
directly.

**Operational implication:** before touching any plan, first establish
*which generation* created it — v1 (`sunbird-cb-ext`, `cb_plan`) vs.
v2/v3/v4 (`cb-ext-course-service`, `cb_plan_v2`/`cb_plan_v3`). Symptoms that
look identical can have entirely different root causes depending on which
table the plan actually lives in.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Storage | 4 generations, 2 repos, non-overlapping table sets (v3 and v4 share one table; v1 and v2 do not) | A plan "missing" from one screen may simply be in a different generation's table than the screen queries |
| Assignment fan-out | Rebuilt entirely on every publish, per generation's own lookup table(s) | Learner-side "not seeing my plan" issues are usually a lookup-table problem, not a plan-row problem |
| Content-request loop | Async, email-only, no confirmed close-the-loop write-back into the same table | Don't expect a status field on the request row to reflect provider action — it may never be updated |
| AICBP bulk pipeline | Runs outside the Org Portal UI; calls `cb-ext-course-service` directly | Check the pipeline's own logs and retry state when a bulk run fails |
| Comprehensive Assessment gating | A plan's `isApar`/`calinkedid` fields double as a gate for an unrelated feature | An "assessment won't unlock" ticket may actually be a Training Plan data issue, not a CAP issue |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `status` | `DRAFT` / `LIVE` / `RETIRE` | `RETIRE` is terminal on every generation — there is no un-retire |
| `draftData` (v1) | Staged edits pending publish | A `LIVE` plan's *visible* fields don't reflect an unpublished edit — check this field before assuming data loss |
| `isApar` | Marks the plan as APAR (mandatory/performance-linked) | Cannot be un-set once true on a `LIVE` plan — a "please remove APAR" request on a live plan requires a new plan, not an edit |
| `calinkedid` | Comprehensive Assessment this plan gates | Written only by the CA-link Kafka consumer or the matching update API — never edit it by hand without understanding the compare-then-write contract |
| `planType` | `AICBP` for AI-bulk-created plans | These plans didn't go through the Org Portal — don't expect Org Portal audit trail fields to be meaningful for them |
| `assignmentTypeInfoKey` / lookup rows | The fan-out key a learner's "my plans" read actually queries | If a plan is live but invisible to an assignee, check the lookup row for that key exists and `isActive=true` |

## Operational workflows

**Authoring & publish**: create (draft) → edit (staged) → publish (promotes
staged fields, rebuilds fan-out). There is no autosave in the stepper —
confirm the author actually completed each step before treating missing
data as a bug.

**Content request**: Org Portal submit → `POST
cbplan/v1/admin/requestcontent` → Kafka `dev.cbplan.content.request` →
`CbplanContentConsumer` looks up `CBP_ADMIN`s in the target provider org(s)
→ templated email sent. If a provider reports never receiving the email,
check: (1) the provider org actually has a user with role `CBP_ADMIN`, (2)
the `email_template` Cassandra row for `cbplanContentRequestTemplate`
exists, (3) the notification service's async endpoint is healthy.

**Comprehensive Assessment link**: a search-indexer Flink job (external)
publishes ADD/REMOVE events to `dev.trainingplan.ca.events` whenever a CA
collection's own link field changes; `CbPlanCaLinkConsumer` mirrors that
onto the plan's `calinkedid`. This is compare-then-write and safe against
redelivery — if a plan's CA link looks wrong, check the *CA collection's*
own linkage first; this consumer only ever reflects it, never originates it.

**AICBP bulk publish**: run from a jumphost, requires port-forwarding
`CB_EXT_COURSE_SERVICE_URL` to the cluster. Each row is independently
create+publish; a partial failure leaves that row `PENDING` for retry on
the next run — do not manually flip a row to `APPROVED` without confirming
both the create and publish calls actually succeeded upstream.

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| POST | `cbplan/v1/create` / `v2/create` / `v3/create` / `v4/create` | Diagnose which generation a reported plan actually belongs to |
| POST | `cbplan/vN/update` | Check save failures and field-allow-list rejections (v3/v4: `cbplan.allowed.fields.update`) |
| GET | `cbplan/v1/read/{id}` / `v3/read/{id}` / `v4/read/{id}` / `v4/admin/read/{id}` | Confirm stored metadata per generation; `admin/read` returns plans of any status on v4 |
| POST | `cbplan/vN/publish` | Confirm the fan-out actually ran |
| DELETE | `cbplan/vN/archive` | Retire/delete support |
| POST | `cbplan/v1/list` / `v2/search` / `v3/search` / `v4/search` | Validate listing/search behaviour per generation |
| GET | `cbplan/v1/user/list` | Legacy learner-list support |
| POST | `cbplan/v3/user/dictionary` / `v4/user/dictionary` | Learner-side "my plans" diagnostics |
| GET | `cbplan/v4/user/assessment/eligibility/{doId}` | Investigate a Comprehensive Assessment unlock issue traced back to Training Plan |
| POST | `cbplan/v1/admin/requestcontent` | Content-request support |
| GET | `cbplan/v2/migrate` | Rebuilds the access-setting-rules Elasticsearch index — **not** a plan-data migration; do not run expecting v1→v2 backfill |
| POST | `{course-service}/cbplan/v3/aicbp/create`, `.../aicbp/publish` | AICBP bulk-pipeline diagnostics |

## Caching and consistency

v3/v4 config exposes both a Caffeine (in-process) and Redis cache per
generation (`cb.plan.v3.cache.ttl.minutes` / `cb.plan.v4.cache.ttl.minutes`,
plus `*.caffine.cache.max.size`, `*.redis.cache.ttl.seconds`) — a
just-published change can appear stale for up to the configured TTL on
reads that hit these caches. When a learner reports a plan that "isn't
there yet," check whether the read path involved is cached before assuming
a fan-out failure.

## Publishing checklist

- [ ] Identify the generation (v1 vs. v2/v3/v4) the plan belongs to
- [ ] Content list and (if APAR) gating selections are saved
- [ ] Access control (user group) is attached, if publish requires it for
      that generation
- [ ] Caller has creator or `MDO_LEADER`-equivalent role
- [ ] Plan is not already `RETIRE`d
- [ ] After publish, confirm lookup/fan-out rows were rebuilt for the
      expected assignee keys

## Retirement checklist

- [ ] Correct plan id and generation confirmed
- [ ] Caller authorized (creator or authorized role)
- [ ] Understand retirement is terminal — no un-retire path exists on any
      generation traced
- [ ] Confirm fan-out rows are deactivated (`isActive=false`), not deleted

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Plan not visible to an assigned learner | Fan-out row missing/inactive, or wrong generation's lookup table queried | The plan's `*_lookup*` row for that assignee key | Re-publish to rebuild fan-out, or confirm which generation's search API the learner-facing screen actually calls |
| Edit doesn't appear after save | Edit staged in `draftData` (v1) but not yet published | Compare draft vs. live fields | Publish to apply the staged edit |
| Can't remove APAR from a live plan | By design — blocked server-side | `isApar` flag + plan status | Business decision — requires a new plan, not an edit |
| Content-request email never arrives | No `CBP_ADMIN` in target org, or template/notification-service issue | Provider org's user roles; `email_template` row; notification service health | Fix the missing piece; there is no retry visible in the consumer |
| Comprehensive Assessment won't unlock despite plan completion | `calinkedid` not set, or CA-side link is the actual source of truth and it's wrong there | `GET cbplan/v4/user/assessment/eligibility/{doId}` | Investigate the CA collection's own link field, not this plan, first |
| AICBP bulk row stuck `PENDING` | Create or publish call failed upstream | Pipeline logs for that `approval_request_id` | Re-run the pipeline — it's idempotent per row |
| Two different learner-content counts for the same person | The two parallel personal-content-info pipelines (v3-based vs. v4-based) disagree | Which widget/screen is being compared | Treat as a known duplication, not a data-corruption bug — see [As-Built Requirements](as-built-requirements.md) |

**Diagnostic sequence**: identify generation → confirm plan status and
`draftData` presence → confirm fan-out/lookup rows for the affected
assignee → for CA-gating issues, check the CA side first → for bulk-pipeline
issues, check the pipeline's own idempotent-retry state before assuming
backend failure.

## Known operational constraints

- No un-retire path on any generation.
- No confirmed write-back from the content-request review UI into the
  request table it presumably reads from.
- No single "list all my org's plans regardless of generation" endpoint —
  an operator must query up to four APIs to be sure they've found every
  plan.
- No admin tool to force-rebuild fan-out rows outside a normal publish
  call.

**Operating model**: treat Training Plan as four parallel, versioned
implementations of the same concept rather than one system with an
evolving schema — support diagnostics should start by identifying which
generation is involved, not by assuming a single unified data model.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| v1 CRUD/workflow, content-request email | `sunbird-cb-ext` backend team | v1 endpoints fail or the content-request Kafka consumer stalls |
| v2/v3/v4 CRUD/workflow, AICBP, CA-link | `cb-ext-course-service` backend team | Any `cbplan/v2`–`v4` endpoint fails, or `calinkedid` mirroring is wrong |
| Org Portal authoring UI | Org Portal frontend team | Stepper, dashboard, or Reusable-User-Groups integration misbehaves |
| Learner-facing `cbp` portal | Web portal team | Bucketing, filtering, or enrolment cross-reference is wrong |
| Content-request provider review | Admin Portal team | Provider-side review screens misbehave (data source unconfirmed — see verification boundary) |
| AICBP bulk pipeline | Platform Ops / cbp-ai-service owners | Bulk publish stalls or repeatedly fails for the same rows |

## FAQ

**Why do two different screens show a different set of plans for the same
org?** They likely query different API generations (v1's `user/list` vs.
v3's `search` vs. v4's `search`) against different tables. Confirm which
generation each screen actually calls before treating it as a data bug.

**Is there a way to migrate a v1 plan to v3/v4?** No migration path was
found in any of the 9 repos. `cbplan/v2/migrate` only rebuilds an
Elasticsearch index for access-setting rules — it does not move plan data
between generations.

**Why does removing APAR from a published plan fail?** It's an intentional
server-side restriction, not a bug — once `isApar=true` and the plan is
`LIVE`, the flag cannot be unset via update.

> **Verification boundary:** this manual is sourced from the same 9 repos
> as the rest of this feature's docs (2 found not functionally connected —
> see [index.md](index.md)). Deeper runbook detail for the Kong gateway's
> routing rules, the DDL/schema repository, the notification service's own
> operations, and the search-indexer Flink job that originates CA-link
> events would need those systems' own operations docs attached.
