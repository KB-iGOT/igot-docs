# Operations Manual — User Onboarding

How to operate, support and troubleshoot onboarding as it exists today. It
is not one service: a registration is a record in Elasticsearch, two Kafka
hops and a call into the core user service, with approval handled by the
workflow service. Most support questions reduce to "which stage did this
registration stop at?"

**Operational implication:** the register API answers `202` before anything
has happened, and the account is created later by a consumer. A learner who
"registered successfully" may have a record that is `CREATED`, `WF_INITIATED`,
`WF_DENIED` or `FAILED`. The record's `status` is the first thing to read.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Registration record | ES index `user_registration`, id = registration code `iGOT-<mapId>-<8 chars>` | The single place to see where a registration stopped; looked up by `email` |
| Account | Cassandra `sunbird.user` plus `user_lookup`, `user_login`, `user_roles`, `user_organisation`, then ES `user` | Creation swallows exceptions — a failed insert is only logged |
| Approval | `sunbird-cb-workflow`, state machine read from system setting `wfUserRegServiceConfig` | Cannot be debugged from the repos; read the setting |
| Mail | Registration mail (cb-ext → notification-service), welcome mail (cb-ext or uiproxy → core service mail endpoint) | The core service itself sends none for HTTP-created users |
| Links / QR | Postgres `registration_qr_code` | One active link per org; counters are best-effort |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `user_registration.status` | `CREATED`, `WF_INITIATED`, `WF_APPROVED`, `WF_DENIED`, `FAILED` | Where the registration stopped |
| `user_registration.wfId` | Workflow application id | Needed to look the request up in the workflow service |
| `registrationLink` on the record | Present for link / QR registrations | Link registrations go straight to account creation |
| `registration_qr_code.status` / `startdate` / `enddate` | Link lifecycle | Active = `ACTIVE` **and** now strictly between the dates |
| `registration_qr_code.numberofusersonboarded` | Count of users registered via the link | Non-atomic, also counts failed creations |
| `profileDetails.profileStatus` (and group / designation variants) | `NOT-VERIFIED` / `VERIFIED` | Self-registered users start `NOT-VERIFIED`; admin-created ones `VERIFIED` when designation and group are given |
| `profileDetails.mandatoryFieldsExists` | Set `false` at creation | Used by portal init; the guard redirect that would act on it is commented out |
| `master_data` rows `userRegistrationDomain` / `userRegistrationPreApprovedDomain` | Email-domain allow-lists | The first lets people request registration, the second skips approval |
| `rootOrgId == X_CHANNEL_ID` | The default holding organisation | uiproxy and mobile treat this user as "first time" |

## Operational workflows

**Public registration (no link).** Learner submits → record `CREATED` →
approval topic → consumer sends `INITIATE` to the workflow → record
`WF_INITIATED` and a registration-code email → an approver acts in the
workflow → on `WF_APPROVED` the workflow publishes
`workflow.user.registration.createUser` → account creation → welcome email.
Who acts as approver is determined by `wfUserRegServiceConfig`.

**Registration via link or pre-approved domain.** Learner submits → record
`CREATED` → auto-create topic → account creation → welcome email → `WF_APPROVED`
(or `FAILED`). No workflow call. If a link was used, the link's counter is
incremented after the attempt.

**Admin-created user.** MDO / admin portal → uiproxy → core user service
create → read-back → password-reset link → `iGotWelcome_v4` email. The three
steps are not atomic: if the reset or the mail fails the user exists and the
API still returns an error.

**Publishing a link.** Org admin → generate; the previous link is expired
first. The org must have designations imported into its framework.

## Common issues

| Symptom | Likely cause (verified) | Fix / workaround |
|---|---|---|
| Learner says "I registered but never got an email" | Registration mail is sent only by the approval-path consumer; link / pre-approved-domain registrations get the welcome mail after account creation and nothing before | Read `user_registration.status` by email. `FAILED`: re-submitting is allowed (the welcome-mail step counts toward the final status, so a mail failure also ends as `FAILED`). `WF_APPROVED`: the account exists and the welcome mail was sent — ask the learner to check spam, or resend the set-password link |
| "Your email domain isn't recognised…" on sign-up | Email-OTP generate returned a domain failure — but the web page shows this message for *any* `errmsg` on that call | Check the domain against `master_data` (`userRegistrationDomain` / `…PreApprovedDomain`). |
| Learner stuck at `WF_INITIATED` | Awaiting workflow action; approval states are config-driven | Read the setting `wfUserRegServiceConfig` and the workflow record by `wfId`; escalate to the approver role it names |
| Registration returned an error but a record exists | Email already registered but phone new: the record is written and Kafka fired before the 400 is returned | Treat the record as real; inspect its status before telling the learner to retry |
| "Email id already registered with another User profile" for a new person | `private/user/v1/search` found a user, or an earlier registration for that email is not `FAILED` | If the earlier record is stuck, resolve it; only `FAILED` ones can be re-submitted |
| "Registrations are closed" / "Registration link is not active" | Link past its end date, status not `ACTIVE`, replaced by a newer link, or expired by the cron route | Generate a new link in the MDO or admin portal. Note a new link expires all earlier ones for that org |
| Link generation says "Designation is not mapped to the organization" / UI says "No designation has been imported" | Org framework has no `org` category terms with associations | Import designations (Org designations screen), then generate |
| Link shows the wrong number of onboarded users | List API overwrites every row with the org-wide total; consumer increments are non-atomic | Treat the figure as approximate |
| Learner created but cannot sign in | Core service created the user in Cassandra and sends no password; they need the set-password link | Resend via the password-reset path; check the welcome mail step |
| Admin-created user: "Failed to send Welcome Email." (500) | Create succeeded; reset link or mail failed afterward | The user exists — do not recreate. Use the password-reset path |
| Admin cannot suppress the welcome mail | `isEmailRequired:false` is coerced to `true` | Use `createUserWithoutInvitationEmail` |
| "MDO Leader already exist in org" | One `MDO_LEADER` allowed per org | Remove or reassign the existing leader first |
| Parichay user bounced to logout with an error (web) | New SSO user without a mobile number | Mobile login does not require it |
| Welcome page never appears for a user who needs it | What triggers `/public/welcome` is not in these repos; `profile-v3`'s own redirect is dead | Send the user to `/public/welcome` directly; `isUpdateRequired` is true only for custodian-org users with empty `profileDetails.userRoles` |
| Admin portal request lists look empty on first paint | The route resolvers return `undefined` (setTimeout wrapper), so the component falls back to its own fetch | Wait for the component's own load; pagination itself is correct (page-index offset matches the workflow service) |
| Email-domain approval rejects a valid domain | Regex in the approval screen loses its backslash (the dot becomes a wildcard, `A-z` range is wider than intended) | Re-check the typed domain; the server enforces its own regex `^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$` |

## Configuration

| Setting | Default | Where / effect |
|---|---|---|
| `user.bulk.upload.group.value` | six groups + Others | Allowed `group` on register |
| `user.registration.dept.exclude.list` | one org id (properties) / empty (helm) | Orgs hidden from the department list |
| `url.custom.self.registration` | `https://{{domain_name}}` | Base of generated links; its trailing slash yields `//crp` |
| `X_CHANNEL_ID` | `<HOLDING_ORG_ID>` | Holding org; first-time-user detection |
| `PORTAL_CREATE_NODEBB_USER` | `false` | Optional forum-user creation after admin create |

## Monitoring

What the code gives you to watch, in the order of the pipeline:

- Kafka consumer groups `userRegistrationRegisterEventTopic-consumer`,
  `userRegistrationTopic-consumer`, `userAutoRegistrationTopic-consumer` —
  lag means registrations are sitting at `CREATED`.
- ES `user_registration` documents by status — a growing count of `FAILED`
  or old `CREATED` / `WF_INITIATED` is the health signal.
- cb-ext logs for `registerUser`, `initiateCreateUserFlow` and the
  createUser steps; core-service logs for swallowed insert failures.

No dashboard, alert definition or runbook for any of these was found in the
repos read.

## Escalation and ownership

- **Registration records / consumers / links / org creation**: owners of
  `sunbird-cb-ext`.
- **Account, OTP, roles**: owners of `sunbird-lms-service`.
- **Approval states and approvers**: owners of `sunbird-cb-workflow` and the
  holder of the `wfUserRegServiceConfig` setting.
- **Kong, Keycloak realm, Nginx**: platform / devops.
- **Mail not delivered**: notification-service owners (cb-ext posts to
  `/v1/notification/send/sync`; templates are outside the repos read).

## Dead code — do not debug it

- `sunbird-cb-uiproxy › publicApi_v8/signup.ts` — never mounted.
- `sunbird-cb-uiproxy › protectedApi_v8/admin/userRegistration.ts` — unused.
- `createUserV2WithRegistry` / `createUserV2WithoutRegistry` — handlers exist
  but are unused.
- `app/signup` and `app/auto-signup/:id` in all three portals — routes still
  mounted, backend router is not.
- `profile-v3` welcome redirect, `Storage.isUserOnboarded`, the NodeBB call in
  the registration flow, and a second, unmounted tenant-admin module in
  `sunbird-cb-portal`.

> **Verification boundary:** the operational facts above follow from the
> code paths cited in [LLD](lld.md). No runbook, alert definition or
> on-call document was available in any of the 14 repos, so the monitoring
> and escalation sections are derived from the code (consumer groups, log
> sites, ownership of the code) and are marked accordingly. The approval-state details depend on
> the `wfUserRegServiceConfig` setting, which was not available.
