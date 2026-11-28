// The diary relay (docs/plans/active/diary-pipeline.md): picks the published days out of the Obsidian vault and
// writes them, with the images they use, as plain Markdown. The vault's GitHub Action runs this into the private
// relay repo; local builds run it straight into .content/diary/.
//
// Output (<out>/ is mirrored: what is not written this time is deleted, so unpublishing a day removes it):
//   <out>/daily/<YYYYMMDD>.md          frontmatter { date } + the converted body
//   <out>/daily/<YYYYMMDD>/<image>     each referenced image, re-encoded with all metadata removed
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { imageRefs, isPublished, parseNote, safeFileName, toSiteMarkdown } from './obsidian.ts';

export const DAILY_DIR = '01_daily';
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

export type DayOut = { id: string; markdown: string; images: { from: string; name: string }[] };

// Builds one published day: converted Markdown plus the list of images to copy. Not published -> undefined.
export const buildDay = (vault: string, notePath: string, resolveImage: ReturnType<typeof makeResolver>): DayOut | undefined => {
  const id = basename(notePath, '.md');
  if (!/^\d{8}$/.test(id)) throw new Error(`${relative(vault, notePath)}: a daily note must be named YYYYMMDD.md`);
  const note = parseNote(readFileSync(notePath, 'utf8'));
  if (!isPublished(note)) return undefined;
  const images = new Map<string, { from: string; name: string }>();
  for (const ref of imageRefs(note.body)) {
    const from = resolveImage(notePath, ref.target);
    if (!images.has(from)) {
      let name = safeFileName(basename(from));
      while ([...images.values()].some((i) => i.name === name)) name = `x-${name}`;
      images.set(from, { from, name });
    }
  }
  const body = toSiteMarkdown(note.body, (target) => `./${id}/${images.get(resolveImage(notePath, target))!.name}`);
  const date = `${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}`;
  return { id, markdown: `---\ndate: ${date}\n---\n${body.replace(/^\n+/, '').replace(/\s*$/, '\n')}`, images: [...images.values()] };
};

// Writes every published day of <vault>/01_daily into <out>/daily, replacing what was there.
// Returns the ids written. Errors in any note stop the whole run before <out> is touched.
export const syncDiary = async (vault: string, out: string): Promise<string[]> => {
  const dailyRoot = join(vault, DAILY_DIR);
  if (!existsSync(dailyRoot)) throw new Error(`${dailyRoot} does not exist. Pass the vault root (the folder that has ${DAILY_DIR}/).`);
  const resolveImage = makeResolver(vault);
  const notes = walk(dailyRoot)
    .filter((p) => p.endsWith('.md'))
    .sort();
  const days = notes.map((p) => buildDay(vault, p, resolveImage)).filter((d): d is DayOut => !!d);
  const dup = days.find((d, i) => days.findIndex((e) => e.id === d.id) !== i);
  if (dup) throw new Error(`${dup.id}.md exists twice under ${DAILY_DIR}/`);
  const encoded = await Promise.all(
    days.map(async (d) => ({
      d,
      files: await Promise.all(d.images.map(async (i) => ({ name: i.name, data: await stripMetadata(readFileSync(i.from), i.from) }))),
    })),
  );
  const target = join(out, 'daily');
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const { d, files } of encoded) {
    writeFileSync(join(target, `${d.id}.md`), d.markdown);
    if (files.length > 0) mkdirSync(join(target, d.id));
    for (const f of files) writeFileSync(join(target, d.id, f.name), f.data);
  }
  return days.map((d) => d.id);
};
