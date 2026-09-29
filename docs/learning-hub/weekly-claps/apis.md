# Weekly Claps — APIs

Sources: `sunbird-cb-ext` (`cbrelease-4.8.41`, commit `55e79421`),
`sunbird-cb-uiproxy` (`cbrelease-4.8.41`, commit `175d24c4`),
`sunbird-cb-portal` (`cbrelease-4.8.41`, commit `31a57e9b`),
`karmayogi-mobile`/`igot_karmayogi_mobile` (`master`, commit `e0deaf59`).
Full trace: [LLD](lld.md#component-detail).

There is one backend endpoint pair. Every client reaches it through a
different literal path, and the translation between those paths and the
backend's own route happens entirely inside the Kong API gateway — config
that lives in none of the six repos this documentation set covers. That
gap is the single biggest "honest gap" in this feature; see the
Verification boundary below.

## Backend (`sunbird-cb-ext`) — the only place claps data is actually assembled

`InsightsController` exposes two claps-bearing routes (plus several
unrelated "insights" routes on the same controller — national/state
learning-week dashboards, org-level nudges, course recommendations — not
part of this feature):

| Method | Path | Week-range mode | Purpose |
|---|---|---|---|
| POST | `/user/v2/insights` | `W4` | The mode every traced client actually consumes |
| POST | `/chatbot/v2/insights` | `W12` | A 12-week history mode; no client in this documentation set's repos calls it — presumably consumed by a chatbot service outside this set |

Both require header `x-authenticated-userid` (no further authorization
check in this repo — the header is trusted, the same convention used by
~10 other controllers in this codebase) and read the body only for
`request.filters.organisations` (used solely by the separate, same-response
"nudges" section — claps are not filtered by it).

### Verified response shape

```jsonc
// result.response, from InsightsController.java + InsightsServiceImpl.java:105-118
{
  "weekly-claps": {
    "userId": "<uuid>",
    "total_claps": 7,
    "w1": { /* parsed JSON, per-week breakdown */ },
    "w2": { /* ... */ },
    "w3": { /* ... */ },
    "w4": { /* ... */ },
    "startDate": "<derived fresh each call, not cached>",
    "endDate": "<derived fresh each call, not cached>"
  },
  "nudges": [ { "progress": "...", "growth": "...", "type": "..." } ]
}
```

- If no `learner_stats` row exists for the user, `weekly-claps` is an
  **empty object** — not an error, not omitted — and that empty result is
  still cached for the full 24-hour TTL
  (`InsightsServiceImpl.java:142-164`).
- The `w1`/`w2`/... values are stored as JSON-encoded strings in Postgres
  and parsed on the way out (`parseWeekField`,
  `InsightsServiceImpl.java:612-621`) — malformed stored JSON falls back to
  the raw string rather than failing the request.
- Caching: Redis key `user_insights_<userId>` (W4 mode) or
  `chatbot_user_insights_<userId>` (W12 mode), TTL 86400s, a dedicated
  "UserInsights" Redis instance separate from the platform's shared cache
  (`InsightsServiceImpl.java:107`, `application.properties:669-673`). A
  cache hit skips Postgres entirely; a Redis failure on read or write is
  swallowed and falls back to (or simply doesn't block) the Postgres path.

## Gateway proxy (`sunbird-cb-uiproxy`)

| Method | Path | Role gate | Forwards to |
|---|---|---|---|
| any | `/proxies/v8/read/user/insights` | `PUBLIC`, `VOLUNTEER` | `${KONG_API_BASE}/insights` (generic passthrough, `ignorePath: true` — the incoming path/query is discarded, only the fixed target is used) |

`proxyCreatorSunbirdSearch` is a fully generic passthrough — there is no
bespoke request/response handling for this route (unlike, say, the
Ford-Gamification `leaderboard.ts`, which is unrelated to this feature).
This repo never inspects the body, so it cannot confirm the payload
actually contains claps data — only the path segment (`user/insights`,
distinct from `microsite/read/insights`, `national|state/learning/week/insights`,
and `volunteer/user/v2/insights`, all unrelated) supports that inference.

## Web client (`sunbird-cb-portal`)

All three UI implementations (see [HLD](hld.md)) call the same endpoint
with the same payload shape, duplicated across four call sites
(`continue-learning.component.ts`, `in-sight-side-bar.component.ts`,
`custom-home.component.ts`, `profile-view.component.ts`,
`profile-view-v2.component.ts`):

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/apis/proxies/v8/read/user/insights` | Fetch claps + nudges for the current user |

```jsonc
// POST /apis/proxies/v8/read/user/insights
{ "request": {
    "filters": {
      "primaryCategory": "programs",
      "organisations": ["across", "<rootOrgId>"]
    }
} }
// reads res.result.response, then aliases
// insightsData['weekly-claps'] -> insightsData['weeklyClaps']
```

If the endpoint is disabled server-side (`DomainConfService.getApiUrl`
resolves falsy), the **app-local** service returns a bare `Observable()`
that never emits or completes; the **library** copy of the same service
returns `EMPTY` instead. See the Operations Manual for the loading-spinner
consequence of that divergence.

## Mobile client (`karmayogi-mobile`)

Two implementations, two slightly different request bodies, same literal
path:

| Method | Endpoint | Caller |
|---|---|---|
| POST | `/api/insights` | Legacy (`ProfileService.getUserInsights`) — Home screen, Your Activities |
| POST | `/api/insights` | Achievement Hub (`AchievementHubService.fetchInsights`) — mobile Achievement Hub only |

```jsonc
// Legacy path — profile_service.dart:331
{ "request": { "filters": {
    "primaryCategory": "programs",
    "organisations": ["across", "<rootOrgId>"]
} } }

// Achievement Hub path — achievement_hub_config.dart:112-120
// NOTE: organisations is hardcoded to ["across"] only — rootOrgId is
// NOT injected here, despite an adjacent code comment claiming it is.
{ "request": { "filters": {
    "primaryCategory": "programs",
    "organisations": ["across"]
} } }
```

Response deserialization (Achievement Hub path only — the legacy path
reads the same JSON untyped):

```
WeeklyClap { startDate, endDate, w1..w4: WeekEntry, totalClaps (json: total_claps) }
WeekEntry  { timespent, isEarned = timespent >= 60 }
```

The 60-minute threshold (`CLAP_DURATION`) matches the meaning implied by
the backend's `w1`..`w4` per-week breakdown, but the backend's own
definition of what counts toward that time was not verifiable from
`sunbird-cb-ext`'s source (see Verification boundary).

## Confirmed uninvolved

`knowledge-platform-jobs` and `sunbird-telemetry-service` were checked
thoroughly (full-repo case-insensitive search for clap/claps/insights/
learner-stats terms, plus manual review of the most plausible modules —
karma-points and activity-aggregation jobs in the former, the generic
telemetry dispatcher in the latter) and contain **no** Weekly Claps-specific
code. In particular, nothing in `knowledge-platform-jobs` writes to a
`learner_stats` table or computes a weekly clap count — the write side of
this feature is not in any of the six repos analyzed.

---

> **Verification boundary:** endpoints and payloads above are read from
> `sunbird-cb-ext`, `sunbird-cb-uiproxy`, `sunbird-cb-portal`, and
> `karmayogi-mobile` at the commits listed above.
>
> - The mapping from `${KONG_API_BASE}/insights` (what `uiproxy` forwards
>   to) and the mobile app's `/api/insights` to the backend's actual
>   `/user/v2/insights` controller path is **not confirmed anywhere in
>   these six repos** — it must be Kong gateway routing/rewrite config
>   held elsewhere. This documentation treats the path-segment match
>   (`insights`) as strong-but-not-certain evidence they're the same
>   endpoint.
> - What actually populates `learner_stats.total_claps` and the `w0`–`w4`/
>   `wn1`–`wn7` columns — a job, a Kafka consumer, a manual process — was
>   searched for and not found in `sunbird-cb-ext`, `knowledge-platform-jobs`,
>   or `sunbird-telemetry-service`. It is written by something outside this
>   documentation set's repo list.
> - The exact semantics of `w0`–`w4` vs. `wn1`–`wn7` (forward vs. past
>   weeks) are inferred from naming convention only — no comment or code
>   logic in `sunbird-cb-ext` states it explicitly.
> - The internals of `@sunbird-cb/consumption`'s `WeeklyClapsCardV2Component`
>   (live on the web Profile page) and `@sunbird-cb/utils-v2`'s
>   `DomainConfService`/`EventService` are external published packages, not
>   vendored in `sunbird-cb-portal` — their behavior is inferred from how
>   the portal code calls them, not verified against their own source.
