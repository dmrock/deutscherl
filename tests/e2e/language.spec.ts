/**
 * Language switching: the only e2e tests on non-English pages (`.claude/rules/testing.md`).
 */
import { expect, test } from '@playwright/test';
import { site } from '../../src/config/site.ts';
import { getLocaleConfig } from '../../src/i18n/locales.ts';
import { t } from '../../src/i18n/utils.ts';

const ruName = getLocaleConfig('ru').name;

test.describe('language picker', () => {
  test('opens the same page in the other locale', async ({ page }) => {
    await page.goto('/a2/perfekt/');
    const picker = page.locator('[data-language-picker]');
    await picker.locator('summary').click();
    await picker.getByRole('link', { name: ruName }).click();

    await expect(page).toHaveURL('/ru/a2/perfekt/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });

  test('closes on a click outside and on Escape', async ({ page }) => {
    await page.goto('/a2/perfekt/');
    const picker = page.locator('[data-language-picker]');
    const summary = picker.locator('summary');

    await summary.click();
    await expect(picker).toHaveAttribute('open');
    await page.getByRole('heading', { level: 1 }).click();
    await expect(picker).not.toHaveAttribute('open');

    await summary.click();
    await page.keyboard.press('Escape');
    await expect(picker).not.toHaveAttribute('open');
    await expect(summary).toBeFocused();
  });
});

test.describe('the picker keeps the page on every page type', () => {
  for (const path of [
    '/',
    '/a2/',
    '/b1/',
    '/reference/',
    '/reference/genus/',
    '/about/',
    '/legal/',
  ]) {
    test(path, async ({ page }) => {
      await page.goto(path);
      const picker = page.locator('[data-language-picker]');
      await picker.locator('summary').click();
      await picker.getByRole('link', { name: ruName }).click();
      await expect(page).toHaveURL(`/ru${path}`);
      await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
      await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
        'href',
        `${site.url}${path}`,
      );
    });
  }
});

test.describe('localized head', () => {
  for (const { path, lang } of [
    { path: '/a2/perfekt/', lang: 'en' },
    { path: '/ru/a2/perfekt/', lang: 'ru' },
  ]) {
    test(`lang, dir, canonical and hreflang on ${path}`, async ({ page }) => {
      await page.goto(path);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', lang);
      await expect(html).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `${site.url}${path}`,
      );
      const alternates = await page
        .locator('link[rel="alternate"][hreflang]')
        .evaluateAll((links) =>
          links.map((link) => [link.getAttribute('hreflang'), link.getAttribute('href')]),
        );
      expect(alternates).toEqual([
        ['en', `${site.url}/a2/perfekt/`],
        ['ru', `${site.url}/ru/a2/perfekt/`],
        ['x-default', `${site.url}/a2/perfekt/`],
      ]);
    });
  }
});

test.describe('mobile width', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const path of ['/ru/a2/perfekt/', '/ru/reference/unregelmaessige-verben/']) {
    test(`${path} has no horizontal scrolling`, async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
});

test.describe('404 page per locale', () => {
  // Cloudflare serves the nearest 404.html for unknown paths; `astro preview` does not, so the
  // pages are opened directly.
  for (const { file, lang, home } of [
    { file: '/404.html', lang: 'en', home: '/' },
    { file: '/ru/404.html', lang: 'ru', home: '/ru/' },
  ] as const) {
    test(file, async ({ page }) => {
      await page.goto(file);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(t(lang, 'notFound.title'));
      await expect(page.getByRole('link', { name: t(lang, 'notFound.backHome') })).toHaveAttribute(
        'href',
        home,
      );
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      await expect(
        page.locator('link[rel="canonical"], link[rel="alternate"][hreflang]'),
      ).toHaveCount(0);

      const picker = page.locator('[data-language-picker]');
      await picker.locator('summary').click();
      await expect(picker.getByRole('link', { name: ruName })).toHaveAttribute('href', '/ru/');
    });
  }
});
