// The site-contents relay (docs/plans/active/diary-pipeline.md): picks the published notes out of the Obsidian vault
// and writes them, with the images they use, as plain Markdown. The vault's GitHub Action runs this into the private
// relay repo; local builds run it straight into .content/.
//
// Output (each section is mirrored: what is not written this time is deleted, so unpublishing a note removes it):
//   <out>/daily/<YYYYMMDD>.md          from 01_daily/**/<YYYYMMDD>.md: frontmatter { date } + the converted body
//   <out>/blog/<id>.md                 from 11_blog/<id>/<last segment of id>.md: title, date, tags, description + body
//   <out>/<section>/<id>/<image>       each referenced image, re-encoded with all metadata removed
// A note is published only with `publish: true` (scripts/lib/obsidian.ts).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { stringify } from 'yaml';
import sharp from 'sharp';
import { demoteHeadings, imageRefs, isPublished, parseNote, safeFileName, toSiteMarkdown } from './obsidian.ts';

export const DAILY_DIR = '01_daily';
export const BLOG_DIR = '11_blog';
const SKIP_DIRS = new Set(['.git', '.obsidian', '.trash', 'node_modules']);

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};

// Obsidian resolves `![[name.png]]` by file name across the whole vault. Same here, preferring the note's own
// folder (where new attachments go: "same folder as current file"). Two matches elsewhere is an error, not a guess.
export const makeResolver = (vault: string) => {
  let byName: Map<string, string[]> | undefined;
  const index = () => {
    if (!byName) {
      byName = new Map();
      for (const p of walk(vault)) {
        const key = basename(p);
        byName.set(key, [...(byName.get(key) ?? []), p]);
      }
    }
    return byName;
  };
  return (notePath: string, target: string): string => {
    const local = resolve(dirname(notePath), target);
    if (local.startsWith(resolve(vault) + sep) && existsSync(local)) return local;
    const found = index().get(basename(target)) ?? [];
    if (found.length === 1) return found[0]!;
    const rel = relative(vault, notePath);
    if (found.length === 0) throw new Error(`${rel}: image "${target}" is not in the vault.`);
    throw new Error(
      `${rel}: image "${target}" matches ${found.length} files (${found.map((f) => relative(vault, f)).join(', ')}). Rename one.`,
    );
  };
};

// Re-encodes an image with every metadata block (EXIF incl. GPS, XMP, IPTC, ICC comments) dropped. sharp drops
// metadata unless asked to keep it; .rotate() first bakes the EXIF orientation into the pixels so phone photos
// stay upright once the tag is gone. Astro cannot be relied on for this: it also copies originals into dist/.
export const stripMetadata = async (input: Buffer, file: string): Promise<Buffer> => {
  const ext = file.toLowerCase().split('.').pop();
  const img = sharp(input, { animated: ext === 'gif' || ext === 'webp' }).rotate();
  if (ext === 'jpg' || ext === 'jpeg') return img.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  if (ext === 'png') return img.png().toBuffer();
  if (ext === 'webp') return img.webp({ quality: 90 }).toBuffer();
  if (ext === 'gif') return img.gif().toBuffer();
  throw new Error(`${file}: unsupported image type`);
};

export type EntryOut = { id: string; markdown: string; images: { from: string; name: string }[] };
type Resolver = ReturnType<typeof makeResolver>;

// The images a note uses, each with a file name unique within the entry, and the body with its images pointing at
// them. The entry's images sit next to its .md in a folder named after the id's last segment: <id>.md + <id>/<image>.
const withImages = (notePath: string, id: string, body: string, resolveImage: Resolver) => {
  const images = new Map<string, { from: string; name: string }>();
  for (const ref of imageRefs(body)) {
    const from = resolveImage(notePath, ref.target);
    if (!images.has(from)) {
      let name = safeFileName(basename(from));
      while ([...images.values()].some((i) => i.name === name)) name = `x-${name}`;
      images.set(from, { from, name });
    }
  }
  const converted = toSiteMarkdown(body, (target) => `./${basename(id)}/${images.get(resolveImage(notePath, target))!.name}`);
  return { body: converted, images: [...images.values()] };
};

// Builds one published day: converted Markdown plus the list of images to copy. Not published -> undefined.
export const buildDay = (vault: string, notePath: string, resolveImage: Resolver): EntryOut | undefined => {
  const id = basename(notePath, '.md');
  if (!/^\d{8}$/.test(id)) throw new Error(`${relative(vault, notePath)}: a daily note must be named YYYYMMDD.md`);
  const note = parseNote(readFileSync(notePath, 'utf8'));
  if (!isPublished(note)) return undefined;
  const { body, images } = withImages(notePath, id, note.body, resolveImage);
  const date = `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`;
  // The page shows the date itself, so the note's own "# YYYYMMDD" title line is dropped (it would be a second h1).
  // Headings inside the day sit under the page's h1 (Diary) and h2 (the date): # becomes ###.
  const text = demoteHeadings(body.replace(/^\s*#[ \t]+\d{8}[ \t]*(\n|$)/, ''), 2)
    .replace(/^\n+/, '')
    .replace(/\s*$/, '\n');
  return { id, markdown: `---\ndate: ${date}\n---\n${text}`, images };
};

// The blog fields the site's collection reads (src/content.config.ts). `publish` and anything Obsidian adds stay behind.
const BLOG_FIELDS = ['title', 'date', 'tags', 'description'] as const;

// Builds one published blog post. The id is the note's folder under 11_blog/ ("threejs-billboard-shader", or
// "2021/06/19/133849" for posts that had a date URL on Hatena); the note is named after the id's last segment.
export const buildPost = (vault: string, notePath: string, resolveImage: Resolver): EntryOut | undefined => {
  const id = relative(join(vault, BLOG_DIR), dirname(notePath)).split(sep).join('/');
  if (!id || id.startsWith('..') || basename(notePath, '.md') !== basename(id))
    throw new Error(`${relative(vault, notePath)}: a blog post must be ${BLOG_DIR}/<id>/<last part of id>.md`);
  const note = parseNote(readFileSync(notePath, 'utf8'));
  if (!isPublished(note)) return undefined;
  if (typeof note.data.title !== 'string' || !note.data.date) throw new Error(`${relative(vault, notePath)}: needs title and date`);
  const { body, images } = withImages(notePath, id, note.body, resolveImage);
  // A property left empty in Obsidian (`description:`) is null; skip it rather than fail the site's schema.
  const data = Object.fromEntries(BLOG_FIELDS.filter((k) => note.data[k] != null && note.data[k] !== '').map((k) => [k, note.data[k]]));
  const date = note.data.date instanceof Date ? note.data.date.toISOString() : String(note.data.date);
  const front = stringify({ ...data, date }, { lineWidth: 0 });
  return { id, markdown: `---\n${front}---\n${body.replace(/^\n+/, '').replace(/\s*$/, '\n')}`, images };
};

const notesIn = (root: string) =>
  existsSync(root)
    ? walk(root)
        .filter((p) => p.endsWith('.md'))
        .sort()
    : [];

const writeSection = (target: string, entries: { e: EntryOut; files: { name: string; data: Buffer }[] }[]) => {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const { e, files } of entries) {
    mkdirSync(dirname(join(target, `${e.id}.md`)), { recursive: true });
    writeFileSync(join(target, `${e.id}.md`), e.markdown);
    if (files.length > 0) mkdirSync(join(target, e.id), { recursive: true });
    for (const f of files) writeFileSync(join(target, e.id, f.name), f.data);
  }
};

const encode = (entries: EntryOut[]) =>
  Promise.all(
    entries.map(async (e) => ({
      e,
      files: await Promise.all(e.images.map(async (i) => ({ name: i.name, data: await stripMetadata(readFileSync(i.from), i.from) }))),
    })),
  );

const noDuplicates = (entries: EntryOut[], dir: string) => {
  const dup = entries.find((d, i) => entries.findIndex((e) => e.id === d.id) !== i);
  if (dup) throw new Error(`${dup.id} exists twice under ${dir}/`);
};

// Writes every published note of the vault into <out>/daily and <out>/blog, replacing what was there.
// Returns the ids written. An error in any note stops the whole run before <out> is touched.
export const syncSite = async (vault: string, out: string): Promise<{ daily: string[]; blog: string[] }> => {
  if (!existsSync(join(vault, DAILY_DIR)))
    throw new Error(`${join(vault, DAILY_DIR)} does not exist. Pass the vault root (the folder that has ${DAILY_DIR}/).`);
  const resolveImage = makeResolver(vault);
  const days = notesIn(join(vault, DAILY_DIR))
    .map((p) => buildDay(vault, p, resolveImage))
    .filter((d): d is EntryOut => !!d);
  noDuplicates(days, DAILY_DIR);
  const posts = notesIn(join(vault, BLOG_DIR))
    .map((p) => buildPost(vault, p, resolveImage))
    .filter((d): d is EntryOut => !!d);
  noDuplicates(posts, BLOG_DIR);
  const [daily, blog] = [await encode(days), await encode(posts)];
  writeSection(join(out, 'daily'), daily);
  writeSection(join(out, 'blog'), blog);
  return { daily: days.map((d) => d.id), blog: posts.map((p) => p.id) };
};
