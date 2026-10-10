import { describe, expect, it } from 'vitest';
import { parseMdx } from '../../scripts/lib/content.ts';
import { germanSchema, i18nSchema, metaSchema } from '../../src/lib/content-schemas.ts';
import { splitMarked, stripMarks } from '../../src/lib/marked-text.ts';

describe('marked text', () => {
  it('splits highlighted German verb forms', () => {
    expect(splitMarked('**Hast** du gut **geschlafen**?', '**')).toEqual([
      { text: 'Hast', marked: true },
      { text: ' du gut ', marked: false },
      { text: 'geschlafen', marked: true },
      { text: '?', marked: false },
    ]);
  });

  it('splits German words in native-language text and strips markers', () => {
    expect(splitMarked('Use *sein* here.', '*')).toEqual([
      { text: 'Use ', marked: false },
      { text: 'sein', marked: true },
      { text: ' here.', marked: false },
    ]);
    expect(stripMarks('Ich **bin** da, *sein*.')).toBe('Ich bin da, sein.');
  });
});

describe('content schemas', () => {
  it('accepts meta with optional source urls and rejects unknown fields', () => {
    const meta = {
      level: 'a2',
      category: 'verbs',
      order: 1,
      readingMinutes: 3,
      sources: [{ title: 'Book' }],
    };
    expect(metaSchema.safeParse(meta).success).toBe(true);
    expect(metaSchema.safeParse({ ...meta, sources: [] }).success).toBe(false);
    expect(metaSchema.safeParse({ ...meta, extra: 1 }).success).toBe(false);
  });

  it('checks choice option counts, punctuation and regions', () => {
    const choice = { id: 'c1', text: 'Ich ___ da.', answer: 'bin', options: ['bin'] };
    expect(germanSchema.safeParse({ choice: [choice] }).success).toBe(false);
    expect(
      germanSchema.safeParse({ choice: [{ ...choice, options: ['bin', 'habe'] }] }).success,
    ).toBe(true);
    const wordOrder = { id: 'w1', parts: ['ich', 'bin'], punctuation: ';' };
    expect(germanSchema.safeParse({ wordOrder: [wordOrder] }).success).toBe(false);
    expect(
      germanSchema.safeParse({ examples: [{ id: 'e1', de: 'x', region: 'CH' }] }).success,
    ).toBe(false);
  });

  it('leaves required i18n keys to the coverage check, but rejects unknown fields', () => {
    expect(i18nSchema.safeParse({ wordOrder: { w1: { why: 'x' } } }).success).toBe(true);
    expect(i18nSchema.safeParse({ wordOrder: { w1: { note: 'x' } } }).success).toBe(false);
  });
});

describe('parseMdx', () => {
  it('reads frontmatter and content references', () => {
    const file = parseMdx(
      'en.mdx',
      '---\ntitle: T\nsummary: S\n---\n<Example id="e1" />\n<AustrianNote id=\'at1\'>x</AustrianNote>\nA <Word id="see-der" />.\n',
    );
    expect(file.data).toEqual({ title: 'T', summary: 'S' });
    expect(file.refs).toEqual({ examples: ['e1'], austrianNotes: ['at1'], words: ['see-der'] });
  });

  it('reports missing frontmatter', () => {
    expect(parseMdx('en.mdx', 'Just text').error).toBe('missing frontmatter');
  });
});
