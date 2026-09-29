# Training Plan — As-Built Requirements

Requirements reconstructed from the shipped implementation across 9 repos
(branches/commits listed in [index.md](index.md)) — what the system does
today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for Training Plan was available in
any of the 9 repos. This document reconstructs requirements **from the
shipped implementation** across the legacy backend (`sunbird-cb-ext`), the
current backend (`cb-ext-course-service`), the BFF proxy
(`sunbird-cb-uiproxy`), three frontend portals
(`sunbird-cb-orgportal`, `sunbird-cb-portal`, `sunbird-cb-adminportal`),
and the AI bulk pipeline (`cbp-ai-service`). Two repos
(`sunbird-cb-creationportal`, `cbp-ai-ui`) were analyzed and found not
functionally connected — see [index.md](index.md). Each requirement traces
to file(s)/function(s) that implement it.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Plan lifecycle (all four generations)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL persist a Training Plan as a dedicated Cassandra row (not a generic Content node), with lifecycle statuses `DRAFT` → `LIVE` → `RETIRE`, the last being terminal. | `CbPlan.java`; `CbPlanServiceImpl` (v1) publish/retire methods |
| FR-002 | An update to a `LIVE` plan SHALL be staged into a `draftData` field rather than applied to live fields, and SHALL only take effect on the next `publish` call. | `CbPlanServiceImpl.updateDraftInfo` (v1) |
| FR-003 | The system SHALL restrict update/publish/retire to the plan's `createdBy` user, or a user holding a role listed in config `cb-plan.update.publish.authorized.roles` (default `MDO_LEADER`), on every generation. | `CbExtServerProperties`; `application.properties:410` (v1) |
| FR-004 | Once a plan's `isApar` flag is `true` and the plan is `LIVE`, the system SHALL reject any update that un-sets it. | `CbPlanServiceImpl` (v1), field-restriction check on publish of a pending draft |
| FR-005 | On every publish, the system SHALL rebuild a per-assignee "lookup" table (insert new assignee keys, deactivate removed keys, refresh `endDate`/`isApar` on existing keys) so learner-side reads are a direct key lookup, not a full-plan scan. | `CbPlanServiceImpl.updateCbPlanLookupInfo` (v1); equivalent `*_lookup_by_org` tables (v2/v3/v4) |
| FR-006 | v3/v4 plan updates SHALL be restricted to an explicit allow-listed field set. | `application.properties:49` `cbplan.allowed.fields.update=name,endDate,isApar,contextData,contentList` |

### Versioning (as-built, not by original design intent)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The system SHALL expose four independent API/table generations of the same feature simultaneously: v1 (`sunbird-cb-ext`, table `cb_plan`), v2 (`cb-ext-course-service`, table `cb_plan_v2`), v3 (table `cb_plan_v3`), and v4 (same table as v3, different access-control model). | `CbPlanController.java` (v1); `CbPlanWithAccessSettings.java` (v2); `CbPlanWithAccessSettingsV3.java`/`V4.java` |
| FR-011 | v4 SHALL differentiate itself from v3 by referencing a `userGroupId` (resolved against `user_group_info`) instead of v3's inline `userGroupCriteriaList`/`userGroupName`, while both read/write the same underlying plan table. | `application.properties:190` `cbplan.v4.plan.table=cb_plan_v3`; V3/V4 service interface javadocs |
| FR-012 | `sunbird-cb-uiproxy` SHALL forward all four `cbplan/vN/*` path families generically to the Kong API gateway without itself selecting a backend service. | `proxies_v8.ts:940-943` |
| FR-013 | The frontend authoring module SHALL call all four API generations from the same service file rather than a single version. | `traininig-plan.service.ts` (create/read/update/archive/publish across v1–v4) |

### Content, APAR, and Comprehensive Assessment gating

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The authoring UI SHALL offer an "APAR Assignment" toggle whose help text states that enabling it makes the plan visible to assignees "under the APAR section on the Home page." | `create-content.component.html:10` |
| FR-021 | When APAR is enabled, the authoring UI SHALL offer a "gating courses" selector letting the author mark specific already-selected courses as mandatory for unlocking a linked Comprehensive Assessment, warning (non-blocking) above 25 selections. | `gating-courses.component.ts:11,25,96-100` |
| FR-022 | The system SHALL mirror a Comprehensive Assessment collection's own link field onto a plan's `calinkedid` column via an async, idempotent (compare-then-write) Kafka consumer, keyed by `trainingPlanId`+`caIdentifier`, supporting `ADD`/`REMOVE` events. | `CbPlanCaLinkConsumer.java:69-118`; topic `dev.trainingplan.ca.events` |
| FR-023 | The system SHALL expose an eligibility-check endpoint that determines whether a given Comprehensive Assessment `do_id` is unlocked for the caller by matching it against `calinkedid` across the current and previous financial year. | `CbPlanWithAccessSettingsV4.java` `GET user/assessment/eligibility/{doId}` |

### Content request (provider-org sourcing)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The authoring UI SHALL let an author, when content search yields no results, submit a structured content request (competency area/theme/sub-theme, provider org list, free-text description ≤1000 chars). | `add-content-dialog.component.html:1-97` |
| FR-031 | Submitting a content request SHALL insert a row into `cb_content_request` with status `IN_PROGRESS` and asynchronously publish the request onto Kafka topic `dev.cbplan.content.request` for email notification. | `CbPlanServiceImpl.requestCbplanContent` (v1), `CbPlanServiceImpl.java:583-618` |
| FR-032 | The system SHALL notify every user with role `CBP_ADMIN` in the named provider org(s) via a Velocity-templated email, CC'ing the original requester. | `CbplanContentConsumer.java` |
| FR-033 | Provider-org admins SHALL review/action requests via the Admin Portal's `request` screens (mark invalid, or publish), each gated behind a reusable confirmation dialog. | `all-request.component.ts:249-263`; `confirmation-popup.component.ts` |

### Learner consumption

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The learner-facing portal SHALL fetch the caller's assigned plans via the v3 search API, server-enriched, and bucket them client-side into Upcoming, Overdue, APAR, and Completed. | `cbp-plan.component.ts:244-332` (`fetchCbpPlanListV3`) |
| FR-041 | Each plan card SHALL be cross-referenced against the learner's own enrolment/completion state, sourced from a client-side IndexedDB cache rather than the plan-list response. | `cbp-plan.component.ts:403-438` |
| FR-042 | The portal SHALL classify each plan into one of three types (`apar`, `nonapar`, `aicbp`) with URL-hint aliasing (`trainingplan`/`training`/`cbplan`/`cbp` → `nonapar`). | `cbp-plan.component.ts:93-110,100-105,458-473` |

### AI-generated bulk plans

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-050 | The system SHALL support creating and publishing a plan on a user's behalf via dedicated `aicbp/create`/`aicbp/publish` endpoints, distinct from the interactive author-facing create/publish endpoints. | `CbPlanWithAccessSettings.java:39-56` (v2); `CbPlanWithAccessSettingsV3.java:161-179` (v3) |
| FR-051 | An offline pipeline (`cbp-ai-service`) SHALL bulk-publish previously-approved AI-drafted designation plans by calling the v3 `aicbp/create`+`aicbp/publish` endpoints directly, scoping each plan's user group by designation and org. | `bulk_training_plan_approval.py:532-590` |
| FR-052 | Bulk publish SHALL be row-idempotent: only a row whose create **and** publish both succeed is marked `APPROVED`; a failed row remains `PENDING` for retry on the next run. | `bulk_training_plan_approval.py:642-680` |
| FR-053 | The bulk pipeline SHALL optionally send an "approved" notification email per successfully-published row. | `bulk_training_plan_approval.py:775-817` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | `cbplan/*` write endpoints (create/update/publish/archive) SHALL require role `MDO_ADMIN` or `MDO_LEADER`; the learner-facing list/dictionary endpoints SHALL require only an authenticated (`PUBLIC`) user. | `whitelistApis.ts` (repeated per version block) |
| NFR-002 | v3/v4 plan reads SHALL be cacheable at both an in-process (Caffeine) and distributed (Redis) layer, independently configurable per generation. | `application.properties:165-182` |
| NFR-003 | The AI bulk pipeline SHALL authenticate to the backend using a human approver's JWT obtained fresh per run via an OIDC password grant, not a long-lived service credential. | `bulk_training_plan_approval.py:404-431` |
| NFR-004 | Content-request processing SHALL run asynchronously off the Kafka consumer thread, decoupling request submission from email delivery latency. | `CbplanContentConsumer.java:50-52` |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | No data migration path exists between any of the four API/table generations. | A plan created under v1 can never appear in a v3/v4 search, and vice versa — an operator or user must know which generation a plan lives in. | `cb_plan` vs. `cb_plan_v2` vs. `cb_plan_v3` table separation; no migration code found |
| CON-002 | `cbplan/v2/migrate` rebuilds an Elasticsearch index for access-setting rules — it is not a plan-data migration despite its name and path. | Anyone assuming this endpoint moves v1 plans into v2/v3 storage will be wrong. | `AccessSettingMigrationServiceImpl.migrateAccessSettingRules` |
| CON-003 | v4's plan table is identical to v3's (`cbplan.v4.plan.table=cb_plan_v3`); only the content-lookup table and the access-control model (`userGroupId` vs. inline criteria) actually differ. | "v4" is best understood as an API/access-model revision of v3, not a fourth physical data generation. | `application.properties:189-195` |
| CON-004 | `sunbird-cb-uiproxy` forwards all `cbplan/*` paths generically to Kong without itself choosing sunbird-cb-ext vs. cb-ext-course-service. | The actual per-version routing decision lives entirely in Kong config, outside all 9 repos traced. | `proxies_v8.ts:940-943` |
| CON-005 | No code in any traced repo confirms the content-request table (`cb_content_request`) is ever written back to by the Admin Portal's review screens. | The request's lifecycle status may remain `IN_PROGRESS` forever from the system's own point of view, regardless of real-world provider action. | Absence confirmed by grep across `sunbird-cb-adminportal` and `sunbird-cb-creationportal` for `cb_content_request`/`CB_CONTENT_REQUEST_TABLE` |
| CON-006 | The AICBP bulk-publish authentication is a human's bearer token, not a service account. | Token expiry or the approver's account being disabled stalls the entire pipeline. | `bulk_training_plan_approval.py:404-431` |
| CON-007 | The `create-assignee` component exists on disk and is routed, but its stepper tab and TS output handler are commented out. | Documentation or tooling describing a standalone "assignee" step in the current authoring flow would be describing dead code. | `stepper.component.html:35-43`; `stepper.component.ts:99,130-135` |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | Two independently-written "how much plan-derived content does this learner have" pipelines exist in `cb-ext-course-service`: an older one (`CourseAccessServiceImpl` → `CbPlanServiceV3`) and a newer one (`ContentInfoUtil` → `CbPlanServiceV4`, financial-year-scoped) — neither calls the other, and their outputs were not confirmed to always agree. | Sits underneath FR-042 (personal content counts) | `CourseAccessServiceImpl.java:1253-1318`; `ContentInfoUtil.java:462-480` |
| DEV-002 | `CourseAccessServiceImpl.buildPersonalContentInfo` (no "V2" suffix) reads from a separate, older `CbPlanLearnerServiceImpl`, but no caller of this method was found anywhere in the file — apparently dead code left alongside the method (`buildPersonalContentInfoV2`) that actually runs. | Sits underneath DEV-001 | `CourseAccessServiceImpl.java:663-707` vs. `:657` |
| DEV-003 | `getCBPlanListForUser_old` (v1, `CbPlanServiceImpl.java:461`) is a superseded duplicate of the live `getCBPlanListForUser` method, missing the newer APAR content-deduplication rule, with no callers found. | Sits underneath FR-005 (learner list) | `CbPlanServiceImpl.java:461` vs. `:1168-1349` |
| DEV-004 | `aicbp/create`/`aicbp/publish` are defined on **both** the v2 and v3 controllers with the same route shape; the bulk pipeline was confirmed to call v3, leaving the v2 pair's live usage (if any) unconfirmed. | Sits underneath FR-050/FR-051 | `CbPlanWithAccessSettings.java:39-56` vs. `CbPlanWithAccessSettingsV3.java:161-179` |
| DEV-005 | The frontend's "get providers" call reads via `http.get`, inconsistent with the sibling create/search calls on the same service being `POST`-based — a naming/method mismatch rather than a functional bug found in testing. | Sits underneath FR-030 | `traininig-plan.service.ts` `getProviders` |
| DEV-006 | The v1 keyspace name for `cb_plan`/`cb_plan_lookup` was not located as a printed constant in the traced files — inferred, not confirmed, to be the platform's standard `sunbird` keyspace. | Sits underneath FR-001/FR-005 | Absence noted during trace of `sunbird-cb-ext` `Constants.java` |

## Out of scope (not reconstructible from these 9 repos)

- The Kong API gateway's exact routing rule that dispatches a given
  `cbplan/vN/*` path to `sunbird-cb-ext` vs. `cb-ext-course-service`.
- The search-indexer Flink job that originates Comprehensive Assessment
  link-change events onto `dev.trainingplan.ca.events` — only the consumer
  side is visible here.
- The Admin Portal `request` screens' actual backing data source and
  whether it writes back to `cb_content_request` — only the UI-level
  "request" workflow and its routing target were traced.
- Any DDL/schema definitions for `cb_plan`, `cb_plan_v2`, `cb_plan_v3`, or
  their lookup tables — none exist in any of the 9 repos; all structure
  here is inferred from application code.
- The full v3/v4 plan row schema beyond the fields touched by the
  controllers, config, and consumers actually traced.
- Stages 1–5 and 7 of the AI-CBP offline pipeline (only stage 6, bulk
  approval/publish, was read in full).

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to one of
> the 9 repos listed in [index.md](index.md) at the file/function cited in
> its Source column — no requirement here is inferred without a citation.
> No original spec/ticket existed to verify these against (see Purpose and
> method); this document is reconstructed from shipped behaviour, not
> compared to an approved requirement set. Attaching the Kong gateway
> config, the DDL/schema repository, the search-indexer Flink job, and the
> Admin Portal's content-request data-access code would convert several
> open questions here (especially CON-005's write-back gap and DEV-004's
> live-usage question) from "unverified" to "confirmed."
