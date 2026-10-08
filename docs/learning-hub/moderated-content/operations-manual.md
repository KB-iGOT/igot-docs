# Operations Manual — Moderated Content

How to operate, support, and troubleshoot the two "moderation" systems
that share this feature name: MDO-restricted content visibility riding on
the generic Sunbird content-review workflow, and an independent
ML-driven discussion-post profanity check.

**Operational implication:** treat these as two separate subsystems when
triaging a support request. "My moderated course isn't visible" is an
access-control/search question (knowledge-platform, cb-ext-course-service).
"My discussion post disappeared" is a text-moderation question
(content-moderation-service, cb-discussion-service). They share no code,
data model, or notification path.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Moderated-content visibility | `secureSettings.organisation` + `isVerifiedKarmayogi` filters, enforced at Elasticsearch query time in `knowledge-platform` | A visibility complaint is a search-index/filter problem, not a permissions-table problem — there is no separate ACL table to check |
| Review/approval | Generic Sunbird `Draft`/`Review`/`Live` workflow, `CONTENT_REVIEWER` role — same mechanism as every other content type | A "my course is stuck in review" ticket is a generic content-workflow issue, not moderated-content-specific |
| Course/program approval notifications | Two separate mechanisms: uiproxy-routed email (`notifyContentState`) and an unfired `cb-notification-service` in-app taxonomy | Don't expect an in-app "your course was approved" notification — nothing triggers that subcategory |
| Text-profanity check | Async (Kafka), soft-hide (not delete) on a hit | A flagged post is never actually removed from storage — if a user says their post "disappeared," it likely still exists with `isProfane=true` |
| Profanity-alert delivery | Sync HTTP call with a flagged request/response contract mismatch | If authors report never receiving a "your post was flagged" alert, check whether the call to `cb-notification-wrapper-service` is actually succeeding, not just whether the Kafka pipeline ran |
| Peer validation/evaluation notifications | Consumer code exists, no confirmed producer in these 13 repos | Don't assume this pipeline is live in the current build without confirming the producer service separately |

## Important fields / configuration

| Field/Config | Meaning | Why it matters |
|---|---|---|
| `courseCategory` | `Moderated Course`/`Moderated Program`/`Moderated Assessment` | The sole signal distinguishing this content from a plain Course |
| `secureSettings.organisation` | Array of MDO org IDs the content is restricted to | Determines who can even find the content in search |
| `secureSettings.isVerifiedKarmayogi` | `"Yes"`/`"No"` | Applied to **unverified** viewers only |
| `status` / `reviewStatus` | `Draft`/`Review`/`Live`/`Retired`, `''`/`InReview`/`Reviewed` | Generic content state — check here first for "content not visible" complaints (must be `Live`) |
| `isProfane` / `profanityCheckStatus` | Discussion post state | `profanityCheckStatus` other than `profanityCheckPassed` means the check didn't complete normally — check this before assuming the ML model made a wrong call |
| `enable.english.language.by.default` (cb-discussion-service) | If `true` (the checked-out default), skips real language detection, treats every post as English | Non-English posts get checked against the English `toxic-bert` model, not the Indic model, unless this is `false` |
| `CONTENT_TEXT_MAX_LENGTH` (content-moderation-service) | 3000 chars | Text over 3000 is rejected by the request validator |
| `KAFKA_MODERATION_RESULTS_TOPIC` / `kafka.topic.process.check.content.profanity` | `dev.content.profanity` (producer default) vs `dev.process.check.content.profanity` (consumer default) | These names differ by default — confirm environment-specific alignment before assuming the pipeline is broken |

## Operational workflows

**Author submits a Moderated Course for review**: authoring UI sets
`courseCategory` + `secureSettings` → generic `sendToReview` call →
content enters the shared `CONTENT_REVIEWER` queue (no
moderated-content-specific queue exists) → reviewer approves
(`reviewStatus=Reviewed`) → publisher publishes (`status=Live`) →
content becomes searchable, subject to the `secureSettings` filter.

**Learner discovers moderated content**: client builds a
`courseCategory`+`secureSettings.organisation`+`status=Live` filter →
`knowledge-platform` search additionally enforces the org restriction
server-side → results returned.

**Discussion post created and checked**: post saved and indexed
immediately (visible) → async Kafka pipeline detects language → checks
profanity via `content-moderation-service` → on a hit, post is
Postgres/ES-flagged and excluded from all listing queries, author gets a
(possibly-broken, see above) in-app alert.

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| GET | (search API, via `SearchActor`) | Reproduce a "moderated content not visible" complaint — check the returned `secureSettings.organisation` on the content |
| GET | `cb-ext-course-service /content/v2/user/info` | Check a specific learner's cached moderated-content count/identifiers (`moderatedCourseCount_{userId}` in Redis) |
| POST | `content-moderation-service /api/v1/moderation/text` | Directly reproduce/diagnose a profanity-check result for a given text/language |
| GET | discussion post's Postgres row (`isprofane`, `profanitycheckstatus`, `profanityresponse`) | Ground truth for whether/why a post was flagged, bypassing the async pipeline |
| POST | `cb-notification-service /v1/notifications/create` | Diagnose the `PROFANITY_CHECK` alert delivery path directly — check request/response against the documented contract mismatch |
| POST | `sunbird-cb-uiproxy /notifyContentState` | Diagnose the (separate) course-review-state email notification path |

## Notification troubleshooting

- **"Author expected a 'your post was flagged' alert but got nothing"**:
  confirm the post's `profanitycheckstatus` is `profanityCheckPassed`
  and `isprofane=true` first (pipeline actually ran and flagged it), then
  check whether `NotificationTriggerService`'s call to
  `cb-notification-wrapper-service:8081/notifications/create` is
  actually succeeding — the payload shape it sends does not match what
  `NotificationController.createNotification` expects (no `request`
  envelope, no `type`, no `X-Auth-Token`). This is a documented
  contract-mismatch risk, not a confirmed-working path.
- **"Reviewer/creator expected an in-app notification for course
  approval/rejection"**: there isn't one wired up. The
  `CONTENT_REVIEW_REQUEST`/`CONTENT_PUBLISHED`/`CONTENT_REJECTED`
  subcategories exist in `cb-notification-service`'s taxonomy but have no
  confirmed producer anywhere in the 13 repos scoped to this feature —
  the only confirmed notification for review/publish state changes is
  the separate uiproxy-routed email (`notifyContentState`), and even that
  depends on `content.reviewer`/`content.publisherDetails` being
  correctly populated on the content record.
- **"Learner expected a peer-validation/evaluation approve/reject
  notification"**: the consumer side (`PeerValidationStatusConsumer`,
  `PeerEvaluationStatusConsumer`) exists and is ready to process events,
  but no producer was found in `sunbird-cb-ext`, `cb-discussion-service`,
  or `sunbird-course-service` — confirm whether the producing service
  (outside these 13 repos) is actually deployed and configured to publish
  to `dev.peer.validation.status.update`/`dev.peer.evaluation.status.update`.

## Visibility troubleshooting

- **"MDO admin says a moderated course isn't showing for their org"**:
  check the content's `secureSettings.organisation` array actually
  contains that org's ID, check `status=Live`, and check whether the
  viewing user's `profileStatus` is unverified (which adds the
  `isVerifiedKarmayogi=No` filter server-side).

## Publishing/config checklist (before relying on this feature in an environment)

- [ ] Confirm `enable.english.language.by.default` is set as intended —
      `true` means non-English discussion posts are checked with the
      English model, not the Indic one
- [ ] Confirm Kafka topic names align between
      `content-moderation-service`'s `KAFKA_MODERATION_RESULTS_TOPIC` and
      `cb-discussion-service`'s `kafka.topic.process.check.content.profanity`
      for this environment — their defaults differ
- [ ] Do not rely on `cb-notification-service` in-app alerts for
      course/program review-state changes — only the uiproxy email path
      is confirmed wired
- [ ] Confirm the payload contract between `NotificationTriggerService`
      and `cb-notification-service`'s `/notifications/create` before
      relying on the `PROFANITY_CHECK` in-app alert in production
- [ ] Confirm `secureSettings.organisation` is actually populated on
      every piece of content intended to be MDO-restricted

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Moderated content invisible to intended MDO | `secureSettings.organisation` missing the org, or content not `Live` | Content record `secureSettings`/`status` fields | Fix content metadata, republish if needed |
| Content stuck in Review | Generic content-workflow issue, not moderated-content-specific | Reviewer assignment, `CONTENT_REVIEWER` role assignment | Escalate as a generic content-workflow issue |
| Discussion post "disappeared" | Flagged profane, soft-hidden from listings (not deleted) | `isprofane`/`profanitycheckstatus` on the post row | Explain soft-hide behavior; check ML classification if disputed |
| Discussion post's profanity check never completed | Registry/service call failed, or language-detection failed | `profanitycheckstatus` in (`profanityCheckCallFailed`, `languageDetectionCallFailed`, `languageNotDetected`) | Check connectivity/service health for the actual fix |
| Author didn't get flagged-post alert | Contract mismatch between `NotificationTriggerService` and `cb-notification-service` | Request/response logs at `cb-notification-wrapper-service:8081/notifications/create` | Treat as a likely integration defect, not a config issue |
| No "course approved/rejected" in-app notification | Never wired up | `CONTENT_PUBLISHED`/`CONTENT_REJECTED` usage (none found) | Log as a feature gap; only the uiproxy email path is live |
| No peer-validation/evaluation notification | Producer not present in these 13 repos | Confirm external producer service's deployment/config | Escalate to the owning team for that producer, outside this feature's repo set |

**Diagnostic sequence**: identify which subsystem the complaint is
about (visibility/access-control vs. text-profanity) → for visibility,
check `secureSettings`/`status` on the content → for text-profanity, check the post's `isprofane`/
`profanitycheckstatus` directly in Postgres before trusting any
downstream notification or UI state → only then check notification
delivery, since both subsystems have at least one unconfirmed/likely-broken
notification path.

## Known operational constraints

- No dedicated moderated-content service, table, or ACL — restriction
  and workflow are entirely composed from generic Sunbird primitives.
- Course/program review-state in-app notifications
  (`cb-notification-service` taxonomy) are declared but have no
  confirmed producer.
- The discussion-profanity in-app alert has a payload-contract mismatch
  with its receiving endpoint that was not confirmed to work at runtime.
- Peer-validation/evaluation notification consumers exist with no
  confirmed producer in this feature's repo set.
- A flagged discussion post is never deleted — only excluded from
  listing queries — so "the post is gone" and "the post is deleted" are
  not the same claim.
- Possible duplicate moderated-content-fetch logic exists between
  `ContentInfoUtil` and `CourseAccessServiceImpl` in
  `cb-ext-course-service` — not fully resolved which is authoritative.

**Operating model**: treat "Moderated Content" as an umbrella over two
independent, differently-mature subsystems — a mature, search-engine-
enforced MDO-visibility scheme built on generic content primitives, and a
newer, async ML-driven text-profanity pipeline whose notification leg is
the least-verified part of the whole feature.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Moderated-content visibility/search filtering | Search/knowledge-platform team | `secureSettings`/`status` are correct but search still returns wrong results |
| Content review workflow stuck/broken | Content-authoring/course-service team | Generic Draft/Review/Live transitions fail, independent of moderated-content status |
| Text-profanity classification disputed | content-moderation-service/ML team | The model's `isProfane`/`confidence` verdict itself is in question |
| Profanity pipeline not completing (call failures) | cb-discussion-service / platform-infra team | `profanitycheckstatus` stuck at a `*Failed` value |
| Profanity-flag in-app alert not delivered | Notifications platform team | Confirm/fix the `NotificationTriggerService` ↔ `cb-notification-service` payload contract |
| Course/program approval in-app notification requests | Notifications platform team | Only once a decision is made to actually wire up `CONTENT_*` subcategories — currently unimplemented |
| Peer-validation/evaluation notification gaps | Owning team for the external producer (outside this repo set) | After confirming that producer's deployment/config separately |

## FAQ

**Why doesn't a moderated course show up in search for a learner in the
right org?** Most likely `secureSettings.organisation` on the content
doesn't include that org's ID, or the content isn't `Live` yet — both
are content-metadata issues, not permissions-table issues, since there
is no separate ACL table.

**Why did a learner's discussion post vanish?** It probably wasn't
deleted — the async profanity pipeline likely flagged it
(`isProfane=true`), and every listing query filters those out. Check the
Postgres row directly rather than assuming data loss.

**Why didn't the post's author get notified their post was flagged?**
The alert call has a documented payload-shape mismatch with the
receiving `cb-notification-service` endpoint — this is flagged as an
unconfirmed/likely-broken path, not a config toggle to flip.

**Why is there no "your course was approved" notification?** Because no
code in any of the 13 repos analyzed calls
`cb-notification-service` with the `CONTENT_PUBLISHED`/
`CONTENT_REJECTED` subcategories — only a separate uiproxy-routed email
mechanism exists for review-state changes, and it depends on
`content.reviewer`/`content.publisherDetails` being populated correctly.

> **Verification boundary**: this manual is sourced from the same 13
> repos as the rest of this feature's docs. Runbook detail for
> `cb-service-registry` (the proxy layer between cb-discussion-service and
> content-moderation-service) and for any external peer-validation/
> evaluation producer would need those systems' own operations docs
> attached.
