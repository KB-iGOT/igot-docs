# Learning Hub

The Learning Hub is the consumption surface of iGOT Karmayogi. Its content
types share one spine — content published from the Creation Portal, batches and
enrolments in the LMS, per-node progress state — and each type adds one twist:

| Content type | The twist | Docs |
|---|---|---|
| [Course](course/index.md) | none — the baseline: direct enrolment | ✅ |
| [Curated Program](curated-program/index.md) | auto-assigned batch, roll-up progress | ✅ |
| [Blended Program](blended-program/index.md) | approval workflow between request and enrolment | ✅ |
| [My Assigned Courses](my-assigned-courses/index.md) | rules engine resolves what the org pushed | ✅ |
| [Standalone Assessment](standalone-assessment/index.md) | assessment engine replaces the player | ✅ |
| [Comprehensive Assessment Program](comprehensive-assessment-program/index.md) | mandated assessment over shared rails | ⚠️ thin |
| [Learning Pathway](learning-pathway/index.md) | milestones gate each other — sequential unlock, not one flat list | ⚠️ thin backend |
| [Peer Validation](peer-validation/index.md) | a named colleague, not a machine, has to approve completion | ✅ |
| [Bharat Kalp](bharat-kalp/index.md) | cohort-gated microsite, not a content type on the shared rails | ⚠️ no backend of its own |
| [AI CBP Tool](ai-cbp-tool/index.md) | AI-assisted competency-based program authoring | ✅ |
| [Events Hub](events-hub/index.md) | live/virtual event scheduling and participation | ✅ |
| [Search](search/index.md) | global content discovery across the composite search APIs | ✅ |
| [AI Assessment Tool](ai-assessment-tool/index.md) | Gemini-generated assessments from a course's PDFs/captions or KCM competency selections alone | ✅ |
| [Marketplace](marketplace/index.md) | partner/external content ecosystem — separate storage, enrollment and entitlement stack from native Course | ✅ |
| [Unenrollment of Courses](unenrollment-of-courses/index.md) | learner-initiated withdrawal — one flag flip, wired up differently per client | ✅ |
| [Moderated Content](moderated-content/index.md) | org-scoped visibility via `courseCategory` + `secureSettings`, riding the generic review workflow — plus an unrelated ML profanity check on discussion posts | ✅ |

Some folders under `learning-hub/` are no longer part of the Learning Hub and
are listed elsewhere: [Bulk Registration](bulk-registration/index.md),
[Weekly Claps](weekly-claps/index.md), [Training Plan](training-plan/index.md)
and [CHS](chs/index.md) are **Features**; [Discussion Hub](discussion-hub/index.md)
and [Amrit Gyaan Kosh](amrit-gyaan-kosh/index.md) are hubs of their own.
