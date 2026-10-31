import { features, hubs, visibleTabs } from './catalog';

export type SearchKind = 'hub' | 'feature' | 'page' | 'doc';

export interface SearchItem {
  label: string;
  kind: SearchKind;
  /** in-app route */
  to: string;
  keywords: string;
}

const RANK: Record<SearchKind, number> = { hub: 0, feature: 1, page: 2, doc: 3 };

/** Everything the header search can find: hubs, features, every feature's documents, and the Platform Overview, ETL Analytics, System Architecture, API Documentation and Monitoring pages. */
export const searchIndex: SearchItem[] = [
  ...hubs.map((h) => ({ label: h.name, kind: 'hub' as const, to: `/hubs/${h.id}`, keywords: h.id })),
  { label: 'Platform hubs', kind: 'hub', to: '/hubs', keywords: 'all hubs overview' },
  ...features.map((f) => ({ label: f.title, kind: 'feature' as const, to: `/features/${f.id}`, keywords: f.id })),
  { label: 'Platform Overview', kind: 'page', to: '/platform-overview', keywords: 'platform architecture hld overview' },
  { label: 'ETL Analytics', kind: 'page', to: '/etl-analytics', keywords: 'data pipeline etl analytics jobs warehouse reports' },
  { label: 'System Architecture', kind: 'page', to: '/system-architecture', keywords: 'system architecture services gateway deployment security' },
  { label: 'API Documentation', kind: 'page', to: '/api-docs', keywords: 'api swagger openapi endpoints rest' },
  { label: 'Monitoring', kind: 'page', to: '/monitoring', keywords: 'monitoring observability alerts dashboards slo runbooks' },
  ...features.flatMap((f) =>
    visibleTabs(f).filter((t) => t.key !== 'overview').map((t) => ({
      label: `${f.title} · ${t.label}`, kind: 'doc' as const, to: `/features/${f.id}/${t.key}`, keywords: `${f.id} ${t.key}`,
    })),
  ),
];

export function search(query: string, limit = 12): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return searchIndex
    .filter((it) => it.label.toLowerCase().includes(q) || it.keywords.toLowerCase().includes(q))
    .sort((a, b) => RANK[a.kind] - RANK[b.kind])
    .slice(0, limit);
}
