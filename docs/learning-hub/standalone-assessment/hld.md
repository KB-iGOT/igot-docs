# Standalone Assessment — High-Level Design

Portal assessment player (`sb-cb-ui-assessment`) → gateway → **assessment
service** for shell/questions/save/submit/result, with progress written back
through the standard real-time progress API so a passed standalone assessment
shows as completed learning. Authoring flows through the question-set APIs of
the knowledge platform.

> **Verification boundary:** the assessment service itself is not in the
> attached repo set — contracts documented from the client.
