import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import styles from './Breadcrumbs.module.css';

export interface Crumb {
  label: string;
  to?: string;
}

/** Home › … › current page. The last crumb is the current page and is not a link. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={styles.crumbs}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        const parent = i === items.length - 2;
        return (
          <Fragment key={`${c.label}-${i}`}>
            {last || !c.to ? (
              <span className={styles.current} aria-current={last ? 'page' : undefined}>{c.label}</span>
            ) : (
              <Link to={c.to} className={parent ? styles.parent : undefined}>{c.label}</Link>
            )}
            {!last && <span className={styles.sep} aria-hidden="true">&rsaquo;</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}
