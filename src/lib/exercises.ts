/**
 * Exercise logic (pure, unit-tested in tests/unit/exercises.test.ts). Shipped to the browser by
 * the exercise islands, so it must not import UI strings or content collections.
 *
 * CLAUDE.md, "Exercise rules" and "UX rules": rounds of mixed items, seen ids per topic, regional
 * answers (`alsoCorrect`), word order compared as string sequences (`parts` + `accept`).
 */
import type { ChoiceItem, GermanContent, TopicI18n, WordOrderItem } from './content-schemas.ts';

export type Region = NonNullable<ChoiceItem['alsoCorrect']>[number]['region'];

/** A choice item resolved for one locale (German from german.yaml, `why` from i18n/<locale>.yaml). */
export interface ChoiceExercise {
  kind: 'choice';
  id: string;
  text: string;
  answer: string;
  options: string[];
  alsoCorrect: { value: string; region: Region }[];
  why: string | undefined;
}

/** A word-order item resolved for one locale. */
export interface WordOrderExercise {
  kind: 'wordOrder';
  id: string;
  parts: string[];
  fixed: boolean;
  accept: string[][];
  punctuation: WordOrderItem['punctuation'];
  translation: string | undefined;
  why: string | undefined;
}

export type Exercise = ChoiceExercise | WordOrderExercise;
export type ExerciseKind = Exercise['kind'];

/** Items of a round per kind; missing items of one kind are filled with the other. */
export const ROUND_COUNTS: Readonly<Record<ExerciseKind, number>> = { choice: 3, wordOrder: 2 };

/** The topic's exercise pool in the page locale (props of the exercise island). */
export function resolveExercises(german: GermanContent, i18n: TopicI18n | undefined): Exercise[] {
  const choice = german.choice.map(
    (item): ChoiceExercise => ({
      kind: 'choice',
      id: item.id,
      text: item.text,
      answer: item.answer,
      options: item.options,
      alsoCorrect: item.alsoCorrect ?? [],
      why: i18n?.choice[item.id]?.why,
    }),
  );
  const wordOrder = german.wordOrder.map(
    (item): WordOrderExercise => ({
      kind: 'wordOrder',
      id: item.id,
      parts: item.parts,
      fixed: item.fixed ?? false,
      accept: item.accept ?? [],
      punctuation: item.punctuation,
      translation: i18n?.wordOrder[item.id]?.translation,
      why: i18n?.wordOrder[item.id]?.why,
    }),
  );
  return [...choice, ...wordOrder];
}

// --- Randomness -------------------------------------------------------------------------------

/** Returns a float in [0, 1). All randomness goes through this, so tests can fix the seed. */
export type Rng = () => number;

/** mulberry32: small, fast, good enough for shuffling exercises. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Parses a `?seed=` value: a non-negative integer, otherwise undefined. */
export function parseSeed(value: string | null | undefined): number | undefined {
  if (!value || !/^\d{1,10}$/.test(value)) return undefined;
  return Number(value) >>> 0;
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

// --- Rounds -----------------------------------------------------------------------------------

export interface Round<T> {
  items: T[];
  /** Seen ids to store after this round (includes the round's items). */
  seen: string[];
}

/**
 * Picks a round: up to `counts[kind]` unseen items per kind, then any other unseen items, in
 * shuffled order. When fewer unseen items are left than the round needs, the pool is exhausted:
 * the remaining unseen items are kept, the seen list starts over and the round is filled with
 * other items. Seen ids that are no longer in the pool are dropped.
 */
export function pickRound<T extends { id: string; kind: K }, K extends string>(
  pool: readonly T[],
  seenIds: readonly string[],
  counts: Readonly<Record<K, number>>,
  rng: Rng,
): Round<T> {
  const size = Math.min(
    Object.values<number>(counts).reduce((sum, count) => sum + count, 0),
    pool.length,
  );
  const seen = new Set(seenIds);
  const unseen = shuffle(
    pool.filter((item) => !seen.has(item.id)),
    rng,
  );
  const picked: T[] = [];
  const take = (candidates: readonly T[], limit: number) => {
    for (const item of candidates) {
      if (picked.length >= size || limit <= 0) return;
      if (picked.includes(item)) continue;
      picked.push(item);
      limit--;
    }
  };

  for (const kind of Object.keys(counts) as K[]) {
    take(
      unseen.filter((item) => item.kind === kind),
      counts[kind],
    );
  }
  take(unseen, size);

  const exhausted = picked.length < size;
  if (exhausted) {
    const rest = shuffle(
      pool.filter((item) => !picked.includes(item)),
      rng,
    );
    for (const kind of Object.keys(counts) as K[]) {
      const missing = counts[kind] - picked.filter((item) => item.kind === kind).length;
      take(
        rest.filter((item) => item.kind === kind),
        missing,
      );
    }
    take(rest, size);
  }

  const items = shuffle(picked, rng);
  const roundIds = items.map((item) => item.id);
  const poolIds = new Set(pool.map((item) => item.id));
  const kept = exhausted ? [] : seenIds.filter((id) => poolIds.has(id));
  return { items, seen: [...new Set([...kept, ...roundIds])] };
}

/** A word chip; ids are unique within one item, so duplicate words ("die … die") stay distinct. */
export interface Chip {
  id: string;
  text: string;
}

/** A word-order item ready to render: the locked first part and the shuffled word bank. */
export interface PreparedWordOrder extends WordOrderExercise {
  lockedPart: string | undefined;
  bank: Chip[];
}

export interface PreparedChoice extends ChoiceExercise {
  /** `options` in display order */
  shuffledOptions: string[];
}

export type PreparedExercise = PreparedChoice | PreparedWordOrder;

/**
 * Shuffles the options and the word bank. The bank is reshuffled (a few times) when it happens
 * to be a valid answer, so the starting order is never a hint.
 */
export function prepareExercise(item: Exercise, rng: Rng): PreparedExercise {
  if (item.kind === 'choice') return { ...item, shuffledOptions: shuffle(item.options, rng) };

  const start = item.fixed ? 1 : 0;
  const chips = item.parts.slice(start).map((text, index) => ({
    id: `${item.id}-${index + start}`,
    text,
  }));
  const validTails = validOrders(item).map((order) => order.slice(start));
  let bank = shuffle(chips, rng);
  for (let attempt = 0; attempt < 10; attempt++) {
    const texts = bank.map((chip) => chip.text);
    if (!validTails.some((tail) => sameSequence(tail, texts))) break;
    bank = shuffle(chips, rng);
  }
  return { ...item, lockedPart: item.fixed ? item.parts[0] : undefined, bank };
}

// --- Checking ---------------------------------------------------------------------------------

/** What an exercise reports to the runner after it was answered. */
export interface Answer {
  correct: boolean;
  region: Region | undefined;
  /** The correct German sentence, shown when the answer was wrong */
  solution: string;
}

export interface ChoiceResult {
  correct: boolean;
  /** Set when the answer is a regional variant (`alsoCorrect`) */
  region: Region | undefined;
}

export function checkChoice(item: Pick<ChoiceExercise, 'answer' | 'alsoCorrect'>, value: string) {
  if (value === item.answer) return { correct: true, region: undefined } satisfies ChoiceResult;
  const regional = item.alsoCorrect.find((variant) => variant.value === value);
  return { correct: Boolean(regional), region: regional?.region } satisfies ChoiceResult;
}

/** The sentence with the gap filled (`___` replaced by `value`). */
export function fillGap(text: string, value: string): string {
  return text.replace('___', value);
}

/** Text before and after the gap. */
export function splitGap(text: string): [before: string, after: string] {
  const index = text.indexOf('___');
  if (index === -1) return [text, ''];
  return [text.slice(0, index), text.slice(index + 3)];
}

export interface WordOrderResult {
  correct: boolean;
  /** The valid order closest to the answer (the matching one when correct). */
  expected: string[];
  /** Per position of the answer: true when it differs from `expected` */
  wrong: boolean[];
}

/** Canonical order first, then the `accept` orders. */
export function validOrders(item: Pick<WordOrderExercise, 'parts' | 'accept'>): string[][] {
  return [item.parts, ...item.accept];
}

function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Compares strings, not chip identities, so swapping two identical words changes nothing. */
export function checkWordOrder(
  item: Pick<WordOrderExercise, 'parts' | 'accept'>,
  answer: readonly string[],
): WordOrderResult {
  let expected = item.parts;
  let bestMatches = -1;
  for (const order of validOrders(item)) {
    if (sameSequence(order, answer)) {
      return { correct: true, expected: order, wrong: answer.map(() => false) };
    }
    const matches = order.filter((value, index) => value === answer[index]).length;
    if (matches > bestMatches) {
      bestMatches = matches;
      expected = order;
    }
  }
  return {
    correct: false,
    expected,
    wrong: answer.map((value, index) => value !== expected[index]),
  };
}

/** Capitalizes the first letter of the first part ("gestern" → "Gestern", "über" → "Über"). */
export function capitalizeFirst(parts: readonly string[]): string[] {
  const [first, ...rest] = parts;
  if (first === undefined) return [];
  const [letter = '', ...tail] = first;
  return [letter.toLocaleUpperCase('de') + tail.join(''), ...rest];
}

/** Displayed sentence after checking: first word capitalized, punctuation attached. */
export function formatSentence(parts: readonly string[], punctuation: string): string {
  return `${capitalizeFirst(parts).join(' ')}${punctuation}`;
}

// --- Seen ids -----------------------------------------------------------------------------------

/** sessionStorage key, shared between locales: `seen:<level>/<slug>`. */
export function seenKey(level: string, slug: string): string {
  return `seen:${level}/${slug}`;
}

export interface SeenStore {
  get(): string[];
  set(ids: readonly string[]): void;
}

/**
 * Seen ids in `storage` (sessionStorage in the browser). Every access is guarded: when storage is
 * missing or throws (private mode, blocked site data) the ids live in memory for this page view.
 */
export function createSeenStore(key: string, storage: () => Storage | undefined): SeenStore {
  let memory: string[] = [];
  return {
    get() {
      try {
        const raw = storage()?.getItem(key);
        if (raw) {
          const value: unknown = JSON.parse(raw);
          if (Array.isArray(value)) memory = value.filter((id) => typeof id === 'string');
        }
      } catch {
        // Keep the in-memory copy.
      }
      return [...memory];
    },
    set(ids) {
      memory = [...ids];
      try {
        storage()?.setItem(key, JSON.stringify(memory));
      } catch {
        // In-memory only.
      }
    },
  };
}

// --- Report a mistake -------------------------------------------------------------------------

export interface MistakeReport {
  /** GitHub repository URL (site.repo) */
  repo: string;
  pageUrl: string;
  locale: string;
  itemId: string;
}

/** The "Report a mistake" issue form, prefilled (field ids of .github/ISSUE_TEMPLATE/report-mistake.yml). */
export function reportMistakeUrl({ repo, pageUrl, locale, itemId }: MistakeReport): string {
  const params = new URLSearchParams({
    template: 'report-mistake.yml',
    title: `[Mistake] ${new URL(pageUrl).pathname} ${itemId}`,
    'page-url': pageUrl,
    locale,
    'item-id': itemId,
  });
  return `${repo}/issues/new?${params}`;
}

/** Fills `{name}` placeholders (the island's copy of t()'s formatting, without the UI strings). */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
