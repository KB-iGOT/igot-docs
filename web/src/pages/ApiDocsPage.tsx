import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { marked } from 'marked';
import { Breadcrumbs } from '../components/ui/Breadcrumbs';
import specJsonUrl from '../data/openapi/openapi.json?url';
import specYamlUrl from '../data/openapi/openapi.yaml?url';
import styles from './ApiDocsPage.module.css';

/* API Documentation: a Swagger-UI-style viewer for the platform OpenAPI spec (data/openapi/openapi.json,
   supplied as-is). Tags are sections, operations expand to their parameters, request body and responses,
   and "Try it out" sends the request from the browser. An operation can be linked as ?op=<operationId>. */

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type Method = (typeof METHODS)[number];

interface Server { url: string; description?: string }
interface Param { name: string; in: 'path' | 'query' | 'header' | 'cookie'; required?: boolean; description?: string; schema?: Record<string, unknown>; example?: unknown }
interface Operation {
  tags?: string[]; summary?: string; description?: string; operationId: string;
  parameters?: Param[]; servers?: Server[]; security?: Record<string, string[]>[];
  requestBody?: { required?: boolean; content: Record<string, { schema?: unknown; example?: unknown }> };
  responses: Record<string, { description?: string }>;
}
interface Spec {
  openapi: string; info: { title: string; version: string; description?: string };
  servers?: Server[]; tags?: { name: string; description?: string }[];
  paths: Record<string, Partial<Record<Method, Operation>>>;
  components?: { securitySchemes?: Record<string, { type: string; scheme?: string; bearerFormat?: string; description?: string }> };
  security?: Record<string, string[]>[];
}
interface Op { path: string; method: Method; op: Operation; tag: string }

const md = (s?: string) => ({ dangerouslySetInnerHTML: { __html: marked.parse(s ?? '') as string } });
const pretty = (v: unknown) => JSON.stringify(v, null, 2);
const CUSTOM = '__custom__';

/** the bearer token entered under Authorize, kept for the browser session */
const TOKEN_KEY = 'igot-api-token';
const loadToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; } };
const saveToken = (t: string) => { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } };

const isSecured = (spec: Spec, op: Operation) => (op.security ?? spec.security ?? []).length > 0;

export function ApiDocsPage() {
  const [spec, setSpec] = useState<Spec | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    import('../data/openapi/openapi.json').then((m) => setSpec(m.default as unknown as Spec)).catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <div className={styles.page}><p className={styles.muted}>{error}</p></div>;
  if (!spec) return <div className={styles.page}><p className={styles.muted}>Loading API specification…</p></div>;
  return <ApiDocs spec={spec} />;
}

function ApiDocs({ spec }: { spec: Spec }) {
  const [params, setParams] = useSearchParams();
  const linked = params.get('op');
  const servers = spec.servers ?? [];
  const [server, setServer] = useState(servers[0]?.url ?? CUSTOM);
  const [customServer, setCustomServer] = useState('');
  const [token, setToken] = useState(loadToken);
  const [authOpen, setAuthOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [closedTags, setClosedTags] = useState<Set<string>>(new Set());
  const [openOps, setOpenOps] = useState<Set<string>>(() => new Set(linked ? [linked] : []));

  const ops = useMemo<Op[]>(() => Object.entries(spec.paths).flatMap(([path, item]) =>
    METHODS.filter((m) => item[m]).map((m) => ({ path, method: m, op: item[m]!, tag: item[m]!.tags?.[0] ?? 'default' }))), [spec]);
  const tags = useMemo(() => {
    const declared = spec.tags ?? [];
    const extra = [...new Set(ops.map((o) => o.tag))].filter((t) => !declared.some((d) => d.name === t)).map((name) => ({ name, description: '' }));
    return [...declared, ...extra];
  }, [spec, ops]);

  const q = filter.trim().toLowerCase();
  const shown = (o: Op) => !q || `${o.method} ${o.path} ${o.op.summary ?? ''} ${o.op.operationId} ${o.tag}`.toLowerCase().includes(q);
  const baseUrl = server === CUSTOM ? customServer.trim().replace(/\/$/, '') : server;

  /* a linked operation opens and scrolls into view once rendered */
  useEffect(() => {
    if (!linked) return;
    const el = document.getElementById(`op-${linked}`);
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [linked]);

  const toggleOp = (id: string) => {
    setOpenOps((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    setParams((p) => { const n = new URLSearchParams(p); if (openOps.has(id)) n.delete('op'); else n.set('op', id); return n; }, { replace: true });
  };
  const toggleTag = (t: string) => setClosedTags((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; });
  const scheme = Object.entries(spec.components?.securitySchemes ?? {})[0];

  return (
    <div className={styles.page}>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'API Documentation' }]} />

      <header className={styles.info}>
        <div className={styles.titleRow}>
          <h1>{spec.info.title}</h1>
          <span className={styles.version}>{spec.info.version}</span>
          <span className={styles.oas}>OAS {spec.openapi}</span>
        </div>
        <div className={styles.downloads}>
          <a href={specJsonUrl} download="openapi.json">openapi.json</a>
          <a href={specYamlUrl} download="openapi.yaml">openapi.yaml</a>
        </div>
        <div className={styles.desc} {...md(spec.info.description)} />
      </header>

      <div className={styles.controls}>
        <label className={styles.serverPick}>
          <span>Servers</span>
          <select value={server} onChange={(e) => setServer(e.target.value)}>
            {servers.map((s) => <option key={s.url} value={s.url}>{s.url}{s.description ? ` - ${s.description}` : ''}</option>)}
            <option value={CUSTOM}>Custom server URL…</option>
          </select>
          {server === CUSTOM && (
            <input className={styles.customServer} placeholder="https://host" value={customServer} onChange={(e) => setCustomServer(e.target.value)} />
          )}
        </label>
        <input className={styles.filter} type="search" placeholder="Filter by path, summary or tag" value={filter} onChange={(e) => setFilter(e.target.value)} />
        {scheme && (
          <button type="button" className={`${styles.authorize} ${token ? styles.authorized : ''}`} onClick={() => setAuthOpen(true)}>
            <Lock locked={!!token} /> {token ? 'Authorized' : 'Authorize'}
          </button>
        )}
      </div>

      {tags.map((t) => {
        const list = ops.filter((o) => o.tag === t.name && shown(o));
        if (!list.length) return null;
        const open = !closedTags.has(t.name);
        return (
          <section key={t.name} className={styles.tag}>
            <button type="button" className={styles.tagHead} aria-expanded={open} onClick={() => toggleTag(t.name)}>
              <h2>{t.name}</h2>
              {t.description && <span className={styles.tagDesc} {...md(t.description)} />}
              <svg className={`${styles.chev} ${open ? '' : styles.closed}`} viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {open && list.map((o) => (
              <OperationBlock key={o.op.operationId} spec={spec} item={o} open={openOps.has(o.op.operationId)}
                              onToggle={() => toggleOp(o.op.operationId)} baseUrl={baseUrl} token={token} />
            ))}
          </section>
        );
      })}
      {!ops.some(shown) && <p className={styles.muted}>No operations match “{filter}”.</p>}

      {authOpen && scheme && (
        <AuthDialog name={scheme[0]} scheme={scheme[1]} token={token}
                    onSave={(t) => { setToken(t); saveToken(t); setAuthOpen(false); }}
                    onClose={() => setAuthOpen(false)} />
      )}
    </div>
  );
}

function Lock({ locked }: { locked: boolean }) {
  return (
    <svg className={styles.lock} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d={locked ? 'M8 11V7a4 4 0 0 1 8 0v4' : 'M8 11V7a4 4 0 0 1 7.5-2'} />
    </svg>
  );
}

/* ---------------------------------------------------------------- one operation */
function OperationBlock({ spec, item, open, onToggle, baseUrl, token }:
  { spec: Spec; item: Op; open: boolean; onToggle: () => void; baseUrl: string; token: string }) {
  const { path, method, op } = item;
  const secured = isSecured(spec, op);
  return (
    <div id={`op-${op.operationId}`} className={`${styles.op} ${styles[method]} ${open ? styles.opOpen : ''}`}>
      <button type="button" className={styles.opHead} aria-expanded={open} onClick={onToggle}>
        <span className={styles.method}>{method.toUpperCase()}</span>
        <span className={styles.path}>{path}</span>
        <span className={styles.summary}>{op.summary}</span>
        {secured && <span title="Requires a bearer token" className={styles.opLock}><Lock locked /></span>}
      </button>
      {open && <OperationBody item={item} baseUrl={baseUrl} token={token} secured={secured} />}
    </div>
  );
}

interface Result { url: string; curl: string; status?: number; statusText?: string; headers?: [string, string][]; body?: string; error?: string; ms?: number }

function OperationBody({ item, baseUrl, token, secured }:
  { item: Op; baseUrl: string; token: string; secured: boolean }) {
  const { path, method, op } = item;
  const params = op.parameters ?? [];
  const body = op.requestBody ? Object.entries(op.requestBody.content)[0] : undefined;
  const opServer = op.servers?.[0];
  const [trying, setTrying] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [bodyText, setBodyText] = useState(body ? pretty(body[1].example ?? {}) : '');
  const [bodyView, setBodyView] = useState<'example' | 'schema'>('example');
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const key = (p: Param) => `${p.in}:${p.name}`;
  const target = (opServer?.url ?? baseUrl).replace(/\/$/, '');

  const build = () => {
    let url = path.replace(/\{([^}]+)\}/g, (_, n: string) => encodeURIComponent(values[`path:${n}`] ?? `{${n}}`));
    const query = params.filter((p) => p.in === 'query' && values[key(p)]).map((p) => `${encodeURIComponent(p.name)}=${encodeURIComponent(values[key(p)])}`);
    url = `${target}${url}${query.length ? `?${query.join('&')}` : ''}`;
    const headers: Record<string, string> = {};
    for (const p of params) if (p.in === 'header' && values[key(p)]) headers[p.name] = values[key(p)];
    if (body) headers['Content-Type'] = body[0];
    if (secured && token) headers.Authorization = `Bearer ${token}`;
    const curl = [`curl -X '${method.toUpperCase()}' \\`, `  '${url}' \\`,
      ...Object.entries(headers).map(([k, v]) => `  -H '${k}: ${k === 'Authorization' ? 'Bearer <token>' : v}' \\`),
      ...(body ? [`  -d '${bodyText.replace(/'/g, "'\\''")}'`] : [])];
    curl[curl.length - 1] = curl[curl.length - 1].replace(/ \\$/, '');
    return { url, headers, curl: curl.join('\n') };
  };

  const execute = async () => {
    const { url, headers, curl } = build();
    const missing = params.filter((p) => p.required && !values[key(p)]).map((p) => p.name);
    if (missing.length) { setResult({ url, curl, error: `Required parameter${missing.length > 1 ? 's' : ''} missing: ${missing.join(', ')}` }); return; }
    if (!/^https?:\/\//.test(target) || /REPLACE-ME/i.test(target)) {
      setResult({ url, curl, error: 'This server is a placeholder. Choose "Custom server URL…" under Servers and enter the real host to send requests.' });
      return;
    }
    setBusy(true);
    const t0 = performance.now();
    try {
      const res = await fetch(url, { method: method.toUpperCase(), headers, body: body ? bodyText : undefined });
      const text = await res.text();
      let shownBody = text;
      try { shownBody = pretty(JSON.parse(text)); } catch { /* not JSON */ }
      setResult({ url, curl, status: res.status, statusText: res.statusText, headers: [...res.headers.entries()], body: shownBody, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      setResult({ url, curl, error: `Failed to fetch (${(e as Error).message}). Possible reasons: the host is unreachable from this browser, CORS, or a network/VPN restriction.` });
    } finally { setBusy(false); }
  };

  return (
    <div className={styles.opBody}>
      {op.description && <div className={styles.opDesc} {...md(op.description)} />}
      {op.servers && (
        <p className={styles.note}>Server for this operation: <code>{opServer!.url}</code>{opServer!.description ? ` (${opServer!.description})` : ''}</p>
      )}

      <div className={styles.sectionBar}>
        <h3>Parameters</h3>
        <button type="button" className={`${styles.btn} ${trying ? styles.btnCancel : ''}`} onClick={() => { setTrying(!trying); setResult(null); }}>
          {trying ? 'Cancel' : 'Try it out'}
        </button>
      </div>
      {params.length ? (
        <table className={styles.params}>
          <thead><tr><th>Name</th><th>Description</th></tr></thead>
          <tbody>
            {params.map((p) => (
              <tr key={key(p)}>
                <td className={styles.pName}>
                  <div>{p.name}{p.required && <span className={styles.req}> *</span>}</div>
                  <div className={styles.pType}>{String(p.schema?.type ?? 'string')}</div>
                  <div className={styles.pIn}>({p.in})</div>
                </td>
                <td>
                  {p.description && <div {...md(p.description)} />}
                  {p.example !== undefined && <div className={styles.pExample}><i>Example</i> : <code>{String(p.example)}</code></div>}
                  {trying ? (
                    <input className={styles.pInput} placeholder={p.example !== undefined ? String(p.example) : p.name} value={values[key(p)] ?? ''}
                           onChange={(e) => setValues({ ...values, [key(p)]: e.target.value })} />
                  ) : !p.description && p.example === undefined && <span className={styles.muted}>No description</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : <p className={styles.muted}>No parameters</p>}

      {body && (
        <>
          <div className={styles.sectionBar}>
            <h3>Request body{op.requestBody?.required && <span className={styles.req}> required</span>}</h3>
            <span className={styles.ctype}>{body[0]}</span>
          </div>
          {trying ? (
            <textarea className={styles.bodyEdit} spellCheck={false} value={bodyText} onChange={(e) => setBodyText(e.target.value)}
                      rows={Math.min(24, bodyText.split('\n').length + 1)} />
          ) : (
            <>
              <div className={styles.viewTabs}>
                <button type="button" className={bodyView === 'example' ? styles.viewOn : ''} onClick={() => setBodyView('example')}>Example Value</button>
                <button type="button" className={bodyView === 'schema' ? styles.viewOn : ''} onClick={() => setBodyView('schema')}>Schema</button>
              </div>
              <pre className={styles.code}>{bodyView === 'example' ? pretty(body[1].example ?? {}) : pretty(body[1].schema ?? {})}</pre>
            </>
          )}
        </>
      )}

      {trying && (
        <div className={styles.execRow}>
          <button type="button" className={styles.execute} onClick={execute} disabled={busy}>{busy ? 'Sending…' : 'Execute'}</button>
          {result && <button type="button" className={styles.btn} onClick={() => setResult(null)}>Clear</button>}
        </div>
      )}
      {result && (
        <div className={styles.result}>
          <h4>Curl</h4>
          <pre className={styles.code}>{result.curl}</pre>
          <h4>Request URL</h4>
          <pre className={styles.code}>{result.url}</pre>
          <h4>Server response</h4>
          {result.error ? <p className={styles.err}>{result.error}</p> : (
            <>
              <p className={styles.status}><b>{result.status}</b> {result.statusText} <span className={styles.muted}>· {result.ms} ms</span></p>
              <pre className={styles.code}>{result.body || '(empty body)'}</pre>
              <h4>Response headers</h4>
              <pre className={styles.code}>{result.headers!.map(([k, v]) => `${k}: ${v}`).join('\n')}</pre>
            </>
          )}
        </div>
      )}

      <div className={styles.sectionBar}><h3>Responses</h3></div>
      <table className={styles.params}>
        <thead><tr><th>Code</th><th>Description</th></tr></thead>
        <tbody>
          {Object.entries(op.responses).map(([code, r]) => (
            <tr key={code}><td className={styles.code3}>{code}</td><td><span {...md(r.description)} /></td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- Authorize dialog */
function AuthDialog({ name, scheme, token, onSave, onClose }:
  { name: string; scheme: { type: string; scheme?: string; bearerFormat?: string; description?: string }; token: string;
    onSave: (t: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(token);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Available authorizations" onClick={(e) => e.stopPropagation()}>
        <div className={styles.dialogHead}><h3>Available authorizations</h3><button type="button" className={styles.x} onClick={onClose} aria-label="Close">×</button></div>
        <h4>{name} <span className={styles.muted}>({scheme.type}, {scheme.scheme}{scheme.bearerFormat ? `, ${scheme.bearerFormat}` : ''})</span></h4>
        {scheme.description && <p>{scheme.description}</p>}
        <label className={styles.tokenLabel}>Value
          <input type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Bearer token" />
        </label>
        <p className={styles.note}>Kept only in this browser tab's session and sent as <code>Authorization: Bearer …</code> on secured operations.</p>
        <div className={styles.dialogBtns}>
          {token && <button type="button" className={styles.btn} onClick={() => onSave('')}>Logout</button>}
          <button type="button" className={styles.execute} onClick={() => onSave(value.trim())}>Authorize</button>
          <button type="button" className={styles.btn} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
