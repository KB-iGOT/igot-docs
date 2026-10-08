# Learning Pathway — APIs

Gateway prefixes are stripped below for readability; every endpoint is
`{{host}}/apis/proxies/v8/…` unless marked otherwise. Verified from
`sunbird-cb-creationportal › learner-pathway.service.ts`,
`igot_karmayogi_mobile › toc_api_service.dart` / `certificate_service.dart`,
`sunbird-cb-portal › certificate.service.ts`, and
`knowledge-platform › content-actors › ExtendedContentActor.scala`.

There is no dedicated "Learning Pathway" API family. Every write goes through
the generic Content CRUD surface; the only pathway-aware backend endpoint is
the enriched read.

## Creation Portal → Backend

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `sunbirdigot/v4/search` | Search pathways (dashboard listing), courses (course picker), and duplicate-title checks — one endpoint, three call sites |
| POST | `action/content/v3/create` | Create the pathway content node (`courseCategory: "Learning Pathway"`); also used to create the Asset node behind an image/logo upload |
| POST | `upload/action/content/v3/upload/{id}` | Upload the image/logo binary (multipart) |
| PATCH | `action/content/v3/update/{id}` | Update pathway metadata, replace the whole `milestones_v1` array, set `preliminaryAssessment`, `accessSettingsEnabled`, or link an asset |
| ~~PATCH~~ | `private/content/v4/system/update/{id}` | Defined in the service, never called — dead code |
| GET | `action/content/v3/read/{id}?mode=edit` | Read the pathway for editing |
| ~~GET~~ | `action/content/v3/read/{id}` | Defined, never called in the traced files |
| GET | `questionset/v1/hierarchy/{id}?mode=edit` | Read an assessment's hierarchy for duration calc and publish-readiness validation |
| POST | `questionset/v1/publish/{id}` | Publish a draft assessment referenced by the pathway |
| POST | `action/content/v3/publish/{id}` | Publish the pathway itself |
| GET | `learningpathway/v1/retire/{id}` | Retire (delete) a pathway |
| GET | `extended/content/v1/read/{id}` | Enriched read used by the Preview step — delegates to the backend's `ExtendedContentActor` |
| GET | `apis/protected/v8/cohorts/course/getUsersForBatch/{id}` | Check for enrolled learners before allowing a Live-tab delete |

### Verified create payload

```jsonc
// POST action/content/v3/create
{
  "request": {
    "content": {
      "contentType": "Course",
      "primaryCategory": "Course",
      "courseCategory": "Learning Pathway",   // the discriminator
      "mimeType": "application/vnd.ekstep.content-collection",
      "framework": "igot",
      "license": "CC BY 4.0",
      "ownershipType": ["createdFor"],
      "cumulativeTracking": true,
      "language": ["English"],
      "accessSetting": "allUsers", // present on the "Next" path only — omitted on "Save Draft", a known inconsistency
      "title": "…",
      "description": "…",
      "purpose": "…" // the learning outcome field
    }
  }
}
```

## Backend (knowledge-platform, Scala/Akka/Play)

| Method | Route | Handler |
|---|---|---|
| GET | `/content/v1/extended/read/:identifier` | `ExtendedContentController.extendedRead` → `ExtendedContentActor.extendedRead()` |
| _(generic)_ | Standard Content v3 create/update/publish/retire routes | `ContentActor` — no pathway branching except cache invalidation when `milestones_v1`/`preliminaryAssessment` change |

Response caching on the enriched-read path: Redis, key `extended_read_content_{id}`,
TTL from `extendted.content.read.cache.ttl` (default 86400s), invalidated on
write by `ContentActor.invalidateExtendedReadCaches`.

## Mobile → Backend

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/learningpathway/v1/enrol/{id}` | Enrol the learner into a pathway |
| POST | `/api/achievement/dynamic/v1/generate` | Generate a milestone achievement certificate |
| GET | `/api/course/v5/content/state/read` | Generic content-progress read — the input to client-side milestone-completion calculation |

```jsonc
// POST /api/achievement/dynamic/v1/generate
{
  "request": {
    "userId": "…",
    "courseId": "…",
    "batchId": "…",
    "milestoneId": "…"
  }
}
// Response: an SVG certificate, rendered in a webview
```

## Web → Certificate service

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `certreg/v2/certs/validate` | Generic content/course certificate validation |
| POST | `/api/certreg/v2/achievement/validate` | Milestone/pathway achievement certificate validation (selected by URL pattern, not a separate UI flow) |

No dedicated "get milestone status" or "get pathway progress" endpoint exists
on any client — unlock state is a purely client-side derived computation from
generic enrolment/progress data.

> **Verification boundary:** the service actually implementing certificate
> issuance, QR generation, and karma-point awards is not present in the four
> repos traced (`sunbird-cb-creationportal`, `sunbird-cb-portal`,
> `igot_karmayogi_mobile`, `knowledge-platform`) — only the calls into it are
> visible. Attaching that service would close this gap.
