// Content collections. 1:1 with docs/spec/content-model.md — change both in the same commit.
// Only `lab` for now; works / notes are added when their first entry is written (P1.5 / P2).
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// R2 key from media/manifest.json, e.g. "lab/001-flow-field/poster.webp". Never a URL (decision 0001).
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

export const collections = { lab };
