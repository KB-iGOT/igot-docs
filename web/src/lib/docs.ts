/* Loads documentation content. Markdown and its images stay in ../docs (shared with
   MkDocs); Vite bundles the images as hashed assets and loads each page lazily. */

const markdownFiles = import.meta.glob('@docs/**/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const imageFiles = import.meta.glob('@docs/**/*.{png,jpg,jpeg,gif,webp,svg}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const htmlFiles = import.meta.glob('../content/features/**/*.html', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

/** glob keys look like "/../docs/a/b.md" or "../../docs/a/b.md": key them by the path inside docs/ */
const byDocsPath = <T,>(files: Record<string, T>) =>
  Object.fromEntries(Object.entries(files).map(([k, v]) => [k.slice(k.lastIndexOf('/docs/') + 6), v]));

const markdown = byDocsPath(markdownFiles);
const images = byDocsPath(imageFiles);
const html = Object.fromEntries(Object.entries(htmlFiles).map(([k, v]) => [k.slice(k.indexOf('/features/') + 10), v]));

export const loadMarkdown = (path: string) => (markdown[path] ? markdown[path]() : Promise.reject(new Error(`Missing docs/${path}`)));
export const loadHtml = (file: string) => (html[file] ? html[file]() : Promise.reject(new Error(`Missing src/content/features/${file}`)));

/** normalise "a/b/../c" */
function normalise(path: string) {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

/** docs-relative path of a link or image written inside the doc at `fromPath`
 *  ("images/x.jpg" in a Markdown file, or "docs/..." in a hand-authored fragment) */
export function resolveDocPath(fromPath: string | null, ref: string) {
  if (ref.startsWith('docs/')) return normalise(ref.slice(5));
  const base = fromPath ? fromPath.replace(/[^/]*$/, '') : '';
  return normalise(base + ref);
}

export const imageUrl = (docsPath: string) => images[docsPath] ?? null;
