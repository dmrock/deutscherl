import { describe, expect, it } from 'vitest';
import {
  applyOverrides,
  assignIds,
  checkEntries,
  isValidId,
  parseEntries,
  parseSeed,
  serializeEntries,
  type WordEntry,
  wordSlug,
} from '../../src/lib/dictionary.ts';

function entry(overrides: Partial<WordEntry> & Pick<WordEntry, 'id' | 'lemma' | 'pos'>): WordEntry {
  return {
    level: 'a1',
    status: 'draft',
    source: 'wiktionary-en',
    sourceUrl: `https://en.wiktionary.org/wiki/${overrides.lemma}`,
    license: 'CC BY-SA 4.0',
    senses: [],
    examples: [],
    regional: [],
    ...overrides,
  };
}

const kartoffel = entry({
  id: 'kartoffel-die',
  lemma: 'Kartoffel',
  pos: 'noun',
  gender: 'f',
  plural: 'Kartoffeln',
  senses: [{ lang: 'en', gloss: 'potato', source: 'wiktionary-en' }],
});
const schnell = entry({
  id: 'schnell-adj',
  lemma: 'schnell',
  pos: 'adj',
  senses: [{ lang: 'en', gloss: 'fast', source: 'wiktionary-en' }],
});

describe('wordSlug', () => {
  it('adds the article for nouns and keeps homonyms apart', () => {
    expect(wordSlug('See', 'noun', 'm')).toBe('see-der');
    expect(wordSlug('See', 'noun', 'f')).toBe('see-die');
    expect(wordSlug('Essen', 'noun', 'n')).toBe('essen-das');
    expect(wordSlug('Eltern', 'noun', 'pl')).toBe('eltern-die');
  });

  it('adds the part of speech for other words', () => {
    expect(wordSlug('essen', 'verb')).toBe('essen-verb');
    expect(wordSlug('schnell', 'adj')).toBe('schnell-adj');
    expect(wordSlug('der', 'article')).toBe('der-art');
  });

  it('keeps umlauts and ß, so Maße and Masse differ', () => {
    expect(wordSlug('Maße', 'noun', 'f')).toBe('maße-die');
    expect(wordSlug('Masse', 'noun', 'f')).toBe('masse-die');
    expect(wordSlug('Brötchen', 'noun', 'n')).toBe('brötchen-das');
  });

  it('normalizes to NFC', () => {
    const decomposed = 'Brötchen';
    expect(wordSlug(decomposed, 'noun', 'n')).toBe('brötchen-das');
    expect(wordSlug(decomposed, 'noun', 'n')).toBe(wordSlug('Brötchen', 'noun', 'n'));
  });

  it('turns spaces into dashes', () => {
    expect(wordSlug('E-Mail', 'noun', 'f')).toBe('e-mail-die');
    expect(wordSlug('zu Hause', 'adv')).toBe('zu-hause-adv');
  });

  it('refuses a noun without gender', () => {
    expect(() => wordSlug('Haus', 'noun')).toThrow(/no gender/);
  });
});

describe('assignIds', () => {
  it('gives every word its slug when nothing collides', () => {
    const ids = assignIds([
      { lemma: 'See', pos: 'noun', gender: 'm' },
      { lemma: 'See', pos: 'noun', gender: 'f' },
      { lemma: 'essen', pos: 'verb' },
      { lemma: 'Essen', pos: 'noun', gender: 'n' },
    ]);
    expect([...ids.values()].sort()).toEqual(['essen-das', 'essen-verb', 'see-der', 'see-die']);
  });

  it('suffixes colliding slugs in a fixed order, whatever the input order', () => {
    // Same slug `weg-adv` for two adverbs that differ only in case.
    const a = { lemma: 'Weg', pos: 'adv' as const };
    const b = { lemma: 'weg', pos: 'adv' as const };
    const forward = assignIds([a, b]);
    const backward = assignIds([b, a]);
    expect(forward).toEqual(backward);
    expect(forward.get('Weg\tadv\t')).toBe('weg-adv');
    expect(forward.get('weg\tadv\t')).toBe('weg-adv-2');
  });

  it('throws on a duplicate identity', () => {
    expect(() =>
      assignIds([
        { lemma: 'Hund', pos: 'noun', gender: 'm' },
        { lemma: 'Hund', pos: 'noun', gender: 'm' },
      ]),
    ).toThrow(/duplicate word: Hund noun m/);
  });
});

describe('isValidId', () => {
  it('accepts the slug and numbered suffixes only', () => {
    const word = { lemma: 'weg', pos: 'adv' as const };
    expect(isValidId('weg-adv', word)).toBe(true);
    expect(isValidId('weg-adv-2', word)).toBe(true);
    expect(isValidId('weg-adv-12', word)).toBe(true);
    expect(isValidId('weg-adv-1', word)).toBe(false);
    expect(isValidId('weg-adv-x', word)).toBe(false);
    expect(isValidId('weg-der', word)).toBe(false);
  });
});

describe('parseSeed', () => {
  it('reads tab-separated lines and skips comments and blank lines', () => {
    const { items, errors } = parseSeed('# comment\n\nSee\tnoun\tm\ta1\nschnell\tadj\t-\ta2\n');
    expect(errors).toEqual([]);
    expect(items).toEqual([
      { lemma: 'See', pos: 'noun', gender: 'm', level: 'a1', line: 3 },
      { lemma: 'schnell', pos: 'adj', gender: undefined, level: 'a2', line: 4 },
    ]);
  });

  it('reports wrong columns, a noun without gender, a gender on a verb and duplicates', () => {
    const { errors } = parseSeed(
      [
        'Haus noun n a1',
        'Haus\tnoun\t-\ta1',
        'gehen\tverb\tm\ta1',
        'See\tnoun\tm\ta1',
        'See\tnoun\tm\ta2',
      ].join('\n'),
    );
    expect(errors).toEqual([
      'lemmas-a1-a2.txt:1: expected 4 tab-separated columns, got 1',
      'lemmas-a1-a2.txt:2: gender: nouns need a gender',
      'lemmas-a1-a2.txt:3: gender: only nouns have a gender',
      'lemmas-a1-a2.txt:5: duplicate of line 4',
    ]);
  });
});

describe('entries', () => {
  it('serializes sorted by id with a fixed key order and parses back', () => {
    const text = serializeEntries([schnell, kartoffel]);
    const lines = text.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(
      /^\{"id":"kartoffel-die","lemma":"Kartoffel","pos":"noun","gender":"f"/,
    );
    expect(parseEntries(text)).toEqual({ items: [kartoffel, schnell], errors: [] });
  });

  it('reports invalid JSON and schema errors with the line number', () => {
    const { errors } = parseEntries(`{\n${JSON.stringify({ ...schnell, level: 'x1' })}\n`);
    expect(errors).toEqual([
      expect.stringMatching(/^words\.jsonl:1: invalid JSON/),
      expect.stringMatching(/^words\.jsonl:2: level: /),
    ]);
  });

  it('checks duplicate ids, ids that do not match the word and duplicate words', () => {
    expect(checkEntries([kartoffel, schnell])).toEqual([]);
    expect(checkEntries([kartoffel, kartoffel])).toEqual([
      'duplicate id "kartoffel-die"',
      '"kartoffel-die" and "kartoffel-die" are the same word',
    ]);
    expect(checkEntries([{ ...kartoffel, id: 'kartoffel-der' }])).toEqual([
      'id "kartoffel-der" does not match Kartoffel (noun, f): expected "kartoffel-die"',
    ]);
  });
});

describe('applyOverrides', () => {
  it('patches fields, and an override wins over imported data', () => {
    const { entries, errors } = applyOverrides(
      [kartoffel],
      [
        {
          name: 'fixes.yaml',
          data: {
            patch: {
              'kartoffel-die': {
                level: 'a2',
                glosses: { en: ['potato', 'spud'] },
                examples: [
                  { de: 'Ich esse gern Kartoffeln.', translations: { en: 'I like potatoes.' } },
                ],
                regional: [{ region: 'AT', variant: 'Erdapfel' }],
              },
            },
          },
        },
      ],
    );
    expect(errors).toEqual([]);
    const [patched] = entries;
    expect(patched?.level).toBe('a2');
    expect(patched?.plural).toBe('Kartoffeln');
    expect(patched?.senses).toEqual([
      { lang: 'en', gloss: 'potato', source: 'manual' },
      { lang: 'en', gloss: 'spud', source: 'manual' },
    ]);
    expect(patched?.examples).toEqual([
      {
        id: 'kartoffel-die-x1',
        de: 'Ich esse gern Kartoffeln.',
        translations: { en: 'I like potatoes.' },
        source: 'manual',
      },
    ]);
    expect(patched?.regional).toEqual([{ region: 'AT', variant: 'Erdapfel' }]);
    // The input is not changed.
    expect(kartoffel.level).toBe('a1');
  });

  it('adds new words as manual entries with the repository as source', () => {
    const { entries, errors } = applyOverrides(
      [],
      [
        {
          name: 'austria.yaml',
          data: {
            add: [
              { lemma: 'Jause', pos: 'noun', gender: 'f', level: 'a2', glosses: { en: ['snack'] } },
            ],
          },
        },
      ],
    );
    expect(errors).toEqual([]);
    expect(entries).toEqual([
      expect.objectContaining({
        id: 'jause-die',
        source: 'manual',
        status: 'draft',
        sourceUrl: 'https://github.com/dmrock/deutscherl/blob/main/db/overrides/austria.yaml',
        license: 'CC BY-SA 4.0',
        senses: [{ lang: 'en', gloss: 'snack', source: 'manual' }],
      }),
    ]);
  });

  it('fails on an unknown id, a field patched twice and a taken id', () => {
    const { errors } = applyOverrides(
      [kartoffel],
      [
        { name: 'a.yaml', data: { patch: { 'kartoffel-die': { plural: 'Kartoffeln' } } } },
        {
          name: 'b.yaml',
          data: {
            patch: { 'kartoffel-die': { plural: 'Kartoffel' }, 'hund-der': { level: 'a1' } },
            add: [
              { lemma: 'Kartoffel', pos: 'noun', gender: 'f', level: 'a1', glosses: { en: ['x'] } },
            ],
          },
        },
      ],
    );
    expect(errors).toEqual([
      'b.yaml: cannot add Kartoffel: id "kartoffel-die" is already taken',
      'b.yaml: kartoffel-die.plural is already patched in a.yaml',
      'b.yaml: patch for unknown id "hund-der"',
    ]);
  });

  it('reports schema errors with the file name', () => {
    const { errors } = applyOverrides(
      [kartoffel],
      [{ name: 'bad.yaml', data: { patch: { 'kartoffel-die': { gender: 'm' } } } }],
    );
    expect(errors).toEqual([expect.stringMatching(/^bad\.yaml: patch\.kartoffel-die: /)]);
  });
});
