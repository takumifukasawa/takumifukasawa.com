// node scripts/check-artifacts.ts [slug]
//
// Opens every built sketch in headless Chrome and fails on any console error or uncaught exception.
//
// Why this exists: the build output is frozen per sketch (decision 0001), and `pnpm dev:lab` is not
// evidence that it works -- terser's property mangling broke three's ShaderChunk lookup in a build that
// was perfect in dev (docs/learnings.md, 2026-10-12). This is the only check that runs the real artifact.
//
// It serves public/ (not public/lab/<slug>/), so the paths match production, /_shell.js included.
import { createServer } from 'node:http';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { findChrome, isEnvironmentProblem, launchChrome } from './lib/chrome.ts';
import { publicLabDir, repoRoot } from './lib/lab.ts';

const TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4',
  '.glsl': 'text/plain', '.svg': 'image/svg+xml',
};

const publicDir = join(repoRoot, 'public');

const serve = () => {
  const server = createServer((req, res) => {
    // normalize + prefix check: the check must not become a way to read outside public/.
    let rel = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!));
    while (rel.startsWith('/') || rel.startsWith(sep)) rel = rel.slice(1);
    let file = join(publicDir, rel);
    if (!file.startsWith(publicDir)) {
      res.statusCode = 403;
      return res.end('forbidden');
    }
    // Chrome asks for this on every navigation; a 404 for it is noise, not a broken sketch.
    if (rel === 'favicon.ico') {
      res.statusCode = 204;
      return res.end();
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      res.statusCode = 404;
      return res.end('not found');
    }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  return new Promise<{ port: number; close: () => void }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ port: typeof address === 'object' && address ? address.port : 0, close: () => server.close() });
    });
  });
};

const slugs = (() => {
  const only = process.argv[2];
  if (only) return [only];
  return existsSync(publicLabDir)
    ? readdirSync(publicLabDir).filter((name) => existsSync(join(publicLabDir, name, 'index.html')))
    : [];
})();

if (slugs.length === 0) {
  console.log('built sketches: 0 — nothing to open.');
  process.exit(0);
}

const executable = findChrome();
if (!executable) {
  // Loud, and a pass: a machine without Chrome must not block the commit. Never silently green.
  console.log('SKIPPED: Chrome が見つからないので成果物を開いていない。');
  console.log('  この検査だけは dev では見つからない壊れ方（terser の property mangling 等）を捕まえる。');
  console.log('  Chrome を入れるか CHROME_PATH=<path to chrome> を設定して、公開前に一度は通すこと。');
  process.exit(0);
}

const site = await serve();
const browser = await launchChrome(executable);
let failed = 0;

try {
  for (const slug of slugs) {
    const url = `http://127.0.0.1:${site.port}/lab/${slug}/`;
    const found = await browser.open(url, 2500);
    const environment = found.filter(isEnvironmentProblem);
    const real = found.filter((problem) => !isEnvironmentProblem(problem));

    if (real.length === 0) {
      console.log(`${slug}: ok${environment.length > 0 ? `（WebGL 関連の環境メッセージ ${environment.length} 件は無視）` : ''}`);
      continue;
    }
    failed++;
    console.log(`${slug}: ビルド成果物がエラーを出している（public/lab/${slug}/）`);
    for (const problem of real.slice(0, 5)) console.log(`  [${problem.kind}] ${problem.text.split('\n')[0]}`);
    console.log(`  dev（pnpm dev:lab ${slug}）では出ないことがある。まず lab/${slug}/vite.config.ts の mangleProperties を`);
    console.log('  false にして pnpm lab:build し直す（three の組み込みマテリアルを使うならこれ。docs/learnings.md 2026-10-12）。');
  }
} finally {
  browser.close();
  site.close();
}

process.exitCode = failed > 0 ? 1 : 0;
