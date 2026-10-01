# User Onboarding — APIs

Gateway prefixes are stripped in the tables for readability. Web admin calls
leave the browser as `{{host}}/apis/{proxies,protected,public}/v8/…` (Nginx →
**sunbird-cb-uiproxy** → Kong). The public web portal and the **mobile app**
call `{{host}}/api/…`, which Nginx rewrites (`rewrite ^/api/(.*) /$1`) and
sends straight to **Kong** — uiproxy is not in that path. Verified from
`sunbird-cb-portal › public-signup.component.ts`, `public-crp.component.ts`,
`public-welcome.component.ts`; `sunbird-cb-orgportal ›
custom-self-registration.component.ts`, `single-user-creation.component.ts`;
`sunbird-cb-adminportal › onboarding-requests.service.ts`,
`create-organisation.component.ts`; `igot_karmayogi_mobile ›
api_endpoints.dart`, `registration_service.dart`, `profile_repository.dart`;
`sunbird-cb-uiproxy › proxies_v8.ts`, `whitelistApis.ts`,
`protectedApi_v8/user/profile-details.ts`; `sunbird-devops ›
ansible/roles/kong-api/defaults/main.yml`, `stack-proxy/templates/proxy-default.conf`;
`sunbird-cb-ext` controllers; `sunbird-lms-service › conf/routes`.

Bulk CSV creation endpoints (`/user/v1|v2|v3/bulkupload`,
`/user/nongovt/v1/bulkupload`, `/v5/cb/user/bulkcreate`) belong to
[Bulk Registration](../bulk-registration/apis.md) and are not repeated.

## Registration (public, learner-facing)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `user/registration/v1/register` | Submit a registration request. Returns **202** with the registration record. Used by web `/public/signup`, web `/crp/…`, mobile link mode and mobile direct mode |
| GET | `user/registration/v1/getUserRegistrationDetails?regCode=` | Read a registration record by code |
| GET | `user/registration/v1/getDeptDetails` | Department list (Redis-cached, org search + a bundled master list) |
| POST | `otp/ext/v1/generate` | Domain-validated OTP generate (email domain must be approved). Web `/public/signup` (both email and phone) and mobile direct-registration email |
| POST | `otp/v1/generate` · `otp/v1/verify` | Plain OTP generate / verify. Verify is used by every client; plain generate by phone everywhere and by email in link mode |
| GET | `user/email/approved/domains` (Kong: `user/v1/email/approvedDomains`) | Union of approved and pre-approved email domains; 500 if the set is empty |
| GET | `user/v1/groups` | Group list for the form (`Others` filtered client-side) |
| POST | `org/hierarchy/search` · `org/hierarchy/ministry/search` · `org/hierarchy/state/search` | Org pickers (web via `/apis/public/v8/…`, mobile via Kong directly) |
| POST | `designation/search` | Designation master list (web via `/apis/public/v8/designation/search`) |
| POST | `org/ext/v2/signup/search` | Org lookup by name or identifier for sign-up and the welcome form |
| GET | `getNodalOfficer?orgId=` | Nodal officer for an org (mobile) |

### Verified register payloads

```jsonc
// POST /api/user/registration/v1/register  — web /public/signup
// sunbird-cb-portal › public-signup.component.ts (no sbRootOrgId, no registrationLink)
{
  "firstName": "…", "email": "…", "phone": "9876543210",
  "group": "GROUP A",
  "source": "<environment.name>.<portalID>",
  "orgName": "…", "channel": "…",
  "organisationType": "…", "organisationSubType": "…",
  "mapId": "<orgId>", "sbOrgId": "<orgId>",
  "position": "<designation>"
}
```

```jsonc
// POST /api/user/registration/v1/register  — registration link (web /crp, mobile link mode)
// public-crp.component.ts / registration_service.dart getSelfRegister
{
  "firstName": "…", "email": "…", "phone": "…", "group": "…",
  "position": "<designation>",
  "orgName": "…", "channel": "…",
  "organisationType": "…", "organisationSubType": "…",
  "mapId": "…", "sbOrgId": "…", "sbRootOrgId": "…",
  "source": "…",
  "isWhatsappConsent": true,
  "registrationLink": "https://<host>/crp/<uniqueId>/<orgId>"   // web sends window.location.href
}
```

Mobile direct registration sends the web `/public/signup` shape (no
`sbRootOrgId`, `registrationLink` or WhatsApp consent). Server-side the
mandatory set is `firstName, email, (sbOrgId or mapId), orgName, group,
source, phone`; `group` must be one of `GROUP A, GROUP B, GROUP C, GROUP D,
Contractual Staff, Honorarium-Based, Others`.

```jsonc
// POST /api/otp/ext/v1/generate and /api/otp/v1/generate
{ "request": { "type": "email" /* or "phone" */, "key": "<address or 10-digit number>" } }
// POST /api/otp/v1/verify
{ "request": { "type": "email", "key": "…", "otp": "123456" } }
```

## Custom registration link / QR (org admin)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `customselfregistration` | Generate the link, PDF and QR for an org. Body: `{registrationStartDate, registrationEndDate (epoch ms), orgId}` |
| POST | `customselfregistration/listallqrs` | List an org's links; the UI takes the **last** element as the latest |
| POST | `customselfregistration/upload/logo/gcpcontainer` | Upload the org logo for the QR (multipart) |
| POST | `customselfregistration/isregistrationqractive` | Is this link active? Body `{registrationLink}`. Public in Kong, admin-only through uiproxy |
| POST · GET | `/expiredQRCodes` · `/cronjob/expiredQRCodes` | Expire codes (per org / all orgs). cb-ext controller routes with no auth in the controller; no Kong or uiproxy mapping was located (VERIFICATION BOUNDARY — presumably cron / internal callers) |
| GET | `framework/v1/read/{frameworkId}` | Read the org framework; designations are the associations of the `org` category's first term |
| POST | `org/v1/read` | Read an org (`{request:{organisationId}}`) to obtain its framework id and name |

## Admin-side user and organisation creation

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `apis/protected/v8/user/profileDetails/createUser` | Create one user (MDO / SPV / admin portals). uiproxy builds the Kong call to `user/v5/create` |
| POST | `apis/protected/v8/user/profileDetails/createUserWithoutInvitationEmail` | Same, no welcome mail, duplicate-email guard, then `PATCH super/user/private/v1/update` for `primaryEmail` |
| POST | `org/ext/v1/create` | Create an organisation (State / Ministry / board / NGO) |
| PATCH | `org/ext/v1/update` · `org/ext/v2/update` | Update an organisation |
| GET | `org/v1/list/{state\|ministry\|globalngo}` (public) · `org/v1/search` · `org/v1/status/update` | Org lists and volunteer-org activation |
| POST | `user/v1/role/assign` | Assign roles to a created admin |
| PATCH | `user/private/v1/migrate` | Move a user into an organisation |
| PATCH/GET | `org/v1/profile/patch` · `org/v1/profile/read` | Org onboarding profile (Elasticsearch `org_onboarding`) |
| GET | `data/v1/system/settings/get/orgTypeList` | Role sets offered when creating users |

### Verified admin create payload

```jsonc
// POST /apis/protected/v8/user/profileDetails/createUser
// sunbird-cb-orgportal › single-user-creation.component.ts:628-671
{
  "personalDetails": { "email": "…", "firstName": "…", "phone": "…", "channel": "<dept name>", "roles": ["PUBLIC", "…"] },
  "profileDetails": {
    "personalDetails": { "dob": "d-m-yyyy", "domicileMedium": "…", "gender": "…", "category": "…",
                         "mobile": "…", "primaryEmail": "…", "firstname": "…" },
    "professionalDetails": [ { "designation": "…", "group": "…" } ],   // omitted for NGO
    "additionalProperties": { "tag": [] },                              // NGO adds externalSystemId + externalSystem "eHRMS ID"
    "employmentDetails": { "pinCode": "…" }
  }
  // "isNgo": true   (NGO orgs only)
}
```

`channel` is required (400 "Channel param is missing in personalDetails. Use
DeptName as Channel value."). uiproxy forwards to Kong `/user/v5/create` with
`emailVerified: true`, `phoneVerified: false`, `mandatoryFieldsExists: false`
and all three profile statuses `VERIFIED` only when both designation and group
are present.

## Approval requests (super admin)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `workflow/org/search` · `workflow/position/search` · `workflow/domain/search` | List requests by `serviceName` (`organisation` / `position` / `domain`) and `applicationStatus` (`IN_PROGRESS` / `APPROVED` / `REJECTED`) |
| POST | `workflow/org/update` · `workflow/position/update` · `workflow/domain/update` | Approve or reject (`action: APPROVE` or `REJECT`, `comment` for reject) |
| POST | `masterData/v1/upsert` | Add a designation directly (`{contextType:'position', contextName, contextData}`) |

```jsonc
// POST workflow/{org|position|domain}/search — adminportal › onboarding-requests.service.ts
{ "serviceName": "organisation", "applicationStatus": "IN_PROGRESS", "limit": 20, "offset": 0, "deptName": "iGOT" }
// POST workflow/…/update — requests-approval.component.ts:100-163
{ "state": "IN_PROGRESS", "action": "APPROVE", "serviceName": "domain", "wfId": "…", "applicationId": "…",
  "userId": "…", "actorUserId": "…", "deptName": "iGOT",
  "updateFieldValues": [ { "toValue": { "domain": "example.gov.in" }, "fieldKey": "domain",
                           "description": "…", "firstName": "…", "email": "…", "mobile": "…" } ] }
```

Offset sent by the admin portal is the **page index**, not index × limit.

## First login and SSO

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `apis/proxies/v8/user/basicInfo` | Returns `isUpdateRequired` (true only for users in the custodian org with empty `profileDetails.userRoles`) |
| POST | `user/basicProfileUpdate` | Complete the welcome form; moves the user to the chosen org via the core migrate call. Requires `userId, group, channel, mapId, organisationType, organisationSubType` |
| POST | `user/v5/parichay/create` · `user/v5/oilindia/create` · `user/v5/ntpc/create` | Server-side SSO account creation (uiproxy, role `PUBLIC`) |
| POST | `user/v1/ext/signup` | Mobile Parichay first login (`{email, emailVerified:true, firstName, lastName}`) |
| POST | `private/user/v1/search` | Lookup an SSO user by email or phone |
| PUT | `user/v1/updateLogin` | Mobile: record login `{userId, orgId}` |
| GET | `user/v5/read/{userId}` | Mobile: read the profile after login |

## Core user service (sunbird-lms-service)

Reached through Kong; routes in `controller/conf/routes`.

| Route | Auth | Role set at creation |
|---|---|---|
| `POST /v5/cb/user/self/register` | none | `PUBLIC` (forced) |
| `POST /v5/cb/user/custom/register` | none | `PUBLIC` (forced) |
| `POST /v5/cb/user/parichay/create` · `/oilindia/create` · `/ntpc/create` | none | `PUBLIC` (forced), channel forced from config |
| `POST /v5/cb/user/create` | user token | Requested roles (default `PUBLIC`), validated; one `MDO_LEADER` per org |
| `POST /v5/cb/support/user/create` | user token | `PUBLIC` |
| `POST /v1/user/signup` · `/v2/user/signup` | none | none assigned |
| `POST /v1·/v2·/v3/user/create`, `/v1/ssouser/create` | none | Requested roles |
| `POST /v4/user/create`, `/v1·/v2/manageduser/create` | user token | none assigned (managed users, limit 30) |
| `POST /v1/user/public/role/assign` | none | Replaces all existing roles with `PUBLIC` |
| `GET /v1/user/exists/:key/:value` | none | `{exists}` |
| `GET /v2/user/exists/:key/:value` | token (+ captcha when enabled) | `{exists, id, name}` |
| `POST /v1·/v2/otp/generate` · `/verify` | none | — |
| `POST /v3/otp/generate` · `/verify`, `/v4/otp/verify`, `/v1/otp/verifyFromLookup` | user token | — |

## Gateway chain

| Client call | uiproxy (web) | Kong route (line) | Upstream | Kong auth / rate limit |
|---|---|---|---|---|
| `POST /api/user/registration/v1/register` | none — web and mobile go via Nginx | `registerUser` (`main.yml:8812`) | cb-ext `/user/registration/v1/register` | no jwt · 1000/h local · 1 MB |
| `POST /api/otp/ext/v1/generate` | not whitelisted | `generateOtpEXT` (`:10457`) | cb-ext `/user/otp/v1/generate` | no jwt · 5000/h · 1 MB |
| `POST /api/otp/v1/generate` · `/verify` | `/proxies/v8/otp/v1/*` (PUBLIC role, needs a session) | `:1506` · `:4859` | learner `/v1/otp/generate` · `/verify` | no jwt · 5000/h |
| `POST /api/customselfregistration/isregistrationqractive` | `/proxies/v8/customselfregistration/isregistrationqractive` (admin roles only) | `isRegistrationQRActiveAPIForCSR` (`:18839`) | cb-ext `/isRegistrationQRActive` | no jwt · 5000/h |
| `POST /customselfregistration` · `/listallqrs` · `/upload/logo/gcpcontainer` | `/proxies/v8/customselfregistration*` — `MDO_ADMIN, MDO_LEADER, SPV_ADMIN, SPV_PUBLISHER, STATE_ADMIN` (`whitelistApis.ts:5096,5160,5182,5193`) | `:18641` · `:18785` · `:18821` | cb-ext `/getSelfRegistrationQRPdf` · `/listAllQRCodes` · `/upload/logo/gcpcontainer` | jwt + acl `dataAccess` |
| `POST /api/org/ext/v2/signup/search` | none | `signupOrgSearchV2API` (`:9564`) | cb-ext `/org/v2/ext/signup/search` | no jwt · 5000/h |
| `POST /api/org/hierarchy/{search,ministry/search,state/search}` | `/public/v8/org/hierarchy/*` | `:23355` · `:23855` · `:23869` | learner `/v1/org/hierarchy/*` | no jwt · 15000/h by IP |
| `POST /api/org/v1/read` · `GET /api/framework/v1/read/{id}` | `/public/v8/org/v1/read` | `readOrg` (`:3225`) · `readFramework` (`:3157`) | learner · knowledge-mw | no jwt |
| `GET /api/user/v1/groups` | `/proxies/v8/user/v1/groups` | `getUserGroupList` (`:9908`) | cb-ext `/user/v1/groups` | no jwt · 5000/h |
| `GET /api/user/v1/email/approvedDomains` | `/proxies/v8/user/v1/email/approvedDomains` (PUBLIC) | `approvedEmailDomains` (`:15892`) | cb-ext `/user/email/approved/domains` | jwt + acl `courseAccess, itsmAccess` |
| `POST /user/v5/create` (server-side from uiproxy) | `/protected/v8/user/profileDetails/createUser` — `MDO_ADMIN, MDO_LEADER, SPV_ADMIN, CBP_ADMIN, CONTENT_CREATOR, STATE_ADMIN` (`whitelistApis.ts:1020`) | `createCbUser` (`:20119`) | learner `/v5/cb/user/create` | jwt + acl `userCreate` |
| `POST /user/v5/parichay\|oilindia\|ntpc/create` | `publicApi_v8/ssoUserHelper.ts` (server-side) | `:20101` · `:23956` · `:24169` | learner `/v5/cb/user/*/create` | jwt + acl `anonymousUserCreate` |
| `POST /api/user/v1/ext/signup` (mobile) | none | `ssoUserV2CreateExt` (`:9185`) | cb-ext `/user/v1/ext/signup` | jwt + acl `anonymousUserCreate` |
| `POST /api/user/basicProfileUpdate` | `/proxies/v8/user/basicProfileUpdate` | `updateUserBasicProfile` (`:8958`) | cb-ext `/user/v1/basicProfileUpdate` | jwt + acl `userAccess` |
| `POST /org/ext/v1/create` | `/proxies/v8/org/ext/v1/create` — `SPV_ADMIN, STATE_ADMIN, MDO_LEADER` (`whitelistApis.ts:2163`) | `orgExtendedCreate` (`:8868`) | cb-ext `/org/ext/v1/create` | jwt + acl `dataAccess` |
| `POST workflow/{org,position,domain}/{search,update}` | generic proxy — **no per-path whitelist entry found** | not traced | sunbird-cb-workflow | VERIFICATION BOUNDARY |

Rate limits are Kong `policy: local` (per Kong node), most with `limit_by:
credential`. Any uiproxy path containing `/public/` bypasses the uiproxy
allow-list (`checkIsStaticRoute` uses `includes()`).

> **Verification boundary:** endpoints, payloads and Kong entries above
> were read from the files cited. Not traced: the Kong route for
> `/org/v1/list/ministry` (mobile `getAllMinistries`), the Kong routes for
> `masterData/v1/upsert`, `basicInfo` and the workflow `search`/`update`
> paths, and the Kubernetes ingress rule that maps `/apis` to uiproxy.
> Which consumers belong to which Kong ACL group (e.g. `userCreate`)
> is defined outside the files read.
