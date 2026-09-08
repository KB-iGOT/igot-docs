# Blended Program

Instructor-led learning that mixes online modules with classroom sessions —
batches, seat limits, attendance and offline session tracking.

- **Category**: `primaryCategory = "Blended Program"`
- **Consumption route**: `/app/toc/:programId` (course TOC page)
- **Workflow service name**: `blendedprogram`

## In one paragraph

A Blended Program is an ordinary course collection whose **enrolment is
indirected through an approval workflow**. A learner requests a seat in a
batch; one or two approvers (MDO admin and/or Program Coordinator, per the
batch's approval type) act on the request; only an **approved workflow** writes
the actual enrolment. Everything else — batches, progress, certificates —
rides the standard course rails.

## Actors

| Actor | Role |
|---|---|
| Karmayogi | The learner: requests, withdraws, learns, attends |
| MDO Admin | Ministry/department administrator; an approver |
| Program Coordinator (PC) | Owns the program; an approver; works the Creation Portal console |
| Author | Creates the program content in the Creation Portal |
| Batch Creator | Opens and maintains batches |
| Instructor | Assigned per batch; runs sessions and marks attendance |

## The one decision that defines the feature

> A learner never writes to the enrolment table directly; only an approved
> workflow does.

See [HLD](hld.md) for the topology and [LLD](lld.md) for the state machine.
