/**
 * Builds the dictionary database (CLAUDE.md, "Dictionary"): db/data/words.jsonl + db/overrides/*.yaml
 * → .cache/dictionary.sqlite. Runs before `astro build`, locally and in CI. The database is
 * regenerated from scratch every time; the text files in git are the source of truth.
 *
 * Fails without writing when an entry is invalid, an override does not apply, ids collide or a
 * topic uses an unknown `<Word id>`. A missing words.jsonl builds an empty dictionary.
 *
 * Usage: node scripts/build-dictionary.ts
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { generateSQLiteDrizzleJson, generateSQLiteMigration } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/libsql';
import { parse } from 'yaml';
import * as schema from '../db/schema.ts';
import {
  applyOverrides,
  checkEntries,
  parseEntries,
  type RawOverrideFile,
  type WordEntry,
} from '../src/lib/dictionary.ts';
import { CONTENT_ROOT, readTopics } from './lib/content.ts';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');

export const WORDS_FILE = join(ROOT, 'db/data/words.jsonl');
export const OVERRIDES_DIR = join(ROOT, 'db/overrides');
export const DICTIONARY_DB = join(ROOT, '.cache/dictionary.sqlite');

export interface DictionaryInput {
  wordsFile?: string;
  overridesDir?: string;
  topicsRoot?: string;
}

export interface TopicWord {
  topicSlug: string;
  wordId: string;
}

export interface LoadedDictionary {
  entries: WordEntry[];
  topicWords: TopicWord[];
  errors: string[];
}

/** Every `*.yaml` in the overrides folder, by name. */
export function readOverrides(dir: string): { files: RawOverrideFile[]; errors: string[] } {
  const files: RawOverrideFile[] = [];
  const errors: string[] = [];
  if (!existsSync(dir)) return { files, errors };
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.yaml')) continue;
    try {
      files.push({ name, data: parse(readFileSync(join(dir, name), 'utf8')) });
    } catch (error) {
      errors.push(`${name}: cannot be parsed: ${(error as Error).message}`);
    }
  }
  return { files, errors };
}

/** `<Word id>` references per topic; unknown ids are errors. */
export function collectTopicWords(
  topicsRoot: string,
  ids: ReadonlySet<string>,
): { topicWords: TopicWord[]; errors: string[] } {
  const topicWords: TopicWord[] = [];
  const errors: string[] = [];
  for (const topic of readTopics(topicsRoot)) {
    const used = new Set<string>();
    for (const file of topic.mdx.values()) {
      for (const id of file.refs.words) {
        if (!ids.has(id)) errors.push(`${topic.key}/${file.name}: unknown <Word id="${id}">`);
        else used.add(id);
      }
    }
    for (const wordId of [...used].sort()) topicWords.push({ topicSlug: topic.key, wordId });
  }
  return { topicWords, errors };
}

/** Reads, merges and checks everything; nothing is written. */
export function loadDictionary(input: DictionaryInput = {}): LoadedDictionary {
  const wordsFile = input.wordsFile ?? WORDS_FILE;
  const errors: string[] = [];
  const imported = existsSync(wordsFile)
    ? parseEntries(readFileSync(wordsFile, 'utf8'))
    : { items: [], errors: [] };
  // Checked before merging: overrides patch by id, so a duplicate would disappear there. Overrides
  // cannot create duplicates themselves (an added word with a taken id is an error).
  errors.push(...imported.errors, ...checkEntries(imported.items));
  const overrides = readOverrides(input.overridesDir ?? OVERRIDES_DIR);
  errors.push(...overrides.errors);
  const merged = applyOverrides(imported.items, overrides.files);
  errors.push(...merged.errors);
  const ids = new Set(merged.entries.map((entry) => entry.id));
  const topics = collectTopicWords(input.topicsRoot ?? CONTENT_ROOT, ids);
  errors.push(...topics.errors);
  return { entries: merged.entries, topicWords: topics.topicWords, errors };
}

/** `CREATE TABLE` / `CREATE INDEX` statements derived from db/schema.ts. */
export async function schemaStatements(): Promise<string[]> {
  const empty = await generateSQLiteDrizzleJson({});
  const current = await generateSQLiteDrizzleJson(schema);
  return generateSQLiteMigration(empty, current);
}

export interface DictionaryCounts {
  words: number;
  senses: number;
  examples: number;
  exampleTranslations: number;
  regionalVariants: number;
  topicWords: number;
}

/** Inserts in chunks, below SQLite's limit on bound parameters. */
const CHUNK = 200;

function chunks<T>(rows: readonly T[]): T[][] {
  const result: T[][] = [];
  for (let start = 0; start < rows.length; start += CHUNK) {
    result.push(rows.slice(start, start + CHUNK));
  }
  return result;
}

/** Writes a fresh database file at `path` (replacing any existing one). */
export async function writeDatabase(
  path: string,
  entries: readonly WordEntry[],
  topicWords: readonly TopicWord[],
): Promise<DictionaryCounts> {
  mkdirSync(dirname(path), { recursive: true });
  for (const suffix of ['', '-journal', '-wal', '-shm'])
    rmSync(`${path}${suffix}`, { force: true });

  const rows = {
    words: entries.map(({ senses, examples, regional, ...word }) => ({
      ...word,
      gender: word.gender ?? null,
      plural: word.plural ?? null,
    })),
    senses: entries.flatMap((entry) => {
      const positions = new Map<string, number>();
      return entry.senses.map((sense) => {
        const position = (positions.get(sense.lang) ?? 0) + 1;
        positions.set(sense.lang, position);
        return { wordId: entry.id, ...sense, region: sense.region ?? null, position };
      });
    }),
    examples: entries.flatMap((entry) =>
      entry.examples.map(({ id, de, source }) => ({ id, wordId: entry.id, de, source })),
    ),
    exampleTranslations: entries.flatMap((entry) =>
      entry.examples.flatMap((example) =>
        Object.entries(example.translations).flatMap(([lang, text]) =>
          text ? [{ exampleId: example.id, lang, text }] : [],
        ),
      ),
    ),
    regionalVariants: entries.flatMap((entry) =>
      entry.regional.map((variant) => ({
        wordId: entry.id,
        ...variant,
        note: variant.note ?? null,
      })),
    ),
    topicWords: [...topicWords],
  };

  const client = createClient({ url: `file:${path}` });
  try {
    await client.batch(await schemaStatements(), 'write');
    const db = drizzle(client, { schema });
    await db.transaction(async (tx) => {
      for (const chunk of chunks(rows.words)) await tx.insert(schema.words).values(chunk);
      for (const chunk of chunks(rows.senses)) await tx.insert(schema.senses).values(chunk);
      for (const chunk of chunks(rows.examples)) await tx.insert(schema.examples).values(chunk);
      for (const chunk of chunks(rows.exampleTranslations)) {
        await tx.insert(schema.exampleTranslations).values(chunk);
      }
      for (const chunk of chunks(rows.regionalVariants)) {
        await tx.insert(schema.regionalVariants).values(chunk);
      }
      for (const chunk of chunks(rows.topicWords)) await tx.insert(schema.topicWords).values(chunk);
    });
  } finally {
    client.close();
  }

  return {
    words: rows.words.length,
    senses: rows.senses.length,
    examples: rows.examples.length,
    exampleTranslations: rows.exampleTranslations.length,
    regionalVariants: rows.regionalVariants.length,
    topicWords: rows.topicWords.length,
  };
}

export async function buildDictionary(
  input: DictionaryInput & { out?: string } = {},
): Promise<{ errors: string[]; counts?: DictionaryCounts }> {
  const { entries, topicWords, errors } = loadDictionary(input);
  if (errors.length) return { errors };
  const counts = await writeDatabase(input.out ?? DICTIONARY_DB, entries, topicWords);
  return { errors, counts };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { errors, counts } = await buildDictionary();
  if (errors.length) {
    console.error(`Dictionary: ${errors.length} problem(s), nothing written:`);
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }
  const summary = Object.entries(counts ?? {})
    .map(([table, count]) => `${count} ${table}`)
    .join(', ');
  console.log(`Dictionary: ${summary} → ${DICTIONARY_DB.slice(ROOT.length + 1)}`);
}
