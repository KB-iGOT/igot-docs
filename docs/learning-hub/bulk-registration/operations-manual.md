# Operations Manual — Bulk Registration

How to support Bulk Registration as it exists today — **three
independent implementations**, only one of them live and routed to a
current UI, with no shared status table and no progress polling
anywhere.

**Operational implication:** before investigating a "stuck upload,"
first establish *which* pipeline the admin used — the live org-portal
flow, the frozen tenant-admin legacy flow, or (unlikely, but possible)
a direct call to `sunbird-lms-service`'s native `/v1/user/upload`. Each
has its own Cassandra table and no cross-references between them.

## Which pipeline am I looking at?

| Symptom / entry point | Pipeline | Where to look |
|---|---|---|
| Admin used Directory → Users → Bulk Creation tab (`sunbird-cb-orgportal`) | Live | Cassandra `sunbird.user_bulk_upload` (`sunbird-cb-ext`'s keyspace); Kafka topics `user.bulk.upload.final` / `nongovt.user.bulk.upload.final` |
| Admin used the tenant-admin "user-bulk-upload" page (`sunbird-cb-portal`) | Legacy | Cassandra `bulk_user_upload_detail` (via `sunbird-cb-uiproxy`'s `admin/userRegistration.ts`) — no Kafka, synchronous Keycloak calls |
| A direct API call to `/v1/user/upload` on `sunbird-lms-service` | Native (unconfirmed live caller) | Cassandra `sunbird.bulk_upload_process` / `bulk_upload_process_task`; `GET /v1/upload/status/{pid}` |

Do not assume the live pipeline's Cassandra table has any record of a
batch reported through the legacy tenant-admin page, or vice versa —
they are entirely separate systems that happen to solve the same
business problem.

## Live pipeline: reading a batch status

1. Batch-level status: `GET /apis/proxies/v8/user/v1/bulkupload/{rootOrgId}`
   (uiproxy) → reads `sunbird.user_bulk_upload` in `sunbird-cb-ext`.
   Shows total/success/failed row counts only.
2. Row-level detail: only available via the downloadable result file —
   `GET /apis/proxies/v8/user/v1/bulkuser/download/{fileName}`. There is
   no admin-facing API that returns per-row errors as structured data.
3. Remember: the UI does **not** poll. If an admin reports "it's stuck,"
   the first step is simply to ask them to reopen/refresh the page — a
   completed batch will not update the currently-open tab on its own.
4. If the batch genuinely appears stuck, check whether it reached Kafka
   at all (`user.bulk.upload.final` / `nongovt.user.bulk.upload.final`
   consumer lag) before assuming a downstream failure at
   `sunbird-lms-service`.

## Legacy pipeline: reading a batch status

1. Batch-level status: `GET /apis/protected/v8/admin/userRegistration/bulkUploadData`.
2. Row-level detail: `GET /apis/protected/v8/admin/userRegistration/bulkUploadReport/{id}`,
   converted client-side to a CSV.
3. This pipeline calls Keycloak **synchronously, per row** — a stuck or
   slow batch here is far more likely to be a Keycloak availability
   issue than a Kafka/consumer-lag issue, since there is no queue between
   the upload and the Keycloak calls.
4. This code path has been functionally unchanged since 2021 — treat any
   bug found here with the expectation that it has been present, silent,
   and unfixed for a long time, not a regression from a recent change.

## Known failure modes and what they mean

| Failure | Pipeline | Cause | Where to look |
|---|---|---|---|
| Entire file rejected before any row is processed | Live, Legacy | Wrong extension (`.csv` vs `.xlsx` — the two pipelines disagree on which one they accept), file >10 MB (live only), or OTP not completed | Frontend validation in `BulkUploadComponent`/`UserBulkUploadComponent` |
| A row fails with "conflicting root org" | Live (NGO variant only) | The target org's ministry/state doesn't match the calling admin's own org | `SSOUserCreateActor.isSameMinistryOrState` |
| A row fails with a profile-validation error | Live, Native | Missing/empty `profileDetails` in the constructed request | `SSOUserCreateActor.updateMinistryDetailsForUsers` |
| A row is silently deduplicated/rejected as a duplicate request | Live, Native, any path through `SSOUserCreateActor` | Redis TTL guard on email/phone — a very recent retry of the same row within the TTL window is treated as a duplicate | `SSOUserCreateActor.processSSOUser` |
| Batch shows `NOT_STARTED` even though it actually failed | Native (`/v1/user/upload`) only | The status API collapses any non-`COMPLETED` state — including `FAILED` — down to `NOT_STARTED` | `BulkUploadManagementActor.updateResponseStatus` |
| Created users report never receiving a welcome email, or never being able to log in | Live, possibly Native | Welcome email/Keycloak account provisioning both key off conditions (`callerId` context, `password` field) that are not set on the bulk-create request path — **open question, see below** | `SSOUserCreateActor.processSSOUser`, `UserUtil.updatePassword` |

## Two open questions worth resolving before relying on this feature operationally

1. **Does a CSV-bulk-created government/MDO user actually get a Keycloak
   account?** Keycloak provisioning in `SSOUserCreateActor` only happens
   if the incoming request includes a `password` field. Whether
   `sunbird-cb-ext`'s per-row request to `/v5/cb/user/bulkcreate`
   includes one was not confirmed in this analysis. If it doesn't, users
   created this way have a platform user record but no way to log in
   until some other provisioning step runs.
2. **Does anyone actually call `/v1/user/upload` on
   `sunbird-lms-service`?** A complete, working implementation exists,
   Kong has a route for it, but no UI in any of the 8 repos traced calls
   it. If it is genuinely unused, it is a maintenance liability (a second
   code path to the same effect as the live pipeline, that must still be
   kept working); if it *is* used by something outside these repos (a
   mobile app, an external integration), its behavior — including the
   `NOT_STARTED`-for-`FAILED` status quirk above — should be documented
   for that caller too.

## Dead code — do not confuse with the live paths

- `sunbird-cb-orgportal`'s `UsersUploadComponent` (under
  `users-view/all-users`) — its route is commented out in the routing
  module. If you find it while searching the codebase, it is not reachable
  from the running app.
- `sunbird-lms-service`'s `BulkUploadManagementActor.upload()` method
  (operation `BULK_UPLOAD`) — no controller or route sends this
  operation; its own background-job-forwarding call is commented out even
  if reached. Confirmed dead by both routing analysis and reading the
  method body.
- `sunbird-cb-ext`'s `UserMigrationController`/`UserMigrationBulkConsumer`
  and `sunbird-cb-workflow`'s bulk-update files — live code, but for a
  different feature (existing-user org transfer / profile update), not
  registration. Don't route a registration support ticket to these.

> **Verification boundary:** the operational facts above follow directly
> from the code paths cited in [LLD](lld.md). The two open questions are
> flagged, not resolved — confirming them requires reading
> `UserUtilityServiceImpl.constructBulkUserCreateRequest`'s exact field
> construction (not captured in this analysis) and checking Kong/access
> logs or external-system documentation not present in any of the 8
> repos, respectively.