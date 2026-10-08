// pnpm dev:lab <NNN-slug> [--https]
// Start the Vite dev server for one sketch. Also serves /_shell.js from public/ so the link back to the site
// shows up while developing (decision 0004). --https uses mkcert and listens on the LAN so a phone can open it
// (iOS camera / motion sensors need a secure context).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Plugin } from 'vite';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const https = args.includes('--https');
const slug = args.find((a) => !a.startsWith('--'));

if (!slug) {
  console.error('pnpm dev:lab: usage: pnpm dev:lab <NNN-slug> [--https]');
  process.exit(1);
}
const configFile = join(root, 'lab', slug, 'vite.config.ts');
if (!existsSync(configFile)) {
  console.error(`pnpm dev:lab: lab/${slug}/vite.config.ts not found. Create the sketch with: pnpm new ${slug} "<title>"`);
  process.exit(1);
}

const shellFile = join(root, 'public', '_shell.js');
const serveShell: Plugin = {
  name: 'serve-site-shell',
  configureServer(server) {
    server.middlewares.use('/_shell.js', (_req, res, next) => {
      if (!existsSync(shellFile)) return next();
      res.setHeader('Content-Type', 'text/javascript');
      res.end(readFileSync(shellFile));
    });
  },
};

const plugins: Plugin[] = [serveShell];
if (https) {
  const { default: mkcert } = await import('vite-plugin-mkcert');
  plugins.push(mkcert());
}

const server = await createServer({
  configFile,
  plugins,
  server: { host: https ? true : 'localhost' },
});
await server.listen();
server.printUrls();
