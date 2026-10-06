# User Onboarding — As-Built Requirements

Requirements reconstructed from the shipped implementation across 14 repos
(commits listed in [index.md](index.md)) — what the system does today, not
what was originally intended. Companion to the [HLD](hld.md), [LLD](lld.md)
and [Operations Manual](operations-manual.md).

## Purpose and method

No original requirements or specification document for User Onboarding was
available in any repo. These requirements are reconstructed **from the shipped
implementation** across the learner, MDO and admin web portals, the mobile
app, the BFF proxy, the orchestration service, the core user service, the
workflow service and the infra configuration. Each requirement traces to
file(s) or function(s). Bulk CSV creation is documented in
[Bulk Registration](../bulk-registration/as-built-requirements.md) and not
repeated.

Requirement IDs: `FR-xxx` (functional), `NFR-xxx` (non-functional),
`CON-xxx` (constraint or assumption baked into the build), `DEV-xxx` (known
deviation).

## Functional requirements

### Self-registration

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | A new user SHALL be able to submit a registration request containing name, email, phone, group, source, organisation (`mapId` or `sbOrgId`, `orgName`) and designation; the system SHALL answer HTTP 202 and return the registration record. | `UserRegistrationServiceImpl.registerUser:95-170` |
| FR-002 | The system SHALL reject a registration missing any of `FirstName, Email, (sbOrgId or mapId), OrgName, Group, Source, Phone`, an invalid phone, or a group outside the configured list. | `validateRegisterationPayload:376-421`; `user.bulk.upload.group.value` |
| FR-003 | The system SHALL reject an email or phone that already belongs to a user ("…already registered with another User profile"). | `registerUser`; `UserUtilityServiceImpl.isUserExist:559` |
| FR-004 | A registration for an email whose existing record is not `FAILED` SHALL be rejected; a `FAILED` record SHALL be re-submittable with only its organisation fields overwritten. | `registerUser`; `updateValues` (:617-624) |
| FR-005 | The system SHALL enforce the email domain allow-list on registration unless a `registrationLink` is supplied. | `UserUtilityServiceImpl.emailValidation:1211-1245` |
| FR-006 | A registration with a `registrationLink`, or whose email domain is pre-approved, SHALL go to the auto-create topic; any other SHALL go to the approval topic. | `registerUser:140-147` |
| FR-007 | The approval consumer SHALL start a `user_registration` workflow (`INITIATE`), store `status` and `wfIds[0]` on the record, and send a registration mail. | `UserRegistrationConsumer:66-106` |
| FR-008 | On approval, or directly for the auto path, the system SHALL create the organisation if absent, create the account, update `profileDetails`, assign `PUBLIC`, generate a set-password link and send the `iGotWelcome_v3` welcome email, ending in `WF_APPROVED` or `FAILED`. | `initiateCreateUserFlow:271-335` |
| FR-009 | The system SHALL generate and verify one-time codes for email and phone, throttled per key. | `OTPActor`; `OtpController` |
| FR-010 | The system SHALL provide a domain-validated OTP generate for email on the public sign-up page and in mobile direct registration. | `UserRegistrationServiceImpl.generateOTP:217-269`; Kong `generateOtpEXT` |
| FR-011 | The learner portal SHALL gate Register on both email and mobile being OTP-verified. | `public-signup.component.ts:932-961` |

### Registration link / QR

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-020 | An admin with `MDO_ADMIN`, `MDO_LEADER`, `SPV_ADMIN`, `SPV_PUBLISHER` or `STATE_ADMIN` SHALL be able to generate a link and QR for an organisation with a start and end date. | `whitelistApis.ts:5096`; `CustomSelfRegistrationServiceImpl` |
| FR-021 | Generating a link SHALL expire every active link of that organisation. | `isRegistrationQRCodeActive(orgId)` expiry |
| FR-022 | Generation SHALL be refused unless the organisation framework's `org` category has a first term with associations (designations). | `CustomSelfRegistrationServiceImpl` |
| FR-023 | The system SHALL answer whether a link is active: `ACTIVE` and now strictly between start and end. | `isRegistrationQRActive` |
| FR-024 | A link registration SHALL increment `numberofusersonboarded` for the link. | `UserRegistrationConsumer:120-140` |
| FR-025 | The web link page SHALL accept only a designation present in the organisation's framework; the mobile app SHALL accept only links matching `/crp/<n>/<n>` starting with the API base URL. | `public-crp.component.ts`; `Helper.isValidRegistrationLink` |

### Account creation and roles

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-030 | Self-register, custom-register, support and SSO creation SHALL force role `PUBLIC`. | `SSOUserCreateActor.populatePublicRoles` |
| FR-031 | Admin creation SHALL validate role assignment against the requester's roles, organisation and `orgTypeConfig`, and SHALL allow at most one `MDO_LEADER` per organisation. | `validateRoleAssignment:680-718`; `createUserV5ByAdmin:443-450` |
| FR-032 | The system SHALL set `profileStatus`, `profileGroupStatus` and `profileDesignationStatus` to `NOT-VERIFIED` and `mandatoryFieldsExists=false` at self-registration; admin creation SHALL set the statuses `VERIFIED` only when both designation and group are provided. | `createBasisProfileDetails:354-400`; `profile-details.ts:225-519` |
| FR-033 | Account creation SHALL write `user`, `user_lookup`, `user_login`, `user_roles`, `user_organisation` and a synchronous ES `user` document. | `SSOUserCreateActor.processSSOUser` |
| FR-034 | An admin-created user SHALL receive a password-reset link and the `iGotWelcome_v4` welcome email unless the no-invitation endpoint is used. | `profile-details.ts:225-519, 701+` |
| FR-035 | An organisation (State, Ministry, board, NGO) SHALL be creatable by `SPV_ADMIN`, `STATE_ADMIN` or `MDO_LEADER`, with a hierarchy-table sync and a Kafka event. | `ExtendedOrgServiceImpl.createOrg:69-224`; `whitelistApis.ts:2163` |

### SSO and first login

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-040 | A Parichay, OIL or NTPC login for an unknown user SHALL create the account with role `PUBLIC` (web: requires a mobile number for new Parichay users). | `ssoUserHelper.ts:60-131`; `parichayAuth.ts` |
| FR-041 | A user whose root organisation equals `X_CHANNEL_ID` SHALL be treated as a first-time user on web and mobile. | `parichayAuth.ts`; `login_respository.dart:144-239` |
| FR-042 | The basic-info API SHALL return `isUpdateRequired` true only for a user in the custodian organisation whose `profileDetails.userRoles` is empty. | `ProfileServiceImpl` basicInfo |
| FR-043 | The welcome form SHALL submit `basicProfileUpdate`, which creates the organisation if needed and migrates the user into it. | `public-welcome.component.ts`; `ProfileServiceImpl.basicProfileUpdate` |

### Approvals

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-050 | An approver SHALL be able to list, approve (optionally editing the name) and reject (with a reason) requests of service `organisation`, `position` and `domain`. | `onboarding-requests.service.ts`; `requests-approval.component.ts:100-261` |
| FR-051 | Approving a `domain` request SHALL add the domain to `master_data` as `userRegistrationPreApprovedDomain`. | `processDomainRequest` (sunbird-cb-workflow) |
| FR-052 | A domain request SHALL match `^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*$`; a rejected domain SHALL be re-requestable. | `domain.validation.regex`; domain workflow service |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | OTP generation SHALL be limited to 5 per hour and 20 per day per key, with 2 verification attempts; the code TTL is 900 s effectively. | `externalresource.properties`; `sunbird_learner-service.env:136` |
| NFR-002 | Duplicate account creation for the same email or phone SHALL be blocked for 300 s via Redis. | `SSOUserCreateActor.processSSOUser` |
| NFR-003 | Public Kong routes (register, OTP v1, link check, org hierarchy, groups) SHALL rely on local rate limits (1000–15000 per hour) and a 1 MB body limit rather than authentication. | `kong-api/defaults/main.yml` |
| NFR-004 | The uiproxy SHALL require a Keycloak session for `/proxies/v8` and `/protected/v8`, and SHALL enforce a per-path role allow-list when `PORTAL_API_WHITELIST_CHECK` is `true`. | `server.ts:190-200`; `apiWhiteList.ts` |
| NFR-005 | Registration SHALL be asynchronous: the API returns 202 and account creation runs on Kafka consumers. | `registerUser`; `UserRegistrationConsumer` |

## Constraints and assumptions baked into the build

| ID | Constraint / assumption | Implication | Source |
|---|---|---|---|
| CON-001 | The register endpoint does not verify that either OTP was verified. | Registration with arbitrary, unowned email / phone is possible by calling the API directly; OTP is a client-side gate. | `registerUser` / `validateRegisterationPayload` (no OTP reference); `OTPValidator` used only in profile update |
| CON-002 | The core service sends onboarding mail only when `callerId` is set (bulk-upload job); HTTP create never sets it. | Welcome mail for HTTP-created users must come from cb-ext or uiproxy. | `SSOUserCreateActor:259`; `RequestInterceptor` / `BaseController.initRequest` |
| CON-003 | The core service never creates a Keycloak user; the Keycloak user is a federated view of Cassandra. | Without a password, a user can only log in via the set-password link. | `SSOManager` interface; `KeyCloakServiceImpl.getFederatedUserId` |
| CON-004 | `emailVerified` / `phoneVerified` are discarded at creation and every read returns `true`. | The platform has no durable email / phone verification state. | `User.java`; `UserServiceImpl.getUserDetailsById:102` |
| CON-005 | The approval state machine is loaded at runtime from `wfUserRegServiceConfig`. | State names and approver roles cannot be derived from code. | `WorkFlowServiceImplV2:546`; `WorkflowServiceImpl:916` |
| CON-006 | A registration link replaces both the domain check and approval. | Anyone holding a link is trusted for that organisation until its end date. | `registerUser:140-147`; `emailValidation` |
| CON-007 | Only one link per organisation is active at a time. | Re-publishing a link immediately invalidates the previous one. | `isRegistrationQRCodeActive(orgId)` |
| CON-008 | Mobile calls go to Kong via `/api`, not uiproxy. | uiproxy allow-list rules do not protect mobile onboarding calls. | `proxy-default.conf:140-172`; `api_endpoints.dart` |

## Known deviations (inconsistent by accident, not by design)

| ID | Deviation | Requirements in tension | Source |
|---|---|---|---|
| DEV-001 | Email-exists / phone-exists checks are not chained: a duplicate email with a new phone writes the ES record and fires Kafka, then returns 400. | FR-003, FR-006 | `registerUser:100-105, 163-167` |
| DEV-002 | Link date errors on register return HTTP 200 with the message in the result body; a link without an id segment passes. | FR-023 | `validateRegistrationDates:651-680` |
| DEV-003 | The Redis duplicate guard is set before validation and never cleared on failure. | NFR-002 | `SSOUserCreateActor.processSSOUser` |
| DEV-004 | Account-insert failures are swallowed; the response may be empty. | FR-033 | `createUserAndPassword` (:94-120) |
| DEV-005 | The link counter increments even when account creation failed, and is overwritten with the org total on list. | FR-024 | `UserRegistrationConsumer:120-140`; `listAllQRCodes` |
| DEV-006 | The learner sign-up page shows the "domain isn't recognised" message for any `errmsg` on email OTP. | FR-010 | `public-signup.component.ts:1066-1081` |
| DEV-007 | Step-one validation does not block "Next"; the reCAPTCHA token is requested but never sent; the link page has reCAPTCHA commented out. | FR-011 | `public-signup.component.ts:1450-1457, 1196-1290` |
| DEV-008 | Mobile OTP wrappers return success on any exception or missing `errmsg`. | FR-009 | `profile_repository.dart:652-777` |
| DEV-009 | `isEmailRequired:false` is coerced to `true` in the admin create endpoint; welcome-mail failure returns 500 after the user is created. | FR-034 | `profile-details.ts` |
| DEV-010 | The public role-assign route is unauthenticated and deletes all other roles of the user. | FR-030 | `UserRoleServiceImpl:45-61, 97-135`; `RequestInterceptor` |
| DEV-011 | Admin-portal request resolvers return `undefined`; the domain pattern loses its backslash; one error branch can never match. Detail in [SPV & Admin Registration](../spv-admin-registration/as-built-requirements.md). | FR-050 | `onboarding-requests.component.ts:61-66`; `requests-approval`; `create-user` |
| DEV-012 | The workflow `DOMAIN` case falls through to the BP workflow processor; `workflowTransition` may dereference a null `toValue` for registration. | FR-007, FR-051 | `ApplicationProcessingServiceImpl:54-56`; `WorkflowServiceImpl:113-122` |
| DEV-013 | The Keycloak realm template enables native registration without email verification; only the UI hides it. | CON-006 | `keycloak-realm.j2` (`registrationAllowed: true`, `verifyEmail: false`) |
| DEV-014 | Dead or unmounted code remains (`publicApi_v8/signup.ts`, `admin/userRegistration.ts`, `createUserV2*`, `app/signup`, profile-v3 welcome redirect, `isUserOnboarded`). | — | See [Operations Manual](operations-manual.md) |
| DEV-015 | Defaults of concern: `OTP secret "secretKey"`, `KC_NEW_USER_DEFAULT_PWD=User@123`, `SB_API_KEY="bearer apiKey"`, Parichay client secret compiled into the mobile app. | NFR-003 | `externalresource.properties:110`; `env.ts:52,167`; `login_service.dart:134-141` |
| DEV-016 | The core service's `/v2/user/exists` returns `id` and full name to any token holder; the OTP TTL differs between the properties file (1800) and the learner-service env (900). | NFR-001 | `CheckUserExistActor`; `sunbird_learner-service.env:136` |

## Out of scope (not reconstructible from these repos)

- The `user_registration` workflow states, approver roles and the transition
  names used after `INITIATE` (`wfUserRegServiceConfig`).
- Who raises a `domain` workflow request, and who calls the workflow
  `transition` to approve a `user_registration`.
- What redirects a user to `/public/welcome` and what configures the
  portal's `welcomeTabs`.
- The Keycloak federation provider and the deployed Keycloak realm.
- Registration and welcome email templates, and notification-service
  internals.
- Kong ACL group membership (e.g. which consumers hold `userCreate`), the
  Kong routes for `masterData/v1/upsert`, `basicInfo` and the workflow
  `search` / `update`, and the Kubernetes ingress rule for `/apis`.
- Values of mobile env constants (`portalBaseUrl`, `configUrl`,
  `xChannelId`) and of the Jinja variables `user_reg_domain_name`,
  `preapproved_domain`, `reg_orgid`.

---

> **Verification boundary:** every FR / NFR / CON / DEV above is traced to
> the repo and file or function in its Source column, drawn from four
> independent code-reading passes over the 14 repos, with the register flow,
> the absence of OTP verification on register, the `callerId` mail gate, the
> Kong `registerUser`, `generateOtpEXT` and link-check routes re-read
> directly while writing this document. No original specification existed to
> compare against. Resolving the workflow configuration and the
> `/public/welcome` trigger would convert the document's two most
> operationally significant open questions from "unverified" to "confirmed."
