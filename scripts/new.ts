// pnpm new <slug> "<title>"
// Scaffold lab/<slug>/ from scripts/templates/sketch/ (docs/spec/publish-pipeline.md).
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { labDir, SLUG_PATTERN } from './lib/lab.ts';

const templateDir = join(import.meta.dirname, 'templates', 'sketch');

const fail = (message: string): never => {
  console.error(`pnpm new: ${message}`);
  process.exit(1);
};

const [slug, title] = process.argv.slice(2);
if (!slug || !title) {
  fail('usage: pnpm new <slug> "<title>"   e.g. pnpm new flow-field "Flow field with curl noise"');
}
if (!SLUG_PATTERN.test(slug)) {
  fail(`slug must look like flow-field (lowercase words joined by "-"): ${slug}`);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const outDir = join(labDir, slug);
// Uniqueness is the directory name itself -- there is no number ledger (decision 0007). This also guards the
// reserved entries of lab/: `pnpm new core` stops here because lab/core/ already exists (lab/core/AGENTS.md).
if (existsSync(outDir)) fail(`lab/${slug}/ already exists. Pick another name.`);

cpSync(templateDir, outDir, { recursive: true });
for (const file of readdirSync(outDir, { recursive: true, encoding: 'utf8' })) {
  const path = join(outDir, file);
  if (!/\.(html|ts)$/.test(file)) continue;
  const src = readFileSync(path, 'utf8');
  const titleValue = file.endsWith('.html') ? escapeHtml(title) : title.replace(/\n/g, ' ');
  writeFileSync(path, src.replaceAll('__SLUG__', slug).replaceAll('__TITLE__', titleValue));
}

console.log(`created lab/${slug}/`);
console.log(`next: pnpm dev:lab ${slug}`);
