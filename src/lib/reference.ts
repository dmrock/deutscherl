/**
 * Reference page data for pages (Astro-only: reads content collections). Joins meta.yaml with the
 * page locale's MDX; pages without an MDX file in that locale are left out.
 */
import { getCollection, getEntry } from 'astro:content';
import type { LocaleCode } from '../i18n/locales.ts';
import { stripMarks } from './marked-text.ts';
import { type ReferenceLink, referenceInOrder } from './navigation.ts';

/** Reference pages of `locale` in reading order. */
export async function getReferenceLinks(locale: LocaleCode): Promise<ReferenceLink[]> {
  const metas = await getCollection('referenceMeta');
  const links: ReferenceLink[] = [];
  for (const meta of metas) {
    const page = await getEntry('reference', `${meta.id}/${locale}`);
    if (!page) continue;
    links.push({
      slug: meta.id,
      order: meta.data.order,
      levels: meta.data.levels,
      title: page.data.title,
      summary: stripMarks(page.data.summary),
    });
  }
  return referenceInOrder(links);
}
