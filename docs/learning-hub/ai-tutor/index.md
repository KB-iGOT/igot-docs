# AI Tutor

iGOT’s AI Tutor on the Learner Portal.

The initiative introduces an RAG-based, agentic conversational assistant capable of answering course-specific queries, directing users to exact video segments and reference materials, tailoring answers to specific pedagogical styles (such as Storytelling), while strictly respecting content authorization and gathering structured user feedback.

## Core Functional Pillars

### 1. Core AI Tutor

- **Location:** Accessible from the Course Table of Contents (TOC), Resources, and Player pages.
- **Enrollment Gating:** The chatbot is only enabled for enrolled learners; un-enrolled learners are prompted to enroll directly within the bot interface before conversation begins.
- **RAG Retrieval:** Searches vectorized CC BY 4.0 content (Courses & Programs), using NLP over titles, summaries, descriptions, meta tags, competencies, and video transcriptions.
- **Deep Linking:** Generates responses linking directly to specific content IDs and segmented video timestamps.
- **Guardrails:** Disabled during assessments; gracefully deflects non-learning/unrelated queries.

### 2. Personalized Learning Styles

- **Style choice:** Allows learners to explicitly select Storytelling as their learning style (alongside Socratic mode).
- **Narrative tailoring:** The AI Tutor tailors its explanations, examples, and tone to convey course concepts narratively.

### 3. Security & Access Governance

- **Query-time checks:** Dynamically evaluates user permissions, roles, and course enrollments at query time.
- **No leakage:** Ensures restricted or role-specific content is never surfaced in AI responses to unauthorized users across both AI Global Search and the AI Tutor.

### 4. Quality Evaluation & Feedback Loops

- **Feedback system:** Integrates Thumbs Up / Thumbs Down feedback across search and tutor responses (RLHF / telemetry).
- **Thumbs Down:** Mandatory comments to capture why the answer was unhelpful or inaccurate.
- **Thumbs Up:** Comments optional.

