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
| Auth in front | Kong routes for register / OTP v1 / link check carry no jwt | Abuse protection is a local rate limit only |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `user_registration.status` | `CREATED`, `WF_INITIATED`, `WF_APPROVED`, `WF_DENIED`, `FAILED` | Where the registration stopped |
| `user_registration.wfId` | Workflow application id | Needed to look the request up in the workflow service |
| `registrationLink` on the record | Present for link / QR registrations | Link registrations skip approval and the domain check |
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
| "Your email domain isn't recognised…" on sign-up | Email-OTP generate returned a domain failure — but the web page shows this message for *any* `errmsg` on that call | Check the domain against `master_data` (`userRegistrationDomain` / `…PreApprovedDomain`). If the real cause is the 5/hour OTP limit, the learner will see the same message |
| Learner stuck at `WF_INITIATED` | Awaiting workflow action; approval states are config-driven | Read the setting `wfUserRegServiceConfig` and the workflow record by `wfId`; escalate to the approver role it names |
| Registration returned an error but a record exists | Email already registered but phone new: the record is written and Kafka fired before the 400 is returned | Treat the record as real; inspect its status before telling the learner to retry |
| "Email id already registered with another User profile" for a new person | `private/user/v1/search` found a user, or an earlier registration for that email is not `FAILED` | If the earlier record is stuck, resolve it; only `FAILED` ones can be re-submitted |
| Retry rejected as "Duplicate request: This EMAIL was processed recently…" | Redis guard `sso:email:<email>` / `sso:phone:<phone>` set for 300 s; set before validation, never cleared on failure | Wait out the TTL (300 s default). Deleting the key early is an inference from the key names, not a documented procedure |
| "Registrations are closed" / "Registration link is not active" | Link past its end date, status not `ACTIVE`, replaced by a newer link, or expired by the cron route | Generate a new link in the MDO or admin portal. Note a new link expires all earlier ones for that org |
| Link generation says "Designation is not mapped to the organization" / UI says "No designation has been imported" | Org framework has no `org` category terms with associations | Import designations (Org designations screen), then generate |
| Link shows the wrong number of onboarded users | List API overwrites every row with the org-wide total; consumer increments are non-atomic | Treat the figure as approximate |
| Learner created but cannot sign in | Core service created the user in Cassandra and sends no password; they need the set-password link | Resend via the password-reset path; check the welcome mail step |
| Admin-created user: "Failed to send Welcome Email." (500) | Create succeeded; reset link or mail failed afterward | The user exists — do not recreate. Use the password-reset path |
| Admin cannot suppress the welcome mail | `isEmailRequired:false` is coerced to `true` | Use `createUserWithoutInvitationEmail` |
| "MDO Leader already exist in org" | One `MDO_LEADER` allowed per org | Remove or reassign the existing leader first |
| OTP "Too many requests" (429, code 0059) | 5 per hour / 20 per day per key | Wait; there is no override in code |
| OTP "verification failed" after 2 tries | `sunbird_otp_allowed_attempt` = 2 | Generate a new code (the same code is re-sent while unexpired) |
| Mobile user "verified" without a real OTP | Mobile wrappers return success on any exception | Not fixable operationally; server does not re-check |
| Parichay user bounced to logout with an error (web) | New SSO user without a mobile number | Mobile login does not require it |
| Welcome page never appears for a user who needs it | What triggers `/public/welcome` is not in these repos; `profile-v3`'s own redirect is dead | Send the user to `/public/welcome` directly; `isUpdateRequired` is true only for custodian-org users with empty `profileDetails.userRoles` |
| Admin portal request lists look empty on first paint | The route resolvers return `undefined` (setTimeout wrapper), so the component falls back to its own fetch | Wait for the component's own load; pagination itself is correct (page-index offset matches the workflow service) |
| Email-domain approval rejects a valid domain | Regex in the approval screen loses its backslash (the dot becomes a wildcard, `A-z` range is wider than intended) | Re-check the typed domain; the server enforces its own regex `^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$` |

## Configuration

| Setting | Default | Where / effect |
|---|---|---|
| `userCreationRedisTTL` | 300 | Core service; duplicate-create window |
| `sunbird_otp_expiration` | 1800 (properties) / **900** (learner env) | Effective 900 s in the learner-service env file |
| `sunbird_otp_hour_rate_limit` / `_day_rate_limit` / `_allowed_attempt` | 5 / 20 / 2 | OTP throttle and attempts |
| `enable_captcha` | env-specific | Captcha on `v2/user/exists` only |
| `user.bulk.upload.group.value` | six groups + Others | Allowed `group` on register |
| `user.registration.dept.exclude.list` | one org id (properties) / empty (helm) | Orgs hidden from the department list |
| `url.custom.self.registration` | `https://{{domain_name}}` | Base of generated links; its trailing slash yields `//crp` |
| `X_CHANNEL_ID` | `<HOLDING_ORG_ID>` | Holding org; first-time-user detection |
| `PORTAL_API_WHITELIST_CHECK` | `true` | Enables the route allow-list check |
| `PORTAL_CREATE_NODEBB_USER` | `false` | Optional forum-user creation after admin create |
| Kong rate limits | register 1000/h; OTP and link check 5000/h; hierarchy 15000/h per IP | `policy: local` — per Kong node, not cluster-wide |
| Keycloak realm | `registrationAllowed: true`, `verifyEmail: false` | Native Keycloak sign-up is enabled in the template; the UI only hides it |

## Monitoring

What the code gives you to watch, in the order of the pipeline:

- Kong 429s on `registerUser`, `generateOtpEXT`, OTP v1 and the link check
  (local limits; Kong routes include a `statsd` plugin).
- Kafka consumer groups `userRegistrationRegisterEventTopic-consumer`,
  `userRegistrationTopic-consumer`, `userAutoRegistrationTopic-consumer` —
  lag means registrations are sitting at `CREATED`.
- ES `user_registration` documents by status — a growing count of `FAILED`
  or old `CREATED` / `WF_INITIATED` is the health signal.
- cb-ext logs for `registerUser`, `initiateCreateUserFlow` and the
  createUser steps; core-service logs for swallowed insert failures.
- Duplicate-request errors from the Redis guard (a retry storm after a
  validation failure).

No dashboard, alert definition or runbook for any of these was found in the
repos read.

## Escalation and ownership

- **Registration records / consumers / links / org creation**: owners of
  `sunbird-cb-ext`.
- **Account, OTP, roles**: owners of `sunbird-lms-service`.
- **Approval states and approvers**: owners of `sunbird-cb-workflow` and the
  holder of the `wfUserRegServiceConfig` setting.
- **Kong, rate limits, Keycloak realm, Nginx**: platform / devops.
- **Mail not delivered**: notification-service owners (cb-ext posts to
  `/v1/notification/send/sync`; templates are outside the repos read).

## Dead code — do not debug it

- `sunbird-cb-uiproxy › publicApi_v8/signup.ts` — never mounted; builds CQL
  by string interpolation.
- `sunbird-cb-uiproxy › protectedApi_v8/admin/userRegistration.ts` — not in
  the allow-list (403 by default).
- `createUserV2WithRegistry` / `createUserV2WithoutRegistry` — handlers exist,
  no allow-list entry.
- `app/signup` and `app/auto-signup/:id` in all three portals — routes still
  mounted, backend router is not.
- `profile-v3` welcome redirect, `Storage.isUserOnboarded`, the NodeBB call in
  the registration flow, and a second, unmounted tenant-admin module in
  `sunbird-cb-portal`.

> **Verification boundary:** the operational facts above follow from the
> code paths cited in [LLD](lld.md). No runbook, alert definition or
> on-call document was available in any of the 14 repos, so the monitoring
> and escalation sections are derived from the code (consumer groups, log
> sites, ownership of the code) and are marked accordingly. The one
> workaround that is an inference, not a documented procedure, is clearing
> the Redis duplicate-request key early. The approval-state details depend on
> the `wfUserRegServiceConfig` setting, which was not available.
