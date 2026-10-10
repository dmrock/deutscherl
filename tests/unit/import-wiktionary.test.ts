import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadDictionary } from '../../scripts/build-dictionary.ts';
import {
  applyRuEdition,
  type EnReport,
  importEdition,
  parseRuRecords,
  type RuReport,
  readRecords,
  sameMeaning,
  type WiktextractRecord,
} from '../../scripts/import-wiktionary.ts';
import { parseEntries, type WordEntry } from '../../src/lib/dictionary.ts';

const FIXTURES = join(import.meta.dirname, '../fixtures');
/** Trimmed real records of the English edition, plus a few synthetic edge cases at the end. */
const EN_FILE = join(FIXTURES, 'dictionary/en-edition.jsonl');
/** Trimmed real records of the Russian edition (localization fixture), plus synthetic ones. */
const RU_FILE = join(FIXTURES, 'i18n/ru/dictionary/ru-edition.jsonl');

const ruRecords: WiktextractRecord[] = readFileSync(RU_FILE, 'utf8')
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));

function ruRecord(word: string, predicate: (record: WiktextractRecord) => boolean = () => true) {
  const record = ruRecords.find((candidate) => candidate.word === word && predicate(candidate));
  if (!record) throw new Error(`no ru fixture record for ${word}`);
  return record;
}

const SEED = [
  'See\tnoun\tm\ta1',
  'See\tnoun\tf\ta2',
  'essen\tverb\t-\ta1',
  'Essen\tnoun\tn\ta1',
  'Kartoffel\tnoun\tf\ta1',
  'Januar\tnoun\tm\ta1',
  'Lehrer\tnoun\tm\ta1',
  'Bank\tnoun\tf\ta1',
  'Taxi\tnoun\tn\ta1',
  'Brötchen\tnoun\tn\ta1',
  'Eltern\tnoun\tpl\ta1',
  'schnell\tadj\t-\ta1',
  'Geld\tnoun\tn\ta1',
  'passieren\tverb\t-\ta2',
  'Hund\tnoun\tm\ta1',
].join('\n');

let dir: string;
let seedFile: string;
let out: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deutscherl-import-'));
  seedFile = join(dir, 'seed.txt');
  out = join(dir, 'words.jsonl');
  writeFileSync(seedFile, `# test seed\n${SEED}\n`);
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function entries(): Map<string, WordEntry> {
  const { items, errors } = parseEntries(readFileSync(out, 'utf8'));
  expect(errors).toEqual([]);
  return new Map(items.map((entry) => [entry.id, entry]));
}

function entry(id: string): WordEntry {
  const found = entries().get(id);
  if (!found) throw new Error(`no entry ${id}`);
  return found;
}

const glosses = (word: WordEntry, lang: string) =>
  word.senses.filter((sense) => sense.lang === lang).map((sense) => sense.gloss);

const importEn = (file = EN_FILE) =>
  importEdition({ file, edition: 'en', seedFile, out }) as Promise<EnReport>;
const importRu = () => importEdition({ file: RU_FILE, edition: 'ru', out }) as Promise<RuReport>;

describe('readRecords', () => {
  it('reads only German records with a wanted headword', async () => {
    const records = await readRecords(EN_FILE, new Set(['See', 'Hund']));
    expect([...records.keys()]).toEqual(['See']);
    expect(records.get('See')?.map((record) => `${record.pos}:${record.lang_code}`)).toEqual([
      'noun:de',
      'noun:de',
      'name:de',
    ]);
  });

  it('reads gzip files', async () => {
    const gz = join(dir, 'en.jsonl.gz');
    writeFileSync(gz, gzipSync(readFileSync(EN_FILE)));
    const records = await readRecords(gz, new Set(['Bank']));
    expect(records.get('Bank')).toHaveLength(2);
  });
});

describe('import: English edition', () => {
  it('reports imported, not found and merged words', async () => {
    const report = await importEn();
    expect(report.seed).toBe(15);
    expect(report.imported).toBe(14);
    expect(report.notFound).toEqual(['Hund (noun, m)']);
    expect(report.merged).toEqual([
      expect.stringMatching(/^Bank \(noun, f\): bench .*Bänke.*Banken/),
    ]);
    expect(report.missingGlosses).toEqual([]);
  });

  it('keeps homonyms apart by gender and part of speech', async () => {
    await importEn();
    expect(entry('see-der')).toMatchObject({ gender: 'm', plural: 'Seen', level: 'a1' });
    expect(glosses(entry('see-der'), 'en')).toEqual(['lake']);
    expect(glosses(entry('see-die'), 'en')[0]).toBe('sea, ocean');
    expect(entry('essen-verb').gender).toBeUndefined();
    expect(entry('essen-das').gender).toBe('n');
  });

  it('writes draft entries with source and licence', async () => {
    await importEn();
    expect(entry('see-der')).toMatchObject({
      status: 'draft',
      source: 'wiktionary-en',
      sourceUrl: 'https://en.wiktionary.org/wiki/See#German',
      license: 'CC BY-SA 4.0',
    });
  });

  it('takes at most 3 glosses and examples with their English translation', async () => {
    await importEn();
    const essen = entry('essen-verb');
    expect(glosses(essen, 'en').length).toBeLessThanOrEqual(3);
    expect(essen.examples.length).toBeGreaterThan(0);
    expect(essen.examples.length).toBeLessThanOrEqual(3);
    expect(essen.examples[0]).toEqual({
      id: 'essen-verb-x1',
      de: 'Er isst gern Schokolade.',
      translations: { en: 'He likes eating chocolate.' },
      source: 'wiktionary-en',
    });
  });

  it('takes the plural and the first glosses of merged homonyms from the first record', async () => {
    await importEn();
    expect(entry('bank-die').plural).toBe('Bänke');
    expect(glosses(entry('bank-die'), 'en')[0]).toMatch(/^bench/);
  });

  it('reads gender from the head template and keeps agent nouns', async () => {
    await importEn();
    expect(glosses(entry('lehrer-der'), 'en')[0]).toMatch(/^one who teaches, teacher/);
    expect(entry('eltern-die').gender).toBe('pl');
  });

  it('keeps a sense tagged for another region when it is the only one', async () => {
    await importEn();
    expect(glosses(entry('taxi-das'), 'en')).toEqual(['taxi, cab']);
  });

  it('marks Austrian senses', async () => {
    await importEn();
    const austrian = entry('brötchen-das').senses.filter((sense) => sense.region === 'AT');
    expect(austrian).toHaveLength(1);
  });

  it('finds Austrian variants: tagged synonyms, and untagged ones with the same meaning', async () => {
    await importEn();
    // Erdapfel is tagged Austria; Bramburi is tagged Austria but dated.
    expect(entry('kartoffel-die').regional.map((variant) => variant.variant)).toEqual(['Erdapfel']);
    // Jänner is untagged on Januar; its own entry is Austrian and means January.
    expect(entry('januar-der').regional).toEqual([{ region: 'AT', variant: 'Jänner' }]);
  });

  it('rejects Austrian variants with another meaning, colloquial ones and those of a secondary sense', async () => {
    await importEn();
    // Knödel: Austrian "dumpling" is not "money", and "money" is colloquial.
    expect(entry('geld-das').regional).toEqual([]);
    // seihen is a synonym of "to strain", not of the main sense "to happen".
    expect(entry('passieren-verb').regional).toEqual([]);
  });

  it('writes sorted entries and the same bytes on a second run', async () => {
    await importEn();
    const first = readFileSync(out, 'utf8');
    const ids = first
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line).id);
    expect(ids).toEqual([...ids].sort());
    await importEn();
    expect(readFileSync(out, 'utf8')).toBe(first);
  });
});

describe('import: Russian edition', () => {
  it('adds Russian glosses without changing grammar fields', async () => {
    await importEn();
    const before = entries();
    const report = await importRu();
    const after = entries();
    for (const [id, word] of after) {
      const { senses, examples, ...grammar } = word;
      const { senses: _s, examples: _e, ...previous } = before.get(id) as WordEntry;
      expect(grammar).toEqual(previous);
    }
    const lake = ruRecord('See', (record) => record.tags?.includes('masculine') ?? false);
    expect(glosses(after.get('see-der') as WordEntry, 'ru')).toEqual([
      lake.senses?.[0]?.glosses?.[0],
    ]);
    expect(after.get('see-der')?.senses.find((sense) => sense.lang === 'ru')?.source).toBe(
      'wiktionary-ru',
    );
    expect(report.notFound).toEqual(expect.arrayContaining(['lehrer-der', 'taxi-das']));
  });

  it('skips labelled senses after the first one', async () => {
    await importEn();
    await importRu();
    // The third Kartoffel sense starts with a usage label.
    const kartoffel = ruRecord('Kartoffel');
    expect(glosses(entry('kartoffel-die'), 'ru')).toEqual(
      kartoffel.senses?.slice(0, 2).map((sense) => sense.glosses?.[0]),
    );
  });

  it('adds the Russian translation to an example with the same German sentence', async () => {
    await importEn();
    const report = await importRu();
    const example = entry('essen-verb').examples.find(
      (item) => item.de === 'Ich esse einen Apfel.',
    );
    const ru = ruRecord('essen')
      .senses?.flatMap((sense) => sense.examples ?? [])
      .find((item) => item.text === 'Ich esse einen Apfel.')?.translation;
    expect(ru).toBeTruthy();
    expect(example?.translations).toEqual({ en: 'I am eating an apple.', ru });
    expect(report.exampleTranslations).toBeGreaterThan(0);
  });

  it('merges records of the same gender and reports them', async () => {
    await importEn();
    const report = await importRu();
    expect(report.merged).toContain('bank-die');
  });

  it('is idempotent, and a new English import keeps the Russian data', async () => {
    await importEn();
    await importRu();
    const first = readFileSync(out, 'utf8');
    await importRu();
    expect(readFileSync(out, 'utf8')).toBe(first);
    await importEn();
    expect(readFileSync(out, 'utf8')).toBe(first);
  });

  it('reports an ambiguous match instead of guessing', () => {
    const kiefer: WordEntry = {
      id: 'kiefer-der',
      lemma: 'Kiefer',
      pos: 'noun',
      gender: 'm',
      level: 'a2',
      status: 'draft',
      source: 'wiktionary-en',
      sourceUrl: 'https://en.wiktionary.org/wiki/Kiefer#German',
      license: 'CC BY-SA 4.0',
      senses: [],
      examples: [],
      regional: [],
    };
    const { entries: result, report } = applyRuEdition(
      [kiefer],
      new Map([['Kiefer', ruRecords.filter((record) => record.word === 'Kiefer')]]),
    );
    expect(report.ambiguous).toEqual(['kiefer-der: genders ?, ?, expected m']);
    expect(report.missingGlosses).toEqual(['kiefer-der']);
    expect(result[0]?.senses).toEqual([]);
  });

  it('uses a single record of unknown part of speech and reports it', () => {
    const aber: WordEntry = {
      id: 'aber-conj',
      lemma: 'aber',
      pos: 'conj',
      level: 'a1',
      status: 'draft',
      source: 'wiktionary-en',
      sourceUrl: 'https://en.wiktionary.org/wiki/aber#German',
      license: 'CC BY-SA 4.0',
      senses: [],
      examples: [],
      regional: [],
    };
    const { entries: result, report } = applyRuEdition(
      [aber],
      new Map([['aber', [ruRecord('aber')]]]),
    );
    expect(report.unknownPos).toEqual(['aber-conj']);
    expect(glosses(result[0] as WordEntry, 'ru')).toEqual([
      ruRecord('aber').senses?.[0]?.glosses?.[0],
    ]);
  });

  it('strips a leading label from the first sense and inline examples after a dash', () => {
    const arm = ruRecord('Arm');
    const first = arm.senses?.[0]?.glosses?.[0] ?? '';
    expect(parseRuRecords([arm]).glosses[0]).toBe(first.slice(first.indexOf('. ') + 2));
    const hinter = parseRuRecords([ruRecord('hinter')]).glosses;
    expect(hinter.length).toBeGreaterThan(0);
    for (const gloss of hinter) {
      expect(gloss).not.toContain('—');
      expect(gloss).not.toMatch(/\.$/);
    }
  });
});

describe('re-import keeps overrides', () => {
  it('never touches override files, and the build still applies them', async () => {
    await importEn();
    const overridesDir = join(dir, 'overrides');
    mkdirSync(overridesDir);
    const override = 'patch:\n  see-der:\n    level: a2\n    glosses:\n      en: [lake, pond]\n';
    writeFileSync(join(overridesDir, 'fixes.yaml'), override);
    const topicsRoot = join(dir, 'no-topics');
    const build = () => loadDictionary({ wordsFile: out, overridesDir, topicsRoot });

    expect(build().errors).toEqual([]);
    await importEn();
    await importRu();
    expect(readFileSync(join(overridesDir, 'fixes.yaml'), 'utf8')).toBe(override);
    const { entries: merged, errors } = build();
    expect(errors).toEqual([]);
    const see = merged.find((word) => word.id === 'see-der') as WordEntry;
    expect(see.level).toBe('a2');
    expect(glosses(see, 'en')).toEqual(['lake', 'pond']);
    // The Russian gloss from the import is still there.
    expect(glosses(see, 'ru')).toHaveLength(1);
    // The imported file itself keeps the Wiktionary value.
    expect(entry('see-der').level).toBe('a1');
  });
});

describe('sameMeaning', () => {
  it('compares content words of English glosses', () => {
    expect(sameMeaning(['a chair (to sit on)'], ['chair (any item of furniture)'])).toBe(true);
    expect(sameMeaning(['January (the first month)'], ['synonym of Januar ("January")'])).toBe(
      true,
    );
    expect(sameMeaning(['money'], ['dumpling'])).toBe(false);
    // geil's Austrian sense has nothing to do with heiß.
    expect(sameMeaning(['hot (having a high temperature)'], ['fatty, heavy (of foods)'])).toBe(
      false,
    );
  });
});
