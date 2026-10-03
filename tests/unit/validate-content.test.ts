import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { capitalizedParts, validateContent } from '../../scripts/validate-content.ts';
import { type ContentFixture, contentFixture } from './helpers/content-fixture.ts';

let fixture: ContentFixture;

beforeEach(() => {
  fixture = contentFixture();
});

afterEach(() => {
  fixture.cleanup();
});

/** Messages of all issues, as `file: message`. */
function issues(): string[] {
  return validateContent(fixture.root).map((issue) =>
    issue.file ? `${issue.file}: ${issue.message}` : issue.message,
  );
}

/** Changes a file without re-syncing review.yaml (that would be a second, separate issue). */
function change(file: string, from: string | RegExp, to: string): void {
  fixture.edit(file, (content) => {
    const next = content.replace(from, to);
    if (next === content) throw new Error(`fixture change did not apply to ${file}: ${from}`);
    return next;
  });
  fixture.sync();
}

describe('validate-content', () => {
  it('accepts the valid fixture', () => {
    expect(issues()).toEqual([]);
  });

  it('reports a schema error with its path', () => {
    change('meta.yaml', 'readingMinutes: 2', 'readingMinutes: two');
    expect(issues()).toEqual([expect.stringMatching(/^meta\.yaml: readingMinutes: /)]);
  });

  it('reports a YAML syntax error', () => {
    change('german.yaml', 'examples:', 'examples: [');
    expect(issues()).toContainEqual(expect.stringMatching(/^german\.yaml: cannot be parsed/));
  });

  it('fails when meta.level does not match the folder', () => {
    change('meta.yaml', 'level: a2', 'level: a1');
    expect(issues()).toEqual(['meta.yaml: level "a1" does not match the folder "a2"']);
  });

  it('fails on a missing ru key', () => {
    change('i18n/ru.yaml', / {2}c3:\n {4}why: .*\n/, '');
    expect(issues()).toEqual(['[ru] missing choice.c3.why']);
  });

  it('fails on a missing ru file', () => {
    fixture.remove('ru.mdx');
    fixture.sync();
    expect(issues()).toEqual(['[ru] missing ru.mdx']);
  });

  it('fails on an unknown example id in MDX', () => {
    change('en.mdx', '<Example id="e2" />', '<Example id="e9" />');
    expect(issues()).toEqual(['en.mdx: <Example id="e9"> is not an example in german.yaml']);
  });

  it('fails on an unknown Austrian note id in MDX', () => {
    change('ru.mdx', '<AustrianNote id="at1">', '<AustrianNote id="e1">');
    expect(issues()).toEqual([
      'ru.mdx: <AustrianNote id="e1"> is not an Austrian note in german.yaml',
    ]);
  });

  it('fails on an i18n key without a German item', () => {
    change('i18n/en.yaml', 'examples:\n', 'examples:\n  e7: English e7\n');
    expect(issues()).toEqual(['i18n/en.yaml: key "examples.e7" has no item in german.yaml']);
  });

  it('fails when the answer is not one of the options', () => {
    change(
      'german.yaml',
      /answer: bin\n {4}options: \[bin, habe\]/,
      'answer: bin\n    options: [ist, habe]',
    );
    expect(issues()).toEqual(['german.yaml: choice c1: answer "bin" is not one of the options']);
  });

  it('fails when the text has no gap or two gaps', () => {
    change('german.yaml', 'text: Ich ___ gegangen.', 'text: Ich ___ ___ gegangen.');
    expect(issues()).toEqual([
      'german.yaml: choice c1: text must contain exactly one ___ (found 2)',
    ]);
  });

  it('fails when alsoCorrect is not one of the options or is the answer', () => {
    change(
      'german.yaml',
      /( {2}- id: c10\n.*\n.*\n {4}options: \[bin, habe\]\n)/,
      '$1    alsoCorrect:\n      - { value: ist, region: AT }\n      - { value: bin, region: AT }\n',
    );
    expect(issues()).toEqual([
      'german.yaml: choice c10: alsoCorrect "ist" is not one of the options',
      'german.yaml: choice c10: alsoCorrect "bin" is the answer',
    ]);
  });

  it('fails on duplicate ids across sections', () => {
    change('german.yaml', '  - id: c2\n', '  - id: e1\n');
    fixture.edit('i18n/en.yaml', (content) => content.replace('  c2:\n', '  e1:\n'));
    expect(issues()).toContainEqual(
      'german.yaml: duplicate id "e1" (ids are unique across the whole file)',
    );
  });

  it('fails with fewer than 10 choice items', () => {
    change('german.yaml', / {2}- id: c10\n(?: {4}.*\n)+/, '');
    change('i18n/en.yaml', / {2}c10:\n.*\n/, '');
    change('i18n/ru.yaml', / {2}c10:\n.*\n/, '');
    expect(issues()).toEqual(['german.yaml: needs at least 10 choice items (found 9)']);
  });

  it('fails on a capitalized sentence-initial part', () => {
    change('german.yaml', 'parts: [ich, habe,', 'parts: [Ich, habe,');
    change(
      'german.yaml',
      '[einen Kaffee, habe, ich, getrunken]',
      '[einen Kaffee, habe, Ich, getrunken]',
    );
    expect(issues()).toEqual([
      'german.yaml: wordOrder w1: part "Ich" must be stored in neutral case (lowercase unless always capitalized)',
    ]);
  });

  it('fails when an accepted order uses different parts', () => {
    change(
      'german.yaml',
      '[einen Kaffee, habe, ich, getrunken]',
      '[einen Tee, habe, ich, getrunken]',
    );
    expect(issues()).toEqual([
      'german.yaml: wordOrder w1: accept[0] must use exactly the same parts as `parts`',
    ]);
  });

  it('fails when an accepted order repeats the canonical order', () => {
    change(
      'german.yaml',
      '[einen Kaffee, habe, ich, getrunken]',
      '[ich, habe, einen Kaffee, getrunken]',
    );
    expect(issues()).toEqual(['german.yaml: wordOrder w1: accept[0] repeats another order']);
  });

  it('fails when a fixed item accepts an order with another first part', () => {
    change(
      'german.yaml',
      '    fixed: true\n',
      '    fixed: true\n    accept:\n      - [bist, du, wann, gekommen]\n',
    );
    expect(issues()).toEqual([
      'german.yaml: wordOrder w2: accept[0] must start with the fixed part "wann"',
    ]);
  });

  it('fails on a stale review hash', () => {
    fixture.edit('german.yaml', (content) =>
      content.replace('Ich **bin** gegangen.', 'Ich **bin** gelaufen.'),
    );
    expect(issues()).toEqual([
      'review.yaml: missing or out of date (stale hash). Run pnpm review:sync',
    ]);
  });

  it('fails on a missing review.yaml', () => {
    fixture.remove('review.yaml');
    expect(issues()).toEqual([
      'review.yaml: missing or out of date (stale hash). Run pnpm review:sync',
    ]);
  });

  it('fails on files for unknown locales and unknown files', () => {
    fixture.write('xx.mdx', fixture.read('en.mdx'));
    fixture.write('notes.txt', 'hello');
    expect(issues()).toEqual(
      expect.arrayContaining([
        'xx.mdx: "xx" is not a locale in src/i18n/locales.ts',
        'notes.txt: unknown file in a topic folder',
      ]),
    );
  });
});

describe('capitalizedParts', () => {
  it('flags capitalized closed-class words, not nouns or formal Sie', () => {
    expect(capitalizedParts(['Ich', 'Gestern', 'Nach Wien', 'ich', 'gestern'])).toEqual([
      'Ich',
      'Gestern',
      'Nach Wien',
    ]);
    expect(capitalizedParts(['Kaffee', 'Anna', 'Sie', 'die', 'Kinder', 'Morgen'])).toEqual([]);
  });
});
