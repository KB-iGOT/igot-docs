import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/ui/Icon';
import { HubCards } from '../components/catalog/HubCards';
import { EntryList } from '../components/catalog/EntryList';
import { HeroArt } from './HeroArt';
import { featureEntries, platformHubs, stats } from '../lib/catalog';
import styles from './HomePage.module.css';

const STATS: { value: number; label: string; icon: IconName }[] = [
  { value: stats.hubs, label: 'Platform Hubs', icon: 'layers' },
  { value: stats.features, label: 'Features', icon: 'doc' },
  { value: stats.documents, label: 'Documents', icon: 'guide' },
  { value: stats.diagrams, label: 'Diagrams', icon: 'tree' },
];

export function SectionHead({ title, sub, to, more }: { title: string; sub: string; to?: string; more?: string }) {
  return (
    <div className={styles.secHead}>
      <div>
        <h2 className={styles.h2}>{title}</h2>
        <p className={styles.sub}>{sub}</p>
      </div>
      {to && <Link to={to} className={styles.more}>{more} <Icon name="arrowRight" size={15} strokeWidth={2.2} /></Link>}
    </div>
  );
}

/** Start page: what the docs cover, the platform hubs, and the Features hub. */
export function HomePage() {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <span className={styles.pill}>Platform Documentation</span>
          <h1 className={styles.title}>iGOT Karmayogi</h1>
          <p className={styles.lead}>Explore platform hubs, features and technical documentation.</p>
          <ul className={styles.stats}>
            {STATS.map((s) => (
              <li key={s.label} className={styles.stat}>
                <Icon name={s.icon} size={22} />
                <div><b>{s.value}</b><span>{s.label}</span></div>
              </li>
            ))}
          </ul>
        </div>
        <HeroArt className={styles.art} />
      </section>

      <SectionHead title="Platform Hubs" sub="Explore the main hubs of the iGOT platform and access detailed documentation." to="/hubs" more="View all hubs" />
      <HubCards hubs={platformHubs} />

      <SectionHead title="Platform Features" sub="Browse key platform features with user guides, APIs, diagrams and operational details." to="/hubs/features" more="View all features" />
      <EntryList entries={featureEntries} />
    </div>
  );
}
