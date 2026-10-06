# SPV & Admin Registration — APIs

Admin-portal calls leave the browser as `{{host}}/apis/{proxies,protected,public}/v8/…`
(Nginx → **sunbird-cb-uiproxy** → Kong). Prefixes are stripped in the tables
below. `proxies/v8/X` is forwarded by `proxyCreatorSunbird` to
`${KONG_API_BASE}/X`; `protected/v8/…` routes are implemented in uiproxy and
call Kong server-side. The uiproxy allow-list (`whitelistApis.ts`, enforced
when `PORTAL_API_WHITELIST_CHECK=true`) matches the **path only — HTTP
method is ignored** (`apiWhiteList.ts:127-143`). Verified from
`sunbird-cb-adminportal › routes/home/services/{create-mdo,users,directory}.services.ts`,
`head/ui-admin-table/**`, `routes/home/routes/{create-user,requests-approval,onboarding-requests}`;
`sunbird-cb-uiproxy › proxies_v8.ts`, `protectedApi_v8/user/profile-details.ts`,
`protectedApi_v8/portal-v3.ts`, `whitelistApis.ts`; `sunbird-cb-ext`
controllers; `sunbird-lms-service › conf/routes`; `sunbird-cb-workflow`
controllers; `sunbird-devops › kong-api/defaults/main.yml`.

Registration-link mechanics and the public registration calls are in
[User Onboarding APIs](../user-onboarding/apis.md); only the admin-side calls
are listed here.

## Organisations

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `org/v1/search` | Directory list. Dedicated uiproxy handler injects `filters.ministryOrStateId = rootOrgId` for `STATE_ADMIN`; a request with no `filters` throws and returns 500 |
| GET | `apis/public/v8/org/v1/list[/{state\|ministry\|globalngo}]` | Parent lists for the create drawer (public; empty = SPV parent) |
| POST | `org/v1/read` | Read an organisation (`{request:{organisationId}}`) |
| POST | `org/ext/v1/create` | Create a state / ministry / board / volunteer organisation (cb-ext → core `private/v1/org/create`) |
| PATCH | `org/ext/v2/update` | Edit logo and description only (`org.updatable.fields=logo,orgName,orgId,description`; others → 400) |
| PATCH | `org/ext/v1/update` | **Backend mapping exists as PATCH only.** The portal's `updateStateOrMinistry` sends POST (405) with no `orgId` |
| POST | `org/v1/create` | Legacy CBC / CBP provider create — straight to the core service, no hierarchy write |
| PATCH | `org/v1/update` | Legacy CBC / CBP update; errors swallowed by the UI |
| PATCH | `org/v1/status/update` | Volunteer organisation activate (`1`) / deactivate (`0`) |
| POST | `customselfregistration/upload/logo/gcpcontainer` | Logo upload (multipart); result `qrcodepath` |
| POST | `org/framework/v1/create?masterFrameworkName=org_hierarchy&orgId=…` | Create the hierarchy framework (empty body) |
| POST | `organisation/v1/hierarchy/bulkUpload/{frameworkId}` | Bulk upload sub-organisations (multipart; plus progress / sample / download routes) |

```jsonc
// POST org/ext/v1/create — create-organisation.component.ts:285-326
{ "request": {
    "orgName": "…", "channel": "<= orgName>",
    "organisationType": "mdo",            // "ngo" for a volunteer organisation
    "organisationSubType": "board",
    "isTenant": true,
    "requestedBy": "<logged-in userId>",
    "logo": "<path or empty>", "description": "…",
    "parentMapId": "…", "sbRootOrgId": "…", "ministryOrStateId": "…"
  } }
// state: ids from the chosen state's mapId / sbOrgId. ministry: from the ministry
// (empty strings if it has no mapId). autonomous (volunteer only): parentMapId and
// sbRootOrgId from the global NGO, ministryOrStateId left empty.
```

```jsonc
// POST org/v1/search — directory.services.ts:28-93 (filters differ by tab)
{ "request": { "filters": { "isTenant": true, "status": 1 },           // organisation tab adds orFilters {isMdo, isAutonomousNgo}
               "sort_by": { "createdDate": "desc" }, "limit": 20, "offset": 0, "query": "…" } }
// state tab: {isTenant,isState,status:1} · volunteer tab: {isTenant,isNgo} (no status)
// cbc / cbp tabs: {isTenant,status:1,isCbp:true}
```

## Users

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `apis/protected/v8/user/profileDetails/createUser` | Create one user (channel required) — uiproxy → Kong `user/v5/create` |
| POST | `user/v1/search` | Users of an organisation (`filters.rootOrgId`) and Add-admin search; State-users page filters by `profileDetails.ministryOrStateId` |
| POST | `user/v1/role/assign` | Assign roles (Kong → core `POST /v1/user/assign/role`) |
| POST | `user/v1/admin/extPatch` | Profile patch after creation (State-users dialog) |
| POST | `user/v1/block` · `user/v1/unblock` | Block / unblock |
| PATCH | `user/private/v1/migrate` | "Reassign" a user to another organisation (`forceMigration:true, softDeleteOldOrg:true, notifyMigration:false`) |
| GET | `data/v1/system/settings/get/orgTypeList` | Role sets per organisation type |

`createUser` payload and uiproxy side effects (password-reset link, welcome
mail, `MDO_LEADER` guard) are as documented in
[User Onboarding APIs](../user-onboarding/apis.md); the admin-portal call:

```jsonc
// create-user.component.ts:362-375
{ "personalDetails": { "email": "…", "firstName": "…", "phone": "…",
                       "channel": "<organisation channel>", "roles": ["…"],
                       "designation": "Volunteer" } }   // designation only for volunteer organisations
```

```jsonc
// POST user/v1/role/assign — create-mdo.services.ts:65-73
{ "request": { "userId": "…", "organisationId": "…", "roles": ["<existing…>", "MDO_ADMIN"] } }   // STATE_ADMIN if sub-type is state
// POST user/v1/admin/extPatch — create-user-dialog.component.ts
{ "request": { "userId": "…", "phone": "…", "firstName": "…",
               "profileDetails": { "profileStatus": "VERIFIED", "mandatoryFieldsExists": true,
                 "personalDetails": { "firstname": "…", "primaryEmail": "…", "mobile": "…", "phoneVerified": true } } } }
```

## Registration link / QR (admin side)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `customselfregistration` | Generate link + QR for `orgId` (`registrationStartDate`, `registrationEndDate` epoch ms) |
| POST | `customselfregistration/listallqrs` | List an organisation's links; `result.qrCodeDataForOrg`, latest = last element |
| GET | `framework/v1/read/{frameworkId}` · POST `org/v1/read` | Pre-check that designations are mapped before the drawer opens |

## Request review

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `workflow/org/search` · `workflow/position/search` · `workflow/domain/search` | List by `serviceName` and `applicationStatus` (`IN_PROGRESS` / `APPROVED` / `REJECTED`), `limit` 20, `offset` = page index (correct: the service uses `PageRequest.of(offset, limit)`) |
| POST | `workflow/org/update` · `workflow/position/update` · `workflow/domain/update` | Approve or reject |
| POST | `masterData/v1/upsert` | Add a designation master (`{request:{contextType:'position', contextName, contextData}}`) |
| GET | `ai/cbp/v1/designation/approval-requests/list?page_size&page&status_filter` | AI-CBP designation requests |
| POST | `ai/cbp/v1/designation/approval-requests/approve` · `…/reject` | `{id}` / `{id, reviewer_comments}` (comment required, non-blank) |

Request creation is **not** an admin-portal call: Kong's `workFlowOrgCreate`,
domain and position create routes carry no jwt plugin (only CORS and a rate
limit), i.e. they are public "raise a request" endpoints (`main.yml:9597-9639`).
Workflow `createOrgWorkFlow` rejects when the email, phone or organisation name
already exists — and also when that lookup itself fails.

## Who may call what (uiproxy allow-list vs. what the UI shows)

| Capability | UI shows it to | Gateway allows (`whitelistApis.ts`) |
|---|---|---|
| Create organisation (`org/ext/v1/create`) | `DASHBOARD_ADMIN, SPV_ADMIN, SPV_PUBLISHER, STATE_ADMIN` | `SPV_ADMIN, STATE_ADMIN, MDO_LEADER` (:2163) |
| Edit logo / description (`org/ext/v2/update`) | Edit on org / volunteer rows | `MDO_ADMIN, MDO_LEADER, SPV_ADMIN, STATE_ADMIN` (:5802) |
| Volunteer activate / deactivate | everyone (no gate) | `SPV_ADMIN` only (:7963) |
| Registration link + QR | link column for `allowedCreateRoles` | `MDO_ADMIN, MDO_LEADER, SPV_ADMIN, SPV_PUBLISHER, STATE_ADMIN` (:5096, :5160, :5182) |
| Create user | Users page `needCreateUser` | `MDO_ADMIN, MDO_LEADER, SPV_ADMIN, CBP_ADMIN, CONTENT_CREATOR, STATE_ADMIN` (:1020) |
| Role assign | Add admin / edit | `MDO_ADMIN, MDO_LEADER, SPV_ADMIN, CBP_ADMIN, STATE_ADMIN` (:7789) |
| Profile `extPatch` | State-users dialog | `MDO_ADMIN, MDO_LEADER, STATE_ADMIN` — **not** `SPV_ADMIN` (:2629) |
| Workflow org / position / domain search + update | Requests pages (SPV-only "designation" tab link) | `SPV_ADMIN, MDO_ADMIN, MDO_LEADER` — **not** `STATE_ADMIN` (:2315-2360) |
| Add designation master | `requests/:type/new` | `SPV_ADMIN` (:2300) |
| Designation approval | menu | list: `SPV_ADMIN, MDO_LEADER, MDO_ADMIN`; approve / reject: `SPV_ADMIN` (:7597-7618) |
| `portal/spv/department` | — (dead) | `SPV_ADMIN` (:984) |

## Gateway chain

| Portal call | uiproxy | Kong route (line) | Upstream | Kong auth |
|---|---|---|---|---|
| `org/ext/v1/create` | `proxiesV8.use('/org/*')` (:591) | `orgExtendedCreate` (`:8868`) | cb-ext `/org/ext/v1/create` | jwt + acl `dataAccess` |
| `org/ext/v2/update` | same | `orgExtendedUpdateV2` (`:20783`) | cb-ext `/org/ext/v2/update` | not recorded |
| `org/v1/search` | dedicated handler (`proxies_v8.ts:559-585`) | `searchOrg` (`:3915`) | core `/v1/org/search` | no jwt / acl |
| `org/v1/create` · `org/v1/update` | `/org/*` | `createOrg` (`:988`, acl `orgCreate`) · (`:4431`, acl `orgUpdate`) | core `/v1/org/create` · `/v1/org/update` | acl `orgCreate` · acl `orgUpdate` (jwt not recorded) |
| `org/v1/status/update` | `/org/*` | `updateOrgStatus` (`:4449`, acl `orgUpdate`) | core `PATCH /v1/org/status/update` | acl `orgUpdate` (jwt not recorded) |
| `protected/v8/user/profileDetails/createUser` | `profile-details.ts:225` (server-side Kong call to `/user/v5/create`) | `createCbUser` (`:20118-20135`) | core `/v5/cb/user/create` | jwt + acl `userCreate` |
| `user/v1/role/assign` | generic `/user/*` | (`:446`) | core `POST /v1/user/assign/role` | not recorded |
| `user/private/v1/migrate` | generic | (`:7800`) | cb-ext `/user/v1/migrate` | not recorded |
| `customselfregistration*` | `/customselfregistration/*` (:1435-1452) | `:18641` · `:18785` · `:18821` | cb-ext | jwt + acl `dataAccess` |
| `workflow/org/search` | generic `/workflow/*` | `workflowOrgSearch` (`:9710`) | workflow `POST /v1/org/workflow/search` | jwt + acl `dataAccess` |
| `masterData/v1/upsert` | generic | (`:9529`) | cb-ext `/masterData/v1/upsert` | not recorded |
| `ai/cbp/v1/designation/approval-requests/*` | generic | (`:25322-25359`) | `ai-cbp-mdo-service:8000` (not in repos) | not recorded |
| `protected/v8/portal/spv/department` POST / PATCH | `portal-v3.ts:148,208` → `${SB_EXT_API_BASE_2}/portal/spv/department` | none | cb-ext `PortalController` has no such route | n/a |

> **Verification boundary:** endpoints, payloads, whitelists and Kong
> entries above were read from the files cited. Not provable from the repos:
> which Kong ACL groups the portal's credential holds (they must include
> `orgCreate`, `orgUpdate`, `userCreate`, `dataAccess` for these flows to
> work), what serves the legacy `/portal/spv/*` routes at runtime, the
> `wid` header those uiproxy handlers require, and the page configuration
> that decides which menu items each role sees.
