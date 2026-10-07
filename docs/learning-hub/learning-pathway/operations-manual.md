# Operations Manual — Learning Pathway

How to operate, support, and troubleshoot Learning Pathway as it exists
today — not as a separate product, but as a standard content/collection node
distinguished by `courseCategory = "Learning Pathway"`, with milestones
embedded in a single `milestones_v1` field.

**Operational implication:** the backend stores pathway metadata generically
and performs only limited pathway-aware logic, on enriched reads and cache
invalidation.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| Primary storage | Generic content node | Every create/update/publish/retire flows through generic content APIs — nothing pathway-specific to check separately |
| Milestone model | `milestones_v1` embedded JSON | No relational integrity |
| Read enrichment | `ExtendedContentActor.extendedRead()` | Preview and enriched reads depend on runtime resolution of referenced courses/assessments |
| Learner progression | Computed client-side, on web and mobile independently | No backend "unlock milestone" endpoint exists to repair learner state directly |
| Caching | Redis extended-read cache | Stale-read issues are usually cache or eventual-consistency related |

## Important fields

| Field | Meaning | Why it matters |
|---|---|---|
| `courseCategory` | `Learning Pathway` | The discriminator every client and the backend enrichment logic key off |
| `milestones_v1` | Embedded milestone JSON | Malformed content can break preview or progression |
| `preliminaryAssessment` | Assessment before milestone 1 | Can lock learner entry into the whole pathway |
| `accessSettingsEnabled` | Whether access control is configured | Publish-time gate depends on this |
| `status` / `prevStatus` | Lifecycle state | `prevStatus = Live` + `status = Draft` forces read-only |
| `versionKey` | Optimistic-concurrency token | Required on updates; stale values cause save conflicts |

## Operational workflows

**Authoring & draft save**: create → generic content create API → edits via
generic update with `versionKey` → milestone changes replace the *entire*
`milestones_v1` payload → preview uses the enriched-read endpoint, not a
separate preview service. There is no true autosave — "Save Draft" is
explicit; if a user reports lost work, first confirm whether they actually
triggered a save.

**Publish**: confirm access control is configured → confirm referenced
assessments are publish-ready → publish draft assessments first → publish
the pathway. The UI uses hardcoded delays (4s after publish, 5s after
retire) to mask search-index eventual consistency — if a pathway doesn't
appear immediately, wait briefly before treating it as a failed publish.

**Retire/delete**: for Live items, check for enrolled learners in the
associated batch first — the UI blocks deletion if any exist. Retirement
itself is `GET /learningpathway/v1/retire/{id}`.

## API reference for operations

| Method | Endpoint | Operator use |
|---|---|---|
| POST | `action/content/v3/create` | Diagnose authoring create-flow issues |
| PATCH | `action/content/v3/update/{id}` | Check save failures and version conflicts |
| GET | `action/content/v3/read/{id}?mode=edit` | Confirm stored metadata |
| GET | `extended/content/v1/read/{id}` | Main read-path diagnostic endpoint |
| POST | `action/content/v3/publish/{id}` | Confirm the final lifecycle action |
| POST | `questionset/v1/publish/{id}` | Resolve blocked publish dependencies |
| GET | `learningpathway/v1/retire/{id}` | Delete/retire support |
| POST | `sunbirdigot/v4/search` | Validate authoring search/listing behaviour |
| GET | `apis/protected/v8/cohorts/course/getUsersForBatch/{id}` | Investigate a blocked Live-tab delete |
| GET | `/api/learningpathway/v1/enrol/{id}` | Mobile learner enrolment support |
| GET | `/api/course/v5/content/state/read` | Indirect input to milestone-progression analysis |
| POST | `/api/achievement/dynamic/v1/generate` | Mobile achievement troubleshooting |

## Caching and consistency

Extended reads cache in Redis as `extended_read_content_{identifier}`,
default TTL 86400s, invalidated when an update touches `milestones_v1` or
`preliminaryAssessment`.

- Preview shows old milestone structure after a save → suspect stale cache
  or a failed invalidation.
- Dashboard looks delayed after publish/retire → suspect search-index lag.
- Edits visible in edit-mode read but not enriched preview → compare the two
  reads directly.

**Best practice**: for triage, compare edit read → extended read → learner
rendering, in that order — it separates persistence issues from enrichment
issues from client-rendering issues.

## Progression and unlock behaviour

There is no dedicated backend API to force a milestone unlock, recompute
pathway progress, or set milestone completion directly. Troubleshooting
means validating the underlying content-completion and assessment-pass
inputs, not looking for an admin override — none exists. Web and mobile
compute unlock independently, so cross-client discrepancies must be
investigated client by client.

## Publishing checklist

- [ ] Pathway node exists and is editable
- [ ] `courseCategory` is `Learning Pathway`
- [ ] `milestones_v1` is present and structurally sensible
- [ ] Preliminary assessment is set, if required by design
- [ ] Milestone-linked assessments are valid and publishable
- [ ] Access control is configured
- [ ] No stale `versionKey` in the update attempt
- [ ] After publish, verify via both listing and enriched read

## Retirement checklist

- [ ] Correct pathway identifier confirmed
- [ ] Enrolled-learner check done for Live content
- [ ] Stakeholders warned about delayed listing refresh
- [ ] Removal from expected listing views verified after the consistency delay

## Troubleshooting guide

| Symptom | Likely cause | Check | Next action |
|---|---|---|---|
| Saved milestones don't appear in preview | Cache staleness or failed update | Compare edit read vs. extended read | Validate update success and cache invalidation |
| Publish fails | Access settings missing or dependent assessment not publishable | Access config + assessment readiness | Fix dependency, retry publish |
| Pathway appears read-only in Draft | Reverted-from-live state | `status` and `prevStatus` | Treat as lifecycle-state issue |
| Learner can't start next milestone | Mandatory items incomplete or prior milestone not complete | Mandatory-content completion + assessment pass state | Correct the underlying completion inputs |
| Milestone assessment stays locked | Mandatory courses in the same milestone not done | Milestone-level progress inputs | Guide learner to finish mandatory content |
| Live delete blocked | Enrolled learners exist | Batch-user endpoint result | Business decision — the block is an intentional safeguard |
| Mobile certificate generation fails | Achievement-generation call failure or external dependency | `/api/achievement/dynamic/v1/generate` behaviour | Retry, inspect downstream service health |
| Conflicting saves between two publishers | Stale `versionKey` | Update sequence, last successful save | Reload latest draft, reapply changes |

**Diagnostic sequence**: confirm identifier + environment → read in edit
mode → read via extended read → determine if the issue is authoring-only,
preview-only, or learner-facing → for learner issues, separate web and
mobile (independent unlock logic) → for publish/retire, account for
eventual-consistency delay.

## Known operational constraints

- No dedicated pathway database tables.
- No reverse index for "which pathways reference course X."
- No server-side pathway-progress or milestone-unlock API.
- No admin mechanism to repair malformed milestone JSON beyond a generic
  content update.
- Some access-control behaviour depends on external widgets and remote
  configuration not present in these repos.

**Operating model**: treat Learning Pathway as a content-orchestration
feature layered on generic content infrastructure, not as an isolated
product with its own operational controls.

## Escalation

| Issue type | Owner | Escalate when |
|---|---|---|
| Draft save, publish, retire, version conflict | Content platform / authoring support | Generic content APIs fail or lifecycle state is inconsistent |
| Preview mismatch or missing enrichment | Backend content-read team | Edit read is correct but extended read is wrong |
| Web learner unlock behaviour | Web portal team | Underlying progress is correct but web lock state is wrong |
| Mobile learner unlock or certificate behaviour | Mobile team | Underlying progress is correct but mobile rendering/certificate fails |
| Access control behaviour | Access-control/config owner | Behaviour differs from the expected widget or remote-config setting |

## FAQ

**Why do dashboard listing, preview, and learner view sometimes disagree?**
Because each depends on a different read path — listing on search-index
freshness, preview and learner rendering on enriched reads and cache state.
Temporary mismatch after a write is expected.

**Is there a manual unlock button for support to use?** No dedicated
server-side pathway-unlock endpoint exists. Support should validate the
completion/assessment inputs the client computes from, not look for an
override.

**Why can malformed milestone data break the UI in inconsistent ways?**
Because `milestones_v1` is stored as embedded JSON — a corrupted structure can fail differently in different clients.

> **Verification boundary:** this manual is sourced from the same four
> repos as the rest of this feature's docs, plus the team's existing
> operations documentation for Learning Pathways. Deeper runbook detail for
> the external certificate/karma/QR service and the access-control remote
> config would need those systems' own operations docs attached.
