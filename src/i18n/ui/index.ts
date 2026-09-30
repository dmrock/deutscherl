import type { LocaleCode } from '../locales.ts';
import { en, type UiStrings } from './en.ts';
import { ru } from './ru.ts';

/** UI strings per locale. A locale missing here is a type error. */
export const ui: Record<LocaleCode, UiStrings> = { en, ru };

export type { UiKey, UiStrings } from './en.ts';
