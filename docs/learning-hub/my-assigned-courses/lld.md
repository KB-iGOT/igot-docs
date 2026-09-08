# My Assigned Courses — Low-Level Design

## Resolution pipeline

1. Validate token.
2. Load the org's access-setting rules (`AccessSettingRuleCacheMgr`, Redis-backed).
3. Build a composite v4 search from the rules.
4. Merge results with the user's enrolment state.
5. Cache and return.

## Tuning (verified from source)

| Config | Default | Meaning |
|---|---|---|
| `cb.search.access.settings.enabled` | `true` | Rules-engine path on/off |
| `cb.cache.course.ttl` | 600000 ms | Course result cache TTL |
| `access.course.cache.ttl.seconds` | 600 s | Access-rule cache TTL |
| `cb.search.limit` / `offset` | 100 / 0 | Composite-search page bounds |
| `cios.search.limit` / `offset` | 100 / 0 | External-course search bounds |
| `moderated.course.search.request` | — | Template request for moderated-course resolution |

⚠️ The 100-item search limit is a real cap worth flagging to MDOs with large
catalogues.
