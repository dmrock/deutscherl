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

test('shows the draft badge, the reading time and no English-version link', async ({ page }) => {
  await page.goto(PATH);
  const badges = page.getByRole('list', { name: t('en', 'review.status') });
  await expect(badges.getByRole('listitem')).toHaveText([t('en', 'review.draft')]);
  await expect(page.getByText(t('en', 'topic.readingTime', { minutes: 4 }))).toBeVisible();
  await expect(page.getByRole('link', { name: t('en', 'review.englishVersion') })).toHaveCount(0);
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

test('audio buttons appear when the browser can speak', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    Object.assign(window, { spoken });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [{ lang: 'de-DE', name: 'German' }],
        cancel: () => {},
        speak: (utterance: { text: string }) => spoken.push(utterance.text),
      },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: class {
        text: string;
        lang = '';
        voice: unknown = null;
        constructor(text: string) {
          this.text = text;
        }
      },
    });
  });
  await page.goto(PATH);
  const button = page.locator('#example-e2').getByRole('button', { name: t('en', 'topic.listen') });
  await button.click();
  expect(await page.evaluate(() => (window as unknown as { spoken: string[] }).spoken)).toEqual([
    'Wir sind am Wochenende nach Graz gefahren.',
  ]);
});
