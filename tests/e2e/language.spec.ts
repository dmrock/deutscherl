/**
 * Language switching: the only e2e tests on non-English pages (CLAUDE.md, "Testing").
 */
import { expect, test } from '@playwright/test';
import { site } from '../../src/config/site.ts';
import { getLocaleConfig } from '../../src/i18n/locales.ts';

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

  test('the Russian topic page has no horizontal scrolling', async ({ page }) => {
    await page.goto('/ru/a2/perfekt/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
