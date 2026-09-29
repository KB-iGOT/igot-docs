# Bulk Registration — Use Cases

Verified from `sunbird-cb-orgportal`, `sunbird-cb-adminportal`,
`sunbird-cb-portal`, `sunbird-cb-uiproxy`, `sunbird-cb-ext`,
`sunbird-lms-service`, and `sunbird-devops` (branches/commits as listed
in [index.md](index.md)).

## Live pipeline (org admin, via sunbird-cb-orgportal)

| ID | Use case | Detail | API |
|---|---|---|---|
| UC-1 | Download the CSV template | A per-org sample file path resolved from route config; NGO orgs get a different sample file/name than standard orgs. There is no template file committed in any traced repo — the field list is either a Cassandra `system_settings` entry (`userProfileConfig`/`csv`) or, if absent, a hardcoded array in `DataCacheHandler.bulkUserAllowedFields` (`firstName, lastName, phone, countryCode, email, userName, roles, position, location, dob, language, profileSummary, subject, externalIdProvider, externalId, externalIdType, externalIds`). | `FileService.download()` (static asset fetch, orgportal) |
| UC-2 | Bulk-create government/MDO users | Picks a `.csv` file (≤10 MB, extension-checked client-side), completes an OTP challenge sent to the *admin's own* email/phone, then uploads. No row-count cap enforced client-side. | POST `/apis/proxies/v8/user/v3/bulkupload?orgId=&channel=` (falls back to `v2/bulkupload` if no org context) |
| UC-3 | Bulk-create NGO/volunteer users | Same flow, gated on `OrgHierarchyService.getOrgData().isNgo`; posts `file` + `targetorgid` instead of `data`. Backend enforces a 10,000-row cap (`nongovt.bulk.upload.max.rows`) not visible to the UI. | POST `/apis/proxies/v8/user/nongovt/v1/bulkupload` |
| UC-4 | Check batch status | A one-time (non-polling) re-fetch of a paginated list of the admin's own past uploads, keyed by org, showing batch-level total/success/failed counts — no per-row detail inline. | GET `/apis/proxies/v8/user/v1/bulkupload/{rootOrgId}` |
| UC-5 | Download the result file | Per-row pass/fail and error messages are visible only in a downloadable CSV, never inline in the UI table. | GET `/apis/proxies/v8/user/v1/bulkuser/download/{fileName}` |

## Legacy pipeline (platform/tenant admin, via sunbird-cb-portal)

| ID | Use case | Detail | API |
|---|---|---|---|
| UC-6 | Bulk-register users (legacy, department-scoped) | A separate admin UI (`admin`/`register-admin` role), functionally unchanged since 2021, that reads the file as a base64 data URL and posts JSON — no OTP gate, no client-side size cap, `.xlsx` only. Hits an entirely different backend path than UC-2/UC-3, bypassing both `sunbird-cb-ext` and `sunbird-lms-service` (see [HLD](hld.md)). | POST `/apis/protected/v8/admin/userRegistration/bulkUpload` |
| UC-7 | Check legacy batch status | Same one-time-refresh pattern as UC-4, against the legacy path's own status/report endpoints. | GET `/apis/protected/v8/admin/userRegistration/bulkUploadData`, `.../bulkUploadReport/{id}` |

## Not surfaced in any traced UI

| ID | Use case | Detail | API |
|---|---|---|---|
| UC-8 | Bulk-create via the native lms-service pipeline (unverified caller) | `sunbird-lms-service` has its own complete, independent CSV-bulk-upload implementation — its own actor, its own Cassandra tables, its own status endpoint — structurally similar to UC-2/UC-3 but reached over a different route family. A Kong route exists for it, but no UI in any of the 8 repos was found calling it; see [HLD](hld.md#three-independent-bulk-registration-pipelines). | POST `/v1/user/upload` (Kong: `{{user_service_prefix}}/v1/upload`), GET `/v1/upload/status/{pid}` |
| UC-9 | Bulk user org-transfer (adjacent, out of scope) | `sunbird-cb-adminportal`'s only "bulk user" feature — moves **existing** users between org-hierarchy nodes. Shares OTP-dialog boilerplate with UC-2/UC-3 (copy-paste lineage) but creates no accounts. Out of scope for this document. | POST `/apis/proxies/v8/user/v1/org-migration/bulk-upload/{frameworkId}` |

> **Verification boundary:** UC-1 through UC-7 are traced end-to-end
> through actual request/response code. UC-8's existence and code path
> are confirmed; whether anything outside these 8 repos calls it is not
> verifiable from this analysis. `sunbird-cb-orgportal` also ships a
> second, orphaned bulk-upload component (`UsersUploadComponent`) whose
> route is commented out in the routing module — dead code, not listed
> as a use case; see [As-Built Requirements](as-built-requirements.md).