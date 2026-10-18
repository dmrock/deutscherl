import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { coverage, pageCoverage, requiredKeys } from '../../scripts/i18n-coverage.ts';
import { type ContentFixture, contentFixture } from './helpers/content-fixture.ts';

let fixture: ContentFixture;

beforeEach(() => {
  fixture = contentFixture();
});

afterEach(() => {
  fixture.cleanup();
});

const locales = [
  { code: 'en', ready: true },
  { code: 'ru', ready: true },
  { code: 'xx', ready: false },
];

describe('i18n-coverage', () => {
  it('lists the keys every German item needs', () => {
    expect(requiredKeys(fixture.topic())).toEqual([
      'examples.e1',
      'examples.e2',
      ...Array.from({ length: 10 }, (_, i) => `choice.c${i + 1}.why`),
      'wordOrder.w1.translation',
      'wordOrder.w1.why',
      'wordOrder.w2.translation',
      'wordOrder.w2.why',
      'austrianNotes.at1',
    ]);
  });

  it('reports missing files for a locale that is not ready, without failing it', () => {
    expect(coverage([fixture.topic()], locales)).toEqual([
      { topic: 'a2/sample', locale: 'xx', ready: false, missing: ['xx.mdx', 'i18n/xx.yaml'] },
    ]);
  });

  it('reports missing keys for a ready locale', () => {
    fixture.edit('i18n/ru.yaml', (c) =>
      c.replace(/ {4}translation: Russian placeholder w2\n/, '').replace(/ {2}e2: .*\n/, ''),
    );
    expect(coverage([fixture.topic()], locales.slice(0, 2))).toEqual([
      {
        topic: 'a2/sample',
        locale: 'ru',
        ready: true,
        missing: ['examples.e2', 'wordOrder.w2.translation'],
      },
    ]);
  });
});

describe('page coverage', () => {
  it('lists site pages without an MDX file in a locale', () => {
    const root = mkdtempSync(join(tmpdir(), 'pages-'));
    try {
      for (const [slug, files] of [
        ['about', ['en.mdx', 'ru.mdx', 'xx.mdx']],
        ['privacy', ['en.mdx']],
      ] as const) {
        mkdirSync(join(root, slug));
        for (const file of files) writeFileSync(join(root, slug, file), '---\n---\n');
      }
      expect(pageCoverage(root, locales)).toEqual([
        { topic: 'pages/privacy', locale: 'ru', ready: true, missing: ['ru.mdx'] },
        { topic: 'pages/privacy', locale: 'xx', ready: false, missing: ['xx.mdx'] },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('has no gaps when the folder does not exist', () => {
    expect(pageCoverage(join(tmpdir(), 'does-not-exist-pages'), locales)).toEqual([]);
  });
});
