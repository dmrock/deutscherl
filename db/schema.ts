/**
 * Dictionary database schema (CLAUDE.md, "Dictionary"). The SQLite file is generated at build time
 * by scripts/build-dictionary.ts from db/data/words.jsonl and db/overrides/*.yaml; it is never
 * edited. The tables are created from this schema (no committed migrations: the file is rebuilt
 * from scratch every time).
 */
import { index, integer, primaryKey, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const words = sqliteTable(
  'words',
  {
    /** Also the URL slug: `see-der`, `essen-verb` */
    id: text('id').primaryKey(),
    lemma: text('lemma').notNull(),
    pos: text('pos').notNull(),
    /** `m` | `f` | `n` | `pl` (plural-only); nouns only */
    gender: text('gender'),
    plural: text('plural'),
    level: text('level').notNull(),
    /** `draft` | `verified` */
    status: text('status').notNull(),
    source: text('source').notNull(),
    sourceUrl: text('source_url').notNull(),
    license: text('license').notNull(),
  },
  (table) => [index('words_level_idx').on(table.level), index('words_pos_idx').on(table.pos)],
);

/** Glosses per locale, in their original order (`position`). */
export const senses = sqliteTable(
  'senses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    lang: text('lang').notNull(),
    gloss: text('gloss').notNull(),
    position: integer('position').notNull(),
    source: text('source').notNull(),
    /** `AT` when the sense is Austrian usage */
    region: text('region'),
  },
  (table) => [
    unique('senses_word_lang_position').on(table.wordId, table.lang, table.position),
    index('senses_word_idx').on(table.wordId),
  ],
);

export const examples = sqliteTable(
  'examples',
  {
    /** `<word id>-x<n>` */
    id: text('id').primaryKey(),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    de: text('de').notNull(),
    source: text('source').notNull(),
  },
  (table) => [index('examples_word_idx').on(table.wordId)],
);

export const exampleTranslations = sqliteTable(
  'example_translations',
  {
    exampleId: text('example_id')
      .notNull()
      .references(() => examples.id),
    lang: text('lang').notNull(),
    text: text('text').notNull(),
  },
  (table) => [primaryKey({ columns: [table.exampleId, table.lang] })],
);

/** Austrian (or other regional) words for the same thing, e.g. `Erdapfel` for `Kartoffel`. */
export const regionalVariants = sqliteTable(
  'regional_variants',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
    region: text('region').notNull(),
    variant: text('variant').notNull(),
    note: text('note'),
  },
  (table) => [index('regional_variants_word_idx').on(table.wordId)],
);

/** Words referenced by `<Word id>` in a topic's MDX files. */
export const topicWords = sqliteTable(
  'topic_words',
  {
    /** `a2/perfekt` */
    topicSlug: text('topic_slug').notNull(),
    wordId: text('word_id')
      .notNull()
      .references(() => words.id),
  },
  (table) => [
    primaryKey({ columns: [table.topicSlug, table.wordId] }),
    index('topic_words_word_idx').on(table.wordId),
  ],
);
