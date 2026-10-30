# 2. Multilingual Course

Courses translated or adapted across multiple Indian scheduled languages to support linguistic inclusivity, sharing common pedagogical goals while presenting localized media, transcripts, and metadata.

- **UC-2.1 · Create Multilingual Course Structure**
  - **Actor:** Content Creator / Translation Lead
  - **Flow:** Author creates a base language course (e.g., English or Hindi) in CBP and configures language variants or localized child units. Transcripts, subtitles (VTT/SRT), localized metadata (title, summary, competencies), and translated assessments are linked to their corresponding language codes (e.g., `hi`, `ta`, `te`, `bn`).

- **UC-2.2 · Associate Language Equivalents**
  - **Actor:** Content Creator / Taxonomy Admin
  - **Flow:** The author or publisher links distinct language manifestations of the same core syllabus using parent-sibling equivalence tags or language group relationships in the Neo4j Knowledge Graph, ensuring cross-language tracking and deduplicated competency credits.

- **UC-2.3 · Discover in Preferred Language**
  - **Actor:** Learner
  - **Flow:** Learner sets their preferred interface or learning language. The search service boosts and filters courses available in that language, or renders a **"Available in X languages"** tag on the course discovery card.

- **UC-2.4 · Switch Course Language**
  - **Actor:** Enrolled Learner
  - **Flow:** While viewing the Course TOC or inside the content player, the learner toggles the language dropdown selector. The player switches audio tracks, subtitle overlays, or redirects to the corresponding localized module without resetting the learner's overall course enrollment identifier.

- **UC-2.5 · Take Localized Assessment**
  - **Actor:** Learner
  - **Flow:** The assessment runner loads question items and multiple-choice options in the selected target language. Responses are evaluated against the universal scoring rubric and logged against the learner's uniform attempt history.

- **UC-2.6 · Complete & Generate Multilingual Certificate**
  - **Actor:** Learner / Certificate Service
  - **Flow:** Upon course completion, the certificate generator issues a certificate rendered with bilingual or native-language typography (e.g., English and Hindi/regional script), preserving official name formatting and MDO designations.

### Comparative Summary Matrix

| Lifecycle Stage | Course (General) | Multilingual Course | Moderated Course | Invite-Only Course / Batch |
|---|---|---|---|---|
| **Creation & Ingestion** | Open metadata; auto-batch enabled via Flink | Localized units/transcripts linked to language group | Rubrics, reviewer roles, and milestone criteria configured | "Custom Users" selected; Flink auto-batch suppressed |
| **Discovery** | Public search & catalog recommendation | Filtered or boosted by learner's preferred language | Discoverable in catalog with "Application Required" tag | Excluded from public search; surfaced only in invited feed |
| **Access & Enrollment** | Immediate self-enrollment | Immediate self-enrollment with language selection | Pre-approval required or open with gated milestones | Restricted to whitelisted UUIDs in `participantlist` |
| **Consumption & Runner** | Standard self-paced media streaming | Dynamic audio/subtitle switching inside player | Subjective project uploads & artifact attachments | Single-sitting timed exam; 3X shuffle; negative marking |
| **Evaluation Gate** | Objective automated quizzes | Localized objective quizzes | Manual grading by assigned assessor/moderator | Automated scoring with negative penalty calculation |
| **Direct Link Security** | Open to all authenticated users | Open to all authenticated users | Prompts user to apply if not approved | Route guard blocks uninvited users with HTTP 403 modal |
