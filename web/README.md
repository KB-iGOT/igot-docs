# iGOT Karmayogi Docs Explorer (React)

The Docs Explorer as a React single-page app. It renders the same Markdown as the static
explorer and MkDocs: **`../docs` stays the single source of truth**.

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # type-checks, then writes the static site to web/dist/
npm run preview    # serves web/dist/ locally
```

`npm run dev` and `npm run build` first run `npm run meta`, which reads git history to
produce `src/data/generated/meta.json` (each feature's "Last Updated" date and the diagram
count). It is generated, so it is git-ignored.

The build is plain static files with hash routing (`#/features/aicbp/hld`), so it can be
served from any folder, including GitHub Pages sub-paths, without server rewrites.
`.github/workflows/docs.yml` builds it and publishes `web/dist/` to GitHub Pages on every
push to `main` that touches `docs/` or `web/`.

## Structure

```
web/
├─ index.html                  app shell
├─ vite.config.ts              @docs alias to ../docs; copies the architecture page into the build
├─ scripts/gen-meta.mjs        build-time metadata (git dates, diagram count)
└─ src/
   ├─ main.tsx, App.tsx        entry point and routes
   ├─ types.ts                 Feature, Hub, TabSource …
   ├─ assets/brand/            the app's own images (logo)
   ├─ data/
   │  ├─ features.json         every feature: title, summary, icon, tabs and where each tab's content lives
   │  └─ hubs.json             hub groups (Learning Hub, Features, Registration) and their features
   ├─ content/features/<id>/   hand-authored panels (overviews, user manuals) as HTML fragments
   ├─ lib/
   │  ├─ catalog.ts            typed access to features/hubs, navigation lists, stats
   │  ├─ docs.ts               lazy Markdown/HTML loading, image URLs from ../docs
   │  ├─ docHtml.ts            rewrites images and .md cross-links inside rendered content
   │  └─ search.ts             header search index
   ├─ components/
   │  ├─ layout/               AppLayout, Header, SearchBox, Sidebar, Footer
   │  ├─ content/              TabContent, MarkdownContent, HtmlContent, KeyLinks, MermaidDiagram, DiagramModal
   │  ├─ catalog/              HubCards, EntryList (shared by Home and the list pages)
   │  └─ ui/                   Icon, Breadcrumbs
   ├─ pages/                   HomePage, HubListPage, FeaturePage, NotFoundPage
   └─ styles/
      ├─ global.css            design tokens and base styles
      └─ content.css           styles for documentation content
```

Component styles are CSS Modules next to each component. `content.css` is global because it
styles content that comes from Markdown and the HTML fragments.

## Where content and assets live

| What | Where | How it gets into the app |
|---|---|---|
| Markdown docs | `../docs/**/*.md` | `import.meta.glob`, loaded lazily per tab |
| Doc images (diagrams, screenshots) | next to their Markdown in `../docs/**/images/` | bundled by Vite as hashed files; links rewritten in `lib/docHtml.ts` |
| App images (logo) | `src/assets/brand/` | imported by components |
| Hand-authored panels | `src/content/features/<feature>/<tab>.html` | loaded lazily by `HtmlContent` |
| Key Links | `src/data/features.json` (`source.type = "links"`) | rendered by `KeyLinks` |
| Architecture page | `../igot-architecture-overview.html` | served in dev and copied into `dist/` by `vite.config.ts` |

## Adding or changing documentation

- **Edit a Markdown tab**: edit the file in `../docs`. Nothing else to do.
- **Add a tab**: add an entry to the feature's `tabs` in `src/data/features.json`, with
  `"source": { "type": "markdown", "path": "learning-hub/<feature>/<file>.md" }`.
- **Add a feature**: add it to `features.json`, and list it under the right hub in
  `hubs.json` (that decides its sidebar dropdown, list page and breadcrumb).

Navigation: hubs that group features (Learning Hub, and Registration inside Features) are
dropdowns in the sidebar; "View all" links and hub breadcrumbs open plain list pages (`/hubs`,
`/hubs/<id>`).

Markdown links to other docs (`[LLD](lld.md)`) become in-app links to the matching tab;
` ```mermaid ` blocks render as diagrams, with a full-screen zoom viewer.

## Migration notes

The data and content files were extracted once from `karmayogi-docs-explorer.template.html`
(the old static single-file explorer) on the `react-migration` branch; that template, the
built HTML and its Python build tools have since been removed. Hand-authored panels were kept as HTML
fragments, not rewritten as JSX: they are content, not UI, and keeping them as fragments means
they can be edited without touching components. Their interactive parts (Expand/Collapse all,
journey pills, screenshot zoom) are handled in `HtmlContent`.
