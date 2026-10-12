# Moderated Content — As-Built Requirements

Requirements reconstructed from the shipped implementation across 13
repos (branches/commits listed in [index.md](index.md)) — what the
system does today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for moderated content was
available in any of the 13 repos. This document reconstructs
requirements **from the shipped implementation** across the authoring
client (`sunbird-cb-creationportal`), the two learner-facing clients
(`sunbird-cb-portal`, `igot_karmayogi_mobile`), the MDO-admin client
(`sunbird-cb-orgportal`), the BFF proxy (`sunbird-cb-uiproxy`), the
content/search backend (`knowledge-platform`, `sunbird-course-service`,
`cb-ext-course-service`), the independent text-moderation subsystem
(`content-moderation-service`, `cb-discussion-service`), and the
notification services (`cb-notification-service`,
`sunbird-notification-service`). Each requirement traces to file(s)/
function(s) that implement it.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Content taxonomy and authoring

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL represent moderated content as one of three `courseCategory` values (`Moderated Course`, `Moderated Program`, `Moderated Assessment`) on ordinary Sunbird `Course`-type content, not as a distinct content schema. | `sunbird-cb-creationportal widget-content.model.ts:303-318` (`ECourseCategory`) |
| FR-002 | Front-end content-type mapping SHALL render all three moderated categories as a generic `EContentTypes.COURSE`. | `sunbird-cb-portal content-type-util.ts:33-36` |
| FR-003 | The mobile client SHALL mirror the same three category string constants. | `igot_karmayogi_mobile lib/core/constants/primary_categories.dart:15-17` |
| FR-004 | The authoring UI SHALL provide an org multi-select checklist plus a "Only Verified Karmayogis"/"All MDO Users" toggle, writing to `secureSettings.organisation` and `secureSettings.isVerifiedKarmayogi` respectively. | `sunbird-cb-creationportal moderated-course.component.ts` (full file) |
| FR-005 | When authoring a Moderated Program's related-content picker, the system SHALL filter candidate content by `courseCategory in [Course, Moderated Course]` plus the same `secureSettings.*` fields. | `auth-picker.component.ts:94-98` |

### Review/approval workflow (generic, reused as-is)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The system SHALL support submitting content for review via `POST {ACTION_CONTENT_V3}review/{id}`, setting `reviewStatus='InReview'` only from `Draft`. | `editor.service.ts.sendToReview:686-698` |
| FR-011 | The system SHALL support a multilingual-content review variant via `POST {API_PROXY_V8}content/v4/mlReview`. | `editor.service.ts.sendMultilingualContentsToReview:700-710` |
| FR-012 | The system SHALL support a generic forward/backward status-change call (`POST {ACTION_BASE}content/status/change/{id}`) used for the approve step and reject-to-draft transitions. | `editor.service.ts.forwardBackward:668-684` |
| FR-013 | The system SHALL support final publish (`Review`→`Live`) via `POST {ACTION_CONTENT_V3}publish/{id}`. | `editor.service.ts.publishContent:712-722` |
| FR-014 | The system SHALL support retiring `Live` content via `POST {API_PROXY_V8}v1/content/retire`. | `apiEndpoints.ts:71` (`UNPUBLISH_CONTENT`) |
| FR-015 | A user holding the `CONTENT_REVIEWER` role SHALL see exactly three tabs (`Live`, `Under Publish`, `For Review`, default `For Review`), filtering by `status`/`reviewStatus` combinations; this queue is not filtered to moderated-content categories specifically. | `contents.component.ts.formTabs:544-585`, `:660-680` |
| FR-016 | Reject/withdraw SHALL set `{status:'Draft', reviewStatus:''}` and SHALL block withdrawal of a parent with any `Live` child resource, or any child COURSE-type element still in `Draft`. | `reject-content.service.ts.moveToDraft/statusUpdateforParent:56-121`, `getChildListData:123-161` |

### MDO-scoped visibility enforcement

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The learner-facing "Moderated contents" tab SHALL query with `courseCategory in [Moderated Course, Moderated Program, Moderated Assessment]`, `secureSettings.organisation = <learner's own rootOrgId>`, `contentType=[Course]`, `status=[Live]`. | `card-learn.component.ts.callModeratedFunc:125-177` |
| FR-021 | The tab SHALL additionally filter by `secureSettings.isVerifiedKarmayogi='No'` when the learner's `profileStatus` is not `"verified"`; verified learners SHALL NOT have this filter applied regardless of the content's own flag value. | `card-learn.component.ts:125-177` |
| FR-022 | The tab SHALL only render if the moderated-content search returns non-empty results for that learner's org. | `card-learn.component.html:42-55` |
| FR-023 | Global search SHALL expose an equivalent "moderated courses" filter chip using the same filter shape. | `search-filters.component.ts:213,264,273,319` |
| FR-024 | The org-portal training-plan module SHALL reuse the identical filter pattern for MDO-admin browse/assign flows. | `training-plan-home.component.ts` |
| FR-025 | The backend SHALL expose a personal content-info endpoint (`GET /content/v2/user/info`) returning a `moderatedContent` count and identifier list, formatted from a templated search request and caching results in Redis under `moderatedCourseCount_{userId}`. | `cb-ext-course-service ContentInfoControllerV2.java:39-44`, `ContentInfoUtil.java:236-346`, `application.properties:158` |
| FR-026 | Backend moderated-content lookups SHALL inject `secureSettings.isVerifiedKarmayogi='No'` into the search filter unless the caller's `profiledetails.profileStatus` equals `"VERIFIED"` (case-insensitive). | `ContentInfoUtil.applyVerifiedStatusFilter:275-315` |
| FR-027 | The search-engine layer (`knowledge-platform`) SHALL enforce `secureSettings.organisation` restriction as an Elasticsearch nested query (`exists` + `term` match). | `SearchProcessor.getSecureSettingsSearchQuery:681-687`, `formQueryImpl:432-494` |

### Text-profanity moderation (independent subsystem, discussion posts only)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | On creating a discussion question, answer post, or reply, the system SHALL save and index the content (`isProfane=false` default), then asynchronously trigger language detection via Kafka topic `dev.process.detect.text.language`. | `DiscussionServiceImpl.java:178-244`; `AnswerPostReplyServiceImpl.java:166` |
| FR-041 | Language detection SHALL default to English (`en`) without calling any external service when `enable.english.language.by.default=true`; otherwise it SHALL call `content-moderation-service`'s `POST /api/v1/language/detect`. | `LanguageDetectionConsumer.java:86-120` |
| FR-042 | The profanity check SHALL be routed through an internal service-registry proxy (`POST serviceregistry/v1/callExternalApi`, `SERVICE_CODE=PROFANITY_CHECK`) rather than calling `content-moderation-service` directly by URL. | `ProfanityCheckServiceImpl.java:43-76` |
| FR-043 | `content-moderation-service` SHALL classify English text using `unitary/toxic-bert` and text in 10 supported Indic languages using `Hate-speech-CNERG/indic-abusive-allInOne-MuRIL`; any other detected language SHALL fall back to the English model. | `text_profanity_service.py:58-181` |
| FR-045 | Requests to `POST /api/v1/moderation/text` SHALL validate `text` length between 2 and 3000 characters and `language` between 2 and 10 characters. | `content-moderation-service schemas/requests.py` |
| FR-046 | The moderation result SHALL be delivered back to `cb-discussion-service` asynchronously via Kafka (topic default `dev.process.check.content.profanity` on the consumer side), not via the synchronous HTTP response of the check call. | `ProfanityConsumer.java:86-116` |
| FR-047 | On a positive profanity result, the system SHALL persist `isProfane=true` and `profanityCheckStatus='profanityCheckPassed'` plus the raw response JSON on the post/reply entity, sync the flag to Elasticsearch, invalidate relevant caches, and (for replies) decrement the parent answer-post's reply counter. | `ProfanityConsumer.java:140-292` |
| FR-048 | Every discussion listing/search/feed query SHALL filter `isProfane=false`, excluding flagged content from results without deleting it. | `DiscussionServiceImpl.java:481,1635,1787/1869,2321` |
| FR-049 | On a positive profanity result, the system SHALL trigger an in-app `PROFANITY_CHECK`/`ALERT` notification to the post's author via a synchronous HTTP call to `cb-notification-wrapper-service:8081/notifications/create`. | `NotificationTriggerService.java:42-133`; `ProfanityConsumer.java:252,258,292` |
| FR-051 | `content-moderation-service` SHALL publish every check result (success or failure) to a Kafka audit topic (default `dev.content.profanity`) independent of the consumer topic used by `cb-discussion-service`. | `kafka_service.py`, `producer.py` |
| FR-052 | The system SHALL maintain a separate, human-driven report/suspend workflow for discussion posts (`REPORTED`/`SUSPENDED` states) that is not automatically linked to the automated `isProfane` flag. | `Constants.java:121-246`; confirmed absent link by grep |

### Roles

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-060 | The `CONTENT_REVIEWER` role SHALL gate the authoring review queue. | `contents.component.ts` |
| FR-061 | The `COMMUNITY_MODERATOR` role SHALL be a distinct role for discussion/forum human moderation only, unrelated to content review or the ML profanity pipeline. | — |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | MDO-restriction enforcement SHALL occur at the search-engine layer (Elasticsearch nested query), not solely as a client-side filter. | `SearchProcessor.java:432-494,670-687` |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | No dedicated moderated-content service, table, or schema exists — MDO-scoping and review state are generic content-schema properties (`secureSettings`, `status`, `reviewStatus`) shared with every other Sunbird content type. | Any change to the generic content schema or search pipeline affects moderated content implicitly, with no isolated moderated-content layer to change independently. | `knowledge-platform schemas/{content,collection,questionset}/1.0/schema.json` |
| CON-002 | `cb-ext-course-service` appears to carry two implementations of moderated-content identifier lookup — `ContentInfoUtil` and `CourseAccessServiceImpl` (the latter also owning a generic `AccessSettingRuleCacheMgr` Redis cache shared with the unrelated CB-Plan targeting feature). | Not confirmed which is authoritative in production, or whether both run; risk of drift between the two. | `ContentInfoUtil.java:275-346`; `CourseAccessServiceImpl.java:719-900,1293-1300` |
| CON-003 | `sunbird-cb-portal`'s discussion-redirection notification handler sets a `?profanity=PROFANITY_CHECK` query param that is not read anywhere in the destination `discuss-v2` module. | Whatever in-page acknowledgment authors might expect for a flagged post beyond the generic notification-center UI does not exist. | `notifications.service.ts:142-162`; zero matches for `isProfane`/`profanity` in `discuss-v2` module tree |
| CON-004 | The payload `NotificationTriggerService` sends for the `PROFANITY_CHECK` alert (`{subCategory, subType, user_ids, message}`) does not match the `{request:{...,type}}` + `X-Auth-Token` contract `cb-notification-service`'s `/notifications/create` controller expects. | The in-app profanity alert's actual runtime delivery is unconfirmed from static code — likely a functional gap, not a documentation gap. | `NotificationTriggerService.java:76-78`; `NotificationController.java:34-39` |
| CON-005 | `cb-notification-service`'s `NotificationSubCategory` enum defines `CONTENT_REVIEW_REQUEST`/`CONTENT_PUBLISHED`/`CONTENT_SPV_PUBLISHED`/`CONTENT_REJECTED`/`CONTENT_EDITED`/`COURSE_PUBLISHED`/`PROGRAM_PUBLISHED`/`RETIRE_APPROVED`/`RETIRE_REJECTED`, but no producer for any of these literal strings was found in `sunbird-cb-ext`, `sunbird-course-service`, or `cb-discussion-service`. | Course/program review-state in-app notifications should not be assumed to exist in the current build; only the separate uiproxy email mechanism is confirmed. | `NotificationSubCategory.java:12-16,92-93,111-114`; cross-repo grep, zero matches |
| CON-006 | `cb-notification-service` has fully-built Kafka consumers (`PeerValidationStatusConsumer`, `PeerEvaluationStatusConsumer`) for an approve/reject event stream, but no producer for either topic (`dev.peer.validation.status.update`, `dev.peer.evaluation.status.update`) was found in any of the 13 repos. | This notification pipeline's liveness in production cannot be confirmed from this feature's repo set; the producer is external. | `PeerValidationStatusConsumer.java`; `PeerEvaluationStatusConsumer.java:112-129`; cross-repo grep, zero matches |
| CON-007 | `cb-notification-service` supports only the `IN_APP` channel; `sunbird-notification-service` supports EMAIL/SMS(PHONE)/DEVICE(push)/FEED but has no confirmed caller for any moderation-related event. | Even if a moderation notification producer were added, only `cb-notification-service` (in-app) is confirmed reachable from the moderation code paths traced; email/SMS/push for moderation events would require new integration work. | `cb-notification-service NotificationType.java:3-5`; `sunbird-notification-service NotificationHandlerFactory.java:8-19`; confirmed callers of `sunbird-notification-service` are all non-moderation |
| CON-008 | `sunbird-cb-creationportal` and `igot_karmayogi_mobile` are private repos; their fork-vs-native classification was corroborated via git-history fingerprinting (matching root-commit author/date patterns against confirmed forks), not the GitHub fork API. | Should either repo's history be rewritten/squashed in the future, this classification would need re-verification by another method. | See [index.md](index.md) "Sourced from" notes |
| CON-009 | Kafka topic name defaults differ between `content-moderation-service`'s producer config (`dev.content.profanity`) and `cb-discussion-service`'s consumer config (`dev.process.check.content.profanity`) at these checked-out commits. | Implies the two services' topic names are aligned via environment-specific overrides not visible in either repo's default config — worth confirming per-environment rather than assuming the defaults connect. | `content-moderation-service core/config.py`; `cb-discussion-service application.properties:95` |

## Out of scope (not reconstructible from these 13 repos)

- The `cb-service-registry` service that proxies `cb-discussion-service`'s
  profanity-check calls — only the calling code's routing hint
  (`SERVICE_CODE=PROFANITY_CHECK`) is visible, not its forwarding
  implementation.
- Any producer for the `CONTENT_REVIEW_REQUEST`/`CONTENT_PUBLISHED`/
  `CONTENT_REJECTED` (and related) notification subcategories — the
  receiving-side taxonomy strongly implies such a producer should exist
  somewhere in the platform, but it is not present in any of the 13
  repos analyzed.
- Any producer for the peer-validation/evaluation approve-reject Kafka
  topics.
- The exact runtime template/text rendered by the generic
  notification-center UI for a `PROFANITY_CHECK` notification — that
  template lives on the external `cb-notification-wrapper-service` side.
- Whether the `CourseAccessServiceImpl`/`ContentInfoUtil` duplication in
  `cb-ext-course-service` represents dead legacy code, an active parallel
  path, or a planned consolidation.

---

> **Verification boundary:** every FR/NFR/CON above is traced to one of
> the 13 repos listed in [index.md](index.md) at the file/function cited
> in its Source column — no requirement here is inferred without a
> citation. No original spec/ticket existed to verify these against (see
> Purpose and method); this document is reconstructed from shipped
> behaviour, not compared to an approved requirement set. Attaching
> `cb-service-registry` and whatever external service(s) produce the
> course-approval and peer-validation notification events would convert
> the largest remaining gaps here (CON-004, CON-005, CON-006) from
> "unverified" to "confirmed."
