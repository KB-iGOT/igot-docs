# Bulk Registration — HLD

Reverse-engineered from `sunbird-cb-orgportal`, `sunbird-cb-adminportal`,
`sunbird-cb-portal`, `sunbird-cb-uiproxy`, `sunbird-cb-ext`,
`sunbird-cb-workflow`, `sunbird-lms-service`, and `sunbird-devops`.

## Three independent bulk-registration pipelines

The single biggest architectural fact about this feature: there are
**three separate implementations of "upload a CSV and create user
accounts,"** built at different times, sharing almost no code, and only
one of them is reachable from a live, routed UI.

1. **The live pipeline** — `sunbird-cb-orgportal`'s Bulk Creation tab →
   `sunbird-cb-uiproxy` → Kong → `sunbird-cb-ext` (parses the CSV, tracks
   the batch, publishes to Kafka) → a Kafka consumer that calls
   `sunbird-lms-service`'s `/v5/cb/user/bulkcreate` (or
   `/ngo/bulkcreate`) **once per row over HTTP**.
2. **The native, unconnected pipeline** — `sunbird-lms-service` also has
   its own complete, self-contained CSV pipeline (`/v1/user/upload`),
   with its own actor, its own Cassandra tables, and its own status API.
   It reaches the same underlying user-creation code
   (`SSOUserCreateActor.createSSOUser`) as pipeline 1, but via a direct
   in-process Akka call rather than HTTP — and no UI in any of the 8
   repos was found calling it. A Kong route exists for it; nothing
   observed uses that route.
3. **The legacy, bypass pipeline** — `sunbird-cb-portal`'s tenant-admin
   "user-bulk-upload" page, functionally unchanged since 2021, posts to
   `sunbird-cb-uiproxy`'s own `admin/userRegistration.ts`, which parses
   the file and calls **Keycloak directly**, never touching
   `sunbird-cb-ext` or `sunbird-lms-service` at all.

`sunbird-cb-adminportal` has **no bulk-registration UI**; its only
"bulk user" feature moves existing users between org nodes, a different
capability. `sunbird-cb-workflow` was also traced and confirmed to have
no role in registration — its "bulk" code paths update profile fields
on **existing** users through a workflow/approval engine.

## Topology

```mermaid
flowchart TB
    subgraph OrgPortal["sunbird-cb-orgportal (live)"]
        BulkUpload["BulkUploadComponent - Directory > Users > Bulk Creation"]
        DeadUI["UsersUploadComponent - route commented out, dead"]
    end

    subgraph TenantAdmin["sunbird-cb-portal (legacy, frozen since 2021)"]
        LegacyUI["UserBulkUploadComponent - tenant-admin"]
    end

    subgraph Proxy["sunbird-cb-uiproxy"]
        ProxyRoutes["proxies_v8.ts - v1/v2/v3/nongovt bulkupload (multipart to Kong)"]
        LegacyRoute["admin/userRegistration.ts - self-contained, own Cassandra table"]
    end

    Kong[("Kong API Gateway")]

    subgraph CbExt["sunbird-cb-ext (sb-cb-ext-service)"]
        ProfileCtrl["ProfileController - v1/v2/v3 bulkupload"]
        NonGovtCtrl["NonGovtUserController - nongovt/v1/bulkupload"]
        UBUConsumer["UserBulkUploadConsumer/Service"]
        NGConsumer["NonGovtUserBulkUploadConsumer/ProcessingService"]
    end

    subgraph LmsService["sunbird-lms-service"]
        BulkCreateCtrl["UserController.bulkCreateUserV5 / bulkCreateVolunteerUserV5"]
        SSOActor["SSOUserCreateActor.createSSOUser - ONE user per call"]
        NativeCtrl["BulkUploadController.userBulkUpload"]
        NativeActor["UserBulkUploadActor -> UserBulkUploadBackgroundJobActor"]
    end

    Keycloak[("Keycloak")]
    CassExt[("Cassandra: user_bulk_upload (cb-ext)")]
    CassLms[("Cassandra: bulk_upload_process, bulk_upload_process_task (lms-service)")]
    CassLegacy[("Cassandra: bulk_user_upload_detail (uiproxy legacy)")]
    Kafka[("Kafka: user.bulk.upload.final, nongovt.user.bulk.upload.final")]

    BulkUpload -->|"CSV multipart"| ProxyRoutes
    ProxyRoutes --> Kong
    Kong --> ProfileCtrl & NonGovtCtrl
    ProfileCtrl --> CassExt
    NonGovtCtrl --> CassExt
    ProfileCtrl -.->|publish| Kafka
    NonGovtCtrl -.->|publish| Kafka
    Kafka -.-> UBUConsumer & NGConsumer
    UBUConsumer -->|"HTTP, one call per row"| BulkCreateCtrl
    NGConsumer -->|"HTTP, one call per row"| BulkCreateCtrl
    BulkCreateCtrl --> SSOActor
    SSOActor -->|"conditional on password field (unconfirmed)"| Keycloak

    LegacyUI -->|"JSON, base64 file"| LegacyRoute
    LegacyRoute -->|"direct, per row"| Keycloak
    LegacyRoute --> CassLegacy

    NativeCtrl --> NativeActor
    NativeActor -->|"in-process actor call, not HTTP"| SSOActor
    NativeActor --> CassLms

    Kong -.->|"route exists, no confirmed caller"| NativeCtrl
```

## Responsibilities

| Component | Owns | Repo |
|---|---|---|
| `BulkUploadComponent` | Live CSV upload UI, OTP gate, org/NGO branching | `sunbird-cb-orgportal` |
| `UsersUploadComponent` | Orphaned predecessor — route commented out, superseded | `sunbird-cb-orgportal` |
| `UserBulkUploadComponent` | Legacy tenant-admin CSV upload, unchanged since 2021 | `sunbird-cb-portal` |
| `proxies_v8.ts` bulkupload handler | Multipart-to-Kong forwarding, header/role gating | `sunbird-cb-uiproxy` |
| `admin/userRegistration.ts` | Self-contained legacy pipeline direct to Keycloak | `sunbird-cb-uiproxy` |
| `ProfileController` / `ProfileServiceImpl` | Govt/MDO CSV parsing, batch tracking, Kafka publish | `sunbird-cb-ext` |
| `NonGovtUserController` / `NonGovtUserBulkUploadServiceImpl` | NGO/volunteer CSV parsing, batch tracking, Kafka publish | `sunbird-cb-ext` |
| `UserBulkUploadConsumer` / `NonGovtUserBulkUploadConsumer` | Per-row HTTP call into lms-service's bulkcreate endpoints | `sunbird-cb-ext` |
| `UserController.bulkCreateUserV5` / `bulkCreateVolunteerUserV5` | Single-user create endpoint, despite the name | `sunbird-lms-service` |
| `SSOUserCreateActor` | Shared user-creation logic for every path in this feature | `sunbird-lms-service` |
| `BulkUploadController` / `UserBulkUploadActor` / `UserBulkUploadBackgroundJobActor` | The native, self-contained CSV pipeline with no confirmed UI caller | `sunbird-lms-service` |
| `UserBulkTransferComponent` | Adjacent, out-of-scope: bulk org-transfer of **existing** users | `sunbird-cb-adminportal` |
| `UserBulkUpdateConsumer` / workflow bulk-update files | Adjacent, out-of-scope: bulk profile-field update for **existing** users | `sunbird-cb-workflow` |

## Key design decisions

- **"Bulk create" at the API layer is a misnomer.** `SSOUserCreateActor`
  creates one user per call for both `BULK_CREATE_USER_V5` and
  `NGO_BULK_CREATE_USER_V5`. The multi-row batching that makes this
  feature "bulk" is implemented entirely in `sunbird-cb-ext`'s consumer
  loop, a full layer above the endpoint whose name suggests it does the
  batching.
- **The live UI's CSV never reaches `sunbird-lms-service` directly.** It
  is fully parsed, validated, and tracked by `sunbird-cb-ext`
  (`sb-cb-ext-service`) first; `sunbird-lms-service` only ever sees one
  synthesized single-user request per row, arriving over plain HTTP from
  another internal service.
- **Two independent user-creation loops exist for the same net effect.**
  `sunbird-cb-ext`'s Kafka consumer calls the bulkcreate endpoints over
  HTTP; `sunbird-lms-service`'s own native `/v1/user/upload` pipeline
  reaches the identical underlying actor via an in-process Akka `ask` —
  built, seemingly, to do the same job a second, unconnected way. Neither
  reuses the other's CSV-parsing, batch-tracking, or Cassandra schema.
- **A fourth, fully separate implementation bypasses both services.**
  `sunbird-cb-portal`'s legacy tenant-admin page talks straight to
  Keycloak through a dedicated uiproxy route, with its own Cassandra
  table, no OTP gate, and no size cap — and its business logic hasn't
  changed since 2021 even though the surrounding codebase has been
  actively developed.
- **OTP verification protects the admin, not the new users.** Before any
  upload, the submitting admin must verify an OTP sent to *their own*
  email/phone — a safeguard against an unattended/compromised session
  initiating bulk account creation, not a check on the uploaded rows
  themselves.
- **Failure is per-row, not per-batch, in every pipeline traced.** A bad
  row does not fail the whole file in either `sunbird-cb-ext`'s consumers
  or `sunbird-lms-service`'s native background actor; each row
  independently ends success or failure, surfaced only via a downloadable
  result file — no pipeline has per-row detail inline in its UI.
- **No pipeline polls.** All three UIs (live, legacy) re-fetch a status
  list once, on load and once after submit. An admin must manually
  reopen the page to see whether an async batch has finished.

See [LLD](lld.md) for storage detail, sequence flows, and validation
rules, and the [Operations Manual](operations-manual.md) for how these
decisions surface in day-2 support.