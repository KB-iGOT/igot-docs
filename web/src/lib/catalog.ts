/* The documentation catalogue: typed access to features, hubs and navigation,
   derived from the data files so every list in the UI stays in sync. */
import featuresData from '../data/features.json';
import hubsData from '../data/hubs.json';
import metaData from '../data/generated/meta.json';
import type { DocsMeta, Feature, FeatureTab, Hub, HubItem } from '../types';
import type { IconName } from '../components/ui/Icon';

export const features = featuresData as Feature[];
export const hubs = hubsData as Hub[];
export const meta = metaData as DocsMeta;

const featureById = new Map(features.map((f) => [f.id, f]));
const hubById = new Map(hubs.map((h) => [h.id, h]));

export const getFeature = (id: string) => featureById.get(id);
export const getHub = (id: string) => hubById.get(id);

/** hub that lists a feature (learning / features / registration); null for the platform-hub pages */
const parentOf = new Map<string, string>();
for (const h of hubs) for (const it of h.items) if ('feature' in it.target && !parentOf.has(it.target.feature)) parentOf.set(it.target.feature, h.id);
export const parentHubOf = (featureId: string) => parentOf.get(featureId) ?? null;

/** tabs shown to the reader, Overview first */
export const visibleTabs = (f: Feature) => f.tabs.filter((t) => !t.hidden);
/** documentation tabs: the visible ones except Overview */
export const docTabs = (f: Feature) => visibleTabs(f).filter((t) => t.key !== 'overview');

/** folder of a feature's Markdown, used to look up its last-updated date */
export function lastUpdated(f: Feature): string | null {
  const md = f.tabs.find((t) => t.source.type === 'markdown');
  if (!md || md.source.type !== 'markdown') return null;
  return meta.dates[md.source.path.replace(/\/[^/]*$/, '')] ?? null;
}

export const routeOf = (it: HubItem) => ('feature' in it.target ? `/features/${it.target.feature}` : `/hubs/${it.target.hub}`);

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

export interface Entry {
  label: string;
  to: string;
  kind: 'feature' | 'hub';
  description: string;
  countText: string;
  /** for nested hubs: the features inside, for sidebar dropdowns */
  children?: Entry[];
}

/** a hub's entries as rows: features with their document count, nested hubs with their features */
export function entriesOf(hubId: string): Entry[] {
  return (getHub(hubId)?.items ?? []).map((it) => {
    if ('feature' in it.target) {
      const f = getFeature(it.target.feature);
      return { label: it.label, to: routeOf(it), kind: 'feature' as const,
               description: f ? firstSentence(f.summary) : '', countText: `${f ? docTabs(f).length : 0} Documents` };
    }
    const children = entriesOf(it.target.hub);
    return { label: it.label, to: routeOf(it), kind: 'hub' as const, children,
             description: children.map((c) => c.label).join(', '), countText: `${children.length} Features` };
  });
}

export interface PlatformHub {
  name: string;
  icon: IconName;
  to: string;
  description: string;
  /** number shown on the card badge, and what it counts */
  count: number;
  countLabel: string;
  /** features listed under it (Learning Hub only) */
  children?: Entry[];
}

const docsCount = (id: string) => {
  const f = getFeature(id);
  return f ? docTabs(f).length : 0;
};

const allPlatformHubs: PlatformHub[] = [
  { name: 'Learning Hub', icon: 'learning', to: '/hubs/learning', count: getHub('learning')?.items.length ?? 0, countLabel: 'features',
    children: entriesOf('learning'), description: 'Documentation for learning content: courses, programs, assessments and pathways.' },
  { name: 'Discussion Hub', icon: 'discussion', to: '/features/discussionhub', count: docsCount('discussionhub'), countLabel: 'documents',
    description: 'Documentation for communities, questions, answers and discussions.' },
  { name: 'Event Hub', icon: 'event', to: '/features/eventshub', count: docsCount('eventshub'), countLabel: 'documents',
    description: 'Documentation for virtual events: authoring, review, attendance and certificates.' },
  { name: 'Amrit Gyaan Kosh', icon: 'book', to: '/features/agk', count: docsCount('agk'), countLabel: 'documents',
    description: 'Documentation for knowledge resources: documents, videos, audio and links.' },
];
/** the four platform hubs: Learning Hub groups features, the others are single pages */
export const platformHubs = allPlatformHubs.filter((h) => !h.to.startsWith('/features/') || getFeature(h.to.split('/')[2]));

/** the Features hub: features and nested hubs such as Registration */
export const featureEntries = entriesOf('features');

const PLATFORM_HUB_PAGES = new Set(['discussionhub', 'eventshub', 'agk']);

export const stats = {
  hubs: platformHubs.length,
  features: features.filter((f) => !PLATFORM_HUB_PAGES.has(f.id)).length,
  documents: features.reduce((n, f) => n + docTabs(f).length, 0),
  diagrams: meta.diagrams,
};

/** feature id + tab key whose Markdown is at docs/<path> */
const tabByMdPath = new Map<string, { featureId: string; tab: FeatureTab }>();
for (const f of features) for (const t of f.tabs) if (t.source.type === 'markdown') tabByMdPath.set(t.source.path, { featureId: f.id, tab: t });
export const tabForDoc = (path: string) => tabByMdPath.get(path) ?? null;
