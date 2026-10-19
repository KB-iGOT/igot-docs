import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/ui/Icon';
import { FeatureIcon } from '../components/ui/Icon';
import { getHub } from '../lib/catalog';
import { useFitScale } from '../hooks/useFitScale';
import type { Bubble } from '../types';
import styles from './HubPage.module.css';

const CANVAS_W = 1440;
const CANVAS_H = 960;
const ARCHITECTURE_URL = 'igot-architecture-overview.html';

const routeOf = (b: Bubble) => ('feature' in b.target ? `/features/${b.target.feature}` : `/hubs/${b.target.hub}`);

/** A hub as a ring of bubbles (the hub map, Learning Hub, Features, Registration).
 *  Bubble positions come from the catalogue, laid out on a fixed 1440x960 canvas that scales to fit. */
export function HubPage() {
  const { hubId = 'map' } = useParams();
  const navigate = useNavigate();
  const hub = getHub(hubId);
  const { ref, scale } = useFitScale<HTMLDivElement>(CANVAS_W, CANVAS_H, 170);
  if (!hub) return <Navigate to="/hubs" replace />;

  const parent = hub.parent ? getHub(hub.parent) : null;
  const backTo = parent ? (parent.id === 'map' ? '/hubs' : `/hubs/${parent.id}`) : '/';
  const backLabel = parent ? parent.name : 'Home';
  const c = hub.center;
  const cx = c.x + c.size / 2;
  const cy = c.y + c.size / 2;

  const centerInner = (
    <>
      <FeatureIcon markup={c.icon} size={hub.id === 'map' ? 36 : 32} />
      <span className={styles.centerTitle}>{c.label}</span>
      {c.sub && <span className={styles.centerSub}>{c.sub}</span>}
      {c.href && <span className={styles.archPill}>Architecture &#8599;</span>}
    </>
  );
  const centerStyle = { left: c.x, top: c.y, width: c.size, height: c.size };

  return (
    <div className={styles.page}>
      <div className={styles.bar}>
        <Link to={backTo} className={styles.back}><Icon name="arrowLeft" size={15} strokeWidth={2.2} /> {backLabel}</Link>
        <h1 className={styles.h1}>{hub.id === 'map' ? 'All platform hubs' : hub.name}</h1>
      </div>

      <div ref={ref} className={styles.fit} style={{ height: CANVAS_H * scale }}>
        <div className={styles.canvas} style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${scale})` }}>
          <svg className={styles.orbit} width={CANVAS_W} height={CANVAS_H} aria-hidden="true">
            {hub.bubbles.map((b) => (
              <line key={b.label} x1={cx} y1={cy} x2={b.x + b.size / 2} y2={b.y + b.size / 2} stroke="#1B4CA138" strokeWidth="1.5" strokeDasharray="4 6" />
            ))}
            {hub.orbit && <circle cx={hub.orbit.cx} cy={hub.orbit.cy} r={hub.orbit.r} fill="none" stroke="#1B4CA126" strokeWidth="1.5" strokeDasharray="5 7" />}
          </svg>

          {c.href ? (
            <a className={`${styles.bub} ${styles.center} ${styles.centerLink}`} style={centerStyle} href={ARCHITECTURE_URL} title="Open the platform architecture (bird's-eye HLD)">{centerInner}</a>
          ) : (
            <div className={`${styles.bub} ${styles.center}`} style={centerStyle}>{centerInner}</div>
          )}

          {hub.bubbles.map((b, i) => (
            <button
              key={b.label}
              type="button"
              className={`${styles.bub} ${styles[b.variant]}`}
              style={{ left: b.x, top: b.y, width: b.size, height: b.size, fontSize: b.fontSize, animationDelay: `${0.04 * i}s` }}
              onClick={() => navigate(routeOf(b))}
            >
              {b.label}
              {b.sub && <span className={styles.sub}>{b.sub}</span>}
            </button>
          ))}
        </div>
      </div>
      {hub.hint && <p className={styles.hint}>{hub.hint}</p>}
    </div>
  );
}
