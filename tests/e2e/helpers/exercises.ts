/** Helpers for the exercise e2e tests: topic data from german.yaml and ways to answer items. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { parse } from 'yaml';
import { t } from '../../../src/i18n/utils.ts';
import {
  type ChoiceItem,
  type GermanContent,
  germanSchema,
  i18nSchema,
  type TopicI18n,
  type WordOrderItem,
} from '../../../src/lib/content-schemas.ts';

export const TOPIC_PATH = '/a2/perfekt/';
export const SEEN_KEY = 'seen:a2/perfekt';
const TOPIC_DIR = join(import.meta.dirname, '../../../src/content/topics/a2/perfekt');

export const german: GermanContent = germanSchema.parse(
  parse(readFileSync(join(TOPIC_DIR, 'german.yaml'), 'utf8')),
);
export const english: TopicI18n = i18nSchema.parse(
  parse(readFileSync(join(TOPIC_DIR, 'i18n/en.yaml'), 'utf8')),
);
export const allIds = [...german.choice, ...german.wordOrder].map((item) => item.id);

export function choiceItem(id: string): ChoiceItem {
  const item = german.choice.find((entry) => entry.id === id);
  if (!item) throw new Error(`No choice item ${id}`);
  return item;
}

export function wordOrderItem(id: string): WordOrderItem {
  const item = german.wordOrder.find((entry) => entry.id === id);
  if (!item) throw new Error(`No word-order item ${id}`);
  return item;
}

/** The next round contains exactly these items (in random order): every other id is "seen". */
export async function onlyUnseen(page: Page, ids: string[]): Promise<void> {
  const seen = allIds.filter((id) => !ids.includes(id));
  await page.addInitScript(([key, value]) => window.sessionStorage.setItem(key, value), [
    SEEN_KEY,
    JSON.stringify(seen),
  ] as const);
}

/** Opens the topic page and scrolls to the exercises, so the island hydrates (client:visible). */
export async function openPractice(page: Page, query = ''): Promise<void> {
  await page.goto(`${TOPIC_PATH}${query}`);
  await page.locator('#practice').scrollIntoViewIfNeeded();
  await expect(page.locator('[data-phase="question"]')).toBeVisible();
  // The font swap moves the words a little; measure positions only after it.
  await page.evaluate(() => document.fonts.ready);
}

export async function currentItemId(page: Page): Promise<string> {
  const id = await page.locator('[data-item-id]').getAttribute('data-item-id');
  if (!id) throw new Error('No current item');
  return id;
}

export const bank = (page: Page) => page.getByTestId('word-bank');
export const answerLine = (page: Page) => page.getByTestId('answer-line');
export const feedback = (page: Page) => page.getByTestId('feedback');

export async function chooseOption(page: Page, value: string): Promise<void> {
  await page
    .getByRole('group', { name: t('en', 'exercise.choice.options') })
    .getByRole('button', { name: value, exact: true })
    .click();
}

/** The library ignores a new drag until the drop animation of the last one has finished. */
export async function dropFinished(page: Page): Promise<void> {
  await expect(page.locator('#dnd-action-dragged-el')).toHaveCount(0);
}

/** Drags a bank word to the end of the answer line with the mouse (in steps, like a person). */
export async function dragToLine(page: Page, word: string, nth = 0): Promise<void> {
  const chip = bank(page).getByLabel(word, { exact: true }).nth(nth);
  const from = await chip.boundingBox();
  const to = await answerLine(page).boundingBox();
  if (!from || !to) throw new Error(`Cannot drag "${word}"`);
  const before = await answerLine(page).locator('.chip').count();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 5, from.y + from.height / 2 + 5, { steps: 3 });
  await page.mouse.move(to.x + to.width - 8, to.y + to.height / 2, { steps: 10 });
  // svelte-dnd-action checks which zone the word is over every 200 ms: hold before letting go.
  await page.waitForTimeout(250);
  await page.mouse.up();
  await dropFinished(page);
  await expect(answerLine(page).locator('.chip'), `drag "${word}"`).toHaveCount(before + 1);
}

/** Builds `order` (the full sentence, including a fixed first part) with the mouse. */
export async function buildWithMouse(page: Page, item: WordOrderItem, order: string[]) {
  for (const word of item.fixed ? order.slice(1) : order) await dragToLine(page, word);
  await expect(answerLine(page).locator('.chip')).toHaveText(item.fixed ? order.slice(1) : order);
}

export async function check(page: Page): Promise<void> {
  await page.getByRole('button', { name: t('en', 'exercise.check') }).click();
}

/** Answers the current item (correctly by default) and goes on to the next one. */
export async function answerCurrent(page: Page, correct = true): Promise<string> {
  const id = await currentItemId(page);
  if (id.startsWith('c')) {
    const item = choiceItem(id);
    const wrong = item.options.find(
      (option) =>
        option !== item.answer && !item.alsoCorrect?.some((variant) => variant.value === option),
    );
    await chooseOption(page, correct ? item.answer : (wrong ?? item.answer));
  } else {
    const item = wordOrderItem(id);
    const order = correct ? item.parts : [item.parts[0] ?? '', ...item.parts.slice(1).reverse()];
    await buildWithMouse(page, item, order);
    await check(page);
  }
  await expect(feedback(page)).toBeVisible();
  return id;
}

export async function goOn(page: Page): Promise<void> {
  const next = page.getByRole('button', {
    name: new RegExp(`^(${t('en', 'exercise.next')}|${t('en', 'exercise.showResult')})$`),
  });
  await next.click();
}

/** Plays the rest of the round, answering everything correctly; returns the item ids. */
export async function playRound(page: Page): Promise<string[]> {
  const ids: string[] = [];
  while ((await page.locator('[data-phase="question"]').count()) > 0) {
    ids.push(await answerCurrent(page));
    await goOn(page);
  }
  return ids;
}
