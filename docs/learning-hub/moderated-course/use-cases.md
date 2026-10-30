# 3. Moderated Course

Specialized or competency-critical courses where enrollment, progression, or completion requires review and approval by an authorized Assessor, Mentor, or Departmental Moderator.

- **UC-3.1 · Create Moderated Course & Define Rubrics**
  - **Actor:** Content Creator / Training Coordinator
  - **Flow:** Creator sets `courseCategory: "Moderated Course"` in CBP. Creator defines evaluation rubrics, assigns designated Assessor/Moderator roles, and configures whether moderation occurs at **Enrollment Request**, **Assignment/Project Submission**, or **Final Completion**.

- **UC-3.2 · Request Enrollment (For Pre-Gated Moderated Courses)**
  - **Actor:** Learner
  - **Flow:** Learner discovers the course but cannot immediately self-enroll. Learner clicks **"Request to Enrol"**, providing justification, departmental affiliation, or prerequisite attachments. The enrollment status enters `PENDING_APPROVAL`.

- **UC-3.3 · Review & Approve Enrollment**
  - **Actor:** Course Moderator / MDO Manager
  - **Flow:** Moderator accesses the **Moderation Worklist** portal, inspects the learner's profile and justification, and either approves or rejects the application with comments. An approval updates the enrollment status in Cassandra to `active: true`, triggering an alert to the learner.

- **UC-3.4 · Submit Subjective Assignment / Artifact**
  - **Actor:** Enrolled Learner
  - **Flow:** Learner completes course modules and reaches a subjective submission milestone (e.g., project report, essay, policy draft). The learner uploads the file or text response. System changes submission status to `SUBMITTED_FOR_REVIEW`.

- **UC-3.5 · Review & Grade Submission**
  - **Actor:** Assessor / Moderator
  - **Flow:** Moderator inspects the submitted artifact in the assessment review interface, grades it against predefined scoring rubrics, provides qualitative feedback, and submits an assessment verdict (**Pass**, **Needs Revision**, or **Fail**).

- **UC-3.6 · Resubmit Artifact (Alternative Flow)**
  - **Actor:** Learner
  - **Flow:** If marked **Needs Revision**, the learner receives notification with feedback, edits the assignment, and resubmits the file within the permitted revision window.

- **UC-3.7 · Issue Moderated Endorsement & Completion**
  - **Actor:** Moderator / LMS Engine
  - **Flow:** Once the moderator signs off on all mandatory subjective milestones, the LMS marks the course completed and triggers issuance of a verified, moderator-endorsed completion credential.

### Comparative Summary Matrix

| Lifecycle Stage | Course (General) | Multilingual Course | Moderated Course | Invite-Only Course / Batch |
|---|---|---|---|---|
| **Creation & Ingestion** | Open metadata; auto-batch enabled via Flink | Localized units/transcripts linked to language group | Rubrics, reviewer roles, and milestone criteria configured | "Custom Users" selected; Flink auto-batch suppressed |
| **Discovery** | Public search & catalog recommendation | Filtered or boosted by learner's preferred language | Discoverable in catalog with "Application Required" tag | Excluded from public search; surfaced only in invited feed |
| **Access & Enrollment** | Immediate self-enrollment | Immediate self-enrollment with language selection | Pre-approval required or open with gated milestones | Restricted to whitelisted UUIDs in `participantlist` |
| **Consumption & Runner** | Standard self-paced media streaming | Dynamic audio/subtitle switching inside player | Subjective project uploads & artifact attachments | Single-sitting timed exam; 3X shuffle; negative marking |
| **Evaluation Gate** | Objective automated quizzes | Localized objective quizzes | Manual grading by assigned assessor/moderator | Automated scoring with negative penalty calculation |
| **Direct Link Security** | Open to all authenticated users | Open to all authenticated users | Prompts user to apply if not approved | Route guard blocks uninvited users with HTTP 403 modal |
