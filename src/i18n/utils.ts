/**
 * Pure i18n helpers (no Astro imports), unit-tested in tests/unit/i18n.test.ts.
 */
import { defaultLocale, isLocaleCode, type LocaleCode, readyLocales } from './locales.ts';
import { type UiKey, ui } from './ui/index.ts';

export type TranslationParams = Record<string, string | number>;

/** Returns the UI string for `key` in `locale`, with `{name}` placeholders replaced from `params`. */
export function t(locale: LocaleCode, key: UiKey, params?: TranslationParams): string {
  const template = ui[locale][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Adds a leading slash and, for page paths (no file extension), a trailing slash. */
export function normalizePath(path: string): string {
  let result = path.startsWith('/') ? path : `/${path}`;
  const lastSegment = result.slice(result.lastIndexOf('/') + 1);
  if (lastSegment !== '' && !lastSegment.includes('.')) result += '/';
  return result;
}

/** Locale of a URL path: the first segment if it is a non-default locale code, otherwise the default locale. */
export function getLocaleFromPath(path: string): LocaleCode {
  const firstSegment = normalizePath(path).split('/')[1] ?? '';
  if (isLocaleCode(firstSegment) && firstSegment !== defaultLocale) return firstSegment;
  return defaultLocale;
}

/** Removes the locale prefix: `/ru/a2/perfekt/` becomes `/a2/perfekt/`. */
export function stripLocale(path: string): string {
  const normalized = normalizePath(path);
  const locale = getLocaleFromPath(normalized);
  if (locale === defaultLocale) return normalized;
  return normalized.slice(locale.length + 1) || '/';
}

/** Path of the same page in `locale`: the default locale has no prefix, others get `/<code>`. */
export function localizePath(path: string, locale: LocaleCode): string {
  const base = stripLocale(path);
  return locale === defaultLocale ? base : `/${locale}${base}`;
}

export interface Alternate {
  hreflang: string;
  href: string;
}

/** hreflang alternates for a page: every ready locale plus `x-default` (the default locale). */
export function alternates(path: string, origin = ''): Alternate[] {
  const links: Alternate[] = readyLocales.map((locale) => ({
    hreflang: locale,
    href: `${origin}${localizePath(path, locale)}`,
  }));
  links.push({ hreflang: 'x-default', href: `${origin}${localizePath(path, defaultLocale)}` });
  return links;
}
