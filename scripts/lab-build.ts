// pnpm lab:build <NNN-slug>     build one sketch into public/lab/<slug>/
// pnpm lab:rebuild --all         rebuild every web sketch; failures are skipped and keep their old output
//
// Each sketch is built into a temporary directory first and swapped into public/lab/<slug>/ only on success,
// so a broken build never deletes the published output (docs/spec/publish-pipeline.md「再ビルド」).
import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'vite';
import { buildMetaDir, buildMetaPath, labDir, publicLabDir, sourceHash, webSketchSlugs, type BuildMeta } from './lib/lab.ts';

const tmpRoot = join(labDir, '.build-tmp');

const buildOne = async (slug: string): Promise<void> => {
  const configFile = join(labDir, slug, 'vite.config.ts');
  if (!existsSync(configFile)) throw new Error(`lab/${slug}/vite.config.ts not found`);

  const tmpOut = join(tmpRoot, slug);
  rmSync(tmpOut, { recursive: true, force: true });
  await build({ configFile, logLevel: 'warn', build: { outDir: tmpOut, emptyOutDir: true } });

  const out = join(publicLabDir, slug);
  mkdirSync(publicLabDir, { recursive: true });
  rmSync(out, { recursive: true, force: true });
  renameSync(tmpOut, out);

  // TODO(0-8): once src/content/lab/<slug>.md exists, rewrite <title> / OGP in out/index.html from it (decision 0004).

  const meta: BuildMeta = { sourceHash: sourceHash(slug), builtAt: new Date().toISOString() };
  mkdirSync(buildMetaDir, { recursive: true });
  writeFileSync(buildMetaPath(slug), `${JSON.stringify(meta, null, 2)}\n`);
};

const [mode, ...rest] = process.argv.slice(2);

if (mode === '--all') {
  const slugs = webSketchSlugs();
  const failed: { slug: string; error: string }[] = [];
  for (const slug of slugs) {
    try {
      await buildOne(slug);
      console.log(`ok    ${slug}`);
    } catch (error) {
      failed.push({ slug, error: String(error instanceof Error ? error.message : error) });
      const kept = existsSync(join(publicLabDir, slug)) ? 'previous output is kept' : 'no previous output';
      console.log(`SKIP  ${slug}  (build failed; ${kept})`);
    }
  }
  rmSync(tmpRoot, { recursive: true, force: true });
  console.log(`\nrebuilt ${slugs.length - failed.length}/${slugs.length}`);
  if (failed.length > 0) {
    console.log('failed:');
    for (const f of failed) console.log(`  ${f.slug}: ${f.error.split('\n')[0]}`);
    process.exitCode = 1;
  }
} else if (mode && !mode.startsWith('--') && rest.length === 0) {
  const slug = mode;
  if (!existsSync(join(labDir, slug, 'index.html'))) {
    console.error(`pnpm lab:build: lab/${slug}/index.html not found. Only sketches with index.html are built (decision 0003).`);
    process.exit(1);
  }
  try {
    await buildOne(slug);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
  console.log(`built lab/${slug}/ -> public/lab/${slug}/`);
} else {
  console.error('usage: pnpm lab:build <NNN-slug>  |  pnpm lab:rebuild --all');
  process.exit(1);
}
