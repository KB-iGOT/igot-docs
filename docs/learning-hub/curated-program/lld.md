# Curated Program — Low-Level Design

## Roll-up mechanics (verified)

`mapCompletionPercentageProgram` in `sb-cb-ui-toc › app-toc.service.ts`:

1. Find the parent enrolment by collection id.
2. For each child in `content.children`, find that child's own enrolment.
3. Copy its `completionPercentage`, `status`, `batchId` and any issued
   certificate onto the child node.
4. Compute the parent's percentage from the children; the latest child
   certificate is surfaced.

**Consequence worth documenting:** a child completed *outside* the program
(as a standalone course) counts toward the program — enrolments are keyed per
course, not per program membership.
