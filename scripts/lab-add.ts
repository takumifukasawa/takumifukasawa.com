// pnpm lab:add <NNN-slug> [--video <mp4>] [--poster <image>] [--title "<title>"] [--dry-run] [--no-push]
//
// Publishes one sketch (docs/spec/publish-pipeline.md「定常フロー」):
//   1. build lab/<slug>/ into public/lab/<slug>/ (only if it has index.html)
//   2. re-encode the mp4 (H.264 / yuv420p / no audio) and make poster.webp (frame from the middle, or --poster)
//   3. put both to R2 as lab/<slug>/{clip.mp4,poster.webp}; keys that already exist are skipped (immutable)
//   4. add them to media/manifest.json, write src/content/lab/<slug>.md (existing values are kept)
//   5. rewrite <title> / OGP of public/lab/<slug>/index.html from the md (decision 0004)
//   6. git commit, then push (--no-push stops before the push)
// Re-running with the same arguments is safe. --dry-run touches neither R2, the repo, nor git.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  applyHeadFromMd, formatLabMd, inferMedium, inferTags, labMdPath, mergeFrontmatter, readLabMd, readManifest,
  titleFromIndexHtml, writeManifest, type LabFrontmatter, type MediaEntry,
} from './lib/content.ts';
import { labDir, repoRoot, sketchFiles, SLUG_PATTERN } from './lib/lab.ts';
import { encodeVideo, extractFrame, probeVideo, toWebp } from './lib/media.ts';
import { createR2, objectExists, putObject, type R2 } from './lib/r2.ts';

const fail = (message: string): never => {
  console.error(`pnpm lab:add: ${message}`);
  process.exit(1);
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    video: { type: 'string' },
    poster: { type: 'string' },
    title: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    'no-push': { type: 'boolean', default: false },
  },
});
const slug = positionals[0];
const dryRun = values['dry-run'];
if (!slug || positionals.length > 1) {
  fail('usage: pnpm lab:add <NNN-slug> [--video <mp4>] [--poster <image>] [--title "<title>"] [--dry-run] [--no-push]');
}
if (!SLUG_PATTERN.test(slug)) fail(`slug must look like 001-flow-field: ${slug}`);
if (!values.video && !values.poster) fail('give --video <mp4> (poster is taken from it) or --poster <image>, or both');
for (const path of [values.video, values.poster]) if (path && !existsSync(path)) fail(`file not found: ${path}`);

const sketchDir = join(labDir, slug);
const indexHtml = join(sketchDir, 'index.html');
const hasIndexHtml = existsSync(indexHtml);
const existingMd = readLabMd(slug);
const title =
  existingMd?.data.title ?? values.title ?? (hasIndexHtml ? titleFromIndexHtml(readFileSync(indexHtml, 'utf8')) : undefined);
if (!title) fail(`no title: lab/${slug}/index.html has no og:title and there is no md yet. Pass --title "<title>"`);

// Fail on a missing / incomplete .env before spending minutes on encoding.
let r2: R2 | undefined;
if (!dryRun) {
  try {
    r2 = createR2(join(repoRoot, '.env'));
  } catch (error) {
    fail((error as Error).message);
  }
}

// 1. build
if (hasIndexHtml && !dryRun) {
  const result = spawnSync('node', [join(import.meta.dirname, 'lab-build.ts'), slug], { stdio: 'inherit' });
  if (result.status !== 0) fail(`build failed. Fix it and re-run (nothing was uploaded yet).`);
}

// 2. encode
const work = mkdtempSync(join(tmpdir(), `lab-add-${slug}-`));
type Upload = { key: string; file: string; contentType: string; entry: MediaEntry };
const uploads: Upload[] = [];
try {
  let video: Upload | undefined;
  if (values.video) {
    const file = join(work, 'clip.mp4');
    console.log('encoding mp4 ...');
    encodeVideo(values.video, file);
    video = { key: `lab/${slug}/clip.mp4`, file, contentType: 'video/mp4', entry: probeVideo(file) };
    uploads.push(video);
  }
  const posterFile = join(work, 'poster.webp');
  let posterSource = values.poster;
  if (!posterSource && video) {
    posterSource = join(work, 'frame.png');
    extractFrame(video.file, video.entry.durationSec ?? 0, posterSource);
  }
  uploads.push({ key: `lab/${slug}/poster.webp`, file: posterFile, contentType: 'image/webp', entry: await toWebp(posterSource!, posterFile) });

  // 3. upload (existing keys are never overwritten)
  const manifest = readManifest();
  for (const upload of uploads) {
    const mb = (upload.entry.bytes / 1024 / 1024).toFixed(2);
    const size = `${upload.entry.width}x${upload.entry.height}, ${mb} MB`;
    if (dryRun) {
      console.log(`[dry-run] would put ${upload.key} (${size})`);
    } else if (await objectExists(r2!, upload.key)) {
      console.log(`skip ${upload.key}: already in R2 (keys are immutable; the existing object is kept)`);
    } else {
      await putObject(r2!, upload.key, upload.file, upload.contentType);
      console.log(`put  ${upload.key} (${size})`);
    }
    // Keep a recorded entry: it describes what is actually in R2.
    manifest[upload.key] ??= upload.entry;
  }

  // 4. md
  const sourceFiles = existsSync(sketchDir)
    ? sketchFiles(slug).map((path) => ({
        path,
        content: /\.(ts|js|tsx|jsx|mjs)$/.test(path) ? readFileSync(join(sketchDir, path), 'utf8') : '',
      }))
    : [];
  const generated: Partial<LabFrontmatter> = {
    date: new Date().toLocaleDateString('sv-SE'), // today, YYYY-MM-DD in local time
    title,
    medium: inferMedium(hasIndexHtml, Boolean(video)),
    poster: `lab/${slug}/poster.webp`,
    tags: inferTags(sourceFiles),
    ...(video ? { video: video.key } : {}),
    ...(existsSync(sketchDir) ? { repo: repoUrl(slug) } : {}),
  };
  const md = formatLabMd(mergeFrontmatter(existingMd?.data, generated), existingMd?.body ?? '');

  if (dryRun) {
    console.log(`\n[dry-run] src/content/lab/${slug}.md:\n${md}`);
    console.log('[dry-run] media/manifest.json entries:');
    for (const upload of uploads) console.log(`  ${upload.key}: ${JSON.stringify(manifest[upload.key])}`);
  } else {
    writeManifest(manifest);
    mkdirSync(dirname(labMdPath(slug)), { recursive: true });
    writeFileSync(labMdPath(slug), md);
    // 5. head
    if (applyHeadFromMd(slug)) console.log(`rewrote <title> / OGP of public/lab/${slug}/index.html from the md`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

// 6. git
if (!dryRun) {
  const paths = [`lab/${slug}`, `public/lab/${slug}`, `lab/.build-meta/${slug}.json`, 'media/manifest.json', `src/content/lab/${slug}.md`]
    .filter((p) => existsSync(join(repoRoot, p)));
  git('add', '--', ...paths);
  const staged = execFileSync('git', ['diff', '--cached', '--name-only', '--', ...paths], { cwd: repoRoot, encoding: 'utf8' }).trim();
  if (staged === '') {
    console.log('nothing to commit (already published)');
  } else {
    git('commit', '-m', `lab: add ${slug}`, '--', ...paths);
    if (values['no-push']) console.log('committed (not pushed: --no-push). Push with: git push');
    else git('push');
  }
}

// Post text for X (the video is uploaded to X directly; the link goes in the text).
console.log(`\n--- post ---\n${title}\nhttps://takumifukasawa.com/lab/${slug}/\n------------`);
if (!dryRun) console.log('Share the link only after the poster is in R2 (it is now): X caches the card forever.');

function git(...args: string[]) {
  const result = spawnSync('git', args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) fail(`git ${args[0]} failed. R2 and the files are already updated; fix and run git ${args[0]} by hand.`);
}

function repoUrl(s: string): string {
  const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repoRoot, encoding: 'utf8' }).trim();
  const base = remote.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
  return `${base}/tree/main/lab/${s}`;
}
