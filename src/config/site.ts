/**
 * Site-wide settings. The project name lives only here (working name, may change).
 */

export const levelIds = ['a1', 'a2', 'b1', 'b2', 'c1'] as const;
export type LevelId = (typeof levelIds)[number];

/**
 * Topic categories in sidebar order. Labels are UI strings (`category.<id>`); topics reference a
 * category in meta.yaml. Stage 8 adds the rest.
 */
export const categoryIds = ['verbs'] as const;
export type CategoryId = (typeof categoryIds)[number];

export interface Level {
  id: LevelId;
  label: string;
  /** false = shown in navigation as "coming soon" */
  available: boolean;
}

export const site = {
  name: 'Deutscherl',
  url: 'https://deutscherl.com',
  repo: 'https://github.com/dmrock/deutscherl',
  discussionsUrl: 'https://github.com/dmrock/deutscherl/discussions',
} as const;

export const levels: readonly Level[] = [
  { id: 'a1', label: 'A1', available: true },
  { id: 'a2', label: 'A2', available: true },
  { id: 'b1', label: 'B1', available: false },
  { id: 'b2', label: 'B2', available: false },
  { id: 'c1', label: 'C1', available: false },
];
