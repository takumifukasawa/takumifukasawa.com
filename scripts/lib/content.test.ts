import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { checkLabHeadInSync, checkMediaKeysResolve } from './checks.ts';
import {
  applyHeadFromMd, formatLabMd, headMatches, inferMedium, inferTags, mergeFrontmatter, readLabMd, rewriteHead,
  titleFromIndexHtml,
} from './content.ts';

const PAGE = `<head>
    <title>Old — takumifukasawa</title>
    <meta property="og:title" content="Old" />
    <meta property="og:type" content="website" />
    <script src="/_shell.js" defer></script>
  </head><body><script type="module" src="./assets/index-x.js"></script></body>`;

describe('rewriteHead', () => {
  test('rewrites <title> and og:title, escaping HTML', () => {
    const out = rewriteHead(PAGE, { title: 'Flow & "curl"' });
    assert.match(out, /<title>Flow &amp; &quot;curl&quot; — takumifukasawa<\/title>/);
    assert.match(out, /<meta property="og:title" content="Flow &amp; &quot;curl&quot;" \/>/);
  });

  test('never touches the script tags', () => {
    const out = rewriteHead(PAGE, { title: 'New', description: 'd' });
    assert.ok(out.includes('<script src="/_shell.js" defer></script>'));
    assert.ok(out.includes('<script type="module" src="./assets/index-x.js"></script>'));
  });

  test('adds, replaces and removes og:description', () => {
    const withDesc = rewriteHead(PAGE, { title: 'New', description: 'first' });
    assert.match(withDesc, /og:description" content="first"/);
    const replaced = rewriteHead(withDesc, { title: 'New', description: 'second' });
    assert.equal(replaced.match(/og:description/g)?.length, 1);
    assert.match(replaced, /content="second"/);
    assert.doesNotMatch(rewriteHead(replaced, { title: 'New' }), /og:description/);
  });

  test('is idempotent, so headMatches holds right after a rewrite', () => {
    const data = { title: 'New', description: 'd' };
    const once = rewriteHead(PAGE, data);
    assert.equal(rewriteHead(once, data), once);
    assert.ok(headMatches(once, data));
    assert.ok(!headMatches(PAGE, data));
  });
});

describe('md', () => {
  test('existing values win on merge (hand edits survive a re-run)', () => {
    const merged = mergeFrontmatter(
      { title: 'Edited', tags: ['density'], medium: 'video' },
      { title: 'Generated', tags: ['canvas2d'], medium: 'runtime', poster: 'lab/001-a/poster.webp' },
    );
    assert.deepEqual(merged, { title: 'Edited', tags: ['density'], medium: 'video', poster: 'lab/001-a/poster.webp' });
  });

  test('formats in content-model order and round-trips through YAML', () => {
    const md = formatLabMd({ tags: ['glsl'], title: 'A: "quoted"', date: '2026-10-08', medium: 'runtime', poster: 'lab/001-a/poster.webp' });
    assert.match(md, /^---\ndate: 2026-10-08\ntitle: /);
    const root = mkdtempSync(join(tmpdir(), 'content-test-'));
    try {
      mkdirSync(join(root, 'src/content/lab'), { recursive: true });
      writeFileSync(join(root, 'src/content/lab/001-a.md'), md);
      assert.equal(readLabMd('001-a', root)?.data.title, 'A: "quoted"');
      assert.equal(readLabMd('001-a', root)?.data.date, '2026-10-08');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('reads the pnpm new title from og:title', () => {
    assert.equal(titleFromIndexHtml('<meta property="og:title" content="Flow &amp; noise" />'), 'Flow & noise');
  });
});

describe('inferred fields', () => {
  test('tags from imports, context types and shader files', () => {
    assert.deepEqual(inferTags([{ path: 'main.ts', content: "import * as THREE from 'three';" }, { path: 'frag.glsl', content: '' }]), ['threejs', 'glsl']);
    assert.deepEqual(inferTags([{ path: 'main.ts', content: "canvas.getContext('2d')" }]), ['canvas2d']);
    assert.deepEqual(inferTags([{ path: 'main.ts', content: 'await navigator.gpu.requestAdapter()' }, { path: 'a.wgsl', content: '' }]), ['webgpu', 'wgsl']);
  });

  test('falls back to one tag, because tags must not be empty', () => {
    assert.deepEqual(inferTags([]), ['sketch']);
  });

  test('medium', () => {
    assert.equal(inferMedium(true, true), 'runtime');
    assert.equal(inferMedium(false, true), 'video');
    assert.equal(inferMedium(false, false), 'image');
  });
});

describe('lab head in sync / media keys resolve', () => {
  let root: string;
  const write = (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const md = (extra = '') =>
    `---\ndate: 2026-10-08\ntitle: New\nmedium: runtime\nposter: lab/001-a/poster.webp\ntags: [canvas2d]\n${extra}---\n`;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'content-check-test-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('head: fails until the page is rewritten from the md, then passes', () => {
    write('src/content/lab/001-a.md', md());
    write('public/lab/001-a/index.html', PAGE);
    assert.match(checkLabHeadInSync(root)[0] ?? '', /pnpm lab:build 001-a/);
    assert.ok(applyHeadFromMd('001-a', root));
    assert.deepEqual(checkLabHeadInSync(root), []);
  });

  test('head: a sketch without md (before lab:add) is not checked', () => {
    write('public/lab/001-a/index.html', PAGE);
    assert.deepEqual(checkLabHeadInSync(root), []);
  });

  test('media: every poster / video key must be in the manifest', () => {
    write('src/content/lab/001-a.md', md('video: lab/001-a/clip.mp4\n'));
    write('media/manifest.json', JSON.stringify({ 'lab/001-a/poster.webp': { width: 1, height: 1, bytes: 1 } }));
    const problems = checkMediaKeysResolve(root);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /video: "lab\/001-a\/clip\.mp4"/);
  });
});
