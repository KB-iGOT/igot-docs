# Operations Manual — Discussion Hub

How to operate, support, and troubleshoot Discussion Hub as it exists
today — 5 backend services with no shared auth model, no shared
consistency-level convention, and one asynchronous counter pipeline that
can silently drop increments.

**Operational implication:** "reported content isn't hidden" or "counters
look wrong" are the two complaint classes most likely to trace back to a
known gap below, not to a new bug.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Auth | 5 services (`cb-discussion-service`, `cb-comment-service`, `cb-community-service`) each independently, manually verify a Keycloak-issued RS256 JWT — **no Spring Security, no RBAC anywhere** | "Admin" endpoint names (`admin/removePost`, `admin/activatePost`, `admin/read`) are not actually admin-gated at the service layer; role enforcement, where it exists at all, is at the `sunbird-cb-uiproxy` gateway whitelist only |
| Ownership | No update/delete/like/report endpoint on any of Question/Answer Post/Answer Post Reply checks the caller against the post's author | A "user says someone edited their post" ticket is expected behavior today, not a bug to route to engineering as a P1 |
| Counters | `discussion-metaupdate-service` consumes 4 Kafka topics with auto-commit decoupled from processing, no idempotency, no optimistic locking | Counter drift (community shows wrong joined/post/like count) is a known, structural risk — see Known Failure Modes below before opening an incident |
| Moderation | Community Manage screen's error-handling callbacks are dead code (`sunbird-cb-orgportal`) | A moderator who clicks "hide" and sees nothing happen may have hit a *silent* failure, not a missing click — check the network tab / backend logs, the UI will not show an error toast |
| Comment-tree cache | `comment-tree-service` is Redis-first with a 1-day TTL (despite a code comment claiming 14 days) over a table owned by `cb-comment-service` | A "my comment tree looks stale" report can be resolved by waiting out the TTL or bypassing the (unused) `overrideCache` flag is **not currently wired to anything** — there is no cache-bypass path today |
| Consistency levels | Every backend service ships two contradictory Cassandra consistency-level settings in two different property files (`sunbird_cassandra_consistency_level=ONE` vs. `cassandra.config.properties: consistencyLevel=LOCAL_QUORUM`) | Confirm which one is actually wired (`Constants.SUNBIRD_CASSANDRA_CONSISTENCY_LEVEL`, read via `CassandraConnectionManagerImpl`) before assuming a Cassandra read is strongly consistent |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `data.type` (`question`/`answerPost`) | Discriminator inside the single `discussion` Postgres table | The same table holds both Questions and Answer Posts — filtering by `type` is mandatory, not optional, for any direct-DB query |
| `data.status` (`active`/`reported`/`suspended`) | Lifecycle state, all 3 levels | Auto-transitions to `suspended` at `report.post.user.limit` (default 5) distinct reporters, if `discussion.report.hide.post=true` |
| `communityId` | Foreign key by convention only (no DB constraint) | Cross-checking a discussion's community requires a live read against `cb-community-service`'s `communities` table — there is no cascade/consistency guarantee if a community is deleted |
| `profanityCheckStatus` | One of `profanityCheckPassed` / `profanityCheckCallFailed` / `profanityCheckUpdateFailed` / `languageNotDetected` / `languageDetectionCallFailed` | A post stuck in a `...Failed` state has no automatic retry — it will stay that way until the moderation pipeline is re-triggered manually (no such trigger was found in any repo) |
| `countOfPeopleJoined`/`countOfPostCreated`/`countOfAnswerPost`/`countOfPeopleLiked` | Denormalized counters on the community's `data` blob | Written only by `discussion-metaupdate-service`'s async consumer — **never** by `cb-community-service` or `cb-discussion-service` directly; a discrepancy check must compare against a live count, not re-derive from these fields |
| `commentTreeId` | HMAC-signed JWT derived from `(entityType, entityId, workflow)` | Not a stored/verified auth token — purely a deterministic cache/DB key |

## Operational workflows

**Reporting → auto-suspend → moderation**: 5 distinct users report the
same content → `cb-discussion-service` (or `cb-community-service` for a
whole community) sets `status=suspended` → the content disappears from
default search results (`searchDiscussion` forces
`status in [active, reported]`, excluding `suspended`) → a moderator finds
it under the Org Portal's "Hidden" tab (Community → Manage →
`getHiddenDiscussionItems`) and can restore it (`admin/activatePost`). If a
moderator says a restore "didn't work," check the raw API response
directly — the UI's error callback for this action is unreachable code
(missing comma before the arrow function in `.subscribe(success, error)`,
`community-manage.component.ts`), so failures produce no visible feedback.

**Counter sync lag/loss**: a community's displayed join/post/like counts
come from `discussion-metaupdate-service`'s Kafka consumer, not a live
count. If counts look wrong:
1. Check whether the 4 relevant topics
   (`community.user.count`, `community.discusion.post.count` [sic],
   `community.discusion.like.count`, `user.post.count`) show consumer
   lag or recent rebalances (`kafka.max.poll.interval.ms=15000` is tight
   given per-record processing).
2. Check for a casing mismatch: `updateCount`/`updateLikeCount` compare
   `status` case-sensitively against lowercase `"increment"`/`"decrement"`;
   if a producer ever sends uppercase, those two listeners silently no-op
   with no error logged.
3. There is no reconciliation job anywhere in this feature set that
   recomputes a counter from source data — a lost increment stays lost
   until a manual data-fix.

**Rate limiting**: create/update/vote actions are Redis-counter rate
limited per user per feature (default 100/hour, 200/hour for votes). The
check-then-increment is two separate Redis round-trips (not atomic), so
a user complaint of "got rate-limited but I only made a few requests" can
genuinely happen under concurrent requests from the same session (e.g.
multiple browser tabs).

## Configuration reference

| Property | Service | Default | Notes |
|---|---|---|---|
| `report.post.user.limit` / `report.community.user.limit` | discussion / community | 5 | Distinct-reporter threshold for auto-suspend |
| `discussion.report.hide.post` | discussion | `true` | Gates whether reporting actually suspends |
| `enable.english.language.by.default` | discussion | `true` | Skips the real language-detection external call |
| `max.rate.*.by.user` (per feature) | discussion | 100 (200 for votes) | Rate-limit ceiling, Redis `INCR`+`EXPIRE` |
| `spring.redis.cacheTtl` | community | `60000` | **Read as seconds, not ms** — ~16.7 hours, not 60 seconds, despite the name |
| `redis.ttl` | comment-tree-service | `86400` | 1 day — a code comment incorrectly claims 14 days |
| `PORTAL_API_WHITELIST_CHECK` | uiproxy | `true` | Controls the *extra* role-check layer; the base allowlist 403 applies regardless of this flag |
| `kafka.offset.reset.value` / `auto.offset.reset` | metaupdate | `latest` | A fresh deployment or consumer-group reset skips messages produced while offline — no backfill |

## Known failure modes (support triage order)

1. **"My post/comment was edited/deleted by someone else"** — expected;
   no ownership check exists (see [As-Built Requirements](as-built-requirements.md)).
2. **"Hide/restore in the moderation queue doesn't seem to do anything"** —
   check the raw API call succeeded; the UI's error path is dead code.
3. **"Community counters are wrong"** — check for Kafka consumer lag,
   casing mismatches, or a crash between offset auto-commit and async
   task completion; there is no reconciliation job to fall back on.
4. **"A private community can't be joined and there's no way to request
   access"** — this is the entire implemented behavior; no
   invite/request-to-join flow exists anywhere in `cb-community-service`.
5. **"A post is permanently stuck failing moderation"** — check
   `profanityCheckStatus`; there is no automatic retry, and this analysis
   found no manual re-trigger endpoint in any of the 5 backend repos.
6. **Bulk CSV membership sync (`community/v1/user/sync`) "half worked"** —
   confirmed to write only the Elasticsearch user index, never the
   Cassandra membership tables the rest of the platform reads; treat any
   ticket referencing this endpoint as a known partial-write, not a new
   bug.
