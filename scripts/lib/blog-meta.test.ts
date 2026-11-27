// src/lib/blog.ts: the description and og:image a blog post's <head> derives from its body.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { excerpt, firstImagePath } from '../../src/lib/blog.ts';

describe('excerpt', () => {
  test('keeps prose, drops code, images, embeds and Markdown syntax', () => {
    const md = [
      '最終的なデモは[こちら](https://example.com)です。',
      '',
      '![alt](../../assets/blog/x/1.png)',
      '',
      '<div class="embed" data-embed-src="x"><button>▶</button><a href="y">t</a></div>',
      '',
      '## ビルボードとは',
      '',
      '**常にカメラを向いている** `Point\\_Size` のこと。',
      '',
      '```c',
      'void main() {}',
      '```',
    ].join('\n');
    assert.equal(excerpt(md), '最終的なデモはこちらです。 ビルボードとは 常にカメラを向いている Point_Size のこと。');
  });

  test('cuts long text and marks the cut', () => {
    assert.equal(excerpt('あ'.repeat(130), 120), `${'あ'.repeat(120)}…`);
  });
});

describe('firstImagePath', () => {
  test('finds the first Markdown image', () => {
    assert.equal(firstImagePath('text\n\n![a](./a.png)\n\n![b](./b.png)'), './a.png');
    assert.equal(firstImagePath('no images'), undefined);
  });
});
