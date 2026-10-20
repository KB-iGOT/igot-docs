import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import type { PlatformHub } from '../../lib/catalog';
import { TONES } from './tones';
import styles from './Catalog.module.css';

/** The platform hubs as cards: icon, count badge, description, link. */
export function HubCards({ hubs }: { hubs: PlatformHub[] }) {
  return (
    <div className={styles.hubs}>
      {hubs.map((h, i) => (
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
  );
}
