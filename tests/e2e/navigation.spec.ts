/** Navigation between page types and the new site pages, English pages (CLAUDE.md, "Testing"). */
import { expect, test } from '@playwright/test';
import { levels, plannedTopicsOf } from '../../src/config/site.ts';
import { t } from '../../src/i18n/utils.ts';
import { stripMarks } from '../../src/lib/marked-text.ts';
import { pageTitle, topicTitle } from './helpers/pages.ts';

const perfekt = topicTitle('a2/perfekt');

test('home → level → topic', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: t('en', 'home.start', { level: 'A2' }) }).click();
  await expect(page).toHaveURL('/a2/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    t('en', 'level.title', { level: 'A2' }),
  );

  await page.getByRole('main').getByRole('link', { name: perfekt }).click();
  await expect(page).toHaveURL('/a2/perfekt/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(perfekt);
});

test('the home page lists the topics of available levels and the planned ones of the others', async ({
  page,
}) => {
  await page.goto('/');
  const levelList = page.getByRole('region', { name: t('en', 'nav.levels') }).getByRole('list');
  await expect(levelList.getByRole('link', { name: perfekt })).toHaveAttribute(
    'href',
    '/a2/perfekt/',
  );
  for (const level of levels.filter((entry) => !entry.available)) {
    const card = page.locator('li', {
      has: page.getByRole('heading', { name: new RegExp(`^${level.label}`) }),
    });
    await expect(card).toContainText(t('en', 'level.comingSoon'));
    for (const id of plannedTopicsOf(level.id)) {
      await expect(card).toContainText(stripMarks(t('en', `planned.${id}`)));
    }
  }
});

test('a level page shows the reading time of each topic', async ({ page }) => {
  await page.goto('/a2/');
  await expect(page.getByRole('main').getByRole('link', { name: perfekt })).toContainText(
    t('en', 'level.readingTime', { minutes: 4 }),
  );
});

test('a coming-soon page lists the planned topics', async ({ page }) => {
  await page.goto('/b1/');
  const planned = page.getByRole('region', { name: t('en', 'level.planned') });
  await expect(planned.getByRole('listitem')).toHaveText(
    plannedTopicsOf('b1').map((id) => stripMarks(t('en', `planned.${id}`))),
  );
});

test.describe('footer', () => {
  const links = [
    { key: 'footer.about', path: '/about/', title: pageTitle('about') },
    { key: 'footer.sources', path: '/about/sources/', title: t('en', 'sources.title') },
    { key: 'footer.impressum', path: '/impressum/', title: pageTitle('impressum') },
    { key: 'footer.privacy', path: '/privacy/', title: pageTitle('privacy') },
  ] as const;

  for (const { key, path, title } of links) {
    test(`links to ${path}`, async ({ page }) => {
      await page.goto('/a2/perfekt/');
      const footer = page.getByRole('contentinfo');
      await footer.getByRole('link', { name: t('en', key), exact: true }).click();
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    });
  }
});

test('the sources page lists the grammar references with links back to the topics', async ({
  page,
}) => {
  await page.goto('/about/sources/');
  const duden = page.getByRole('heading', { level: 2, name: 'duden.de' });
  await expect(duden).toBeVisible();
  const usedIn = page.getByRole('main').getByRole('link', { name: perfekt });
  await expect(usedIn.first()).toHaveAttribute('href', '/a2/perfekt/');
});

test('legal pages mark the placeholders the owner still has to fill in', async ({ page }) => {
  await page.goto('/impressum/');
  await expect(page.locator('[data-todo]').first()).toBeVisible();
});
