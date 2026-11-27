// Hatena Blog export (Movable Type format) -> Markdown for src/content/blog/. Pure functions only: the I/O
// (downloading images and gists, writing files) is in scripts/hatena/import.ts.
// Plan: docs/plans/active/blog-migration.md.
import TurndownService from 'turndown';

export type HatenaEntry = {
  title: string;
  // Hatena's BASENAME: either a slug ("threejs-billboard-shader") or a date path ("2021/06/19/133849").
  // The new URL is /blog/<basename>/, so the redirect from /entry/<basename> needs no table.
  basename: string;
  status: 'Publish' | 'Draft';
  // ISO 8601 in JST, which is what the export's "MM/DD/YYYY hh:mm:ss" means.
  date: string;
  categories: string[];
  excerpt?: string;
  body: string;
};

// --- parsing ----------------------------------------------------------------------------------------------

const ENTRY_SEPARATOR = /^--------$/m;
const SECTION_SEPARATOR = /^-----$/m;

const toIsoJst = (mtDate: string): string => {
  const m = mtDate.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`unexpected DATE: ${mtDate}`);
  const [, mo, d, y, h, mi, s] = m;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
};

export const parseExport = (text: string): HatenaEntry[] =>
  text
    .replace(/\r\n/g, '\n')
    .split(ENTRY_SEPARATOR)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const [header, ...sections] = chunk.split(SECTION_SEPARATOR);
      const fields = new Map<string, string[]>();
      for (const line of header.split('\n')) {
        const m = line.match(/^([A-Z ]+): ?(.*)$/);
        if (!m) continue;
        fields.set(m[1], [...(fields.get(m[1]) ?? []), m[2]]);
      }
      const section = (name: string) => {
        const found = sections.map((s) => s.replace(/^\n/, '')).find((s) => s.startsWith(`${name}:\n`));
        return found?.slice(name.length + 2).trim();
      };
      const one = (name: string) => fields.get(name)?.[0] ?? '';
      const status = one('STATUS');
      if (status !== 'Publish' && status !== 'Draft') throw new Error(`unexpected STATUS: ${status}`);
      return {
        title: one('TITLE').trim(),
        basename: one('BASENAME').trim(),
        status,
        date: toIsoJst(one('DATE')),
        categories: (fields.get('CATEGORY') ?? []).map((c) => c.trim()).filter(Boolean),
        excerpt: section('EXCERPT') || undefined,
        body: section('BODY') ?? '',
      };
    });

// --- HTML clean-up before Markdown ------------------------------------------------------------------------

const FOTOLIFE = /https:\/\/cdn-ak\.f\.st-hatena\.com\/images\/fotolife\/[^"'\s)]+/g;

export const imageUrls = (html: string): string[] => [...new Set(html.match(FOTOLIFE) ?? [])];

const GIST_SCRIPT = /<script src="https:\/\/gist\.github\.com\/([^/"]+)\/([0-9a-f]+)\.js"><\/script>/g;

export const gistIds = (html: string): string[] => [...html.matchAll(GIST_SCRIPT)].map((m) => m[2]);

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m?.[1];
};

const decodeEntities = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

// --- click-to-load embeds --------------------------------------------------------------------------------

export type Embed = {
  // What the iframe loads once the reader clicks.
  src: string;
  // Where the link goes: the page on the service, opened in a new tab. Also the fallback without JS.
  href: string;
  title: string;
  // CSS for the box, so the page does not jump when the iframe replaces the button.
  height?: number;
  aspectRatio?: string;
  allow?: string;
};

export const codepenEmbed = (user: string, hash: string, o: { title?: string; height?: number; tab?: string } = {}): Embed => ({
  src: `https://codepen.io/${user}/embed/${hash}?default-tab=${encodeURIComponent(o.tab ?? 'result')}&theme-id=dark`,
  href: `https://codepen.io/${user}/pen/${hash}`,
  title: o.title || `CodePen ${hash}`,
  height: o.height ?? 300,
});

// youtube-nocookie: YouTube's embed that sets no cookies until the video is played.
export const youtubeEmbed = (id: string, title = ''): Embed => ({
  src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`,
  href: `https://www.youtube.com/watch?v=${id}`,
  title: title || `YouTube ${id}`,
  aspectRatio: '16 / 9',
  allow: 'autoplay; encrypted-media; picture-in-picture',
});

// One line of HTML, kept as-is in the Markdown. The article page's script swaps the button for the iframe
// (src/pages/blog/[...slug].astro); the link works without it.
export const embedHtml = (e: Embed): string => {
  const style = e.aspectRatio ? `aspect-ratio: ${e.aspectRatio}` : `height: ${e.height}px`;
  const data = [`data-embed-src="${escapeHtml(e.src)}"`, e.allow ? `data-embed-allow="${e.allow}"` : ''].filter(Boolean).join(' ');
  return (
    `<div class="embed" ${data} style="${style}">` +
    `<button type="button" aria-label="${escapeHtml(e.title)} を読み込む">▶</button>` +
    `<a href="${escapeHtml(e.href)}" target="_blank" rel="noopener">${escapeHtml(e.title)}</a>` +
    `</div>`
  );
};

export type Gist = { files: { filename: string; language: string | null; content: string }[] };

export type CleanOptions = {
  // fotolife URL -> path written into the Markdown (relative to the .md file).
  image: (url: string) => string;
  gists: Map<string, Gist>;
};

// Things that only make sense on Hatena, or that pull a third-party script into the page, are turned into
// plain HTML that Markdown can carry: links, images, code blocks. Nothing is kept as an embed.
export const cleanHtml = (html: string, options: CleanOptions): string => {
  let out = html;

  // Hatena keyword auto-links: just the text.
  out = out.replace(/<a class="keyword"[^>]*>([\s\S]*?)<\/a>/g, '$1');

  // Table of contents generated by [:contents]. The site can generate its own from the headings.
  out = out.replace(/<ul class="table-of-contents">[\s\S]*?<\/ul>\s*(?=<(?:p|h\d|div|pre|hr)\b|$)/g, '');

  // Link cards (hatenablog-parts) -> a link with the card's title. The <cite> after a card repeats the URL.
  out = out.replace(/<iframe [^>]*src="https:\/\/hatenablog-parts\.com\/embed\?url=([^"&]+)[^"]*"[^>]*><\/iframe>/g, (tag, enc: string) => {
    const url = decodeURIComponent(enc);
    const title = decodeEntities(attr(tag, 'title') ?? url);
    return `<a href="${url}">${escapeHtml(title)}</a>`;
  });
  out = out.replace(/<cite class="hatena-citation">[\s\S]*?<\/cite>/g, '');

  // CodePen and YouTube -> a click-to-load embed (embedHtml). Nothing is fetched from them until the reader
  // asks for it.
  out = out.replace(/<p class="codepen"([^>]*)>[\s\S]*?<\/p>/g, (tag, attrs: string) => {
    const user = attr(attrs, 'data-user');
    const hash = attr(attrs, 'data-slug-hash');
    if (!user || !hash) return tag;
    return embedHtml(
      codepenEmbed(user, hash, {
        title: decodeEntities(attr(attrs, 'data-pen-title') ?? ''),
        height: Number(attr(attrs, 'data-height')) || undefined,
        tab: attr(attrs, 'data-default-tab'),
      }),
    );
  });
  out = out.replace(/<iframe ([^>]*)>[\s\S]*?<\/iframe>/g, (tag, attrs: string) => {
    const src = decodeEntities(attr(` ${attrs}`, 'src') ?? '');
    const title = decodeEntities(attr(` ${attrs}`, 'title') ?? '');
    const pen = src.match(/^https:\/\/codepen\.io\/([^/]+)\/embed\/(?:preview\/)?([^?]+)(?:\?(.*))?$/);
    if (pen) {
      const query = new URLSearchParams(pen[3] ?? '');
      return embedHtml(
        codepenEmbed(pen[1], pen[2], {
          title,
          height: Number(query.get('height')) || undefined,
          tab: query.get('default-tabs') ?? undefined,
        }),
      );
    }
    const video = src.match(/^https:\/\/www\.youtube\.com\/embed\/([^?]+)/);
    if (video) return embedHtml(youtubeEmbed(video[1], title));
    return tag;
  });

  // Gists -> the code itself, so the page does not depend on gist.github.com.
  out = out.replace(GIST_SCRIPT, (_m, user: string, id: string) => {
    const gist = options.gists.get(id);
    const url = `https://gist.github.com/${user}/${id}`;
    if (!gist) return `<p><a href="${url}">${url}</a></p>`;
    return gist.files
      .map((f) => `<pre class="code lang-${(f.language ?? '').toLowerCase()}">${escapeHtml(f.content)}</pre>`)
      .concat(`<p><a href="${url}">${url}</a></p>`)
      .join('\n');
  });

  // Links between the migrated entries point at their new place.
  out = out.replace(/https?:\/\/takumifukasawa\.hatenablog\.com\/entry\/([0-9A-Za-z_/-]+?)\/?(?=["#?<\s]|$)/g, (_m, basename: string) =>
    newPath(basename),
  );

  // Every other script (embed loaders, jsdo.it which no longer exists).
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');

  // Fotolife images -> a plain <img> pointing at the local copy.
  out = out.replace(/<span itemscope[^>]*>(<img [^>]*>)<\/span>/g, '$1');
  out = out.replace(/<img [^>]*src="([^"]+)"[^>]*>/g, (tag, src: string) => {
    if (!src.match(FOTOLIFE)) return tag;
    const alt = [attr(tag, 'alt'), attr(tag, 'title')].find((a) => a && !a.startsWith('f:id:')) ?? '';
    return `<img src="${options.image(src)}" alt="${alt}">`;
  });

  return out;
};

// --- Markdown ---------------------------------------------------------------------------------------------

// "lang-c", "c", "javascript:webpack.common.js" -> "c" / "javascript". "code" alone has no language.
export const codeLanguage = (className: string): string => {
  const words = className.split(/\s+/).filter((w) => w !== 'code');
  const word = words[0] ?? '';
  const lang = word.replace(/^lang-/, '').split(':')[0];
  return { cs: 'csharp', 'c#': 'csharp' }[lang] ?? lang;
};

const turndown = () => {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });
  td.addRule('hatena-code', {
    filter: (node) => node.nodeName === 'PRE',
    replacement: (_content, node) => {
      const el = node as HTMLElement;
      const lang = codeLanguage(el.getAttribute('class') ?? '');
      const code = (el.textContent ?? '').replace(/\n+$/, '');
      const fence = code.includes('```') ? '````' : '```';
      return `\n\n${fence}${lang}\n${code}\n${fence}\n\n`;
    },
  });
  td.keep((node) => node.nodeName === 'DIV' && (node as HTMLElement).classList.contains('embed'));
  // CommonMark only closes ** / * when the delimiter is "flanking", which fails when the emphasised text starts
  // or ends with punctuation and is glued to Japanese text: **3D空間（板ポリ）**を stays as literal asterisks.
  // Those cases keep the HTML tag instead.
  const startsOrEndsWithPunctuation = (s: string) => /^[\p{P}\p{S}]|[\p{P}\p{S}]$/u.test(s.trim());
  td.addRule('emphasis-safe', {
    filter: ['strong', 'b', 'em', 'i'],
    replacement: (content, node) => {
      if (!content.trim()) return content;
      const strong = node.nodeName === 'STRONG' || node.nodeName === 'B';
      if (startsOrEndsWithPunctuation(content)) {
        const tag = strong ? 'strong' : 'em';
        return `<${tag}>${content}</${tag}>`;
      }
      return strong ? `**${content}**` : `*${content}*`;
    },
  });
  td.addRule('strike', {
    filter: ['s', 'del'],
    replacement: (content) => `~~${content}~~`,
  });
  return td;
};

export const toMarkdown = (html: string): string =>
  turndown()
    .turndown(html)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// --- the .md file -----------------------------------------------------------------------------------------

const yamlString = (s: string) => JSON.stringify(s);

export const formatBlogMd = (entry: HatenaEntry, markdown: string): string => {
  const lines = ['---', `title: ${yamlString(entry.title)}`, `date: ${entry.date}`];
  lines.push(entry.categories.length ? `tags: [${entry.categories.map(yamlString).join(', ')}]` : 'tags: []');
  if (entry.excerpt) lines.push(`description: ${yamlString(entry.excerpt)}`);
  lines.push('---', '', markdown, '');
  return lines.join('\n');
};

export const oldUrl = (basename: string) => `https://takumifukasawa.hatenablog.com/entry/${basename}`;
export const newPath = (basename: string) => `/blog/${basename}/`;
