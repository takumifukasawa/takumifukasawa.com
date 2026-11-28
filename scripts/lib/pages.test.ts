// src/lib/pages.ts: splitting the blog and diary lists into pages.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { laterPages, pagePath, paginate } from '../../src/lib/pages.ts';

test('paginate slices pages and knows the last one', () => {
  const items = Array.from({ length: 45 }, (_, i) => i);
  assert.deepEqual(paginate(items, 1, 20), { items: items.slice(0, 20), current: 1, last: 3 });
  assert.deepEqual(paginate(items, 3, 20).items, [40, 41, 42, 43, 44]);
  assert.equal(paginate([], 1, 20).last, 1);
  assert.throws(() => paginate(items, 4, 20));
  assert.throws(() => paginate(items, 0, 20));
});

test('page 1 is the base URL, later pages live under page/', () => {
  assert.equal(pagePath('/blog/', 1), '/blog/');
  assert.equal(pagePath('/blog/', 2), '/blog/page/2/');
});

test('laterPages lists the pages after the first', () => {
  assert.deepEqual(laterPages(45, 20), [2, 3]);
  assert.deepEqual(laterPages(20, 20), []);
  assert.deepEqual(laterPages(0, 20), []);
});
