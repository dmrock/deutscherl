# Contributing

Thank you for helping! This project is small and run by one person, so a few rules keep it manageable.

## Issue first, then a pull request

1. **Open an issue first** and describe what you want to change. Use one of the [issue forms](https://github.com/dmrock/deutscherl/issues/new/choose); ideas and questions go to [Discussions](https://github.com/dmrock/deutscherl/discussions).
2. Wait until we agree on the change in the issue.
3. Pull requests are limited to collaborators. Once we have agreed on the work in an issue, you are added as a collaborator and can open a pull request that links the issue.

Pull requests without an agreed issue may be closed. The only exception is a one-line typo fix.

## Sign off your commits (DCO)

Every commit needs a `Signed-off-by` line ([Developer Certificate of Origin](https://developercertificate.org/)). CI checks this.

```sh
git commit -s -m "fix: correct the article in example e3"
```

Forgot it? `git rebase --signoff main` and push again with `--force-with-lease`.

By signing off you confirm that you have the right to submit the work and agree that it is published under the project's licenses: [MIT](LICENSE) for code and [CC BY-SA 4.0](LICENSE-CONTENT) for content (explanations, examples, exercises, translations, dictionary data).

## Language of the repository

Everything is written in **English**: code, comments, docs, commit messages, branch names, pull requests, issues and test names.

Native-language text (for example Russian) is allowed only in localization files:

- `src/i18n/ui/<locale>.ts` (UI strings)
- `src/i18n/locales.ts`, only the `name` field (the language name in its own language)
- `src/content/topics/**/<locale>.mdx` and `src/content/topics/**/i18n/<locale>.yaml`
- dictionary glosses and translations in `db/data/words.jsonl` and `db/overrides/*.yaml`
- test fixtures under `tests/fixtures/i18n/<locale>/`

German letters (ä ö ü ß) are fine everywhere. `pnpm check:language` checks this in the pre-commit hook and in CI.

## Content rules in short

- German sentences live only in `german.yaml`; they are never duplicated in explanation or translation files.
- The English explanation is the canonical one; other languages translate its meaning.
- Explanations: short sentences, simple words, a one-line definition for every grammar term.
- Examples: natural, everyday German. Austrian notes only for established Austrian usage (reference: Österreichisches Wörterbuch).
- Name your sources in the issue or pull request. Do not copy text from books or other websites.
- **Never change the review status in a pull request.** Do not edit `review.yaml` by hand and do not mark anything as reviewed or verified. The tooling resets changed content to `draft` automatically, and only the maintainer and the reviewing teacher change the status.

## Development

See [README.md](README.md#run-it-locally) for setup. Before you push:

```sh
pnpm lint && pnpm check && pnpm test
pnpm build && pnpm test:e2e
```

The pre-commit hook (installed by `pnpm install`) formats staged files and runs the language check.

## Proposing a new native language

1. Open an issue with the **Translation** form. Tell us the language, its writing direction and your fluency. Every translation needs a fluent speaker to review it.
2. After we agree, the language is added to `src/i18n/locales.ts` with `ready: false`: it is built for previews but hidden from visitors and search engines.
3. Translate the UI strings (`src/i18n/ui/<locale>.ts`), then the topics (`<locale>.mdx` and `i18n/<locale>.yaml`), always from the English version.
4. When every page is translated and reviewed, the maintainer switches the language to `ready: true`.

## Code of Conduct

Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
