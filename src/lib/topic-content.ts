/**
 * Content of one topic or reference page for the current page (Astro-only: reads content
 * collections). MDX components (<Example>, <AustrianNote>, <GermanTable>) use it with the page's
 * route params and locale.
 */
import { getEntry } from 'astro:content';
import type { LocaleCode } from '../i18n/locales.ts';
import { getLocaleFromPath } from '../i18n/utils.ts';
import type { GermanContent, Review, TopicI18n } from './content-schemas.ts';

export interface TopicContent {
  locale: LocaleCode;
  german: GermanContent;
  /** Translations in the page locale; validate-content guarantees them for ready locales */
  i18n: TopicI18n | undefined;
  review: Review | undefined;
}

export async function getTopicContent(
  level: string,
  slug: string,
  locale: LocaleCode,
): Promise<TopicContent> {
  const key = `${level}/${slug}`;
  const [german, i18n, review] = await Promise.all([
    getEntry('topicGerman', key),
    getEntry('topicI18n', `${key}/${locale}`),
    getEntry('topicReview', key),
  ]);
  if (!german) throw new Error(`Missing german.yaml for ${key}`);
  return { locale, german: german.data, i18n: i18n?.data, review: review?.data };
}

export async function getReferenceContent(slug: string, locale: LocaleCode): Promise<TopicContent> {
  const [german, i18n, review] = await Promise.all([
    getEntry('referenceGerman', slug),
    getEntry('referenceI18n', `${slug}/${locale}`),
    getEntry('referenceReview', slug),
  ]);
  if (!german) throw new Error(`Missing german.yaml for reference/${slug}`);
  return { locale, german: german.data, i18n: i18n?.data, review: review?.data };
}

/**
 * Content of the page being rendered: topic routes have `level` and `topic` params, reference
 * routes a `reference` param.
 */
export function getPageTopicContent(astro: {
  params: Record<string, string | undefined>;
  url: URL;
}): Promise<TopicContent> {
  const { level, topic, reference } = astro.params;
  const locale = getLocaleFromPath(astro.url.pathname);
  if (reference) return getReferenceContent(reference, locale);
  if (!level || !topic) throw new Error(`Not a topic or reference page: ${astro.url.pathname}`);
  return getTopicContent(level, topic, locale);
}
