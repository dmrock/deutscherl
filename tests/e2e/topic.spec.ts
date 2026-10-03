/** Topic page content components, English page (CLAUDE.md, "Testing"). */
import { expect, test } from '@playwright/test';
import { t } from '../../src/i18n/utils.ts';

const PATH = '/a2/perfekt/';

test('examples show German with lang="de" and a translation', async ({ page }) => {
  await page.goto(PATH);
  const example = page.locator('#example-e1');
  await expect(example.locator('p[lang="de"]')).toHaveText('Ich habe gestern einen Film gesehen.');
  await expect(example.locator('strong')).toHaveText(['habe', 'gesehen']);
  await expect(example.locator('[data-translation]')).toBeVisible();
});

test('"Hide translations" hides every translation and shows them again', async ({ page }) => {
  await page.goto(PATH);
  const translations = page.locator('[data-translation]');
  const toggle = page.getByLabel(t('en', 'topic.hideTranslations'));
  expect(await translations.count()).toBeGreaterThan(1);

  await toggle.check();
  for (const translation of await translations.all()) await expect(translation).toBeHidden();
  await expect(page.locator('#example-e1 p[lang="de"]')).toBeVisible();

  await toggle.uncheck();
  for (const translation of await translations.all()) await expect(translation).toBeVisible();
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
  await expect(note.locator('[data-translation]')).toBeVisible();
});

test('rule table and sources are rendered', async ({ page }) => {
  await page.goto(PATH);
  await expect(page.locator('.rule-table table')).toBeVisible();
  const sources = page.getByRole('region', { name: t('en', 'topic.sources') });
  await expect(sources.getByRole('link').first()).toHaveAttribute('href', /^https:\/\//);
});
