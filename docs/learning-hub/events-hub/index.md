# Events Hub

A live/virtual-event content type (webinars, talks, multi-session series)
that reuses the platform's Course infrastructure end to end — Event and
EventSet are graph content nodes like Course, enrollment reuses
course-style Cassandra tables, and certificates/karma-points reuse the
Course certificate pipeline with parallel, event-specific code paths.

- **Content types**: `Event` (single occurrence) and `EventSet` (a
  schedule-driven parent that auto-generates one child `Event` per
  occurrence)
- **Learner-facing route**: `app/event-hub` (portal) — branded "Event Hub"
  in the actual routing code (`pageId: 'app/event-hub'`)
- **Status**: ⚠️ several real inconsistencies below, not just gaps —
  see [As-Built Requirements](as-built-requirements.md) for the full list

## In one paragraph

A Karmayogi finds an Event through search, a home-page card, or the
dedicated Event Hub browsing pages, opens its detail page, and enrolls
with a single call. Behind that one action, the platform actually has
**three different, independently-implemented enrollment code paths**
(plain Event via the generic Course actor, plain Event via a dedicated
Event actor, and EventSet via yet another actor that fans out to every
child Event) — which one runs depends on which endpoint the calling
client happens to use. Authoring is split by role across two separate
portals with two separate implementations: org admins create and
auto-publish events in the Org Portal, while the Creation Portal runs a
parallel review queue keyed on a `status` value that the Org Portal's
own create flow never appears to set. Certification and karma-point
awarding are triggered from at least four different places (course-service
cert issuance, cb-ext bulk onboarding, cb-ext post-consumption
reconciliation, knowledge-platform's dedicated cert-generator job) with
duplicated, non-shared logic in more than one of them.

## How a Karmayogi experiences it

1. **Discovers** an event via global search, a home-page "today's/live
   events" widget (`card-event-hub`), or the Event Hub's own browse pages
   (`see-all`, `view-all`, `my-events`).
2. **Opens the detail page**, which shows schedule, description, and (if
   the event has a linked course) that course's enrollment/progress.
3. **Enrolls** with one click — a single `POST event/batch/enroll` (or one
   of two other possible enrollment endpoints, see [HLD](hld.md)).
4. **Attends/consumes** the event; progress is written to the same
   Cassandra table used for course content consumption.
5. **Receives a certificate**, if eligible — triggered either automatically
   post-publish, via an admin's bulk-onboard CSV upload, or via an ops-run
   reconciliation script; every path hard-codes 100% completion rather
   than checking real consumption data.
6. **Earns karma points** for attendance, pushed to a shared Kafka topic
   by two independently-written, near-identical producer methods.

## Actors

| Actor | Role |
|---|---|
| Karmayogi (learner) | Discovers, enrolls in, attends, and gets certified for events |
| Org Admin / MDO Admin / SPV Admin | Authors and publishes events for their organization, in the Org Portal |
| CBP Admin (Creation Portal) | Reviews/rejects/publishes events submitted for review, links them to courses |
| Platform ops | Runs bulk-onboarding CSV uploads and post-consumption reconciliation scripts (cb-ext) |

## The one decision that defines the feature

> An EventSet is not a separate "batch" concept the way CourseBatch is —
> it is a parent content node that, on create, synchronously spawns one
> full `Event` content node per schedule entry and wires them together
> with a native `hasSequenceMember` graph relation. A child Event created
> this way can never be managed directly again — `EventActor` explicitly
> checks for an inbound `EventSet` relation and rejects any direct
> update/publish/retire/discard on it.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the reconstructed
requirement set with every known deviation called out.

> **Verification boundary:** this feature set is sourced from 7 repos, each
> checked out on the branch with its own most-recent commit at analysis
> time: `sunbird-cb-portal` (`cbrelease-4.8.40.1`, `86550d431`),
> `sunbird-cb-orgportal` (`cbrelease-4.8.41`, `90f9be63`),
> `sunbird-cb-creationportal` (`cbrelease-4.8.41`, `5a0f8b5de`),
> `sunbird-cb-uiproxy` (`cbrelease-4.8.40`, `80d1585`), `sunbird-cb-ext`
> (`4.8.40.1-KB-15294`, `7a46b27c`), `sunbird-course-service`
> (`cbrelease-4.8.41`, `95cb3c90`), `knowledge-platform`
> (`4.8.41-KB15457`, `b7f050a4`), and `knowledge-platform-jobs`
> (`dev-4.8.41-devops`, `bfec7231`). A separate, smaller "meetup" microsite
> also lives under a similarly-named `app-event` folder in the three portal
> repos — it is a distinct, unrelated feature (single external API, no
> enrollment, not called "Event Hub" anywhere in its own code) and is out
> of scope for this documentation set; see the HLD's naming-collision note.