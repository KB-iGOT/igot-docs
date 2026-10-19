import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  svg: string;
  onClose: () => void;
}

/** Full-screen diagram viewer: zoom in / out, fit to screen, drag to pan, Esc to close. */
export function DiagramModal({ svg, onClose }: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [fit, setFit] = useState(1);
  const drag = useRef<{ x: number; y: number; l: number; t: number } | null>(null);

  /* pin the SVG to its natural (viewBox) size, then fit it to the window */
  useLayoutEffect(() => {
    const el = scaleRef.current?.querySelector('svg');
    if (!el) return;
    const vb = el.viewBox?.baseVal;
    if (vb?.width) {
      el.setAttribute('width', String(vb.width));
      el.setAttribute('height', String(vb.height));
      el.style.maxWidth = 'none';
    }
    const w = vb?.width || el.clientWidth;
    const h = vb?.height || el.clientHeight;
    if (w && h) {
      const f = Math.max(0.15, Math.min(2.5, Math.min((window.innerWidth - 90) / w, (window.innerHeight - 130) / h)));
      setFit(f);
      setScale(f);
    }
  }, [svg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onMove = (e: MouseEvent) => {
      const v = viewRef.current;
      if (!drag.current || !v) return;
      v.scrollLeft = drag.current.l - (e.clientX - drag.current.x);
      v.scrollTop = drag.current.t - (e.clientY - drag.current.y);
    };
    const onUp = () => { drag.current = null; viewRef.current?.classList.remove('dragging'); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [onClose]);

  const startDrag = useCallback((e: React.MouseEvent) => {
    const v = viewRef.current!;
    drag.current = { x: e.clientX, y: e.clientY, l: v.scrollLeft, t: v.scrollTop };
    v.classList.add('dragging');
    e.preventDefault();
  }, []);

  return createPortal(
    <div className="moverlay" role="dialog" aria-modal="true" aria-label="Diagram">
      <div className="mmbar">
        <span className="ttl">Diagram</span>
        <button type="button" title="Zoom out" aria-label="Zoom out" onClick={() => setScale((s) => Math.max(0.25, s - 0.25))}>&minus;</button>
        <span className="mpct">{Math.round(scale * 100)}%</span>
        <button type="button" title="Zoom in" aria-label="Zoom in" onClick={() => setScale((s) => Math.min(8, s + 0.25))}>+</button>
        <button type="button" className="wide" title="Fit to screen" onClick={() => setScale(fit)}>fit</button>
        <button type="button" title="Close" aria-label="Close" onClick={onClose}>&#10005;</button>
      </div>
      <div className="mmview" ref={viewRef} onMouseDown={startDrag}>
        <div className="mscale" ref={scaleRef} style={{ transform: `scale(${scale})` }} dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>,
    document.body,
  );
}
