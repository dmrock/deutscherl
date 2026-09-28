/**
 * Site-wide settings. The project name lives only here (working name, may change).
 */

export type LevelId = 'a1' | 'a2' | 'b1' | 'b2' | 'c1';

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
