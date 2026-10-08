# Learning Pathway — LLD

Reverse-engineered from code. Where an assumed relational schema doesn't
match reality, the as-built structure is documented instead, with the
mismatch called out explicitly.

## Storage reality

There are no dedicated tables — no `learning_pathway`, `pathway_milestone`,
`milestone_course`, `learner_pathway_progress`, or `learner_milestone_progress`
anywhere in the four repos traced. This is the single biggest deviation from
what a "pathway feature" would normally look like.

**Neo4j (ontology-engine, via `DataNode`)** — one graph node per pathway, of
generic type `Content`:

| Property | Type | Notes |
|---|---|---|
| `identifier` | string | node ID |
| `contentType` | string | `"Course"` |
| `primaryCategory` | string | `"Course"` |
| `courseCategory` | string | `"Learning Pathway"` — the sole discriminator |
| `mimeType` | string | `"application/vnd.ekstep.content-collection"` |
| `title`, `description`, `purpose` | string | learning outcome stored in `purpose` |
| `appIcon`, `posterImage`, `creatorLogo` | string (URL) | |
| `milestones_v1` | string (JSON) or list | opaque JSON |
| `preliminaryAssessment` | string | assessment content identifier |
| `accessSettingsEnabled` | boolean | |
| `duration` | number | computed client-side, stored server-side |
| `status`, `prevStatus` | string | `Draft` / `Live` / retired (unconfirmed) |
| `versionKey` | string | optimistic-concurrency token, required on every PATCH |

**Cassandra (`hierarchy_store`, via `HierarchyManager`)** stores the generic
content-hierarchy tree for referenced Course nodes' own children — it is
**not** used for pathway↔milestone↔course relationships, which live inside
the `milestones_v1` JSON instead.

**Redis** is a cache only, key `extended_read_content_{identifier}`, TTL
configurable (default 86400s) — not a source of truth.

**Milestone** (embedded object inside `milestones_v1`, no table):

```jsonc
{
  "id": "uuid",
  "index": 1,
  "name": "string, <=70 chars",
  "description": "string, <=1000 chars",
  "courses": [
    { "identifier": "string", "name": "string", "isMandatory": true,
      "appIcon": "url", "posterImage": "url", "lastPublishedOn": "iso-date",
      "description": "string", "duration": 0 }
  ],
  "assessmentDetail": { "identifier": "string", "duration": 0 }
}
```

There is nothing to relate below the single pathway node — everything is
embedded JSON, not rows. The one real edge in the whole structure is a plain
string `identifier`, resolved by ID lookup at read time, never by a foreign
key or graph edge:

```mermaid
flowchart TB
    PN["Content node (Neo4j) - courseCategory = Learning Pathway - identifier, title, status, versionKey, duration"]
    MV["milestones_v1 - opaque JSON string or list"]
    PA["preliminaryAssessment - single identifier string"]

    PN -->|field| MV
    PN -->|field| PA

    subgraph M1["milestones_v1[0] embedded object"]
        M1C["courses: identifier, isMandatory, duration, ..."]
        M1A["assessmentDetail: identifier, duration"]
    end
    subgraph M2["milestones_v1[1..4] up to 4 more, same shape"]
    end

    MV --> M1
    MV --> M2

    CourseNode[("Course content node (Neo4j) resolved by identifier lookup, not a graph edge")]
    AssessNode[("Assessment content node (Neo4j) resolved by identifier lookup")]

    M1C -.->|"DataNode.read(identifier) at extended-read time only"| CourseNode
    M1A -.->|"DataNode.read(identifier) at extended-read time only"| AssessNode
    PA -.->|"DataNode.read(identifier)"| AssessNode
```

Dashed arrows are resolved on demand by ID lookup, not a persisted
relationship — there is no reverse index, so "which pathways reference
course X" requires a full scan, and a milestone can reference a since-deleted
course with no referential-integrity check catching it.

## API detail

### Update (generic, used for every field group)

```plaintext
PATCH action/content/v3/update/{id}
Body: { request: { content: { versionKey, ...changedFields } } }
```

Used for metadata edits, `milestones_v1` array replacement (whole-array PUT
semantics — no partial-milestone update endpoint), `preliminaryAssessment`
id, `accessSettingsEnabled`, and asset linking.

### Backend extended-read, step by step

```plaintext
GET /content/v1/extended/read/:identifier
  -> ExtendedContentController.extendedRead
  -> ExtendedContentActor ! Request(operation="extendedReadContent")
  -> extendedRead():
      1. read(identifier) via generic ContentActor read path (Neo4j DataNode.read)
      2. if courseCategory == "Learning Pathway":
           parseMilestones(metadata["milestones_v1"])
           for each milestone (parallel):
             fetchCourseWithHierarchy(courseId) -> DataNode.read (Neo4j) + HierarchyManager.getHierarchy (Cassandra)
             fetchAssessmentRead(assessmentId) -> DataNode.read (Neo4j, no hierarchy, leaf node)
           merge results back into milestone.courses[] / milestone.assessmentDetail
           enrichPreliminaryAssessment() - same pattern, single identifier
      3. cache result in Redis (extended_read_content_{id}, TTL from config)
```

No pagination, partial-field selection, or filtering exists on this
endpoint — it always returns the full enriched tree.

## Module map

```mermaid
flowchart TB
    subgraph Backend["knowledge-platform Scala/Akka"]
        CA2["ContentActor - generic CRUD + cache invalidation"]
        ECA2["ExtendedContentActor - enrichLearningPathwayContent, enrichMilestonesWithHierarchy"]
    end

    subgraph Creation["sunbird-cb-creationportal - dedicated module"]
        Stepper2["lp-creation-stepper orchestrator"]
        CreatePath["lp-create-path"]
        Structure["lp-learning-structure -> lp-milestone"]
        Access["lp-access-control"]
        Preview["lp-preview-path"]
        Dashboard["lp-dashboard"]
        Stepper2 --> CreatePath & Structure & Access & Preview
    end

    subgraph WebViewer["sunbird-cb-portal - branches inside generic viewer"]
        Viewer["viewer.component.ts courseCategory branch"]
        TopBar["viewer-top-bar / viewer-secondary-top-bar shouldApplyMilestoneLocking"]
        Practice["practice.component.ts checkAndShowMilestoneCompletion"]
    end

    subgraph MobileToc["igot_karmayogi_mobile - lives inside toc/ feature"]
        TocHelper["toc_helper.dart the unlock engine"]
        LearnerPath["learner_path_content_page.dart"]
        MilestoneUI["MilestoneView / MilestoneItem"]
        LearnerPath --> MilestoneUI
    end

    Stepper2 -->|REST create update publish| CA2
    Preview -->|REST extended/content/v1/read| ECA2
    Viewer -->|REST generic content-read| CA2
    TocHelper -->|REST generic progress-read| CA2
```

No shared library exists between the four repos for pathway logic — each
client independently reimplements its own read of `courseCategory` /
`milestones_v1` and its own unlock computation.

## Sequence: milestone unlock (the load-bearing mechanism)

This is entirely client-computed on both platforms — there is no server-side
"unlock" call anywhere in this chain.

```mermaid
flowchart TD
    Start(["Learner completes a resource"]) --> Event["Content-completion event (web markAsCompleteSubject, mobile progress update)"]
    Event --> Recalc["Recalculate milestone progress - counts MANDATORY courses only"]
    Recalc --> AllDone{"All mandatory courses in this milestone complete?"}
    AllDone -- No --> WaitCourses["Milestone status stays 0 - own assessment isAssessmentLocked true"]
    AllDone -- Yes --> AssessUnlock["Milestone's assessment unlocks isAssessmentLocked false"]
    AssessUnlock --> Attempt["Learner attempts milestone assessment - scored by generic assessment engine"]
    Attempt --> Pass{"Passed?"}
    Pass -- No --> Attempt
    Pass -- Yes --> Complete["milestone i status = 2 complete"]
    Complete --> NextRule["milestone i+1 isLocked = milestone i status < 2 -> false"]
    NextRule --> Popup["Web: Continue to next milestone popup"]
    NextRule --> Achieve["Mobile: View Achievement button appears"]
```

## State machine

**Pathway status** (informal, string-literal-based — no enum found in code):

```mermaid
stateDiagram-v2
    [*] --> Draft: created
    Draft --> Live: publish (validateStepperFour passes)
    Live --> Retired: retire
    Live --> RevertedDraft: reverted externally
    RevertedDraft --> RevertedDraft: forced read-only client-side
    Retired --> [*]
```

`RevertedDraft` (`prevStatus = Live`, `status = Draft`) is a real, distinct
state discovered in `isLearningPathwayReadOnly()` — not documented in any
requirements summary, and no path back to fully editable was found.

**Milestone status** (mobile, binary only):

```mermaid
stateDiagram-v2
    [*] --> Incomplete: milestone created status 0
    Incomplete --> Complete: all mandatory courses done, assessment passed
    Complete --> [*]
```

No "in progress" (status 1) state is ever emitted — partial completion looks
identical to not-started.

The two lock flags on a milestone are independent: `isLocked` depends on the
**previous** milestone's status; `isAssessmentLocked` depends on **this**
milestone's own mandatory-course completion. A milestone can be unlocked
while its own assessment is still locked.

> **Verification boundary:** facts above are read from
> `sunbird-cb-creationportal`, `sunbird-cb-portal`, `igot_karmayogi_mobile`,
> and `knowledge-platform`. Not analysed from source: the certificate
> registry, karma-points award, and QR-generation services — their
> behaviour is only visible as calls made *into* them from the traced
> clients. Attaching those repos would close the gap, as would the assessment
> config's external `@sunbird-cb/consumption` package (numeric bounds for
> attempts/passing-score are delegated there and unverified) and the remote
> JSON config that drives access control and discovery filtering.
