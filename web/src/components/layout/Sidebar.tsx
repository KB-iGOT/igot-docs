import { useState } from 'react';
import { NavLink, useLocation, matchPath } from 'react-router-dom';
import { Icon, type IconName } from '../ui/Icon';
import { featureEntries, parentHubOf, platformHubs } from '../../lib/catalog';
import styles from './Sidebar.module.css';

const ARCHITECTURE_URL = 'igot-architecture-overview.html';

/** where the reader is, as the sidebar entry to highlight */
function useActiveTarget(): string {
  const { pathname } = useLocation();
  const feature = matchPath('/features/:id/*', pathname)?.params.id;
  if (feature) {
    const parent = parentHubOf(feature);
    if (parent === 'learning' || parent === 'registration') return `/hubs/${parent}`;
    return `/features/${feature}`;
  }
  return pathname;
}

function Group({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={styles.group}>
      <button type="button" className={`${styles.item} ${styles.head}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        <Icon name={icon} />
        <span>{title}</span>
        <Icon name="chevronDown" size={16} strokeWidth={2} className={`${styles.chev} ${open ? '' : styles.closed}`} />
      </button>
      {open && <div className={styles.sub}>{children}</div>}
    </div>
  );
}

interface Props {
  open: boolean;
  onNavigate: () => void;
}

/** Platform navigation: Home, the architecture overview, the platform hubs and the Features hub. */
export function Sidebar({ open, onNavigate }: Props) {
  const active = useActiveTarget();
  const cls = (to: string, sub = false) => `${styles.item} ${sub ? styles.subItem : ''} ${active === to ? styles.active : ''}`;

  return (
    <nav className={`${styles.sidebar} ${open ? styles.open : ''}`} aria-label="Platform navigation" onClick={(e) => (e.target as HTMLElement).closest('a') && onNavigate()}>
      <NavLink to="/" end className={cls('/')}><Icon name="home" /><span>Home</span></NavLink>
      <a className={styles.item} href={ARCHITECTURE_URL}><Icon name="layers" /><span>Platform Overview</span></a>

      <Group title="Platform Hubs" icon="box">
        {platformHubs.map((h) => (
          <NavLink key={h.to} to={h.to} className={cls(h.to, true)}><Icon name={h.icon} /><span>{h.name}</span></NavLink>
        ))}
      </Group>

      <Group title="Features" icon="grid">
        {featureEntries.map((f) => (
          <NavLink key={f.to} to={f.to} className={cls(f.to, true)}><Icon name={f.kind === 'hub' ? 'users' : 'doc'} /><span>{f.label}</span></NavLink>
        ))}
        <NavLink to="/hubs/features" className={`${cls('/hubs/features', true)} ${styles.more}`}>
          <span>View all features</span><Icon name="chevronRight" size={14} />
        </NavLink>
      </Group>
    </nav>
  );
}
