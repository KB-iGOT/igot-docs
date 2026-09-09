# Bharat Kalp — APIs

All paths are as called by `sunbird-cb-portal` via the API gateway
(`/apis/proxies/v8/…` prefix stripped for readability). Sources:
`bharat-kalp-form.service.ts`, `bharat-kalp-see-all.component.ts`
(verified against `sunbird-cb-portal` `origin/cbrelease-4.8.40`, commit
`b80a6327`). Full request/response detail: [LLD](lld.md#component-detail).

There is no "Bharat Kalp" API family. The feature composes four existing
platform endpoints — one form-config read plus two search and two enrolment
calls — and fans them out from the browser; no endpoint assembles a week on
the server.

## Configuration

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `v1/form/read` | Resolve the program's config (`bkConfig`, `sectionList`, `weekProgress`); cached in memory for the SPA session after the first success |

### Verified config payload

```jsonc
// POST v1/form/read — as built by bharat-kalp-form.service.ts
{ "request": {
    "type": "<route.data.pageKey || 'bharat-kalp'>",
    "subType": "microsite",
    "action": "page-configuration",
    "component": "portal",
    "rootOrgId": "*"
} }
// on failure: returns { data: null, error } rather than throwing
```

## Content discovery ("see all")

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `sunbirdigot/search` | Internal content metadata for the ids configured under the selected week/tab |
| POST | `cios/v1/search/content` | External (content-partner/CIOS) content metadata for the External Courses tab |

### Verified search payloads

```jsonc
// POST sunbirdigot/search — internal content
{ "locale": ["en"],
  "request": {
    "filters": { "identifier": ["<content id>", "…"] },
    "limit": "<ids.length + 5>"
} }
// reads res.result.content[]

// POST cios/v1/search/content — external (CIOS) content
{ "filterCriteriaMap": {
    "contentPartner.isActive": true,
    "contentId": ["<content id>", "…"]
  },
  "requestedFields": [], "pageNumber": 0,
  "pageSize": "<ids.length + 10>",
  "orderBy": "createdOn", "searchString": "", "facets": [ ]
}
// reads res.data[]
```

## Enrolment / completion status

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `learner/course/v4/user/enrollment/details/:userId` | Internal enrolment + completion status, batched for all internal ids in one call |
| GET | `cios-enroll/v1/readby/useridcourseid/:id` | External enrolment + completion status — one call per external content id, no batching |

### Verified enrolment payloads

```jsonc
// POST learner/course/v4/user/enrollment/details/:userId — one batched call
{ "request": { "courseId": ["<content id>", "…"] } }
// reads res.result.courses[] — camelCase (courseId, completionPercentage)

// GET cios-enroll/v1/readby/useridcourseid/:id — no body, one call per id
// reads res.result — flat and lowercase (courseid, completionpercentage),
// a different shape from the internal API; merged by spread into enrollmentMap
```

Every one of these calls is wrapped in `catchError(() => of(null))`, so a
failure degrades to an empty grid rather than an error state.

## Community carousel

Community data on the landing page is supplied by the external
`<sb-uic-bharat-kalp>` component (from `@sunbird-cb/consumption`) via
template projection — this repo only renders the projected data, it does
not call an API for it directly.

---

> **Verification boundary:** endpoints and payloads above are read from
> `sunbird-cb-portal`, `origin/cbrelease-4.8.40`, commit `b80a6327`. The
> serving side of every endpoint (Form Service, Search Service, Enrollment
> Service, CIOS) is documented from the portal's request/response handling
> only — not analysed from those services' own source.
