# Bharat Kalp — Use Cases

## Learner journeys

### UC-1 · Land on the Bharat Kalp home page

A member opens `app/learn/bharat-kalp` (directly, from the home page
spotlight card, or from a notification banner). The page resolves the
program's configuration once, then renders the program hero and a
horizontally scrollable carousel of communities the member can join — with
a loading skeleton while that carousel's data arrives, and a plain "No
communities available" message if there are none.

- API: `POST /apis/v1/form/read` (program configuration)

### UC-2 · Open a community from the carousel

Clicking a community card navigates the member straight into that
community's discussion thread.

### UC-3 · Browse this week's content

From "see all," the member searches by keyword, narrows to a specific week
or "All Weeks," and switches between content-type tabs (Courses, Programs,
Events, Resources, External Courses) — a tab only appears if that week
actually has content under it. Status pills (All / In Progress / Completed
/ Not Started) filter further, except on the Resources tab, where
enrolment status doesn't apply.

- APIs: `POST sunbirdigot/search` (internal content) · `POST
  cios/v1/search/content` (external/CIOS content)

### UC-4 · See enrolment/completion status while browsing

Each card in the grid shows the member's own progress against that item —
fetched in one batched call for internal content and one call per item for
external content, then merged into a single status per card.

- APIs: `POST learner/course/v4/user/enrollment/details/:userId` · `GET
  cios-enroll/v1/readby/useridcourseid/:id`

### UC-5 · Open a piece of content

Clicking a card routes the member to the right place depending on content
type: the internal player for resources, the external TOC for CIOS content,
or the normal course/program overview for everything else.

## Non-member journeys

### UC-6 · Turned away at the door

Someone outside the program sees no entry points at all — the home
spotlight card and the notification banner are both filtered out — and a
direct link to the route is redirected to `/page-not-found` by the guard.
The one exception is the string-vs-boolean flag mismatch below, where the
entry points appear but the guard still refuses the click.

## Edge cases

| Situation | Behaviour |
|---|---|
| User isn't a Bharat Kalp member | Direct link to `app/learn/bharat-kalp` redirects to `/page-not-found`; entry points (spotlight card, notification) are hidden |
| Member's profile stores the flag as the string `"true"` instead of boolean `true` | Entry points *do* show (they accept both), but clicking through hits the guard, which only accepts boolean `true` — the member sees the door but can't open it |
| A dependency call fails (config, search, or enrolment) | Silently caught; the affected area renders empty ("No content found") rather than showing an error |
| A week's date fields aren't in the expected format | Week/current-week calculation can silently go wrong, showing the wrong week selection |
| Program config changes after a member's session already loaded it | Member keeps seeing the old config until a full page reload — the config cache has no invalidation |
| A new route is added under this feature expecting the same full-width mobile layout | It won't get it automatically — the mobile layout list is hardcoded per route |

See [LLD](lld.md) and [Operations Manual](operations-manual.md) for the
mechanics and troubleshooting behind each of these.
