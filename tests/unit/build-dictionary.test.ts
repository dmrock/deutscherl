import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { count, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../../db/schema.ts';
import { buildDictionary, loadDictionary } from '../../scripts/build-dictionary.ts';
import { serializeEntries, type WordEntry } from '../../src/lib/dictionary.ts';
import { type ContentFixture, contentFixture } from './helpers/content-fixture.ts';

const see: WordEntry = {
  id: 'see-der',
  lemma: 'See',
  pos: 'noun',
  gender: 'm',
  plural: 'Seen',
  level: 'a1',
  status: 'draft',
  source: 'wiktionary-en',
  sourceUrl: 'https://en.wiktionary.org/wiki/See',
  license: 'CC BY-SA 4.0',
  senses: [
    { lang: 'en', gloss: 'lake', source: 'wiktionary-en' },
    { lang: 'en', gloss: 'pond', source: 'wiktionary-en' },
  ],
  examples: [
    {
      id: 'see-der-x1',
      de: 'Wir schwimmen im See.',
      translations: { en: 'We swim in the lake.' },
      source: 'wiktionary-en',
    },
  ],
  regional: [],
};
const kartoffel: WordEntry = {
  ...see,
  id: 'kartoffel-die',
  lemma: 'Kartoffel',
  gender: 'f',
  plural: 'Kartoffeln',
  sourceUrl: 'https://en.wiktionary.org/wiki/Kartoffel',
  senses: [{ lang: 'en', gloss: 'potato', source: 'wiktionary-en' }],
  examples: [],
  regional: [{ region: 'AT', variant: 'Erdapfel' }],
};

let dir: string;
let content: ContentFixture;
let input: { wordsFile: string; overridesDir: string; topicsRoot: string; out: string };

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'deutscherl-dictionary-'));
  content = contentFixture();
  input = {
    wordsFile: join(dir, 'words.jsonl'),
    overridesDir: join(dir, 'overrides'),
    topicsRoot: content.root,
    out: join(dir, 'cache', 'dictionary.sqlite'),
  };
  mkdirSync(input.overridesDir);
  writeFileSync(input.wordsFile, serializeEntries([see, kartoffel]));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  content.cleanup();
});

function override(name: string, yaml: string): void {
  writeFileSync(join(input.overridesDir, name), yaml);
}

function useWord(id: string): void {
  content.edit('en.mdx', (mdx) => `${mdx}\nA <Word id="${id}" /> here.\n`);
}

describe('build-dictionary', () => {
  it('builds the database with overrides and topic words', async () => {
    override('fixes.yaml', 'patch:\n  see-der:\n    level: a2\n');
    useWord('see-der');
    const { errors, counts } = await buildDictionary(input);
    expect(errors).toEqual([]);
    expect(counts).toEqual({
      words: 2,
      senses: 3,
      examples: 1,
      exampleTranslations: 1,
      regionalVariants: 1,
      topicWords: 1,
    });

    const client = createClient({ url: `file:${input.out}` });
    try {
      const db = drizzle(client, { schema });
      const [row] = await db.select().from(schema.words).where(eq(schema.words.id, 'see-der'));
      expect(row).toMatchObject({ lemma: 'See', gender: 'm', plural: 'Seen', level: 'a2' });
      const senses = await db
        .select({ gloss: schema.senses.gloss, position: schema.senses.position })
        .from(schema.senses)
        .where(eq(schema.senses.wordId, 'see-der'));
      expect(senses).toEqual([
        { gloss: 'lake', position: 1 },
        { gloss: 'pond', position: 2 },
      ]);
      expect(await db.select().from(schema.topicWords)).toEqual([
        { topicSlug: 'a2/sample', wordId: 'see-der' },
      ]);
      expect(await db.select({ n: count() }).from(schema.regionalVariants)).toEqual([{ n: 1 }]);
    } finally {
      client.close();
    }
  });

  it('builds an empty dictionary without words.jsonl', async () => {
    rmSync(input.wordsFile);
    const { errors, counts } = await buildDictionary(input);
    expect(errors).toEqual([]);
    expect(counts?.words).toBe(0);
  });

  it('replaces an existing database', async () => {
    await buildDictionary(input);
    writeFileSync(input.wordsFile, serializeEntries([see]));
    const { counts } = await buildDictionary(input);
    expect(counts?.words).toBe(1);
  });

  it('fails on a duplicate id without writing', async () => {
    writeFileSync(input.wordsFile, serializeEntries([see]) + serializeEntries([see]));
    const { errors, counts } = await buildDictionary(input);
    expect(errors).toContain('duplicate id "see-der"');
    expect(counts).toBeUndefined();
  });

  it('fails on an unknown <Word id> in a topic', () => {
    useWord('see-die');
    expect(loadDictionary(input).errors).toEqual(['a2/sample/en.mdx: unknown <Word id="see-die">']);
  });

  it('fails on an override problem', () => {
    override('bad.yaml', 'patch:\n  hund-der:\n    level: a1\n');
    expect(loadDictionary(input).errors).toEqual(['bad.yaml: patch for unknown id "hund-der"']);
  });

  it('reports an override file that is not valid YAML', () => {
    override('broken.yaml', 'patch: [\n');
    expect(loadDictionary(input).errors).toEqual([
      expect.stringMatching(/^broken\.yaml: cannot be parsed/),
    ]);
  });
});
