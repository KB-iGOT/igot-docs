# Events Hub — Use Cases

## Learner journeys (sunbird-cb-portal)

### UC-1 · Discover an event

No single discovery surface — events surface through several independent
entry points: global search result cards, a home-page "today's/live
events" strip (`ws-widget-card-event-hub`, only rendered when a
server-delivered page-config JSON asks for it — not found in this repo),
and the Event Hub's own `see-all`/`view-all`/`my-events` pages.

- API: `POST apis/proxies/v8/sunbirdigot/search` with
  `filters: {status:['Live'], contentType:'Event', category:'Event'}`,
  facets `sourceName`/`resourceType`, optional `eventDate`/`dateRange`/
  `eventStatus` filters
- Source: `routes/view-all/view-all.component.ts:generateRequestBody()`

### UC-2 · Open an event's detail page

Fetches the event by ID; if the event has a `courseLinked` field, chains
two more calls to show that linked course's own enrollment/progress.

- APIs: `GET apis/proxies/v8/event/v4/read/{id}` ·
  `GET apis/proxies/v8/content/v2/read/{contentId}` (linked course) ·
  `POST apis/proxies/v8/learner/course/v4/user/enrollment/details/{userId}`
  (linked course's enrollment)
- Source: `routes/event-detail/event-detail.component.ts:140-249`

### UC-3 · Enroll in an event

A single call from the detail page's right-menu card; on success the page
re-navigates with the new `batchId` and, for certain resource types, can
immediately kick off an "issue certificate after enroll" flow.

- API: `POST apis/proxies/v8/event/batch/enroll` —
  `{request:{userId, eventId, batchId}}`
- Source: `components/right-menu-card/right-menu-card.component.ts:307-348`
- **Non-obvious mechanism**: this is only one of three enrollment code
  paths that exist for "an event" across the platform — see
  [HLD](hld.md#three-parallel-enrollment-paths). Which one runs depends on
  which client/endpoint is used, not on any explicit choice by the
  learner.

### UC-4 · Check enrollment status / headcount

- APIs: `GET apis/proxies/v8/user/event/read/{userId}?eventId=...&batchId=...`
  (is-enrolled check, gates a NetCore analytics call) ·
  `POST apis/proxies/v8/course/v1/batch/getParticipants` (headcount)
- Source: `event-detail.component.ts` (`getUserIsEnrolled`,
  `getEnrolledUserCount`)

### UC-5 · Consume/attend the event

`EventPlayerComponent` hosts the post-enrollment viewing surface (PDF,
YouTube, or generic video child routes). Attendance/consumption is
recorded server-side against the same table used for course content
consumption — there is no event-specific consumption table on the write
path.

- API: `POST /v1/user/event/state/update` (course-service,
  `EventConsumptionActor`) — writes `status`/`progress`/`completedCount`
  into Cassandra `user_content_consumption`
- **Verification boundary**: the exact client call site that invokes this
  update endpoint from `EventPlayerComponent` was not traced in this pass
  — the actor-level contract is confirmed from `sunbird-course-service`,
  but the portal's player-side trigger point needs a follow-up read of
  `event-player.component.ts` and its viewer children if the LLD needs
  the precise event(s) that fire it.

### UC-6 · Download a certificate

- API: generic `downloadCertV2` call from `@sunbird-cb/utils-v2`'s
  `WidgetContentService`, `{request:{courseId, batchId, userId}}` — the
  same certificate-download plumbing used for courses
- Source: `event-detail.component.ts:handleOpenCertificateDialog()`

## Authoring journeys — Org Portal (event creation)

### UC-7 · Create and publish an event

A single-page reactive form (title, summary, description, agenda, type —
only "Webinar" is actually enabled — date/time, duration, conference
link, presenters). On submit, the org admin's client **immediately
publishes** the event; there is no visible "submit for review" step in
this flow.

- APIs: `POST apis/proxies/v8/event/v4/create` →
  `POST apis/proxies/v8/event/v4/publish/{id}` (status forced to `Live`)
- Source: `routes/events/routes/create-event/create-event.component.ts:402-532`
- **Known deviation**: the Creation Portal's review dashboard (UC-9) looks
  for events with `status:'SentToPublish'` as "New Requests," but nothing
  in this create flow sets that status. See
  [As-Built Requirements](as-built-requirements.md#known-deviations).

### UC-8 · Upload a cover image

- APIs: `POST apis/proxies/v8/action/content/v3/create` (asset node) →
  `POST apis/proxies/v8/upload/action/content/v3/upload/{id}` (binary)
- **Known deviation**: the follow-up call that would attach the uploaded
  image to the event and republish it is present in code but its
  invocation is commented out (`create-event.component.ts:522`) — an
  uploaded cover image may never actually get attached via this path.

## Authoring journeys — Creation Portal (review workflow)

### UC-9 · Review new event submissions

A queue split into "New Requests" (`status:'SentToPublish'`) and "Past
Requests" (`status:'Live'`), scoped to events not created by the CBP's own
org.

- API: `POST apis/proxies/v8/sunbirdigot/search` with
  `filters:{contentType:'Event', status:[...], createdFor:{'!=': [spvOrgId]}, startDate:{'>=': <phase-2 cutoff date>}}`
- Source: `routes/events-v2/components/dashboard/dashboard.component.ts:83-151`

### UC-10 · Publish or reject a reviewed event

Publish patches basic fields (name/description, and for "live" events a
meeting-agenda field) before publishing; if the event has a linked course,
it also patches that course's `eventLinked` array to link back. Reject
records a reason and moves status to `Rejected`.

- APIs: `PATCH apis/proxies/v8/event/v4/update/{id}` →
  `POST apis/proxies/v8/event/v4/publish/{id}` ·
  `POST apis/proxies/v8/event/v4/reject/{id}`
- Source: `routes/event-details/components/base/base.component.ts`

## Operational journeys — sunbird-cb-ext

### UC-11 · Bulk-onboard a CSV of attendees

An admin uploads a CSV of emails against an event+batch; the flow resolves
each email to a user ID, enrolls or completes their enrollment, and
(unless `publicCert`) awards karma points and issues a certificate per
row — with a `reissue` flag to force re-issuance for already-completed
rows.

- APIs: `POST /user/event/bulkOnboard` (v1) ·
  `POST /v2/user/event/bulkOnboard/{eventId}/{batchId}` (v2) · `GET /user/event/bulkonboard/status/{eventId}` ·
  `GET /user/event/bulkonboard/download/{fileName}`
- Source: `PublicUserEventBulkonboardController.java`,
  `PublicUserEventBulkonboardConsumer.java` (Kafka-consumer driven,
  topic `dev.public.user.event.bulk.onboard`)
- **Non-obvious mechanism**: karma points are only awarded on the
  non-public-certificate branch.

### UC-12 · Bulk-create/publish calendar events from a spreadsheet

A separate flow: an XLSX of "Calendar"-category events is uploaded, each
row is matched against existing content by name+channel via composite
search, and either updated or newly created, then published.

- API: `POST /calendar/v1/bulkUpload`
- Source: `CalendarBulkUploadServiceImpl.java:362-416`, consumer topic
  `dev.calendar.event.bulk.upload`

### UC-13 · Reconcile post-event completion and karma points (ops tool)

A manual, on-demand CSV upload (no scheduler, no Kafka trigger) that
recomputes a user's true completion timestamp from the event batch's end
time, marks the enrollment complete, issues a certificate if none exists,
and pushes a karma-point event.

- APIs: `POST /user/event/postConsumption` ·
  `POST /user/event/postConsumption/updateStatus` (corrective rollback)
- Source: `UserEventPostConsumptionServiceImpl.java:110-149,340-372`
- **Known deviation**: this class's karma-point push is a second,
  independently-written copy of the same logic in
  `ClaimEventKarmaPointsServiceImpl` — see
  [As-Built Requirements](as-built-requirements.md#known-deviations).

## Edge cases

| Situation | Behaviour |
|---|---|
| Learner enrolls via `/v1/event/enroll` vs `/v2/event/enroll` vs `/v1/eventset/enroll` | Three different actors, three different validation rule sets, two different Cassandra tables — "is this user enrolled" must be checked per-path |
| Event is part of an EventSet | Cannot be directly updated/published/retired/discarded — `EventActor.verifyStandaloneEventAndApply` rejects with a client error naming the parent EventSet |
| EventSet update | Only allowed while the EventSet is still `Draft` — all child Events are torn down and fully re-created on every update, never incrementally diffed |
| Org Portal event create → Creation Portal review queue | The create flow publishes directly (`status:'Live'`); the review queue expects `status:'SentToPublish'` — no traced code path sets that status from this create flow |
| Bulk-onboard the same CSV twice | Already-complete rows are only skipped for certificate re-issuance if `reissue=true`, otherwise marked `FAILED` |
| Cover image upload in Org Portal create flow | Uploaded but the attach-and-republish call is commented out — image may not appear on the published event |
| Event type selection in Org Portal | Only "Webinar" is enabled; "Ask me anything"/"Workshop"/"Interview" exist in code but are disabled |
| `meetup`/`app-event` microsite | A separate, unrelated feature sharing a similarly-named folder — not part of Events Hub; see the HLD's naming-collision note |