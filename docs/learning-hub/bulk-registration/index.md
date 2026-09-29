# Bulk Registration

The platform's mechanism for creating many user accounts at once from an
uploaded CSV, rather than one signup at a time. An org admin (or, for
NGOs, an org-onboarding admin) downloads a template, fills in rows of
new users, uploads the file, and the platform creates the accounts
asynchronously — reporting back a per-row success/failure result the
admin can download.

- **Live UI**: `sunbird-cb-orgportal` — Directory → a department's Users
  page → **Bulk Creation** tab (`BulkUploadComponent`)
- **Two record populations**: standard MDO/government users, and a
  separate NGO/volunteer variant gated on the org being NGO-typed
  (`isNgo`)
- **Status**: ⚠️ this is not one pipeline — see below and
  [As-Built Requirements](as-built-requirements.md) for the full list of
  divergences

## In one paragraph

An org admin opens the Bulk Creation tab, downloads a CSV template,
fills in new users, and uploads it. The file is verified by OTP sent to
the *admin's own* email/phone (not the new users'), then posted to
`sunbird-cb-ext`'s `/user/{v1,v2,v3}/bulkupload` (or
`/user/nongovt/v1/bulkupload` for NGO orgs). That service stores the
file, tracks the batch in its own Cassandra table, and hands rows off to
a Kafka consumer, which — one HTTP call **per CSV row** — calls
`sunbird-lms-service`'s `POST /v5/cb/user/bulkcreate` (or
`/v5/cb/user/ngo/bulkcreate`). Despite the route name and the "many
rows" framing, that endpoint creates **exactly one user per call**;
there is no array-of-users handling anywhere in the actor that serves
it. The batching that makes this feature "bulk" happens entirely in
`sunbird-cb-ext`'s consumer loop, one layer above the API most people
would assume does the batching. Two more, largely unconnected,
implementations of "upload a CSV of users" also exist in the traced
repos — see [HLD](hld.md) for all three.

## How an org admin experiences it

1. **Opens** Directory → a department's Users page → **Bulk Creation**
   tab.
2. **Downloads** a CSV template — a static hardcoded field list (or a
   platform-config override), not a file shipped in any repo.
3. **Verifies by OTP** sent to their own email/phone (not the new
   users'), before the file can be submitted.
4. **Uploads** the CSV (≤10 MB, `.csv` only); it's queued asynchronously.
5. **Manually refreshes** a status table to see batch-level
   success/failure counts — there is no live progress bar or polling.
6. **Downloads a result file** to see which rows failed and why.

## Actors

| Actor | Role |
|---|---|
| Org Admin / MDO Admin / MDO Leader | Uploads a CSV of new government/MDO users for their department |
| SPV Admin / Org-onboarding Admin | Uploads a CSV of new NGO/volunteer users for an NGO-typed org |
| Platform/Tenant Admin (legacy) | Uses a separate, frozen `sunbird-cb-portal` admin UI that bypasses this entire pipeline |
| Platform ops | Investigates stuck batches across whichever of the three pipelines was used |

## The one decision that defines the feature

> The two endpoints named for "bulk create" — `POST
> /v5/cb/user/bulkcreate` and `POST /v5/cb/user/ngo/bulkcreate` in
> `sunbird-lms-service` — take a single flat user object in their
> request body and create exactly one user per call. `SSOUserCreateActor`
> has no loop, no array handling, and no per-row result aggregation for
> either operation. The actual "many rows from one CSV" batching is
> entirely `sunbird-cb-ext`'s doing: its Kafka consumer iterates the
> parsed CSV rows and calls one of these two endpoints once per row over
> plain HTTP. A reader going only by endpoint names would conclude the
> opposite of how the system is actually built.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the reconstructed
requirement set with every known deviation called out.

> **Verification boundary:** this feature set is sourced from all 8 repos
> named for this analysis, each checked out at the branch/commit with
> its own most-recent tagged release at analysis time (September 2026):
> `sunbird-cb-ext` (`cbrelease-4.8.41`, `55e79421`), `sunbird-cb-workflow`
> (`cbrelease-4.8.39.2`, `8ae07a0` — analyzed and confirmed **out of
> scope**, see HLD), `sunbird-lms-service` (`cbrelease-4.8.41`,
> `e06912f8`), `sunbird-cb-orgportal` (`cbrelease-4.8.40`, `b4d19553`),
> `sunbird-cb-adminportal` (`cbrelease-4.8.40.1`, `4a35703e` — analyzed,
> has **no** bulk-registration UI, see HLD), `sunbird-cb-portal`
> (`cbrelease-4.8.40`, `eafc3ea7`), `sunbird-cb-uiproxy`
> (`cbrelease-4.8.41`, `175d24c`), and `sunbird-devops`
> (`cbrelease-4.8.41`, `b4c4602b`). Several facts below (whether Keycloak
> account/password provisioning and welcome-email/SMS fire for
> CSV-bulk-created users; the exact request body `sunbird-cb-ext`
> constructs for the per-row `bulkcreate` call) could not be confirmed
> to file/line and are flagged inline as open questions, not asserted.