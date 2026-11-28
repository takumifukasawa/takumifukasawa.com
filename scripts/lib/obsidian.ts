// Obsidian notes -> plain Markdown the site can render (docs/plans/active/diary-pipeline.md).
// Pure functions only: reading the vault, copying images and stripping their metadata live in scripts/lib/diary.ts.
import { parse } from 'yaml';

export type Note = { data: Record<string, unknown>; body: string };

// Splits a note into its frontmatter (Obsidian's "properties") and body. A note without frontmatter has none.
export const parseNote = (text: string): Note => {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text };
  const data: unknown = parse(m[1]!);
  return { data: data && typeof data === 'object' ? (data as Record<string, unknown>) : {}, body: text.slice(m[0].length) };
};

// Only an explicit `publish: true` publishes. A missing, false, or misspelt value keeps the note private.
export const isPublished = (note: Note): boolean => note.data.publish === true;

export type ImageRef = { raw: string; target: string; alt: string };

const IMAGE_EXT = /\.(png|jpe?g|gif|webp)$/i;
export const isImagePath = (path: string): boolean => IMAGE_EXT.test(path);

// Fenced and inline code are left alone by every conversion below: `[[x]]` inside code is text, not a link.
const splitCode = (body: string): { code: boolean; text: string }[] => {
  const parts: { code: boolean; text: string }[] = [];
  const re = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$|`[^`\n]+`/gm;
  let last = 0;
  for (const m of body.matchAll(re)) {
    if (m.index! > last) parts.push({ code: false, text: body.slice(last, m.index) });
    parts.push({ code: true, text: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < body.length) parts.push({ code: false, text: body.slice(last) });
  return parts;
};
const outsideCode = (body: string, f: (text: string) => string): string =>
  splitCode(body)
    .map((p) => (p.code ? p.text : f(p.text)))
    .join('');

// `![[photo.png]]`, `![[photo.png|alt]]`, `![[photo.png|300]]` (a width, not an alt) and `![alt](photo.png)`.
// Remote images (http...) are not refs: they are not copied, and the conversion leaves them as they are.
export const imageRefs = (body: string): ImageRef[] => {
  const refs: ImageRef[] = [];
  outsideCode(body, (text) => {
    for (const m of text.matchAll(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g)) {
      const target = m[1]!.trim();
      if (isImagePath(target)) refs.push({ raw: m[0], target, alt: /^\d+(x\d+)?$/.test(m[2] ?? '') ? '' : (m[2] ?? '').trim() });
    }
    for (const m of text.matchAll(/!\[([^\]]*)\]\(<?([^)>\s]+)>?\)/g)) {
      const target = decodeURI(m[2]!);
      if (!/^[a-z]+:/i.test(target)) refs.push({ raw: m[0], target, alt: m[1]! });
    }
    return text;
  });
  return refs;
};

export class ConvertError extends Error {}

// Converts a note body. `imageUrl` maps an image ref's target to the path the page should use.
// - `%% comments %%` are dropped: they are private by definition (Obsidian never renders them).
// - `[[note]]` / `[[note|alias]]` become plain text: links into the vault point at notes that are not published.
// - `![[note]]` (embedding another note) is refused: inlining it would publish that note, dropping it would
//   silently lose text. The writer decides.
// - Callouts (`> [!info] Title`) become a plain quote with the title in bold.
export const toSiteMarkdown = (body: string, imageUrl: (target: string) => string): string => {
  const withoutComments = outsideCode(body, (t) => t.replace(/%%[\s\S]*?%%/g, ''));
  // Markdown images first: the `![[...]]` replacement below produces Markdown images, which must not be mapped twice.
  return outsideCode(withoutComments, (text) =>
    text
      .replace(/!\[([^\]]*)\]\(<?([^)>\s]+)>?\)/g, (raw, alt: string, target: string) =>
        /^[a-z]+:/i.test(target) ? raw : `![${alt}](${imageUrl(decodeURI(target))})`,
      )
      .replace(/!\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (raw, target: string, opt?: string) => {
        if (!isImagePath(target.trim())) throw new ConvertError(`${raw}: embeds another note. Copy the text in, or link it as plain text.`);
        const alt = /^\d+(x\d+)?$/.test(opt ?? '') ? '' : (opt ?? '').trim();
        return `![${alt}](${imageUrl(target.trim())})`;
      })
      .replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]*))?\]\]/g, (_raw, target: string, alias?: string) => (alias ?? target).trim())
      .replace(/^>[ \t]*\[!\w+\][+-]?[ \t]*(.*)$/gm, (_raw, title: string) => (title.trim() ? `> **${title.trim()}**` : '>')),
  );
};

// Pushes every heading down `by` levels (capped at h6), so a note's headings sit under the page's own h1/h2.
export const demoteHeadings = (body: string, by: number): string =>
  outsideCode(body, (text) => text.replace(/^(#{1,6})(?=[ \t])/gm, (h) => '#'.repeat(Math.min(6, h.length + by))));

// A file name that is safe in a URL and on every file system: Obsidian's "Pasted image 2026….png" has spaces.
export const safeFileName = (name: string): string => name.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
