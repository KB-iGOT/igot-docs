# Organisation Hierarchy — APIs

All portal calls leave on `{{host}}/apis/proxies/v8/…` → Nginx →
`sunbird-cb-uiproxy` (allow-list `src/utils/whitelistApis.ts`) → Kong
(`sunbird-devops › ansible/roles/kong-api/defaults/main.yml`) → serving
service. The prefix is stripped below. Portal callers verified from
`sunbird-cb-orgportal › routes/home/services/org-hierarchy.service.ts`,
`sunbird-cb-adminportal › head/ui-admin-table/services/org-hierarchy.service.ts`
and `sb-cb-ui-components › sb-cb-ui-tree-hierarchy/…/tree-hierarchy.service.ts`,
`framework.service.ts`.

## Hierarchy lifecycle (cb-pores-service)

| Method | Endpoint | Kong name → upstream | Purpose |
|---|---|---|---|
| POST | `org/framework/v1/create?masterFrameworkName=org_hierarchy&orgId={rootOrgId}` | `OrgFrameworkHierarchy` → `cb-pores-service/org/hierarchy/framework` (jwt, acl `contentAccess`) | Create the org's hierarchy: copy master → publish → PATCH org with `orgHierarchyFrameworkId`/`Status=COMPLETED`. Idempotent: returns existing ID if present. Role-gated by `org.hierarchy.required.roles`. |
| GET | `org/framework/read?frameworkName=&orgId=&termName=` | → `cb-pores-service/org/framework/read` | Reads (and lazily creates) a per-org framework + term; used by the designation screens, not the hierarchy page. Listed for completeness. |

Serving code: `cb-pores-service › org/OrgController.java:19-30`, `org/service/impl/OrgServiceImpl.java:396-460`.

## Bulk upload (sunbird-cb-ext, `/organisation`)

| Method | Endpoint | Kong name | Purpose |
|---|---|---|---|
| GET | `organisation/v1/getMappingFile/sample/{frameworkId}` | — (uiproxy allow-listed; Kong entry not located, see boundary) | Sample template: `referenceSheet` (level headers) + read-only `masterData` (orgs under root) with dropdowns |
| GET | `organisation/v1/hierarchy/download/{frameworkId}` | `bulkUploadFileDownloadForOrgHierarchyMapping` (acl `dataAccess`) | Export current tree as xlsx |
| POST | `organisation/v1/hierarchy/bulkUpload/{frameworkId}` (multipart `file`) | `bulkUploadForOrgHierarchyMapping` (acl `dataAccess`, `medium_request_size_limit`) | Store file, write `INITIATED` record, publish Kafka job |
| GET | `organisation/v1/hierarchy/progress/details/bulkUpload/{orgId}` | `bulkUploadForOrgHierarchyMappingProgressDetails` (acl `dataAccess`) | List upload records for the org |
| GET | `organisation/v1/hierarchy/download/file/{fileName}` | `bulkUploadSampleFrameworkFileForOrgHierarchyMapping` (acl `dataAccess`) | Download the annotated result sheet |

Headers: `x-authenticated-user-token` (all); `x-authenticated-user-orgid`
(sample, upload, progress, file download). Serving code:
`sunbird-cb-ext › org/controller/OrgHierarchyController.java`,
`org/service/OrgHierarchyServiceImpl.java`. The upload path in uiproxy is in
the multipart pass-through list (`proxies_v8.ts:601`).

Upload response (`result` is the record just written to Cassandra):

```jsonc
{
  "params": { "status": "SUCCESSFUL" },
  "responseCode": "OK",
  "result": {
    "rootorgid": "<orgId prefix of frameworkId>",   // frameworkId.split("_")[0]
    "identifier": "<uuid>",                          // row key, returned to the UI
    "filename": "<stored name>",
    "filepath": "<cloud URL>",
    "datecreatedon": "2026-…",
    "status": "INITIATED",
    "createdby": "<userId from token>"
  }
}
```

(`OrgHierarchyServiceImpl.bulkUploadOrgHierarchyMapping:213-236`.)

## Tree editing (knowledge-mw-service framework APIs, via Kong `/framework/*`)

Used by `lib-tree-view`; all `jwt`-protected, upstream
`knowledge-mw-service:5000/v1/framework/…` (Kong `copyFramework`,
`readFramework`, `createFrameworkTerm`, `updateFrameworkTerm`,
`retireFrameworkTerm`, `publishFramework`).

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `framework/v1/read/{orgHierarchyFrameworkId}` | Full framework: `categories[]` (the levels) → `terms[]` with `associations[]` |
| POST | `framework/v1/term/search?framework=&category=` | Terms of one level |
| POST | `framework/v1/term/create?framework=&category=` | Add a node (also `action/framework/v3/term/create` in `tree-hierarchy.service.ts`) |
| PATCH | `framework/v1/term/update/{code}?framework=&category=` | Rename a node / set its `associations` (children) |
| POST | `framework/v1/term/retire?framework=&category=` | Retire a node |
| POST | `framework/v1/publish/{frameworkId}` | Publish (header `X-Channel-Id` = org) |
| PATCH | `org/ext/v2/update` | Tree-view's only org-record write: after each `term/retire`, `{ "orgId": "<orgId from term.additionalProperties>", "parentPathId": "" }`, before the publish (`tree-view.component.ts:779-786`). cb-ext forwards `orgName`, `description`, `logo`, `parentPathId` to learner-service `v1/org/update` (`ExtendedOrgServiceImpl.updateOrgDetailsToDB:992-1012`). Add / rename / re-link flows do **not** call it. |

Term create payload as built by the bulk consumer (the tree-view sends the
same shape by hand):

```jsonc
{ "request": { "term": {
    "name": "Tiruchirappalli",            // extractName — text before '<'
    "code": "<time-based UUID>",
    "description": "…",
    "parentTerm": "Tamil Nadu<0135…>",     // raw parent cell (bulk only)
    "additionalProperties": {
      "orgId": "0135…",                    // extracted from Name<orgId>
      "parentOrgName": "Tamil Nadu"
    }
}}}
```

(`OrgHierarchyBulkUploadConsumer.buildCreateTermRequest:164-186`; the
parent's association update is `{ "request": { "term": { "associations":
[{"identifier": "<childTermId>"}, …] }}}` — `updateRequestObject:555-563`.)

## Public sign-up pickers (learner-service, via uiproxy `/apis/public/v8`)

Called without a login from the learner portal's sign-up form. uiproxy
(`src/publicApi_v8/publicApiV8.ts:342-400`) relays the body to Kong; Kong
routes `searchOrgHierarchy` / `searchMinistryOrgHierarchy` /
`searchStateOrgHierarchy` → `learner-service/v1/org/hierarchy/*`; Play routes
in `sunbird-lms-service › controller/conf/routes:131-133` → `OrgController` →
`SearchHandlerActor` (ops `orgHierarchySearch`, `orgHierarchyMinistrySearch`,
`orgHierarchyStateSearch`) → organisation index in Elasticsearch.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `org/hierarchy/ministry/search` | Ministries + their L1 departments (default filter injected when `filters` absent) |
| POST | `org/hierarchy/state/search` | States (default filter `{status:1, sbOrgType: state}`) |
| POST | `org/hierarchy/search` | Orgs under a chosen L0/L1 via `parentPathId` wildcard |

Request as built by the sign-up form (`public-signup.component.ts:2113-2160`):

```jsonc
{ "request": {
    "filters": {
      "status": 1,
      "levelZeroOrgId": "<ministry or state id>",
      "levelOneOrgId":  "<department id>",        // omitted when picking directly under a ministry
      "hierarchyRequestType": "All"              // All = every descendant; anything else = direct path only
    },
    "query": "",                                 // free text; when blank results sort by orgName asc
    "limit": 20, "offset": 0,
    "fields": ["identifier","orgName","description","parentOrgName",
               "orgHierarchyFrameworkId","orgHierarchyFrameworkStatus",
               "sbOrgType","sbOrgSubType","channel"]
}}
```

Allowed filter keys are whitelisted by
`org_hierarchy_search_filters_allowed_fields`
(`levelZeroOrgId, levelOneOrgId, status, sbOrgType, hierarchyRequestType,
advancedFilters`); the level keys joined by `_` become `parentPathId`
(`org_hierarchy_level_map`). Response is the standard org-search shape
`result.response.{count, content[]}`.

## Extended org API family (sunbird-cb-ext `ExtendedOrgController`)

All eight routes live in `sunbird-cb-ext › org/controller/ExtendedOrgController.java`
and are served by `org/service/ExtendedOrgServiceImpl.java`; Kong maps each
to `sb_cb_ext_service_url` unless noted. `org/v1/list*` and `org/v2/list*` are
additionally exposed login-free through uiproxy `/apis/public/v8`
(`publicApiV8.ts:87, 211`).

| Method | Endpoint | Kong name | Behaviour (verified) | Web caller |
|---|---|---|---|---|
| POST | `org/ext/v1/create` | `orgExtendedCreate` | Validates `orgName`, `organisationType` (`state`/`ministry` need no parent; anything else needs `parentMapId`), `organisationSubType`, `isTenant`. Looks the channel up in learner-service; if absent → `fetchStateOrMinistryDetails` (for `board` subtype: walk `org_hierarchy_v4` by `parentMapId` to the ministry/state and set `ministryOrStateId/Name/Type`) → learner-service `org/create`. If the channel exists and the org is not state/ministry, builds a unique channel `L1_L2_<name>` (`prepareChannelName`, delimiter `org.channel.delimitter=_`) and creates with that. Then inserts/updates the Postgres row — `mapId` generated as `S_n` / `M_n` (roots) or `<parentMapId>_D_n` / `_O_n` / `_T_n` / `_X_n` (department / board / training institute / other) with a counter when `mapid.counter.enabled` — and emits Kafka `org.hierarchy.new.org`. | `sunbird-cb-adminportal` create-MDO & create-organisation; `sunbird-cb-orgportal` create-organisation (`directory.service.ts CREATE_STATE_OR_MINISTRY`) — payloads already carry `parentMapId`, `sbRootOrgId`, `ministryOrStateId` |
| PATCH | `org/ext/v1/update` | `orgExtendedUpdate` | Requires flat `orgId` + `orgName`. Only if the Postgres row's `sborgsubtype` is `board`: renames the row and PATCHes learner-service (`orgName`, `description`, `logo`, `parentPathId` if present). For ministry/state/department returns 200 with `"Updating ministry,state or department is not allowed"`. | **None working** — `create-mdo.component.ts:685, 839` POSTs `{request:{orgName, channel, …}}` (no `orgId`) to this PATCH route via `updateStateOrMinistry`; see DEV-013 |
| PATCH | `org/ext/v2/update` | `orgExtendedUpdateV2` | Requires `orgId`; every other key must be in `org.updatable.fields` (repo default `logo,orgName,orgId,description`; **deployed env adds `parentPathId`** — `helm_charts/igot-deploy/sb-cb-ext-service/files/sb-cb-ext-service-env.j2:578`). Renames the Postgres row if `orgName` given, then PATCHes learner-service with `orgName`/`description`/`logo`/`parentPathId`. No subtype restriction. | orgportal & adminportal *create-organisation* edit mode (`{orgId, logo, description}`); tree view retire (`{orgId, parentPathId: ""}`) |
| GET | `org/v1/list` · `org/v1/list/{key}` | `getOrgList` | `key` ∈ `ministry` / `state` / `globalngo` → rows by `sborgtype`; otherwise rows whose `parentmapid` = key (case-insensitive); empty key = `SPV`. Returns `response.{count, content[]}` of raw `org_hierarchy_v4` rows. | adminportal create-MDO / directory-list / create-organisation; orgportal directory-table |
| GET | `org/v2/list/{key}` | `getOrgListV2` | Same, but the non-type branch uses `findAllOrgByParentMapId` — matches key against `parentmapid` **or** `l1MapId`/`l2MapId`/`l3MapId` and requires `sborgid` not null (all descendants with a Sunbird org, not just direct children). No `globalngo` branch. | orgportal reports-section (`download-report.service.ts GET_ORGS_OF_DEPT`) |
| POST | `org/v1/ext/search` | `searchOrgExtended` → **`learner-service/v1/org/search`** | cb-ext's handler (page `sborgid`s by `sbrootorgid` + optional `query`, then hydrate via learner-service search) is **not reachable through Kong** — the URI is routed to learner-service's plain org search instead. | none (DEV-014) |
| POST | `org/v2/ext/signup/search` | `signupOrgSearchV2API` | `filters.identifier[]` → rows by `sborgid`; or `filters.orgName` → Postgres regex (`~*`) match on `orgname` with `sborgid` present; then keeps rows whose L1 parent's `sborgtype` (or own type for roots) is in `filters.parentType`; truncates to `limit`. | none in the five web repos (DEV-015) |
| GET | `getNodalOfficer?orgId=` | `getNodalOfficer` | Redis-cached (`nodal_officer:<orgId>`) lookup of the org's MDO leader: name, orgName, stateOrMinistryName, email. | none in the five web repos (DEV-015) |

`org/ext/v2/update` body as the tree view sends it and as cb-ext forwards it:

```jsonc
// portal → cb-ext (PATCH org/ext/v2/update)
{ "orgId": "0135…", "parentPathId": "" }
// cb-ext → learner-service (PATCH v1/org/update)
{ "request": { "organisationId": "0135…", "parentPathId": "" } }
```

(`tree-view.component.ts:780-786`, `ExtendedOrgServiceImpl.updateOrgDetailsToDB:992-1012`.)

## Reporting / lookup (sunbird-cb-ext)

| Method | Endpoint | Kong name → upstream | Purpose |
|---|---|---|---|
| POST | `org/level/hierarchy` | `orgLevelHierarchy` → `sb-cb-ext/org/level/hierarchy` | Children of MDOs from `mdo_children_lookup`, Redis-cached |

`org/level/hierarchy` request/response:

```jsonc
// request
{ "request": { "filters": { "identifier": ["<mdoOrgId>", "…"] } } }
// response (cache miss path)
{ "result": { "response": { "count": 12, "content": [
  { "id": "", "orgName": "…", "channel": "…", "mapId": "", "orgCode": "",
    "parentMapId": "", /* … */ } ] } } }
```

(`OrgLevelHierarchyServiceImpl.orgExtSearchV3:54-105`, `mapOrgList:147-`;
note the cache-hit path returns `count`/`response` one level up — see
[As-Built Requirements](as-built-requirements.md) DEV-004.)

## Internal calls (not client-facing)

| From | Call | Purpose |
|---|---|---|
| cb-ext bulk consumer, cb-pores | `POST {knowledgeMS}/v1/framework/copy/org_hierarchy` (header `X-Channel-Id`) | New per-org framework from master |
| cb-ext bulk consumer | `DELETE {learning-service}/framework/v3/retire/{frameworkId}` (headers `user-id`, `X-Channel-Id`) | Retire previous / failed framework |
| cb-ext (both consumers), cb-pores | `PATCH {learner-service}/v1/org/update` `{request:{organisationId, orgHierarchyFrameworkId, orgHierarchyFrameworkStatus}}` | Point the org at its framework |
| cb-ext new-org consumer | `GET {km}/v1/framework/read/{rootOrgId}_org_hierarchy` | Find the first category to create the L1 term in |
| cb-ext `org/level/hierarchy` | `POST {sbUrl}{sbOrgSearchPath}` (`isTenant=true, status=1, identifier IN …`) | Hydrate child org IDs |

> **Verification boundary:** the Kong entry for
> `organisation/v1/getMappingFile/sample` was not located by name in
> `kong-api/defaults/main.yml` (the uiproxy allow-list carries it). In `sunbird-lms-service` only the
> hierarchy-search path was traced; `v1/org/update`'s handling of the two
> hierarchy fields and the writer of `parentPathId` / `hierarchyLevel` on the
> organisation index were not. The learning-service `framework/v3/retire`
> handler (`sunbird-learning-platform`) was not traced.
