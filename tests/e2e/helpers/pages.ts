/** Titles from the English content files, so tests do not repeat text. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const CONTENT = join(import.meta.dirname, '../../../src/content');

function frontmatter(file: string): Record<string, string> {
  const raw = readFileSync(join(CONTENT, file), 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match?.[1]) throw new Error(`No frontmatter in ${file}`);
  return parse(match[1]);
}

/** Title of a site page (`src/content/pages/<slug>/en.mdx`). */
export const pageTitle = (slug: string): string =>
  frontmatter(`pages/${slug}/en.mdx`).title as string;

/** Title of a topic (`src/content/topics/<level>/<slug>/en.mdx`). */
export const topicTitle = (key: string): string =>
  frontmatter(`topics/${key}/en.mdx`).title as string;

/** Title of a reference page (`src/content/reference/<slug>/en.mdx`). */
export const referenceTitle = (slug: string): string =>
  frontmatter(`reference/${slug}/en.mdx`).title as string;
