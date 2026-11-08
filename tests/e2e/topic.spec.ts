/** Topic page content components, English page (`.claude/rules/testing.md`). */
import { expect, type Page, test } from '@playwright/test';
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

test.describe('links to topics at other levels', () => {
  const A2 = '/a2/adjektivdeklination/';
  const B1 = '/b1/adjektive-ohne-artikel/';

  /** The links of one group ("Builds on", "Continued in") in the "Other levels" box. */
  const group = (page: Page, key: 'topic.buildsOn' | 'topic.continuedIn') =>
    page
      .getByRole('navigation', { name: t('en', 'topic.otherLevels') })
      .getByRole('list', { name: t('en', key) })
      .getByRole('link');

  test('the higher topic links back to the topic it builds on', async ({ page }) => {
    await page.goto(B1);
    const links = group(page, 'topic.buildsOn');
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute('href', A2);
    await expect(links).toContainText('A2');
    await expect(group(page, 'topic.continuedIn')).toHaveCount(0);
  });

  test('the lower topic links forward to the topic that builds on it', async ({ page }) => {
    await page.goto(A2);
    const links = group(page, 'topic.continuedIn');
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute('href', B1);
    await expect(links).toContainText('B1');
    await links.click();
    await expect(page).toHaveURL(B1);
  });

  test('the box sits inside the explanation, before the practice card', async ({ page }) => {
    await page.goto(A2);
    await expect(page.locator('#explanation [data-level-links]')).toBeVisible();
  });

  test('a topic without links has no box', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.locator('[data-level-links]')).toHaveCount(0);
  });
});
