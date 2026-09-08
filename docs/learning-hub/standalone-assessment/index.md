# Standalone Assessment

An assessment taken as its own learning object — question sets served
securely, auto-saved attempts, versioned submission and result APIs, retakes.

- **Category**: `primaryCategory = "Standalone Assessment"`
- **Player**: `sb-cb-ui-assessment` library

Questions are fetched separately from the assessment shell (answers are never
shipped with the paper), attempts auto-save, and submission/results run
through **versioned endpoints currently at v5**. The same machinery powers
assessments embedded inside courses and pre-enrolment assessments.
