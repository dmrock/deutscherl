/**
 * Per-file content schemas (CLAUDE.md, "Content model"). Pure: used by the content collections
 * (src/content.config.ts) and by the scripts that run on plain node (validate-content, review).
 * Rules that span files live in scripts/validate-content.ts.
 */
import { z } from 'astro/zod';
import { categoryIds, levelIds } from '../config/site.ts';

const id = z.string().regex(/^[a-z][a-z0-9-]*$/, 'ids are lowercase letters, digits and dashes');
const text = z.string().trim().min(1);

/** `meta.yaml` */
export const metaSchema = z.strictObject({
  level: z.enum(levelIds),
  category: z.enum(categoryIds),
  order: z.number().int().positive(),
  readingMinutes: z.number().int().positive(),
  sources: z.array(z.strictObject({ title: text, url: z.url().optional() })).min(1),
});

export const regionSchema = z.enum(['AT']);

/** German example; `de` may mark key words with `**…**` (highlighted, stripped for audio). */
export const exampleSchema = z.strictObject({
  id,
  de: text,
  region: regionSchema.optional(),
});

export const choiceSchema = z.strictObject({
  id,
  /** Sentence with one `___` gap */
  text,
  answer: text,
  options: z.array(text).min(2).max(4),
  alsoCorrect: z.array(z.strictObject({ value: text, region: regionSchema })).optional(),
});

export const punctuationSchema = z.enum(['.', '?', '!']);

export const wordOrderSchema = z.strictObject({
  id,
  /** Canonical order, neutral case */
  parts: z.array(text).min(2),
  /** First part is locked in place */
  fixed: z.boolean().optional(),
  /** Every other valid full order */
  accept: z.array(z.array(text)).optional(),
  punctuation: punctuationSchema,
});

export const austrianNoteSchema = z.strictObject({ id, de: text });

/** `german.yaml`: everything German in a topic, shared by all locales. */
export const germanSchema = z.strictObject({
  examples: z.array(exampleSchema).default([]),
  choice: z.array(choiceSchema).default([]),
  wordOrder: z.array(wordOrderSchema).default([]),
  austrianNotes: z.array(austrianNoteSchema).default([]),
});

/** `<locale>.mdx` frontmatter. In `summary`, `*word*` marks a German term. */
export const frontmatterSchema = z.strictObject({
  title: text,
  summary: text,
});

/**
 * `i18n/<locale>.yaml`: translations and explanations keyed by German item id. Fields are optional
 * here, so a locale that is not ready yet can be translated step by step; scripts/i18n-coverage.ts
 * requires every key for ready locales.
 */
export const i18nSchema = z.strictObject({
  examples: z.record(z.string(), text).default({}),
  choice: z.record(z.string(), z.strictObject({ why: text.optional() })).default({}),
  wordOrder: z
    .record(z.string(), z.strictObject({ translation: text.optional(), why: text.optional() }))
    .default({}),
  austrianNotes: z.record(z.string(), text).default({}),
});

export const baseStatusSchema = z.enum(['draft', 'reviewed', 'verified']);
export const translationStatusSchema = z.enum(['draft', 'reviewed']);

const hash = z.string().regex(/^sha256:[0-9a-f]{16}$/);
const timestamp = z.string().min(1);

export const historyEntrySchema = z.strictObject({
  at: timestamp,
  event: z.enum(['reset', 'minor', 'status']),
  from: z.string().optional(),
  to: z.string().optional(),
  by: z.string().nullable().optional(),
  reason: z.string().optional(),
  previousHash: hash.optional(),
});

/** `review.yaml`: review state, managed only by scripts/review.ts. */
export const reviewSchema = z.strictObject({
  base: z.strictObject({
    status: baseStatusSchema,
    contentHash: hash,
    verifiedBy: z.string().nullable(),
    verifiedAt: timestamp.nullable(),
    history: z.array(historyEntrySchema),
  }),
  translations: z.record(
    z.string(),
    z.strictObject({
      status: translationStatusSchema,
      contentHash: hash,
      basedOn: hash,
      reviewedBy: z.string().nullable(),
      reviewedAt: timestamp.nullable(),
      history: z.array(historyEntrySchema),
    }),
  ),
});

export type TopicMeta = z.infer<typeof metaSchema>;
export type GermanContent = z.infer<typeof germanSchema>;
export type ChoiceItem = z.infer<typeof choiceSchema>;
export type WordOrderItem = z.infer<typeof wordOrderSchema>;
export type Frontmatter = z.infer<typeof frontmatterSchema>;
export type TopicI18n = z.infer<typeof i18nSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type BaseReview = Review['base'];
export type TranslationReview = Review['translations'][string];
export type HistoryEntry = z.infer<typeof historyEntrySchema>;
