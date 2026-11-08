import { describe, expect, it } from 'vitest';
import {
  groupByCategory,
  levelLinks,
  neighbours,
  type ReferenceLink,
  referenceInOrder,
  referencePath,
  type TopicLink,
  topicKey,
  topicPath,
  topicsInOrder,
} from '../../src/lib/navigation.ts';

type Category = TopicLink['category'];
// Navigation only compares category ids, so fixtures may use ids that site.ts does not define yet.
const cat = (id: string) => id as Category;
const order = [cat('verbs'), cat('cases'), cat('sentences')];
const levelOrder = ['a1', 'a2'] as const;

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
    const { prev, next } = neighbours(topics, 'a2', 'perfekt', order, levelOrder);
    expect(prev?.slug).toBe('modal-verbs');
    expect(next?.slug).toBe('dative');
  });

  it('crosses from the last topic of a level to the first of the next', () => {
    expect(neighbours(topics, 'a1', 'present', order, levelOrder).next?.slug).toBe('modal-verbs');
    expect(neighbours(topics, 'a2', 'modal-verbs', order, levelOrder).prev?.slug).toBe('present');
  });

  it('has no previous at the start and no next at the end', () => {
    expect(neighbours(topics, 'a1', 'present', order, levelOrder).prev).toBeUndefined();
    expect(neighbours(topics, 'a2', 'weil-dass', order, levelOrder).next).toBeUndefined();
  });

  it('returns nothing for an unknown topic', () => {
    expect(neighbours(topics, 'a2', 'missing', order, levelOrder)).toEqual({
      prev: undefined,
      next: undefined,
    });
  });
});

describe('levelLinks()', () => {
  const linked = (slug: string, category: string, level: 'a1' | 'a2', buildsOn: string[]) => ({
    ...topic(slug, category, 1, level),
    buildsOn,
  });
  const levelTopics = [
    linked('dative-more', 'cases', 'a2', ['a1/dative']),
    linked('perfekt', 'verbs', 'a2', ['a1/present', 'a1/dative', 'a1/missing']),
    topic('dative', 'cases', 1, 'a1'),
    topic('present', 'verbs', 1, 'a1'),
    topic('alone', 'sentences', 1, 'a1'),
  ];

  it('lists the topics a topic builds on, in reading order, skipping unknown keys', () => {
    const links = levelLinks(levelTopics, 'a2', 'perfekt', order, levelOrder);
    expect(links.buildsOn.map(topicKey)).toEqual(['a1/present', 'a1/dative']);
    expect(links.continuedIn).toEqual([]);
  });

  it('derives the topics that build on a topic, in reading order', () => {
    const links = levelLinks(levelTopics, 'a1', 'dative', order, levelOrder);
    expect(links.buildsOn).toEqual([]);
    expect(links.continuedIn.map(topicKey)).toEqual(['a2/perfekt', 'a2/dative-more']);
  });

  it('returns no links for a topic without any', () => {
    expect(levelLinks(levelTopics, 'a1', 'alone', order, levelOrder)).toEqual({
      buildsOn: [],
      continuedIn: [],
    });
  });
});

describe('topicPath()', () => {
  it('builds the unprefixed topic path with a trailing slash', () => {
    expect(topicPath({ level: 'a2', slug: 'perfekt' })).toBe('/a2/perfekt/');
  });
});

describe('reference pages', () => {
  const page = (slug: string, rank: number): ReferenceLink => ({
    slug,
    order: rank,
    levels: ['a1'],
    title: slug,
    summary: '',
  });

  it('orders by order, then slug', () => {
    const pages = [page('verben', 2), page('plural', 1), page('genus', 1)];
    expect(referenceInOrder(pages).map((item) => item.slug)).toEqual(['genus', 'plural', 'verben']);
  });

  it('builds the index and page paths', () => {
    expect(referencePath()).toBe('/reference/');
    expect(referencePath('genus')).toBe('/reference/genus/');
  });
});
