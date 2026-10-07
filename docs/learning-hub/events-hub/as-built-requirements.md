# Events Hub — As-Built Requirements

Requirements reconstructed from the shipped implementation across 8 repos
(branches/commits listed in [index.md](index.md)) — what the system does
today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for Events Hub was available in
any of the 8 repos. This document reconstructs requirements **from the
shipped implementation** across the content layer (`knowledge-platform`),
enrollment/consumption/certification (`sunbird-course-service`), support
services (`sunbird-cb-ext`), the BFF proxy (`sunbird-cb-uiproxy`), the
Flink jobs pipeline (`knowledge-platform-jobs`), and three frontend
portals. Each requirement traces to file(s)/function(s) that implement
it.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Content model

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL model a live/virtual event as a distinct content type `Event`, persisted as a Neo4j graph node via the same `DataNode`/`ContentActor` machinery used for Course/Collection. | `EventActor.scala` (extends `ContentActor`); `TestEventSetActor.scala:47` ("store it in neo4j") |
| FR-002 | The system SHALL model a multi-occurrence event as a distinct content type `EventSet`, which on create SHALL synchronously generate one child `Event` node per entry in its `schedule.value` array, wired via a `hasSequenceMember` graph relation. | `EventSetActor.scala` `addChildEvents`/`formChildEvents` |
| FR-003 | The system SHALL reject any direct update, publish, retire, or discard of an `Event` that has an inbound `EventSet` relation, returning a client error naming the constraint. | `EventActor.scala` `verifyStandaloneEventAndApply` |
| FR-004 | `EventSet` update SHALL be rejected unless the node's current status is `Draft`, and on a valid update SHALL delete all existing child `Event` nodes and recreate them from the new schedule rather than diffing. | `EventSetActor.scala` `update`, `deleteExistingEvents` |
| FR-005 | `EventSet` publish, retire, and discard SHALL cascade the same operation to every child `Event` before/alongside acting on the parent node. | `EventSetActor.scala` `publishChildEvents`/`retireChildEvents`/`discardChildEvents` |
| FR-006 | `EventSet.getHierarchy` SHALL compute the child list by reading Neo4j relations live on every call, without consulting the Cassandra hierarchy cache used by Course/Collection. | `EventSetActor.scala:130-147` |
| FR-007 | An `Event` update SHALL parse `startDateTime`/`endDateTime` from a UTC input format and convert to `Asia/Kolkata` before storing, returning a client error on unparseable input. | `EventActor.scala:45-93` |

### Enrollment

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The system SHALL support enrolling in a plain `Event` via `POST /v2/event/enroll`, writing the enrollment to the `user_entity_enrolments` Cassandra table keyed by `{userId, contentId=eventId, contextId=eventId, batchId}`. | `EventsActor.eventEnroll`, `UserEventsDaoImpl` |
| FR-011 | The system SHALL also support enrolling in an `Event` via the generic `POST /v1/event/enroll` route, dispatched to the same `CourseEnrollmentActor` used for Course enrollment. | `service/conf/routes` (Event Management block) |
| FR-012 | The system SHALL support enrolling in an `EventSet` via `POST /v1/eventset/enroll`, which SHALL resolve every child `Event` id and write one enrollment record per child into the **Course** enrolment table (`UserCoursesDao`), not `user_entity_enrolments`. | `EventSetEnrolmentActor.scala` |
| FR-013 | `/v2/event/enroll` SHALL reject enrollment once a configured campaign end date (`KARMAYOGI_SAPTAH_END_DATE`) has passed. | `EventsActor.validateEnrolment:451-490` |
| FR-014 | `/v2/event/enroll` SHALL, for content whose `resourceType` is configured as a Bharat Kalp resource type, require the enrolling user's profile attribute `isBharatKalpMember == true`. | `EventsActor.eventEnroll` |
| FR-015 | `/v2/event/enroll` SHALL, for `resourceType == SAMUHIK_CHARCHA_COURSE_TYPE` content, require the user to have an active or sufficiently-progressed enrollment in the event's linked course. | `EventsActor.validaSamuhikCharchaEnrolment` |
| FR-016 | On successful `/v2/event/enroll`, the system SHALL synchronously publish an enrolment-alert event to a dashboard Kafka topic, and SHALL fail the enrollment API call if that publish fails. | `EventsActor.sendEventEnrolmentAlert:628-666` |

### Consumption

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The system SHALL track event attendance/progress via `POST /v1/user/event/state/update`, writing `status`/`progress`/`completedCount`/`lastCompletedTime` into the shared `user_content_consumption` Cassandra table. | `EventConsumptionActor.scala:29-52` |
| FR-021 | Consumption-state updates SHALL clamp `status` to a maximum of 2 and `progress` to a maximum of 100. | `EventConsumptionActor.scala` |
| FR-022 | Consumption-state updates SHALL NOT emit any Kafka instruction event, unlike the equivalent Course consumption actors. | Confirmed absent by cross-repo grep against `InstructionEvent` usage |

### Certification and karma points

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The system SHALL support issuing an event certificate via `POST /v1/event/batch/cert/issue`, which SHALL treat every issuance request as `eventCompletionPercentage = 100.0` regardless of actual recorded consumption. | `CertificateActor.issueEventCertificate:180-267` |
| FR-031 | Certificate-template management for an event batch (`add`) SHALL be available via `PATCH /private/v1/event/batch/cert/template/add`. | `EventBatchCertificateActor.java` |
| FR-032 | The bulk-onboarding flow SHALL award karma points for event attendance by publishing to Kafka topic `dev.karma.points.unified.v2.event`, unless the row was processed under `publicCert`. | `PublicUserEventBulkonboardConsumer.java:272,294`, `ClaimEventKarmaPointsServiceImpl.java:23-38` |
| FR-033 | The post-consumption reconciliation flow SHALL always publish a karma-point event after successfully updating a user's completion state, regardless of whether a certificate was already issued. | `UserEventPostConsumptionServiceImpl.java:167-181` |

### Bulk operations

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The system SHALL support bulk-onboarding a CSV of user emails against an event+batch, resolving emails to user IDs, enrolling/completing them, and optionally issuing certificates and karma points, asynchronously via Kafka. | `PublicUserEventBulkonboardServiceImpl.bulkOnboard`, `PublicUserEventBulkonboardConsumer.java` |
| FR-041 | Bulk-onboard SHALL reject a new upload for an event that already has an `IN_PROGRESS` upload. | `PublicUserEventBulkonboardServiceImpl` |
| FR-042 | Bulk-onboard SHALL support a `reissue` flag to force certificate re-issuance for rows already marked complete. | `PublicUserEventBulkonboardConsumer.processRecord` |
| FR-043 | The system SHALL support bulk-creating/publishing "Calendar"-category events from an uploaded XLSX, matching existing content by name+channel via composite search before deciding create vs. update. | `CalendarBulkUploadServiceImpl.java:362-416` |
| FR-044 | The system SHALL support an on-demand, CSV-driven post-consumption reconciliation that recomputes true completion time from the event batch's end time and corrects enrollment records accordingly. | `UserEventPostConsumptionServiceImpl.java:110-149` |

### Authoring and review

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-050 | The Org Portal SHALL provide a single-page event-creation form (title, summary, description, agenda, type, date/time, duration, conference link, presenters) that creates and **immediately publishes** the event. | `create-event.component.ts:402-532` |
| FR-051 | The Org Portal's event-type selector SHALL offer only "Webinar" as an enabled option in the current build. | `create-event.component.ts:56-61` |
| FR-052 | The Creation Portal SHALL provide a review dashboard listing events by `status`, split into "New Requests" (`SentToPublish`) and "Past Requests" (`Live`), scoped to events not created by the CBP's own org. | `dashboard.component.ts:83-151` |
| FR-053 | The Creation Portal SHALL support publishing (with basic-field patch) or rejecting (with a recorded reason) an event under review, and if the event has a linked course, SHALL patch that course's `eventLinked` array to cross-reference the event. | `base.component.ts` `publishEvent`/`rejectEvent` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | Bulk-onboard processing SHALL run asynchronously off the Kafka consumer thread (fire-and-forget), so a processing failure surfaces only in logs, not to the original uploader. | `PublicUserEventBulkonboardConsumer.java:70-84` |
| NFR-003 | Event-related uiproxy routes not present in the role whitelist SHALL default-deny under the standard whitelist-check configuration. | `whitelistApis.ts`, `apiWhiteList.ts:335-382` |
| NFR-004 | `EventBatchDaoImpl` SHALL apply an environment-configurable `+5:30` correction when merging batch start/end times, to compensate for an otherwise-unresolved timezone handling issue. | `EventBatchDaoImpl.processStartEndDate` |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | `EventBatchDao` has no `update()` method — only `create` and certificate-template map mutation exist. | Batch dates, mentors, and enrollment type cannot be corrected post-creation through any traced code path. | `EventBatchDao.java`/`EventBatchDaoImpl.java` |
| CON-002 | No scheduler or job in any traced repo transitions an event batch's `status` from `NOT_STARTED`/`STARTED` to `COMPLETED` over time. | Batch status set at creation is effectively permanent unless manually corrected. | `EventsActor.setEventBatchStatus` |
| CON-003 | The `eventset` JSON schema's `schedule.nonRecurringDetails` field name does not match the actor code's `schedule.value`. | Any external tooling built against the published schema would send the wrong field and silently produce zero child events. | `schemas/eventset/1.0/schema.json` vs. `EventSetActor.formChildEvents` |
| CON-004 | The `eventset` schema's `contentType` enum is `["Event"]`, not `["EventSet"]`. | Schema-based client-side validation of an EventSet's `contentType` would incorrectly reject the correct value. | `schemas/eventset/1.0/schema.json` |
| CON-005 | Certificate issuance across all four trigger points assumes 100% completion without querying consumption data. | Certificates can be issued to users who did not actually attend/complete the event. | `CertificateActor.issueEventCertificate`; `PublicUserEventBulkonboardConsumer`; `UserEventPostConsumptionServiceImpl` |
| CON-006 | No idempotency key or duplicate-claim check exists in `sunbird-cb-ext` before publishing a karma-points event. | Any process that re-runs a bulk-onboard or reconciliation job for the same rows will re-award points, unless a downstream (unverified) consumer de-dupes. | `ClaimEventKarmaPointsServiceImpl.java`, `UserEventPostConsumptionServiceImpl.java` |
| CON-007 | The Org Portal's event-creation flow assumes there is no review gate — it publishes directly. | An event created here never appears to pass through the Creation Portal's `SentToPublish` review queue via any traced path. | `create-event.component.ts` vs. `dashboard.component.ts` |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | Two independently-written implementations of the same karma-point Kafka-publish logic exist (`ClaimEventKarmaPointsServiceImpl` and a duplicate method inside `UserEventPostConsumptionServiceImpl`) — neither calls the other. | FR-032 vs. FR-033 | `ClaimEventKarmaPointsServiceImpl.java:23-38` vs. `UserEventPostConsumptionServiceImpl.java:167-181` |
| DEV-002 | `UserEventPostConsumptionServiceImpl.processRecordForStatus` has an operator-precedence bug: missing parentheses make the second half of an `&&`/`||` condition evaluate unconditionally, and can NPE if `issuedCertificates` is null. | Sits underneath FR-044 | `UserEventPostConsumptionServiceImpl.java:350` |
| DEV-003 | `EventSetActor.discardChildEvents` calls `RetireManager.retire` on each child instead of `DiscardManager.discard`, even though the parent EventSet's own discard correctly uses `DiscardManager` — children are likely retired, not discarded, when the parent is discarded. | Sits underneath FR-005 | `EventSetActor.scala:236-254` |
| DEV-004 | `EventBatchCertificateActor.removeCertificateTemplateFromCourseBatch` reads the event id from `JsonKey.COURSE_ID` instead of `JsonKey.EVENT_ID` (used everywhere else in the same class), and validates via the Course batch validator instead of the Event one. No route wires this method to any HTTP endpoint, so it may be dead code. | Sits underneath FR-031 | `EventBatchCertificateActor.java:82` (cf. line 57) |
| DEV-005 | Certificate issuance for Course uses the shared `InstructionEvent` enum + `InstructionEventGenerator.pushInstructionEvent`; the Event path hand-builds a raw JSON string via `String.format` (no escaping) and calls `KafkaClient.send` directly, to a differently-named topic. | Sits underneath FR-030 | `CertificateActor.java:64-178` (Course) vs. `:218-253` (Event) |
| DEV-006 | Two apparently-overlapping "consumption" tables exist for events (`user_entity_consumption`, read-only, vs. `user_content_consumption`, read+write) with no code found writing to the first — its use in enriching `EventManagementActor` responses may always yield empty data. | Sits underneath FR-020 | `EventEnrolmentDaoImpl.getUserEventConsumption` |
| DEV-007 | The Org Portal's `app/events` route is declared twice in its routing module; the second declaration (the unrelated "meetup" microsite) is unreachable because Angular matches the first. | N/A — out-of-scope feature, noted for completeness | `sunbird-cb-orgportal/src/app/app-routing.module.ts:139-140,212-213` |
| DEV-008 | The Org Portal create-event flow uploads a cover image and defines the code to attach it to the event and republish, but the call that would invoke that attachment (`this.fileSubmit(identifier)`) is commented out. | Sits underneath FR-050 | `create-event.component.ts:522` |
| DEV-009 | Field names for "the event/event-set id" are inconsistent across course-service request validators — `eventId`/`collectionId` in `EventsController`'s validators vs. `courseId` in `EventConsumptionController`, `EventSetEnrolmentActor`, and the reused `CourseEnrollmentRequestValidator`. | Sits underneath FR-010/FR-012/FR-020 | `CourseBatchRequestValidator.java` vs. `EventConsumptionController.java:59-79` |

## Out of scope (not reconstructible from these 8 repos)

- The `app-event`/"meetup" microsite (`event-external` proxy, single
  external API, no enrollment) — a distinct feature sharing a similarly
  named folder; not part of Events Hub proper.
- Any consumer of the `dev.karma.points.unified.v2.event` or
  `dev.issue.certificate.request`/`user_issue_certificate_for_event`
  Kafka topics — only the producer side is visible in these repos.
- The Kong API gateway's exact path-rewrite rules between
  `sunbird-cb-uiproxy` and `sunbird-cb-ext` (several alias paths don't
  match the target controller paths literally).
- The server-delivered page-configuration JSON that drives the portal's
  `card-event-hub` widget placement and the Event Hub's filter/facet
  behaviour — referenced by the frontend but not present in any repo.
- Four Creation Portal wizard steps (`competencies`, `course-linked`,
  `pre-event-setup`, `preview`) — identified and routed but not read
  line-by-line for field-level validation rules.
- The client-side call site in `EventPlayerComponent` that triggers the
  consumption-update API (UC-5) — the actor-level contract is confirmed,
  the exact frontend trigger point is not.

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to one
> of the 8 repos listed in [index.md](index.md) at the file/function
> cited in its Source column — no requirement here is inferred without a
> citation. No original spec/ticket existed to verify these against (see
> Purpose and method); this document is reconstructed from shipped
> behaviour, not compared to an approved requirement set. Attaching the
> originating spec, the Kong gateway config, and the downstream Kafka
> consumers listed under Out of scope would convert several of the open
> questions here (especially DEV-007's status-transition gap and CON-006's
> idempotency gap) from "unverified" to "confirmed."