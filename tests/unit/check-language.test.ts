import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  allowedPathPatterns,
  checkFiles,
  findViolations,
  formatViolation,
  isAllowedPath,
} from '../../scripts/check-language.ts';

// Non-Latin sample text is written as escapes so this file passes the language check itself.
const CYRILLIC = '\u041f\u0440\u0438\u0432\u0435\u0442'; // "hello" in Russian
const GREEK = '\u03b1\u03b2\u03b3';
const CJK = '\u4e2d\u6587';
const GERMAN = 'Mädchen, Größe, Übung, Straße, Äpfel, Öl';

describe('check-language', () => {
  it('allows native-language text in localization files', () => {
    const paths = [
      'src/i18n/ui/ru.ts',
      'src/content/topics/a2/perfekt/ru.mdx',
      'src/content/topics/a2/perfekt/i18n/ru.yaml',
      'db/data/words.jsonl',
      'db/overrides/nouns.yaml',
      'tests/fixtures/i18n/ru/paragraph.md',
    ];
    for (const path of paths) {
      expect(isAllowedPath(path), path).toBe(true);
      expect(findViolations(path, `title: ${CYRILLIC}`), path).toEqual([]);
    }
  });

  it('fails on Cyrillic in a component', () => {
    const content = `---\nconst x = 1;\n---\n<p>${CYRILLIC}</p>\n`;
    const violations = findViolations('src/components/Example.astro', content);
    expect(violations).toHaveLength(CYRILLIC.length);
    expect(violations[0]).toMatchObject({ line: 4, column: 4, script: 'Cyrillic' });
    expect(formatViolation(violations[0])).toBe(
      'src/components/Example.astro:4:4  Cyrillic letter "\u041f" (U+041F)',
    );
  });

  it('allows German umlauts and ß everywhere', () => {
    for (const path of ['src/components/Example.astro', 'README.md', 'src/i18n/utils.ts']) {
      expect(findViolations(path, GERMAN), path).toEqual([]);
    }
  });

  it('fails on other non-Latin scripts', () => {
    expect(findViolations('src/lib/a.ts', GREEK)[0]?.script).toBe('Greek');
    expect(findViolations('src/lib/a.ts', CJK)[0]?.script).toBe('Han');
  });

  it('allows a native language name in locales.ts only on name lines', () => {
    expect(findViolations('src/i18n/locales.ts', `    name: '${CYRILLIC}',`)).toEqual([]);
    expect(findViolations('src/i18n/locales.ts', `    // ${CYRILLIC}`)).toHaveLength(
      CYRILLIC.length,
    );
  });

  it('does not treat unknown locales or non-locale files as localization files', () => {
    expect(isAllowedPath('src/i18n/ui/index.ts')).toBe(false);
    expect(isAllowedPath('src/i18n/ui/xx.ts')).toBe(false);
    expect(isAllowedPath('src/content/topics/a2/perfekt/german.yaml')).toBe(false);
    expect(isAllowedPath('tests/fixtures/other/ru.txt')).toBe(false);
    expect(allowedPathPatterns(['xx']).some((p) => p.test('src/i18n/ui/xx.ts'))).toBe(true);
  });

  it('skips binary and missing files when reading from disk', () => {
    const root = mkdtempSync(join(tmpdir(), 'check-language-'));
    writeFileSync(join(root, 'bad.ts'), `export const s = '${CYRILLIC}';\n`);
    writeFileSync(join(root, 'image.png'), Buffer.from([0x89, 0x50, 0x00, 0xd0, 0x9f]));
    const violations = checkFiles(['bad.ts', 'image.png', 'deleted.ts'], root);
    expect(violations.map((v) => v.path)).toEqual(Array(CYRILLIC.length).fill('bad.ts'));
  });
});
