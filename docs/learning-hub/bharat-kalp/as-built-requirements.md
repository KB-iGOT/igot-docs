# Bharat Kalp — As-Built Requirements

Requirements reconstructed from the shipped implementation in
`sunbird-cb-portal` (`origin/cbrelease-4.8.40`, commit `b80a6327`) — what the
system does today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for Bharat Kalp was available in the
repo. This document reconstructs requirements **from the shipped
implementation** — it states what the system actually does today (as-built),
not what was originally intended. Each requirement is traced to the
file(s)/line(s) that implement it, so it can be used as:

- A baseline for QA test-case authoring against current behavior.
- An audit artifact for handover / knowledge transfer.
- A reference point to distinguish **intentional behavior** from **defects**
  going forward (defects are called out explicitly under Known deviations).

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional), `CON-xxx`
(constraint/assumption baked into the build).

## Functional requirements

### Access and visibility

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL restrict navigation to `app/learn/bharat-kalp` to users whose profile attribute `unMappedUser.profileDetails.additionalProperties.isBharatKalpMember` is the **boolean** `true`; all other users are redirected to `/page-not-found`. | `src/app/guards/bharat-kalp.guard.ts:15-27` |
| FR-003 | The system SHALL show a "Bharat Kalp" card in the home page spotlight section only for users where the membership attribute is `true` **or** the string `'true'`. | `src/app/home/home-v2/in-spotlight-v2/in-spotlight-v2.component.ts:53-59`, `home-v2-resolver.service.ts:89-104` |
| FR-004 | The system SHALL surface a Bharat Kalp notification/banner entry in the in-sight sidebar only for members (same `true`/`'true'` check). | `src/app/component/in-sight-side-bar/in-sight-side-bar.component.ts:858-889` |
| FR-005 | The Bharat Kalp spotlight card SHALL link to `app/learn/bharat-kalp` and display an icon (`/assets/icons/home-v2/bharat-kalp.png`) and a label sourced from i18n key `home.spotlightCards.bharatKalp`. | `in-spotlight-v2.component.ts:35-38` |

### Landing page

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | On loading `app/learn/bharat-kalp`, the system SHALL resolve program configuration (`sectionList`, `bkConfig`, `individualSection`) via a route resolver before rendering the page. | `kalp-routing.module.ts:7-15`, `bharat-kalp-form.service.ts:11-40` |
| FR-011 | The landing page SHALL delegate primary content rendering (hero, week-progress display) to the external `<sb-uic-bharat-kalp>` component, passing it `sectionList`, `bkConfiguration`, `individualSection`, and a community-cards template. | `bharat-kalp.component.html:1`, `bharat-kalp.component.ts:12-14` |
| FR-012 | The landing page SHALL render a horizontally scrollable list of community cards, sourced from data supplied by the external `<sb-uic-bharat-kalp>` component via template projection. | `bharat-kalp.component.html:5-30` |
| FR-013 | While community data is loading, the system SHALL display a skeleton/fetching state using `<sb-uic-horizontal-scroller-v2 [fetching]="true">`. | `bharat-kalp.component.html:8-13` |
| FR-014 | If no communities are available, the system SHALL display the message "No communities available" in place of the carousel. | `bharat-kalp.component.html:26-29` |
| FR-015 | Clicking a community card SHALL navigate the user to `/app/discussion-forum-v2/community/<communityId>`. | `bharat-kalp.component.ts:31-36` |

### Content browser ("see all")

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The system SHALL provide a dedicated content-browsing page at `app/learn/bharat-kalp/see-all` with breadcrumb navigation (Home > Bharat Kalp > "Explore all Bharat Kalp content"). | `bharat-kalp-see-all.component.html:4-10` |
| FR-021 | The page SHALL provide a free-text search box labeled "Search Anything in Bharat Kalp...". | `bharat-kalp-see-all.component.html:19` |
| FR-022 | The page SHALL provide a week selector ("All Weeks" plus one entry per configured week) driven by `individualSection.weekProgress.weeks.tabs[]`. | `bharat-kalp-see-all.component.ts:443-452` |
| FR-023 | The page SHALL derive content-type tabs (e.g. Courses/Programs/Events/Resources/External Courses) dynamically per selected week(s), showing a tab only if the week has ≥1 content id under that type. | `bharat-kalp-see-all.component.ts:167-180` |
| FR-024 | The page SHALL provide enrollment-status filter pills (All / In Progress / Completed / Not Started), hidden when the active tab is a resource tab. | `bharat-kalp-see-all.component.ts:203-206`, HTML lines 56-61 |
| FR-025 | The page SHALL fetch internal content metadata via `POST /apis/proxies/v8/sunbirdigot/search` using the content ids configured for the selected week/tab. | `bharat-kalp-see-all.component.ts:294-309` |
| FR-026 | The page SHALL fetch external (content-partner) metadata via `POST /apis/proxies/v8/cios/v1/search/content` for ids under the external-courses tab. | `bharat-kalp-see-all.component.ts:255-280` |
| FR-027 | The page SHALL fetch internal enrollment/completion status in a single batched call via `POST /apis/proxies/v8/learner/course/v4/user/enrollment/details/<userId>`. | `bharat-kalp-see-all.component.ts:100-111` |
| FR-028 | The page SHALL fetch external enrollment/completion status via one `GET /apis/proxies/v8/cios-enroll/v1/readby/useridcourseid/<id>` call per external content id. | `bharat-kalp-see-all.component.ts:75-93` |
| FR-029 | The system SHALL merge internal and external enrollment results into a single `enrollmentMap`, tolerating the two APIs' differing key casing (`completionPercentage`/`courseId` vs. `completionpercentage`/`courseid`). | `bharat-kalp-see-all.component.ts:89-92` |
| FR-030 | The page SHALL paginate results with selectable page size (10/20/50/100) and an ellipsis-compressed page-number control. | `bharat-kalp-see-all.component.ts:395-406` |
| FR-031 | Clicking a resource card SHALL navigate to the internal content player at `app/amrit-gyaan-kosh/player/...`. | `bharat-kalp-see-all.component.ts:414-431` |
| FR-032 | Clicking an external-course card SHALL navigate to `/app/toc/ext/<contentId>`. | `bharat-kalp-see-all.component.ts:334-336` |
| FR-033 | Clicking any other content card SHALL navigate to `/app/toc/<identifier>/overview`. | `bharat-kalp-see-all.component.ts:414-431` |
| FR-034 | If no content matches the current filters, the system SHALL display a "No content found." message. | `bharat-kalp-see-all.component.html:85-88` |

### Configuration resolution

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The system SHALL retrieve program configuration via `POST /apis/v1/form/read` with `{ type: pageKey, subType: 'microsite', action: 'page-configuration', component: 'portal', rootOrgId: '*' }`. | `bharat-kalp-form.service.ts:23-31`, `form-ext.service.ts:8,23-25` |
| FR-041 | The system SHALL cache the first successful configuration response in memory for the lifetime of the SPA session and reuse it on subsequent navigations between the landing and see-all pages, rather than re-fetching. | `bharat-kalp-form.service.ts:12,20-21` |
| FR-042 | If configuration retrieval fails, the system SHALL return a null-data result (`{ data: null, error }`) rather than throwing, allowing dependent components to render in a degraded/empty state. | `bharat-kalp-form.service.ts:37` |

### Layout

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-050 | The landing page (exact path `app/learn/bharat-kalp` only) SHALL render full-width on mobile viewports; the see-all page SHALL NOT. | `src/app/component/root/root.component.ts:115, 292-295` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | The feature module SHALL be lazy-loaded, so a load failure or slow chunk affects only users navigating to `app/learn/bharat-kalp`, not the app shell. | `src/app/app-routing.module.ts:299-309` |
| NFR-002 | All feature-initiated HTTP calls SHALL fail gracefully — errors are caught and mapped to an empty/null result, never surfaced as an uncaught exception or thrown error to the user. | `bharat-kalp-form.service.ts:37`; `bharat-kalp-see-all.component.ts:84,103,272,300` |
| NFR-003 | The feature SHALL load its own i18n translation loader (`ngx-translate` `TranslateHttpLoader`) independent of the app shell's root translate configuration. | `kalp.module.ts:18-20,38-44` |
| NFR-004 | The feature SHALL NOT require any environment-specific configuration flag to be enabled in any deployment environment — availability is controlled solely by the per-user profile attribute (FR-001). | Confirmed absence of "kalp" in `src/environments/environment*.ts` |
| NFR-005 | The feature SHALL render using `CUSTOM_ELEMENTS_SCHEMA` to host externally-versioned UI library components rather than reimplementing card/carousel rendering locally. | `kalp.module.ts:46` |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | `bkConfig.startDate` / `endDate` are assumed to be either `DD-MM-YYYY` formatted strings or otherwise parseable by JavaScript's native `Date` constructor. | CMS/config authors must conform to this format or week calculations silently produce wrong results. | `bharat-kalp-see-all.component.ts:132-138` |
| CON-002 | No TypeScript interfaces exist for the `bkConfig` / `weekProgress` / `sectionList` payloads — all typed as `any`. | Malformed backend config produces no compile-time or runtime validation error; it degrades silently to empty UI. | `bharat-kalp-form.service.ts:19`; `bharat-kalp.component.ts:12-14` |
| CON-003 | The external enrollment API (`cios-enroll`) is assumed to return a flat, lowercase-keyed response shape distinct from the internal enrollment API. | A future backend change to normalize these shapes would require a corresponding code change in the merge logic (FR-029) or status pills silently break for external content. | `bharat-kalp-see-all.component.ts:75-93` |
| CON-004 | The `_cache` in `BharatKalpFormService` is a single, unkeyed in-memory value (not per-user, no TTL). | Config changes require a full page reload to take effect. | `bharat-kalp-form.service.ts:12,21` |
| CON-005 | Tab label localization for the see-all page falls back to `localStorage.getItem('websiteLanguage')` rather than the app's `TranslateService`. | Language-switch behavior for this specific UI text may diverge from the rest of the app if the two mechanisms ever fall out of sync. | `bharat-kalp-see-all.component.ts:195` |

## Known deviations (inconsistent by accident, not by design)

These are behaviors present in the as-built system that appear to be
unintended inconsistencies rather than deliberate requirements. Listed here so
they are not mistaken for intended behavior when used as a QA/test baseline.

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-002 | The internal and external enrollment APIs return differently-cased response shapes (FR-029 works around this today), which is fragile to any future backend normalization. | Sits underneath FR-027/FR-028/FR-029 | `bharat-kalp-see-all.component.ts:75-93` |
| DEV-003 | No distinction exists in the UI between "no content configured for this week/filter" and "an API call failed" — both present as the same empty-state message (FR-034). | Sits underneath NFR-002 | `bharat-kalp-see-all.component.html:85-88` |

## Out of scope (not reconstructible from this repo)

- Internal rendering/behavior logic of `<sb-uic-bharat-kalp>`,
  `<sb-uic-card-portrait>`, `<sb-uic-card-portrait-ext>`,
  `<d-v2-community-card>` — implemented in `@sunbird-cb/consumption` /
  `@sunbird-cb/discussion-v2`, not in this repo.
- Backend contract/validation rules for the `bkConfig`/`weekProgress` JSON
  authored via the Form Service — this document only captures what the
  frontend assumes about that payload (see Constraints and assumptions).
- The process by which `isBharatKalpMember` is set on a user's profile
  (enrollment/eligibility workflow) — entirely backend/out-of-repo.

---

> **Verification boundary:** every FR/NFR/CON above is traced to
> `sunbird-cb-portal` (`origin/cbrelease-4.8.40`, commit `b80a6327`) at the
> file:line cited in its Source column — no requirement here is inferred
> without a citation. No original spec/ticket existed to verify these
> against (see Purpose and method); this document is reconstructed from
> shipped behaviour, not
> compared to an approved requirement set. Attach the originating spec, if
> one surfaces, to convert this from as-built to a gap analysis.
