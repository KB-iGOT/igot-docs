/* Build-time metadata the app cannot compute in the browser:
   - dates: last git commit date per docs folder (shown as "Last Updated")
   - diagrams: number of Mermaid diagrams and design-diagram images in the docs
   Writes src/data/generated/meta.json (git-ignored; regenerated before dev/build). */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, '..', '..', 'docs');
const out = join(here, '..', 'src', 'data', 'generated', 'meta.json');

const mdFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.md')) mdFiles.push(p);
  }
})(docs);

const dates = {};
for (const dir of new Set(mdFiles.map((f) => dirname(f)))) {
  const key = relative(docs, dir).split('\\').join('/');
  if (!key) continue;
  try {
    const d = execFileSync('git', ['log', '-1', '--format=%cs', '--', dir], { encoding: 'utf8' }).trim();
    if (d) dates[key] = d;
  } catch {
    /* no git: pages simply show no date */
  }
}

let diagrams = 0;
for (const f of mdFiles) {
  const text = readFileSync(f, 'utf8');
  diagrams += (text.match(/^```mermaid/gm) || []).length;
  if (/(context-diagram|hld|lld)\.md$/.test(f)) diagrams += (text.match(/!\[[^\]]*\]\(|<img\b/g) || []).length;
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ dates, diagrams }, null, 2) + '\n');
console.log(`meta: ${Object.keys(dates).length} dated folders, ${diagrams} diagrams`);
