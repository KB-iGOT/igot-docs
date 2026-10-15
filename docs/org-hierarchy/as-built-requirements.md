# Organisation Hierarchy — As-Built Requirements

Requirements reconstructed from the shipped implementation across 7 repos
(commits listed in the [LLD](lld.md) boundary note) — what the system does
today, not what was originally intended. Companion to the [HLD](hld.md),
[LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements or specification document for Organisation Hierarchy
was available in any repo. These requirements are reconstructed **from the
shipped implementation** of the MDO and admin portals, the shared tree
component, the BFF proxy, `cb-pores-service`, `sunbird-cb-ext` and the
gateway configuration. Each requirement traces to file(s) or function(s).

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint or assumption baked into the build), `DEV-xxx` (known
deviation / divergence between implementations).

## Functional requirements

### Creating a hierarchy

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | A root organisation SHALL be able to have exactly one hierarchy, created by copying the master framework `org_hierarchy` to `<orgId>_org_hierarchy`, publishing it, and recording `orgHierarchyFrameworkId` and `orgHierarchyFrameworkStatus=COMPLETED` on the organisation. | `cb-pores › OrgServiceImpl.createOrgHierarchyFramework:396-460`, `createFramework:247-255` |
| FR-002 | Creation SHALL be allowed only to users holding one of the configured roles (`MDO_ADMIN, MDO_LEADER, SPV_ADMIN, SPV_PUBLISHER, STATE_ADMIN`). | `OrgServiceImpl:412-416`, `application.properties:138` |
| FR-003 | Creation SHALL be idempotent: if the org already carries a framework ID it SHALL be returned unchanged; if the status is `FAILED` or blank and no ID exists, a new copy SHALL be made. | `OrgServiceImpl:426-457` |
| FR-004 | The portal SHALL show the tree only when the resolved root organisation carries `orgHierarchyFrameworkId`; for a department whose `ministryOrStateType` is ministry/state the root SHALL be its `ministryOrStateId`. | `org-hierarchy-mapping.component.ts:126-137, 397-430` |

### Editing the tree

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-010 | The tree SHALL be rendered from `framework/v1/read/<orgHierarchyFrameworkId>`, one column per category, enriched with the org record (`org/v1/search`) and user counts (`user/v1/search`). | `framework.service.ts:62-104` |
| FR-011 | An admin SHALL be able to create, update, retire a term under a category and publish the framework from the tree view. | `tree-hierarchy.service.ts:30-60` |
| FR-012 | Clicking a node SHALL navigate to that organisation's user list using `additionalProperties.orgId`. | `org-hierarchy-mapping.component.ts:254-258` |

### Bulk upload

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | The sample template SHALL contain a `referenceSheet` with the framework's category codes as headers and a read-only `masterData` sheet (`orgId, orgName, DisplayName`, col 3 hidden) listing organisations under the root, wired as dropdowns, with duplicate highlighting on the reference sheet. | `OrgHierarchyServiceImpl.bulkUploadOrganisationMapping:85-135` |
| FR-021 | Upload SHALL be accepted only with a valid user token and a row count within the configured cap; the file SHALL be stored and an `INITIATED` record written before the API returns. | `bulkUploadOrgHierarchyMapping:182-240` |
| FR-022 | Processing SHALL create a **new** framework `<orgId>_org_hierarchy_<epochMillis>` per upload and load rows into it, never into the existing framework. | `OrgHierarchyBulkUploadConsumer:254-262` |
| FR-023 | Each cell SHALL be in the form `Name<orgId>`; rows SHALL be rejected for blank L1, gaps in the chain, unknown org (by id or name) in master data, multiple parents, multiple levels, or circular references. | `processHierarchyRow:353-420` |
| FR-024 | A child term SHALL be linked to its parent by appending its identifier to the parent term's `associations` after re-reading the parent's current associations. | `processHierarchyRow:461-486`, `fetchLatestAssociationsFromKM:799-840` |
| FR-025 | On completion the sheet SHALL be re-uploaded with `Status` and `Error` columns per row; the record SHALL carry total / successful / failed counts; status SHALL be `SUCCESSFUL` only if no row failed and the final publish succeeded. | `processBulkHierarchyUpload:316-330` |
| FR-026 | If at least one row succeeded, the framework ID supplied in the request SHALL be retired and the org re-pointed to the new framework; if none succeeded the new framework SHALL be retired. | `processBulkHierarchyUpload:332-346` |
| FR-027 | Progress listing and result download SHALL be restricted to users of the same root org or the SPV channel. | `validateUserOrgId:317-328` |

### Keeping the tree complete

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | Every organisation created through `org/ext/v1/create` (new org or new channel) SHALL be added as a term in the first category of `<sbRootOrgId>_org_hierarchy`, with retries, and the framework published. | `ExtendedOrgServiceImpl.createOrg:210-214`, `OrgHierarchyForNewOrgConsumer:100-167` |
| FR-031 | The same create SHALL insert or update a row in Postgres `org_hierarchy_v4` with `mapid`, `parentmapid` (`SPV` for State/Ministry), `sborgid`, `sbrootorgid`, and L1/L2 snapshot columns. | `ExtendedOrgServiceImpl.createOrg:154-209` |
| FR-032 | `org/level/hierarchy` SHALL return the active tenant children of each requested MDO from `mdo_children_lookup`, cached in Redis for 4 h. | `OrgLevelHierarchyServiceImpl:54-139` |

### Public sign-up

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | A new user SHALL be able to pick ministry (with its L1 departments in the same list), state, department-of-state and organisation from paginated, free-text-searchable pickers without being logged in. | `public-signup.component.ts:1468-2200`, uiproxy `publicApiV8.ts:342-400` |
| FR-041 | The ministry and state endpoints SHALL apply a configured default filter set when the caller sends none; a caller-supplied `filters` object SHALL replace it. | `OrgController.java:28-42, 141-180`, `externalresource.properties:128-129` |
| FR-042 | The organisation endpoint SHALL resolve descendants by joining `levelZeroOrgId`/`levelOneOrgId` into `parentPathId` and matching `parentPathId.raw` with a wildcard; `hierarchyRequestType=All` SHALL include every depth. | `SearchHandlerActor.java:715-742`, `ElasticSearchHelper.java:982-1030` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | Upload processing SHALL be asynchronous via Kafka, partitioned by root org id. | `kafkaProducer.pushWithKey(topic, uploadedFile, rootOrgId)` |
| NFR-002 | After publishing a new framework the consumer SHALL wait for it to become readable, up to 10 attempts × 5 s. | `populateDataFromFrameworkTerm:606-626` |
| NFR-003 | The master-data list for the root org is fetched from knowledge-mw **for every cell** processed (`frameworkUtil.getMasterData` inside the level loop), so processing cost grows with rows × levels. | `processHierarchyRow:424` |
| NFR-004 | The auth token of the uploading user is carried in the Kafka message and used for the org PATCH at the end of processing; a long run with an expired token will log a failed org update. | `bulkUploadOrgHierarchyMapping:234`, `processBulkHierarchyUpload:335` |

## Constraints and assumptions

| ID | Constraint | Source |
|---|---|---|
| CON-001 | Depth is fixed at 10 levels by configuration and by the master framework's category count. | `org.hierarchy.level.count=10`, `org.hierarchy.headers.references` |
| CON-002 | The root org id is derived from the framework id by `split("_")[0]`, so org ids must not contain `_`. | `OrgHierarchyServiceImpl:217`, consumer `:232` |
| CON-003 | The upload row cap reuses the designation/competency upload cap. | `maximumRowAllowedForDesignationCompetencyUpload` |
| CON-004 | Term lookup inside a category is by display name (`findTermInFramework(…, levelName)`), so two orgs with the same name at the same level resolve to one term. | `processHierarchyRow:432` |
| CON-005 | Template header names must equal the master framework's category names — the consumer passes the sheet header as `category` in KM calls. | `processBulkHierarchyUpload:229-233, 286` |
| CON-006 | learner-service `org/update` is a generic pass-through to Cassandra + ES (only `rootOrgId`, `contactDetails`, `status` stripped), so whichever client PATCHes a hierarchy attribute owns its correctness — there is no server-side derivation of `parentPathId`/`hierarchyLevel`. | `OrganisationManagementActor.updateOrgData:224-330`, `cassandratablecolumn.properties:164-175` |
| CON-007 | `ministryOrStateId/Name/Type` are derived **once, at org create**, from Postgres `org_hierarchy_v4` by `parentMapId` (department → ministry/state) and only when `organisationSubType=board`; later tree edits do not re-derive them. | `ExtendedOrgServiceImpl.fetchStateOrMinistryDetails:1066-1098` |

## Known deviations

| ID | Deviation | Source |
|---|---|---|
| DEV-001 | **Two naming schemes for the per-org framework.** cb-pores creates `<orgId>_org_hierarchy`; every bulk upload creates `<orgId>_org_hierarchy_<ts>` and retires the previous. The new-org consumer always targets the fixed name `<sbRootOrgId>_org_hierarchy`, so after the first successful bulk upload new organisations are added to a retired framework (or fail to read it) and never appear in the live tree. | `OrgServiceImpl:249`, `OrgHierarchyBulkUploadConsumer:736-741`, `OrgHierarchyForNewOrgConsumer:111` |
| DEV-002 | `FAILED` upload status can coexist with a replaced tree (≥1 row ok). The UI status therefore does not say whether the org was re-pointed. | `processBulkHierarchyUpload:316-346` |
| DEV-003 | Three unreconciled hierarchy stores: framework (Neo4j), `org_hierarchy_v4` (Postgres, written on create/update only), `mdo_children_lookup` (Postgres, writer not found). Edits in the tree view do not touch Postgres; bulk upload does not touch Postgres. | HLD "three stores" |
| DEV-004 | `org/level/hierarchy` response shape differs between cache hit (`result.count`, `result.response=[…]`) and cache miss (`result.response={count, content}`). | `OrgLevelHierarchyServiceImpl:100-104, 136-139` |
| DEV-005 | `OrgHierarchyRepository` queries reference `l3MapId` (`isChildOrgPresent`, `findAllOrgByParentMapId`) while the `OrgHierarchy` entity maps only `l1mapid`/`l2mapid`; the column's existence is assumed from the DB schema. | `OrgHierarchyRepository.java:58-63`, `OrgHierarchy.java:38-41` |
| DEV-006 | Repo defaults `org.level.hierarchy.es.limit=0` and `…offset=2000` are passed as `limit`/`offset` to org search; with those values the search returns nothing, so environments must override them. | `application.properties:643-644`, `handleChildrenScenario:116-117` |
| DEV-007 | The `includeOrgId` flag on cb-pores `processFrameworkCreate` is accepted but does not affect the generated name. | `OrgServiceImpl:206-249` |
| DEV-008 | cb-pores writes the framework id/status to the org **twice** — a learner-service PATCH and a direct Cassandra `updateRecord` on `sunbird.organisation`. | `OrgServiceImpl:436-445, 372-393` |
| DEV-010 | `sunbird-cb-portal` carries `org/v1/list` constants and wrapper methods in three services (`public-signup/signup.service.ts`, `welcome/public-welcome.service.ts`, `profile-v2-revamp.service.ts`) that no component calls; the live sign-up uses `org/hierarchy/*/search`. Dead client code. | grep of `getStatesOrMinisteries\|getDeparmentsOfState\|getOrgsOfDepartment` in `*.component.ts` |
| DEV-011 | `parentPathId` is only ever **cleared** by a portal (tree view, after `term/retire`); no portal, cb-ext, cb-pores or learner-service code path sets it to a value. The sign-up organisation picker filters on it. | `tree-view.component.ts:779-786`, `updateOrgDetailsToDB:1008-1009`, `OrganisationManagementActor.updateOrgData` (pass-through) |
| DEV-012 | `hierarchyLevel` has **no writer** in any attached repo or remote branch, yet the ministry picker's default filter requires `hierarchyLevel in [levelZero, levelOne]`. Both Cassandra columns exist (`cassandratablecolumn.properties:174-175`). Populated outside the traced code (migration script or newer build) — unverified. | `git grep` across `refs/remotes/*` of the six portal/backend repos |
| DEV-013 | `sunbird-cb-adminportal` create-MDO edits a state/ministry through `updateStateOrMinistry`, which **POSTs** `{request:{orgName, channel, organisationType, …}}` to `org/ext/v1/update` — a **PATCH** route that needs a flat `orgId`+`orgName` and rejects non-`board` rows anyway. The call cannot succeed as written; no other caller of `org/ext/v1/update` exists in the five web repos. | `create-mdo.services.ts:103-108`, `create-mdo.component.ts:676-686, 839`, `ExtendedOrgController.java:26`, `ExtendedOrgServiceImpl.update:925-958` |
| DEV-014 | Kong routes `/org/v1/ext/search` to **learner-service** `v1/org/search`, so cb-ext's `orgExtSearch` (Postgres-scoped by `sbrootorgid` then hydrated) is unreachable through the gateway. | `kong-api/defaults/main.yml:3920-3922` vs `ExtendedOrgController.java:45` |
| DEV-015 | `org/v2/ext/signup/search` and `getNodalOfficer` are Kong-exposed cb-ext routes with no caller in `sunbird-cb-portal`, `-orgportal`, `-adminportal`, `-multitenant-staticweb` or `sb-cb-ui-components` (mobile app not attached). | grep across the five repos |
| DEV-016 | `org/ext/v2/update`'s allow-list differs between repo (`logo,orgName,orgId,description`) and deployment (`+parentPathId`); with the repo default the tree view's retire-time PATCH is rejected with 400 `Field : parentPathId is not allowed to be updated.` | `application.properties:569`, `sb-cb-ext-service-env.j2:578`, `validateRequestFieldsV2:1125-1146` |
| DEV-017 | `org/v1/list/{key}` and `org/v2/list/{key}` differ silently: v1 returns direct children by `parentmapid` and knows `globalngo`; v2 returns every descendant that has a Sunbird org (`parentmapid` or `l1/l2/l3MapId` match, `sborgid` not null) and has no `globalngo` branch. | `listOrg:226-256`, `listAllOrg:888-914`, `OrgHierarchyRepository` |
| DEV-009 | A retired-framework or org-update failure at the end of a bulk upload is logged and swallowed; the upload record still says `SUCCESSFUL`. | `retireFramework:765-797`, `processBulkHierarchyUpload:335-343` |

> **Verification boundary:** DEV-001 is stated from the three name-building
> sites; whether knowledge-platform's `copy` honours the requested `code` as
> the node id (so the names above are the real framework ids) was not
> verified in `knowledge-platform`. The `mdo_children_lookup` writer and the
> Postgres DDL for `org_hierarchy_v4` were not found in the attached repos.
