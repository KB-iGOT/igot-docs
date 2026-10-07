# Bulk Registration — APIs

Gateway prefixes stripped for readability. Verified from
`sunbird-cb-orgportal`, `sunbird-cb-uiproxy`, `sunbird-cb-ext`,
`sunbird-lms-service`, and `sunbird-devops` (branches/commits as listed
in [index.md](index.md)).

## uiproxy (`sunbird-cb-uiproxy`) — BFF layer for the live pipeline

One shared multipart-aware handler serves all four CSV routes
(`src/proxies_v8/proxies_v8.ts:600-730`): reads the uploaded file via
`express-fileupload` (not multer), repackages it as `FormData`, and
submits it directly to Kong, forwarding auth headers
(`x-authenticated-user-*`) and, where present, `targetorgid`.

| Method | Path | Required role(s) (`whitelistApis.ts`) | Notes |
|---|---|---|---|
| POST | `/proxies/v8/user/v1/bulkupload` | `MDO_ADMIN`, `MDO_LEADER` | |
| GET | `/proxies/v8/user/v1/bulkupload/:orgId` | `MDO_ADMIN`, `MDO_LEADER` | Status list |
| POST | `/proxies/v8/user/v2/bulkupload` | `MDO_ADMIN`, `MDO_LEADER` | Used when no org/channel context is available |
| POST | `/proxies/v8/user/v3/bulkupload` | `MDO_LEADER` only | Used by the live org-scoped UI when `orgId`/`channel` are known |
| POST | `/proxies/v8/user/nongovt/v1/bulkupload` | `MDO_ADMIN`, `SPV_ADMIN`, `MDO_LEADER` | NGO/volunteer variant; expects `targetorgid` |

### Legacy, self-contained route

| Method | Path | Notes |
|---|---|---|
| POST | `/protected/v8/admin/userRegistration/bulkUpload` | `src/protectedApi_v8/admin/userRegistration.ts`. Accepts a base64-encoded xlsx/csv in a JSON body, parses it locally, and calls Keycloak directly per row (`createKeycloakUser`, `UpdateKeycloakUserPassword`, `sendActionsEmail`) — never calls `sunbird-cb-ext` or `sunbird-lms-service`. Own Cassandra table `bulk_user_upload_detail`. |
| GET | `/protected/v8/admin/userRegistration/bulkUploadData` | Status list for the legacy path |
| GET | `/protected/v8/admin/userRegistration/bulkUploadReport/{id}` | Per-batch downloadable report |

## Kong (`sunbird-devops`) — gateway routing

| Kong route | External path | Upstream |
|---|---|---|
| `userBulkUpload` (v1) | `{{user_service_prefix}}/v1/upload` | `learner-service:9000` → `sunbird-lms-service` `/v1/user/upload` |
| `UserBulkUploadv2` | `/v2/bulk/upload` | `learner-service:9000` → `/v2/bulk/user/upload` |
| `userBulkUpload` (bulkupload v1) | `{{user_service_prefix}}/v1/bulkupload` | `sb-cb-ext-service:7001` → `/user/v1/bulkupload` |
| `CBBulkUserUploadV2` | `/v2/bulkupload` | `sb-cb-ext-service` → `/user/v2/bulkupload` |
| `CBBulkUserUploadV3` | `/v3/bulkupload` | `sb-cb-ext-service` → `/user/v3/bulkupload` |
| `userNgoBulkUpload` / `CBNonGovtUserBulkUpload` | `/nongovt/v1/bulkupload` | `sb-cb-ext-service` → `/user/nongovt/v1/bulkupload` |

The live UI's `v2`/`v3`/`nongovt` uiproxy paths resolve to
**`sb-cb-ext-service`** (i.e. `sunbird-cb-ext`), not directly to
`sunbird-lms-service`. The `v1/upload` route to `sunbird-lms-service`
exists in Kong but has no confirmed caller among the 8 repos (see
[Use Cases UC-8](use-cases.md)).

## sunbird-cb-ext (`sb-cb-ext-service`) — CSV parsing + orchestration

| Method | Path | Handler | Notes |
|---|---|---|---|
| POST | `/user/v1/bulkupload` | `ProfileController` → `ProfileServiceImpl.bulkUpload` | XLSX |
| POST | `/user/v2/bulkupload` | `ProfileController` → `ProfileServiceImpl.bulkUploadV2` | CSV (RFC4180) |
| POST | `/user/v3/bulkupload` | `ProfileController` → `bulkUploadBySuperAdmin` → delegates to `bulkUploadV2` | State/ministry admin uploading on behalf of a child org |
| GET | `/user/v1/bulkupload/{orgId}` | `getBulkUploadDetails` | Reads Cassandra `user_bulk_upload` |
| GET | `/user/v1/bulkuser/download/{fileName}` | — | Annotated result file |
| POST | `/user/nongovt/v1/bulkupload` | `NonGovtUserController` → `NonGovtUserBulkUploadServiceImpl.bulkUploadNonGovtUsers` | Requires header `targetOrgId`; shares the `user_bulk_upload` table |

Both controllers upload the file to blob storage, insert a tracking row,
and publish to Kafka (`user.bulk.upload.final` / `nongovt.user.bulk.upload.final`)
for async processing — see [LLD](lld.md) for the consumer side.

## sunbird-lms-service — the two "bulk create" endpoints and the native CSV pipeline

| Method | Path | Handler | Notes |
|---|---|---|---|
| POST | `/v5/cb/user/bulkcreate` | `UserController.bulkCreateUserV5` → `SSOUserCreateActor` op `BULK_CREATE_USER_V5` | **Creates exactly one user per call** — request body is a single flat object, not an array. Called once per CSV row by `sunbird-cb-ext`'s consumer. `sourceCreationType=bulkUserCreate`; role auto-set to `PUBLIC`. |
| POST | `/v5/cb/user/ngo/bulkcreate` | `UserController.bulkCreateVolunteerUserV5` → op `NGO_BULK_CREATE_USER_V5` | Same one-record-per-call semantics. Reads header `X-Auth-User-Org-Id`; cross-checks the target org's ministry/state against the caller's; sets role `VOLUNTEER` if the target org resolves to `NGO` type. |
| POST | `/v1/user/upload` | `BulkUploadController.userBulkUpload` → `UserBulkUploadActor` | The native, self-contained CSV pipeline — accepts multipart, urlencoded (`data` field), or JSON (`data` field as file bytes). No confirmed caller among the 8 repos (see UC-8). |
| GET | `/v1/upload/status/{pid}` | `BulkUploadController.getUploadStatus` → `BulkUploadManagementActor` | Returns decrypted+masked success/failure arrays once `status==COMPLETED`; otherwise a coarse `COMPLETED`/`IN_PROGRESS`/`NOT_STARTED` string (a `FAILED` or `NEW` row also reports as `NOT_STARTED` here). |
| POST | `/v1/org/upload` | `BulkUploadController.orgBulkUpload` → `OrgBulkUploadActor`/`OrgBulkUploadBackgroundJobActor` | Confirmed **org-only** — no user-creation code path; unrelated to this feature despite the similar name. |

Both `/v5/cb/user/...bulkcreate` request bodies must include a non-empty
`profileDetails` map (`updateMinistryDetailsForUsers`, throws
`bulkUserCreateProfileValidation` otherwise) — unlike the single-user
`/v5/cb/user/create`, these two paths never build `profileDetails`
themselves; the caller must supply it.

## Verified payloads

```jsonc
// POST /v5/cb/user/bulkcreate — one CSV row, one call
{
  "request": {
    "firstName": "…", "email": "…", "phone": "…",
    "sourceCreationType": "bulkUserCreate",
    "profileDetails": { /* caller-supplied, mandatory */ }
  }
}
```

```jsonc
// POST /v5/cb/user/ngo/bulkcreate — header carries the calling admin's org
// X-Auth-User-Org-Id: <admin's rootOrgId>
{
  "request": {
    "firstName": "…", "email": "…",
    "orgName": "…",               // resolved via ES org search
    "sourceCreationType": "ngoBulkUserCreate",
    "profileDetails": { /* mandatory */ }
  }
}
```

> **Verification boundary:** every route above is traced to the file/line
> citations recorded by the four research passes behind this document
> set. Not verified from source: the exact JSON body
> `UserUtilityServiceImpl.constructBulkUserCreateRequest` builds for the
> per-row call into `/v5/cb/user/bulkcreate` (specifically, whether it
> includes a `password` field — this determines whether Keycloak
> provisioning happens at all for these users, see
> [As-Built Requirements](as-built-requirements.md)); and whether any
> system outside these 8 repos calls `sunbird-lms-service`'s native
> `/v1/user/upload` directly.