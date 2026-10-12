# Marketplace — Use Cases

Verified from `cb-pores-service`, `cios-content-service`,
`cb_external_enrollment_service`, `sunbird-course-service`,
`sunbird-cb-uiproxy`, `sunbird-cb-adminportal`, `sunbird-cb-creationportal`,
and `sunbird-cb-portal` (branches/commits as listed in [index.md](index.md)).

## Actors

**Karmayogi** (the learner), **Content Partner** (the external
organisation whose content is being sold/offered through the platform),
**Marketplace/CBP Admin** (works the Admin Portal's Marketplace Providers
console — onboards partners, configures SSO/certificates/licensing),
**Content Curator** (works the Creation Portal's marketplace queue —
reviews ingested courses, tags competencies, publishes), and **Platform
Ops** (runs/monitors ingestion and progress-sync jobs). Which admin console
a given action happens in depends on whether it's partner-master-data
(Admin Portal) or catalog-content (Creation Portal) — see [HLD](hld.md).

## Partner onboarding & licensing (cb-pores-service, sunbird-cb-adminportal)

<div class="uc-grid">
<div class="uc-card">
<div class="who">Content Partner</div><b class="t">UC-1 · Self-register as a partner</b>
<p>A partner submits org name, contact, email — validated for duplicates,
assigned an <code>applicationId</code> (<code>IGOT-&lt;ORGWORD&gt;-&lt;5charHex&gt;</code>),
saved as <code>PENDING</code>, and confirmed by email (subject literally
"Your iGOT Marketplace Application ID").</p>
<div class="api">POST <code>contentpartner/register/v1/create</code></div>
</div>
<div class="uc-card">
<div class="who">Marketplace Admin</div><b class="t">UC-2 · Approve or reject a partner application</b>
<p>Approval auto-provisions a full <code>ContentPartner</code> record
(<code>createContentPartner</code>) with a generated <code>partnerCode</code>
and licensing defaults all zeroed/disabled; rejection requires a mandatory
comment. Either way the applicant is emailed.</p>
<div class="api">POST <code>contentpartner/register/v1/update</code></div>
</div>
<div class="uc-card">
<div class="who">Marketplace Admin</div><b class="t">UC-3 · Onboard a partner directly (no self-registration)</b>
<p>Two parallel UI flows exist for this in <code>sunbird-cb-adminportal</code>
— a legacy <code>onboard-partner</code> route and the current
<code>configure-provider</code> route (5 tabs: details, courses, certificate,
SSO, API integration). The dashboard only ever links to the current flow;
the legacy one is reachable only by a bookmarked/typed URL.</p>
<div class="api">POST <code>contentpartner/v1/create</code></div>
</div>
<div class="uc-card">
<div class="who">Marketplace Admin</div><b class="t">UC-4 · Configure a partner's license</b>
<p>Sets <code>licenseType</code> (<code>User</code> or <code>Course</code>),
<code>overAllLimit</code>, per-user/concurrent limit toggles, and karma-point
eligibility. <strong>Once <code>licenseType</code> is set it cannot be
changed</strong> — enforced server-side in <code>cb-pores-service</code>.</p>
<div class="api">POST <code>contentpartner/v1/update</code></div>
</div>
<div class="uc-card">
<div class="who">Marketplace Admin</div><b class="t">UC-5 · Configure partner SSO (SAML)</b>
<p>Client ID, SSO/ACS URLs, attribute mappers, and a "test connection" flow
that chains a SAML validation call into simultaneous SSO-config and
provider-record updates. Only one protocol (SAML) is offered — the protocol
dropdown has a single hardcoded option.</p>
<div class="api">POST <code>sso/create/:partnerId</code> · <code>sso/validateSaml</code></div>
</div>
<div class="uc-card">
<div class="who">Marketplace Admin</div><b class="t">UC-6 · Configure a partner's certificate template</b>
<p>Uploads/edits an SVG certificate, positions the partner's logo into a
<code>ProvidersLogo_Placement</code> group via client-side SVG DOM
manipulation, with a default-template fallback.</p>
<div class="api">POST <code>storage/v1/uploadCiosIcon</code></div>
</div>
<div class="uc-card">
<div class="who">Marketplace Admin</div><b class="t">UC-7 · Deactivate / reactivate a partner</b>
<p>Deactivation/activation fires a Kafka event
(<code>content-partner-delete-topic</code> /
<code>-activate-topic</code>) that a consumer uses to cascade the
<code>isActive</code> flag onto every one of that partner's content records
in Elasticsearch — content isn't deleted, just flagged.</p>
<div class="api">DELETE <code>contentpartner/v1/delete/:id</code> · PUT <code>.../activate</code></div>
</div>
</div>

## Content ingestion & curation (cios-content-service, sunbird-cb-creationportal)

<div class="uc-grid">
<div class="uc-card">
<div class="who">Marketplace Admin / Partner</div><b class="t">UC-8 · Upload a partner's course catalog</b>
<p>An Excel/CSV file is uploaded, stored to GCS, and a Kafka message queues
async processing — file status starts <code>IN_PROGRESS</code>.</p>
<div class="api">POST <code>ciosIntegration/v1/loadContentFromExcel/:partnercode/:partnerId</code></div>
</div>
<div class="uc-card">
<div class="who">Platform (async)</div><b class="t">UC-9 · Transform and persist each catalog row</b>
<p>A Kafka consumer downloads the file, fetches the partner's JOLT transform
spec from <code>cb-pores-service</code>, transforms and validates each row
(<code>courseType</code> defaults to <code>"paid"</code> if blank),
persists it, and indexes it into Elasticsearch.</p>
<div class="api">— (internal Kafka consumer, no external endpoint)</div>
</div>
<div class="uc-card">
<div class="who">Content Curator</div><b class="t">UC-10 · Review the curation queue</b>
<p>A two-tab queue — "Live" (<code>status=live</code>) and "For Publish"
(<code>status</code> in <code>draft</code>/<code>notInitiated</code>) —
listing every ingested-but-not-yet-fully-configured course for a provider.</p>
<div class="api">POST <code>ciosIntegration/v1/search/content</code></div>
</div>
<div class="uc-card">
<div class="who">Content Curator</div><b class="t">UC-11 · Configure and publish a course</b>
<p>Opens a multi-step wizard (Config: content details / enrolment settings
/ classification / competencies, then Access Control), sets
<code>courseType</code>, <code>courseEnrolLimit</code>,
<code>requiredKarmaPoints</code> and competency tags — locked once
<code>licenseType</code> is <code>User</code> vs <code>Course</code>, and
once the course is already <code>live</code>. Saving as draft vs. publishing
both call the same onboard endpoint with a different <code>status</code>.</p>
<div class="api">POST <code>cios/v1/onboardContent</code></div>
</div>
<div class="uc-card">
<div class="who">Content Curator</div><b class="t">UC-12 · Preview a course as a learner would see it</b>
<p>Opens the same CIOS detail page a learner would reach
(<code>public/toc/ext/:partnerCode/:externalId</code>) with an edit-mode
flag, in a new tab.</p>
<div class="api">— (opens learner-facing route directly)</div>
</div>
</div>

## Learner journeys (sunbird-cb-portal, cb_external_enrollment_service)

<div class="uc-grid">
<div class="uc-card">
<div class="who">Karmayogi</div><b class="t">UC-13 · Discover a partner/marketplace course</b>
<p>Via the home "iGOT Marketplace" spotlight card (routes to the generic
see-all module's Providers tab, telemetry-tagged <code>module: 'Marketplace'</code>)
or the dedicated Browse-by-Provider directory
(<code>all-providers</code> → provider detail → catalog/micro-site/
training-calendar) — two independently-built entry points with no
cross-link found between them.</p>
<div class="api">POST <code>contentpartner/v1/search</code></div>
</div>
<div class="uc-card">
<div class="who">Karmayogi</div><b class="t">UC-14 · Open a course's CIOS detail page</b>
<p><code>AppTocCiosHomeComponent</code> at <code>app/toc/ext/:id</code>,
resolved through the third-party <code>@sunbird-cb/collection-v2</code>
library rather than a directly-visible REST call in this codebase.</p>
<div class="api">— (via <code>@sunbird-cb/collection-v2</code>, not locally visible)</div>
</div>
<div class="uc-card">
<div class="who">Karmayogi</div><b class="t">UC-15 · Enroll in a partner course</b>
<p>Validated first against the partner's overall / per-user / concurrent /
per-course license caps (Cassandra counters + Redis cache in
<code>cb_external_enrollment_service</code>) before the enrollment is
written; a Kafka event then updates the partner's consumption counter.</p>
<div class="api">POST <code>cios-enroll/v1/create</code></div>
</div>
<div class="uc-card">
<div class="who">Karmayogi</div><b class="t">UC-16 · Progress synced from the partner's own LMS</b>
<p>Either a scheduled partner-specific job (Cornell/Coursera/CDAC/Harvard,
in <code>cios-content-service</code>) or a Kafka consumer in
<code>cb_external_enrollment_service</code> reconciles progress reported by
the partner and writes it against the enrollment.</p>
<div class="api">POST <code>cios-enroll/v1/user/progressupdate</code> (requires <code>partnerCode</code> header)</div>
</div>
<div class="uc-card">
<div class="who">Karmayogi</div><b class="t">UC-17 · Complete, certify and earn karma points</b>
<p><code>cb_external_enrollment_service</code> reads the certificate
template and karma-point rule off the partner record and fires a
certificate-generation Kafka event. Separately,
<code>sunbird-course-service</code>'s <code>ExtendedBadgeEnrollmentActor</code>
independently merges external-course completions into the user's overall
badge/certification stats via its own CIOS search call.</p>
<div class="api">POST <code>cios-enroll/v1/karmapoints/deductionrule</code></div>
</div>
<div class="uc-card">
<div class="who">Karmayogi</div><b class="t">UC-18 · See marketplace credentials in the competency passbook</b>
<p>A dedicated "Marketplace" tab in the competency passbook lists
externally-acquired course credentials (<code>extCourses</code>), counted
and fetched separately from native platform achievements.</p>
<div class="api">— (competency-card-details-v2 component, client-side aggregation)</div>
</div>
</div>

## Edge cases worth documenting

<div class="tw"><table>
<thead><tr><th>Situation</th><th>Behaviour</th></tr></thead>
<tbody>
<tr><td>Partner already registered (duplicate name/email)</td><td>Registration is rejected before an <code>applicationId</code> is generated (<code>ContentPartnerRegistrationServiceImpl.insert</code>).</td></tr>
<tr><td><code>read</code> a registration by id or email</td><td>The lookup actually requires <strong>both</strong> to be non-empty despite the API/error contract advertising "id OR email" — supplying only one throws an unhandled <code>NoSuchElementException</code>, surfaced as a 500 (see LLD gap).</td></tr>
<tr><td>Enrollment limit reached for a partner</td><td>The enrol call is rejected with a partner-specific "provider" limit-reached message, checked before any enrollment row is written.</td></tr>
<tr><td>Course already <code>live</code> in the curation wizard</td><td>Course-type and karma-point fields are locked from further edits (<code>isCoursePublished</code> gate).</td></tr>
<tr><td>Curator opens "configure" on a row with no <code>contentId</code> yet</td><td>The course is first silently onboarded as <code>draft</code>, then searched for by a 200ms-delayed follow-up call before the wizard opens — a timing hack, not a state check.</td></tr>
<tr><td>Certificate logo merge fails</td><td>The error is caught and silently discarded in <code>certificate-configuration.component.ts</code> — no snackbar, no user feedback, unlike every other error path in the same file.</td></tr>
<tr><td>Partner deactivated</td><td>All of that partner's content is flagged inactive in Elasticsearch via a Kafka cascade — existing enrollments/certificates are not touched by this flow (not traced further).</td></tr>
</tbody>
</table></div>

> **Verification boundary:** enrollment-limit enforcement, license locking,
> and the Kafka cascades above are confirmed from the 9 repos listed in
> [index.md](index.md). Not verified: any consumer-side behaviour inside
> the `@sunbird-cb/collection-v2` npm package that the learner-facing CIOS
> detail page depends on.
