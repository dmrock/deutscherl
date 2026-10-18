/**
 * Translation coverage (CLAUDE.md, "Testing": data checks). For every topic and locale: the
 * missing files (`<locale>.mdx`, `i18n/<locale>.yaml`) and missing keys (every German item needs a
 * translation or explanation). For every site page (`src/content/pages/<slug>/`): the missing
 * `<locale>.mdx`. Fails only for ready locales; others are reported for information, so a language
 * can be translated step by step before it goes live.
 *
 * Usage: node scripts/i18n-coverage.ts
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type LocaleConfig, locales } from '../src/i18n/locales.ts';
import { germanSchema, i18nSchema, type TopicI18n } from '../src/lib/content-schemas.ts';
import { CONTENT_ROOT, readTopics, type TopicFiles } from './lib/content.ts';

/** Site pages (about, legal): one folder per page, one MDX file per locale. */
export const PAGES_ROOT = resolve(fileURLToPath(import.meta.url), '../../src/content/pages');

export interface CoverageGap {
  /** Topic key (`a2/perfekt`) or site page (`pages/about`) */
  topic: string;
  locale: string;
  ready: boolean;
  /** Missing files (`ru.mdx`, `i18n/ru.yaml`) and keys (`examples.e1`, `choice.c3.why`) */
  missing: string[];
}

/** Keys an i18n file must have for the German content of a topic. */
export function requiredKeys(topic: TopicFiles): string[] {
  const parsed = germanSchema.safeParse(topic.german?.data);
  if (!parsed.success) return [];
  const german = parsed.data;
  return [
    ...german.examples.map((item) => `examples.${item.id}`),
    ...german.choice.map((item) => `choice.${item.id}.why`),
    ...german.wordOrder.flatMap((item) => [
      `wordOrder.${item.id}.translation`,
      `wordOrder.${item.id}.why`,
    ]),
    ...german.austrianNotes.map((item) => `austrianNotes.${item.id}`),
  ];
}

function hasKey(i18n: TopicI18n, key: string): boolean {
  const [section, id, field] = key.split('.') as [keyof TopicI18n, string, string | undefined];
  const value = (i18n[section] as Record<string, unknown>)[id];
  if (field === undefined) return typeof value === 'string';
  return typeof (value as Record<string, unknown> | undefined)?.[field] === 'string';
}

/** Gaps per topic and locale; topics without gaps are left out. */
export function coverage(
  topics: readonly TopicFiles[],
  localeList: readonly Pick<LocaleConfig, 'code' | 'ready'>[] = locales,
): CoverageGap[] {
  const gaps: CoverageGap[] = [];
  for (const topic of topics) {
    const keys = requiredKeys(topic);
    for (const { code, ready } of localeList) {
      const missing: string[] = [];
      if (!topic.mdx.has(code)) missing.push(`${code}.mdx`);
      const file = topic.i18n.get(code);
      if (!file) {
        missing.push(`i18n/${code}.yaml`);
      } else {
        const parsed = i18nSchema.safeParse(file.data);
        // An invalid file is reported by validate-content; its keys are not counted here.
        if (parsed.success) missing.push(...keys.filter((key) => !hasKey(parsed.data, key)));
      }
      if (missing.length > 0) gaps.push({ topic: topic.key, locale: code, ready, missing });
    }
  }
  return gaps;
}

/** Site pages without an MDX file in a locale. */
export function pageCoverage(
  root: string,
  localeList: readonly Pick<LocaleConfig, 'code' | 'ready'>[] = locales,
): CoverageGap[] {
  if (!existsSync(root)) return [];
  const slugs = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  return slugs.flatMap((slug) =>
    localeList
      .filter(({ code }) => !existsSync(join(root, slug, `${code}.mdx`)))
      .map(({ code, ready }) => ({
        topic: `pages/${slug}`,
        locale: code,
        ready,
        missing: [`${code}.mdx`],
      })),
  );
}

function main(): number {
  const topics = readTopics(CONTENT_ROOT);
  const gaps = [...coverage(topics), ...pageCoverage(PAGES_ROOT)];
  for (const gap of gaps) {
    const label = gap.ready ? 'error' : 'info (not ready)';
    console.log(`${gap.topic} [${gap.locale}] ${label}: missing ${gap.missing.join(', ')}`);
  }
  const failing = gaps.filter((gap) => gap.ready);
  if (failing.length > 0) {
    console.error(`\ni18n coverage failed: ${failing.length} gap(s) in ready locales.`);
    return 1;
  }
  console.log(`i18n coverage complete for ready locales (${topics.length} topics).`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
