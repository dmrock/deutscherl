/**
 * SEO helpers (pure, unit-tested): structured data (JSON-LD) and the sitemap filter.
 * Pages that are noindex never go into the sitemap: coming-soon levels, locales that are not
 * ready, the 404 page.
 */
import { levels } from '../config/site.ts';
import { defaultLocale, type LocaleCode, locales } from '../i18n/locales.ts';
import { stripLocale } from '../i18n/utils.ts';

const SCHEMA = 'https://schema.org';

export const CONTENT_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';
export const CODE_LICENSE_URL = 'https://opensource.org/license/mit';

export type StructuredData = Record<string, unknown>;

/** JSON for a `<script type="application/ld+json">`; `<` is escaped so text cannot close the tag. */
export function jsonLd(data: StructuredData | readonly StructuredData[]): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

export function websiteData(options: {
  name: string;
  url: string;
  description: string;
  locale: LocaleCode;
}): StructuredData {
  return {
    '@context': SCHEMA,
    '@type': 'WebSite',
    name: options.name,
    url: options.url,
    description: options.description,
    inLanguage: options.locale,
  };
}

export interface Crumb {
  name: string;
  /** Absolute URL */
  url: string;
}

export function breadcrumbData(crumbs: readonly Crumb[]): StructuredData {
  return {
    '@context': SCHEMA,
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

/** A topic page: explanation and exercises for one grammar rule. */
export function topicData(options: {
  title: string;
  description: string;
  url: string;
  locale: LocaleCode;
  /** CEFR level label, e.g. `A2` */
  level: string;
}): StructuredData {
  return {
    '@context': SCHEMA,
    '@type': 'LearningResource',
    name: options.title,
    description: options.description,
    url: options.url,
    inLanguage: options.locale,
    educationalLevel: options.level,
    learningResourceType: ['explanation', 'exercise'],
    about: { '@type': 'Thing', name: 'German grammar' },
    isAccessibleForFree: true,
    license: CONTENT_LICENSE_URL,
  };
}

/** Whether a built page (absolute URL) belongs in the sitemap. */
export function inSitemap(url: string): boolean {
  const path = new URL(url).pathname;
  if (path === '/404/' || path.endsWith('/404.html')) return false;
  const first = path.split('/')[1] ?? '';
  const locale = locales.find((entry) => entry.code === first && entry.code !== defaultLocale);
  if (locale && !locale.ready) return false;
  const rest = stripLocale(path);
  const comingSoon = levels.some((level) => !level.available && rest === `/${level.id}/`);
  return !comingSoon;
}
