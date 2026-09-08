# Curated Program — Use Cases

### UC-1 · Enrol in the program (Karmayogi)

One call; the response carries the assigned batch. Moderated Programs route
to the open-program variant of the same call (verified branch in
`autoAssignCuratedBatchApi`).

- APIs: `POST curatedprogram/v1/enrol` · `openprogram/v1/enrol`

### UC-2 · Work through child courses (Karmayogi)

Each child behaves as a normal course; the parent card shows the merged
percentage and the next course to take.

- APIs: `GET enrollment/details` · `POST course/v1/hierarchy/:id`

### UC-3 · Complete and certify (Karmayogi)

When the roll-up reaches 100%, program-level completion triggers the
certificate exactly as for a course.

### UC-4 · Assemble and publish (Author / Curator)

Built in the Creation Portal as a collection of existing courses, through the
same create → review → publish cycle.

- APIs: `action/content/create` · `content/hierarchy/update` · `content/v3/publish/:id`
