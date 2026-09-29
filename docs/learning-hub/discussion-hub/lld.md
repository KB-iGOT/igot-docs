# Discussion Hub — LLD

Reverse-engineered from code. All three storage engines per service and
every synchronous fan-out are documented as observed, not as presumably
intended.

## Discussion entity (`cb-discussion-service`)

### `DiscussionEntity` (Postgres table `discussion`)

`jsonb`-blob design, not a normalized schema — `spring.jpa.hibernate.ddl-auto=update`,
no versioned migration files.

| Column | Type | Notes |
|---|---|---|
| `discussionId` | String, `@Id` | Cassandra-style time-UUID (`Uuids.timeBased()`), not a Postgres sequence |
| `data` | `jsonb` | The entire Question/Answer Post payload — both stored in this **same table**, discriminated by `data.type` (`"question"` / `"answerPost"`) |
| `isActive` | boolean | Soft-delete flag |
| `createdOn`/`updatedOn` | Timestamp | |
| `profanityresponse` | `jsonb` | Raw moderation-service response |
| `isProfane`/`profanityCheckStatus` | boolean/String | `profanityCheckPassed` \| `profanityCheckCallFailed` \| `profanityCheckUpdateFailed` \| `languageNotDetected` \| `languageDetectionCallFailed` |

Fields inside `data` (inferred from code, no canonical DTO exists):
`discussionId, type, communityId, description, language, createdBy,
status (active/reported/suspended), upVoteCount, answerPosts[]+Count,
answerPostReplies[]+Count (answerPost only), parentDiscussionId
(answerPost only), reportedBy[], mediaCategory{document,link,image,video},
mentionedUsers[{userId,userName}]`.

### `DiscussionAnswerPostReplyEntity` (table `discussion_answer_post_reply`)

Structurally identical to `DiscussionEntity` — Answer Post Replies live in
a **separate table** even though they're conceptually the third level of
the same thread. Extra fields: `parentAnswerPostId`, `answerPostReplyId`.

### `CommunityEntity` (table `communities`, this service reads only)

`communityId`, `data` (jsonb), `createdOn`/`updatedOn`,
`created_by` (snake_case — the one non-camelCase field in the entity,
signalling it's a cross-service leftover), `isActive`. Written by
`cb-community-service`; `cb-discussion-service` only validates a
`communityId` exists/is active against this same table
(shared-database read, not an API call).

### Elasticsearch mapping (`discussionEsMapping.json`)

Authoritative field list for the `discussion_entity_alias` index. Notably
declares `downVoteCount: {type: number}` — **never populated anywhere**;
the down-vote path just decrements `upVoteCount` itself. Every write is
synchronous, `Refresh.True` on every call (`EsUtilServiceImpl.java:79,111`).

### Cassandra (keyspace `sunbird`, generic CQL DAO, no per-table repositories)

| Table | Purpose |
|---|---|
| `user_post_votes` | one row per (userId, discussionId), boolean up/down |
| `user_post_bookmarks` | soft-deleted via `status=false` |
| `discussion_post_report_lookup_bypost` / `..._byuser` | denormalized report facts, written non-atomically (2 separate inserts, second one's result unchecked) |
| `user_community` | membership gate for create; shared with `cb-community-service` |
| `user` | shared user-profile table, read-only, owned by an out-of-scope service |
| `system_settings` | config KV, used once for report-reason list |

### Redis (three `RedisTemplate` beans)

1. Simple object cache (`cb_discussion_` prefix) — discussion-by-id,
   bookmark lists, plus a **second connection** (`redisDataTemplate`) for
   cross-service `user:<id>`/`community:<id>` lookups populated by an
   unidentified upstream service.
2. Structured search-result cache — whole ES `SearchResult` pages, keyed
   either by a deterministic string for ~7 hardcoded "known feed shapes"
   or, on any drift from those shapes, by a signed JWT of the request
   (silent fallback — see [As-Built Requirements](as-built-requirements.md)).
3. Rate limiting — `INCR`+`EXPIRE`, not atomic (TOCTOU race between check
   and increment).

## Community entity (`cb-community-service`)

### `CommunityEntity` (Postgres `communities`)

`communityId` (UUID), `data` (jsonb — name, description, org, access
level, moderators[], tags, competencies, counts, status), `createdOn`/
`updatedOn`, `created_by` (snake_case), `isActive`.

### `CommunityCategory` (Postgres `community_category`, relational)

Self-referencing tree via `parentId` (0 = top-level "Topic";
>0 = sub-category), scoped per `departmentId` (= org's `rootOrgId`), with
a denormalized `countOfCommunities` counter.

### Membership (Cassandra, no entity classes — raw CQL)

`user_community` (join/unjoin state) + `community_user_lookup` (inverse
partition key, for "list members of a community" without
`ALLOW FILTERING`) + `user_reported_communities`/`communities_reportedby_user`
(report tracking).

### Dual Elasticsearch clusters

The modern `elasticsearch-java` client for `community_entity_alias` /
`community_category_entity_alias`, **plus** a legacy `RestHighLevelClient`
(ES 6.8.0, a different major version coexisting in the same POM) used only
to run a Painless script against a **separate user index** (`user_alias`),
appending/removing the community id from the user's own
`discussionCommunities` array on join/unjoin.

## Comment tree duplication (LLD detail)

Both `cb-comment-service` and `comment-tree-service` implement the
identical structure below independently:

```java
@Entity @Table(name = "comment_tree")
class CommentTree {
  @Id private String commentTreeId;      // signed HMAC256 JWT: claims {entityId, entityType, workflow}
  @Column(columnDefinition = "jsonb")
  private JsonNode commentTreeData;      // {comments:[{commentId,children:[...]}], childNodes:[], firstLevelNodes:[]}
  private String status;                 // "active" | "resolved" (unconstrained varchar)
}
```

`commentTreeId` is not a stored/verified token — it's recomputed fresh on
every request purely as a deterministic key-derivation function, signed
with the same checked-in secret (`jwt.secret.key=comment-hub`) in both
repos. The "tree" is not a relational adjacency structure at all — nesting
is expressed entirely by a `children` array key inside one JSON document
per thread, fetched as a single unbounded blob (no depth limit, no
pagination) by `comment-tree-service`'s only real endpoint,
`POST /commentTree/v1/get`.

## Synchronous write path: create a Question

```
DiscussionController.createDiscussion
  → PayloadValidation (JSON-Schema; a validation failure here throws
    BEFORE the enclosing try/catch, so it surfaces via a different
    error-response shape than every other failure in the same method)
  → AccessTokenValidator.verifyUserToken (RSA vs Keycloak JWKS, no RBAC)
  → RateLimitingServiceImpl (Redis INCR+EXPIRE, not atomic)
  → validate communityId exists+active (Postgres, cross-service read)
  → verify caller is an active community member (Cassandra user_community)
  → assign fields, generate time-UUID id
  → Postgres save
  → Elasticsearch addDocument (Refresh.True)
  → Redis write-through + invalidate: community-feed cache, "first 5
    pages" precompute (re-queries ES up to 5x), global-feed cache
    (another ES query)
  → push 2 Kafka messages (community post-count, user post-count)
  → best-effort HTTP notification (tagged users)
  → push Kafka message to kick off async language+profanity pipeline
```

A single `create` call can trigger **up to ~7 additional Elasticsearch
queries and several Redis SCANs synchronously** before the response is
returned.

## Asynchronous moderation pipeline detail

```
LanguageDetectionConsumer (topic dev.process.detect.text.language)
  ├─ enable.english.language.by.default=true (default) → skip real call
  └─ else → HTTP POST content-moderation-service/api/v1/language/detect
       → on success, calls ProfanityCheckServiceImpl SYNCHRONOUSLY inside
         the same Kafka listener thread
       → HTTP POST cb-service-registry/serviceregistry/v1/callExternalApi
       → on failure, updates profanityCheckStatus in Postgres
         (no retry, no backoff, no DLQ — permanent failure state)

ProfanityConsumer (topic dev.process.check.content.profanity, produced
externally — no producer for this topic exists in this repo)
  → updates isProfane/profanityresponse/profanityCheckStatus (native
    @Modifying query)
  → re-syncs Elasticsearch document
  → if profane: notify author, decrement parent's answerPost/-reply count
    (hides from listings without deleting)
  → runs inside CompletableFuture.runAsync on the default
    ForkJoinPool.commonPool() — no dedicated executor
```

## Counter-sync consumer detail (`discussion-metaupdate-service`)

4 `@KafkaListener` methods, each wrapping its logic in
`CompletableFuture.runAsync(...)` and returning immediately — **Kafka
auto-commit happens on the poll-loop's own cadence, independent of whether
the async task has even started**:

| Listener | Topic | Read-modify-write target |
|---|---|---|
| `upateUserCount` | `community.user.count` | `CommunityEntity.data.countOfPeopleJoined` (+ Cassandra `community_user_lookup` insert, no existence check) |
| `upatePostCount` | `community.discusion.post.count` [sic] | `countOfPostCreated` / `countOfAnswerPost` by `type` field |
| `upateLikeCount` | `community.discusion.like.count` [sic] | `countOfPeopleLiked` |
| `updateUserPostCount` | `user.post.count` | Redis-only per-user cache, no Postgres write |

Each: `find CommunityEntity by id → mutate JsonNode in memory → save()` —
no `@Version` column, no atomic `jsonb_set`, no dedup key. Concurrent
messages for the same community race a classic lost-update. A
case-sensitivity mismatch (`updateCount`/`updateLikeCount` use
case-sensitive `.equals("increment")`; `updateUserPostCount` uses
`.equalsIgnoreCase`) means an uppercase `"INCREMENT"` payload — which the
service's *own* test fixture sends — would silently no-op on the
case-sensitive paths in production if a real producer ever sends that
casing.

## N+1-style fetch pattern in community-manage

The Org Portal's moderation screen (`community-manage.component.ts`,
`ngOnInit`) fires **5 near-duplicate `POST /feedDiscussion/search` calls**
on every page load and after every hide/show action: one unfiltered
"reported+hidden" call plus 3 more filtered only by `type`
(question/answerPost/answerPostReply) that are strict subsets of the
first, plus a separate hidden-items call. None of this is derived
client-side from the first response.
