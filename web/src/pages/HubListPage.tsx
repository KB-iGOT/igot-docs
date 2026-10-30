import { Navigate, useParams } from 'react-router-dom';
import { Breadcrumbs, type Crumb } from '../components/ui/Breadcrumbs';
import { HubCards } from '../components/catalog/HubCards';
import { EntryList } from '../components/catalog/EntryList';
import { entriesOf, getHub, hubTrail, platformHubs } from '../lib/catalog';
import styles from './HubListPage.module.css';

const INTRO: Record<string, string> = {
  learning: 'Features for learning content: courses, programs, assessments and pathways.',
  features: 'Platform-wide features with user guides, APIs, diagrams and operational details.',
  registration: 'How users and organisations get onto the platform.',
  course: 'Courses: creation and management, languages, moderation and invite-only access.',
  programs: 'Programs that bundle courses: blended, invite-only, moderated and curated.',
  assessment: 'Assessments on their own: standalone, moderated and invite-only.',
};

function crumbsFor(hubId: string, name: string): Crumb[] {
  const above = hubTrail(hubId).slice(0, -1);
  const trail: Crumb[] = [{ label: 'Home', to: '/' }];
  if ((above[0]?.id ?? hubId) === 'learning') trail.push({ label: 'Platform Hubs', to: '/hubs' });
  for (const h of above) trail.push({ label: h.name, to: `/hubs/${h.id}` });
  return [...trail, { label: name }];
}

/** "View all" pages: /hubs lists the platform hubs, /hubs/:hubId lists a hub's features. */
export function HubListPage() {
  const { hubId } = useParams();

  if (!hubId) {
    return (
      <div className={styles.page}>
        <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Platform Hubs' }]} />
        <h1 className={styles.h1}>Platform Hubs</h1>
        <p className={styles.lead}>The main hubs of the iGOT platform. Learning Hub groups many features; the others are documented as single pages.</p>
        <HubCards hubs={platformHubs} />
      </div>
    );
  }

  const hub = getHub(hubId);
  if (!hub) return <Navigate to="/hubs" replace />;
  const entries = entriesOf(hub.id);
  return (
    <div className={styles.page}>
      <Breadcrumbs items={crumbsFor(hub.id, hub.name)} />
      <h1 className={styles.h1}>{hub.name}</h1>
      <p className={styles.lead}>{INTRO[hub.id] ?? ''} <span className={styles.count}>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span></p>
      <EntryList entries={entries} />
    </div>
  );
}
