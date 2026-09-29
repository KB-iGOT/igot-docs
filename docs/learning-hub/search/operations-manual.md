# Operations Manual — Search

How to operate, support, and troubleshoot platform search as it exists today
— two independent backends (`nlp-search`, `search-service`) that never call
each other, fronted by `uiproxy`/Kong, backed by an Elasticsearch index kept
current by a separate indexing job.

**Operational implication:** because `nlp-search` and `search-service` never
communicate, a report of "search gives bad results" needs to be split
immediately into two questions — is the *keyword extraction* wrong (only
relevant on the web portal and mobile), or is the *Elasticsearch query/index*
wrong (relevant everywhere)? Checking only one service's logs can send you
down the wrong path entirely.

## System overview

| Area | As-built reality | Why it matters operationally |
|---|---|---|
| NLP/content-search coupling | No API call between `nlp-search` and `search-service`/`knowledge-platform-jobs` — confirmed by repo-wide grep in both, zero hits | There is no shared trace ID or log correlation between the two calls a single user search triggers; correlating them requires timestamp/session matching across two separate log sources |
| Which clients use NLP | Only `sunbird-cb-portal` (`search-v3`) and `igot_karmayogi_mobile` call `nlp-search`; `sunbird-cb-orgportal`, `sunbird-cb-creationportal`, `sunbird-cb-adminportal` do not | A search-quality complaint from an org/system admin or a content author is **never** an NLP issue — it's always a `search-service`/index issue |
| `nlp-search` auth | None at the application layer — confirmed by reading all three Python files | If this service is ever reachable other than through Kong/uiproxy, it is completely open; perimeter enforcement is the only auth that exists |
| `nlp-search` error handling | Two of three error paths `return` rather than `raise` an `HTTPException` (see [LLD](lld.md)) | A "malformed query" or "LLM returned bad JSON" condition looks like a 200 OK to any caller checking status code, with the error message serialized in the body instead — clients that don't inspect body shape on 200 will silently treat this as a successful empty-ish result |
| `nlp-search` timeouts | No timeout on the Vertex AI call, no retry | A slow/hung Gemini call hangs the request indefinitely; there is no circuit breaker in this repo — if this matters, it needs to be enforced at the gateway/ingress level |
| Indexing latency | Kafka-driven, near-real-time per content transaction (`search-indexer`), **plus** a separate synchronous bulk-index at publish time (`content-publish`'s `syncNodes`) | A just-published collection's child units may appear searchable *before* the async Kafka path even processes the corresponding graph event — the two paths race, they don't hand off to each other |
| Indexing failure handling | Kafka path: DLQ topic + Flink restart-strategy (3 attempts, 30s delay) on `InvalidEventException`. Bulk-publish path: **only logged**, no DLQ, no retry | A silently-failed bulk-index during publish has no automated recovery signal — only a log line to catch |
| `search-service` auth model | `/v3`,`/v4` rely on upstream-set headers (`x-authenticated-user-*`); `/v5`,`/v4/bp` additionally decode a JWT's claims **without verifying its signature** | A forged `x-authenticated-user-token` header reaching this service directly (bypassing whatever validates it upstream) would be trusted as-is — this service performs no cryptographic check itself |
| Two autocomplete mechanisms | `searchAutoComplete` hits Elasticsearch directly against `searchautocomplete_${lang}` (a *different* index from `compositesearch`); the web portal's live-results dropdown instead re-queries the normal category search endpoints on every keystroke | If autocomplete results look stale while normal search results are current, check `searchautocomplete_${lang}`'s freshness specifically — nothing in the ten traced repos shows what keeps it populated |
| Health checks | `search-service` has `GET /health` and `GET /service/health`; `nlp-search` has `GET /` (a welcome message, not a real liveness probe — see below); the `nlp-search-service` Helm chart has **no `livenessProbe`/`readinessProbe` at all** | `nlp-search`'s k8s deployment cannot detect an unresponsive pod via HTTP probe as configured — a hung Vertex AI call inside the app process would not trigger a restart |
| `nlp-search` autoscaling/monitoring config | Helm chart's `values.j2` defines `autoscaling` and `serviceMonitor` blocks, but the chart has **no corresponding `hpa.yaml`/`servicemonitor.yaml` template** | These settings currently appear to be dead config — don't assume HPA or Prometheus scraping is active for this service without checking the live cluster directly |

## Important configuration — `nlp-search`

| Setting | Meaning | Why it matters |
|---|---|---|
| `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` / `GOOGLE_APPLICATION_CREDENTIALS` | Vertex AI project/region/service-account | Required, no default for project/credentials; app fails to start without them. Deployed via a Kubernetes ConfigMap (`gcpnlpsearchcredentialsjson`), not baked into the image |
| `MODEL_NAME` | Gemini model | Default `gemini-2.0-flash-lite`; devops config resolves this from `nlp_search_gemini_model_pro`, i.e. **the env var name says "flash-lite" but the deployed value may point at a Pro model** — confirm the actual deployed value, don't assume from the code default |
| `TEMPERATURE`/`TOP_P`/`TOP_K` | Generation determinism knobs | Code default `temperature=0` (near-deterministic); any change here changes keyword-extraction repeatability, which downstream clients rely on implicitly (see [LLD](lld.md) on non-identical repeat searches) |
| `NLP_SEARCH_INSTRUCTION_PROMPT` / `NPL_SEARCH_EXAMPLE_PROMPT` (note the typo in the second var name — it's in the code, not a documentation error) | The two prompt halves the user's raw query is spliced between | Required, no default in the app; baked into infra config (`sunbird-devops`), not the app repo — a prompt change is a devops/infra change, not an app deploy |
| `MAX_SEARCH_LEN` | Max query length (chars) | Default 400; enforced both at the Pydantic model layer and (redundantly, and buggily — see [LLD](lld.md)) again inside the handler |
| `WEB_CONCURRENCY` | Intended worker-process count | Present in `.env_sample` and in the devops env template, but **not read by any code in this repo** and not passed to the `uvicorn` CMD in the Dockerfile — this setting currently does nothing unless something outside this repo applies it |

## Important configuration — `search-service`

| Setting | Meaning | Why it matters |
|---|---|---|
| `search.es_conn_info` | Elasticsearch host(s) | Defaults to `localhost:9200` in the repo's own `application.conf`; devops templates this from `search_index_host` = the `composite-search-cluster` Ansible inventory group — confirm this resolves correctly per environment |
| `compositesearch.index.name` | Index name | Not set in `search-service`'s own conf (falls back to the `"compositesearch"` code default), but **is** explicitly set in `content-api`'s conf and in `knowledge-platform-jobs`' indexer conf — three independent places agree on the same literal string; a rename in one without the others silently breaks the pipeline |
| `search.fields.enable.fuzzy.when.noresult` | Auto-retry with fuzzy matching on zero hits | Defaults `false` — if search feels too strict for typos, this is the first knob to check |
| `allowed.search.query.length` | Free-text query length cap | 200 chars, enforced in `SearchActor.java:136-147` — distinct from and independent of `nlp-search`'s own 400-char cap; a keyword extracted by `nlp-search` is very unlikely to hit this, but a raw admin-portal query could |
| `search.org_eligibility.index` / `search.coordinator_eligibility.index` | Lookup indices for eligibility filtering | Defaults `org_eligibility_alias` / `user_program_lookup_v1` — these are separate ES indices that must independently exist and be populated; not part of the `compositesearch` pipeline traced here |

## Important configuration — `knowledge-platform-jobs` (`search-indexer`)

| Setting | Meaning | Why it matters |
|---|---|---|
| `kafka.input.topic` | Source of graph-transaction events | `sunbirddev.learning.graph.events` (per-environment name templated in `sunbird-devops`' Helm values) — if content changes aren't appearing in search, confirm the job is actually consuming this topic and not stalled |
| `nested.fields` | Which properties get parsed as nested ES objects vs. flat text | Config-driven list (`badgeAssertions`, `targets`, `batches`, etc.) — a new metadata field that needs nested-query support (e.g. range queries on a sub-field) must be added here, or it indexes as flat text and those queries silently return nothing |
| `restrict.objectTypes` | Which node types are indexed at all | Set at the job-conf/Helm level; a content type not in this list is invisible to search regardless of whether `search-service`'s query logic is otherwise correct |
| Flink `restart-strategy` | `attempts=3`, `delay=30000` (from `jobs-core`'s `base-config.conf`) | After 3 unhandled-exception restarts within the window, the job stays down — check Flink job status, not just Kafka lag, when indexing appears to have stopped entirely |

## Known deviations / things to double-check per environment

- **`nlp-search`'s `WEB_CONCURRENCY` is dead config** (see above) — don't
  tune it expecting an effect without also checking whether something
  external (an orchestrator, a different CMD override) actually applies it.
- **`nlp-search-service`'s Helm chart has no working liveness/readiness
  probe and no wired HPA/ServiceMonitor**, despite `values.j2` defining
  config for all three — verify directly against the live cluster rather
  than assuming these are active from the chart's `values.j2` alone.
- **`search-service`'s `/v5` and `/v4/bp` routes trust unverified JWT
  claims** — if a security review is scoped to this feature, this is the
  first thing to flag; the actual signature-verification step (if any) is
  not part of this service and needs to be located and confirmed
  separately.
- **Two independent write paths hit the same `compositesearch` index**
  (Kafka indexer, publish-time bulk sync) with **different failure-handling
  guarantees** (DLQ+restart vs. log-only) — an ops runbook for "content not
  appearing in search" needs to check both, not just the Kafka consumer
  group's lag.
- **`sunbird-cb-uiproxy`'s direct search endpoints
  (`searchV5`/`searchV6`/`searchAutoComplete`/`searchRegionRecommendation`)
  are not present in its own RBAC whitelist** (`API_LIST.URL`) — they rely
  solely on the Keycloak session gate. Confirm whether this is intentional
  before treating whitelist coverage as a security boundary for search.

## Verification boundary

- Kong's live routing config for `/nlp/*` and `/search/*` was not located
  in any of the ten repos (see [HLD](hld.md)) — the "what does this route
  to in production" question ultimately needs a Kong admin-API/config
  check outside this trace's scope.
- Whether `search-service`'s `/v5` JWT claims are in fact verified by
  something upstream (Kong plugin, a signature-checking gateway not in
  these repos) is inferred from absence-of-evidence, not confirmed.
- `nlp-search`'s buggy error-return behavior (described above and in
  [LLD](lld.md)) is a static-analysis finding; it was not observed by
  running the live service.
