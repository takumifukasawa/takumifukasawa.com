// node scripts/check-dist-images.ts [dir]   (default: dist/)
//
// Fails when any built image still carries EXIF / XMP / IPTC metadata (GPS position, camera, date taken).
// Runs at the end of `pnpm build`, so a photo with its location never reaches the site. Astro copies original
// images into dist/_astro/ unchanged (docs/plans/active/diary-pipeline.md), so the diary's images are stripped
// when they are copied out of the vault (scripts/lib/diary.ts) and this is the net behind that.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import { repoRoot } from './lib/lab.ts';

export const imagesWithMetadata = async (dir: string): Promise<string[]> => {
  const files = readdirSync(dir, { recursive: true })
    .map(String)
    .filter((f) => /\.(jpe?g|png|webp|gif|avif|tiff?)$/i.test(f));
  const found: string[] = [];
  for (const f of files) {
    const meta = await sharp(readFileSync(join(dir, f))).metadata();
    const kinds = (['exif', 'xmp', 'iptc'] as const).filter((k) => meta[k]);
    if (kinds.length > 0) found.push(`${f} (${kinds.join(', ')})`);
  }
  return found;
};

if (import.meta.main) {
  const dir = process.argv[2] ?? join(repoRoot, 'dist');
  const found = await imagesWithMetadata(dir);
  for (const f of found)
    console.error(`metadata left in ${relative(repoRoot, join(dir, f.split(' ')[0]!))}: ${f.split(' ').slice(1).join(' ')}`);
  if (found.length > 0) {
    console.error(
      'These images would publish their metadata (possibly a GPS position). Strip it from the source image ' +
        '(diary images: scripts/lib/diary.ts does this; others: re-save without metadata, e.g. exiftool -all= <file>) and build again.',
    );
    process.exit(1);
  }
  console.log('dist images: no metadata');
}
