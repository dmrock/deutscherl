import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import {
  baseHash,
  type Clock,
  formatStatus,
  isInSync,
  main,
  minorEdit,
  normalizeMdx,
  normalizeYaml,
  readReview,
  serializeReview,
  setStatus,
  statusRows,
  syncReview,
} from '../../scripts/review.ts';
import type { Review } from '../../src/lib/content-schemas.ts';
import { type ContentFixture, contentFixture } from './helpers/content-fixture.ts';

const clock: Clock = () => new Date('2026-10-03T12:00:00.000Z');

let fixture: ContentFixture;

beforeEach(() => {
  fixture = contentFixture();
});

afterEach(() => {
  fixture.cleanup();
});

function review(): Review {
  const value = readReview(fixture.topic());
  if (!value) throw new Error('no review.yaml');
  return value;
}

function save(value: Review): void {
  fixture.write('review.yaml', serializeReview(value));
}

/** Marks base verified and ru reviewed through the owner command. */
function verifyAll(): void {
  save(setStatus(fixture.topic(), review(), 'base', 'verified', 'Teacher', clock));
  save(setStatus(fixture.topic(), review(), 'ru', 'reviewed', 'Owner', clock));
}

function syncNow(): string[] {
  const topic = fixture.topic();
  const result = syncReview(topic, readReview(topic), clock);
  save(result.review);
  return result.changes;
}

describe('hashing', () => {
  it('ignores YAML comments, quoting, indentation and key order', () => {
    expect(normalizeYaml('a: 1\nb: [x, y]\n')).toBe(
      normalizeYaml('# comment\nb:\n    - \'x\'\n    - "y"\na: 1\n'),
    );
    expect(normalizeYaml('a: 1')).not.toBe(normalizeYaml('a: 2'));
  });

  it('ignores trailing spaces and blank-line runs in MDX, not text changes', () => {
    const mdx = '---\ntitle: A\nsummary: B\n---\n\nText.\n\nMore.\n';
    expect(normalizeMdx(mdx)).toBe(
      normalizeMdx("---\nsummary: 'B'\ntitle: A\n---\r\n\r\nText.   \n\n\n\nMore.\n\n"),
    );
    expect(normalizeMdx(mdx)).not.toBe(normalizeMdx(mdx.replace('More.', 'More!')));
  });

  it('keeps the base hash for a comment-only change', () => {
    const before = baseHash(fixture.topic());
    fixture.edit('german.yaml', (content) => `# another comment\n${content}`);
    expect(baseHash(fixture.topic())).toBe(before);
  });
});

describe('review:sync', () => {
  it('creates draft entries for base and every translation', () => {
    fixture.remove('review.yaml');
    const changes = syncNow();
    expect(changes).toEqual(['created review.yaml']);
    const value = review();
    expect(value.base).toMatchObject({ status: 'draft', verifiedBy: null, history: [] });
    expect(Object.keys(value.translations)).toEqual(['ru']);
    expect(value.translations.ru).toMatchObject({
      status: 'draft',
      basedOn: value.base.contentHash,
    });
    expect(isInSync(fixture.topic())).toBe(true);
  });

  it('writes a header comment and valid YAML', () => {
    const raw = fixture.read('review.yaml');
    expect(raw.startsWith('# Review state of this topic.')).toBe(true);
    expect(parse(raw).base.status).toBe('draft');
  });

  it('a change in german.yaml resets base and the ru translation', () => {
    verifyAll();
    const before = review();
    fixture.edit('german.yaml', (c) => c.replace('Ich **bin** gegangen.', 'Ich **bin** gelaufen.'));
    expect(syncNow()).toEqual([
      'base: reset to draft (content changed)',
      'ru: reset to draft (base changed, translation is outdated)',
    ]);
    const after = review();
    expect(after.base).toMatchObject({ status: 'draft', verifiedBy: null, verifiedAt: null });
    expect(after.base.history.at(-1)).toEqual({
      at: '2026-10-03T12:00:00Z',
      event: 'reset',
      from: 'verified',
      by: 'Teacher',
      reason: 'base changed',
      previousHash: before.base.contentHash,
    });
    expect(after.translations.ru).toMatchObject({ status: 'draft', reviewedBy: null });
    expect(after.translations.ru?.history.at(-1)).toMatchObject({
      event: 'reset',
      from: 'reviewed',
      by: 'Owner',
      reason: 'base changed',
    });
    // basedOn keeps the base the translation was checked against: it is outdated now.
    expect(after.translations.ru?.basedOn).toBe(before.base.contentHash);
    expect(statusRows([fixture.topic()])[0]?.translations[0]?.outdated).toBe(true);
  });

  it('a change in en.mdx resets base and the ru translation', () => {
    verifyAll();
    fixture.edit('en.mdx', (c) =>
      c.replace('English explanation.', 'English explanation, longer.'),
    );
    expect(syncNow()).toEqual([
      'base: reset to draft (content changed)',
      'ru: reset to draft (base changed, translation is outdated)',
    ]);
  });

  it('a change in ru.mdx resets only the ru translation and updates basedOn', () => {
    verifyAll();
    fixture.edit('german.yaml', (c) => c.replace('Ich **bin** gegangen.', 'Ich **bin** gelaufen.'));
    syncNow();
    save(setStatus(fixture.topic(), review(), 'base', 'verified', 'Teacher', clock));
    const before = review();
    expect(before.translations.ru?.basedOn).not.toBe(before.base.contentHash);

    fixture.edit('ru.mdx', (c) => c.replace('Russian placeholder explanation.', 'Updated.'));
    expect(syncNow()).toEqual(['ru: hash updated']);
    const after = review();
    expect(after.base).toEqual(before.base);
    expect(after.translations.ru?.basedOn).toBe(after.base.contentHash);
  });

  it('a change in a reviewed translation resets it and logs the reviewer', () => {
    verifyAll();
    fixture.edit('i18n/ru.yaml', (c) => c.replace('Russian placeholder e1', 'Changed e1'));
    expect(syncNow()).toEqual(['ru: reset to draft (translation changed)']);
    const after = review();
    expect(after.base.status).toBe('verified');
    expect(after.translations.ru?.history.at(-1)).toMatchObject({
      event: 'reset',
      from: 'reviewed',
      by: 'Owner',
      reason: 'translation changed',
    });
  });

  it('adds no history entry for draft content changes', () => {
    fixture.edit('german.yaml', (c) => c.replace('Ich **bin** gegangen.', 'Ich **bin** gelaufen.'));
    expect(syncNow()).toEqual(['base: hash updated']);
    expect(review().base.history).toEqual([]);
  });

  it('--check reports drift without writing', () => {
    const before = fixture.read('review.yaml');
    fixture.edit('meta.yaml', (c) => c.replace('readingMinutes: 2', 'readingMinutes: 3'));
    expect(main(['sync', '--check'], fixture.root)).toBe(1);
    expect(fixture.read('review.yaml')).toBe(before);
    expect(main(['sync'], fixture.root)).toBe(0);
    expect(main(['sync', '--check'], fixture.root)).toBe(0);
  });
});

describe('review:minor', () => {
  it('keeps the status and logs the reason', () => {
    verifyAll();
    const before = review();
    fixture.edit('i18n/en.yaml', (c) => c.replace('English why c3', 'English why c3, fixed'));
    const after = minorEdit(fixture.topic(), review(), 'base', 'typo in c3 why', clock);
    save(after);
    expect(after.base.status).toBe('verified');
    expect(after.base.contentHash).not.toBe(before.base.contentHash);
    expect(after.base.history.at(-1)).toEqual({
      at: '2026-10-03T12:00:00Z',
      event: 'minor',
      reason: 'typo in c3 why',
      previousHash: before.base.contentHash,
    });
    // Translations based on the previous base move along: a typo fix does not outdate them.
    expect(after.translations.ru).toMatchObject({
      status: 'reviewed',
      basedOn: after.base.contentHash,
    });
    expect(syncNow()).toEqual([]);
  });

  it('works for a translation scope', () => {
    verifyAll();
    fixture.edit('ru.mdx', (c) =>
      c.replace('Russian placeholder note.', 'Russian placeholder note!'),
    );
    const after = minorEdit(fixture.topic(), review(), 'ru', 'punctuation', clock);
    save(after);
    expect(after.translations.ru?.status).toBe('reviewed');
    expect(syncNow()).toEqual([]);
  });

  it('refuses without a reason or without a change', () => {
    expect(() => minorEdit(fixture.topic(), review(), 'base', ' ', clock)).toThrow(/reason/);
    expect(() => minorEdit(fixture.topic(), review(), 'base', 'x', clock)).toThrow(/not changed/);
  });
});

describe('review:set', () => {
  it('needs a name for verified and reviewed', () => {
    expect(() => setStatus(fixture.topic(), review(), 'base', 'verified', undefined)).toThrow(
      /--by/,
    );
    expect(() => setStatus(fixture.topic(), review(), 'ru', 'reviewed', '')).toThrow(/--by/);
  });

  it('rejects unknown statuses and verified for translations', () => {
    expect(() => setStatus(fixture.topic(), review(), 'base', 'done', 'X')).toThrow();
    expect(() => setStatus(fixture.topic(), review(), 'ru', 'verified', 'X')).toThrow();
  });

  it('refuses when review.yaml is out of sync', () => {
    fixture.edit('german.yaml', (c) => c.replace('Ich **bin** gegangen.', 'Ich **bin** gelaufen.'));
    expect(() => setStatus(fixture.topic(), review(), 'base', 'reviewed', 'Owner')).toThrow(
      /out of sync/,
    );
  });

  it('records the status change in history', () => {
    verifyAll();
    const value = review();
    expect(value.base).toMatchObject({
      status: 'verified',
      verifiedBy: 'Teacher',
      verifiedAt: '2026-10-03T12:00:00Z',
    });
    expect(value.base.history).toEqual([
      { at: '2026-10-03T12:00:00Z', event: 'status', from: 'draft', to: 'verified', by: 'Teacher' },
    ]);
    expect(value.translations.ru).toMatchObject({
      status: 'reviewed',
      reviewedBy: 'Owner',
      basedOn: value.base.contentHash,
    });
  });
});

describe('review:status', () => {
  it('lists base and translation status and marks outdated translations', () => {
    verifyAll();
    fixture.edit('german.yaml', (c) => c.replace('Ich **bin** gegangen.', 'Ich **bin** gelaufen.'));
    expect(formatStatus(statusRows([fixture.topic()]))).toBe(
      'a2/sample  base: verified  ru: reviewed  [out of sync: run pnpm review:sync]',
    );
    syncNow();
    expect(formatStatus(statusRows([fixture.topic()]))).toBe(
      'a2/sample  base: draft  ru: draft (outdated)',
    );
  });
});
