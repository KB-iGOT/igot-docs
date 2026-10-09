# Karma Points — APIs

Verified from `sunbird-cb-ext` (`KarmaPointsController`, `KarmaCoinWalletController`,
`WallOfFameController`), `sunbird-cb-uiproxy` (`proxies_v8.ts`, `whitelistApis.ts`),
`sunbird-devops` (Kong `kong-api/defaults/main.yml`), `sunbird-cb-portal`
(`karma-wallet.service.ts`), `igot_karmayogi_mobile` (`api_endpoints.dart`),
`sunbird-course-service`, `sunbird-lms-service` and `knowledge-platform-jobs`.

Web calls go `portal → /apis/proxies/v8/… → uiproxy → ${KONG_API_BASE}/… → sb-cb-ext`.
Mobile calls Kong directly under `/api/…`. All uiproxy karma entries are
`ROLE.PUBLIC` in the whitelist — authorization is upstream (Kong JWT + ACL).

## Points endpoints (sunbird-cb-ext)

| Method | Kong path → upstream | Headers | Body | Response |
|---|---|---|---|---|
| POST | `/karmapoints/read` → `/v1/karmapoints/read` | `x-authenticated-userid`, `x-authenticated-user-orgid` | `{limit, offset}` (offset = epoch ms cursor) | `{kpList:[…], count}` |
| POST | `/karmapoints/user/course/read` → `/v1/user/course/karmapoints/read` | `x-authenticated-userid` | `{request:{filters:{contextType, contextId}}}` | `{kpList:{row}}` or `{}` |
| POST | `/claimkarmapoints` → `/v1/claimkarmapoints` | none | `{userId, courseId}` | `200`, empty body |
| POST | `/user/totalkarmapoints` → `/v1/user/totalkarmapoints` | `x-authenticated-userid` | none | `{kpList:{summaryRow}}` |

Kong ACLs: `read`, `course/read` → dataAccess, itsmAccess; `claim`, `total` → dataAccess.

## Karma Coin Wallet (sunbird-cb-ext, base `/v1/karmawallet`)

Header `x-authenticated-user-token`; role must be in `karma.coin.wallet.authorized.roles`
(`PUBLIC` in code default; `PUBLIC,VOLUNTEER` in the DevOps env template).

| Method | Path | Request | Success |
|---|---|---|---|
| GET | `/summary` | — | `200` — `walletBalance, totalRedeemed, totalEarnedTillDate, totalKarmaPoints, unredeemedKarmaPoints, yearMonth, monthlyCap, convertedThisMonth, convertibleThisMonth, capResetsOn, redeemEnabled` |
| POST | `/transactions` | `{request:{startDate, endDate, type?: ALL\|CREDIT\|DEBIT\|PENDING}}` | `200` — `{transactions:[…]}` |
| POST | `/redeem` | `{request:{pointsToConvert, requestId}}` | `202` `{requestId, status:"PROCESSING"}` |
| GET | `/redeem/status/{requestId}` | — | `200` stored addinfo JSON, or `PROCESSING` |

Error codes seen: `401 USER_ID_DOESNT_EXIST`, `403 UNAUTHORIZED_USER`,
`400 INSUFFICIENT_KARMA_POINTS`, `400 MONTHLY_CAP_EXCEEDED`,
`409 CONVERSION_REQUEST_IN_PROGRESS`, `400` "You can view history for up to the last 1 year only."

## Leaderboard / Hall of Fame (sunbird-cb-ext `WallOfFameController`)

`halloffame` and `walloffame` are aliases.

| Method | Path | Auth | Source |
|---|---|---|---|
| POST | `/v1/halloffame/read` | none (also in uiproxy `publicApiV8`) | Cassandra `mdo_karma_points`, previous month |
| GET | `/v1/halloffame/learnerleaderboard` | token + org-id header | `learner_leaderboard_lookup` + `learner_leaderboard`, Redis-cached |
| GET | `/v1/top/learners/{ministryOrgId}` | token | `mdo_top_learners`, ranks 1–10 |
| GET | `/v1/halloffame/user/read` | token | Postgres `nlw_user_leaderboard` |
| GET | `/v1/halloffame/mdoleaderboard` | none | `nlw_mdo_leaderboard` |
| POST | `/v1/halloffame/state/mdoleaderboard` | none | Postgres `slw_mdo_leaderboard` |
| GET | `/v1/state/top/learners/{stateOrgId}` | token | Postgres `slw_mdo_top_learners` |

## Operational / bulk endpoint

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/user/event/postConsumption` (multipart `file`) | CSV `userid, contentid, batchid`; completes event enrolments and emits `EVENT_ATTENDED` |

## External-course deduction

`POST /api/cios-enroll/v1/karmapoints/deductionrule` — body `{partnerId, courseId}`,
returns `requiredKarmaPoints` (served by the cb-external-enrollment service, not in
these repos). Web: `/apis/proxies/v8/cios-enroll/…` (whitelisted, no portal caller found).

## Kafka contract

Topic `{env}.karma.points.unified.v2.event`, keyed by userId. Envelope:

```jsonc
{ "eventType": "FIRST_ENROLMENT", "data": { "edata": { "courseId": "…", "userId": "…", "batchId": "…" } }, "version": 2 }
```

| Producer | Event types | Where the userId sits in `data` |
|---|---|---|
| course-service | `FIRST_ENROLMENT`, `UNENROLMENT` (`edata.userIds`), `EVENT_ATTENDED` | `edata.userId` / `edata.userIds` / `user_id` |
| lms-service | `SELF_/CUSTOM_/BULK_REGISTRATION` (`edata.userId`), `FIRST_LOGIN` (`edata.id`), `FIRST_LOGIN_MOBILE` (`edata.id`) | see left |
| cb-ext | `EVENT_ATTENDED` (`user_id`), `RATING` (`user_id`) | see left |
| cb-ext wallet | `POINTS_CONVERSION` → topic `karma.coin.wallet.redeem` | `data.userId` |
| collection-certificate-generator | `COURSE_COMPLETION` (`edata.userIds[0]`) | see left |

Other topics: `{env}.user.claim.acbp.karma.points` (ACBP claim, `{edata:{userId,courseId}}`),
`user.paid.course.enrolment` (from the job on coin redemption),
`karma.points.unified.v2.failed` (data-quality rejects).

> **Verification boundary:** the implementation of `cios-enroll` deduction rules,
> `cb-enrollment-service` coin deduction, the `workflow-handler`/`form-service`/
> `cb-ext-assessment-service` producers (only their topic env wiring is visible in
> DevOps), and the portal `getKarmaPoitns` / `@sunbird-cb/toc` karma widget are not in
> the repos traced. The portal history call is inferred to hit `/karmapoints/read`.
