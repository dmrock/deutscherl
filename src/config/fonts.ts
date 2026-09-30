/**
 * Fonts (CLAUDE.md, "Fonts"). Every locale font from `locales.ts` plus the German font is
 * self-hosted from its Fontsource package through Astro's Fonts API. Only the subsets listed in the
 * config get `@font-face` rules. Build-time only: imported by astro.config.ts and Base.astro.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { AstroUserConfig, FontProvider } from 'astro';
import { type LocaleFont, locales } from '../i18n/locales.ts';

/** German content blocks use this font on every locale. */
export const germanFont = {
  family: 'Atkinson Hyperlegible Next',
  package: '@fontsource-variable/atkinson-hyperlegible-next',
  subsets: ['latin', 'latin-ext'],
  preload: [],
} as const satisfies LocaleFont;

type FontFace = NonNullable<Awaited<ReturnType<FontProvider['resolveFont']>>>['fonts'][number];
type PackageProvider = FontProvider<{ faces: FontFace[] }>;
/** Astro's `fonts` entry type for this provider (the type itself is not exported). */
type FontFamily = NonNullable<AstroUserConfig<never, never, PackageProvider[]>['fonts']>[number];

/** The parts of a Fontsource package that the `@font-face` rules are built from. */
export interface FontsourcePackage {
  /** Absolute path of the package's `files/` directory */
  filesDir: string;
  metadata: {
    id: string;
    subsets: string[];
    styles: string[];
    variable?: Record<string, { min: string; max: string }>;
  };
  /** Unicode range per subset (`unicode.json`) */
  unicode: Record<string, string>;
}

/** CSS variable of a font family: `Golos Text` becomes `--font-golos-text`. */
export function cssVariableOf(family: string): `--font-${string}` {
  return `--font-${family.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

/** One `@font-face` per subset and style of a variable Fontsource font. */
export function fontFaces(font: LocaleFont, pkg: FontsourcePackage): FontFace[] {
  const { id, subsets, styles, variable } = pkg.metadata;
  const weight = variable?.wght;
  if (!weight) throw new Error(`${font.package} has no variable weight axis`);
  return font.subsets.flatMap((subset) => {
    const range = pkg.unicode[subset];
    if (!subsets.includes(subset) || !range) {
      throw new Error(
        `${font.package} has no "${subset}" subset (available: ${subsets.join(', ')})`,
      );
    }
    return styles
      .filter((style) => style === 'normal' || style === 'italic')
      .map((style) => ({
        src: [{ url: join(pkg.filesDir, `${id}-${subset}-wght-${style}.woff2`), format: 'woff2' }],
        weight: [Number(weight.min), Number(weight.max)],
        style,
        display: 'swap',
        unicodeRange: range.split(','),
        meta: { subset },
      }));
  });
}

const require = createRequire(import.meta.url);

function loadPackage(name: string): FontsourcePackage {
  const metadataPath = require.resolve(`${name}/metadata.json`);
  const read = (file: string) =>
    JSON.parse(readFileSync(join(dirname(metadataPath), file), 'utf8'));
  return {
    filesDir: join(dirname(metadataPath), 'files'),
    metadata: read('metadata.json'),
    unicode: read('unicode.json'),
  };
}

/**
 * Serves font files straight from installed Fontsource packages (versions pinned by the lockfile,
 * no network at build time). Unlike Astro's `local` provider it tags each face with its subset, so
 * `<Font preload>` can preload by subset.
 */
function fontsourcePackageProvider(): PackageProvider {
  return {
    name: 'fontsource-package',
    resolveFont: ({ options }) => (options ? { fonts: options.faces } : undefined),
  };
}

/** Fonts with the same family are merged into one entry with the union of their subsets. */
export function mergeFonts(fonts: readonly LocaleFont[]): LocaleFont[] {
  const byFamily = new Map<string, LocaleFont>();
  for (const font of fonts) {
    const existing = byFamily.get(font.family);
    if (existing && existing.package !== font.package) {
      throw new Error(`Font "${font.family}" is configured with two packages`);
    }
    const subsets = new Set([...(existing?.subsets ?? []), ...font.subsets]);
    byFamily.set(font.family, { ...font, subsets: [...subsets], preload: [] });
  }
  return [...byFamily.values()];
}

/** Astro `fonts` config: each distinct font of `locales.ts` and the German font, once. */
export function fontFamilies(fonts: readonly LocaleFont[] = allFonts()): FontFamily[] {
  const provider = fontsourcePackageProvider();
  return mergeFonts(fonts).map((font) => ({
    provider,
    name: font.family,
    cssVariable: cssVariableOf(font.family),
    fallbacks: ['sans-serif'],
    options: { faces: fontFaces(font, loadPackage(font.package)) },
  }));
}

/** Every font the site uses: locale fonts and the German font. */
export function allFonts(): LocaleFont[] {
  return [...locales.map((locale) => locale.font), germanFont];
}

/**
 * Fonts under consideration, shown next to the site fonts on the specimen page (/dev/fonts/) and
 * never loaded in production. Add a candidate here (and its package as a devDependency) when a
 * new locale needs a font; empty once chosen.
 */
export const fontCandidates: readonly LocaleFont[] = [];
