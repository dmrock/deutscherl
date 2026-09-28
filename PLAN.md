# Deutscherl — pilot plan and Claude Code prompts

Each stage has manual steps for the owner and a prompt for Claude Code.

## How to work

1. Put `CLAUDE.md`, `PLAN.md`, `decisions.md` and `architecture.html` into one folder (for example `~/Downloads/deutscherl-docs`), start Claude Code in the parent folder where the project should live (for example `~/Projects`), and paste the stage 1 prompt with both paths filled in. Claude Code clones the repository, adds the files and commits them.
2. Before each stage, switch Claude Code to plan mode (Shift+Tab), review the plan, then let it implement.
3. One stage = one branch = one PR. Run `/clear` between stages. Everything important lives in `CLAUDE.md` and `docs/decisions.md`, and Claude Code updates both at the end of every stage.
4. After each stage, open the PR's preview URL on a computer and on a phone and click through it in both languages. Deployment is set up in stage 1 for exactly this reason.

---

## Stage 0. Preparation (manual, about 30 minutes)

No Claude Code needed.

**Cloudflare and domain**
- Buy the domain with Cloudflare Registrar, so it lands in your Cloudflare account right away.
- Create an API token that can edit Workers for your account (least privilege). Keep the token and your Account ID.
- Web Analytics → Add a site: add your domain and keep the site token. It is not a secret; it is needed in stage 7.

**GitHub**
- Create a **public** repository. Do not add the `hacktoberfest` topic.
- Settings → General → Pull requests: allow pull requests from **collaborators only**.
- Settings → General → Features: enable Issues and Discussions, disable Wiki and Projects if not needed.
- Settings → Secrets and variables → Actions: secret `CLOUDFLARE_API_TOKEN`, variable `CLOUDFLARE_ACCOUNT_ID`.
- Settings → Environments: create an environment named `production`.
- Set up rules for `main` after stage 1, once CI checks exist: block direct pushes, require a PR, require the checks, **0 required approvals** (otherwise you cannot merge your own PRs).
- If spam ever becomes a problem: Settings → Moderation options → Interaction limits.

**Dictionary data** (needed in stage 5): download from kaikki.org the German JSONL of the English Wiktionary edition and the German entries of the Russian Wiktionary edition into the project's `.data/` folder. The files are large and stay out of git.

---

## Stage 1. Scaffold, open-source files, deployment

```
Set up the repository first:
- Check that git can push to GitHub (`gh auth status` or `git ls-remote git@github.com:dmrock/deutscherl.git`). If not, stop and tell me what to fix.
- Clone https://github.com/dmrock/deutscherl into <PROJECT_PATH, e.g. ~/Projects/deutscherl>. The repository is empty.
- Copy the planning files from <DOCS_PATH, e.g. ~/Downloads/deutscherl-docs>: CLAUDE.md and PLAN.md into the repository root, decisions.md and architecture.html into docs/.
- Commit them directly to main with sign-off as the initial commit ("docs: add project context and plan") and push.
- Create a branch for this stage (e.g. stage-1-scaffold) and continue there.
Then read CLAUDE.md and docs/decisions.md. Scaffold the project:
- Astro (latest stable) with TypeScript strict, Svelte integration, MDX integration, Tailwind CSS v4; build.format 'directory', trailingSlash 'always'.
- pnpm, .nvmrc with current Node LTS, .gitignore including .data/ and .cache/.
- Biome for TS/JS/JSON; check what Biome supports for .astro and .svelte files today and add Prettier with plugins only for what Biome can't handle.
- A git hooks tool (lightweight, e.g. simple-git-hooks or lefthook; justify the choice) with a pre-commit hook running biome and the language check on staged files. The review sync hook is added in stage 3.
- scripts/check-language.ts as described in CLAUDE.md, "Repository language", with unit tests (allowed paths pass, Cyrillic in a component fails, German umlauts pass everywhere).
- Vitest and Playwright with one smoke test each. No visual snapshot tests (CLAUDE.md, "Testing").
- src/config/site.ts with the site name "Deutscherl" and the levels (A1, A2 available; B1, B2, C1 coming soon).
- i18n foundation (CLAUDE.md, "Languages"): src/i18n/locales.ts with en (default, ready, ltr) and ru (ready, ltr) including a font field (ru font is a placeholder until stage 2); Astro i18n routing with the default locale unprefixed; ui/en.ts as typed source of truth and ru.ts typed against it; t() and localized path helpers with unit tests.
- package.json scripts: dev, build, preview, check, lint, test, test:e2e.
- GitHub Actions (CLAUDE.md, "Deployment" and "Testing"): DCO check, language check, lint, astro check, vitest, build, playwright, then deploy jobs: PR preview with `wrangler versions upload --preview-alias pr-<number>` and a PR comment with the URL; production `wrangler deploy` on main in the `production` environment; concurrency; no deploys for forks. Preview builds add noindex. Name jobs clearly so I can mark them as required checks.
- wrangler.jsonc for a static-assets-only Worker as described in CLAUDE.md. Verify the current Wrangler keys for preview URLs and workers.dev in the docs before writing it.
- Open-source files (CLAUDE.md, "Open source"):
  - LICENSE (official MIT text, copyright holder: Denis Sitnikov, current year) and LICENSE-CONTENT (official CC BY-SA 4.0 legal code). Fetch the official texts; if you can't, leave a TODO and tell me where to get them.
  - README: what the project is, how to run it locally, which license covers what, how to report a mistake.
  - CONTRIBUTING.md: issue first, then PR; PRs without an agreed issue may be closed (except one-line typo fixes); contributors become collaborators after agreeing in an issue; DCO with `git commit -s`; everything in English except localization files; content rules in short (never change review status in a PR); how to propose a new native language.
  - CODE_OF_CONDUCT.md from the official Contributor Covenant text.
  - .github/ISSUE_TEMPLATE/: config.yml (blank issues disabled, contact link to Discussions); report-mistake.yml (page URL, locale, item id, what is wrong, what is correct, source) with field ids usable as URL query parameters; bug.yml; translation.yml.
  - .github/pull_request_template.md: linked issue, what changed, checklist (tests pass, sign-off, review status untouched).
Show me the plan first. After implementing, list every dependency with its purpose, the exact CI check names to mark as required, and the preview URL of this PR.
```

## Stage 2. Design system, fonts and layout

```
Read CLAUDE.md, sections "UX rules", "Languages" and "Fonts". Build the base layout (variant A):
- Font comparison page (dev only, not deployed to production): the same German paragraph with ä ö ü ß and the I/l/1, O/0 pairs, and the same Russian paragraph (a localization fixture under tests/fixtures/i18n/ru/) with German terms in parentheses, rendered in Atkinson Hyperlegible Next and each Cyrillic candidate (Golos Text, Inter, Noto Sans, Onest) at body and example sizes, light and dark. Stop and ask me to choose the ru font before continuing.
- Per-locale fonts from locales.ts via Fontsource, only needed subsets; the German font for German content blocks.
- Design tokens as CSS variables for light and dark theme, wired into Tailwind v4; logical properties only.
- Inline <head> script for the theme (no flash), inline scripts for the language picker and the language hint (CLAUDE.md, "Languages"). No Svelte for these. Keep all inline JS under the 3 KB budget.
- Header: site name, level switcher (A1, A2 links; B1, B2, C1 muted with "soon"), search button placeholder, language picker, theme toggle.
- Left sidebar with topics grouped by category; on mobile a sheet opened from a menu button, plus a bottom bar with Prev / Practice / Next.
- <html lang dir> per locale, hreflang alternates and x-default, noindex rules.
- Native cross-document View Transitions in CSS with named elements for header and sidebar; disabled under prefers-reduced-motion. No ClientRouter.
- Stub pages for /, /a1/, /a2/, /b1/ (coming soon, noindex) and one topic page, in both locales. All UI strings through t().
- scripts/check-js-budget.ts and its CI step (budgets from CLAUDE.md).
Add Playwright tests: language switching (picker opens the same page in the other locale and saves the choice; hint appears and can be dismissed; lang, dir, hreflang, canonical; no horizontal scrolling on the Russian topic page at mobile width); on English pages: noindex rules, no theme flash, axe checks. No screenshot tests. Record the font choice and other decisions in docs/decisions.md.
```

## Stage 3. Content model, review and the first topic

```
Read CLAUDE.md, sections "Content model", "Review and verification", "Content rules" and "Languages". Implement:
- Per-file Zod schemas for meta.yaml, german.yaml, <locale>.mdx frontmatter, i18n/<locale>.yaml, review.yaml.
- scripts/validate-content.ts for all cross-file rules, run in CI and before build.
- scripts/i18n-coverage.ts: missing keys and files per locale (fails for ready locales).
- scripts/review.ts implementing CLAUDE.md, "Review and verification" (base scope + translation scopes): review:sync (recompute hashes, reset changed scopes to draft, reset translations whose basedOn no longer matches, set basedOn when translation files change, append history), review:minor <topic> <base|locale> --reason, review:status, and a CI check that fails when review.yaml is out of sync. Add review:sync to the pre-commit hook.
- MDX components: <InShort>, <RuleTable>, <Example id> (German from german.yaml with lang="de", translation from the locale file, audio placeholder, page-level "Hide translation" toggle), <AustrianNote id>, <SponsorSlot> (renders nothing for now).
- Status badges exactly as described in CLAUDE.md (English: "Checked by a teacher"; other locales: "German checked by a teacher" + "Translation reviewed" + link to the English version; otherwise "Draft"); localized.
- ONE sample topic: A2 "Perfekt: haben or sein?" with en.mdx, ru.mdx, i18n files, 5 examples, 10 choice items and 6 word-order items following the exercise rules in CLAUDE.md (neutral case, accept lists, alsoCorrect for real regional variants). Everything draft.
Tests: Vitest for every validation rule with failing fixtures (missing ru key, unknown example id, answer not in options, capitalized sentence-initial part, stale hash), for review sync/minor/status, including: a change in german.yaml resets base and the ru translation; a change in ru.mdx resets only the ru translation; review:minor keeps the status. At the end tell me which German sentences you are least sure about, which items might have more than one correct answer or order, and where ru might differ in meaning from en.
```

## Stage 4. Exercises

```
Read CLAUDE.md, sections "UX rules" and "Exercise rules". Build the exercise islands in Svelte 5:
- Pure logic in src/lib/exercises.ts: seeded RNG, pickRound(pool, seenIds, counts, rng), shuffle, checkChoice (with alsoCorrect and region), checkWordOrder (canonical + accept, string sequences, duplicates), capitalizeFirst for display after checking. Full Vitest coverage.
- The topic page passes items already resolved for the current locale and a small object of localized UI strings.
- ChoiceExercise.svelte.
- WordOrderExercise.svelte with svelte-dnd-action: answer line and word bank as two zones of the same type, reorder inside the line, move back to the bank; delayTouchStart 250; built-in keyboard and screen-reader support; "Check" button active when the bank is empty; punctuation shown after the line; after checking, show the sentence with the first word capitalized and mark wrong positions. Check the library's current docs first.
- ExerciseRunner.svelte: rounds of 5 mixed items, progress dots, feedback with why, "Report a mistake" link (GitHub issue form, prefilled), result screen, "Try again" = new round with unseen items; sessionStorage as in CLAUDE.md. A test-only way to set the RNG seed (e.g. a query parameter honored only in non-production builds).
- Hydrate with client:visible. Run the JS budget check and report the sizes.
- Record the WCAG 2.5.7 exception in docs/decisions.md.
Playwright tests on English pages only: choice flow including a regional answer; word order with mouse; with touch emulation (long press drags, quick swipe scrolls); keyboard-only; duplicate words; "Try again" shows different items with a fixed seed; report link URL. After merging I will test on a real iPhone and Android phone via the preview URL.
```

## Stage 5. Dictionary data

Before this stage, download the kaikki.org files into `.data/` (see stage 0). Claude Code generates a first draft of the lemma list; review it yourself: the choice of words and their A1/A2 levels are your call.

```
Read CLAUDE.md, sections "Dictionary" and "Languages". Implement the dictionary data pipeline:
- Drizzle schema (SQLite): words (id/slug, lemma, pos, gender, plural, level, status, source, sourceUrl, license), senses (wordId, lang, gloss, position, source), examples (id, wordId, de, source), exampleTranslations (exampleId, lang, text), regionalVariants (wordId, region, variant, note), topicWords (topicSlug, wordId).
- db/seed/lemmas-a1-a2.txt: "lemma<TAB>pos<TAB>gender<TAB>level", about 300 common A1–A2 entries including homonyms where relevant; header marks it as a draft for my review. Build it from general knowledge, do not copy an official word list.
- scripts/import-wiktionary.ts <file> --edition en|ru: writes db/data/words.jsonl (sorted, deterministic). en: pos, gender, plural, first 3 English glosses, examples with English translations, Austria-tagged forms and senses. ru: Russian glosses matched by (lemma, pos, gender), never overwriting grammar fields; ambiguous matches reported. Report per edition: imported, not found, ambiguous, missing glosses per locale. Before writing the ru parser, show me the structure of a few real ru-edition records.
- db/overrides/*.yaml format (field patches by word id, new words), documented in db/README.md with examples.
- scripts/build-dictionary.ts: words.jsonl + overrides → .cache/dictionary.sqlite, run before astro build (locally and in CI). Slug generation and uniqueness check as in CLAUDE.md; fail on collisions without a suffix rule.
- pnpm script for Drizzle Studio to browse the generated DB (read-only use).
Unit tests with small JSONL fixtures for both editions (ru fixtures under tests/fixtures/i18n/ru/), overrides merging (override wins, re-import keeps overrides), and slugs (see-der / see-die, essen-verb / essen-das, maße-die / masse-die).
```

## Stage 6. Dictionary pages

```
Build dictionary pages from .cache/dictionary.sqlite at build time, for every ready locale:
- /dictionary/ and /ru/dictionary/: list grouped by level, filter by level and part of speech (small Svelte island), article color coding for der/die/das.
- /dictionary/<id>/ and /ru/dictionary/<id>/: article, plural, glosses in the page locale (fallback to English with a "no translation yet" hint), examples with translations, audio placeholder, Austrian variant badge, links to topics using the word.
- <Word id> MDX component linking to the entry in the same locale, with article and gloss on hover/focus.
- /about/sources/ in both locales with Wiktionary attribution (English and Russian editions, CC BY-SA 4.0) and grammar references.
No DB code in the client bundle. Add the static file count to the CI budget step. E2E on the preview deployment: entries with ä, ö, ü, ß in the URL open correctly.
```

## Stage 7. Home, levels, search, SEO, legal pages, analytics

```
Build, for every ready locale:
- Home page: short intro, level cards (A1, A2 available; B1–C1 coming soon with planned topic titles), link to the dictionary.
- Level pages /a1/ and /a2/: topics by category with summary and reading time. Coming-soon pages for B1, B2, C1 with planned topics, noindex.
- Pagefind: one index per ready locale, topics and dictionary; UI loaded only when search is opened (button or Cmd/Ctrl+K). German words must be findable from any locale.
- SEO: unique titles and descriptions per locale, canonical URLs, hreflang, sitemap with alternates, Open Graph with og:locale, structured data where it makes sense.
- Legal pages from CLAUDE.md "Legal pages (Austria)": /impressum/ and /privacy/ in both locales, footer links, TODO placeholders for me to fill in.
- /about/ with an accessibility statement (WCAG 2.2 AA target, the 2.5.7 exception for word order).
- Analytics: Cloudflare Web Analytics beacon with `defer`, token from src/config/site.ts, only on production builds (not on previews or in dev), mentioned in /privacy/. Add an e2e check that preview builds contain no beacon.
Add e2e tests on English pages for navigation and search (including finding a German word), and axe checks for all new page types. Extend the language-switching tests to the new page types (picker keeps the page, hreflang present).
```

## Stage 8. Content: 10 topics

Do 2–3 topics per session. After each batch: read the English pages and move them to `reviewed`; send the English pages (German content + English explanation) to the teacher, who moves them to `verified`; compare the Russian explanations with the English ones yourself and mark the translations `reviewed`.

- A1: Personal pronouns and sein/haben · Present tense of regular verbs · Articles and gender (der/die/das) · Word order: verb in position 2 and questions · Negation: nicht and kein
- A2: Perfekt: haben or sein (already done) · Dative case · Two-way prepositions (Wechselpräpositionen) · Subordinate clauses with weil, dass, wenn · Comparative and superlative

```
Read CLAUDE.md, sections "Content model", "Exercise rules" and "Content rules". Write the topics: <LIST 2–3 TOPICS>.
For each topic: meta.yaml with sources; german.yaml with 4–6 examples, 10+ choice items, 6+ word-order items, Austrian notes only for real established differences; en.mdx first (In short, rule explanation, rule table, <Example> references), then ru.mdx from its meaning in simple Russian; i18n/en.yaml and i18n/ru.yaml with all translations and why texts. Link words with <Word id> when they exist in the dictionary. Everything draft; run review:sync.
At the end, list: (1) German sentences you are not fully sure about, (2) Austrian notes and your confidence, (3) items that might have more than one correct answer or order, (4) places where ru might differ in meaning from en.
```

## Stage 9. Launch preparation

```
Prepare the pilot for launch:
- Lighthouse on home, level, topic and dictionary pages, en and ru, mobile and desktop; fix anything below 95; report JS sizes per page type.
- 404 page per locale (served by Cloudflare's nearest 404.html).
- docs/adding-a-language.md: exact steps (locales.ts entry with ready: false, dir and font, UI strings, i18n-coverage, explanations and i18n files, dictionary glosses, language check allowlist, review, switching ready: true).
- Check docs/decisions.md and CLAUDE.md are up to date with everything built.
- README: production URL, badges for CI and licenses.
```

---

## Manual checks before launch

- Read every English page and move it to `reviewed`; the teacher checks every English page (German + explanation) for `verified`; you review every Russian translation against the English page.
- Fill in `/impressum/` and `/privacy/` and compare them with the WKO or USP templates (this is not legal advice).
- Verify the domain in Google Search Console via a DNS record in Cloudflare and submit the sitemap.
- Test the exercises on a real iPhone and Android phone via the preview URL.
- Mark the CI checks as required in the rules for `main`.
- Agree with the teacher: they verify German content and the English explanation of each topic, and any text they write is contributed under CC BY-SA 4.0.
- Check licenses: Wiktionary (CC BY-SA 4.0, both editions), and Wikimedia Commons audio if you decide to use it.
