# Bharat Kalp

A week-by-week learning program with its own home inside the platform —
a program hero, a community carousel, and a searchable library of that
week's content.

- **Route**: `app/learn/bharat-kalp` (landing) and
  `app/learn/bharat-kalp/see-all` (content browser)
- **Who it's for**: members flagged into the program — it doesn't appear for
  anyone else
- **Status**: ⚠️ no backend of its own — composes existing platform services

## In one paragraph

Bharat Kalp only shows up for people invited into the program. From the
program's own landing page a member sees their progress alongside a
carousel of communities they can join; from "see all" they can search and
filter that week's courses, programs, events and resources, and jump
straight into whichever piece of content they pick, picking up their
enrolment status where they left off.

## How a Karmayogi experiences it

1. **Finds it waiting for them** — a card on the home page, or a
   notification pointing at it. Someone not in the program sees neither.
2. **Lands on the program's own page**: their progress at the top, a
   carousel of communities they can join underneath.
3. **Joins a community**, which drops them straight into its discussion.
4. **Opens "see all"** — the week's library. They can search it, switch
   weeks, and move between courses, programs, events and resources; only the
   kinds of content that week actually has are offered.
5. **Narrows it down** to what they've finished, started, or not begun yet —
   every card showing how far along they are.
6. **Picks something and starts**, opening it where that content normally
   lives, with their progress carried over.

## Actors

| Actor | Role |
|---|---|
| Bharat Kalp member | Sees the entry points, browses the landing page and content library, joins communities, opens content |
| Non-member | Never sees the entry points; a direct link redirects them away |
| Portal admin / CMS author | Authors the `bkConfig` / `sectionList` / `weekProgress` JSON via the Form Service backend — out of scope of this repo |
| Backend services | Form service, search service, enrolment service, and the external content-partner (CIOS) service the feature composes |

## The one decision that defines the feature

> Whether you can see Bharat Kalp at all comes from one flag on your
> profile — there's no separate on/off switch for the feature itself.

See [Use Cases](use-cases.md), [APIs](apis.md), [HLD](hld.md) and
[LLD](lld.md) for the full picture, the
[Operations Manual](operations-manual.md) for running it day to day, and
[As-Built Requirements](as-built-requirements.md) for what actually shipped.
