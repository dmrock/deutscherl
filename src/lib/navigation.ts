/**
 * Topic navigation (pure, unit-tested): sidebar groups and prev/next topic.
 * Reading order = level order, then category order from site.ts, then `order` from meta.yaml, then
 * slug.
 */
import type { CategoryId, LevelId } from '../config/site.ts';

export interface TopicLink {
  level: LevelId;
  slug: string;
  category: CategoryId;
  order: number;
  title: string;
  /** `*word*` marks a German word (`MarkedText`) */
  summary: string;
  /** Topics at lower levels this topic extends, as `<level>/<slug>` (`buildsOn` in meta.yaml) */
  buildsOn?: readonly string[];
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

/** Previous and next topic in reading order; the last topic of a level leads to the next level. */
export function neighbours(
  topics: readonly TopicLink[],
  level: LevelId,
  slug: string,
  categoryOrder: readonly CategoryId[],
  levelOrder: readonly LevelId[],
): { prev: TopicLink | undefined; next: TopicLink | undefined } {
  const ordered = levelOrder.flatMap((id) => topicsInOrder(topics, id, categoryOrder));
  const index = ordered.findIndex((topic) => topic.level === level && topic.slug === slug);
  if (index === -1) return { prev: undefined, next: undefined };
  return { prev: ordered[index - 1], next: ordered[index + 1] };
}

/** Key of a topic, `<level>/<slug>`, as `buildsOn` in meta.yaml names it. */
export function topicKey(topic: Pick<TopicLink, 'level' | 'slug'>): string {
  return `${topic.level}/${topic.slug}`;
}

/**
 * Topics at other levels linked to a topic: the ones it builds on (its `buildsOn`) and the ones
 * that build on it (every topic whose `buildsOn` names it), both in reading order. Keys without a
 * topic in `topics` are skipped (validate-content reports them; a locale may lack a page).
 */
export function levelLinks(
  topics: readonly TopicLink[],
  level: LevelId,
  slug: string,
  categoryOrder: readonly CategoryId[],
  levelOrder: readonly LevelId[],
): { buildsOn: TopicLink[]; continuedIn: TopicLink[] } {
  const ordered = levelOrder.flatMap((id) => topicsInOrder(topics, id, categoryOrder));
  const key = topicKey({ level, slug });
  const current = ordered.find((topic) => topicKey(topic) === key);
  const targets = new Set(current?.buildsOn ?? []);
  return {
    buildsOn: ordered.filter((topic) => targets.has(topicKey(topic))),
    continuedIn: ordered.filter((topic) => topic.buildsOn?.includes(key)),
  };
}

/** URL path of a topic, without locale prefix. */
export function topicPath(topic: Pick<TopicLink, 'level' | 'slug'>): string {
  return `/${topic.level}/${topic.slug}/`;
}

/** A reference page (`src/content/reference/<slug>/`) in navigation. */
export interface ReferenceLink {
  slug: string;
  order: number;
  levels: readonly LevelId[];
  title: string;
  /** `*word*` marks a German word (`MarkedText`) */
  summary: string;
}

/** Reference pages in reading order: `order` from meta.yaml, then slug. */
export function referenceInOrder(pages: readonly ReferenceLink[]): ReferenceLink[] {
  return [...pages].sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
}

/** URL path of the reference index (no slug) or of a reference page, without locale prefix. */
export function referencePath(slug?: string): string {
  return slug ? `/reference/${slug}/` : '/reference/';
}
