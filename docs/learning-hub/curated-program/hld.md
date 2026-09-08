# Curated Program — High-Level Design

Same topology as Course — portal → gateway → LMS — with one added hop: the
**curated/open-program enrol endpoints** encapsulate batch resolution
server-side, so the client never lists or picks batches. The roll-up is a
**client-side merge** in the TOC service, not a server aggregate: the portal
fetches the full enrolment list once and derives the parent percentage.
