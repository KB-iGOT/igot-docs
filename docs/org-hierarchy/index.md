# Organisation Hierarchy

How a ministry, state or department lays out the organisations under it —
districts under a state, offices under a department, divisions under a
ministry — as a tree that the rest of Karmayogi can use: to scope what an
admin can see, to route users and reports, and to show "where in government
does this office sit".

- **Live UIs**: MDO admin portal (`sunbird-cb-orgportal` — *Directory →
  Organisation hierarchy*, the `lib-tree-view` tree), the super-admin
  portal (`sunbird-cb-adminportal` — same tree inside *Create MDO*), and the
  learner portal's public sign-up (`sunbird-cb-portal` — the ministry /
  state / department / organisation pickers read the hierarchy)
- **Who uses it**: SPV admins and publishers, State admins, MDO admins and
  MDO leaders (the roles allowed to create a hierarchy)
- **Not covered here**: moving users between organisations in bulk — that
  rides on the hierarchy but is its own feature (`user/v1/org-migration/*`)
- **Status**: ✅ traced from source across 9 repos; see
  [As-Built Requirements](as-built-requirements.md) for the places where the
  three implementations in production disagree

## In one paragraph

Every root organisation (a ministry or a state) can own **one hierarchy**, up
to ten levels deep. An admin switches it on once from the hierarchy page
("Create hierarchy"), which gives the organisation an empty tree with ten
named levels. From then on the tree is filled in two ways: **one node at a
time** in the tree view (add a child, rename it, retire it, publish), or **all
at once** by downloading a spreadsheet template, filling one row per
leaf-path (`L1 → L2 → L3 …`, each cell written as `Name<orgId>`), and
uploading it. The upload runs in the background; the admin polls a progress
list, and when it finishes they can download the same spreadsheet back with a
`Status` and `Error` column filled in per row. Separately, every time a new
organisation is created on the platform it is dropped automatically into its
root organisation's hierarchy as a top-level node. And when a new Karmayogi
signs up, the ministry → department → organisation pickers they click through
are the same hierarchy, read from the platform's search index.

## How an admin experiences it

1. **Opens the hierarchy page** in the MDO portal directory. If their own
   organisation is a ministry or state it is the root; if it is a department
   under one, the page resolves the parent ministry/state and shows that
   root's tree.
2. **Creates the hierarchy** (first time only) — one click; a snackbar confirms
   "Framework created successfully for &lt;org&gt;". The root organisation now
   carries a hierarchy ID and a `COMPLETED` status, which the page checks before
   showing the tree.
3. **Works the tree** — the tree view shows the ten levels as columns; the
   admin adds a child under a node, edits names, retires a node, and
   publishes. Clicking a node jumps to that organisation's user list.
4. **Or bulk-loads it** — downloads the *sample template* (a reference sheet
   with the ten level headers plus a read-only *master data* sheet listing
   every organisation under the root with its ID, so names and IDs can be
   dropdown-picked rather than typed), fills it, and uploads.
5. **Watches progress** — the upload page lists every upload for the root
   organisation with `INITIATED → IN_PROGRESS → SUCCESSFUL | FAILED` and the
   counts of total / successful / failed rows.
6. **Downloads the result file** — the uploaded sheet comes back with
   `Status` and `Error` per row ("Parent organization is empty for 'X' at
   level 3", "Org 'Y' does not exist in the master data", "Circular reference
   detected", …), so the admin fixes only the rows that failed and re-uploads.
7. **Exports the current tree** — the *download* action produces the
   hierarchy as a spreadsheet, one column per level.

## Actors

| Actor | What they do here |
|---|---|
| SPV Admin / SPV Publisher | Create a hierarchy for any ministry or state; bulk-upload or edit any tree |
| State Admin | Create and maintain the hierarchy for their state |
| MDO Admin / MDO Leader | Maintain the tree of their own root organisation (or, for a department, their parent ministry/state's tree) |
| Platform (automatic) | Add every newly created organisation to its root's hierarchy as a top-level node |

## The one design decision that shapes everything

**A bulk upload does not edit the existing tree — it builds a fresh one and
swaps it in.** Each upload creates a brand-new hierarchy copy for the
organisation, loads the rows into it, publishes it, and if at least one row
succeeded, retires the previous hierarchy and points the organisation at the
new one. The tree an admin sees after an upload is therefore exactly what the
spreadsheet said, with nothing left over from before — and an upload where
every row failed leaves the old tree untouched.

Technical detail — the endpoints, the framework/term model underneath, the
Kafka consumers and the stores — lives in [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md); day-2 handling is in the [Operations Manual](operations-manual.md).
