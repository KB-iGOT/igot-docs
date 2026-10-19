import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

/* The standalone architecture page lives at the repo root (shared with the static
   explorer); serve it in dev and copy it into the build so the app can link to it. */
function architecturePage(): Plugin {
  const file = resolve(root, 'igot-architecture-overview.html');
  return {
    name: 'architecture-page',
    configureServer(server) {
      server.middlewares.use('/igot-architecture-overview.html', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(readFileSync(file));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'igot-architecture-overview.html', source: readFileSync(file) });
    },
  };
}

export default defineConfig({
  /* relative base: the build works from any sub-path (e.g. GitHub Pages /igot-docs/) */
  base: './',
  plugins: [react(), architecturePage()],
  resolve: { alias: { '@docs': resolve(root, 'docs') } },
  /* the Markdown and its images live in ../docs, the single source of truth */
  server: { fs: { allow: [root] } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 1500 },
});
