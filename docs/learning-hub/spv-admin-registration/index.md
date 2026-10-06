# SPV & Admin Registration

The registration and onboarding work done from the super-admin (SPV) portal:
bringing an organisation onto the platform, putting its first users and
administrators in place, publishing its registration link and QR code, and
approving the requests that other people raise for new organisations,
designations and email domains. It is the platform-owner side of
[User Onboarding](../user-onboarding/index.md).

- **Live UI**: `sunbird-cb-adminportal` — the single Angular app behind the
  SPV / super-admin portal. There is no separate SPV repository in the set
  analysed; the app itself refers to "spv" in its API names
  (`portal/spv/department`) and in the QR image URLs it rewrites
  (`portal` → `spv`)
- **Entry**: left menu → **Directory** (organisations, volunteer
  organisations, CBP providers, hierarchies), **Users** / **State users**,
  **Requests**, **Designation approval**
- **Who**: SPV Admin and State Admin mainly; SPV Publisher and Dashboard
  Admin see some of the same screens
- **Status**: ⚠️ the screens and the gateway disagree about who may do what,
  and several screens call routes nothing serves — see
  [As-Built Requirements](as-built-requirements.md)

## In one paragraph

An SPV admin opens the **Directory**, picks **Create new**, and enters a
name, a category (state, ministry, or — for volunteer organisations —
autonomous), a description and a logo; the platform creates the organisation
and registers it in its hierarchy. A new organisation has no users, so the
admin then creates its first administrator from the **Create user** screen,
choosing the organisation and an admin or leader role; from then on the
organisation's own admin can add people and publish a registration link. From
the same directory the SPV admin can publish a registration link and QR code
for any organisation, activate or deactivate a volunteer organisation, and
edit an organisation's logo and description. Separately, the **Requests**
screens list what other people have asked for — a new organisation, a new
designation, or an email domain to be trusted — and the admin approves or
rejects each one, optionally correcting the name first.

## How an SPV admin experiences it

1. **Opens the Directory** and chooses a tab — Organisation, CBP Providers,
   Volunteer, or the hierarchy tab.
2. **Creates an organisation**: state, ministry (centre) or autonomous
   volunteer organisation. A State Admin's screen is pre-set to their own
   state.
3. **Creates the first administrator** on the Create user screen — picking
   the organisation, name, email, mobile and an admin role; the person is
   emailed an activation link.
4. **Publishes a registration link and QR** for the organisation (after its
   designations have been imported), shares or downloads it.
5. **Works the Requests queue** — approves or rejects organisation,
   designation and email-domain requests, with a reason when rejecting.
6. **Maintains organisations**: edits logo and description, deactivates a
   volunteer organisation, assigns more administrators.

## Actors

| Actor | Role |
|---|---|
| SPV Admin | Full set: creates organisations, creates users in any organisation, approves requests, activates / deactivates volunteer organisations, adds designation masters |
| State Admin | Same screens, scoped to their own state: directory limited to organisations under that state; category fixed to "state" when creating; cannot see the request queues in practice |
| SPV Publisher / Dashboard Admin | See the Directory's Create and Generate-link buttons; most of the calls behind them are refused by the gateway for these roles |
| MDO Admin / MDO Leader | Operate the equivalent screens for their own organisation in the MDO portal — see [User Onboarding](../user-onboarding/index.md) |
| Requester (anyone) | Raises a request for an organisation, designation or domain through public workflow endpoints; not an admin-portal user |

## The one decision that defines the feature

> The admin portal's routes carry no role requirement at all. Who sees
> which menu item comes from page configuration served by the backend, and
> the only hard check is the gateway proxy's allow-list, which looks at
> the URL path and ignores the HTTP method. The buttons a role sees and the
> calls the gateway accepts for that role are maintained separately, and
> they do not agree: Dashboard Admin and SPV Publisher are shown **Create
> new**, but the create call is refused for them; State Admin can open the
> Requests screens, but the request calls are not allowed for State Admin.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for the reconstructed
requirement set with every known deviation called out.

> **Verification boundary:** sourced from `sunbird-cb-adminportal`
> (`cbrelease-4.8.41` branch, last tagged commit `4a35703e`), with the
> calls it makes traced through `sunbird-cb-uiproxy` (`cc9adea`),
> `sunbird-cb-ext` (`713ff3ce`), `sunbird-lms-service` (`e06912f8`),
> `sunbird-cb-workflow` (`927117d`) and `sunbird-devops` (`b823e40a0`);
> `sunbird-cb-orgportal` (`14961d92`) was read only for comparison. Not
> answerable from these repos: the left-menu page configuration (so which
> role sees which menu item), the Helm value `igot_spvrules` that decides who
> may enter the portal at all, the Kong ACL groups held by the portal's
> credentials, the workflow state graphs for organisation / position /
> domain requests (loaded from platform settings), what actually serves the
> legacy `/portal/spv/*` routes, and `ai-cbp-mdo-service` (designation
> approval). Each is flagged where it matters.
