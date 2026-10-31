---
paths:
  - "tests/**"
  - "playwright.config.ts"
  - "vitest.config.ts"
---

# Tests

Functional tests run on English pages only: the code is the same for every locale. Other locales are covered by data checks and a small set of language-switching tests. No screenshot (visual snapshot) tests.

- Vitest: schemas, `validate-content.ts` rules (with failing fixtures), review hashing/reset/minor edit including translation reset via `basedOn`, `check-language.ts`, `t()` and path helpers, `src/lib` logic (pool selection with seeded RNG, choice check with `alsoCorrect`, word-order check with `accept`, duplicates, capitalization after check). Unit tests copy the valid topic in `tests/fixtures/content/` and change one file.
- Data checks, not tests of wording: `i18n-coverage.ts` fails when a ready locale misses a key or file.
- Playwright on English pages: topic page content (`lang="de"` examples, badges, Austrian note), exercise flows (choice incl. a regional answer; word order with mouse, touch long press vs swipe, keyboard only, duplicates; "Try again" with a fixed seed), navigation, search (lazy loading, a German word, Cmd/Ctrl+K, focus return), SEO (Open Graph, JSON-LD, robots.txt, sitemap, icons served), report-mistake URL, noindex rules, no analytics beacon in the build, axe on every page type and the open search modal.
- Playwright language switching, the only tests on non-English pages: the picker opens the same page in the other locale on every page type; `lang`, `dir`, `hreflang` and canonical are correct; no horizontal scrolling on a Russian topic page at phone width; each locale's 404 page (language, home link, noindex, no canonical).
- Assert localized text through `t()`, never inline native-language strings.
- The E2E job gets the same `PUBLIC_DEPLOY_ENV` as the build, so the noindex tests know what they test (preview builds: noindex everywhere).

## E2E mechanics

- Tests run against `dist/` (`pnpm build && pnpm test:e2e`); search tests need the Pagefind index from the build.
- Playwright's web server is `astro preview --ignore-lock` on port 4321 and reuses a server already running there outside CI; `E2E_PORT=<port>` picks another port (e.g. when a preview of another worktree holds 4321). Stop `astro dev` (`pnpm astro dev stop`) before running e2e, or the tests hit the dev server and fail in unrelated places. `--ignore-lock` keeps `astro preview` in the foreground (Astro 7 backgrounds it when it detects an AI agent).
- Exercise tests steer a round through the seen ids in `sessionStorage` (`onlyUnseen` in `tests/e2e/helpers/exercises.ts`), so they run on production builds; only the "Try again" seed test needs `?seed=` and is skipped there.
- Drags move in steps and hold 250 ms before release (svelte-dnd-action checks the zone under the word every 200 ms). Touch uses CDP `Input.dispatchTouchEvent` with the bank scrolled to the middle (the mobile bottom bar covers the bottom of the screen).
- `<noscript>` is checked in the served HTML: Playwright with JavaScript disabled still parses it as scripted.
