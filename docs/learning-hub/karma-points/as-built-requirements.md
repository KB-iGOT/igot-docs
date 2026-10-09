# Karma Points — As-Built Requirements

Requirements reconstructed from the shipped implementation across
`knowledge-platform-jobs` (`cbrelease-4.8.41.1`, `19c89ce4`),
`sunbird-cb-ext` (`cbrelease-4.8.41.1`, `5baf0ecc`),
`sunbird-course-service` (tagged `5b7202d1`), `sunbird-lms-service` (`0cf65885`),
`sunbird-cb-portal` (tagged `08989e4d5`), `sunbird-cb-orgportal` (`591f6954`),
`sunbird-cb-staticweb` (`cbrelease-4.8.41`, `86761496`),
`sunbird-cb-uiproxy` (tagged `014cdb3`), `sunbird-devops` (tagged `e1fcdb9d7`),
`igot_karmayogi_mobile` (`master`, `7a3219157`). Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements document was available in any repo. Each requirement is
traced to implementing file(s). IDs: `FR-xxx` functional, `NFR-xxx`
non-functional, `CON-xxx` constraint baked into the build. Paths are relative to each repo.

## Functional requirements

### Producers

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | On successful enrolment the system SHALL emit `FIRST_ENROLMENT` `{courseId,userId,batchId}` to the unified topic, including on re-enrol; "first" is not checked at the producer. | `course-mw/enrolment-actor/.../CourseEnrolmentActor.scala:133,206`; `ExtendedCourseEnrollmentActor.scala:181,246,1423,2235` |
| FR-002 | On successful unenrol the system SHALL emit `UNENROLMENT` with `edata.userIds` (string), actor "Karma points reversal". | `ExtendedCourseEnrollmentActor.scala:2061, 2354-2371` |
| FR-003 | On event-content completion (status 2 and ≥ min percentage) the system SHALL emit `EVENT_ATTENDED`, gated by `pushTokafkaEnabled` (default true). | `ContentConsumptionActor.scala:630-633, 728-744` |
| FR-004 | After user creation the system SHALL emit a registration event whose type is mapped from `sourceCreationType`; `ngoBulkUserCreate` is unmapped and emits nothing; publish failure SHALL NOT fail creation. | `UserBaseActor.java:325-374`, `SSOUserCreateActor.java:232` |
| FR-005 | When `user_logins.first_login` is null the system SHALL emit `FIRST_LOGIN`; when `mobile_first_login` is null, `FIRST_LOGIN_MOBILE`. | `UserProfileReadService.java:~760-775, ~899-945` |
| FR-006 | After a rating upsert with no comment the system SHALL emit `RATING`. | `RatingServiceImpl.java:476-480` |
| FR-007 | After certificate issue the generator SHALL emit `COURSE_COMPLETION` (`version 2`). | `collection-certificate-generator/.../CertificateGeneratorFunction.scala:389-391, 577-605` |
| FR-008 | The CSV post-consumption upload SHALL complete event enrolments and emit `EVENT_ATTENDED`, except for already-completed enrolments. | `UserEventPostConsumptionServiceImpl.java:100-181`, `PublicUserEventBulkonboardConsumer.java:272-294` |

### Processor (`knowledge-platform-jobs`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | V2 SHALL consume one topic keyed per user and dispatch by `eventType`; unknown/invalid events SHALL be published to the failed topic without retry. | `v2/task/KarmaPointsProcessorTaskV2.scala:37-89`, `KarmaPointsProcessorFnV2.scala:115-173` |
| FR-021 | Course completion SHALL award `5` (Learning Pathway `10`), plus `5` if ACBP, minus `min(monthsLate,5)` after plan end; deduped by lookup. | `CourseCompletionHandler.scala:34-198` |
| FR-022 | Non-ACBP completions SHALL be skipped when the monthly count ≥ 4 (capping on). | `CourseCompletionHandler.scala`; `values.j2` `enableCapping = true` |
| FR-023 | Curated Program completion SHALL award 10, max 2 a month. | `CourseCompletionHandler.scala:77-84, 175-197` |
| FR-024 | First enrolment SHALL award 5 once; a reverted row SHALL be re-awarded on the same row. | `FirstEnrolmentHandler.scala:24-82` |
| FR-025 | First login, first mobile login, and each registration type SHALL award 5, once each. | `FirstLoginHandler.scala`, `RegistrationHandler.scala` |
| FR-026 | Rating SHALL award 2, once per course. | `RatingEventHandler.scala:27-63` |
| FR-027 | Event attendance SHALL award 5, credited at `ets`, skipped if `ets` is after the event end. | `EventAttendedHandler.scala:26-63` |
| FR-028 | ACBP claim SHALL add 5 to the course row and decrement the non-ACBP quota; already-claimed SHALL be a no-op. | `ACBPClaimHandler.scala:68-142` |
| FR-029 | Unenrolment SHALL set the first-enrolment row to 0 and subtract it from the summary. | `UnenrolmentHandler.scala:19-50` |
| FR-030 | Survey (2), course time spent (5), engagement streak (10), verified profile (10), assessment passed (5), assessment high score `>75` (5) SHALL be awarded with per-key dedup. | `SurveySubmissionHandler`, `CourseTimeSpentHandler`, `EngagementStreakHandler`, `VerifiedProfileHandler`, `AssessmentHandler` |
| FR-031 | `KARMA_POINTS_ADJUSTMENT` SHALL change only `total_points` (non-zero ± N), with no idempotency. | `KarmaPointsAdjustmentHandler.scala:20-31` |
| FR-032 | `POINTS_CONVERSION` SHALL convert ≤ min(unconverted, 300 − converted this month in IST) via Redis + LWT dedup and a frozen plan. | `PointsConversionHandler.scala` |
| FR-033 | `COINS_REDEMPTION` SHALL debit the wallet if balance suffices and publish `EXT_COURSE_ENROLLMENT` to `user.paid.course.enrolment`; `COINS_REAWARD` SHALL reverse a matching DEBIT. | `CoinsRedemptionHandler.scala`, `CoinsReawardHandler.scala` |

### Read side (`sunbird-cb-ext`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The system SHALL return a user's credit history `credit_date DESC`, limit = request or 10, cursor `credit_date < offset`, with `count` since 2023-12-01. | `KarmaPointsServiceImpl.java:30-63, 121-130` |
| FR-041 | The system SHALL return the `COURSE_COMPLETION` row for a user/course via the credit lookup, or `{}`. | `KarmaPointsServiceImpl.java:65-97` |
| FR-042 | The system SHALL emit the ACBP claim message `{edata:{userId,courseId}}` with no validation or idempotency and return 200. | `KarmaPointsServiceImpl.java:98-106` |
| FR-043 | Wallet summary SHALL compute `walletBalance`, `unredeemedKarmaPoints = total − earned`, `convertibleThisMonth = min(300 − converted, unredeemed)` and `redeemEnabled`. | `KarmaCoinWalletServiceImpl.java:54-119` |
| FR-044 | Transactions SHALL reject ranges older than 1 year or ending in the future, and SHALL inject in-flight conversions/enrolments as `IN_PROGRESS`. | `KarmaCoinWalletServiceImpl.java:122-220` |
| FR-045 | Redeem SHALL validate, take a 900 s Redis lock, emit `POINTS_CONVERSION` and return 202. | `KarmaCoinWalletServiceImpl.java:334-424` |
| FR-046 | Learner leaderboard SHALL require the org-id header, serve ranks `{1,2,3,n-1,n,n+1}` and cache 3600 s. | `WallOfFameServiceImpl.java:89-148` |

### Clients

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-060 | Web SHALL provide a Karma Wallet page showing four summary cards, a Convert dialog (max = min(convertible, unredeemed), digits only), and transaction history with period filters. | `karma-wallet.component.*`, `karma-redeem-dialog.component.*` |
| FR-061 | Web SHALL generate a client `requestId` (uuid v4) per conversion and update nav/enrolment caches with `walletBalance` after summary load. | `karma-wallet.model.ts`, `karma-wallet.component.ts:~780-815` |
| FR-062 | Web SHALL list history 10 at a time by `credit_date` cursor, with a Bonus badge when `addinfo.ACBP` is truthy. | `profile-karmapoints.component.ts` |
| FR-063 | Mobile SHALL show points on the profile strip (tap-through only if > 0), a history screen (page 6), and TOC reward cards by learner state. | `profile_data_strip.dart`, `karmapoint_overview.dart`, `message_card.dart` |
| FR-064 | Mobile SHALL show a Claim button when course progress is 100% and `addinfo.ACBP` is not true. | `message_card.dart:82-120`, `claim_karmapoint.dart` |
| FR-065 | Mobile SHALL, for restricted external courses with `requiredKarmaPoints > 0`, show a consent sheet before the regular consent. | `external_course_toc.dart`, `karma_points_consent_bottom_sheet.dart` |
| FR-066 | Static web SHALL show the previous month's MDO Hall of Fame bucketed by size, marking equal-score ties. | `hall-of-fame.component.ts` |
| FR-067 | uiproxy SHALL route karma, wallet, Hall of Fame paths to Kong; `/halloffame/read` also unauthenticated. | `proxies_v8.ts:320-387,1807`, `publicApiV8.ts:97-99` |

## Non-functional requirements

| ID | Requirement | Source |
|---|---|---|
| NFR-001 | V2 stream SHALL checkpoint EXACTLY_ONCE and be keyed per user. | `KarmaPointsProcessorTaskV2.scala:32-45` |
| NFR-002 | Transient Cassandra errors SHALL be retried once. | `CassandraUtil.scala:46-81` |
| NFR-003 | Leaderboard reads SHALL be Redis-cached for 3600 s. | `application.properties:679-680` |
| NFR-004 | Wallet reads SHALL use QUORUM. | `KarmaCoinWalletServiceImpl.java:279-291` |
| NFR-005 | Kong karma routes SHALL apply jwt, cors, acl, rate-limiting and request-size-limiting. | `kong-api/defaults/main.yml:10807-10917, 26938-27047` |

## Constraints and defects baked into the build

| ID | Observation | Source |
|---|---|---|
| CON-001 | **Value mismatch (ACBP):** processor awards 5 + 5 = 10; mobile/orgportal show 15; mobile claim button hard-codes `+10` while the processor claim adds 5. Helm V1 `acbp=10`, V2 `acbp=5`. | `values.j2`, `app_constants.dart:109-117`, `claim_karmapoint.dart:55` |
| CON-002 | **Value mismatch (Learning Pathway):** V1 25, V2 10, mobile shows 25. | `values.j2`, `learner_path_karma_message_card.dart` |
| CON-003 | **Value mismatch (event):** processor 5 (conf and Helm V2); mobile copy "10"; V1 Helm 10. | conf, `app_en.arb` |
| CON-004 | V2 removed the assessment-pass bonus from course completion and the first-login self-registration gate. | `CourseCompletionHandler.scala:128-148`, `FirstLoginHandler.scala:29-36` |
| CON-005 | Claim endpoint takes userId from the body without comparing it to the caller. | `KarmaPointsController.java:36` |
| CON-006 | History excludes pre-2023-12-01 credits; offset 0 excludes today. | `KarmaPointsServiceImpl.java:42-45,121-130` |
| CON-007 | `markRedeemFailed` has no caller; a failed Kafka push leaves the lock up to 900 s; check-then-lock is not atomic across requestIds. | `KarmaCoinWalletServiceImpl.java:460, 334-424` |
| CON-008 | Event-certificate generator's karma emit is commented out. | `event-cert-generator/.../CertificateGeneratorFunction.scala:90-93` |
| CON-009 | `redeem/status/:id` and `deductionrule` are routed but no portal caller exists; orgportal karma panels are commented out in the template. | `whitelistApis.ts`, `app-toc-home.component.html` |
| CON-010 | No tests exist for the points controller/service, rating emission, Hall of Fame, or either Flink module in this checkout. | test trees |

## Verification boundary

Rows marked *inferred* in [LLD](lld.md) (table keys, Helm fall-back behaviour,
`UNENROLMENT` envelope) are not directly verified. Services referenced only by
topic name (`cb-enrollment-service`, `cios-enroll`, `workflow-handler`, `form-service`,
`cb-ext-assessment-service`) were not traced.
