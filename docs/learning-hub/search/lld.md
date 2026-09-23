# Search — LLD

## `nlp-search` — keyword extraction mechanics

- **Prompt construction** (`llm_service.py:61`): final prompt =
  `NLP_SEARCH_INSTRUCTION_PROMPT + query + NPL_SEARCH_EXAMPLE_PROMPT` — the
  user's raw text is interpolated unsanitized between two configured prompt
  halves (both required env vars, no default, `config.py:24-25`). If
  `synonyms=true`, the code string-replaces the first `]` in the composed
  prompt with an instruction to add synonyms (`llm_service.py:63-64`) —
  fragile string surgery, not a templated field.
- **Model call**: `GenerativeModel(settings.MODEL_NAME, system_instruction=[
  "You are a helpful language expert.", "Your mission is to extract search
  keywords from queries."])` (`llm_service.py:23-35`), default model
  `gemini-2.0-flash-lite` (`config.py:17`), `temperature=0`, `top_p=0.95`,
  `top_k=1`, `max_output_tokens=8192` — all env-overridable, all deterministic
  defaults (temperature 0).
- **Response parsing**: streams `generate_content(..., stream=True)`,
  concatenates `.text` chunks, strips markdown code fences and the literal
  string `"json"`, then `json.loads`s the result (`llm_service.py:68-80`).
  No schema validation beyond what `json.loads` itself enforces — a
  malformed-but-valid-JSON response (e.g. missing `keywords` key) would
  propagate as a `KeyError` wherever the caller indexes into it, not caught
  here.
- **A real defect**: both validation-failure branches
  (`llm_service.py:41-42,44-45`) and the LLM-JSON-failure branch
  (`llm_service.py:79-89`) `return HTTPException(...)` instead of `raise
  HTTPException(...)`. FastAPI does not special-case a *returned*
  `HTTPException` object — it JSON-serializes the exception instance as a
  200-OK body rather than emitting the intended 400/500 status. Only the
  outer `try/except`'s catch-all (`llm_service.py:53-56`) correctly `raise`s,
  so genuinely unexpected errors do return real 500s; validation and
  LLM-parse failures do not return the status their own code implies.
- **Auth to Google**: Vertex AI service-account JSON via
  `GOOGLE_APPLICATION_CREDENTIALS` (`config.py:15`); the credentials file is
  excluded from both git and the Docker build context (`.gitignore`,
  `.dockerignore`), so it must be mounted/injected at deploy time — confirmed
  in `sunbird-devops` as a Kubernetes ConfigMap (`gcpnlpsearchcredentialsjson`)
  mounted at `/app/gcp_nlp_search_credentials.json`.
- **No timeout, no retry**: `model.generate_content(...)` is called with no
  `timeout=` kwarg and no retry wrapper anywhere in the repo — a hung Vertex
  AI call hangs the request indefinitely (bounded only by whatever
  ASGI-server-level timeout the deployment sets, which is not configured in
  this repo's `Dockerfile`/`CMD`).

## `search-service` — query DSL construction

- **Request → `SearchDTO`**: `SearchActor.getSearchDTO()`
  (`SearchActor.java:99-333`) walks the wire-level request and produces a
  list of `properties`, each `{operation, propertyName, values}`. Operator
  mapping (`getSearchFilterProperties`, `SearchActor.java:438-612`): plain
  value → `EQ`; `{startsWith}` → `SW`; `{endsWith}` → `EW`; `{ne|!=}` →
  `NT_EQ`; `{notIn}` → `NT_IN`; `{gt,gte,lt,lte}` → passthrough range;
  `{contains|value}` → `CONTAINS`; `{and}` → `AND`; `any: [...]` → grouped
  `should`-clause.
- **Implicit defaults injected unless overridden**: `status=Live`
  (`SearchActor.java:602-605`), `visibility=Default`
  (`SearchActor.java:607-609,625-633`, gated by config
  `object.withVisibility`) — a caller who doesn't explicitly ask for
  non-Live or non-Default content silently only sees the common case.
- **ES query assembly**: `SearchProcessor.processSearchQuery()`
  (`SearchProcessor.java:233-329`) builds a `SearchSourceBuilder`: field
  projection, `size`/`from` from `limit`/`offset`, boolean query from
  `formQueryImpl()` (`SearchProcessor.java:394-600` — one `QueryBuilder` per
  `SearchConstants.SEARCH_OPERATION_*`: `matchQuery`, `regexpQuery` for
  LIKE/CONTAINS/STARTS/ENDS, `rangeQuery`, `termsQuery` for `NOT_IN`,
  `existsQuery`), sort (default `name asc, lastUpdatedOn desc` when
  unspecified or in fuzzy-relevance mode), facets as terms aggregations,
  and an arbitrary nested `l1/l2/...` aggregation tree
  (`SearchProcessor.java:926-951`).
- **Free-text query**: a `multiMatchQuery` across the field list in
  `search.fields.query` config, with per-field boosts parsed from
  `field^boost` syntax, `Type.CROSS_FIELDS`; fuzzy matching
  (`fuzziness("AUTO")`) only when `fuzzySearch=true` on the request
  (`SearchProcessor.getAllFieldsPropertyQuery`, lines 647-669).
- **Secure-settings / eligibility filtering**: `/v3`/`/v3/private` apply a
  nested `secureSettings` query by default; `/v4`/`/v5` instead wrap the
  main query in a `post_filter` (`getPostFilterQuery`,
  `SearchProcessor.java:1005-1038`). Org- and coordinator-eligibility use
  `TermsLookup`-based filters against separate indices
  (`org_eligibility_alias`, `user_program_lookup_v1`), built via reflective
  `TermsQueryBuilder` construction (`SearchProcessor.java:1075-1109`) —
  fragile to any ES client library version bump that changes that
  constructor's signature.
- **Result shaping**: `ElasticSearchUtil.getDocumentsFromSearchResult(...)`
  extracts `_source`; a second, self-addressed actor round trip
  (`GROUP_SEARCH_RESULT_BY_OBJECTTYPE`, `SearchManager.java:275-285`)
  buckets raw hits into typed keys (content/domains/concepts/etc) for the
  composite-search response shape.

## `search-indexer` (jobs) — indexing mechanics

- **Dispatch**: `TransactionEventRouter` routes a graph-transaction Kafka
  event by `nodeType` — `SET`/`DATA_NODE` → composite-search path,
  `EXTERNAL` → dialcode path, `DIALCODE_METRICS` → metrics path
  (`TransactionEventRouter.scala:27-43`).
- **CREATE/UPDATE/DELETE** (`CompositeSearchIndexerHelper.upsertDocument`,
  lines 97-130):
    - `CREATE`: builds the full document via `getIndexDocument()` and
      indexes it.
    - `UPDATE`: **fetches the existing document from ES first**
      (`esUtil.getDocumentAsString`), merges only the transaction's
      property diff (`ov`/`nv` pairs) into it, then re-indexes the merged
      whole — this is a read-modify-write against ES per update, not a
      partial-update API call.
    - `DELETE`: fetches the existing doc, checks `visibility == "Parent"`
      and **skips the delete** if so (a "Parent" doc is presumably still
      referenced), else deletes.
- **Enrichment before write**: nested-field re-parsing for a configured
  field list (`badgeAssertions`, `targets`, `batches`, `competencies_v3`,
  `taxonomyPaths_v2`, ...) so ES indexes them as `nested` rather than flat
  text; relation-label denormalization (walks `addedRelations`/
  `removedRelations`, resolves each to a human-readable field name via
  `ObjectDefinition.relationLabel()`); external-property exclusion (fields
  owned by Cassandra content-store, not the graph, are dropped); a 32,000-char
  string-length guard per field (`ElasticSearchUtil.checkDocStringLength`).
- **Custom analysis**: `cs_index_analyzer`/`cs_search_analyzer` with an
  ngram filter (`mynGram`, min 1 / max 30 grams) plus a `copy_to: all_fields`
  catch-all field for partial-match full-text search — created once at job
  startup if the index doesn't already exist
  (`CompositeSearchIndexerHelper.createCompositeSearchIndex()`).
- **Failure handling**: on exception, the event is wrapped with job name +
  a truncated (21-frame) stack trace and emitted to a Kafka DLQ topic
  (`FailedEventHelper.getFailedEvent`); `InvalidEventException` is
  additionally re-thrown, which — combined with Flink's
  `restart-strategy.attempts=3`/`delay=30000` — triggers a job restart and
  checkpoint-based reprocessing. This is retry-via-infrastructure, not
  application-level retry logic. The parallel bulk-publish path
  (`CollectionPublisher.syncNodes`) has no DLQ — a failure there is only
  logged.

## Frontend keyword-to-search wiring (web portal, the fullest-traced client)

- `SearchInputHomeV4Component.updateQuery()` (web) sequences two calls on
  submit: `searchInNLP(query)` first, then `processSearchText(query)`,
  which builds `queryParams = {q, search: nlpKeyword, category, p, f, tab,
  filtersPanel}` and navigates to `/app/globalsearch`
  (`search-input-home-v4.component.ts:279-586`). The `q` param preserves
  what the user typed; the `search` param is what's actually queried against
  — both are visible in the URL, so a shared/bookmarked search link
  reproduces the *keyword-based* result, not necessarily what re-running
  the user's exact original phrase through NLP again would produce (the LLM
  call is not deterministic-by-identity across time, only
  deterministic-by-temperature=0 for a given prompt+model version).
- `GlobalSearchComponent` decodes `f` as JSON
  (`global-search.component.ts:75-85`) into
  `{mainType: 'course', subType: sfilters.primaryCategory}` and passes it
  down to `LearnSearchComponent`, which is what actually assembles the
  per-category `SearchV4Request` objects and fires the parallel category
  searches (courses/events/people/resources/communities).
- **Facet round-trip**: `SearchFiltersComponent` emits selections via
  `appliedFilter`/`constructQueryParam`; these update the `f` query param,
  which `GlobalSearchComponent` re-parses on next navigation — filter state
  lives entirely in the URL, not a service-level store, so a full page
  reload with the same URL reproduces the same filtered search.

## Verification boundary

- `nlp-search`'s response-shape non-enforcement (no `response_model`) was
  confirmed by static reading only — the described 200-with-serialized-
  exception behavior was not observed by actually running the service
  (no live Vertex AI credentials in this environment).
- The reflective `TermsQueryBuilder` construction in `SearchProcessor`
  (`SearchProcessor.java:1075-1109`) was read as written; whether it
  actually succeeds against the specific Elasticsearch client library
  version pinned in this repo's build was not exercised at runtime.
- Kong's actual routing behavior for `/proxies/v8/nlp/*` and
  `/proxies/v8/search/*` remains unconfirmed (see [HLD](hld.md)).
