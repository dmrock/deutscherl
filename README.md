# Deutscherl

A free website for learning German grammar. Each topic has a short explanation in your native language, examples in German with translations, and exercises to practice.

- Levels A1 and A2 first; B1, B2 and C1 will follow.
- Native languages: English and Russian, with more to come.
- Notes on Austrian German where usage differs from Germany.
- No accounts, no cookies, no tracking.

Production: https://deutscherl.com (not launched yet)

## Run it locally

Requirements: [Node.js](https://nodejs.org/) LTS (the version in `.nvmrc`) and [pnpm](https://pnpm.io/) (the version in `package.json` → `packageManager`; `corepack enable pnpm` sets it up).

```sh
nvm use                # or install the Node version from .nvmrc another way
corepack enable pnpm
pnpm install           # also installs the git hooks (lefthook)
pnpm dev               # http://localhost:4321
```

Other commands:

| Command | What it does |
|---|---|
| `pnpm build` | Validates the content, then builds the static site into `dist/` |
| `pnpm preview` | Serves `dist/` locally |
| `pnpm check` | Type check (`astro check`) |
| `pnpm lint` | Biome (TS/JS/JSON/CSS) and Prettier (`.astro`, `.svelte`) |
| `pnpm format` | Fixes formatting and lint issues where possible |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm test:e2e` | End-to-end tests (Playwright) on the built site; run `pnpm build` first, and `pnpm exec playwright install chromium` once |
| `pnpm check:language` | Checks that native-language text appears only in localization files |
| `pnpm validate` | Checks the topic content across files (ids, exercises, translations, review state) |
| `pnpm i18n:coverage` | Lists missing translation files and keys per language |
| `pnpm review:sync` | Updates `review.yaml` after content changes (the git hook runs it for you) |
| `pnpm review:status` | Shows the review status of every topic and its translations |

## Licenses

- **Code** (everything that is not content): [MIT](LICENSE).
- **Content** (explanations, examples, exercises, translations and dictionary data, for example `src/content/`, `src/i18n/ui/`, `db/data/`, `db/overrides/`): [CC BY-SA 4.0](LICENSE-CONTENT). Dictionary data derived from Wiktionary is CC BY-SA 4.0 as well.

## Report a mistake

Found a mistake in the German, an explanation or a translation? Use the **Report a mistake** link on the page; it opens a [GitHub issue form](https://github.com/dmrock/deutscherl/issues/new?template=report-mistake.yml) with the page already filled in. You need a GitHub account. Ideas and questions go to [Discussions](https://github.com/dmrock/deutscherl/discussions).

The form fields can be prefilled with query parameters (`page-url`, `locale`, `item-id`), for example:

```
https://github.com/dmrock/deutscherl/issues/new?template=report-mistake.yml&page-url=https%3A%2F%2Fdeutscherl.com%2Fa2%2Fperfekt%2F&locale=en&item-id=c3
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). In short: open an issue first, sign off your commits (`git commit -s`), and write everything in English except localization files.
