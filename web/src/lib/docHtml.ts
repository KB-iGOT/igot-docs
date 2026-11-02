/* Rewrites rendered documentation HTML so it works inside the app:
   images point at the bundled assets, links to other docs become in-app routes,
   headings get GitHub-style ids for in-page links, external links open in a new tab.
   Pure string -> string, so it can be memoised. */
import { imageUrl, resolveDocPath } from './docs';
import { tabForDoc } from './catalog';
import { docPageFor } from './docPages';

/** the ETL references link to the interactive overview by its original file name */
const HTML_PAGES: Record<string, string> = { 'Data-pipeline-overview.html': '#/etl-analytics' };

/** GitHub's heading anchor: lower-case, drop punctuation, spaces to hyphens */
const slug = (text: string) => text.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');

const isExternal = (href: string) => /^(https?:|mailto:|tel:|data:)/i.test(href);

export function rewriteDocHtml(html: string, docPath: string | null): string {
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  const root = doc.getElementById('r')!;

  root.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src')!;
    if (!isExternal(src)) {
      const url = imageUrl(resolveDocPath(docPath, src));
      if (url) img.setAttribute('src', url);
    }
    img.setAttribute('loading', 'lazy');
  });

  const seen = new Map<string, number>();
  root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => {
    const base = slug(h.textContent ?? '');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    h.id = n ? `${base}-${n}` : base;
  });

  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')!;
    if (isExternal(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      return;
    }
    if (/^#[^/]/.test(href)) { a.setAttribute('data-anchor', decodeURIComponent(href.slice(1))); return; } /* MarkdownContent scrolls to it */
    const [file, anchor] = href.split('#');
    if (HTML_PAGES[file]) { a.setAttribute('title', href); a.setAttribute('href', HTML_PAGES[file]); return; }
    if (!file.endsWith('.md')) return; /* in-app routes (#/...) stay as they are */
    const target = resolveDocPath(docPath, file);
    const hit = tabForDoc(target);
    const page = docPageFor(target);
    a.setAttribute('title', href);
    if (hit) a.setAttribute('href', `#/features/${hit.featureId}/${hit.tab.key}`);
    else if (page) a.setAttribute('href', `#/${page.route}`);
    else {
      a.removeAttribute('href'); /* the target isn't published as a tab: keep the text, drop the dead link */
      a.classList.add('doc-xref-missing');
    }
    void anchor;
  });

  return root.innerHTML;
}
