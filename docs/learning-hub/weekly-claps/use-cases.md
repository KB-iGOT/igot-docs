# Weekly Claps — Use Cases

## Web journeys (`sunbird-cb-portal`)

### UC-1 · See claps on the Home page

A Karmayogi loads the Home page. `InSightSideBarComponent` calls the
insights endpoint only if the page's resolved config says
`homePageData.weeklyClaps.enabled` or `homePageData.profileCard.enabled` is
true (`in-sight-side-bar.component.ts:209-211`), then renders
`ws-widget-weekly-claps` directly and, separately, as a fallback inside
`ws-widget-profile-card-stats` when there's no leaderboard rank to show
(`profile-card-stats.component.html:85-87`).

- API: `POST /apis/proxies/v8/read/user/insights`

### UC-2 · See claps on the Custom Home page

On the org-specific `CustomHome/:id` route, the insight sidebar itself is
disabled, but `ws-widget-profile-card-stats` still renders — so the claps
widget can still appear here via its fallback path, unconditionally (no
`weeklyClaps.enabled` gate at this call site,
`custom-home.component.ts:130,288-306`).

### UC-3 · See claps on the Profile page

On `app/person-profile/me` (or `/:userId`), `ProfileViewV2Component` shows
`sb-uic-weekly-claps-card-v2` — a component from the external
`@sunbird-cb/consumption` package — inside the Achievement section's "My
Statistics" tab (`profile-view-v2.component.html:511-513`, default tab).

- API: `POST /apis/proxies/v8/read/user/insights`

### UC-4 · Open the explainer dialog

Tapping "Know more" (app-local card, if it were wired in) or the info icon
(the live library widget) opens a static dialog: what claps are, how to
keep one, why one might reset. No API call, no navigation.

### UC-5 · Jump to the claps section from the stats summary

Clicking the profile-card-stats summary row calls
`redirectTo('my-weekly-claps')`, which navigates to
`app/person-profile/me?tab=1#my-weekly-claps` — an in-page anchor scroll to
the same Profile page, not a new page (`profile-card-stats.component.ts:263-265`).

## Mobile journeys (`karmayogi-mobile`)

### UC-6 · See claps on the Home screen

The Home screen's "My Activity" card shows the legacy
`WeeklyclapTitleWidget`, fed by `ProfileService.getUserInsights`, gated by
`activityConfig['modules']['weeklyClaps']['enabled']` (default: enabled if
config is missing, `myactivity_card.dart:38-45`). Tapping it navigates to
the profile dashboard's "My Activity" view.

- API: `POST /api/insights`

### UC-7 · See the weekly breakdown in Your Activities

The Your Activities tab renders the same `WeeklyclapTitleWidget` (row
layout, non-navigating) plus a four-cell week strip
(`your_activities.dart:263-316`), gated by a `weeklyClaps` component entry
in the profile config (`enabled: true` at the component level, even where
the parent `myActivitiesTab` itself is configured `enabled: false` in the
sampled org configs — see the [LLD](lld.md) note on this).

### UC-8 · See claps in the Achievement Hub

Mobile-only: `MobileAchievementHubScreen`'s "My Statistics" tab renders
`WeeklyClapSection`, a typed, separately-built implementation with its own
model (`WeeklyClap`/`WeekEntry`) and its own skeleton. The tablet
Achievement Hub screen has no equivalent — this surface doesn't exist on
tablet.

- API: `POST /api/insights` (a request body distinct from UC-6/7 — see
  [APIs](apis.md))

### UC-9 · Get prompted for an app-store rating after a clap

Separately from any client-side clap count, the Home screen polls a
server-side "user feed"
(`GET /api/user/v1/feed/<userId>`) and, for any feed item categorized
`InAppReview` and not expired, shows a congratulations dialog ("Rate Now" /
"Maybe Later"). Both buttons dismiss the feed item server-side; only "Rate
Now" also opens the store listing. See [LLD](lld.md) for why this is not a
clap-threshold check at all.

## Edge cases

| Situation | Behaviour |
|---|---|
| No `learner_stats` row exists for the user | Backend caches and returns an **empty** claps object for a full 24 hours rather than a "no data" signal (`sunbird-cb-ext`, `InsightsServiceImpl.java:142-164`) |
| The remote "insights" API flag is disabled (`DomainConfService.getApiUrl` resolves falsy) | The **app's** `HomePageService.getInsightsData` returns a bare `new Observable()` that never emits or completes — every consumer's "loading" flag stays `true` forever; the **library** copy of the same method instead returns `EMPTY`, which does complete (`sunbird-cb-portal`, `home-page.service.ts:25` vs `library/.../home-page.service.ts:23`) |
| Mobile Achievement Hub's insights call resolves to `null` | `WeeklyClapSection`'s `FutureBuilder` treats a resolved `null` as `hasData: true` and force-unwraps it (`weekly_clap_section.dart:97,100`) — a latent null-check-operator crash risk, not exercised by any test |
| Profile-config's `myActivitiesTab` is disabled at the parent level | The nested `weeklyClaps` component entry is still marked `enabled: true` underneath it — the two flags disagree in the sampled configs (`profile_config.dart:376,434` and `:844,902`) |
| Mobile's Achievement Hub request body vs. legacy request body | The Achievement Hub path never injects `rootOrgId` into `organisations` despite a code comment claiming it does; the legacy profile-insights path does inject it — the two mobile call sites can legitimately return different data for the same user (`achievement_hub_config.dart:110-111` vs `profile_service.dart:331`) |
| `WeeklyClapsCardComponent` / `ContinueLearningComponent` (web) | Fully built (skeleton, popup, ARIA labels) but not referenced by any template or module import in this repo at this commit — effectively dead code |

See [LLD](lld.md) and [Operations Manual](operations-manual.md) for the
mechanics and troubleshooting behind each of these.
