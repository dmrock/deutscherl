/**
 * Native languages (locales) of the site. This is the ONLY place where locales are defined:
 * adding a language = adding an entry here + its translation files.
 *
 * The language check allows non-Latin letters in this file only on `name:` lines.
 */

export interface LocaleFont {
  /** CSS font family name */
  family: string;
  /** Fontsource package that self-hosts the font; null = system font (placeholder) */
  package: string | null;
  /** Fontsource subsets this locale needs */
  subsets: readonly string[];
}

export interface LocaleConfig {
  code: string;
  /** Language name in its own language, shown in the language picker */
  name: string;
  /** Exactly one locale is the default: served without a URL prefix */
  default: boolean;
  /** false = built for preview, but hidden from picker, sitemap and search, and pages get noindex */
  ready: boolean;
  dir: 'ltr' | 'rtl';
  font: LocaleFont;
}

export const locales = [
  {
    code: 'en',
    name: 'English',
    default: true,
    ready: true,
    dir: 'ltr',
    font: {
      family: 'Atkinson Hyperlegible Next',
      package: '@fontsource-variable/atkinson-hyperlegible-next',
      subsets: ['latin', 'latin-ext'],
    },
  },
  {
    code: 'ru',
    name: 'Русский',
    default: false,
    ready: true,
    dir: 'ltr',
    // TODO(stage 2): placeholder until the owner picks a Cyrillic font (docs/decisions.md #7).
    font: {
      family: 'system-ui',
      package: null,
      subsets: ['cyrillic', 'latin'],
    },
  },
] as const satisfies readonly LocaleConfig[];

export type LocaleCode = (typeof locales)[number]['code'];

const defaults = locales.filter((locale) => locale.default);
if (defaults.length !== 1) {
  throw new Error(`Expected exactly one default locale, found ${defaults.length}`);
}

export const defaultLocale: LocaleCode = defaults[0].code;

export const localeCodes: readonly LocaleCode[] = locales.map((locale) => locale.code);

export const readyLocales: readonly LocaleCode[] = locales
  .filter((locale) => locale.ready)
  .map((locale) => locale.code);

export function getLocaleConfig(code: LocaleCode): LocaleConfig {
  const config = locales.find((locale) => locale.code === code);
  if (!config) throw new Error(`Unknown locale: ${code}`);
  return config;
}

export function isLocaleCode(value: string): value is LocaleCode {
  return (localeCodes as readonly string[]).includes(value);
}
