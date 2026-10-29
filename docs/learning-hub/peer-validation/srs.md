# Peer Validation — Software Requirements Specification (SRS)

## 3. INTRODUCTION

### 3.1 PURPOSE

The purpose of the Peer Validation feature is to enable structured and credible validation of learner outcomes through feedback from relevant stakeholders such as reporting managers, peers, and subordinates. It aims to enhance the effectiveness of learning programs by incorporating real-world performance insights, improve accountability, and provide administrators with measurable validation data to assess the impact of training initiatives.

### 3.2 SCOPE

##### This feature applies to:

- SPV and MDO administrators configuring peer feedback surveys
- Learners who complete courses/programs and nominate peers
- External/internal peers who provide feedback

It includes:

- Creation and configuration of peer feedback surveys
- Automated triggering of surveys post course completion
- Secure sharing of survey links with nominated peers
- Submission and aggregation of feedback responses
- Monitoring and reporting capabilities for administrators

### 3.3 OVERVIEW

The Peer Validation feature introduces a feedback loop into the learning ecosystem. Once a learner completes a course, the system triggers a peer feedback survey configured by administrators. Learners nominate relevant individuals from their professional network, who then receive secure survey invitations.

Peers complete the survey via the platform, and the system aggregates responses to generate validation insights. Administrators can track participation, response rates, and overall validation outcomes through dashboards and reports. Notifications and reminders ensure timely completion, while telemetry helps track engagement and system performance.

### 3.3.1 SYSTEM PERSPECTIVE

#### The feature operates as an integrated component within the iGOT platform ecosystem, interacting with:

Admin Portals (SPV/MDO):

Used for survey configuration, management, and monitoring.

Learner Portal: Enables learners to nominate peers and allows peers to access and complete surveys.

Notification Service: Sends survey invitations, reminders, and status updates.

Survey Management Service: Handles survey creation, distribution, response collection, and deadline enforcement.

Reporting & Analytics Module: Aggregates feedback data and provides insights into response rates and validation metrics.

Security Layer: Ensures secure access to surveys via unique links or authentication mechanisms.

The system is designed to be modular, salable, and configurable to support multiple programs and varying survey structures.

### 3.3.2 LIMITATIONS

- Feedback quality depends on the honesty and engagement of nominated peers.
- Survey response rates may vary, affecting the completeness of validation data.
- Reliance on learner-nominated peers may introduce bias in feedback.
- Limited offline support; requires internet access for survey participation.
- Potential delays due to non-responsive peers despite reminders.
- Data privacy and consent considerations must be managed carefully.
- Customization may be constrained by predefined survey templates (if applicable).

## 4. USER TYPES & CHARACTERISTICS

The following user types are identified with respect to the iGoT Karmayogi process:

| **Role** | **Function** |
|---|---|
| SPV ADMIN | Creates Peer validation |
| MDO Leader, MDO Admin | Creates Peer validation |
| Public | Consumes Peer validation |

## 5. System Behavior

### 5.1 Q11 | Peer Validation | MDO Peer validation survey creation and listing

| **User story Link** | [KB-13016: Q11 \| Peer Validation \| MDO Peer validation survey creation and listing](https://karmayogibharat.atlassian.net/browse/KB-13016) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| MDO Peer validation survey creation and listing |
| **Primary Usage** | Enables MDO admins or MDO Leader to create and publish peer validation surveys by selecting a live course/program and optionally adding questions, then monitoring participation and outcomes. |
| **Actors** | MDO admins, MDO Leader |
| **Pre-Conditions** | Should have MDO admins, MDO Leader |
| **Dependencies** | No |
| **Trigger** | Will navigate to create peer validation on click of create new |
| **Basic behavior** | 1. User clicks **Create** → selects a **single live course/program** from allowed types<br>2. Search supports full dataset (not page-limited) with filters and sorting<br>3. Displays course details (thumbnail, name, provider, duration, published date)<br>4. User can optionally add questions and **publish survey**<br>5. Listing pages show surveys with pagination, status tabs (All/Active/Ended/Draft), and reporting options<br>6. Submission rate is auto-calculated and displayed |
| **Alternate behavior** | N/A |
| **Business Rule / Validations** | 1. Only **one course/program** can be linked per survey<br>2. Only **live courses/programs** are searchable and selectable<br>3. Allowed types strictly restricted to predefined categories<br>4. Search must work across entire dataset (not just visible page)<br>5. Pagination options fixed to **15 / 30 / 50 per page**<br>6. Submission Rate = *(submissions / views) × 100*<br>7. Status auto-derived (Active, Ended, Draft) based on dates<br>8. Filters (Status) applicable only in **All tab**<br>9. Clear message shown: *“Only live courses/programs will be searchable here.”*. |
| **Exceptions / Alerts** |  |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

### 5.2 Q11 | Peer Validation | SPV Peer validation survey creation and listing

| **User story Link** | [KB-13017: Q11 \| Peer Validation \| SPV Peer validation survey creation and listing](https://karmayogibharat.atlassian.net/browse/KB-13017) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| SPV Peer validation survey creation and listing |
| **Primary Usage** | Allows SPV admins to create and publish peer validation surveys by selecting a live course/program, optionally adding questions, and tracking survey performance across organizations. |
| **Actors** | SPV Admin |
| **Pre-Conditions** | Should have SPV admin role |
| **Dependencies** | No |
| **Trigger** | On click of Learning Structure. |
| **Basic behavior** | 1. User clicks **Create** → searches and selects **one live course/program**<br>2. Search works across full dataset with filters (Status, Date, Organization) and sorting<br>3. Displays key details (thumbnail, name, provider, duration, published date)<br>4. User can add optional questions → **Publish survey**<br>5. Listing view shows surveys with pagination, tabs (All/Active/Ended/Draft), and archive/report options<br>6. Submission rate is auto-calculated and displayed |
| **Alternate behavior** | N/A |
| **Business Rule / Validations** | 1. Only **one course/program per survey**<br>2. Only **live content** is searchable/selectable<br>3. Allowed content types restricted to predefined list<br>4. Mandatory message: *“Only the Content which are live on the platform are available here.”*<br>5. Search must cover **entire dataset**, not just current page<br>6. Pagination fixed: **15 / 30 / 50 per page**<br>7. Status filter only in **All tab**; counts update dynamically<br>8. Submission Rate = *(submissions / views) × 100*<br>9. Status auto-derived (Active/Ended/Draft) based on dates<br>10. Organization filter applicable (SPV-specific requirement) |
| **Exceptions / Alerts** |  |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

### 5.3 Q11 | Peer Validation | Learner portal Peer Validation survey Notification and Pop-up message

| **User story Link** | [KB-13018: Q11 \| Peer Validation \| Learner portal Peer Validation survey Notification and Pop-up message](https://karmayogibharat.atlassian.net/browse/KB-13018) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| Learner portal Peer Validation survey Notification and Pop-up message |
| **Primary Usage** | Prompts learners to take a peer validation survey after completing a course/program and gathers confirmation on application of learnings. |
| **Actors** | Public |
| **Pre-Conditions** | Should have Public login |
| **Dependencies** | No |
| **Trigger** | On click of Bell icon in learner portal |
| **Basic behavior** | 1. Triggered after configured days post course completion<br>2. Learner receives **notification + pop-up**<br>3. Pop-up asks about applying learnings with options: **YES** → Opens survey form **NO** → Closes and marks as responded **Cross (X)** → Closes but keeps survey pending<br>4. Notification acts as entry point to access survey<br>5. System handles cases like survey ended or already submitted |
| **Alternate behavior** | N/A |
| **Business Rule / Validations** | 1. Trigger only for **completed courses/programs** (assessment passed or content consumed)<br>2. Pop-up shown only if survey is **active**<br>3. If survey ended → show *“Survey has ended”*<br>4. If already submitted → show *“You have already completed the survey”*<br>5. If user clicked **NO earlier** → show *“You have already submitted the response”*<br>6. **NO action** removes survey from pending list<br>7. **Cross (X)** keeps survey in pending state<br>8. Notifications must reflect correct survey state and not allow duplicate submissions |
| **Exceptions / Alerts** | N/A |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

### 5.4 Q11 | Peer Validation | Learner Portal pending surveys dashboard

| **User story Link** | [KB-13020: Q11 \| Peer Validation \| Learner Portal pending surveys dashboard](https://karmayogibharat.atlassian.net/browse/KB-13020) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| Learner Portal pending surveys dashboard |
| **Primary Usage** | Provides learners a centralized dashboard to manage their **pending surveys** and **incoming peer validation requests**. |
| **Actors** | Public |
| **Pre-Conditions** | Should have Public login |
| **Dependencies** | No |
| **Trigger** | On click of Access Setting |
| **Basic behavior** | 1. Dashboard has two sections: **Pending Surveys** → surveys to be completed by learner **Incoming Validation Requests** → requests received from peers/subordinates<br>2. Users can view, start, and complete actions from respective sections<br>3. Status updates dynamically based on user actions (completed, expired, etc.) |
| **Alternate behavior** | N/A |
| **Business Rule / Validations** | 1. Only **active and relevant** items should be displayed<br>2. Completed/expired surveys should not appear in pending list<br>3. Each item should be actionable (start/respond) only if valid<br>4. No duplicate entries across sections<br>5. Data must reflect real-time survey status and submission state |
| **Exceptions / Alerts** | N/A |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

### 5.5 Q11 | Peer Validation | Learner Portal | Survey

| **User story Link** | [KB-13023: Q11 \| Peer Validation \| Learner Portal \| Survey](https://karmayogibharat.atlassian.net/browse/KB-13023) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| Learner Portal \| Survey |
| **Primary Usage** | Allows learners to submit peer validation surveys, nominate endorsers (peers/reporting officers/subordinates), and upload supporting evidence for validation. |
| **Actors** | Public |
| **Pre-Conditions** | Should have Public role |
| **Dependencies** | No |
| **Trigger** | On click of Learing Pathway in left menu |
| **Basic behavior** | 1. Learner fills survey and **adds endorsers** from platform users<br>2. Search prioritizes users from **same organization**, then exact name match<br>3. Learner can upload **one document + one video** as evidence<br>4. Endorsers receive requests and can review/respond<br>5. Reporting Officer can **forward to Superior** for additional endorsement<br>6. Superior can view responses, evidence, and prior approvals |
| **Alternate behavior** | N/A |
| **Business Rule / Validations** | • No hierarchy restriction → **any platform user can be added**<br>• User search shows: **profile image, name, organization, designation**<br>• Search logic: **same org first → exact match next**<br>• File limits: Video: **max 200** **MB, mp4 only** Document: **max 2 MB, pdf only**<br>• Only **one video + one document** allowed<br>• Supporting evidence must be viewable by all endorsers<br>• Forwarding allowed only for **Reporting Officer role**<br>• No duplicate or invalid user selections allowed |
| **Exceptions / Alerts** | N/A |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

### 5.6 Q11 | Peer Validation | Mobile - Learner Portal | Survey

| **User story Link** | [KB-12114: Q10 \| Learning Pathways \| Landing Page for the Learners](https://karmayogibharat.atlassian.net/browse/KB-12114) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| Mobile - Learner Portal \| Survey |
| **Primary Usage** | Enables learners to submit surveys, nominate endorsers, and provide supporting evidence for validation of their learning outcomes. |
| **Actors** | Public |
| **Pre-Conditions** | Should have Public role |
| **Dependencies** | No |
| **Trigger** |  |
| **Basic behaviour** | 1. Learner completes survey and **adds users** (peer/reporting officer/subordinate)<br>2. User search shows **profile image, name, organization, designation**<br>3. Search prioritizes **same organization**, then exact match<br>4. Learner can upload **one video + one document** as evidence<br>5. Selected users receive validation requests and can review submissions |
| **Alternate behaviour** | N/A |
| **Business Rule / Validations** | 1. **Any platform user** can be added (no hierarchy restriction)<br>2. Search logic: **same org first → exact string match**<br>3. File constraints: Video: **≤ 200 MB, mp4 only** Document: **≤ 2 MB, pdf only**<br>4. Only **1 video + 1 document** allowed<br>5. Mandatory validation on file size and format<br>6. No duplicate or invalid user selection allowed |
| **Exceptions / Alerts** | N/A |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

### 5.7 Q11 | Peer Validation | Mobile - Learner Portal | Pending surveys dashboard

| **User story Link** | [KB-13498: Q11 \| Peer Validation \| Mobile - Learner Portal \| Pending surveys dashboard](https://karmayogibharat.atlassian.net/browse/KB-13498) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| Mobile - Learner Portal \| Pending surveys dashboard |
| **Primary Usage** | Enables learners to view and act on **pending surveys** and **incoming validation requests** with clear status, deadlines, and actions. |
| **Actors** | Learner / Public |
| **Pre-Conditions** | Should have Public role |
| **Dependencies** | No |
| **Trigger** |  |
| **Basic behavior** | • Two sections: **Pending Surveys** and **Incoming Requests**<br>• List view with pagination (**15 / 30 / 50**) and total pages<br>• Search across **entire dataset** (by course/program name)<br>• Filters: **Status, Date range**<br>• Default sort: **End Date (ascending)**<br>• Actions: Pending → **Start Survey (Active)** / Disabled (Ended) Incoming → **Start Review (Active)** / Disabled (Ended)<br>• Displays key fields (thumbnail, name, status, end date, requester for incoming) |
| **Alternate behavior** | N/A |
| **Business Rule / Validations** | 1. CTA enabled only if **status = Active** and within end date<br>2. After **end date**, survey/review becomes non-actionable<br>3. Status strictly derived: **Active / Ended**<br>4. Search must not be limited to current page<br>5. Pagination fixed: **15 / 30 / 50 per page**<br>6. Default sorting always by **End Date (ascending)**<br>7. No duplicate entries; items must appear in correct section only<br>8. Real-time reflection of survey state and user action status |
| **Exceptions / Alerts** | N/A |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

### 5.8 Q11 | Peer Validation | Mobile - Learner portal | Peer Validation survey Notification and Pop-up message

| **User story Link** | [KB-13499: Q11 \| Peer Validation \| Mobile - Learner portal \| Peer Validation survey Notification and Pop-up message](https://karmayogibharat.atlassian.net/browse/KB-13499) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| Mobile - Learner portal \| Peer Validation survey Notification and Pop-up message |
| **Primary Usage** | Prompts learners to take peer validation surveys after course completion and captures their response on applying learnings. |
| **Actors** | Learner / Public |
| **Pre-Conditions** | Should have Public role |
| **Dependencies** | No |
| **Trigger** |  |
| **Basic behaviour** | 1. Triggered after **configured days post completion**<br>2. Learner receives **notification + pop-up**<br>3. Pop-up options: **YES** → Opens survey form **NO** → Closes and marks as responded **Cross (X)** → Closes, keeps survey pending<br>4. Notification acts as entry point to reopen survey (if valid)<br>5. System handles ended/already responded scenarios with messages |
| **Alternate behaviour** | N/A |
| **Business Rule / Validations** | 1. Trigger only for **completed courses/programs**<br>2. Pop-up shown only if **survey is active**<br>3. If survey ended → show *“Survey has ended”*<br>4. If already submitted → show *“You have already completed the survey”*<br>5. If user selected **NO earlier** → show *“You have already submitted the response”*<br>6. **NO** removes survey from pending list<br>7. **Cross (X)** keeps survey pending<br>8. No duplicate submissions allowed<br>9. Notifications must reflect **current survey state** |
| **Exceptions / Alerts** | N/A |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

### 5.9 Q11 | Peer Validation | Notification Pipeline | Survey

| **User story Link** | [KB-13508: Q11 \| Peer Validation \| Notification Pipeline \| Survey](https://karmayogibharat.atlassian.net/browse/KB-13508) (Prod Deployed) |
|---|---|
| **Epic name** | Q11 \| Peer Validation |
| **Use story Title** | Q11 \| Peer Validation \| Notification Pipeline \| Survey |
| **Primary Usage** | N/A |
| **Actors** | Learner / Public |
| **Pre-Conditions** | Should have Public role |
| **Dependencies** | No |
| **Trigger** |  |
| **Basic behavior** | N/A |
| **Alternate behavior** | N/A |
| **Business Rule / Validations** | N/A |
| **Exceptions / Alerts** | N/A |
| **Post Conditions** | N/A |
| **Frequency of Use** | 90% |
| **External linkages** | N/A |
| **API Reference** | [Peer Validation Survey – View Count & Submission Rate Design](https://karmayogibharat.atlassian.net/wiki/x/AoDJM) |
| **Issues** | N/A |

## 6. References

| **Document Name** | **Document Version Number** | **Release date** |
|---|---|---|
| RFP Document | V1.1 | 04-October-2025 |
| BRD Document | V1.1 | 04-October-2025 |
| FRS Document | V1.1 | 04-October-2025 |

## 7. Specific Requirements

### 7.1 EXTERNAL INTERFACES

There are no external interfaces.

### 7.2 SYSTEM INTERFACE

Nginx will be used as a web server. The user inputs data via the web server using HTML forms. The actual program that will perform the operations is written in Java/J2EE 1.8

### 7.2.1 USER INTERFACE

The user interface shall be implemented using software packages like Java applet, MS Frontpage, Enterprise Java beans, etc on the following languages

| **Language** | **Description** |
|---|---|
| Angular | Angular is a TypeScript-based free and open-source single-page web application framework run on Node.js. |
| JavaScript | JavaScript is a light weight, object oriented, cross platform scripting language, will mainly be used within the webpages |
| HTML5 | HTML5 is the fifth revision of the HTML standard. |
| CSS | Cascading style sheets define style rules in a separate CSS file |

**7.2.1 USER INTERFACE** | **MOBILE**

| **Language** | **Description** |
|---|---|
| Dart | Dart is a general-purpose programming language that can be used for a wide range of applications, including web development, server-side programming, and mobile app development. Flutter, on the other hand, is a UI SDK specifically designed for building high-performance, cross-platform mobile apps. |

### 7.2.2 SOFTWARE INTERFACE

Server-side: An Apache web server will accept all requests from the client and forward it accordingly. A database will be hosted centrally using PostgreS and Teradata.

Client-side: A Windows/Linux OS which is capable of running a modern web browser that supports JavaScript and HTML5 will be used

Client-side-Mobile: An Android/iOS device

### 7.2.3 COMMUNICATION INTERFACES

The system shall use the HTTPS protocol(s) and TCP/IP protocol suite for communication over the intranet. The user must have an SSL certificate licensing registered web browser.

### 7.2.4 OPERATIONS

Recommended browsers for the system are Chrome, Firefox, and Internet Explorer 8 or higher.

| **Mozilla Version** | **Chrome Version** | **IE** **Version** |
|---|---|---|
| Version 122+ | Version 118+ | Version 11 |

| **Android Version** | **iOS Version** |
|---|---|
| Version 13 & below | Version 17 & below |

The system shall have operations to protect the database from being corrupted or accidentally altered during a system failure.

## 8. Non-Functional Requirements

### 8.1 USABILITY REQUIREMENTS

The user interface of Karmayogi Bharat shall provide a very intuitive and simple interface to the user so that the user can easily navigate through pages.

### 8.2 PERFORMANCE REQUIREMENTS

Response Time: Average response time shall be less than 3-5 seconds (Note: No SLA is defined in the RFP. However as per industry standard every page’s average response time should be between of 3 to 5 seconds)

Capacity: The system will be able to accommodate 25000 concurrent users in Production env.

| **Applications** | **Business Transaction** | **User Distribution** <br>**(%age of peak load)** | **Total Users Expected in Production env.** |
|---|---|---|---|
| Portal | Login, Registration, User Profile Views, Course consumption | 80% | 25000 |
| Help, Resources, Feedback | 20% |  |  |
| Mobile | Registration | 90% of total application features | 25000 |

### 8.3 SECURITY

The application will store data that are critical concerning security. Adequate safety measures are to be incorporated during the development stage to prevent vulnerabilities and build a secure code for these services.

The following security considerations are to be made:

**User Level Security: -**

Restricted areas of the application shall be accessible through pre-defined user access rights.

**Database Level Security:**

Database security should provide different layers of database users with overall control of the database security administrator, only authorized database administration users with assigned privileges shall be allowed to access the database. A separate audit trail should be maintained for any direct modification, deletion, and addition in Postgres and Teradata database in database structure or records. Users, even the database administrator should not be allowed to tamper with the audit log.

**Network Level Security:**

Network traffic shall be encrypted using SSL & secured connectivity between the ITD office and the data center where the application will be hosted.

**Infrastructure Level Security:**

Application infrastructure shall be hosted in a DMZ & firewall and IPS shall be installed to detect malicious activities.

The portal should also be tested against the[OWASP 2017 top 10 list](https://www.owasp.org/index.php/Category:OWASP_Top_Ten_Project)of security vulnerabilities.

<Refer to the security guidelines document >

### 8.4 MAINTAINABILITY

Maintainability is defined as the ease with which the software system and components can be modified to correct faults and improve performance or other attributes. It is envisaged that KB shall have a high degree of maintainability. RTO shall be 8 hours for business-critical systems and 48 hours for other systems

### 8.5 SCALABILITY

Scalability is the capability of the system and the underlying components to handle a growing amount of work, or its potential to be enlarged to accommodate that growth. It will be able to accommodate 25000 concurrent users in the Production environment.

| **Applications** | **Business Transaction** | **User Distribution** <br>**(%age of peak load)** | **Total Users Expected in Production env.** |
|---|---|---|---|
| Portal | Login, Registration, User Profile Views, Course consumption | 80% | 25000 |
| Help, Resources, Feedback | 20% |  |  |
| Mobile | Registration | 90% of total application features | 25000 |

### 8.6 PORTABILITY MOBILE

#### MOBILE

Upon the introduction of the Designation based recommendation, the system portability remains constant

| **Android Version** | **iOS Version** |
|---|---|
| Version 13 & below | Version 17 & below |

#### WEB:

Upon the introduction of the Designation based recommendation, the system portability remains constant, The application and introduced feature are Windows/Linux-based and should be compatible with other systems. Apache, Java/Scala/J2EE and Postgres and programs are practically independent of the OS-system which they communicate with. The end-user part is fully portable and any system using any web browser should be able to use the features of the application.

| **Mozilla Version** | **Chrome Version** | **IE Version** |
|---|---|---|
| Version 122+ | Version 118+ | Version 11 |
