# Karma Points — Software Requirements Specification (SRS)

## Karma Points, Karma Coins, and Karma Wallet Ecosystem

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for the dual-currency Karma Points, Karma Coins, and Karma Wallet subsystem on the iGOT Karmayogi Bharat platform. It serves as the contractual and technical specification for Product Owners, Solution Architects, Backend Engineers, Frontend Engineers, Data Engineers, and QA Engineers.

### 1.2 Scope

The scope encompasses:

- **Karma Points (KP):** Ingestion, rule calculation, storage, idempotent deduplication, running summary aggregation, and gamification display.
- **Karma Coins (KC):** Generation via point conversion, monthly cap enforcement, balance tracking, and audit logging.
- **Karma Wallet:** User interface access, balance calculation, transactional conversion execution, and ledger management.
- **Marketplace Integration:** Prerequisite checking, course redemption, exemption bypass, and error/shortfall handling.
- **Gamification & Leaderboard Integration:** Invariance guarantees and data source isolation.
- **Data Pipelines & Reconciliation:** Asynchronous Flink event ingestion, Cassandra Lightweight Transactions (LWT/Paxos), and batch backfill recovery.

Out of scope: Fiat currency purchases, peer-to-peer coin transfers, cryptocurrency integrations, and external third-party payment gateways.

### 1.3 Definitions, Acronyms, and Abbreviations

- **ACBP:** Annual Capacity Building Plan (mandated civil service training plans).
- **CAS:** Compare-And-Swap (Cassandra Lightweight Transactions).
- **CBP:** Capacity Building Plan.
- **IEEE 29148:** International standard for requirements engineering.
- **KC:** Karma Coin(s) (spendable utility currency).
- **KP:** Karma Point(s) (non-diminishing recognition points).
- **LMS:** Learning Management System.
- **LWT:** Lightweight Transaction (Paxos-based consensus in Cassandra).
- **MDO:** Ministry, Department, and Organization.
- **NPCSCB:** National Programme for Civil Services Capacity Building (Mission Karmayogi).
- **SPV:** Special Purpose Vehicle (Karmayogi Bharat entity).
- **TBD:** To Be Determined (indicates an unverified or pending stakeholder specification).
- **TOC:** Table of Contents (Course overview/landing page).

### 1.4 References

1. **ISO/IEC/IEEE 29148:2018:** Systems and software engineering — Requirements engineering.
2. **Jira Epics & Issues:** `KB-15254`, `KB-15271`, `KB-15294`, `KB-15296`, `KB-15297`, `KB-15298`, `KB-15299`, `KB-15300`, `KB-15301`, `KB-443`, `KB-464`, `KB-465`, `KB-468`, `KB-15698`, `KB-14235`, `KB-2122`, `KB-2933`, `KB-5808`, `KB-7462`, `KB-15036`, `KB-15347`, `KB-12140`.
3. **Confluence Specifications:**
  - *Karma Points Data Model* (`Page 31031297`)
  - *FRS Karma Points* (`Page 6750572`)
  - *BRD Learner Leaderboard based on Karma Points* (`Page 36929736`)
  - *Total Karma Points API* (`Page 71467044`)
  - *Karma Points Consumption APIs* (`Page 30408705`)
  - *Karma Points V1 to V2 and Karma Coins* (`Page 1253441539`)
  - *Karma Coin Wallet Technical Design* (`Page 1214906388`)
  - *Q13 BRD Karma Wallet* (`Page 1188134918`)
  - *Design Document: Reconciliation of Missed First Enrollment* (`Page 1148485633`)

### 1.5 Document Overview

Section 2 provides the overall system description. Section 3 defines specific functional and business requirements using testable "shall" statements. Section 4 defines non-functional requirements. Section 5 presents the complete verification traceability matrix.

## 2. Overall Description

### 2.1 Product Perspective

The Karma subsystem is a component of the iGOT Karmayogi Bharat digital learning platform. It interfaces with:

- **Learner Web and Mobile Portals:** Presentation layer for badges, counters, wallets, and course checkouts.
- **LMS and Assessment Services:** Event producers publishing completion and rating signals.
- **Apache Kafka & Flink Streaming Tier:** Ingestion and stream processing engine.
- **Apache Cassandra:** Authoritative persistence tier for ledgers, summaries, and lookups.
- **Redis Cache:** Low-latency caching tier for spendable balances.
- **Marketplace Service:** Third-party course catalog and partner license coordinator.

### 2.2 Product Functions

- Award permanent, non-diminishing Karma Points for discrete learning milestones.
- Convert eligible Karma Points to spendable Karma Coins at a fixed 1:1 ratio within a 300 KP monthly calendar cap.
- Manage spendable Karma Coins with no expiration date and unlimited carry-over.
- Enforce atomic, full-tender redemption of Karma Coins against Marketplace courses.
- Provide an immutable, append-only transaction audit ledger for all coin minting and redemption.
- Maintain complete data and calculation isolation between spendable coin actions and gamification/leaderboard standings.

### 2.3 User Classes and Characteristics

- **Civil Service Learner:** Primary end-user. Earns points, converts points to coins, monitors running balances, and redeems coins for courses. Requires clear visibility into conversion caps and shortfall math.
- **MDO Administrator:** Monitors departmental competency rollups via Leaderboards and the Wall of Fame.
- **Marketplace SPV Partner / Admin:** Configures course coin multipliers, sets Minimum Karma Points gating thresholds, and maintains exempt learner rosters.
- **Platform Operations / Data Engineer:** Monitors Cassandra/Flink streaming health and executes automated backfills for missed points.

### 2.4 Operating Environment

- Distributed cloud environment operating Linux containerized microservices managed via Kubernetes.
- Message bus: Apache Kafka (unified topic topology).
- Stream processor: Apache Flink (version TBD).
- Datastores: Apache Cassandra 3.11/4.x (Keyspace: `sunbird`) and Redis 6.x/7.x.
- Client browsers: Modern evergreen desktop and mobile browsers (Chrome, Edge, Firefox, Safari) and mobile PWA/wrapper.

### 2.5 Design and Implementation Constraints

- **CON-01:** Indivisibility — Balances and transactions shall operate strictly in non-negative whole integers (). Fractional points or coins are prohibited.
- **CON-02:** Monotonicity — Lifetime earned Karma Points (`total_points`) shall never decrement under any normal operational condition.
- **CON-03:** Distributed Consistency — Point conversion shall execute synchronously with ACID guarantees using Cassandra Lightweight Transactions (Paxos LWT). Points earning shall operate asynchronously under eventual consistency.
- **CON-04:** Data Store Schema Constraints — Cassandra counter columns cannot be combined with regular update columns in the same table; therefore, read-modify-write or Paxos conditional updates are mandatory for summary tables.

### 2.6 Assumptions and Dependencies

- **ASM-01:** System clocks across API Gateway, microservices, and Cassandra cluster nodes are synchronized via NTP (UTC).
- **ASM-02:** Calendar months strictly follow UTC `YYYY-MM-01 00:00:00` to `YYYY-MM-LastDay 23:59:59`.
- **DEP-01:** Authentication tokens supply a cryptographically verified `userId` and associated organization identifier.

## 3. Specific Requirements

### 3.1 Functional Requirements: Karma Points Engine

#### 3.1.1 Earning and Calculation Rules

- **FR-KP-001:** The system shall award a flat to a learner upon verified first login following self-registration.
- **FR-KP-002:** The system shall award a flat to a learner upon verified first course enrolment across the platform lifetime.
- **FR-KP-003:** The system shall award for each completed non-mandated course, up to a maximum cap of four (4) completed non-mandated courses per calendar month.
- **FR-KP-004:** The system shall award for any non-mandated course completed after the four-course monthly quota has been reached in that calendar month.
- **FR-KP-005:** The system shall award a flat when a learner achieves a passing score on a final course assessment.
- **FR-KP-006:** The system shall evaluate and award assessment mastery points (FR-KP-005) independently of the monthly non-mandated completion cap.
- **FR-KP-007:** The system shall award a flat when an enrolled learner submits a valid rating for a course.
- **FR-KP-008:** The system shall enforce that course rating points are awarded at most once per user per course.
- **FR-KP-009:** The system shall award a flat for completing an ACBP-mandated course on or before the departmental due date.
- **FR-KP-010:** The system shall award ACBP completion points regardless of whether the learner has reached the monthly 4-course non-mandated completion cap.
- **FR-KP-011:** When an ACBP course is completed after the departmental due date, the system shall calculate points according to the penalty formula:
- **FR-KP-012:** If an ACBP course is completed ten (10) or more calendar months after the due date, the system shall award for ACBP completion.
- **FR-KP-013:** The system shall provide an API endpoint (`POST /apis/proxies/v8/claimkarmapoints/`) enabling learners to retroactively claim ACBP points for courses completed prior to departmental ACBP assignment.
- **FR-KP-014:** The system shall award a flat to an enrolled learner upon verified attendance of a live event or webinar.
- **FR-KP-015:** The system shall award to learners viewing recorded sessions post-event, while allowing standard certificate generation.

#### 3.1.2 Persistence, Deduplication, and Totals

- **FR-KP-016:** The system shall record every point credit event as an immutable row in Cassandra table `sunbird.user_karma_points`.
- **FR-KP-017:** Prior to writing a point credit, the system shall check `sunbird.user_karma_points_credit_lookup` using composite key `userid|context_type|context_id` and clustering key `operation_type`. If a record exists, the event shall be dropped as a duplicate.
- **FR-KP-018:** The system shall maintain the learner's cumulative lifetime earned points in `sunbird.user_karma_points_summary.total_points`.
- **FR-KP-019:** The system shall expose `POST /apis/proxies/v8/user/totalkarmapoints` to return `total_points` for display in the header and profile.
- **FR-KP-020:** The system shall reflect awarded Karma Points on learner profile and header interfaces within a maximum SLA of 4 hours post-event.

### 3.2 Functional Requirements: Karma Coins & Conversion Engine

#### 3.2.1 Conversion Business Logic

- **FR-KC-001:** The system shall allow a learner to convert eligible Karma Points into Karma Coins at a fixed ratio of 1 Karma Point = 1 Karma Coin.
- **FR-KC-002:** The system shall enforce a strict conversion cap of three hundred (300) Karma Points per calendar month per learner.
- **FR-KC-003:** The monthly conversion cap shall be evaluated based on the UTC calendar month (`YYYY-MM`).
- **FR-KC-004:** The system shall reset the available conversion cap allowance to 300 Karma Points at `00:00:00 UTC` on the first calendar day of each month.
- **FR-KC-005:** Unused monthly conversion allowance shall not roll over, accumulate, or carry forward into subsequent calendar months.
- **FR-KC-006:** The system shall allow learners to execute multiple partial conversions within a calendar month, provided the cumulative points converted in that month do not exceed 300 KP.
- **FR-KC-007:** The system shall dynamically calculate the maximum convertible points allowed for a learner as:<br><br>where:
- **FR-KC-008:** The system shall reject any conversion request with an amount less than or equal to zero () or containing non-integer values.
- **FR-KC-009:** The system shall reject any conversion request where the requested points exceed .
- **FR-KC-010:** Point conversion shall be irreversible; the system shall provide no mechanism to convert Karma Coins back into Karma Points.

#### 3.2.2 Balance Management & Currency Lifecycle

- **FR-KC-011:** Converting Karma Points to Karma Coins shall decrement the available unconverted points pool by incrementing `user_karma_coin_wallet.total_earned`.
- **FR-KC-012:** Converting Karma Points to Karma Coins shall leave lifetime earned points (`user_karma_points_summary.total_points`) unchanged.
- **FR-KC-013:** Karma Coins shall have no expiration date and shall remain valid indefinitely across calendar and financial years.
- **FR-KC-014:** Karma Coins shall have unlimited carry-over with no account balance ceiling.
- **FR-KC-015:** The spendable wallet balance shall be calculated as:
- **FR-KC-016:** Converting Karma Points or spending Karma Coins shall have zero mathematical effect on leaderboard scores, MDO rankings, or Wall of Fame standings.

### 3.3 Functional Requirements: Karma Wallet Subsystem

#### 3.3.1 User Interface & Navigation

- **FR-KW-001:** The system shall provide access to the Karma Wallet from three distinct entry points:
  - Learner Homepage "View All Achievements" banner/card.
  - Global Top Navigation Bar via a dedicated Wallet Icon adjacent to the notification bell.
  - Learner Profile menu via "Karma Wallet" link.

- **FR-KW-002:** The system shall render the breadcrumb path on the wallet page as: `Home > Profile > Karma Wallet`.
- **FR-KW-003:** The Karma Wallet summary interface shall display four metric cards:
  - **Card 1:** "Wallet Balance" displaying available spendable Karma Coins (`current_coin_balance`).
  - **Card 2:** "Convertible This Month" displaying remaining convertible points allowance as an integer (`300 - points_converted`).
  - **Card 3:** "Total Converted Karma Coins" displaying cumulative lifetime coins minted (`total_earned`).
  - **Card 4:** "Unconverted Karma Points" displaying cumulative lifetime points awaiting conversion (`total_points - total_earned`).

- **FR-KW-004:** If fetching wallet summary data fails, the system shall render a full-page modal dialog with options to "Refresh Page" or "Go to Homepage".

#### 3.3.2 Transaction Execution & Ledgering

- **FR-KW-005:** The system shall expose `POST /apis/proxies/v8/karmawallet/convert` to process point conversion requests.
- **FR-KW-006:** The conversion API shall require a client-generated UUID `requestId` in the request payload.
- **FR-KW-007:** The system shall record `requestId` in `sunbird.user_karma_coin_lookup`. If a request with an existing `requestId` is submitted, the system shall return the cached response without re-executing mutations.
- **FR-KW-008:** The system shall execute point conversion as an atomic batch transaction across `user_karma_coin_monthly_summary`, `user_karma_coin_wallet`, `user_karma_coin_transactions`, and `user_karma_coin_lookup` using Cassandra Lightweight Transactions (LWT).
- **FR-KW-009:** Every coin credit (conversion) and debit (redemption) shall append an immutable record to `sunbird.user_karma_coin_transactions`.
- **FR-KW-010:** Each transaction record shall include: `userid`, `transaction_date`, unique `transaction_id` (`TXN-XXXXXX`), `transaction_type` (`EARNED` or `REDEEMED`), `amount`, `balance_after`, `context_type`, `context_id`, and `context_name`.
- **FR-KW-011:** The system shall guarantee that `balance_after` in the transaction record strictly equals the post-commit spendable balance.
- **FR-KW-012:** The system shall expose `GET /apis/proxies/v8/karmawallet/transactions` supporting lazy-loading and filtering across three tabs: "All", "Earned", and "Redeemed".
- **FR-KW-013:** The system shall support history filtering by: Recent (last 30 days), Current Month, Last Month, Last 3 Months (excluding current), Last 6 Months (excluding current), and Custom Date Range.
- **FR-KW-014:** The system shall reject custom date range queries specifying a lookback period greater than one (1) year from the current date.
- **FR-KW-015:** If no transactions exist for a selected date filter, the system shall display: *"No transactions found for the selected date range. Please try a different date range."*

### 3.4 Functional Requirements: Marketplace Redemption

#### 3.4.1 Eligibility & Pricing

- **FR-MP-001:** The system shall support configuration of a Partner Multiplier (integer , ) per SPV Marketplace Partner.
- **FR-MP-002:** The system shall compute the Marketplace Course Price in Karma Coins as:
- **FR-MP-003:** The system shall support configuration of a Minimum Karma Points threshold per partner or course.
- **FR-MP-004:** The system shall block checkout and prevent enrolment if the learner's lifetime earned points (`total_points`) do not meet or exceed the configured Minimum Karma Points threshold, irrespective of the learner's coin balance.
- **FR-MP-005:** The system shall maintain an approved Partner Exemption List containing exempt learner/organization identifiers.
- **FR-MP-006:** When an exempt learner enrols in a Marketplace course, the system shall provision access at zero () coin cost.
- **FR-MP-007:** The system shall NOT debit coins, reserve balance, or create rows in `user_karma_coin_transactions` for exempt course enrolments.
- **FR-MP-008:** The system shall record exempt enrolments in an external platform audit trail store outside the learner wallet ledger.

#### 3.4.2 Checkout, Deductions, and Shortfall Handling

- **FR-MP-009:** The system shall enforce full coin tender for non-exempt Marketplace course enrolments; partial payment, split tender, and co-pay options are prohibited.
- **FR-MP-010:** When an eligible learner confirms enrolment and holds sufficient coins (), the system shall atomically debit the course price from `user_karma_coin_wallet` and append a `REDEEMED` transaction record.
- **FR-MP-011:** Upon successful coin debit, the system shall trigger course provisioning in the LMS.
- **FR-MP-012 (Case B1):** If `current_coin_balance < Course Price` and the remaining monthly convertible points can cover the shortfall:<br><br>the system shall block checkout and render an actionable prompt enabling direct conversion of points to coins within the course context.
- **FR-MP-013:** Upon successful completion of Case B1 in-modal conversion, the system shall update the coin balance and automatically complete course enrolment.
- **FR-MP-014 (Case B2):** If `current_coin_balance < Course Price` and remaining monthly convertible points are greater than zero but cannot cover the full shortfall:<br><br>the system shall block checkout and notify the learner of the residual coin shortfall.
- **FR-MP-015 (Case C):** If `current_coin_balance < Course Price` and , the system shall block checkout and notify the learner that the conversion allowance has been exhausted for the current month or that points are insufficient.
- **FR-MP-016:** If checkout is blocked due to insufficient balance, the system shall execute zero balance mutations, place no reservations on coins, and write no transaction rows.

### 3.5 Functional Requirements: Pipeline Processing & Reconciliation

- **FR-PR-001:** The system shall ingest all Karma Point-earning domain events through a unified Kafka topic (`dev.karma.points.unified.request`).
- **FR-PR-002:** The Flink stream processor shall partition events using `keyBy(userId)` to ensure sequential, race-free processing per learner.
- **FR-PR-003:** In the event of unrecoverable stream processing failures, the system shall route failed events to a dead-letter queue topic (`dev.karma.points.failed`).
- **FR-PR-004:** The system shall emit a `POINTS_CONVERSION` event to Kafka post-commit following successful point-to-coin conversion to trigger downstream cache invalidation.
- **FR-PR-005:** The system shall provide an automated batch reconciliation script to detect first course enrolments present in LMS logs that lack a corresponding record in `user_karma_points_credit_lookup`.
- **FR-PR-006:** The reconciliation engine shall retroactively insert missing first enrolment records into `user_karma_points`, create the deduplication key in `user_karma_points_credit_lookup`, and increment `user_karma_points_summary.total_points`.

## 4. Non-Functional Requirements

### 4.1 Performance Requirements

- **NFR-PERF-001:** Point Conversion Response Time — The system shall execute `POST /apis/proxies/v8/karmawallet/convert` (including Cassandra LWT execution) with a 95th percentile response time of less than **800 ms** under peak concurrent load of 500 requests/sec.
- **NFR-PERF-002:** Wallet Summary Latency — The system shall return `GET /apis/proxies/v8/karmawallet/summary` with a 99th percentile response time of less than **300 ms** by leveraging Redis caching.
- **NFR-PERF-003:** Points Earning Throughput — The Flink streaming pipeline shall sustain an ingestion and processing throughput of at least **2,000 events/sec** without backpressure.
- **NFR-PERF-004:** Balance Display SLA — Points earned from verified learning activities shall be persisted and available for retrieval by balance APIs within **4 hours** of event generation.

### 4.2 Security and Access Control Requirements

- **NFR-SEC-001:** Authentication Verification — Every request to Points, Wallet, and Redemption endpoints shall be authenticated via a cryptographically valid bearer token.
- **NFR-SEC-002:** Tenant & Identity Scoping — The system shall verify that the `userId` in the route or payload matches the authenticated token context; cross-user balance queries or conversion mutations shall be rejected with HTTP 403 Forbidden.
- **NFR-SEC-003:** Input Sanitization — The conversion API shall reject payloads containing SQL/CQL injection sequences, negative values, fractional amounts, or string-encoded numbers.

### 4.3 Data Integrity and Consistency Requirements

- **NFR-DAT-001:** Paxos Atomicity — Conversions shall use Cassandra Lightweight Transactions (`APPLY BATCH`) ensuring that `user_karma_coin_monthly_summary`, `user_karma_coin_wallet`, and `user_karma_coin_transactions` commit atomically or fail entirely.
- **NFR-DAT-002:** Audit Trail Immutability — Rows written to `sunbird.user_karma_points` and `sunbird.user_karma_coin_transactions` shall be strictly append-only; update (`UPDATE`) and delete (`DELETE`) operations on transaction rows are prohibited.
- **NFR-DAT-003:** Balance Invariant — The system shall guarantee at all times:
- **NFR-DAT-004:** Leaderboard Isolation — Leaderboard batch queries shall read exclusively from `user_karma_points`; zero reads or joins against `user_karma_coin_*` tables shall be permitted in gamification services.

### 4.4 Reliability, Availability, and Fault Tolerance

- **NFR-REL-001:** High Availability — The Karma Points and Wallet microservices shall maintain an uptime availability of **99.9%** excluding scheduled maintenance windows.
- **NFR-REL-002:** Idempotent Ingress — All API mutations and Kafka event handlers shall be strictly idempotent; duplicate deliveries shall cause zero unintended state mutations.
- **NFR-REL-003:** Cassandra Partition Bounding — To prevent tombstone and latency degradation, history queries shall enforce a 1-year lookback bounding limit.

## 5. Verification and Traceability Matrix

The matrix below maps each requirement to its business origin, technical implementation, and verification method.

*Verification Methods:*

- **T:** Test (Automated functional, integration, or performance test)
- **A:** Analysis (Architectural proof, static code review, or mathematical reconciliation)
- **I:** Inspection (Visual inspection of UI/schema DDL)
- **D:** Demonstration (End-to-end user workflow execution)

| Req ID | Requirement Summary | Business Rule / AC Origin | Source Jira / Spec Document | Verification Method |
|---|---|---|---|---|
| **FR-KP-001** | First Login Points (+5) | `BR-01`, `AC-01` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-002** | First Enrolment Points (+5) | `BR-02`, `AC-02` | `KB-464`, `KB-14235` | **T** |
| **FR-KP-003** | Course Completion Cap (/mo) | `BR-03`, `AC-03` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-004** | Completion Points Beyond Cap (+0) | `BR-03`, `AC-04` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-005** | Assessment Mastery Points (+5) | `BR-04`, `AC-05` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-006** | Assessment Cap Independence | `BR-04`, `AC-06` | `KB-464`, `FRS Karma Points` | **A** |
| **FR-KP-007** | Course Rating Points (+2) | `BR-05`, `AC-07` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-008** | Rating Points Deduplication | `BR-05`, `AC-08` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-009** | ACBP On-Time Completion (+10) | `BR-06`, `AC-09` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-010** | ACBP Bypass of Monthly Cap | `BR-06`, `AC-10` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-011** | ACBP Late Penalty Formula | `BR-06`, `AC-11` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-012** | ACBP 10-Month Delay Expiry (0 KP) | `BR-06`, `AC-12` | `KB-464`, `FRS Karma Points` | **T** |
| **FR-KP-013** | Retroactive ACBP Claim API | `BR-07`, `AC-13` | `KB-464`, `Karma Points APIs` | **T** |
| **FR-KP-014** | Live Event Attendance Points (+10) | `BR-08`, `AC-14` | `KB-7462`, `KB-7116` | **T** |
| **FR-KP-015** | Event Recording View Gate (0 KP) | `BR-08`, `AC-15` | `KB-7462` | **T** |
| **FR-KP-016** | Points Ledger Storage | `BR-09`, `AC-16` | `KB-465`, Confluence `31031297` | **I** |
| **FR-KP-017** | Idempotency Lookup Guard | `BR-09`, `AC-17` | `KB-465`, Confluence `31031297` | **T** |
| **FR-KP-018** | Running Summary `total_points` | `BR-10`, `AC-18` | `KB-465`, Confluence `31031297` | **T** |
| **FR-KP-019** | Total Karma Points API | `BR-10`, `AC-19` | `KB-789`, Confluence `71467044` | **T** |
| **FR-KP-020** | Points Reflection 4h SLA | `BR-11`, `AC-20` | `FRS Karma Points` | **T** |
| **FR-KC-001** | Conversion Ratio (1 KP = 1 KC) | `BR-02.1`, `AC-02.7` | `KB-15296`, Confluence `1188134918` | **T** |
| **FR-KC-002** | 300 KP Monthly Conversion Cap | `BR-02.2`, `AC-02.11` | `KB-15296`, Confluence `1188134918` | **T** |
| **FR-KC-003** | UTC Calendar Month Reset | `BR-02.3`, `AC-02.19` | `KB-15296`, Confluence `1214906388` | **T** |
| **FR-KC-004** | Cap Reset on 1st of Month | `BR-02.4`, `AC-02.19` | `KB-15296` | **T** |
| **FR-KC-005** | No Unused Cap Rollover | `BR-02.4`, `AC-02.12` | `KB-15296` | **A** |
| **FR-KC-006** | Multiple Conversions in Month | `BR-02.5`, `AC-02.13` | `KB-15296` | **D** |
| **FR-KC-007** | Max Convertible Formula | `BR-02.5`, `AC-02.4` | `KB-15296`, Stage 2 Model | **T** |
| **FR-KC-008** | Positive Integer Input Only | `BR-02.6`, `AC-02.25` | `KB-15296` | **T** |
| **FR-KC-009** | Rejection of Over-Cap Amount | `BR-02.6`, `AC-02.14` | `KB-15296` | **T** |
| **FR-KC-010** | One-Way Irreversible Conversion | `BR-02.8`, `AC-02.26` | `KB-15296` | **A** |
| **FR-KC-011** | Unconverted Pool Decrement | `BR-01.4`, `AC-02.18` | `KB-15296` | **T** |
| **FR-KC-012** | Lifetime KP Invariance | `BR-01.1`, `AC-02.18` | `KB-15296` | **A** |
| **FR-KC-013** | Infinite Coin Expiration | `BR-03.5`, `AC-03.15` | `KB-15297` | **A** |
| **FR-KC-014** | Unlimited Coin Carry-Over | `BR-03.5`, `AC-03.16` | `KB-15297` | **A** |
| **FR-KC-015** | Spendable Balance Equation | `BR-01.3`, `AC-01.9` | `KB-15294`, Confluence `1214906388` | **T** |
| **FR-KC-016** | Leaderboard Invariance Guarantee | `BR-02.7`, `AC-03.7` | `BRD Learner Leaderboard` | **A** |
| **FR-KW-001** | 3 Wallet Entry Points | `AC-01.1–3` | `KB-15294` | **I** |
| **FR-KW-002** | Breadcrumb Specifications | `AC-01.4` | `KB-15294` | **I** |
| **FR-KW-003** | 4 Summary Metric Cards | `AC-01.9–12` | `KB-15294` | **I** |
| **FR-KW-004** | Summary Error State Modal | `AC-01.13` | `KB-15294 Comment 90064` | **T** |
| **FR-KW-005** | Convert API Endpoint | `AC-02.1` | `KB-15296`, Confluence `1214906388` | **T** |
| **FR-KW-006** | RequestId in Payload | `AC-02.21` | `KB-15296` | **T** |
| **FR-KW-007** | Idempotency Lookup Table | `AC-02.21` | `KB-15296` | **T** |
| **FR-KW-008** | Atomic LWT Batch Execution | `AC-02.20` | `KB-15296`, Confluence `1214906388` | **T** |
| **FR-KW-009** | Append-Only Coin Ledger | `AC-04.1` | `KB-15298` | **I** |
| **FR-KW-010** | Transaction Schema & TXN ID | `AC-04.5–10` | `KB-15298` | **I** |
| **FR-KW-011** | Balance After Integrity | `AC-04.11` | `KB-15298` | **T** |
| **FR-KW-012** | Transactions Filter Tabs | `AC-04.2–4` | `KB-15298` | **I** |
| **FR-KW-013** | 6 Date Filter Presets | `AC-05.1–7` | `KB-15299` | **T** |
| **FR-KW-014** | 1-Year Lookback Bound | `BR-05.3`, `AC-05.8` | `KB-15299` | **T** |
| **FR-KW-015** | Empty History Copy Message | `AC-05.9` | `KB-15298 Comment 90065` | **I** |
| **FR-MP-001** | Partner Multiplier () | `BR-04.1` | `KB-15347` | **T** |
| **FR-MP-002** | Course Price Equation | `BR-04.2` | `KB-15347` | **T** |
| **FR-MP-003** | Minimum KP Gate Setting | `BR-04.3` | `KB-12140`, `KB-15036` | **I** |
| **FR-MP-004** | Minimum KP Gate Enforcement | `BR-04.4` | `KB-12140` | **T** |
| **FR-MP-005** | Exemption List Configuration | `BR-03.3`, `AC-03.9` | `KB-15297` | **I** |
| **FR-MP-006** | Exempt 0 Coin Enrolment | `BR-03.3`, `AC-03.9` | `KB-15297` | **T** |
| **FR-MP-007** | Zero Debit / No Ledger for Exempt | `AC-03.10` | `KB-15297` | **T** |
| **FR-MP-008** | External Exempt Audit Trail | `AC-03.13` | `KB-15297 Comment 90066` | **A** |
| **FR-MP-009** | Full Coin Tender Only | `BR-03.9`, `AC-03.30` | `KB-15297` | **I** |
| **FR-MP-010** | Atomic Coin Debit | `BR-03.2`, `AC-03.2` | `KB-15297`, Confluence `1214906388` | **T** |
| **FR-MP-011** | LMS Enrolment Trigger | `AC-03.3` | `KB-15297` | **T** |
| **FR-MP-012** | Case B1 Shortfall Prompt | `AC-03.22a` | `KB-15297` | **D** |
| **FR-MP-013** | In-Modal Conversion & Enrol | `AC-02.10a` | `KB-15297` | **D** |
| **FR-MP-014** | Case B2 Residual Shortfall | `AC-03.22b` | `KB-15297` | **D** |
| **FR-MP-015** | Case C Cap Exhausted Prompt | `AC-03.26–28` | `KB-15297` | **D** |
| **FR-MP-016** | Zero State Mutation on Failure | `BR-03.10`, `AC-03.29` | `KB-15297` | **T** |
| **FR-PR-001** | Unified Ingress Topic | Architecture V2 | `KB-15698`, Confluence `1007583244` | **I** |
| **FR-PR-002** | Flink `keyBy(userId)` | Architecture V2 | `KB-15698`, Confluence `1253441539` | **A** |
| **FR-PR-003** | Dead Letter Queue Handling | Architecture V2 | Confluence `1007583244` | **T** |
| **FR-PR-004** | Conversion Event Invalidation | Event Spec | Confluence `1253441539` | **T** |
| **FR-PR-005** | Batch Reconciliation Query | Remediation Spec | `KB-14235`, Confluence `1148485633` | **T** |
| **FR-PR-006** | Backfill State Repair | Remediation Spec | `KB-14235`, Confluence `1148485633` | **T** |
| **NFR-PERF-001** | Conversion Latency (<800ms) | Architecture LWT | Stage 3 Performance SLA | **T** |
| **NFR-PERF-002** | Summary Latency (<300ms) | Architecture Cache | Stage 3 Performance SLA | **T** |
| **NFR-PERF-003** | Flink Throughput (2000 evt/s) | Architecture Stream | Stage 3 Performance SLA | **T** |
| **NFR-PERF-004** | 4-Hour Display SLA | Business Target | `FRS Karma Points` | **T** |
| **NFR-SEC-001** | Bearer Token Authentication | Platform Security | Stage 3 Security Baseline | **T** |
| **NFR-SEC-002** | User Identity Scoping | Data Governance | `KB-15296` Acceptance Criteria | **T** |
| **NFR-SEC-003** | Input Sanitization | Platform Security | `KB-15296` | **T** |
| **NFR-DAT-001** | Cassandra Paxos Atomicity | Transaction Engine | Confluence `1214906388` | **T** |
| **NFR-DAT-002** | Immutable Audit Ledgers | Regulatory Compliance | `KB-465`, `KB-15298` | **I** |
| **NFR-DAT-003** | Balance Invariant Equality | Mathematical Engine | Stage 2 Balance Model | **A** |
| **NFR-DAT-004** | Leaderboard Query Isolation | Gamification Design | `BRD Learner Leaderboard` | **A** |
| **NFR-REL-001** | 99.9% Service Uptime | Service Operations | Non-Functional Baseline | **A** |
| **NFR-REL-002** | Idempotent Ingress | Data Reliability | `KB-15296`, `KB-465` | **T** |
| **NFR-REL-003** | 1-Year Partition Bounding | Storage Optimization | `KB-15299` | **T** |
