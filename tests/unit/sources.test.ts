import { describe, expect, it } from 'vitest';
import { groupSources, siteOf } from '../../src/lib/sources.ts';

describe('siteOf', () => {
  it('drops www and subdomains', () => {
    expect(siteOf('https://www.duden.de/x')).toBe('duden.de');
    expect(siteOf('https://grammis.ids-mannheim.de/fragen/87')).toBe('ids-mannheim.de');
    expect(siteOf('https://Mediawiki.IDS-Mannheim.de/VarGra')).toBe('ids-mannheim.de');
  });
});

describe('groupSources', () => {
  const duden = { title: 'Duden: Perfekt', url: 'https://www.duden.de/perfekt' };
  const grammis = { title: 'grammis: Frage 87', url: 'https://grammis.ids-mannheim.de/fragen/87' };
  const vargra = { title: 'Variantengrammatik', url: 'https://mediawiki.ids-mannheim.de/VarGra' };
  const book = { title: 'Duden – Die Grammatik' };

  it('de-duplicates by URL and lists every topic that uses a source', () => {
    const groups = groupSources([
      { key: 'a2/perfekt', sources: [duden, grammis] },
      // Same URL with a trailing slash and a fragment, different title: still one source.
      {
        key: 'a2/dativ',
        sources: [{ title: 'Other title', url: 'https://www.duden.de/perfekt/#x' }],
      },
    ]);
    expect(groups.find((group) => group.site === 'duden.de')?.sources).toEqual([
      { title: 'Duden: Perfekt', url: duden.url, topics: ['a2/perfekt', 'a2/dativ'] },
    ]);
  });

  it('de-duplicates sources without a URL by title', () => {
    const groups = groupSources([
      { key: 'a1/artikel', sources: [book] },
      { key: 'a2/dativ', sources: [{ title: ' Duden – Die Grammatik ' }] },
    ]);
    expect(groups).toEqual([
      {
        site: undefined,
        sources: [{ title: book.title, url: undefined, topics: ['a1/artikel', 'a2/dativ'] }],
      },
    ]);
  });

  it('groups by website in alphabetical order, books last, sources sorted by title', () => {
    const groups = groupSources([{ key: 'a2/perfekt', sources: [book, vargra, grammis, duden] }]);
    expect(groups.map((group) => group.site)).toEqual(['duden.de', 'ids-mannheim.de', undefined]);
    expect(groups[1]?.sources.map((source) => source.title)).toEqual([
      'grammis: Frage 87',
      'Variantengrammatik',
    ]);
  });

  it('lists a topic once even when it names a source twice', () => {
    const groups = groupSources([{ key: 'a2/perfekt', sources: [duden, duden] }]);
    expect(groups[0]?.sources[0]?.topics).toEqual(['a2/perfekt']);
  });
});
