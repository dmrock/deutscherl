/** Reference pages and their navigation, English pages (`.claude/rules/testing.md`). */
import { expect, test } from '@playwright/test';
import { site } from '../../src/config/site.ts';
import { t } from '../../src/i18n/utils.ts';
import { referenceTitle } from './helpers/pages.ts';
import { searchModal as modal, openSearch } from './helpers/search.ts';

const verbs = referenceTitle('unregelmaessige-verben');
const genus = referenceTitle('genus');
const verbsPath = '/reference/unregelmaessige-verben/';

test('home → reference index → reference page', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('region', { name: t('en', 'reference.title') })
    .getByRole('link', { name: t('en', 'reference.title') })
    .click();
  await expect(page).toHaveURL('/reference/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(t('en', 'reference.title'));

  await page
    .getByRole('main')
    .getByRole('link', { name: new RegExp(verbs) })
    .click();
  await expect(page).toHaveURL(verbsPath);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(verbs);
});

test('the Reference tab is marked and the sidebar lists the reference pages', async ({ page }) => {
  await page.goto(verbsPath);
  await expect(
    page.getByRole('banner').getByRole('link', { name: t('en', 'nav.reference') }),
  ).toHaveAttribute('aria-current', 'true');
  const sidebar = page.getByRole('navigation', { name: t('en', 'nav.referencePages') });
  await expect(sidebar.getByRole('link', { name: genus })).toHaveAttribute(
    'href',
    '/reference/genus/',
  );
  await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute('href', verbsPath);
});

test('a reference page has tables of German forms and no practice', async ({ page }) => {
  await page.goto(verbsPath);
  const table = page.locator('#german-table-a-ae');
  // A focusable region named by the caption, so keyboard users can scroll it.
  await expect(table).toHaveAttribute('role', 'region');
  await expect(table).toHaveAttribute('tabindex', '0');
  const caption = await table.locator('caption').textContent();
  await expect(page.getByRole('region', { name: caption ?? '' })).toBeVisible();

  const row = page.locator('#row-fahren');
  await expect(row.getByRole('rowheader')).toHaveText('fahren');
  await expect(row.locator('[lang="de"]')).toHaveText(['fahren', 'fährt', 'ist gefahren']);
  await expect(row.locator('td.gloss')).not.toHaveAttribute('lang', /.*/);
  await expect(row.getByRole('rowheader')).toHaveCSS('position', 'sticky');
  await expect(page.locator('#german-table-a-ae th[scope="col"]').last()).toHaveText(
    t('en', 'table.meaning'),
  );

  await expect(page.locator('#practice')).toHaveCount(0);
  await expect(page.locator('[data-badge]')).toHaveCount(1);
});

test('an Austrian variant shows the flag and a label in the page language', async ({ page }) => {
  await page.goto(verbsPath);
  const row = page.locator('#row-sitzen');
  await expect(row.locator('.flag')).toHaveCount(1);
  await expect(row.locator('.sr-only')).toHaveText(`${t('en', 'topic.austrianUsage')}:`);
  await expect(row.locator('.sr-only')).not.toHaveAttribute('lang', /.*/);
  await expect(row.locator('[lang="de"]').last()).toHaveText('ist gesessen');
});

test('the contents list jumps to a section', async ({ page }) => {
  await page.goto(verbsPath);
  const contents = page.getByRole('navigation', { name: t('en', 'reference.onThisPage') });
  const link = contents.getByRole('link').nth(1);
  const target = (await link.getAttribute('href')) ?? '';
  await link.click();
  await expect(page).toHaveURL(new RegExp(`${target}$`));
  await expect(page.locator(target)).toBeInViewport();
});

test('search finds a participle from a reference table', async ({ page }) => {
  await page.goto('/');
  await openSearch(page);
  await page.keyboard.type('geschwommen');
  await expect(modal(page).getByRole('link', { name: verbs })).toBeVisible();
});

test('a reference page has structured data for its levels', async ({ page }) => {
  await page.goto(verbsPath);
  const data = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '',
  ) as { '@type': string; educationalLevel?: string; learningResourceType?: string[] }[];
  expect(data.map((entry) => entry['@type'])).toEqual(['LearningResource', 'BreadcrumbList']);
  expect(data[0]).toMatchObject({
    educationalLevel: 'A1, A2',
    learningResourceType: ['reference'],
  });
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${site.url}${verbsPath}`,
  );
});

test.describe('on mobile', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('the sheet has the Reference tab and the reference pages', async ({ page }) => {
    await page.goto('/reference/genus/');
    await page.getByRole('button', { name: t('en', 'nav.menu') }).click();
    const sheet = page.locator('#sidebar');
    // The tab next to the levels; the list below has its own link to the index.
    await expect(sheet.locator('a[aria-current="true"]')).toHaveText(t('en', 'nav.reference'));
    await expect(sheet.locator('a[aria-current="page"]')).toHaveAttribute(
      'href',
      '/reference/genus/',
    );
  });
});
