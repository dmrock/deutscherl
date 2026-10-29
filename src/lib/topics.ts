/**
 * Topic data for pages (Astro-only: reads content collections). Joins meta.yaml with the page
 * locale's MDX; topics without an MDX file in that locale are left out.
 */
import { getCollection, getEntry } from 'astro:content';
import type { LocaleCode } from '../i18n/locales.ts';
import { stripMarks } from './marked-text.ts';
import type { TopicLink } from './navigation.ts';

export async function getTopicLinks(locale: LocaleCode): Promise<TopicLink[]> {
  const metas = await getCollection('topicMeta');
  const links: TopicLink[] = [];
  for (const meta of metas) {
    const page = await getEntry('topics', `${meta.id}/${locale}`);
    if (!page) continue;
    links.push({
      level: meta.data.level,
      slug: meta.id.slice(meta.id.indexOf('/') + 1),
      category: meta.data.category,
      order: meta.data.order,
      title: page.data.title,
      summary: stripMarks(page.data.summary),
    });
  }
  return links;
}
