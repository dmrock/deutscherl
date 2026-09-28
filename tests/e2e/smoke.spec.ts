import { expect, test } from '@playwright/test';
import { t } from '../../src/i18n/utils.ts';

test('home page renders in English', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('en', 'home.title'));
});
