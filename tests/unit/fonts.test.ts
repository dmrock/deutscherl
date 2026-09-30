import { describe, expect, it } from 'vitest';
import {
  cssVariableOf,
  type FontsourcePackage,
  fontFaces,
  fontFamilies,
  germanFont,
  mergeFonts,
} from '../../src/config/fonts.ts';
import { categoryIds } from '../../src/config/site.ts';
import type { LocaleFont } from '../../src/i18n/locales.ts';
import { en } from '../../src/i18n/ui/en.ts';

const pkg: FontsourcePackage = {
  filesDir: '/pkg/files',
  metadata: {
    id: 'demo',
    subsets: ['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext'],
    styles: ['italic', 'normal'],
    variable: { wght: { min: '300', max: '800' } },
  },
  unicode: {
    cyrillic: 'U+0400-045F,U+2116',
    'cyrillic-ext': 'U+0460-052F',
    latin: 'U+0000-00FF',
    'latin-ext': 'U+0100-024F',
  },
};

const font: LocaleFont = {
  family: 'Demo Sans',
  package: '@fontsource-variable/demo',
  subsets: ['cyrillic', 'latin'],
  preload: ['cyrillic'],
};

describe('cssVariableOf()', () => {
  it('derives a CSS variable from the family name', () => {
    expect(cssVariableOf('Golos Text')).toBe('--font-golos-text');
    expect(cssVariableOf('Atkinson Hyperlegible Next')).toBe('--font-atkinson-hyperlegible-next');
  });
});

describe('fontFaces()', () => {
  it('creates faces only for the configured subsets, per style', () => {
    const faces = fontFaces(font, pkg);
    expect(faces.map((face) => `${face.meta?.subset}/${face.style}`)).toEqual([
      'cyrillic/italic',
      'cyrillic/normal',
      'latin/italic',
      'latin/normal',
    ]);
  });

  it('uses the variable weight range, unicode range and Fontsource file name', () => {
    const [face] = fontFaces({ ...font, subsets: ['cyrillic'] }, pkg);
    expect(face).toMatchObject({
      weight: [300, 800],
      display: 'swap',
      unicodeRange: ['U+0400-045F', 'U+2116'],
      src: [{ url: '/pkg/files/demo-cyrillic-wght-italic.woff2', format: 'woff2' }],
    });
  });

  it('fails for a subset the package does not have', () => {
    expect(() => fontFaces({ ...font, subsets: ['greek'] }, pkg)).toThrow(/no "greek" subset/);
  });

  it('fails for a package without a variable weight axis', () => {
    const noWeight = { ...pkg, metadata: { ...pkg.metadata, variable: {} } };
    expect(() => fontFaces(font, noWeight)).toThrow(/variable weight axis/);
  });
});

describe('mergeFonts()', () => {
  it('merges fonts of the same family into one entry with all subsets', () => {
    const merged = mergeFonts([
      { ...font, subsets: ['latin'] },
      { ...font, subsets: ['cyrillic', 'latin'] },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.subsets).toEqual(['latin', 'cyrillic']);
  });

  it('fails when one family comes from two packages', () => {
    expect(() => mergeFonts([font, { ...font, package: '@fontsource-variable/other' }])).toThrow(
      /two packages/,
    );
  });
});

describe('site fonts', () => {
  it('registers every locale font and the German font once, from installed packages', () => {
    const families = fontFamilies();
    expect(families.map((family) => family.name).sort()).toEqual([
      'Atkinson Hyperlegible Next',
      'Golos Text',
    ]);
    expect(families.map((family) => family.cssVariable)).toContain(
      cssVariableOf(germanFont.family),
    );
  });

  it('has a UI label for every category', () => {
    for (const id of categoryIds) expect(en).toHaveProperty(`category.${id}`);
  });
});
