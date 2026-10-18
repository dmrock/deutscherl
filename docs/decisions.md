# Decision log

One line per decision: what was decided and why. The rules themselves live in `CLAUDE.md`; this list keeps the reasons, so they survive `/clear`. IDs never change (CLAUDE.md and code comments refer to them). Longer write-ups of #1–#62 are in the git history of this file.

Marks: **owner** = the owner's call; **pending** = waiting for the owner; ~~struck~~ = superseded.

## Architecture and hosting

- **#1** Astro with Svelte islands: static pages, zero JS by default, small islands. Rejected: Next.js (React runtime everywhere), SvelteKit.
- **#2** Cloudflare Workers static assets: free plan allows commercial use (sponsor banners), fast CDN. Rejected: Vercel Hobby (non-commercial).
- **#3** Deploy from GitHub Actions with Wrangler: checks first, one build, nothing broken deploys. Rejected: Cloudflare Git integration.
- **#17** Trailing-slash URLs (`build.format: 'directory'`): match Cloudflare's default HTML handling.
- **#29** Pure i18n helpers and one `[...locale]` route per page: a new locale needs no page files; `PUBLIC_DEPLOY_ENV` via `astro:env`, so a typo fails the build.
- **#30** CI: parallel checks, one build, e2e on the build output, deploys need every check.
- **#31** DCO check as a shell step in the workflow. Rejected: DCO app, third-party actions (more access for 10 lines of shell).
- **#32** Wrangler: custom domain only, `workers_dev: false`, preview URLs on. Open: redirect `www` to the apex.
- **#33** **owner** First deploy bootstrapped from CI without routes, so the domain is attached only by the first production deploy.
- **#54** "Content checks" CI job (validate, i18n coverage, review check): fast, clearly named failure; a required check.
- **#86** Sitemap from `@astrojs/sitemap` (alternates from the locale prefixes), noindex pages filtered out by `inSitemap`; `robots.txt` allows everything, because a crawler blocked by robots.txt never sees `noindex`.
- **#87** **owner** Cloudflare injects the Web Analytics beacon on the production domain (automatic setup); the build adds none and holds no token, so there is nothing to configure in the repository or CI, and previews (workers.dev) are not counted. Rejected: a beacon in `Base.astro` with the token in `site.ts` or a GitHub Actions variable.

## Languages and fonts

- **#4** **owner** English (default, unprefixed) and Russian; locales are data in one config, so more can be added without code changes.
- **#5** German single-sourced in `german.yaml`, translations per locale: translators never touch German, and translations never reset German verification.
- **#6** Per-locale fonts: Atkinson Hyperlegible Next has no Cyrillic; German blocks always use Atkinson.
- **#7** **owner** Russian font Golos Text: made for Russian interfaces, `I`/`l`/`1` distinct. Rejected: Inter and Onest (`I` = `l`), Noto Sans (close second).
- **#19** **owner** Repository in English except localization files, enforced by `check-language.ts`.
- **#27** Language check by Unicode script, not a list: every non-Latin script is caught, German umlauts always pass.
- **#34** Fonts via Astro's Fonts API with a small provider over the installed Fontsource packages: only needed subsets, preloads, fallback metrics, no network at build.
- ~~**#37** Server-rendered language hints~~ → #44.
- ~~**#38** Font specimen page~~ → #43.
- **#43** **owner** Font specimen page removed after the choice; quick to rebuild for a new locale.
- **#44** **owner** No language hint and no stored locale: `hreflang` and the always-visible picker are enough.
- **#88** `ogLocale` per locale in `locales.ts` (`og:locale` needs language_TERRITORY); structured data: `WebSite`, `BreadcrumbList`, `LearningResource` (topics). No social image yet.

## Design and UX

- **#11** `svelte-dnd-action` for drag and drop: touch delay, keyboard and screen-reader support. Rejected: hand-rolled pointer events, SortableJS (no keyboard).
- ~~**#12** **owner** WCAG 2.5.7 exception for word order~~ → #76.
- **#13** Regional answers (`alsoCorrect` with `region`) accepted with an explanation, e.g. Austrian "bin gesessen".
- **#14** Word order: parts in neutral case, `accept` lists all valid orders, compared as strings (no capitalization hints, duplicates work).
- **#15** Minimal JS: theme and language picker are inline vanilla JS; JS budgets in CI (3 KB without islands, 45 KB with). Rejected: `<ClientRouter />`. (Page transitions → #47.)
- **#35** Theme via `data-theme` and semantic color tokens; softened dark palette and grayscale antialiasing so text does not glow. Rejected: `light-dark()` (breaks older Safari), `dark:` classes everywhere.
- **#36** Zero-JS header widgets: the sidebar sheet uses the Popover API, the language picker is `<details>`.
- **#42** **owner** Level switcher shows B1–C1 muted without a visible "soon" (screen readers still get it).
- **#45** **owner** Visual design "Paper": cream background, teal accent, soft cards, system serif headings (no font download). Rejected: Clean, Friendly, Austria.
- ~~**#46** Component sample page~~ → #47.
- **#47** **owner** Static navigation, no page transitions: header and sidebar stay in place (`scrollbar-gutter: stable`, exact 3rem header), checked by an e2e test.
- **#55** Extra badge "Translation not reviewed yet" when only the German is verified, so the German badge is not read as covering the whole page.
- ~~**#57** Hide-translation toggle and Web Speech audio~~ → #61, #62.
- **#61** **owner** Simpler topic page: no browser-voice audio (sounded bad), no "min read", no "Read in English" link; body text 15px, German examples 16px, full-width content, less padding.
- **#62** **owner** No "Hide translation" toggle: examples illustrate the rule, self-testing is the exercises' job.
- **#63** **pending** (owner: Azure account) Audio from pre-generated Azure AI Speech files with the Austrian voices `de-AT-IngridNeural` / `de-AT-JonasNeural` (stage 4b). The paid S0 tier is required to publish the output (the free tier is not licensed for commercial use); about $16 per 1M characters, cents for the pilot; label it as a computer-generated voice. Rejected for now: human recordings (best, but slow; can replace files later), Wikimedia Commons (mostly single words).
- **#64** Rounds of 3 choice + 2 word-order items, a missing kind filled with the other; seen ids are stored when a round starts, and an exhausted pool keeps its last unseen items before starting over, so nothing is skipped.
- **#65** The round is picked in the browser; the server renders a placeholder plus a `<noscript>` note. Rejected: a server-rendered first round (random on every visit, so hydration would replace it).
- **#66** One click answers a choice item (no confirm button); focus moves to the feedback, then to the next question, so keyboard and screen-reader users follow the round.
- **#67** Word order: a `fixed` part is a locked chip outside the drag zones; the bank is reshuffled when it starts in a valid order; wrong positions and the shown solution use the valid order closest to the answer, so a near-miss of an `accept` order is not judged against `parts`.
- **#68** The report link opens in a new tab, so the round is not lost; the issue title carries the page path and item id for triage.
- **#71** **owner** "Report a mistake" in the feedback is a small flag icon at the end of the header with a tooltip, not a text link: it should not compete with the explanation.
- **#72** **owner** (request) No layout jumps when answering: fixed-width gap and corner badges, a box that only grows, focus without scroll plus smooth `nearest` scrolling, fade-in. Rejected: reserving the feedback's space up front (its height depends on the explanation).
- **#73** **owner** The result screen lists every answer of the round (the learner's sentence, the correct one when wrong) instead of only coloured dots.
- **#74** **owner** "Start practice" button: the practice section then fills the screen below the header and is scrolled to the top once, so answers grow inside reserved space and the page no longer moves (#72 alone still scrolled when feedback opened below the fold). The round is picked on Start, so the first paint never changes on hydration.
- ~~**#75** **owner** Sources moved below the practice section~~ → #78.
- **#76** **owner** Word order: a tap or click (Enter on the keyboard) moves a word to the end of the sentence or back to the bank; dragging stays for reordering. This is the single-pointer alternative, so WCAG 2.5.7 is met and the exception #12 is gone. Space alone starts the library's keyboard drag.
- **#77** **owner** (request: no big empty gap) The screen-high reserve moved from the practice card to a wrapper around it: the card fits its content, the spare room is below it at the end of the page, and the wrapper never shrinks during a visit, so the page still does not move.
- **#78** **owner** No sources block on topic pages: it keeps the page clean and playful, and learners do not use it. `sources` stays required in `meta.yaml` for review. (A `/about/sources/` page was planned → #95.)
- **#79** **owner** Choice items get 4 options: 2 forms of *haben* and 2 of *sein* (the right person plus another person), so guessing drops from 50% to 25% and the person form is practised too; the why texts name the right form. Distractors must be clearly wrong for the subject.
- **#80** **owner** No intro sentence in the practice card: the heading, the Start button and "Question 1 of 5" say it already.
- **#81** **owner** No visible "Question 3 of 5": the dots show progress. The text stays as the dots' accessible name (`role="img"`), and the dots are where focus goes after "Next".
- **#82** **owner** Links back to the explanation: a quiet "↑ Explanation" in the practice card header while a round runs, and "Back to the explanation" next to "Try again". Plain in-page links to `#explanation`, so the round is kept. Rejected for now: linking each wrong answer to its rule section (needs a section tag per item).
- **#84** Search: Pagefind Component UI, loaded by a small inline script on the first click or Cmd/Ctrl+K and opened as its modal. Pages load no search code, so the 3 KB budget holds (opening search loads about 130 KB, mostly the WASM). Pagefind's own translations from `<html lang>`. Rejected: the legacy Default UI, an own UI over the JS API (more code to maintain).
- **#85** Only topic pages of ready locales are indexed (`data-pagefind-body`); German examples are on every locale's page, so a German word is found from any locale without a separate German index.
- **#89** **owner** (request) Footer across the whole page width, under the sidebar too (a top-level `contentinfo` landmark): About, legal page, source code, licenses. The body is a column that fills the screen, so short pages still do not scroll (#47); the sidebar is as tall as its topics (at most the screen) and the divider is the content column's border.
- **#95** **owner** No sources page: learners do not need it. `sources` stays in `meta.yaml` for review only. Rejected: an `/about/sources/` page.
- **#90** Home page level cards list each level's topics, or its planned topics under "Coming soon"; level pages show the reading time (kept off topic pages, #61).

## Content and review

- ~~**#8** Page-level review~~ → #20.
- **#20** **owner** Split review: a teacher verifies German + English (`base`), a fluent speaker reviews each translation against English; scopes are hashed and reset automatically. Rejected: one teacher badge on translated pages (misleading), English-only launch.
- **#39** A minimal content collection already in stage 2, so navigation used real topic data.
- **#48** Content schemas shared by Astro and the scripts (`src/lib/content-schemas.ts`); `yaml` parses YAML in scripts (build only, never shipped).
- **#49** Validation rules in `validate-content.ts` (list in CLAUDE.md), run before every build. Neutral case is checked with a list of closed-class words, because nouns cannot be detected without a dictionary.
- **#50** Translation keys are optional in the schema and required by `i18n-coverage` for ready locales, so a new locale can be translated step by step.
- **#51** Review hashes over normalized content (YAML as sorted JSON, MDX with normalized whitespace): formatting and comments do not reset a review.
- **#52** Review sync: draft → draft adds no history; an outdated translation keeps its old `basedOn` (stays listed as outdated); `review:minor base` moves `basedOn` along; the hook hashes the working tree, CI checks the commit.
- **#53** `review:set` for status changes, owner only: nobody edits `review.yaml` by hand.
- **#56** Content components are passed by the topic page (MDX needs no imports) and find their topic from the page URL; `**…**` highlights German key words, `*…*` marks German words in native text.
- **#59** First topic A2 "Perfekt: haben or sein?", draft. The Austrian note says "usually": in Austria `sein` is the majority form for sitzen/liegen/stehen, but `haben` is used too (Variantengrammatik).
- **#91** Site pages (about, legal) are MDX in `src/content/pages/<slug>/<locale>.mdx`, an allowed localization path; `i18n-coverage` requires them for ready locales, and a locale that is not ready shows the English text. Rejected: long UI strings.
- **#92** Audio paragraphs on /about/ and /legal/ are written but shown only once `site.audio` is true (stage 4b), so the pages never describe audio that does not exist.
- **#96** **owner** One short legal page, "Legal notice and privacy" (`/legal/`): the Offenlegung (name, town, email, purpose) and a few plain privacy paragraphs instead of two long templates with open legal questions. No postal address (the Mediengesetz asks for the place of residence); a commercial site may need one later (§ 5 ECG). Rejected: separate `/impressum/` and `/privacy/` pages.
- **#98** **owner** Contact email `hallo@deutscherl.com` in `site.email` (shown with `<Email />`; also in CODE_OF_CONDUCT.md), forwarded to the owner by Cloudflare Email Routing (free, receive only), so the personal address is not on the site. Rejected: the owner's Gmail on the page (spam).
- **#99** **owner** Every page uses the full width of the main column, like topic pages (#61): no narrower text measure on the home intro, coming-soon, about and legal pages.
- **#100** **owner** German words in explanations, summaries and why texts are bold, not italic (`<De>`, `*word*`); `<De plain>` for cells that are German throughout.
- **#101** **owner** Example cards show two columns when the card is at least 40rem wide (container query), so short examples do not leave half the card empty; an odd last example spans both.
- **#102** **owner** Rule tables are as wide as their content; verb forms go in a compact singular | plural table with the irregular forms in bold.
- **#93** Planned topics for B1–C1 (`plannedTopics` in `site.ts`) are a draft list for the coming-soon pages; the owner may change them.

## Dictionary

- ~~**#9** Dictionary in text files, SQLite generated at build~~ → #83.
- ~~**#10** Word ids from lemma + article or part of speech~~ → #83.
- **#83** **owner** No dictionary: no Wiktionary import, no vocabulary database, no dictionary pages, no `<Word>` component. It would copy what Wiktionary, DWDS and Leo do better, add hundreds of entries nobody can verify, and does not serve the goal (grammar in the learner's language with exercises). Austrian vocabulary stays in the topics. The import pipeline was built in PR #7 and dropped before merging. Rejected: the full dictionary (stages 5–6), a smaller curated word list later.

## Testing

- **#21** **owner** No screenshot tests: flaky and constant updates; functional tests and axe catch real breakage.
- **#22** **owner** Functional tests on English pages only (same code everywhere); other locales get language-switching tests and the coverage check.
- **#40** JS budget counts everything a page loads (inline, local scripts, imported chunks), gzipped per file; pages with an island get the 45 KB budget.
- **#69** `?seed=` works only in non-production builds; exercise e2e tests steer rounds through the seen ids in `sessionStorage` instead, so they also run on production builds (only the seed test is skipped there).

## Tooling and dependencies

- **#16** Open source: code MIT, content CC BY-SA 4.0, DCO sign-off, PRs only from collaborators, issues via forms.
- **#97** **owner** Content stays CC BY-SA 4.0 after dropping the dictionary (no longer required by Wiktionary): adapted versions must stay open. Rejected: CC BY 4.0 (easier reuse, but closed copies allowed).
- **#18** **owner** Cloudflare Web Analytics (free, cookieless, production only). PostHog postponed: 24–98 KB of JS.
- **#23** **owner** Latest stable versions, except Node (current LTS, 24) and TypeScript 6 (Astro's tooling does not support 7 yet); pnpm's 1-day minimum release age is kept as a supply-chain safeguard.
- **#24** pnpm 12 pinned via `packageManager`; dependency build scripts denied by default (`allowBuilds`).
- **#25** Biome for TS/JS/JSON/CSS, Prettier only for `.astro`/`.svelte` (Biome's support for them is experimental).
- **#26** lefthook for git hooks: staged files, re-staging and ordering in one binary. Rejected: simple-git-hooks + lint-staged, husky.
- **#28** Scripts run on Node's built-in TypeScript support. Rejected: tsx.
- **#41** Stage 2 added the Fontsource font packages and `@axe-core/playwright`.
- **#58** Stage 3 bumped Biome to 2.5.15 and Wrangler to 4.147.0 and added `yaml` 2.9.1.
- **#60** **owner** The lockfile is committed exactly as pnpm writes it (including the `@pnpm/exe` entry the standalone pnpm records); both pnpm builds accept it, so it is never edited by hand.
- **#70** Stage 4 added `svelte-dnd-action` 0.9.79 (decision #11). Topic pages load 35.6 KB of gzipped JS (budget 45 KB): Svelte runtime 15.9 KB, exercise island with svelte-dnd-action 17.3 KB, island loader and inline scripts the rest.
- **#94** Stage 7 added `@astrojs/sitemap` 3.7.4 (build only, no client JS) and `pagefind` 1.5.2 (dev dependency, a CLI run after `astro build`; the browser loads its 39 KB UI + 7 KB CSS + 13 KB loader + 73 KB WASM, gzipped, only when search is opened). Static pages load at most 1.2 KB of JS, topic pages 37.8 KB.
