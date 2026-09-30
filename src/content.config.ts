/**
 * Content collections (CLAUDE.md, "Content model"). Per-file shapes only; cross-file rules live in
 * scripts/validate-content.ts (stage 3). Stage 2 defines just the fields navigation needs.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { categoryIds, levelIds } from './config/site.ts';

const base = './src/content/topics';

/** `a2/perfekt/meta.yaml`, id `a2/perfekt` */
const topicMeta = defineCollection({
  loader: glob({
    pattern: '*/*/meta.yaml',
    base,
    generateId: ({ entry }) => entry.replace(/\/meta\.yaml$/, ''),
  }),
  schema: z.object({
    level: z.enum(levelIds),
    category: z.enum(categoryIds),
    order: z.number().int().positive(),
  }),
});

/** `a2/perfekt/en.mdx`, id `a2/perfekt/en` */
const topics = defineCollection({
  loader: glob({
    pattern: '*/*/*.mdx',
    base,
    generateId: ({ entry }) => entry.replace(/\.mdx$/, ''),
  }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
  }),
});

export const collections = { topicMeta, topics };
