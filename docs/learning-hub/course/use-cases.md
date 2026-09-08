# Course — Use Cases

### UC-1 · Enrol (Karmayogi)

From the TOC page, one click enrols into the course's batch. Re-clicking is
safe; the record is keyed on user + course + batch.

- API: `POST learner/course/v1/enrol`

### UC-2 · Learn & resume (Karmayogi)

The viewer writes real-time progress; `lastReadContentId` powers the Resume
button back into the exact node.

- APIs: `POST content/v2/state/read` · `user/realTimeProgress/update`

### UC-3 · Leave a course (Karmayogi)

Unenroll is soft — the course leaves My Learning but history and any earned
certificate stay.

- API: `POST course/v2/unenroll`

### UC-4 · Complete, claim, certify (Karmayogi)

At 100% the learner claims Karma Points and downloads the certificate;
ratings and share-with-a-colleague close the loop.

- APIs: `POST claimkarmapoints` · `GET cohorts/course/batch/cert/download/:id` · `POST user/rating` · `user/v1/content/recommend`
