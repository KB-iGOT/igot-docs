# User Onboarding — Use Cases

## New-user journeys

### UC-1 · Self-register on the public sign-up page (Karmayogi)

The learner opens `/public/signup` (web) and fills a two-step form: ministry
or state, organisation, designation and email in step one; name, group,
mobile and two confirmation boxes in step two. Both the email and the mobile
must be verified with an OTP before Register is enabled — but that
enforcement is in the browser; the register endpoint does not re-check it.
The submit sends a registration request and the learner sees a success dialog.

- APIs: `POST /api/user/registration/v1/register` ·
  `POST /api/otp/ext/v1/generate` · `POST /api/otp/v1/verify`

### UC-2 · Register on mobile (Karmayogi)

The mobile app shows three intro pages with Sign-in and Register buttons.
Register opens a screen where the user either pastes or scans an org
registration link (UC-5) or follows "click here" to the **direct**
registration form: a two-step flow mirroring the web form, with org pickers
driven by a remote `registrationConfig`. The request is accepted only on HTTP
202; on success the app shows "Thanks for registering" and returns to login.

- APIs: `POST /api/user/registration/v1/register` ·
  `POST /api/org/hierarchy/{ministry/,state/,}search` ·
  `GET /api/user/v1/groups` · `POST /api/designation/search`

### UC-3 · Verify the email address (Karmayogi)

On the public sign-up page and in mobile direct registration the email OTP
goes through the **domain-validated** generate call: the email's domain must
be in the approved-domain list stored in `sunbird.master_data`. A rejected
domain surfaces as "Your email domain isn't recognised — please contact your
department for registration." In the register-via-link flows the plain OTP
generate call is used instead, so the domain list is not consulted.

- APIs: `POST /api/otp/ext/v1/generate` (domain-validated) ·
  `POST /api/otp/v1/generate` (plain) · `POST /api/otp/v1/verify`

### UC-4 · Verify the mobile number (Karmayogi)

The mobile OTP uses the plain generate/verify pair on every client. The
server limits OTP generation to 5 per hour and 20 per day per key, allows 2
verification attempts, and re-issues the same code while an earlier one is
still valid.

- APIs: `POST /api/otp/v1/generate` · `POST /api/otp/v1/verify`

### UC-5 · Register through a department's link or QR code (Karmayogi)

An org admin has shared a link of the form `…/crp/<uniqueId>/<orgId>`. On web
the route `/crp/:qrCodeId/:orgId` first checks the link is active, then loads
that organisation's designations from its framework; on mobile the link is
pasted, scanned, or arrives as a deep link (ignored when the user is already
logged in). The form carries a WhatsApp-consent tickbox. The register call
includes `registrationLink`, so the backend creates the account automatically
(UC-7) and counts the user against the link.

- APIs: `POST /api/customselfregistration/isregistrationqractive` ·
  `POST /api/org/v1/read` · `GET /api/framework/v1/read/{frameworkId}` ·
  `POST /api/org/ext/v2/signup/search` (mobile) ·
  `POST /api/user/registration/v1/register`

### UC-6 · Wait for approval (Karmayogi)

When there is no registration link and the email domain is not pre-approved,
the registration record is pushed to the approval workflow
(`user_registration` service, state `INITIATE`). The learner is emailed a
registration code. If the workflow later reports `WF_APPROVED`, the account is
created (UC-7); `WF_DENIED` sends a denial email. The state machine that
drives the approval is loaded at runtime from a platform setting and is not in
the repositories.

- Kafka: `user.register.event` → `POST /v1/workflow/transition` →
  `workflow.user.registration.createUser`

### UC-7 · Account is created and activated (system)

For a registration link or a pre-approved domain, the register call itself
pushes the record to the auto-create topic. A consumer then (if the
organisation has no platform id yet) creates the organisation, calls the core
user service to create the account, sets the profile fields and the PUBLIC
role, generates a set-password link and sends the `iGotWelcome_v3` welcome
email. The registration record ends as `WF_APPROVED` or `FAILED`.

- APIs: `POST /v5/cb/user/self/register` or `/v5/cb/user/custom/register` ·
  `PATCH /private/user/v1/update` · `POST /v1/user/public/role/assign` ·
  `POST /private/user/v1/password/reset` ·
  `POST /private/user/v1/notification/email`

### UC-8 · Sign in through government single sign-on (Karmayogi)

A person arriving through Parichay (or, on web, OIL / NTPC) who has no
platform account is created on the spot with the PUBLIC role. Web requires the
SSO identity to carry a mobile number for a new user and then sends them to
`/public/welcome`; mobile creates the user through a different endpoint and
routes to the registration form. In both clients, an existing user whose root
organisation is still the default holding organisation (`X_CHANNEL_ID`) is
treated as a first-time user.

- APIs: `POST /user/v5/{parichay,oilindia,ntpc}/create` (web, server-side) ·
  `POST /api/user/v1/ext/signup` (mobile)

### UC-9 · Complete the welcome form on first login (Karmayogi)

`/public/welcome` reads the user's basic info; if the platform says an update
is required it shows a form (name, group, mobile with OTP, organisation) and
submits it, which moves the user into their chosen organisation. If no update
is required the user is sent to the home page. What triggers the redirect to
this page is not located in the repositories.

- APIs: `GET /apis/proxies/v8/user/basicInfo` ·
  `POST /apis/proxies/v8/user/basicProfileUpdate` ·
  `POST /api/org/ext/v2/signup/search`

### UC-10 · Open the app for the first time (Karmayogi, mobile)

A cold start shows a splash, then the landing page. With no valid token the
user sees the three-page onboarding intro; with a token that is about to expire
(under 4 hours) it is refreshed first, and users flagged as restricted
(`NOT-MY-USER` in the holding department) or missing custom-profile fields are
sent to the profile dashboard.

## Organisation-admin journeys

### UC-11 · Add one user directly (MDO Admin / MDO Leader)

In the MDO portal's **Individual Creation** tab the admin enters email, name,
phone, designation, group and roles. The roles offered depend on the admin's
own role (MDO_LEADER sees all MDO roles, MDO_ADMIN sees all but
MDO_LEADER/MDO_ADMIN). The user is created with the profile statuses set to
`VERIFIED` when both designation and group are supplied, and gets an
activation email.

- API: `POST /apis/protected/v8/user/profileDetails/createUser` →
  Kong `/user/v5/create`

### UC-12 · Add one volunteer to an NGO organisation (MDO Admin)

For NGO-typed organisations the same tab hides designation and group, adds an
eHRMS external id, and the Custom Registration Link tab is not offered. The
bulk route for NGOs is a different pipeline (see Bulk Registration).

### UC-13 · Publish a department registration link and QR code (MDO Admin / State Admin / SPV Admin)

Before a link can be generated, the organisation must have a framework with
imported designations; otherwise the screen offers "Start Importing". The
admin picks a start and end date, the backend expires any earlier active link
for that organisation (one active link per org), builds
`…/crp/<id>/<orgId>` and a branded QR, and stores them. The admin can copy,
email, WhatsApp-share, or download the QR.

- APIs: `POST /apis/proxies/v8/customselfregistration` ·
  `POST /apis/proxies/v8/customselfregistration/listallqrs` ·
  `POST /apis/proxies/v8/customselfregistration/upload/logo/gcpcontainer`

## Platform-admin journeys

### UC-14 · Onboard organisations and review requests (SPV Admin / State Admin)

Creating organisations, the first administrators, and approving requests for
new organisations, designations and email domains are done from the SPV /
super-admin portal and documented in their own feature:
[SPV & Admin Registration](../spv-admin-registration/use-cases.md). The one
link back into this feature: approving an email domain makes everyone
registering from that domain skip manual approval (UC-7).

### UC-15 · Onboard public participants into an event (SPV Admin / MDO Admin)

Not account creation: a CSV of **existing** users (matched by email) is
enrolled into an event batch, marked completed, and issued a certificate.
Listed here because the code and the Kong routes are named *bulkonboard*.

- APIs: `POST /apis/proxies/v8/user/v2/event/bulkonboard/{eventId}/{batchId}` ·
  `GET …/status/{eventId}` · `GET …/download/{fileName}`

## Edge cases

| Situation | Behaviour |
|---|---|
| Email is already registered but the phone is not | The register call still writes the registration record and fires the Kafka event, then overwrites the response with HTTP 400 "Email id already registered…" — side effects happen despite the error |
| A previous registration for the same email ended in `FAILED` | Allowed to re-submit; only org-related fields are overwritten on the existing record |
| A previous registration for the same email is anything other than `FAILED` | Rejected as "email exists" |
| Email domain not recognised (public sign-up) | The client shows the domain message for *any* `errmsg` returned by email-OTP generate, not just the domain failure |
| Registration link past its end date or not `ACTIVE` | Link check returns 400 "Registration link is not active"; web shows a "registrations are closed" dialog, mobile a bottom sheet |
| Link check on the register call | Date errors are returned as **HTTP 200** with the message in the result body, not as an error |
| Link without an id segment in the register call | Passes the registration-date check (the check only looks for `/crp/(\d+)`) |
| Generating a second link for an org | All active links of that org are expired first |
| Org has no framework designations | Link generation is blocked with "Designation is not mapped to the organization" |
| Failed account creation | Retry with the same email or phone within 300 seconds is rejected as a duplicate request (the Redis guard is set before validation and never cleared) |
| Account created by HTTP in the core user service | No welcome email or SMS is sent by that service — only the cb-ext registration consumer or uiproxy create-user sends one |
| Admin creates a user and welcome-mail step fails | HTTP 500, but the user already exists (no rollback) |
| Admin passes `isEmailRequired: false` | Coerced to `true` — the welcome mail cannot be suppressed on this endpoint |
| MDO_LEADER role requested for an org that already has one | Rejected ("MDO Leader already exist in org") |
| Mobile OTP verify throws or returns no `errmsg` | The app treats it as verified (fail-open); only server-side checks stand behind it |
| Parichay user without a mobile number (web) | Redirected to logout with an error; mobile does not require one |
| `X_CHANNEL_ID` root org | Treated as "not yet onboarded" by uiproxy and mobile |
