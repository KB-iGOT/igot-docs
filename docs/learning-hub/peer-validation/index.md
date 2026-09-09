# Peer Validation

A course completion isn't taken at face value for some content — a
Karmayogi picks two or three colleagues who know their work, and one of
those peers has to sign off before the completion really counts.

- **Trigger**: a set number of days after finishing an eligible course (a
  window the department configures, typically 30–60 days later)
- **Consumption route**: a survey pop-up / dashboard on web and mobile
- **Status**: ✅ documented, with two confirmed gaps called out below

## In one paragraph

Some courses come with a peer-validation survey attached by the department.
Once a Karmayogi finishes the course and enough time has passed, they're
prompted to fill in a short survey about how they applied what they
learned, attach optional supporting proof (a PDF or short video), and name
two or three peers who can vouch for it. Each named peer gets their own
notification, opens the submission, and approves or rejects it. Once a peer
decides, that decision is final — there's no way to reopen it, and if
rejected, there's currently no way to try again with a fresh submission.

## How a Karmayogi experiences it

1. **Gets prompted**, days after finishing the course, to complete a short
   validation survey — answering a few questions about the course.
2. **Optionally attaches proof** — a PDF or a short video — to back up their
   answers.
3. **Names two or three peers** who can vouch for the work.
4. **Waits for a peer to act.** Each named peer sees the request on their
   own dashboard and opens it to review.
5. **Peer approves or rejects.** This is a one-shot decision — once made,
   it can't be changed, and (today) a rejection is a dead end: there's no
   built-in way to submit again for the same request.

## Actors

| Actor | Role |
|---|---|
| Karmayogi (learner) | Completes the course, fills the survey, names peer reviewers |
| Peer | A colleague named by the learner; reviews and approves/rejects |
| MDO Admin | Configures and monitors validation surveys for their department's courses |
| SPV Admin | Configures and monitors surveys system-wide, across departments |

## The one decision that defines the feature

> A peer's decision is final the moment it's made — there is no edit, no
> appeal, and no resubmission path if a peer rejects. Support can explain
> why a request looks stuck, but there is nothing to override.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, and the
[Operations Manual](operations-manual.md) for running it day to day.
