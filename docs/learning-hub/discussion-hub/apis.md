# Discussion Hub — APIs

All paths below are as exposed by each backend service directly. The
frontends and `sunbird-cb-uiproxy` reach them at
`/apis/proxies/v8/<suffix>` (path preserved 1:1 behind Kong) — see
[HLD](hld.md#gateway-routing) for the uiproxy mapping and whitelist
gating. "Auth" reflects only what the service code actually checks, not
what a gateway might additionally enforce; see
[As-Built Requirements](as-built-requirements.md) for the authorization
gaps this implies.

## cb-discussion-service — `/v1/discussion/**`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `create` | token | Rate-limited; caller must be an active community member |
| GET | `read/{discussionId}` | none | Redis-cached |
| POST | `update` | token | **No ownership check** |
| POST | `search` | none | ES-backed; forces `isActive=true`, `isProfane=false` |
| DELETE | `question/delete/{id}` | token | Soft delete; **no ownership check** |
| POST | `answerPosts` | token | Create Answer Post under a Question |
| POST | `question/like/{id}` / `question/dislike/{id}` | token | Rate-limited |
| POST | `report` | token | Shared by all 3 levels via a `type` field; auto-suspend at 5 reporters |
| POST | `fileUpload/{communityId}/{discussionId}` | **none** | 50MB multipart to Azure Blob; no ownership/existence check |
| POST | `updateAnswerPost` | token | No ownership check |
| GET/POST | `bookmark`/`unBookmark`/`bookmarkedDiscussions` | token | |
| POST | `communityFeed` | none | Community-scoped feed, Redis-cached |
| DELETE | `answerPost/delete/{id}` | token | No ownership check |
| POST | `answerPost/like`/`dislike/{id}` | token | |
| POST | `enrichData` | token | Batch: per-discussion boolean maps (liked/bookmarked/reported) for the caller |
| POST | `globalFeed` | token | Populates `communityId` filter from caller's memberships |
| POST | `answerPostReply/create` | token | Parent Answer Post must be active |
| GET | `answerPostReply/read/{id}` | none | |
| POST | `answerPostReply/update` | token | No ownership check |
| DELETE | `answerPostReply/delete/{id}` | token | No ownership check |
| POST | `answerPostReply/like`/`dislike/{id}` | token | Routed through the *Question*-level `upVote`/`downVote` methods, not the reply service |
| POST | `admin/removePost` | token only | **No admin/role check at all** despite the name |
| POST | `admin/activatePost` | token only | Same |
| POST | `getReportStatistics` | none | Aggregate report-reason counts for any `discussionId` |
| GET | `migrateRecentReportedTime` | none | One-off data-migration endpoint, left permanently exposed |
| GET | `/api/metrics`, `/api/metrics/enableTracking`, `/disableTracking` | none | Global JVM metrics toggle, unauthenticated |

Response envelope: `ApiResponse{id, ver, ts, params:{resmsgid,status,err,errmsg}, result:Map<String,Object>}`
— no versioned per-endpoint response DTOs. Payload validation is JSON-Schema
(`additionalProperties:false`) for all create/update bodies.

## cb-community-service — `/community/v1/**`

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `create` | token | Draft status; org-scoped name uniqueness |
| GET | `read/{communityId}` | token | Redis read-through |
| DELETE | `delete/{communityId}` | token | Soft delete |
| PUT | `update` | token | Re-sets status to `draft` |
| PUT | `join` / `unjoin` | token | Private communities: no request-to-join flow exists |
| GET | `user/communities` / `user/communities/all` | token | |
| POST | `community/listuser` | token | Paginated member list (Redis hash + Cassandra fallback) |
| POST | `search` / `mdo/search` / `topic/search` / `popular` | none | ES-backed discovery |
| POST | `category/create` / `category/update` / `read/{id}` / `delete/{id}` / `list` / `listAll` | mixed (create/update/delete: token; list/listAll: none) | `updateCategory` unconditionally reactivates a soft-deleted category |
| POST | `subcategory/list` | none | |
| POST | `report` | token | Auto-suspend at 5 reporters |
| POST | `fileUpload/{communityId}` | **none** | No auth, no ownership check |
| POST | `publish` | token | Draft → active; emails moderators |
| GET | `admin/read/{communityId}` | **none** | Named "admin", weaker auth than the plain `read` endpoint |
| POST | `user/sync` (multipart CSV) | **none** | Bulk membership sync — **writes only the ES user index, not Cassandra membership tables** |
| PUT | `admin/join` / `admin/unjoin` | token (any valid user) | Bulk join/unjoin, capped at 10 users; **no admin-role check** |

## discussion-metaupdate-service

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/v1/postcount/{userId}` | none | Redis-cached, ES-backed per-user post count |

No other REST surface — all other behavior is 4 Kafka consumers (see
[HLD](hld.md#asynchronous-counter-sync)).

## cb-comment-service — `/comment/**`

*(Workflow content comments — not part of the Discussion Hub community
flow; see [index.md](index.md#the-one-decision-that-defines-the-feature).)*

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `v1/addFirst` | none | Creates first comment + new tree |
| POST | `v1/addNew` | none | Adds a reply into an existing tree |
| PUT | `v1/update` | trusts client-supplied `userId`, no token | |
| GET | `v1/getAll` | none | No pagination, no caching (acknowledged TODO) |
| DELETE | `v1/delete/{commentId}` | token, ownership-checked | |
| POST | `v1/setStatusToResolved` | none | **Any caller can resolve any thread** |
| POST | `v1/like` | none | Trusts client-supplied `userId` entirely |
| GET | `v1/like/read` | none | Reads a Cassandra table nothing ever writes — always empty |
| POST | `search` (v1/v2/v3) | none | Paginated, Redis-cached |
| POST | `list` | none | Bulk fetch by ID |
| POST | `report` | token | |
| POST | `delete/reported` | token, **no role check** | Named for admins, callable by any authenticated user |
| GET | `v1/likedComments` | token | |

Business errors on this service are **always HTTP 200** with the real
status embedded in the response body (`RestExceptionHandling`), not
reflected in the HTTP status line.

## comment-tree-service — `/commentTree/v1/**`

*(Read-only cache facade over the same table `cb-comment-service` writes —
see [HLD](hld.md#comment-tree-duplication).)*

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `health` | none | |
| POST | `get` | none | Returns the **entire** tree as one blob — no pagination, no depth limit |

No create/update/delete endpoint exists in this service at all.
