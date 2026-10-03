/**
 * Content validation (CLAUDE.md, "Content model" and "Exercise rules"): per-file schemas plus every
 * rule that spans files, which Zod alone cannot check. Runs before every build and in CI.
 *
 * Usage: node scripts/validate-content.ts
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { z } from 'astro/zod';
import { levelIds } from '../src/config/site.ts';
import { isLocaleCode, type LocaleConfig, locales } from '../src/i18n/locales.ts';
import {
  frontmatterSchema,
  type GermanContent,
  germanSchema,
  i18nSchema,
  metaSchema,
  type WordOrderItem,
} from '../src/lib/content-schemas.ts';
import { coverage } from './i18n-coverage.ts';
import { CONTENT_ROOT, type ParsedFile, readTopics, type TopicFiles } from './lib/content.ts';
import { isInSync } from './review.ts';

export interface Issue {
  /** `a2/perfekt` */
  topic: string;
  /** File inside the topic folder, if the issue belongs to one */
  file?: string;
  message: string;
}

/** Each choice topic needs at least this many items (CLAUDE.md, "Exercise rules"). */
export const MIN_CHOICE_ITEMS = 10;

/**
 * Closed-class words that are never capitalized inside a sentence. A word-order part starting with
 * one of them in uppercase gives away the first position (CLAUDE.md, "Exercise rules": neutral
 * case). Nouns cannot be recognized without a dictionary, so this is a list, not a rule for every
 * word. Left out on purpose: `sie` (formal `Sie` is always capitalized), `ihnen` (`Ihnen`),
 * `morgen` (`der Morgen`).
 */
export const LOWERCASE_WORDS = new Set(
  [
    // pronouns
    'ich du er es wir ihr man mich dich mir dir uns euch ihm ihn sich',
    // articles and determiners
    'der die das den dem des ein eine einen einem einer eines kein keine keinen keinem keiner',
    'mein meine meinen meinem dein deine deinen seine seinen ihre ihren unser unsere euer eure',
    'dieser diese dieses diesen jeder jede jedes',
    // auxiliaries and modal verbs
    'bin bist ist sind seid war warst waren wart habe hast hat haben habt hatte hatten',
    'werde wirst wird werden kann kannst können muss musst müssen will willst wollen darf soll möchte',
    // prepositions
    'in im ins an am ans auf aus bei beim mit nach von vom zu zum zur für gegen ohne um über unter',
    'vor hinter neben zwischen durch seit bis',
    // conjunctions
    'und oder aber denn weil dass wenn als ob',
    // question words
    'wer was wo wohin woher wann warum wie welche welcher welches',
    // adverbs
    'gestern heute dann schon noch nicht nie oft immer jetzt hier dort da sehr auch gern lange',
  ]
    .join(' ')
    .split(' '),
);

/** Parts whose first word is a capitalized closed-class word (e.g. `Ich`, `Gestern`). */
export function capitalizedParts(parts: readonly string[]): string[] {
  return parts.filter((part) => {
    const word = part.split(/\s+/)[0] ?? '';
    const first = word.charAt(0);
    return (
      first !== first.toLowerCase() && LOWERCASE_WORDS.has(word.toLowerCase().replace(/\W+$/, ''))
    );
  });
}

function sameMultiset(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sorted = (list: readonly string[]) => [...list].sort().join('\u0000');
  return sorted(a) === sorted(b);
}

function schemaIssues(
  topic: string,
  file: ParsedFile,
  schema: z.ZodType,
  issues: Issue[],
): boolean {
  if (file.error) {
    issues.push({ topic, file: file.name, message: `cannot be parsed: ${file.error}` });
    return false;
  }
  const result = schema.safeParse(file.data);
  if (result.success) return true;
  for (const issue of result.error.issues) {
    const where = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    issues.push({ topic, file: file.name, message: `${where}${issue.message}` });
  }
  return false;
}

function checkWordOrder(item: WordOrderItem, add: (message: string) => void): void {
  const orders = [item.parts, ...(item.accept ?? [])];
  const seen = new Set<string>();
  for (const [index, order] of orders.entries()) {
    const label = index === 0 ? 'parts' : `accept[${index - 1}]`;
    if (index > 0 && !sameMultiset(order, item.parts)) {
      add(`wordOrder ${item.id}: ${label} must use exactly the same parts as \`parts\``);
    }
    const key = order.join('\u0000');
    if (seen.has(key)) add(`wordOrder ${item.id}: ${label} repeats another order`);
    seen.add(key);
    if (item.fixed && order[0] !== item.parts[0]) {
      add(`wordOrder ${item.id}: ${label} must start with the fixed part "${item.parts[0]}"`);
    }
  }
  for (const part of capitalizedParts(item.parts)) {
    add(
      `wordOrder ${item.id}: part "${part}" must be stored in neutral case (lowercase unless always capitalized)`,
    );
  }
}

function checkGerman(german: GermanContent, add: (message: string) => void): void {
  const ids = new Set<string>();
  const all = [...german.examples, ...german.choice, ...german.wordOrder, ...german.austrianNotes];
  for (const { id } of all) {
    if (ids.has(id)) add(`duplicate id "${id}" (ids are unique across the whole file)`);
    ids.add(id);
  }

  for (const item of german.choice) {
    const gaps = item.text.split('___').length - 1;
    if (gaps !== 1) add(`choice ${item.id}: text must contain exactly one ___ (found ${gaps})`);
    if (new Set(item.options).size !== item.options.length) {
      add(`choice ${item.id}: options must be unique`);
    }
    if (!item.options.includes(item.answer)) {
      add(`choice ${item.id}: answer "${item.answer}" is not one of the options`);
    }
    for (const { value } of item.alsoCorrect ?? []) {
      if (value === item.answer) add(`choice ${item.id}: alsoCorrect "${value}" is the answer`);
      else if (!item.options.includes(value)) {
        add(`choice ${item.id}: alsoCorrect "${value}" is not one of the options`);
      }
    }
  }
  if (german.choice.length < MIN_CHOICE_ITEMS) {
    add(`needs at least ${MIN_CHOICE_ITEMS} choice items (found ${german.choice.length})`);
  }

  for (const item of german.wordOrder) checkWordOrder(item, add);
}

/** Ids in an i18n file that do not exist in german.yaml. */
function unknownI18nKeys(i18n: z.infer<typeof i18nSchema>, german: GermanContent): string[] {
  const known = {
    examples: new Set(german.examples.map((item) => item.id)),
    choice: new Set(german.choice.map((item) => item.id)),
    wordOrder: new Set(german.wordOrder.map((item) => item.id)),
    austrianNotes: new Set(german.austrianNotes.map((item) => item.id)),
  };
  const unknown: string[] = [];
  for (const section of Object.keys(known) as (keyof typeof known)[]) {
    for (const id of Object.keys(i18n[section])) {
      if (!known[section].has(id)) unknown.push(`${section}.${id}`);
    }
  }
  return unknown;
}

export function validateTopic(
  topic: TopicFiles,
  localeList: readonly Pick<LocaleConfig, 'code' | 'ready'>[] = locales,
): Issue[] {
  const issues: Issue[] = [];
  const key = topic.key;
  const add = (file: string | undefined, message: string) =>
    issues.push(file ? { topic: key, file, message } : { topic: key, message });

  if (!(levelIds as readonly string[]).includes(topic.folderLevel)) {
    add(undefined, `folder "${topic.folderLevel}" is not a level (${levelIds.join(', ')})`);
  }
  for (const file of topic.unknownFiles) add(file, 'unknown file in a topic folder');

  // meta.yaml
  if (!topic.meta) add(undefined, 'missing meta.yaml');
  else if (schemaIssues(key, topic.meta, metaSchema, issues)) {
    const meta = metaSchema.parse(topic.meta.data);
    if (meta.level !== topic.folderLevel) {
      add('meta.yaml', `level "${meta.level}" does not match the folder "${topic.folderLevel}"`);
    }
  }

  // german.yaml
  let german: GermanContent | undefined;
  if (!topic.german) add(undefined, 'missing german.yaml');
  else if (schemaIssues(key, topic.german, germanSchema, issues)) {
    german = germanSchema.parse(topic.german.data);
    checkGerman(german, (message) => add('german.yaml', message));
  }

  // <locale>.mdx
  for (const [locale, file] of topic.mdx) {
    if (!isLocaleCode(locale)) {
      add(file.name, `"${locale}" is not a locale in src/i18n/locales.ts`);
      continue;
    }
    schemaIssues(key, file, frontmatterSchema, issues);
    if (!german) continue;
    const examples = new Set(german.examples.map((item) => item.id));
    const notes = new Set(german.austrianNotes.map((item) => item.id));
    for (const id of file.refs.examples) {
      if (!examples.has(id))
        add(file.name, `<Example id="${id}"> is not an example in german.yaml`);
    }
    for (const id of file.refs.austrianNotes) {
      if (!notes.has(id)) {
        add(file.name, `<AustrianNote id="${id}"> is not an Austrian note in german.yaml`);
      }
    }
  }

  // i18n/<locale>.yaml
  for (const [locale, file] of topic.i18n) {
    if (!isLocaleCode(locale)) {
      add(file.name, `"${locale}" is not a locale in src/i18n/locales.ts`);
      continue;
    }
    if (!schemaIssues(key, file, i18nSchema, issues) || !german) continue;
    for (const unknown of unknownI18nKeys(i18nSchema.parse(file.data), german)) {
      add(file.name, `key "${unknown}" has no item in german.yaml`);
    }
  }

  // Coverage: every ready locale has all files and keys.
  for (const gap of coverage([topic], localeList)) {
    if (!gap.ready) continue;
    add(undefined, `[${gap.locale}] missing ${gap.missing.join(', ')}`);
  }

  // review.yaml matches the current content.
  try {
    if (!isInSync(topic)) {
      add('review.yaml', 'missing or out of date (stale hash). Run pnpm review:sync');
    }
  } catch (error) {
    add('review.yaml', (error as Error).message);
  }

  return issues;
}

export function validateContent(root: string = CONTENT_ROOT): Issue[] {
  return readTopics(root).flatMap((topic) => validateTopic(topic));
}

export function formatIssue({ topic, file, message }: Issue): string {
  return `${file ? `${topic}/${file}` : topic}: ${message}`;
}

function main(): number {
  const issues = validateContent();
  if (issues.length === 0) {
    console.log(`Content valid (${readTopics().length} topics).`);
    return 0;
  }
  for (const issue of issues) console.error(formatIssue(issue));
  console.error(`\nContent validation failed: ${issues.length} issue(s).`);
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
