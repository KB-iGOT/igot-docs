# Discussion Hub

A community-scoped Q&A/forum feature: MDO leaders create **Communities**
around a topic, Karmayogis join them and post **Questions**, other members
answer with **Answer Posts**, and those answers get threaded **Answer Post
Replies**. Reporting/moderation, voting, and bookmarking sit on top of all
three levels.

- **Backend of record**: `cb-discussion-service` (Questions/AnswerPosts/
  AnswerPostReplies — all three levels live in this one service) and
  `cb-community-service` (Communities, topic taxonomy, membership).
- **Learner-facing route**: `app/discussion-forum-v2` (portal) — the actual
  list/thread/community UI is an **external, unvendored npm widget**
  (`@sunbird-cb/discussion-v2`); the portal repo is host wiring only.
- **Admin-facing route**: `app/home/community` (org portal) — community
  create/publish and reported-content moderation, gated to `mdo_leader`/
  `community_moderator`.
- **Status**: ⚠️ two independently-implemented "no role check" backend
  services, one confirmed shared-DB race, several dead/legacy code paths in
  every repo — see [As-Built Requirements](as-built-requirements.md).

## In one paragraph

A Karmayogi joins a Community (public communities: instant; private: no
join path is actually implemented), posts a Question inside it, and other
members answer with Answer Posts and nested Answer Post Replies — all three
levels stored by `cb-discussion-service` in just two Postgres tables
(discriminated by a `type` field), indexed into Elasticsearch for every
read/search, and cached through three separate Redis templates. Voting,
bookmarking, and reporting operate identically on all three levels through
one 2,300-line service class. Reports past a configurable threshold
auto-suspend the post; an MDO leader or community moderator then reviews
suspended/reported content in the Org Portal's **Community → Manage**
screen and can hide or restore it via two endpoints named `admin/removePost`
and `admin/activatePost` — names that promise a role check that does not
exist anywhere in the backend. A separate Kafka-driven worker,
`discussion-metaupdate-service`, asynchronously keeps each community's
joined-user/post/answer-post/like counters in sync — despite its name, it
never touches a Question/AnswerPost row.

## How a Karmayogi experiences it

1. **Discovers/joins** a Community via the Discussion Hub landing page,
   topic search, or a direct link; browsing/searching communities and
   reading Questions requires no authentication at all.
2. **Posts a Question** inside a community they've joined (membership is
   checked against a Cassandra `user_community` row).
3. **Others answer** with an Answer Post, and reply threads nest one level
   further as Answer Post Replies — all three are literally the same kind
   of row (`DiscussionEntity`/`DiscussionAnswerPostReplyEntity`), just typed
   differently and, for replies, stored in a second table.
4. **Votes, bookmarks, reports** any of the three levels — reporting five
   times auto-suspends the content (config: `report.post.user.limit=5`).
5. **Gets moderated**: an MDO leader/community moderator reviews reported
   and suspended content in the Org Portal's Community → Manage screen and
   hides/restores it — but the backend enforces no role or ownership check
   on any of this, and the moderation screen's own error-handling callbacks
   are dead code (see [As-Built Requirements](as-built-requirements.md)
   DEV-005), so failed hide/restore actions fail silently in the UI.
6. **Sees engagement counters update** on the community (people joined,
   posts, answer posts, likes) via an asynchronous Kafka worker running
   independently of the request that triggered the change.

## Actors

| Actor | Role |
|---|---|
| Karmayogi (learner) | Joins communities, posts Questions/Answer Posts/Replies, votes, bookmarks, reports |
| MDO Leader | Creates, edits, publishes, deletes communities; full moderation access |
| Community Moderator | Reviews/hides/restores reported content in a community they moderate (no create/publish/delete access) |
| Platform ops | Owns the shared Postgres/Cassandra/Elasticsearch/Redis/Kafka infrastructure five backend services all read and write directly |

## The one decision that defines the feature

> The platform ships **two separate, unconnected "comment thread" systems
> that share a confusable name**. "Discussion Hub" as a Karmayogi
> experiences it — communities, Questions, Answer Posts, and nested Answer
> Post Replies — is implemented **entirely** inside `cb-discussion-service`
> (all three levels, one service, two tables) plus `cb-community-service`
> (communities/topics/membership). Separately, `cb-comment-service` +
> `comment-tree-service` implement a generic, workflow-role-gated "comment"
> feature used for course/CBP-content review comments — gated in
> `sunbird-cb-uiproxy`'s whitelist by content-workflow roles
> (`CONTENT_CREATOR`, `CONTENT_REVIEWER`, `SPV_PUBLISHER`, …), not by
> community membership. No confirmed code path connects the two: the Org
> Portal's moderation screen and the Learner Portal's discussion widget
> call only `feedDiscussion/*`/`community/v1/*` endpoints; `cb-comment-service`
> itself has no reference anywhere in its source to `cb-discussion-service`,
> `cb-community-service`, or an external `comment-tree-service`. Its
> "CommentTree" logic is a same-named-but-unrelated in-process class, and
> the actual `comment-tree-service` microservice turns out to be a
> **read-only cache facade over the very same Postgres `comment_tree` table
> that `cb-comment-service` writes** — two independent implementations of
> identical entity/JWT-key logic, coupled only by a shared table,
> with no API or Kafka connection between the services
> at all.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the reconstructed
requirement set with every known deviation called out.

> **Verification boundary:** this feature set is sourced from 9 repos, each
> checked out at the last-shipped commit on its most-recently-active
> release branch at analysis time: `cb-discussion-service`
> (`cbrelease-4.8.38.2`, `73a1b45`), `cb-comment-service`
> (`cbrelease-4.8.39`, `d809df4`), `cb-community-service`
> (`cbrelease-4.8.38.1`, `cf537b0`), `discussion-metaupdate-service`
> (`cbrelease-4.8.34`, `e6d38f1`), `comment-tree-service`
> (`cbrelease-4.8.34`, `10f5c35`), `sunbird-cb-portal` (`cbrelease-4.8.40`,
> `1a46a9bba` — the branch tip itself was untagged; this is the branch's
> last release-tagged commit, `cbrelease-4.8.40_RC24`), `sunbird-cb-orgportal`
> (`cbrelease-4.8.41`, `0725ce0a`, tag `cbrelease-4.8.41_RC11`),
> `sunbird-cb-ext` (`cbrelease-4.8.41`, `f0011706`, tag `cbrelease-4.8.41_RC6`),
> `sunbird-cb-uiproxy` (`cbrelease-4.8.41`, `c620db2`, tag
> `cbrelease-4.8.41_RC6`). Two external npm packages that render the actual
> learner-facing discussion UI, `@sunbird-cb/discussion-v2` and
> `@sunbird-cb/collection`, are referenced from `sunbird-cb-portal` and
> `sunbird-cb-orgportal` but **not vendored in either checkout** — their
> internal implementation (list/feed rendering, comment/reply widgets, the
> HTTP calls they make) is out of scope for this documentation set; only
> their host-side wiring and passed-in config are covered. `sunbird-cb-ext`
> was confirmed to have **no active role** in this feature (a single,
> already-disabled NodeBB user-provisioning hook is its only trace) and is
> excluded from the request-path diagrams in the HLD/LLD accordingly.
