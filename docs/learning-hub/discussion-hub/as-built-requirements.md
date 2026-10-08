# Discussion Hub — As-Built Requirements

Requirements reconstructed from the shipped implementation across 9 repos
(branches/commits listed in [index.md](index.md)) — what the system does
today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for Discussion Hub was available in
any of the 9 repos. This document reconstructs requirements **from the
shipped implementation** across the domain services
(`cb-discussion-service`, `cb-community-service`), the async workers
(`discussion-metaupdate-service`), the adjacent-but-unrelated comment
system (`cb-comment-service`, `comment-tree-service`), the gateway
(`sunbird-cb-uiproxy`), and the two frontends
(`sunbird-cb-portal`, `sunbird-cb-orgportal`). `sunbird-cb-ext` was
searched and confirmed to have no active role — excluded below. Each
requirement traces to file(s)/function(s) that implement it.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Content model

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL model a Question and an Answer Post as the same content type, persisted in a single Postgres table (`discussion`) discriminated by a `type` field inside a `jsonb` blob. | `DiscussionEntity.java`; `Constants.QUESTION`/`Constants.ANSWER_POST` |
| FR-002 | The system SHALL model an Answer Post Reply as a structurally-identical entity in a **separate** table (`discussion_answer_post_reply`), not the same table as its parent. | `DiscussionAnswerPostReplyEntity.java` |
| FR-003 | The system SHALL model a Community as a separate service/datastore (`cb-community-service`, Postgres `communities`), linked from a Discussion only via a `communityId` value with no database foreign-key constraint. | `cb-discussion-service` `CommunityEntity.java` (read-only), `CommunityEngagementRepository` |
| FR-004 | The system SHALL model a Community's topic taxonomy as a self-referencing relational tree (`community_category`, `parentId`), scoped per organization via `departmentId`. | `CommunityCategory.java` |
| FR-005 | Every write to a Question/Answer Post/Answer Post Reply SHALL be synchronously indexed into Elasticsearch with a forced segment refresh (`Refresh.True`) in the same request. | `EsUtilServiceImpl.java:79,111` |

### Community membership

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The system SHALL support joining a public community via `PUT /community/v1/join`, writing a Cassandra `user_community` row. | `CommunityManagementServiceImpl.joinCommunity` |
| FR-011 | The system SHALL reject a direct join to a `private` community with no request-to-join, invite, or approval workflow of any kind. | `CommunityManagementServiceImpl.joinCommunity` line 538-542 |
| FR-012 | The system SHALL support bulk CSV-driven membership sync (`POST /community/v1/user/sync`) that writes **only** the Elasticsearch user index's `discussionCommunities` array, never the Cassandra membership tables that every other membership check reads. | `CommunityManagementServiceImpl.syncUserWithCommunity`, lines 1978-2022 |
| FR-013 | Community-engagement counters (`countOfPeopleJoined`, `countOfPostCreated`, `countOfAnswerPost`, `countOfPeopleLiked`) SHALL be updated exclusively by an asynchronous Kafka-consumer service (`discussion-metaupdate-service`), never synchronously by the service handling the triggering action. | `CommunityMetaUpdateConsumer.java` |

### Posting, voting, bookmarking, reporting

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The system SHALL require the caller be an active member of a community (Cassandra `user_community`) to create a Question in it. | `DiscussionServiceImpl.createDiscussion` |
| FR-021 | The system SHALL support voting (up/down) and bookmarking at all 3 thread levels, tracked in dedicated Cassandra lookup tables (`user_post_votes`, `user_post_bookmarks`). | `DiscussionServiceImpl.vote`/`bookmarkDiscussion` |
| FR-022 | The system SHALL support reporting content at all 3 levels via one shared endpoint (`POST /v1/discussion/report`), auto-suspending the content once a configurable number of distinct reporters (default 5) is reached, if `discussion.report.hide.post=true`. | `DiscussionServiceImpl.report` |
| FR-023 | Report inserts SHALL write to two denormalized Cassandra lookup tables (by-post and by-user) as two separate, non-transactional operations. | `DiscussionServiceImpl.report`, lines ~1195-1196 |
| FR-024 | Every create/update of a Question/Answer Post/Answer Post Reply SHALL trigger an asynchronous Kafka pipeline that performs language detection (skippable by config) and profanity screening via an external moderation service. | `LanguageDetectionConsumer`, `ProfanityConsumer` |

### Moderation

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The system SHALL provide `POST /v1/discussion/admin/removePost` and `/admin/activatePost` to suspend/reactivate content at any level. | `DiscussionController` lines 205-217; `AnswerPostReplyServiceImpl.managePost` |
| FR-031 | The Org Portal SHALL provide a Community → Manage screen (route `/app/home/community/manage/:communityId`, roles `mdo_leader`/`community_moderator`) that lists reported and hidden/suspended content and invokes FR-030's endpoints to hide/restore it. | `community-manage.component.ts` |
| FR-032 | The report-reason statistics lookup from the Manage screen SHALL always pass `type: "question"` to the backend regardless of the actual item's type (comment/reply included). | `community-manage.component.ts` `getReportedIssueList`, lines 392-396 |

### Workflow content comments (separate feature, documented for scope clarity)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The system SHALL support a generic threaded-comment feature (`cb-comment-service`) for course/CBP-content review, used by content-workflow roles (`CONTENT_CREATOR`, `CONTENT_REVIEWER`, `SPV_PUBLISHER`), unrelated to community membership. | `sunbird-cb-uiproxy` `whitelistApis.ts:4482-4570` |
| FR-041 | The comment-tree structure for FR-040 SHALL be owned and written by `cb-comment-service` itself, in-process, against a Postgres `comment_tree` table it also serves reads from. | `cb-comment-service` `CommentTreeServiceImpl` |
| FR-042 | A separate microservice, `comment-tree-service`, SHALL provide a **read-only**, Redis-fronted cache facade over the identical `comment_tree` table, using an independently-implemented copy of the same entity/key-derivation logic, with no API or Kafka connection to `cb-comment-service`. | `comment-tree-service` `CommentTreeServiceImpl`; shared table confirmed via identical connection string in both repos |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-002 | `discussion-metaupdate-service`'s Kafka listeners SHALL process messages asynchronously (`CompletableFuture.runAsync`) with the consumer's auto-commit decoupled from task completion, and with no retry or dead-letter mechanism. | `CommunityMetaUpdateConsumer.java`; `ConsumerConfiguration.java` (`ENABLE_AUTO_COMMIT_CONFIG=true`) |
| NFR-003 | Every Elasticsearch write in `cb-discussion-service` and `cb-community-service` SHALL force an immediate segment refresh (`Refresh.True`) rather than batching/deferring refresh. | `EsUtilServiceImpl.java` (both repos) |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-004 | Two contradictory Cassandra consistency-level settings coexist in every backend service's config (`sunbird_cassandra_consistency_level=ONE` vs. `cassandra.config.properties: consistencyLevel=LOCAL_QUORUM`), with only the first actually wired up. | The weaker `ONE` consistency is what's actually in effect for votes/reports/bookmarks/membership, contrary to what the second file's presence suggests. | `cb-discussion-service.md`, `cb-community-service.md`, `discussion-metaupdate-service.md` §5/§6 (independently confirmed in 3 repos) |
| CON-005 | `discussion-metaupdate-service`'s 4 counter-update Kafka listeners perform unlocked read-modify-write on a `jsonb` blob with no `@Version` column and no atomic increment. | Concurrent messages for the same community can lose an increment (classic lost-update race), worsened by 4-way listener concurrency plus per-message async fan-out. | `CommunityMetaUpdateConsumer.java` (`updateCount`/`updateJoinedUserCount`/`updateLikeCount`) |
| CON-006 | `discussion-metaupdate-service`'s `CacheService.getJedis()` returns a Jedis connection *after* it has already been closed/returned to the pool inside a try-with-resources block. | The Redis cache-read path (`getCache`/`getCacheWithoutPrefix`) is likely non-functional, silently forcing every read through Elasticsearch instead. | `CacheService.java:31-35` |
| CON-007 | `cb-community-service`'s `report()` writes the community's cache-invalidation key with the Redis key prefix applied twice, so it never actually overwrites the key `read()` looks up. | After a community is reported/suspended, `read()` can keep serving the stale pre-suspension cached copy for the cache's full TTL (effectively ~16.7 hours given the ms/seconds config bug, CON-008). | `CommunityManagementServiceImpl.java` `report()` vs. `CacheService.putCache`/`getCache` |
| CON-008 | `cb-community-service`'s `spring.redis.cacheTtl=60000` is read directly as a `TimeUnit.SECONDS` value, not milliseconds despite the property's apparent intent. | Every community/category read-through cache entry lives ~16.7 hours, not 60 seconds — cache invalidation on write is load-bearing everywhere it's used and easy to miss. | `CacheService.java:47` |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | `discussion-metaupdate-service`'s 4 counter-update listeners use inconsistent case-sensitivity: 2 do exact `.equals("increment"/"decrement")` (lowercase-only), 1 uses `.equalsIgnoreCase`; the service's own unit test feeds an uppercase `"INCREMENT"` value into a case-sensitive path. | Sits underneath FR-013/CON-005 | `CommunityMetaUpdateConsumer.java:115-119,179-183` vs. `:217-219`; own test at line 98 |
| DEV-002 | The Org Portal's Community-Manage moderation screen has 5 near-identical error-handling arrow functions after `.subscribe(...)` calls that are syntactically dead statements (missing comma before the callback) — none of the moderation action's error snackbars ever fire. | Sits underneath FR-031 | `community-manage.component.ts` lines ~111-120, 144-154, 170-178, 363-365, 386-388 |
| DEV-003 | `cb-discussion-service` and `HelperMethodService` (its own class) both contain a byte-for-byte-duplicated bug where a user's `designation` field is populated from `PROFILE_IMG` instead of the designation value — every enriched user record shows a photo URL where a designation should be. Same bug independently duplicated in `cb-comment-service`'s two equivalent classes. | Data-correctness issue underneath discussion/comment user-enrichment, present identically in 2 unrelated repos | `cb-discussion-service.md` §7.1; `cb-comment-service.md` §7.4 |
| DEV-004 | `answerPostReply/like` and `/dislike` are routed through `DiscussionService.upVote`/`downVote` (the Question-level service), not `AnswerPostReplyService`, even though every other Answer Post Reply operation (create/update/delete/read) goes through the latter. | Sits underneath FR-002 | `DiscussionController.java` lines 191-203 |
| DEV-005 | `comment-tree-service`'s controller checks for `HttpStatus.NOT_FOUND`, but its service layer never sets that status on a genuine miss (leaves `HttpStatus.OK`) — the branch is dead code, and a missing tree returns HTTP 200 with an ambiguous body. Both `cb-comment-service` and `comment-tree-service` additionally map their own custom business exception to HTTP 200 even when reachable. | Sits underneath FR-041/FR-042 | `comment-tree-service` `CommentTreeController.java:33-35`; `RestExceptionHandling.java` (both repos) |
| DEV-006 | `cb-discussion-service`'s ES mapping declares a `downVoteCount` field that is never populated anywhere — down-votes decrement the same `upVoteCount` field instead. | Sits underneath FR-021 | `discussionEsMapping.json` vs. `DiscussionServiceImpl.vote`, line 733 |
| DEV-007 | Kafka topic-name typo `discusion` (missing the second "s") is baked consistently into config keys/values across `cb-discussion-service`, `cb-community-service`, and `discussion-metaupdate-service` — functionally harmless only because all three repos agree on the misspelling. | Sits underneath FR-013 | `application.properties` in all 3 repos, e.g. `kafka.topic.community.discusion.post.count` |
| DEV-008 | `sunbird-cb-uiproxy` ships **two parallel implementations** of what should be one Discussion API surface: a legacy `discussionHub` NodeBB module (effectively unreachable) and the live `/proxies/v8/discussion*`+`feedDiscussion*`+`community*` family. A third, entirely separate legacy `social.ts` "Forum" feature is also present. | N/A — architectural cleanup candidate, noted for completeness | `sunbird-cb-uiproxy.md` §2a/§2c |
| DEV-009 | The Learner Portal (`sunbird-cb-portal`) retains an entire dead v1 NodeBB forum module (`taxonomy/` subtree, undeclared in any `@NgModule`) alongside 2 live components (`footer-section`, `in-sight-side-bar`) that still navigate to a now-commented-out route (`/app/discussion-forum`), producing a real broken-link bug for any user who clicks "Start discussion"/"All discussions" from those components. | N/A — dead code + live bug, noted for completeness | `sunbird-cb-portal.md` "Known issues" |

## Out of scope (not reconstructible from these 9 repos)

- The internal implementation of the learner-facing discussion UI itself
  (list/feed rendering, compose/create-post flow, comment/reply tree
  rendering inside a thread, community-join button behavior) — this all
  lives in the external, unvendored npm package `@sunbird-cb/discussion-v2`,
  referenced by both `sunbird-cb-portal` and `sunbird-cb-orgportal` but not
  present in either checkout.
- The exact producer(s) of the 4 Kafka topics `discussion-metaupdate-service`
  consumes — confirmed present in `cb-discussion-service`/
  `cb-community-service`'s own producer code, but the guaranteed message
  shape on the wire (vs. what the consumer assumes) was cross-checked only
  by field-name grep, not a shared schema/contract test.
- The Kong API gateway's exact path-rewrite rules between
  `sunbird-cb-uiproxy` and the 5 backend services (uiproxy forwards
  `/proxies/v8/<suffix>` to `KONG_API_BASE/<suffix>` verbatim; Kong's own
  routing config that maps that suffix to a specific backend pod/service
  is not in any of these 9 repos).
- The exact Cassandra CQL schema (column types, partition/clustering keys,
  secondary indexes) for every membership/vote/report/bookmark table
  across `cb-discussion-service` and `cb-community-service` — no DDL/
  migration file exists in either repo; all inference is from query
  patterns.
- Whether `spring.jpa.hibernate.ddl-auto=update` (present in all 5 backend
  services, several against the same shared `communities` table) is
  overridden to a safer setting in actual production deployment — not
  visible from any of these repos (presumably Helm/K8s config).
- Downstream consumers of the `dev.community.joined.user.count` and
  `dev.user.post.count` Kafka topics beyond `discussion-metaupdate-service`
  itself, if any exist.

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to one
> of the 9 repos listed in [index.md](index.md) at the file/function cited
> in its Source column — no requirement here is inferred without a
> citation. No original spec/ticket existed to verify these against (see
> Purpose and method); this document is reconstructed from shipped
> behaviour, not compared to an approved requirement set. Attaching the
> originating spec, the Kong gateway config, the Cassandra DDL, and the
> `@sunbird-cb/discussion-v2` package's own source would convert several of
> the open questions here (especially CON-005's lost-update risk and
> CON-006's Redis-cache bug) from "confirmed in isolation" to "confirmed
> end-to-end in production."
