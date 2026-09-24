# Competency Hub — APIs

Every client-facing call below is proxied through `sunbird-cb-uiproxy`
(paths shown relative to it, `apis/proxies/v8/…` or `apis/protected/v8/…`).
Verified from `sunbird-cb-portal`, `sunbird-cb-orgportal`,
`igot_karmayogi_mobile`, `sunbird-cb-uiproxy`, `sunbird-cb-ext`,
`cb-ext-course-service`, and `sunbird-devops`' Kong route definitions.

## Client → Gateway → Backend, by concern

### Taxonomy reads (the KCM/FRAC framework)

| Method | Endpoint (via uiproxy) | Backend | Purpose |
|---|---|---|---|
| GET | `apis/proxies/v8/framework/v1/read/kcmfinal_fw` | Kong → external framework service | Read the full Competency Area→Theme hierarchy — used by both web repos and mobile to populate every competency picker |
| POST | `apis/protected/v8/frac/searchNodes` | `sunbird-cb-uiproxy` → FRAC directly | Search competency nodes by name/status; used by profile-v3 self-attestation and Work Allocation |
| GET | `apis/protected/v8/frac/getAllNodes/{type}` | `sunbird-cb-uiproxy` → FRAC directly | `type=competencyarea`/`dictionary`/`role`/`activity`/`knowledgeResource` dispatch |
| POST | `apis/proxies/v8/competency/v4/search` | Kong | Legacy ("v5") competency listing, still the primary endpoint for several callers |
| GET | `apis/proxies/v8/searchBy/competency` / `apis/proxies/v8/searchBy/v2/competency` | Kong → `sunbird-cb-ext`'s `SearchByController` | Browse-by-Competency directory (v1/v2) |
| POST | `apis/proxies/v8/v2/browseByCompetency` | Kong → `sunbird-cb-ext` | v2 hierarchical Area→Theme→SubTheme tree, combining Composite Search facets with the KCM framework read |
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
  `https://frac.igot-dev.in`), doing light request shaping (e.g. building a
  `searchNodes` filter from a `type`/`key` path param) rather than pure
  pass-through.
- Everything else — `/competency/*`, `/competencyArea|Theme|SubTheme/*`,
  `/v1/search/competenciesByOrg`, `/organisation/v1/competencyDesignationMappings/*`,
  `/user/profile/v1/extended/competencies`, `/learner/v1/competency/read` —
  is a generic pass-through to `CONSTANTS.KONG_API_BASE` (default
  `https://portal.karmayogi.nic.in/api`).

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
competency_url: "http://fracentity-service:8083"   # NOT any of the 14 repos traced
cb_ext_course_service_url: "http://cb-ext-course-service:7005"
```

The generic `/competency/*` and `/competencyArea|Theme|SubTheme/*` pass-
through routes ultimately reach `fracentity-service` — a competency CRUD
microservice that exists (confirmed by this routing config) but whose own
source is not part of this trace.

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
     3. for each new mapping: createFrameworkTerm/updateFrameworkTerm (FRAC, category=competency/subtheme)
     4. associate the competency node with the Designation term
     5. publishFramework() -> POST {kmBaseHost}{kmFrameworkPublishPath}/{frameworkId}
     6. UPDATE the Cassandra tracking row's status
```

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

> **Verification boundary:** the FRAC backend, `fracentity-service`, and the
> content-service (`competencies_v6` source) are all called *into* from
> these repos but their own implementations are not part of this trace —
> only the calls made into them are visible here. `sunbird-devops` confirms
> `fracentity-service` exists and where it's routed from, but its API
> contract is not documented in this feature's scope. Attaching that repo
> would close this gap.
