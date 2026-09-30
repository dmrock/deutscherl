/** axe checks on every page type, English pages, both themes (CLAUDE.md, "Testing"). */
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { t } from '../../src/i18n/utils.ts';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const pages = [
  { name: 'home', path: '/' },
  { name: 'level', path: '/a2/' },
  { name: 'level without topics', path: '/a1/' },
  { name: 'coming soon', path: '/b1/' },
  { name: 'topic', path: '/a2/perfekt/' },
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    for (const { name, path } of pages) {
      test(`${name} page has no axe violations`, async ({ page }) => {
        await page.goto(path);
        const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
        expect(results.violations).toEqual([]);
      });
    }
  });
}

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('topic page with the sheet open has no axe violations', async ({ page }) => {
    await page.goto('/a2/perfekt/');
    await page.getByRole('button', { name: t('en', 'nav.menu') }).click();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations).toEqual([]);
  });
});
