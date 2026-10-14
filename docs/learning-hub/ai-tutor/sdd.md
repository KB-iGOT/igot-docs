# AI Tutor — Software Design Document (SDD)

**AI Tutor Integration with the iGOT Learner Portal**

Version 1.0 | Draft for technical review | 14 October 2026

*Design proposal derived from the agreed AI Tutor learner journey and SRS. Confirm existing platform components, API contracts and deployment constraints before implementation.*

## Document Control

| Field | Value |
|---|---|
| Document | Software Design Document — AI Tutor Integration |
| Version / status | 1.0 / Draft for technical review |
| Date | 14 October 2026 |
| Related specification | AI Tutor × iGOT Learner Portal SRS v1.0 |
| Audience | Architects, frontend/backend developers, QA, DevOps, security and platform owners |

### Revision History

| Version | Date | Description |
|---|---|---|
| 1.0 | 14 Oct 2026 | Initial proposed design covering components, sequence flows, interfaces, data, security and operations. |

## Design Status and Conventions

This SDD defines a target design, not a verified description of the current repository. Names such as AI Tutor API, Session Service, Retrieval Service and the endpoints below are logical/proposed boundaries. Reuse existing iGOT/Sunbird components where available; do not create duplicate identity, course or enrollment systems. All API paths and payloads are illustrative until repository and environment validation is complete.

## Contents

- 1. Purpose and Design Goals
- 2. Architecture Overview
- 3. Component Design
- 4. End-to-End Sequence Flows
- 5. API and WebSocket Contracts
- 6. Data Design
- 7. Security Design
- 8. Failure Handling and Resilience
- 9. Deployment and Operations
- 10. Observability
- 11. Test Design
- 12. Requirement Traceability
- 13. Implementation Plan
- 14. Open Decisions
- Appendix A — Example Payloads

## 1. Purpose and Design Goals

### 1.1 Purpose

Describe how the AI Tutor feature should be integrated into the iGOT Learner Portal, from learner authentication and conditional discovery entry points to course access checks, player UI, JWT-authenticated WebSocket messaging, context retrieval, response generation and operational monitoring.

### 1.2 Design Goals

- Integrate with existing portal identity, course catalogue, enrollment and player capabilities.
- Keep eligibility and access decisions authoritative on the backend.
- Authenticate the WebSocket before accepting tutoring messages; authorize every session/message against learner and course scope.
- Keep AI/model-provider credentials server-side and retrieve only approved course content.
- Support learning styles Socratic, Storytelling and None with a stable, validated enum.
- Make the tutor feature independently configurable, observable and disableable.
- Keep failure of AI Tutor from breaking core course discovery or course playback.

### 1.3 Design Principles

| Principle | Application |
|---|---|
| Reuse before build | Inspect repository modules and platform APIs; add adapters instead of duplicating platform services. |
| Zero-trust authorization | UI visibility is a convenience, never an authorization boundary. |
| Least privilege | A tutor session is scoped to one authenticated learner and permitted course. |
| Fail closed for access | Unknown eligibility or enrollment status must not grant access. |
| Privacy by design | Minimize stored content, restrict transcript access and redact credentials from logs. |
| Provider abstraction | Wrap model and retrieval integrations behind internal interfaces. |
| Contract-first | Version and validate REST/WebSocket schemas; use correlation IDs. |

## 2. Architecture Overview

### 2.1 Logical Architecture

| Layer | Logical components | Responsibilities |
|---|---|---|
| Experience | iGOT discovery/course views; course player; AI Tutor panel | Conditional CTA, style selector, transcript, composer, connection status and safe errors. |
| Portal integration | Eligibility adapter; course/enrollment adapter; session API client | Reuse portal auth and platform APIs; pass course context; handle navigation and response states. |
| Edge / transport | HTTPS API gateway; WebSocket endpoint/gateway | TLS/WSS termination, request limits, connection limits, routing and basic abuse protection. |
| Tutor application | Tutor API; session manager; socket handler; policy/validation | Session lifecycle, authorization, schema validation, rate limiting, request correlation and orchestration. |
| AI orchestration | Prompt/style composer; retrieval adapter; guardrail layer; model adapter | Build grounded prompts, retrieve course content, generate and stream answers, handle model failures. |
| Platform dependencies | Identity/session service; course/enrollment APIs; content repository/index; LLM provider | Authoritative identity/access, approved course material and model inference. |
| Data / operations | Session/message store; telemetry pipeline; metrics/logs/traces | Conversation continuity, audit metadata, monitoring, alerting and cost tracking. |

### 2.2 Logical Request Flow

```
Learner Browser
  ├─ HTTPS → iGOT Portal / existing identity session
  ├─ HTTPS → AI Tutor Eligibility + Session API
  └─ WSS → WebSocket Gateway → JWT Authentication → Session Authorization
                                         ↓
                                  Tutor Orchestrator
                                   ├─ Course/Enrollment Adapter
                                   ├─ Approved Content Retriever
                                   ├─ Safety/Style Prompt Builder
                                   ├─ LLM Provider Adapter
                                   └─ Session Store + Telemetry
```

### 2.3 Trust Boundaries

- Browser to portal/backend: untrusted client input; enforce authentication, schema and access checks.
- Gateway to tutor service: trusted only over authenticated internal transport; propagate verified identity claims, not raw client assertions.
- Tutor service to platform APIs: service-to-service credentials with least privilege.
- Tutor service to retrieval/model providers: send only necessary query/context; secrets remain server-side.
- Operations/data store: restrict transcript access; separate conversation content from operational telemetry where practical.

### 2.4 Proposed Runtime Boundaries

For an MVP, the tutor API, WebSocket handler and orchestration can be modules in one deployable backend if the existing platform favors a monolith. Keep interfaces separate in code. Split into independently deployed services only when scale, ownership or platform constraints justify the added operational cost.

## 3. Component Design

### C-01 Portal UI integration

Adds AI Tutor entry point to discovery and course detail views. Requests eligibility for authenticated principal and course. Must not treat client-side eligibility as authorization.

### C-02 AI Tutor panel

Runs in the player. Holds selected learning style, transcript view, input composer, pending state, connection status and retry actions.

### C-03 Eligibility adapter

Resolves server-controlled feature policy by principal and course/cohort scope. Defaults to disabled when policy cannot be safely evaluated.

### C-04 Course access adapter

Calls the authoritative course/enrollment service. Normalizes enrollment/access states and timeouts.

### C-05 Tutor Session API

Creates/resumes/closes sessions. Rechecks feature eligibility and course access before session creation. Returns opaque session ID and approved connection instructions.

### C-06 WebSocket handler

Accepts connection upgrade, validates credential via auth middleware, binds principal/session/course scope, validates events and sends correlated response events.

### C-07 JWT authentication middleware

Verifies signature using trusted issuer keys and validates applicable iss, aud, exp, nbf, subject and token purpose. Rejects before application messages are processed.

### C-08 Authorization policy

Checks tutor entitlement, current course access, session ownership and allowed operation. Do not trust userId/courseId sent by client without server-side binding.

### C-09 Tutor orchestrator

Coordinates request validation, conversation context, style instructions, retrieval, model generation, persistence and event delivery.

### C-10 Retrieval adapter

Searches approved course/module content only within the learner/course authorization scope. Returns content references and relevance metadata.

### C-11 Model adapter

Calls the approved LLM provider with timeouts, bounded retries, token/cost limits and normalized streaming/error output.

### C-12 Persistence adapter

Stores session metadata and permitted messages with retention and deletion metadata. Supports idempotent handling of request IDs where practical.

### C-13 Telemetry adapter

Emits structured events, metrics and traces with correlation IDs; redacts tokens and sensitive fields.

## 4. End-to-End Sequence Flows

### 4.1 Login and Eligibility

1. Learner opens the portal and completes the existing iGOT login/SSO flow.
2. Portal resolves the authenticated principal from its trusted session.
3. Discovery/course view requests AI Tutor eligibility for the current principal and course scope.
4. Eligibility adapter evaluates the server-side feature policy.
5. If enabled, UI renders the tutor entry point. If disabled or policy lookup fails, hide the entry point and record a safe diagnostic event.
6. On any later session creation, the backend repeats the eligibility check.

### 4.2 Click AI Tutor and Validate Enrollment

1. UI sends the selected course identifier to the session API or access-check endpoint.
2. Backend resolves principal from trusted authentication context; it does not accept client-supplied userId as authority.
3. Course access adapter queries the platform’s authoritative enrollment/access service.
4. If unknown, inactive or denied, return a normalized access error and do not create a tutor session.
5. If allowed, create a session bound to principal + course + selected style, then return session ID and connection instructions.

### 4.3 WebSocket Handshake and JWT Validation

1. Client obtains a short-lived, narrowly scoped socket credential or uses the platform-approved secure handshake mechanism.
2. Client connects over WSS and supplies credentials using the approved transport supported by the browser and gateway.
3. Gateway enforces connection/frame limits and forwards the request over trusted internal transport.
4. JWT middleware validates signature, issuer, audience, expiry, not-before, subject and intended token purpose as applicable.
5. Authorization policy verifies tutor eligibility, session ownership, course binding and current access policy.
6. Only after successful validation does the server accept application events. Invalid credentials are rejected without exposing token details.

### 4.4 Message Processing and Answer Generation

1. Client sends chat.message with requestId, sessionId, message and learningStyle.
2. Socket handler validates schema, size, style enum, rate limits and session binding; duplicates are handled idempotently where feasible.
3. Server sends chat.accepted, persists the learner message according to policy and starts orchestration.
4. Orchestrator obtains authorized conversation context and asks retrieval adapter for relevant approved course content.
5. Prompt builder adds the selected style instruction, trusted context, safety constraints and a clear instruction not to invent unsupported course facts.
6. Model adapter generates a response. If streaming is enabled, normalized chunks are emitted as chat.delta events.
7. Server applies output/grounding checks, persists the final result and references as permitted, then emits chat.completed.
8. On failure, emit a stable chat.error code and safe user message; record diagnostic metadata without secrets.

### 4.5 Learning Style Behavior

| Canonical value | Behavioral instruction | Expected observable behavior |
|---|---|---|
| SOCRATIC | Guide with questions and hints before revealing a full solution when pedagogically appropriate. | Encourages reasoning; can explain directly when requested or when necessary. |
| STORYTELLING | Explain through a coherent story, scenario or analogy grounded in course content. | Uses narrative examples while preserving factual accuracy. |
| NONE | Use the default neutral teaching style without a forced Socratic or narrative format. | Clear, direct explanation with examples as useful. |

### 4.6 Disconnect and Reconnect

1. Client detects close/heartbeat timeout and changes UI state to disconnected.
2. Reconnect uses bounded exponential backoff with jitter and stops after a configured attempt/time limit.
3. Client re-authenticates and server rechecks token validity, session ownership and course access.
4. Client reconciles transcript state using message/request IDs; pending requests are not blindly resubmitted unless idempotency is guaranteed.
5. If session is expired or access was revoked, client asks the learner to re-enter through the portal.

## 5. API and WebSocket Contracts

The paths below are examples for design discussion. Prefer existing portal conventions and standard error envelopes. All protected requests derive the principal from server-validated credentials.

### 5.1 Eligibility API

```
GET /api/ai-tutor/eligibility?courseId={courseId}
Response 200: { "enabled": true, "allowedStyles": ["SOCRATIC","STORYTELLING","NONE"] }
Response 401: unauthenticated; 403: not permitted; 503: policy unavailable (UI fails closed).
```

### 5.2 Create Tutor Session

```
POST /api/ai-tutor/sessions
Request: { "courseId": "course-123", "learningStyle": "SOCRATIC" }
Response 201: { "sessionId": "opaque-id", "expiresAt": "ISO-8601", "connection": { "url": "wss://...", "credentialMode": "SHORT_LIVED_SCOPED" } }
Server steps: authenticate → validate input → eligibility check → enrollment/access check → create session → return connection details.
```

### 5.3 Close Tutor Session

```
POST /api/ai-tutor/sessions/{sessionId}/close
Response 204 on successful close; 401/403 for auth/access failures; 404 if not found or deliberately concealed.
```

### 5.4 WebSocket Event Schema

| Event | Direction | Payload (minimum) |
|---|---|---|
| chat.message | Client → server | type, requestId, sessionId, message, learningStyle |
| chat.accepted | Server → client | type, requestId, acceptedAt or status |
| chat.delta | Server → client | type, requestId, sequence, delta |
| chat.completed | Server → client | type, requestId, answer, citations[] optional |
| chat.error | Server → client | type, requestId, code, message, retryable |

### 5.5 Error Taxonomy

| Code | Meaning | Retry guidance |
|---|---|---|
| UNAUTHENTICATED | No valid identity/token | Re-authenticate; do not retry same credential. |
| FORBIDDEN | Feature/course/session access denied | Do not retry unless access changes. |
| INVALID_MESSAGE | Payload/schema/style invalid | Correct request before retry. |
| RATE_LIMITED | Quota/rate threshold reached | Respect retry-after/backoff. |
| SESSION_EXPIRED | Session no longer usable | Create or resume a permitted session. |
| CONTENT_UNAVAILABLE | Retrieval/content dependency failed | Retry boundedly or ask a general safe follow-up. |
| MODEL_TIMEOUT | Model exceeded time budget | Bounded retry if idempotent; otherwise show retry action. |
| MODEL_UNAVAILABLE | Provider unavailable or overloaded | Circuit breaker/fallback policy; retry later. |
| PERSISTENCE_ERROR | Message/session write failed | Follow explicit degraded-mode policy; do not falsely report saved state. |
| INTERNAL_ERROR | Unexpected internal failure | Safe generic message; correlate via trace ID. |

## 6. Data Design

### 6.1 Logical Data Model

| Entity | Fields | Constraints / notes |
|---|---|---|
| TutorSession | session_id, subject_id, course_id, learning_style, status, created_at, updated_at, expires_at | Opaque ID; subject/course binding; enum validation; lifecycle state. |
| ConversationMessage | message_id, session_id, request_id, role, content or content_ref, sequence, status, created_at | Unique or deduplicated request ID within session; bounded content; retention metadata. |
| SourceReference | source_ref_id, message_id, content_id, title, location, relevance metadata | Only authorized references; verify links before returning. |
| TutorAuditEvent | event_id, event_type, subject pseudonym/reference, session_id, timestamp, outcome, trace_id | No raw token; avoid full message content unless approved. |
| EligibilityPolicy | policy_id, scope_type, scope_value, enabled, allowed_styles, version, updated_at | Configuration access-controlled; default deny if unavailable. |

### 6.2 Session Lifecycle

```
CREATED → CONNECTING → ACTIVE → CLOSING → CLOSED
                         └──────────────→ EXPIRED
Creation requires authorization; ACTIVE socket requires valid identity/session scope.
Terminal states must not accept new messages. Reconnect may return to ACTIVE only after re-authentication and policy checks.
```

### 6.3 Persistence Rules

- Persist only data needed for session continuity, product quality and approved audit purposes.
- Define whether raw prompts, model responses and retrieved excerpts are stored; apply a configurable retention policy.
- Encrypt stored data and backups using platform-approved controls.
- Use access controls for transcript viewing and log administrative reads where required.
- Support deletion/retention expiry according to approved policy.
- Separate operational telemetry from transcript content; use pseudonymous identifiers where feasible.

## 7. Security Design

### 7.1 Authentication and JWT Validation

- Accept only approved signing algorithms and trusted issuer/key configuration; reject algorithm/key confusion.
- Validate signature, issuer, audience, expiry and not-before claims as applicable.
- Validate token purpose and scope; a portal access token must not automatically be treated as a socket token unless explicitly approved.
- Use short-lived credentials for WebSocket access and support key rotation.
- Do not log raw tokens, authorization headers, cookies, private keys or provider secrets.
- Use generic external error messages; detailed reasons belong in restricted diagnostic logs.

### 7.2 Authorization

- Bind session to server-resolved subject, course ID and policy scope at creation.
- For every socket event, verify session ownership and permitted action.
- Recheck access at session creation and according to policy during long-running sessions; handle enrollment revocation.
- Never trust client-provided subject/user ID, enrollment status or feature-enabled flags.
- Use service-to-service authentication and least-privilege scopes for course, content and model dependencies.

### 7.3 WebSocket Hardening

- Require WSS in production.
- Set maximum frame/message size, per-user connection limits, idle timeout and request rate limits.
- Validate event type and schema; reject unknown message types by default.
- Use origin checks as a defense-in-depth control, not as a substitute for authentication.
- Apply heartbeat/ping policy and bounded connection lifetime where required.
- Protect against token leakage in URL/access logs if query-string credentials are unavoidable; prefer a secure short-lived handshake approach.

### 7.4 AI Safety and Prompt Security

- Treat retrieved content and learner messages as untrusted input; course text must not override system security instructions.
- Constrain retrieval to approved course content and authorized course scope.
- Do not include secrets, hidden prompts or internal tool credentials in model context.
- Use prompt-injection defenses and output checks appropriate to the use case.
- Provide uncertainty behavior when evidence is absent or conflicting; do not fabricate citations.
- Define prohibited content and escalation behavior with product/content governance owners.

### 7.5 Privacy

Before production, obtain approval for learner notices, consent where required, data residency, provider processing terms, retention/deletion, access to transcripts and incident response. The technical design should minimize personal data in prompts and telemetry.

## 8. Failure Handling and Resilience

| Failure | System behavior | Client behavior / recovery |
|---|---|---|
| Eligibility service unavailable | Fail closed for entry/session creation; record dependency error. | Hide CTA or show temporary unavailable state; retry eligibility with backoff. |
| Enrollment service unavailable | Do not assume access; do not create session. | Show access check temporarily unavailable; retry. |
| JWT invalid/expired | Reject handshake or operation before message processing. | Re-authenticate or request a fresh scoped credential. |
| Enrollment/feature revoked mid-session | Deny new messages and close/disable session per policy. | Show access changed message and return to course page. |
| WebSocket drops | Server expires stale connection; preserve persisted state. | Reconnect with bounded backoff and fresh auth. |
| Duplicate client request | Deduplicate by requestId or return prior status when possible. | Use same requestId for retry only when contract guarantees idempotency. |
| Retrieval timeout/no evidence | Use approved fallback or disclose insufficient context. | Show a useful response/clarifying question, not fabricated sources. |
| LLM timeout/429/5xx | Apply bounded retry, circuit breaker and budget policy. | Show retryable error without duplicate side effects. |
| Store write failure | Follow explicit consistency policy; mark response persistence status accurately. | Do not claim transcript was saved if write failed. |
| Telemetry outage | Chat path should continue unless audit policy requires fail-closed behavior. | No learner-facing interruption; alert ops when pipeline recovers. |

## 9. Deployment and Operations

### 9.1 Deployment Topology

```
Browser → Existing iGOT Portal / API Gateway
                 ├─ REST → AI Tutor Application
                 └─ WSS  → WebSocket-capable Gateway / AI Tutor Application
AI Tutor Application → Identity/JWKS, Course/Enrollment APIs, Content Retrieval, LLM Provider
AI Tutor Application → Session/Message Store + Telemetry/Monitoring
```

### 9.2 Environment Configuration

- Separate development, test/staging and production credentials and endpoints.
- Configure trusted JWT issuer, audience, key source and allowed algorithms outside source code.
- Configure WSS origin policy, connection/frame limits, idle timeout and rate limits.
- Configure model provider, model identifier, token/cost limits, request timeout and retry policy.
- Configure retrieval index/content sources and course authorization mapping.
- Configure retention period, data encryption and transcript access roles.
- Use feature flags/kill switch and safe defaults; changes must be auditable.

### 9.3 Scaling Considerations

- Estimate concurrent connections, message rate, response duration and model throughput before choosing instance sizes.
- Use shared session/persistence state when connections may land on different instances.
- Validate gateway idle timeouts and connection draining during deployments.
- Apply per-user and global concurrency limits to protect model spend and platform availability.
- Scale retrieval and model adapter independently if measurements show they are bottlenecks.

### 9.4 Rollout Strategy

1. Phase 0: repository and platform capability verification.
2. Phase 1: development integration using test identity/course data and mocked model/retrieval dependencies.
3. Phase 2: staging end-to-end tests including valid/invalid JWT, enrollment denial, socket reconnect and provider failures.
4. Phase 3: limited cohort/course pilot with feature flag and daily quality/cost review.
5. Phase 4: expand only after security, quality, latency, accessibility and cost gates are met.
6. Rollback: disable new tutor sessions via kill switch; preserve core portal and course player functionality.

## 10. Observability

| Signal | Suggested measurements | Notes |
|---|---|---|
| Connection | handshake success/failure, concurrent sockets, disconnect reason, reconnect rate | Segment by environment/client version; never log token. |
| Latency | eligibility latency, session-create latency, first-token latency, end-to-end latency | Use percentiles and agreed SLOs; include model/retrieval breakdown. |
| Quality | retrieval hit rate, citation coverage/validity, evaluation scores, learner feedback | Use a curated evaluation set and privacy-approved feedback collection. |
| Cost | tokens/request, cost/session, retries, provider usage | Apply per-user/session quotas and budget alerts. |
| Security | invalid JWT, forbidden session access, rate-limit hits, malformed payloads | Alert on anomalous patterns; avoid logging sensitive payloads. |
| Reliability | dependency errors, timeout rates, circuit-breaker state, persistence failures | Dashboards and on-call alerts for production pilot. |

Numeric SLO targets are intentionally left as decisions for the product/platform owners. Define them before pilot, then validate under representative load.

## 11. Test Design

| Test layer | Coverage | Examples |
|---|---|---|
| Unit | Eligibility policy, enum/schema validation, JWT claim mapping, state machine, error mapping | Feature disabled; invalid style; expired token; duplicate requestId. |
| Component/contract | Course adapter, enrollment API, retrieval/model adapters, REST and WebSocket schemas | Enrollment timeout; provider 429; unknown event type. |
| Integration | Portal login to CTA; session creation; socket auth; player transcript and streaming | Eligible enrolled learner end-to-end; wrong session owner denied. |
| Security | Authentication bypass, token leakage, replay, IDOR, injection, rate limiting | Swap sessionId/courseId; expired token on reconnect; oversized frames. |
| Performance | Concurrent sockets, long sessions, burst messages, slow model responses | Load test agreed concurrent learner target and gateway timeout behavior. |
| AI quality | Grounding, style fidelity, source correctness, uncertainty, prompt injection | Course-specific question with/without retrieved evidence. |
| Accessibility/usability | Keyboard flow, labels, focus, status announcements, mobile layout | Screen-reader announces connection and completion states. |
| Resilience | Dependency outages, reconnect, deployment drain, store/telemetry failure | Model timeout; content index unavailable; graceful rollout restart. |

## 12. Requirement Traceability

| SRS / journey area | Design elements | Primary verification |
|---|---|---|
| FR-001–002: login/auth | C-01, C-05, C-07 | Unit + integration auth tests |
| FR-003–005: eligibility | C-01, C-03, C-05 | Feature-on/off and fail-closed tests |
| FR-006–007: enrollment | C-04, C-05, C-08 | Enrolled, not-enrolled and timeout tests |
| FR-008–011: player/style/session | C-02, C-05, C-09 | UI/style/session integration tests |
| FR-012–016: WebSocket/JWT | C-06, C-07, C-08 | Handshake and authorization security tests |
| FR-017–023: messaging/orchestration | C-06, C-09, C-10, C-11 | Contract, streaming, grounding and timeout tests |
| FR-024–030: persistence/ops/errors | C-12, C-13 plus resilience policies | Retention, telemetry, reconnect, kill-switch tests |

## 13. Implementation Plan

| Phase | Work items | Exit gate |
|---|---|---|
| 1. Repository discovery | Map routes/components, auth/session handling, course/enrollment APIs, player extension points, gateway and deployment. | Repository-verified architecture and interface inventory approved. |
| 2. Contract and threat review | Finalize REST/socket schemas, JWT strategy, threat model, data retention and access policy. | Security/platform/product sign-off. |
| 3. Portal integration | Add eligibility adapter and conditional CTA to discovery/course pages. | Feature flag and direct-access tests pass. |
| 4. Player and session | Implement tutor panel, style selector, session API and course access validation. | Enrolled/eligible learner flow passes in staging. |
| 5. Socket and orchestration | Implement WSS, JWT validation, event schema, retrieval/model adapters and persistence. | End-to-end streaming and negative auth tests pass. |
| 6. Pilot readiness | Load/security/accessibility tests, dashboards, runbooks, cost limits and rollback. | Go/no-go criteria approved; kill switch tested. |

## 14. Open Decisions

- What are the exact existing routes, components and extension points in the deployed portal branch?
- Which auth/session mechanism and JWT issuer/audience should the tutor backend trust?
- Will WebSocket credentials use a short-lived scoped token, secure cookie or another approved mechanism?
- What are the authoritative course and enrollment endpoints and service-to-service auth requirements?
- Where is approved course content stored, and how will retrieval respect course/learner permissions?
- Which LLM provider/model and model-data processing configuration are approved?
- What are the retention, deletion, privacy notice and transcript access rules?
- What are pilot targets for concurrent connections, first-token latency, end-to-end latency, availability and cost?
- What are the supported browser/device matrix, accessibility target and operational support ownership?

## Appendix A — Example Payloads

### A.1 Client WebSocket message

```
{
  "type": "chat.message",
  "requestId": "uuid",
  "sessionId": "opaque-session-id",
  "message": "Explain this concept",
  "learningStyle": "SOCRATIC"
}
```

### A.2 Streaming event

```
{
  "type": "chat.delta",
  "requestId": "uuid",
  "sequence": 2,
  "delta": "Let us reason through this..."
}
```

### A.3 Completion event

```
{
  "type": "chat.completed",
  "requestId": "uuid",
  "answer": "…",
  "citations": [{"title": "Module 2", "contentRef": "content-id"}]
}
```

### A.4 Error event

```
{
  "type": "chat.error",
  "requestId": "uuid",
  "code": "MODEL_TIMEOUT",
  "message": "Please try again.",
  "retryable": true
}
```

End of document.
