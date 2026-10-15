# Organisation Hierarchy — Operations Manual

Audience: ops / L2 support keeping the hierarchy feature running. Everything
below is read from the code paths in [LLD](lld.md); no runbook or on-call
document for this feature was attached, so the "where to look" column is
derived from what the code logs and writes, not from an existing playbook.

## Common support issues

| Symptom (as reported) | What is actually happening | Verified fix / workaround |
|---|---|---|
| "Create hierarchy" says not authorised | Caller lacks one of `org.hierarchy.required.roles` (`MDO_ADMIN, MDO_LEADER, SPV_ADMIN, SPV_PUBLISHER, STATE_ADMIN`) in cb-pores | Assign the role; no override |
| "Create hierarchy" returns `FRAMEWORK_PROCESS_ALREADY_INITIALISED` / 400 | `org/v1/read` shows `orgHierarchyFrameworkStatus` blank or `FAILED` but the framework copy call to knowledge-mw failed | Check knowledge-mw logs for `/v1/framework/copy/org_hierarchy`; confirm master `org_hierarchy` framework exists and is published; retry create |
| Tree page blank, no "Create hierarchy" button either | `org/v1/read` for the resolved root lacks `orgHierarchyFrameworkId`, or the page resolved a different root than expected (`ministryOrStateType`/`ministryOrStateId` on the admin's org) | Read the org; if a department's parent fields are wrong the page will show the wrong root |
| Tree shows but is missing orgs created recently | New-org consumer failed: topic `org.hierarchy.new.org` not consumed, or framework `<rootOrgId>_org_hierarchy` not readable (it is **retired after any successful bulk upload** — see DEV-001) | Re-add the org in the tree view, or run a bulk upload including it. Look for `Category not available or framework read failed for frameworkId=` in cb-ext logs |
| Upload stuck at `INITIATED` | Consumer group `orgHierarchyBulkUpload` not consuming `org.hierarchy.bulk.upload` | Check cb-ext consumer lag / pod logs for `processOrgHierarchyBulkUploadMessage` |
| Upload stuck at `IN_PROGRESS` | Consumer crashed mid-run (no try/finally resets the status) or is waiting on `populateDataFromFrameworkTerm` retries (`10 × 5 s`) | Check logs for `Attempt n: Framework data not available`; a crashed run leaves a stray `<orgId>_org_hierarchy_<ts>` framework that is never retired |
| Upload `FAILED` but tree changed anyway | Expected: ≥1 row succeeded so the org was re-pointed to the new framework; failed rows are listed in the result sheet | Download result file, fix rows, re-upload (the next upload again replaces the whole tree) |
| Upload `FAILED`, every row ok, sheet ends with "Publish framework failed" | Second `framework/v1/publish` failed | knowledge-mw / knowledge-platform publish logs; re-upload |
| Rows fail with "does not exist in the master data" | `frameworkUtil.getMasterData(rootOrgId)` does not list that org (wrong root, org not under this root, org inactive) | Use the `masterData` sheet of the sample template as the source of truth for names/IDs |
| Progress or result download returns 401 | Caller's `rootOrgId` ≠ path org and caller is not on the SPV channel | Use an SPV account or the owning org's admin |
| Result file download 500 | File missing from `org.hierarchy.bulk.upload.container.name` or local temp write failed | Check the container; property is blank in the repo and must be set per environment |
| `org/level/hierarchy` returns "No child org found" for an MDO that has children | No/empty row in Postgres `mdo_children_lookup` for that `mdo_id` | The populating job is outside this feature (boundary); check that job |
| `org/level/hierarchy` returns stale children | Redis `org:level:hierarchy:<id>` cached 4 h | Delete the key or wait out `org.level.hierarchy.cache.key.ttl` |

## Configuration to check per environment

| Where | Key | Must be |
|---|---|---|
| cb-ext | `org.hierarchy.bulk.upload.container.name` | set (blank in repo) |
| cb-ext | `kafka.topics.org.hierarchy.bulk.upload.event`, `…framework.new.org.event` | topics exist; env prefix (`dev.` in repo) matches cluster |
| cb-ext | `km.base.host`, `knowledge.ms` (`framework.copy`), `learning.service.vm` (`framework.retire.endpoint.url`), `sb.url` + `sb.update.org.path` | reachable from cb-ext pods |
| cb-ext | `org.hierarchy.level.count` = 10 and `org.hierarchy.headers.references` has 10 entries matching the master framework's categories | otherwise template headers and `categories.get(i)` drift |
| cb-pores | `org.hierarchy.required.roles` | includes the roles the SPV expects |
| Kong | `OrgFrameworkHierarchy` (acl `contentAccess`), `bulkUploadForOrgHierarchyMapping*` (acl `dataAccess`), `orgLevelHierarchy`, `/framework/*` family | enabled |
| knowledge-platform | master framework `org_hierarchy` with 10 categories, published | present before any org can create a hierarchy |

## Monitoring

- **Kafka lag** on consumer groups `orgHierarchyBulkUpload` and
  `orgHierarchyNewOrg` — the only async paths; lag means uploads stall and
  new orgs silently miss the tree.
- **Cassandra** `sunbird.org_hierarchy_mapping_bulk_upload` — rows in
  `IN_PROGRESS` older than the longest expected run (hundreds of rows × a few
  KM calls each) are crashed runs.
- **cb-ext logs**: `Framework created with ID:`, `Framework published with
  status:`, `Successfully processed {} records`, `Retiring framework:`,
  `Failed to publish org hierarchy:`, `Category not available or framework
  read failed`, `Failed to create term for framework … after … attempts`.
- **Orphan frameworks** in knowledge-platform named `<orgId>_org_hierarchy_<ts>`
  that no organisation's `orgHierarchyFrameworkId` points to — left by crashed
  or all-failed runs where retire also failed (retire errors are logged and
  swallowed).

## Escalation

| Layer | Owner (team) |
|---|---|
| Portal pages / tree component | MDO portal & shared-components team (`sunbird-cb-orgportal`, `sb-cb-ui-components`) |
| Upload API, consumers, `org/level/hierarchy` | `sunbird-cb-ext` team |
| Hierarchy creation | `cb-pores-service` team |
| Framework copy/publish/term/retire behaviour, Neo4j | knowledge-platform team |
| `orgHierarchyFrameworkId` on the org record | learner-service (`sunbird-lms-service`) team |
| `mdo_children_lookup` contents | data/reports pipeline owner — *unidentified in this pass* |

> **Verification boundary:** no runbook, alert definitions or dashboards for
> this feature were attached; monitoring points above are inferred from log
> lines and tables the code writes. Attach the on-call docs to replace this
> with the real procedures.
