# Marketplace — Operations Manual

Verified from `cb-pores-service`, `cios-content-service`,
`cb_external_enrollment_service`, and `sunbird-devops` (branches/commits as
listed in [index.md](index.md)).

## Services to know about

| Service | k8s/Kong name | Notes |
|---|---|---|
| `cb-pores-service` | `cb-pores-service:7001` | Has a full Jenkins Build/ArtifactUpload/Deploy pipeline and is present in the `deploy-igot` Ansible service list |
| `cios-content-service` | `cios-content-service:7001` | Has Kong routes and a Helm chart, but **no Jenkins job directory was found** and it is **absent from the `deploy-igot` Ansible service list** (`kubernetes/ansible/roles/deploy-igot/tasks/main.yml`) — confirm how this service is actually deployed before assuming the standard pipeline applies |
| `cb_external_enrollment_service` | Kong upstream var name suggests this, but the **actual k8s service is named `cb-enrollment-service`**, not `cb_external_enrollment_service` — don't search for the literal repo name when triaging | Helm chart present; no Jenkins job directory found either, despite being in the deploy-igot list — a build/deploy pipeline gap |
| `sunbird-course-service` | Fronted through `lms_service_url` → `http://lms-service:9000` in Kong, not a literally-named "course-service" | The external-course subsystem lives inside this deployment |

## Kong plugin stack (applies uniformly to sampled marketplace routes)

`jwt` (auth) → `cors` → statsd metrics → `acl` (role whitelist,
`config.whitelist`) → `rate-limiting` (`policy: local`, hourly, keyed by
credential) → `request-size-limiting`. No route-specific deviation was
observed across the sampled CIOS/pores/course/external-enrollment routes.

## Running a partner-content ingestion manually

The four partner-specific progress-sync jobs
(Cornell/Coursera/CDAC/Harvard) in `cios-content-service` can each be
triggered manually via their `SchedulerController` GET endpoints —
`ciosIntegration/v1/scheduler/{cornell,coursera,cdac,harvard}/progress` —
useful if a scheduled run failed or a partner reports missing progress
data. Whether these also run on a cron was not confirmed from the
controller alone; check for `@Scheduled` annotations on the corresponding
`*SchedulerService` classes before assuming manual-trigger is the only
path.

## Diagnosing a stuck/failed catalog upload

1. Check `GET ciosIntegration/v1/file/info/:partnerId` for the file's
   status (`IN_PROGRESS` that never completes suggests the Kafka consumer
   never picked up the message, or transformation failed silently).
2. Check `FileLogInfoEntity` (`cios_log_info` table) for per-row
   processing logs and `isHasFailure`.
3. If content already exists and is `live`/`draft`, re-running the same
   file is a **confirmed no-op** for already-processed rows
   (`DataTransformUtility.saveOrUpdateCornellContent`'s empty `else`
   branch) — don't expect a re-upload to refresh already-ingested content;
   this needs deletion/explicit update instead.

## Diagnosing a partner enrollment-limit rejection

The rejection message is generic ("The enrollment limit for this provider
has been reached") regardless of which of the four limit checks
(`isOverallLimitExceeded`, `isUserWiseLimitExceeded`,
`isConcurrentLimitExceeded`, `isCourseLevelCapExceeded`) tripped. To
determine which one, inspect the partner's `ContentPartner` record
(`overAllLimit`, `userWiseLimitEnabled`, `concurrentLimitEnabled`) via `GET
contentpartner/v1/read/:id` and cross-reference the Cassandra counter for
that partner against the configured limit.

## Partner deactivation/reactivation — expected propagation

Deactivating or reactivating a partner in `cb-pores-service` fires a Kafka
event consumed by `ContentPartnerConsumer` in `cb-pores-service` itself,
which paginates all of that partner's content and flips `isActive` in
Elasticsearch. Content is not deleted or re-indexed from scratch — only
the flag changes. If a partner is reactivated and its content still
appears inactive in search results, check `ContentPartnerConsumer`'s
`updateAllPartnerContents` pagination completed rather than assuming the
Kafka event was lost.

## Known operational risk areas (from LLD)

- **`cios-content-service` deployment gap**: no confirmed Jenkins pipeline
  and absent from the `deploy-igot` list — verify manually before relying
  on standard CI/CD for this service.
- **`cb_external_enrollment_service` deploy gap**: same — present in the
  deploy list but no Jenkins job directory found.
- **`authz.ts` in `sunbird-cb-uiproxy`** gates partner-course enrollment
  authorization with a substring check on a cookie (`cookie.includes(
  'access_token')`), not real Keycloak token verification — treat any
  authorization-related incident in this path as a potential real gap, not
  a misconfiguration to dismiss.
- **No Angular route guards** on any marketplace/curation admin route in
  either `sunbird-cb-adminportal` or `sunbird-cb-creationportal` — if
  unauthorized access is reported, the gate (if any) is server-side only;
  don't assume the client blocks it.

## Emails triggered by this feature

`cb-pores-service`'s `NotificationConsumer` sends: registration-submitted
("Your iGOT Marketplace Application ID – #applicationId"),
approval, and rejection emails, all keyed off the
`content-partner-registration` Kafka topic
(`request.content.partner.registration`). If a partner reports not
receiving one of these, check that topic's consumer group
(`content-partner-registration-group`) lag before assuming an email
provider issue.

> **Verification boundary:** this manual reflects what is confirmed
> operationally from code and infra config in the 9 repos listed in
> [index.md](index.md), not from runbooks or incident history (none were
> found in-repo — `cb-pores-service` and `cios-content-service` both have
> effectively empty READMEs with no operational documentation).
