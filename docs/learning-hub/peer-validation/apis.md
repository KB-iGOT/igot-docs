# Peer Validation — APIs

Gateway prefixes are stripped for readability. Verified from `form-service`
(`FormsControllerV2.java`), `cb-notification-service`
(`NotificationController` / `NotificationServiceImpl.java`), `sunbird-cb-ext`
(`PeerValidationController` / `StorageServiceImpl.java`), and the mobile
client's `PeerValidationRepository` (`igot_karmayogi_mobile`), which calls
the same three backends directly rather than through a dedicated pathway.

There is no single "Peer Validation service" — endpoints are split across
three independently-owned backends, correlated only by shared `formId` /
`notificationId` string identifiers, not a database relationship.

## form-service — survey lifecycle, submission, review

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `mdo/peersurvey/create` | Create a survey scoped to the caller's department |
| POST | `spv/peersurvey/create` | Create a survey system-wide |
| PUT | `mdo/peersurvey/{surveyId}` | Update a draft survey (department-scoped) |
| PUT | `spv/peersurvey/{surveyId}` | Update a draft survey (system-wide) |
| POST | `mdo/peersurvey/search` | Search surveys within the caller's department |
| POST | `spv/peersurvey/search` | Search surveys across all departments |
| PUT | `peersurvey/publish/{surveyId}` | Draft → Active |
| PUT | `peersurvey/end/{surveyId}` | Active → Ended |
| PUT | `peersurvey/archive/{surveyId}` | Ended → Archived |
| POST | `peersurvey/submit` | Dual-purpose: a learner's survey submission, or a peer's review decision — disambiguated by an action-type field in the body |

### Verified submission payload

```jsonc
// POST peersurvey/submit — learner submission
{
  "formId": "string",
  "contextId": "string",       // the course
  "contextOrgId": "string",
  "notificationId": "string",
  "peerIds": ["userId1", "userId2"],   // client enforces 2-3; server allows up to 5
  "attachments": ["https://.../peerValidationSubmissions/formId/userId/file.pdf"],
  "responses": [
    { "questionId": "q1", "answer": 4, "answerType": "numericRating", "isRequired": true }
  ]
}

// POST peersurvey/submit — peer review decision
{
  "actionType": "REVIEW",
  "submissionId": "string",
  "reviewStatus": "APPROVED", // or "REJECTED" — terminal once set
  "notificationId": "string"
}
```

## cb-notification-service — notification and status tracking

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `bulk/create/peervalidation` | Bulk-create notification + tracking rows for a set of peers/learners (called by form-service, also directly reachable) |
| GET | `peervalidation/list` | List a user's pending (as learner) and incoming (as peer) requests |
| PATCH | `v2/read` | Mark a notification read, or record a free-form status (e.g. `IGNORED`) |
| POST | `cleanup/peer-validations` | Trigger the previous-day cleanup job — **requires no auth header** |

## sunbird-cb-ext — reporting and attachments

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `peerValidation/v1/report/initiate/{formId}` | Kick off an async CSV report (throttled: 409 if a completed report exists within 24h, or one is already in progress within 1h) |
| GET | `peerValidation/v1/list/report` | Poll report status for the caller's department |
| POST | `peersurvey/upload` | Upload the optional PDF/MP4 attachment |
| POST | `storage/v1/peervalidation/report/download` | Download a completed CSV |

## Mobile client (direct calls, not through the web gateway prefix)

The mobile app calls these same backend contracts, but at `/api/...`
directly against its configured base URL — not through the
`/apis/proxies/v8/...` prefix the web learner portal uses.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/notifications/peervalidation/list` | List requests/reviews (mobile dashboard) |
| POST | `/api/forms/v2/submissions/search` | Fetch a learner's submitted response, for a peer to review |
| POST | `/api/forms/peersurvey/submit` | Submission and review decision (same dual-purpose endpoint) |
| GET | `/api/forms/v2/getFormById` | Fetch the survey's question definitions |
| POST | `/api/peersurvey/upload` | Upload attachment (multipart) |
| POST | `/api/user/v1/search` | Search for peers to name (a generic, reused user-search endpoint) |
| PATCH | `/api/v1/notifications/v2/read` | Mark read / record decision |

> **Verification boundary:** Kong's actual routing rules (how `/apis/proxies/v8/...` and the mobile's direct `/api/...` calls both eventually reach `form-service`, `cb-notification-service`, and `sunbird-cb-ext`) live outside the repos traced — only the gateway-facing config (`KONG_API_BASE`) was visible, not Kong's own route definitions. Whether both paths resolve to the same Kong instance could not be confirmed.
