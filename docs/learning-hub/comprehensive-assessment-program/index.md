# Comprehensive Assessment Program

A program-level assessment category, typically assigned/mandated, that reuses
the assessment engine end to end.

- **Category**: `primaryCategory = "Comprehensive Assessment Program"`

CAP appears in the attached repos as a distinct `ECourseCategory` with three
verified behaviours: it is the **default deep-link target of the
mandatory-notification modal**, its cards are **exempt from end-date display**
in the consumption strips, and it has its own section handling in the
home-page content strips. Its consumption mechanics are those of the
assessment engine documented under
[Standalone Assessment](../standalone-assessment/index.md).

> **Honest gap:** no CAP-specific enrolment or evaluation endpoint appears in
> the attached repos — the category rides shared assessment and course rails.
> If a dedicated CAP backend exists (e.g. in the assessment service),
> attaching that repo would let these pages say more. Treat this section as a
> stub-plus, not finished documentation.
