# Moderated Content — APIs

Verified from `sunbird-cb-creationportal › editor.service.ts` /
`apiEndpoints.ts` / `reject-content.service.ts`, `sunbird-cb-portal ›
card-learn.component.ts` / `notifications.service.ts`,
`sunbird-cb-orgportal › training-plan/**`, `knowledge-platform ›
SearchActor.java` / `SearchProcessor.java`, `cb-ext-course-service ›
ContentInfoControllerV2.java` / `ContentInfoUtil.java` /
`application.properties`, `content-moderation-service ›
profanity_controller.py` / `language_controller.py`, `cb-discussion-service
› ProfanityCheckServiceImpl.java` / `ProfanityConsumer.java` /
`application.properties`, `cb-notification-service ›
NotificationController.java`, `sunbird-notification-service › service/conf
/routes`.

## Content authoring / review workflow (generic Sunbird content APIs, reused as-is)

| Method | Route | Handler | Purpose |
|---|---|---|---|
| POST | `{ACTION_CONTENT_V3}review/{id}` | `editor.service.ts.sendToReview` | Submit content for review: `{request:{content:{reviewStatus:'InReview'}}}` |
| POST | `{API_PROXY_V8}content/v4/mlReview` | `editor.service.ts.sendMultilingualContentsToReview` | Multilingual-content review variant |
| POST | `{ACTION_BASE}content/status/change/{id}` | `editor.service.ts.forwardBackward` | Generic status transition (approve step, reject-to-draft) |
| POST | `{ACTION_CONTENT_V3}publish/{id}` | `editor.service.ts.publishContent` | Final publish, `Review`→`Live` |
| POST | `{API_PROXY_V8}v1/content/retire` | `editor.service.ts` (`UNPUBLISH_CONTENT`) | Retire/unpublish Live content |

None of these routes are specific to `courseCategory=Moderated*` — they
are the same endpoints every Sunbird content type uses for its
Draft→Review→Live lifecycle.

### Reject/withdraw (client-composed, same underlying endpoints)

```jsonc
// via editorService.updateContentForReviwer() / updateAssessmentContent()
{ "request": { "content": { "reviewStatus": "", "status": "Draft" } } }
```

- Source: `reject-content.service.ts:56-121` (`moveToDraft`, `statusUpdateforParent`)

## Moderated-content search / listing

### Authoring-side content picker (auth-picker.component.ts)

```jsonc
{
  "filters": {
    "courseCategory": ["Course", "Moderated Course"],
    "secureSettings.organisation": "<orgList>",
    "secureSettings.isVerifiedKarmayogi": "<isVerifiedUser>"
  }
}
```

- Source: `sunbird-cb-creationportal auth-picker.component.ts:94-98`

### Learner "Moderated contents" tab (card-learn.component.ts)

```jsonc
{
  "filters": {
    "courseCategory": ["Moderated Course", "Moderated Program", "Moderated Assessment"],
    "secureSettings.organisation": "<learner's rootOrgId>",
    "contentType": ["Course"],
    "status": ["Live"]
    // + "secureSettings.isVerifiedKarmayogi": "No" when profileStatus != "verified"
  }
}
```

- Source: `sunbird-cb-portal card-learn.component.ts:125-177`

### Backend moderated-content identifiers (cb-ext-course-service)

| Method | Route | Handler | Purpose |
|---|---|---|---|
| GET | `/content/v2/user/info` | `ContentInfoControllerV2.getContentInfo` → `ContentInfoServiceV2Impl.buildPersonalContentInfoV3` | Learner's personal content-info summary, includes `moderatedContent` count and `contentIds.moderatedContent` identifier list |

Backend search template (`application.properties:158`):

```json
{"request":{"filters":{"contentType":["Course"],
  "courseCategory":["Moderated Course","Moderated Program","Moderated Assessment"],
  "status":["Live"],"secureSettings.organisation":"%s"},
  "fields":["identifier"],"sort_by":{"createdOn":"desc"}}}
```

`ContentInfoUtil.getModeratedCourseIdentifiers` /
`applyVerifiedStatusFilter` (lines 275-346) formats the caller's org ID
into `%s`, then injects `secureSettings.isVerifiedKarmayogi: "No"` unless
the caller's `profiledetails.profileStatus` is `"VERIFIED"`
(case-insensitive). Results are cached in Redis under
`moderatedCourseCount_{userId}`.

- Source: `cb-ext-course-service ContentInfoUtil.java:275-346`, `Constants.java:617,625,809`
- **Verification boundary**: `CourseAccessServiceImpl.java` (lines
  719-900, 1293-1300) contains a near-duplicate implementation of this
  same logic plus a generic `AccessSettingRuleCacheMgr` Redis cache — not
  fully resolved whether this is dead/legacy duplication or an actively
  used parallel path.

### Search-engine enforcement (knowledge-platform, not client-optional)

No public REST route beyond the standard content-search endpoint — the
restriction is applied inside `SearchActor`/`SearchProcessor` regardless
of caller:

- `SearchActor.getSearchDTO` reads `x-user-channel-id` request-context
  header as the caller's org; if the caller's request has no explicit
  `secureSettings.*` filter, it auto-injects
  `secureSettingsFilter.put("secureSettings.organisation", userOrgId)`.
- `SearchProcessor.getSecureSettingsSearchQuery(org_id)` builds an
  Elasticsearch `NestedQueryBuilder` requiring
  `exists(secureSettings.organisation) AND term(secureSettings
  .organisation, org_id)`.

- Source: `search-api/search-actors/.../SearchActor.java:99-179`;
  `search-api/search-core/.../SearchProcessor.java:432-494,670-687`

## Text moderation (content-moderation-service, base path `/api/v1`)

| Method | Route | Handler | Purpose |
|---|---|---|---|
| POST | `/api/v1/moderation/text` | `profanity_controller.analyze_text_profanity` | Analyze arbitrary `text` for profanity/toxicity |
| POST | `/api/v1/language/detect` | `language_controller` | Detect language (XLM-RoBERTa, top-5 predictions) |

### Request/response (`POST /api/v1/moderation/text`)

```jsonc
// Request (ProfanityCheckRequest)
{
  "text": "...",          // 2–3000 chars, trimmed/non-empty
  "language": "en",       // ISO 639-1 hint, required, 2-10 chars
  "metadata": { "postId": "...", "type": "...", "parentDiscussionId": "..." } // optional, caller-defined
}
```

```jsonc
// Response (ProfanityCheckResponse.responseData)
{
  "isProfane": true,
  "confidence": 92.4,
  "category": "Profane",   // string values are inconsistent across chunked/non-chunked and English/Indic paths
  "detected_language": "en",
  "chunking_used": true,
  "total_chunks": 3, "profane_chunks": 1, "clean_chunks": 2,
  "aggregation_strategy": "majority",
  "chunk_statistics": {}, "chunk_details": []
}
```

On both success and failure, the endpoint fires a Kafka background
publish to `KAFKA_MODERATION_RESULTS_TOPIC` (default
`dev.content.profanity`) — a separate audit-topic publish, not the
mechanism the calling service reads for its own result (see below).

- Source: `content-moderation-service profanity_controller.py:29-74`, `schemas/requests.py`, `schemas/responses.py`, `services/kafka_service.py`

### Detection internals (for reference, not a public API)

- English: `unitary/toxic-bert`, sigmoid, toxic if any label prob ≥ 0.4,
  then an 0.8-confidence-floor flip heuristic (hardcoded, not
  configurable).
- Indic (hi/bn/ta/te/mr/gu/kn/ml/pa/ur): `Hate-speech-CNERG/indic-abusive-allInOne-MuRIL`,
  softmax/argmax, no confidence-floor adjustment.
- Any other language: falls back to the English model.
- Chunking: triggered above `MAX_TEXT_LENGTH=500` chars, 400-token chunks
  /100-token overlap/10-chunk cap; aggregation is priority-based (any
  profane chunk ⇒ whole text profane), not literal majority vote.
- No word-list/blocklist or per-tenant sensitivity config exists — all
  thresholds are hardcoded in `text_profanity_service.py`.

- Source: `content-moderation-service src/services/text_profanity_service.py:27-397`, `src/core/config.py:37-39`

## Discussion-service integration (internal, not directly caller-facing)

`cb-discussion-service` does **not** call
`content-moderation-service` directly by URL — it routes through an
internal service-registry proxy:

| Method | Route | Purpose |
|---|---|---|
| POST | `{cb.service.registry.base.url}/serviceregistry/v1/callExternalApi` | Generic external-API proxy; `SERVICE_CODE=PROFANITY_CHECK` selects the profanity-check target |
| POST | `{content.moderation.service.url}/api/v1/language/detect` | Called directly (not via registry) when `enable.english.language.by.default=false` |

Config (`cb-discussion-service application.properties`):

```properties
cb.service.registry.base.url=http://cb-service-registry:8096
cb.registry.textmoderation.api.path=serviceregistry/v1/callExternalApi
content.moderation.service.url=http://content-moderation-service:8000
content.moderation.language.detect.api.path=/api/v1/language/detect
kafka.topic.process.check.content.profanity=dev.process.check.content.profanity
kafka.topic.process.detect.language=dev.process.detect.text.language
enable.english.language.by.default=true
```

The moderation **result** is not read from the HTTP response — it comes
back asynchronously on Kafka topic
`dev.process.check.content.profanity`, consumed by `ProfanityConsumer`.

- Source: `cb-discussion-service ProfanityCheckServiceImpl.java:43-76`,
  `LanguageDetectionConsumer.java:86-120`, `application.properties:94-106`
- **Verification boundary**: `cb-service-registry` is not one of the 13
  repos analyzed, so exact forwarding behavior from the registry proxy to
  `content-moderation-service` is inferred from the `SERVICE_CODE` hint,
  not directly confirmed. The Kafka topic name mismatch between
  `content-moderation-service`'s default publish topic
  (`dev.content.profanity`) and `cb-discussion-service`'s consumed topic
  (`dev.process.check.content.profanity`) implies environment-specific
  topic alignment via env vars not present in either repo's checked-out
  defaults.

## Notifications

### cb-notification-service (in-app feed only) — base path `/v1/notifications`

| Method | Route | Purpose |
|---|---|---|
| POST | `/v1/notifications/create` | Single in-app notification; requires `X-Auth-Token` header, `{request:{type,...}}` body |
| POST | `/v1/notifications/bulk/create` | Bulk create, max 100 `user_ids` |
| GET | `/v1/notifications/list` | List, `?days&page&size&status&sub_type` |
| PATCH | `/v1/notifications/read`, `/v1/notifications/read/v2` | Mark read |
| DELETE | `/v1/notifications/delete` | Delete |
| GET | `/v1/notifications/unread/count`, `/v1/notifications/reset/unread/count` | Unread counter |
| POST | `/v1/notifications/bulk/create/peervalidation` | Peer-validation-specific bulk create |
| GET | `/v1/notifications/peervalidation/list` | Peer-validation list |
| — | Kafka topic `dev.user.notification` | Async bulk-create trigger, consumed by `Consumer.java` |

`PROFANITY_CHECK` is a defined `NotificationSubCategory`
(`NotificationSubCategory.java:98`) — the only moderation-related
subcategory with a confirmed producer (see below). `CONTENT_REVIEW_REQUEST`,
`CONTENT_PUBLISHED`, `CONTENT_REJECTED`, etc. are defined in the same enum
but have **no confirmed producer** anywhere in the 13 repos.

- Source: `cb-notification-service NotificationController.java:34-151`,
  `NotificationSubCategory.java:12-16,92-93,98,111-116`, `consumer/Consumer.java:27-47`

### Confirmed trigger: discussion profanity flag → in-app alert

```java
// cb-discussion-service NotificationTriggerService.java:110-133
notificationTriggerService.triggerNotification(
  Constants.PROFANITY_CHECK, ALERT, List.of(authorUserId), title, firstName, notificationData);
// -> RestTemplate.postForEntity(notification.api.url, request, Map.class)   // synchronous, blocking
// notification.api.url = http://cb-notification-wrapper-service:8081/notifications/create
```

**Contract mismatch flagged, not confirmed as a runtime bug**: the
payload cb-discussion-service sends is a flat map
`{subCategory, subType, user_ids, message}`, no `request` envelope, no
`type` field, no `X-Auth-Token` header — but
`cb-notification-service`'s `POST /notifications/create` controller
expects `{request:{...,type}}` plus that header, resolving `userId` from
the token. Whether an intermediary reshapes this, or the call fails at
these commits, is not confirmed from these two repos alone.

- Source: `cb-discussion-service NotificationTriggerService.java:42-133`, `application.properties:94`; `cb-notification-service NotificationController.java:34-39`

### Course/program approval notifications (uiproxy email path, separate from cb-notification-service)

| Method | Route | Purpose |
|---|---|---|
| POST | `{API_PROXY_V8}notifyContentState` | `sunbird-cb-uiproxy proxies_v8.ts:1030-1082` — validates `contentState` ∈ `[sendForReview, reviewCompleted, reviewFailed, sendForPublish, publishCompleted, publishFailed]`, composes an email per state, forwards to a mail service |

Called from `sunbird-cb-creationportal reject-content.service.ts
.sendEmailNotification(actionType, content)` with recipients pulled from
`content.reviewer`/`content.publisherDetails`/`content.creatorContacts`
depending on `actionType`. This is a completely separate mechanism from
`cb-notification-service`'s in-app taxonomy — no code path connects them.

- Source: `sunbird-cb-creationportal reject-content.service.ts:200-261`; `sunbird-cb-uiproxy src/proxies_v8/proxies_v8.ts:1030-1082`

### sunbird-notification-service (multi-channel: email/SMS/push/feed)

| Method | Route | Purpose |
|---|---|---|
| POST | `/v1/notification/send` | Async dispatch |
| POST | `/v1/notification/send/sync` | Sync (blocking) dispatch — used by `sunbird-cb-ext` |
| POST | `/v2/notification/send` | v2, list-of-notifications body, stricter validation |
| POST | `/v1/notification/otp/verify` | OTP verification |
| GET/PATCH/POST | `/v1/notification/feed/*` | In-app feed read/update/delete |

No confirmed caller of this service for any moderation-related event —
its confirmed callers (`UserRegistrationConsumer`,
`CourseReminderNotificationService`, `LatestCoursesAlertNotificationService`)
are all non-moderation.

- Source: `sunbird-notification-service service/conf/routes`,
  `service/app/controllers/notification/NotificationController.java:53-108`;
  `sunbird-cb-ext NotificationUtil.java:29-74`, `application.properties:247-248`

### Peer validation/evaluation (receiving side only, no producer found)

| Method | Kafka topic (consumer only) | Purpose |
|---|---|---|
| — | `dev.peer.validation.status.update` | `PeerValidationStatusConsumer` |
| — | `dev.peer.evaluation.status.update` | `PeerEvaluationStatusConsumer` — validates `STATUS_APPROVED`/`STATUS_REJECTED` |
| POST | `/v1/notifications/bulk/create/peervalidation` | REST surface for the same feature |

- Source: `cb-notification-service consumer/PeerValidationStatusConsumer.java`, `PeerEvaluationStatusConsumer.java:112-129`
- **Verification boundary**: no producer for either topic was found in
  `sunbird-cb-ext`, `cb-discussion-service`, or `sunbird-course-service`
  — likely produced by a service outside the 13 repos analyzed.

> **Verification boundary**: everything above traces to the 13 repos
> listed in [index.md](index.md). `cb-service-registry` and any external
> peer-validation/evaluation producer are referenced but not present in
> the analyzed set — only the calls/consumers into them are visible.
