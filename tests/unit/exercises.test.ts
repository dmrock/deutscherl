import { describe, expect, it } from 'vitest';
import type { GermanContent, TopicI18n } from '../../src/lib/content-schemas.ts';
import {
  capitalizeFirst,
  checkChoice,
  checkWordOrder,
  createRng,
  createSeenStore,
  type Exercise,
  fillGap,
  format,
  formatSentence,
  type PreparedWordOrder,
  parseSeed,
  pickRound,
  prepareExercise,
  ROUND_COUNTS,
  reportMistakeUrl,
  resolveExercises,
  seenKey,
  shuffle,
  splitGap,
  validOrders,
  type WordOrderExercise,
} from '../../src/lib/exercises.ts';

const choice = (id: string): Exercise => ({
  kind: 'choice',
  id,
  text: 'Ich ___ gegangen.',
  answer: 'bin',
  options: ['bin', 'habe'],
  alsoCorrect: [],
  why: undefined,
});

const wordOrder = (id: string, overrides: Partial<WordOrderExercise> = {}): WordOrderExercise => ({
  kind: 'wordOrder',
  id,
  parts: ['ich', 'habe', 'gestern', 'einen Film', 'gesehen'],
  fixed: false,
  accept: [
    ['gestern', 'habe', 'ich', 'einen Film', 'gesehen'],
    ['einen Film', 'habe', 'ich', 'gestern', 'gesehen'],
  ],
  punctuation: '.',
  translation: undefined,
  why: undefined,
  ...overrides,
});

const pool: Exercise[] = [
  ...Array.from({ length: 10 }, (_, i) => choice(`c${i + 1}`)),
  ...Array.from({ length: 6 }, (_, i) => wordOrder(`w${i + 1}`)),
];
const ids = (items: readonly { id: string }[]) => items.map((item) => item.id);
const kinds = (items: readonly Exercise[]) => ({
  choice: items.filter((item) => item.kind === 'choice').length,
  wordOrder: items.filter((item) => item.kind === 'wordOrder').length,
});

describe('createRng()', () => {
  it('returns the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const sequence = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(sequence);
    expect(sequence.every((value) => value >= 0 && value < 1)).toBe(true);
  });

  it('returns a different sequence for another seed', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe('parseSeed()', () => {
  it('accepts non-negative integers only', () => {
    expect(parseSeed('7')).toBe(7);
    expect(parseSeed('0')).toBe(0);
    for (const value of [null, undefined, '', '-1', '1.5', 'abc', '12345678901']) {
      expect(parseSeed(value)).toBeUndefined();
    }
  });
});

describe('shuffle()', () => {
  it('returns a permutation and leaves the input unchanged', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const result = shuffle(input, createRng(3));
    expect([...result].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('is deterministic with a seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], createRng(9))).toEqual(shuffle([1, 2, 3, 4, 5], createRng(9)));
  });
});

describe('pickRound()', () => {
  it('picks 3 choice and 2 word-order items, all unseen', () => {
    const round = pickRound(pool, ['c1', 'c2', 'w1'], ROUND_COUNTS, createRng(1));
    expect(round.items).toHaveLength(5);
    expect(kinds(round.items)).toEqual({ choice: 3, wordOrder: 2 });
    expect(ids(round.items)).not.toContain('c1');
    expect(ids(round.items)).not.toContain('w1');
    expect(round.seen).toEqual(['c1', 'c2', 'w1', ...ids(round.items)]);
  });

  it('is deterministic with a seed', () => {
    const a = pickRound(pool, [], ROUND_COUNTS, createRng(5));
    const b = pickRound(pool, [], ROUND_COUNTS, createRng(5));
    expect(ids(a.items)).toEqual(ids(b.items));
  });

  it('fills with the other kind when one kind has no unseen items left', () => {
    const seen = ['w1', 'w2', 'w3', 'w4', 'w5', 'w6'];
    const round = pickRound(pool, seen, ROUND_COUNTS, createRng(2));
    expect(kinds(round.items)).toEqual({ choice: 5, wordOrder: 0 });
  });

  it('three rounds in a row never repeat an item', () => {
    const rng = createRng(11);
    let seen: string[] = [];
    const shown: string[] = [];
    for (let i = 0; i < 3; i++) {
      const round = pickRound(pool, seen, ROUND_COUNTS, rng);
      shown.push(...ids(round.items));
      seen = round.seen;
    }
    expect(new Set(shown).size).toBe(15);
  });

  it('keeps the last unseen items and starts over when the pool is exhausted', () => {
    const seen = ids(pool).filter((id) => id !== 'c4' && id !== 'w6');
    const round = pickRound(pool, seen, ROUND_COUNTS, createRng(4));
    expect(ids(round.items)).toEqual(expect.arrayContaining(['c4', 'w6']));
    expect(round.items).toHaveLength(5);
    expect(kinds(round.items)).toEqual({ choice: 3, wordOrder: 2 });
    expect(new Set(ids(round.items)).size).toBe(5);
    expect([...round.seen].sort()).toEqual(ids(round.items).sort());
  });

  it('drops seen ids that are no longer in the pool', () => {
    const round = pickRound(pool, ['gone', 'c1'], ROUND_COUNTS, createRng(1));
    expect(round.seen).not.toContain('gone');
    expect(round.seen).toContain('c1');
  });

  it('returns the whole pool when it is smaller than a round', () => {
    const small = [choice('c1'), wordOrder('w1')];
    const round = pickRound(small, [], ROUND_COUNTS, createRng(1));
    expect(ids(round.items).sort()).toEqual(['c1', 'w1']);
  });
});

describe('prepareExercise()', () => {
  it('shuffles choice options without losing any', () => {
    const item = { ...choice('c1'), options: ['a', 'b', 'c', 'd'] } as Exercise;
    const prepared = prepareExercise(item, createRng(1));
    expect(prepared.kind === 'choice' && [...prepared.shuffledOptions].sort()).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('gives duplicate words distinct chip ids and never starts with a valid order', () => {
    const item = wordOrder('w6', {
      parts: ['die', 'Kinder', 'haben', 'die', 'Pizza', 'gegessen'],
      accept: [['die', 'Pizza', 'haben', 'die', 'Kinder', 'gegessen']],
    });
    for (let seed = 0; seed < 50; seed++) {
      const prepared = prepareExercise(item, createRng(seed)) as PreparedWordOrder;
      expect(new Set(prepared.bank.map((chip) => chip.id)).size).toBe(6);
      const texts = prepared.bank.map((chip) => chip.text);
      expect(validOrders(item)).not.toContainEqual(texts);
      expect([...texts].sort()).toEqual([...item.parts].sort());
    }
  });

  it('keeps the fixed first part out of the bank', () => {
    const item = wordOrder('w4', { parts: ['wann', 'bist', 'du', 'aufgestanden'], fixed: true });
    const prepared = prepareExercise(item, createRng(1)) as PreparedWordOrder;
    expect(prepared.lockedPart).toBe('wann');
    expect(prepared.bank.map((chip) => chip.text).sort()).toEqual(['aufgestanden', 'bist', 'du']);
  });
});

describe('checkChoice()', () => {
  const item = {
    answer: 'haben',
    alsoCorrect: [{ value: 'sind', region: 'AT' as const }],
  };

  it('accepts the answer', () => {
    expect(checkChoice(item, 'haben')).toEqual({ correct: true, region: undefined });
  });

  it('accepts a regional variant and names its region', () => {
    expect(checkChoice(item, 'sind')).toEqual({ correct: true, region: 'AT' });
  });

  it('rejects other options', () => {
    expect(checkChoice(item, 'hat')).toEqual({ correct: false, region: undefined });
  });
});

describe('gaps', () => {
  it('fills and splits the gap', () => {
    expect(fillGap('Ich ___ gegangen.', 'bin')).toBe('Ich bin gegangen.');
    expect(splitGap('Ich ___ gegangen.')).toEqual(['Ich ', ' gegangen.']);
    expect(splitGap('___ du müde?')).toEqual(['', ' du müde?']);
  });
});

describe('checkWordOrder()', () => {
  const item = wordOrder('w1');

  it('accepts the canonical order and every accept order', () => {
    for (const order of validOrders(item)) {
      expect(checkWordOrder(item, order)).toEqual({
        correct: true,
        expected: order,
        wrong: [false, false, false, false, false],
      });
    }
  });

  it('marks wrong positions against the closest valid order', () => {
    const result = checkWordOrder(item, ['gestern', 'ich', 'habe', 'einen Film', 'gesehen']);
    expect(result.correct).toBe(false);
    expect(result.expected).toEqual(['gestern', 'habe', 'ich', 'einen Film', 'gesehen']);
    expect(result.wrong).toEqual([false, true, true, false, false]);
  });

  it('compares strings, so identical words can swap places', () => {
    const duplicates = wordOrder('w6', {
      parts: ['die', 'Kinder', 'haben', 'die', 'Pizza', 'gegessen'],
      accept: [['die', 'Pizza', 'haben', 'die', 'Kinder', 'gegessen']],
    });
    // The chips of the two "die" swapped: the same strings, so still correct.
    expect(
      checkWordOrder(duplicates, ['die', 'Kinder', 'haben', 'die', 'Pizza', 'gegessen']),
    ).toMatchObject({ correct: true });
    expect(
      checkWordOrder(duplicates, ['die', 'Pizza', 'haben', 'die', 'Kinder', 'gegessen']),
    ).toMatchObject({ correct: true });
    expect(
      checkWordOrder(duplicates, ['die', 'die', 'Kinder', 'haben', 'Pizza', 'gegessen']),
    ).toMatchObject({ correct: false });
  });

  it('checks a fixed first part like any other', () => {
    const fixed = wordOrder('w4', {
      parts: ['wann', 'bist', 'du', 'aufgestanden'],
      fixed: true,
      accept: [],
    });
    expect(checkWordOrder(fixed, ['wann', 'bist', 'du', 'aufgestanden']).correct).toBe(true);
    expect(checkWordOrder(fixed, ['wann', 'du', 'bist', 'aufgestanden']).wrong).toEqual([
      false,
      true,
      true,
      false,
    ]);
  });
});

describe('capitalizeFirst() and formatSentence()', () => {
  it('capitalizes only the first letter of the first part', () => {
    expect(capitalizeFirst(['gestern', 'habe', 'ich'])).toEqual(['Gestern', 'habe', 'ich']);
    expect(capitalizeFirst(['einen Film', 'habe'])).toEqual(['Einen Film', 'habe']);
    expect(capitalizeFirst(['über', 'Nacht'])).toEqual(['Über', 'Nacht']);
    expect(capitalizeFirst(['Kinder'])).toEqual(['Kinder']);
    expect(capitalizeFirst([])).toEqual([]);
  });

  it('joins the parts and adds the punctuation', () => {
    expect(formatSentence(['bist', 'du', 'gut', 'nach Hause', 'gekommen'], '?')).toBe(
      'Bist du gut nach Hause gekommen?',
    );
  });
});

describe('resolveExercises()', () => {
  const german: GermanContent = {
    examples: [],
    choice: [
      {
        id: 'c1',
        text: 'Wir ___ gesessen.',
        answer: 'haben',
        options: ['haben', 'sind'],
        alsoCorrect: [{ value: 'sind', region: 'AT' }],
      },
    ],
    wordOrder: [
      { id: 'w1', parts: ['wann', 'bist', 'du', 'gekommen'], fixed: true, punctuation: '?' },
    ],
    austrianNotes: [],
  };
  const i18n: TopicI18n = {
    examples: {},
    choice: { c1: { why: 'why c1' } },
    wordOrder: { w1: { translation: 'When did you come?', why: 'why w1' } },
    austrianNotes: {},
  };

  it('joins German items with the locale texts', () => {
    expect(resolveExercises(german, i18n)).toEqual([
      {
        kind: 'choice',
        id: 'c1',
        text: 'Wir ___ gesessen.',
        answer: 'haben',
        options: ['haben', 'sind'],
        alsoCorrect: [{ value: 'sind', region: 'AT' }],
        why: 'why c1',
      },
      {
        kind: 'wordOrder',
        id: 'w1',
        parts: ['wann', 'bist', 'du', 'gekommen'],
        fixed: true,
        accept: [],
        punctuation: '?',
        translation: 'When did you come?',
        why: 'why w1',
      },
    ]);
  });

  it('leaves texts undefined when the locale has no translations', () => {
    const [first, second] = resolveExercises(german, undefined);
    expect(first?.why).toBeUndefined();
    expect(second?.kind === 'wordOrder' && second.translation).toBeUndefined();
  });
});

describe('createSeenStore()', () => {
  function fakeStorage(): Storage {
    const data = new Map<string, string>();
    return {
      get length() {
        return data.size;
      },
      clear: () => data.clear(),
      getItem: (key) => data.get(key) ?? null,
      key: (index) => [...data.keys()][index] ?? null,
      removeItem: (key) => void data.delete(key),
      setItem: (key, value) => void data.set(key, value),
    };
  }

  it('stores ids under the topic key, shared by every locale', () => {
    const storage = fakeStorage();
    expect(seenKey('a2', 'perfekt')).toBe('seen:a2/perfekt');
    createSeenStore('seen:a2/perfekt', () => storage).set(['c1', 'w2']);
    expect(storage.getItem('seen:a2/perfekt')).toBe('["c1","w2"]');
    expect(createSeenStore('seen:a2/perfekt', () => storage).get()).toEqual(['c1', 'w2']);
  });

  it('falls back to memory when storage throws', () => {
    const store = createSeenStore('seen:a2/perfekt', () => {
      throw new Error('SecurityError');
    });
    expect(store.get()).toEqual([]);
    store.set(['c3']);
    expect(store.get()).toEqual(['c3']);
  });

  it('ignores invalid stored values', () => {
    const storage = fakeStorage();
    storage.setItem('k', '{"not":"a list"}');
    expect(createSeenStore('k', () => storage).get()).toEqual([]);
    storage.setItem('k', 'not json');
    expect(createSeenStore('k', () => storage).get()).toEqual([]);
    storage.setItem('k', '["c1", 2]');
    expect(createSeenStore('k', () => storage).get()).toEqual(['c1']);
  });
});

describe('reportMistakeUrl()', () => {
  it('prefills the issue form with page URL, locale and item id', () => {
    const url = new URL(
      reportMistakeUrl({
        repo: 'https://github.com/dmrock/deutscherl',
        pageUrl: 'https://deutscherl.com/ru/a2/perfekt/',
        locale: 'ru',
        itemId: 'c3',
      }),
    );
    expect(url.origin + url.pathname).toBe('https://github.com/dmrock/deutscherl/issues/new');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template: 'report-mistake.yml',
      title: '[Mistake] /ru/a2/perfekt/ c3',
      'page-url': 'https://deutscherl.com/ru/a2/perfekt/',
      locale: 'ru',
      'item-id': 'c3',
    });
  });
});

describe('format()', () => {
  it('fills placeholders and keeps unknown ones', () => {
    expect(format('Question {current} of {total}', { current: 2, total: 5 })).toBe(
      'Question 2 of 5',
    );
    expect(format('{a} {b}', { a: 'x' })).toBe('x {b}');
  });
});
