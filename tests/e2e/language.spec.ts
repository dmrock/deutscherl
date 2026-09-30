/**
 * Language switching: the only e2e tests on non-English pages (CLAUDE.md, "Testing").
 */
import { expect, type Page, test } from '@playwright/test';
import { site } from '../../src/config/site.ts';
import { getLocaleConfig } from '../../src/i18n/locales.ts';
import { t } from '../../src/i18n/utils.ts';

const ruName = getLocaleConfig('ru').name;

const storage = (page: Page, key: string) =>
  page.evaluate((name) => localStorage.getItem(name), key);

test.describe('language picker', () => {
  test('opens the same page in the other locale and saves the choice', async ({ page }) => {
    await page.goto('/a2/perfekt/');
    const picker = page.locator('.language-picker');
    await picker.locator('summary').click();
    await picker.getByRole('link', { name: ruName }).click();

    await expect(page).toHaveURL('/ru/a2/perfekt/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    expect(await storage(page, 'locale')).toBe('ru');
  });
});

test.describe('language hint', () => {
  const hint = (page: Page) => page.locator('[data-language-hint="ru"]');

  test('appears when the saved locale differs and stays dismissed', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('locale', 'ru'));
    await page.goto('/a2/perfekt/');

    await expect(hint(page)).toBeVisible();
    await expect(hint(page).getByRole('link', { name: ruName })).toHaveAttribute(
      'href',
      '/ru/a2/perfekt/',
    );
    await hint(page)
      .getByRole('button', { name: t('ru', 'languageHint.dismiss') })
      .click();
    await expect(hint(page)).toBeHidden();

    await page.reload();
    await expect(hint(page)).toBeHidden();
    expect(await storage(page, 'hint-dismissed:ru')).toBe('1');
  });

  test('does not appear when the saved locale is the page locale', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('locale', 'en'));
    await page.goto('/a2/perfekt/');
    await expect(page.locator('[data-language-hint]')).toHaveCount(1);
    await expect(hint(page)).toBeHidden();
  });

  test.describe('with a Russian browser and nothing saved', () => {
    test.use({ locale: 'ru-RU' });

    test('suggests the Russian page and its link saves the choice', async ({ page }) => {
      await page.goto('/a2/perfekt/');
      await expect(hint(page)).toBeVisible();
      await expect(hint(page)).toContainText(
        t('ru', 'languageHint.available').split('{language}')[0]?.trim() ?? '',
      );
      await hint(page).getByRole('link', { name: ruName }).click();
      await expect(page).toHaveURL('/ru/a2/perfekt/');
      expect(await storage(page, 'locale')).toBe('ru');
    });

    test('shows no hint on the Russian page', async ({ page }) => {
      await page.goto('/ru/a2/perfekt/');
      await expect(page.locator('[data-language-hint]:visible')).toHaveCount(0);
    });
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
    await page.addInitScript(() => localStorage.setItem('locale', 'en'));
    await page.goto('/ru/a2/perfekt/');
    await expect(page.locator('[data-language-hint="en"]')).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
