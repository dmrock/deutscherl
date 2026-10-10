/**
 * Wiktionary import (CLAUDE.md, "Dictionary"): kaikki.org Wiktextract JSONL → db/data/words.jsonl.
 *
 * Usage:
 *   node scripts/import-wiktionary.ts <file.jsonl[.gz]> --edition en|ru [--seed <file>] [--out <file>]
 *
 * Input files are the raw Wiktextract downloads (all languages; only German entries are read) or a
 * German-only file. `.gz` is read without unpacking.
 *
 * Each edition replaces only its own data, so the result is deterministic and a re-run changes
 * nothing:
 * - `en` rebuilds every entry from the seed list (db/seed/lemmas-a1-a2.txt): part of speech, gender,
 *   plural, up to 3 English glosses, up to 3 examples with English translations, Austrian senses
 *   and Austrian synonyms. Russian data already in the output is kept for ids that still exist.
 * - `ru` replaces the Russian glosses and the Russian translations of examples. It never changes
 *   grammar fields. Records are matched by (lemma, pos, gender); unclear matches are reported, not
 *   guessed.
 *
 * Overrides (db/overrides/) are never read or written here; scripts/build-dictionary.ts applies
 * them on top.
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';
import {
  assignIds,
  DICTIONARY_LICENSE,
  type DictionaryExample,
  type Gender,
  identityKey,
  parseEntries,
  parseSeed,
  type RegionalVariant,
  type SeedWord,
  type Sense,
  serializeEntries,
  sortSenses,
  type WordEntry,
} from '../src/lib/dictionary.ts';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
export const SEED_FILE = join(ROOT, 'db/seed/lemmas-a1-a2.txt');
export const WORDS_FILE = join(ROOT, 'db/data/words.jsonl');

export type Edition = 'en' | 'ru';

/** At most this many glosses per locale and examples per word. */
export const MAX_GLOSSES = 3;
export const MAX_EXAMPLES = 3;
/** Longer example sentences are left out (quotations, not learner examples). */
const MAX_EXAMPLE_LENGTH = 120;

/** The part of a Wiktextract record this import reads. */
export interface WiktextractRecord {
  word: string;
  pos: string;
  lang_code: string;
  tags?: string[];
  head_templates?: { name: string; args?: Record<string, string> }[];
  forms?: { form: string; tags?: string[]; source?: string }[];
  senses?: WiktextractSense[];
  synonyms?: WiktextractSynonym[];
}

export interface WiktextractSense {
  glosses?: string[];
  tags?: string[];
  examples?: {
    text?: string;
    translation?: string;
    english?: string;
    type?: string;
    ref?: string;
  }[];
  synonyms?: WiktextractSynonym[];
}

export interface WiktextractSynonym {
  word: string;
  tags?: string[];
}

// --- Reading ---------------------------------------------------------------------------------------

const WORD_KEY = /"word": ?"((?:[^"\\]|\\.)*)"/g;

/**
 * German records whose headword is in `words`, grouped by headword, in file order. Lines are
 * pre-filtered by string search, so only candidates are parsed (the English file is ~24 GB).
 */
export async function readRecords(
  file: string,
  words: ReadonlySet<string>,
): Promise<Map<string, WiktextractRecord[]>> {
  const found = new Map<string, WiktextractRecord[]>();
  let input: NodeJS.ReadableStream = createReadStream(file);
  if (file.endsWith('.gz')) input = input.pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Number.POSITIVE_INFINITY });
  for await (const line of lines) {
    if (!line.includes('"lang_code": "de"') && !line.includes('"lang_code":"de"')) continue;
    let candidate = false;
    for (const match of line.matchAll(WORD_KEY)) {
      if (words.has(JSON.parse(`"${match[1]}"`))) {
        candidate = true;
        break;
      }
    }
    if (!candidate) continue;
    const record = JSON.parse(line) as WiktextractRecord;
    if (record.lang_code !== 'de' || !words.has(record.word)) continue;
    found.set(record.word, [...(found.get(record.word) ?? []), record]);
  }
  return found;
}

// --- Shared helpers --------------------------------------------------------------------------------

const GENDER_TAGS: Readonly<Record<string, Gender>> = {
  masculine: 'm',
  feminine: 'f',
  neuter: 'n',
  'plural-only': 'pl',
};

function gendersOf(tags: readonly string[] | undefined): Set<Gender> {
  return new Set((tags ?? []).flatMap((tag) => (GENDER_TAGS[tag] ? [GENDER_TAGS[tag]] : [])));
}

/** "agent noun of lehren: one who teaches, teacher" → "one who teaches, teacher" */
const AGENT_NOUN_PREFIX = /^agent noun of [^:]+:\s*/;
/** Lemmas that Wiktextract tags as forms of another word (`Lehrer`, `Freundin`). */
const DERIVED_LEMMA = /^(?:agent noun of |(?:female|male) equivalent of )/;

/** The specific gloss of a sense (Wiktextract lists parent glosses first). */
function glossOf(sense: WiktextractSense): string | undefined {
  return sense.glosses?.at(-1)?.trim().replace(AGENT_NOUN_PREFIX, '') || undefined;
}

/** An inflected form or spelling variant (but not an agent noun or a female equivalent). */
function isFormOf(sense: WiktextractSense): boolean {
  if (DERIVED_LEMMA.test(sense.glosses?.at(-1)?.trim() ?? '')) return false;
  return (sense.tags ?? []).some((tag) => tag === 'form-of' || tag === 'alt-of');
}

/** A record that only points to another word (inflected form, spelling variant). */
function isFormRecord(record: WiktextractRecord): boolean {
  const senses = record.senses ?? [];
  return senses.length > 0 && senses.every(isFormOf);
}

// --- English edition -------------------------------------------------------------------------------

/** Senses with these tags are not shown to A1–A2 learners. */
const SKIPPED_SENSE_TAGS = new Set([
  'form-of',
  'alt-of',
  'obsolete',
  'archaic',
  'dated',
  'rare',
  'historical',
  'poetic',
  'derogatory',
  'offensive',
  'vulgar',
  'slang',
  'euphemistic',
  'in-compounds',
]);

/** Regions other than Austria: such senses and synonyms are left out (unless also Austrian). */
const OTHER_REGION_TAGS = new Set([
  'regional',
  'Germany',
  'Northern-Germany',
  'Southern-Germany',
  'Bavaria',
  'Berlin',
  'Westphalia',
  'Saxony',
  'Swabia',
  'Switzerland',
  'Liechtenstein',
  'Luxembourg',
]);

/**
 * Austrian variants must be established, standard usage (CLAUDE.md, "Content rules"): synonyms and
 * Austrian senses with these tags are left out.
 */
const SKIPPED_VARIANT_TAGS = new Set([
  ...SKIPPED_SENSE_TAGS,
  'regional',
  'colloquial',
  'informal',
  'nonstandard',
]);

function isAustrian(tags: readonly string[] | undefined): boolean {
  return (tags ?? []).includes('Austria');
}

/** Genders of a German noun record: sense tags plus the `de-noun` head template (`m,(e)s`, `n:m`). */
function recordGenders(record: WiktextractRecord): Set<Gender> {
  const genders = gendersOf([
    ...(record.tags ?? []),
    ...(record.senses ?? []).flatMap((sense) => sense.tags ?? []),
  ]);
  for (const head of record.head_templates ?? []) {
    if (head.name !== 'de-noun') continue;
    const spec = head.args?.['1']?.split(',')[0] ?? '';
    for (const part of spec.split(':')) {
      const letter = part.trim().charAt(0);
      if (letter === 'm' || letter === 'f' || letter === 'n') genders.add(letter);
      if (letter === 'p') genders.add('pl');
    }
  }
  return genders;
}

/**
 * Senses shown to learners: no obsolete, slang, form-of, … senses, no colloquial Austrian senses,
 * and no senses of other regions. When the region rule would leave nothing (e.g. `Taxi`, whose only
 * sense is tagged for its Swiss gender), it is dropped.
 */
function keptEnSenses(record: WiktextractRecord): WiktextractSense[] {
  const usable = (record.senses ?? []).filter((sense) => {
    const tags = sense.tags ?? [];
    if (!glossOf(sense) || isFormOf(sense)) return false;
    if (tags.some((tag) => SKIPPED_SENSE_TAGS.has(tag) && tag !== 'form-of')) return false;
    return !(isAustrian(tags) && tags.some((tag) => SKIPPED_VARIANT_TAGS.has(tag)));
  });
  const outsideOtherRegions = usable.filter(
    (sense) =>
      isAustrian(sense.tags) || !(sense.tags ?? []).some((tag) => OTHER_REGION_TAGS.has(tag)),
  );
  return outsideOtherRegions.length ? outsideOtherRegions : usable;
}

const STOPWORDS = new Set(
  'the and for with any one someone something which that from into used synonym who whom its'.split(
    ' ',
  ),
);

/** Content words of English glosses, for comparing meanings. */
function meaningWords(glosses: readonly string[]): Set<string> {
  return new Set(
    glosses.flatMap((gloss) =>
      (gloss.toLowerCase().match(/\p{L}+/gu) ?? []).filter(
        (word) => word.length >= 3 && !STOPWORDS.has(word),
      ),
    ),
  );
}

/** True when two sets of glosses share a content word (`chair` in `a chair (to sit on)`). */
export function sameMeaning(a: readonly string[], b: readonly string[]): boolean {
  const words = meaningWords(b);
  return [...meaningWords(a)].some((word) => words.has(word));
}

/** English-edition records for a seed word: same lemma and pos, and the seed gender for nouns. */
export function matchEnRecords(
  seed: SeedWord,
  records: readonly WiktextractRecord[],
): WiktextractRecord[] {
  return records.filter((record) => {
    if (record.word !== seed.lemma || record.pos !== seed.pos || isFormRecord(record)) return false;
    if (seed.pos !== 'noun' || !seed.gender) return true;
    return recordGenders(record).has(seed.gender);
  });
}

export interface SynonymCandidate {
  word: string;
  /** English glosses of the sense the synonym belongs to */
  glosses: string[];
}

export interface EnWordData {
  plural?: string;
  senses: Sense[];
  /** Examples without ids */
  examples: { de: string; en: string }[];
  /** Synonyms tagged as Austrian */
  regional: RegionalVariant[];
  /** Untagged synonyms: Austrian if their own entry says so with the same meaning (second pass) */
  synonymCandidates: SynonymCandidate[];
}

/**
 * Grammar, glosses, examples and Austrian synonyms from the matching records. Several records are
 * homonyms with the same identity (`Bank`: bench, plural `Bänke`, and bank, plural `Banken`): the
 * plural and the first glosses come from the first record (Wiktionary lists the main etymology
 * first), later records only fill the remaining gloss slots. The import report lists such words, so
 * the owner can patch them in db/overrides/.
 */
export function parseEnRecords(records: readonly WiktextractRecord[]): EnWordData {
  const kept = records.map((record) => keptEnSenses(record));
  const senses: Sense[] = [];
  for (const sense of kept.flat()) {
    const gloss = glossOf(sense) as string;
    if (senses.some((existing) => existing.gloss === gloss)) continue;
    senses.push({
      lang: 'en',
      gloss,
      source: 'wiktionary-en',
      ...(isAustrian(sense.tags) ? { region: 'AT' as const } : {}),
    });
  }

  const examples: { de: string; en: string }[] = [];
  for (const sense of kept.flat()) {
    for (const example of sense.examples ?? []) {
      const de = example.text?.trim();
      const en = (example.english ?? example.translation)?.trim();
      if (!de || !en || example.ref || (example.type && example.type !== 'example')) continue;
      if (de.includes('\n') || de.length > MAX_EXAMPLE_LENGTH) continue;
      if (!examples.some((existing) => existing.de === de)) examples.push({ de, en });
    }
  }

  // Synonyms of the main sense (the first kept sense) and of the whole word only: a synonym of a
  // secondary sense (`passieren` "to strain" → `seihen`) is not a variant of the word.
  const regional: RegionalVariant[] = [];
  const candidates: SynonymCandidate[] = [];
  const addSynonym = (synonym: WiktextractSynonym, glosses: string[]) => {
    const tags = synonym.tags ?? [];
    if (!synonym.word || tags.some((tag) => SKIPPED_VARIANT_TAGS.has(tag))) return;
    if (regional.some((variant) => variant.variant === synonym.word)) return;
    if (isAustrian(tags)) regional.push({ region: 'AT', variant: synonym.word });
    else if (tags.length === 0) candidates.push({ word: synonym.word, glosses });
  };
  records.forEach((record, index) => {
    const recordSenses = kept[index] ?? [];
    const main = recordSenses[0];
    if (main) {
      for (const synonym of main.synonyms ?? []) addSynonym(synonym, [glossOf(main) as string]);
    }
    const all = recordSenses.map((sense) => glossOf(sense) as string);
    for (const synonym of record.synonyms ?? []) addSynonym(synonym, all);
  });

  const firstRecord = records[0];
  const plural = firstRecord?.forms?.find(
    // Head forms (no `source`) tagged exactly `plural`; declension tables repeat them with cases.
    (form) => !form.source && form.tags?.length === 1 && form.tags[0] === 'plural',
  )?.form;
  return {
    ...(plural ? { plural } : {}),
    senses: senses.slice(0, MAX_GLOSSES),
    examples: examples.slice(0, MAX_EXAMPLES),
    regional,
    synonymCandidates: candidates.filter(
      (candidate) => !regional.some((variant) => variant.variant === candidate.word),
    ),
  };
}

/** English glosses of a record's established Austrian senses (not colloquial, dated, …). */
export function austrianGlosses(record: WiktextractRecord): string[] {
  return (record.senses ?? []).flatMap((sense) => {
    const gloss = glossOf(sense);
    const tags = sense.tags ?? [];
    return gloss && isAustrian(tags) && !tags.some((tag) => SKIPPED_VARIANT_TAGS.has(tag))
      ? [gloss]
      : [];
  });
}

export function wiktionaryUrl(edition: Edition, lemma: string): string {
  const title = encodeURIComponent(lemma.replaceAll(' ', '_'));
  return edition === 'en'
    ? `https://en.wiktionary.org/wiki/${title}#German`
    : `https://ru.wiktionary.org/wiki/${title}`;
}

export interface EnReport {
  seed: number;
  imported: number;
  notFound: string[];
  /** Words built from more than one record (e.g. `Bank`: bench and bank) */
  merged: string[];
  missingGlosses: string[];
  austrian: string[];
}

/** Russian data of the previous output, kept for ids that still exist after an `en` import. */
function keepRussian(entry: WordEntry, previous: WordEntry | undefined): WordEntry {
  if (!previous) return entry;
  const ruTranslations = new Map(
    previous.examples.flatMap((example) =>
      example.translations.ru ? [[example.de, example.translations.ru] as const] : [],
    ),
  );
  return {
    ...entry,
    senses: sortSenses([
      ...entry.senses,
      ...previous.senses.filter((sense) => sense.source === 'wiktionary-ru'),
    ]),
    examples: entry.examples.map((example) => {
      const ru = ruTranslations.get(example.de);
      return ru ? { ...example, translations: { ...example.translations, ru } } : example;
    }),
  };
}

/**
 * Builds the entries of the English edition. `records` are the seed lemmas' records,
 * `austrian` the Austrian glosses of untagged synonyms by `<word>\t<pos>` (second pass): such a
 * synonym is a variant when one of them has the same meaning as the sense it belongs to.
 */
export function buildEnEntries(
  seed: readonly SeedWord[],
  records: ReadonlyMap<string, readonly WiktextractRecord[]>,
  austrian: ReadonlyMap<string, readonly string[]>,
  previous: readonly WordEntry[] = [],
): { entries: WordEntry[]; report: EnReport } {
  const report: EnReport = {
    seed: seed.length,
    imported: 0,
    notFound: [],
    merged: [],
    missingGlosses: [],
    austrian: [],
  };
  const found: { word: SeedWord; data: EnWordData }[] = [];
  for (const word of seed) {
    const matches = matchEnRecords(word, records.get(word.lemma) ?? []);
    const label = `${word.lemma} (${word.pos}${word.gender ? `, ${word.gender}` : ''})`;
    if (matches.length === 0) {
      report.notFound.push(label);
      continue;
    }
    if (matches.length > 1) {
      const parts = matches.map((record) => {
        const data = parseEnRecords([record]);
        return `${data.senses[0]?.gloss ?? '?'} (plural ${data.plural ?? '-'})`;
      });
      report.merged.push(`${label}: ${parts.join(' | ')}`);
    }
    found.push({ word, data: parseEnRecords(matches) });
  }

  const ids = assignIds(found.map(({ word }) => word));
  const previousById = new Map(previous.map((entry) => [entry.id, entry]));
  const entries = found.map(({ word, data }) => {
    const id = ids.get(identityKey(word)) as string;
    const regional = [
      ...data.regional,
      ...data.synonymCandidates
        .filter((candidate) =>
          sameMeaning(candidate.glosses, austrian.get(`${candidate.word}\t${word.pos}`) ?? []),
        )
        .map((candidate) => ({ region: 'AT' as const, variant: candidate.word })),
    ];
    if (data.senses.length === 0) report.missingGlosses.push(id);
    if (regional.length || data.senses.some((sense) => sense.region)) {
      const senses = data.senses.filter((sense) => sense.region).length;
      report.austrian.push(
        `${id}: ${[...regional.map((variant) => variant.variant), ...(senses ? [`${senses} Austrian sense(s)`] : [])].join(', ')}`,
      );
    }
    const examples: DictionaryExample[] = data.examples.map((example, index) => ({
      id: `${id}-x${index + 1}`,
      de: example.de,
      translations: { en: example.en },
      source: 'wiktionary-en',
    }));
    const entry: WordEntry = {
      id,
      lemma: word.lemma,
      pos: word.pos,
      ...(word.gender ? { gender: word.gender } : {}),
      ...(data.plural ? { plural: data.plural } : {}),
      level: word.level,
      status: 'draft',
      source: 'wiktionary-en',
      sourceUrl: wiktionaryUrl('en', word.lemma),
      license: DICTIONARY_LICENSE,
      senses: data.senses,
      examples,
      regional,
    };
    return keepRussian(entry, previousById.get(id));
  });
  report.imported = entries.length;
  return { entries, report };
}

// --- Russian edition -------------------------------------------------------------------------------

/**
 * A usage label at the start of a gloss: one or more abbreviations ending in a dot, optionally
 * separated by commas (e.g. "obsolete." or "figurative., colloquial." in the Russian edition).
 * Detected by shape, so no Russian text is needed here.
 */
const LEADING_LABEL = /^(?:\p{L}{1,8}\.\s*)+(?:,\s*(?:\p{L}{1,8}\.\s*)+)*/u;

/**
 * Russian glosses of matched records: the first sense of each record (a leading label stripped,
 * e.g. an anatomy label before the main sense of `Arm`), then later senses without a label
 * (labelled senses are obsolete, figurative, colloquial, … meanings).
 */
export function parseRuRecords(records: readonly WiktextractRecord[]): {
  glosses: string[];
  examples: { de: string; ru: string }[];
} {
  const glosses: string[] = [];
  const examples: { de: string; ru: string }[] = [];
  for (const record of records) {
    let first = true;
    for (const sense of record.senses ?? []) {
      if (isFormOf(sense)) continue;
      const raw = glossOf(sense);
      if (!raw) continue;
      const label = LEADING_LABEL.exec(raw)?.[0] ?? '';
      // Some glosses carry an inline example after a dash ("<gloss>. — <example>").
      const gloss = (raw.slice(label.length).split(/\s+\u2014\s+/)[0] ?? '')
        .trim()
        .replace(/\.$/, '');
      const keep = gloss && (first || !label);
      first = false;
      if (keep && !glosses.includes(gloss)) glosses.push(gloss);
      for (const example of sense.examples ?? []) {
        const de = example.text?.trim();
        const ru = example.translation?.trim();
        if (de && ru && !examples.some((existing) => existing.de === de)) examples.push({ de, ru });
      }
    }
  }
  return { glosses: glosses.slice(0, MAX_GLOSSES), examples };
}

export type RuMatch =
  | { status: 'matched'; records: WiktextractRecord[]; unknownPos?: boolean }
  | { status: 'not-found' }
  | { status: 'ambiguous'; reason: string };

/**
 * Russian-edition records for an entry, by (lemma, pos, gender). Records with the entry's gender
 * are merged (like `Bank`: bench and bank). A record without a gender tag is used only when it is
 * the single candidate; anything else is ambiguous. Wiktextract could not classify some Russian
 * entries (`pos: unknown`, e.g. `aber`, `um`): for words other than nouns, a single such record is
 * used when no record has the right part of speech, and the report lists it.
 */
export function matchRuRecords(entry: WordEntry, records: readonly WiktextractRecord[]): RuMatch {
  const usable = records.filter((record) => record.word === entry.lemma && !isFormRecord(record));
  const candidates = usable.filter((record) => record.pos === entry.pos);
  if (candidates.length === 0) {
    const unknown = usable.filter((record) => record.pos === 'unknown');
    if (entry.pos !== 'noun' && unknown.length === 1) {
      return { status: 'matched', records: unknown, unknownPos: true };
    }
    return { status: 'not-found' };
  }
  if (entry.pos !== 'noun') return { status: 'matched', records: candidates };
  const withGender = candidates.filter((record) => gendersOf(record.tags).size > 0);
  const same = withGender.filter(
    (record) => entry.gender && gendersOf(record.tags).has(entry.gender),
  );
  if (same.length) return { status: 'matched', records: same };
  const without = candidates.filter((record) => gendersOf(record.tags).size === 0);
  if (without.length === 1 && withGender.length === 0) {
    return { status: 'matched', records: without };
  }
  const found = candidates.map((record) => [...gendersOf(record.tags)].join('/') || '?').join(', ');
  return { status: 'ambiguous', reason: `genders ${found}, expected ${entry.gender}` };
}

export interface RuReport {
  entries: number;
  matched: number;
  notFound: string[];
  ambiguous: string[];
  merged: string[];
  /** Matched to a record whose part of speech Wiktextract could not tell */
  unknownPos: string[];
  missingGlosses: string[];
  exampleTranslations: number;
  /** Russian-edition examples without the same German sentence in the entry */
  unmatchedExamples: number;
}

/** Replaces the Russian glosses and example translations of every entry. */
export function applyRuEdition(
  entries: readonly WordEntry[],
  records: ReadonlyMap<string, readonly WiktextractRecord[]>,
): { entries: WordEntry[]; report: RuReport } {
  const report: RuReport = {
    entries: entries.length,
    matched: 0,
    notFound: [],
    ambiguous: [],
    merged: [],
    unknownPos: [],
    missingGlosses: [],
    exampleTranslations: 0,
    unmatchedExamples: 0,
  };
  const result = entries.map((original) => {
    const entry: WordEntry = {
      ...original,
      senses: original.senses.filter((sense) => sense.source !== 'wiktionary-ru'),
      examples: original.examples.map(({ translations: { ru: _ru, ...rest }, ...example }) => ({
        ...example,
        translations: rest,
      })),
    };
    if (entry.source === 'manual') return entry;
    const match = matchRuRecords(entry, records.get(entry.lemma) ?? []);
    if (match.status === 'not-found') {
      report.notFound.push(entry.id);
      report.missingGlosses.push(entry.id);
      return entry;
    }
    if (match.status === 'ambiguous') {
      report.ambiguous.push(`${entry.id}: ${match.reason}`);
      report.missingGlosses.push(entry.id);
      return entry;
    }
    report.matched += 1;
    if (match.records.length > 1) report.merged.push(entry.id);
    if (match.unknownPos) report.unknownPos.push(entry.id);
    const { glosses, examples } = parseRuRecords(match.records);
    if (glosses.length === 0) report.missingGlosses.push(entry.id);
    const translations = new Map(examples.map((example) => [example.de, example.ru]));
    let used = 0;
    const withRu = entry.examples.map((example) => {
      const ru = translations.get(example.de);
      if (!ru) return example;
      used += 1;
      return { ...example, translations: { ...example.translations, ru } };
    });
    report.exampleTranslations += used;
    report.unmatchedExamples += examples.length - used;
    return {
      ...entry,
      senses: sortSenses([
        ...entry.senses,
        ...glosses.map((gloss) => ({ lang: 'ru', gloss, source: 'wiktionary-ru' as const })),
      ]),
      examples: withRu,
    };
  });
  return { entries: result, report };
}

// --- CLI -------------------------------------------------------------------------------------------

function readPrevious(file: string): WordEntry[] {
  if (!existsSync(file)) return [];
  const { items, errors } = parseEntries(readFileSync(file, 'utf8'), file);
  if (errors.length) throw new Error(`${file} is not valid:\n  ${errors.join('\n  ')}`);
  return items;
}

function printList(title: string, items: readonly string[]): void {
  console.log(`${title}: ${items.length}`);
  for (const item of items) console.log(`  ${item}`);
}

export async function importEdition(options: {
  file: string;
  edition: Edition;
  seedFile?: string;
  out?: string;
}): Promise<EnReport | RuReport> {
  const out = options.out ?? WORDS_FILE;
  const previous = readPrevious(out);

  if (options.edition === 'ru') {
    const lemmas = new Set(previous.map((entry) => entry.lemma));
    const records = await readRecords(options.file, lemmas);
    const { entries, report } = applyRuEdition(previous, records);
    writeFileSync(out, serializeEntries(entries));
    return report;
  }

  const seed = parseSeed(readFileSync(options.seedFile ?? SEED_FILE, 'utf8'));
  if (seed.errors.length) throw new Error(`Seed list is not valid:\n  ${seed.errors.join('\n  ')}`);
  const records = await readRecords(options.file, new Set(seed.items.map((word) => word.lemma)));
  // Second pass: an untagged synonym is Austrian when its own entry has an Austrian sense.
  const candidates = new Set<string>();
  for (const word of seed.items) {
    const data = parseEnRecords(matchEnRecords(word, records.get(word.lemma) ?? []));
    for (const synonym of data.synonymCandidates) candidates.add(synonym.word);
  }
  const synonymRecords = await readRecords(options.file, candidates);
  const austrian = new Map<string, string[]>();
  for (const [word, list] of synonymRecords) {
    for (const record of list) {
      const glosses = austrianGlosses(record);
      const key = `${word}\t${record.pos}`;
      if (glosses.length) austrian.set(key, [...(austrian.get(key) ?? []), ...glosses]);
    }
  }
  const { entries, report } = buildEnEntries(seed.items, records, austrian, previous);
  writeFileSync(out, serializeEntries(entries));
  return report;
}

function parseArgs(argv: readonly string[]): {
  file: string;
  edition: Edition;
  seedFile?: string;
  out?: string;
} {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;
    if (arg.startsWith('--')) {
      flags.set(arg.slice(2), argv[index + 1] ?? '');
      index += 1;
    } else positional.push(arg);
  }
  const edition = flags.get('edition');
  const [file] = positional;
  if (!file || (edition !== 'en' && edition !== 'ru')) {
    throw new Error(
      'Usage: node scripts/import-wiktionary.ts <file.jsonl[.gz]> --edition en|ru [--seed <file>] [--out <file>]',
    );
  }
  return {
    file,
    edition,
    ...(flags.get('seed') ? { seedFile: flags.get('seed') as string } : {}),
    ...(flags.get('out') ? { out: flags.get('out') as string } : {}),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const started = Date.now();
    const report = await importEdition(options);
    console.log(`Edition ${options.edition}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
    if ('seed' in report) {
      console.log(`Imported: ${report.imported} of ${report.seed} seed words`);
      printList('Not found', report.notFound);
      printList('Merged from several records', report.merged);
      printList('Missing en glosses', report.missingGlosses);
      printList('Austrian data', report.austrian);
    } else {
      console.log(`Matched: ${report.matched} of ${report.entries} entries`);
      printList('Not found', report.notFound);
      printList('Ambiguous', report.ambiguous);
      printList('Merged from several records', report.merged);
      printList('Matched by lemma only (part of speech unknown)', report.unknownPos);
      printList('Missing ru glosses', report.missingGlosses);
      console.log(`Russian example translations: ${report.exampleTranslations}`);
      console.log(`Russian examples without the same German sentence: ${report.unmatchedExamples}`);
    }
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
