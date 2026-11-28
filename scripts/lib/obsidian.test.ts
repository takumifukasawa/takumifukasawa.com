// scripts/lib/obsidian.ts: Obsidian notes -> plain Markdown for the site.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ConvertError, imageRefs, isPublished, parseNote, safeFileName, toSiteMarkdown } from './obsidian.ts';

describe('parseNote / isPublished', () => {
  test('only an explicit publish: true publishes', () => {
    assert.equal(isPublished(parseNote('---\npublish: true\n---\n# a\n')), true);
    assert.equal(isPublished(parseNote('---\npublish: false\n---\n# a\n')), false);
    assert.equal(isPublished(parseNote('---\npublish: "true"\n---\n# a\n')), false);
    assert.equal(isPublished(parseNote('---\npubish: true\n---\n# a\n')), false);
    assert.equal(isPublished(parseNote('# no frontmatter\n')), false);
  });

  test('the body starts after the frontmatter', () => {
    assert.equal(parseNote('---\npublish: true\n---\n# 20260101\n\ntext\n').body, '# 20260101\n\ntext\n');
  });
});

describe('imageRefs', () => {
  test('finds wiki and Markdown images, skips remote ones, code, and widths used as alt', () => {
    const body = [
      '![[Pasted image 20261128.png]]',
      '![[photo.jpg|300]]',
      '![[photo2.jpg|a cat]]',
      '![alt](sub/pic.webp)',
      '![x](https://example.com/a.png)',
      '`![[in-code.png]]`',
      '```',
      '![[in-fence.png]]',
      '```',
      '![[some note]]',
    ].join('\n');
    assert.deepEqual(
      imageRefs(body).map((r) => [r.target, r.alt]),
      [
        ['Pasted image 20261128.png', ''],
        ['photo.jpg', ''],
        ['photo2.jpg', 'a cat'],
        ['sub/pic.webp', 'alt'],
      ],
    );
  });
});

describe('toSiteMarkdown', () => {
  const url = (t: string) => `./d/${t.split('/').pop()}`;

  test('images point at the copied files, each mapped once', () => {
    assert.equal(toSiteMarkdown('![[a.png|cat]]\n![b](b.jpg)\n', url), '![cat](./d/a.png)\n![b](./d/b.jpg)\n');
  });

  test('links into the vault become plain text', () => {
    assert.equal(toSiteMarkdown('see [[メダリスト]] and [[20250329#感想|this day]].', url), 'see メダリスト and this day.');
  });

  test('comments are dropped, even across lines', () => {
    assert.equal(toSiteMarkdown('a %%secret%% b\n%%\nprivate\nlines\n%%\nc', url), 'a  b\n\nc');
  });

  test('callouts become a quote with a bold title', () => {
    assert.equal(toSiteMarkdown('> [!info] Title\n> body\n> [!note]\n> more', url), '> **Title**\n> body\n>\n> more');
  });

  test('code is left alone', () => {
    const md = '`[[x]]` and\n```\n![[a.png]] %%c%%\n```\n';
    assert.equal(toSiteMarkdown(md, url), md);
  });

  test('embedding another note is refused, not silently dropped', () => {
    assert.throws(() => toSiteMarkdown('![[private note]]', url), ConvertError);
  });

  test('remote images are kept as written', () => {
    assert.equal(toSiteMarkdown('![x](https://example.com/a.png)', url), '![x](https://example.com/a.png)');
  });
});

test('safeFileName', () => {
  assert.equal(safeFileName('Pasted image 20261128123456.png'), 'Pasted-image-20261128123456.png');
  assert.equal(safeFileName('写真 1.JPG'), '1.JPG');
});
