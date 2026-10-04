/**
 * Exercise flows on the English topic page (CLAUDE.md, "Testing"). Rounds are steered through the
 * seen ids in sessionStorage (`onlyUnseen`), which works in every build; only the seed test needs
 * `?seed=`, which production builds ignore.
 */
import { type CDPSession, expect, type Page, test } from '@playwright/test';
import { t } from '../../src/i18n/utils.ts';
import { capitalizeFirst, fillGap, formatSentence } from '../../src/lib/exercises.ts';
import {
  answerCurrent,
  answerLine,
  bank,
  buildWithMouse,
  check,
  choiceItem,
  chooseOption,
  currentItemId,
  dragToLine,
  english,
  feedback,
  goOn,
  onlyUnseen,
  openPractice,
  playRound,
  SEEN_KEY,
  scrollSettled,
  TOPIC_PATH,
  wordOrderItem,
} from './helpers/exercises.ts';

const isProduction = (process.env.PUBLIC_DEPLOY_ENV ?? 'development') === 'production';
const why = (text: string | undefined) => (text ?? '').replaceAll('*', '');

test.describe('choice', () => {
  test('a wrong answer shows the correct sentence and the explanation', async ({ page }) => {
    await onlyUnseen(page, ['c1', 'c2', 'c3', 'c4', 'c5']);
    await openPractice(page);
    await expect(
      page.getByText(t('en', 'exercise.progress', { current: 1, total: 5 })),
    ).toBeVisible();

    const item = choiceItem(await currentItemId(page));
    const wrong = item.options.find((option) => option !== item.answer) ?? '';
    await chooseOption(page, wrong);

    await expect(feedback(page)).toBeFocused();
    await expect(feedback(page)).toContainText(t('en', 'exercise.incorrect'));
    await expect(feedback(page).locator('[lang="de"]').first()).toHaveText(
      fillGap(item.text, item.answer),
    );
    await expect(feedback(page)).toContainText(why(english.choice[item.id]?.why));
    for (const option of item.options) {
      await expect(page.getByRole('button', { name: option, exact: true })).toBeDisabled();
    }
  });

  test('a full round ends with the score and every answer', async ({ page }) => {
    await onlyUnseen(page, ['c1', 'c2', 'c3', 'c4', 'c5']);
    await openPractice(page);
    const ids = [await answerCurrent(page, false)];
    await goOn(page);
    for (let i = 0; i < 4; i++) {
      ids.push(await answerCurrent(page));
      await expect(feedback(page)).toContainText(t('en', 'exercise.correct'));
      await goOn(page);
    }
    await expect(page.getByTestId('score')).toHaveText(
      t('en', 'exercise.result', { correct: 4, total: 5 }),
    );

    // The list shows each answer in order; the wrong one with the correct sentence below.
    const rows = page.getByTestId('answers').getByRole('listitem');
    await expect(rows).toHaveCount(5);
    const wrongItem = choiceItem(ids[0] ?? '');
    const wrongOption = wrongItem.options.find((option) => option !== wrongItem.answer) ?? '';
    await expect(rows.first()).toContainText(t('en', 'exercise.incorrect'));
    await expect(rows.first()).toContainText(fillGap(wrongItem.text, wrongOption));
    await expect(rows.first()).toContainText(fillGap(wrongItem.text, wrongItem.answer));
    for (const [position, id] of ids.slice(1).entries()) {
      const item = choiceItem(id);
      await expect(rows.nth(position + 1)).toContainText(t('en', 'exercise.correct'));
      await expect(rows.nth(position + 1)).toContainText(fillGap(item.text, item.answer));
    }
    await expect(
      page.getByRole('heading', { name: t('en', 'exercise.resultTitle') }),
    ).toBeFocused();
  });

  test('the Austrian answer counts as correct and is labeled', async ({ page }) => {
    await onlyUnseen(page, ['c10', 'c1', 'c2', 'c3', 'c4']);
    await openPractice(page);
    while ((await currentItemId(page)) !== 'c10') {
      await answerCurrent(page);
      await goOn(page);
    }
    await chooseOption(page, 'sind');
    await expect(feedback(page)).toContainText(t('en', 'exercise.correct'));
    await expect(feedback(page)).toContainText(t('en', 'topic.austrianUsage'));
    await expect(feedback(page)).toContainText(why(english.choice.c10?.why));
  });
});

test.describe('word order', () => {
  test('mouse: building the sentence shows it capitalized', async ({ page }) => {
    await onlyUnseen(page, ['w1', 'w2', 'w3', 'w4', 'w5']);
    await openPractice(page);
    const item = wordOrderItem(await currentItemId(page));

    const checkButton = page.getByRole('button', { name: t('en', 'exercise.check') });
    await expect(checkButton).toBeDisabled();
    await buildWithMouse(page, item, item.parts);
    await expect(checkButton).toBeEnabled();
    await check(page);

    await expect(feedback(page)).toContainText(t('en', 'exercise.correct'));
    const result = page.getByTestId('word-order-result');
    await expect(result.locator('.chip')).toHaveText(capitalizeFirst(item.parts));
    await expect(result).toContainText(item.punctuation);
  });

  async function openAt(page: Page, id: string) {
    await onlyUnseen(page, [id, 'c1', 'c2', 'c3', 'c4']);
    await openPractice(page);
    while ((await currentItemId(page)) !== id) {
      await answerCurrent(page);
      await goOn(page);
    }
  }

  test('mouse: an accepted order is correct', async ({ page }) => {
    await openAt(page, 'w1');
    const item = wordOrderItem('w1');
    await buildWithMouse(page, item, item.accept?.[0] ?? []);
    await check(page);
    await expect(feedback(page)).toContainText(t('en', 'exercise.correct'));
  });

  test('mouse: a wrong order marks the wrong positions', async ({ page }) => {
    await openAt(page, 'w1');
    const item = wordOrderItem('w1');
    // "ich gestern habe einen Film gesehen": positions 2 and 3 are wrong.
    await buildWithMouse(page, item, ['ich', 'gestern', 'habe', 'einen Film', 'gesehen']);
    await check(page);
    await expect(feedback(page)).toContainText(t('en', 'exercise.incorrect'));
    await expect(feedback(page)).toContainText(formatSentence(item.parts, item.punctuation));
    const result = page.getByTestId('word-order-result');
    await expect(result.locator('.chip-wrong')).toHaveText([
      `gestern, ${t('en', 'exercise.wordOrder.wrongPosition')}`,
      `habe, ${t('en', 'exercise.wordOrder.wrongPosition')}`,
    ]);
    await expect(result.locator('.chip').first()).toHaveText('Ich');
  });

  test('duplicate words: either "die" chip works', async ({ page }) => {
    await openAt(page, 'w6');
    // Take the second "die" chip first.
    await dragToLine(page, 'die', 1);
    for (const word of ['Kinder', 'haben', 'die', 'Pizza', 'gegessen'])
      await dragToLine(page, word);
    await check(page);
    await expect(feedback(page)).toContainText(t('en', 'exercise.correct'));
  });

  test('a word can be moved back to the bank', async ({ page }) => {
    await onlyUnseen(page, ['w1', 'w2', 'w3', 'w4', 'w5']);
    await openPractice(page);
    const item = wordOrderItem(await currentItemId(page));
    const word = item.parts[1] ?? '';
    await dragToLine(page, word);
    const chip = answerLine(page).getByLabel(word, { exact: true });
    const from = await chip.boundingBox();
    const to = await bank(page).boundingBox();
    if (!from || !to) throw new Error('no boxes');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
    await page.mouse.move(to.x + to.width - 8, to.y + to.height / 2, { steps: 10 });
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect(answerLine(page).locator('.chip')).toHaveCount(0);
    await expect(bank(page).getByLabel(word, { exact: true })).toBeVisible();
  });

  test('keyboard only', async ({ page }) => {
    await onlyUnseen(page, ['w1', 'w2', 'w3', 'w4', 'w5']);
    await openPractice(page);
    const item = wordOrderItem(await currentItemId(page));
    const words = item.fixed ? item.parts.slice(1) : item.parts;
    const focusedLabel = () =>
      page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '');

    await page.getByText(t('en', 'exercise.progress', { current: 1, total: 5 })).focus();
    for (const word of words) {
      // Tab to the word in the bank, pick it up, move it to the answer line, put it down.
      for (let i = 0; i < 20 && (await focusedLabel()) !== word; i++)
        await page.keyboard.press('Tab');
      await expect(bank(page).getByLabel(word, { exact: true }).first()).toBeFocused();
      await page.keyboard.press('Space');
      await page.keyboard.press('Shift+Tab');
      await expect(answerLine(page).getByLabel(word, { exact: true }).last()).toBeFocused();
      await page.keyboard.press('Space');
    }
    await expect(answerLine(page).locator('.chip')).toHaveText(words);

    const checkButton = page.getByRole('button', { name: t('en', 'exercise.check') });
    for (let i = 0; i < 20; i++) {
      if (await checkButton.evaluate((el) => el === document.activeElement)) break;
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');
    await expect(feedback(page)).toBeFocused();
    await expect(feedback(page)).toContainText(t('en', 'exercise.correct'));

    // Tab past the report link to "Next question".
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(
      page.getByText(t('en', 'exercise.progress', { current: 2, total: 5 })),
    ).toBeFocused();
  });

  test.describe('touch', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 700 } });

    async function touch(
      cdp: CDPSession,
      type: 'touchStart' | 'touchMove' | 'touchEnd',
      x = 0,
      y = 0,
    ) {
      await cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });
    }

    /** Centre of a bank word, scrolled to the middle of the screen (clear of the bottom bar). */
    async function chipCenter(page: Page, word: string) {
      await bank(page).evaluate((element) => element.scrollIntoView({ block: 'center' }));
      await scrollSettled(page);
      const box = await bank(page).getByLabel(word, { exact: true }).first().boundingBox();
      if (!box) throw new Error(`No chip ${word}`);
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    }

    test('a long press drags a word, a quick swipe scrolls', async ({ page }) => {
      await onlyUnseen(page, ['w1', 'w2', 'w3', 'w4', 'w5']);
      await openPractice(page);
      const item = wordOrderItem(await currentItemId(page));
      const word = item.parts[1] ?? '';
      const cdp = await page.context().newCDPSession(page);

      // Swipe up from the word without waiting: the page scrolls, nothing is dragged.
      await page.evaluate(() => window.scrollBy(0, -200));
      let start = await chipCenter(page, word);
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await touch(cdp, 'touchStart', start.x, start.y);
      for (let i = 1; i <= 8; i++) await touch(cdp, 'touchMove', start.x, start.y + i * 15);
      await touch(cdp, 'touchEnd');
      await expect.poll(() => page.evaluate(() => window.scrollY)).not.toBe(scrollBefore);
      await expect(answerLine(page).locator('.chip')).toHaveCount(0);

      // Long press, then move to the answer line: the word is dragged.
      start = await chipCenter(page, word);
      const line = await answerLine(page).boundingBox();
      if (!line) throw new Error('No answer line');
      const end = { x: line.x + line.width - 8, y: line.y + line.height / 2 };
      await touch(cdp, 'touchStart', start.x, start.y);
      await page.waitForTimeout(400);
      // The drag started: the library shows a floating copy of the word.
      await expect(page.locator('#dnd-action-dragged-el')).toHaveCount(1);
      for (let i = 1; i <= 10; i++) {
        await touch(
          cdp,
          'touchMove',
          start.x + ((end.x - start.x) * i) / 10,
          start.y + ((end.y - start.y) * i) / 10,
        );
        await page.waitForTimeout(20);
      }
      // svelte-dnd-action checks which zone the word is over every 200 ms: hold before letting go.
      await page.waitForTimeout(250);
      await touch(cdp, 'touchEnd');
      await expect(answerLine(page).locator('.chip')).toHaveText([word]);
    });
  });
});

test.describe('rounds', () => {
  test('"Try again" shows unseen items; the same seed gives the same round', async ({
    page,
    browser,
  }) => {
    test.skip(isProduction, '?seed= is honored only in non-production builds');
    await openPractice(page, '?seed=7');
    const first = await playRound(page);
    expect(first).toHaveLength(5);
    await page.getByRole('button', { name: t('en', 'exercise.tryAgain') }).click();
    await expect(
      page.getByText(t('en', 'exercise.progress', { current: 1, total: 5 })),
    ).toBeFocused();
    const second = await playRound(page);
    expect(second.filter((id) => first.includes(id))).toEqual([]);

    const seen: string[] = JSON.parse(
      (await page.evaluate((key) => window.sessionStorage.getItem(key), SEEN_KEY)) ?? '[]',
    );
    expect([...seen].sort()).toEqual([...first, ...second].sort());

    // A fresh session with the same seed starts with the same round.
    const other = await browser.newPage();
    await openPractice(other, '?seed=7');
    expect(await currentItemId(other)).toBe(first[0]);
    await other.close();
  });
});

test.describe('no layout jumps', () => {
  /** Where the practice section is and how far the page is scrolled, after any scrolling stopped. */
  async function position(page: Page) {
    await page.waitForFunction(() => document.getAnimations().length === 0);
    await scrollSettled(page);
    const box = await page.locator('#practice').boundingBox();
    return {
      scrollY: await page.evaluate(() => Math.round(window.scrollY)),
      top: Math.round(box?.y ?? -1),
    };
  }

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 740 },
  ]) {
    test(`"Start practice" moves the section to the top, answering moves nothing (${viewport.width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await onlyUnseen(page, ['c1', 'c2', 'c3', 'c4', 'c5']);
      await openPractice(page);
      const start = await position(page);
      // Below the 3rem sticky header plus the 1rem scroll margin.
      expect(start.top).toBe(64);

      await answerCurrent(page, false);
      expect(await position(page)).toEqual(start);
      await goOn(page);
      expect(await position(page)).toEqual(start);
    });
  }

  test('word order with feedback fits on a desktop screen', async ({ page }) => {
    await onlyUnseen(page, ['w1', 'w2', 'w3', 'w4', 'w5']);
    await openPractice(page);
    const start = await position(page);
    await answerCurrent(page, false);
    expect(await position(page)).toEqual(start);
  });
});

test('the report link prefills the issue form', async ({ page }) => {
  await onlyUnseen(page, ['c1', 'c2', 'c3', 'c4', 'c5']);
  await openPractice(page);
  const id = await answerCurrent(page);
  const link = feedback(page).getByRole('link', { name: t('en', 'exercise.reportMistake') });
  const url = new URL((await link.getAttribute('href')) ?? '');
  expect(`${url.origin}${url.pathname}`).toBe('https://github.com/dmrock/deutscherl/issues/new');
  expect(url.searchParams.get('template')).toBe('report-mistake.yml');
  expect(url.searchParams.get('page-url')).toBe(`https://deutscherl.com${TOPIC_PATH}`);
  expect(url.searchParams.get('locale')).toBe('en');
  expect(url.searchParams.get('item-id')).toBe(id);
});

// Playwright's `javaScriptEnabled: false` still parses <noscript> as if scripts ran, so the
// served HTML is checked instead.
test('says without JavaScript that the exercises need it', async ({ request }) => {
  const html = await (await request.get(TOPIC_PATH)).text();
  expect(html).toMatch(
    new RegExp(
      `<noscript>[^]*?${t('en', 'exercise.needsJs').replace(/[.]/g, '\\.')}[^]*?</noscript>`,
    ),
  );
});
