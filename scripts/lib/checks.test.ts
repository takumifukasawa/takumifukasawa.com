import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { checkLabBuildInSync, checkLabShellEmbedded, checkNoLargeFiles } from './checks.ts';
import { sourceHash } from './lab.ts';

let root: string;

const write = (path: string, content: string | Buffer) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });

const SHELL = '<script src="/_shell.js" defer></script>';

// A sketch whose source is built and recorded in build-meta, as `pnpm lab:build` leaves it.
const builtSketch = (slug: string) => {
  write(`lab/${slug}/index.html`, `<html>${SHELL}</html>`);
  write(`lab/${slug}/main.ts`, 'console.log(1);');
  write(`public/lab/${slug}/index.html`, `<html>${SHELL}</html>`);
  write(`lab/.build-meta/${slug}.json`, JSON.stringify({ sourceHash: sourceHash(slug, root), builtAt: 'x' }));
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'checks-test-'));
  git('init', '-q');
  write('.gitignore', '.DS_Store\nlab/*/.vite/\n');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('lab build in sync', () => {
  test('passes when the output was built from the current source', () => {
    builtSketch('alpha');
    assert.deepEqual(checkLabBuildInSync(root), []);
  });

  test('fails when the source changed after the build', () => {
    builtSketch('alpha');
    write('lab/alpha/main.ts', 'console.log(2);');
    const problems = checkLabBuildInSync(root);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /pnpm lab:build alpha/);
  });

  test('fails when a new source file was added after the build', () => {
    builtSketch('alpha');
    write('lab/alpha/frag.glsl', 'void main() {}');
    assert.equal(checkLabBuildInSync(root).length, 1);
  });

  test('ignores gitignored files (.DS_Store, .vite/) so a fresh clone gives the same hash', () => {
    builtSketch('alpha');
    write('lab/alpha/.DS_Store', 'finder');
    write('lab/alpha/.vite/deps.json', '{}');
    assert.deepEqual(checkLabBuildInSync(root), []);
  });

  test('fails when a sketch was never built', () => {
    write('lab/alpha/index.html', '<html></html>');
    assert.match(checkLabBuildInSync(root)[0] ?? '', /ビルドされていない/);
  });

  test('fails when an output has no source (renamed slug)', () => {
    write('public/lab/stale/index.html', `<html>${SHELL}</html>`);
    assert.match(checkLabBuildInSync(root)[0] ?? '', /public\/lab\/stale/);
  });

  test('skips sketches without index.html (non-web sketches, decision 0003)', () => {
    write('lab/vex/main.vex', '@P.y += 1;');
    assert.deepEqual(checkLabBuildInSync(root), []);
  });
});

describe('lab shell embedded', () => {
  test('passes when every output embeds /_shell.js', () => {
    write('public/lab/alpha/index.html', `<html data-shell="none"><head>${SHELL}</head></html>`);
    assert.deepEqual(checkLabShellEmbedded(root), []);
  });

  test('fails when an output lost the tag', () => {
    write('public/lab/alpha/index.html', '<html><head></head></html>');
    assert.match(checkLabShellEmbedded(root)[0] ?? '', /alpha/);
  });
});

describe('no large files', () => {
  const big = Buffer.alloc(3 * 1024 * 1024);

  test('fails on a staged file over 2 MB', () => {
    write('public/lab/alpha/texture.png', big);
    git('add', '-A');
    assert.match(checkNoLargeFiles(root)[0] ?? '', /texture\.png: 3\.0 MB/);
  });

  test('passes when the file is in the allowlist', () => {
    write('public/lab/alpha/texture.png', big);
    write('scripts/large-files-allow.txt', '# needed offline\npublic/lab/alpha/texture.png\n');
    git('add', '-A');
    assert.deepEqual(checkNoLargeFiles(root), []);
  });

  test('ignores files that are not in the index', () => {
    write('captures/clip.mp4', big);
    assert.deepEqual(checkNoLargeFiles(root), []);
  });
});
