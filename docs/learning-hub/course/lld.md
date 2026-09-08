# Course — Low-Level Design

## Enrolment record (as consumed by the portal)

| Field | Use |
|---|---|
| `status` 0/1/2 | Not started / in progress / completed — drives My Learning grouping |
| `completionPercentage` | Server-computed over mandatory nodes |
| `lastReadContentId` | Resume deep-link into the viewer |
| `issuedCertificates[]` | Non-empty ⇒ certificate download renders |
| `batch.batchId` | Every enrolment is batch-scoped, even for open courses |

Verified from the enrolment-merge logic in
`sb-cb-ui-toc › app-toc.service.ts` (`mapCompletionPercentageProgram`) and the
session/progress components.

> **Verification boundary:** LMS internals are upstream — same boundary as
> Blended Program.
