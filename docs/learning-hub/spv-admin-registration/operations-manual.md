# Operations Manual — SPV & Admin Registration

How to operate and support the admin side of onboarding as it exists today:
the SPV / super-admin portal creating organisations, first administrators and
registration links, and working the request queues. Most support tickets here
are "I can see the button but it fails" — the portal and the gateway keep
separate role lists — or "I created it but nothing shows".

**Operational implication:** a 403 from the gateway is usually a role-list
mismatch, not a bug in the data; an empty success from organisation creation
usually means the organisation *was* created.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Portal | One Angular app, no route-level role gates; menu from backend page config | Visibility is configuration, not code — check the page config first |
| Gateway | uiproxy allow-list, path-only, method ignored; Kong ACL groups per consumer | The effective permission is the whitelist entry for the **path** |
| Organisation | Created in the core service; `org_hierarchy_v4` in Postgres kept by cb-ext; event on `dev.org.hierarchy.new.org` | Three places can disagree: core org, hierarchy row, downstream consumer |
| Requests | Workflow records; state graph in system settings | Approving an organisation or position request creates nothing |
| Registration link | One active per organisation | A failed regeneration can leave the organisation with no active link |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `org.status` | 1 active, 0 inactive, 2 blocked, 3 retired | Portal uses 0 and 1 only; transitions are validated in the core service |
| `isNgo` / `organisationType: ngo` | Volunteer organisation | Volunteer list has no status filter — inactive ones still show |
| `channel` | Unique organisation key; children get `<parentChannel>_<name>` on collision | Needed by `createUser` (400 when missing) |
| `mapId`, `parentMapId`, `sbOrgId`, `ministryOrStateId` | Hierarchy ids | Blank `ministryOrStateId` fails role assignment for non-SPV admins |
| `org_hierarchy_v4` row | Hierarchy record | A matching row at create time yields an empty (silent) response |
| `registration_qr_code.status` | `ACTIVE` / `expired` | See link behaviour in [User Onboarding](../user-onboarding/operations-manual.md) |
| Workflow `wfId`, `applicationStatus` | `IN_PROGRESS` / `APPROVED` / `REJECTED` | The portal's request lists are filtered on it |

## Operational workflows

**Onboard a department.** Directory → Create new → state / ministry →
organisation exists with status 1 → open the organisation's **Users** page →
**Create user** with an admin or leader role → the person receives the
activation mail → they sign in to the MDO portal and add their own users and
publish their own registration link. Add-admin works only after the
organisation has at least one user.

**Onboard a volunteer organisation.** Same, on the Volunteer tab; autonomous
organisations take their parent from the global NGO. To switch one off,
deactivate it (SPV Admin only).

**Work the request queue.** Requests → pick the type → open a row → approve
(optionally editing the name) or reject with a reason. Then do the follow-up
by hand for organisations and designations.

## Common issues

| Symptom | Likely cause (verified) | Fix / workaround |
|---|---|---|
| Dashboard Admin / SPV Publisher sees **Create new** but gets a 403 | UI role list (`DASHBOARD_ADMIN, SPV_ADMIN, SPV_PUBLISHER, STATE_ADMIN`) is wider than the gateway's (`SPV_ADMIN, STATE_ADMIN, MDO_LEADER`) | Have an SPV Admin or State Admin do it, or widen the allow-list entry |
| State Admin cannot deactivate a volunteer organisation | `org/v1/status/update` is `SPV_ADMIN` only | Ask an SPV Admin |
| State Admin opens Requests and gets nothing / 403 | Workflow search and update are not whitelisted for `STATE_ADMIN` | Use an SPV Admin |
| SPV Admin creates a user from State-users: "User created but profile update failed" | `user/v1/admin/extPatch` is not whitelisted for `SPV_ADMIN` | The user and roles exist; apply the profile patch via an allowed role or create from the **Create user** screen instead |
| Organisation created but the drawer shows no success and the list does not refresh | A matching `org_hierarchy` row existed, so the response `result` was empty | Refresh the directory; the organisation was created |
| "Organisation is already exist." | State / ministry channel already exists | Search the directory; for children the platform renames the channel to `<parentChannel>_<name>` |
| "Duplicate Record Found in OrgHierarchy. Contact Admin" | A hierarchy row already points at the existing organisation | Needs a data fix in `org_hierarchy_v4`; escalate |
| Edit state / ministry does nothing | The update call is a POST to a PATCH-only endpoint with no `orgId` | Not fixable operationally; only logo and description edits (v2) work |
| A new organisation has no admin and Add-admin finds nobody | The picker searches only users already in the organisation | Use **Create user** with an admin role first |
| "MDO Leader already exists in org" appears as a green success | Role assign returns HTTP 200 with a message string | Read the snackbar text; remove or reassign the existing leader |
| "User created but welcome email failed" / HTTP 500 after create | Reset-link or mail step failed after the user was created | Do not recreate; resend via the password-reset path |
| Registration link vanished after clicking Generate | Previous link is expired first; the designation check ran after and failed | Import designations, then generate again |
| Approved an organisation request but no organisation appears | Approval only changes the request status and notifies | Create the organisation in the Directory |
| Approved a domain but registrations still go to approval | Domain not stored as `userRegistrationPreApprovedDomain`, or typed differently | Check `master_data` for the exact domain string |
| Requests list is blank for a moment | Route resolvers return nothing; component loads on its own | Wait; pagination is correct |
| Deactivated volunteer organisation, users can still sign in | The portal's claim is not enforced in any repo read | Block the users individually if required |
| Designation approval list fails | Backed by `ai-cbp-mdo-service`, not in the repos | Check that service |

## Configuration

| Setting | Default | Where / effect |
|---|---|---|
| `org.updatable.fields` | `logo,orgName,orgId,description` | cb-ext `application.properties:563` — keys outside it → 400 |
| `org.channel.delimitter` | `_` | Child channel rename on collision |
| `map.id.counter.enabled` | `disabled` | `max+1` versus `count+1` for `mapId` |
| `SPV_ROLES` | `SPV_ADMIN, IGOT_SUPPORT_ADMIN` | Core service — skips role restrictions and org-authority check |
| `ROLE_ASSIGNMENT_RESTRICTIONS` | `{"MDO_LEADER":["MDO_LEADER"],"MDO_ADMIN":["MDO_ADMIN","MDO_LEADER"]}` | Who may assign which role |
| `admin_role_suffixes` | `_ADMIN`, `_LEADER`, `SPV_PUBLISHER` | Requester must hold one |
| `orgTypeConfig` / `orgTypeList` (system settings) | per environment | Allowed roles per organisation type, applied to everyone including SPV |
| `PORTAL_API_WHITELIST_CHECK` | `true` | Turning it off removes the only hard gate |
| `igot_spvrules` (Helm) → `portalRoles` | not in repos | Who may enter the portal at all |
| `domain.validation.regex` | `^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$` | Server-side domain request validation |
| `PORTAL_CREATE_NODEBB_USER` | `false` | Optional forum account at user create |

## Monitoring

- Kong 4xx / 5xx on `orgExtendedCreate`, `createCbUser`, `workflowOrgSearch`
  and the `customselfregistration` routes; uiproxy 403s indicate allow-list
  rejections.
- Postgres `org_hierarchy_v4` against core-service organisations — a core org
  with no hierarchy row (or the reverse) means a failed or partial create.
- Kafka `dev.org.hierarchy.new.org` consumer lag (consumer outside the repos).
- Workflow records stuck `IN_PROGRESS` for long periods.

No dashboard or alert definition was found in the repos read.

## Escalation and ownership

- **Organisation create / hierarchy / links**: owners of `sunbird-cb-ext`.
- **Organisation status, users, roles and the role validator**: owners of
  `sunbird-lms-service`.
- **Request queues and state graphs**: owners of `sunbird-cb-workflow` and the
  system-settings holder.
- **Role lists and 403s**: owners of `sunbird-cb-uiproxy` (allow-list) and
  devops (Kong ACL groups).
- **Menu visibility and portal entry**: whoever owns the page configuration
  and `igot_spvrules`.
- **Designation approval**: owners of `ai-cbp-mdo-service`.

## Dead code — do not debug it

`portal/spv/department` (POST/PATCH), `portal/spv/mydepartment`,
`deptAction/userrole`; `app/signup` and `app/auto-signup/:id`; the positions
module; the three request resolvers; `updateStateOrMinistry`; add-admin mode
from the directory.

> **Verification boundary:** the facts above follow from the code paths cited
> in [LLD](lld.md). No runbook, alert definition or on-call document was in
> any repo read, so monitoring and escalation are derived from code
> ownership. Role outcomes assume the whitelist is enabled
> (`PORTAL_API_WHITELIST_CHECK=true`) and that the portal's Kong credential
> holds the ACL groups the routes need — neither can be confirmed from the
> repos.
