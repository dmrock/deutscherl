---
paths:
  - "src/content/topics/**"
  - "src/content/reference/**"
  - "scripts/review.ts"
  - "src/lib/review-badges.ts"
  - "src/components/content/StatusBadges.astro"
  - "tests/unit/review*.ts"
  - "lefthook.yml"
---

# Review and verification

A German teacher verifies the German and the canonical English explanation. Every other locale is a translation of the verified English page, reviewed by a fluent speaker of that locale, so nobody needs to read German and Russian at the same time.

## Scopes

Both live in each topic's and reference page's `review.yaml`, written only by `scripts/review.ts`. Reference pages go through the same flow, keyed `reference/<slug>`:

1. `base`: `meta.yaml`, `german.yaml`, `en.mdx`, `i18n/en.yaml`. Status `draft` → `reviewed` (a maintainer read it) → `verified` (a German teacher checked all of it). Stores `verifiedBy`, `verifiedAt`, `contentHash`, `history`.
2. `translations.<locale>` for every non-English locale: `<locale>.mdx`, `i18n/<locale>.yaml`. Status `draft` → `reviewed` (a fluent speaker confirmed it says the same as English). Stores `reviewedBy`, `reviewedAt`, `contentHash`, `basedOn` (the `base` hash it was last written or reviewed against; `review:sync` sets it whenever the translation files change), `history`.

## Hashes and automatic reset

- Hashes use normalized content: YAML parsed and re-serialized with sorted keys (comments do not count); MDX as parsed frontmatter + body with normalized line endings, trailing spaces and blank-line runs. Stored as `sha256:<16 hex>`.
- A change in `base` files resets `base` to `draft`, and every translation whose `basedOn` no longer matches as well.
- A change in a translation file resets that translation to `draft`.
- Each reset appends a history entry with the previous status and reviewer; resetting a `draft` scope only updates the hash. An unchanged translation keeps its old `basedOn` after a base change, so it stays listed as outdated until it is edited or reviewed again.
- The pre-commit hook runs `review:sync` (reads the working tree), so resets show up in the PR diff. `pnpm review:check` (CI) fails without writing when anything is out of sync.

## Commands

- `pnpm review:status`: every topic and reference page with base status, translation status per locale and outdated translations.
- Maintainers only (never run them unless asked to explicitly):
  - `pnpm review:minor <topic> <base|locale> --reason "typo in c3 why"`: updates the hash, keeps the status, appends `{ at, event: minor, reason, previousHash }`; for `base`, translations based on the previous hash move to the new one.
  - `pnpm review:set <topic> base reviewed|verified --by "Name"` and `pnpm review:set <topic> <locale> reviewed --by "Name"` (sets `basedOn` to the current base hash). Refuses when `review.yaml` is out of sync.

## Badges

They say exactly what was checked; all texts are `review.*` UI strings.

- English page: "Checked by a teacher" when `base` is `verified` with a matching hash, otherwise "Draft".
- Other locales: "German checked by a teacher" when `base` is verified, plus "Translation reviewed" when the translation is reviewed and its `basedOn` matches, or "Translation not reviewed yet" when it is not. "Draft" when neither is checked. No link to the English version.
