# Explore Content — Use Cases

### UC-1 · Search from anywhere (Karmayogi)

The top-bar search and the global search page issue composite search
requests with the query string plus filters; results carry facets used to
render the filter rail.

- API: `POST composite/v5/search` (current) · legacy strips use `sunbirdigot/search`

### UC-2 · Browse by facet (Karmayogi)

Explore-menu tiles and filter chips are the same API with `filters` set
(primaryCategory, competency, provider, language…) and an empty query.

- API: `POST composite/v5/search` with `filters` + `facets`

### UC-3 · Role-aware search (Program Coordinator)

The v5 controller parses the JWT to extract user roles and org, so the same
endpoint can scope results (e.g. PC-only content); the Creation Portal's PC
console uses the dedicated BP search.

- APIs: `POST composite/v5/search` (JWT-aware) · `POST composite/v4/bp/search`

### UC-4 · Search while authoring (Author)

The Creation Portal searches drafts and published content via v4 search and
the authoring search endpoints.

- API: `POST sunbirdigot/v4/search` → `composite/v4/search`

## Edge cases

| Situation | Behaviour |
|---|---|
| `visibility: Private` in a public search request | Rejected — `ERR_ACCESS_DENIED` ("Cannot access private content through public search api"), enforced in the controller |
| Result missing seconds after publish | Expected — the index updates via the publish pipeline; eventual consistency |
| Count without results | `composite` count endpoints (`/v3/count`) serve tallies for badges/strips |
