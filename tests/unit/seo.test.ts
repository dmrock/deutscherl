import { describe, expect, it } from 'vitest';
import {
  breadcrumbData,
  inSitemap,
  jsonLd,
  referenceData,
  topicData,
  websiteData,
} from '../../src/lib/seo.ts';

const origin = 'https://example.com';

describe('jsonLd', () => {
  it('escapes < so the text cannot close the script tag', () => {
    const json = jsonLd({ name: '</script><script>alert(1)</script>' });
    expect(json).not.toContain('<');
    expect(JSON.parse(json)).toEqual({ name: '</script><script>alert(1)</script>' });
  });
});

describe('structured data', () => {
  it('builds a breadcrumb list with positions', () => {
    expect(
      breadcrumbData([
        { name: 'Home', url: `${origin}/` },
        { name: 'Level A2', url: `${origin}/a2/` },
      ]),
    ).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${origin}/` },
        { '@type': 'ListItem', position: 2, name: 'Level A2', item: `${origin}/a2/` },
      ],
    });
  });

  it('describes the website and topic pages in the page language', () => {
    expect(
      websiteData({ name: 'Site', url: `${origin}/ru/`, description: 'd', locale: 'ru' }),
    ).toMatchObject({
      '@type': 'WebSite',
      inLanguage: 'ru',
    });
    expect(
      topicData({
        title: 'Perfekt',
        description: 'd',
        url: `${origin}/a2/perfekt/`,
        locale: 'en',
        level: 'A2',
      }),
    ).toMatchObject({
      '@type': 'LearningResource',
      educationalLevel: 'A2',
      inLanguage: 'en',
      isAccessibleForFree: true,
    });
  });
});

describe('referenceData', () => {
  it('describes a reference page for several levels', () => {
    expect(
      referenceData({
        title: 'Genus',
        description: 'd',
        url: `${origin}/reference/genus/`,
        locale: 'en',
        levels: ['A1', 'A2'],
      }),
    ).toMatchObject({
      '@type': 'LearningResource',
      educationalLevel: 'A1, A2',
      learningResourceType: ['reference'],
      inLanguage: 'en',
    });
  });

  it('keeps reference pages in the sitemap', () => {
    expect(inSitemap(`${origin}/reference/`)).toBe(true);
    expect(inSitemap(`${origin}/ru/reference/genus/`)).toBe(true);
  });
});

describe('inSitemap', () => {
  it('keeps indexable pages in every ready locale', () => {
    for (const path of ['/', '/a1/', '/a2/perfekt/', '/ru/', '/ru/a2/', '/ru/legal/']) {
      expect(inSitemap(`${origin}${path}`), path).toBe(true);
    }
  });

  it('leaves out coming-soon levels and the 404 pages', () => {
    for (const path of [
      '/b1/',
      '/c1/',
      '/ru/b2/',
      '/404/',
      '/404.html',
      '/ru/404/',
      '/ru/404.html',
    ]) {
      expect(inSitemap(`${origin}${path}`), path).toBe(false);
    }
  });
});
