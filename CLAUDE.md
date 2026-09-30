# Deutscherl — project context

Working name, may change. Keep the name in one place: `src/config/site.ts`.

This file is the source of truth for how the project works. `docs/architecture.html` is an illustrated snapshot and may lag behind; if they disagree, this file wins.

## What this is

A free website for learning German grammar. Explanations in the learner's native language (simple wording), examples in German with translations into the native language, interactive exercises.

- Pilot scope: levels A1 and A2, 5 topics each. Levels B1, B2, C1 are visible in navigation as "coming soon".
- Native languages in the pilot: English (default) and Russian. More languages will be added later, possibly with other scripts or right-to-left writing, so language support must be data-driven, not hard-coded.
- No accounts, no progress tracking, no cookies. Anyone can use it without barriers.
- Signature feature: notes about Austrian German (usage that differs from Germany).
- Monetization later: static sponsor banners, clearly labeled as ads, no ad trackers. Keep a sponsor slot in the topic layout.

## Working agreements (for Claude Code)

- Always commit with sign-off: `git commit -s` (DCO is enforced in CI).
- Content you generate is ALWAYS `draft` (base and translations). Never set `reviewed` or `verified`, never edit `review.yaml` by hand, never run the minor-edit command unless the owner asks for it explicitly.
- At the end of every stage: update this file if a rule or structure changed, and add an entry to `docs/decisions.md` for every decision made during the stage (what, why, alternatives). Decisions that are not written down are lost after `/clear`.
- Before adding a dependency, check its current docs (Context7 or the official site), state its gzipped size and why it is needed.
- If you are not sure a German sentence is correct, say so in the summary instead of guessing.

## Repository language

Everything committed is in English: code, identifiers, comments, docs, README, CONTRIBUTING, issue and PR templates, commit messages, branch names, PR titles and descriptions, script output, test names, `review.yaml` reasons and history.

Native-language text is allowed ONLY in localization files:
- `src/i18n/ui/<locale>.ts` (UI strings)
- `src/i18n/locales.ts` — only the `name` field (language name in its own language)
- `src/content/topics/**/<locale>.mdx` and `src/content/topics/**/i18n/<locale>.yaml`
- dictionary glosses and translations for that locale in `db/data/words.jsonl` and `db/overrides/*.yaml`
- test fixtures under `tests/fixtures/i18n/<locale>/`

Components, pages and tests never contain native-language strings inline: they use `t(locale, key)` or read content files. E2E tests assert localized text through `t()` too.

`scripts/check-language.ts` runs in CI and in the pre-commit hook: it fails when non-Latin letters (Cyrillic, Greek, Arabic, Hebrew, CJK, Devanagari, …) appear in any tracked file outside the allowed localization paths. German letters (ä ö ü ß) are allowed everywhere because German is the subject matter. German sentences belong in `german.yaml`, not in code.

## Open source

- Public GitHub repository. Pull requests are limited to collaborators (repository setting); issues are open to everyone, but only through issue forms (blank issues disabled). Ideas go to GitHub Discussions.
- Licenses:
  - Code: MIT → `LICENSE`
  - Content (explanations, examples, exercises, translations, dictionary data): CC BY-SA 4.0 → `LICENSE-CONTENT`. Wiktionary-derived dictionary data must stay CC BY-SA 4.0 anyway.
  - Use the official license texts verbatim; never write or paraphrase them from memory.
- Contributions require DCO sign-off (`Signed-off-by` in each commit), checked in CI. By signing off, contributors agree to MIT for code and CC BY-SA 4.0 for content.
- Rule in `CONTRIBUTING.md`: open an issue first; PRs without an agreed issue may be closed. Exception: one-line typo fixes. External contributors become collaborators after agreeing on the work in an issue.
- Never commit secrets. The only secrets are the Cloudflare API token and account ID, stored in GitHub Actions secrets/variables.
- Do not add the `hacktoberfest` topic or label.

## Stack

- Astro (latest stable), fully static output, no SSR adapter. `build.format: 'directory'`, `trailingSlash: 'always'`: canonical URLs end with `/`.
- Svelte 5 ONLY for islands that need real interactivity: exercises, dictionary filter. Everything else (theme toggle, language picker, language hint) is a few lines of inline vanilla JS.
- Drag and drop: `svelte-dnd-action` (Svelte 5 compatible, touch delay option, keyboard and screen-reader support). Do not hand-roll drag and drop.
- Page transitions: native cross-document View Transitions in CSS (`@view-transition { navigation: auto; }`). Do NOT use Astro's `<ClientRouter />`: it adds JS to every page. Browsers without support navigate normally.
- TypeScript, `strict` preset. TypeScript 6.x until Astro's tooling (`astro check`) supports TypeScript 7 (decision #23).
- Scripts in `scripts/` run with plain `node` (built-in type stripping): erasable TypeScript only, local imports with the `.ts` extension, no tsx.
- Tailwind CSS v4. Use logical properties/utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) everywhere, never left/right, so right-to-left languages work later.
- Content: MDX for explanations, YAML for German content and translations, via Astro Content Collections with Zod schemas
- i18n: Astro built-in i18n routing
- Dictionary: text files in git are the source of truth; a SQLite file is generated from them at build time and queried with Drizzle ORM (build time only, no runtime DB)
- Search: Pagefind, one index per ready locale, UI loaded only when the user opens search
- Lint/format: Biome for TS/JS/JSON/CSS (lints the script part of `.astro`/`.svelte`); Prettier with astro/svelte plugins formats only `.astro` and `.svelte` (Biome's support for them is experimental, decision #25)
- Git hooks: lefthook (`lefthook.yml`), installed by `pnpm install`
- Tests: Vitest, Playwright, @axe-core/playwright
- Package manager: pnpm, version pinned in `package.json` → `packageManager`; dependency build scripts are denied by default (`pnpm-workspace.yaml` → `allowBuilds`). Node LTS, pinned in `.nvmrc`
- Versions: latest stable release of every dependency and GitHub Action (check npm / GitHub, not memory); exceptions are recorded in `docs/decisions.md`. GitHub Actions are pinned to commit SHAs with the version in a comment.
- Hosting: Cloudflare Workers with static assets, deployed from GitHub Actions with Wrangler (see "Deployment")
- Analytics: Cloudflare Web Analytics (free, cookieless). The beacon script is added with `defer` only on production builds; its site token is public and lives in `src/config/site.ts`. No other analytics or tracking SDKs (PostHog was considered and postponed, see `docs/decisions.md`). Google Search Console is verified via a DNS record, no code.

## Languages (i18n)

Terminology: the "native language" (a.k.a. locale) is the language of the UI, explanations and translations. German is always the language being learned and is never a locale.

- Locales are defined in ONE place: `src/i18n/locales.ts`. Each entry: `code`, `name` (in its own language), `default`, `ready`, `dir` (`ltr` | `rtl`), `font` (see "Fonts"). Adding a language = adding an entry + translations; no code changes elsewhere.
- Pages are built from `[...locale]` rest-parameter routes (`src/pages/[...locale]/…`) over `locales.ts`, so a new locale needs no new page files.
- `ready: false` locales are built for preview but hidden from the picker, sitemap and search, and pages get `noindex`.
- Routing: default locale without prefix (`/a2/perfekt/`), others with prefix (`/ru/a2/perfekt/`). Same slugs in every locale.
- `<html lang dir>` come from the locale. Every German fragment is wrapped with `lang="de"` (screen readers, TTS, hyphenation, search).
- Language picker in the header: plain links, language names in their own language (the `name` field of each locale, e.g. Russian written in Cyrillic), no flags. It links to the SAME page in the other locale and saves the choice in `localStorage` (`locale`). Markup: a `<details>` disclosure (opens without JS; `LocaleScript.astro` closes it on an outside click or Escape); every link carries `data-locale`, and one delegated click handler saves the choice.
- No automatic redirects. A small dismissible hint ("This page is available in <language>", text from the target locale's UI strings) appears on a page when its locale differs from the saved choice, or, if nothing is saved, from the best match in `navigator.languages` among ready locales. Dismissal is saved per locale (`hint-dismissed:<code>`). The hints are server-rendered, hidden, one per other ready locale, each in its own language (`LanguageHint.astro`); `LocaleScript.astro` only un-hides one.
- UI strings: `src/i18n/ui/en.ts` is the source of truth; every other locale file is typed against it (`satisfies UiStrings`), so a missing key is a type error. Access via `t(locale, key)`; no inline strings in components.
- German is single-sourced: German sentences exist ONCE and are shared by all locales. Everything written in a native language lives in per-locale files, so translators never touch German files and translations never trigger German re-verification.
- Translation freshness: `review.yaml` records for each translation the `base` hash it was last written or reviewed against (`basedOn`). If English or German changes afterwards, the translation is outdated: it is reset to `draft` and listed by `review:status` (see "Review and verification").
- SEO: `hreflang` alternates for all ready locales plus `x-default` → English; canonical per locale; sitemap with alternates.
- Russian explanations: simple, friendly Russian (informal "you" form), grammar terms in Russian with the German term in parentheses the first time (e.g. the Russian term for "dative case" followed by "(Dativ)").

## Fonts

- Fonts are configured per locale in `locales.ts` (`family`, Fontsource variable-font `package`, `subsets`, `preload`), self-hosted, `font-display: swap`. Only the listed subsets get `@font-face` rules; `preload` lists the subsets every page of that locale uses right away.
- Implementation: Astro's built-in Fonts API. `src/config/fonts.ts` builds the `fonts` config from `locales.ts` + `germanFont` with a small provider that reads the files of the installed Fontsource packages (`metadata.json`, `unicode.json`, `files/`): versions pinned by the lockfile, no network at build time, metric-adjusted fallbacks. Each family gets a CSS variable derived from its name (`--font-golos-text`). `Base.astro` renders `<Font>` for the locale font (preloaded) and the German font, and sets `--font-body` / `--font-de`.
- German content blocks (examples, exercises, dictionary headwords) use one German font on every locale for consistent umlauts and ß: Atkinson Hyperlegible Next (Latin only), via the `german` utility (German font, slightly larger size). Inline German terms inside explanation text inherit the locale font.
- `en`: Atkinson Hyperlegible Next.
- `ru`: Golos Text (owner's choice after the specimen comparison, decision #7).
- Font specimen page `/dev/fonts/` (`src/dev/fonts.astro`): every site font with the samples in `tests/fixtures/`, body and example size, light and dark. Built in dev and for previews, never for production. To choose a font for a new locale, put the candidates into `locales.ts` one by one (or temporarily extend the page), compare on the PR preview, and keep only the chosen package.
- A future locale in a script without a good match (Arabic, Hindi, …) simply gets its own font entry; nothing else changes.
- German example text is slightly larger than explanation text.

## Project structure (target)

```
src/
  config/site.ts             # name, levels, categories
  config/fonts.ts            # Fonts API config from locales.ts + German font
  i18n/
    locales.ts               # locales: code, name, default, ready, dir, font
    ui/en.ts                 # UI strings, source of truth
    ui/ru.ts                 # satisfies UiStrings
    utils.ts                 # t(), localized paths, hreflang helpers
  content/topics/a2/perfekt/
    meta.yaml                # level, category, order, readingMinutes, sources
    german.yaml              # German examples, exercises, Austrian notes (German part)
    en.mdx                   # explanation in English (canonical)
    ru.mdx                   # explanation in Russian
    i18n/en.yaml             # translations + why texts in English, keyed by item id
    i18n/ru.yaml             # same in Russian
    review.yaml              # review state: base + translations (tool-managed)
  content.config.ts          # per-file Zod schemas
  components/
    exercises/               # Svelte islands
    content/                 # InShort, RuleTable, Example, AustrianNote, Word, SponsorSlot
    layout/                  # Header, LevelSwitcher, LanguagePicker, ThemeToggle, Sidebar,
                             # BottomBar, LanguageHint, ThemeScript, LocaleScript (inline JS)
  layouts/Base.astro         # <html lang dir>, head (canonical, hreflang, noindex, fonts), layout
  lib/                       # pure TS logic — unit-tested (navigation.ts); topics.ts reads collections
  dev/                       # developer pages, not built for production (fonts.astro)
  pages/[...locale]/         # index, [level]/index, [level]/[topic]/index
db/
  schema.ts                  # Drizzle schema
  data/words.jsonl           # imported data (generated by import, committed)
  overrides/*.yaml           # manual edits and additions (never touched by import)
  seed/lemmas-a1-a2.txt      # lemma list with levels
scripts/
  import-wiktionary.ts       # .data/*.jsonl → db/data/words.jsonl
  build-dictionary.ts        # words.jsonl + overrides → .cache/dictionary.sqlite
  validate-content.ts        # cross-file checks
  i18n-coverage.ts           # missing translation keys and files
  check-language.ts          # no native-language text outside localization files
  review.ts                  # review status, reset and minor-edit commands
  check-js-budget.ts         # gzipped JS per page (islands vs. none), CI build job
  ci/                        # CI-only helpers (wrangler bootstrap config)
docs/
  decisions.md               # decision log
  architecture.html          # illustrated snapshot
  adding-a-language.md
.data/                       # raw downloads (kaikki.org), gitignored
.cache/                      # generated SQLite, gitignored
tests/
  unit/
  e2e/
  fixtures/                  # fonts/ (German sample), i18n/<locale>/ (native-language samples)
```

## Content model

- `meta.yaml`: level, category, order, readingMinutes, sources (`{title, url}`).
- `german.yaml`:
  - `examples`: `{ id, de, region?: AT }`
  - `choice`: `{ id, text (with ___), answer, options, alsoCorrect?: [{ value, region }] }`
  - `wordOrder`: `{ id, parts, fixed?, accept?, punctuation }`
  - `austrianNotes`: `{ id, de }`
- `<locale>.mdx` frontmatter: `title`, `summary` ("In short"). Body references German content by id: `<Example id="e1" />`. Never write German example sentences directly in MDX.
- `i18n/<locale>.yaml`: `examples.<id>`, `choice.<id>.why`, `wordOrder.<id>.translation`, `wordOrder.<id>.why`, `austrianNotes.<id>`.
- `review.yaml`: see "Review and verification". Managed only by `scripts/review.ts`.
- Validation: per-file shape with Zod in `content.config.ts`; everything that spans files (ids referenced in MDX and i18n files exist in `german.yaml`, every ready locale has all files and keys, answer is in options, ids unique, review hashes) in `scripts/validate-content.ts`, run in CI and before build. Zod alone cannot do cross-file checks.

### Exercise rules

- Choice: 2–4 options, exactly one correct answer, except for regional variants listed in `alsoCorrect` (e.g. `bin` with `region: AT` for "Ich ___ gesessen"). A regional answer is accepted as correct and the `why` explains the regional difference. Avoid such items unless the topic is about that difference.
- Word order:
  - `parts` is the canonical order. `accept` lists every other valid full order. `fixed` (first element locked) may be combined with `accept`; it does not guarantee a unique answer by itself.
  - Parts are stored in neutral case: a sentence-initial word is lowercase unless it is always capitalized (nouns, names, formal "Sie"). The UI shows parts exactly as stored, so capitalization gives no hint. After checking, the first word of the displayed sentence is capitalized.
  - Checking compares sequences of strings, not chip identities, so duplicate words ("die … die") work.
  - Punctuation (`.`, `?`, `!`) is part of the item, shown after the answer line, not a draggable chip.
- Each topic has at least 10 choice items and, where it makes sense, at least 6 word-order items. Every item has `why` (and word-order items `translation`) in every ready locale.

## Review and verification

The teacher verifies German and the canonical English explanation. Other locales are translations of verified English, reviewed by a fluent speaker of that locale (for Russian: the owner). Nobody needs to read German and Russian at the same time.

- Two scopes per topic, both stored in `review.yaml` and managed only by `scripts/review.ts`:
  1. `base` = the topic's German content plus the English page: `meta.yaml`, `german.yaml`, `en.mdx`, `i18n/en.yaml`. Status `draft` → `reviewed` (owner read it) → `verified` (a German teacher checked all of it). Stores `verifiedBy`, `verifiedAt`, `contentHash`, `history`.
  2. `translations.<locale>` for every non-English locale = `<locale>.mdx` and `i18n/<locale>.yaml`. Status `draft` → `reviewed` (a fluent speaker confirmed it says the same as English). Stores `reviewedBy`, `reviewedAt`, `contentHash`, `basedOn` (the `base` hash the translation was last written or reviewed against; `review:sync` sets it whenever translation files change), `history`.
- Hashes use normalized content (parsed and re-serialized), so formatting-only changes don't count.
- Automatic reset:
  - any change in `base` files → `base` goes back to `draft`, and every translation whose `basedOn` no longer matches goes back to `draft` too (the translation must be re-checked against the new English/German);
  - any change in a translation file → that translation goes back to `draft`.
  Each reset appends a history entry with the previous status and reviewer. A pre-commit hook (`review:sync`) performs the reset so it shows up in the PR diff; CI fails if `review.yaml` is out of sync.
- Minor edit without reset: `pnpm review:minor <topic> <base|locale> --reason "typo in c3 why"` updates the hash, keeps the status and appends `{ at, reason, previousHash }` to history. Only the owner runs it.
- Badges say exactly what was checked:
  - English page: "Checked by a teacher" when `base` is `verified` with a matching hash; otherwise "Draft".
  - Other locales: "German checked by a teacher" when `base` is verified, plus "Translation reviewed" when the translation is reviewed and its `basedOn` matches; a link to the English version is always shown. Otherwise "Draft". All texts localized.
- `pnpm review:status` prints every topic with base status, translation status per locale and outdated translations.
- Dictionary entries have their own `status` (draft | verified) without hashing in the pilot; no badge on dictionary pages.

## Content rules (critical)

The site owner is an A2 learner. German correctness cannot be assumed — neither the owner's nor yours.

- Write the English explanation first; it is the canonical explanation the teacher verifies. Other locales are translated from its meaning (not word-for-word) and must describe the same rule, same exceptions, same examples.
- Every topic lists `sources` (e.g. Duden grammar, Goethe-Institut / ÖSD level descriptions). Do not copy text from books or other websites. Do not copy Goethe/ÖSD word lists wholesale.
- Explanations: short sentences, no jargon without a one-line definition.
- Examples: natural, everyday German.
- Austrian notes only for real, established Austrian usage (reference: Österreichisches Wörterbuch). Mark with `region: AT`. When unsure, leave it out and add a TODO for the owner.

## UX rules

- Zero JavaScript by default. Islands hydrate with `client:visible`. Islands receive already-localized strings as props; do not ship other locales to the client.
- Exercise types: multiple choice and word order by drag and drop. NO free-text input.
- Word order UI: two zones built with `svelte-dnd-action`: the answer line and the word bank. Words are dragged from the bank into the line, reordered inside it, and back. Mouse: drag immediately. Touch: `delayTouchStart: 250` (a long press starts the drag, a swipe scrolls). Keyboard: the library's built-in support. A "Check" button becomes active when the bank is empty.
- Exercise runner: rounds of 5 mixed items from the topic pool. Seen item IDs in `sessionStorage` under `seen:<level>/<slug>` (shared between locales); reset when the pool is exhausted. Shuffle options and word-bank order. "Try again" starts a new round with unseen items. All randomness goes through a seedable RNG so tests are deterministic. Storage access in try/catch with in-memory fallback.
- After each answer show whether it was right and the `why` in the current locale, plus a "Report a mistake" link.
- Examples: audio button (Web Speech API placeholder in the pilot, `de-AT` then `de-DE` voice) and a "Hide translation" toggle.
- Theme: follow `prefers-color-scheme`, manual toggle saved in `localStorage` (`theme`), applied by a tiny inline script in `<head>` before first paint (`ThemeScript.astro` sets `data-theme` on `<html>`). Without JS, CSS follows the system preference.
- Design tokens (`src/styles/global.css`): semantic colors (`bg`, `surface`, `fg`, `muted`, `border`, `accent`, `accent-fg`, `focus`) defined per `[data-theme]` and exposed to Tailwind (`bg-bg`, `text-muted`, …). Use only these; no raw colors, no `dark:` variants except for swapping icons. Dark text is deliberately not pure white on black (about 13:1 instead of 18:1) and text uses grayscale antialiasing, so it does not glow.
- Layout (variant A): header with level switcher, search, language picker, theme toggle; left sidebar with topics grouped by category (category order in `site.ts`, labels `category.<id>`); main column with the topic. On mobile the sidebar becomes a sheet (the same element with the `popover` attribute, opened by a `popovertarget` button: no JS) and a bottom bar shows Prev / Practice / Next. Russian strings are often 20–30% longer than English: layouts must not break.
- Page transitions: `@view-transition { navigation: auto; }` inside `prefers-reduced-motion: no-preference`; named elements `site-header` and `sidebar`.
- "Report a mistake": opens the GitHub issue form with page URL, locale and item id prefilled via query parameters. No email.
- Pages that are not ready for search engines get `noindex`: coming-soon pages, `ready: false` locales, preview deployments.
- Performance budgets, enforced by `scripts/check-js-budget.ts` in CI (gzipped JS loaded by the page, excluding the analytics beacon and other external scripts; each file gzipped separately, imported chunks followed):
  - pages without islands: ≤ 3 KB (inline scripts only)
  - pages with islands (topic pages with exercises): ≤ 45 KB (Svelte + svelte-dnd-action ≈ 13.5 KB + our code)
  - Lighthouse ≥ 95 in all categories, checked before launch.
- Accessibility: WCAG 2.2 AA, with one documented exception decided by the owner: success criterion 2.5.7 (Dragging Movements) for word-order exercises, which have drag and keyboard input but no single-tap alternative. Record it in `docs/decisions.md` and on the accessibility statement in `/about`.

## Dictionary

- Raw data: kaikki.org Wiktextract JSONL, English edition (grammar + English glosses) and Russian edition (Russian glosses). The owner downloads the files manually into `.data/` (gitignored); scripts take the path as an argument.
- `scripts/import-wiktionary.ts` writes normalized entries for lemmas in `db/seed/lemmas-a1-a2.txt` to `db/data/words.jsonl` (sorted, one entry per line). Re-running it replaces this file completely; it never reads or writes overrides.
- Manual edits go to `db/overrides/*.yaml` (field-level patches by word id, or new words). `scripts/build-dictionary.ts` merges `words.jsonl` + overrides into `.cache/dictionary.sqlite` before the Astro build. Overrides always win. Drizzle Studio may be used to browse the generated DB, never to edit it.
- Word identity: `(lemma, pos, gender)`. Homonyms are separate entries (der See / die See, essen / das Essen).
- Word id and URL slug: NFC-normalized lowercase lemma + `-` + article for nouns (`see-der`, `see-die`, `essen-das`, `maße-die`, `masse-die`) or part of speech otherwise (`essen-verb`, `schnell-adj`). Umlauts and ß stay as they are. Any remaining collision gets `-2`. Uniqueness is checked in CI; an e2e test on the preview deployment opens entries with ä/ö/ü/ß.
- `<Word id="see-der">` in MDX references entries by id, never by bare lemma.
- Glosses and example translations are stored per locale (`lang`). Missing gloss → English with a visible "no translation yet" hint.
- Russian glosses are matched by `(lemma, pos, gender)`; ambiguous matches are reported, not guessed.
- Every entry keeps `source`, `sourceUrl`, `license`; `/about/sources` shows attribution in every locale.
- Wiktionary has no CEFR levels: levels come from `db/seed/lemmas-a1-a2.txt`, maintained by the owner. No frequency data in the pilot.
- Hosting limit to remember: Cloudflare allows 20,000 static files per deployment on the free plan (100,000 on paid). Pagefind adds many files. Watch the count in CI when the dictionary grows.

## Deployment

- One GitHub Actions workflow. Deploy jobs run only after all checks pass.
- Pull requests: `wrangler versions upload --preview-alias pr-<number>`, then a PR comment with the preview URL. Preview builds set `PUBLIC_DEPLOY_ENV=preview`, which adds `noindex` to every page.
- Push to `main`: `wrangler deploy` in a GitHub Environment `production`. `concurrency` prevents overlapping deploys.
- Only run deploy jobs for branches of this repository, never for forks.
- First deploy: if the Worker does not exist yet, the preview job deploys once without `routes` (`scripts/ci/wrangler-bootstrap-config.ts`), so the custom domain is attached only by the first production deploy.
- Required status checks (job names): `DCO`, `Language check`, `Lint`, `Astro check`, `Unit tests`, `Build`, `E2E tests`.
- `wrangler.jsonc`: `assets.directory: "./dist"`, `assets.not_found_handling: "404-page"`, default HTML handling (trailing slash, matching Astro), production only on the custom domain, preview URLs enabled. Check the current Wrangler docs for the exact keys.
- Secrets: `CLOUDFLARE_API_TOKEN` (least privilege: edit Workers for this account), variable `CLOUDFLARE_ACCOUNT_ID`.
- Preview URLs live on the account's workers.dev subdomain (`pr-<n>-deutscherl.<subdomain>.workers.dev`), so the Cloudflare account must have one: opening Workers & Pages in the dashboard once creates it. Production does not use workers.dev (`workers_dev: false`).

## Legal pages (Austria)

- `/impressum/` (Offenlegung according to § 25 Mediengesetz for a small private website: owner name, place of residence, purpose of the site) and `/privacy/` (hosting by Cloudflare, Cloudflare Web Analytics, browser storage used, Web Speech API, links to GitHub for reports). Both in every ready locale, linked in the footer.
- Write them as templates with clearly marked TODO placeholders; the owner fills in and checks the facts. Do not invent legal statements.
- When sponsor banners arrive: label them as ads ("Anzeige" / localized) and extend the Impressum as required for commercial sites.

## Testing

Functional tests run on the English site only: the code is the same for every locale. Other locales are covered by data checks and a small set of language-switching tests. No visual snapshot (screenshot) tests.

- Vitest: schemas, `validate-content.ts` rules (with failing fixtures), review hashing/reset/minor-edit including translation reset via `basedOn`, `check-language.ts`, `t()` and path helpers, `src/lib` logic (pool selection with seeded RNG, choice check with `alsoCorrect`, word-order check with `accept`, duplicates, capitalization after check), dictionary import on small JSONL fixtures, slug uniqueness.
- Data checks (not tests of wording): `i18n-coverage.ts` fails when a ready locale misses a key or file, so a missing translation can never break a page.
- Playwright on English pages: exercise flows (choice incl. a regional answer, word order with mouse, touch long press vs swipe, keyboard-only, duplicates, "Try again" with a fixed seed), navigation, search, report-mistake URL, noindex rules, analytics beacon only in production, axe checks on every page type.
- Playwright language switching (the only tests on non-English pages): the picker opens the same page in the other locale and saves the choice; the language hint appears and can be dismissed; `lang`, `dir`, `hreflang` and canonical are correct; no horizontal scrolling on a Russian topic page at mobile width.
- CI: DCO, language check, lint (`biome ci` + Prettier), `astro check`, Vitest and the build run as parallel jobs; the build job also runs the JS budget (`pnpm budget`); later stages add validate-content + review sync + i18n coverage (checks), dictionary build and file count (build job).
- The E2E job gets the same `PUBLIC_DEPLOY_ENV` as the build, so the noindex tests know what they test (preview builds: noindex everywhere; production: no `/dev/` pages).
- Local e2e: `pnpm build && pnpm test:e2e` (the tests run against `dist/`). Playwright runs on the build output. Deploy jobs need every check (decision #30).
- Playwright's web server runs `astro preview --ignore-lock`: Astro 7 moves `astro preview` to the background when it detects an AI agent, and `--ignore-lock` keeps it in the foreground.

## Don'ts

- No accounts, no cookies, no ad trackers.
- No runtime API or DB calls.
- No automatic language redirects.
- No German text duplicated across locale files; no native-language text in `german.yaml`.
- No native-language text outside localization files (see "Repository language").
- No `<ClientRouter />`, no hand-rolled drag and drop.
- No visual snapshot (screenshot) tests; no functional tests duplicated per locale.
- No left/right-specific CSS; use logical properties.
- No new dependencies without a clear reason and size; mention them in the summary.
- Do not mark content as reviewed or verified.
