// Derived metadata for a blog post's <head>: the description and the og:image come from the body, so the
// frontmatter does not carry them (docs/spec/content-model.md: derivable things are not stored).

// The first ~120 characters of the body's prose, for <meta name="description"> / og:description.
// Code, images, embeds, HTML tags and Markdown syntax are dropped; links keep their text.
export const excerpt = (markdown: string, max = 120): string => {
  // Escaped characters (\_ in Point\_Size) are set aside first, so stripping emphasis markers cannot eat them.
  const escaped: string[] = [];
  const text = markdown
    .replace(/\\([\\`*_{}[\]()#+\-.!])/g, (_m, c: string) => `\u{F0000}${escaped.push(c) - 1}\u{F0001}`)
    .replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1\s*$/gm, ' ') // fenced code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/<div class="embed"[\s\S]*?<\/div>/g, ' ') // click-to-load embeds
    .replace(/<[^>]+>/g, ' ') // other HTML tags (keeps their text)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> their text
    .replace(/`([^`]*)`/g, '$1') // inline code
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '') // headings, quotes, list markers
    .replace(/^\s*([-*_]\s*){3,}$/gm, ' ') // horizontal rules
    .replace(/(\*\*|__|\*|_|~~)/g, '') // emphasis markers
    .replace(/\u{F0000}(\d+)\u{F0001}/gu, (_m, i: string) => escaped[Number(i)]!) // escapes back
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
};

// The path of the first Markdown image in the body, as written (relative to the .md file), or undefined.
export const firstImagePath = (markdown: string): string | undefined => markdown.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1];
