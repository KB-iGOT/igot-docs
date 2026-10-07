# Marketplace — APIs

Gateway prefixes stripped for readability except where noted. Verified from
`cb-pores-service`, `cios-content-service`, `cb_external_enrollment_service`,
`sunbird-course-service`, `sunbird-cb-uiproxy`, `sunbird-cb-adminportal`,
`sunbird-cb-creationportal`, and `sunbird-devops` (branches/commits as
listed in [index.md](index.md)).

## Partner master data & licensing (`cb-pores-service`)

`ContentPartnerController`, base path `/contentpartner`:

| Method | Route | Notes |
|---|---|---|
| POST | `/v1/create` | `createOrUpdate` — generates `partnerCode`, zeroes licensing defaults |
| POST | `/v1/update` | Same handler; locks `licenseType` once set (`LICENCE_TYPE_CANNOT_BE_CHANGED`) |
| GET | `/v1/read/:id` | |
| POST | `/v1/search` | Elasticsearch-backed, index `content_provider_alias` |
| DELETE | `/v1/delete/:id` | Soft delete (`isActive=false`) + Kafka cascade to content |
| PUT | `/v1/activate` | Reactivate + Kafka cascade to content |
| GET | `/v1/readbypartnercode/:partnercode` | |

`ContentPartnerRegistrationController`, base path `/contentpartner/register`:

| Method | Route | Notes |
|---|---|---|
| POST | `/v1/create` | Self-registration; generates `applicationId`, status `PENDING` |
| POST | `/v1/update` | Admin approve (`APPROVED`, auto-provisions `ContentPartner`) / reject (`REJECTED`, comment required) |
| GET | `/v1/read` | Lookup by `id`+`email` — **requires both**, not either (see LLD gap) |
| GET | `/v1/readbyid` | Authenticated read by id |
| POST | `/v1/search` | Elasticsearch-backed, index `content_provider_registration_alias` |

`SSOController`, base path `/sso`: POST `/create/:id`, POST `/update/:id`,
GET `/read/:id`, POST `/validateSaml` — Keycloak SAML client management per
partner.

`CiosController` (also in `cb-pores-service`), base path `/cios`: POST
`/v1/onboardContent`, POST `/v1/search/content`, POST `/read/v1/content`,
GET `/v1/content/read/:contentId`, GET
`/v1/content/readby/externalid/:externalid/:partnerid`, GET
`/v2/content/read/:contentId`, DELETE `/v1/content/delete/:contentId`.

## Content ingestion (`cios-content-service`)

`CiosContentController`, base path `/ciosIntegration`:

| Method | Route | Notes |
|---|---|---|
| POST | `/v1/loadContentFromExcel/:partnercode/:partnerId` | Uploads catalog file to GCS, queues Kafka processing |
| POST | `/v1/readAllContentFromDb` | Paginated Postgres fetch |
| POST | `/v1/loadContentProgressFromExcel/:partnercode` | Progress/enrollment file upload |
| GET | `/v1/file/info/:partnerId` | Upload history |
| POST | `/v1/deleteContent` | Delete not-yet-published content |
| GET | `/v1/read/content/:partnercode/:externalid` | |
| POST | `/v1/search/content` | Elasticsearch-backed |
| POST | `/v1/update/content` | |

## Enrollment & entitlement (`cb_external_enrollment_service`)

`EnrollmentController`, base path `/cios-enroll`:

| Method | Route | Notes |
|---|---|---|
| POST | `/v1/create` | Enroll user in a CIOS/partner course |
| POST | `/v1/courselist/byuserid` | List a user's enrollments |
| GET | `/v1/readby/useridcourseid/:courseid` | Read one enrollment |
| GET | `/v2/readby/useridcourseid/:courseid` | V2 of the above |
| POST | `/v1/user/progressupdate` | Requires `partnerCode` header |
| POST | `/v1/validation` | Pre-enrollment validation |
| GET | `/v1/enrollment/status` | Requires `partnerCode` header |
| POST | `/v1/search` | By user + partnerId |
| POST | `/v1/karmapoints/deductionrule` | Karma-point deduction rule check |

Integration calls this service makes outward (via `TransformUtility`, not
controller endpoints): CIOS content read/search, content-partner
read/update (syncs consumed-license counts back), and a named **Coursera**
invite integration proxied through an internal service-registry
(`POST /serviceregistry/v1/callExternalApi`).

## External-course enrollment inside native course-service (`sunbird-course-service`)

No dedicated "marketplace" controller — the external-course path rides the
**same** enrollment/badge actors as native courses, branching internally:

| Component | What it does |
|---|---|
| `ContentUtil.getAllExternalContent` / `getExternalContents` | POST to `cb-pores-service`'s CIOS content-search endpoint, parses CIOS response shape |
| `ContentCacheHandlerV2.getExternalContent(id)` | Local cache for external content, separate from the native content cache |
| `CourseEnrolmentActorV3` / `ExtendedCourseEnrollmentActor` | `getExternalEnrollments`, `addExternalCourseDetails`, `isExternalCourseEligible` — read/write a **separate** Cassandra table `externalCoursesEnrolment_db`, distinct from native course enrollment |
| `ExtendedBadgeEnrollmentActor.searchExternalContent` | POSTs to CIOS with `filterCriteriaMap["contentPartner.isActive"]=true`, then `transformCiosResponseToCompositeFormat` to make CIOS results look like native Composite Search results |

## uiproxy (`sunbird-cb-uiproxy`) — BFF layer

All marketplace/CIOS/partner traffic rides the generic catch-all proxy
(`proxyCreatorSunbird`) to `KONG_API_BASE` — there is **no dedicated
`CIOS_API_BASE`/`PORES_API_BASE` env var**; the routing decision (which
backend a given path prefix reaches) is made entirely in Kong, not here.

A bespoke (non-passthrough) handler exists at `GET
/cios/v1/content/read/:contentId` (`proxies_v8.ts`), but it sits **behind**
a catch-all `.use('/cios/*', ...)` registered earlier — since the catch-all
never calls `next()`, this specific handler is effectively unreachable dead
code (see LLD gap).

## Kong gateway (`sunbird-devops`)

Path prefixes and upstream service URLs, from
`ansible/roles/kong-api/defaults/main.yml`:

| Prefix | Upstream |
|---|---|
| `/cios` | `cb_pores_service_url` → `http://cb-pores-service:7001` |
| `/ciosIntegration`, SSO routes, content-onboard/search/update | `cios_content_service_url` → `http://cios-content-service:7001` |
| `/cios-enroll` | `cb_external_enrollment_service_url` → `http://cb-enrollment-service:7002` (note: k8s service name doesn't match the repo name) |
| `/course` | `lms_service_url` → `http://lms-service:9000` (native course enrollment, not marketplace-specific) |

## Admin Portal service (`sunbird-cb-adminportal`)

`MarketplaceService`, full endpoint list (all proxied through
`/apis/proxies/v8/...`): `createProvider`, `updateProvider`,
`uploadThumbNail`, `uploadCIOSContract`, `getProvidersList`,
`deleteProvider`, `activateProvider`, `getProviderDetails`,
`getGroupsList`, `getContentList`, `uploadContent`, `uploadProgress`,
`getCoursesList`, `deleteUnPublishedCourses`, `downloadLogs`,
`createConfiguration`/`updateConfiguration`/`getConfiguraionDetails`
(service-registry, for the "via API" content-transform path),
`getSSOConfiguration`/`createSSOConfiguration`/`updateSSOConfiguration`/
`testSSOConfiguration`, `contentRegisterList`,
`changeStatusRegisterProvider`, `readRegisteredProviderDetails`.

## Creation Portal services (`sunbird-cb-creationportal`)

`MarketPlaceServicesService`: `getProvidersList` (POST
`contentpartner/v1/search`), `getCoursesList` (POST
`ciosIntegration/v1/search/content`), `onboardContent` (POST
`cios/v1/onboardContent`), `getProviderData` (GET
`contentpartner/v1/read/:id`), `getConfiguraionDetails`/
`callExternalApiById` (service-registry "via API" ingestion path). A
**second, independently-defined** copy of `GET_COURSES_LIST` and
`GET_PROVIDER_DETAILS` exists in `CiosContentReadResolverService` (used as
a route resolver), plus a third URL there,
`GET_LIVE_COURSE_DETAILS` → `cios/v2/content/read/:id?inputFields=status`.

Learner-facing consumption (`AppTocCiosHomeComponent`, in `sunbird-cb-portal`)
goes through the third-party `@sunbird-cb/collection-v2` package's
`WidgetContentService` (`fetchExternalContent`, `fetchExtUserContentEnroll`,
`extContentEnroll`) — its literal REST endpoints are not visible in any of
the 9 repos traced.

## Verified payloads

```jsonc
// POST contentpartner/register/v1/create (self-registration)
{ "request": { "contentPartnerName": "…", "email": "…", "phone": "…" } }
```

```jsonc
// POST cios-enroll/v1/create (learner enroll into a partner course)
{ "userId": "…", "courseId": "…", "partnerId": "…" }
```

```jsonc
// POST cios/v1/onboardContent (curator publishes/saves a course)
{
  "content": { "…": "…", "courseType": "paid|free",
    "courseEnrolLimit": 0, "requiredKarmaPoints": 0 },
  "status": "draft|live",
  "contentPartner": { "…partner fields merged in…" }
}
```

> **Verification boundary:** confirmed end-to-end from the 9 repos listed
> in [index.md](index.md). Not verified: Kong's exact path-rewrite between
> `sunbird-cb-uiproxy`'s proxy aliases and each backend's literal
> controller path (config lives in `sunbird-devops` and was spot-checked,
> not exhaustively diffed against every route); and any REST calls inside the
> third-party `@sunbird-cb/collection-v2` package.
