# Events Hub — APIs

Gateway prefixes stripped for readability. Verified from
`sunbird-cb-portal`, `sunbird-cb-orgportal`, `sunbird-cb-creationportal`,
`sunbird-cb-uiproxy`, `sunbird-cb-ext`, `sunbird-course-service`, and
`knowledge-platform` (branches/commits as listed in [index.md](index.md)).

## Content layer (knowledge-platform, Scala/Akka/Play)

Routes from `content-api/content-service/conf/routes:120-137`.

| Method | Route | Actor op | Notes |
|---|---|---|---|
| POST | `/event/v4/create` | `createContent` (inherited from `ContentActor`) | Rejects a client-supplied `contentType` |
| PATCH | `/event/v4/update/:id` | `updateContent` (`EventActor`-overridden) | Parses `startDateTime`/`endDateTime`, converts UTC→IST, requires `versionKey` |
| POST | `/event/v4/publish/:id` | `publishContent` (`EventActor`-specific) | Forces `status="Live"`; rejected if the Event has an inbound `EventSet` relation |
| GET | `/event/v4/read/:id` | `readContent` (inherited) | |
| DELETE | `/event/v4/discard/:id` | `discardContent` (inherited) | Rejected if part of an EventSet |
| DELETE | `/private/event/v4/retire/:id` | `retireContent` (inherited) | Rejected if part of an EventSet; deletes Redis key `{id}:user-event-enrolments` on success |
| POST | `/event/v4/reject/:id` | `rejectEvent` | Requires node status `sentToPublish`; sets `status="Rejected"` |
| PATCH | `/event/v4/system/update/:id` | `systemUpdate` | Direct metadata merge, no image-node dance |
| POST | `/eventset/v4/create` | `createContent` (`EventSetActor`-overridden) | Spawns one child `Event` node per `schedule.value` entry |
| PUT | `/eventset/v4/update/:id` | `updateContent` (`EventSetActor`-overridden) | Requires `Draft` status; rejects `status` in body; tears down + re-creates all children |
| POST | `/eventset/v4/publish/:id` | `publishContent` | Requires `Draft`; publishes every child Event, then the EventSet |
| GET | `/eventset/v4/hierarchy/:id` | `getHierarchy` | Computed live from Neo4j relations — **no Cassandra hierarchy cache**, unlike Course/Collection |
| GET | `/eventset/v4/read/:id` | `readContent` (inherited) | |
| DELETE | `/eventset/v4/discard/:id` | `discardContent` | Discards every child too — via `RetireManager`, not `DiscardManager` (see LLD gap) |
| DELETE | `/private/eventset/v4/retire/:id` | `retireContent` | Retires every child too |

Request envelopes: `{"request":{"event": {...}}}` / `{"request":{"eventset": {...}}}`.

## Course/enrollment layer (sunbird-course-service, Java/Scala)

Routes from `service/conf/routes:98-125`. **Three separate enrollment
families exist** — see [HLD](hld.md#three-parallel-enrollment-paths).

### Event Management (`EventManagementActor`, actor `event-management-actor`) — read/query + discard only, no create/publish

| Method | Route | Op |
|---|---|---|
| DELETE | `/v1/event/discard/:id` | `discardEvent` — delegates to content service HTTP, not local persistence |
| GET | `/v1/user/events/list/:uid` | `listEnrol` |
| GET | `/private/v1/user/events/list/:uid` | `getEnrol`/`getEnrolList` (private) |
| POST | `/v1/user/events/list/:uid` | `userEnrolList` |
| GET | `/v1/user/event/:uid` | `getEnrol` |
| POST | `/v2/user/event/state/read` | `getEventState` |
| GET | `/v2/featured/events` | `getFeatureEvent` — reads a Redis-cached ID list |
| GET | `/v2/mdo/trending/events` | `getTrendingEvent` — reads a per-org Redis-cached ID list |
| GET | `/v1/user/events/enroll/summary` | `getEnrolEventSummary` |
| POST | `/v2/user/events/list/:uid` | `userEnrolListByEventTypes` |

### EventSet Management (`EventSetManagementActor`) — update/discard only, no create/publish/list

| Method | Route | Op |
|---|---|---|
| PATCH | `/v1/eventset/update` | `updateEventSet` — blocked if any child event has active participants |
| DELETE | `/v1/eventset/discard/:id` | `discardEventSet` — same participant check |

### Event batch + enrollment (`EventsActor`, actor `event-batch-management-actor`)

| Method | Route | Op |
|---|---|---|
| POST | `/v2/event/batch/create` (+ `/private/v2/event/batch/create`) | `createEventBatch` — no corresponding `update` operation exists anywhere |
| POST | `/v2/event/enroll` | `enrollEvent` — writes `UserEventsDao` (`user_entity_enrolments`) + `BatchUserDao` |

### Generic Course actor reused for plain events

| Method | Route | Notes |
|---|---|---|
| POST | `/v1/event/enroll`, `/v1/event/unenroll` | Routes to `CourseEnrollmentController`/`CourseEnrollmentActor` — a **third**, Course-shaped enrollment path |
| GET | `/v1/event/participants/list`, `/v1/user/event/list/:uid` | Same controller |
| PATCH | `/v1/event/state/update` | `LearnerController.updateEventState` — not deep-traced in this pass |

### EventSet enrollment (`EventSetEnrolmentActor`, Scala, actor `eventset-enrolment-actor`)

| Method | Route | Op |
|---|---|---|
| POST | `/v1/eventset/enroll` | `enrol` — fans out to every child event, writes **`UserCoursesDao`** (course enrolment table), not `UserEventsDao` |
| POST | `/v1/eventset/unenroll` | `unenrol` |

### Consumption (`EventConsumptionActor`, Scala, actor `event-consumption-actor`)

| Method | Route | Op |
|---|---|---|
| POST | `/v1/user/event/state/read` | `getConsumption` — reads Cassandra `user_content_consumption` |
| POST | `/v1/user/event/state/update` | `updateConsumption` — writes the same table; **no Kafka instruction event emitted**, unlike the Course equivalent |

### Certificates (`CertificateActor` / `EventBatchCertificateActor`)

| Method | Route | Op |
|---|---|---|
| POST | `/v1/event/batch/cert/issue` | `issueEventCertificate` — hard-codes `eventCompletionPercentage=100.0`; publishes a hand-built JSON string (not the shared `InstructionEvent` model) to topic `user_issue_certificate_for_event` |
| PATCH | `/private/v1/event/batch/cert/template/add` | `addCertificateToEventBatch` |

> No route was found wiring a "remove event batch cert template" endpoint,
> even though `EventBatchCertificateActor.removeCertificateTemplateFromCourseBatch`
> exists in code — likely dead/unreachable.

## uiproxy (`sunbird-cb-uiproxy`) — BFF layer

Two dedicated single-route files, both requiring only Keycloak auth (not
in the role whitelist):

| Method | Path | Proxies to |
|---|---|---|
| GET | `/protected/v8/events/` | `${CONTENT_API_BASE}/live-events` |
| GET | `/protected/v8/event-external/` | Proxied to a fixed external site (`<EXTERNAL_SITE>`) |

Everything else rides the generic `/proxies/v8/*` catch-all
(`proxyCreatorSunbird`), forwarding to `KONG_API_BASE` 1:1 with no body
transformation. Key prefixes: `event/*`, `eventprogress/*`, `user/*`
(covers `user/events/...`, `user/event/...`, `user/v2/event/bulkonboard/...`).
Every generic route is gated by a per-role whitelist
(`src/utils/whitelistApis.ts`) — e.g. `event/v4/create` requires
`MDO_ADMIN, MDO_LEADER, SPV_ADMIN`; `event/v4/read/:id` is `PUBLIC`.

## cb-ext (`sunbird-cb-ext`) — supporting services

| Method | Path | Purpose |
|---|---|---|
| POST | `/calendar/v1/bulkUpload` | Calendar-category event bulk create/update from XLSX |
| POST | `/user/event/bulkOnboard` | Public bulk-onboard v1 (header auth) |
| POST | `/v2/user/event/bulkOnboard/{eventId}/{batchId}` | Public bulk-onboard v2 (bearer token) |
| GET | `/user/event/bulkonboard/status/{eventId}` | Status lookup |
| GET | `/user/event/bulkonboard/download/{fileName}` | Result CSV download |
| POST | `/user/event/postConsumption` | Ops reconciliation — completion + certificate + karma points |
| POST | `/user/event/postConsumption/updateStatus` | Corrective rollback — **has an operator-precedence bug**, see LLD |

`EventUtilityService` (internal, no controller) wraps: `POST
event-create-api` → `/event/v4/create`, `POST event-publish-api` →
`/event/v4/publish`, `PATCH event-update-api` → `/event/v4/update`, and a
composite-search call — all proxied straight through to
`knowledge-platform`.

## Verified payloads

```jsonc
// POST /apis/proxies/v8/event/batch/enroll (learner enroll, portal)
{ "request": { "userId": "…", "eventId": "…", "batchId": "…" } }
```

```jsonc
// POST /event/v4/create (Org Portal → uiproxy → knowledge-platform)
{
  "request": {
    "event": {
      "mimeType": "application/html",
      "category": "Event",
      "isExternal": true,
      "eventType": "Online",
      "startDate": "…", "endDate": "…", "startTime": "…", "endTime": "…",
      "registrationEndDate": "…",
      "creatorDetails": [/* presenters */],
      "resourceType": "…",
      "createdFor": ["…"]
    }
  }
}
```

```jsonc
// EventSet create — schedule shape the actor code actually reads
// (schemas/eventset/1.0/schema.json disagrees — see LLD gap)
{
  "request": {
    "eventset": {
      "name": "…", "code": "…", "eventType": "Online",
      "schedule": { "type": "NON_RECURRING", "value": [
        { "startDate": "…", "endDate": "…", "startTime": "…", "endTime": "…" }
      ]}
    }
  }
}
```

> **Verification boundary:** confirmed end-to-end from the 8 repos listed
> at the top. Not verified: the Kong API gateway's exact path-rewrite
> rules between `sunbird-cb-uiproxy`'s aliases and `sunbird-cb-ext`'s
> literal controller paths (several don't match 1:1 — e.g.
> `/proxies/v8/user/v2/event/bulkonboard/...` vs. cb-ext's
> `/v2/user/event/bulkOnboard/...`) — that rewrite lives in gateway
> config outside every repo traced. Also unverified: any consumer of the
> `dev.karma.points.unified.v2.event` Kafka topic (no consumer exists in
> `sunbird-cb-ext`), and the client-side call site in
> `EventPlayerComponent` that triggers `POST /v1/user/event/state/update`.