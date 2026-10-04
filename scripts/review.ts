/**
 * Review state of topics (CLAUDE.md, "Review and verification"). `review.yaml` in each topic folder
 * is managed only by this script.
 *
 * Two scopes per topic, each with a content hash:
 * - `base`: meta.yaml, german.yaml, <default locale>.mdx, i18n/<default locale>.yaml
 *   (draft → reviewed → verified)
 * - `translations.<locale>`: <locale>.mdx, i18n/<locale>.yaml (draft → reviewed), with `basedOn` =
 *   the base hash the translation was last written or reviewed against.
 *
 * Usage:
 *   node scripts/review.ts sync [--check]                     # pre-commit; --check in CI
 *   node scripts/review.ts status
 *   node scripts/review.ts minor <topic> <base|locale> --reason "typo in c3 why"   # owner only
 *   node scripts/review.ts set <topic> <base|locale> <status> --by "Name"          # owner only
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { Document, parse } from 'yaml';
import { defaultLocale, localeCodes } from '../src/i18n/locales.ts';
import {
  type BaseReview,
  baseStatusSchema,
  type HistoryEntry,
  type Review,
  reviewSchema,
  type TranslationReview,
  translationStatusSchema,
} from '../src/lib/content-schemas.ts';
import { CONTENT_ROOT, readTopics, type TopicFiles } from './lib/content.ts';

export type Clock = () => Date;
const systemClock: Clock = () => new Date();

/** ISO timestamp with second precision. */
function timestamp(clock: Clock): string {
  return `${clock().toISOString().slice(0, 19)}Z`;
}

// --- Hashing -------------------------------------------------------------------------------

/** JSON with object keys sorted, so key order does not matter. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Parsed and re-serialized YAML: comments, quoting, indentation and key order do not count. */
export function normalizeYaml(raw: string): string {
  try {
    return stableStringify(parse(raw) ?? null);
  } catch {
    return raw;
  }
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** MDX: parsed frontmatter plus the body with line endings, trailing spaces and blank runs normalized. */
export function normalizeMdx(raw: string): string {
  const match = FRONTMATTER.exec(raw);
  const frontmatter = match ? normalizeYaml(match[1] ?? '') : '';
  const body = (match ? raw.slice(match[0].length) : raw)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `${frontmatter}\n${body}`;
}

function digest(parts: Record<string, string | undefined>): string {
  const hash = createHash('sha256').update(stableStringify(parts)).digest('hex');
  return `sha256:${hash.slice(0, 16)}`;
}

export function baseHash(topic: TopicFiles): string {
  return digest({
    meta: topic.meta && normalizeYaml(topic.meta.raw),
    german: topic.german && normalizeYaml(topic.german.raw),
    mdx: topic.mdx.get(defaultLocale) && normalizeMdx(topic.mdx.get(defaultLocale)?.raw ?? ''),
    i18n: topic.i18n.get(defaultLocale) && normalizeYaml(topic.i18n.get(defaultLocale)?.raw ?? ''),
  });
}

export function translationHash(topic: TopicFiles, locale: string): string {
  const mdx = topic.mdx.get(locale);
  const i18n = topic.i18n.get(locale);
  return digest({
    mdx: mdx && normalizeMdx(mdx.raw),
    i18n: i18n && normalizeYaml(i18n.raw),
  });
}

/** Non-default known locales that have at least one translation file in the topic. */
export function translationLocales(topic: TopicFiles): string[] {
  return localeCodes.filter(
    (locale) => locale !== defaultLocale && (topic.mdx.has(locale) || topic.i18n.has(locale)),
  );
}

// --- Reading and writing review.yaml ---------------------------------------------------------

/** Parsed review.yaml of a topic; undefined when missing. Throws when it is invalid. */
export function readReview(topic: TopicFiles): Review | undefined {
  if (!topic.review) return undefined;
  if (topic.review.error) throw new Error(`${topic.key}/review.yaml: ${topic.review.error}`);
  const result = reviewSchema.safeParse(topic.review.data);
  if (!result.success) {
    throw new Error(`${topic.key}/review.yaml: ${result.error.issues[0]?.message ?? 'invalid'}`);
  }
  return result.data;
}

export function serializeReview(review: Review): string {
  const doc = new Document(review);
  doc.commentBefore =
    ' Review state of this topic. Managed by scripts/review.ts (pnpm review:*); do not edit by hand.';
  return doc.toString({ lineWidth: 0 });
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

// --- Sync ------------------------------------------------------------------------------------

export interface SyncResult {
  review: Review;
  /** Human-readable list of what changed; empty when review.yaml was already in sync */
  changes: string[];
}

function newBase(hash: string): BaseReview {
  return { status: 'draft', contentHash: hash, verifiedBy: null, verifiedAt: null, history: [] };
}

function newTranslation(hash: string, basedOn: string): TranslationReview {
  return {
    status: 'draft',
    contentHash: hash,
    basedOn,
    reviewedBy: null,
    reviewedAt: null,
    history: [],
  };
}

/**
 * Recomputes the hashes of a topic and resets changed scopes to draft:
 * - base files changed → base back to draft;
 * - translation files changed → that translation back to draft, `basedOn` = current base hash;
 * - translation unchanged but `basedOn` no longer matches the base → back to draft, `basedOn`
 *   kept (it still shows which base it was checked against).
 * Every reset of a non-draft scope appends a history entry with the previous status and reviewer.
 */
export function syncReview(
  topic: TopicFiles,
  existing: Review | undefined,
  clock: Clock = systemClock,
): SyncResult {
  const changes: string[] = [];
  const at = () => timestamp(clock);
  const currentBase = baseHash(topic);
  let review: Review;

  if (!existing) {
    review = { base: newBase(currentBase), translations: {} };
    changes.push('created review.yaml');
  } else {
    review = clone(existing);
    const base = review.base;
    if (base.contentHash !== currentBase) {
      const previousHash = base.contentHash;
      if (base.status !== 'draft') {
        base.history.push({
          at: at(),
          event: 'reset',
          from: base.status,
          by: base.verifiedBy,
          reason: 'base changed',
          previousHash,
        });
        base.status = 'draft';
        base.verifiedBy = null;
        base.verifiedAt = null;
        changes.push('base: reset to draft (content changed)');
      } else {
        changes.push('base: hash updated');
      }
      base.contentHash = currentBase;
    }
  }

  const locales = translationLocales(topic);
  const translations: Record<string, TranslationReview> = {};
  for (const locale of locales) {
    const hash = translationHash(topic, locale);
    const entry = review.translations[locale];
    if (!entry) {
      translations[locale] = newTranslation(hash, currentBase);
      if (existing) changes.push(`${locale}: added`);
      continue;
    }
    if (entry.contentHash !== hash) {
      if (entry.status !== 'draft') {
        entry.history.push({
          at: at(),
          event: 'reset',
          from: entry.status,
          by: entry.reviewedBy,
          reason: 'translation changed',
          previousHash: entry.contentHash,
        });
        entry.status = 'draft';
        entry.reviewedBy = null;
        entry.reviewedAt = null;
        changes.push(`${locale}: reset to draft (translation changed)`);
      } else {
        changes.push(`${locale}: hash updated`);
      }
      entry.contentHash = hash;
      entry.basedOn = currentBase;
    } else if (entry.basedOn !== currentBase && entry.status !== 'draft') {
      entry.history.push({
        at: at(),
        event: 'reset',
        from: entry.status,
        by: entry.reviewedBy,
        reason: 'base changed',
      });
      entry.status = 'draft';
      entry.reviewedBy = null;
      entry.reviewedAt = null;
      changes.push(`${locale}: reset to draft (base changed, translation is outdated)`);
    }
    translations[locale] = entry;
  }
  for (const locale of Object.keys(review.translations)) {
    if (!locales.includes(locale)) changes.push(`${locale}: removed (no translation files)`);
  }
  review.translations = translations;
  return { review, changes };
}

/** True when review.yaml exists and matches the current content. */
export function isInSync(topic: TopicFiles): boolean {
  const existing = readReview(topic);
  return existing !== undefined && syncReview(topic, existing).changes.length === 0;
}

// --- Owner commands --------------------------------------------------------------------------

/** A scope is `base` or a non-default locale code. */
export type Scope = string;

function translationEntry(review: Review, topic: TopicFiles, scope: Scope): TranslationReview {
  const entry = review.translations[scope];
  if (!entry) throw new Error(`${topic.key}: no translation "${scope}" in review.yaml`);
  return entry;
}

/**
 * Minor edit without reset: stores the new hash of the scope, keeps the status and logs the reason.
 * For base, translations that were based on the previous base hash move to the new one.
 */
export function minorEdit(
  topic: TopicFiles,
  existing: Review,
  scope: Scope,
  reason: string,
  clock: Clock = systemClock,
): Review {
  if (!reason.trim()) throw new Error('A reason is required (--reason "...").');
  const review = clone(existing);
  const at = timestamp(clock);
  if (scope === 'base') {
    const previousHash = review.base.contentHash;
    const hash = baseHash(topic);
    if (hash === previousHash) throw new Error(`${topic.key}: base has not changed.`);
    review.base.contentHash = hash;
    review.base.history.push({ at, event: 'minor', reason, previousHash });
    for (const entry of Object.values(review.translations)) {
      if (entry.basedOn === previousHash) entry.basedOn = hash;
    }
    return review;
  }
  const entry = translationEntry(review, topic, scope);
  const previousHash = entry.contentHash;
  const hash = translationHash(topic, scope);
  if (hash === previousHash)
    throw new Error(`${topic.key}: translation "${scope}" has not changed.`);
  entry.contentHash = hash;
  entry.history.push({ at, event: 'minor', reason, previousHash });
  return review;
}

/** Sets the review status of a scope (owner command). The topic must be in sync first. */
export function setStatus(
  topic: TopicFiles,
  existing: Review,
  scope: Scope,
  status: string,
  by: string | undefined,
  clock: Clock = systemClock,
): Review {
  if (syncReview(topic, existing, clock).changes.length > 0) {
    throw new Error(`${topic.key}: review.yaml is out of sync. Run pnpm review:sync first.`);
  }
  const review = clone(existing);
  const at = timestamp(clock);
  const name = by?.trim() || null;
  if (scope === 'base') {
    const next = baseStatusSchema.parse(status);
    if (next === 'verified' && !name) throw new Error('verified needs --by "<teacher name>".');
    const entry: HistoryEntry = {
      at,
      event: 'status',
      from: review.base.status,
      to: next,
      by: name,
    };
    review.base.status = next;
    review.base.verifiedBy = next === 'verified' ? name : null;
    review.base.verifiedAt = next === 'verified' ? at : null;
    review.base.history.push(entry);
    return review;
  }
  const next = translationStatusSchema.parse(status);
  const translation = translationEntry(review, topic, scope);
  if (next === 'reviewed' && !name) throw new Error('reviewed needs --by "<reviewer name>".');
  translation.history.push({ at, event: 'status', from: translation.status, to: next, by: name });
  translation.status = next;
  translation.reviewedBy = next === 'reviewed' ? name : null;
  translation.reviewedAt = next === 'reviewed' ? at : null;
  if (next === 'reviewed') translation.basedOn = review.base.contentHash;
  return review;
}

// --- Status ----------------------------------------------------------------------------------

export interface StatusRow {
  topic: string;
  base: string;
  translations: { locale: string; status: string; outdated: boolean }[];
  inSync: boolean;
}

export function statusRows(topics: readonly TopicFiles[]): StatusRow[] {
  return topics.map((topic) => {
    const review = readReview(topic);
    if (!review) return { topic: topic.key, base: 'missing', translations: [], inSync: false };
    return {
      topic: topic.key,
      base: review.base.status,
      translations: Object.entries(review.translations).map(([locale, entry]) => ({
        locale,
        status: entry.status,
        outdated: entry.basedOn !== review.base.contentHash,
      })),
      inSync: syncReview(topic, review).changes.length === 0,
    };
  });
}

export function formatStatus(rows: readonly StatusRow[]): string {
  if (rows.length === 0) return 'No topics.';
  return rows
    .map((row) => {
      const translations = row.translations
        .map((t) => `${t.locale}: ${t.status}${t.outdated ? ' (outdated)' : ''}`)
        .join(', ');
      const sync = row.inSync ? '' : '  [out of sync: run pnpm review:sync]';
      return `${row.topic}  base: ${row.base}${translations ? `  ${translations}` : ''}${sync}`;
    })
    .join('\n');
}

// --- CLI -------------------------------------------------------------------------------------

function findTopic(topics: readonly TopicFiles[], key: string | undefined): TopicFiles {
  const topic = topics.find((item) => item.key === key);
  if (!topic) throw new Error(`Unknown topic "${key ?? ''}". Use <level>/<slug>, e.g. a2/perfekt.`);
  return topic;
}

function existingReview(topic: TopicFiles): Review {
  const review = readReview(topic);
  if (!review) throw new Error(`${topic.key}: no review.yaml yet. Run pnpm review:sync first.`);
  return review;
}

function write(topic: TopicFiles, review: Review): void {
  writeFileSync(join(topic.dir, 'review.yaml'), serializeReview(review));
}

export function main(argv: readonly string[], root: string = CONTENT_ROOT): number {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: {
      check: { type: 'boolean', default: false },
      reason: { type: 'string' },
      by: { type: 'string' },
    },
  });
  const [command, topicKey, scope, status] = positionals;
  const topics = readTopics(root);

  switch (command) {
    case 'sync': {
      let outOfSync = 0;
      for (const topic of topics) {
        const { review, changes } = syncReview(topic, readReview(topic));
        if (changes.length === 0) continue;
        outOfSync++;
        for (const change of changes) console.log(`${topic.key}: ${change}`);
        if (!values.check) write(topic, review);
      }
      if (values.check && outOfSync > 0) {
        console.error(
          `\nreview.yaml is out of sync in ${outOfSync} topic(s). Run pnpm review:sync and commit the result.`,
        );
        return 1;
      }
      console.log(
        outOfSync === 0
          ? `Review state in sync (${topics.length} topics).`
          : 'review.yaml updated.',
      );
      return 0;
    }
    case 'status':
      console.log(formatStatus(statusRows(topics)));
      return 0;
    case 'minor': {
      const topic = findTopic(topics, topicKey);
      if (!scope) throw new Error('Missing scope: base or a locale code.');
      write(topic, minorEdit(topic, existingReview(topic), scope, values.reason ?? ''));
      console.log(`${topic.key}: ${scope} hash updated, status kept.`);
      return 0;
    }
    case 'set': {
      const topic = findTopic(topics, topicKey);
      if (!scope || !status)
        throw new Error('Usage: set <topic> <base|locale> <status> --by "Name"');
      write(topic, setStatus(topic, existingReview(topic), scope, status, values.by));
      console.log(`${topic.key}: ${scope} is now ${status}.`);
      return 0;
    }
    default:
      console.error(
        'Usage: node scripts/review.ts sync [--check] | status | minor <topic> <scope> --reason "..." | set <topic> <scope> <status> --by "..."',
      );
      return 2;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error((error as Error).message);
    process.exitCode = 1;
  }
}
