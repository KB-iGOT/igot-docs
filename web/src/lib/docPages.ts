/** Platform-level documents shown as their own pages (one Markdown file each under docs/).
 *  One table drives the routes, the search entries and links between documents. */
export interface DocPageDef {
  route: string;
  path: string;
  title: string;
  parents: { label: string; to?: string }[];
  keywords: string;
}

const etl = [{ label: 'Data Pipeline' }, { label: 'ETL Analytics', to: '/etl-analytics' }];

export const docPages: DocPageDef[] = [
  { route: 'system-architecture', path: 'platform/system-architecture.md', title: 'System Architecture', parents: [], keywords: 'system architecture services gateway deployment security' },
  { route: 'monitoring', path: 'platform/monitoring.md', title: 'Monitoring', parents: [], keywords: 'monitoring observability alerts dashboards slo runbooks' },
  { route: 'etl-analytics/docs/architecture', path: 'data-pipeline/etl-analytics/ARCHITECTURE.md', title: 'ETL Architecture', parents: etl, keywords: 'cb-core-data etl architecture stages warehouse' },
  { route: 'etl-analytics/docs/job-details', path: 'data-pipeline/etl-analytics/JOB_DETAILS.md', title: 'ETL Job Details', parents: etl, keywords: 'cb-core-data etl jobs reads joins writes' },
  { route: 'etl-analytics/docs/data-dictionary', path: 'data-pipeline/etl-analytics/DATA_DICTIONARY.md', title: 'ETL Data Dictionary', parents: etl, keywords: 'cb-core-data etl parquet warehouse tables redis cassandra' },
];

const byPath = new Map(docPages.map((d) => [d.path, d]));
export const docPageFor = (path: string) => byPath.get(path) ?? null;
