# Marketplace

A partner/external-content ecosystem layered alongside the native Course
pipeline — third-party providers (Coursera, Cornell, Harvard, CDAC, and
others onboarded ad hoc) are registered, licensed, and have their catalogs
ingested through a **separate storage, enrollment, and entitlement stack**
that only loosely interoperates with native platform content.

- **Core entities**: `ContentPartner` (a licensed provider/organisation) and
  `ContentPartnerRegistration` (a partner's self-service application before
  approval) — both owned by `cb-pores-service`, not by the content/graph
  layer that owns `Course`.
- **Admin-facing route**: `/app/home/marketplace-providers`
  (`sunbird-cb-adminportal`) — module folder is literally named
  `marketplace-provider`.
- **Curation-facing route**: `/author/cbp/market-place-content` and
  `/author/curation/marketplace/:partnerId/external-contents`
  (`sunbird-cb-creationportal`).
- **Learner-facing routes**: `/app/toc/ext/:id` (CIOS content detail/enroll,
  `sunbird-cb-portal`) and `/app/learn/browse-by/provider` (provider
  directory, `sunbird-cb-portal`).
- **Status**: ⚠️ several real gaps below, not just missing docs — see
  [As-Built Requirements](as-built-requirements.md) for the full list.

## In one paragraph

A content partner is either onboarded directly by a platform admin
(`sunbird-cb-adminportal`'s Marketplace Providers dashboard) or self-registers
and is approved later (`cb-pores-service`'s `ContentPartnerRegistration` →
`ContentPartner` promotion). Once active, the partner's catalog is ingested
by uploading an Excel/CSV file that `cios-content-service` transforms
per-partner (JOLT spec fetched from `cb-pores-service`) and indexes into its
own Postgres table + Elasticsearch index — a completely separate store from
the platform's Neo4j/Cassandra content graph. A curator in
`sunbird-cb-creationportal` reviews each ingested course, tags it with
competencies, sets `courseType` (paid/free), `courseEnrolLimit` and
`requiredKarmaPoints`, and publishes it. A learner discovers the course via
the provider directory or a spotlight card, opens a dedicated CIOS detail
page (`app-toc-cios-home`), and enrolls through
`cb_external_enrollment_service` — a **third, independent enrollment
engine** (distinct from both the native Course enrollment path and
`sunbird-course-service`'s own parallel "external course" subsystem) that
enforces per-partner license caps (overall / per-user / concurrent /
per-course) before writing the enrollment.

## How a Karmayogi experiences it

1. **Discovers** a partner course via the "iGOT Marketplace" home spotlight
   card (routes into the generic see-all module's Providers tab, telemetry
   module tagged `'Marketplace'`) or via the dedicated Browse-by-Provider
   directory (`all-providers` → `:provider/:orgId` → catalog/micro-site/
   training-calendar).
2. **Opens the detail page** at `app/toc/ext/:id` (`AppTocCiosHomeComponent`)
   — content and enrollment state are fetched through the
   `@sunbird-cb/collection-v2` library, not a directly-visible REST call.
3. **Enrolls** via `POST /cios-enroll/v1/create` — validated first against
   the partner's license limits (overall, per-user, concurrent, per-course
   caps, all enforced in `cb_external_enrollment_service`).
4. **Progress** for the course is synced back from the partner's own LMS,
   either by one of four partner-specific scheduler jobs in
   `cios-content-service` (Cornell/Coursera/CDAC/Harvard) or by a
   Kafka-driven "receive progress from partner" consumer in
   `cb_external_enrollment_service`.
5. **Certifies and earns karma points** — `cb_external_enrollment_service`
   reads the certificate template and karma-point rule off the partner
   record and fires a Kafka certificate-generation event;
   `sunbird-course-service` separately merges external-course completions
   into the user's badge/certification summary via its own parallel
   `ExtendedBadgeEnrollmentActor` logic.

## Actors

| Actor | Role |
|---|---|
| Karmayogi (learner) | Discovers, enrolls in, consumes, and gets certified for partner/marketplace courses |
| Content Partner (external org) | Registers (self-service or admin-onboarded), uploads its catalog, is licensed with enrollment/karma caps |
| Marketplace/CBP Admin (Admin Portal) | Onboards and configures providers — details, SSO, certificate template, licensing, API integration |
| Content Curator (Creation Portal) | Reviews each ingested course, tags competencies, sets enrollment/licensing metadata, publishes |
| Platform ops | Runs/monitors partner content-ingestion and progress-sync jobs |

## The one decision that defines the feature

> Marketplace/external content is not a variant of the platform's native
> content model — it is a **parallel universe with its own storage,
> its own enrollment engine, and its own entitlement logic**, stitched to
> the native platform only at the edges. `cb-pores-service` owns the partner
> master record (Postgres + Elasticsearch); `cios-content-service` owns the
> ingested catalog (a *different* Postgres table + a *different*
> Elasticsearch index, despite both nominally being "CIOS content");
> `cb_external_enrollment_service` owns yet another local mirror
> (`CiosContentEntity`) plus the actual enrollment/license-limit enforcement;
> and `sunbird-course-service` — the service that owns *native* course
> enrollment — independently re-implements a second, largely-duplicate
> "external course" enrollment and badge-merge subsystem
> (`CourseEnrolmentActorV3`/`ExtendedCourseEnrollmentActor`/
> `ExtendedBadgeEnrollmentActor`) against its own separate Cassandra table
> (`externalCoursesEnrolment_db`). No single service is the definitive
> owner of "is this user enrolled in this partner course" — the answer
> depends on which of at least three independently-written code paths you
> ask.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the reconstructed
requirement set with every known deviation called out.

> **Verification boundary:** this feature set is sourced from 9 repos, each
> checked out on the branch with its own most-recent *release* commit at
> analysis time (2026-09-22): `cb-pores-service` (`cbrelease-4.8.40`,
> `cca638f`), `cios-content-service` (`cbrelease-4.8.40`, `0f12efc`),
> `cb_external_enrollment_service` (`cbrelease-4.8.41`, `1772bec`),
> `sunbird-course-service` (`cbrelease-4.8.41`, `95cb3c90`),
> `sunbird-cb-uiproxy` (`cbrelease-4.8.41`, `423875a`),
> `sunbird-cb-adminportal` (`cbrelease-4.8.40.1`, `5fd82767`),
> `sunbird-cb-creationportal` (`cbrelease-4.8.40`, `ab91df5d1`),
> `sunbird-cb-portal` (`cbrelease-4.8.40`, `88cee51f1`), and
> `sunbird-devops` (`cbrelease-4.8.41`, `978c17a12`). The
> `@sunbird-cb/collection-v2` npm package that backs the learner-facing CIOS
> detail page (`app-toc-cios-home` in `sunbird-cb-portal`) is a third-party
> dependency with no local source in any of the 9 repos — its actual REST
> calls are out of scope and are called out as unverified in the relevant
> sections below. Kong's exact path-rewrite rules between
> `sunbird-cb-uiproxy`'s proxy prefixes and each backend's literal
> controller paths are configured in `sunbird-devops`
> (`ansible/roles/kong-api/defaults/main.yml`) and were cross-checked there,
> not assumed.
