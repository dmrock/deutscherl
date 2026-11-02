/**
 * Reads topic and reference page folders from disk for the content scripts (validate-content,
 * i18n-coverage, review). Files are parsed but not validated: callers apply the schemas from
 * src/lib/content-schemas.ts.
 *
 * Layout (`.claude/rules/content.md`, `.claude/rules/reference.md`): both kinds have the files
 * {meta.yaml, german.yaml, review.yaml, <locale>.mdx, i18n/<locale>.yaml}, topics in
 * <topics root>/<level>/<slug>/, reference pages in <reference root>/<slug>/.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

/** Default content root: src/content/topics of this repository. */
export const CONTENT_ROOT = resolve(fileURLToPath(import.meta.url), '../../../src/content/topics');

/** Default reference root: src/content/reference of this repository. */
export const REFERENCE_ROOT = resolve(
  fileURLToPath(import.meta.url),
  '../../../src/content/reference',
);

export interface ContentRoots {
  topics: string;
  reference: string;
}

export const CONTENT_ROOTS: ContentRoots = { topics: CONTENT_ROOT, reference: REFERENCE_ROOT };

/** Key prefix of reference pages: `reference/genus` */
export const REFERENCE_PREFIX = 'reference';

export type ContentKind = 'topic' | 'reference';

export interface ParsedFile {
  /** Path relative to the topic folder, e.g. `i18n/ru.yaml` */
  name: string;
  raw: string;
  /** Parsed YAML (or MDX frontmatter); undefined when parsing failed */
  data: unknown;
  /** Parse error message */
  error?: string;
}

export interface MdxFile extends ParsedFile {
  body: string;
  /** Ids used by `<Example id>`, `<AustrianNote id>` and `<GermanTable id>` in the body */
  refs: { examples: string[]; austrianNotes: string[]; tables: string[] };
}

/** The files of a topic or a reference page. */
export interface TopicFiles {
  kind: ContentKind;
  /** `a2/perfekt`, `reference/genus` */
  key: string;
  /** Level folder of a topic; undefined for reference pages */
  folderLevel: string | undefined;
  slug: string;
  dir: string;
  meta?: ParsedFile;
  german?: ParsedFile;
  review?: ParsedFile;
  /** By locale code from the file name (may be an unknown code) */
  mdx: Map<string, MdxFile>;
  /** By locale code from the file name (may be an unknown code) */
  i18n: Map<string, ParsedFile>;
  /** Files the content model does not know */
  unknownFiles: string[];
}

function readYaml(dir: string, name: string): ParsedFile {
  const raw = readFileSync(join(dir, name), 'utf8');
  try {
    return { name, raw, data: parse(raw) ?? {} };
  } catch (error) {
    return { name, raw, data: undefined, error: (error as Error).message };
  }
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const REFERENCE = /<(Example|AustrianNote|GermanTable)\s[^>]*?\bid=["']([^"']+)["']/g;
const REF_LISTS = {
  Example: 'examples',
  AustrianNote: 'austrianNotes',
  GermanTable: 'tables',
} as const;

/** Splits MDX into parsed frontmatter and body, and collects the content references. */
export function parseMdx(name: string, raw: string): MdxFile {
  const match = FRONTMATTER.exec(raw);
  const body = match ? raw.slice(match[0].length) : raw;
  const refs = { examples: [] as string[], austrianNotes: [] as string[], tables: [] as string[] };
  for (const [, component, id] of body.matchAll(REFERENCE)) {
    if (!id) continue;
    refs[REF_LISTS[component as keyof typeof REF_LISTS]].push(id);
  }
  if (!match) return { name, raw, body, refs, data: undefined, error: 'missing frontmatter' };
  try {
    return { name, raw, body, refs, data: parse(match[1] ?? '') ?? {} };
  } catch (error) {
    return { name, raw, body, refs, data: undefined, error: (error as Error).message };
  }
}

function isDirectory(path: string): boolean {
  return existsSync(path) && statSync(path).isDirectory();
}

function sortedEntries(dir: string): string[] {
  return readdirSync(dir).sort();
}

function readFolder(
  kind: ContentKind,
  dir: string,
  key: string,
  folderLevel: string | undefined,
  slug: string,
): TopicFiles {
  const topic: TopicFiles = {
    kind,
    key,
    folderLevel,
    slug,
    dir,
    mdx: new Map(),
    i18n: new Map(),
    unknownFiles: [],
  };
  for (const name of sortedEntries(dir)) {
    if (name === 'i18n' && isDirectory(join(dir, name))) {
      for (const file of sortedEntries(join(dir, name))) {
        const locale = /^(.+)\.yaml$/.exec(file)?.[1];
        if (locale) topic.i18n.set(locale, readYaml(dir, `i18n/${file}`));
        else topic.unknownFiles.push(`i18n/${file}`);
      }
      continue;
    }
    if (name === 'meta.yaml') topic.meta = readYaml(dir, name);
    else if (name === 'german.yaml') topic.german = readYaml(dir, name);
    else if (name === 'review.yaml') topic.review = readYaml(dir, name);
    else if (name.endsWith('.mdx')) {
      topic.mdx.set(name.slice(0, -4), parseMdx(name, readFileSync(join(dir, name), 'utf8')));
    } else topic.unknownFiles.push(name);
  }
  return topic;
}

/** Reads one topic folder. */
export function readTopic(root: string, folderLevel: string, slug: string): TopicFiles {
  return readFolder(
    'topic',
    join(root, folderLevel, slug),
    `${folderLevel}/${slug}`,
    folderLevel,
    slug,
  );
}

/** Reads one reference page folder. */
export function readReferencePage(root: string, slug: string): TopicFiles {
  return readFolder('reference', join(root, slug), `${REFERENCE_PREFIX}/${slug}`, undefined, slug);
}

/** Reads every topic folder (`<root>/<level>/<slug>/`), sorted by key. */
export function readTopics(root: string = CONTENT_ROOT): TopicFiles[] {
  if (!isDirectory(root)) return [];
  const topics: TopicFiles[] = [];
  for (const level of sortedEntries(root)) {
    if (!isDirectory(join(root, level))) continue;
    for (const slug of sortedEntries(join(root, level))) {
      if (isDirectory(join(root, level, slug))) topics.push(readTopic(root, level, slug));
    }
  }
  return topics;
}

/** Reads every reference page folder (`<root>/<slug>/`), sorted by slug. */
export function readReferencePages(root: string = REFERENCE_ROOT): TopicFiles[] {
  if (!isDirectory(root)) return [];
  return sortedEntries(root)
    .filter((slug) => isDirectory(join(root, slug)))
    .map((slug) => readReferencePage(root, slug));
}

/** Topics, then reference pages. */
export function readContent(roots: ContentRoots = CONTENT_ROOTS): TopicFiles[] {
  return [...readTopics(roots.topics), ...readReferencePages(roots.reference)];
}
