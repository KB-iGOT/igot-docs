# Moderated Content

Three loosely-related mechanisms sharing the word "moderation": an
MDO-restricted **content-visibility scheme** for courses/programs/
assessments (`courseCategory` values `Moderated Course`/`Moderated
Program`/`Moderated Assessment` plus a `secureSettings` org-scoping block),
a generic **content-review workflow** (Draft → Review → Live) that this
content rides on top of but doesn't own, and a completely independent
**ML-based text profanity check** on discussion posts. They do not share
code, a data model, or a notification path.

- **Access control**: not a separate content type — a `courseCategory`
  value plus a `secureSettings.organisation` / `secureSettings
  .isVerifiedKarmayogi` block on ordinary Sunbird content, enforced at
  Elasticsearch query time in `knowledge-platform`'s search actor.
- **Review/approval**: the generic Sunbird content-status machine
  (`Draft`/`Review`/`Live`/`Retired` + `reviewStatus`
  `InReview`/`Reviewed`), gated by the `CONTENT_REVIEWER` role — the same
  mechanism every other Sunbird content type uses, not something built
  specifically for moderated content.
- **Text moderation**: a standalone transformer-based (toxic-bert / MuRIL)
  microservice, called asynchronously (Kafka) from `cb-discussion-service`
  for discussion posts/replies only — unrelated code, unrelated data model,
  unrelated notification subcategory (`PROFANITY_CHECK`) from the
  course/program review workflow above.
- **Status**: ⚠️ notification coverage is uneven — the profanity-check
  alert has a fully-traced (if payload-mismatched) trigger chain; no
  trigger code for course/program "submitted for review" / "approved" /
  "rejected" notifications was found in any of the 13 repos analyzed,
  despite a receiving-side taxonomy that implies they should exist.

## Sourced from

| Repo | Branch | Commit |
|---|---|---|
| `sunbird-cb-creationportal` | `cbrelease-4.8.40` | `1e6a35c52` |
| `sunbird-cb-portal` | `cbrelease-4.8.41` | `91632c2e7` |
| `sunbird-cb-orgportal` | `cbrelease-4.8.41` | `7a057d8a` |
| `knowledge-platform` | `cbrelease-4.8.41` | `38bf7d92` (tip `ce1a624f` untagged, walked back to last tagged ancestor `cbrelease-4.8.41_RC2`) |
| `sunbird-cb-ext` | `cbrelease-4.8.41` | `55e79421` |
| `sunbird-course-service` | `cbrelease-4.8.41` | `decf2d42` |
| `cb-ext-course-service` | `cbrelease-4.8.41` | `7a0dd25` |
| `sunbird-cb-uiproxy` | `cbrelease-4.8.41` | `175d24c` |
| `content-moderation-service` | `cbrelease-4.8.28.1` | `da4c42b` |
| `cb-discussion-service` | `cbrelease-4.8.38.2` | `73a1b45` |
| `cb-notification-service` | `cbrelease-4.8.39` | `88430ce` |
| `igot_karmayogi_mobile` | `master` | `7a3219157` |
| `sunbird-notification-service` | `cbrelease-4.8.37.1` (tip `9caf9dd` untagged, walked back to `cbrelease-4.8.34_RC1`) | `4168e65` |

All 13 repos were checked out at the commits above for analysis.
`sunbird-cb-creationportal` and `igot_karmayogi_mobile` are private
repos — fork-vs-native status for each was corroborated via git history
fingerprinting (matching root-commit authors/dates against confirmed
forks) rather than the GitHub API, and is flagged as a verification
boundary wherever it matters.

## In one paragraph

"Moderated Content" is a `courseCategory` (Moderated Course / Moderated
Program / Moderated Assessment) layered on ordinary Sunbird course
content, restricted to specific MDOs via a `secureSettings.organisation`
array and optionally further restricted to `secureSettings
.isVerifiedKarmayogi` users, enforced as an Elasticsearch nested-query
filter inside `knowledge-platform`'s search actor (not just a client-side
hide). Authoring it goes through the same generic
Draft→Review→Live/`reviewStatus` InReview→Reviewed workflow every other
piece of Sunbird content uses, gated by a `CONTENT_REVIEWER` role and
surfaced as a review queue in the creation portal. A structurally
unrelated feature also called "moderation" — automatic text-profanity
screening of discussion posts and replies — runs through a separate
Python/FastAPI transformer service (`content-moderation-service`) called
asynchronously via Kafka from `cb-discussion-service`; a flagged post is
not deleted or blocked at submission time, it is silently excluded from
search/feed results (`isProfane=true` filtered out of every listing
query) while the author gets an async in-app alert. Of the notification
types the platform's `NotificationSubCategory` enum is clearly built to
support — course/program review-request, approval, rejection — only the
discussion-profanity alert (`PROFANITY_CHECK`) has a locatable, traceable
producer; the rest exist only as receiving-side taxonomy with no
confirmed caller in any of the 13 repos.

## Actors

| Actor | Role |
|---|---|
| Content creator/author | Authors a Moderated Course/Program/Assessment, sets `secureSettings` org-scoping and verified-Karmayogi toggle, submits for review |
| Content reviewer (`CONTENT_REVIEWER` role) | Sees a "For Review" queue, moves content `Draft`→`Review` (`InReview`)→`Reviewed`; same role and queue used for all Sunbird content, not moderated-content-specific |
| Content publisher (`CONTENT_PUBLISHER`/`SPV_PUBLISHER`) | Final publish step, `Review`→`Live` |
| Learner | Sees a "Moderated contents" tab/strip filtered to their own MDO (and verified status if unverified), only for `Live` content |
| Discussion post author | Subject of the independent text-profanity check; gets a `PROFANITY_CHECK` in-app alert if their post/reply is flagged |
| MDO/community moderator (`COMMUNITY_MODERATOR` role) | A **different, unrelated** role — governs discussion/forum human moderation (report/suspend), not course-content review or the ML profanity pipeline |

## The one decision that defines the feature

> "Moderated" is not a first-class content type or a dedicated service —
> it is two independent bolt-ons on existing Sunbird primitives: a
> `courseCategory` value plus a `secureSettings` field on the generic
> content schema (enforced by the generic search actor, reusing the
> generic Draft/Review/Live workflow), and, unrelated in code and data
> model, an ML text classifier wired into one specific content type
> (discussion posts) via Kafka. Nothing in the 13 repos analyzed ties
> these two "moderation" concepts together, and the notification
> taxonomy that would announce course/program approval/rejection events
> has no confirmed producer anywhere in this codebase.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md),
[LLD](lld.md) and [As-Built Requirements](as-built-requirements.md) for
the full picture, and the [Operations Manual](operations-manual.md) for
running it day to day.
