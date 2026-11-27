// /sitemap.xml — every page meant to be found by search: the top, About, the blog and its articles, and the
// sketches on this site. Written by hand rather than with @astrojs/sitemap, which only sees Astro's own pages:
// the sketches are built files under public/lab/ (decision 0001) and would be missing.
// Referenced from public/robots.txt; submitted in Search Console (docs/plans/active/blog-migration.md).
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

const ymd = (d: Date) => d.toISOString().slice(0, 10);

export const GET: APIRoute = async ({ site }) => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const sketches = await getCollection('lab', ({ data }) => !data.draft && !data.externalUrl);

  const entries: { path: string; lastmod?: Date }[] = [
    { path: '/' },
    { path: '/about/' },
    { path: '/blog/' },
    { path: '/privacy/' },
    ...posts.map((p) => ({ path: `/blog/${p.id}/`, lastmod: p.data.date })),
    ...sketches.map((s) => ({ path: `/lab/${s.id}/`, lastmod: s.data.date })),
  ];

  const urls = entries
    .map(({ path, lastmod }) => {
      const loc = new URL(path, site).href;
      return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${ymd(lastmod)}</lastmod>` : ''}</url>`;
    })
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
};
