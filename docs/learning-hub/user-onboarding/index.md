# User Onboarding

How a person gets onto Karmayogi Bharat and into a usable account — by
signing up themselves, by following their department's registration link or
QR code, by being added by their department's admin, or by arriving through a
government single sign-on — plus the admin-side steps that make those routes
possible (onboarding a department, approving a new designation or email
domain).

- **Live UIs**: learner web portal (`sunbird-cb-portal` — `/public/signup`,
  `/crp/:qrCodeId/:orgId`, `/public/welcome`), MDO admin portal
  (`sunbird-cb-orgportal` — `/app/home/onboarding`), super-admin portal
  (`sunbird-cb-adminportal` — documented separately as
  [SPV & Admin Registration](../spv-admin-registration/index.md)), and the
  mobile app (`igot_karmayogi_mobile` — intro screens,
  self-registration, register-via-link)
- **Not covered here**: uploading a CSV of many users — see
  [Bulk Registration](../bulk-registration/index.md)
- **Status**: ⚠️ several routes coexist and a few are dead code — see
  [As-Built Requirements](as-built-requirements.md) for the full list of
  divergences

## In one paragraph

A new Karmayogi starts on the sign-up page (web) or the intro screens
(mobile), picks their ministry or state, their organisation and their
designation, proves they own their email address and their mobile number with
one-time codes, and submits. What they have submitted is a **request**, not an
account. If they came in through their department's registration link or QR
code, or their email domain has already been approved, the platform creates
the account straight away and emails an activation link. Otherwise the request
is held for approval first. Department admins can skip all of this by adding a
person directly, and people who already have a government single-sign-on
identity are created on their first login and sent to a short welcome page to
finish their basic details.

## How a Karmayogi experiences it

1. **Opens sign-up** — on the web at the public sign-up page, or on mobile via
   the intro screens' "Register" button — or **scans / pastes their
   department's registration link** (web: the link; mobile: QR scanner or
   pasted link).
2. **Chooses where they work**: ministry or state, then department /
   organisation, then designation. A link or QR code fixes the organisation
   for them and only offers that organisation's designations.
3. **Verifies their email** with a one-time code. On the public sign-up page
   the email's domain must be one the platform recognises; otherwise they are
   told to contact their department.
4. **Enters their name, group and mobile number**, verifies the mobile with a
   second one-time code, and accepts the terms.
5. **Submits** and sees a confirmation that the registration has been
   received.
6. **Gets an email** — a registration reference if approval is needed, or a
   welcome email with a "set your password" link once the account exists.
7. **Signs in** and, if the platform still needs basic details (for example
   after a single-sign-on first login), is asked to complete a short welcome
   form before reaching the home page.

## Actors

| Actor | Role |
|---|---|
| Karmayogi (new user) | Registers themselves, by public sign-up, by a department link or QR code, or by single sign-on |
| MDO Admin / MDO Leader | Adds individual users to their department; generates and shares the department's registration link and QR code |
| State Admin / SPV Admin | Onboards organisations (departments, states, ministries, NGOs); also generates registration links for them |
| Super admin (SPV Admin) | Approves or rejects requests for new organisations, designations and email domains |
| Platform ops | Keeps the registration pipeline running — see the [Operations Manual](operations-manual.md) |

## The one decision that defines the feature

> Submitting the registration form does not create an account. The register
> call writes a registration record, returns "accepted", and hands it to a
> background consumer that creates the real account later — immediately for
> a registration link or a pre-approved email domain, after an approval step
> otherwise.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the reconstructed
requirement set with every known deviation called out.

> **Verification boundary:** this feature set is sourced from all 14
> repos named for this analysis, each checked out at the release commit
> (September–October 2026) — `sunbird-cb-portal` (`cbrelease-4.8.41`,
> `c12b4a9ed`), `sunbird-cb-orgportal` (`cbrelease-4.8.41`, `14961d92`),
> `sunbird-cb-adminportal` (`cbrelease-4.8.41` branch, last tagged commit
> `4a35703e`), `sunbird-cb-uiproxy` (`cbrelease-4.8.41`, `cc9adea`),
> `igot_karmayogi_mobile` (`master`, `7a3219157`), `sunbird-cb-ext`
> (`cbrelease-4.8.41`, `713ff3ce`), `sunbird-lms-service`
> (`cbrelease-4.8.41.1` branch, last tagged commit `e06912f8`),
> `cb-ext-userprofile-service` (`cbrelease-4.8.41`, `69dcb98`),
> `sunbird-cb-workflow` (`cbrelease-4.8.41.1`, `927117d`),
> `cb-notification-service` (`cbrelease-4.8.39`, `168e173`),
> `cb-notification-wrapper` (`cbrelease-4.8.39`, `9a99b1d`),
> `cb-ext-config-service` (`cbrelease-4.8.39.2`, `0d1d9a2`),
> `form-service` (`cbrelease-4.8.39`, `37268b8`), and `sunbird-devops`
> (`cbrelease-4.8.41`, `b823e40a0`). The last five of the backend repos
> (`cb-ext-userprofile-service`, `cb-notification-service`,
> `cb-notification-wrapper`, `cb-ext-config-service`, `form-service`)
> were analysed and contain **no** onboarding logic — see
> [HLD](hld.md). Not answerable from these repos: the approval-workflow
> state machine for user registration (it is loaded at runtime from the
> platform setting `wfUserRegServiceConfig`), the Keycloak user-federation
> provider, the deployed Keycloak realm, and the private-inventory values
> for the registration domain settings. Each is flagged where it matters.
