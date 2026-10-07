# Competency Hub — APIs

Every client-facing call below is proxied through `sunbird-cb-uiproxy`
(paths shown relative to it, `apis/proxies/v8/…` or `apis/protected/v8/…`).
Verified from `sunbird-cb-portal`, `sunbird-cb-orgportal`,
`igot_karmayogi_mobile`, `sunbird-cb-uiproxy`, `sunbird-cb-ext`,
`cb-ext-course-service`, `frac-backend`, `frac-dictionary`, and
`sunbird-devops`' Kong route definitions.

**Two different backends answer to "the competency taxonomy," and this
page is careful to say which one every row below actually hits** — see
[HLD](hld.md) for why there are two.

## Client → Gateway → Backend, by concern

### Taxonomy reads

| Method | Endpoint (via uiproxy) | Backend | Purpose |
|---|---|---|---|
| GET | `apis/proxies/v8/framework/v1/read/kcmfinal_fw` | Kong → **`knowledge-platform`'s generic Framework API** (not `frac-backend`) | Read the `kcmfinal_fw` Competency Area→Theme hierarchy — used by both web repos and mobile to populate most competency pickers |
| POST | `apis/protected/v8/frac/searchNodes` | `sunbird-cb-uiproxy` → **`frac-backend` directly** | Search FRAC `DataNode`s (Competency/Role/Activity/Position/...) by name/status; used by profile-v3 self-attestation and Work Allocation |
| GET | `apis/protected/v8/frac/getAllNodes/{type}` | `sunbird-cb-uiproxy` → **`frac-backend` directly** | `type=competencyarea`/`dictionary`/`role`/`activity`/`knowledgeResource` dispatch onto `frac-backend`'s own `/frac/getAllNodes` |
| POST | `apis/proxies/v8/competency/v4/search` | Kong → likely `frac-backend`'s `/frac/searchNodes`, unconfirmed exact route mapping | Legacy ("v5") competency listing, still the primary endpoint for several callers |
| GET | `apis/proxies/v8/searchBy/competency` / `apis/proxies/v8/searchBy/v2/competency` | Kong → `sunbird-cb-ext`'s `SearchByController` | Browse-by-Competency directory (v1/v2) |
| POST | `apis/proxies/v8/v2/browseByCompetency` | Kong → `sunbird-cb-ext` | v2 hierarchical Area→Theme→SubTheme tree, combining Composite Search facets with the `kcmfinal_fw` framework read |
| GET | `apis/proxies/v8/v1/search/competenciesByOrg/{orgId}` | Kong → `sunbird-cb-ext` | Org-scoped competency listing, backs the mobile "Competency Strength" view |

### Content tagging

| Method | Endpoint | Purpose |
|---|---|---|
| — | *(none — read only)* | Content's `competencies_v6` field rides on whatever content-read/search call the screen already makes; there is no dedicated "tag content" API in this trace outside authoring |
| POST | `apis/protected/v8/competency/searchCompetency` | Authoring autocomplete when tagging a content item |
| POST | `apis/protected/v8/competency/addCompetency` | Author-submitted request for a new competency to be added to the master |

### Learner's own acquired competencies (the Passbook)

| Method | Endpoint | Backend | Purpose |
|---|---|---|---|
| GET | `apis/proxies/v8/learner/v1/competency/read` | Kong → `cb-ext-course-service` `LearnerCompetencyController` | The Passbook's core read — Cassandra-backed, Redis-cached |
| POST | `apis/proxies/v8/competencyTheme/search` | Kong | Resolve theme names/ids for the Passbook UI |
| — | `GET apis/protected/v8/cohorts/course/batch/cert/download/…` | — | Certificate download from within a Passbook competency's course list |

### Self-attestation (current/desired competencies)

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `apis/protected/v8/frac/searchNodes` | Populate the picker during profile-v3 setup |
| POST | `apis/proxies/v8/user/v1/extPatch` | Persist `profileDetails.competencies` / `profileDetails.desiredCompetencies` |

### Admin: ODCS designation↔competency mapping (`sunbird-cb-orgportal` + `sunbird-cb-ext`)

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `apis/proxies/v8/organisation/v1/getCompetencyDesignationMappingFile/sample/{frameworkId}` | Download the bulk-upload sample workbook |
| POST | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/bulkUpload/{frameworkId}` | Multipart upload; queues async processing, does not process inline |
| GET | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/progress/details/bulkUpload/{orgId}` | Poll batch progress |
| GET | `apis/proxies/v8/organisation/v1/competencyDesignationMappings/download/{fileName}` | Download a processed file |

### Admin: Work Allocation competency mapping

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `apis/protected/v8/frac/COMPETENCY/{query}` | Search competencies to attach to a role/activity (v1 and v2 share this endpoint) |
| GET | `apis/protected/v8/workallocation/getUserCompetencies/{userId}` | Aggregate a user's role-derived competencies across all their Work Allocation assignments |

## Gateway routing detail (`sunbird-cb-uiproxy`)

Unlike most proxied concerns, competency has **two hand-written routers** in
addition to the generic pass-through mechanism:

- `src/protectedApi_v8/competency.ts` and `src/protectedApi_v8/frac.ts` —
  call the FRAC backend directly (`CONSTANTS.FRAC_API_BASE`, default
  `https://<FRAC_HOST_DEV>`), doing light request shaping (e.g. building a
  `searchNodes` filter from a `type`/`key` path param) rather than pure
  pass-through.
- Everything else — `/competency/*`, `/competencyArea|Theme|SubTheme/*`,
  `/v1/search/competenciesByOrg`, `/organisation/v1/competencyDesignationMappings/*`,
  `/user/profile/v1/extended/competencies`, `/learner/v1/competency/read` —
  is a generic pass-through to `CONSTANTS.KONG_API_BASE` (default
  `https://<PORTAL_HOST>/api`).

Every one of the ~30 competency-related paths has its own explicit
role-based ACL entry in `whitelistApis.ts`. The pattern is consistent where
checked: read/search paths are open to `ROLE.PUBLIC` (any authenticated
user); create/update/delete/upload paths are restricted to
`MDO_ADMIN`/`MDO_LEADER`/`SPV_ADMIN`.

`sunbird-devops`' Kong config independently confirms where the pass-through
paths actually land:

```yaml
# ansible/roles/kong-api/defaults/main.yml
competency_prefix: /competency
competency_url: "http://fracentity-service:8083"
cb_ext_course_service_url: "http://cb-ext-course-service:7005"
```

The generic `/competency/*` and `/competencyArea|Theme|SubTheme/*` pass-
through routes reach `fracentity-service` — which this pass now confirms
**is** `frac-backend` (its `FRACController` implements the exact
`addDataNode`/`searchNodes`/`getAllNodes` method names both uiproxy routers
call by name). Its own `server.port` is `8091`
(`application.properties:2`), one off from the Kong config's `8083` and
from the Dockerfile's declared `EXPOSE 8090` (`Dockerfile:6`) — three
different port numbers for the same service across three configs; not
resolved further here, flagged in the Operations Manual.

## Backend: `frac-backend` (`/frac/*`) — the real taxonomy API

One controller (`FRACController.java`) behind base path `/frac`, backing
both uiproxy routers above and the generic Kong pass-through. All of it —
not just the subset the calling repos happened to use:

| Method | Path | Purpose |
|---|---|---|
| POST | `/frac/addDataNode` | Create/update one node. Blocked on an already-L2-verified node unless caller is `FRAC_REVIEWER_L2`/`FRAC_ADMIN` |
| POST | `/frac/addDataNodes` | Bulk create/update, array body |
| POST | `/frac/addDataNodeBulk` | One node + its children in one call (e.g. a Competency + its levels) |
| POST | `/frac/uploadDataNode` | **The real bulk-import path**: multipart `.xlsx`, parsed with Apache POI — sheet 1 = node rows, sheet 2 (optional) = competency-level rows |
| POST | `/frac/verifyDataNode` | Verify/reject one node — gated to `FRAC_REVIEWER_L1`/`FRAC_REVIEWER_L2`/`FRAC_ADMIN` |
| POST | `/frac/verifyAllDataNode` | Bulk-verify every node of a type, async on a background thread — **no role check found in the controller for this one**, unlike the single-node version (see As-Built) |
| GET | `/frac/getAllNodes` | List by type/status/department/bookmarks/myRequest/userType |
| POST | `/frac/v2/getAllNodes` | v2 variant, `RequestObject` body instead of query params |
| POST | `/frac/filterNodes` | Filtered listing |
| GET | `/frac/getVerificationList` | **A reviewer's inbox** — nodes grouped by status for a type/department/userType |
| POST | `/frac/mapNodes` | Replace a node's full parent↔child mapping |
| POST | `/frac/appendMapNodes` | **Dead code** — entire method body is commented out; always returns `true`, does nothing |
| POST | `/frac/nodeFeedback` | Submit a rating/comment on a node |
| GET | `/frac/getNodeFeedback` | List feedback (optionally just the caller's own) |
| GET | `/frac/getNodeRatingAverage` | Average rating via an Elasticsearch aggregation |
| GET | `/frac/getChildNodes` / `/frac/getParentNodes` | One-hop traversal of the mapping graph |
| GET | `/frac/getNodeById` | Single node, with optional detail/bookmarks/similar-nodes |
| DELETE | `/frac/deleteNode` | `FRAC_REVIEWER_L2`/`FRAC_ADMIN` only |
| POST | `/frac/searchNodes` | Elasticsearch-backed multi-field search — what most calling repos actually use |
| GET | `/frac/getCountOfNodes` | Counts by type/department/status/userType |
| GET | `/frac/exploreAllNodes` / `/frac/exploreSearch` | Public "explore" browse/search views |
| GET | `/frac/getMapping` | Raw mapping lookup |
| GET | `/frac/getCompetencyAreaListing` | Competency-area dropdown values |
| GET | `/frac/getCollectionLogs` | Per-node change/audit log, from the `frac-collection-logs` ES index |
| POST | `/frac/bookmarkDataNode` / GET `/frac/getBookmark` | Per-user bookmarking |
| POST | `/frac/filterByMappings` | Filter by mapping relationships |
| POST | `/frac/reviewMappings` | Verify a *mapping* (distinct from verifying a node) — writes to a separate `frac-verifiedmapping` ES index |
| POST | `/frac/filterReviewNodes` | Filtered review queue |
| GET | `/frac/getSourceList` | Distinct `source` values (`ISTM` or `CBPPROVIDER`) |
| GET | `/frac/getMyGraphs` | Analytics/insights widgets for the caller |
| GET | `/frac/flushReloadCache` | Admin: flush/reload the in-memory node+mapping cache (see LLD) |
| POST | `/frac/cloudStorage` / DELETE `/frac/deleteCloudFile` | Generic file upload/delete, provider-agnostic (`cloud-provider=azure`) |
| GET | `/frac/reloadDictionary` | Reload the `frac-dictionary` ES index and push it to `frac-dictionary`'s webhook (see below) |
| POST | `/frac/triggerAuditEvent` | Admin: replay historical review actions from `frac-collection-logs` back out as Kafka telemetry — a backfill/reconciliation tool |
| GET | `/frac/getPropertyCountList` | Counts per `additionalProperties` value (e.g. competencies per area) |
| PATCH | `/frac/privateUpdate` | Admin: arbitrary partial-field patch on any node's fields or `additionalProperties`, bypassing the normal add/update flow |

**Not found anywhere in `frac-backend`: "framework," "term," or "publish"
as domain concepts.** `framework` only appears as Spring Framework package
names; `term` has zero matches. So the ODCS "framework term create/update/
publish" calls in `sunbird-cb-ext` (below) are **not** hitting this
service — see HLD for where they actually land.

## `frac-dictionary`'s data path — bypasses the REST API entirely

`frac-dictionary` never calls any `/frac/*` endpoint. It reads Elasticsearch
directly, two ways:

- **Build time**: the `gatsby-source-elasticsearch` plugin bulk-pulls an
  entire ES index (`GATSBY_ELASTIC_INDEX`, env-templated, actual value not
  in the repo — but `frac-backend` names an ES index literally
  `frac-dictionary`, and `frac-backend` pushes to a webhook at
  `https://frac-dictionary-backend.../api/v1/site/update` matching
  `frac-dictionary`'s own `POST /api/v1/site/update` rebuild-trigger route)
  into Gatsby's static data layer, baked into the site at build time.
- **Runtime**: a small bundled Express/Apollo server re-queries the same
  Elasticsearch `_search` endpoint on every facet-filter interaction
  (`filterCompetencies`/`filterPositions` GraphQL queries), so filtering
  after page load still never touches `frac-backend`'s own API.

## Backend: `sunbird-cb-ext` (ODCS bulk upload)

## Backend: `cb-ext-course-service` (`LearnerCompetencyController`)

```
GET /learner/v1/competency/read
  Header: x-authenticated-user-token
  -> CompetencyService.fetchUserCompetency(authToken)
     1. resolve userId from token
     2. Redis GET user_competency_{userId}
     3. on miss: Cassandra read (user_competency_mapping, by userId)
        - if a row exists: cache it (TTL 3600s default), return under "competencies"
        - if no row exists: publish COMPETENCY_ACQUIRED{isFirstTimeUser:true}, return []
```

## Backend: `sunbird-cb-ext` (ODCS bulk upload)

```
POST /organisation/v1/competencyDesignationMappings/bulkUpload/{frameworkId}
  -> OrgDesignationCompetencyMappingServiceImpl.bulkUploadCompetencyDesignationMapping
     1. validate row count <= maximum.allow.limit.bulk.designation.competency.upload (1000)
     2. upload file to blob storage
     3. INSERT Cassandra tracking row (designation_competency_mapping_bulk_upload)
     4. publish Kafka event -> {env}.competency.designation.bulk.upload

# async, on a separate consumer:
OrgDesignationCompetencyBulkUploadConsumer
  -> initiateCompetencyDesignationBulkUploadProcess / processBulkUpload
     1. parse uploaded xlsx row by row
     2. validateCompetencyHierarchy() against master framework data (kcmfinal_fw)
     3. for each new mapping: createFrameworkTerm/updateFrameworkTerm
          -> knowledge-platform's generic Framework/Term API (kmBaseHost), NOT frac-backend
             (category=competency/subtheme is a Term category in THAT taxonomy)
     4. associate the competency node with the Designation term
     5. publishFramework() -> POST {kmBaseHost}{kmFrameworkPublishPath}/{frameworkId}
     6. UPDATE the Cassandra tracking row's status
```

This is the one flow that writes to `kcmfinal_fw` — and it never calls
`frac-backend` at all.

## Kafka events

| Topic (dev naming) | Producer | Consumer | Payload |
|---|---|---|---|
| `dev.user.competency.mapping.event` | `cb-ext-course-service` (first-time-user read); `event-cert-generator`, `collection-certificate-generator`, `common-certificate-generator-utility` (all `knowledge-platform-jobs`) | `user-competency-updater` (`knowledge-platform-jobs`) | `{eventType: "COMPETENCY_ACQUIRED", userId, contentId?, batchId?, contextType?, isFirstTimeUser?}` |
| `dev.user.competency.mapping.event.failed` | `user-competency-updater` | — (dead-letter) | Same shape, on processing failure |
| `dev.competency.designation.bulk.upload` | `sunbird-cb-ext` (`bulkUploadCompetencyDesignationMapping`) | `sunbird-cb-ext` (`OrgDesignationCompetencyBulkUploadConsumer`, same repo — a self-loop, not cross-service) | The uploaded file reference + rootOrgId |

## Backend: `user-competency-updater` write path (`knowledge-platform-jobs`)

```
Kafka consume COMPETENCY_ACQUIRED
  -> UserCompetencyPreProcessorFn
     dispatch on contextType/isFirstTimeUser:
       processFirstTimeUser   -> backfill from user_enrolments_v2 + external-training history
       processAchievementEvent -> new self-achievement, or add/remove update
       processIGOTCourses / processExtCourses / processExternalTraining
     for course-sourced events:
       getCourseInfo(courseId) -> GET content-service …/read/{id}?fields=competencies_v6
     for external content:
       getExtContentAPICall(courseId) -> competencyArea/Theme/SubThemeRefId
     upsertCompetencyWithFetch -> read existing Cassandra row, merge/dedupe by
       acquiredContextId, upsertCompetency -> Cassandra INSERT (LOCAL_QUORUM)
```

> **Verification boundary:** `frac-backend`'s API surface above is now fully
> traced. Still not part of this trace: the content-service component that
> writes `competencies_v6` when content is authored; `knowledge-platform`'s
> generic Framework/Term implementation itself (only its role as the ODCS
> write target was confirmed, via `sunbird-cb-ext`'s calling code and
> `knowledge-platform`'s own `taxonomy-api` controllers noted in that
> repo's analysis — its internal `kcmfinal_fw` schema wasn't independently
> re-verified here); and, most importantly, **any code that reconciles
> `frac-backend`'s taxonomy with the `kcmfinal_fw` mirror** — none was
> found in any of the 13 repos traced, and neither backend's code
> references the other by name or config.
