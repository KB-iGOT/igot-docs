import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Footer } from './Footer';
import styles from './AppLayout.module.css';

/** Page chrome shared by every route: header, sidebar, content, footer. */
export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  /* each navigation starts at the top of the page */
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className={styles.app}>
      <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((o) => !o)} />
      <div className={styles.body}>
        <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
        {menuOpen && <div className={styles.scrim} onClick={() => setMenuOpen(false)} aria-hidden="true" />}
        <main className={styles.main} id="main">
          <Outlet />
        </main>
      </div>
      <Footer />
    </div>
  );
}
