// scripts/lib/diary.ts: picking the published days out of a vault, copying their images without metadata.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import sharp from 'sharp';
import { stripMetadata, syncSite } from './diary.ts';
import { normalizeKey, pickSource } from '../diary/fetch.ts';
import { imagesWithMetadata } from '../check-dist-images.ts';

// A JPEG that carries a camera, a date and a GPS position, rotated by EXIF (orientation 6 = 90° clockwise).
const photoWithMetadata = () =>
  sharp({ create: { width: 40, height: 20, channels: 3, background: '#c33' } })
    .jpeg()
    .withExif({
      IFD0: { Make: 'TestCam', Model: 'X1' },
      IFD2: { DateTimeOriginal: '2026:01:02 03:04:05' },
      IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '35/1 19/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '139/1 33/1 0/1' },
    })
    .withMetadata({ orientation: 6 })
    .toBuffer();

const tiny = () =>
  sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } })
    .png()
    .toBuffer();

describe('stripMetadata', () => {
  test('drops EXIF (camera, date, GPS) and keeps the photo upright', async () => {
    const input = await photoWithMetadata();
    const before = await sharp(input).metadata();
    assert.ok(before.exif, 'fixture must carry EXIF');
    assert.equal(before.orientation, 6);
    const out = await sharp(await stripMetadata(input, 'p.jpg')).metadata();
    assert.equal(out.exif, undefined);
    assert.equal(out.xmp, undefined);
    assert.equal(out.iptc, undefined);
    assert.equal(out.orientation, undefined);
    // Orientation 6 was baked into the pixels: 40x20 becomes 20x40.
    assert.deepEqual([out.width, out.height], [20, 40]);
  });

  test('refuses image types it cannot clean', async () => {
    await assert.rejects(stripMetadata(Buffer.from(''), 'a.heic'));
  });
});

describe('syncSite', () => {
  let vault: string;
  let out: string;
  before(async () => {
    vault = mkdtempSync(join(tmpdir(), 'vault-'));
    out = mkdtempSync(join(tmpdir(), 'relay-'));
    const day = (ym: string, id: string, text: string) => {
      mkdirSync(join(vault, '01_daily', ym), { recursive: true });
      writeFileSync(join(vault, '01_daily', ym, `${id}.md`), text);
    };
    day('202611', '20261101', '---\npublish: true\n---\n# 20261101\n\n![[Pasted image 1.jpg]]\n\n[[secret note]] %%hidden%%\n');
    day('202611', '20261102', '---\npublish: false\n---\n# 20261102\n\nprivate\n');
    day('202611', '20261103', '# 20261103\n\nno properties\n');
    day('202611', '20261104', '---\npublish: true\n---\n# 20261104\n\n![[old.png]]\n');
    writeFileSync(join(vault, '01_daily', '202611', 'Pasted image 1.jpg'), await photoWithMetadata());
    mkdirSync(join(vault, '99_attachments'));
    writeFileSync(join(vault, '99_attachments', 'old.png'), await tiny());
    writeFileSync(join(vault, '99_attachments', 'unused.png'), await tiny());
    const post = (id: string, text: string) => {
      mkdirSync(join(vault, '11_blog', id), { recursive: true });
      writeFileSync(join(vault, '11_blog', id, `${id.split('/').pop()}.md`), text);
    };
    post(
      'threejs-x',
      '---\ntitle: "Three: x"\ndate: 2020-03-04T00:36:23+09:00\ntags:\n  - three.js\npublish: true\n---\n\nbody ![](shot.png)\n',
    );
    writeFileSync(join(vault, '11_blog', 'threejs-x', 'shot.png'), await tiny());
    post('2021/06/19/133849', '---\ntitle: dated\ndate: 2021-06-19T13:38:49+09:00\ndescription:\npublish: true\n---\ntext\n');
    post('draft-post', '---\ntitle: d\ndate: 2021-01-01\npublish: false\n---\nnot yet\n');
    // Something left over from a previous run (a day that has since been unpublished).
    mkdirSync(join(out, 'daily', '20261102'), { recursive: true });
    writeFileSync(join(out, 'daily', '20261102.md'), 'stale');
    mkdirSync(join(out, '.git'));
    writeFileSync(join(out, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  });
  after(() => {
    rmSync(vault, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  });

  test('writes only published days, removes unpublished ones, keeps .git', async () => {
    assert.deepEqual(await syncSite(vault, out), { daily: ['20261101', '20261104'], blog: ['2021/06/19/133849', 'threejs-x'] });
    assert.deepEqual(readdirSync(join(out, 'daily')).sort(), ['20261101', '20261101.md', '20261104', '20261104.md']);
    assert.ok(existsSync(join(out, '.git', 'HEAD')));
  });

  test('the Markdown is converted and points at the copied images', () => {
    const md = readFileSync(join(out, 'daily', '20261101.md'), 'utf8');
    assert.equal(md, '---\ndate: 2026-11-01\n---\n![](./20261101/Pasted-image-1.jpg)\n\nsecret note\n');
    assert.match(readFileSync(join(out, 'daily', '20261104.md'), 'utf8'), /!\[\]\(\.\/20261104\/old\.png\)/);
  });

  test('only referenced images are copied, and without metadata', async () => {
    assert.deepEqual(readdirSync(join(out, 'daily', '20261104')), ['old.png']);
    const meta = await sharp(readFileSync(join(out, 'daily', '20261101', 'Pasted-image-1.jpg'))).metadata();
    assert.equal(meta.exif, undefined);
  });

  test('blog posts keep their fields (not publish) and their nested ids', () => {
    assert.equal(
      readFileSync(join(out, 'blog', 'threejs-x.md'), 'utf8'),
      '---\ntitle: "Three: x"\ndate: 2020-03-04T00:36:23+09:00\ntags:\n  - three.js\n---\nbody ![](./threejs-x/shot.png)\n',
    );
    assert.ok(existsSync(join(out, 'blog', 'threejs-x', 'shot.png')));
    assert.equal(
      readFileSync(join(out, 'blog', '2021', '06', '19', '133849.md'), 'utf8'),
      '---\ntitle: dated\ndate: 2021-06-19T13:38:49+09:00\n---\ntext\n',
    );
    assert.ok(!existsSync(join(out, 'blog', 'draft-post.md')));
  });

  test('a missing image stops the run before anything is written', async () => {
    writeFileSync(join(vault, '01_daily', '202611', '20261105.md'), '---\npublish: true\n---\n![[nope.png]]\n');
    await assert.rejects(syncSite(vault, out), /nope\.png/);
    assert.ok(existsSync(join(out, 'daily', '20261101.md')), 'previous output must be left as it was');
    rmSync(join(vault, '01_daily', '202611', '20261105.md'));
  });
});

describe('pickSource', () => {
  test('vault, relay repo, or nothing — and nothing is fatal only on Workers Builds', () => {
    assert.deepEqual(pickSource({ OBSIDIAN_VAULT: '/v' }), { kind: 'vault', vault: '/v' });
    assert.deepEqual(pickSource({ SITE_CONTENTS_REPO: 'git@x:y', SITE_CONTENTS_READ_KEY: 'k' }), {
      kind: 'repo',
      repo: 'git@x:y',
      key: 'k',
    });
    assert.deepEqual(pickSource({ SITE_CONTENTS_REPO: 'git@x:y' }), { kind: 'none', fatal: false });
    assert.deepEqual(pickSource({ WORKERS_CI: '1' }), { kind: 'none', fatal: true });
    assert.deepEqual(pickSource({}), { kind: 'none', fatal: false });
  });
});

describe('imagesWithMetadata (the build-time net)', () => {
  test('finds an image that kept its EXIF, passes a stripped one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'dist-'));
    try {
      mkdirSync(join(dir, '_astro'));
      const photo = await photoWithMetadata();
      writeFileSync(join(dir, '_astro', 'kept.jpg'), photo);
      writeFileSync(join(dir, '_astro', 'clean.jpg'), await stripMetadata(photo, 'clean.jpg'));
      const found = await imagesWithMetadata(dir);
      assert.equal(found.length, 1);
      assert.match(found[0]!, /kept\.jpg \(exif/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('normalizeKey (a deploy key pasted into a build variable)', () => {
  const key = [
    '-----BEGIN OPENSSH PRIVATE KEY-----',
    'a'.repeat(70),
    'b'.repeat(70),
    'c'.repeat(12),
    '-----END OPENSSH PRIVATE KEY-----',
    '',
  ].join('\n');
  test('an intact key is unchanged', () => assert.equal(normalizeKey(key), key));
  test('line breaks turned into spaces come back', () => assert.equal(normalizeKey(key.replace(/\n/g, ' ')), key));
  test('line breaks turned into literal \\n come back', () => assert.equal(normalizeKey(key.replace(/\n/g, '\\n')), key));
  test('surrounding whitespace is ignored', () => assert.equal(normalizeKey(`  ${key}  \n\n`), key));
});
