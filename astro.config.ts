// Site build (Astro, static). Sketches are NOT built here: their outputs are already in public/lab/ (decision 0001).
// P0 has no pages (docs/spec/site-v0.md): `pnpm build` only copies public/ into dist/.
//
// pnpm dev --https: mkcert certificate + listen on the LAN so a phone can open it (same certificate as dev:lab).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { satteri } from '@astrojs/markdown-satteri';
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

// Links in Markdown bodies (the blog) that leave the site open in a new tab, like the header's external links
// (src/layouts/Base.astro). A link is external when it has a scheme and host: site paths and #anchors are
// left alone. Written as a Sätteri hast plugin: Sätteri is Astro 7's default Markdown processor and does not
// run unified (rehype) plugins.
const externalLinksInNewTab = () => ({
  name: 'external-links-in-new-tab',
  element: {
    filter: ['a'],
    visit(node: { properties?: Record<string, unknown> }, ctx: { setProperty: (node: unknown, name: string, value: unknown) => void }) {
      const href = node.properties?.href;
      if (typeof href !== 'string' || !/^https?:\/\//.test(href)) return;
      ctx.setProperty(node, 'target', '_blank');
      ctx.setProperty(node, 'rel', 'noopener');
    },
  },
});

export default defineConfig({
  site: 'https://takumifukasawa.com',
  output: 'static',
  trailingSlash: 'always',
  markdown: { processor: satteri({ hastPlugins: [externalLinksInNewTab] }) },
  server: { host: https },
  vite: {
    plugins: [servePublicIndex, ...(https ? [mkcert()] : [])],
  },
});
