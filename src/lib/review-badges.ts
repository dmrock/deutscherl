/**
 * Review badges of a topic page (CLAUDE.md, "Review and verification"), pure and unit-tested.
 * They say exactly what was checked:
 * - canonical (English) page: "Checked by a teacher" when base is verified, otherwise "Draft";
 * - other locales: "German checked by a teacher" when base is verified, "Translation reviewed" when
 *   the translation is reviewed against the current base; "Draft" when neither. When the German is
 *   checked but the translation is not, "Translation not reviewed yet" is added, so the German
 *   badge is not read as covering the translation.
 * Hashes match the files because validate-content (run before every build) fails otherwise.
 */
import type { Review } from './content-schemas.ts';

export type Badge =
  | 'teacherChecked'
  | 'germanChecked'
  | 'translationReviewed'
  | 'translationNotReviewed'
  | 'draft';

export function reviewBadges(
  review: Review | undefined,
  locale: string,
  canonicalLocale: string,
): Badge[] {
  const baseVerified = review?.base.status === 'verified';
  if (locale === canonicalLocale) return [baseVerified ? 'teacherChecked' : 'draft'];
  const translation = review?.translations[locale];
  const translationReviewed =
    translation?.status === 'reviewed' && translation.basedOn === review?.base.contentHash;
  if (baseVerified) {
    return [
      'germanChecked',
      translationReviewed ? 'translationReviewed' : 'translationNotReviewed',
    ];
  }
  return translationReviewed ? ['translationReviewed'] : ['draft'];
}

/** Badges that state a completed check (shown in the success style). */
export function isPositive(badge: Badge): boolean {
  return badge === 'teacherChecked' || badge === 'germanChecked' || badge === 'translationReviewed';
}
