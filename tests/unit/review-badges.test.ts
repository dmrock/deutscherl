import { describe, expect, it } from 'vitest';
import type { Review } from '../../src/lib/content-schemas.ts';
import { isPositive, reviewBadges } from '../../src/lib/review-badges.ts';

const BASE = 'sha256:aaaaaaaaaaaaaaaa';
const OLD = 'sha256:bbbbbbbbbbbbbbbb';

function review(
  base: Review['base']['status'],
  ru?: { status: 'draft' | 'reviewed'; basedOn: string },
): Review {
  return {
    base: { status: base, contentHash: BASE, verifiedBy: null, verifiedAt: null, history: [] },
    translations: ru
      ? {
          ru: {
            ...ru,
            contentHash: 'sha256:cccccccccccccccc',
            reviewedBy: null,
            reviewedAt: null,
            history: [],
          },
        }
      : {},
  };
}

describe('reviewBadges', () => {
  it('English page: checked by a teacher only when base is verified', () => {
    expect(reviewBadges(review('verified'), 'en', 'en')).toEqual(['teacherChecked']);
    expect(reviewBadges(review('reviewed'), 'en', 'en')).toEqual(['draft']);
    expect(reviewBadges(review('draft'), 'en', 'en')).toEqual(['draft']);
    expect(reviewBadges(undefined, 'en', 'en')).toEqual(['draft']);
  });

  it('translation: both badges when German is verified and the translation reviewed', () => {
    expect(
      reviewBadges(review('verified', { status: 'reviewed', basedOn: BASE }), 'ru', 'en'),
    ).toEqual(['germanChecked', 'translationReviewed']);
  });

  it('translation: an outdated review does not count', () => {
    expect(
      reviewBadges(review('verified', { status: 'reviewed', basedOn: OLD }), 'ru', 'en'),
    ).toEqual(['germanChecked', 'translationNotReviewed']);
  });

  it('translation: only the translation badge while the German is not verified', () => {
    expect(
      reviewBadges(review('reviewed', { status: 'reviewed', basedOn: BASE }), 'ru', 'en'),
    ).toEqual(['translationReviewed']);
  });

  it('translation: draft when nothing is checked', () => {
    expect(reviewBadges(review('draft', { status: 'draft', basedOn: BASE }), 'ru', 'en')).toEqual([
      'draft',
    ]);
    expect(reviewBadges(review('draft'), 'ru', 'en')).toEqual(['draft']);
  });

  it('marks completed checks as positive', () => {
    expect(isPositive('teacherChecked')).toBe(true);
    expect(isPositive('translationNotReviewed')).toBe(false);
    expect(isPositive('draft')).toBe(false);
  });
});
