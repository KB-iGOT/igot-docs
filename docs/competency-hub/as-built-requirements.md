# Competency Hub — As-Built Requirements

Requirements reconstructed from the shipped implementation across
`frac-backend` (`cbrelease-4.8.10`, `6fa1954`, tagged
`cbrelease-4.8.10_RC1`), `frac-dictionary` (`cbrelease-4.8.8`, `3eb7e05`),
`sunbird-cb-portal` (`cbrelease-4.8.41`, `2c8cc4d`),
`sunbird-cb-orgportal` (`cbrelease-4.8.41`, `0725ce0`),
`sunbird-cb-uiproxy` (`cbrelease-4.8.41`, `c620db2`),
`sunbird-cb-ext` (`cbrelease-4.8.41`, `f001170`),
`cb-ext-course-service` (`cbrelease-4.8.41`, `b1ca807`),
`igot_karmayogi_mobile` (`master`, `e0deaf5`),
`knowledge-platform-jobs` (`cbrelease-4.8.41`, `5395bdf`),
`knowledge-platform` (`cbrelease-4.8.41`, `38bf7d9`),
`sunbird-course-service` (`cbrelease-4.8.41`, `bad54e9`),
`sunbird-devops` (`cbrelease-4.8.41`, `bc73939`), and
`sunbird-cb-workflow` (`cbrelease-4.8.39.2`, `8ae07a0`, checked and
confirmed uninvolved) — what the system does today, not what was
originally intended. `frac-backend` and `frac-dictionary` were added in a
second pass after the first eleven repos' trace identified a service
called `fracentity-service` that none of them contained; both are ~2 years
behind the rest of the platform's release cadence (Feb/Mar 2024 vs. Sept
2026 everywhere else) — flagged, not resolved, here.

## Purpose and method

No original requirements/spec document for Competency Hub was available in
any of the 13 repos traced. This document reconstructs requirements **from
the shipped implementation** — it states what the system actually does
today (as-built), not what was originally intended. Requirement IDs:
`FR-0xx` (`sunbird-cb-portal`), `FR-1xx` (`sunbird-cb-orgportal`), `FR-2xx`
(`sunbird-cb-uiproxy`), `FR-3xx` (`sunbird-cb-ext`), `FR-4xx`
(`cb-ext-course-service`), `FR-5xx` (`igot_karmayogi_mobile`), `FR-6xx`
(`knowledge-platform-jobs`), `FR-7xx` (`knowledge-platform` /
`sunbird-course-service`, both thin), `FR-8xx` (`frac-backend`), `FR-9xx`
(`frac-dictionary`), `NFR-xxx` (non-functional), `CON-xxx`
(constraint/assumption), `DEV-xxx` (unintended deviation).

## Functional requirements — `sunbird-cb-portal`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL provide two generations of a Browse-by-Competency directory (v1 and v2), routed independently, with v2 the one actually linked from navigation. | `src/app/app-routing.module.ts:244-270` |
| FR-002 | The system SHALL provide a standalone "Competencies" assessment/achievements module in source, but SHALL NOT route to it — its path is commented out. | `src/app/app-routing.module.ts:114-128` |
| FR-003 | The system SHALL provide a Competency Passbook at a root-level page (not under `app/`), with `list` and `details` child routes. | `src/app/routes/route-page.module.ts:92-96` |
| FR-004 | The Passbook SHALL read the taxonomy via `apis/proxies/v8/framework/v1/read/kcmfinal_fw` (the `knowledge-platform` mirror, not `frac-backend`) and the learner's own competencies via `apis/proxies/v8/learner/v1/competency/read`. | `src/app/competency-passbook/competency-passbook.service.ts:6-15` |
| FR-005 | The system SHALL let a Karmayogi self-attest current and desired competencies, each at a selectable proficiency level, during profile-v3 setup only (no equivalent found in profile-v2 or mobile). | `project/ws/app/src/lib/routes/profile-v3/**` |
| FR-006 | Self-attested competencies SHALL persist via a generic profile-patch endpoint (`user/v1/extPatch`), writing `profileDetails.competencies` and `profileDetails.desiredCompetencies` separately. | `.../profile-v3/services/profile_v3.service.ts:9-13` |
| FR-007 | Content search/browse SHALL be facetable by `competencies_v6.competencyAreaName/ThemeName/SubThemeName`. | `.../search-v3/models/search-v3.model.ts:45,105-107` |
| FR-008 | An author tagging content with a competency that doesn't yet exist SHALL be able to submit a request for a new one via a dedicated popup. | `project/ws/author/.../competency-add-popup/**` |
| FR-009 | Notifications of sub-category `EXTERNAL_TRAINING` SHALL deep-link directly into the Competency Passbook list. | `src/app/services/notifications.service.ts:224-226` |

## Functional requirements — `sunbird-cb-orgportal`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-100 | The system SHALL provide one shared `CompetencyAddComponent` widget, independently reused across community posts, events, and content-demand requests. | `project/ws/app/src/lib/common/competency-add/competency-add.component.ts:1-243` |
| FR-101 | The system SHALL provide an ODCS (Org Designation↔Competency) bulk-upload flow: sample-file download, upload, progress polling, and result download. | `.../home/routes/odcs-mapping/**` |
| FR-102 | The system SHALL let an MDO admin attach competencies (with proficiency `level`) to Work Allocation roles/activities, via two independently-built UIs (v1 search-based, v2 drag-and-drop). | `.../workallocation/**`, `.../workallocation-v2/**` |
| FR-103 | The system SHALL let an MDO admin create a content-demand request scoped to a specific Competency Area/Theme/Sub-Theme. | `.../home/components/request-list/create-request-form/create-request-form.component.ts:24-100` |
| FR-104 | `CompetencyResolverService` SHALL be defined to prefetch competency data for the state-profile module, but its route `resolve` registration and DI provider SHALL both be commented out — it is unreachable. | `.../state-profile/resolvers/competency.resolver.ts`; `state-profile-routing.module.ts:14-24,105-111` |

## Functional requirements — `sunbird-cb-uiproxy`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-200 | The system SHALL provide two hand-written routers (`competency.ts`, `frac.ts`) that call FRAC directly, in addition to generic Kong pass-through for every other competency path. | `src/protectedApi_v8/competency.ts`, `frac.ts` |

## Functional requirements — `sunbird-cb-ext`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-300 | The system SHALL expose a browse/search-by-competency directory backed by Redis-cached facets pulled from Composite Search + `frac-backend`, not by a locally-owned competency table. | `src/main/java/org/sunbird/searchby/service/SearchByService.java:55-118,542` |
| FR-301 | The system SHALL process ODCS bulk uploads asynchronously via Kafka, capped at 1000 rows per batch, validating every row against `kcmfinal_fw` before writing anything. | `OrgDesignationCompetencyMappingServiceImpl.java:81-181,960` |
| FR-302 | For each new competency introduced by an ODCS mapping, the system SHALL create or update a Term in `knowledge-platform`'s Framework API (`kcmfinal_fw`) and then publish the framework — the only write path in this feature that mutates that taxonomy. It does not call `frac-backend`. | `OrgDesignationCompetencyMappingServiceImpl.java:1017,1208,1227,1246` |
| FR-303 | The system SHALL verify (and create if needed) every competency attached to a Work Allocation role against `frac-backend` before the document saves — the one path in this repo that does hit the real taxonomy service. | `AllocationService.java:516,529`; `AllocationServiceV2.java:392` |
| FR-304 | `OrgDesignationMappingController`'s methods SHALL be named with "Competency" in them, but the service they delegate to SHALL contain no competency logic — naming leftover, not a second competency feature. | `OrgDesignationMappingController.java:19-47`; absence of `competenc*` in `OrgDesignationMappingServiceImpl` |

## Functional requirements — `cb-ext-course-service`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-400 | The system SHALL expose exactly one learner-facing competency endpoint, `GET /learner/v1/competency/read`, resolving the user from an auth token. | `LearnerCompetencyController.java:27-33` |
| FR-401 | A cache-miss read SHALL fall back to Cassandra; if no row exists yet, the system SHALL publish a `COMPETENCY_ACQUIRED{isFirstTimeUser:true}` event and return an empty list rather than blocking on a backfill. | `CompetencyServiceImpl.java:51-158` |
| FR-402 | A successful Cassandra read SHALL be cached in Redis with a configurable TTL, default 3600 seconds. | `CompetencyServiceImpl.java:51-105`; `application.properties:153` |
| FR-403 | CB Plan content enrichment SHALL pass through a content item's `competencies_v5` field unmodified — this repo does not manage or validate that data. | `ContentInfoServiceImpl.java:150-178` |

## Functional requirements — `igot_karmayogi_mobile`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-500 | The system SHALL implement a full, dedicated Competency Passbook feature module — screens, widgets, models, repository, and service — independent of the web implementation. | `lib/features/competency_passbook/**` |
| FR-501 | The Passbook's primary competency-data endpoint SHALL be server-config-driven (`modules.competencyConfig.apiUrl`), not hardcoded, allowing the backend path to change without an app release. | `lib/core/configurations/app_global_config.dart:397-401,816-820` |
| FR-502 | The system SHALL tag each Passbook entry by acquisition source: iGOT Learning, Self Declared, or ATI/CTI Reported. | `competency_theme_course_tabbed_view.dart:245-253` |
| FR-503 | A learner adding a manual achievement SHALL be able to self-declare which competency it demonstrates via a 3-level Area→Theme→Subtheme picker. | `lib/features/profile/presentation/widgets/competency_selector_bottom_sheet.dart:10` |
| FR-504 | The system SHALL provide MDO-channel and ATI/CTI-microsite "Competency Strength" views showing an organisation's aggregate competency data — an org-level, not per-learner, read. | `lib/features/mdo_channels/.../mdo_competency_strength_view.dart:22,166-169` |
| FR-505 | The route constant `/competencyHub` SHALL be declared and referenced from onboarding copy and the Explore-hub menu, but SHALL have no matching case in the app's route switch. | `lib/core/router/app_routes.dart:14`; absence in `lib/core/router/routes.dart` |

## Functional requirements — `knowledge-platform-jobs`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-600 | Three independent certificate-generator jobs (`event-cert-generator`, `collection-certificate-generator`, `common-certificate-generator-utility`) SHALL each fire a `COMPETENCY_ACQUIRED` Kafka event when a certificate is issued, tagged with a `contextType` distinguishing external training, iGOT courses, or general content. | `CertificateGeneratorFunction.scala` in each job (e.g. `event-cert-generator:394-403,758-761`) |
| FR-601 | `user-competency-updater` SHALL be the sole consumer of that event, resolving the content's `competencies_v6` field from the content-service and upserting the learner's Cassandra row, deduplicating by `acquiredContextId`. | `UserCompetencyPreProcessorFn.scala:616,698-815` |
| FR-602 | A `COMPETENCY_ACQUIRED{isFirstTimeUser:true}` event SHALL trigger a full backfill from the learner's existing enrolment and external-training history, not just an incremental update. | `UserCompetencyPreProcessorFn.scala:57-83,146-203` |
| FR-603 | The "karma-points-processor"/"karma-points-persist-processor" modules in this same repo SHALL have zero code ties to the competency taxonomy, despite adjacency in the codebase. | Confirmed by exhaustive `competenc*` grep across both directories: zero matches |

## Functional requirements — `knowledge-platform` / `sunbird-course-service` (thin repos)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-700 | `knowledge-platform` SHALL reserve five versioned competency fields on its content-model schemas (`competencies` through `competencies_v6`), each an unvalidated `array` of `object`, with no dedicated controller, service, or model class for any of them. | `schemas/content/1.0/schema.json:1233-1521` (and `collection`/`asset`/`questionset` equivalents) |
| FR-701 | `knowledge-platform`'s content-versioning copy-forward logic SHALL carry only `competencies_v6` to a new content version, not the older field variants. | `content-api/content-service/conf/application.conf:793` |
| FR-702 | `sunbird-course-service` SHALL permit exactly two competency field names (`competencies_v5`, `competencies_v6`) through its Elasticsearch field-selection whitelists, with no competency-specific controller, service, or model anywhere in the repo. | `externalresource.properties:212,266` |

## Functional requirements — `frac-backend`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-800 | The system SHALL model every taxonomy entity (Competency, CompetencyArea, CompetencyType, Role, Position, Activity, KnowledgeResource, Sector, CompetenciesLevel) as one generic `DataNode`, distinguished only by a `type` discriminator, not as per-type classes/tables. | `models/DataNode.java:22-69`; `models/Entities.java:10-12` |
| FR-801 | The system SHALL represent the entity hierarchy via a hardcoded parent→child map (`POSITION→ROLE→{ACTIVITY,COMPETENCY}`, `COMPETENCY→COMPETENCIESLEVEL`, `ACTIVITY→KNOWLEDGERESOURCE`), not a graph database or a generic adjacency model. | `utils/TaggingConstants.java` (`CHILD_NODE`) |
| FR-802 | New or edited nodes SHALL enter an `UNVERIFIED` state and require sequential approval by an `FRAC_REVIEWER_L1` ("technical review") and then an `FRAC_REVIEWER_L2`/`FRAC_ADMIN` ("review board") before counting as fully verified. | `service/impl/VerificationServiceImpl.java:61-124` |
| FR-803 | An L1 rejection SHALL be terminal (the node never reaches L2); an L2 rejection SHALL instead return the node to the L1 queue (`status=UNVERIFIED, secondaryStatus=REJECTED`), not kill it. | `VerificationServiceImpl.java` (L1 vs. L2 branch logic, lines ~90-124) |
| FR-804 | Only `POSITION`, `ROLE`, `COMPETENCY`, `ACTIVITY` node types SHALL enter the review workflow; `KNOWLEDGERESOURCE`, `COMPETENCIESLEVEL`, `COMPETENCYAREA`, `SECTOR` SHALL never appear in a verification queue. | `TaggingConstants.TAGGING_MAP` |
| FR-805 | Once a node's `secondaryStatus` reaches `VERIFIED`, only `FRAC_REVIEWER_L2`/`FRAC_ADMIN` SHALL be permitted to edit it further. | `DataNodeServiceImpl.java:289-302` (`checkUserAccesstoEdit`) |
| FR-806 | The system SHALL support bulk node import via a multipart `.xlsx` upload (node rows on sheet 1, optional competency-level rows on sheet 2), parsed with Apache POI and routed into the same create/update path as a programmatic bulk call. | `POST /frac/uploadDataNode`; `DataNodeServiceImpl.java:154-267` |
| FR-807 | Every node mutation (create/update/publish/verify/delete) SHALL emit a Sunbird-style `Audit` telemetry event onto Kafka topic `dev.telemetry.raw`, fire-and-forget. | `ActivityServiceImpl.java:378` |
| FR-808 | The system SHALL support per-node user feedback/rating, with the average computed via an Elasticsearch aggregation over the `frac-commentrating` index. | `POST /frac/nodeFeedback`, `GET /frac/getNodeRatingAverage`; `FRACDaoImpl.java:1955-2015` |
| FR-809 | Role membership SHALL be resolved per-request from an external `learner-service` (`GET /v1/user/read/{userId}`), not derived from the caller's JWT claims. | `utils/AuthUtil.java:43-106`; `application.properties:34` |
| FR-810 | The system SHALL cache every node and mapping in memory at boot (`ConfigurationPanel`) as its primary read path, with `GET /frac/flushReloadCache` as the only way to force a reload by type or in full short of a restart. | `ConfigurationPanel.java` (`run()`, `setChildNodes()` lines 71-77,400-440) |
| FR-811 | On node rejection, the system SHALL email the node's creator a deep link back into the FRAC authoring UI (a frontend not present in this or any other traced repo). | `VerificationServiceImpl.java:161-181` |
| FR-812 | The system SHALL push verified/updated node data into a dedicated `frac-dictionary` Elasticsearch index and call an external webhook (`webhook.callback.url`) to notify a downstream "frac-dictionary-backend" service. | `FRACDictionaryService`; `application.properties:29` |

## Functional requirements — `frac-dictionary`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-900 | The system SHALL be a static Gatsby site for browsing the competency dictionary. | `package.json:4` |
| FR-901 | The system SHALL let a visitor browse Competencies, Roles, Activities, and Positions ("Designations"), plus a cross-entity keyword search and a dynamically-generated per-competency detail page. | `src/pages/*.js`; `gatsby-node.js:799-855` (`createPages`) |
| FR-902 | The system SHALL source its data directly from Elasticsearch — a build-time bulk pull (`gatsby-source-elasticsearch`) plus a runtime proxy that re-queries the same ES `_search` endpoint for facet filtering — and SHALL NOT call `frac-backend`'s REST API at any point. | `gatsby-config.js:166-178`; `app/routes/graphql.js:112-948`; absence of any `/frac/*`-shaped call anywhere in the repo |
| FR-903 | The system SHALL expose faceted filtering on Competencies (Area/Type/Sector) and Positions (Department/Sector), each via its own runtime GraphQL query against the ES-backed proxy. | `CompetencyView.js:47-73`; `PositionView.js:47-49` |
| FR-904 | The system SHALL expose a webhook (`POST /api/v1/site/update`) that triggers a full `gatsby clean && gatsby build && ... deploy` cycle, presumably called by `frac-backend` after data changes. | `app/routes/site.js:6-17`; `app/utils/gatsby.js:5-7` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | The real competency taxonomy CRUD API SHALL be served by `frac-backend` (`fracentity-service` in Kong), confirmed by matching `FRACController` method names to what the gateway routers call by name. | `sunbird-devops:ansible/roles/kong-api/defaults/main.yml:98,231`; `frac-backend:FRACController.java` |
| NFR-002 | No repo in this trace SHALL own a migration/schema file for the `user_competency_mapping` Cassandra table — its shape is inferred only from column-alias config and test fixtures. `frac-backend`'s own MySQL schema is equally unmigrated (hand-written JDBC, no Flyway/Liquibase, no JPA entities). | Absence confirmed across `cb-ext-course-service`, `knowledge-platform-jobs`, and `frac-backend` |
| NFR-003 | The learner's acquired-competency record SHALL be written by two independently-triggered mechanisms (synchronous first-read, asynchronous certificate event) with no shared code and no cross-call between the owning repos. | `cb-ext-course-service:CompetencyServiceImpl.java` vs. `knowledge-platform-jobs:UserCompetencyPreProcessorFn.scala` |
| NFR-004 | No shared client library SHALL exist across `sunbird-cb-portal`, `sunbird-cb-orgportal`, and `igot_karmayogi_mobile` for competency data access — each independently implements its own service wrapper around the same backend endpoints. | Independent `*.service.ts`/`*_service.dart` files per repo, no common package |
| NFR-005 | `sunbird-devops` SHALL deploy the four services most central to the broader competency vocabulary (`ai-cbp-mdo-service`, `cbp-ai-service`, `cbp-ai-ui`, `cb-ext-course-service`) via generic Helm/Ansible, with `cb-ext-course-service` backing 63 Kong routes — by far the largest competency-adjacent route surface in the platform's gateway config. | `sunbird-devops:ansible/roles/kong-api/defaults/main.yml` (route count) |
| NFR-006 | `frac-backend` SHALL authenticate every request via a self-contained, locally-verified Keycloak JWT check (RSA signature against a locally-cached public key), not a live call to Keycloak for validation itself. | `validation/KeycloakValidation.java:54-72` |
| NFR-007 | `frac-backend` SHALL wire a full Kafka consumer configuration (`@EnableKafka`, `ConcurrentKafkaListenerContainerFactory`) but SHALL NOT actually consume any topic — it is producer-only in practice; grepping the entire repo for `@KafkaListener` returns zero results. | `kafka/consumer/KafkaConsumerConfig.java`; absence of `@KafkaListener` anywhere in `src/main` |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | `sunbird-cb-orgportal`'s global competency config key is spelled `compentency` (transposed), with a fallback to the correct spelling. | Any environment/config that only sets `competency` (correct spelling) without also setting `compentency` may silently fail to configure this module, depending on evaluation order. | `src/app/services/init.service.ts:347` |
| CON-002 | Competency schema-version selection (`v5` vs `v6`) is controlled independently in at least four places across three repos, with no shared constant. | A version-migration decision (e.g. retiring `v5`) requires coordinated changes across `sunbird-cb-orgportal`, `sunbird-cb-ext`, `igot_karmayogi_mobile`, and `knowledge-platform-jobs` — there is no single flag to flip. | See HLD, "Key design decisions" |
| CON-003 | The ODCS bulk-upload worker in `sunbird-cb-ext` writes new terms into `knowledge-platform`'s `kcmfinal_fw` framework, not `frac-backend`; `frac-backend`'s own taxonomy is instead written to via its L1/L2-reviewed `addDataNode`/`verifyDataNode` path. Two separate write paths for what most of the platform treats as one taxonomy. | A defect in either write path corrupts a *different* taxonomy than the other — there is no single place to look for "did someone break the competency data." | `OrgDesignationCompetencyMappingServiceImpl.java:1017-1246`; `frac-backend:FRACController.java` |
| CON-004 | No competency self-assessment, scoring, or gap-analysis engine exists anywhere in the 13 repos traced. | Any product or support conversation about "competency assessment" in this feature is necessarily about self-attestation (unscored) — a genuine scored/AI-driven gap analysis exists only in the separately-documented AI CBP Tool feature. | Absence confirmed across all 13 repos; contrast with `ai-cbp-tool/hld.md` |
| CON-005 | No code in any of the 13 repos traced reconciles `frac-backend`'s MySQL/Elasticsearch data with the `kcmfinal_fw` mirror inside `knowledge-platform`. | Whether these two taxonomies are meant to converge via a process outside this trace, or have simply diverged, is unanswerable from source — treat data differences between them as expected, not as a bug to chase in either repo alone. | Exhaustive cross-reference search across both repos' source, zero hits |
| CON-006 | `frac-backend` declares three different port numbers for itself across its own config surface: `server.port=8091` (`application.properties`), Kong routes `fracentity-service` to `:8083`, and its own `Dockerfile` `EXPOSE`s `8090`. | A fresh deploy following any single one of these configs in isolation may not be reachable from the others without reconciling them first. | `frac-backend:application.properties:2`; `sunbird-devops:kong-api/defaults/main.yml:231`; `frac-backend:Dockerfile:6` |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | Web's standalone "Competencies" assessment/achievements module is fully built but unreachable — its route is commented out. | FR-002 | `sunbird-cb-portal:src/app/app-routing.module.ts:114-128` |
| DEV-002 | `sunbird-cb-orgportal`'s `CompetencyResolverService` is fully implemented but its route resolver and DI provider registrations are both commented out. | FR-104 | `sunbird-cb-orgportal:state-profile-routing.module.ts:14-24,105-111` |
| DEV-003 | `sunbird-course-service`'s `course_content_allowed_fields` whitelist (includes `competencies_v6`) is defined and has a `JsonKey` constant, but no call site in the repo references that constant. | FR-702 | `sunbird-course-service:JsonKey.java:1289`; absence of further references |
| DEV-004 | Mobile's `/competencyHub` route constant is referenced from product-facing config and copy but has no case in the route switch. | FR-505 | `igot_karmayogi_mobile:app_routes.dart:14`; absence in `routes.dart` |
| DEV-005 | `sunbird-cb-ext`'s `OrgDesignationMappingController` (a *different* controller from the ODCS one) has method names containing "Competency" despite its delegated service having no competency logic at all — apparent copy-paste residue. | FR-304 | `OrgDesignationMappingController.java:19-47` |
| DEV-007 | `frac-backend`'s `POST /frac/appendMapNodes` endpoint is live and callable, but its entire method body is commented out — it always returns `true` and performs no work. | FR-801 (mapping mutation) | `frac-backend:DataNodeServiceImpl.java:326-358` |
| DEV-009 | `frac-backend` declares `PathRoutes` constants for a per-type endpoint design (`ADD_POSITION`, `GET_ALL_POSITIONS`, `ADD_ROLE`, `ADD_ACTIVITY`, `ADD_KNOWLEDGE_RESOURCE`, `GET_CONTENT_SEARCH`) that are never mapped to any controller method — superseded by the generic `addDataNode`/`getAllNodes` endpoints but never removed. | FR-800 | `frac-backend:utils/PathRoutes.java:12,24-28`; absence in `FRACController.java` |
| DEV-010 | `frac-backend` ships standalone `Role.java`/`Position.java`/`Activity.java`/`KnowledgeResource.java` model classes that are never instantiated anywhere in the codebase — vestiges of an earlier per-type design collapsed into the generic `DataNode`. | FR-800 | `frac-backend:models/{Role,Position,Activity,KnowledgeResource}.java`; absence of instantiation elsewhere |
| DEV-011 | `frac-backend`'s `application.properties` has an unresolved git merge-conflict marker checked in at lines 48-55, spanning the SSO/public-key config properties — the file as committed at this commit would not parse cleanly. | NFR-006 | `frac-backend:application.properties:48-55` |

## Out of scope (not reconstructible from these 13 repos)

- `knowledge-platform`'s Framework/Category/Term implementation, in the
  same depth `frac-backend` was traced to — only its role as ODCS's write
  target and as the `kcmfinal_fw` read source was confirmed here.
- Any mechanism (if one exists at all, outside these 13 repos) that
  reconciles `frac-backend`'s data with the `kcmfinal_fw` mirror — searched
  for specifically, found nowhere in this trace.
- The `learner-service` that `frac-backend` calls for role/permission
  lookups (`GET /v1/user/read/{userId}`) — only the call into it is
  visible here.
- The "frac-dictionary-backend" service `frac-backend` posts a rebuild
  webhook to — its own identity/implementation wasn't independently
  confirmed beyond `frac-dictionary`'s matching `POST /api/v1/site/update`
  route.
- The FRAC authoring UI that a rejected node's notification email deep-
  links into — not present in any of the 13 repos traced.
- The content-service component that populates `competencies_v6` when
  content is tagged during authoring — only the read side (content-service
  serving that field back out) is visible in this trace.
- The exact status-value enum and any retry/resume behaviour for a
  partially-failed ODCS bulk-upload batch.
- `cbp-ai-service`, `ai-cbp-mdo-service`, and `cbp-ai-ui` — deliberately not
  re-documented here; see [AI CBP Tool](../learning-hub/ai-cbp-tool/as-built-requirements.md)
  for their own, already-traced requirement set. Those three repos use the
  same Behavioural/Functional/Domain vocabulary from a bundled, static KCM
  dataset — a *third* copy, distinct from both `frac-backend`'s own data
  and the `kcmfinal_fw` mirror — and the relationship between that bundled
  dataset and either live taxonomy is unconfirmed from any of the traces.

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to the
> repo named in its ID prefix or Source column, at the commit listed at the
> top of this page — no requirement here is inferred without a citation. No
> original spec/ticket existed to verify these against (see Purpose and
> method); this document is reconstructed from shipped behaviour across 13
> repos, not compared to an approved requirement set. `fracentity-service`
> — the single biggest gap in the first pass — is now closed: it's
> `frac-backend`, fully traced above. What replaced it as the open
> question is whether `frac-backend` and the `kcmfinal_fw` mirror inside
> `knowledge-platform` are supposed to be the same data, kept in sync by
> something outside these 13 repos, or have genuinely diverged — no code
> here answers that either way. `knowledge-platform`'s Framework API
> internals and the content-service's write-side remain external to this
> trace — attaching either would convert the relevant sections from
> as-built to a gap analysis.
