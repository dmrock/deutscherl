import { describe, expect, it } from 'vitest';
import {
  groupByCategory,
  neighbours,
  type TopicLink,
  topicPath,
  topicsInOrder,
} from '../../src/lib/navigation.ts';

type Category = TopicLink['category'];
// Navigation only compares category ids, so fixtures may use ids that site.ts does not define yet.
const cat = (id: string) => id as Category;
const order = [cat('verbs'), cat('cases'), cat('sentences')];

const topic = (
  slug: string,
  category: string,
  rank: number,
  level: 'a1' | 'a2' = 'a2',
): TopicLink => ({
  level,
  slug,
  category: cat(category),
  order: rank,
  title: slug,
  summary: '',
});

const topics = [
  topic('dative', 'cases', 1),
  topic('perfekt', 'verbs', 2),
  topic('modal-verbs', 'verbs', 1),
  topic('weil-dass', 'sentences', 1),
  topic('present', 'verbs', 1, 'a1'),
];

describe('topicsInOrder()', () => {
  it('orders by category, then order, and keeps only the level', () => {
    expect(topicsInOrder(topics, 'a2', order).map((t) => t.slug)).toEqual([
      'modal-verbs',
      'perfekt',
      'dative',
      'weil-dass',
    ]);
  });
});

describe('groupByCategory()', () => {
  it('groups topics by category in category order and leaves out empty categories', () => {
    const groups = groupByCategory(topics, 'a1', order);
    expect(groups).toEqual([{ category: 'verbs', topics: [topics[4]] }]);
    expect(groupByCategory(topics, 'a2', order).map((g) => g.category)).toEqual(order);
  });

  it('returns no groups for a level without topics', () => {
    expect(groupByCategory(topics, 'b1', order)).toEqual([]);
  });
});

describe('neighbours()', () => {
  it('returns previous and next topic across categories', () => {
    const { prev, next } = neighbours(topics, 'a2', 'perfekt', order);
    expect(prev?.slug).toBe('modal-verbs');
    expect(next?.slug).toBe('dative');
  });

  it('has no previous at the start and no next at the end', () => {
    expect(neighbours(topics, 'a2', 'modal-verbs', order).prev).toBeUndefined();
    expect(neighbours(topics, 'a2', 'weil-dass', order).next).toBeUndefined();
  });

  it('returns nothing for an unknown topic', () => {
    expect(neighbours(topics, 'a2', 'missing', order)).toEqual({
      prev: undefined,
      next: undefined,
    });
  });
});

describe('topicPath()', () => {
  it('builds the unprefixed topic path with a trailing slash', () => {
    expect(topicPath({ level: 'a2', slug: 'perfekt' })).toBe('/a2/perfekt/');
  });
});
