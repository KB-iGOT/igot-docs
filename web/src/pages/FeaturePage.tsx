import { Navigate, NavLink, useParams } from 'react-router-dom';
import { Breadcrumbs, type Crumb } from '../components/ui/Breadcrumbs';
import { FeatureIcon, Icon } from '../components/ui/Icon';
import { TabContent } from '../components/content/TabContent';
import { docTabs, getFeature, getHub, lastUpdated, parentHubOf, visibleTabs } from '../lib/catalog';
import styles from './FeaturePage.module.css';

const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function crumbsFor(featureId: string, title: string): Crumb[] {
  const parent = parentHubOf(featureId);
  const trail: Crumb[] = [{ label: 'Home', to: '/' }];
  if (parent === 'learning') trail.push({ label: 'Platform Hubs', to: '/hubs' }, { label: 'Learning Hub', to: '/hubs/learning' });
  else if (parent === 'features') trail.push({ label: 'Features', to: '/hubs/features' });
  else if (parent === 'registration') trail.push({ label: 'Features', to: '/hubs/features' }, { label: 'Registration', to: '/hubs/registration' });
  else trail.push({ label: 'Platform Hubs', to: '/hubs' });
  return [...trail, { label: title }];
}

/** A feature's documentation: header, tabs (one route per tab) and the selected tab's content. */
export function FeaturePage() {
  const { featureId = '', tabKey } = useParams();
  const feature = getFeature(featureId);
  if (!feature) return <Navigate to="/" replace />;

  const tabs = visibleTabs(feature);
  /* hidden tabs (e.g. Old LLD) stay reachable by direct link, as before */
  const tab = feature.tabs.find((t) => t.key === tabKey) ?? tabs[0];
  if (tabKey && tab.key !== tabKey) return <Navigate to={`/features/${feature.id}`} replace />;

  const parent = parentHubOf(feature.id);
  const where = parent ? getHub(parent)?.name : 'Platform Hub';
  const updated = lastUpdated(feature);

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <Breadcrumbs items={crumbsFor(feature.id, feature.title)} />
        <div className={styles.head}>
          <div className={styles.icon}><FeatureIcon markup={feature.icon} size={30} /></div>
          <div className={styles.headText}>
            <h1 className={styles.title}>{feature.title}</h1>
            {feature.summary && <p className={styles.summary}>{feature.summary}</p>}
            <div className={styles.chips}>
              <span className={styles.chip}><Icon name={parent === 'learning' ? 'learning' : 'layers'} size={14} />{where}</span>
              <span className={styles.chip}><Icon name="doc" size={14} />{docTabs(feature).length} Documents</span>
              {updated && <span className={styles.chip}><Icon name="event" size={14} />Last Updated: {formatDate(updated)}</span>}
            </div>
          </div>
        </div>
        <nav className={styles.tabs} aria-label={`${feature.title} documents`}>
          {tabs.map((t, i) => (
            <NavLink
              key={t.key}
              to={i === 0 ? `/features/${feature.id}` : `/features/${feature.id}/${t.key}`}
              end
              className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <TabContent key={`${feature.id}/${tab.key}`} tab={tab} />
    </div>
  );
}
