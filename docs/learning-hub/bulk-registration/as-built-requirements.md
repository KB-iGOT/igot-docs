# Bulk Registration — As-Built Requirements

Requirements reconstructed from the shipped implementation across 8
repos (branches/commits listed in [index.md](index.md)) — what the
system does today, not what was originally intended. Companion to the
[HLD](hld.md), [LLD](lld.md) and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for Bulk Registration was
available in any of the 8 repos. This document reconstructs requirements
**from the shipped implementation** across the live UI
(`sunbird-cb-orgportal`), the absent UI (`sunbird-cb-adminportal`), the
legacy UI (`sunbird-cb-portal`), the BFF proxy (`sunbird-cb-uiproxy`),
the orchestration service (`sunbird-cb-ext`), the core user service
(`sunbird-lms-service`), the adjacent workflow engine
(`sunbird-cb-workflow`), and infra config (`sunbird-devops`). Each
requirement traces to file(s)/function(s) that implement it.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint/assumption baked into the build).

## Functional requirements

### Live pipeline

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | An org admin SHALL be able to upload a `.csv` file of new users from a "Bulk Creation" tab, gated by org role (`MDO_ADMIN`/`MDO_LEADER`). | `BulkUploadComponent`; `whitelistApis.ts:2186,3678,6631` |
| FR-002 | The system SHALL require the submitting admin to complete an OTP challenge, sent to the admin's own email/phone, before the upload request is submitted. | `BulkUploadComponent.sendOTP`/`generateAndVerifyOTP` |
| FR-003 | For an org flagged `isNgo`, the system SHALL route the upload to a distinct endpoint (`/user/nongovt/v1/bulkupload`) with a `targetorgid`, instead of the standard org endpoint. | `BulkUploadComponent.uploadCSVFile`; `OrgHierarchyService.getOrgData().isNgo` |
| FR-004 | `sunbird-cb-ext` SHALL persist each uploaded file, insert a batch-tracking row into `user_bulk_upload`, and publish a Kafka message for asynchronous row processing. | `ProfileServiceImpl.bulkUpload`/`bulkUploadV2`; `NonGovtUserBulkUploadServiceImpl` |
| FR-005 | A Kafka consumer in `sunbird-cb-ext` SHALL parse each row and, for the government/MDO population, call `sunbird-lms-service`'s `POST /v5/cb/user/bulkcreate` once per row. | `UserBulkUploadConsumer`/`UserBulkUploadService` → `UserUtilityServiceImpl.createBulkUploadUser` |
| FR-006 | For the NGO/volunteer population, a separate Kafka consumer SHALL call `POST /v5/cb/user/ngo/bulkcreate` once per row, explicitly avoiding the government-population code path because it hardcodes `organisationType=Government`. | `NonGovtUserBulkUploadProcessingServiceImpl.createVolunteerUser` |
| FR-007 | `POST /v5/cb/user/bulkcreate` and `/ngo/bulkcreate` SHALL each create **exactly one** user per call; neither accepts nor processes an array of user records. | `SSOUserCreateActor.createBulkUsers`/`createNgoBulkUsers` — no loop over a list in either |
| FR-008 | The NGO bulk-create path SHALL reject a request if the target org's ministry/state does not match the calling admin's own org's ministry/state, unless either record is empty. | `SSOUserCreateActor.isSameMinistryOrState` |
| FR-009 | The NGO bulk-create path SHALL set the created user's role to `VOLUNTEER` if, and only if, the resolved target org's type is `NGO`. | `SSOUserCreateActor.populateVolunteerRoles`/`applyOrganisationRoleAndRootOrg` |
| FR-010 | The government bulk-create path SHALL unconditionally set the created user's role to `PUBLIC`. | `SSOUserCreateActor.populatePublicRoles` |
| FR-011 | Both bulk-create paths SHALL require a non-empty `profileDetails` map in the request, rejecting with a client error otherwise. | `SSOUserCreateActor.updateMinistryDetailsForUsers` |
| FR-012 | The admin SHALL be able to retrieve a batch-level (total/success/failed count) status list and download a per-row result file for a completed batch. | `BulkUploadComponent.getBulkStatusList`/`handleDownloadFile`; `GET /apis/proxies/v8/user/v1/bulkupload/{rootOrgId}`, `.../bulkuser/download/{fileName}` |

### Legacy pipeline

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | A platform/tenant admin (role `admin` or `register-admin`) SHALL be able to upload an `.xlsx` file of new users via a separate tenant-admin UI, selecting a target department. | `UserBulkUploadComponent` (`sunbird-cb-portal`); `tenant-admin-routing.module.ts` |
| FR-021 | This upload SHALL be sent as a JSON body containing the file's base64-encoded content, to a dedicated uiproxy route that does not forward to either `sunbird-cb-ext` or `sunbird-lms-service`. | `upload.service.ts` (cb-portal) → `POST /apis/protected/v8/admin/userRegistration/bulkUpload` |
| FR-022 | This route SHALL parse the file and, per row, provision the user directly in Keycloak (`createKeycloakUser`, password update, action-email), independent of the platform's own user-creation actor. | `admin/userRegistration.ts:259-372` (`sunbird-cb-uiproxy`) |

### Native, unconnected pipeline

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | `sunbird-lms-service` SHALL independently support `POST /v1/user/upload`: a self-contained CSV-bulk-upload pipeline with its own actor, Cassandra tables, and status API, functionally equivalent in effect to the live pipeline's end result. | `BulkUploadController.userBulkUpload`, `UserBulkUploadActor`, `UserBulkUploadBackgroundJobActor` |
| FR-031 | This pipeline SHALL accept the file as multipart form data, urlencoded form data (`data` field), or a JSON body (`data` field as file bytes) — three alternative body shapes tried in order. | `BaseBulkUploadController.createAndInitBulkRequest` |
| FR-032 | Rows without an existing `userId` SHALL be created via the same `SSOUserCreateActor.createSSOUser` logic used by the live pipeline, invoked via a direct in-process actor call rather than HTTP. | `UserBulkUploadBackgroundJobActor.processUser`/`callCreateUser` |
| FR-033 | Rows with an existing `userId` SHALL instead be routed to `user_update_actor` (and `user_role_actor` if roles are present) — an update, not a create. | `UserBulkUploadBackgroundJobActor.processUser` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | The live pipeline's file upload SHALL be capped at 10 MB and `.csv` only. | `BulkUploadComponent`: `maxFileSizeBytes = 10 * 1024 * 1024`, `validateFile(fileName, ['csv'])` |
| NFR-002 | The NGO bulk-upload path SHALL be capped at 10,000 rows at the backend config layer, with no equivalent client-side warning. | `sb-cb-ext-service-env.j2`: `nongovt.bulk.upload.max.rows=10000` |
| NFR-004 | Duplicate rapid-fire submissions for the same email/phone SHALL be rejected via a Redis-backed TTL guard, applied uniformly to every path through `SSOUserCreateActor`. | `SSOUserCreateActor.processSSOUser` — Redis keys `sso:email:<email>`/`sso:phone:<phone>` |
| NFR-005 | None of the three pipelines' UIs SHALL implement interval-based status polling; each re-fetches a status list exactly once per page load/submit. | `BulkUploadComponent`, `UserBulkUploadComponent` — no timer/interval found in either |

## Constraints and assumptions baked into the build

| ID | Constraint/Assumption | Implication | Source |
|---|---|---|---|
| CON-001 | `sunbird-lms-service`'s `/v5/cb/user/bulkcreate` and `/ngo/bulkcreate` process one user per HTTP call, with no batch semantics. | Every "bulk" registration observed in the live pipeline is, at this layer, N sequential single-user HTTP calls made by `sunbird-cb-ext` — a partial failure of the CSV batch is a partial failure of many independent HTTP requests, not one transactional operation. | `SSOUserCreateActor.createBulkUsers`/`createNgoBulkUsers` |
| CON-002 | Welcome email/SMS and the Keycloak required-action link (`sendEmailAndSms` in `SSOUserCreateActor`) fire only if `context.callerId` is set; neither bulk-create controller method sets it. | Users created via the live pipeline's CSV upload likely never receive an onboarding email/SMS through this code path — flagged, not fully confirmed (an unreviewed upstream filter could theoretically set it). | `SSOUserCreateActor.processSSOUser:259-261`; `UserController.bulkCreateUserV5`/`bulkCreateVolunteerUserV5` (no `CALLER_ID` set) |
| CON-003 | Keycloak account/password provisioning in `SSOUserCreateActor` happens only `if` a `password` field is present in the request. Whether `sunbird-cb-ext`'s per-row constructed request includes one was not confirmed. | If it does not, CSV-bulk-created users may have a platform record with no way to authenticate. | `UserUtil.updatePassword`; `UserUtilityServiceImpl.constructBulkUserCreateRequest` (contents not traced) |
| CON-004 | The status API for the native pipeline (`GET /v1/upload/status/:pid`) maps every non-`COMPLETED`/`IN_PROGRESS` state — including `FAILED` — to a generic `NOT_STARTED` string. | A caller of this API cannot distinguish "hasn't started yet" from "failed" without separately inspecting the raw `status` column. | `BulkUploadManagementActor.updateResponseStatus` |
| CON-005 | No CSV template file is committed in any traced repo; the expected column set is either a Cassandra `system_settings` value or a hardcoded Java array. | Changing the expected CSV format requires either a data migration or a code change — there is no versioned schema artifact to diff against. | `DataCacheHandler.bulkUserAllowedFields`; `UserBulkUploadActor.upload` |
| CON-006 | `sunbird-cb-adminportal` has no bulk-user-registration UI at the traced commit. | Any organization relying on `sunbird-cb-adminportal` as its admin surface has no path to this feature at all — only `sunbird-cb-orgportal` exposes it. | Exhaustive grep for `bulkcreate`/`bulkupload`/registration keywords in `sunbird-cb-adminportal`, no matches found |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | Three structurally independent implementations of "CSV-upload users into the platform" exist (live via `sunbird-cb-ext`, native via `sunbird-lms-service`'s own `/v1/user/upload`, legacy via `sunbird-cb-uiproxy`'s direct-Keycloak route), sharing no code, no Cassandra schema, and no Kafka topics. | FR-004/FR-005 vs. FR-030 vs. FR-021 | See HLD's "Three independent bulk-registration pipelines" |
| DEV-002 | `sunbird-lms-service`'s native `/v1/user/upload` pipeline has a Kong route but no confirmed caller among any of the 8 repos traced. | Sits underneath FR-030 | Kong `main.yml:4683-4699`; absence of any matching caller in `sunbird-cb-uiproxy`, `sunbird-cb-orgportal`, `sunbird-cb-adminportal`, `sunbird-cb-portal` |
| DEV-003 | `sunbird-cb-orgportal` ships a second, orphaned bulk-upload UI (`UsersUploadComponent`) whose route is commented out — dead code sharing the same general purpose as the live `BulkUploadComponent`, of an earlier vintage (last touched 2026-01-29 vs. 2026-07-17). | Sits underneath FR-001 | `home.rounting.module.ts` (routes commented out); component last-modified dates |
| DEV-004 | `sunbird-lms-service`'s `BulkUploadManagementActor.upload()` method (operation `BULK_UPLOAD`) is unreachable — no controller sends that operation, and its own internal call to forward to a background job is commented out even if it were reached. | Adjacent to FR-030 | `BulkUploadManagementActor.java` — route/actor-binding grep shows no caller; `// tellToAnother(request);` commented out |

## Out of scope (not reconstructible from these 8 repos)

- The exact request body `UserUtilityServiceImpl.constructBulkUserCreateRequest`
  builds for each per-row call into `/v5/cb/user/bulkcreate` — in
  particular whether it includes a `password` field (see CON-003).
- Any consumer or external caller of `sunbird-lms-service`'s native
  `/v1/user/upload` outside these 8 repos (see DEV-002).
- The exact Cassandra DDL for `bulk_upload_process_task` and
  `bulk_user_upload_detail` — not found in `sunbird-devops`'s migration
  files.
- The `validateFrameworkDetails` field list referenced by
  `UserRequestValidator` — identified but not read line-by-line.
- Whether `sunbird-cb-adminportal` exposes a bulk-registration UI in any
  module outside `project/ws/app/src/lib` (an exhaustive search of that
  directory found none; the rest of the repo was not searched).

---

> **Verification boundary:** every FR/NFR/CON/DEV above is traced to one
> of the 8 repos listed in [index.md](index.md) at the file/function
> cited in its Source column, drawn from four independent research
> passes over this codebase. No original spec/ticket existed to verify
> these against (see Purpose and method); this document is reconstructed
> from shipped behaviour, not compared to an approved requirement set.
> Resolving CON-002/CON-003 (reading
> `constructBulkUserCreateRequest`'s exact field list) and DEV-002
> (checking whether any external system calls `/v1/user/upload`) would
> convert this document's two most operationally significant open
> questions from "unverified" to "confirmed."