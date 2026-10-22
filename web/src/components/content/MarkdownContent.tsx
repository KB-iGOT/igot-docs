import { Fragment, useEffect, useMemo, useState } from 'react';
import { marked, type Tokens, type TokensList } from 'marked';
import { loadMarkdown } from '../../lib/docs';
import { rewriteDocHtml } from '../../lib/docHtml';
import { MermaidDiagram } from './MermaidDiagram';
import { DiagramModal } from './DiagramModal';

type Segment = { kind: 'html'; html: string } | { kind: 'mermaid'; source: string };

/** Split a Markdown document into HTML chunks and Mermaid diagrams, so diagrams
 *  render as components instead of being patched into the DOM afterwards. */
function toSegments(md: string, docPath: string): Segment[] {
  const tokens = marked.lexer(md);
  const segments: Segment[] = [];
  let run: Tokens.Generic[] = [];
  const flush = () => {
    if (!run.length) return;
    const list = Object.assign(run, { links: tokens.links }) as unknown as TokensList;
    segments.push({ kind: 'html', html: rewriteDocHtml(marked.parser(list), docPath) });
    run = [];
  };
  for (const t of tokens) {
    if (t.type === 'code' && (t as Tokens.Code).lang === 'mermaid') {
      flush();
      segments.push({ kind: 'mermaid', source: (t as Tokens.Code).text });
    } else run.push(t);
  }
  flush();
  return segments;
}

/** Renders docs/<path> (Markdown) with its images, cross-links and diagrams. */
export function MarkdownContent({ path }: { path: string }) {
  const [md, setMd] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setMd(null);
    setError(null);
    loadMarkdown(path).then((text) => alive && setMd(text)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [path]);

  const segments = useMemo(() => (md === null ? [] : toSegments(md, path)), [md, path]);
  /* clicking a documentation image opens it full screen */
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const onClick = (e: React.MouseEvent) => {
    const img = (e.target as HTMLElement).closest('.md-seg img') as HTMLImageElement | null;
    if (img) setZoom({ src: img.currentSrc || img.src, alt: img.alt });
  };

  if (error) return <div className="md-missing">{error}</div>;
  if (md === null) return <div className="content-loading" aria-busy="true">Loading…</div>;
  return (
    <article className="mdwrap" onClick={onClick}>
      {segments.map((s, i) => (
        <Fragment key={i}>
          {s.kind === 'html' ? <div className="md-seg" dangerouslySetInnerHTML={{ __html: s.html }} /> : <MermaidDiagram source={s.source} />}
        </Fragment>
      ))}
      {zoom && (
        <DiagramModal
          title={zoom.alt || 'Image'}
          svg={`<img src="${zoom.src.replace(/"/g, '&quot;')}" alt="">`}
          onClose={() => setZoom(null)}
        />
      )}
    </article>
  );
}
