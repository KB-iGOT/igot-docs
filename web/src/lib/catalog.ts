/* The documentation catalogue: typed access to features, hubs and navigation,
   derived from the data files so every list in the UI stays in sync. */
import featuresData from '../data/features.json';
import hubsData from '../data/hubs.json';
import metaData from '../data/generated/meta.json';
import type { DocsMeta, Feature, FeatureTab, Hub } from '../types';

export const features = featuresData as Feature[];
export const hubs = hubsData as Hub[];
export const meta = metaData as DocsMeta;

const featureById = new Map(features.map((f) => [f.id, f]));
const hubById = new Map(hubs.map((h) => [h.id, h]));

export const getFeature = (id: string) => featureById.get(id);
export const getHub = (id: string) => hubById.get(id);

/** hub ring that lists a feature's bubble (learning / features / registration); null for the platform hubs */
const parentOf = new Map<string, string>();
for (const h of hubs) {
  if (h.id === 'map') continue;
  for (const b of h.bubbles) if ('feature' in b.target && !parentOf.has(b.target.feature)) parentOf.set(b.target.feature, h.id);
}
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

export interface PlatformHub {
  name: string;
  icon: 'learning' | 'discussion' | 'competency' | 'event' | 'book';
  to: string;
  description: string;
  /** number shown on the card badge, and what it counts */
  count: number;
  countLabel: string;
}

const featurePage = (id: string) => getFeature(id);
const docsCount = (id: string) => {
  const f = featurePage(id);
  return f ? docTabs(f).length : 0;
};

/** the five platform hubs: Learning Hub is a ring of features, the others are single pages */
const allPlatformHubs: PlatformHub[] = [
  { name: 'Learning Hub', icon: 'learning', to: '/hubs/learning', count: getHub('learning')?.bubbles.length ?? 0, countLabel: 'features',
    description: 'Documentation for learning content: courses, programs, assessments and pathways.' },
  { name: 'Discussion Hub', icon: 'discussion', to: '/features/discussionhub', count: docsCount('discussionhub'), countLabel: 'documents',
    description: 'Documentation for communities, questions, answers and discussions.' },
  { name: 'Competency Hub', icon: 'competency', to: '/features/competencyhub', count: docsCount('competencyhub'), countLabel: 'documents',
    description: 'Documentation for the competency framework and competency mapping.' },
  { name: 'Event Hub', icon: 'event', to: '/features/eventshub', count: docsCount('eventshub'), countLabel: 'documents',
    description: 'Documentation for virtual events: authoring, review, attendance and certificates.' },
  { name: 'Amrit Gyaan Kosh', icon: 'book', to: '/features/agk', count: docsCount('agk'), countLabel: 'documents',
    description: 'Documentation for knowledge resources: documents, videos, audio and links.' },
];
export const platformHubs = allPlatformHubs.filter((h) => !h.to.startsWith('/features/') || featurePage(h.to.split('/')[2]));

export interface FeatureEntry {
  label: string;
  to: string;
  kind: 'feature' | 'hub';
  description: string;
  countText: string;
}

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

/** the Features hub, in ring order: features and sub-hubs such as Registration */
export const featureEntries: FeatureEntry[] = (getHub('features')?.bubbles ?? []).map((b) => {
  if ('feature' in b.target) {
    const f = getFeature(b.target.feature);
    return { label: b.label, to: `/features/${b.target.feature}`, kind: 'feature' as const,
             description: f ? firstSentence(f.summary) : '', countText: `${f ? docTabs(f).length : 0} Documents` };
  }
  const sub = getHub(b.target.hub);
  const kids = sub?.bubbles.map((k) => k.label) ?? [];
  return { label: b.label, to: `/hubs/${b.target.hub}`, kind: 'hub' as const, description: kids.join(', '), countText: `${kids.length} Features` };
});

const PLATFORM_HUB_PAGES = new Set(['discussionhub', 'competencyhub', 'eventshub', 'agk']);

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
