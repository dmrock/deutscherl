# Deutscherl

A free website for learning German grammar: explanations in the learner's native language, German examples with translations, interactive exercises. Working name; it lives only in `src/config/site.ts`.

- Pilot: levels A1 and A2 (7 and 6 topics, listed in `PLAN.md` stage 8); B1, B2 and C1 show as "coming soon".
- Native languages: English (default) and Russian. More will follow, possibly in other scripts or right to left, so everything language-specific is data, not code.
- Signature feature: notes on Austrian German (usage that differs from Germany).
- The site teaches grammar only: no dictionary or vocabulary database; Austrian vocabulary goes into the topics.
- No accounts, no progress tracking, no cookies, no ad trackers, no runtime API or database calls.
- Sponsor banners later: static, labeled as ads. The topic layout keeps a sponsor slot.

This file and `.claude/rules/` are the source of truth. `docs/architecture.html` is an illustrated snapshot and may lag behind.

## Commands

```sh
pnpm install            # also installs the git hooks (lefthook)
pnpm dev                # http://localhost:4321
pnpm build              # validate content, astro build, Pagefind index
pnpm lint               # Biome + Prettier (.astro, .svelte); pnpm format fixes
pnpm check              # astro check
pnpm test               # Vitest
pnpm test:e2e           # Playwright against dist/: run pnpm build first, stop astro dev first
pnpm validate           # cross-file content checks
pnpm i18n:coverage      # missing translations of ready locales
pnpm check:language     # native-language text outside localization files
pnpm review:status      # review state of every topic
pnpm budget             # JS budget per page (after a build)
```

## Working agreements

- Commit with sign-off: `git commit -s` (DCO is enforced in CI).
- Content you generate stays `draft` (base and translations). Never set `reviewed` or `verified`, never edit `review.yaml` by hand, and run `review:minor` or `review:set` only when asked to explicitly.
- If you are not sure a German sentence is correct, say so in your summary instead of guessing.
- Before adding a dependency, check its current docs (Context7 or the official site) and state its gzipped size and why it is needed, also in your summary.
- At the end of every stage, update this file or the matching file in `.claude/rules/` when a rule or the structure changed. There is no decision log: a decision that matters becomes a rule, and background that helps contributors goes into `README.md`.
- The repository is public. Commit messages, PR descriptions, docs and comments describe what the code does; they never mention who decided something or why someone asked for it.

## Repository language

Everything committed is in English: code, identifiers, comments, docs, templates, commit messages, branch names, PRs, script output, test names, `review.yaml` reasons and history.

Native-language text is allowed only in localization files:

- `src/i18n/ui/<locale>.ts` (UI strings)
- `src/i18n/locales.ts`, only the `name` field
- `src/content/topics/**/<locale>.mdx` and `src/content/topics/**/i18n/<locale>.yaml`
- `src/content/pages/<page>/<locale>.mdx`
- test fixtures under `tests/fixtures/i18n/<locale>/`

Components, pages and tests use `t(locale, key)` or read content files instead of inline native-language strings. German sentences belong in `german.yaml`, not in code. `scripts/check-language.ts` (CI and pre-commit) fails on non-Latin letters (Cyrillic, Greek, Arabic, CJK, …) in any other tracked file; German letters (ä ö ü ß) are allowed everywhere.

## Stack

- Astro (latest stable), fully static (`build.format: 'directory'`, `trailingSlash: 'always'`), no SSR adapter, no page transitions.
- Svelte 5 only for the exercise islands; `svelte-dnd-action` for drag and drop.
- TypeScript `strict`, 6.x until `astro check` supports TypeScript 7. Pure logic lives in `src/lib/` and is unit-tested.
- Scripts in `scripts/` run with plain `node` (built-in type stripping): erasable TypeScript only, local imports with the `.ts` extension, no tsx. They parse YAML with `yaml`.
- Tailwind CSS v4 with logical utilities only (`ms-`, `pe-`, `start-`, `text-start`, …), never left/right.
- Content: MDX explanations and YAML German content/translations in Astro content collections with Zod schemas (`src/lib/content-schemas.ts`).
- Astro i18n routing; Pagefind search; `@astrojs/sitemap`.
- Biome for TS/JS/JSON/CSS; Prettier only for `.astro` and `.svelte`. lefthook pre-commit: Biome, Prettier, language check, `review:sync`.
- Vitest, Playwright, @axe-core/playwright.
- pnpm (version in `package.json` → `packageManager`), dependency build scripts denied by default (`allowBuilds`), minimum release age kept as a supply-chain safeguard. The lockfile is committed exactly as pnpm writes it. Node LTS from `.nvmrc`.
- Latest stable versions of every dependency and GitHub Action (check npm / GitHub, not memory); exceptions: Node LTS and TypeScript 6.
- Hosting: Cloudflare Workers static assets, deployed from GitHub Actions with Wrangler. Analytics: Cloudflare Web Analytics, injected by Cloudflare, nothing in the build.

## Core principles

- Locales are defined once in `src/i18n/locales.ts`; adding a language needs no code changes elsewhere.
- German is single-sourced: each German sentence exists once in `german.yaml` and is shared by all locales; everything in a native language lives in per-locale files.
- Every German fragment on a page carries `lang="de"`.
- Zero JavaScript by default; islands hydrate with `client:visible` and get already-localized strings.
- WCAG 2.2 AA without exceptions.

## Open source

- Code MIT (`LICENSE`), content CC BY-SA 4.0 (`LICENSE-CONTENT`). Use the official license texts verbatim, never from memory.
- DCO sign-off on every commit, checked in CI; by signing off, contributors agree to both licenses.
- PRs only from collaborators; issues only through issue forms; ideas in GitHub Discussions. `CONTRIBUTING.md`: open an issue first (except one-line typo fixes).
- Never commit secrets. The only secrets are the Cloudflare API token and account ID, in GitHub Actions secrets/variables.
- Do not add the `hacktoberfest` topic or label.

## Detailed rules

Path-scoped files in `.claude/rules/` load when you work on matching files:

- `content.md`: writing topics, the content model, MDX components, lesson formatting, exercise items, validation
- `review.md`: review scopes, hashes, automatic reset, badges
- `exercises.md`: exercise runner, practice section, word-order UI
- `ui.md`: JS budgets, page types, layout, design tokens, accessibility
- `i18n.md`: locales, routing, language picker, SEO, search
- `fonts.md`: per-locale and German fonts
- `site-pages.md`: about and legal pages
- `testing.md`: what is tested where, e2e mechanics
- `deployment.md`: CI, Cloudflare deployment, analytics
