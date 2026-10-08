// Site build (Astro, static). Sketches are NOT built here: their outputs are already in public/lab/ (decision 0001).
// P0 has no pages (docs/spec/site-v0.md): `pnpm build` only copies public/ into dist/.
//
// pnpm dev --https: mkcert certificate + listen on the LAN so a phone can open it (same certificate as dev:lab).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from 'astro/config';
import type { Plugin } from 'vite';
import mkcert from 'vite-plugin-mkcert';

const https = process.argv.includes('--https');
const publicDir = join(import.meta.dirname, 'public');

// Astro dev does not serve public/**/index.html for a directory URL (Pages does), so /lab/<slug>/ would 404.
const servePublicIndex: Plugin = {
  name: 'serve-public-index',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = req.url?.split('?')[0];
      if (path?.endsWith('/') && path !== '/' && existsSync(join(publicDir, path, 'index.html'))) {
        req.url = req.url!.replace(path, `${path}index.html`);
      }
      next();
    });
  },
};

export default defineConfig({
  site: 'https://takumifukasawa.com',
  output: 'static',
  trailingSlash: 'always',
  server: { host: https },
  vite: {
    plugins: [servePublicIndex, ...(https ? [mkcert()] : [])],
  },
});
