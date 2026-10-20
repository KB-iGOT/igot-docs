import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import type { Entry } from '../../lib/catalog';
import { TONES } from './tones';
import styles from './Catalog.module.css';

/** Features (and nested hubs) as rows: icon, name, one-line description, document count. */
export function EntryList({ entries }: { entries: Entry[] }) {
  return (
    <div className={styles.list}>
      {entries.map((e, i) => (
        <Link key={e.to} to={e.to} className={styles.row}>
          <span className={`${styles.ic} ${styles.icSm} ${styles[TONES[i % TONES.length]]}`}>
            <Icon name={e.kind === 'hub' ? 'users' : 'doc'} size={20} />
          </span>
          <span className={styles.rowTxt}><b>{e.label}</b><span>{e.description}</span></span>
          <span className={styles.docs}><Icon name="doc" size={15} />{e.countText}</span>
          <Icon name="chevronRight" size={16} className={styles.chev} />
        </Link>
      ))}
    </div>
  );
}
