import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import type { Entry } from '../../lib/catalog';
import { TONES } from './tones';
import styles from './Catalog.module.css';

/** Features (and nested hubs) as rows: icon, name, one-line description, document count.
 *  A "coming soon" placeholder is a plain, muted row with no link. */
export function EntryList({ entries }: { entries: Entry[] }) {
  return (
    <div className={styles.list}>
      {entries.map((e, i) => {
        const inner = (
          <>
            <span className={`${styles.ic} ${styles.icSm} ${styles[TONES[i % TONES.length]]}`}>
              <Icon name={e.kind === 'hub' ? 'users' : 'doc'} size={20} />
            </span>
            <span className={styles.rowTxt}><b>{e.label}</b><span>{e.description}</span></span>
          </>
        );
        return e.kind === 'soon' ? (
          <div key={e.label} className={`${styles.row} ${styles.soonRow}`}>
            {inner}
            <span className={styles.docs}><span className={styles.soonTag}>{e.countText}</span></span>
          </div>
        ) : (
          <Link key={e.to} to={e.to} className={styles.row}>
            {inner}
            <span className={styles.docs}><Icon name="doc" size={15} />{e.countText}</span>
            <Icon name="chevronRight" size={16} className={styles.chev} />
          </Link>
        );
      })}
    </div>
  );
}
