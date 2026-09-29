# Marketplace — As-Built Requirements

Requirements reconstructed from the shipped implementation across 9 repos
(branches/commits listed in [index.md](index.md)) — what the system does
today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for Marketplace was available in
any of the 9 repos — both `cb-pores-service` and `cios-content-service`
ship effectively empty READMEs with no architecture or requirement
content. This document reconstructs requirements **from the shipped
implementation** across partner master data (`cb-pores-service`), catalog
ingestion (`cios-content-service`), enrollment/entitlement
(`cb_external_enrollment_service`), the duplicate external-course
subsystem (`sunbird-course-service`), the gateway layer
(`sunbird-cb-uiproxy`, `sunbird-devops`), and the three frontend portals.
Each requirement traces to file(s)/function(s) that implement it.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Partner registration and licensing

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL allow an external organisation to self-register as a content partner, generating a unique `applicationId` of the form `IGOT-<ORGWORD>-<5charHex>` and setting status `PENDING`. | `ContentPartnerRegistrationServiceImpl.insert()`, lines 64-122 |
| FR-002 | Self-registration SHALL be rejected if an existing registration shares the same organisation name or email. | `ContentPartnerRegistrationServiceImpl.insert()`, lines 72-83 |
| FR-003 | The system SHALL notify the applicant by email on submission, approval, and rejection, with rejection requiring a mandatory comment. | `NotificationConsumer.processContentPartnerNotification()`, lines 71-137; `ContentPartnerRegistrationServiceImpl.update()`, lines 140-148 |
| FR-004 | Approving a registration SHALL auto-provision a full `ContentPartner` record with a generated `partnerCode` and licensing defaults initialised to zero/disabled. | `ContentPartnerRegistrationServiceImpl.saveContentPartnerIfApproved()`; `ContentPartnerServiceImpl.createContentPartner()`, lines 182-250 |
| FR-005 | Once a partner's `licenseType` (`User` or `Course`) is set, the system SHALL reject any further attempt to change it. | `ContentPartnerServiceImpl.updateContentPartner()`, lines 103-111 |
| FR-006 | Deactivating or reactivating a partner SHALL cascade the `isActive` flag to every one of that partner's ingested content records in Elasticsearch, asynchronously via Kafka. | `ContentPartnerServiceImpl.activate()`/`delete()`; `ContentPartnerConsumer.updateAllPartnerContents()`, lines 61-96 |
| FR-007 | The system SHALL support configuring partner SSO via SAML, including a "test connection" flow that validates the SAML config before persisting it. | `SSOController`; `sso-integration.component.ts` `testSsoUrl()`, lines 80-156 |

### Catalog ingestion

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The system SHALL accept a partner's course catalog as an uploaded Excel/CSV file, store the raw file to GCS, and process it asynchronously via Kafka. | `CiosContentController.loadContentFromExcel()`; `OnboardContentConsumer.consumeMessage()`, line 54 |
| FR-011 | Each catalog row SHALL be transformed using a partner-specific JOLT transform spec fetched from `cb-pores-service`, then validated against a JSON-Schema before persistence. | `DataTransformUtility.processRowsAndCreateLogs()`, lines 499-532; `PayloadValidation/ContentFileValidation.json` |
| FR-012 | A content item's `courseType` SHALL default to `"paid"` if not supplied in the source row. | `DataTransformUtility.updateProcessedDataInDb()`, lines 366-369 |
| FR-013 | Re-ingesting a catalog row whose existing content is already `live` or `draft` SHALL be a no-op (confirmed empty branch, not merely undocumented). | `DataTransformUtility.saveOrUpdateCornellContent()`, lines 410-412 |
| FR-014 | The system SHALL support four partner-specific progress-sync jobs (Cornell, Coursera, CDAC, Harvard), each independently triggerable via a scheduler endpoint. | `SchedulerController`, lines 34-56 |

### Curation and publishing

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The Creation Portal SHALL present a curation queue split into "Live" and "For Publish" tabs, keyed on the ingested course's `status` field (`live` vs. `draft`/`notInitiated`). | `curation-content.component.ts`, lines 85-94 |
| FR-021 | A curator SHALL be able to tag a course with competency area/theme/sub-theme and free-text search tags before publishing. | `competency-configuration.component.ts`; `compentencies-mapping.component.ts` |
| FR-022 | A curator SHALL be able to set `courseType`, `courseEnrolLimit`, and `requiredKarmaPoints` on a course, with course-type and karma-point fields locked once the course's status is `live`. | `compentencies-mapping.component.ts`, `isCoursePublished` getter, line 322 |
| FR-023 | Saving as draft and publishing SHALL both route through the same onboard-content API, distinguished only by a `status` parameter. | `MarketPlaceServicesService.formateOnboardContent()`, lines 93-132 |
| FR-024 | A curator SHALL be able to preview a course exactly as a learner would see it, via the same public CIOS detail URL used at runtime. | `curation-content.component.ts` `openPreview()`, lines 792-799 |

### Enrollment and entitlement

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | The system SHALL enforce four independent partner-scoped enrollment limits — overall, per-user, concurrent, and per-course — before writing a marketplace-course enrollment. | `EnrollmentServiceImpl`, lines 658-907 |
| FR-031 | A successful enrollment SHALL publish a Kafka counter-update event keyed by `partnerId + "_" + userId`, and SHALL sync the partner's consumed-license count back to `cb-pores-service`. | `EnrollmentServiceImpl.enrollUserInCourse()`, line 550, 605; `TransformUtility.updateContentPartnerLicenseConsumedCount()`, lines 204-229 |
| FR-032 | The system SHALL support a named Coursera integration that invites enrolled users into Coursera programs via an internal service-registry proxy. | `TransformUtility.callCourseraInviteApi()`, lines 357-420; `application.properties` lines 93-97 |
| FR-033 | Certificate issuance for a partner course SHALL read the certificate template and karma-point rule from the partner's own record. | `KafkaConsumer` certificate generation consumer, ~lines 260-274 |
| FR-034 | The native course-service SHALL independently support external-course enrollment against its own Cassandra table, entirely separate from `cb_external_enrollment_service`'s enrollment store. | `CourseEnrolmentActorV3.scala`, lines 91-112, 536-548 (`externalCoursesEnrolment_db`) |
| FR-035 | The native course-service SHALL merge external-course completions into a user's overall badge/certification summary via a dedicated CIOS search call filtered on `contentPartner.isActive`. | `ExtendedBadgeEnrollmentActor.scala`, lines 121-143, 773-834 |

### Learner discovery

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | The learner-facing portal SHALL provide a dedicated provider directory (all providers → provider detail → catalog / micro-site / training calendar). | `browse-by-provider-routing.module.ts`, lines 21-112 |
| FR-041 | The learner-facing portal SHALL also expose partner content through a home-page spotlight card that routes to a generic content-browsing module filtered to a "Providers" tab, telemetry-tagged as the `Marketplace` module. | `in-spotlight-v2.component.ts`, lines 28,39; `see-all-dynamic.component.ts`, lines 46, 732 |
| FR-042 | The competency passbook SHALL display externally-acquired course credentials in a distinct "Marketplace" tab, separate from native platform achievements. | `competency-card-details-v2.component.ts`, lines 108-146, 151-163 |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | Every marketplace/CIOS/partner gateway route SHALL be subject to JWT auth, CORS, metrics, role-based ACL, and hourly rate-limiting, applied uniformly by the same 5-plugin Kong stack used for every other domain. | `ansible/roles/kong-api/defaults/main.yml`, sampled routes lines 826-840, 13765-13780 |
| NFR-002 | Partner-record CRUD endpoints (`contentpartner/v1/create|update|read|search|delete`) SHALL require only the baseline `PUBLIC` session role, while `activate` and `register/*` endpoints SHALL require an admin role — this is the as-shipped access model, not a claim that it is the intended one. | `whitelistApis.ts`, lines 4209-4243 vs. 6895-6970, 7034 |
| NFR-003 | Search-result and provider-record lookups SHALL be cached in Redis with a configurable TTL (default 600s). | `application.properties:50`; `ContentPartnerServiceImpl.generateRedisJwtTokenKey()`, lines 449-461 |

## Constraints / assumptions baked into the build

| ID | Constraint | Source |
|---|---|---|
| CON-001 | Neither the Admin Portal's `marketplace-provider` routes nor the Creation Portal's `market-place`/`curation`/`external-contents` routes carry a client-side `canActivate` guard — access control, if any, is entirely server-side. | `marketplace-provider.module.ts` route definitions; `ws-auth-root-routing.module.ts` lines 44-51; absence confirmed by repo-wide `canActivate`/`guard` grep in both repos |
| CON-002 | There is no dedicated backend base-URL configuration for CIOS/content-partner traffic in `sunbird-cb-uiproxy` — every such request rides the single shared `KONG_API_BASE`, meaning routing decisions for this feature are made entirely inside Kong (`sunbird-devops`), outside the proxy repo's visibility. | `src/utils/env.ts`, lines 5-179 (no `CIOS_API_BASE`/`PORES_API_BASE` present) |
| CON-003 | No typed domain model exists for `Provider`, marketplace course, or content-upload log rows anywhere in the Admin Portal's marketplace module — everything is `any`-typed and accessed via lodash `.get()` path strings. | Confirmed absent across `routes/marketplace-provider/`; only `SsoConfiguration` and two filter-tree models are typed |
| CON-004 | Two structurally independent onboarding UI flows coexist in the Admin Portal (`onboard-partner` legacy, `configure-provider` current); the dashboard only ever links to the current one, leaving the legacy flow reachable only by a bookmarked/typed URL. | `market-place-dashboard.component.ts`, `navigateToConfiguration()` (dead, line 272) vs. `navigateToConfigurationV2()` (live, line 280) |
| CON-005 | The learner-facing CIOS detail/enroll page depends on a third-party npm package (`@sunbird-cb/collection-v2`) whose source is not present in any of the 9 repos traced — its actual REST contract with the backend cannot be verified from this codebase. | `AppTocCiosHomeComponent`; `package.json:54` |
| CON-006 | `cios-content-service` has Kong routes and a Helm chart but no confirmed Jenkins build/deploy job and is absent from the `deploy-igot` Ansible service list — its actual deployment mechanism is unconfirmed. | `kubernetes/ansible/roles/deploy-igot/tasks/main.yml`, lines 66-90; `find deploy/jenkins -iname "*cios*"` → zero results |

> **Verification boundary:** every requirement above traces to a specific
> file/function in one of the 9 repos listed in [index.md](index.md); none
> are inferred from how "similar Sunbird repos usually work." Gaps and
> inconsistencies are stated as such, not smoothed over. Not covered:
> requirements that might exist only in a product/requirements-management
> tool outside these repos, and any behaviour inside the third-party
> `@sunbird-cb/collection-v2` package (CON-005).
