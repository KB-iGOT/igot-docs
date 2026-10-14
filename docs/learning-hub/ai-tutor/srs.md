# AI Tutor — Software Requirements Specification (SRS)

**AI Tutor Integration with the iGOT Learner Portal**

Version 1.0 | Draft for review | 14 October 2026

*Status: Proposed requirements. Endpoint names, platform capabilities, identity flows and player extension points must be verified against the deployed iGOT/Sunbird environment.*

## Document Control

| Field | Value |
|---|---|
| Document title | Software Requirements Specification — AI Tutor Integration |
| Version | 1.0 (Draft for review) |
| Date | 14 October 2026 |
| Status | Proposed / pending stakeholder and repository validation |
| Product | AI Tutor embedded in the iGOT Learner Portal |
| Intended audience | Product owner, engineering, QA, security, platform/integration teams |

### Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 14 Oct 2026 | Initial draft based on the agreed learner journey and context/LLD flows. |

## Contents

- 1. Introduction
- 2. Overall Description
- 3. User Classes and Operating Environment
- 4. Scope and Assumptions
- 5. Functional Requirements
- 6. External Interface Requirements
- 7. Data Requirements
- 8. Non-Functional Requirements
- 9. Business Rules and Decision Flows
- 10. Acceptance Criteria
- 11. Test Scenarios
- 12. Risks and Dependencies
- 13. Traceability Matrix
- 14. Open Questions
- Appendix A — Illustrative Message Contracts

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines the proposed functional, interface, data, security, operational and acceptance requirements for integrating an AI Tutor into the iGOT Learner Portal. It is intended to align product, engineering, QA, security and platform teams before detailed design and implementation.

### 1.2 Product Vision

Provide eligible learners with an interactive AI Tutor from course discovery and course pages, then enable real-time tutoring in the course player. Learners can choose a learning style—Socratic, Storytelling or None—and exchange messages over a WebSocket connection authenticated by a JWT validated on the backend.

### 1.3 Intended Use

The SRS describes target behavior. It does not claim that illustrative APIs or proposed services already exist in the repository. Before implementation, map requirements to existing portal authentication, course discovery, enrollment, player, API gateway and deployment capabilities.

### 1.4 Definitions and Acronyms

| Term | Definition |
|---|---|
| AI Tutor | Conversational learning assistant embedded in the course experience. |
| iGOT Portal | Learner-facing portal hosting discovery and course/player experiences. |
| JWT | JSON Web Token used to convey signed identity/authorization claims. |
| WebSocket | Persistent, bidirectional connection for real-time message exchange. |
| RAG | Retrieval-augmented generation: retrieving trusted course context for model responses. |
| Learning style | Learner-selected response mode: Socratic, Storytelling or None. |
| Feature flag | Server-controlled setting determining whether a learner/cohort/course may use AI Tutor. |
| SRS | Software Requirements Specification. |

## 2. Overall Description

### 2.1 Product Perspective

AI Tutor is an additional capability integrated into the existing portal/player experience. The portal remains the source of learner identity and course access truth unless platform owners specify otherwise. The AI Tutor backend manages tutoring sessions, message orchestration, learning-style behavior, course-context retrieval, model calls, and tutor-specific telemetry.

### 2.2 High-Level System Context

| External / internal actor or system | Responsibilities / interaction |
|---|---|
| Learner | Logs in, discovers courses, opens an eligible course, chooses a style, sends questions and reads responses. |
| iGOT Learner Portal | Authenticates or consumes authenticated session; renders discovery/course UI and AI Tutor entry point. |
| Identity / authentication service | Authenticates learner and provides a trusted identity/session or token claims. |
| Course and enrollment services | Provide course metadata and authoritative enrollment/access status. |
| Course player | Hosts learning content and AI Tutor panel. |
| AI Tutor API / WebSocket service | Enforces access, creates sessions, authenticates socket, validates messages and coordinates tutoring. |
| Content retrieval service / store | Returns approved course content relevant to a learner query. |
| LLM provider | Generates responses from approved context and tutor instructions. |
| Persistence / telemetry | Stores session/conversation data according to policy and emits operational events. |

### 2.3 User Journey

1. Learner signs in to the iGOT Learner Portal.
2. Portal checks AI Tutor eligibility for the authenticated learner and relevant scope.
3. If enabled, AI Tutor entry point is shown during course discovery and on the course page.
4. When the learner clicks AI Tutor, the system checks course enrollment/access.
5. If access is allowed, the learner enters the course player where the AI Tutor panel is available.
6. Learner selects Socratic, Storytelling or None.
7. Frontend requests a tutor session/connection credential and opens a secure WebSocket.
8. Backend validates JWT and authorizes the learner, course and session before accepting messages.
9. Learner and tutor exchange real-time messages; the tutor retrieves approved context and returns a response.
10. System persists permitted session data and records operational metrics/audit events.

### 2.4 In-Scope for Initial Release

- Eligibility-controlled AI Tutor entry points in discovery and course detail views.
- Server-side enrollment/access validation before tutoring.
- AI Tutor panel integrated into the course player.
- Learning-style selector with Socratic, Storytelling and None.
- JWT-authenticated WebSocket messaging and backend authorization.
- Course-context-aware response generation, with safe behavior when context is insufficient.
- Session/message lifecycle, essential telemetry, error handling and basic operational dashboards.

### 2.5 Out of Scope Unless Separately Approved

- Replacing the portal identity provider or course enrollment system.
- Changing the core course player or course content format beyond the integration needed for the tutor panel.
- High-stakes grading, certification decisions or autonomous changes to learner records.
- Voice/video tutoring, multilingual speech interfaces, social learning and tutor-to-tutor collaboration.
- An unrestricted web-search assistant; initial answers should use approved learning sources.
- Specific scale, SLA, model vendor or hosting design until agreed by platform/product owners.

## 3. User Classes and Operating Environment

| User / system | Needs and permissions |
|---|---|
| Authenticated learner | Can see tutor entry points only when eligible; can use the tutor only for accessible/enrolled courses and own sessions. |
| Portal administrator / feature owner | Can configure rollout/eligibility according to approved access controls. |
| Support / operations | Can inspect service health and diagnostic metadata; conversation content access must be restricted and audited. |
| Platform identity service | Provides authenticated identity or token claims. |
| Course/enrollment service | Authoritative course and enrollment status. |
| AI Tutor service | Authorizes requests, manages sessions and coordinates retrieval/model interactions. |

### 3.1 Operating Environment

- Modern supported desktop and mobile browsers used by the iGOT portal.
- HTTPS for portal/API traffic and WSS for WebSocket traffic outside local development.
- Existing iGOT/Sunbird deployment and identity conventions, subject to technical validation.
- Backend components deployed in an environment capable of maintaining WebSocket connections and reaching approved content/model services.

## 4. Scope and Assumptions

- AI Tutor is controlled by a server-side feature flag or equivalent eligibility policy.
- Portal identity is the authoritative source for the learner subject; client-supplied user identifiers are not trusted.
- Course/enrollment APIs or equivalent platform services are available to verify access.
- An approved JWT issuer and validation mechanism can be used by the WebSocket backend.
- Learning styles are represented by the canonical values SOCRATIC, STORYTELLING and NONE.
- The AI Tutor has access only to content the learner is authorized to use.
- API paths and payloads in this document are illustrative contracts, not confirmed repository endpoints.
- Product owner/security owner will approve conversation retention, model/data-processing terms and privacy notices.

## 5. Functional Requirements

Requirement priority: Must = required for initial release; Should = recommended for MVP; Could = optional enhancement.

| ID | Requirement statement | Priority |
|---|---|---|
| FR-001 | The system shall use the existing iGOT login/session mechanism to identify the authenticated learner. | Must |
| FR-002 | The system shall prevent unauthenticated users from accessing protected AI Tutor APIs or creating a tutor session. | Must |
| FR-003 | The system shall evaluate AI Tutor eligibility using a server-controlled policy for the authenticated learner and configured rollout scope. | Must |
| FR-004 | The portal shall display AI Tutor entry points in course discovery and course detail views only when eligibility permits. | Must |
| FR-005 | The backend shall re-evaluate eligibility when a tutor session is created or a protected operation is performed. | Must |
| FR-006 | When the learner selects AI Tutor for a course, the system shall verify authoritative enrollment/course access before opening a usable tutor session. | Must |
| FR-007 | The system shall deny tutor session creation when the learner is not enrolled or otherwise lacks course access. | Must |
| FR-008 | For an authorized learner, the course player shall display an AI Tutor panel without preventing normal course content interaction. | Must |
| FR-009 | The AI Tutor panel shall provide learning-style options Socratic, Storytelling and None. | Must |
| FR-010 | The system shall validate the selected learning style against the allowed enum on both client and server. | Must |
| FR-011 | The system shall create or resume a tutor session associated with the authenticated learner and authorized course. | Must |
| FR-012 | The client shall establish a secure WebSocket connection to the AI Tutor service using the approved credential transport pattern. | Must |
| FR-013 | The backend shall validate the JWT before accepting application messages on the WebSocket connection. | Must |
| FR-014 | JWT validation shall check signature and applicable issuer, audience, expiry and not-before claims, using trusted configuration. | Must |
| FR-015 | The backend shall authorize the authenticated learner against the requested course and tutor session. | Must |
| FR-016 | The backend shall reject invalid, expired, malformed or unauthorized credentials and shall not disclose sensitive validation details to the client. | Must |
| FR-017 | The client and backend shall exchange versioned, schema-validated WebSocket messages with a request/correlation identifier. | Must |
| FR-018 | The tutor service shall validate message size, type, session ownership and rate limits before processing a learner message. | Must |
| FR-019 | The tutor service shall use the selected learning style when constructing the response instructions. | Must |
| FR-020 | The tutor service should retrieve approved course context relevant to the learner question before generating an answer. | Must |
| FR-021 | When trusted context is insufficient, the tutor shall ask a clarifying question, retrieve additional context, or clearly state the limitation rather than fabricate course facts. | Must |
| FR-022 | The service shall support response streaming or incremental response events over WebSocket where supported by the model/service stack. | Should |
| FR-023 | The system shall send a completion or safe error event for each accepted request, subject to disconnect/cancellation conditions. | Must |
| FR-024 | The system shall persist session and conversation data according to approved retention, access and deletion policies. | Must |
| FR-025 | The system shall emit operational telemetry for connection outcomes, request latency, model/retrieval errors and safety/authorization denials. | Must |
| FR-026 | The system shall handle socket disconnection and provide a bounded, re-authenticated reconnect strategy. | Must |
| FR-027 | The system shall provide safe user-facing handling for enrollment denial, disabled feature, expired JWT, rate limit, model timeout and dependency failure. | Must |
| FR-028 | The system shall avoid logging raw JWTs, credentials, provider secrets or unnecessary sensitive conversation data. | Must |
| FR-029 | The system should support a controlled rollout/kill switch so the AI Tutor feature can be disabled without disabling the core portal. | Should |
| FR-030 | The system shall maintain trace/correlation identifiers across gateway, tutor orchestration, retrieval and model calls where technically feasible. | Should |

## 6. External Interface Requirements

### 6.1 User Interface

- AI Tutor entry point shall appear in course discovery and course detail contexts only for eligible learners.
- Course/player UI shall expose a tutor panel with transcript, message composer, send action, selected learning style and connection/error state.
- The style selector shall have accessible labels and keyboard support.
- The UI shall clearly distinguish connecting, connected, responding, completed, disconnected and failed states.
- Error messages shall explain the next action without exposing internal stack traces, prompts or secrets.
- The panel shall adapt to supported desktop and mobile layouts and shall not block essential player controls.

### 6.2 REST / HTTP Interfaces

The following routes are illustrative. Final paths, verbs, authentication headers and response formats must follow existing platform conventions.

| Operation | Illustrative contract | Purpose |
|---|---|---|
| Eligibility | GET /api/ai-tutor/eligibility?courseId={id} | Return enabled status and permitted styles for current authenticated principal. |
| Enrollment/access | GET /api/enrollments/{courseId}/status | Read authoritative enrollment/access status, if no existing equivalent is available. |
| Create session | POST /api/ai-tutor/sessions { courseId, learningStyle } | Create/resume a session after rechecking eligibility and course access. |
| Session response | { sessionId, websocketUrl, credentialStrategy } | Return session reference and approved connection instructions; avoid long-lived tokens. |
| Session close | POST /api/ai-tutor/sessions/{sessionId}/close | Optionally close a session and finalize state. |

### 6.3 WebSocket Interface

Proposed endpoint: wss://{host}/ws/ai-tutor. This is a placeholder. Use the approved token transport pattern supported by the browser, gateway and identity architecture. If credentials are sent in a query string, token leakage through logs and observability systems must be prevented; prefer a secure handshake or short-lived scoped credential pattern.

| Event | Direction | Required fields / behavior |
|---|---|---|
| chat.message | Client → server | type, requestId, sessionId, message, learningStyle; server validates principal, scope, schema, size and rate. |
| chat.accepted | Server → client | requestId and accepted/status marker. |
| chat.delta | Server → client | requestId, sequence and incremental text chunk, if streaming is enabled. |
| chat.completed | Server → client | requestId, final answer and optional verified source references. |
| chat.error | Server → client | requestId, stable error code, safe message and retryable boolean. |

### 6.4 External Services

- Identity provider / portal session service.
- Course catalogue and enrollment/access service.
- Approved learning content source or retrieval index.
- LLM provider accessed through a server-side adapter; provider credentials must not be exposed to the browser.
- Monitoring, logging and alerting services.

## 7. Data Requirements

### 7.1 Logical Entities

| Entity | Minimum fields (logical, not final schema) | Notes |
|---|---|---|
| TutorSession | sessionId, userSubject, courseId, learningStyle, status, createdAt, updatedAt, expiry | Access control must bind session to authenticated subject and course. |
| ConversationMessage | messageId, requestId, sessionId, role, content/reference, createdAt, sequence, status | Apply content retention and deletion policy; consider redaction/minimization. |
| TutorEvent | eventId, eventType, timestamp, outcome, latency, traceId, safe error code | Operational events should avoid raw tokens and unnecessary message content. |
| SourceReference | sourceId/contentRef, title, courseId, location/reference metadata | Only expose references that the learner is allowed to access. |
| EligibilityPolicy | scope, enabled, permitted cohort/course, style configuration, updatedAt | Access-controlled; feature-off must be enforced server-side. |

### 7.2 Data Validation

- Course IDs and session IDs must be syntactically validated and checked against authoritative records.
- Learning style must match the allowed enum.
- Message length, character encoding, content type and payload size must be bounded.
- Request IDs must support correlation and safe duplicate handling.
- Server timestamps and authenticated subject are authoritative; client timestamps/user IDs are not authorization evidence.

### 7.3 Retention and Privacy

Retention periods, deletion workflows, learner notice/consent where required, access to transcripts, model-provider processing terms and data residency must be approved by product, privacy and security owners before production launch. This SRS does not prescribe a legal basis or fixed retention duration.

## 8. Non-Functional Requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-001 | Security | All portal/API traffic shall use HTTPS and WebSocket traffic shall use WSS outside local development. |
| NFR-002 | Security | The backend shall perform authentication and authorization checks; hiding a UI control alone shall never grant or deny access. |
| NFR-003 | Security | JWT keys, secrets and model-provider credentials shall be held server-side in an approved secret-management mechanism. |
| NFR-004 | Privacy | Conversation access shall be role-restricted, audited where appropriate, and governed by an approved retention/deletion policy. |
| NFR-005 | Reliability | Timeouts, bounded retries, rate limits and circuit breakers shall be defined for external dependencies. |
| NFR-006 | Reliability | WebSocket reconnect behavior shall re-authenticate and re-authorize; reconnect shall not bypass access checks. |
| NFR-007 | Performance | The team shall define measurable targets for connection establishment, first-token latency and end-to-end response latency before pilot launch. |
| NFR-008 | Scalability | The deployment shall support the agreed number of concurrent socket connections; multi-instance deployments shall account for session routing/shared state as needed. |
| NFR-009 | Observability | Logs and metrics shall include correlation IDs and stable error codes while excluding raw credentials/secrets. |
| NFR-010 | Accessibility | The tutor UI shall support keyboard navigation, accessible labels, focus behavior and announcements for connection/response states. |
| NFR-011 | Compatibility | The UI and WebSocket behavior shall be tested in the supported browser/device matrix defined by the portal team. |
| NFR-012 | Maintainability | Model and retrieval integrations should be abstracted behind replaceable service interfaces. |
| NFR-013 | Content quality | Responses should be evaluated for grounding, citation accuracy, usefulness and safe handling of insufficient context. |
| NFR-014 | Recoverability | The AI Tutor shall be independently feature-toggleable so a failure can be isolated without disabling core portal learning flows. |

## 9. Business Rules and Decision Flows

### 9.1 Eligibility Decision

1. Input: authenticated principal plus configured rollout scope.
2. If identity is missing or invalid: deny access.
3. If the feature policy is disabled, missing or cannot be evaluated safely: do not expose/use AI Tutor (fail closed).
4. If enabled: expose entry point; backend still rechecks policy on session creation and protected operations.

### 9.2 Enrollment Decision

1. Input: authenticated principal and requested course ID.
2. Query the authoritative course/enrollment service.
3. If course is unknown, enrollment is inactive, or policy denies access: do not create a tutor session.
4. If permitted: continue to player/session creation; the player/tutor backend must revalidate access for protected operations.

### 9.3 WebSocket Authentication and Authorization

1. Receive connection credentials through the approved secure pattern.
2. Validate JWT signature, allowed algorithm, expiry, not-before, issuer and audience as applicable.
3. Resolve the authenticated subject and verify AI Tutor entitlement.
4. Bind connection to an authorized session and course; reject if the session does not belong to the principal.
5. Only after successful validation accept chat events; validate authorization and schema for every message.

### 9.4 Answer Grounding

1. Retrieve approved course context relevant to the learner query.
2. If sufficient trusted context exists, generate an answer using the selected style and provide verified references when available.
3. If context is insufficient or conflicting, ask a clarifying question or disclose uncertainty; do not invent course-specific facts or citations.

## 10. Acceptance Criteria

| ID | Acceptance criterion |
|---|---|
| AC-01 | Authenticated eligible learner sees AI Tutor entry point in discovery and course detail views. |
| AC-02 | Authenticated ineligible learner does not see the entry point and cannot create a session by directly calling the backend. |
| AC-03 | Unauthenticated learner cannot access protected tutor APIs or establish an authenticated tutor session. |
| AC-04 | Non-enrolled learner is denied tutor access for the course and receives a safe, actionable message. |
| AC-05 | Enrolled/authorized learner can open the course player and see the AI Tutor panel. |
| AC-06 | Style selector supports Socratic, Storytelling and None; invalid style values are rejected server-side. |
| AC-07 | Valid JWT permits an authorized WebSocket session; invalid, expired or wrong-issuer/audience tokens are rejected. |
| AC-08 | A learner cannot use another learner’s session by substituting a sessionId or courseId. |
| AC-09 | Client message produces a correlated accepted/completed event or a safe error event under defined conditions. |
| AC-10 | WebSocket disconnect can recover via bounded reconnect and fresh authentication without duplicating messages unexpectedly. |
| AC-11 | Insufficient retrieval context does not result in fabricated citations or unsupported course facts. |
| AC-12 | Logs and telemetry contain no raw JWTs, provider secrets or unnecessary sensitive data. |
| AC-13 | Feature kill switch disables new tutor use while preserving normal portal/course functionality. |
| AC-14 | Operational dashboards expose agreed connection, latency, failure and model-cost metrics. |

## 11. Test Scenarios

| Test ID | Area | Scenario | Expected result |
|---|---|---|---|
| TS-01 | Login/session | Valid learner login | Portal shows learner home; authenticated identity available. |
| TS-02 | Eligibility | Feature enabled for learner | Tutor entry point is visible. |
| TS-03 | Eligibility | Feature disabled or policy lookup fails | Entry point is hidden; backend denies session creation. |
| TS-04 | Enrollment | Learner not enrolled | Tutor session is not created; enrollment guidance shown. |
| TS-05 | Enrollment | Enrollment service timeout | Fail safely; do not assume access. |
| TS-06 | Player | Eligible, enrolled learner opens tutor | Tutor panel loads alongside course content. |
| TS-07 | Style | Submit each valid style | Server accepts SOCRATIC, STORYTELLING and NONE. |
| TS-08 | Style | Submit invalid style | Request rejected with validation error. |
| TS-09 | JWT | Expired or malformed JWT | Socket/auth request rejected. |
| TS-10 | JWT | Wrong issuer/audience/signature | Socket/auth request rejected. |
| TS-11 | Authorization | Use another learner’s sessionId | Operation denied and event recorded safely. |
| TS-12 | WebSocket | Valid message schema | Correlated accepted and completion/stream events received. |
| TS-13 | WebSocket | Oversized/malformed message or rate excess | Rejected or throttled with safe error. |
| TS-14 | Network | Connection drops during response | Reconnect re-authenticates; transcript state reconciled per design. |
| TS-15 | AI/retrieval | No relevant approved context | Tutor clarifies or states limitation without fabricated sources. |
| TS-16 | AI provider | Provider timeout/429/5xx | Bounded retry/fallback; safe error returned. |
| TS-17 | Persistence | Conversation store unavailable | Behavior follows approved degraded-mode policy; UI does not falsely claim persistence. |
| TS-18 | Privacy | Inspect logs for authentication and model calls | No raw tokens, secrets or unnecessary sensitive content. |
| TS-19 | Accessibility | Keyboard and screen-reader pass | Tutor controls and state changes are accessible. |
| TS-20 | Kill switch | Disable feature during pilot | New sessions/operations denied; standard portal remains functional. |

## 12. Risks and Dependencies

| Risk / dependency | Impact | Mitigation / action |
|---|---|---|
| Existing portal auth model differs from assumed JWT flow | Integration rework or insecure token handling | Inspect current SSO/session pattern; design token exchange with platform/security owners. |
| Course/enrollment API not directly available to tutor backend | Access decision may be stale or duplicated | Identify authoritative API and service-to-service auth; define timeout/failure behavior. |
| Player has limited extension points | UI integration complexity | Review repository components, routes and player SDK/customization points early. |
| WebSocket gateway/load balancer constraints | Dropped connections or failed upgrades | Validate WSS upgrade, idle timeouts, sticky/shared session needs and scale testing. |
| Course content is incomplete or poorly indexed | Low answer quality/hallucinations | Pilot on curated content; measure retrieval and answer grounding before broad rollout. |
| LLM cost/latency/availability | Poor user experience or high operating cost | Set quotas, timeouts, budgets, fallback and model evaluation criteria. |
| Conversation data sensitivity/retention unclear | Privacy and governance risk | Approve data map, notice, access controls, retention and deletion before launch. |
| Illustrative APIs mistaken for existing endpoints | Implementation delays | Create a repository-verified interface inventory and replace placeholders in detailed design. |

## 13. Traceability Matrix

| Journey step | Requirement IDs | Primary validation |
|---|---|---|
| 1. Learner login | FR-001, FR-002 | TS-01; protected API denial |
| 2. Eligibility | FR-003, FR-005, FR-029 | TS-02, TS-03, TS-20 |
| 3. Discovery/course CTA | FR-004 | TS-02, TS-03 |
| 4. Enrollment | FR-006, FR-007 | TS-04, TS-05 |
| 5. Player/style selector | FR-008, FR-009, FR-010, FR-011 | TS-06, TS-07, TS-08 |
| 6. WebSocket connection | FR-012, FR-026 | TS-12, TS-14 |
| 7. JWT validation | FR-013, FR-014, FR-015, FR-016 | TS-09, TS-10, TS-11 |
| 8. Real-time messaging | FR-017, FR-018, FR-022, FR-023 | TS-12, TS-13 |
| 9. Orchestration/context | FR-019, FR-020, FR-021 | TS-15, TS-16 |
| 10. Persistence/telemetry | FR-024, FR-025, FR-028, FR-030 | TS-17, TS-18 |
| 11. End-to-end flow | FR-017, FR-023, FR-026, FR-030 | TS-12, TS-14, TS-16 |
| 12. Error handling | FR-027, FR-028 | TS-03, TS-05, TS-13–TS-18 |

## 14. Open Questions / Decisions Required

- Which existing identity/session mechanism does the deployed iGOT portal use, and how will the AI Tutor backend validate or exchange credentials?
- Is eligibility scoped by user, role, organization, cohort, course, geography, or a combination?
- Which authoritative course enrollment/access API should be called, and what are its exact response/status semantics?
- What is the supported player extension point for the AI Tutor panel?
- Which gateway/runtime will terminate WebSocket connections, and what are the idle timeout, max frame size and concurrency limits?
- Will the client receive a short-lived scoped socket token, use a secure cookie, or use another approved handshake mechanism?
- Which course-content source and retrieval/indexing approach are approved for the MVP?
- Which model/provider is approved, and what are the data-processing, retention, region and cost constraints?
- Should conversation history persist across visits? What is the retention duration and deletion behavior?
- What are the MVP targets for concurrent learners, connection success, first-token latency, end-to-end latency and monthly cost?
- Which browsers/devices and accessibility conformance target must be supported?
- Who owns the kill switch, operational dashboards, incident response and content-quality evaluation?

## Appendix A — Illustrative Message Contracts

### A.1 Client message

{  
  "type": "chat.message",  
  "requestId": "<uuid>",  
  "sessionId": "<session-id>",  
  "message": "Explain this concept",  
  "learningStyle": "SOCRATIC"  
}

### A.2 Completion event

{  
  "type": "chat.completed",  
  "requestId": "<uuid>",  
  "answer": "...",  
  "citations": [{"title": "...", "contentRef": "..."}]  
}

### A.3 Error event

{  
  "type": "chat.error",  
  "requestId": "<uuid>",  
  "code": "MODEL_TIMEOUT",  
  "message": "Please try again.",  
  "retryable": true  
}

End of document.
