// Import a Hatena Blog export into src/content/blog/ (plan: docs/plans/active/blog-migration.md).
//
//   node scripts/hatena-import.ts <export.txt> [--cache <dir>]
//
// Only published entries. Images are downloaded from Hatena Fotolife into the cache, then copied next to the
// site's other article images (src/assets/blog/<basename>/, docs/spec/content-model.md). Gists are inlined as
// code. Writes src/data/hatena-redirects.json (old URL -> new path) for the redirect on Hatena's side.
// Re-running overwrites what it wrote before, so hand edits to the imported .md files are lost: run it until
// the conversion is right, then edit by hand.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative } from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { cleanHtml, formatBlogMd, gistIds, imageUrls, newPath, oldUrl, parseExport, toMarkdown, type Gist } from './lib/hatena.ts';
import { repoRoot } from './lib/lab.ts';

const MAX_BYTES = 2 * 1024 * 1024; // the `no large files` check

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { cache: { type: 'string', default: join(tmpdir(), 'hatena-import') } },
});
const exportPath = positionals[0];
if (!exportPath) {
  console.error('usage: node scripts/hatena-import.ts <export.txt> [--cache <dir>]');
  process.exit(1);
}
const cache = values.cache!;
mkdirSync(join(cache, 'images'), { recursive: true });
mkdirSync(join(cache, 'gists'), { recursive: true });

const entries = parseExport(readFileSync(exportPath, 'utf8')).filter((e) => e.status === 'Publish');

// --- downloads (cached, so re-runs are offline) ------------------------------------------------------------

const cachedImage = (url: string) => join(cache, 'images', new URL(url).pathname.replace(/^\/+/, ''));

const download = async (url: string, path: string) => {
  if (existsSync(path)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
};

const inBatches = async <T>(items: T[], size: number, fn: (item: T) => Promise<void>) => {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn));
};

const allImages = [...new Set(entries.flatMap((e) => imageUrls(e.body)))];
await inBatches(allImages, 8, (url) => download(url, cachedImage(url)));

const gists = new Map<string, Gist>();
for (const id of new Set(entries.flatMap((e) => gistIds(e.body)))) {
  const path = join(cache, 'gists', `${id}.json`);
  await download(`https://api.github.com/gists/${id}`, path);
  const json = JSON.parse(readFileSync(path, 'utf8')) as { files: Record<string, Gist['files'][number]> };
  gists.set(id, { files: Object.values(json.files) });
}

// --- write ------------------------------------------------------------------------------------------------

const warnings: string[] = [];

// Copies one image into the entry's asset directory and returns its path on disk. A GIF over the size limit
// becomes an animated WebP (same frames, far smaller).
const placeImage = async (url: string, assetDir: string): Promise<string> => {
  const source = cachedImage(url);
  const name = basename(source);
  mkdirSync(assetDir, { recursive: true });
  if (name.endsWith('.gif') && statSync(source).size > MAX_BYTES) {
    const target = join(assetDir, name.replace(/\.gif$/, '.webp'));
    if (!existsSync(target)) await sharp(source, { animated: true }).webp({ quality: 80 }).toFile(target);
    if (statSync(target).size > MAX_BYTES) warnings.push(`still over 2 MB after WebP: ${relative(repoRoot, target)}`);
    return target;
  }
  const target = join(assetDir, name);
  copyFileSync(source, target);
  if (statSync(target).size > MAX_BYTES) warnings.push(`over 2 MB: ${relative(repoRoot, target)}`);
  return target;
};

const redirects: { from: string; to: string }[] = [];

for (const entry of entries) {
  const mdPath = join(repoRoot, 'src', 'content', 'blog', `${entry.basename}.md`);
  const assetDir = join(repoRoot, 'src', 'assets', 'blog', entry.basename);

  const placed = new Map<string, string>();
  for (const url of imageUrls(entry.body)) placed.set(url, await placeImage(url, assetDir));

  const html = cleanHtml(entry.body, {
    image: (url) => {
      const rel = relative(dirname(mdPath), placed.get(url)!);
      return rel.startsWith('.') ? rel : `./${rel}`;
    },
    gists,
  });
  const markdown = toMarkdown(html);

  for (const leftover of markdown.match(/<(iframe|script)\b|hatenablog-parts|st-hatena\.com|d\.hatena\.ne\.jp/g) ?? []) {
    warnings.push(`${entry.basename}: leftover "${leftover}"`);
  }

  mkdirSync(dirname(mdPath), { recursive: true });
  writeFileSync(mdPath, formatBlogMd(entry, markdown));
  redirects.push({ from: oldUrl(entry.basename), to: newPath(entry.basename) });
}

const redirectsPath = join(repoRoot, 'src', 'data', 'hatena-redirects.json');
mkdirSync(dirname(redirectsPath), { recursive: true });
writeFileSync(redirectsPath, `${JSON.stringify(redirects, null, 2)}\n`);

console.log(`entries: ${entries.length}, images: ${allImages.length}, gists: ${gists.size}`);
for (const w of warnings) console.log(`WARN ${w}`);
