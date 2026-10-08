// pnpm new <NNN-slug> "<title>"
// Scaffold lab/<NNN-slug>/ from scripts/templates/sketch/ (docs/spec/publish-pipeline.md).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const templateDir = join(import.meta.dirname, 'templates', 'sketch');
const labDir = join(root, 'lab');

const fail = (message: string): never => {
  console.error(`pnpm new: ${message}`);
  process.exit(1);
};

const [slug, title] = process.argv.slice(2);
if (!slug || !title) {
  fail('usage: pnpm new <NNN-slug> "<title>"   e.g. pnpm new 001-flow-field "Flow field with curl noise"');
}
if (!/^\d{3}-[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
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
mkdirSync(outDir, { recursive: true });
for (const file of readdirSync(templateDir)) {
  const src = readFileSync(join(templateDir, file), 'utf8');
  const titleValue = file.endsWith('.html') ? escapeHtml(title) : title.replace(/\n/g, ' ');
  writeFileSync(join(outDir, file), src.replaceAll('__SLUG__', slug).replaceAll('__TITLE__', titleValue));
}

console.log(`created lab/${slug}/`);
console.log(`next: pnpm dev:lab ${slug}`);
