// The redirect script pasted into Hatena (scripts/hatena/head.html), run against a fake page.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { repoRoot } from './lab.ts';

const script = readFileSync(join(repoRoot, 'scripts', 'hatena', 'head.html'), 'utf8').match(/<script>([\s\S]*?)<\/script>/)![1];

const run = (pathname: string, hash = '', canonical = true) => {
  const link = { rel: 'canonical', href: 'https://takumifukasawa.hatenablog.com/x' };
  const appended: unknown[] = [];
  let replacedWith = '';
  runInNewContext(script, {
    location: { pathname, hash, replace: (url: string) => (replacedWith = url) },
    document: {
      querySelector: () => (canonical ? link : null),
      createElement: () => ({ rel: '', href: '' }),
      head: { appendChild: (el: unknown) => appended.push(el) },
    },
  });
  return { replacedWith, canonical: canonical ? link.href : (appended[0] as { href: string })?.href };
};

describe('hatena head redirect', () => {
  test('an entry goes to the same basename under /blog/', () => {
    assert.deepEqual(run('/entry/threejs-billboard-shader'), {
      replacedWith: 'https://takumifukasawa.com/blog/threejs-billboard-shader/',
      canonical: 'https://takumifukasawa.com/blog/threejs-billboard-shader/',
    });
  });

  test('date basenames and hashes are kept', () => {
    assert.equal(run('/entry/2021/06/19/133849', '#h2').replacedWith, 'https://takumifukasawa.com/blog/2021/06/19/133849/#h2');
  });

  test('any other page goes to /blog/, and a missing canonical is added', () => {
    assert.deepEqual(run('/archive/category/Unity', '', false), {
      replacedWith: 'https://takumifukasawa.com/blog/',
      canonical: 'https://takumifukasawa.com/blog/',
    });
  });
});
