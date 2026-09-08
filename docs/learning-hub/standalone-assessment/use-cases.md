# Standalone Assessment — Use Cases

### UC-1 · Start an attempt (Karmayogi)

The player reads the assessment shell (sections, timing, rules), then fetches
questions by id in batches as the learner progresses.

- APIs: `POST assessment/v5/read` · `question/v5/read`

### UC-2 · Auto-save & submit (Karmayogi)

Answers are saved server-side during the attempt, then submitted; the submit
API has evolved v2→v5 and old versions remain for embedded/legacy content.

- APIs: `POST assessment/save` · `user/evaluate/assessment/submit/v5`

### UC-3 · See results & retake (Karmayogi)

Result read is versioned alongside submit; retakes are requested per
assessment id and honour the configured attempt policy.

- APIs: `POST user/assessment/v5/result` · `GET user/assessment/v5/retake/:assessmentId`

### UC-4 · Author the question set (Author)

Created in the Creation Portal as a question set with its own review/publish
cycle; CQF quality checks have their own create/update/autopublish path.

- APIs: `questionset/v1/create · review · publish` · `cqfquestionset/…`
