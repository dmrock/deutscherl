/** Topic page content components, English page (CLAUDE.md, "Testing"). */
import { expect, test } from '@playwright/test';
import { t } from '../../src/i18n/utils.ts';

const PATH = '/a2/perfekt/';

test('examples show German with lang="de" and a translation', async ({ page }) => {
  await page.goto(PATH);
  const example = page.locator('#example-e1');
  await expect(example.locator('p[lang="de"]')).toHaveText('Ich habe gestern einen Film gesehen.');
  await expect(example.locator('strong')).toHaveText(['habe', 'gesehen']);
  await expect(example.locator('p:not([lang])')).toHaveText('I watched a film yesterday.');
});

test('shows the draft badge', async ({ page }) => {
  await page.goto(PATH);
  const badges = page.getByRole('list', { name: t('en', 'review.status') });
  await expect(badges.getByRole('listitem')).toHaveText([t('en', 'review.draft')]);
});

test('the Austrian note shows its German sentence and translation', async ({ page }) => {
  await page.goto(PATH);
  const note = page.locator('#note-at1');
  await expect(note).toContainText(t('en', 'topic.inAustria'));
  await expect(note.locator('p[lang="de"]')).toContainText('gesessen');
  await expect(note.locator('p:not([lang])').last()).toHaveText('I sat in the office all day.');
});

test('the rule table is rendered', async ({ page }) => {
  await page.goto(PATH);
  await expect(page.locator('.rule-table table')).toBeVisible();
});
