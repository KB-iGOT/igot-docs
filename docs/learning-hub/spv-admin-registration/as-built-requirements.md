# SPV & Admin Registration — As-Built Requirements

Requirements reconstructed from the shipped implementation of the SPV /
super-admin portal and the services behind it (commits listed in
[index.md](index.md)) — what the system does today, not what was originally
intended. Companion to the [HLD](hld.md), [LLD](lld.md) and
[Operations Manual](operations-manual.md).

## Purpose and method

No original specification was available. Each requirement is reconstructed
from `sunbird-cb-adminportal` and traced through `sunbird-cb-uiproxy`,
`sunbird-cb-ext`, `sunbird-lms-service`, `sunbird-cb-workflow` and
`sunbird-devops`. IDs: `FR-xxx`, `NFR-xxx`, `CON-xxx`, `DEV-xxx`. The public
side of onboarding is in
[User Onboarding](../user-onboarding/as-built-requirements.md).

## Functional requirements

### Organisations

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL list organisations by tab (organisation, state, volunteer, CBC / CBP providers) with search, sort and paging; for `STATE_ADMIN` the proxy SHALL inject `ministryOrStateId = rootOrgId`. | `directory.services.ts:28-93`; `proxies_v8.ts:559-585` |
| FR-002 | An `SPV_ADMIN`, `STATE_ADMIN` or `MDO_LEADER` SHALL be able to create a state, ministry, board or volunteer organisation with name, category, description and logo. | `create-organisation.component.ts:285-326`; `whitelistApis.ts:2163` |
| FR-003 | Create SHALL require `orgName, organisationType, organisationSubType, isTenant, channel` and `parentMapId` for any type other than state / ministry. | `ExtendedOrgServiceImpl.validateOrgRequest:332-368` |
| FR-004 | Create SHALL create the organisation in the core service, upsert the `org_hierarchy_v4` row with a derived `mapId`, and publish `dev.org.hierarchy.new.org`. | `ExtendedOrgServiceImpl.createOrg:69-209` |
| FR-005 | A duplicate state or ministry channel SHALL be rejected; a duplicate child SHALL be renamed `<parentChannel>_<name>`, linked to a blank hierarchy row, or rejected when the hierarchy row already points at it. | `createOrg` branches |
| FR-006 | The system SHALL allow editing only `logo` and `description` through the v2 update; other keys SHALL be rejected. | `updateV2:1102-1127`; `org.updatable.fields` |
| FR-007 | An `SPV_ADMIN` SHALL be able to set a volunteer organisation's status to 0 or 1, subject to the status transition table. | `directory-table.component.ts:369-431`; `OrgServiceImpl:322-348`; `whitelistApis.ts:7963` |
| FR-008 | CBC / CBP provider organisations SHALL be created through the core service directly and the portal SHALL then open the organisation's Users page. | `create-mdo.component.ts:442-508`; Kong `createOrg` |

### Users and roles

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | An admin SHALL be able to create a user in a chosen organisation with name, email, mobile and roles; `channel` SHALL be required. | `create-user.component.ts:362-375`; `profile-details.ts:225` |
| FR-021 | The system SHALL allow at most one `MDO_LEADER` per organisation, checked in the portal, the proxy and the core service. | `create-user.component.ts:515-525`; `profile-details.ts`; `SSOUserCreateActor.populateRoles:414-441` |
| FR-022 | Role assignment SHALL be validated: requester role suffix, SPV exemption, own-org or ministry/state authority, restrictions, and org-type role list. | `RoleAssignmentValidator.java:31-300` |
| FR-023 | A State Admin's create-user roles SHALL be `STATE_ADMIN` and `PUBLIC`. | `create-user.component.ts:60,257-259` |
| FR-024 | An existing user of an organisation SHALL be promotable to `MDO_ADMIN` (or `STATE_ADMIN` for a state organisation) unless they already hold either. | `ui-admin-user-table.component.ts:187-241`; `ui-user-table-pop-up.component.ts:118-122` |
| FR-025 | The State-users dialog SHALL create the user, assign roles and patch the profile to `VERIFIED` with `mandatoryFieldsExists: true`. | `create-user-dialog.component.ts` |

### Links and requests

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | A link and QR SHALL be generable for any organisation by `MDO_ADMIN, MDO_LEADER, SPV_ADMIN, SPV_PUBLISHER, STATE_ADMIN`, after a designation pre-check. | `directory-table.component.ts:276-347`; `whitelistApis.ts:5096` |
| FR-031 | Pending / approved / rejected requests of service `organisation`, `position` and `domain` SHALL be listable and approvable or rejectable (reason on reject). | `onboarding-requests.component.ts`; `requests-approval.component.ts:90-261` |
| FR-032 | Approving a domain request SHALL insert it into `master_data` as `userRegistrationPreApprovedDomain`. | `DomainWhiteListWorkFlowServiceImpl.processDomainRequest:200-218` |
| FR-033 | An `SPV_ADMIN` SHALL be able to upsert a designation master directly. | `requests-approval.component.ts:267-292`; `whitelistApis.ts:2300` |
| FR-034 | An `SPV_ADMIN` SHALL be able to list, approve and reject AI-generated designation requests; reject SHALL need a non-blank reviewer comment. | `designation-approval.service.ts`; `whitelistApis.ts:7597-7618` |
| FR-035 | Request creation SHALL be public at the gateway; creation SHALL be refused when the email, phone or organisation name already exists. | `main.yml:9597-9639`; `OrganisationWorkFlowServiceImpl:49-80` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | The uiproxy SHALL enforce its role allow-list by path, regardless of HTTP method, when `PORTAL_API_WHITELIST_CHECK=true`. | `apiWhiteList.ts:127-143`; `server.ts:62` |
| NFR-002 | Portal entry SHALL be restricted to `environment.portalRoles`. | `init.service.ts:533-534,581-588` |
| NFR-003 | Request lists SHALL be paged by page index (`PageRequest.of(offset, limit)`), 20 per page. | `onboarding-requests.component.ts`; `WorkflowServiceImpl:723` |
| NFR-004 | Logo uploads SHALL be png / jpeg / jpg, ≤5 MB; names ≤100 characters, descriptions ≤1000. | `create-organisation.component.ts:50,139-146,385-408` |

## Constraints and assumptions baked into the build

| ID | Constraint / assumption | Implication | Source |
|---|---|---|---|
| CON-001 | No admin-portal route has `requiredRoles`; menu visibility is backend page config. | UI visibility cannot be audited from code. | `home.rounting.module.ts`; `general.guard.ts:126-134` |
| CON-002 | A new organisation has no administrator. | The first admin must be created, not picked. | `ui-user-table-pop-up` search by `rootOrgId` |
| CON-003 | The request state graphs are system settings. | States and approver roles are not in code. | `WorkflowServiceImpl.getWorkFlowConfig:908` |
| CON-004 | Approving an organisation or position request does not create anything. | Follow-up is manual. | `ApplicationProcessingServiceImpl`; workflow services |
| CON-005 | Roles must be in `orgTypeList` for the target organisation's type, SPV included. | SPV cannot assign arbitrary roles. | `RoleAssignmentValidator:134-286` |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | UI role lists are wider than gateway lists: Create new (`DASHBOARD_ADMIN, SPV_PUBLISHER` get 403); volunteer status (State Admin 403); Requests (State Admin 403); State-users `extPatch` (SPV Admin 403). | FR-002, FR-007, FR-025, FR-031 | `directroy.component.ts:41`; `whitelistApis.ts:2163, 7963, 2315-2360, 2629` |
| DEV-002 | `updateStateOrMinistry` POSTs to a PATCH-only endpoint with no `orgId`; non-board orgs return "not allowed" anyway. | FR-006 | `create-mdo.services.ts:103-108`; `ExtendedOrgController:26` |
| DEV-003 | Create returns an empty `result` when a hierarchy row already existed; the portal shows nothing. | FR-004 | `ExtendedOrgServiceImpl:197-200`; `create-organisation.component.ts:340-344` |
| DEV-004 | The directory's duplicate-name check covers only the loaded page of ≤20 rows. | FR-005 | `directory-table.component.html:5` |
| DEV-005 | Link generation expires the old link before the designation check can fail. | FR-030 | `CustomSelfRegistrationServiceImpl:103-105` |
| DEV-006 | Role assign returns HTTP 200 for org mismatch and for an existing `MDO_LEADER`; the portal shows it as success. | FR-021, FR-024 | `UserRoleActor.assignRoles`; `create-user.component.ts:546-548` |
| DEV-007 | Directory passes `needAddAdmin`; the screen reads `addAdmin`. | FR-024 | `create-mdo.component.ts:163-171` |
| DEV-008 | Create-user error branch compares a lower-cased message to a capitalised literal. | FR-020 | `create-user.component.ts:428-446` |
| DEV-009 | Request resolvers return `undefined`; the domain pattern loses its backslash. | FR-031 | `requests-resolver.service.ts:30-42`; `requests-approval.component.ts` |
| DEV-010 | The `DOMAIN` case falls through to the BP workflow processor. | FR-032 | `ApplicationProcessingServiceImpl:54-56` |
| DEV-011 | `portal/spv/department` create / update and related routes are mapped and whitelisted but not served by any repo. | — | `portal-v3.ts:148,208`; `whitelistApis.ts:984`; `PortalController` |
| DEV-012 | Legacy `app/signup` and `app/auto-signup/:id` remain mounted; the backend router is not. | — | `app-routing.module.ts:143-152`; `publicApi_v8/signup.ts` |
| DEV-013 | Dead add-admin entry points remain: `gotoAddAdmin()` navigates to `/app/roles/<id>/basicinfo`, a route that does not exist. | FR-024 | `AP/routes/create-mdo/routes/users/users.component.ts`; `create-mdo-routing.module.ts` |
| DEV-014 | The volunteer-deactivation dialog promises users cannot sign in; no enforcement found. | FR-007 | `directory-table.component.ts:369-431` |
| DEV-015 | A workflow lookup failure is treated as "already exists" on request creation. | FR-035 | `OrganisationWorkFlowServiceImpl:98-100` |

## Out of scope (not reconstructible from these repos)

- The left-menu page configuration and `igot_spvrules`.
- The workflow state graphs and the `dev.org.hierarchy.new.org` consumer.
- `ai-cbp-mdo-service` behaviour.
- What serves `/portal/spv/*` and `/portal/departmentType/*` at runtime.
- The portal credential's Kong ACL groups.

---

> **Verification boundary:** every FR / NFR / CON / DEV above is traced to
> the file or function in its Source column. The key mismatch claims
> (PATCH-only update, `portal/spv/department` unserved, link-expiry ordering,
> page-index offset) were re-read directly while writing this document. No
> specification existed to compare against.
