import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import {
  COMPUTED_TABLES, DEPLOY_STEPS, GROUP_LABEL, JOBS, RAW_TABLES, SRC_COLORS, STAGE_VAR, TAG_LABEL, WAREHOUSE_TABLES,
  type Job, type JobWrites,
} from '../data/etlAnalytics';
import styles from './EtlAnalyticsPage.module.css';

/* Data Pipeline › ETL Analytics, ported from the former standalone page (Data-pipeline-overview.html):
   the same seven views, its own job search and filters, with its rail turned into an in-page toolbar.
   Views are sub-routes: /etl-analytics/<view>[/<job id>][?q=<search>]. */

const BASE = '/etl-analytics';
const VALID_PAGES = ['overview', 'schematic', 'jobs', 'job', 'dictionary', 'deploy', 'analytics'];
const PAGE_TITLE: Record<string, string> = { overview: 'Overview', schematic: 'Pipeline map', jobs: 'Job index', dictionary: 'Data dictionary', deploy: 'Deployment flow', analytics: 'Analytics' };
const NAV = ['overview', 'schematic', 'jobs', 'dictionary', 'deploy', 'analytics'];

/** strings from the data carry inline HTML (<code>, entities), rendered as the original page did */
const html = (s: string) => ({ dangerouslySetInnerHTML: { __html: s } });

const pathFor = (page: string, id?: string | null, q?: string) =>
  `${BASE}/${page}${id ? `/${id}` : ''}${q ? `?q=${encodeURIComponent(q)}` : ''}`;

/* the last search typed anywhere on the page, kept for the session as before */
let lastQuery = (() => { try { return sessionStorage.getItem('cb_search_q') || ''; } catch { return ''; } })();
function persistQuery(q: string) { lastQuery = q; try { sessionStorage.setItem('cb_search_q', q); } catch { /* storage unavailable */ } }

const jobStageColor = (job: Job) => (job.group === 'foundation' && job.tags.includes('lib') ? 'var(--shared)' : STAGE_VAR[job.stage]);
const jobById = (id: string | null) => JOBS.find((j) => j.id === id);
const matchJob = (job: Job, ql: string) =>
  `${job.name} ${job.file} ${job.purpose} ${GROUP_LABEL[job.group] || ''}`.toLowerCase().includes(ql);
const isActiveJob = (j: Job) => !j.tags.some((t) => ['lib', 'dep', 'dead'].includes(t));
const isEmptyJob = (job: Job) => job.tags.includes('dead') && !job.reads.length && !job.proc.length;
const ACTIVE = JOBS.filter(isActiveJob);
const activeIn = (group: string) => ACTIVE.filter((j) => j.group === group).length;

/* ---------------------------------------------------------------- search bar (toolbar / job index / job detail) */
function SearchBar({ size, placeholder, value, onInput, onPick, onEnter }:
  { size: 'sm' | 'md' | 'lg'; placeholder: string; value: string; onInput?: (v: string) => void;
    onPick: (job: Job, q: string) => void; onEnter: (q: string) => void }) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  useEffect(() => { setText(value); }, [value]);

  const q = text.trim();
  const items = q ? JOBS.filter((j) => matchJob(j, q.toLowerCase())).slice(0, 8) : [];
  const pick = (i: number) => { const job = items[i]; if (!job) return; persistQuery(q); setOpen(false); onPick(job, q); };

  return (
    <div className={`${styles.searchbar} ${styles[size]}`}>
      <svg className={styles.sicon} viewBox="0 0 24 24" fill="none" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
      <input
        type="text" placeholder={placeholder} autoComplete="off" value={text}
        onChange={(e) => { const v = e.target.value; setText(v); persistQuery(v.trim()); setActiveIdx(-1); setOpen(!!v.trim()); onInput?.(v.trim()); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); if (items.length) setActiveIdx((activeIdx + 1) % items.length); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); if (items.length) setActiveIdx((activeIdx - 1 + items.length) % items.length); }
          else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIdx >= 0 && items[activeIdx]) pick(activeIdx);
            else { persistQuery(q); setOpen(false); onEnter(q); }
          } else if (e.key === 'Escape') setOpen(false);
        }}
        onFocus={() => { if (q) setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 140)}
      />
      {open && q && (
        <div className={styles.suggestions}>
          {items.length ? items.map((j, i) => (
            <div key={j.id} className={`${styles.suggestion} ${i === activeIdx ? styles.active : ''}`}
                 onMouseEnter={() => setActiveIdx(i)} onMouseDown={(e) => { e.preventDefault(); pick(i); }}>
              <span className={styles.sname} {...html(j.name)} />
              <span className={styles.sfile}>{j.file}</span>
            </div>
          )) : <div className={styles.suggestionEmpty}>No jobs match &ldquo;{q}&rdquo; — press Enter to search the full index</div>}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- small pieces */
function TagPills({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return <div className={styles.tagset}>{tags.map((t) => <span key={t} className={`${styles.tagpill} ${styles[t] ?? ''}`}>{TAG_LABEL[t] || t}</span>)}</div>;
}

function SrcItem({ str }: { str: string }) {
  const m = str.match(/^([A-Za-z]+):\s*(.*)$/);
  if (!m) return <li><span className={styles.srcBadge} style={{ background: 'var(--sunken)', color: 'var(--text-faint)' }}>·</span><span {...html(str)} /></li>;
  const col = SRC_COLORS[m[1]] || 'var(--text-faint)';
  return <li><span className={styles.srcBadge} style={{ background: `color-mix(in srgb, ${col} 20%, transparent)`, color: col }}>{m[1]}</span><span {...html(m[2])} /></li>;
}

function ListOrNone({ items, src, job }: { items: string[]; src?: boolean; job: Job }) {
  if (!items.length) return <li className={styles.none}>{job.external ? 'Not yet documented' : 'None'}</li>;
  return <>{items.map((i, n) => (src ? <SrcItem key={n} str={i} /> : <li key={n}><span {...html(i)} /></li>))}</>;
}

function WritesBlock({ w }: { w?: JobWrites }) {
  if (!w) return null;
  const rows: [string, string[] | undefined][] = [
    ['Parquet', w.parquet], ['Report / CSV', w.report], ['Warehouse (Postgres/BigQuery)', w.warehouse],
    ['Redis', w.redis], ['Kafka', w.kafka], ['Other', w.other],
  ];
  const out = rows.filter(([, v]) => v && v.length);
  if (!out.length) return <div className={styles.writeBlock}><div className={`${styles.v} ${styles.none}`}>No writes — read-only against upstream data.</div></div>;
  return <>{out.map(([k, v]) => <div key={k} className={styles.writeBlock}><div className={styles.k}>{k}</div><div className={styles.v} {...html(v!.join('<br>'))} /></div>)}</>;
}

const Dot = ({ on }: { on: boolean }) => <span className={styles.statusDot} style={{ background: on ? 'var(--good)' : 'var(--text-faint)' }} />;

function Head({ title, children }: { title: string; children: ReactNode }) {
  return <div className={styles.head}><h2>{title}</h2><p className={styles.desc}>{children}</p></div>;
}

/* ---------------------------------------------------------------- the page */
export function EtlAnalyticsPage() {
  const params = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const page = VALID_PAGES.includes(params.view ?? 'overview') ? (params.view ?? 'overview') : 'overview';
  const id = params.id ?? null;
  const q = search.get('q') || '';

  const [activeFilter, setActiveFilter] = useState('all');
  const [jobsQuery, setJobsQuery] = useState(q);

  /* where a job's page leads back to, and how far down each page was scrolled when left */
  const here = location.pathname + location.search;
  const prev = useRef<{ here: string; page: string } | null>(null);
  const [returnTo, setReturnTo] = useState({ here: pathFor('jobs'), page: 'jobs' });
  const savedScroll = useRef<Record<string, number>>({});
  useLayoutEffect(() => {
    const before = prev.current;
    if (before) savedScroll.current[before.here] = window.scrollY;
    if (page === 'job' && before && before.page !== 'job') setReturnTo({ here: before.here, page: before.page });
    prev.current = { here, page };
    /* coming back from a job's details restores the earlier scroll position; the layout scrolls to the top first */
    const y = before?.page === 'job' ? savedScroll.current[here] : 0;
    if (y) requestAnimationFrame(() => window.scrollTo(0, y));
    if (page === 'jobs') setJobsQuery(q);
  }, [here]); // runs once per navigation

  const goTo = (p: string, jobId?: string | null, query?: string) => {
    if (query !== undefined) persistQuery(query);
    navigate(pathFor(p, jobId, query));
  };
  const gotoFilter = (f: string) => { setActiveFilter(f); goTo('jobs'); };
  const pickJob = (job: Job, query: string) => goTo('job', job.id, query);
  const enterSearch = (query: string) => goTo('jobs', null, query);
  const scrollTo = (sectionId: string) => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const navKey = page === 'job' ? returnTo.page : page;

  return (
    <div className={styles.page}>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Data Pipeline' }, { label: 'ETL Analytics' }]} />

      {/* the former left rail: name, job search, page navigation and stage legend */}
      <div className={styles.toolbar}>
        <div className={styles.tbTop}>
          <div>
            <div className={styles.brand}><span className={styles.mark}>cb-core-data</span><span className={styles.tag}>v4.8.41</span></div>
            <div className={styles.brandSub}>Karmayogi Bharat analytics pipeline</div>
          </div>
          <div className={styles.tbSearch}>
            <SearchBar size="sm" placeholder="Search jobs…" value="" onPick={pickJob} onEnter={enterSearch} />
          </div>
        </div>
        <nav className={styles.tabs} aria-label="ETL Analytics pages">
          {NAV.map((p) => (
            <Link key={p} to={pathFor(p)} className={`${styles.tab} ${navKey === p ? styles.tabActive : ''}`}>{PAGE_TITLE[p]}</Link>
          ))}
        </nav>
        <div className={styles.legend}>
          <span className={styles.eyebrow}>Stage legend</span>
          <span className={styles.legendRow}><span className={styles.legendDot} style={{ background: 'var(--stage0)' }} />Stage 0 — Extract</span>
          <span className={styles.legendRow}><span className={styles.legendDot} style={{ background: 'var(--stage1)' }} />Stage 1 — Prejoin</span>
          <span className={styles.legendRow}><span className={styles.legendDot} style={{ background: 'var(--stage2)' }} />Stage 2 — Reports &amp; sync</span>
          <span className={styles.legendRow}><span className={styles.legendDot} style={{ background: 'var(--shared)' }} />Shared library</span>
        </div>
      </div>

      {page === 'overview' && <OverviewView goTo={goTo} gotoFilter={gotoFilter} />}
      {page === 'schematic' && <SchematicView goTo={goTo} gotoFilter={gotoFilter} />}
      {page === 'jobs' && (
        <JobsView query={jobsQuery} setQuery={setJobsQuery} filter={activeFilter} setFilter={setActiveFilter}
                  onOpen={(jobId) => {
                    /* put the current search into the index URL so the back link returns to the same filtered list */
                    const indexPath = pathFor('jobs', null, jobsQuery.trim());
                    navigate(indexPath, { replace: true });
                    if (prev.current) prev.current.here = indexPath;
                    goTo('job', jobId, jobsQuery.trim());
                  }}
                  pickJob={pickJob} enterSearch={enterSearch} />
      )}
      {page === 'job' && (
        <JobDetailView id={id} q={q} back={returnTo} pickJob={pickJob} enterSearch={enterSearch} />
      )}
      {page === 'dictionary' && <DictionaryView />}
      {page === 'deploy' && <DeployView />}
      {page === 'analytics' && <AnalyticsView scrollTo={scrollTo} gotoFilter={gotoFilter} />}

      <footer className={styles.pageFooter}>
        Generated from a direct read of <code>cbrelease-4.8.41</code> (every in-repo job, every <code>dfutil</code> helper,
        every deployment script). The Looker dashboard jobs and ClickHouse load are documented from team notes. The performance-profiling/phase-clock instrumentation seen elsewhere lives only on
        the separate, never-merged <code>cbrelease-4.8.39.1-profiling</code> branch — it isn't part of this branch, so
        there was nothing to exclude here. See <code>docs/ARCHITECTURE.md</code>, <code>docs/JOB_DETAILS.md</code> and{' '}
        <code>docs/DATA_DICTIONARY.md</code> for the full written reference.
      </footer>
    </div>
  );
}

type GoTo = (p: string, jobId?: string | null, query?: string) => void;

/* ---------------------------------------------------------------- overview */
function OverviewView({ goTo, gotoFilter }: { goTo: GoTo; gotoFilter: (f: string) => void }) {
  const tile = (onClick?: () => void) => ({
    className: `${styles.statTile} ${onClick ? styles.linkable : ''}`,
    ...(onClick ? { onClick, role: 'link', tabIndex: 0, onKeyDown: (e: { key: string }) => { if (e.key === 'Enter') onClick(); } } : {}),
  });
  return (
    <header className={styles.hero}>
      <span className={styles.eyebrow}>Engineering reference · branch cbrelease-4.8.41</span>
      <h1>Every job in the Karmayogi Bharat data pipeline, mapped end to end.</h1>
      <p className={styles.lede}>
        A three-stage PySpark + DuckDB batch pipeline that turns raw platform activity
        (Cassandra, Elasticsearch, Redis, MongoDB, Druid, Postgres) into 43 requirement-specific
        reports, a Postgres/BigQuery data warehouse, the ClickHouse tables behind the Looker
        dashboards, and the live Redis cache behind the admin dashboard. This page inventories what every job reads, joins, computes and writes —
        built for someone opening this repository for the first time.
      </p>
      <div className={styles.branchNote}>
        Reflects the current <b>cbrelease-4.8.41</b> branch (as of 2026-10-30),
        built on top of the earlier <code>cbrelease-4.8.39.1-hotfix</code> analysis with 3 new org-hierarchy/warehouse
        utility jobs and 9 files updated in between. One clarification worth having: a performance-profiling /
        phase-clocking instrumentation layer exists, but only on a separate <code>cbrelease-4.8.39.1-profiling</code> branch
        that was <b>never merged</b> into this lineage — it is not present
        anywhere in this branch, so nothing was excluded here.
      </div>
      <div className={styles.statGrid}>
        <div {...tile(() => goTo('jobs'))}><div className={styles.num}>{ACTIVE.length}</div><div className={styles.lbl}>active pipeline jobs across 3 stages (excludes shared libraries, deprecated and unused)</div></div>
        <div {...tile()}><div className={styles.num}>9</div><div className={styles.lbl}>external systems read (Cassandra, ES, Redis, Mongo, Druid, 2×Postgres, Kafka, REST)</div></div>
        <div {...tile(() => goTo('dictionary'))}><div className={styles.num}>59</div><div className={styles.lbl}>named Parquet datasets (31 raw + 28 computed)</div></div>
        <div {...tile(() => goTo('dictionary'))}><div className={styles.num}>12</div><div className={styles.lbl}>warehouse tables synced to Postgres + BigQuery</div></div>
        <div {...tile(() => gotoFilter('looker'))}><div className={styles.num}>4</div><div className={styles.lbl}>Looker dashboards fed by 8 ClickHouse-bound jobs</div></div>
        <div {...tile(() => goTo('analytics'))}><div className={styles.num}>10</div><div className={styles.lbl}>analytics outputs — reports, Redis, email, BigQuery and more</div></div>
      </div>
    </header>
  );
}

/* ---------------------------------------------------------------- pipeline map */
const STAGE2_CATS: [string, string][] = [
  ['warehouse-sync', 'Warehouse & dashboard sync'], ['compliance', 'Compliance & enrolment reports'], ['gamification', 'Gamification & scoring'],
  ['engagement', 'Leaderboards, metrics & campaigns'], ['export', 'Surveys, user reports & export'], ['looker', 'Looker dashboards (ClickHouse)'],
];

function SchematicView({ goTo, gotoFilter }: { goTo: GoTo; gotoFilter: (f: string) => void }) {
  const flow = (col?: string) => <div className={`${styles.flowConnector} ${styles.animated}`} style={col ? ({ '--flow-col': col } as CSSProperties) : undefined} />;
  const chips = (names: string[]) => <div className={styles.flowRow}>{names.map((n) => <span key={n} className={styles.flowChip}>{n}</span>)}</div>;
  return (
    <div className={styles.pageInner}>
      <Head title="How data moves through the system">
        Stage 0 pulls everything raw into Parquet caches. Stage 1 joins those caches into a handful of reusable "computed" tables. Stage 2 is {ACTIVE.filter((j) => j.stage === 2).length} independent active jobs, each reading the computed tables to build one report, warehouse table, or cache entry. Click any box to jump to its detail.
      </Head>
      <div className={styles.flow}>
        {chips(['Cassandra', 'Elasticsearch', 'Postgres (app)', 'MongoDB', 'Druid', 'External REST APIs'])}
        {flow('var(--stage0)')}
        <button type="button" className={`${styles.stageBox} ${styles.stage0Box}`} onClick={() => goTo('job', 'dataExhaust')}>
          <div className={styles.stageTag} style={{ color: 'var(--stage0)' }}>Stage 0 · Extract</div>
          <h3>dataExhaust.py</h3>
          <div className={styles.file}>jobs/stage-0/dataExhaust.py</div>
          <div className={styles.meta}>~29 reads → 27 raw Parquet caches · 4 joins</div>
        </button>
        {flow('var(--stage1)')}
        <button type="button" className={`${styles.stageBox} ${styles.stage1Box}`} onClick={() => goTo('job', 'prejoinData')}>
          <div className={styles.stageTag} style={{ color: 'var(--stage1)' }}>Stage 1 · Prejoin</div>
          <h3>prejoinData.py</h3>
          <div className={styles.file}>jobs/stage-1/prejoinData.py + 7 dfutil modules</div>
          <div className={styles.meta}>18 orchestrated steps → ~27 computed Parquet tables · 45+ joins</div>
        </button>
        {flow('var(--stage2)')}
        <div className={styles.stage2Fan}>
          {STAGE2_CATS.map(([g, l]) => (
            <button type="button" key={g} className={styles.stage2Cat} onClick={() => gotoFilter(g)}>
              <div className={styles.n}>{activeIn(g)}</div><div className={styles.l}>{l}</div>
            </button>
          ))}
        </div>
        {flow()}
        {chips(['Postgres warehouse', 'BigQuery', 'ClickHouse (Looker)', 'Redis (dashboard)', 'Cassandra', 'Kafka', 'GCS (zipped reports)'])}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- job index */
const FILTERS: [string, string, string | null][] = [
  ['all', 'All', null], ['0', 'Stage 0', 'var(--stage0)'], ['1', 'Stage 1', 'var(--stage1)'],
  ['warehouse-sync', 'Warehouse sync', 'var(--stage2)'], ['compliance', 'Compliance', 'var(--stage2)'], ['gamification', 'Gamification', 'var(--stage2)'],
  ['engagement', 'Leaderboards & campaigns', 'var(--stage2)'], ['export', 'Surveys & export', 'var(--stage2)'], ['looker', 'Looker dashboards', 'var(--stage2)'],
];

function JobsView({ query, setQuery, filter, setFilter, onOpen, pickJob, enterSearch }:
  { query: string; setQuery: (q: string) => void; filter: string; setFilter: (f: string) => void; onOpen: (id: string) => void;
    pickJob: (job: Job, q: string) => void; enterSearch: (q: string) => void }) {
  const ql = query.trim().toLowerCase();
  const filtered = JOBS.filter((j) => (filter === 'all' || String(j.stage) === filter || j.group === filter) && (!ql || matchJob(j, ql)));
  return (
    <div className={styles.pageInner}>
      <Head title="Job index">Every job, searchable with autocomplete and filterable by category. Select a suggestion or a card to open its dedicated detail page.</Head>
      <div className={styles.jobsSearchBlock}>
        <SearchBar size="lg" placeholder="Search by job name, file path, table, or keyword…" value={query} onInput={setQuery} onPick={pickJob} onEnter={enterSearch} />
      </div>
      <div className={styles.filterBar}>
        {FILTERS.map(([f, label, dot]) => (
          <button type="button" key={f} className={`${styles.chip} ${filter === f ? styles.chipActive : ''}`} onClick={() => setFilter(f)}>
            {dot && <span className={styles.dot} style={{ background: dot }} />}{label}
          </button>
        ))}
        <span className={styles.resultCount}>{filtered.length} of {JOBS.length} jobs</span>
      </div>
      <div className={styles.jobGrid}>
        {filtered.length ? filtered.map((job) => (
          <div key={job.id} className={styles.jobRow} role="link" tabIndex={0} onClick={() => onOpen(job.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(job.id); }}>
            <div className={styles.stagebar} style={{ background: jobStageColor(job) }} />
            <div className={styles.jobMain}>
              <div className={styles.jobTitleRow}><h4 {...html(job.name)} /></div>
              <div className={styles.jobFile}>{job.file}</div>
              <div className={styles.jobPurpose} {...html(job.purpose)} />
              {!isEmptyJob(job) && <div className={styles.quickstats}><span className={styles.qs}>Reads <b>{job.reads.length}</b></span><span className={styles.qs}>Joins <b>{job.joins.length}</b></span></div>}
              <TagPills tags={job.tags} />
            </div>
            <svg className={styles.rowArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6l6 6-6 6" /></svg>
          </div>
        )) : <p className={styles.none} style={{ fontSize: 13.5 }}>No jobs match this search/filter combination.</p>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- job detail */
function JobDetailView({ id, q, back, pickJob, enterSearch }:
  { id: string | null; q: string; back: { here: string; page: string }; pickJob: (job: Job, q: string) => void; enterSearch: (q: string) => void }) {
  const job = jobById(id);
  const backLink = <div className={styles.breadcrumb}><Link to={back.here}>← {PAGE_TITLE[back.page] || 'Job index'}</Link></div>;
  const searchBox = (
    <div style={{ maxWidth: 520, marginBottom: 20 }}>
      <SearchBar size="md" placeholder="Search another job…" value={q || lastQuery || ''} onPick={pickJob} onEnter={enterSearch} />
    </div>
  );
  if (!job) return <div className={styles.pageInner}>{searchBox}{backLink}<p>Job not found.</p></div>;

  const idx = JOBS.findIndex((j) => j.id === id);
  const prev = JOBS[(idx - 1 + JOBS.length) % JOBS.length];
  const next = JOBS[(idx + 1) % JOBS.length];
  const qs = q ? `?q=${encodeURIComponent(q)}` : '';
  return (
    <div className={styles.pageInner}>
      {searchBox}
      {backLink}
      <div className={styles.jobDetailHeader}>
        <div className={styles.stagebarLg} style={{ background: jobStageColor(job) }} />
        <div>
          <div className={styles.jobTitleRow}><h2 {...html(job.name)} /></div>
          <div className={styles.jobFile}>{job.file}</div>
          <TagPills tags={job.tags} />
        </div>
      </div>
      <p className={styles.jobPurposeLg} {...html(job.purpose)} />
      {!isEmptyJob(job) && (
        <>
          <div className={styles.quickstats} style={{ marginBottom: 18 }}>
            <span className={styles.qs}>Reads <b>{job.reads.length}</b></span>
            <span className={styles.qs}>Joins <b>{job.joins.length}</b></span>
          </div>
          <div className={styles.jobBodyGrid}>
            <div>
              <div className={styles.jbH}>Reads ({job.reads.length})</div>
              <ul className={styles.jbList}><ListOrNone items={job.reads} src job={job} /></ul>
              <div className={styles.jbH}>Joins ({job.joins.length})</div>
              <ul className={styles.jbList}><ListOrNone items={job.joins} job={job} /></ul>
            </div>
            <div>
              <div className={styles.jbH}>Processing</div>
              <ul className={`${styles.jbList} ${styles.procList}`}><ListOrNone items={job.proc} job={job} /></ul>
              <div className={styles.jbH}>Writes</div>
              <WritesBlock w={job.writes} />
            </div>
          </div>
          {job.downstream && <div className={styles.downstreamNote}><b>Downstream:</b> <span {...html(job.downstream)} /></div>}
        </>
      )}
      <div className={styles.jobNavButtons}>
        <Link className={styles.navBtn} to={`${BASE}/job/${prev.id}${qs}`}>← <span {...html(prev.name)} /></Link>
        <Link className={styles.navBtn} to={`${BASE}/job/${next.id}${qs}`} style={{ textAlign: 'right' }}><span {...html(next.name)} /> →</Link>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- data dictionary */
function DictionaryView() {
  const sub = (title: string, desc: ReactNode) => <div className={styles.dictSub}><h3>{title}</h3><p className={styles.desc}>{desc}</p></div>;
  const twoCol = (rows: string[][], third: string) => (
    <div className={styles.tableWrap}><table className={styles.dataTable}>
      <thead><tr><th>Constant</th><th>Folder</th><th>{third}</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r[0]}><td className={styles.mono}>{r[0]}</td><td className={styles.mono}>{r[1]}</td><td {...html(r[2])} /></tr>)}</tbody>
    </table></div>
  );
  const jobLink = (jobId: string, text: string) => <Link to={`${BASE}/job/${jobId}`}>{text}</Link>;
  return (
    <div className={styles.pageInner}>
      <Head title="Data dictionary">The authoritative name for every dataset in the pipeline, sourced from <code>constants/ParquetFileConstants.py</code> and the warehouse-sync jobs.</Head>

      {sub('Warehouse tables — Postgres & BigQuery', <>Written locally as Parquet under <code>warehouseReportDir</code>, then pushed by <code>dataWarehouse.py</code> / <code>dataWarehouseBash.sh</code> (Postgres, full truncate + reload every run) and <code>bq-scripts.sh</code> (BigQuery, full drop + recreate + load every run).</>)}
      <div className={styles.tableWrap}><table className={styles.dataTable}>
        <thead><tr><th>Table</th><th>Populated by</th><th>Postgres</th><th>BigQuery</th><th>Content</th></tr></thead>
        <tbody>{WAREHOUSE_TABLES.map((r) => (
          <tr key={r[0]}><td className={styles.mono}>{r[0]}</td><td {...html(r[1])} />
            <td><Dot on={r[2].startsWith('Yes')} />{r[2]}</td>
            <td><Dot on={r[3] === 'Yes'} />{r[3] === 'Yes' ? 'Yes' : 'No'}</td>
            <td {...html(r[4])} /></tr>
        ))}</tbody>
      </table></div>

      {sub('Raw Parquet caches — written by Stage 0', <>Live under <code>data-res/pq_files/cache_pq/&lt;name&gt;/</code>. One folder per Cassandra table, Elasticsearch query, or Postgres table pulled straight from source.</>)}
      {twoCol(RAW_TABLES, 'Source')}

      {sub('Computed Parquet tables — written by Stage 1', <>Live under <code>output/computed/&lt;name&gt;/</code>. These are the tables almost every Stage 2 job reads from.</>)}
      {twoCol(COMPUTED_TABLES, 'Built by')}

      {sub('Dashboard Parquet outputs — loaded into ClickHouse', 'Written by the Looker dashboard scripts and loaded into the ClickHouse warehouse database by the ClickHouse bash script, which runs last.')}
      <div className={styles.tableWrap}><table className={styles.dataTable}>
        <thead><tr><th>Output</th><th>Produced by</th><th>Dashboard</th></tr></thead>
        <tbody>
          <tr><td className={styles.mono}>user_enrolments_custom</td><td>{jobLink('dashUserEnrolmentsCustom', 'dashboard_user_enrolments_custom_updated.py')}</td><td>MDO</td></tr>
          <tr><td className={styles.mono}>content_custom</td><td>{jobLink('dashContentCustom', 'dashboard_content_custom.py')}</td><td>Content</td></tr>
          <tr><td className={styles.mono}>myigot</td><td>{jobLink('dashMyIgot', 'dashboard_myigot.py')}</td><td>IGOT</td></tr>
          <tr><td>7 folders: plan facts, funnel stage counts, recommended-course competency map, saved-course map, learner coverage map, org and department user summary, competency master list</td><td>{jobLink('dashAiCbp', 'AICBPDashboardFactModel')}</td><td>AI CBP</td></tr>
        </tbody>
      </table></div>
    </div>
  );
}

/* ---------------------------------------------------------------- deployment flow */
function DeployView() {
  return (
    <div className={styles.pageInner}>
      <Head title="From commit to running pipeline">The deployment path is fully visible in this repo; the run-time <em>schedule</em> is not — no cron or Airflow DAG file lives here. <code>gamification/prerequisites.md</code> and an <code>airflowData/</code> path constant both point to an external Airflow instance as the real scheduler.</Head>
      <div className={styles.timeline}>
        {DEPLOY_STEPS.map((s, i) => (
          <div key={i} className={styles.tlStep} data-n={i + 1}>
            <h4 {...html(s[0])} /><p {...html(s[1])} />{s[2] && <div className={styles.note} {...html(s[2])} />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- analytics */
function AnalyticsView({ scrollTo, gotoFilter }: { scrollTo: (id: string) => void; gotoFilter: (f: string) => void }) {
  const jl = (jobId: string, text: string) => <Link to={`${BASE}/job/${jobId}`}><code>{text}</code></Link>;
  const sl = (sectionId: string, text: string) => <a href={`#${BASE}/analytics`} onClick={(e) => { e.preventDefault(); scrollTo(sectionId); }}>{text}</a>;
  return (
    <div className={styles.pageInner}>
      <Head title="What the pipeline produces">Every output of the data pipeline: what it is, which job makes it, where it is stored and who uses it. Most data refreshes once every 24 hours; the public landing page analytics refresh every 4 hours and the Content Health Score once a month. Outputs land in zipped CSVs on GCS, the Postgres warehouse, BigQuery, Redis, or email.</Head>

      <div className={styles.dictSub}><h3>At a glance</h3></div>
      <div className={styles.tableWrap}><table className={styles.dataTable}>
        <thead><tr><th>#</th><th>Output</th><th>Job(s)</th><th>Refresh</th><th>Stored in</th><th>Used by</th></tr></thead>
        <tbody>
          <tr><td className={styles.mono}>1</td><td>{sl('an-reports', 'Operational reports (CSV)')}</td><td>One Spark job per report</td><td>Daily</td><td>GCS (zipped, per MDO) + Postgres warehouse</td><td>MDO and SPV admins (download)</td></tr>
          <tr><td className={styles.mono}>2</td><td>{sl('an-platform', 'Platform analytics')}</td><td>{jl('dashboardSync', 'dashboardSync')}</td><td>Daily</td><td>Redis</td><td>Platform APIs → portal UI</td></tr>
          <tr><td className={styles.mono}>3a</td><td>{sl('an-email', 'DSR')}</td><td>{jl('dsrComputation', 'dsrComputation')}</td><td>Daily</td><td>Email</td><td>Stakeholders</td></tr>
          <tr><td className={styles.mono}>3b</td><td>{sl('an-email', 'Peer Validation weekly report')}</td><td><code>peerValidationWeeklyReq</code></td><td>Weekly, Monday</td><td>Email (+ zipped CSVs)</td><td>Stakeholders</td></tr>
          <tr><td className={styles.mono}>3c</td><td>{sl('an-email', 'Monthly report data')}</td><td><code>monthlyRequests</code></td><td>Monthly, last day</td><td>Email / shared files</td><td>Stakeholders</td></tr>
          <tr><td className={styles.mono}>4</td><td>{sl('an-bq', 'Warehouse in BigQuery')}</td><td>Warehouse push to BQ</td><td>Daily</td><td>BigQuery</td><td>Looker dashboards, ad hoc BQ queries</td></tr>
          <tr><td className={styles.mono}>5</td><td>{sl('an-sparrow', 'Sparrow feed')}</td><td>Sparrow transform job + shell script</td><td>Daily</td><td>GCS parquet → BigQuery</td><td>Sparrow APIs</td></tr>
          <tr><td className={styles.mono}>6</td><td>{sl('an-claps', 'Weekly claps')}</td><td>{jl('weeklyClaps', 'weeklyClaps')}</td><td>Daily (cumulative for the week)</td><td>Postgres</td><td>Claps API → portal UI</td></tr>
          <tr><td className={styles.mono}>7</td><td>{sl('an-landing', 'Landing page analytics')}</td><td>Ansible script (reads ES)</td><td>Every 4 hours</td><td>Landing page data</td><td>Public landing page (not logged in)</td></tr>
          <tr><td className={styles.mono}>8</td><td>{sl('an-chs', 'Content Health Score (CHS)')}</td><td>Content Health Score job</td><td>Monthly</td><td>Redis (current month) + Postgres (monthly history)</td><td>Content API → portal UI (per content)</td></tr>
        </tbody>
      </table></div>
      <p className={styles.anNote}>Marketplace courses are part of the operational reports (row 1); there is no separate marketplace report.</p>

      <div className={styles.anSection} id="an-reports">
        <h3><span className={styles.anNum}>1</span>Operational reports</h3>
        <p>CSV files that MDO and SPV admins download for their own organisation and its child organisations. Each report has its own Spark job.</p>
        <div className={styles.tableWrap}><table className={styles.dataTable}>
          <thead><tr><th>Report</th><th>Spark job</th></tr></thead>
          <tbody>
            <tr><td>User report</td><td>{jl('userReport', 'userReport.py')}</td></tr>
            <tr><td>Content report</td><td>{jl('courseReport', 'courseReport.py')}</td></tr>
            <tr><td>Consumption report</td><td>{jl('userEnrolment', 'userEnrolment.py')}</td></tr>
            <tr><td>ACBP report</td><td>{jl('acbpReport', 'acbpReport.py')}</td></tr>
            <tr><td>Blended program report</td><td>{jl('blendedReport', 'blendedReport.py')}</td></tr>
            <tr><td>Assessment report</td><td>{jl('assessmentReport', 'assessmentReport.py')}</td></tr>
            <tr><td>Course Based Assessment report</td><td>{jl('courseBasedAssessmentReport', 'courseBasedAssessmentReport.py')}</td></tr>
            <tr><td>Gamification report</td><td>{jl('gamificationJob', 'gamificationJob.py')}</td></tr>
          </tbody>
        </table></div>
        <p style={{ marginTop: 14 }}><b>How they are stored</b></p>
        <ol>
          <li>Each job writes its report partitioned by <code>mdo_id</code>, so every MDO gets its own folder.</li>
          <li>The per-MDO files are zipped (password protected) and uploaded to GCS, where admins download and unzip them.</li>
          <li>The same data is loaded daily into the Postgres warehouse as a full dump, for easy querying.</li>
        </ol>
        <p className={styles.anNote}>Marketplace courses are included in these reports, so there is no separate marketplace reporting.</p>
      </div>

      <div className={styles.anSection} id="an-platform">
        <h3><span className={styles.anNum}>2</span>Platform analytics ({jl('dashboardSync', 'dashboardSync')})</h3>
        <p>Computes the numbers the portal shows and writes them to Redis, where platform APIs read them and pass them to the UI.</p>
        <ul>
          <li>Trending courses and programmes, ranked by consumption</li>
          <li>Content under 30 minutes, sorted by rating</li>
          <li>Per-MDO channel analytics: users onboarded, enrolments, completions, certifications</li>
          <li>Top CBPs (content providers) and top MDOs</li>
          <li>Other platform-level metrics in the same job</li>
        </ul>
        <p className={styles.anNote}><b>Storage:</b> Redis keys, read by APIs → portal UI.</p>
      </div>

      <div className={styles.anSection} id="an-email">
        <h3><span className={styles.anNum}>3</span>Stakeholder reports (email)</h3>
        <p>Three reports go out by email on a fixed schedule, each from its own job.</p>
        <div className={styles.tableWrap}><table className={styles.dataTable}>
          <thead><tr><th>Report</th><th>Job</th><th>When</th><th>Notes</th></tr></thead>
          <tbody>
            <tr><td>DSR (Daily Status Report)</td><td>{jl('dsrComputation', 'dsrComputation')}</td><td>Every day</td><td>Covers all requested KPIs</td></tr>
            <tr><td>Peer Validation weekly report</td><td><code>peerValidationWeeklyReq</code></td><td>Every Monday (covers previous Mon–Sun)</td><td>Cumulative and weekly submissions, peer reviews, course-wise adoption; zipped response files and Netcore files (Reviewers, Survey users) attached</td></tr>
            <tr><td>Monthly report</td><td><code>monthlyRequests</code></td><td>Last day of every month</td><td>All data needed for the monthly report</td></tr>
          </tbody>
        </table></div>
      </div>

      <div className={styles.anSection} id="an-bq">
        <h3><span className={styles.anNum}>4</span>BigQuery and Looker</h3>
        <p>The warehouse data is also pushed to BigQuery, which powers the Looker dashboards and lets anyone query the data directly with BQ SQL.</p>
        <ul>
          <li><b>Source:</b> the same warehouse tables as the Postgres daily dump</li>
          <li><b>Storage:</b> BigQuery datasets</li>
          <li><b>Used by:</b> Looker dashboards, ad hoc analysis in BigQuery</li>
        </ul>
        <p className={styles.anNote}>The MDO, Content, IGOT and AI CBP dashboards are fed separately through ClickHouse — see the <a href={`#${BASE}/jobs`} onClick={(e) => { e.preventDefault(); gotoFilter('looker'); }}>Looker dashboards</a> jobs.</p>
      </div>

      <div className={styles.anSection} id="an-sparrow">
        <h3><span className={styles.anNum}>5</span>Sparrow data feed</h3>
        <p>Sparrow APIs read only from BigQuery, and that BigQuery data is built from our reports.</p>
        <ol>
          <li>A job reads our generated reports and transforms them to the Sparrow team's requirements.</li>
          <li>The output is written as parquet files and pushed to GCS.</li>
          <li>A shell script reads the parquet from GCS and loads it into BigQuery.</li>
          <li>Sparrow APIs fetch the data from BigQuery.</li>
        </ol>
      </div>

      <div className={styles.anSection} id="an-claps">
        <h3><span className={styles.anNum}>6</span>Weekly claps</h3>
        <p>The {jl('weeklyClaps', 'weeklyClaps')} job runs every day and computes each user's cumulative activity for the current week. A clap is updated as soon as the user reaches the target in that week (for example 60 minutes by mid-week), without waiting for the week to end. Claps show how consistently the user has been active over the last 4 weeks.</p>
        <ul>
          <li><b>Storage:</b> Postgres</li>
          <li><b>Used by:</b> the claps API, which the portal UI calls to show the user's consistency</li>
        </ul>
      </div>

      <div className={styles.anSection} id="an-landing">
        <h3><span className={styles.anNum}>7</span>Landing page analytics</h3>
        <p>The public (non-logged-in) landing page shows a few platform analytics. An Ansible script reads them from Elasticsearch and updates the data every 4 hours.</p>
        <ul>
          <li><b>Source:</b> Elasticsearch</li>
          <li><b>Refresh:</b> every 4 hours</li>
          <li><b>Used by:</b> the public landing page</li>
        </ul>
      </div>

      <div className={styles.anSection} id="an-chs">
        <h3><span className={styles.anNum}>8</span>Content Health Score (CHS)</h3>
        <p>Calculated once a month for every piece of content, from 6 factors combined into one score.</p>
        <ul>
          <li><b>Refresh:</b> monthly</li>
          <li><b>Storage:</b> Redis holds the current month's scores only; Postgres holds every month's scores as history</li>
          <li><b>Used by:</b> an API that the portal UI calls to show the score on each content</li>
        </ul>
      </div>
    </div>
  );
}
