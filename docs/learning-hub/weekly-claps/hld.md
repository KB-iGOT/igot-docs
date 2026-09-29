# Weekly Claps — HLD

Reverse-engineered across six repos: `sunbird-cb-portal` (`cbrelease-4.8.41`,
commit `31a57e9b`), `sunbird-cb-ext` (`cbrelease-4.8.41`, commit `55e79421`),
`sunbird-cb-uiproxy` (`cbrelease-4.8.41`, commit `175d24c4`),
`karmayogi-mobile`/`igot_karmayogi_mobile` (`master`, commit `e0deaf59`),
`knowledge-platform-jobs` (`cbrelease-4.8.41`, commit `dd314964`) and
`sunbird-telemetry-service` (`cbrelease-4.8.15`, commit `b682baec`) — the
last two confirmed to have no involvement (see [APIs](apis.md)).

## Topology

Weekly Claps is a read-only stats widget with no dedicated route on either
client. One backend endpoint pair (`sunbird-cb-ext`) is the only place
claps data is assembled, from a Postgres table this feature's own repo
cluster never writes to. Every client — three implementations on the web,
two on mobile — independently fetches the same shape and renders its own
copy of the same visual idea (running total + four-week strip).

```mermaid
flowchart TB
    WebUser(["Karmayogi — web"])
    MobUser(["Karmayogi — mobile"])

    subgraph Portal["sunbird-cb-portal (SPA)"]
        ISB["InSightSideBarComponent<br/>(Home page)"] --> WCW["WeeklyClapsComponent<br/>ws-widget-weekly-claps"]
        ISB --> PCS["ProfileCardStatsComponent"] --> WCW
        PV2["ProfileViewV2Component<br/>(Profile page)"] --> WCV2["WeeklyClapsCardV2Component<br/>(external, @sunbird-cb/consumption)"]
        CLC["ContinueLearningComponent<br/>(unwired — dead)"] -.-> WCC["WeeklyClapsCardComponent<br/>(unwired — dead)"]
    end

    subgraph Mobile["karmayogi-mobile (Flutter)"]
        Home["Home screen /<br/>Your Activities"] --> WCTW["WeeklyclapTitleWidget<br/>(legacy, untyped)"]
        AH["Achievement Hub<br/>(mobile only)"] --> WCS["WeeklyClapSection<br/>(typed model)"]
    end

    WebUser --> ISB
    WebUser --> PV2
    MobUser --> Home
    MobUser --> AH

    subgraph Proxy["sunbird-cb-uiproxy"]
        Route["/proxies/v8/read/user/insights<br/>role: PUBLIC, VOLUNTEER<br/>generic passthrough"]
    end

    Kong{{"Kong API Gateway<br/>path rewrite — config in none<br/>of these six repos"}}

    subgraph Backend["sunbird-cb-ext"]
        Ctrl["InsightsController<br/>POST /user/v2/insights (W4)<br/>POST /chatbot/v2/insights (W12)"]
        Redis[("UserInsights Redis<br/>user_insights_&lt;userId&gt;<br/>TTL 24h")]
        PG[("Postgres learner_stats<br/>read-only in this repo")]
        Ctrl --> Redis
        Ctrl --> PG
    end

    ExtJob(["Unidentified external process<br/>writes learner_stats —<br/>confirmed absent from sunbird-cb-ext,<br/>knowledge-platform-jobs,<br/>sunbird-telemetry-service"])

    WCW -->|"POST /apis/proxies/v8/read/user/insights"| Route
    PCS -->|"POST /apis/proxies/v8/read/user/insights"| Route
    WCV2 -.->|"same endpoint (external logic)"| Route
    WCTW -->|"POST /api/insights"| Kong
    WCS -->|"POST /api/insights"| Kong

    Route --> Kong
    Kong --> Ctrl
    ExtJob -.writes.-> PG

    style Portal fill:#eef4ff,stroke:#3b5bdb
    style Mobile fill:#eef4ff,stroke:#3b5bdb
    style Proxy fill:#f3f0ff,stroke:#7048e8
    style Backend fill:#fff4e6,stroke:#e8590c
    style Kong fill:#ffe3e3,stroke:#c92a2a
    style ExtJob fill:#ffe3e3,stroke:#c92a2a
```

The two red boxes are the feature's real gaps: the Kong path rewrite and
the write side of `learner_stats` are both invisible from every repo this
documentation set covers.

## Responsibilities

| Component | Responsibility |
|---|---|
| `InsightsController` / `InsightsServiceImpl` (`sunbird-cb-ext`) | The only place a claps response is assembled — Redis-then-Postgres read, JSON parsing of stored week fields, cache write-through (even for empty results) |
| `/proxies/v8/read/user/insights` (`sunbird-cb-uiproxy`) | Role gate (`PUBLIC`/`VOLUNTEER`) plus a fixed-target passthrough to Kong — no feature-specific logic |
| `WeeklyClapsComponent` (`ws-widget-weekly-claps`, `sunbird-cb-portal` library) | The one **live**, shared web widget — used by the Home page's insight sidebar and (as a fallback) by the profile-card-stats widget |
| `WeeklyClapsCardV2Component` (external, `@sunbird-cb/consumption`) | The web Profile page's own implementation — versioned and released independently of `sunbird-cb-portal`, opaque to this repo |
| `WeeklyClapsCardComponent` / `ContinueLearningComponent` (`sunbird-cb-portal`, app-local) | A third, fully-built implementation with no live caller — dead code as of this commit |
| `WeeklyclapTitleWidget` (`karmayogi-mobile`, legacy) | Untyped, reused across the mobile Home screen and Your Activities |
| `WeeklyClapSection` (`karmayogi-mobile`, Achievement Hub) | A separately-built, typed reimplementation, mobile-only, with its own request body that (unlike the legacy path) omits `rootOrgId` |
| `InAppReviewPopupOnWeeklyClap` (`karmayogi-mobile`) | Shows a store-rating prompt driven entirely by a server-issued feed item, not by any client-computed clap count |

**Not present in any of the six repos**: the process that computes and
writes `total_claps` / the weekly breakdown fields into `learner_stats`;
the internal logic of `@sunbird-cb/consumption`'s
`WeeklyClapsCardV2Component`; and the Kong gateway config that maps
`${KONG_API_BASE}/insights` and `/api/insights` onto
`InsightsController`'s actual `/user/v2/insights` route.

## Key design decisions

- **Read-only by construction, everywhere.** Every client and the backend
  controller itself only read claps data — there is no write path anywhere
  in this documentation set's repos. The feature composes an external,
  unidentified data producer the same way Bharat Kalp composes existing
  platform services, except here the producer isn't even identifiable from
  source.
- **Three implementations on web, two on mobile, no shared component
  across platforms.** Each platform (and, on web, each of three routes)
  independently fetches the same endpoint and renders its own card. This
  keeps each surface free to diverge in layout, but it has already
  produced real divergence: different request payloads (mobile Achievement
  Hub omits `rootOrgId`; every other call site includes it), different
  error-handling behavior (the app-local vs. library `HomePageService`
  disagree on what an unemitting vs. completing Observable means for a
  perpetually-loading spinner), and one implementation (web's
  `ContinueLearningComponent`) that was built and then never wired in.
- **Aggressive, write-through caching that doesn't distinguish "no data" from
  "cached empty."** The backend caches a user's claps response for 24
  hours regardless of whether a `learner_stats` row exists — a genuinely
  new user and a user whose data hasn't loaded yet look identical to every
  client for up to a day. See the [Operations Manual](operations-manual.md).
- **Client-side, not server-side, review-prompt logic.** The mobile app's
  "rate us" popup looks tied to weekly claps, but is entirely driven by a
  generic server-side feed item (`category: InAppReview`) — the phone never
  checks a clap threshold itself. If the intent is genuinely
  clap-count-gated prompting, that gate lives entirely on a backend not
  covered here.
- **A field-name alias baked into every web call site.** All five web call
  sites independently perform the same
  `insightsData['weekly-claps'] -> insightsData['weeklyClaps']`
  translation — copy-pasted rather than centralized — because the backend
  key is hyphenated JSON and Angular templates prefer camelCase. A future
  backend rename would require updating five places identically.

See the [LLD](lld.md) for file-level detail and sequence flows, and the
[Operations Manual](operations-manual.md) for how these decisions surface
in day-2 support.

---

> **Verification boundary:** facts above are read from the six repos named
> at the top of this document, at the commits listed. Not analysed from
> source: the Kong API Gateway's routing/rewrite configuration; whatever
> process writes `learner_stats`; and the `@sunbird-cb/consumption` and
> `@sunbird-cb/utils-v2` published packages consumed by `sunbird-cb-portal`
> — their behavior is inferred only from how the portal code calls them.
