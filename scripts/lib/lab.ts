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

// A sketch slug: lowercase words joined by "-", no number prefix (decision 0007). It is the directory name,
// the content entry id, the R2 key prefix and the URL, all at once (decision 0002).
//
// Also used to tell sketches apart from the other entries of lab/ (core/, AGENTS.md, .build-meta/). Note that
// `core` matches this pattern, so a caller that must not pick it up has to exclude it another way -- the
// builders do it by requiring index.html, and `pnpm new` by refusing a directory that already exists.
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Slugs that mean "still being made". A sketch lives under one of these while its subject is still moving,
// and is renamed to its real slug at publish time -- because the slug becomes the URL and is permanent from
// then on (decision 0007). `pnpm lab:add` refuses them, so the convention cannot be forgotten into a
// permanent /lab/wip/ (docs/spec/publish-pipeline.md).
export const WORKSPACE_SLUGS = /^wip(-[a-z0-9]+)*$/;

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
