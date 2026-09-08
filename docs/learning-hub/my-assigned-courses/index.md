# My Assigned Courses

Courses pushed to a learner by their organisation — resolved by an
access-settings rules engine, including external partner (CIOS) courses.

- **Backend**: `cb-ext-course-service` — `CourseAccessController` /
  `CourseAccessServiceImpl` (fully in the attached repo set)
- **Primary API**: `POST user/v2/assignedcourses`

The learner-facing view of content assignment: courses an MDO has directed at
a user, surfaced as "My Assigned Courses" with mandatory-course nudges.
Assignments resolve from **cached access-setting rules**, then a composite
search finds matching courses; a dedicated endpoint resolves assigned partner
content via the CIOS integration.
