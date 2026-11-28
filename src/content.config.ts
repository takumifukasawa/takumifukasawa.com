// Content collections. 1:1 with docs/spec/content-model.md — change both in the same commit.
// `lab`, `blog` (the Hatena Blog migration, docs/plans/active/blog-migration.md) and `diary`. works is added with its
// first entry (P2).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// R2 key from media/manifest.json, e.g. "lab/flow-field/poster.webp". Never a URL (decision 0001).
const mediaKey = z.string().regex(/^[a-z0-9][a-z0-9/_.-]*$/);

const lab = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/lab' }),
  schema: z.object({
    date: z.coerce.date(),
    title: z.string(),
    medium: z.enum(['runtime', 'video', 'image']),
    poster: mediaKey,
    tags: z.array(z.string()).min(1),
    description: z.string().optional(),
    video: mediaKey.optional(),
    externalUrl: z.string().url().optional(),
    repo: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

// Articles. The id is the path under src/content/blog/ ("threejs-billboard-shader", or "2021/06/19/133849" for
// entries that had a date URL on Hatena), and the page is /blog/<id>/, so Hatena's /entry/<id> maps by rule.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    description: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// The published days of the diary. NOT in this repo: scripts/diary/fetch.ts puts them into .content/ (gitignored)
// before each build, from the Obsidian vault locally or the private relay repo on Workers Builds
// (docs/plans/active/diary-pipeline.md). The id is the date, YYYYMMDD.
const diary = defineCollection({
  loader: glob({ pattern: '*.md', base: './.content/daily' }),
  schema: z.object({
    date: z.coerce.date(),
  }),
});

export const collections = { lab, blog, diary };
