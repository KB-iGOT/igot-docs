import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';
import { featureEntries, platformHubs, type Entry } from '../../lib/catalog';
import styles from './Sidebar.module.css';

const ARCHITECTURE_URL = 'igot-architecture-overview.html';

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

/** A hub that groups features (Learning Hub, Registration): opens as a dropdown of its features.
 *  It opens by itself when the page being read is one of its features. */
function Dropdown({ label, icon, items, pathname }: { label: string; icon: IconName; items: Entry[]; pathname: string }) {
  const containsActive = items.some((c) => pathname === c.to || pathname.startsWith(`${c.to}/`));
  const [open, setOpen] = useState(containsActive);
  useEffect(() => { if (containsActive) setOpen(true); }, [containsActive]);

  return (
    <div>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}
              className={`${styles.item} ${styles.subItem} ${containsActive ? styles.within : ''}`}>
        <Icon name={icon} />
        <span>{label}</span>
        <Icon name="chevronDown" size={15} strokeWidth={2} className={`${styles.chev} ${open ? '' : styles.closed}`} />
      </button>
      {open && (
        <div className={styles.nested}>
          {items.map((c) => (
            <NavLink key={c.to} to={c.to} className={({ isActive }) => `${styles.item} ${styles.nestedItem} ${isActive ? styles.active : ''}`}>
              <span>{c.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onNavigate: () => void;
}

/** Platform navigation: Home, the architecture overview, the platform hubs and the Features hub. */
export function Sidebar({ open, onNavigate }: Props) {
  const { pathname } = useLocation();
  const link = ({ isActive }: { isActive: boolean }) => `${styles.item} ${styles.subItem} ${isActive ? styles.active : ''}`;

  return (
    <nav className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Platform navigation"
         onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate()}>
      <NavLink to="/" end className={({ isActive }) => `${styles.item} ${isActive ? styles.active : ''}`}><Icon name="home" /><span>Home</span></NavLink>
      <a className={styles.item} href={ARCHITECTURE_URL}><Icon name="layers" /><span>Platform Overview</span></a>

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
    </nav>
  );
}
