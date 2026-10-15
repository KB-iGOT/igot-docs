# Organisation Hierarchy — Context Diagram

## System boundary

Inside the feature are the hierarchy page and tree component in the MDO and
super-admin portals, the hierarchy-creation endpoint in `cb-pores-service`,
and the bulk-upload API, the two Kafka consumers and the lookup endpoints in
`sunbird-cb-ext`. Outside it are the admins who use it, the gateways, the
generic framework service (`knowledge-mw-service` → `knowledge-platform`) that
actually stores the tree, the learner-service that owns the organisation
record, and the Cassandra, Postgres, Redis, Neo4j and object-store backends.

## Diagram

```mermaid
flowchart LR
    SPV["SPV Admin / Publisher"]
    STA["State Admin"]
    MDO["MDO Admin / Leader"]
    RPT["Reports and other services"]
    KM0["Karmayogi (new user)"]

    CL["Web portals<br/>(MDO, super-admin)<br/>+ lib-tree-view"]
    GW["Gateways<br/>(Nginx, sunbird-cb-uiproxy, Kong)"]

    OH(["Organisation Hierarchy<br/>cb-pores-service create<br/>sunbird-cb-ext upload, consumers, lookups"])

    KM["Framework service<br/>knowledge-mw-service → knowledge-platform"]
    LMS["learner-service<br/>organisation record<br/>hierarchy search"]
    ES[("Elasticsearch<br/>organisation index")]
    KAFKA[["Kafka"]]

    NEO[("Neo4j<br/>frameworks, categories, terms")]
    CAS[("Cassandra<br/>organisation, upload records")]
    PG[("Postgres<br/>org_hierarchy_v4, mdo_children_lookup")]
    RED[("Redis<br/>org level cache")]
    OBJ[("Object store<br/>upload and result sheets")]

    KM0 --> CL
    GW --> LMS --> ES
    SPV --> CL
    STA --> CL
    MDO --> CL
    CL --> GW --> OH
    GW --> KM
    RPT --> GW
    OH --> KAFKA --> OH
    OH --> KM --> NEO
    OH --> LMS --> CAS
    OH --> CAS
    OH --> PG
    OH --> RED
    OH --> OBJ
```

## Interfaces at the boundary

| Direction | Interface | Notes |
|---|---|---|
| In | `org/framework/v1/create`, `organisation/v1/hierarchy/*`, `organisation/v1/getMappingFile/sample/*`, `org/level/hierarchy`, `org/v1|v2/list*` | from portals and reporting callers through Kong |
| In | `org/hierarchy/{ministry,state,}/search` | public sign-up pickers, through uiproxy `/apis/public/v8` and Kong to learner-service |
| In | `org/ext/v1/create` | trigger for the new-org consumer (feature owned by registration, documented under [SPV & Admin Registration](../learning-hub/spv-admin-registration/index.md)) |
| Out | `framework/v1/copy|read|publish|term/create|term/update|term/retire|term/search` | knowledge-mw-service |
| Out | `framework/v3/retire` | learning-service (VM) |
| Out | `v1/org/update`, `v1/org/search` | learner-service |
| Out / In | Kafka `org.hierarchy.bulk.upload`, `org.hierarchy.new.org` | produced and consumed inside `sunbird-cb-ext` |
