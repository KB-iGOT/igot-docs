# Comprehensive Assessment Program — Use Cases

### UC-1 · Arrive by mandate (Karmayogi)

A mandatory notification (modal) deep-links the learner into the CAP by
assessment id — discovery is push, not browse.

- Portal `mandatory-notification-modal` → TOC deep link

### UC-2 · Attempt and complete (Karmayogi)

The attempt lifecycle is the assessment engine's: read → save → submit →
result, with completion feeding the learner's record.

- See [Standalone Assessment › APIs](../standalone-assessment/apis.md)

### UC-3 · Mandate and track (MDO Admin)

Assignment and tracking ride content assignment + assigned-courses resolution
and the standard reports.

- See [My Assigned Courses](../my-assigned-courses/index.md)

### UC-4 · Author the program (Author)

Created in the Creation Portal under the CAP category with question sets
attached.

- APIs: `action/content/create` · `questionset/v1/…`
