# Weekly Claps — As-Built Requirements

Requirements reconstructed from the shipped implementation across
`sunbird-cb-portal` (`cbrelease-4.8.41`, commit `31a57e9b`),
`sunbird-cb-ext` (`cbrelease-4.8.41`, commit `55e79421`),
`sunbird-cb-uiproxy` (`cbrelease-4.8.41`, commit `175d24c4`), and
`karmayogi-mobile`/`igot_karmayogi_mobile` (`master`, commit `e0deaf59`) —
what the system does today, not what was originally intended. Companion to
the [HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for Weekly Claps was available in
any of the six repos checked. This document reconstructs requirements
**from the shipped implementation** across all of them. Each requirement is
traced to the file(s)/line(s) that implement it. Requirement IDs: `FR-xxx`
(functional), `NFR-xxx` (non-functional), `CON-xxx` (constraint/assumption
baked into the build).

## Functional requirements

### Backend (`sunbird-cb-ext`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL expose `POST /user/v2/insights`, for the user identified by the `x-authenticated-userid` header, returning a `weekly-claps` object using week fields `w1`–`w4`. | `InsightsController.java:19-24`, `InsightsServiceImpl.java:105-118` |
| FR-002 | The system SHALL expose `POST /chatbot/v2/insights`, identical in mechanism but using week fields `w0`–`w4` and `wn1`–`wn7` (12 total). | `InsightsController.java:58-63` |
| FR-003 | On a cache miss, the system SHALL read `learner_stats` by `userId`; if no row exists, it SHALL return an empty claps object rather than an error. | `InsightsServiceImpl.java:140-163` |
| FR-004 | The system SHALL cache the claps response (populated or empty) in a dedicated Redis instance for 24 hours, keyed `user_insights_<userId>` (W4) or `chatbot_user_insights_<userId>` (W12), excluding `startDate`/`endDate` from the cached payload so those are always recomputed fresh. | `InsightsServiceImpl.java:107,130-168,585-609` |
| FR-005 | The system SHALL fall back to Postgres on any Redis read failure, and SHALL NOT fail the request if the subsequent Redis write fails. | `InsightsServiceImpl.java:597-610`, `RedisCacheMgr.java:399-409` |
| FR-006 | The `weekly-claps` and `nudges` objects SHALL be returned together in a single `response` map from the same call. | `InsightsServiceImpl.java:109-110` |

### Gateway (`sunbird-cb-uiproxy`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The system SHALL expose `/proxies/v8/read/user/insights` restricted to `PUBLIC` and `VOLUNTEER` roles, forwarding (passthrough, ignoring the incoming path) to `${KONG_API_BASE}/insights`. | `proxies_v8.ts:309-311`, `whitelistApis.ts:2645-2652` |

### Web (`sunbird-cb-portal`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The Home page SHALL fetch and display weekly claps only when `homePageData.weeklyClaps.enabled` or `homePageData.profileCard.enabled` is true. | `in-sight-side-bar.component.ts:209-211` |
| FR-021 | The Custom Home page SHALL fetch weekly claps unconditionally whenever the page config resolves, without a `weeklyClaps.enabled` gate. | `custom-home.component.ts:130,288-306` |
| FR-022 | The Profile page SHALL render an external `sb-uic-weekly-claps-card-v2` component (from `@sunbird-cb/consumption`) inside the Achievement section's "My Statistics" tab. | `profile-view-v2.component.html:511-513` |
| FR-023 | Every web call site SHALL alias the backend's `weekly-claps` response key to `weeklyClaps` before rendering. | `continue-learning.component.ts:168-169`, `in-sight-side-bar.component.ts:389-391`, `custom-home.component.ts:349-351`, `profile-view.component.ts:560-562`, `profile-view-v2.component.ts:2224-2226` |
| FR-024 | Clicking the profile-card-stats summary row SHALL navigate to `app/person-profile/me?tab=1#my-weekly-claps`. | `profile-card-stats.component.ts:263-265` |
| FR-025 | Each week's completion SHALL be determined by comparing that week's `timespent` value against a 60-minute threshold. | `weekly-claps-card.component.ts:32-33,61-62`, `weekly-claps.component.html:14,18` |

### Mobile (`karmayogi-mobile`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The Home screen SHALL show weekly claps via `WeeklyclapTitleWidget`, gated by `activityConfig.modules.weeklyClaps.enabled` (default enabled), and SHALL navigate to the profile dashboard's "My Activity" view on tap. | `myactivity_card.dart:38-45,240,262` |
| FR-031 | Your Activities SHALL show the same widget in a non-navigating row layout plus a four-week status strip. | `your_activities.dart:263-316,331-362` |
| FR-032 | The (mobile-only) Achievement Hub SHALL show a separately-implemented, typed `WeeklyClapSection`, gated per-org by static config. | `mobile_achievement_hub_screen.dart:290-292`, `achievement_hub_config.dart:121,281` |
| FR-033 | The Achievement Hub's request body SHALL be `{request:{filters:{primaryCategory:'programs', organisations:['across']}}}` — it SHALL NOT include `rootOrgId`, unlike the legacy path. | `achievement_hub_config.dart:112-120` |
| FR-034 | The legacy path's request body SHALL be `{request:{filters:{primaryCategory:'programs', organisations:['across', rootOrgId]}}}`. | `profile_service.dart:331` |
| FR-035 | The system SHALL show a congratulatory, app-store-review prompt driven by a server-issued feed item of category `InAppReview`, polled via `GET /api/user/v1/feed/<userId>` on Home-screen load — independent of any client-computed clap count. | `home_screen.dart:73-116`, `in_app_review_repository.dart:102-115` |
| FR-036 | Both "Rate Now" and "Maybe Later" on the review popup SHALL delete the server-side feed item; only "Rate Now" SHALL additionally open the app-store listing. | `in_app_review_on_weekly_clap.dart:143-165` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-002 | The app-local web `HomePageService.getInsightsData` SHALL return a non-completing `Observable()` (rather than an empty/completing one) when the endpoint is remotely disabled. | `src/app/services/home-page.service.ts:25` |
| NFR-003 | The library web `HomePageService.getInsightsData` SHALL return `EMPTY` (a completing, non-emitting observable) for the same disabled-endpoint case. | `library/ws-widget/collection/src/lib/_services/home-page.service.ts:23` |
| NFR-004 | The mobile Achievement Hub's insights fetch SHALL NOT specify a client-side cache TTL, unlike sibling calls in the same service class. | `achievement_hub_service.dart:16-21` vs. `:30` |
| NFR-005 | No unit or integration test SHALL exist for the backend's claps assembly logic, the web's app-local claps components, or the mobile Achievement Hub's claps model/widgets, as of this commit. | Confirmed absent across all four repos (see each repo's report) |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | `learner_stats.w1`–`w4` (and `w0`, `wn1`–`wn7`) are stored as JSON-encoded strings, parsed on read. | A malformed stored value falls back silently to the raw string rather than failing the request. | `InsightsServiceImpl.java:612-621` |
| CON-002 | No Flyway/Liquibase migration for `learner_stats` exists in `sunbird-cb-ext`. | The table's authoritative schema and rollout history are not version-controlled in any repo checked. | Confirmed absent, `sunbird-cb-ext` |
| CON-003 | Nothing in `sunbird-cb-ext`, `knowledge-platform-jobs`, or `sunbird-telemetry-service` writes to `learner_stats`. | The producer of clap data is an unidentified external system — this documentation set cannot describe how a clap is actually earned server-side. | Confirmed absent across all three repos |
| CON-004 | The Kong gateway path from `${KONG_API_BASE}/insights` (and mobile's `/api/insights`) to the backend's literal `/user/v2/insights` route is assumed, not confirmed, from path-segment naming alone. | A gateway config change could silently redirect or break every client with no commit in any of these six repos. | `sunbird-cb-uiproxy` `proxies_v8.ts:309-311`; `sunbird-cb-ext` `InsightsController.java:19` |
| CON-005 | The mobile Achievement Hub's config comment claims `rootOrgId` is auto-injected into `organisations`, but no such injection exists in the actual code path. | Any future engineer trusting the comment will misdescribe this endpoint's behavior. | `achievement_hub_config.dart:110-111` vs. `weekly_clap_section.dart:33-36` |
| CON-006 | `WeeklyClapSection`'s future is force-unwrapped (`snapshot.data!`) without checking for a resolved `null`. | A backend/network failure resolving to `null` (rather than throwing) will crash this widget. | `weekly_clap_section.dart:97,100` |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | The app-local and library `HomePageService` implementations of the identical method disagree on whether a disabled endpoint completes the observable stream. | NFR-002 vs. NFR-003 | `home-page.service.ts` (app) vs. `library/.../home-page.service.ts` |
| DEV-002 | The mobile Achievement Hub's request body omits `rootOrgId` while every other call site (legacy mobile, all web) includes it, despite a comment claiming otherwise. | FR-033 vs. FR-034, CON-005 | `achievement_hub_config.dart:110-120` vs. `profile_service.dart:331` |
| DEV-003 | `WeeklyclapTitleWidget`'s info-icon telemetry fires only in the column layout, not the row layout, despite both showing the same info dialog. | Sits underneath the mobile telemetry requirements (not separately numbered above) | `weeklyclap_title_widget.dart:42-46` (row, silent) vs. `:329-331` (column, fires) |
| DEV-004 | `ContinueLearningComponent` / `WeeklyClapsCardComponent` / `ProfileViewComponent` are fully built, translated, and ARIA-labeled, but are unreachable via any live route or template. | Sits underneath FR-020–FR-024 (the live web paths) | Confirmed via repo-wide grep, `sunbird-cb-portal` |

## Out of scope (not reconstructible from these six repos)

- The process that computes and writes `learner_stats.total_claps` / the
  weekly breakdown fields — not found in `sunbird-cb-ext`,
  `knowledge-platform-jobs`, or `sunbird-telemetry-service`.
- The Kong API Gateway's routing/rewrite rules mapping `/insights`-shaped
  client paths to the backend's actual controller path.
- The internal rendering/behavior logic of `@sunbird-cb/consumption`'s
  `WeeklyClapsCardV2Component` and `@sunbird-cb/utils-v2`'s
  `DomainConfService`/`EventService` — published packages, not vendored in
  `sunbird-cb-portal`.
- Whether a CMS-driven widget-resolver mechanism could still surface the
  web components identified as dead code (FR-020–024 note, DEV-004).

---

> **Verification boundary:** every FR/NFR/CON above is traced to one of
> the four repos named at the top of this document, at the file:line cited
> in its Source column. No original spec/ticket existed to verify these
> against — this document is reconstructed from shipped behaviour across
> six repos (two of which, `knowledge-platform-jobs` and
> `sunbird-telemetry-service`, were confirmed to have no Weekly Claps
> involvement rather than simply not being cited above). Attach the Kong
> gateway config and the `learner_stats` write-side system, if either
> surfaces, to close the two largest gaps.
