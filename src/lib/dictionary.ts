/**
 * Dictionary data model (CLAUDE.md, "Dictionary"). Pure: shared by the import and build scripts
 * (plain node) and by the dictionary pages.
 *
 * - `db/seed/lemmas-a1-a2.txt`: which words exist and their level (`parseSeed`)
 * - `db/data/words.jsonl`: one `WordEntry` per line, written by scripts/import-wiktionary.ts
 * - `db/overrides/*.yaml`: manual patches and new words (`applyOverrides`); overrides always win
 */
import { z } from 'astro/zod';
import { levelIds, site } from '../config/site.ts';
import { localeCodes } from '../i18n/locales.ts';
import { regionSchema } from './content-schemas.ts';

/** Parts of speech, named as in Wiktextract. */
export const partsOfSpeech = [
  'noun',
  'verb',
  'adj',
  'adv',
  'prep',
  'pron',
  'conj',
  'num',
  'article',
  'particle',
  'intj',
] as const;
export type PartOfSpeech = (typeof partsOfSpeech)[number];

/** Noun genders; `pl` = plural-only noun (`die Eltern`). */
export const genders = ['m', 'f', 'n', 'pl'] as const;
export type Gender = (typeof genders)[number];

export const ARTICLES: Readonly<Record<Gender, string>> = {
  m: 'der',
  f: 'die',
  n: 'das',
  pl: 'die',
};

/** Id suffix for words other than nouns (nouns get their article). */
const POS_SUFFIX: Readonly<Record<Exclude<PartOfSpeech, 'noun'>, string>> = {
  verb: 'verb',
  adj: 'adj',
  adv: 'adv',
  prep: 'prep',
  pron: 'pron',
  conj: 'conj',
  num: 'num',
  article: 'art',
  particle: 'part',
  intj: 'intj',
};

export const dictionarySources = ['wiktionary-en', 'wiktionary-ru', 'manual'] as const;
export type DictionarySource = (typeof dictionarySources)[number];

/** Licence of every entry: Wiktionary data and our own content are both CC BY-SA 4.0. */
export const DICTIONARY_LICENSE = 'CC BY-SA 4.0';

/** Base id (slug) of a word: NFC lowercase lemma + article (nouns) or part of speech. */
export function wordSlug(lemma: string, pos: PartOfSpeech, gender?: Gender): string {
  const base = lemma.normalize('NFC').trim().toLowerCase().replace(/\s+/g, '-');
  if (pos !== 'noun') return `${base}-${POS_SUFFIX[pos]}`;
  if (!gender) throw new Error(`noun "${lemma}" has no gender`);
  return `${base}-${ARTICLES[gender]}`;
}

/** Identity of a word: `(lemma, pos, gender)`. */
export interface WordIdentity {
  lemma: string;
  pos: PartOfSpeech;
  gender?: Gender | undefined;
}

export function identityKey(word: WordIdentity): string {
  return [word.lemma.normalize('NFC'), word.pos, word.gender ?? ''].join('\t');
}

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Ids for a list of words, keyed by `identityKey`. Words whose slugs collide (e.g. `Weg` and `weg`
 * would only collide if their part of speech matched) get `-2`, `-3`, … in a fixed order: exact
 * lemma by code point, then part of speech, then gender. Throws on a duplicate identity.
 */
export function assignIds(words: readonly WordIdentity[]): Map<string, string> {
  const groups = new Map<string, WordIdentity[]>();
  const seen = new Set<string>();
  for (const word of words) {
    const key = identityKey(word);
    if (seen.has(key)) throw new Error(`duplicate word: ${key.replaceAll('\t', ' ').trim()}`);
    seen.add(key);
    const slug = wordSlug(word.lemma, word.pos, word.gender);
    groups.set(slug, [...(groups.get(slug) ?? []), word]);
  }
  const ids = new Map<string, string>();
  for (const [slug, group] of groups) {
    const sorted = [...group].sort(
      (a, b) =>
        compareCodePoints(a.lemma.normalize('NFC'), b.lemma.normalize('NFC')) ||
        compareCodePoints(a.pos, b.pos) ||
        compareCodePoints(a.gender ?? '', b.gender ?? ''),
    );
    sorted.forEach((word, index) => {
      ids.set(identityKey(word), index === 0 ? slug : `${slug}-${index + 1}`);
    });
  }
  return ids;
}

/** True when `id` is the word's slug, optionally with a collision suffix `-2`, `-3`, … */
export function isValidId(id: string, word: WordIdentity): boolean {
  const slug = wordSlug(word.lemma, word.pos, word.gender);
  if (!id.startsWith(`${slug}-`)) return id === slug;
  return /^(?:[2-9]|[1-9]\d+)$/.test(id.slice(slug.length + 1));
}

const text = z.string().trim().min(1);
const lang = z.enum(localeCodes as [string, ...string[]]);
const posSchema = z.enum(partsOfSpeech);
const genderSchema = z.enum(genders);
const levelSchema = z.enum(levelIds);
const statusSchema = z.enum(['draft', 'verified']);
const sourceSchema = z.enum(dictionarySources);
const wordIdSchema = z
  .string()
  .regex(/^[\p{Ll}\d][\p{Ll}\d-]*$/u, 'ids are lowercase letters, digits and dashes');

export const senseSchema = z.strictObject({
  lang,
  gloss: text,
  source: sourceSchema,
  region: regionSchema.optional(),
});
export type Sense = z.infer<typeof senseSchema>;

export const dictionaryExampleSchema = z.strictObject({
  /** `<word id>-x<n>` */
  id: z.string().regex(/^.+-x\d+$/),
  de: text,
  translations: z.partialRecord(lang, text).default({}),
  source: sourceSchema,
});
export type DictionaryExample = z.infer<typeof dictionaryExampleSchema>;

export const regionalVariantSchema = z.strictObject({
  region: regionSchema,
  variant: text,
  note: text.optional(),
});
export type RegionalVariant = z.infer<typeof regionalVariantSchema>;

/** Nouns need a gender; other words must not have one. */
function genderRule(
  word: { pos: PartOfSpeech; gender?: Gender | undefined },
  ctx: z.RefinementCtx,
) {
  if (word.pos === 'noun' && !word.gender) {
    ctx.addIssue({ code: 'custom', path: ['gender'], message: 'nouns need a gender' });
  }
  if (word.pos !== 'noun' && word.gender) {
    ctx.addIssue({ code: 'custom', path: ['gender'], message: 'only nouns have a gender' });
  }
}

/** One line of `db/data/words.jsonl`. Key order here is the key order in the file. */
export const wordEntrySchema = z
  .strictObject({
    id: wordIdSchema,
    lemma: text,
    pos: posSchema,
    gender: genderSchema.optional(),
    plural: text.optional(),
    level: levelSchema,
    status: statusSchema,
    source: sourceSchema,
    sourceUrl: z.url(),
    license: text,
    senses: z.array(senseSchema).default([]),
    examples: z.array(dictionaryExampleSchema).default([]),
    regional: z.array(regionalVariantSchema).default([]),
  })
  .superRefine(genderRule);
export type WordEntry = z.infer<typeof wordEntrySchema>;

/** Sorted by id, one JSON object per line, fixed key order: stable diffs in PRs. */
export function serializeEntries(entries: readonly WordEntry[]): string {
  const lines = [...entries]
    .sort((a, b) => compareCodePoints(a.id, b.id))
    .map((entry) => {
      const parsed = wordEntrySchema.parse(entry);
      const examples = parsed.examples.map((example) => ({
        ...example,
        translations: Object.fromEntries(
          Object.entries(example.translations).sort(([a], [b]) => compareCodePoints(a, b)),
        ),
      }));
      return JSON.stringify({ ...parsed, examples });
    });
  return lines.length ? `${lines.join('\n')}\n` : '';
}

export interface ParseResult<T> {
  items: T[];
  errors: string[];
}

/** Parses `words.jsonl` content; errors carry the line number. */
export function parseEntries(content: string, file = 'words.jsonl'): ParseResult<WordEntry> {
  const items: WordEntry[] = [];
  const errors: string[] = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const where = `${file}:${index + 1}`;
    let data: unknown;
    try {
      data = JSON.parse(line);
    } catch (error) {
      errors.push(`${where}: invalid JSON (${(error as Error).message})`);
      continue;
    }
    const result = wordEntrySchema.safeParse(data);
    if (result.success) items.push(result.data);
    else errors.push(...formatIssues(where, result.error));
  }
  return { items, errors };
}

export function formatIssues(where: string, error: z.ZodError): string[] {
  return error.issues.map(
    (issue) => `${where}: ${issue.path.length ? `${issue.path.join('.')}: ` : ''}${issue.message}`,
  );
}

/** Entries that are not valid together: duplicate ids, ids that do not match the word. */
export function checkEntries(entries: readonly WordEntry[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const identities = new Map<string, string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) errors.push(`duplicate id "${entry.id}"`);
    ids.add(entry.id);
    if (!isValidId(entry.id, entry)) {
      errors.push(
        `id "${entry.id}" does not match ${entry.lemma} (${entry.pos}${entry.gender ? `, ${entry.gender}` : ''}): expected "${wordSlug(entry.lemma, entry.pos, entry.gender)}"`,
      );
    }
    const identity = identityKey(entry);
    const other = identities.get(identity);
    if (other) errors.push(`"${entry.id}" and "${other}" are the same word`);
    identities.set(identity, entry.id);
  }
  return errors;
}

// --- Seed list -----------------------------------------------------------------------------------

export interface SeedWord extends WordIdentity {
  level: (typeof levelIds)[number];
  /** Line number in the seed file */
  line: number;
}

/** `lemma<TAB>pos<TAB>gender<TAB>level`; `-` for no gender, `#` comments, blank lines ignored. */
export function parseSeed(content: string, file = 'lemmas-a1-a2.txt'): ParseResult<SeedWord> {
  const items: SeedWord[] = [];
  const errors: string[] = [];
  const seen = new Map<string, number>();
  for (const [index, raw] of content.split(/\r?\n/).entries()) {
    const line = index + 1;
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue;
    const where = `${file}:${line}`;
    const columns = raw.split('\t').map((column) => column.trim());
    if (columns.length !== 4) {
      errors.push(`${where}: expected 4 tab-separated columns, got ${columns.length}`);
      continue;
    }
    const [lemma, pos, gender, level] = columns as [string, string, string, string];
    const result = z
      .strictObject({
        lemma: text,
        pos: posSchema,
        gender: genderSchema.optional(),
        level: levelSchema,
      })
      .superRefine(genderRule)
      .safeParse({
        lemma: lemma.normalize('NFC'),
        pos,
        gender: gender === '-' ? undefined : gender,
        level,
      });
    if (!result.success) {
      errors.push(...formatIssues(where, result.error));
      continue;
    }
    const word = { ...result.data, line };
    const key = identityKey(word);
    const first = seen.get(key);
    if (first) {
      errors.push(`${where}: duplicate of line ${first}`);
      continue;
    }
    seen.set(key, line);
    items.push(word);
  }
  return { items, errors };
}

// --- Overrides -----------------------------------------------------------------------------------

/** Glosses per locale; a patch replaces all glosses of each locale it lists. */
const glossesSchema = z.partialRecord(lang, z.array(text).min(1));

const overrideExampleSchema = z.strictObject({
  de: text,
  translations: z.partialRecord(lang, text).default({}),
});

export const overridePatchSchema = z.strictObject({
  plural: text.optional(),
  level: levelSchema.optional(),
  status: statusSchema.optional(),
  glosses: glossesSchema.optional(),
  /** Replaces all examples */
  examples: z.array(overrideExampleSchema).optional(),
  /** Replaces all regional variants */
  regional: z.array(regionalVariantSchema).optional(),
});
export type OverridePatch = z.infer<typeof overridePatchSchema>;

export const overrideAddSchema = z
  .strictObject({
    lemma: text,
    pos: posSchema,
    gender: genderSchema.optional(),
    plural: text.optional(),
    level: levelSchema,
    status: statusSchema.default('draft'),
    /** Defaults to the override file on GitHub */
    sourceUrl: z.url().optional(),
    glosses: glossesSchema,
    examples: z.array(overrideExampleSchema).default([]),
    regional: z.array(regionalVariantSchema).default([]),
  })
  .superRefine(genderRule);

/** `db/overrides/<name>.yaml` */
export const overrideFileSchema = z.strictObject({
  /** Field-level patches by word id */
  patch: z.record(z.string(), overridePatchSchema).default({}),
  /** New words that are not in Wiktionary */
  add: z.array(overrideAddSchema).default([]),
});
export type OverrideFile = z.infer<typeof overrideFileSchema>;

export interface RawOverrideFile {
  /** File name, e.g. `austria.yaml` */
  name: string;
  /** Parsed YAML */
  data: unknown;
}

function glossSenses(glosses: Partial<Record<string, string[]>>): Sense[] {
  return Object.entries(glosses).flatMap(([lang, list = []]) =>
    list.map((gloss) => ({ lang, gloss, source: 'manual' as const })),
  );
}

function overrideExamples(
  wordId: string,
  list: readonly z.infer<typeof overrideExampleSchema>[],
): DictionaryExample[] {
  return list.map((example, index) => ({
    id: `${wordId}-x${index + 1}`,
    de: example.de,
    translations: example.translations,
    source: 'manual',
  }));
}

/** Senses in locale order (the order of `localeCodes`), original order within a locale. */
export function sortSenses(senses: readonly Sense[]): Sense[] {
  const rank = (code: string) => localeCodes.indexOf(code as (typeof localeCodes)[number]);
  return senses
    .map((sense, index) => ({ sense, index }))
    .sort((a, b) => rank(a.sense.lang) - rank(b.sense.lang) || a.index - b.index)
    .map(({ sense }) => sense);
}

/**
 * Applies override files (in name order) to the imported entries. Overrides always win. Errors: a
 * patch for an unknown id, the same field patched by two files, an added word whose id is taken.
 */
export function applyOverrides(
  entries: readonly WordEntry[],
  files: readonly RawOverrideFile[],
): { entries: WordEntry[]; errors: string[] } {
  const errors: string[] = [];
  const byId = new Map(entries.map((entry) => [entry.id, structuredClone(entry)]));
  const parsed: { name: string; data: OverrideFile }[] = [];
  for (const file of [...files].sort((a, b) => compareCodePoints(a.name, b.name))) {
    const result = overrideFileSchema.safeParse(file.data ?? {});
    if (result.success) parsed.push({ name: file.name, data: result.data });
    else errors.push(...formatIssues(file.name, result.error));
  }

  for (const { name, data } of parsed) {
    for (const add of data.add) {
      const id = wordSlug(add.lemma, add.pos, add.gender);
      if (byId.has(id)) {
        errors.push(`${name}: cannot add ${add.lemma}: id "${id}" is already taken`);
        continue;
      }
      byId.set(id, {
        id,
        lemma: add.lemma.normalize('NFC'),
        pos: add.pos,
        gender: add.gender,
        plural: add.plural,
        level: add.level,
        status: add.status,
        source: 'manual',
        sourceUrl: add.sourceUrl ?? `${site.repo}/blob/main/db/overrides/${name}`,
        license: DICTIONARY_LICENSE,
        senses: sortSenses(glossSenses(add.glosses)),
        examples: overrideExamples(id, add.examples),
        regional: add.regional,
      });
    }
  }

  const claimed = new Map<string, string>();
  const claim = (name: string, field: string): boolean => {
    const other = claimed.get(field);
    if (other) {
      errors.push(`${name}: ${field} is already patched in ${other}`);
      return false;
    }
    claimed.set(field, name);
    return true;
  };

  for (const { name, data } of parsed) {
    for (const [id, patch] of Object.entries(data.patch)) {
      const entry = byId.get(id);
      if (!entry) {
        errors.push(`${name}: patch for unknown id "${id}"`);
        continue;
      }
      if (patch.plural !== undefined && claim(name, `${id}.plural`)) entry.plural = patch.plural;
      if (patch.level !== undefined && claim(name, `${id}.level`)) entry.level = patch.level;
      if (patch.status !== undefined && claim(name, `${id}.status`)) entry.status = patch.status;
      for (const [lang, list = []] of Object.entries(patch.glosses ?? {})) {
        if (!claim(name, `${id}.glosses.${lang}`)) continue;
        entry.senses = sortSenses([
          ...entry.senses.filter((sense) => sense.lang !== lang),
          ...glossSenses({ [lang]: list }),
        ]);
      }
      if (patch.examples !== undefined && claim(name, `${id}.examples`)) {
        entry.examples = overrideExamples(id, patch.examples);
      }
      if (patch.regional !== undefined && claim(name, `${id}.regional`)) {
        entry.regional = patch.regional;
      }
    }
  }

  return {
    entries: [...byId.values()].sort((a, b) => compareCodePoints(a.id, b.id)),
    errors,
  };
}
