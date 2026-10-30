# 4. Invite-Only Course / Batch

Restricted, entitlement-gated learning cohorts and standalone assessments created for nominated civil servants from specific Ministries, Departments, or Organizations (MDOs), hidden from open discovery.

- **UC-4.1 · Create Gated Course / Assessment**
  - **Actor:** Content Creator / SPV Publisher
  - **Flow:** Author configures the resource in CBP, toggling Access Settings to **"Custom Users"**. Content metadata is tagged as `courseCategory: "Invite-Only Program"` or `"Invite-Only Assessment"`. For assessments, negative marking and duration are defined. Upon publish, the Flink post-publish processor detects the category and **suppresses** automated open-batch creation.

- **UC-4.2 · Create Closed Batch & Define Schedule**
  - **Actor:** Program Coordinator / MDO Administrator
  - **Flow:** Coordinator opens the batch scheduling console, selects the published content, sets `enrollmentType: "invite-only"`, and defines the operational active window (`startDate`, `endDate`, and `enrollmentEndDate`).

- **UC-4.3 · Whitelist & Invite Candidate Cohort**
  - **Actor:** Program Coordinator
  - **Flow:** Coordinator uploads a candidate cohort via CSV or directory selection. The backend deduplicates user UUIDs and appends them to Cassandra table `sunbird_courses.course_batch` under `participantlist`. Notification services send email and in-app alerts to invited learners.

- **UC-4.4 · Discover via Personalized Feed**
  - **Actor:** Invited Learner vs. Uninvited Learner
  - **Flow:**
    - *Invited Learner:* Resource is hidden from the public catalog but dynamically populates the learner's personal dashboard feed (`/cbplan/v2/user/list`).
    - *Uninvited Learner:* Resource is completely suppressed from public search indexes; catalog keyword searches return no results.

- **UC-4.5 · Gate Direct Link Access**
  - **Actor:** Uninvited Learner / Client Route Guard
  - **Flow:** If an uninvited user attempts access via a shared direct URL (`/app/toc/{do_id}/overview`), the Angular route guard (`InviteOnlyGuard`) calls `/batch/read`. The LMS detects the caller is not in `participantlist`, returns HTTP `403 Forbidden`, and halts navigation, displaying the non-dismissible modal: *"Access Restricted: You are not invited to this course."*

- **UC-4.6 · Enrol in Invite-Only Cohort**
  - **Actor:** Invited Learner
  - **Flow:** Whitelisted learner clicks **"Start"** or **"Join Batch"**. System verifies that `userId` is present in `participantlist` and the enrollment window is open, committing the enrollment record to Cassandra `user_enrolments`.

- **UC-4.7 · Take Single-Sitting Proctored Assessment**
  - **Actor:** Invited Learner (Examinee)
  - **Flow:** Learner acknowledges the test rules modal. The assessment engine starts a single-sitting session in PostgreSQL and applies a 3X seed-based Fisher-Yates shuffle to randomize questions and options. Pausing is prohibited. Upon submission or timer expiration, the engine calculates the net score applying negative marking deductions:

- **UC-4.8 · Monitor Cohort Compliance & Audit Reports**
  - **Actor:** Program Coordinator / MDO Admin
  - **Flow:** Coordinator monitors the cohort dashboard to track invitation-to-enrollment conversion rate, attendance, pass/fail ratios, and score distribution, and exports isolated departmental compliance reports.

### Comparative Summary Matrix

| Lifecycle Stage | Course (General) | Multilingual Course | Moderated Course | Invite-Only Course / Batch |
|---|---|---|---|---|
| **Creation & Ingestion** | Open metadata; auto-batch enabled via Flink | Localized units/transcripts linked to language group | Rubrics, reviewer roles, and milestone criteria configured | "Custom Users" selected; Flink auto-batch suppressed |
| **Discovery** | Public search & catalog recommendation | Filtered or boosted by learner's preferred language | Discoverable in catalog with "Application Required" tag | Excluded from public search; surfaced only in invited feed |
| **Access & Enrollment** | Immediate self-enrollment | Immediate self-enrollment with language selection | Pre-approval required or open with gated milestones | Restricted to whitelisted UUIDs in `participantlist` |
| **Consumption & Runner** | Standard self-paced media streaming | Dynamic audio/subtitle switching inside player | Subjective project uploads & artifact attachments | Single-sitting timed exam; 3X shuffle; negative marking |
| **Evaluation Gate** | Objective automated quizzes | Localized objective quizzes | Manual grading by assigned assessor/moderator | Automated scoring with negative penalty calculation |
| **Direct Link Security** | Open to all authenticated users | Open to all authenticated users | Prompts user to apply if not approved | Route guard blocks uninvited users with HTTP 403 modal |
