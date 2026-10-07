# Moderated Content — Use Cases

## Authoring journeys (sunbird-cb-creationportal)

### UC-1 · Author creates a Moderated Course/Program/Assessment

The author picks one of `MODERATED_COURSE`, `MODERATED_PROGRAM`,
`MODERATED_ASSESSEMENT` (sic — typo preserved from source) as the
`courseCategory` (`ECourseCategory` enum, `widget-content.model.ts:303-318`).
This is the only signal that distinguishes moderated content from a plain
`Course` — there is no separate content schema, table, or service.

- Source: `library/ws-widget/collection/src/lib/_services/widget-content.model.ts:303-318`

### UC-2 · Author sets MDO-scoping (`ws-auth-moderated-course` widget)

The `moderated-course.component.ts` widget presents an org multi-select
checklist (keyed by `sbOrgId`) plus a slide-toggle labelled "Only Verified
Karmayogis" vs "All MDO Users". Selecting orgs and the toggle value writes
into the content's `secureSettings.organisation` (array of org IDs) and
`secureSettings.isVerifiedKarmayogi` (`"Yes"`/`"No"`) fields at save time.

- Source: `project/ws/author/src/lib/modules/shared/components/moderated-course/moderated-course.component.ts` (154 lines, full component)

### UC-3 · Author submits for review

`editor.service.ts.sendToReview(id, parentStatus)` — only reachable from
`Draft` — POSTs `{request:{content:{reviewStatus:'InReview'}}}` to
`ACTION_CONTENT_V3 + 'review/'`. This moves the content's `status` to
`Review` with `reviewStatus: 'InReview'`. A multilingual variant exists
(`sendMultilingualContentsToReview`) hitting a separate `mlReview`
endpoint. This is the **generic** Sunbird content-review call — identical
for a plain `Course` and a `Moderated Course`.

- Source: `project/ws/author/src/lib/routing/modules/editor/services/editor.service.ts:686-710`

### UC-4 · Reviewer works the queue

A user with the `CONTENT_REVIEWER` role sees exactly three tabs: `Live`,
`Under Publish`, `For Review` (default tab), driven by `formTabs()` in
`contents.component.ts`. "For Review" queries `status=["InReview",
"Review"]` filtered further by `reviewStatus: 'InReview'`; "Under Publish"
queries the same `status` set filtered by `reviewStatus: 'Reviewed'`. A
`CONTENT_CREATOR` sees a completely different tab set (`My Content`, `All
Content`, `Draft`) and never sees the review queue at all.

- Source: `project/ws/author/src/lib/routing/modules/home/components/my-content/components/new/contents/contents.component.ts:544-680`
- **Verification boundary**: this queue is generic to all Sunbird content
  under review, not filtered to `courseCategory=Moderated*` — a reviewer
  sees moderated and non-moderated content submissions in the same list.

### UC-5 · Reviewer approves, publisher publishes

Reviewer action moves `reviewStatus` to `'Reviewed'` via the generic
`forwardBackward()` status-change call
(`POST {ACTION_BASE}content/status/change/{id}`). A separate
`CONTENT_PUBLISHER`/`SPV_PUBLISHER` role then calls
`publishContent()` (`POST {ACTION_CONTENT_V3}publish/{id}`), moving
`status` to `Live`. Only at `Live` does the content become visible to
learners via the MDO-scoped search filters (UC-8).

- Source: `editor.service.ts:668-722`

### UC-6 · Reject / withdraw back to Draft

`reject-content.service.ts` (`moveToDraft`, `statusUpdateforParent`)
POSTs `{request:{content:{reviewStatus:'', status:'Draft'}}}`. A parent
course/program cannot be withdrawn if any child resource is already
`Live` (`liveResourceError` toast) or if any child course-type element is
still `Draft` (`courseDraft` toast).

- Source: `project/ws/author/src/lib/.../reject-content.service.ts:56-121,200-261`

### UC-7 · Unpublish/retire

`UNPUBLISH_CONTENT` (`{API_PROXY_V8}v1/content/retire`) moves `Live`
content out of circulation. Same generic endpoint as any other retired
Sunbird content.

- Source: `editor.service.ts` apiEndpoints reference, `apiEndpoints.ts:71`

## Learner journeys

### UC-8 · Learner sees a "Moderated contents" tab scoped to their org

`card-learn.component.ts.callModeratedFunc()` searches with:

```jsonc
{
  "filters": {
    "courseCategory": ["Moderated Course", "Moderated Program", "Moderated Assessment"],
    "secureSettings.organisation": "<learner's own rootOrgId>",
    "contentType": ["Course"],
    "status": ["Live"]
  }
}
```

If the learner's profile `profileStatus` is not `"verified"`, the filter
additionally adds `"secureSettings.isVerifiedKarmayogi": "No"`. The tab
itself is only rendered if the search returns non-empty results — i.e. an
MDO with no matching moderated content never sees the tab/badge at all.

- Source: `library/ws-widget/collection/src/lib/card-learn/card-learn.component.ts:125-177`, `card-learn.component.html:42-55`

### UC-9 · Global search "moderated courses" filter

`search-v2`/`search-v3` expose a moderated-courses filter chip
(`search-filters.component.ts:213,264,273,319`) applying the same
`courseCategory`/`secureSettings.organisation` filter shape as UC-8.

- Source: `project/ws/app/src/lib/routes/search-v2/**`, `search-v3/global-search.component.ts`

### UC-10 · Org-portal MDO admin browses/assigns moderated content to training plans

`sunbird-cb-orgportal`'s training-plan module (`training-plan-home`,
`create-content`, `search`, `category-drop-down` components) reuses the
identical `courseCategory`/`secureSettings.organisation` filter pattern,
tracked via a `showModeratedNotification` state flag driven by
`tpdsSvc.moderatedCourseSelectStatus`.

- Source: `project/ws/app/src/lib/routes/training-plan/**`

### UC-11 · Mobile learner enrolls in a Moderated Program

`enroll_moderated_program.dart` presents a batch-selection widget and
"Enroll" button for moderated programs. This screen is UI-only — no
approve/reject logic was found in this file; enrollment goes through the
standard course-service enroll path once a batch is selected.

- Source: `igot_karmayogi_mobile lib/features/toc/presentation/screens/enroll_moderated_program.dart`
- **Verification boundary**: this file was not read in full depth; other
  moderated-course filter chip files (`course_filters.dart`,
  `my_cbp_course_filter.dart`, `my_cbp_filter.dart`) were located but not
  analyzed line-by-line.

### UC-12 · Search-engine-level MDO enforcement (not just client hiding)

`knowledge-platform`'s `SearchActor.getSearchDTO` applies
`secureSettings.organisation = <caller's org>` as a post-filter.
`SearchProcessor.getSecureSettingsSearchQuery(org_id)` builds an
Elasticsearch nested query requiring `exists(secureSettings.organisation)
AND term(secureSettings.organisation, org_id)` — restriction is enforced
at the search/Elasticsearch layer, not only by the calling UI choosing to
apply a filter.

- Source: `search-api/search-actors/.../SearchActor.java:99-179`; `search-api/search-core/.../SearchProcessor.java:432-494,670-687`
- **Verification boundary**: query construction was read but not traced
  through a live Elasticsearch request.

## Text-moderation journeys (unrelated feature, same document scope)

### UC-13 · Discussion post/reply created — profanity check kicks off async

Creating a discussion question, answer post, or answer-post reply
saves and indexes the post (`isProfane=false`
by default), then pushes to Kafka
topic `dev.process.detect.text.language` to start the async check.

- Source: `cb-discussion-service DiscussionServiceImpl.java:178-244` (create), `AnswerPostReplyServiceImpl.java:166`

### UC-14 · Language detection, then profanity classification

A Kafka consumer either defaults the language to `en`
(`enable.english.language.by.default=true`, the default in this
checkout) or calls `content-moderation-service`'s
`POST /api/v1/language/detect`. It then calls
`processProfanityCheck()`, which routes the request through an internal
service-registry proxy (`POST serviceregistry/v1/callExternalApi`,
`SERVICE_CODE=PROFANITY_CHECK`) to `content-moderation-service`'s
`POST /api/v1/moderation/text`. That service runs `toxic-bert` (English)
or `Hate-speech-CNERG/indic-abusive-allInOne-MuRIL` (10 Indic languages). The result comes back
asynchronously on Kafka topic `dev.process.check.content.profanity`
(consumed by `ProfanityConsumer`), not as the direct HTTP response.

- Source: `cb-discussion-service LanguageDetectionConsumer.java:86-120`, `ProfanityCheckServiceImpl.java:43-76`, `ProfanityConsumer.java:86-116`; `content-moderation-service text_profanity_service.py:27-181`, `profanity_controller.py:29-74`

### UC-15 · A post is flagged — soft-hidden, not deleted, author alerted

On `isProfane=true`, the post's Postgres row and Elasticsearch document
are updated (`isProfane=true`, `profanityCheckStatus='profanityCheckPassed'`),
relevant caches are invalidated, and an async in-app alert
(`NotificationTriggerService.triggerNotification(PROFANITY_CHECK, ALERT,
[authorUserId], ...)`) fires. Every discussion search/listing query
hardcodes `isProfane=false` in its filter — so the post stays in storage
but disappears from all standard search/feed results. It is not deleted
and no "rejected"/"pending review" UI state is shown to other users.

- Source: `cb-discussion-service ProfanityConsumer.java:140-292`; `DiscussionServiceImpl.java:481,1635,1787/1869,2321` (the `IS_PROFANE=false` filter, repeated at every listing query)

### UC-16 · Author sees the flagged-post notification in-app

`sunbird-cb-portal`'s `notifications.service.ts.handleDiscussionRedirection()`
recognizes `sub_category === 'PROFANITY_CHECK'` and deep-links the author
to their post with a `?profanity=PROFANITY_CHECK` query param. That param
is set but **not read anywhere** in the destination `discuss-v2` module —
no toast, banner, or inline warning beyond whatever the generic
notification-center UI itself renders.

- Source: `sunbird-cb-portal src/app/services/notifications.service.ts:142-162`
- **Verification boundary**: the generic notification-center's rendered
  title/body text for a `PROFANITY_CHECK` notification is templated on
  the external `cb-notification-wrapper-service` side, not in this
  checkout — not confirmed.

### UC-18 · Manual report/suspend — a second, unrelated moderation path

Discussion posts also support a human-driven report-and-suspend workflow
(`Constants.REPORTED`, `SUSPENDED`, `reportedBy`, `reportedDueTo`,
`mdoReported*`/`mdoSuspendedPosts` cache prefixes) that is **not**
automatically linked to the ML `isProfane` flag — no code path was found
setting `status=REPORTED` from the profanity pipeline. This is the
`COMMUNITY_MODERATOR`-role human moderation feature, structurally
separate from UC-13–17.

- Source: `cb-discussion-service Constants.java:121-246`

## Notification gaps (confirmed absent)

### UC-19 · Course/program review-request/approval/rejection notifications — not found

`cb-notification-service`'s `NotificationSubCategory` enum defines
`CONTENT_REVIEW_REQUEST`, `CONTENT_PUBLISHED`, `CONTENT_SPV_PUBLISHED`,
`CONTENT_REJECTED`, `CONTENT_EDITED`, `COURSE_PUBLISHED`,
`PROGRAM_PUBLISHED`, `RETIRE_APPROVED`, `RETIRE_REJECTED` — but an
exhaustive search of `sunbird-cb-ext`, `sunbird-course-service`, and
`cb-discussion-service` for any of these literal strings returned **zero
matches**. `sunbird-cb-creationportal` does send its own separate email
notification via `reject-content.service.ts.sendEmailNotification()` →
`POST {API_PROXY_V8}notifyContentState` (uiproxy composes the email body
per `contentState`: `sendForReview`/`reviewCompleted`/`reviewFailed`/
`sendForPublish`/`publishCompleted`/`publishFailed`) — a parallel,
uiproxy-hosted email mechanism, not the `cb-notification-service`
in-app taxonomy.

- Source: `cb-notification-service NotificationSubCategory.java:12-16,92-93,111-114` (receiving-side only); `sunbird-cb-creationportal reject-content.service.ts:200-261`; `sunbird-cb-uiproxy proxies_v8.ts:1030-1082`

### UC-20 · Peer validation/evaluation approve-reject notifications — producer not found

`cb-notification-service` has fully-built Kafka consumers
(`PeerValidationStatusConsumer`, `PeerEvaluationStatusConsumer`) for an
approve/reject event stream, but an exact-string search across
`sunbird-cb-ext`, `cb-discussion-service`, and `sunbird-course-service`
for the topics they listen on returned no producer. `sunbird-cb-ext` does
have a `peervalidation` package, but its only Kafka topic push is a
report-download topic, unrelated to approve/reject events.

- Source: `cb-notification-service consumer/PeerValidationStatusConsumer.java`, `PeerEvaluationStatusConsumer.java:112-129`
- **Verification boundary**: whether this peer-validation/evaluation flow
  is the same thing as course/program "moderation" approval, or a
  separate feature (e.g. Blended Program peer assessment), could not be
  established from these repos — the producer lives outside the 13 repos
  analyzed.

## Edge cases

| Situation | Behaviour |
|---|---|
| Verified Karmayogi user views moderated content | `secureSettings.isVerifiedKarmayogi` filter is **not** added — verified users see all MDO-scoped moderated content regardless of the flag's value on the content |
| Unverified user views moderated content | Extra filter `secureSettings.isVerifiedKarmayogi: "No"` is injected server-side (`cb-ext-course-service ContentInfoUtil.applyVerifiedStatusFilter`) |
| Reviewer tries to withdraw a parent with a Live child | Blocked client-side, `liveResourceError` toast |
| Reviewer tries to withdraw a parent with a Draft child course element | Blocked client-side, `courseDraft` toast |
| Discussion post flagged profane | Not deleted, not blocked at submission — silently excluded from search/feed via `isProfane=false` filter on every listing query; author gets async alert |
| Non-English, non-Indic-language discussion post | Falls back to the English (`toxic-bert`) model — `check_profanity_transformer()`'s default branch |
| Course/program submitted for review | No `cb-notification-service` in-app event fires — only the uiproxy's own email mechanism (UC-19), and only if that code path is actually invoked (not confirmed end-to-end from these repos) |

> **Verification boundary**: all use cases above trace to the 13 repos
> listed in [index.md](index.md). The service-registry proxy layer
> (`cb-service-registry`) that routes `cb-discussion-service`'s profanity
> check to `content-moderation-service` is referenced by name/routing
> code but is not itself one of the 13 repos, so its exact forwarding
> behavior is inferred from the calling code's `SERVICE_CODE` hint, not
> directly read.
