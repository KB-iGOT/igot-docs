# Course — APIs

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `learner/course/v1/batch/list` | Batches for the course (open courses ride a default batch) |
| POST | `learner/course/v1/enrol` | Direct enrolment — no workflow |
| POST | `course/v2/unenroll` | Soft unenroll |
| GET | `learner/course/v4/user/enrollment/details/:userId` | Enrolments with batch + progress for My Learning |
| POST | `content/v2/state/read` · PATCH `content/v2/state/update` | Per-node progress (`cb-ext-course-service › CourseController`) |
| POST | `karmapoints/user/course/read` · `claimkarmapoints` · `user/totalkarmapoints` | Karma Points read / claim / totals |
| POST | `user/rating` · `user/v1/content/recommend` | Rating and share |
| GET | `cohorts/course/batch/cert/download/:certId` | Certificate download |
