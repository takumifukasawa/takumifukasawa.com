// Checks the Hatena Blog -> takumifukasawa.com/blog/ move against what is live (plan:
// docs/plans/active/blog-migration.md). Read-only: it only fetches pages.
//
//   node scripts/hatena/check-redirects.ts            # every new page answers 200
//   node scripts/hatena/check-redirects.ts --hatena   # and every Hatena entry carries the redirect script
//
// The list comes from src/data/hatena-redirects.json (written by scripts/hatena/import.ts). With --hatena it
// also reads Hatena's sitemap, so an entry published on Hatena after the export (and so not migrated) shows up.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { repoRoot } from '../lib/lab.ts';

const SITE = 'https://takumifukasawa.com';
const HATENA = 'https://takumifukasawa.hatenablog.com';
const MARKER = "'https://takumifukasawa.com/blog/'"; // a string only the head.html script contains

const { values } = parseArgs({ options: { hatena: { type: 'boolean', default: false } } });

const redirects = JSON.parse(readFileSync(join(repoRoot, 'src', 'data', 'hatena-redirects.json'), 'utf8')) as {
  from: string;
  to: string;
}[];

const problems: string[] = [];

const inBatches = async <T>(items: T[], size: number, fn: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
};

await inBatches(redirects, 8, async ({ to }) => {
  const res = await fetch(`${SITE}${to}`, { redirect: 'manual' });
  if (res.status !== 200) problems.push(`${res.status} ${SITE}${to}`);
});
console.log(`new pages: ${redirects.length} checked`);

if (values.hatena) {
  const known = new Set(redirects.map((r) => r.from));
  const index = await (await fetch(`${HATENA}/sitemap.xml`)).text();
  const monthly = [...index.matchAll(/<loc>([^<]*sitemap_periodical[^<]*)<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
  const live: string[] = [];
  for (const url of monthly) {
    const xml = await (await fetch(url)).text();
    live.push(...[...xml.matchAll(/<loc>([^<]*\/entry\/[^<]*)<\/loc>/g)].map((m) => m[1]));
  }
  for (const url of live) if (!known.has(url)) problems.push(`on Hatena but not migrated: ${url}`);

  await inBatches(live, 8, async (url) => {
    const html = await (await fetch(url)).text();
    if (!html.includes(MARKER)) problems.push(`no redirect script yet: ${url}`);
  });
  console.log(`hatena entries: ${live.length} checked`);
}

for (const p of problems) console.log(`FAIL ${p}`);
if (problems.length > 0) {
  console.log(
    'The new pages must all answer 200 before the script goes into Hatena (deploy main first). ' +
      'An unmigrated entry: re-export and re-run scripts/hatena/import.ts.',
  );
  process.exit(1);
}
console.log('ok');
