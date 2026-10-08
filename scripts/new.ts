// pnpm new <NNN-slug> "<title>"
// Scaffold lab/<NNN-slug>/ from scripts/templates/sketch/ (docs/spec/publish-pipeline.md).
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
  fail('usage: pnpm new <NNN-slug> "<title>"   e.g. pnpm new 001-flow-field "Flow field with curl noise"');
}
if (!SLUG_PATTERN.test(slug)) {
  fail(`slug must look like 001-flow-field (3 digits, then lowercase words joined by "-"): ${slug}`);
}

const number = slug.slice(0, 3);
const existing = existsSync(labDir) ? readdirSync(labDir) : [];
const sameSlug = existing.find((name) => name === slug);
if (sameSlug) fail(`lab/${slug}/ already exists`);
const sameNumber = existing.find((name) => name.startsWith(`${number}-`));
if (sameNumber) fail(`number ${number} is already used by lab/${sameNumber}/. Pick the next free number.`);

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const outDir = join(labDir, slug);
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
