# Competency Hub — Use Cases

## Learner journeys

### UC-1 · Discover content by competency

Web has two generations of a standalone "Browse by Competency" directory
(`app/learn/browse-by/competency-o` = v1, `app/learn/browse-by/competency` =
v2 — v2 is the one actually linked to); mobile calls the same concept
"Explore by Competency". Both list/filter content by Competency
Area/Theme/Type, backed by the same content-search endpoint every other
discovery surface uses.

- APIs: `POST apis/proxies/v8/sunbirdigot/search` (content search) ·
  `GET apis/proxies/v8/searchBy/competency` (v1) ·
  `GET apis/proxies/v8/searchBy/v2/competency` (v2) ·
  mobile: `GET /api/searchBy/v2/competency`, gated by
  `AppConfiguration.useCompetencyv6`

### UC-2 · See competencies tagged on a piece of content

Course cards, the Table-of-Contents/About tab, and content search results
all render whatever the content's `competencies_v6` field holds — an
opaque, unvalidated array. There is no separate "get competencies for this
content" call; it rides on whichever content-read/search call the screen
already makes.

- Field: `competencies_v6` (current); legacy content may still carry
  `competencies`, `competencies_v3`, `competencies_v5`

### UC-3 · Open the Competency Passbook

A learner's personal record of every competency they've acquired, grouped
Area → Theme → Sub-Theme, each entry tagged by source. Fully implemented
independently on both platforms — web at `page/competency-passbook`, mobile
as a dedicated `competency_passbook` feature module with its own tabbed
(Behavioural/Functional/Domain) view.

- APIs: `GET apis/proxies/v8/learner/v1/competency/read` (web) ·
  mobile's primary data source is **server-config-driven**, not hardcoded:
  `modules.competencyConfig.apiUrl = "/api/v1/competency/read"`

### UC-4 · Drill into one competency's courses and certificates

From the Passbook, opening a Competency Theme shows the specific courses,
external trainings, and self-declared achievements that earned it,
including certificate download where one exists.

- APIs: `GET apis/protected/v8/cohorts/course/batch/cert/download/…`
  (certificate) · `POST apis/proxies/v8/competencyTheme/search`
  (theme resolution)

### UC-5 · Self-attest current vs. desired competencies

During profile setup (`app/setup`, web only — no mobile equivalent was
found), a Karmayogi can declare which competencies they already hold and
which they want to grow into, each at a self-assessed proficiency level.
This is opt-in self-reporting, not a scored test — there is no competency
quiz/assessment engine anywhere in this trace.

- API: `POST apis/proxies/v8/user/v1/extPatch` — writes
  `profileDetails.competencies` / `profileDetails.desiredCompetencies`

### UC-6 · Earn a competency passively via certificate

The load-bearing background mechanism: whenever a course, event, or
self-declared achievement produces a certificate, the issuing job fires a
`COMPETENCY_ACQUIRED` Kafka event; `user-competency-updater` consumes it,
resolves the content's `competencies_v6` taxonomy via the content-service
API, and upserts the learner's `user_competency_mapping` Cassandra row. The
learner does nothing to trigger this beyond completing the content.

- Producers: `event-cert-generator`, `collection-certificate-generator`,
  `common-certificate-generator-utility` (all in `knowledge-platform-jobs`)
- Consumer: `user-competency-updater` (`knowledge-platform-jobs`)

### UC-7 · First-time competency read backfills history

The first time a brand-new user's competency Passbook is opened via
`cb-ext-course-service`'s `/learner/v1/competency/read`, and no
`user_competency_mapping` row exists yet, the service itself fires a
`COMPETENCY_ACQUIRED` event with `isFirstTimeUser: true` — which
`user-competency-updater` treats as a signal to backfill from the learner's
*entire* existing enrolment and certificate history, not just future
events.

- API: `GET apis/proxies/v8/learner/v1/competency/read`

### UC-8 · Self-declare a competency for a manually-added achievement

A learner adding an achievement by hand (not machine-issued) can pick which
competency it demonstrates from a 3-level Area→Theme→Sub-theme picker —
confirmed as a full flow on mobile (`CompetencySelectorBottomSheet` inside
Edit Achievement); the web equivalent module exists in source but its route
is disabled (see Edge cases).

### UC-9 · View an organisation's aggregate "Competency Strength"

Mobile-only: MDO Channel and ATI/CTI microsite screens show which
competencies the users in that organisation are collectively strongest in,
based on completed/enrolled courses — an org-level read, not a per-learner
one. No equivalent surface was found on web.

- API: `GET apis/proxies/v8/v1/search/competenciesByOrg/{orgId}`

## Admin journeys (MDO/SPV admin, `sunbird-cb-orgportal` + `sunbird-cb-ext`)

### UC-10 · Bulk-upload an ODCS designation↔competency mapping

An admin downloads a sample workbook (three sheets: workspace, competency
reference, designation master), fills in which Competency Area/Theme/
Sub-Theme applies to each of the org's designations, and uploads it —
capped at 1000 rows.

- APIs: `GET apis/proxies/v8/organisation/v1/getCompetencyDesignationMappingFile/sample/{frameworkId}` ·
  `POST apis/proxies/v8/organisation/v1/competencyDesignationMappings/bulkUpload/{frameworkId}`

### UC-11 · Processing happens asynchronously, off the request

The upload only queues a Kafka event and returns; a background consumer in
`sunbird-cb-ext` does the real work — validating every row against
`kcmfinal_fw`, then creating or updating Term nodes for any new Competency
Theme/Sub-Theme the mapping introduces, in `knowledge-platform`'s generic
Framework API (**not** `frac-backend` — confirmed by an exhaustive search
of `frac-backend`'s code, which has no "framework"/"term"/"publish" concept
at all), associating them with the Designation term, and publishing the
framework.

- Kafka topic: `{env}.competency.designation.bulk.upload` →
  `OrgDesignationCompetencyBulkUploadConsumer`

### UC-12 · Check progress and download the result

- APIs: `GET apis/proxies/v8/organisation/v1/competencyDesignationMappings/bulkUpload/progress/details/{orgId}` ·
  `GET apis/proxies/v8/organisation/v1/competencyDesignationMappings/download/{fileName}`

### UC-13 · Map competencies onto a Work Allocation role

Separately from ODCS, an admin building a Work Allocation/Work Order
document can attach specific competencies — each with a proficiency
`level` — to a role or activity, via drag-and-drop (Work Allocation v2) or
a search-and-select flow (v1). Every attached competency is verified/
created against `frac-backend` (the real one) before the document saves —
unlike ODCS, this path does hit the actual taxonomy service.

- APIs: `GET apis/protected/v8/frac/COMPETENCY/{search}` (v1 and v2, same
  endpoint) · `GET apis/protected/v8/workallocation/getUserCompetencies/{userId}`
  (read a user's aggregated role-derived competencies)

### UC-14 · Tag a community, event, or content request with competencies

The same shared 3-level competency picker (`CompetencyAddComponent`) is
reused, independently wired, across three unrelated features in
`sunbird-cb-orgportal`: community posts, events, and the "content demand"
request-list an MDO can use to ask for content mapped to a specific
competency.

- API: `POST apis/proxies/v8/framework/v1/read/kcmfinal_fw` (shared taxonomy
  read all three reuse to populate the picker)

## Authoring journeys (Creation, `sunbird-cb-portal`)

### UC-15 · Tag content with a competency while authoring

A content author tags a course/content item with competencies via an
autocomplete search; if the competency they need doesn't exist yet, a
"Submit Competency" dialog lets them request a new one be added to the
master taxonomy.

- APIs: `POST apis/protected/v8/competency/searchCompetency` ·
  `POST apis/protected/v8/competency/addCompetency`

## Reviewer/admin journeys (`frac-backend` — new in this pass)

### UC-16 · Review a newly-created or edited node

Every new/edited Competency, CompetencyArea, Role, Position, or Activity
node starts `UNVERIFIED`. An `FRAC_REVIEWER_L1` user sees it in their
inbox, scoped by department/type, and approves (promotes it into the L2
queue) or rejects (terminal — never reaches L2).

- APIs: `GET /frac/getVerificationList` · `POST /frac/verifyDataNode`

### UC-17 · Final approval by the review board

An `FRAC_REVIEWER_L2` or `FRAC_ADMIN` user gives the final sign-off on an
L1-approved node (fully verified — only L2/Admin can edit it further from
this point), or rejects it — which, distinctly from an L1 rejection, sends
it back to the L1 queue instead of killing it.

- API: `POST /frac/verifyDataNode` (same endpoint as UC-16; branch behaviour
  is decided by the caller's role, downstream in `VerificationServiceImpl`)

### UC-18 · Bulk-import nodes from a spreadsheet

An admin uploads an `.xlsx` with node rows on sheet 1 and optional
competency-level rows on sheet 2; parsed rows feed into the same
create/update path as a single `addDataNode` call.

- API: `POST /frac/uploadDataNode` (multipart)

### UC-19 · Leave feedback/rating on a node

Any user can rate and comment on a node; an Elasticsearch aggregation
computes its average rating.

- APIs: `POST /frac/nodeFeedback` · `GET /frac/getNodeFeedback` ·
  `GET /frac/getNodeRatingAverage`

## Public journey (`frac-dictionary`)

### UC-20 · Browse the FRAC taxonomy without logging in

Anyone — no authentication anywhere in this codebase — can browse
Competencies, Roles, Activities, and Positions ("Designations") on a public
static site, with faceted filtering (Competency Area/Type/Sector,
Department/Sector for Positions) and a cross-entity keyword search. A
per-competency detail page cross-links which Roles/Positions reference it.

- Data path: Elasticsearch directly (build-time bulk pull, runtime
  re-query via a bundled proxy) — **never** `frac-backend`'s REST API; see
  APIs/HLD for why this is worth knowing operationally.

## Edge cases

| Situation | Behaviour |
|---|---|
| Web's standalone "Competencies" assessment/achievements module (`app/competencies`) | Fully implemented in source, but its route is commented out in `app-routing.module.ts` — unreachable from the live app |
| `CompetencyResolverService` in `sunbird-cb-orgportal`'s state-profile module | Defined and calls the FRAC search API, but its route `resolve` registration and DI provider are both commented out — dead wiring |
| `sunbird-course-service`'s `course_content_allowed_fields` whitelist (includes `competencies_v6`) | Defined in config and read by a `JsonKey` constant, but no call site references that constant anywhere in the repo — likely unused |
| Mobile's `/competencyHub` route | Declared as a constant and referenced from onboarding copy and the Explore-hub menu config, but has no matching `case` in the route switch — tapping it may not resolve to a working screen |
| `sunbird-cb-ext`'s `OrgDesignationMappingController` (`/designation` prefix, distinct from `/organisation`'s competency controller) | Method names say "Competency" (`getCompetencyMappingFile`, `bulkUploadCompetencyDesignationMapping`) but the service it delegates to has no competency logic at all — naming leftover from a copy-paste, not a second competency feature |
| `knowledge-platform-jobs`' "karma-points" modules | Confirmed unrelated despite sitting next to `user-competency-updater` in the same repo and era of commits — karma points/coins are a separate currency system, zero code ties them to the competency taxonomy |
| Competency schema-version switching (`competencies_v5` vs `competencies_v6`) | Handled independently, ad hoc, in at least four places (`ICompentencyKeys` + `environment.compentencyVersionKey` in `sunbird-cb-orgportal`, `competency.selected.version` in `sunbird-cb-ext`, `competencyVersionKey` in mobile's `app_global_config.dart`, hardcoded `competencies_v6` in `knowledge-platform-jobs`) — no shared constant or config source across repos |
| Org-wide config misspelling | `sunbird-cb-orgportal`'s global config key is `compentency` (transposed), not `competency` — `publicConfig.compentency \|\| publicConfig.competency` is a fallback for the correct spelling, suggesting the typo shipped first and the fix was added defensively rather than corrected at the source |
| `FRAC_COMPETENCY_REVIEWER` and `FRAC_ACCESS_COMPENTENCY` roles | Declared in both `sunbird-cb-uiproxy` and `frac-backend`, but confirmed unenforced by *either* — the former is a dead constant in both repos, the latter doesn't exist in `frac-backend`'s code at all. This is now confirmed platform-wide, not just a gateway-repo quirk |
| `frac-backend`'s `POST /frac/appendMapNodes` | The entire method body is commented out — it always returns `true` and does nothing, despite being a live, callable endpoint |
| `frac-backend`'s `POST /frac/verifyAllDataNode` (bulk-verify) | Has no role check in the controller, unlike the single-node `verifyDataNode` — a possible authorization gap, not confirmed exploitable from source alone (Kong/uiproxy don't gate it either) |
| `frac-backend`'s dead `PathRoutes` constants | `ADD_POSITION`, `GET_ALL_POSITIONS`, `ADD_ROLE`, `ADD_ACTIVITY`, `ADD_KNOWLEDGE_RESOURCE`, `GET_CONTENT_SEARCH` are declared but never mapped to any controller method — leftovers from an earlier per-type-endpoint design |
| `frac-backend`'s standalone `Role`/`Position`/`Activity`/`KnowledgeResource` model classes | Defined but never instantiated anywhere — superseded by the generic `DataNode` model, never deleted |
| `frac-backend`'s config | Three disagreeing port numbers (`server.port=8091`, Kong routes to `:8083`, Dockerfile `EXPOSE`s `8090`); an unresolved git merge-conflict marker checked into `application.properties` (lines 48-55); `KeycloakValidation.isExpired()` reads as logically inverted — none confirmed as active incidents, all worth a deliberate look before relying on this service in a new environment |
