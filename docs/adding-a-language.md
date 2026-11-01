# Adding a native language

A native language (locale) is the language of the UI, the explanations and the translations. German is the language being learned and is never a locale. Everything language-specific is data, so a new locale needs no changes to components, pages or scripts.

The steps below use `xx` as the locale code. Start with an issue from the **Translation** form (see [CONTRIBUTING.md](../CONTRIBUTING.md#proposing-a-new-native-language)): every translation needs a fluent speaker who reviews it.

## 1. Add the locale with `ready: false`

Add an entry to `locales` in [`src/i18n/locales.ts`](../src/i18n/locales.ts):

```ts
{
  code: 'xx',              // URL prefix: /xx/a2/perfekt/
  name: '…',               // the language name in its own language, shown in the language picker
  default: false,
  ready: false,            // built for previews, hidden from visitors and search engines
  dir: 'ltr',              // or 'rtl'
  ogLocale: 'xx_XX',       // Open Graph locale, language_TERRITORY
  font: {
    family: '…',
    package: '@fontsource-variable/…',
    subsets: ['…', 'latin'],
    preload: ['…', 'latin'],
  },
},
```

What `ready: false` does:

- Every page is built at `/xx/…`, with `noindex` (`Base.astro`).
- The locale is not in the language picker, `hreflang`, `og:locale:alternate` or the sitemap (all read `readyLocales`), and Pagefind does not index its pages (`data-pagefind-body` only for ready locales).
- Content checks report its gaps as information only (`pnpm i18n:coverage`, `pnpm validate`).
- The about and legal pages show the English text until `src/content/pages/<page>/xx.mdx` exists (`src/lib/pages.ts`).
- A topic without `xx.mdx` has no page in this locale and is left out of its navigation (`src/lib/topics.ts`); the same goes for reference pages (`src/lib/reference.ts`).

The 404 page (`/xx/404.html`) and the language check's allowlist (step 5) follow from the entry automatically.

`name` is the only line in `locales.ts` that may contain non-Latin letters; the language check allows it on `name:` lines only.

## 2. Font

Each locale has its own font; German content blocks keep the German font on every locale (`.claude/rules/fonts.md`).

1. Pick a Fontsource variable font that covers the script. For a script without a good match (Arabic, Hindi, …) look further rather than using a Latin font with system fallbacks.
2. Compare candidates on a temporary page in the pull request: body and example size, light and dark theme, next to German blocks. Choose on the preview, then remove the page.
3. Install only the chosen package: `pnpm add @fontsource-variable/<name>`. Before adding it, check its page on fontsource.org and npm (license, subsets). pnpm's minimum release age applies.
4. Set `subsets` to the subsets the locale needs (only these get `@font-face` rules) and `preload` to the ones every page uses right away. Punctuation, digits and German terms are in the `latin` subset, so most locales need it in both lists.

`src/config/fonts.ts` builds the `@font-face` rules from this entry; `tests/unit/fonts.test.ts` checks that every locale font is installed and registered once.

## 3. UI strings

1. Copy `src/i18n/ui/en.ts` to `src/i18n/ui/xx.ts`, rename the export to `xx` and end the object with `satisfies UiStrings` (like `ru.ts`). A missing key is a type error (`pnpm check`).
2. Register it in [`src/i18n/ui/index.ts`](../src/i18n/ui/index.ts): import it and add it to the `ui` record. The record is typed `Record<LocaleCode, UiStrings>`, so the build fails until it is there.
3. Translate every string. Keep the `{placeholders}` as they are. Translate from the meaning, not word for word.

Every key must exist even while the locale is not ready; strings not translated yet can stay in English for the preview.

## 4. Site pages, topics and reference pages

Translate from the English files; the English explanation is the canonical one.

- Site pages: `src/content/pages/about/xx.mdx` and `src/content/pages/legal/xx.mdx` (frontmatter `title` and `description`; `.claude/rules/site-pages.md`).
- Each topic in `src/content/topics/<level>/<slug>/`:
  - `xx.mdx`: frontmatter `title` and `summary`, then the explanation. It references German content by id (`<Example id="e1" />`) and never contains German example sentences.
  - `i18n/xx.yaml`: translations of the examples and Austrian notes, the `why` of every choice item, `translation` and `why` of every word-order item.
  - `german.yaml` is shared by all locales: never copy or change German sentences for a translation.
- Each reference page in `src/content/reference/<slug>/`: `xx.mdx` and `i18n/xx.yaml` as for a topic, without practice items, plus `columns` (the table column labels) and `glosses` (the meaning of each table row) in `i18n/xx.yaml` (`.claude/rules/reference.md`).
- `.claude/rules/content.md` has the file formats and the writing rules.

Check progress with:

```sh
pnpm i18n:coverage
```

It lists every missing file and key per topic, reference page and site page. For a locale that is not ready the gaps are marked `info (not ready)` and do not fail.

## 5. Language check

Nothing to edit. `scripts/check-language.ts` builds its allowlist from the locale codes in `locales.ts`: once `xx` is there, native-language text is allowed in `src/i18n/ui/xx.ts`, `src/content/topics/**/xx.mdx`, `src/content/topics/**/i18n/xx.yaml`, `src/content/reference/<slug>/xx.mdx`, `src/content/reference/<slug>/i18n/xx.yaml`, `src/content/pages/<page>/xx.mdx` and `tests/fixtures/i18n/xx/`. Everything else stays English. Run it with:

```sh
pnpm check:language
```

## 6. Preview

Open a pull request: CI builds a preview at `pr-<number>-deutscherl.<subdomain>.workers.dev`. Check on the preview, at phone and desktop width:

- the home, level, topic, reference, about, legal and 404 pages under `/xx/`;
- long strings: headers, buttons, the previous/next topic cards and the practice card must not break (translations are often longer than English);
- for `dir: 'rtl'`: the page mirrors (sidebar, tables and their sticky first column, the word-order line and the word bank, the progress dots), German blocks stay left-to-right (`lang="de"`);
- search (Pagefind takes its UI language and stemming from `<html lang>`) once the locale is ready, since only ready locales are indexed.

## 7. Review

The pre-commit hook runs `pnpm review:sync`, which adds `translations.xx` (status `draft`) to the `review.yaml` of each topic and reference page as soon as it has an `xx` file. Never edit `review.yaml` by hand.

A fluent speaker reads each translated topic against the English page. A maintainer then records it:

```sh
pnpm review:set <level>/<slug> xx reviewed --by "Name"
pnpm review:set reference/<slug> xx reviewed --by "Name"
```

`pnpm review:status` shows the state of every topic. The topic page shows "Translation reviewed" or "Translation not reviewed yet" (`.claude/rules/review.md`).

## 8. Switch to `ready: true`

When every topic, reference page and site page is translated (and, ideally, reviewed):

1. Set `ready: true` in `locales.ts`.
2. Run the checks; for a ready locale they fail on gaps:

   ```sh
   pnpm validate
   pnpm i18n:coverage
   pnpm check
   pnpm test
   pnpm build
   pnpm test:e2e
   ```

3. After the build, the locale is in the language picker, `hreflang`, the sitemap and the search index, and its pages lose `noindex`.
4. Pagefind adds an index for the language. Cloudflare's free plan allows 20,000 static files per deployment: check the file count of `dist/`.
5. Add the language to the README.
