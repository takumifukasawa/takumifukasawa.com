// node scripts/blog/to-vault.ts <vault> [--dry-run]
//
// One-off: moves the migrated blog (src/content/blog/ + src/assets/blog/) into the Obsidian vault as
// 11_blog/<id>/<last part of id>.md with its images next to it, so all writing lives in the vault
// (docs/plans/active/diary-pipeline.md, task 8). Adds `publish: true`; image links become the bare file name.
// Never overwrites: a post whose folder already exists in the vault is an error. It does not delete anything here.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { stringify } from 'yaml';
import { BLOG_DIR } from '../lib/diary.ts';
import { repoRoot } from '../lib/lab.ts';
import { parseNote } from '../lib/obsidian.ts';

const contentDir = join(repoRoot, 'src', 'content', 'blog');
const assetsDir = join(repoRoot, 'src', 'assets', 'blog');

export type Move = { id: string; note: string; markdown: string; images: { from: string; to: string }[] };

export const planMove = (mdPath: string, vault: string): Move => {
  const id = relative(contentDir, mdPath).replace(/\.md$/, '').split(sep).join('/');
  const folder = join(vault, BLOG_DIR, ...id.split('/'));
  const { data, body } = parseNote(readFileSync(mdPath, 'utf8'));
  const images: Move['images'] = [];
  const newBody = body.replace(/(!\[[^\]]*\]\()([^)\s]+)(\))/g, (raw, open: string, target: string, close: string) => {
    if (/^[a-z]+:/i.test(target)) return raw;
    const from = resolve(dirname(mdPath), decodeURI(target));
    if (!from.startsWith(assetsDir + sep)) throw new Error(`${id}: image outside src/assets/blog: ${target}`);
    if (!existsSync(from)) throw new Error(`${id}: image missing: ${target}`);
    const to = join(folder, basename(from));
    if (!images.some((i) => i.to === to)) images.push({ from, to });
    return `${open}${basename(from)}${close}`;
  });
  const { draft, ...rest } = data;
  const front = stringify({ ...rest, publish: draft !== true }, { lineWidth: 0 });
  return { id, note: join(folder, `${basename(id)}.md`), markdown: `---\n${front}---\n${newBody}`, images };
};

const allPosts = (dir: string): string[] =>
  readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(dir, f))
    .sort();

if (import.meta.main) {
  const [vaultArg, flag] = process.argv.slice(2);
  if (!vaultArg) {
    console.error('usage: node scripts/blog/to-vault.ts <vault> [--dry-run]');
    process.exit(2);
  }
  const vault = resolve(vaultArg);
  const moves = allPosts(contentDir).map((p) => planMove(p, vault));
  const taken = moves.filter((m) => existsSync(dirname(m.note)));
  if (taken.length > 0) {
    console.error(`already in the vault, not touching anything: ${taken.map((m) => m.id).join(', ')}`);
    process.exit(1);
  }
  for (const m of moves) {
    console.log(`${m.id} -> ${relative(vault, m.note)} (+${m.images.length} images)`);
    if (flag === '--dry-run') continue;
    mkdirSync(dirname(m.note), { recursive: true });
    writeFileSync(m.note, m.markdown);
    for (const i of m.images) copyFileSync(i.from, i.to);
  }
  console.log(`${moves.length} posts, ${moves.reduce((n, m) => n + m.images.length, 0)} images${flag === '--dry-run' ? ' (dry run)' : ''}`);
}
