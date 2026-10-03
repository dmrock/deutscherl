/**
 * Content collections (CLAUDE.md, "Content model"). Per-file shapes come from
 * src/lib/content-schemas.ts (shared with the scripts); cross-file rules live in
 * scripts/validate-content.ts, which runs before every build.
 */
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import {
  frontmatterSchema,
  germanSchema,
  i18nSchema,
  metaSchema,
  reviewSchema,
} from './lib/content-schemas.ts';

const base = './src/content/topics';

/** A collection of one file name per topic folder: `a2/perfekt/<file>` gets the id `a2/perfekt`. */
function perTopic(file: string) {
  return glob({
    pattern: `*/*/${file}`,
    base,
    generateId: ({ entry }) => entry.slice(0, -(file.length + 1)),
  });
}

/** `a2/perfekt/meta.yaml`, id `a2/perfekt` */
const topicMeta = defineCollection({ loader: perTopic('meta.yaml'), schema: metaSchema });

/** `a2/perfekt/german.yaml`, id `a2/perfekt` */
const topicGerman = defineCollection({ loader: perTopic('german.yaml'), schema: germanSchema });

/** `a2/perfekt/review.yaml`, id `a2/perfekt` */
const topicReview = defineCollection({ loader: perTopic('review.yaml'), schema: reviewSchema });

/** `a2/perfekt/i18n/ru.yaml`, id `a2/perfekt/ru` */
const topicI18n = defineCollection({
  loader: glob({
    pattern: '*/*/i18n/*.yaml',
    base,
    generateId: ({ entry }) => entry.replace(/\/i18n\/([^/]+)\.yaml$/, '/$1'),
  }),
  schema: i18nSchema,
});

/** `a2/perfekt/en.mdx`, id `a2/perfekt/en` */
const topics = defineCollection({
  loader: glob({
    pattern: '*/*/*.mdx',
    base,
    generateId: ({ entry }) => entry.replace(/\.mdx$/, ''),
  }),
  schema: frontmatterSchema,
});

export const collections = { topicMeta, topicGerman, topicReview, topicI18n, topics };
