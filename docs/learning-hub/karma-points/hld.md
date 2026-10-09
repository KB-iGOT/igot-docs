# Karma Points — HLD

Reverse-engineered from `knowledge-platform-jobs`, `sunbird-cb-ext`,
`sunbird-course-service`, `sunbird-lms-service`, `sunbird-cb-portal`,
`sunbird-cb-orgportal`, `sunbird-cb-staticweb`, `sunbird-cb-uiproxy`,
`igot_karmayogi_mobile`, `sunbird-devops`.

## Topology

Karma Points is an **event-sourced ledger**: producers emit, one job writes,
cb-ext reads.

```mermaid
flowchart LR
    subgraph Producers
        CS["course-service - enrol, unenrol, event attended"]
        LMS["lms-service - registration, first login"]
        CBX["sb-cb-ext - rating, event post-consumption, ACBP claim, wallet convert"]
        CERT["collection-certificate-generator - course completion"]
    end

    K1[["Kafka karma.points.unified.v2.event"]]
    K2[["Kafka user.claim.acbp.karma.points (V1 only)"]]
    KC[["Kafka karma.coin.wallet.redeem"]]

    subgraph Flink["knowledge-platform-jobs"]
        V2["karma-points-processor-v2 (keyed per user)"]
        V1["karma-points-persist-processor v1 (7 topics)"]
    end

    Cass[("Cassandra sunbird - user_karma_points, lookup, summary, coin tables")]
    Redis[("Redis - totals, dedup, convert locks")]
    FAIL[["Kafka unified.v2.failed"]]
    PAID[["Kafka user.paid.course.enrolment"]]

    subgraph Read["Read side - sb-cb-ext"]
        KPS["KarmaPointsController"]
        WAL["KarmaCoinWalletController"]
        WOF["WallOfFameController"]
    end

    GW["Kong + uiproxy"]
    Web["portal / orgportal / staticweb"]
    Mob["mobile app"]

    CS --> K1
    LMS --> K1
    CBX --> K1
    CERT --> K1
    CBX --> K2
    CBX -->|"POINTS_CONVERSION"| KC
    K1 --> V2
    KC --> V2
    K2 --> V1
    V2 --> Cass
    V2 --> Redis
    V2 --> FAIL
    V2 --> PAID
    V1 --> Cass
    Cass --> KPS
    Cass --> WAL
    Cass --> WOF
    Redis --> WAL
    GW --> KPS
    GW --> WAL
    GW --> WOF
    Web --> GW
    Mob --> GW
```

## Responsibilities

| Component | Owns | Repo |
|---|---|---|
| `InstructionEventGenerator` (course) | `FIRST_ENROLMENT`, `UNENROLMENT`, `EVENT_ATTENDED` emission | `sunbird-course-service` |
| `InstructionEventGenerator` + `UserBaseActor` (LMS) | Registration and first-login events | `sunbird-lms-service` |
| `KarmaPointsServiceImpl` | History, per-course, total read; ACBP claim emit | `sunbird-cb-ext` |
| `KarmaCoinWalletServiceImpl` | Wallet summary, transactions, convert (validate + lock + emit) | `sunbird-cb-ext` |
| `WallOfFameServiceImpl` | MDO and learner leaderboards | `sunbird-cb-ext` |
| `KarmaPointsProcessorFnV2` + per-event handlers | The only ledger/summary/wallet writer | `knowledge-platform-jobs` |
| `karma-wallet`, `profile-karmapoints`, `karma-leaderboard-v2` | Web UI | `sunbird-cb-portal` |
| `hall-of-fame`, `rank-podium` | Public MDO Hall of Fame | `sunbird-cb-staticweb` |
| `proxies_v8.ts` / Kong routes | Routing and access | `sunbird-cb-uiproxy`, `sunbird-devops` |

## Key design decisions

- **One writer.** Every point and coin write happens in the Flink job, which keys
  the stream by user so its read-before-write dedup and non-atomic summary update
  are ordered per user (V1 relied on parallelism = 1 for the same safety).
- **Event envelope, uneven payloads.** All producers use `{eventType, data, version}`
  but the userId sits in a different place per type — the job's
  `KarmaPointsKeySelector` encodes that map. Fragile, but contained.
- **Wallet is a Kafka round-trip.** cb-ext validates and locks, returns `202`; the
  job applies a frozen conversion plan with a Cassandra LWT claim and Redis dedup.
- **Leaderboards are precomputed.** cb-ext reads tables populated elsewhere; monthly
  refresh is stated in the UI copy.
- **V1 and V2 both deploy.** Different input topics; which producers still feed V1
  cannot be determined from these repos.

See [LLD](lld.md) for tables, state, and flows, and the
[Operations Manual](operations-manual.md) for day-2 support.
