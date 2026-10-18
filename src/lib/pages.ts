/**
 * Site pages (about, legal) from `src/content/pages/<slug>/<locale>.mdx` (Astro-only: reads the
 * `pages` collection). Every ready locale must have its own file (i18n-coverage checks it); a
 * locale that is not ready yet falls back to the default locale's text, so its preview has no
 * broken footer links.
 */
import { type CollectionEntry, getEntry } from 'astro:content';
import { defaultLocale, getLocaleConfig, type LocaleCode, localeCodes } from '../i18n/locales.ts';

export const pageSlugs = ['about', 'legal'] as const;
export type PageSlug = (typeof pageSlugs)[number];

export interface PageProps {
  locale: LocaleCode;
  slug: PageSlug;
}

/** getStaticPaths of a site page: one page per locale. */
export function pagePaths(slug: PageSlug) {
  return localeCodes.map((code) => ({
    params: { locale: code === defaultLocale ? undefined : code },
    props: { locale: code, slug } satisfies PageProps,
  }));
}

export async function getPage(
  slug: PageSlug,
  locale: LocaleCode,
): Promise<{ entry: CollectionEntry<'pages'>; lang: LocaleCode }> {
  const entry = await getEntry('pages', `${slug}/${locale}`);
  if (entry) return { entry, lang: locale };
  if (getLocaleConfig(locale).ready) {
    throw new Error(`Missing src/content/pages/${slug}/${locale}.mdx (ready locale)`);
  }
  const fallback = await getEntry('pages', `${slug}/${defaultLocale}`);
  if (!fallback) throw new Error(`Missing src/content/pages/${slug}/${defaultLocale}.mdx`);
  return { entry: fallback, lang: defaultLocale };
}
