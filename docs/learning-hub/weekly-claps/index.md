# Weekly Claps

A rolling engagement counter — a "clap" is earned for a week once a
Karmayogi spends enough time on the platform in it — surfaced as a small
stats widget rather than a page of its own.

- **Route**: none of its own. It's embedded inside the Home page, the
  Profile page, and (on mobile) the Achievement Hub and Your Activities
  screens.
- **Who it's for**: every Karmayogi — there's no membership gate, unlike
  [Bharat Kalp](../bharat-kalp/index.md). Visibility is a plain
  enabled/disabled config flag per surface, not a profile attribute.
- **Status**: ⚠️ three separate front-end implementations exist on the web
  client alone (one of them dead code), two more on mobile, and the whole
  feature rests on a `learner_stats` table that none of the six repos this
  documentation set covers ever writes to — see the honest gaps below.

## In one paragraph

Every week, if a Karmayogi spends at least 60 minutes engaging with the
platform, that week earns a "clap." A small widget — on the web Home page,
the web Profile page, the mobile Home screen, mobile Your Activities, and
the mobile Achievement Hub — shows a running total and a four-week
tick/cross strip. None of that arithmetic happens in any of the repos
analyzed here: every client just asks one backend endpoint,
`GET`/`POST`-style, for "insights," and renders whatever comes back. The
endpoint itself only reads a Postgres row and a 24-hour Redis cache — it
never computes or updates a clap count either.

## How a Karmayogi experiences it

1. **Sees it without asking** — on the web Home page (inside the insight
   sidebar) and, separately, in the Profile page's "My Statistics" tab; on
   mobile, on the Home screen's "My Activity" card, in Your Activities, and
   in the Achievement Hub.
2. **Reads a running total** — "N Weeks" of claps earned overall — and a
   row of up to four week markers (check / cross / in-progress / not yet)
   for the current rolling window.
3. **Taps "Know more" / the info icon** and gets a static explainer dialog:
   what a clap is, how to keep one, why one might be lost. No navigation
   away from the page.
4. **On mobile, may be surprised by a store-review prompt** — congratulated
   on a clap and asked to rate the app. This isn't triggered by the clap
   count in the phone at all; it's a server-issued "feed" item the app
   happens to display right after a clap milestone.
5. **On the web Profile page**, tapping the stats summary can jump to
   `#my-weekly-claps` on the same page — the only case where clicking the
   widget does anything beyond opening a dialog.

## Actors

| Actor | Role |
|---|---|
| Karmayogi (any) | Sees the widget wherever it's enabled for their surface; no membership check, unlike Bharat Kalp |
| `sunbird-cb-portal` | Three UI implementations — two live (Home page, Profile page), one built but never wired into any route |
| `karmayogi-mobile` (`igot_karmayogi_mobile`) | Two UI implementations, both live but on different screens, plus a server-driven in-app-review prompt tied to the same feed category |
| `sunbird-cb-uiproxy` | Role-gated pass-through proxy (`PUBLIC`/`VOLUNTEER`) — no request/response logic of its own |
| `sunbird-cb-ext` | `InsightsController` — reads `learner_stats` (Postgres) and a 24-hour Redis cache; writes nothing |
| Kong API Gateway | Rewrites the `/insights`-shaped paths every client and proxy use into whichever path the backend controller actually exposes — this mapping lives in gateway config outside every repo checked |
| An external stats job (unidentified) | Must be what actually computes and writes `total_claps` / the weekly fields — confirmed *absent* from `sunbird-cb-ext`, `knowledge-platform-jobs`, and `sunbird-telemetry-service`, the three repos most likely to hold it |

## The one decision that defines the feature

> Whether a Karmayogi has any claps to show comes entirely from a
> `learner_stats` Postgres row that nothing in this documentation set's six
> repos ever writes — every client, web or mobile, just reads whatever an
> external process already computed, through a cache that's aggressive
> enough to serve a 24-hour-stale "zero" for a brand-new user.

That single read path is implemented three times on the web and twice on
mobile, with small, unresolved divergences between the copies — see
[LLD](lld.md) for exactly where they disagree.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for what actually shipped.
