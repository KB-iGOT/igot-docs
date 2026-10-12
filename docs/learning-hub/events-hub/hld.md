# Events Hub — HLD

Reverse-engineered from `sunbird-cb-portal`, `sunbird-cb-orgportal`,
`sunbird-cb-creationportal`, `sunbird-cb-uiproxy`, `sunbird-cb-ext`,
`sunbird-course-service`, `knowledge-platform`, `knowledge-platform-jobs`.

## A naming collision worth flagging up front

The three portal frontends each contain **two unrelated features** that
share a similarly-named folder:

- **"Event Hub" proper** (`app/event-hub`, `pageId: 'app/event-hub'`) — the
  content-type-driven system this document covers: search/browse,
  enroll, consume, certify, plus role-split authoring/review.
- **`app-event` ("meetup")** — a small, single-external-API microsite
  (`event-external` proxy, `<EXTERNAL_SITE>`) with no enrollment and no
  data-model relationship to Event/EventSet content. It is not called
  "Event Hub" anywhere in its own code, and in two of the three portals
  its route is either unreachable (Org Portal — shadowed by a duplicate
  route declaration) or disabled outright (Creation Portal — commented
  out). **Out of scope** for the rest of this documentation set.

## Topology

```mermaid
flowchart TB
    subgraph Learner["Learner Web - sunbird-cb-portal"]
        EVH["events module - see-all, view-all, my-events, event-detail, event-player"]
        CEH["card-event-hub / event-card-v2 widgets"]
    end

    subgraph OrgAdmin["Org Admin - sunbird-cb-orgportal"]
        CreateE["create-event.component.ts"]
        ListE["list-event / view-event"]
    end

    subgraph CBPAdmin["CBP Review - sunbird-cb-creationportal"]
        Dash["events-v2 dashboard - review queue"]
        EventDetails["event-details wizard - publish/reject"]
    end

    GW["uiproxy /proxies/v8/... (Kong-routed pass-through)"]

    subgraph KP["knowledge-platform (Scala/Akka/Play)"]
        EA["EventActor - extends ContentActor"]
        ESA["EventSetActor - extends ContentActor, fans out to children"]
    end

    subgraph CS["sunbird-course-service"]
        EMA["EventManagementActor - read/query/discard only"]
        ESMA["EventSetManagementActor - update/discard only"]
        EventsActor["EventsActor - batch create + Event enroll"]
        ESEA["EventSetEnrolmentActor (Scala) - fans out to child events"]
        ECA["EventConsumptionActor (Scala)"]
        CourseEnrollActor["CourseEnrollmentActor (generic, reused for /v1/event/enroll)"]
        CertActor["CertificateActor / EventBatchCertificateActor"]
    end

    subgraph Ext["sunbird-cb-ext"]
        EUS["EventUtilityService - thin HTTP client to knowledge-platform"]
        CalBulk["CalendarBulkUploadService/Consumer"]
        PubBulk["PublicUserEventBulkonboardService/Consumer"]
        PostConsump["UserEventPostConsumptionService"]
        KarmaClaim["ClaimEventKarmaPointsServiceImpl"]
    end

    subgraph Jobs["knowledge-platform-jobs (Flink)"]
        PubPipe["content-publish: PublishEventRouter -> EventPublishFunction"]
        PostPub["post-publish-processor: BatchCreation, SamuhikCharchaEventLinkCourse"]
        CertGen["event-cert-generator (standalone job)"]
    end

    Neo4j[("Neo4j content graph")]
    Cass[("Cassandra: event_batch, user_entity_enrolments, user_content_consumption, public_user_event_bulkonboard, calendar_event_bulk_upload")]
    Redis[("Redis: extended-read cache, trending/featured event ID lists")]
    Kafka[("Kafka: dev.publish.job.request, dev.karma.points.unified.v2.event, dev.issue.certificate.request, dev.public.user.event.bulk.onboard, dev.calendar.event.bulk.upload")]

    EVH -->|REST search/read/enroll| GW
    CEH -.->|"server-config-driven, not statically wired"| EVH
    CreateE -->|REST create/publish| GW
    Dash -->|REST search/update/publish/reject| GW
    EventDetails -->|REST update/publish/reject| GW
    GW --> EA & ESA
    GW --> EMA & ESMA & EventsActor & ESEA & ECA & CourseEnrollActor & CertActor
    EA -->|writes + Kafka publish trigger| Neo4j
    EA -->|"publish trigger"| Kafka
    ESA -->|"spawns/tears down child Event nodes"| Neo4j
    ESA -->|"read hierarchy live, no Cassandra cache"| Neo4j
    EventsActor --> Cass
    ESEA -->|"writes course enrolment table per child event"| Cass
    ECA --> Cass
    EventsActor -->|"enrolment alert + cert issue"| Kafka
    CertActor -->|"issue-event-certificate"| Kafka
    EMA -->|"HTTP to content service"| KP
    ESMA -->|"HTTP to content service"| KP
    EUS -->|HTTP| KP
    CalBulk --> EUS
    CalBulk --> Kafka
    PubBulk --> Cass
    PubBulk --> Kafka
    KarmaClaim --> Kafka
    PostConsump --> Cass
    PostConsump --> Kafka
    Kafka -.->|"dev.publish.job.request"| PubPipe
    PubPipe --> PostPub
    PostPub -->|"batch creation"| Cass
    PostPub -->|"cross-links Event to Course"| KP
    Kafka -.->|"certificate triggers"| CertGen
    EMA -.->|"trending/featured ID lists"| Redis
```

## Responsibilities

| Component | Owns | Repo |
|---|---|---|
| `EventActor` | Event content CRUD/publish; enforces "can't modify an Event that belongs to an EventSet" | `knowledge-platform` |
| `EventSetActor` | EventSet CRUD/publish, cascading to child Event nodes it owns | `knowledge-platform` |
| `EventManagementActor` | Read/query/discard *only* — no create or publish; discard is an HTTP call to the content service, not local persistence | `sunbird-course-service` |
| `EventsActor` | Event batch creation + the "v2" plain-Event enrollment path (`user_entity_enrolments`) | `sunbird-course-service` |
| `EventSetEnrolmentActor` | EventSet enrollment — fans out to every child event, writes the **Course** enrolment table, not the Event one | `sunbird-course-service` |
| `EventConsumptionActor` | Attendance/progress tracking, shared Cassandra table with Course consumption | `sunbird-course-service` |
| `CertificateActor` / `EventBatchCertificateActor` | Certificate issuance trigger + template management for event batches | `sunbird-course-service` |
| `EventUtilityService` | Thin HTTP client wrapper — the only way `sunbird-cb-ext` talks to the content service for events | `sunbird-cb-ext` |
| `PublicUserEventBulkonboardConsumer` | Kafka-driven bulk CSV onboarding: enroll, certify, award karma points per row | `sunbird-cb-ext` |
| `UserEventPostConsumptionServiceImpl` | On-demand ops reconciliation of completion/certificates/karma points | `sunbird-cb-ext` |
| `PublishEventRouter` / `EventPublishFunction` | Flink consumer of the publish-instruction Kafka topic; lightweight Event publish side-effects (no ecar packaging, unlike Course) | `knowledge-platform-jobs` |
| `BatchCreation` (post-publish) | Auto-creates the Event's default batch and links cert templates after publish | `knowledge-platform-jobs` |
| `SamuhikCharchaEventLinkCourse` | iGOT-specific: cross-links a published Event back to its linked Course | `knowledge-platform-jobs` |
| `event-cert-generator` | Standalone Flink job dedicated to Event certificate generation | `knowledge-platform-jobs` |
| Event Hub browsing UI (`events` module) | Search/browse/enroll/consume UX | `sunbird-cb-portal` |
| `create-event.component.ts` | Org-admin authoring, auto-publishes on submit | `sunbird-cb-orgportal` |
| `events-v2` dashboard + `event-details` wizard | CBP review queue, publish/reject, course cross-linking | `sunbird-cb-creationportal` |

## Three parallel enrollment paths

The single biggest architectural fact about this feature: **"enrolling in
an event" has three independent implementations**, not one:

1. `POST /v1/event/enroll` → generic `CourseEnrollmentController` /
   `CourseEnrollmentActor` — an Event enrolled exactly like a Course.
2. `POST /v2/event/enroll` → `EventsActor.eventEnroll` — Event-specific,
   writes `UserEventsDao`/`user_entity_enrolments`, carries iGOT-specific
   rules (Bharat Kalp eligibility, Samuhik Charcha linked-course checks, a
   hard-coded campaign end-date cutoff).
3. `POST /v1/eventset/enroll` → `EventSetEnrolmentActor` — fans out to
   every child Event of an EventSet, but writes into the **Course**
   enrolment table (`UserCoursesDao`) per child, not the Event one.

Each has different validation, different tables, and different
side-effects (only path 2 emits a Kafka enrolment alert). "Is this user
enrolled in this event" therefore has no single query — which table to
check depends on which path was used to enroll them.

## Key design decisions

- **Event/EventSet are content nodes, not a separate service.** Both
  extend `ContentActor` and persist through the same Neo4j
  `DataNode`/`GraphService` machinery as Course/Collection — there is no
  bespoke Event datastore in `knowledge-platform`.
- **EventSet's children are full Event nodes, materialized synchronously
  at create/update time**, connected via the same `hasSequenceMember`
  relation type Course→CourseUnit uses — not a lightweight batch/schedule
  table. Every `EventSetActor.update()` tears down and fully re-creates
  all children rather than diffing them.
- **EventSet hierarchy bypasses the Cassandra hierarchy cache** that
  Course/Collection rely on — `getHierarchy` always reads Neo4j relations
  live. A deliberate simplification, not parity with Course.
- **Enrollment, consumption, and certification are each split across
  multiple non-shared implementations** (three enroll paths; two
  independently-written karma-point Kafka producers; two Kafka mechanisms
  for certificate issuance — Course uses the shared `InstructionEvent`
  enum/model, Event hand-builds a JSON string). This is the feature's
  dominant maintenance risk, not a one-off gap.
- **Authoring and review are two unrelated implementations, not
  role-gated views of one flow.** Org Portal's create form and Creation
  Portal's review dashboard were independently written, share only the
  backend `event/v4/*` API family, and disagree on what status a
  freshly-created event should have.

See [LLD](lld.md) for storage detail, state machines, and sequence flows,
and the [Operations Manual](operations-manual.md) for how these decisions
surface in day-2 support.