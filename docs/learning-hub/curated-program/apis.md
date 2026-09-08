# Curated Program — APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `curatedprogram/v1/enrol` | Auto-assign enrolment into the program's batch |
| POST | `openprogram/v1/enrol` | Same, for Moderated Program |
| POST | `cohorts/user/autoenrollment/` | Generic auto-enrolment used by standard collections |
| POST | `course/v1/hierarchy/:id` | Program structure — the child course list |
| GET | `learner/course/v4/user/enrollment/details/:userId` | Parent + child enrolments for the roll-up |
