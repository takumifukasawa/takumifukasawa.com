// pnpm preview [--https]
// Build the site, then serve dist/ with `wrangler pages dev` so _headers / _redirects / trailing slashes behave
// like production. --https listens on the LAN with the same mkcert certificate as `pnpm dev --https` /
// `pnpm dev:lab --https`, so a phone that trusts the mkcert root CA once can open all three.
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const https = process.argv.slice(2).includes('--https');

const run = (cmd: string, args: string[]) => {
  const result = spawnSync(cmd, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

run('astro', ['build']);

const wranglerArgs = ['pages', 'dev', 'dist'];
if (https) {
  // Let vite-plugin-mkcert create / renew the certificate (it adds the current LAN IPs), then hand its files to wrangler.
  const { default: mkcert } = await import('vite-plugin-mkcert');
  const plugin = mkcert();
  const config = plugin.config as (c: object, env: object) => Promise<unknown>;
  await config({ server: {} }, { command: 'serve', mode: 'development' });
  const certDir = join(homedir(), '.vite-plugin-mkcert');
  wranglerArgs.push(
    '--ip', '0.0.0.0',
    '--local-protocol', 'https',
    '--https-key-path', join(certDir, 'dev.pem'),
    '--https-cert-path', join(certDir, 'cert.pem'),
  );
}
run('wrangler', wranglerArgs);
