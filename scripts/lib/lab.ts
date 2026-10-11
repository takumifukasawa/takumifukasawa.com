// Shared helpers for the lab scripts (build, checks).
// Functions take `root` (the repo root) so tests can run them against a temporary repo.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const repoRoot = join(import.meta.dirname, '..', '..');
export const labDir = join(repoRoot, 'lab');
export const buildMetaDir = join(labDir, '.build-meta');
export const publicLabDir = join(repoRoot, 'public', 'lab');
// Archived sketches (decision 0006). Source only: never built, never deployed, never a content entry.
export const labArchivesDir = join(repoRoot, 'lab-archives');

export const SLUG_PATTERN = /^\d{3}-[a-z0-9]+(-[a-z0-9]+)*$/;

// Which directory, if any, has already taken a 3-digit number. Returns e.g. "lab-archives/001-mirror-sphere".
//
// Numbers are allocated once and never reused, including by shelved sketches (decision 0006). The
// lab-archives directory name *is* the ledger of that: moving lab/001-x/ to lab-archives/ must not free 001, or
// git history ends up with two different things called 001 and reviving the shelved one collides.
export const numberOwner = (number: string, root = repoRoot): string | undefined => {
  for (const place of ['lab', 'lab-archives']) {
    const dir = join(root, place);
    if (!existsSync(dir)) continue;
    const hit = readdirSync(dir)
      .filter((name) => SLUG_PATTERN.test(name))
      .sort()
      .find((name) => name.startsWith(`${number}-`));
    if (hit) return `${place}/${hit}`;
  }
  return undefined;
};

// Sketch slugs that have a web build (index.html). Directories without index.html
// (Houdini VEX, Python tools, ...) are valid sketches but are never built (decision 0003).
export const webSketchSlugs = (root = repoRoot): string[] => {
  const dir = join(root, 'lab');
  return existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => SLUG_PATTERN.test(name))
        .filter((name) => existsSync(join(dir, name, 'index.html')))
        .sort()
    : [];
};

// Source files of lab/<slug>/ as git sees them: tracked + untracked-but-not-ignored.
// Ignored files (.DS_Store, node_modules/, .vite/) never count, so the hash matches a fresh clone.
export const sketchFiles = (slug: string, root = repoRoot): string[] => {
  const prefix = `lab/${slug}/`;
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', prefix], {
    cwd: root,
    encoding: 'utf8',
  });
  return out
    .split('\0')
    .filter((path) => path !== '' && existsSync(join(root, path)))
    .map((path) => path.slice(prefix.length))
    .sort();
};

// Content hash of every source file of lab/<slug>/ (paths + contents, order-independent).
// Compared by the `lab build in sync` check against lab/.build-meta/<slug>.json.
export const sourceHash = (slug: string, root = repoRoot): string => {
  const dir = join(root, 'lab', slug);
  const hash = createHash('sha256');
  for (const file of sketchFiles(slug, root)) {
    hash.update(file).update('\0');
    hash.update(readFileSync(join(dir, file))).update('\0');
  }
  return hash.digest('hex');
};

export type BuildMeta = { sourceHash: string; builtAt: string };

export const buildMetaPath = (slug: string, root = repoRoot) => join(root, 'lab', '.build-meta', `${slug}.json`);
