import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { loadHtml } from '../../lib/docs';
import { rewriteDocHtml } from '../../lib/docHtml';

/** A hand-authored panel (overview cards, step-by-step user manuals...) from
 *  src/content/features. Its interactive bits are handled here by delegation:
 *  Expand/Collapse all, journey pills that open a step, click-to-enlarge screenshots. */
export function HtmlContent({ file }: { file: string }) {
  const [raw, setRaw] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setRaw(null);
    setError(null);
    loadHtml(file).then((h) => alive && setRaw(h)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [file]);

  const html = useMemo(() => (raw === null ? '' : rewriteDocHtml(raw, null)), [raw]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const pill = target.closest<HTMLElement>('[data-ov-open]');
    if (pill) {
      const step = document.getElementById(pill.dataset.ovOpen!) as HTMLDetailsElement | null;
      if (step) { step.open = true; step.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
      return;
    }
    const fig = target.closest<HTMLElement>('.uc-fig');
    if (fig) {
      fig.classList.toggle('zoom');
      if (fig.classList.contains('zoom')) fig.scrollIntoView({ block: 'nearest' });
      return;
    }
    const all = target.closest<HTMLElement>('[data-ug-all]');
    if (all) {
      const open = all.dataset.ugAll === 'open';
      e.currentTarget.querySelectorAll<HTMLDetailsElement>('details.uc-acc').forEach((d) => { d.open = open; });
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const pill = (e.target as HTMLElement).closest<HTMLElement>('[data-ov-open]');
    if (pill) { e.preventDefault(); pill.click(); }
  };

  if (error) return <div className="md-missing">{error}</div>;
  if (raw === null) return <div className="content-loading" aria-busy="true">Loading…</div>;
  /* the fragment is first-party content bundled at build time, not user input */
  return <div className="html-content" onClick={onClick} onKeyDown={onKeyDown} dangerouslySetInnerHTML={{ __html: html }} />;
}
