# Training Plan — Use Cases

## Authoring journeys (Org Portal, MDO Admin / MDO Leader)

### UC-1 · Create the plan shell

Fill in a Plan Title (required, ≤70 chars, min-length + special-char
validation). This is the only field on step 1 of the 4-step stepper.

- API: `POST apis/proxies/v8/cbplan/v4/create` (also called with `v1`–`v3`
  path variants from the same service file — see [APIs](apis.md))

### UC-2 · Add content, optionally mark it APAR / gating

Search and select courses. Toggle **APAR Assignment** ("If APAR Assignment
is enabled, Karmayogis will see their assigned plans under the APAR section
on the Home page"). If APAR is on, a "gating courses" panel appears letting
the author tick which of the selected courses are **mandatory** for
unlocking a linked Comprehensive Assessment — ticking more than 25 pops a
confirmation dialog naming the count.

- API: `POST apis/proxies/v8/sunbirdigot/search` (content search, batched
  100 at a time)

### UC-3 · Request content that doesn't exist yet

From the content-search empty state, open a request form: competency
area/theme/sub-theme, a list of target provider orgs, and a free-text
description (≤1000 chars). Submitting emails every `CBP_ADMIN` in the named
provider org(s), CC'ing the requester.

- API: `POST apis/proxies/v8/cbplan/v1/admin/requestcontent`
- **Non-obvious mechanism**: this is the *only* endpoint on the v1 (legacy)
  API family that the current UI still actively calls — everything else on
  this screen goes through v3/v4.

### UC-4 · Target an audience via Reusable User Groups

Step 3 ("Access Control") is a shared `@sunbird-cb/access-settings`
component bound to a user-group context of `'training-plan'` — the author
creates or updates a Reusable User Group rather than picking users inline.
A plan cannot proceed to Timeline until at least one user group is saved.

- Cross-feature link: a draft plan can also be picked up from the
  **Reusable User Groups** module itself — `use-in-plan-dialog` lists the
  caller's org's *draft* plans (`getTrainingPlansV4`, filtered
  `status: ['draft']`) so a group can be attached to an existing plan from
  the other direction.

### UC-5 · Set the timeline and review

Pick an end date and (if APAR) a reporting year. Review read-only summaries
of selected content and the selected user group before saving.

### UC-6 · Publish, edit, or retire from the dashboard

The org-level dashboard lists plans under **Live / Drafts / Retire** tabs,
searchable, sortable, paginated (20/50/100). Edit/Delete is allowed for the
plan's creator or an MDO Leader, and only while the plan isn't retired;
Publish is only offered from the Drafts tab under the same rule.

- APIs: `POST cbplan/v2/search` · `POST cbplan/v3/search` ·
  `POST cbplan/v4/search` (dashboard calls all three version families;
  which one actually renders was not resolved per call site)
- **Edge case**: no "published"/"ongoing"/"completed"/"expired" status
  string appears anywhere in this frontend module — only `Live`, `draft`,
  and `RETIRE` are ever compared against.

## Learner journeys (public portal, `cbp` module)

### UC-7 · View assigned plans

A Karmayogi opens the `cbp` portal route and sees their plans, fetched
server-side already filtered/enriched to "plans that apply to me," bucketed
client-side into **Upcoming**, **Overdue** (by end date), **APAR**
(`isApar === true`), and **Completed** (`contentStatus === 2`), with a
per-bucket count.

- API: `fetchCbpPlanListV3` → `cbplan/v3/search` (server-enriched)

### UC-8 · Cross-reference personal progress

Each plan card is stamped with the learner's own enrolment/completion state,
read from an IndexedDB cache (cold-loaded from a dictionary fetch if empty)
rather than from the plan-list response itself.

### UC-9 · Filter and search assigned plans

Client-side filters: plan type (APAR / ordinary "CBP Plan" / AI-generated
"AICBP" — with URL-hint aliases `trainingplan`/`training`/`cbplan`/`cbp` all
resolving to the ordinary bucket), primary category, status, time duration,
competency area/theme/sub-theme, and provider. A plan-year switch re-queries
the server (the list itself is year-scoped).

### UC-10 · Get counted in "my assigned content"

A separate summary widget (personal content-info) independently counts a
learner's plan-derived content across **two parallel, non-identical
pipelines** in `cb-ext-course-service`: an older path
(`CourseAccessServiceImpl` → `CbPlanServiceV3.getCBPlanDictionaryForUser`)
and a newer one (`ContentInfoUtil.getCbPlanV4ContentIds` →
`CbPlanServiceV4.getCBPlanDictionaryForUser`, scoped to the current
financial year). Both exist in the same build; which one backs which widget
was not resolved per call site.

## Provider-org journeys (content-request loop)

### UC-11 · Receive and action a content request

A provider-org `CBP_ADMIN` receives the UC-3 email, then reviews/actions it
in the Admin Portal's `request` screens (`all-request.component.ts` and
siblings) — options include marking an item invalid or publishing a plan,
each gated behind a generic reusable confirmation dialog
(`ConfirmationPopupComponent`) whose copy is supplied by the caller, not
specific to this flow. Reviewing routes into the Creation Portal's
`author/cbp/demand-details-form`.

- **Verification boundary**: the request-review screen's own data source
  (whether it reads `cb_content_request`, the table backing UC-3, directly)
  was not traced line-by-line — flagged as inferred from route/table naming
  only.

## Bulk/AI operations (Platform Ops)

### UC-12 · Generate and bulk-publish AI-drafted plans

Outside any portal, a 7-stage offline pipeline (`cbp-ai-service`) generates
one AI-drafted "AICBP" plan per designation, sends them for MDO approval,
and — this stage traced in depth — bulk-publishes already-approved requests
by calling `cb-ext-course-service` directly:

- APIs: `POST {course-service}/cbplan/v3/aicbp/create` ·
  `POST {course-service}/cbplan/v3/aicbp/publish` (also exist, duplicated,
  on the v2 controller — which one the pipeline actually calls was
  confirmed as v3 by the traced script)
- Idempotent by design: a failed create/publish leaves the item `PENDING`
  for retry on the next run rather than partially recording success.
- Notification: an "approved" email is optionally sent per row after
  publish, via the platform's generic notification service.

## Edge cases and inconsistencies

| Situation | Behaviour |
|---|---|
| `create-assignee` step/component | Present on disk, wired in the module, but its stepper tab and output handler are commented out — dead in the live flow; targeting is done entirely through Reusable User Groups now |
| Removing the APAR flag from a Live plan | Blocked server-side — once `isApar=true` on a published plan, it cannot be unset via update |
| A `LIVE` plan with a pending edit | Not applied immediately — staged into a `draftData` blob; only takes effect on the *next* publish call |
| `getCBPlanListForUser_old` (v1 backend) | A second, superseded implementation of the same "list my plans" logic, missing the newer APAR-dedup rule — left in the codebase with no callers |
| `buildPersonalContentInfo` (no "V2" suffix, course-service) | Reads from a separate, older `CbPlanLearnerServiceImpl`; grep found no caller anywhere in the file — apparently dead code |
| Provider list API | Code path is a `GET`, despite the equivalent create/search calls on the same service being `POST` — an inconsistency, not a bug per se |
| Content-provider request table | Referenced only by a constant name (`cb_content_request`); no DDL/schema file found in any of the 9 repos |
