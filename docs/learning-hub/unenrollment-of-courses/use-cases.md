# Unenrollment of Courses — Use Cases

## Learner journeys — mobile (the only client with a full flow)

### UC-1 · Discover the option

The unenroll action lives only inside the TOC page's overflow ("⋮") menu,
gated by `TocAppbarWidget._buildActions`:

```dart
if (!isPlayer && !isCompleted && !isFeatured && isActive &&
    courseCategory.toLowerCase() == PrimaryCategory.course &&
    (config?['showMenuIcon'] ?? false)) { ... }
```

So it is **never offered** for: a course opened in player mode, an already
completed course, a "featured" course, an inactive/not-enrolled state, or
any content whose `courseCategory` isn't exactly `"course"` — blended
programs, curated/moderated programs, standalone assessments, and pathway
content all fall outside this menu and have no equivalent unenroll entry
point on mobile. A single remote-config flag (`showMenuIcon`, currently
`true` in both traced TOC configs) can also hide it globally.

- Source: `toc_appbar_widget.dart` `_buildActions`

### UC-2 · Confirm intent

Selecting "Un-enroll" opens `UnenrollConfirmationBottomSheet`: title
"Confirm Un-enrollment", body naming the course, and an impact statement
("removes the course from My Learning, deducts Karma Points if applicable,
updates Reports and Organization Dashboard"). A checkbox ("I understand the
impact...") gates the Continue button — it stays disabled until ticked.
Cancel or the close icon simply dismisses with no side effect.

- **Verification boundary**: the Karma Point deduction claimed in this
  copy is not confirmed anywhere in the backend trace (see
  [as-built-requirements.md](as-built-requirements.md) CON-002) — the
  backend unenroll path never touches a karma-points table or emits a
  karma-points event.
- Source: `unenroll_confirmation_bottom_sheet.dart`

### UC-3 · Give a reason (mandatory)

Confirming leads straight into `UnenrollFeedbackBottomSheet`, never
directly to the API call. The learner must select at least one reason from
a fixed list (not relevant to role / too difficult or too easy / not
enough time / poor content quality / enrolled by mistake); a free-text
comment (≤500 chars) is optional. "Yes, un-enroll" is disabled with zero
reasons selected. "Back" returns to the confirmation sheet rather than
cancelling outright.

- Source: `unenroll_feedback_bottom_sheet.dart`

### UC-4 · The call itself

Reasons and comment travel in the **same** request as the unenroll call —
there is no separate feedback-submission endpoint:

```jsonc
// POST /api/course/v2/unenroll
{ "request": { "courseId": "...", "batchId": "...", "reasons": [...], "comments": "..." } }
```

- **Verification boundary**: the backend controller/validator/actor trace
  (`sunbird-course-service`) shows no field named `reasons` or `comments`
  anywhere in `CourseEnrollmentRequestValidator` or `CourseEnrolmentActor` —
  only `courseId`/`collectionId`, `batchId`, `userId` are read. Whether the
  backend persists, ignores, or errors on the extra fields could not be
  confirmed from the traced files; it is not referenced in the actor logic
  at all, so the most likely reading is that it's silently dropped.
- Source: `toc_repository.dart` `unenrollCourse`, `toc_api_service.dart`
  `unenrollCourse`, `api_endpoints.dart` (`courseUnenroll =
  '/api/course/v2/unenroll'`)

### UC-5 · See the result

On success: a telemetry `INTERACT` event fires
(`pageIdentifier: /app/toc/:do_ID/overview_btn-unenroll`, `subType:
unenroll`), and the page re-fetches enrolment info to refresh local state —
there's no explicit navigation away, no dedicated "unenrolled"
confirmation screen. On failure: a toast shows the backend's `errmsg` (or a
generic failure string), no retry button.

- Source: `course_toc_page.dart` `_onUnenrollConfirmed`

## Learner journeys — web (a different feature entirely)

### UC-6 · "Withdraw" a pending blended-program enrolment (web's only unenroll-labelled action)

Web has **no** equivalent of UC-1–UC-5 for a plain course — an exhaustive
case-insensitive grep of `sunbird-cb-portal` for "unenroll" turns up exactly
two files, both part of one flow: withdrawing a **blended program**
enrolment request that is still sitting in an approval workflow. The
"Withdraw" button on the TOC banner only appears while
`workFlow.wfItem.currentStatus` is none of `REJECTED` / `REMOVED` /
`WITHDRAWN` / `APPROVED` — i.e. **only pre-approval**. Once a two-step
MDO→PC (or PC→MDO) chain is mid-flight, the button disables itself while
sitting at the other approver's stage.

```jsonc
// POST apis/proxies/v8/workflow/blendedprogram/unenrol
{
  "rootOrgId": "...", "userId": "...", "state": "<current workflow status>",
  "action": "WITHDRAW", "actorUserId": "...", "applicationId": "<batchId>",
  "serviceName": "blendedprogram", "courseId": "...", "deptName": "...",
  "wfId": "..."  // when known
}
```

On success the banner updates its own local workflow-status object and
shows a "Request withdrawn Successfully!" toast; it does not splice
anything out of a course list, doesn't navigate away, and the parent page
doesn't refetch (it only refetches on the mirror `INITIATE` action).

- APIs: `POST apis/proxies/v8/workflow/blendedprogram/unenrol` (web) via
  `WidgetContentService.enrollAndUnenrollUserToBatchWF`
- **Important distinction**: this is the *same endpoint path* mobile uses
  for its own blended-program "withdraw" flow (see UC-7), but it is a
  workflow-state-machine action — not the `POST /v1/course/unenroll`
  backend endpoint documented in UC-1–UC-5. Whether `/workflow/
  blendedprogram/unenrol` and `/v1/course/unenroll` share any backend
  implementation is out of scope — neither backend for the workflow route
  was in the repos traced for this feature.

### UC-7 · Mobile's separate blended-program "withdraw" path

Mobile has its own version of UC-6, structurally distinct from UC-1–UC-5:
triggered from `EnrollBlendedProgramButton` only while the enrollment
workflow is pending MDO/PC approval, via a plain `AlertDialog` (no
checkbox, no reason picker), calling the same
`/api/workflow/blendedprogram/unenrol` endpoint mobile calls "withdraw" in
code. No telemetry event fires for this path (unlike UC-1–UC-5's
`TelemetrySubType.unenroll`), and a failed call fails **silently** — the
service method catches its own exception and returns `null` with no
user-facing error message.

- API: `POST /api/workflow/blendedprogram/unenrol` (mobile) via
  `TocApiService.requestUnenroll`
- Source: `enroll_blended_program_button.dart` `unEnrollBlendedCourse`

## Admin journeys

### UC-8 · Admin force-unenrolls a learner

`POST /v1/course/admin/unenroll` exists on the backend, using the identical
actor path (`CourseEnrolmentActor.unEnroll`) as the learner-initiated
route; the caller supplies `userId` directly. **No UI in any of the
front-end-facing repos traced (mobile, web, uiproxy) calls this route** —
no confirmed caller was found.

- API: `POST /v1/course/admin/unenroll`
- Source: `CourseEnrollmentController.adminUnenrollCourse`

## Edge cases

| Situation | Behaviour |
|---|---|
| Course already completed | Backend rejects with `courseBatchAlreadyCompleted` — the same error code used for "batch has ended" |
| Not currently enrolled / already unenrolled | Backend rejects with `userNotEnrolledCourse` |
| Batch enrollment type is neither `open` nor `invite-only` | Backend rejects with `enrollmentTypeValidation` — applies identically to enroll and unenroll |
| No content access | Backend rejects with `accessDeniedToEnrolOrUnenrolCourse` |
| Mobile: course completed / mid-player / featured / non-plain-course | Menu item never shown — no rejection error path, the UI simply doesn't offer it |
| Mobile: unenroll API call fails | Toast shows backend `errmsg` or generic failure string; no retry action |
| Mobile: reasons list empty | "Yes, un-enroll" button stays disabled — can't submit without a reason |
| Web: plain-course unenroll | Not possible — no UI path exists for it at all |
| Web/mobile: blended-program withdraw once `APPROVED` | Withdraw button disappears entirely — no way to back out post-approval through any traced UI |
| EventSet (multi-occurrence event) unenroll | Supported via a separate actor (`EventSetEnrolmentActor`) that unenrolls each child event individually, but — unlike course unenroll — never updates the per-batch lookup table, only the enrolment row itself |
| "Certificate already issued" | No such check exists anywhere in the backend validation — only course-completion status blocks unenroll, not certificate state |

> **Verification boundary:** all use cases above trace to the seven repos
> listed in [index.md](index.md). Whether the mobile-collected
> `reasons`/`comments` fields are persisted anywhere downstream (e.g. fed
> into the `cb-core-data` unenrollment report) could not be confirmed — the
> report job reads its reason/comment columns from a Cassandra audit table
> (`enrollment_history_by_action`) that is written outside the code paths
> traced here, so the connection between "what mobile sends" and "what the
> report shows" is plausible but unverified.
