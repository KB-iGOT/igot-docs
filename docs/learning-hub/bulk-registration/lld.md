# Bulk Registration — LLD

Reverse-engineered from code. Three pipelines exist (see [HLD](hld.md));
each has its own storage, its own status model, and its own validation
rules — nothing here is shared across all three unless stated.

## Storage reality

### Cassandra (`sunbird-cb-ext`, keyspace `sunbird`)

| Table | Written by | Purpose |
|---|---|---|
| `user_bulk_upload` | `ProfileServiceImpl.bulkUpload`/`bulkUploadV2`, `NonGovtUserBulkUploadServiceImpl` | Shared batch-tracking table for **both** the govt and NGO CSV pipelines — composite key `(rootOrgId, identifier)` |

### Cassandra (`sunbird-lms-service`, keyspace `sunbird`)

| Table | Written by | Purpose |
|---|---|---|
| `bulk_upload_process` | `BulkUploadProcessDaoImpl` | Batch-level record for the **native**, unconnected `/v1/user/upload` pipeline: `id, status, data, successResult, failureResult, uploadedBy, uploadedDate, processStartTime, processEndTime, objectType, organisationId, retryCount` |
| `bulk_upload_process_task` | `BulkUploadProcessTaskDaoImpl` | Per-row record: `processId, sequenceId, status, data, successResult, failureResult, createdOn, lastUpdatedOn, iterationId` |

`bulk_upload_process_task`'s DDL was **not found** in `sunbird-devops`'s
CQL migration file, unlike `bulk_upload_process` (which is present,
`cassandra-cql-update/templates/cassandra.cql:378-379,486`) — its schema
must be created elsewhere or bootstrapped outside this checkout's range.

### Cassandra (`sunbird-cb-uiproxy`, legacy pipeline)

| Table | Written by | Purpose |
|---|---|---|
| `bulk_user_upload_detail` | `admin/userRegistration.ts` | Batch/row status for the legacy, Keycloak-direct pipeline. No DDL found in `sunbird-devops` either — same open gap as above. |

### Kafka topics

| Topic | Producer | Consumer |
|---|---|---|
| `user.bulk.upload.final` | `ProfileServiceImpl` (`sunbird-cb-ext`) | `UserBulkUploadConsumer` (same repo) |
| `nongovt.user.bulk.upload.final` | `NonGovtUserBulkUploadServiceImpl` (`sunbird-cb-ext`) | `NonGovtUserBulkUploadConsumer` (same repo) |

No Kafka topic connects any of these to `sunbird-lms-service` — the
handoff from `sunbird-cb-ext` to `sunbird-lms-service` is plain
synchronous HTTP, not an async message.

### Status model

`sunbird-lms-service`'s `BulkProcessStatus` enum (native pipeline only):
`NEW(0)`, `IN_PROGRESS(1)`, `INTERRUPT(2)`, `COMPLETED(3)`, `FAILED(9)`.
`IN_PROGRESS` and `INTERRUPT` are only ever **read**, never set, by the
user-bulk-upload code path — a batch/row goes straight
`NEW → COMPLETED` or `NEW → FAILED`. The status API
(`GET /v1/upload/status/:pid`) collapses anything other than `COMPLETED`
or the (never-set) `IN_PROGRESS` down to a generic `NOT_STARTED` string —
so a batch that actually failed reports as `NOT_STARTED` until/unless it
later flips to `COMPLETED`.

`sunbird-cb-ext`'s two pipelines were not confirmed to share this exact
enum — their status column semantics were traced only as far as
"batch-level total/success/failed counts," per the frontend trace.

## Sequence: live pipeline, government/MDO user

```mermaid
flowchart TD
    A["Org admin uploads CSV - Bulk Creation tab"] --> B["OTP sent to admin's own email/phone"]
    B --> C["OTP verified"]
    C --> D["POST /apis/proxies/v8/user/v3/bulkupload (or v2)"]
    D --> E["Kong -> sb-cb-ext-service"]
    E --> F["ProfileServiceImpl.bulkUpload/bulkUploadV2"]
    F --> G["Store file, insert tracking row: user_bulk_upload"]
    G --> H["Publish Kafka: user.bulk.upload.final"]
    H --> I["UserBulkUploadConsumer -> UserBulkUploadService"]
    I --> J["Parse CSV rows, validate fields"]
    J --> K{"For each row"}
    K --> L["UserUtilityServiceImpl.createBulkUploadUser"]
    L --> M["HTTP POST /v5/cb/user/bulkcreate (ONE user)"]
    M --> N["SSOUserCreateActor.createSSOUser"]
    N --> O["Create user row + role assignment + sync ES index"]
    K --> P["Aggregate per-row result"]
    P --> Q["Admin manually refreshes status list, downloads result CSV"]
```

## Sequence: native, unconnected pipeline (`/v1/user/upload`)

```mermaid
flowchart TD
    A["Caller POSTs CSV to /v1/user/upload (no confirmed caller in these repos)"] --> B["BulkUploadController.userBulkUpload"]
    B --> C["UserBulkUploadActor.upload - validate header columns"]
    C --> D["Insert bulk_upload_process row (status NEW), reply processId"]
    D --> E["validateAndParseRecords - batch-insert bulk_upload_process_task rows"]
    E --> F["Akka tell -> UserBulkUploadBackgroundJobActor (async, in-process)"]
    F --> G{"For each task row"}
    G --> H["No userId in row? -> in-process ask to SSOUserCreateActor.createSSOUser"]
    G --> I["userId present? -> user_update_actor / user_role_actor"]
    H --> J["Mark task COMPLETED/FAILED"]
    I --> J
    J --> K["Mark bulk_upload_process COMPLETED, aggregate successResult/failureResult"]
    K --> L["GET /v1/upload/status/:pid"]
```

## Sequence: legacy pipeline (`sunbird-cb-portal` tenant-admin)

```mermaid
flowchart TD
    A["Tenant admin uploads xlsx - user-bulk-upload page"] --> B["FileReader -> base64 data URL"]
    B --> C["POST /apis/protected/v8/admin/userRegistration/bulkUpload - JSON body"]
    C --> D["admin/userRegistration.ts - write to local disk, parse with node-xlsx"]
    D --> E{"For each row"}
    E --> F["createKeycloakUser + UpdateKeycloakUserPassword + sendActionsEmail"]
    F --> G["Track row in bulk_user_upload_detail"]
    E --> H["Admin manually refreshes bulkUploadData, downloads bulkUploadReport"]
```

## Validation reality

| Rule | Enforced | Where |
|---|---|---|
| `.csv` extension only, ≤10 MB | Frontend | `BulkUploadComponent.handleOnFileChange`/`uploadCSVFile` (orgportal, live) |
| `.xlsx` only | Frontend | `UserBulkUploadComponent` (cb-portal, legacy) |
| OTP verification of the *submitting admin* | Frontend, gates the upload call | `BulkUploadComponent.sendOTP`/`generateAndVerifyOTP` |
| Mandatory CSV columns | Backend, dynamic-or-hardcoded field list | `UserBulkUploadActor.upload` / `system_settings` `userProfileConfig`/`csv` |
| Max 10,000 rows (NGO CSV) | Backend config | `sb-cb-ext-service-env.j2`: `nongovt.bulk.upload.max.rows=10000` |
| Row/size cap (native `/v1/user/upload`) | Backend config | `sunbird_lms-service.env`: `sunbird_user_bulk_upload_size=1001` |
| `firstName` required; `email`/`phone`/`managedBy` (mutually exclusive with the latter) required | Backend | `UserRequestValidator.validateUserCreateV3` |
| Non-empty `profileDetails` required | Backend, explicit exception | `SSOUserCreateActor.updateMinistryDetailsForUsers` — throws `bulkUserCreateProfileValidation` |
| NGO bulk-create: target org's ministry/state must match the calling admin's org (unless either record is empty) | Backend | `SSOUserCreateActor.isSameMinistryOrState` — throws `errorConflictingRootOrgId` |
| NGO bulk-create: role forced to `VOLUNTEER` only if the resolved org is `NGO`-typed | Backend | `SSOUserCreateActor.populateVolunteerRoles` |
| Duplicate-submission guard (email/phone, Redis TTL) | Backend | `SSOUserCreateActor.processSSOUser` — Redis keys `sso:email:<email>`/`sso:phone:<phone>` |
| Welcome email/SMS + Keycloak required-action link | **Conditional on `context.callerId` being set** — not set by either bulkcreate controller method | `SSOUserCreateActor.processSSOUser:259-261` vs. `UserController.bulkCreateUserV5`/`bulkCreateVolunteerUserV5` (no `CALLER_ID` set) |
| Keycloak account/password provisioning | **Conditional on a `password` field being present in the request** | `UserUtil.updatePassword` → `KeyCloakServiceImpl`, called only `if (password present)` |

> **Verification boundary:** the storage, sequence, and validation facts
> above are read directly from the four traced repos at the file/line
> citations gathered during this analysis. Not verified from source:
> whether `UserUtilityServiceImpl.constructBulkUserCreateRequest`
> (`sunbird-cb-ext`) includes a `password` field in the per-row request
> it sends to `/v5/cb/user/bulkcreate` — this single fact determines
> whether Keycloak accounts are actually provisioned for CSV-bulk-created
> government/MDO users, and whether any welcome email/SMS ever reaches
> them. Also unverified: the exact Cassandra schema for
> `bulk_upload_process_task` and `bulk_user_upload_detail` (DDL not found
> in `sunbird-devops`); and whether `sunbird-cb-ext`'s status-tracking
> columns share `sunbird-lms-service`'s `BulkProcessStatus` enum values.