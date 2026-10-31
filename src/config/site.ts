/**
 * Site-wide settings. The project name lives only here (working name, may change).
 */

export const levelIds = ['a1', 'a2', 'b1', 'b2', 'c1'] as const;
export type LevelId = (typeof levelIds)[number];

/**
 * Topic categories in sidebar order. Labels are UI strings (`category.<id>`); topics reference a
 * category in meta.yaml.
 */
export const categoryIds = ['verbs', 'nouns', 'cases', 'adjectives', 'sentences'] as const;
export type CategoryId = (typeof categoryIds)[number];

export interface Level {
  id: LevelId;
  label: string;
  /** false = shown in navigation as "coming soon" */
  available: boolean;
}

/**
 * Planned topics of the levels that are not available yet, shown on the home page and their
 * coming-soon pages. Labels are UI strings (`planned.<id>`).
 */
export const plannedTopics = {
  b1: ['praeteritum', 'konjunktiv-ii', 'passiv', 'relativsaetze', 'infinitiv-mit-zu'],
  b2: [
    'passiv-modalverben',
    'konjunktiv-i',
    'n-deklination',
    'zweiteilige-konnektoren',
    'nomen-verb',
  ],
  c1: [
    'nominalstil',
    'modalpartikeln',
    'subjektive-modalverben',
    'partizipialattribute',
    'konnektoren',
  ],
} as const satisfies Partial<Record<LevelId, readonly string[]>>;
export type PlannedTopicId = (typeof plannedTopics)[keyof typeof plannedTopics][number];

export function plannedTopicsOf(level: LevelId): readonly PlannedTopicId[] {
  return (plannedTopics as Partial<Record<LevelId, readonly PlannedTopicId[]>>)[level] ?? [];
}

export const site = {
  name: 'Deutscherl',
  url: 'https://deutscherl.com',
  repo: 'https://github.com/dmrock/deutscherl',
  discussionsUrl: 'https://github.com/dmrock/deutscherl/discussions',
  /** Contact on /legal/ and /about/; Cloudflare Email Routing forwards it to the maintainers */
  email: 'hallo@deutscherl.com',
  /**
   * Pre-generated audio for German sentences (a later feature). While false, the audio
   * notes on /about/ and /legal/ are not shown (<AudioOnly> in the page MDX).
   */
  audio: false as boolean,
} as const;

export const levels: readonly Level[] = [
  { id: 'a1', label: 'A1', available: true },
  { id: 'a2', label: 'A2', available: true },
  { id: 'b1', label: 'B1', available: false },
  { id: 'b2', label: 'B2', available: false },
  { id: 'c1', label: 'C1', available: false },
];
