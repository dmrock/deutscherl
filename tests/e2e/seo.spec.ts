/** SEO and analytics in the built pages, English pages (CLAUDE.md, "Testing"). */
import { expect, test } from '@playwright/test';
import { site } from '../../src/config/site.ts';
import { t } from '../../src/i18n/utils.ts';
import { topicTitle } from './helpers/pages.ts';

test('a topic page has Open Graph tags and structured data', async ({ page }) => {
  await page.goto('/a2/perfekt/');
  const og = (property: string) => page.locator(`meta[property="${property}"]`);
  await expect(og('og:type')).toHaveAttribute('content', 'article');
  await expect(og('og:title')).toHaveAttribute('content', topicTitle('a2/perfekt'));
  await expect(og('og:url')).toHaveAttribute('content', `${site.url}/a2/perfekt/`);
  await expect(og('og:locale')).toHaveAttribute('content', 'en_US');
  await expect(og('og:locale:alternate')).toHaveAttribute('content', 'ru_RU');

  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '',
  ) as { '@type': string; educationalLevel?: string; itemListElement?: unknown[] }[];
  expect(data.map((entry) => entry['@type'])).toEqual(['LearningResource', 'BreadcrumbList']);
  expect(data[0]?.educationalLevel).toBe('A2');
  expect(data[1]?.itemListElement).toHaveLength(3);
});

test('the home page describes the website', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    t('en', 'home.intro'),
  );
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '',
  );
  expect(data).toMatchObject({ '@type': 'WebSite', name: site.name, inLanguage: 'en' });
});

test('robots.txt points to the sitemap', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain(`Sitemap: ${site.url}/sitemap-index.xml`);
});

test('the sitemap lists indexable pages with their alternates, no coming-soon pages', async ({
  request,
}) => {
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).toContain(`<loc>${site.url}/a2/perfekt/</loc>`);
  expect(sitemap).toContain(
    `<xhtml:link rel="alternate" hreflang="ru" href="${site.url}/ru/a2/perfekt/"/>`,
  );
  expect(sitemap).toContain(`<loc>${site.url}/legal/</loc>`);
  expect(sitemap).not.toContain(`<loc>${site.url}/b1/</loc>`);
  expect(sitemap).not.toContain('404');
});

// Cloudflare injects the analytics beacon on the production domain (decision #87); a second one
// from the build would count every visit twice.
test('the build adds no analytics beacon', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('script[src*="cloudflareinsights.com"]')).toHaveCount(0);
});
