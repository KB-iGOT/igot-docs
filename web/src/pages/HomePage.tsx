import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../components/ui/Icon';
import { HeroArt } from './HeroArt';
import { featureEntries, platformHubs, stats } from '../lib/catalog';
import styles from './HomePage.module.css';

const TONES = ['blue', 'violet', 'green', 'orange', 'pink', 'teal'] as const;

const STATS: { value: number; label: string; icon: IconName }[] = [
  { value: stats.hubs, label: 'Platform Hubs', icon: 'layers' },
  { value: stats.features, label: 'Features', icon: 'doc' },
  { value: stats.documents, label: 'Documents', icon: 'guide' },
  { value: stats.diagrams, label: 'Diagrams', icon: 'tree' },
];

function SectionHead({ title, sub, to, more }: { title: string; sub: string; to: string; more: string }) {
  return (
    <div className={styles.secHead}>
      <div>
        <h2 className={styles.h2}>{title}</h2>
        <p className={styles.sub}>{sub}</p>
      </div>
      <Link to={to} className={styles.more}>{more} <Icon name="arrowRight" size={15} strokeWidth={2.2} /></Link>
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
      <div className={styles.hubs}>
        {platformHubs.map((h, i) => (
          <Link key={h.to} to={h.to} className={styles.hub}>
            <span className={styles.hubTop}>
              <span className={`${styles.ic} ${styles[TONES[i % TONES.length]]}`}><Icon name={h.icon} size={22} /></span>
              <span className={styles.badge} title={`${h.count} ${h.countLabel}`}>{h.count}</span>
            </span>
            <b>{h.name}</b>
            <p>{h.description}</p>
            <span className={styles.go}>View documentation <Icon name="arrowRight" size={14} strokeWidth={2.2} /></span>
          </Link>
        ))}
      </div>

      <SectionHead title="Platform Features" sub="Browse key platform features with user guides, APIs, diagrams and operational details." to="/hubs/features" more="View all features" />
      <div className={styles.feats}>
        {featureEntries.map((f, i) => (
          <Link key={f.to} to={f.to} className={styles.feat}>
            <span className={`${styles.ic} ${styles.icSm} ${styles[TONES[i % TONES.length]]}`}><Icon name={f.kind === 'hub' ? 'users' : 'doc'} size={20} /></span>
            <span className={styles.featTxt}><b>{f.label}</b><span>{f.description}</span></span>
            <span className={styles.docs}><Icon name="doc" size={15} />{f.countText}</span>
            <Icon name="chevronRight" size={16} className={styles.chev} />
          </Link>
        ))}
      </div>
    </div>
  );
}
