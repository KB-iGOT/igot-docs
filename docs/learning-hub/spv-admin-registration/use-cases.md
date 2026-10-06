# SPV & Admin Registration — Use Cases

## Organisation onboarding

### UC-1 · Browse the organisation directory (SPV Admin / State Admin)

The Directory lists organisations by tab. SPV sees every organisation; for a
State Admin the proxy injects `ministryOrStateId = <their root org>` into the
search so only organisations under their state appear. State Admin also sees
fewer columns (Organisation, Created On). The Volunteer tab has no status
filter, so deactivated volunteer organisations still appear.

- API: `POST apis/proxies/v8/org/v1/search`

### UC-2 · Create a state, ministry or board organisation (SPV Admin / State Admin)

The Create-organisation drawer takes a name (required, ≤100 characters,
letters/digits/space and `& . , ' ( ) -`), a category, a description
(required, ≤1000 characters) and a logo (png/jpeg/jpg, ≤5 MB). For a State
Admin the category is fixed to *state* and the state to their own. The call
creates the organisation in the core service, records it in the
organisation-hierarchy table and publishes a "new organisation" event.

- API: `POST apis/proxies/v8/org/ext/v1/create`

### UC-3 · Create a volunteer (NGO) organisation (SPV Admin)

Same drawer on the Volunteer tab: the payload type becomes `ngo`, and the
category can be state, ministry or *autonomous* (parent taken from the global
NGO; `ministryOrStateId` left empty).

- API: `POST apis/proxies/v8/org/ext/v1/create`

### UC-4 · Edit an organisation's logo and description (SPV Admin / State Admin / MDO)

Only `logo` and `description` are editable here; any other key in the request
is rejected by the backend. The logo is uploaded first and its returned path
is sent with the update.

- APIs: `PATCH apis/proxies/v8/org/ext/v2/update` ·
  `POST apis/proxies/v8/customselfregistration/upload/logo/gcpcontainer`

### UC-5 · Activate or deactivate a volunteer organisation (SPV Admin)

A confirmation dialog sets the organisation's status to `0` (inactive) or `1`
(active). The dialog claims users of a deactivated organisation can no longer
sign in; no code enforcing that was found in the repos read. The button is not
role-gated in the UI, but the gateway allows only SPV Admin, so State Admin
gets a 403.

- API: `PATCH apis/proxies/v8/org/v1/status/update`

### UC-6 · Create a CBC / CBP provider or a legacy MDO / state form (SPV Admin)

The older **create-department** screen creates CBC and CBP provider
organisations straight in the core service (no hierarchy-table write) and then
jumps to the organisation's **Users** page so the first admin can be added.
Its state, ministry, department and board forms use the same create call as
UC-2/UC-3; their *update* mode is broken (see Edge cases).

- APIs: `POST apis/proxies/v8/org/v1/create` (CBC/CBP) ·
  `POST apis/proxies/v8/org/ext/v1/create` (others)

## People onboarding

### UC-7 · Create the first administrator of an organisation (SPV Admin / State Admin)

A new organisation has no users, and the *Add admin* picker only searches
existing users of the organisation, so the first admin must be created
through **Create user**: choose the organisation (channel), name, email,
mobile and roles. A State Admin's roles are hard-wired to
`STATE_ADMIN` + `PUBLIC`. At most one `MDO_LEADER` per organisation. The user
is created, a set-password link is generated and an `iGotWelcome_v4` welcome
mail is sent.

- API: `POST apis/protected/v8/user/profileDetails/createUser`

### UC-8 · Create a user from the State-users page (State Admin / SPV Admin)

A dialog creates the user, assigns roles, then patches the profile to
`VERIFIED` with `mandatoryFieldsExists: true` in three sequential calls. For
an SPV Admin the third call is refused by the gateway, so the user exists with
roles but the dialog reports "User created but profile update failed".

- APIs: `POST apis/protected/v8/user/profileDetails/createUser` ·
  `POST apis/proxies/v8/user/v1/role/assign` ·
  `POST apis/proxies/v8/user/v1/admin/extPatch`

### UC-9 · Make an existing person an administrator (SPV Admin / State Admin)

The **Add admin** popup searches users of the organisation, blocks anyone who
already holds `MDO_ADMIN` or `STATE_ADMIN`, and grants `STATE_ADMIN` when the
organisation's sub-type is *state*, otherwise `MDO_ADMIN`, merged with the
person's existing roles.

- API: `POST apis/proxies/v8/user/v1/role/assign`

### UC-10 · Publish a registration link and QR for an organisation (SPV Admin / State Admin / SPV Publisher)

Before the drawer opens the portal reads the organisation and its framework;
with no designations a dialog sends the admin to *import designations*. The
drawer shows the latest link, a status badge and Generate / Publish New Link.
The QR image URLs are rewritten from `portal` to `spv` for display. Mechanics
of the link itself are in [User Onboarding](../user-onboarding/lld.md).

- APIs: `POST apis/proxies/v8/customselfregistration/listallqrs` ·
  `POST apis/proxies/v8/customselfregistration`

## Request review

### UC-11 · Review organisation and designation requests (SPV Admin)

Pending / Approved / Rejected tabs list requests by workflow service
(`organisation`, `position`); the approver can edit the requested name before
approving, or must give a reason to reject. **Approving an organisation or
position request only triggers a notification** — it does not create the
organisation or the designation; an admin does that separately.

- APIs: `POST apis/proxies/v8/workflow/{org,position}/search` ·
  `POST apis/proxies/v8/workflow/{org,position}/update`

### UC-12 · Approve an email domain (SPV Admin)

Same screens with service `domain`. Approval inserts the domain into
`sunbird.master_data` as `userRegistrationPreApprovedDomain`; from then on
registrations from that domain are auto-created without approval.

- APIs: `POST apis/proxies/v8/workflow/domain/search` ·
  `POST apis/proxies/v8/workflow/domain/update`

### UC-13 · Add a designation to the master list (SPV Admin)

`requests/positions/new` (matching `requests/:type/new`) upserts a
`position` row directly.

- API: `POST apis/proxies/v8/masterData/v1/upsert`

### UC-14 · Approve or reject an AI-generated designation (SPV Admin)

The designation-approval list pages through requests by status; reject needs
a non-blank reviewer comment. The service behind it is `ai-cbp-mdo-service`
(not in the repos).

- APIs: `GET apis/proxies/v8/ai/cbp/v1/designation/approval-requests/list` ·
  `POST …/approve` · `POST …/reject`

## Post-onboarding

### UC-15 · Create the organisation hierarchy framework (State Admin / SPV Admin)

After an organisation exists, its hierarchy framework is created and sub-orgs
can be bulk-uploaded. Not registration, but it is the next step the portal
offers.

- APIs: `POST apis/proxies/v8/org/framework/v1/create?masterFrameworkName=org_hierarchy&orgId=…` ·
  `POST apis/proxies/v8/organisation/v1/hierarchy/bulkUpload/{frameworkId}`

## Edge cases

| Situation | Behaviour |
|---|---|
| Update an existing state / ministry from the legacy form | The portal `POST`s to `org/ext/v1/update`, which the backend maps only as `PATCH`, and the body has no `orgId` — the update modes cannot work. Even if reached, non-board organisations return 200 "Updating ministry, state or department is not allowed" |
| Organisation created while a matching hierarchy row already exists | The backend returns an empty `result`; the portal shows no success message and does not refresh |
| Duplicate-name check in the drawer | Compares only against the current page (≤20 rows) already loaded, not the whole directory |
| State Admin whose state is not in the loaded states list | The submit handler returns silently with no request |
| Generating a link when the organisation has no designations | The previous live link is already expired before the designation check fails — the org is left with **no** active link |
| Add-admin from the directory | The directory passes `needAddAdmin`, the screen reads `addAdmin` — add-admin mode is never entered from there |
| Role assign: user is in another organisation, or an `MDO_LEADER` already exists | Returns **HTTP 200** with a message string; the role-edit screen shows it as a success snackbar |
| Create user: welcome mail step fails | HTTP 500 though the user already exists |
| Create user: second `MDO_LEADER` | Blocked in the UI pre-check and again by the proxy ("MDO_LDEADER already exist…") and the core service |
| Create user with an invalid phone | The portal's error branch for "Invalid format for given phone." compares a lower-cased string to a capitalised literal and never matches |
| Requests list first paint | Route resolvers return nothing (a `setTimeout` wrapper); the component fetches for itself |
| Domain request pattern in the approval form | Pattern is declared in a template literal that drops a backslash, so `.` matches any character; the server applies its own stricter regex |
| `/portal/spv/department` create / update, `portal/spv/mydepartment`, `deptAction/userrole` | Mapped by the proxy but no controller in the repos serves them |
