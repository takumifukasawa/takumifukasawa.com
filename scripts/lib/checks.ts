// Repo checks registered in .harness/checks.sh (via scripts/check.ts). Each returns a list of problems;
// an empty list means pass. Messages say how to fix (AGENTS.md: 検査のエラー文に修復手順を書く).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { headMatches, labMdSlugs, readLabMd, readManifest } from './content.ts';
import { buildMetaPath, repoRoot, SLUG_PATTERN, sourceHash, webSketchSlugs, type BuildMeta } from './lab.ts';

// public/lab/<slug>/ was built from the current lab/<slug>/ (docs/spec/publish-pipeline.md「再ビルド」).
export const checkLabBuildInSync = (root = repoRoot): string[] => {
  const problems: string[] = [];
  const rebuild = (slug: string) => `pnpm lab:build ${slug} して public/lab/${slug}/ と lab/.build-meta/${slug}.json をコミットする`;

  for (const slug of webSketchSlugs(root)) {
    const metaPath = buildMetaPath(slug, root);
    if (!existsSync(join(root, 'public', 'lab', slug, 'index.html')) || !existsSync(metaPath)) {
      problems.push(`${slug}: ビルドされていない。${rebuild(slug)}`);
      continue;
    }
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as BuildMeta;
    if (meta.sourceHash !== sourceHash(slug, root)) {
      problems.push(`${slug}: 最後のビルド（${meta.builtAt}）の後に lab/${slug}/ が変わった。${rebuild(slug)}`);
    }
  }

  const publicLab = join(root, 'public', 'lab');
  if (existsSync(publicLab)) {
    const sources = new Set(webSketchSlugs(root));
    for (const slug of readdirSync(publicLab)) {
      if (!sources.has(slug)) {
        problems.push(
          `public/lab/${slug}/: 対応する lab/${slug}/index.html が無い。slug を変えたなら古い成果物を git rm する（公開済み URL が消える点に注意）`,
        );
      }
    }
  }
  return problems;
};

// Every built sketch embeds /_shell.js (decision 0004). Opting out is data-shell="none" on <html>, not removing the tag.
const SHELL_TAG = /<script\s+src="\/_shell\.js"\s+defer\s*><\/script>/;

export const checkLabShellEmbedded = (root = repoRoot): string[] => {
  const publicLab = join(root, 'public', 'lab');
  if (!existsSync(publicLab)) return [];
  return readdirSync(publicLab)
    .filter((slug) => SLUG_PATTERN.test(slug) && existsSync(join(publicLab, slug, 'index.html')))
    .filter((slug) => !SHELL_TAG.test(readFileSync(join(publicLab, slug, 'index.html'), 'utf8')))
    .map(
      (slug) =>
        `public/lab/${slug}/index.html に <script src="/_shell.js" defer></script> が無い。lab/${slug}/index.html に戻して pnpm lab:build ${slug}。` +
        '導線を消したいなら <html data-shell="none"> にする（決定 0004）',
    );
};

// No file over the limit in the git index, except the allowlist (docs/spec/publish-pipeline.md).
export const LARGE_FILE_LIMIT = 2 * 1024 * 1024;
export const LARGE_FILES_ALLOW = 'scripts/large-files-allow.txt';

export const checkNoLargeFiles = (root = repoRoot, limit = LARGE_FILE_LIMIT): string[] => {
  const allowPath = join(root, LARGE_FILES_ALLOW);
  const allowed = new Set(
    existsSync(allowPath)
      ? readFileSync(allowPath, 'utf8')
          .split('\n')
          .map((line) => line.replace(/#.*/, '').trim())
          .filter(Boolean)
      : [],
  );

  // Sizes of the staged blobs (what would be committed), not of the working tree.
  const entries = execFileSync('git', ['ls-files', '-s', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .map((line) => {
      const [info, path] = line.split('\t');
      return { hash: info.split(' ')[1], path };
    });
  if (entries.length === 0) return [];
  const sizes = execFileSync('git', ['cat-file', '--batch-check=%(objectsize)'], {
    cwd: root,
    encoding: 'utf8',
    input: entries.map((e) => e.hash).join('\n') + '\n',
  })
    .trim()
    .split('\n')
    .map(Number);

  return entries
    .map((e, i) => ({ ...e, size: sizes[i] }))
    .filter((e) => e.size > limit && !allowed.has(e.path))
    .map(
      (e) =>
        `${e.path}: ${(e.size / 1024 / 1024).toFixed(1)} MB（上限 ${limit / 1024 / 1024} MB）。` +
        `メディアやテクスチャなら R2 に置いて絶対 URL で読む（docs/spec/publish-pipeline.md）。` +
        `どうしてもコミットするなら ${LARGE_FILES_ALLOW} に理由のコメントと 1 行で足す`,
    );
};

// The built page's <title> / og:title / og:description show the md (decision 0004: the md is the source of truth).
export const checkLabHeadInSync = (root = repoRoot): string[] =>
  labMdSlugs(root).flatMap((slug) => {
    const page = join(root, 'public', 'lab', slug, 'index.html');
    const data = readLabMd(slug, root)?.data;
    if (!existsSync(page) || !data?.title) return [];
    return headMatches(readFileSync(page, 'utf8'), { title: data.title, description: data.description })
      ? []
      : [`public/lab/${slug}/index.html の <title> / OGP が src/content/lab/${slug}.md と違う。pnpm lab:build ${slug} で md から書き直す（手で直さない）`];
  });

// Every media key in the md exists in media/manifest.json (offline; docs/spec/content-model.md).
export const checkMediaKeysResolve = (root = repoRoot): string[] => {
  const manifest = readManifest(root);
  return labMdSlugs(root).flatMap((slug) => {
    const data = readLabMd(slug, root)?.data ?? {};
    return (['poster', 'video'] as const)
      .filter((field) => data[field] !== undefined && !(data[field]! in manifest))
      .map(
        (field) =>
          `src/content/lab/${slug}.md の ${field}: "${data[field]}" が media/manifest.json に無い。` +
          `pnpm lab:add ${slug} --video <mp4> / --poster <image> で R2 に上げる（key の打ち間違いなら md を直す）`,
      );
  });
};
