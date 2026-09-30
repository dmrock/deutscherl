/**
 * Topic navigation (pure, unit-tested): sidebar groups and prev/next inside a level.
 * Reading order = category order from site.ts, then `order` from meta.yaml, then slug.
 */
import type { CategoryId, LevelId } from '../config/site.ts';

export interface TopicLink {
  level: LevelId;
  slug: string;
  category: CategoryId;
  order: number;
  title: string;
  summary: string;
}

export interface CategoryGroup {
  category: CategoryId;
  topics: TopicLink[];
}

/** Topics of `level` in reading order. */
export function topicsInOrder(
  topics: readonly TopicLink[],
  level: LevelId,
  categoryOrder: readonly CategoryId[],
): TopicLink[] {
  const rank = (category: CategoryId) => categoryOrder.indexOf(category);
  return topics
    .filter((topic) => topic.level === level)
    .sort(
      (a, b) =>
        rank(a.category) - rank(b.category) || a.order - b.order || a.slug.localeCompare(b.slug),
    );
}

/** Topics of `level` grouped by category; empty categories are left out. */
export function groupByCategory(
  topics: readonly TopicLink[],
  level: LevelId,
  categoryOrder: readonly CategoryId[],
): CategoryGroup[] {
  const ordered = topicsInOrder(topics, level, categoryOrder);
  return categoryOrder
    .map((category) => ({
      category,
      topics: ordered.filter((topic) => topic.category === category),
    }))
    .filter((group) => group.topics.length > 0);
}

/** Previous and next topic in reading order within the same level. */
export function neighbours(
  topics: readonly TopicLink[],
  level: LevelId,
  slug: string,
  categoryOrder: readonly CategoryId[],
): { prev: TopicLink | undefined; next: TopicLink | undefined } {
  const ordered = topicsInOrder(topics, level, categoryOrder);
  const index = ordered.findIndex((topic) => topic.slug === slug);
  if (index === -1) return { prev: undefined, next: undefined };
  return { prev: ordered[index - 1], next: ordered[index + 1] };
}

/** URL path of a topic, without locale prefix. */
export function topicPath(topic: Pick<TopicLink, 'level' | 'slug'>): string {
  return `/${topic.level}/${topic.slug}/`;
}
