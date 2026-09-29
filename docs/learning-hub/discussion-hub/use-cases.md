# Discussion Hub — Use Cases

## Learner journeys (sunbird-cb-portal + cb-community-service + cb-discussion-service)

### UC-1 · Browse / search communities

The Discussion Hub landing page (`app/discussion-forum-v2`) renders topic
cards, a search box, and a "my communities" tab — all inside the external
`@sunbird-cb/discussion-v2` widget, which this repo only hosts (route,
guard, resolved page config). No HTTP calls to community/discussion APIs
exist in the portal repo itself for this flow.

- Likely APIs (per uiproxy path convention, not directly observed in the
  widget's own — unvendored — source): `POST /apis/proxies/v8/community/v1/search`,
  `POST /apis/proxies/v8/community/v1/topic/search`, `GET /apis/proxies/v8/community/v1/category/listAll`
  — all unauthenticated at the backend (`cb-community-service`
  `CommunityController`).
- Source (host wiring only): `sunbird-cb-portal`
  `project/ws/app/src/lib/routes/discuss-v2/routes/discuss-v2-home/discuss-v2-home.component.ts`
- **Verification boundary**: the actual network calls are inside
  `@sunbird-cb/discussion-v2`, not vendored in this checkout — see
  [index.md](index.md).

### UC-2 · Join a community

- API: `PUT /community/v1/join` — `{communityId}`, token required.
- Source: `cb-community-service` `CommunityManagementServiceImpl.joinCommunity`
- Rejected for `communityAccessLevel == "private"` communities, with **no
  request-to-join/invite flow implemented anywhere** — a private community
  is simply unjoinable through the public API (`cb-community-service.md`
  §6). Writes a Cassandra `user_community` row and (asynchronously, via
  Kafka) increments the community's `countOfPeopleJoined` counter — see
  [HLD](hld.md#asynchronous-counter-sync).

### UC-3 · Post a Question inside a joined community

- API: `POST /v1/discussion/create` — validated against
  `discussionValidation.json`, rate-limited per user
  (`discussion_create`), requires the caller be an active member of
  `communityId` (checked against Cassandra `user_community`).
- Source: `cb-discussion-service` `DiscussionController.createDiscussion` →
  `DiscussionServiceImpl.createDiscussion` (`cb-discussion-service.md` §2,
  §3.2)
- Side effects on success (all synchronous, in the same request thread):
  write to Postgres, write to Elasticsearch (`Refresh.True`), write-through
  to Redis, invalidate/precompute up to 5 pages of community-feed cache and
  the global-feed cache, push 2 Kafka count-update messages, best-effort
  notification, and a Kafka message that kicks off async language +
  profanity moderation (see [HLD](hld.md#asynchronous-moderation-pipeline)).

### UC-4 · Answer a Question / reply to an Answer Post

- APIs: `POST /v1/discussion/answerPosts` (create an Answer Post under a
  Question) · `POST /v1/discussion/answerPostReply/create` (reply under an
  Answer Post)
- Source: `cb-discussion-service` `DiscussionController.answerPost` /
  `createAnswerPostReply`
- Both are rejected if the parent (Question or Answer Post) is inactive or
  suspended. Both levels are stored as the **same entity type** as a
  Question, just discriminated by a `type` field — Answer Post Replies live
  in a second table, `discussion_answer_post_reply`.

### UC-5 · Vote, bookmark, report a post at any level

- APIs: `POST /v1/discussion/{question|answerPost|answerPostReply}/like|dislike/{id}` ·
  `GET /v1/discussion/bookmark/{communityId}/{discussionId}` ·
  `POST /v1/discussion/report`
- Source: `cb-discussion-service` `DiscussionServiceImpl.vote` / `bookmarkDiscussion` / `report`
- Reporting the same content by 5 distinct users (config:
  `report.post.user.limit=5`) auto-suspends it if
  `discussion.report.hide.post=true` (the default). The two report-lookup
  Cassandra tables (`discussion_post_report_lookup_bypost`/`..._byuser`)
  are written non-atomically — a failure on the second insert leaves them
  out of sync silently (`cb-discussion-service.md` §7.4).
- **Non-obvious**: none of update/delete/like on any level check that the
  caller is the post's author — see
  [As-Built Requirements](as-built-requirements.md) FR-020/CON group.

### UC-6 · Get notified of a reply/mention

- Mechanism: `NotificationTriggerService` inside `cb-discussion-service`
  fires a synchronous, best-effort HTTP call to
  `cb-notification-wrapper-service` on tagged-post/tagged-comment/
  liked/replied and profanity-alert events.
- On the learner portal, `NotificationsService.handleDiscussionRedirection`
  (`sunbird-cb-portal` `src/app/services/notifications.service.ts:142-162`)
  is the only push→UI bridge: a `DISCUSSION`-category notification with
  sub-category `LEARN_DISCUSSION_POST_COMMENT`/`LEARN_DISCUSSION_POST_REPLY`/
  `PROFANITY_CHECK` deep-links to
  `/app/discussion-forum-v2/community/:communityId/:discussionId`.

## Admin/moderation journeys (sunbird-cb-orgportal)

### UC-7 · Create and publish a community

- Route: `/app/home/community/create`, role `mdo_leader` only.
- APIs: `POST /apis/proxies/v8/community/v1/create` (draft) →
  `POST /apis/proxies/v8/community/v1/publish` (draft → active, requires
  name/description/guidelines/topic/moderators fields per
  `communityPublishPayloadValidation.json`)
- Source: `sunbird-cb-orgportal`
  `project/ws/app/src/lib/routes/home/routes/community/components/community-creation/community-creation.component.ts`
- On publish, `cb-community-service` emails every listed moderator via
  `NotificationService` → `notification-service`.

### UC-8 · Assign a community moderator

- API: `POST /apis/proxies/v8/user/v1/search` (autocomplete, filtered to
  role `COMMUNITY_MODERATOR` client-side) then persisted as part of
  create/update.
- Source: `add-moderator.component.ts`
- **Not implemented anywhere**: banning/removing a member from a community
  (only moderator assignment exists) — see
  [As-Built Requirements](as-built-requirements.md).

### UC-9 · Review and moderate reported content

- Route: `/app/home/community/manage/:communityId`, roles `mdo_leader` or
  `community_moderator`.
- APIs: `POST /apis/proxies/v8/feedDiscussion/search` (reported/hidden
  items, called 5× per page load with different `type`/`status` filters —
  see [LLD](lld.md#n1-style-fetch-pattern-in-community-manage)) ·
  `POST /apis/proxies/v8/feedDiscussion/getReportStatistics` (report-reason
  breakdown — **hardcodes `type: "question"` for every item type**,
  including comments/replies) · `POST /apis/proxies/v8/feedDiscussion/admin/removePost` ·
  `POST /apis/proxies/v8/feedDiscussion/admin/activatePost`
- Source: `community-manage.component.ts`
- **Non-obvious**: the two "admin" endpoints require only a valid platform
  JWT on the backend — no admin/moderator role, no community-membership
  check (`cb-discussion-service.md` §6). Client-side, all five of this
  screen's error-handling callbacks are unreachable dead code (missing
  comma before the error handler in `.subscribe(success, error)`), so a
  failed hide/restore call fails silently with no snackbar
  (`sunbird-cb-orgportal.md` §5).

### UC-10 · Community engagement counters update

- Not a user-triggered use case directly — an asynchronous side effect of
  UC-2/UC-3/UC-4/UC-5. `discussion-metaupdate-service` consumes 4 Kafka
  topics (`community.user.count`, `community.discusion.post.count`
  [sic], `community.discusion.like.count`, `user.post.count`) and
  read-modify-writes the corresponding counter inside the community's
  Postgres JSON blob, then reindexes it to Elasticsearch and refreshes its
  Redis cache.
- Source: `discussion-metaupdate-service`
  `CommunityMetaUpdateConsumer`
- **Known gap**: no idempotency/dedup key and no optimistic locking on the
  read-modify-write — concurrent messages for the same community can lose
  an increment; a case-sensitivity mismatch between two of the four
  listener methods means an uppercase `"INCREMENT"` payload silently
  no-ops on one of the four topics (see
  [Operations Manual](operations-manual.md)).

## Unrelated-but-confusable: workflow content comments

### UC-11 · Comment on a course/CBP content item under review

This is **not part of the Discussion Hub flow** above — it is a separate
feature reusing a similarly-named "comment" domain, gated by
content-workflow roles (`CONTENT_CREATOR`, `CONTENT_REVIEWER`,
`SPV_PUBLISHER`, …) rather than community membership.

- APIs: `POST /comment/v1/addFirst` · `POST /comment/v1/addNew` ·
  `POST /comment/v1/setStatusToResolved`
- Source: `cb-comment-service` `CommentController`
- See [index.md](index.md#the-one-decision-that-defines-the-feature) for
  why this is documented here only to rule it out of scope, plus
  `comment-tree-service` (a read-only cache facade over the same
  `comment_tree` table `cb-comment-service` writes — no relationship to
  Discussion Hub proper was found in either repo).
