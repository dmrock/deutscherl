/** Helpers for the search e2e tests (Pagefind Component UI, loaded on demand). */
import { expect, type Locator, type Page } from '@playwright/test';
import { t } from '../../../src/i18n/utils.ts';

export const searchModal = (page: Page): Locator => page.locator('pagefind-modal');

/** Opens search with the header button and waits until the search input has focus. */
export async function openSearch(page: Page): Promise<void> {
  await page.getByRole('button', { name: t('en', 'search.open') }).click();
  await expect(searchModal(page).locator('input')).toBeFocused();
}
