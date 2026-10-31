import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/ui/Icon';
import { HubCards } from '../components/catalog/HubCards';
import { EntryList } from '../components/catalog/EntryList';
import { HeroArt } from './HeroArt';
import { featureEntries, platformHubs, stats } from '../lib/catalog';
import { TELEMETRY_URL } from '../lib/links';
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

/** Start page, in the agreed order: Platform Overview, System Architecture, Platform Hubs,
 *  Platform Features, API Documentation, Data Pipeline, Monitoring. */
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

      <section className={styles.section}>
        <SectionHead title="Platform Overview" sub="A one-page view of the whole iGOT Karmayogi platform: portals, services, data stores and how they connect." />
        <Link to="/platform-overview" className={styles.overview}>
          <span className={styles.overviewIc}><Icon name="layers" size={22} /></span>
          <span className={styles.overviewTxt}><b>Platform Overview</b><span>Open the platform overview page.</span></span>
          <Icon name="arrowRight" size={16} strokeWidth={2.2} />
        </Link>
      </section>

      <section className={styles.section}>
        <SectionHead title="System Architecture" sub="Architecture of the platform as a whole: components, boundaries and how requests flow." />
        <Link to="/system-architecture" className={styles.overview}>
          <span className={styles.overviewIc}><Icon name="tree" size={22} /></span>
          <span className={styles.overviewTxt}><b>System Architecture</b><span>Open the system architecture page.</span></span>
          <Icon name="arrowRight" size={16} strokeWidth={2.2} />
        </Link>
      </section>

      <section className={styles.section}>
        <SectionHead title="Platform Hubs" sub="Explore the main hubs of the iGOT platform and access detailed documentation." to="/hubs" more="View all hubs" />
        <HubCards hubs={platformHubs} />
      </section>

      <section className={styles.section}>
        <SectionHead title="Platform Features" sub="Browse key platform features with user guides, APIs, diagrams and operational details." to="/hubs/features" more="View all features" />
        <EntryList entries={featureEntries} />
      </section>

      <section className={styles.section}>
        <SectionHead title="API Documentation" sub="The platform's APIs: gateway routing, contracts and examples." />
        <Link to="/api-docs" className={styles.overview}>
          <span className={styles.overviewIc}><Icon name="guide" size={22} /></span>
          <span className={styles.overviewTxt}><b>API Documentation</b><span>Open the API documentation page.</span></span>
          <Icon name="arrowRight" size={16} strokeWidth={2.2} />
        </Link>
      </section>
      <section className={styles.section}>
        <SectionHead title="Data Pipeline" sub="How platform data flows through ingestion, processing and reporting." />
        <div className={styles.pipeline}>
          <a href={TELEMETRY_URL} target="_blank" rel="noopener noreferrer" className={styles.overview}>
            <span className={styles.overviewIc}><Icon name="layers" size={22} /></span>
            <span className={styles.overviewTxt}><b>Telemetry</b><span>Open the telemetry document on SharePoint.</span></span>
            <Icon name="external" size={16} strokeWidth={2.2} />
          </a>
          <Link to="/etl-analytics" className={styles.overview}>
            <span className={styles.overviewIc}><Icon name="tree" size={22} /></span>
            <span className={styles.overviewTxt}><b>ETL Analytics</b><span>Open the ETL Analytics page.</span></span>
            <Icon name="arrowRight" size={16} strokeWidth={2.2} />
          </Link>
        </div>
      </section>
      <section className={styles.section}>
        <SectionHead title="Monitoring" sub="Health, alerting and operational monitoring of the platform." />
        <Link to="/monitoring" className={styles.overview}>
          <span className={styles.overviewIc}><Icon name="search" size={22} /></span>
          <span className={styles.overviewTxt}><b>Monitoring</b><span>Open the monitoring page.</span></span>
          <Icon name="arrowRight" size={16} strokeWidth={2.2} />
        </Link>
      </section>
    </div>
  );
}
