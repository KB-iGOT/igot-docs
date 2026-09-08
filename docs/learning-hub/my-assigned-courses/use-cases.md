# My Assigned Courses — Use Cases

### UC-1 · See what's assigned to me (Karmayogi)

The portal calls the v2 endpoint with the user's token; the service resolves
the org's access-setting rules and returns matching courses with the
learner's enrolment state.

- API: `POST user/v2/assignedcourses`

### UC-2 · Assigned external (partner) courses (Karmayogi)

Marketplace/CIOS content assigned by the org is resolved by a separate
endpoint against the CIOS search host.

- API: `POST user/v1/assigned/externalcourses`

### UC-3 · Inspect a learner's assignments (MDO Admin)

Support and compliance view: the admin endpoint takes the target userId in
the path.

- API: `POST admin/user/v2/assignedcourses/:userId`

### UC-4 · Mandatory-course pressure (Karmayogi)

Assigned mandatory courses drive the notification modal and the
mandatory-course shelf, with deadlines shown until completion.

- Feature route `/app/learn/mandatory-course` · `GET content/user/info`
