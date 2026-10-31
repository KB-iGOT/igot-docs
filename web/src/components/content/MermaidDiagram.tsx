import { useEffect, useState } from 'react';
import { renderMermaid } from './mermaid';
import { DiagramModal } from './DiagramModal';

/** A Mermaid diagram rendered in place, with a Zoom button that opens it full screen.
 *  Falls back to the diagram source if Mermaid can't render it. */
export function MermaidDiagram({ source }: { source: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    let alive = true;
    renderMermaid(source).then((s) => alive && setSvg(s)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [source]);

  if (failed) {
    return <pre className="mermaid-fallback"><code>{source}</code></pre>;
  }
  if (!svg) return <div className="mermaid mermaid-loading" aria-busy="true">Rendering diagram…</div>;
  return (
    <div className="mfig">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <button type="button" className="mzoom" onClick={() => setZoomed(true)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5M11 8v6M8 11h6" /></svg>
        Zoom
      </button>
      {zoomed && <DiagramModal svg={svg} onClose={() => setZoomed(false)} />}
    </div>
  );
}
