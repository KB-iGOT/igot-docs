# Learning Pathway — Use Cases

## Learner journeys

### UC-1 · Discover a pathway

There is no purpose-built "Explore Pathways" surface. Discovery rides on
generic search/listing (`contentType` filter includes `Learning Path`, cards
label-swap `'Learning Path' → 'Program'`) or on the learner web portal's
org-targeted curated-content strip and "Curated Collections" explorer — both
real and reachable, but whether pathway content is actually fed into them is
controlled by a remotely-hosted page/widget config, not by anything in these
four repos.

- API: `POST apis/proxies/v8/sunbirdigot/v4/search`

### UC-2 · Enrol and open the pathway

The learner enrols (mobile has a dedicated enrol call) and opens the content.
On mobile, a pathway routes to its own screen (`LearnerPathContentPage`) once
`courseCategory == 'Learning Pathway'` is detected; on web it goes through the
standard course viewer, which branches internally on the same field.

- APIs: `GET /api/learningpathway/v1/enrol/{id}` (mobile) ·
  `GET apis/proxies/v8/extended/content/v1/read/{id}` (enriched read used to
  render milestones)

### UC-3 · Clear the entry gate

If the pathway defines a preliminary assessment, milestone one stays locked
until the learner passes it.

- API: read via the enriched-read response's `preliminaryAssessment`
  reference; the attempt itself uses the generic assessment/questionset APIs

### UC-4 · Work through a milestone

The learner takes the milestone's mandatory courses (optional ones don't
gate anything). Progress is read from the same generic content-progress APIs
used by any course — there is no pathway-specific progress endpoint.

- API: `GET /api/course/v5/content/state/read` (mobile) · generic
  content-progress read (web)

### UC-5 · Unlock and pass the milestone checkpoint

Once every mandatory course in the milestone is done, that milestone's own
assessment unlocks — a state tracked entirely on the learner's device, not
fetched from a server. Passing it marks the milestone complete and unlocks
the next one immediately, without a page refresh.

- **Non-obvious mechanism**: there is no server-side "unlock" call anywhere
  in this chain on either web or mobile — completion state is recomputed
  client-side from generic progress data every time.

### UC-6 · Collect a milestone achievement

Completing a milestone can trigger its own certificate/achievement, separate
from any final pathway certificate — confirmed end-to-end on mobile
(view, download, share); confirmed only as a validation fork on web.

- APIs: `POST /api/achievement/dynamic/v1/generate` (mobile) ·
  `POST /api/certreg/v2/achievement/validate` (web)

## Authoring journeys (Creation Portal, Publisher role)

### UC-7 · Create the pathway shell

The publisher fills in title, description, learning outcome and an image
across a 4-step wizard; the title must be unique (checked live) and the
description/outcome must be 250–1000 characters of plain text.

- API: `POST apis/proxies/v8/action/content/v3/create`

### UC-8 · Build the milestone structure

Up to five milestones can be added, each with its own name/description, a
searched-and-picked set of courses (each flaggable mandatory/optional, with
cross-milestone duplicates blocked), and a checkpoint assessment. A milestone
must be explicitly saved — there's no autosave.

- API: `PATCH apis/proxies/v8/action/content/v3/update/{id}` (whole
  `milestones_v1` array replaced on every save)

### UC-9 · Configure access and publish

Access control (who can see/enrol/consume) is configured before publish is
allowed; publish pushes any draft assessments first, then the pathway itself.

- APIs: `POST apis/proxies/v8/questionset/v1/publish/{id}` ·
  `POST apis/proxies/v8/action/content/v3/publish/{id}`

### UC-10 · Manage the pathway from the dashboard

The publisher's dashboard lists Live and Draft pathways with search, sort and
pagination; editing a Live pathway is read-only, editing a Draft is full
edit. Deleting a Live pathway is blocked if it has enrolled learners.

- APIs: `POST apis/proxies/v8/sunbirdigot/v4/search` ·
  `GET apis/protected/v8/cohorts/course/getUsersForBatch/{id}` ·
  `GET apis/proxies/v8/learningpathway/v1/retire/{id}`

## Edge cases

| Situation | Behaviour |
|---|---|
| Course picker "Apply Filters" | Non-functional — the button and its handler are a commented-out no-op; only search + pagination actually work |
| Same course added to two milestones | Blocked with a message naming the milestone that already has it |
| Milestone assessment save vs. pre-assessment save | Inconsistent: pre-assessment autosaves on configuration, milestone assessment requires an explicit "Save Milestone" click |
| Milestone "in progress" state | Never shown — mobile's status is binary (incomplete/complete); partial completion looks identical to not-started |
| Pathway reverted from Live to Draft | Forced read-only client-side, with no traced path back to fully editable |
| Deleting a Live pathway with enrolled learners | Blocked with an explanation dialog |
