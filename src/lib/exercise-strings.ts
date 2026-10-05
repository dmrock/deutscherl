/**
 * UI strings for the exercise island, resolved on the server for one locale: the island gets
 * them as props, so other locales are never shipped to the client (CLAUDE.md, "UX rules").
 */
import type { LocaleCode } from '../i18n/locales.ts';
import { en, type UiKey } from '../i18n/ui/en.ts';
import { t } from '../i18n/utils.ts';

type ExerciseKey = Extract<UiKey, `exercise.${string}`> | 'topic.austrianUsage';
export type ExerciseStrings = Record<ExerciseKey, string>;

const keys = (Object.keys(en) as UiKey[]).filter(
  (key): key is ExerciseKey => key.startsWith('exercise.') || key === 'topic.austrianUsage',
);

/** Exercise strings in `locale`, placeholders (`{name}`) left for the island to fill in. */
export function exerciseStrings(locale: LocaleCode): ExerciseStrings {
  return Object.fromEntries(keys.map((key) => [key, t(locale, key)])) as ExerciseStrings;
}
