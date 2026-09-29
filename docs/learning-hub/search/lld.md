# Search — LLD

## `nlp-search` — keyword extraction mechanics

```mermaid
flowchart TD
    Start(["POST /nlp/search {query, synonyms}"]) --> Val1["Pydantic SearchModel validator: reject empty or >400 chars - src/search/request_model.py:7-14"]
    Val1 -->|invalid| P422["FastAPI 422 (real status code)"]
    Val1 -->|valid| Val2["search_request(): re-check empty/whitespace and length>MAX_SEARCH_LEN - llm_service.py:41-45"]
    Val2 -->|fails| Bug1["return HTTPException(400,...) - NOT raised: FastAPI serializes the exception object as a 200 body instead"]
    Val2 -->|passes| Prompt["Build prompt = INSTRUCTION_PROMPT + raw query + EXAMPLE_PROMPT - llm_service.py:61"]
    Prompt -->|synonyms=true| Splice["String-splice a synonym instruction into the prompt at the first ']' - llm_service.py:63-64"]
    Prompt -->|synonyms=false| Gemini
    Splice --> Gemini["Vertex AI GenerativeModel.generate_content(stream=True) - temperature=0, top_p=0.95, top_k=1"]
    Gemini --> Parse["Strip code fences + literal 'json', json.loads() the concatenated text - llm_service.py:73-80"]
    Parse -->|JSONDecodeError / Exception| Bug2["return HTTPException(500,...) - same non-raise bug as Val2"]
    Parse -->|ok| Wrap["Wrap as {data: {keywords: [{keyword, priority}]}} - llm_service.py:52"]
    Wrap --> P200["200 OK, real status"]
    Gemini -->|unexpected exception e.g. auth/quota/network| Outer["Outer try/except: log + traceback, RAISE HTTPException(500,...) - llm_service.py:53-56"]
    Outer --> P500["500 (this is the one path that returns the status it claims)"]
```

No `response_model` is declared on the route, so FastAPI does not enforce
the documented response shape on any path — a caller checking only HTTP
status will treat `Bug1`/`Bug2` as success.

- **Prompt construction** (`llm_service.py:61`): the user's raw text is
  interpolated unsanitized between two configured prompt halves (both
  required env vars, no default, `config.py:24-25`).
- **Model call**: `GenerativeModel(settings.MODEL_NAME, system_instruction=[
  "You are a helpful language expert.", "Your mission is to extract search
  keywords from queries."])` (`llm_service.py:23-35`), default model
  `gemini-2.0-flash-lite` (`config.py:17`).
- **Auth to Google**: Vertex AI service-account JSON via
  `GOOGLE_APPLICATION_CREDENTIALS` (`config.py:15`); excluded from git and
  the Docker build context, mounted at deploy time (confirmed in
  `sunbird-devops` as a Kubernetes ConfigMap).
- **No timeout, no retry**: `model.generate_content(...)` has no `timeout=`
  kwarg and no retry wrapper anywhere in the repo — a hung Vertex AI call
  hangs the request indefinitely.

## `search-service` — query DSL construction

```mermaid
flowchart TD
    Req(["POST /v3|v4|v5/search {query, filters, sort_by, facets, limit, offset, ...}"]) --> Actor["SearchActor.getSearchDTO() - SearchActor.java:99-333"]
    Actor --> Ops["Map each filter to an operator: EQ/SW/EW/NT_EQ/NT_IN/CONTAINS/AND/range/ANY-should - getSearchFilterProperties, lines 438-612"]
    Ops --> Defaults{"status / visibility explicit in request?"}
    Defaults -->|no| Inject["Inject status=Live, visibility=Default - lines 602-609,625-633"]
    Defaults -->|yes| DTO
    Inject --> DTO["SearchDTO: properties, facets, sortBy, limit/offset, fuzzySearch, softConstraints, aggregations"]
    DTO --> Proc["SearchProcessor.processSearchQuery() - SearchProcessor.java:233-329"]
    Proc --> Bool["formQueryImpl(): one QueryBuilder per operation - matchQuery / regexpQuery (LIKE,CONTAINS,SW,EW) / rangeQuery / termsQuery(NOT_IN) / existsQuery"]
    Proc --> FreeText{"Free-text query present?"}
    FreeText -->|yes| MM["multiMatchQuery across search.fields.query, field^boost parsed, CROSS_FIELDS - fuzziness(AUTO) only if fuzzySearch=true"]
    Proc --> Secure{"Route is /v4 or /v5?"}
    Secure -->|yes| PostFilter["Wrap query in post_filter (getPostFilterQuery) instead of the default nested secureSettings query"]
    Secure -->|no /v3| Nested["Apply nested secureSettings query by default"]
    Proc --> Facets["Facets -> terms aggregations; optional nested l1/l2/... aggregation tree"]
    Bool --> Build["Build SearchSourceBuilder: fetchSource, size/from, sort (default name asc + lastUpdatedOn desc)"]
    MM --> Build
    PostFilter --> Build
    Nested --> Build
    Facets --> Build
    Build --> ES[("Elasticsearch - compositesearch index")]
    ES --> Shape["ElasticSearchUtil.getDocumentsFromSearchResult() - extract _source"]
    Shape --> Group{"Composite-search response needed?"}
    Group -->|yes| RoundTrip["Second, self-addressed actor round trip: GROUP_SEARCH_RESULT_BY_OBJECTTYPE - SearchManager.java:275-285"]
    Group -->|no| Resp
    RoundTrip --> Resp["Typed response: content/domains/concepts/... buckets"]
```

- **Secure-settings / eligibility filtering**: org- and
  coordinator-eligibility use `TermsLookup`-based filters against separate
  indices (`org_eligibility_alias`, `user_program_lookup_v1`), built via
  reflective `TermsQueryBuilder` construction
  (`SearchProcessor.java:1075-1109`) — fragile to any ES client library
  version bump that changes that constructor's signature.
- **Result shaping**: the `GROUP_SEARCH_RESULT_BY_OBJECTTYPE` round trip is
  a second actor `ask()` call issued by `SearchManager` after the first
  search completes — not a single-pass operation.

## `search-indexer` (jobs) — indexing mechanics

```mermaid
flowchart TD
    Kafka(["Kafka: *.learning.graph.events"]) --> Router["TransactionEventRouter.processElement() - validates event, routes by nodeType"]
    Router -->|SET / DATA_NODE| CSFunc["CompositeSearchIndexerFunction.processElement()"]
    Router -->|EXTERNAL| Dialcode["dialcode path (not composite search)"]
    Router -->|DIALCODE_METRICS| Metrics["metrics path (not composite search)"]
    CSFunc --> Op{"operationType?"}
    Op -->|CREATE| Full["getIndexDocument(): build full doc from transaction properties + relation-label resolution + nested-field parsing"]
    Op -->|UPDATE| Fetch["esUtil.getDocumentAsString(): fetch existing doc from ES"]
    Fetch --> Merge["Merge transaction's ov/nv property diff into the fetched doc"]
    Op -->|DELETE| FetchD["esUtil.getDocumentAsString(): fetch existing doc"]
    FetchD --> Vis{"visibility == 'Parent'?"}
    Vis -->|yes| Skip["Skip delete - Parent doc presumed still referenced"]
    Vis -->|no| Del["esUtil.deleteDocument(identifier)"]
    Full --> Write["upsertDocument(): ElasticSearchUtil.addDocument - index=compositesearch, type=cs"]
    Merge --> Write
    Write --> ES[("Elasticsearch - compositesearch index")]
    Del --> ES
    CSFunc -->|exception| DLQ["FailedEventHelper.getFailedEvent(): wrap event + jobName + truncated stack trace"]
    DLQ --> KafkaErr(["Kafka DLQ: *.learning.events.failed"])
    CSFunc -->|InvalidEventException specifically| Rethrow["re-thrown after DLQ emit"]
    Rethrow --> Restart["Flink restart-strategy: 3 attempts, 30s delay - checkpoint-based reprocessing"]
```

This is retry-via-infrastructure (Flink checkpoint/restart), not
application-level retry logic. A parallel, independent write path exists:
content-publish's `CollectionPublisher.syncNodes()` bulk-indexes a
collection's child/unit nodes into the same index at publish time — it has
**no DLQ**, failures are only logged.

- **Enrichment before write**: nested-field re-parsing for a configured
  field list (so ES indexes them as `nested` rather than flat text);
  relation-label denormalization (walks `addedRelations`/`removedRelations`,
  resolves each to a human-readable field name); external-property exclusion
  (fields owned by Cassandra content-store are dropped); a 32,000-char
  string-length guard per field.
- **Custom analysis**: `cs_index_analyzer`/`cs_search_analyzer` with an
  ngram filter (`mynGram`, min 1 / max 30 grams) plus a `copy_to: all_fields`
  catch-all field for partial-match full-text search — created once at job
  startup if the index doesn't already exist.

## Frontend keyword-to-search sequence (web portal, the fullest-traced client)

```mermaid
flowchart TD
    Type["User types query, hits submit - SearchInputHomeV4Component"] --> NLP["searchInNLP(query): POST /apis/proxies/v8/nlp/search - search-input-home-v4.component.ts:778-795"]
    NLP --> Extract["Response: {data:{keywords:[{keyword,priority}]}} - pick top-priority keyword"]
    Extract --> Process["processSearchText(): build queryParams {q: rawQuery, search: nlpKeyword, category, p, f, tab, filtersPanel}"]
    Process --> Nav["router.navigate(['/app/globalsearch'], {queryParams}) - q preserved for the URL, search is what's actually queried"]
    Nav --> GSC["GlobalSearchComponent.ngOnInit(): read q/search/category/f from queryParamMap - decode f as JSON filters"]
    GSC --> LSC["LearnSearchComponent: build per-category SearchV4Request objects from search + f"]
    LSC --> Parallel{"Fire parallel category searches"}
    Parallel --> Courses["searchCoursesv5() -> POST composite/v5/search"]
    Parallel --> People["searchConnections() -> POST user/v5/public/search"]
    Parallel --> Community["searchCommunity() -> POST community/v1/search"]
    Parallel --> External["searchExternalContent() -> POST cios/v1/search/content"]
    Courses --> Render["Render result cards, bind fields from the search-time 'fields' projection"]
    People --> Render
    Community --> Render
    External --> Render
    Extract --> Recent["createRecent(): POST search/v1/recent/create {searchQuery, nlpSearchQuery, searchCategory}"]
```

The mobile app follows the identical two-hop shape (`nlpSearch()` →
top-priority keyword → parallel category searches), confirmed in
`igot_karmayogi_mobile:lib/features/search/presentation/widgets/search_result_page.dart:313-324`.
The three admin-facing portals (`orgportal`, `creationportal`,
`adminportal`) skip the `NLP` step entirely — their equivalent flow starts
directly at `Process`, with the user's raw text substituted for `nlpKeyword`.

- **Facet round-trip**: `SearchFiltersComponent` emits selections via
  `appliedFilter`/`constructQueryParam`; these update the `f` query param,
  which `GlobalSearchComponent` re-parses on next navigation — filter state
  lives entirely in the URL, not a service-level store, so a full page
  reload with the same URL reproduces the same filtered search.
- **Non-identical repeat searches**: because `search` (not `q`) is what's
  actually queried, and `nlp-search`'s output is only deterministic-by-
  temperature for a fixed prompt+model version, a bookmarked search URL
  reproduces the *keyword-based* result at the time it was generated — it
  does not re-run NLP extraction on load.

## Verification boundary

- `nlp-search`'s response-shape non-enforcement (no `response_model`) and
  the two `return`-not-`raise` branches were confirmed by static reading
  only — not observed by running the live service (no Vertex AI
  credentials in this environment).
- The reflective `TermsQueryBuilder` construction in `SearchProcessor`
  (`SearchProcessor.java:1075-1109`) was read as written; whether it
  actually succeeds against the pinned Elasticsearch client library version
  was not exercised at runtime.
- Kong's actual routing behavior for `/proxies/v8/nlp/*` and
  `/proxies/v8/search/*` remains unconfirmed (see [HLD](hld.md)).
