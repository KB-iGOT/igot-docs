import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';
import { featureEntries, platformHubs, type Entry } from '../../lib/catalog';
import { TELEMETRY_URL } from '../../lib/links';
import styles from './Sidebar.module.css';


/** A collapsible section heading (Platform Hubs, Features). */
function Group({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.group}>
      <button type="button" className={`${styles.item} ${styles.head}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={icon} />
        <span>{title}</span>
        <Icon name="chevronDown" size={16} strokeWidth={2} className={`${styles.chev} ${open ? '' : styles.closed}`} />
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

/** does a list of entries contain the page being read, looking inside nested hubs too */
const holds = (items: Entry[], pathname: string): boolean =>
  items.some((c) => (c.to && (pathname === c.to || pathname.startsWith(`${c.to}/`))) || holds(c.children ?? [], pathname));

/** A hub that groups features (Learning Hub, Registration, and Course / Programs / Assessment inside
 *  Learning Hub): opens as a dropdown of its entries, nested hubs opening as dropdowns of their own.
 *  It opens by itself when the page being read is inside it. */
function Dropdown({ label, icon, items, pathname, nested = false }:
                  { label: string; icon?: IconName; items: Entry[]; pathname: string; nested?: boolean }) {
  const containsActive = holds(items, pathname);
  const [open, setOpen] = useState(containsActive);
  useEffect(() => { if (containsActive) setOpen(true); }, [containsActive]);

  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
              className={`${styles.item} ${nested ? styles.nestedItem : styles.subItem} ${containsActive ? styles.within : ''}`}>
        {icon && <Icon name={icon} />}
        <span>{label}</span>
        <Icon name="chevronDown" size={nested ? 14 : 15} strokeWidth={2} className={`${styles.chev} ${open ? '' : styles.closed}`} />
      </button>
      {open && (
        <div className={`${styles.nested} ${nested ? styles.nestedDeep : ''}`}>
          {items.map((c) =>
            c.kind === 'hub' ? (
              <Dropdown key={c.to} label={c.label} items={c.children ?? []} pathname={pathname} nested />
            ) : c.kind === 'soon' ? (
              <span key={c.label} className={`${styles.item} ${styles.nestedItem} ${styles.soon}`} title="Documentation coming soon">
                <span>{c.label}</span><span className={styles.soonTag}>Soon</span>
              </span>
            ) : (
              <NavLink key={c.to} to={c.to} className={({ isActive }) => `${styles.item} ${styles.nestedItem} ${isActive ? styles.active : ''}`}>
                <span>{c.label}</span>
              </NavLink>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Data Pipeline: a dropdown of Telemetry (an external document) and ETL Analytics (still to come). */
function DataPipeline() {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={styles.item}>
        <Icon name="layers" />
        <span>Data Pipeline</span>
        <Icon name="chevronDown" size={15} strokeWidth={2} className={`${styles.chev} ${open ? '' : styles.closed}`} />
      </button>
      {open && (
        <div className={styles.nested}>
          <a href={TELEMETRY_URL} target="_blank" rel="noopener noreferrer" className={`${styles.item} ${styles.nestedItem}`}>
            <span>Telemetry</span><Icon name="external" size={13} strokeWidth={2} className={styles.ext} />
          </a>
          <span className={`${styles.item} ${styles.nestedItem} ${styles.soon}`} title="Documentation coming soon">
            <span>ETL Analytics</span><span className={styles.soonTag}>Soon</span>
          </span>
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onNavigate: () => void;
}

/** A top-level section whose documentation is still to come: listed, but not a link. */
function Soon({ label, icon }: { label: string; icon: IconName }) {
  return (
    <span className={`${styles.item} ${styles.soon}`} title="Documentation coming soon">
      <Icon name={icon} /><span>{label}</span><span className={styles.soonTag}>Soon</span>
    </span>
  );
}

/** Platform navigation, in the home page's order: Home, Platform Overview, System Architecture,
 *  the platform hubs, the Features hub, API Documentation, Data Pipeline and Monitoring. */
export function Sidebar({ open, onNavigate }: Props) {
  const { pathname } = useLocation();
  const link = ({ isActive }: { isActive: boolean }) => `${styles.item} ${styles.subItem} ${isActive ? styles.active : ''}`;

  return (
    <nav className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Platform navigation"
         onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate()}>
      <NavLink to="/" end className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}><Icon name="home" /><span>Home</span></NavLink>
      <NavLink to="/platform-overview" className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}><Icon name="layers" /><span>Platform Overview</span></NavLink>
      <Soon label="System Architecture" icon="tree" />

      <Group title="Platform Hubs" icon="box">
        {platformHubs.map((h) =>
          h.children ? (
            <Dropdown key={h.to} label={h.name} icon={h.icon} items={h.children} pathname={pathname} />
          ) : (
            <NavLink key={h.to} to={h.to} className={link}><Icon name={h.icon} /><span>{h.name}</span></NavLink>
          ),
        )}
      </Group>

      <Group title="Features" icon="grid">
        {featureEntries.map((f) =>
          f.children ? (
            <Dropdown key={f.to} label={f.label} icon="users" items={f.children} pathname={pathname} />
          ) : (
            <NavLink key={f.to} to={f.to} className={link}><Icon name="doc" /><span>{f.label}</span></NavLink>
          ),
        )}
        <NavLink to="/hubs/features" end className={({ isActive }) => `${link({ isActive })} ${styles.more}`}>
          <span>View all features</span><Icon name="chevronRight" size={14} />
        </NavLink>
      </Group>

      <div className={styles.group}>
        <Soon label="API Documentation" icon="guide" />
        <DataPipeline />
        <Soon label="Monitoring" icon="search" />
      </div>
    </nav>
  );
}
