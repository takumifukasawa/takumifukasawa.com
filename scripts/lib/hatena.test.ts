import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanHtml, codeLanguage, formatBlogMd, gistIds, imageUrls, parseExport, toMarkdown, type Gist } from './hatena.ts';

const EXPORT = `AUTHOR: takumifukasawa
TITLE: 【three.js】ビルボード
BASENAME: threejs-billboard-shader
STATUS: Publish
ALLOW COMMENTS: 1
CONVERT BREAKS: 0
DATE: 04/02/2020 23:00:06
CATEGORY: WebGL
CATEGORY: threejs
-----
BODY:
<p>本文</p>
-----
EXCERPT:
概要
-----
--------
AUTHOR: takumifukasawa
TITLE: 下書き
BASENAME: 2021/06/19/133849
STATUS: Draft
DATE: 06/19/2021 13:38:49
-----
BODY:
<p>x</p>
-----
--------
`;

describe('parseExport', () => {
  test('reads fields, categories, sections and converts the date to JST ISO', () => {
    const [a, b] = parseExport(EXPORT);
    assert.deepEqual(a, {
      title: '【three.js】ビルボード',
      basename: 'threejs-billboard-shader',
      status: 'Publish',
      date: '2020-04-02T23:00:06+09:00',
      categories: ['WebGL', 'threejs'],
      excerpt: '概要',
      body: '<p>本文</p>',
    });
    assert.equal(b.status, 'Draft');
    assert.equal(b.basename, '2021/06/19/133849');
  });
});

const noGists = new Map<string, Gist>();
const clean = (html: string, gists = noGists) => cleanHtml(html, { image: (u) => `./img/${u.split('/').pop()}`, gists });

describe('cleanHtml', () => {
  test('drops keyword links but keeps their text', () => {
    assert.equal(clean('<a class="keyword" href="https://d.hatena.ne.jp/keyword/VSCode">VSCode</a>'), 'VSCode');
  });

  test('turns a link card into a link and drops the citation after it', () => {
    const out = clean(
      '<p><iframe src="https://hatenablog-parts.com/embed?url=https%3A%2F%2Fgithub.com%2Fa%2Fb" title="A &amp; B" class="embed-card"></iframe><cite class="hatena-citation"><a href="https://github.com/a/b">github.com</a></cite></p>',
    );
    assert.equal(out, '<p><a href="https://github.com/a/b">A &amp; B</a></p>');
  });

  test('points fotolife images at the local copy and ignores Hatena syntax as alt', () => {
    const out = clean(
      '<span itemscope itemtype="http://schema.org/Photograph"><img src="https://cdn-ak.f.st-hatena.com/images/fotolife/t/takumifukasawa/20200330/20200330235049.png" alt="f:id:takumifukasawa:20200330235049p:plain" title=""></span>',
    );
    assert.equal(out, '<img src="./img/20200330235049.png" alt="">');
  });

  test('rewrites links between migrated entries to their new path', () => {
    assert.equal(
      clean('<a href="https://takumifukasawa.hatenablog.com/entry/learning-vae-sample">x</a>'),
      '<a href="/blog/learning-vae-sample/">x</a>',
    );
    assert.equal(
      clean('<a href="https://takumifukasawa.hatenablog.com/entry/2021/06/19/133849#h">x</a>'),
      '<a href="/blog/2021/06/19/133849/#h">x</a>',
    );
  });

  test('inlines a gist as code and removes every script', () => {
    const gists = new Map<string, Gist>([['abc123', { files: [{ filename: 'a.js', language: 'JavaScript', content: 'a < b' }] }]]);
    const out = clean('<script src="https://gist.github.com/u/abc123.js"></script><script async src="https://x/y.js"></script>', gists);
    assert.equal(
      out,
      '<pre class="code lang-javascript">a &lt; b</pre>\n<p><a href="https://gist.github.com/u/abc123">https://gist.github.com/u/abc123</a></p>',
    );
  });

  test('removes the generated table of contents', () => {
    assert.equal(clean('<ul class="table-of-contents"><li><a href="#a">a</a><ul><li>b</li></ul></li></ul>\n<h2>a</h2>'), '<h2>a</h2>');
  });
});

describe('imageUrls / gistIds', () => {
  test('collect unique references', () => {
    const img = 'https://cdn-ak.f.st-hatena.com/images/fotolife/t/takumifukasawa/1/1.png';
    assert.deepEqual(imageUrls(`<img src="${img}"><img src="${img}">`), [img]);
    assert.deepEqual(gistIds('<script src="https://gist.github.com/u/ab12.js"></script>'), ['ab12']);
  });
});

describe('codeLanguage', () => {
  test('reads Hatena code classes', () => {
    assert.equal(codeLanguage('code lang-javascript'), 'javascript');
    assert.equal(codeLanguage('code javascript:webpack.common.js'), 'javascript');
    assert.equal(codeLanguage('code lang-cs'), 'csharp');
    assert.equal(codeLanguage('code'), '');
  });
});

describe('toMarkdown', () => {
  test('keeps code text without the highlight spans, fenced with the language', () => {
    const md = toMarkdown(
      '<pre class="code lang-c" data-lang="c"><span class="synType">float</span> a = <span class="synConstant">1.0</span>;\n</pre>',
    );
    assert.equal(md, '```c\nfloat a = 1.0;\n```');
  });
});

describe('formatBlogMd', () => {
  test('writes the frontmatter', () => {
    const [entry] = parseExport(EXPORT);
    assert.equal(
      formatBlogMd(entry, '本文'),
      '---\ntitle: "【three.js】ビルボード"\ndate: 2020-04-02T23:00:06+09:00\ntags: ["WebGL", "threejs"]\ndescription: "概要"\n---\n\n本文\n',
    );
  });
});

describe('embeds', () => {
  test('a CodePen fallback paragraph becomes a click-to-load embed', () => {
    const out = clean(
      '<p class="codepen" data-height="265" data-theme-id="dark" data-default-tab="js,result" data-user="u" data-slug-hash="abc" data-pen-title="A &quot;pen&quot;"><span>See the Pen</span></p>',
    );
    assert.equal(
      out,
      '<div class="embed" data-embed-src="https://codepen.io/u/embed/abc?default-tab=js%2Cresult&amp;theme-id=dark" style="height: 265px">' +
        '<button type="button" aria-label="A &quot;pen&quot; を読み込む">▶</button>' +
        '<a href="https://codepen.io/u/pen/abc" target="_blank" rel="noopener">A &quot;pen&quot;</a></div>',
    );
  });

  test('CodePen and YouTube iframes become embeds; YouTube loads from youtube-nocookie', () => {
    const pen = clean(
      '<iframe id="cp_embed_x" src="https://codepen.io/u/embed/preview/x?height=300&amp;default-tabs=js,result&amp;host=https://codepen.io" title="T" class="cp_embed_iframe"></iframe>',
    );
    assert.match(
      pen,
      /^<div class="embed" data-embed-src="https:\/\/codepen\.io\/u\/embed\/x\?default-tab=js%2Cresult&amp;theme-id=dark" style="height: 300px">/,
    );
    const video = clean(
      '<iframe width="480" height="270" src="https://www.youtube.com/embed/Ad6ABt_Vd5Y?feature=oembed" allowfullscreen></iframe>',
    );
    assert.match(video, /data-embed-src="https:\/\/www\.youtube-nocookie\.com\/embed\/Ad6ABt_Vd5Y\?autoplay=1"/);
    assert.match(video, /style="aspect-ratio: 16 \/ 9"/);
    assert.match(video, /href="https:\/\/www\.youtube\.com\/watch\?v=Ad6ABt_Vd5Y"/);
  });

  test('the embed survives the Markdown conversion as HTML', () => {
    const html = clean('<p class="codepen" data-user="u" data-slug-hash="abc" data-pen-title="t"></p>');
    assert.equal(toMarkdown(html), html);
  });
});

describe('emphasis next to Japanese punctuation', () => {
  test('keeps the HTML tag when ** would not close', () => {
    assert.equal(toMarkdown('<p><strong>3D空間（板ポリ）</strong>を指す</p>'), '<strong>3D空間（板ポリ）</strong>を指す');
  });
  test('uses ** otherwise', () => {
    assert.equal(toMarkdown('<p>これは<strong>常に向く</strong>もの</p>'), 'これは**常に向く**もの');
  });
});
