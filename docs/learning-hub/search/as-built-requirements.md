# Search — As-Built Requirements

Requirements reconstructed from the shipped implementation across all ten
repos pinned in [index](index.md) — what the system does today, not what
was originally intended. Companion to the [HLD](hld.md), [LLD](lld.md) and
[Operations Manual](operations-manual.md).

## Purpose and method

No original requirements/spec document for platform search was available in
any of the ten repos. This document reconstructs requirements **from the
shipped implementation**. Each requirement is traced to the file(s)/line(s)
that implement it.

Requirement IDs: `FR-0xx` (`nlp-search`), `FR-1xx` (`search-service`),
`FR-2xx` (`search-indexer`, `knowledge-platform-jobs`), `FR-3xx` (`uiproxy`),
`FR-4xx` (frontends, cross-repo), `NFR-xxx` (non-functional), `CON-xxx`
(constraint/assumption baked into the build).

## Functional requirements — `nlp-search`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-001 | The system SHALL accept a POST to `/nlp/search` with `{query: str, synonyms: bool=false}` and extract a ranked keyword list from `query` using an LLM. | `src/search/router.py:8-10`, `src/search/llm_service.py:37-56` |
| FR-002 | `query` SHALL be rejected (via Pydantic field validation) if empty or longer than 400 characters. | `src/search/request_model.py:7-14` |
| FR-003 | When `synonyms=true`, the system SHALL append an instruction to also suggest synonyms by string-splicing it into the composed prompt. | `src/search/llm_service.py:63-64` |
| FR-004 | The system SHALL call Vertex AI's `GenerativeModel` with a fixed system instruction, `temperature=0`, and env-configurable `top_p`/`top_k`/`max_output_tokens`. | `src/search/llm_service.py:23-35` |
| FR-005 | The system SHALL strip markdown code fences and the literal string `"json"` from the LLM's raw text response before `json.loads`-ing it. | `src/search/llm_service.py:80` |
| FR-006 | The `/nlp/search` endpoint SHALL require no authentication. | Confirmed by absence — no middleware/`Depends()`/header check in `main.py`, `router.py`, or `llm_service.py` |

## Functional requirements — `search-service` (`knowledge-platform`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-100 | The system SHALL expose versioned search endpoints (`/v3`, `/v4`, `/v5`) with different default filter behavior: `/v3` applies "secure settings" filtering by default, `/v4`/`/v5` disable it. | `search-api/search-service/conf/routes:4-16`, `SearchController.scala` |
| FR-101 | `/v3/search` and `/v4/search` SHALL reject any request whose `filters.visibility` includes `"Private"`. | `SearchController.scala:31-33,73-75` |
| FR-102 | `/v3/private/search` SHALL require a resolved channel ID header, distinguishing it from the public `/v3/search`. | `SearchController.scala:44-46` |
| FR-103 | `/v5/search` and `/v4/bp/search` SHALL extract `user_roles`/`org`/`sub` claims from a JWT found in `x-authenticated-user-token` or `Authorization: Bearer`, by base64-decoding the payload segment **without verifying the signature**. | `ExtendedSearchController.scala:76-90` |
| FR-104 | The system SHALL default `status=Live` and `visibility=Default` on any search request that does not explicitly override them. | `SearchActor.java:602-605,607-609,625-633` |
| FR-105 | Free-text queries SHALL be executed as a boosted `multi_match` across a configured field list, with `fuzziness("AUTO")` applied only when the request sets `fuzzySearch=true`. | `SearchProcessor.java:647-669` |
| FR-106 | Facets requested by the caller SHALL be returned as Elasticsearch terms aggregations; an arbitrary nested `l1/l2/...` aggregation tree SHALL also be supported. | `SearchProcessor.java:337-387,926-951` |
| FR-107 | The system SHALL search the `compositesearch` Elasticsearch index and SHALL NOT itself write to it (read-only against the index). | `SearchConstants.java:6`; confirmed by grep — no `ElasticSearchUtil` write-method callers found in `search-api` |

## Functional requirements — `search-indexer` (`knowledge-platform-jobs`)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-200 | The system SHALL consume graph-transaction events from a Kafka topic and route them by `nodeType` (`SET`/`DATA_NODE` → composite search index path). | `TransactionEventRouter.scala:27-43` |
| FR-201 | On `CREATE`, the system SHALL build and index a full document; on `UPDATE`, it SHALL fetch the existing document, merge the transaction's property diff, and re-index the merged result; on `DELETE`, it SHALL skip the delete if the document's `visibility` is `"Parent"`. | `CompositeSearchIndexerHelper.scala:97-130` |
| FR-202 | Properties in a configured `nested.fields` list SHALL be deserialized and indexed as nested objects rather than flat text. | `CompositeSearchIndexerHelper.scala:187-190`, `search-indexer.conf:20` |
| FR-203 | Relations added/removed in a transaction SHALL be resolved to human-readable field names via the object definition and written/removed as ID-list fields. | `CompositeSearchIndexerHelper.scala:46-75` |
| FR-204 | String field values over 32,000 characters SHALL be truncated before indexing. | `ElasticSearchUtil.scala:180-185` |
| FR-205 | On an unhandled indexing exception, the system SHALL emit a failed-event record (with error message and truncated stack trace) to a Kafka dead-letter topic. | `FailedEventHelper.scala:9-20`, `SearchIndexerStreamTask.scala:41` |
| FR-206 | A collection publish SHALL additionally bulk-index that collection's child/unit nodes into the same index, independent of the Kafka-driven path, with failures only logged (no DLQ). | `CollectionPublisher.scala:558-583` |

## Functional requirements — `sunbird-cb-uiproxy`

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-300 | The system SHALL expose `POST /protected/v8/content/{searchV5,searchV6,searchRegionRecommendation}` and `GET /protected/v8/content/searchAutoComplete`, each requiring a Keycloak session. | `src/protectedApi_v8/content.ts:293-501` |
| FR-301 | `searchAutoComplete` SHALL query Elasticsearch directly against a per-language index (`searchautocomplete_${lang}`), not proxy to `search-service`. | `content.ts:356` |
| FR-302 | The system SHALL expose generic passthrough proxies `ALL /proxies/v8/nlp/*` and `ALL /proxies/v8/search/*` to Kong, injecting session-derived auth headers on every forwarded request. | `src/proxies_v8/proxies_v8.ts:1481-1501`, `src/utils/proxyCreator.ts:115-138,300-341` |
| FR-303 | `/proxies/v8/nlp/search` SHALL be reachable by any authenticated session (RBAC role `PUBLIC`), not restricted to any elevated role. | `src/utils/whitelistApis.ts:5545-5551` |
| FR-304 | Every request routed via `isAllowed()` middleware SHALL be checked against a whitelist keyed by exact path or precompiled pattern, rejecting unmatched paths with 403, when `PORTAL_API_WHITELIST_CHECK` is enabled (default `true`). | `src/utils/apiWhiteList.ts:373-377`, `src/utils/env.ts:96` |

## Functional requirements — frontends (cross-repo)

| ID | Requirement (as-built) | Source |
|---|---|---|
| FR-400 | The web portal (`search-v3`) and mobile app SHALL call `nlp-search` and substitute its top-priority extracted keyword for the user's raw query before executing any content/people/community/event/resource search. | `search-input-home-v4.component.ts:279-586`, `search_result_page.dart:313-324` |
| FR-401 | `sunbird-cb-orgportal`, `sunbird-cb-creationportal`, and `sunbird-cb-adminportal` SHALL NOT call `nlp-search` — search executes on the raw typed query. | Confirmed by absence — zero `nlp` matches in a repo-wide grep of each |
| FR-402 | Recent searches SHALL be persisted server-side (`/search/v1/recent/*`) on every client that implements the feature; no client SHALL cache recent-search history in local/on-device storage. | Confirmed by absence of `localStorage`/Hive/SharedPreferences usage tied to search history on web and mobile |
| FR-403 | `sunbird-cb-creationportal` SHALL provide tag/keyword suggestion during content authoring via a competency-taxonomy search (`competency/v4/search`), independent of `nlp-search`. | `competence.service.ts:44`, `edit-meta.component.ts:555` |
| FR-404 | Each admin-facing portal (`orgportal`, `adminportal`) SHALL provide a separate admin user-search feature (`user/v1/search` or `v3/search`) distinct from content search, filtering the platform's user directory rather than the `compositesearch` index. | `all-users.component.ts`, `list-user.component.ts` (adminportal) |
| FR-405 | `sunbird-cb-orgportal`'s Training Plan wizard SHALL provide independent search calls for candidate courses (`sunbirdigot/search`) and candidate assignees (`user/v1/search`), reusing the admin user-search endpoint for the latter. | `training-plan/components/search/search.component.ts:127-235` |

## Non-functional requirements

| ID | Requirement (as-built) | Source |
|---|---|---|
| NFR-001 | `nlp-search` keyword extraction SHALL be near-deterministic per call (`temperature=0`) but is not guaranteed identical across repeated calls with the same input over time (model/version drift is out of this service's control). | `config.py:19`, `llm_service.py:31` |
| NFR-002 | `search-service`'s free-text query length SHALL be capped independently of `nlp-search`'s own cap — 200 chars vs. 400 chars respectively, enforced in two different services with no shared configuration. | `SearchActor.java:136-147` (`allowed.search.query.length`); `config.py:22` (`MAX_SEARCH_LEN`) |
| NFR-003 | Index-write failures SHALL be recoverable via Flink checkpoint-based restart (3 attempts, 30s delay) for the Kafka-driven indexing path; the publish-time bulk-index path has no equivalent recovery mechanism. | `base-config.conf:25-26` (jobs-core); `CollectionPublisher.scala:578-582` |

## Constraints / assumptions baked into the build

| ID | Constraint | Source |
|---|---|---|
| CON-001 | `nlp-search` assumes its Google service-account credentials file is supplied externally at deploy time — it is excluded from both git and the Docker build context. | `.gitignore`, `.dockerignore`; confirmed deployed via Kubernetes ConfigMap in `sunbird-devops` |
| CON-002 | `search-service`'s `/v5`/`/v4/bp` JWT-claim extraction assumes token signature verification happens upstream — this service performs none itself. | `ExtendedSearchController.scala:76-90`; no signature-verification code found in this repo |
| CON-003 | The `compositesearch` index name is a string literal independently duplicated in three repos (`knowledge-platform`'s default constant, `content-api`'s conf, `knowledge-platform-jobs`' indexer conf) with no shared source of truth. | `SearchConstants.java:6`; `content-api/content-service/conf/application.conf:552`; `search-indexer.conf:19` |
| CON-004 | Kong's routing configuration — the actual mapping from `/proxies/v8/nlp/*` and `/proxies/v8/search/*` to a downstream host — is assumed to exist but lives entirely outside the ten repos traced for this feature. | See [HLD](hld.md) Verification boundary |

## Verification boundary

- No original spec/PRD existed in any of the ten repos; every requirement
  above is reconstructed from shipped code, not confirmed against original
  intent.
- Fork status for `sunbird-cb-creationportal` and `igot_karmayogi_mobile`
  could not be confirmed via GitHub API (private, no in-org token); both
  resolved commits are independently confirmed tagged in git.
- Whether Kong actually enforces JWT signature verification upstream of
  `search-service`'s `/v5` route (referenced in CON-002) is inferred from
  absence of evidence in these repos, not directly confirmed.
