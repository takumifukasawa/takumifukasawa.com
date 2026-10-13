// pnpm dev:lab <slug> [--https] [--port <n>]
// Start the Vite dev server for one sketch. Also serves /_shell.js from public/ so the link back to the site
// shows up while developing (decision 0004). --https uses mkcert and listens on the LAN so a phone can open it
// (iOS camera / motion sensors need a secure context).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Plugin } from 'vite';

const root = join(import.meta.dirname, '..');
const args = process.argv.slice(2);
const https = args.includes('--https');
const portIndex = args.indexOf('--port');
const port = portIndex === -1 ? 5173 : Number(args[portIndex + 1]);
const slug = args.find((a, i) => !a.startsWith('--') && (portIndex === -1 || i !== portIndex + 1));

if (!slug) {
  console.error('pnpm dev:lab: usage: pnpm dev:lab <slug> [--https] [--port <n>]');
  process.exit(1);
}
if (!Number.isInteger(port) || port <= 0) {
  console.error(`pnpm dev:lab: --port needs a number (got ${args[portIndex + 1]}). Example: pnpm dev:lab ${slug} --port 5174`);
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
  // strictPort: without it Vite silently moves to the next free port, so a stale server from an earlier
  // session keeps 5173 and you spend a while looking at the wrong sketch. Failing here costs one message.
  server: { host: https ? true : 'localhost', port, strictPort: true },
});
try {
  await server.listen();
} catch (e) {
  if (!(e instanceof Error && e.message.includes('already in use'))) throw e;
  console.error(
    `pnpm dev:lab: port ${port} is already in use. Find the owner with \`lsof -nP -iTCP:${port} -sTCP:LISTEN\`, ` +
      `stop it if it is stale, or pick another port: pnpm dev:lab ${slug} --port ${port + 1}`,
  );
  process.exit(1);
}
server.printUrls();
