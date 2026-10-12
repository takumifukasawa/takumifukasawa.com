// R2 media keys -> URL + intrinsic size. The single place that turns a frontmatter key into something
// renderable (docs/spec/content-model.md). Keys look like "lab/foo/poster.webp"; URLs are never
// written in frontmatter (decision 0001).
// Imported, not read from disk: Vite inlines it at build time, so the path stays correct in the bundled
// output and the manifest never ships to the browser.
import manifestJson from '../../media/manifest.json';

export type MediaEntry = { width: number; height: number; bytes: number; durationSec?: number };
type Manifest = Record<string, MediaEntry>;

const manifest = manifestJson as Manifest;

export type ResolvedMedia = MediaEntry & { url: string };

export const resolveMedia = (key: string): ResolvedMedia => {
  const base = import.meta.env.PUBLIC_MEDIA_BASE_URL;
  if (!base) {
    throw new Error(
      'PUBLIC_MEDIA_BASE_URL is not set, so media keys cannot become URLs.\n' +
        '  local:  add PUBLIC_MEDIA_BASE_URL=https://media.takumifukasawa.com to .env (see .env.example)\n' +
        '  deploy: it is a Workers Builds variable (docs/spec/site-v0.md)',
    );
  }
  const entry = manifest[key];
  if (!entry) {
    throw new Error(
      `media key "${key}" is not in media/manifest.json.\n` +
        '  the manifest is written by `pnpm lab:add`; run it for this sketch, or fix the key in the md',
    );
  }
  return { ...entry, url: `${base.replace(/\/$/, '')}/${key}` };
};
