import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import { COLBLURB, COLUMNS, GORDER, GROUPS, LINKS, NODES, type Column, type GroupId, type Node } from '../data/platformOverview';
import styles from './PlatformOverviewPage.module.css';

/* lookups built once from the data */
const byId: Record<string, Node> = {};
const byGroup: Partial<Record<GroupId, Node[]>> = {};
const adj: Record<string, string[]> = {};
const colOf = {} as Record<GroupId, string>;
const colById: Record<string, Column> = {};
COLUMNS.forEach((c) => { colById[c.id] = c; c.groups.forEach((g) => { colOf[g] = c.id; }); });
NODES.forEach((n) => { byId[n.id] = n; (byGroup[n.layer] ??= []).push(n); });
LINKS.forEach(([a, b]) => { (adj[a] ??= []).push(b); (adj[b] ??= []).push(a); });
const cidx = (colId: string) => COLUMNS.findIndex((c) => c.id === colId);
const colCount = (c: Column) => c.groups.reduce((a, g) => a + (byGroup[g] ?? []).length, 0);

interface State { focus: string | null; picked: string | null }

/** columns shown open: the picked component's column and its neighbours' columns, or the focused column and the two beside it */
function revealed({ focus, picked }: State): Record<string, boolean> {
  const r: Record<string, boolean> = {};
  if (picked) { r[colOf[byId[picked].layer]] = true; (adj[picked] ?? []).forEach((o) => { r[colOf[byId[o].layer]] = true; }); }
  else if (focus) {
    const i = cidx(focus); r[focus] = true;
    if (i > 0) r[COLUMNS[i - 1].id] = true;
    if (i < COLUMNS.length - 1) r[COLUMNS[i + 1].id] = true;
  }
  return r;
}

/** links to draw as wires: [from, to, sameColumn?] */
function visibleLinks(s: State): [Node, Node, boolean?][] {
  const r = revealed(s), out: [Node, Node, boolean?][] = [];
  LINKS.forEach(([x, y]) => {
    const a = byId[x], b = byId[y], ca = colOf[a.layer], cb = colOf[b.layer];
    if (!r[ca] || !r[cb]) return;
    if (ca === cb) { if (!s.picked || (x !== s.picked && y !== s.picked)) return; out.push([a, b, true]); return; }
    if (s.picked) { if (x !== s.picked && y !== s.picked) return; }
    else if (s.focus) { if (ca !== s.focus && cb !== s.focus) return; }
    out.push(cidx(ca) < cidx(cb) ? [a, b] : [b, a]);
  });
  return out;
}

function Pill({ n, small, cls }: { n: Node; small?: boolean; cls?: string }) {
  const G = GROUPS[n.layer];
  const style: CSSProperties = { borderColor: G.color, color: n.layer === 'ext' ? '#5A3D05' : G.color };
  return (
    <button type="button" data-id={n.id} style={style}
            className={[styles.pill, small && styles.sm, n.b && styles.b, cls].filter(Boolean).join(' ')}>
      {n.label}{n.b ? ' ◌' : ''}
      {!small && n.sub && <small>{n.sub}</small>}
    </button>
  );
}

/** The four-layer diagram: click a layer to focus it, a component to see what it talks to. */
function LayerStage() {
  const [state, setState] = useState<State>({ focus: null, picked: null });
  const [fullscreen, setFullscreen] = useState(false);
  const card = useRef<HTMLDivElement>(null), stage = useRef<HTMLDivElement>(null), wires = useRef<SVGSVGElement>(null);
  const stateRef = useRef(state); stateRef.current = state;

  const drawWires = useCallback(() => {
    const st = stage.current, svg = wires.current; if (!st || !svg) return;
    const s = stateRef.current, sr = st.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
    let html = '';
    visibleLinks(s).forEach(([a, b, same]) => {
      const pa = st.querySelector(`[data-id="${a.id}"]`), pb = st.querySelector(`[data-id="${b.id}"]`); if (!pa || !pb) return;
      const ra = pa.getBoundingClientRect(), rb = pb.getBoundingClientRect(), col = GROUPS[a.layer].color;
      if (same) {
        const down = rb.top > ra.top;
        const sx = ra.right - sr.left - 14, sy = (down ? ra.bottom : ra.top) - sr.top, ex = rb.right - sr.left - 14, ey = (down ? rb.top : rb.bottom) - sr.top, ox = ra.right - sr.left + 16;
        html += `<path d="M${sx},${sy} C${ox},${sy} ${ox},${ey} ${ex},${ey}" fill="none" stroke="${col}" stroke-width="2.2" opacity=".9"/><circle cx="${ex}" cy="${ey}" r="3" fill="${col}"/>`;
        return;
      }
      const x1 = ra.right - sr.left, y1 = ra.top + ra.height / 2 - sr.top, x2 = rb.left - sr.left, y2 = rb.top + rb.height / 2 - sr.top;
      const dx = Math.max(30, (x2 - x1) * 0.5), ext = b.layer === 'ext';
      html += `<path d="M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}" fill="none" stroke="${col}" stroke-width="${s.picked ? 2.2 : 1.4}" opacity="${s.picked ? 0.9 : 0.55}"${ext ? ' stroke-dasharray="5 4"' : ''}/><circle cx="${x2}" cy="${y2}" r="3" fill="${col}"/>`;
    });
    svg.innerHTML = html;
  }, []);

  /* the columns animate their width for ~0.4 s: redraw the wires every frame until they settle */
  useLayoutEffect(() => {
    const until = performance.now() + 460; let raf = 0;
    const loop = () => { drawWires(); if (performance.now() < until) raf = requestAnimationFrame(loop); };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [state, fullscreen, drawWires]);

  useEffect(() => {
    const onResize = () => drawWires();
    const onFs = () => { setFullscreen(!!document.fullscreenElement); setTimeout(drawWires, 300); };
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onFs);
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs); };
  }, [drawWires]);

  const focusCol = (id: string) => { if (id === 'ext') return; setState((s) => ({ picked: null, focus: s.focus === id ? null : id })); };
  const pick = (id: string) => setState((s) => {
    if (s.picked === id) return { ...s, picked: null };
    const c = colOf[byId[id].layer];
    return { picked: id, focus: c === 'ext' ? s.focus : c };
  });
  const reset = () => setState({ focus: null, picked: null });
  const toggleFullscreen = () => { if (document.fullscreenElement) document.exitFullscreen(); else card.current?.requestFullscreen?.(); };

  const r = revealed(state), any = !!(state.focus || state.picked);
  const pickCol = state.picked ? colOf[byId[state.picked].layer] : null;
  const rel = state.picked ? (adj[state.picked] ?? []) : [];
  const sameBelow = state.picked ? rel.some((x) => colOf[byId[x].layer] === pickCol) : false;

  let hint: string;
  if (state.picked) hint = `${byId[state.picked].label} — ${rel.length} connection${rel.length === 1 ? '' : 's'} shown`;
  else if (state.focus) {
    const i = cidx(state.focus);
    const nb = [i > 0 ? COLUMNS[i - 1].name : null, i < COLUMNS.length - 1 ? COLUMNS[i + 1].name : null].filter(Boolean);
    hint = `${colById[state.focus].name} focused — connections to ${nb.join(' and ')}`;
  } else hint = 'All layers shown — click a layer to focus it';

  const pillCls = (id: string) => [
    id === state.picked && styles.picked,
    id === state.picked && sameBelow && styles.gapped,
    (id === state.picked || rel.includes(id)) && styles.on,
  ].filter(Boolean).join(' ');

  const onStageClick = (e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const p = t.closest<HTMLElement>('[data-id]'); if (p) { pick(p.dataset.id!); return; }
    const c = t.closest<HTMLElement>('[data-col]'); if (c) focusCol(c.dataset.col!);
  };

  const picked = state.picked ? byId[state.picked] : null;
  const relGroups: Partial<Record<GroupId, Node[]>> = {};
  rel.forEach((x) => { (relGroups[byId[x].layer] ??= []).push(byId[x]); });

  return (
    <div className={styles.stagecard} ref={card}>
      <div className={styles.tools}>
        <span>{hint}</span>
        <span>
          {any && <button type="button" onClick={reset}>Reset</button>}{' '}
          <button type="button" title="Full screen" onClick={toggleFullscreen}>{fullscreen ? '⤡ Exit full screen' : '⤢ Full screen'}</button>
        </span>
      </div>
      <div className={[styles.stage, any && styles.has, state.picked && styles.sel].filter(Boolean).join(' ')} ref={stage} onClick={onStageClick}>
        <svg className={styles.wires} ref={wires} />
        {COLUMNS.map((c, i) => {
          const multi = c.groups.length > 1, G0 = GROUPS[c.groups[0]];
          const color = multi ? '#2C3340' : G0.color, soft = multi ? '#F3F4F7' : G0.soft;
          const focus = any && ((state.focus === c.id && !state.picked) || pickCol === c.id);
          const cls = [styles.col, c.id === 'ext' && styles.ext, c.id === 'services' && styles.services,
            focus && styles.focus, any && r[c.id] && !focus && styles.reveal, any && !r[c.id] && styles.thin,
            pickCol === c.id && styles.haspick].filter(Boolean).join(' ');
          return (
            <Fragment key={c.id}>
              <div className={cls} data-col={c.id} style={{ borderColor: color }}>
                <div className={styles.face} style={{ background: soft }}>
                  {multi
                    ? <span className={styles.dots}>{c.groups.map((g) => <span key={g} className={styles.num} style={{ background: GROUPS[g].color }} title={GROUPS[g].name}>{c.n}</span>)}</span>
                    : <span className={styles.num} style={{ background: color }}>{c.n}</span>}
                  <span className={styles.vt}>{c.name}<small>{c.tag}</small></span>
                  <span className={styles.cnt} style={{ background: color }}>{colCount(c)}</span>
                </div>
                <div className={styles.body}>
                  <div className={styles.head} style={{ background: soft }}>
                    <span className={styles.num} style={{ background: color }}>{c.n}</span>
                    <span className={styles.ttl}>{c.name}<small>{c.tag} · {colCount(c)}</small></span>
                  </div>
                  <div className={styles.groups}>
                    {c.groups.map((g) => {
                      const G = GROUPS[g];
                      return (
                        <div key={g} className={styles.grp} style={{ borderColor: G.color }}>
                          {multi && (
                            <div className={styles.ghead} style={{ color: G.color }}>
                              <span className={styles.dot} style={{ background: G.color }}>{(byGroup[g] ?? []).length}</span>
                              {G.name}{G.sub && <small>{G.sub}</small>}
                            </div>
                          )}
                          <div className={styles.pills}>{(byGroup[g] ?? []).map((n) => <Pill key={n.id} n={n} cls={pillCls(n.id)} />)}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className={styles.blurb}>{COLBLURB[c.id] ?? G0.blurb}</div>
                </div>
              </div>
              {i < COLUMNS.length - 1 && <span className={styles.chev}>›</span>}
            </Fragment>
          );
        })}
      </div>
      <div className={styles.legend}>
        <span><i style={{ background: '#EF951E' }} />from portals</span><span><i style={{ background: '#4E5562' }} />from gateways</span>
        <span><i style={{ background: '#1B4CA1' }} />from iGOT services</span><span><i style={{ background: '#0F7A5E' }} />from Sunbird Knowlg</span>
        <span><i style={{ background: '#B45309' }} />from Sunbird Lern</span><span><i style={{ background: '#5B6472' }} />live stores</span>
        <span><i style={{ background: '#7B3FA0' }} />messaging</span><span><i style={{ background: '#0E7490' }} />analytics stores</span>
        <span><i style={{ background: '#C8933A', borderTop: '2px dashed #C8933A', height: 0 }} />external</span><span>◌ documented from contracts / config only</span>
      </div>
      {picked && (
        <div className={styles.detail} onClick={(e) => { const p = (e.target as HTMLElement).closest<HTMLElement>('[data-id]'); if (p) pick(p.dataset.id!); }}>
          <button type="button" className={styles.close} title="Close" onClick={() => setState((s) => ({ ...s, picked: null }))}>×</button>
          <div className={styles.eyebrow}><span className={styles.swatch} style={{ background: GROUPS[picked.layer].color }} />{GROUPS[picked.layer].name}</div>
          <h3>{picked.label}{picked.b ? ' ◌' : ''}</h3>
          {picked.sub && <p><code>{picked.sub}</code></p>}
          <p>{picked.owns}</p>
          <div className={styles.rel}>
            {GORDER.filter((k) => relGroups[k]).map((k) => (
              <div key={k}><b>{GROUPS[k].name}</b><div className={styles.relPills}>{relGroups[k]!.map((m) => <Pill key={m.id} n={m} small />)}</div></div>
            ))}
          </div>
          {picked.repo && <p className={styles.repo}><a href={`https://github.com/KB-iGOT/${picked.repo}`}>github.com/KB-iGOT/{picked.repo}</a></p>}
          {picked.b && <div className={styles.bnote}><b>Verification boundary</b> — documented from client contracts, Kong routes or deployment config; source not traced in this doc set.</div>}
        </div>
      )}
    </div>
  );
}

const RG: Record<string, string> = { Portals: styles.rgC, Gateway: styles.rgG, Knowlg: styles.rgS, Lern: styles.rgL, iGOT: styles.rgI, Data: styles.rgD };
const Rg = ({ k }: { k: keyof typeof RG }) => <span className={`${styles.rg} ${RG[k]}`}>{k}</span>;

const COMPONENTS: [React.ReactNode, string, React.ReactNode, string, React.ReactNode][] = [
  [<code>sunbird-cb-uiproxy</code>, 'Gateway', <>Browser session, Keycloak token exchange, allow-listed <code>/apis</code> routes, forwards to Kong</>, '—', <a href="https://github.com/KB-iGOT/sunbird-cb-uiproxy">sunbird-cb-uiproxy</a>],
  ['Kong', 'Gateway', <>Public URI → internal service map (<code>sunbird-devops › kong-api</code>), JWT / CORS / ACL plugins</>, '—', <><a href="https://github.com/KB-iGOT/sunbird-devops">sunbird-devops</a> › kong-api</>],
  ['Keycloak', 'Gateway', 'Identity, login theme, realms, SSO clients (incl. marketplace partner SSO)', 'own DB', <><a href="https://github.com/KB-iGOT/sunbird-devops">sunbird-devops</a> › keycloak</>],
  [<code>sunbird-cb-ext</code>, 'iGOT', 'Registration orchestration, custom links, org creation/hierarchy, profile, karma points, competency-designation mapping, search-by directory', 'Cassandra · Elasticsearch · Redis · Postgres', <a href="https://github.com/KB-iGOT/sunbird-cb-ext">sunbird-cb-ext</a>],
  [<code>cb-ext-course-service</code>, 'iGOT', 'Karmayogi-specific course / enrolment extensions', 'Cassandra · Redis', <a href="https://github.com/KB-iGOT/cb-ext-course-service">cb-ext-course-service</a>],
  [<code>sunbird-cb-workflow</code>, 'iGOT', 'Approval workflows: user registration, domain, organisation, position, blended-program enrolment', 'Postgres', <a href="https://github.com/KB-iGOT/sunbird-cb-workflow">sunbird-cb-workflow</a>],
  [<code>frac-backend</code>, 'iGOT', 'FRAC competency taxonomy (parallel to the knowledge-platform framework)', 'Postgres', <a href="https://github.com/KB-iGOT/frac-backend">frac-backend</a>],
  ['Discussion family', 'iGOT', <><code>cb-discussion-service</code>, <code>cb-community-service</code>, <code>cb-comment-service</code>, meta-update consumers; language detection &amp; profanity via ML sidecar</>, 'Cassandra · Elasticsearch · Kafka', <><a href="https://github.com/KB-iGOT/cb-discussion-service">cb-discussion-service</a> · <a href="https://github.com/KB-iGOT/cb-community-service">cb-community-service</a> · <a href="https://github.com/KB-iGOT/cb-comment-service">cb-comment-service</a></>],
  ['Marketplace trio', 'iGOT', <><code>cb-pores-service</code> (partner master), <code>cios-content-service</code> (catalog ETL, partner sync), <code>cb_external_enrollment_service</code> (enrolment, licence limits)</>, 'Postgres · Elasticsearch · Cassandra · Redis · GCS', <><a href="https://github.com/KB-iGOT/cb-pores-service">cb-pores-service</a> · <a href="https://github.com/KB-iGOT/cios-content-service">cios-content-service</a> · <a href="https://github.com/KB-iGOT/cb_external_enrollment_service">cb_external_enrollment_service</a></>],
  [<code>notification-service</code>, 'iGOT', <>Email / notification dispatch, with <code>cb-notification-wrapper-service</code> in front</>, '—', <a href="https://github.com/KB-iGOT/notification-service">notification-service</a>],
  ['AI services', 'iGOT', <><code>nlp-search</code> keyword extraction, <code>ai-assessment-service</code>, AI CBP authoring, profanity model</>, 'Gemini / Vertex AI', <><a href="https://github.com/KB-iGOT/nlp-search">nlp-search</a> · <a href="https://github.com/KB-iGOT/ai-assessment-service">ai-assessment-service</a></>],
  [<code>cb-core-data</code>, 'iGOT', 'Nightly Spark / DuckDB stages: extract → pre-join → reports, warehouse, cache, karma, leaderboards', 'Postgres warehouse · BigQuery · Redis · Cassandra · GCS', <a href="https://github.com/KB-iGOT/cb-core-data">cb-core-data</a>],
  [<code>knowledge-platform</code>, 'Knowlg', 'content-service (lifecycle), search-service (Elasticsearch read), taxonomy / framework API', 'Neo4j · Elasticsearch · Cassandra · Redis', <a href="https://github.com/KB-iGOT/knowledge-platform">knowledge-platform</a>],
  [<code>knowledge-mw-service</code>, 'Knowlg', <>Legacy Node middleware relaying v1 composite search and content proxies to the current knowledge-platform services (<code>knowledge-mw-service:5000</code> in Kong)</>, '—', <a href="https://github.com/KB-iGOT/knowledge-mw-service">knowledge-mw-service</a>],
  [<code>sunbird-lms-service</code>, 'Lern', 'User accounts, organisations, roles, OTP, SSO user creation', 'Cassandra · Elasticsearch', <a href="https://github.com/KB-iGOT/sunbird-lms-service">sunbird-lms-service</a>],
  [<code>sunbird-course-service</code>, 'Lern', 'Batches, enrolments, content-state progress, external-course enrolment path', 'Cassandra · Redis', <a href="https://github.com/KB-iGOT/sunbird-course-service">sunbird-course-service</a>],
  [<code>knowledge-platform-jobs</code>, 'Knowlg', 'Flink jobs: search indexer, publish pipeline', 'Kafka → Elasticsearch · Neo4j', <a href="https://github.com/KB-iGOT/knowledge-platform-jobs">knowledge-platform-jobs</a>],
];

/** Platform Overview: the bird's-eye high-level design of the whole platform. */
export function PlatformOverviewPage() {
  return (
    <div className={styles.page}>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Platform Overview' }]} />

      <header className={styles.hero}>
        <div className={styles.kicker}>High-level design · bird's-eye view</div>
        <h1 className={styles.title}>iGOT Karmayogi platform architecture</h1>
        <p className={styles.lede}>Four portals and a mobile app reach, through <b>two gateway front doors</b>, a Karmayogi-specific service layer that <b>extends — never forks —</b> the open-source Sunbird building blocks (Knowlg and Lern). Everything persists in a set of purpose-built stores, talks asynchronously over Kafka, and is mined nightly into a BI warehouse — all running on Kubernetes in Google Cloud.</p>
        <div className={styles.chips}>
          <span className={styles.chip}>Scope: whole platform, incl. Sunbird Knowlg + Lern</span>
          <span className={styles.chip}>No APIs · no use cases · no data models</span>
          <span className={`${styles.chip} ${styles.ok}`}>✓ Components traced in the feature HLDs · Oct 2026</span>
          <span className={styles.chip}>◌ = documented from contracts / config only</span>
        </div>
      </header>

      <section id="layers" className={styles.section}>
        <h2 className={styles.h2}>The platform in four layers</h2>
        <p className={styles.h2sub}>Read left to right the way a request travels: people → gateways → services → data. iGOT services and the two upstream Sunbird building blocks — <b>Knowlg</b> and <b>Lern</b> — sit <b>shoulder to shoulder</b> in the services layer: Kong routes to any of them directly, and iGOT calls into the Sunbird blocks sideways. <b>Click a layer</b> to focus it — unrelated layers slim down to bars and the connections to its neighbours flow across the gaps. <b>Click a component</b> to see everything it talks to, wherever it sits. Click the focused layer again (or Reset) to go back.</p>
        <LayerStage />
        <div className={styles.infra}><b>Runs on</b> Kubernetes (GKE) · Google Cloud asia-south1 &nbsp;·&nbsp; <b>defined by</b> <code>sunbird-devops</code> (Ansible · Helm · Kong route map) &nbsp;·&nbsp; <b>built &amp; deployed by</b> Jenkins CI/CD ◌</div>
      </section>

      <section id="flows" className={styles.section}>
        <h2 className={styles.h2}>Four flows that cross the layers</h2>
        <p className={styles.h2sub}>Shown at ring level only — the per-feature HLD pages carry the service-by-service version.</p>
        <div className={styles.flows}>
          <div className={styles.flow}><h3>Learn <small>a Karmayogi takes a course</small></h3><ol>
            <li><Rg k="Portals" /><Rg k="Gateway" /> portal or mobile enters via <code>/apis</code> → Kong</li>
            <li><Rg k="Knowlg" /> search-service to discover; <Rg k="Lern" /> course-service to enrol and track progress</li>
            <li><Rg k="Data" /> state in Cassandra; completion event on Kafka</li>
            <li><Rg k="iGOT" /><Rg k="Lern" /> karma points, certificates react to the event</li>
            <li><Rg k="iGOT" /><Rg k="Data" /> next nightly run refreshes leaderboards and the warehouse</li></ol></div>
          <div className={styles.flow}><h3>Create &amp; publish <small>content reaches learners</small></h3><ol>
            <li><Rg k="Portals" /><Rg k="Gateway" /> creation portal → gateway</li>
            <li><Rg k="Knowlg" /> knowledge-platform: Draft → Review → Live</li>
            <li><Rg k="Data" /> publish event on Kafka</li>
            <li><Rg k="Knowlg" /> Flink publish &amp; indexer jobs</li>
            <li><Rg k="Data" /> Elasticsearch / Neo4j / GCS updated; visible to learners</li></ol></div>
          <div className={styles.flow}><h3>Onboard <small>a user or a department joins</small></h3><ol>
            <li><Rg k="Portals" /> public sign-up, admin portal or CSV upload</li>
            <li><Rg k="Gateway" /> Keycloak identity</li>
            <li><Rg k="iGOT" /> sunbird-cb-ext orchestrates; workflow approvals where required</li>
            <li><Rg k="Lern" /> sunbird-lms-service creates the account</li>
            <li><Rg k="iGOT" /><Rg k="Data" /> notification mail; user directory in Cassandra / Elasticsearch</li></ol></div>
          <div className={styles.flow}><h3>Measure <small>the platform reports on itself</small></h3><ol>
            <li><Rg k="iGOT" /><Rg k="Data" /> cb-core-data extracts nightly from the live stores</li>
            <li><Rg k="iGOT" /> pre-join, then ~46 independent Stage-2 jobs</li>
            <li><Rg k="Data" /> Postgres warehouse + BigQuery → Looker (external)</li>
            <li><Rg k="Data" /> Redis live-dashboard keys; Cassandra karma &amp; leaderboards</li>
            <li><Rg k="Portals" /> read back by portals and admins</li></ol></div>
        </div>
      </section>

      <section id="architects" className={styles.section}>
        <h2 className={styles.h2}>For architects</h2>
        <p className={styles.h2sub}>Component responsibilities at a glance, where the code lives, and where this page's certainty ends. Documentation source: <a href="https://github.com/KB-iGOT/igot-docs">github.com/KB-iGOT/igot-docs</a>.</p>
        <details className={styles.arch} open>
          <summary>Component responsibilities by layer</summary>
          <div className={styles.archBody}>
            <table className={styles.table}>
              <thead><tr><th>Component</th><th>Layer</th><th>Owns</th><th>Primary stores</th><th>Repo</th></tr></thead>
              <tbody>
                {COMPONENTS.map(([name, layer, owns, stores, repo], i) => (
                  <tr key={i}><td>{name}</td><td>{layer}</td><td>{owns}</td><td>{stores}</td><td className={styles.repoCell}>{repo}</td></tr>
                ))}
              </tbody>
            </table>
            <div className={styles.note}><b>Verification boundary.</b> Components marked <b>◌</b> — <code>assessment-service</code>, certificate / registry services, Druid, MongoDB's owner, Jenkins, CDN / static delivery, email / SMS providers — appear because the feature docs reach them through client contracts, Kong route entries or deployment configuration, not because their source has been traced in this doc set. Attach the missing repo and re-verify before relying on their internals; do not remove the marker when editing.</div>
          </div>
        </details>
      </section>
    </div>
  );
}
