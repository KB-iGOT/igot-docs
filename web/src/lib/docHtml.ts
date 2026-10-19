/* Rewrites rendered documentation HTML so it works inside the app:
   images point at the bundled assets, links to other docs become in-app routes,
   external links open in a new tab. Pure string -> string, so it can be memoised. */
import { imageUrl, resolveDocPath } from './docs';
import { tabForDoc } from './catalog';

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

  root.querySelectorAll('a[href]').forEach((a) => {
    const href = a.getAttribute('href')!;
    if (isExternal(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
      return;
    }
    const [file, anchor] = href.split('#');
    if (!file.endsWith('.md')) return; /* in-app routes (#/...) and in-page anchors stay as they are */
    const hit = tabForDoc(resolveDocPath(docPath, file));
    a.setAttribute('title', href);
    if (hit) a.setAttribute('href', `#/features/${hit.featureId}/${hit.tab.key}`);
    else {
      a.removeAttribute('href'); /* the target isn't published as a tab: keep the text, drop the dead link */
      a.classList.add('doc-xref-missing');
    }
    void anchor;
  });

  return root.innerHTML;
}
