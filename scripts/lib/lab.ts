// Shared helpers for the lab scripts (build, checks).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const repoRoot = join(import.meta.dirname, '..', '..');
export const labDir = join(repoRoot, 'lab');
export const buildMetaDir = join(labDir, '.build-meta');
export const publicLabDir = join(repoRoot, 'public', 'lab');

export const SLUG_PATTERN = /^\d{3}-[a-z0-9]+(-[a-z0-9]+)*$/;

// Directories inside lab/<slug>/ that are not source (generated or installed).
const IGNORED_DIRS = new Set(['node_modules', '.vite', 'dist']);

// Sketch slugs that have a web build (index.html). Directories without index.html
// (Houdini VEX, Python tools, ...) are valid sketches but are never built (decision 0003).
export const webSketchSlugs = (): string[] =>
  existsSync(labDir)
    ? readdirSync(labDir)
        .filter((name) => SLUG_PATTERN.test(name))
        .filter((name) => existsSync(join(labDir, name, 'index.html')))
        .sort()
    : [];

const listFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) return IGNORED_DIRS.has(entry.name) ? [] : listFiles(join(dir, entry.name));
    return entry.isFile() ? [join(dir, entry.name)] : [];
  });

// Content hash of every source file of lab/<slug>/ (paths + contents, order-independent).
// Compared by the `lab build in sync` check against lab/.build-meta/<slug>.json.
export const sourceHash = (slug: string): string => {
  const dir = join(labDir, slug);
  const hash = createHash('sha256');
  for (const file of listFiles(dir).map((f) => relative(dir, f)).sort()) {
    hash.update(file).update('\0');
    hash.update(readFileSync(join(dir, file))).update('\0');
  }
  return hash.digest('hex');
};

export type BuildMeta = { sourceHash: string; builtAt: string };

export const buildMetaPath = (slug: string) => join(buildMetaDir, `${slug}.json`);
