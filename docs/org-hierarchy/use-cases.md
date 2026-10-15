# Organisation Hierarchy — Use Cases

Endpoints are shown without the `/apis/proxies/v8` portal prefix; the full
gateway chain for each is in [APIs](apis.md). Every API listed below was
confirmed to have a live caller — a component that invokes it, not merely a
constant in a service file — in at least one of the portal repos
(`sunbird-cb-portal`, `sunbird-cb-orgportal`, `sunbird-cb-adminportal`,
`sb-cb-ui-components`; `sunbird-cb-multitenant-staticweb` is a tenant
landing page whose only API call is `form/read`, so it has none for this
feature; `sunbird-cb-creationportal` was not available in this pass) — a
backend endpoint with no portal caller is not a use case here.

## Admin journey — setting up and editing a tree

### UC-1 · Open the hierarchy page for my organisation (MDO Admin / MDO Leader)

The MDO portal reads the admin's organisation. If it is a ministry or state
(`ministryOrStateType` is `ministry` / `state`), the page reads the parent
(`ministryOrStateId`) as the root and lists that root's sibling organisations
of the same type; otherwise the admin's own organisation is the root. The tree
renders only if the resolved root carries `orgHierarchyFrameworkId`.

- API: `POST org/v1/read`, `POST org/v1/search`
- Verified from `sunbird-cb-orgportal › routes/home/routes/directory/org-hierarchy-mapping/org-hierarchy-mapping/org-hierarchy-mapping.component.ts` (`getOrgReadAndDetails`, `checkFrameworkExists`)

### UC-2 · Create the hierarchy for a root organisation (SPV Admin / State Admin / MDO Admin)

First-time only. The portal calls create with `masterFrameworkName=org_hierarchy`
and the root's `orgId`. `cb-pores-service` checks the caller has one of the
configured roles, reads the organisation, and if it has no hierarchy yet (or
the previous attempt is `FAILED`) copies the master `org_hierarchy` framework
to `<orgId>_org_hierarchy`, publishes it, and PATCHes the organisation with
`orgHierarchyFrameworkId` and `orgHierarchyFrameworkStatus=COMPLETED`. If a
hierarchy already exists the existing ID is returned unchanged.

- API: `POST org/framework/v1/create?masterFrameworkName=org_hierarchy&orgId=<rootOrgId>`
- Verified from `cb-pores-service › org/service/impl/OrgServiceImpl.java` (`createOrgHierarchyFramework:396-460`, `createFramework:249`), `application.properties` (`org.hierarchy.required.roles`)

### UC-3 · Add, rename, retire a node in the tree (MDO Admin / SPV)

The shared `lib-tree-view` component reads the framework
(`framework/v1/read/<orgHierarchyFrameworkId>`), enriches each term with the
organisation record (`org/v1/search`) and user counts (`user/v1/search`), and
lets the admin work the tree. Verified call order per action:

- *Add orgs under a node*: pick from `org/v1/search` → `term/create` per org
  (`additionalProperties.orgId`) → `term/update/{parentCode}` with the parent's
  merged `associations` (only below the second column) → `publish` → re-read.
  **No organisation-record update.**
- *Remove a connection*: `term/retire` → `PATCH org/ext/v2/update {orgId,
  parentPathId: ""}` for each removed org → `publish`.
- *Rename / re-link / rename level*: `term/update` or `category/update` →
  `publish`. No organisation-record update.

Clicking a node navigates to `/app/home/roles/<orgId>/users`.

- API: `GET framework/v1/read/{frameworkId}`, `POST framework/v1/term/create?framework=&category=`, `PATCH framework/v1/term/update/{code}?framework=&category=`, `POST framework/v1/term/retire?framework=&category=`, `POST framework/v1/publish/{frameworkId}`, `PATCH org/ext/v2/update` (retire path only)
- Portal caller: `sb-cb-ui-components › sb-cb-ui-tree-hierarchy/library/sunbird-cb/tree-hierarchy/src/lib/components/tree-view/tree-view.component.ts` (`createTerms:580-617`, `updateAssociation:619-656`, retire flow `740-800`, `updateCategory:904`), hosted by `sunbird-cb-orgportal › …/org-hierarchy-mapping.component.html:20` and `sunbird-cb-adminportal` create-MDO
- Verified from `services/framework.service.ts` (`getFrameworkInfo:62-104`), `tree-hierarchy.service.ts:6-60`

## Admin journey — bulk loading a tree

### UC-4 · Download the sample template (MDO Admin / SPV)

Returns `orgHierarchyBulkMasterData.xlsx` with two sheets: `referenceSheet`
whose headers are the framework's category codes (the ten levels), and a
read-only `masterData` sheet (`orgId, orgName, DisplayName`, third column
hidden) listing the organisations under the root, used as the dropdown source
for the reference sheet. Duplicate values in the reference sheet are
highlighted.

- API: `GET organisation/v1/getMappingFile/sample/{frameworkId}`
- Verified from `sunbird-cb-ext › org/service/OrgHierarchyServiceImpl.java` (`bulkUploadOrganisationMapping:85-135`)

### UC-5 · Upload a filled hierarchy sheet (MDO Admin / SPV)

The portal POSTs the file as multipart `file` to the bulk-upload endpoint with
the root's current `orgHierarchyFrameworkId` in the path. Synchronously the
service validates the token, caps the row count, stores the file in the
org-hierarchy bulk-upload container, writes an `INITIATED` record to Cassandra
`sunbird.org_hierarchy_mapping_bulk_upload`, returns that record, and pushes
the job (with the auth token and framework ID) to Kafka
`org.hierarchy.bulk.upload`.

- API: `POST organisation/v1/hierarchy/bulkUpload/{frameworkId}` (multipart)
- Verified from `OrgHierarchyServiceImpl.bulkUploadOrgHierarchyMapping:182-240`

### UC-6 · Background processing of the upload (Platform)

The consumer sets the record `IN_PROGRESS`, downloads the file, appends
`Status` and `Error` header columns, creates a **new** framework
`<orgId>_org_hierarchy_<epochMillis>` by copying the master, publishes it,
then processes every non-empty row left-to-right (`processHierarchyRow`):
creating a term per `Name<orgId>` cell that doesn't yet exist and appending
the child to the parent's `associations`. It publishes again, writes the
counts and final status, re-uploads the annotated sheet, and — if at least one
row succeeded — retires the framework ID that came in the request and PATCHes
the organisation to the new framework (`COMPLETED`). If no row succeeded the
*new* framework is retired instead and the organisation is left as it was.

- Kafka: `${kafka.topics.org.hierarchy.bulk.upload.event}` (group `orgHierarchyBulkUpload`)
- Verified from `sunbird-cb-ext › org/consumer/OrgHierarchyBulkUploadConsumer.java` (`processBulkHierarchyUpload:211-350`)

### UC-7 · Check progress of uploads (MDO Admin / SPV)

Lists the bulk-upload records for the root org (fields from
`bulk.upload.status.fields`) with `count`. The caller must belong to that root
org or be on the SPV channel.

- API: `GET organisation/v1/hierarchy/progress/details/bulkUpload/{orgId}`
- Verified from `OrgHierarchyServiceImpl.getBulkUploadDetailsForOrgHierarchyMapping:284-315`, `validateUserOrgId:317-328`

### UC-8 · Download the annotated result file (MDO Admin / SPV)

Streams the stored file (same container) back as an attachment; same org/SPV
authorisation as UC-7; the local temp copy is deleted afterwards.

- API: `GET organisation/v1/hierarchy/download/file/{fileName}`
- Verified from `OrgHierarchyServiceImpl.downloadFile:248-282`

### UC-9 · Export the current tree to Excel (MDO Admin / SPV)

Builds a workbook whose single read-only sheet has the framework's categories
as headers and the terms populated per category.

- API: `GET organisation/v1/hierarchy/download/{frameworkId}`
- Verified from `OrgHierarchyServiceImpl.exportOrgHierarchyToExcel:138-180`

## Platform journey — keeping the tree complete

### UC-10 · A new organisation lands in its root's hierarchy automatically (Platform)

When `org/ext/v1/create` creates an organisation (new org, or an existing org
given a new channel), `sunbird-cb-ext` writes/updates the Postgres
`org_hierarchy_v4` row **and** pushes the request to Kafka
`org.hierarchy.new.org`. The consumer resolves the framework
`<sbRootOrgId>_org_hierarchy`, reads its first category, creates a term
(`name=orgName`, `additionalProperties.orgId=orgId`, time-UUID code) with up
to the configured retries, and publishes the framework.

- API: `POST org/ext/v1/create` (trigger); Kafka `${kafka.topics.org.hierarchy.framework.new.org.event}` (group `orgHierarchyNewOrg`)
- Verified from `sunbird-cb-ext › org/service/ExtendedOrgServiceImpl.java` (`createOrg:69-224`), `org/consumer/OrgHierarchyForNewOrgConsumer.java` (`createTermAndPublishFrameworkHierarchy:100-167`)

### UC-11 · Pick child organisations when downloading an MDO report (MDO Admin)

The MDO portal's Reports section lets an admin scope a report to the
organisations under their MDO. The portal calls `org/level/hierarchy` with the
MDO's `identifier`; the service serves it from Redis
(`org:level:hierarchy:<id>`, TTL 14400 s) when present, otherwise reads
`mdo_children_lookup` (Postgres) for the comma-separated `children_id` list,
hydrates those IDs through `org/v1/search` (`isTenant=true, status=1`, sorted
by channel) and caches the mapped list.

- API: `POST org/level/hierarchy`
- Portal caller: `sunbird-cb-orgportal › routes/home/services/download-report.service.ts` (`SEARCH_ORG_BY_HIERARCHY`, used by `routes/reports-section/reports-section.component.ts`)
- Verified from `sunbird-cb-ext › orghierarchyreport/service/OrgLevelHierarchyServiceImpl.java` (`orgExtSearchV3:54-105`, `handleChildrenScenario:107-139`), `application.properties:642-644`

### UC-12 · Pick a state / ministry, then its departments, in admin screens (SPV Admin, MDO Admin)

The admin portals' create-MDO form, directory tables and the MDO reports
filter walk the older flat hierarchy: `org/v1/list/{type}` (`state`,
`ministry`, `globalngo`) for the top level, then `org/v1/list/{parentMapId}`
/ `org/v2/list/{parentMapId}` for the children of the picked node —
`org_hierarchy_v4` rows by `parentmapid` (case-insensitive). These are
`/apis/public/v8` calls.

- API: `GET org/v1/list/{typeOrParentMapId}`, `GET org/v2/list/{parentMapId}`
- Portal callers: `sunbird-cb-adminportal › routes/home/routes/create-mdo/create-mdo.component.ts:324-371` (`getStatesOrMinisteries('state'|'ministry')`, `getDeparmentsOfState(mapId)`), `head/ui-admin-table/directory-list/directory-table.component.ts:154-160`, `head/ui-admin-table/create-organisation/create-organisation.component.ts:197` (`globalngo`); `sunbird-cb-orgportal › routes/home/components/directory-table/directory-table.component.ts:197`, `routes/home/routes/reports-section/reports-section.component.ts:431` (`org/v2/list`)
- Not a caller: `sunbird-cb-portal` defines the same constants in `public-signup/signup.service.ts`, `welcome/public-welcome.service.ts` and `profile-v2-revamp.service.ts`, but no component invokes them — the live sign-up uses UC-13 (see DEV-010)
- Verified from `sunbird-cb-ext › org/controller/ExtendedOrgController.java:33-57`, `org/repository/OrgHierarchyRepository.java` (`findAllByParentMapId`)

## Karmayogi journey — registering

### UC-13 · Choose ministry/state → department → organisation on public sign-up (Karmayogi)

The learner portal's sign-up form drives three paginated, searchable pickers
off the organisation **search index**, not the framework:

1. *Ministry* picker → `org/hierarchy/ministry/search` (no `filters` sent;
   learner-service injects `org_hierarchy_search_filter_criteria_ministry` =
   `{status:1, advancedFilters:{includeHierarchyLevels:[levelZero, levelOne],
   ministryOrStateType: ministry}}`, i.e. ministries and their L1 departments
   in one list, each row carrying `hierarchyLevel` and `ministryOrStateId`).
2. *State* picker → `org/hierarchy/state/search` (injected
   `{status:1, sbOrgType: state}`); *Department of state* → the same
   endpoint family with `levelZeroOrgId=<state>`.
3. *Organisation* picker → `org/hierarchy/search` with
   `filters:{status:1, levelZeroOrgId, levelOneOrgId?, hierarchyRequestType:'All'}`.
   For a ministry row that was itself `levelOne`, the portal sends the
   row's `ministryOrStateId` as `levelZeroOrgId` and the row as
   `levelOneOrgId`. learner-service joins the level ids with `_` into
   `parentPathId` and runs an ES wildcard `*<L0>_<L1>*` on
   `parentPathId.raw` (`hierarchyRequestType=All` adds the trailing `*`,
   i.e. all descendants rather than direct children), sorted by `orgName`
   when no `query` text is given.

Each call pages with `limit`/`offset` and a free-text `query`; the fields
requested include `orgHierarchyFrameworkId/Status`, `hierarchyLevel`,
`parentPathId`, `ministryOrStateId`.

- API: `POST org/hierarchy/ministry/search`, `POST org/hierarchy/state/search`, `POST org/hierarchy/search` (all `/apis/public/v8`, no login)
- Portal caller: `sunbird-cb-portal › src/app/routes/public/public-signup/public-signup.component.ts` (`getMinistryData:1468-1530`, `getStateData:1686-1760`, `getOrganisationData:2100-2200`), `signup.service.ts` (`MINISTRY_FOR_REGISTRATION`, `STATE_FOR_REGISTRATION`, `STATE_MINISTRY_FOR_REGISTRATION`)
- Verified from `sunbird-cb-uiproxy › src/publicApi_v8/publicApiV8.ts:33-35, 342-400`; Kong `searchOrgHierarchy`, `searchMinistryOrgHierarchy`, `searchStateOrgHierarchy` → `learner-service/v1/org/hierarchy/*`; `sunbird-lms-service › controller/app/controllers/organisationmanagement/OrgController.java:28-42, 125-180`, `service/src/main/java/org/sunbird/actor/search/SearchHandlerActor.java` (`handleOrgHierarchySearchAsyncRequest:669-713`, `createTheParentMapAndAddToFilter:715-742`), `core/es-utils/…/ElasticSearchHelper.java:190-245, 975-1030`, `core/platform-common/src/main/resources/externalresource.properties:124-129`

## Edge cases

| Situation | Behaviour |
|---|---|
| Create hierarchy called for an org that already has one | Returns the existing `orgHierarchyFrameworkId`; no new copy (`OrgServiceImpl:455-457`) |
| Create hierarchy by a user without a configured role | `400` "not authorised" — roles are `MDO_ADMIN, MDO_LEADER, SPV_ADMIN, SPV_PUBLISHER, STATE_ADMIN` (`org.hierarchy.required.roles`) |
| Upload file exceeds the row cap | `400` with `BULK_UPLOAD_MAXIMUM_LIMIT_ERROR_MSG`; cap is `maximumRowAllowedForDesignationCompetencyUpload` (shared with designation upload) |
| Uploaded sheet has no data rows | Record set `FAILED` with 0/0/0; a row "File is empty" is written to the sheet; no framework is created |
| Row where L1 is blank | Row `FAILED` — "Top-level organization (L1) is empty" |
| Row with a blank cell followed by a filled one | Row `FAILED` — "Missing intermediate level before 'X' at level n" |
| Cell not in `Name<orgId>` form | Row `FAILED` — "Invalid format … Expected format: Name<orgId>" (regex `<([^>]+)>`) |
| Org ID/name not in the root's master data | Row `FAILED` — "Org 'X' (ID: …) does not exist in the master data" |
| Same org appears under two different parents in the sheet | Row `FAILED` — "Term 'X' has multiple parents" |
| Same org appears at two different levels | Row `FAILED` — "appears in multiple levels/categories" |
| Parent chain loops back to the child | Row `FAILED` — "Circular reference detected" |
| Framework publish fails after processing | Status `FAILED` even if all rows succeeded; a "Publish framework failed" summary row is appended to the sheet |
| Every row failed | New framework is retired; organisation keeps its previous framework |
| At least one row succeeded | Previous framework (from the request path) retired; org PATCHed to the new framework; `FAILED` status still reported if any row failed |
| Progress / file download for another org | `401` unless the caller's channel is the SPV channel |
| New-org consumer cannot read `<rootOrgId>_org_hierarchy` | Logs "Category not available or framework read failed" and gives up — no retry (`OrgHierarchyForNewOrgConsumer:112-116`) |
| `org/level/hierarchy` for an MDO with no `mdo_children_lookup` row | `count: 0`, empty response, errmsg "No child org found" |
| Sign-up org search with `levelZeroOrgId` but no `levelOneOrgId` | `parentPathId` = `<L0>` alone; with `hierarchyRequestType=All` the wildcard `*<L0>*` returns every org under the ministry/state at any depth |
| Sign-up search with `filters` omitted on the ministry/state endpoints | learner-service injects the configured default filter set; a caller-supplied `filters` object replaces it entirely |
