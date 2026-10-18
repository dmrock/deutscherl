/**
 * Search (Pagefind), English pages (`.claude/rules/testing.md`). Needs `pnpm build`, which indexes
 * dist/.
 */
import { expect, test } from '@playwright/test';
import { t } from '../../src/i18n/utils.ts';
import { topicTitle } from './helpers/pages.ts';
import { searchModal as modal, openSearch } from './helpers/search.ts';

const perfekt = topicTitle('a2/perfekt');

test('nothing is loaded until search is opened', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(new URL(request.url()).pathname));
  await page.goto('/a2/');
  await page.waitForLoadState('networkidle');
  expect(requests.filter((path) => path.startsWith('/pagefind/'))).toEqual([]);

  await page.getByRole('button', { name: t('en', 'search.open') }).click();
  await expect(modal(page).locator('dialog')).toBeVisible();
  expect(requests).toContain('/pagefind/pagefind-component-ui.js');
});

test('finds a German word from the examples and opens the topic', async ({ page }) => {
  await page.goto('/');
  await openSearch(page);
  await page.keyboard.type('gesessen');
  const result = modal(page).getByRole('link', { name: perfekt });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/a2\/perfekt\/(#.*)?$/);
});

test('finds English words from the explanation', async ({ page }) => {
  await page.goto('/');
  await openSearch(page);
  await page.keyboard.type('participle');
  await expect(modal(page).getByRole('link', { name: perfekt })).toBeVisible();
});

test('Ctrl+K opens search; Escape closes it and returns focus', async ({ page }) => {
  await page.goto('/a2/perfekt/');
  const button = page.getByRole('button', { name: t('en', 'search.open') });
  await button.focus();
  await page.keyboard.press('Control+k');
  await expect(modal(page).locator('input')).toBeFocused();
  // The first Escape clears the input (Pagefind), the next one closes the dialog.
  await page.keyboard.type('x');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(modal(page).locator('dialog')).toBeHidden();
  await expect(button).toBeFocused();
});
