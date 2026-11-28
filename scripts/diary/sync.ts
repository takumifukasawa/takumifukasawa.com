// node scripts/diary/sync.ts <vault> <out>
//
// Writes the published notes of the Obsidian vault (01_daily/, 11_blog/; `publish: true`) into <out>/daily/ and
// <out>/blog/, with their images
// stripped of metadata. Run by the vault's GitHub Action into the private relay repo, and by
// scripts/diary/fetch.ts for local builds. See scripts/lib/diary.ts and docs/plans/active/diary-pipeline.md.
import { resolve } from 'node:path';
import { syncSite } from '../lib/diary.ts';

const [vault, out] = process.argv.slice(2);
if (!vault || !out) {
  console.error('usage: node scripts/diary/sync.ts <vault> <out>');
  process.exit(2);
}
try {
  const { daily, blog } = await syncSite(resolve(vault), resolve(out));
  console.log(`site contents: ${daily.length} days, ${blog.length} blog posts -> ${resolve(out)}/`);
} catch (e) {
  console.error(`diary: ${(e as Error).message}`);
  process.exit(1);
}
