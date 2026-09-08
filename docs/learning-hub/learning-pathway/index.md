# Learning Pathway

A guided, multi-stage learning journey — a handful of milestones, each a
small bundle of courses plus a checkpoint assessment, unlocked one at a time.

- **Category**: `courseCategory = "Learning Pathway"`
- **Consumption route**: pathway content page (mobile: dedicated learner-path
  screen; web: the standard course viewer)
- **Status**: ⚠️ thin backend — see the honest gap below

## In one paragraph

A Karmayogi opens a Learning Pathway the way they'd open any course, but
instead of one flat list of content they see up to five **milestones** laid
out like a staircase. Each milestone bundles a small set of courses (some
mandatory, some optional) and ends in its own short assessment. The next
milestone stays locked until the mandatory courses in the current one are
done and its checkpoint is passed — sometimes there's also a starting gate,
a preliminary assessment, before milestone one even opens. Finishing a
milestone can hand the learner a certificate for that milestone alone, not
just for the whole pathway at the end.

## How a Karmayogi experiences it

1. **Arrives** at the pathway from search, a listing, or (on mobile) a
   dedicated pathway screen — it looks like a course with stages.
2. **Clears the entry gate**, if the pathway has one: a preliminary
   assessment must be passed before milestone one opens.
3. **Works through milestone one**: takes its mandatory courses (optional
   ones are just that — optional); once every mandatory course is done, the
   milestone's own checkpoint assessment unlocks.
4. **Passes the checkpoint** and the milestone is marked complete —
   milestone two unlocks immediately, no waiting, no refresh needed.
5. **Repeats** for up to five milestones, picking up a milestone-level
   achievement/certificate along the way if the pathway awards one.
6. **Finishes the pathway** once the last milestone is complete.

## Actors

| Actor | Role |
|---|---|
| Karmayogi | The learner: works through milestones in order |
| Publisher | Authors the pathway in the Creation Portal — builds milestones, picks courses, sets up assessments and access rules |

## The one decision that defines the feature

> A milestone is not a separate record anywhere — it's a slot inside one
> JSON field on the pathway's own content entry, and every unlock a learner
> sees is worked out on their own device from ordinary course-progress data,
> not fetched from a "pathway progress" API.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, and the
[Operations Manual](operations-manual.md) for running it day to day.
