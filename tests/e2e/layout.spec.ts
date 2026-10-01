/** Layout, theme and indexing rules, on English pages (CLAUDE.md, "Testing"). */
import { expect, type Page, test } from '@playwright/test';
import { t } from '../../src/i18n/utils.ts';

// Same value the tested build used (set in CI; local builds default to development).
const deployEnv = process.env.PUBLIC_DEPLOY_ENV ?? 'development';

test.describe('noindex', () => {
  for (const path of ['/b1/', '/b2/', '/c1/']) {
    test(`coming-soon page ${path} is noindex`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    });
  }

  for (const path of ['/', '/a1/', '/a2/', '/a2/perfekt/']) {
    test(`${path} is noindex only in preview builds`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(
        deployEnv === 'preview' ? 1 : 0,
      );
    });
  }
});

/** Records data-theme as soon as it is set, and whether <body> existed at that moment. */
async function recordFirstTheme(page: Page) {
  await page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement?.dataset.theme;
      if (!theme) return;
      Object.assign(window, { firstTheme: { theme, beforeBody: document.body === null } });
      observer.disconnect();
    });
    observer.observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-theme'],
    });
  });
}

const firstTheme = (page: Page) =>
  page.evaluate(() => (window as unknown as { firstTheme?: unknown }).firstTheme);

test.describe('theme', () => {
  test('a saved dark theme applies before the body renders (no flash)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await recordFirstTheme(page);
    await page.goto('/a2/perfekt/');
    expect(await firstTheme(page)).toEqual({ theme: 'dark', beforeBody: true });
  });

  test('the system dark theme applies before the body renders when nothing is saved', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await recordFirstTheme(page);
    await page.goto('/');
    expect(await firstTheme(page)).toEqual({ theme: 'dark', beforeBody: true });
  });

  test('the toggle switches the theme and remembers it', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    const toggle = page.getByRole('button', { name: t('en', 'theme.dark') });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('navigation on desktop', () => {
  test('the sidebar is shown and marks the current topic; no bottom bar', async ({ page }) => {
    await page.goto('/a2/perfekt/');
    const sidebar = page.getByRole('navigation', { name: t('en', 'nav.topics') });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator('a[aria-current="page"]')).toHaveAttribute('href', '/a2/perfekt/');
    await expect(page.getByRole('button', { name: t('en', 'nav.menu') })).toBeHidden();
    await expect(
      page.getByRole('navigation', { name: t('en', 'nav.topicNavigation') }),
    ).toBeHidden();
  });

  test('the level switcher links to levels and marks the current one', async ({ page }) => {
    await page.goto('/a2/');
    const levels = page
      .getByRole('banner')
      .getByRole('navigation', { name: t('en', 'nav.levels') });
    await expect(levels.locator('a[aria-current="true"]')).toHaveAttribute('href', '/a2/');
    await expect(levels.getByRole('link')).toHaveCount(5);
  });
});

test.describe('static navigation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  /** Boxes of the header widgets and the sidebar, rounded to whole pixels. */
  const chromeBoxes = (page: Page) =>
    page.evaluate(() =>
      ['header a', 'header nav', 'header [data-theme-toggle]', '#sidebar'].map((selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const { x, y, width, height } = element.getBoundingClientRect();
        return [x, y, width, height].map(Math.round);
      }),
    );

  test('the header and sidebar stay in place on every page type', async ({ page }) => {
    await page.goto('/');
    const [brand, levels, toggle] = await chromeBoxes(page);
    await page.goto('/a1/');
    const sidebar = (await chromeBoxes(page))[3];
    expect(sidebar).not.toBeNull();

    for (const path of ['/a2/', '/b1/', '/a2/perfekt/']) {
      await page.goto(path);
      expect(await chromeBoxes(page), path).toEqual([brand, levels, toggle, sidebar]);
    }
  });

  test('a level page without much content does not scroll', async ({ page }) => {
    await page.goto('/a1/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
    );
    expect(overflow).toBe(0);
  });
});

test.describe('navigation on mobile', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('the menu button opens the sidebar sheet, which closes again', async ({ page }) => {
    await page.goto('/a2/perfekt/');
    const sheet = page.locator('#sidebar');
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: t('en', 'nav.menu') }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('a[aria-current="page"]')).toBeVisible();

    await page.getByRole('button', { name: t('en', 'nav.closeMenu') }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: t('en', 'nav.menu') }).click();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('the topic page has a bottom bar with Practice', async ({ page }) => {
    await page.goto('/a2/perfekt/');
    const bar = page.getByRole('navigation', { name: t('en', 'nav.topicNavigation') });
    await expect(bar).toBeVisible();
    await bar.getByRole('link', { name: t('en', 'nav.practice') }).click();
    await expect(page).toHaveURL(/#practice$/);
  });
});
