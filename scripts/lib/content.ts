// src/content/lab/<slug>.md (frontmatter = docs/spec/content-model.md), media/manifest.json, and the <head>
// of the built sketch page, which is rewritten from the md (decision 0004: the md is the source of truth).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse, stringify } from 'yaml';
import { repoRoot } from './lab.ts';

// --- md ---------------------------------------------------------------------------------------------------

export type LabFrontmatter = {
  date: string;
  title: string;
  medium: 'runtime' | 'video' | 'image';
  poster: string;
  tags: string[];
  description?: string;
  video?: string;
  externalUrl?: string;
  repo?: string;
  draft?: boolean;
};

export const labMdPath = (slug: string, root = repoRoot) => join(root, 'src', 'content', 'lab', `${slug}.md`);

export const labMdSlugs = (root = repoRoot): string[] => {
  const dir = join(root, 'src', 'content', 'lab');
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.slice(0, -3))
        .sort()
    : [];
};

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;

export const readLabMd = (slug: string, root = repoRoot): { data: Partial<LabFrontmatter>; body: string } | undefined => {
  const path = labMdPath(slug, root);
  if (!existsSync(path)) return undefined;
  const match = readFileSync(path, 'utf8').match(FRONTMATTER);
  if (!match) throw new Error(`src/content/lab/${slug}.md: frontmatter (--- ... ---) not found`);
  return { data: (parse(match[1]) ?? {}) as Partial<LabFrontmatter>, body: match[2] };
};

// Field order follows content-model.md so generated files read the same as the spec.
const FIELD_ORDER: (keyof LabFrontmatter)[] = [
  'date', 'title', 'medium', 'poster', 'tags', 'description', 'video', 'externalUrl', 'repo', 'draft',
];

export const formatLabMd = (data: Partial<LabFrontmatter>, body = ''): string => {
  const ordered: Record<string, unknown> = {};
  for (const key of FIELD_ORDER) if (data[key] !== undefined) ordered[key] = data[key];
  for (const [key, value] of Object.entries(data)) if (!(key in ordered) && value !== undefined) ordered[key] = value;
  return `---\n${stringify(ordered, { lineWidth: 0 }).trimEnd()}\n---\n${body}`;
};

// Existing values always win: a re-run only fills what is missing, so hand edits (title, tags, medium) survive.
export const mergeFrontmatter = (
  existing: Partial<LabFrontmatter> | undefined,
  generated: Partial<LabFrontmatter>,
): Partial<LabFrontmatter> => ({ ...generated, ...(existing ?? {}) });

// --- values lab:add fills in ---------------------------------------------------------------------------------

const unescapeHtml = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The title given to `pnpm new` lives in og:title of lab/<slug>/index.html until the md exists.
export const titleFromIndexHtml = (html: string): string | undefined => {
  const match = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/);
  return match ? unescapeHtml(match[1]) : undefined;
};

// Guess tags from the sketch source (publish-pipeline.md「各ステップの約束」). A starting point: the human edits the md.
const TAG_RULES: { tag: string; test: (src: string, files: string[]) => boolean }[] = [
  { tag: 'threejs', test: (src) => /from\s+['"]three(\/[^'"]*)?['"]/.test(src) },
  { tag: 'webgpu', test: (src, files) => /navigator\.gpu|['"]webgpu['"]/.test(src) || files.some((f) => f.endsWith('.wgsl')) },
  { tag: 'webgl', test: (src) => /getContext\(\s*['"](webgl2?|experimental-webgl)['"]/.test(src) },
  { tag: 'glsl', test: (_src, files) => files.some((f) => /\.(glsl|vert|frag)$/.test(f)) },
  { tag: 'wgsl', test: (_src, files) => files.some((f) => f.endsWith('.wgsl')) },
  { tag: 'canvas2d', test: (src) => /getContext\(\s*['"]2d['"]/.test(src) },
];

export const inferTags = (files: { path: string; content: string }[]): string[] => {
  const src = files.filter((f) => /\.(ts|js|tsx|jsx|mjs)$/.test(f.path)).map((f) => f.content).join('\n');
  const paths = files.map((f) => f.path);
  const tags = TAG_RULES.filter((rule) => rule.test(src, paths)).map((rule) => rule.tag);
  return tags.length > 0 ? tags : ['sketch'];
};

export const inferMedium = (hasIndexHtml: boolean, hasVideo: boolean): LabFrontmatter['medium'] =>
  hasIndexHtml ? 'runtime' : hasVideo ? 'video' : 'image';

// --- <head> of the built page --------------------------------------------------------------------------------

export const SITE_NAME = 'takumifukasawa';

// Rewrites only <title>, og:title and og:description; the script tags (and the JS) are never touched.
export const rewriteHead = (html: string, data: Pick<LabFrontmatter, 'title' | 'description'>): string => {
  let out = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(data.title)} — ${SITE_NAME}</title>`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${escapeHtml(data.title)}$2`);
  out = out.replace(/\s*<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, '');
  if (data.description) {
    out = out.replace(
      /(<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>)/,
      `$1\n    <meta property="og:description" content="${escapeHtml(data.description)}" />`,
    );
  }
  return out;
};

// Whether the built page shows the md title (the `lab head in sync` check).
export const headMatches = (html: string, data: Pick<LabFrontmatter, 'title' | 'description'>): boolean =>
  rewriteHead(html, data) === html;

// Called at the end of lab:build and lab:add. No md yet (before the first lab:add) → keep what pnpm new wrote.
export const applyHeadFromMd = (slug: string, root = repoRoot): boolean => {
  const md = readLabMd(slug, root);
  const page = join(root, 'public', 'lab', slug, 'index.html');
  if (!md?.data.title || !existsSync(page)) return false;
  writeFileSync(page, rewriteHead(readFileSync(page, 'utf8'), { title: md.data.title, description: md.data.description }));
  return true;
};

// --- media/manifest.json -----------------------------------------------------------------------------------

export type MediaEntry = { width: number; height: number; bytes: number; durationSec?: number };
export type Manifest = Record<string, MediaEntry>;

export const manifestPath = (root = repoRoot) => join(root, 'media', 'manifest.json');

export const readManifest = (root = repoRoot): Manifest =>
  existsSync(manifestPath(root)) ? (JSON.parse(readFileSync(manifestPath(root), 'utf8')) as Manifest) : {};

// Keys sorted so diffs stay small and stable.
export const writeManifest = (manifest: Manifest, root = repoRoot) => {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(manifestPath(root)), { recursive: true });
  writeFileSync(manifestPath(root), `${JSON.stringify(sorted, null, 2)}\n`);
};
