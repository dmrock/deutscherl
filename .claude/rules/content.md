---
paths:
  - "src/content/topics/**"
  - "src/components/content/**"
  - "src/content.config.ts"
  - "src/lib/content-schemas.ts"
  - "scripts/validate-content.ts"
  - "scripts/i18n-coverage.ts"
  - "scripts/lib/**"
  - "tests/fixtures/**"
---

# Topic content

## Writing content

German correctness cannot be assumed, neither the maintainers' nor yours. German content counts as correct only after a teacher has verified it, so everything you write stays `draft`, and you name every sentence you are unsure about in your summary.

- Write the English explanation first: it is the canonical explanation the teacher verifies. Other locales are translated from its meaning (not word for word) and describe the same rule, exceptions and examples.
- Every topic lists `sources` (e.g. Duden grammar, Goethe-Institut / ÖSD level descriptions). Write your own text and examples: never copy from books, course material or other websites, and never copy Goethe/ÖSD word lists wholesale.
- Explanations: short sentences, no jargon without a one-line definition.
- Examples: natural, everyday German.
- Austrian notes only for real, established Austrian usage (reference: Österreichisches Wörterbuch), marked with `region: AT`. When unsure, leave the note out and name it in your summary (no TODOs in content).
- Russian explanations: simple, friendly Russian (informal "you"), grammar terms in Russian with the German term in parentheses the first time (e.g. the Russian term for "dative case" followed by "(Dativ)").

## Files of a topic (`src/content/topics/<level>/<slug>/`)

- `meta.yaml`: `level` (matches the folder), `category`, `order`, `sources` (`{title, url?}`, at least one; for review only, never shown on the site).
- `german.yaml`, the only place for German sentences, shared by all locales; ids unique across the file:
  - `examples`: `{ id, de, region?: AT }`; in `de`, `**…**` marks the key words the page highlights.
  - `choice`: `{ id, text (with ___), answer, options, alsoCorrect?: [{ value, region }] }`
  - `wordOrder`: `{ id, parts, fixed?, accept?, punctuation }`
  - `austrianNotes`: `{ id, de }`
- `<locale>.mdx`: frontmatter `title` and `summary` (the "In short" box, also the meta description and the level-page card). The body references German content by id and never contains German example sentences.
- `i18n/<locale>.yaml`: `examples.<id>`, `choice.<id>.why`, `wordOrder.<id>.translation`, `wordOrder.<id>.why`, `austrianNotes.<id>`. Optional in the schema, so a locale that is not ready can be translated step by step; `i18n-coverage` requires every field for ready locales.
- `review.yaml`: written only by `scripts/review.ts` (see `.claude/rules/review.md`).
- In native-language text (`summary`, why texts), `*word*` marks a German word: rendered bold with `lang="de"`, stripped for meta tags. No native-language text in `german.yaml`.

## MDX components

The topic page passes them; MDX files import nothing.

- `<Examples>` around one or more `<Example id="e1" />`: a card with one cell per example (German, translation); two columns when the card is at least 40rem wide.
- `<AustrianNote id="at1">explanation in the locale</AustrianNote>`: flag + "In Austria", the children, then the German sentence and its translation.
- `<RuleTable>` + blank line + a GFM table + blank line. `<RuleTable equal>`: full width, equal columns. `<RuleTable wide>`: full width, columns sized by content, cells never wrap (scrolls on narrow screens); for tables with more than two columns.
- `<De>haben</De>` for German words in explanation text (`lang="de"`, bold). `<De plain>` for text that is German throughout (cells of a forms table), with `**…**` inside for what to notice.

## Lesson formatting

- German words in native-language text are bold (`<De>`, `*word*`), never italic.
- A rule with several meanings or cases: one paragraph per case, starting with a bold lead-in (`**1. Leave something somewhere.**`), then its `<Examples>`. Two examples per case fill one row of the card; an odd last example spans both columns.
- Tables have short cells. A small table is as wide as its content; a forms table uses the full width (`equal` or `wide`) and spells every form out instead of combining forms in one cell.
- Examples under a two-column rule table mirror it: `<RuleTable equal>`, then one example per table cell in reading order (left, right, next row), so each example sits under its column. Every case in the table gets an example.
- Article forms of a case: `<RuleTable wide>` with columns masculine | feminine | neuter | plural and one row per article type in the order definite, indefinite, `kein`, `mein`, without a label column (each cell starts with its base form); never several genders or article types in one cell. Each cell shows the basic (nominative) form before the case form, `<De plain>der → **den**</De>`; forms that change are bold, unchanged ones too are shown (`die → die`); a noun ending goes after `…` (`**den** …**n**`, `**des** …**(e)s**`); `–` where a form does not exist. No extra legend: the section heading or text names the case.
- Verb forms: a two-column table, singular | plural, rows `ich`/`wir`, `du`/`ihr`, `er / sie / es`/`sie / Sie`; each cell `<De plain>pronoun form</De>`, irregular forms in `**…**` (`<De plain>du **lässt**</De>`). Headers in the locale.

## Exercise items

- At least 10 choice items and, where it makes sense, at least 6 word-order items per topic. Every item has `why` (word order also `translation`) in every ready locale.
- Choice: 2–4 options, 4 when the topic allows (e.g. two forms of each of two words). Exactly one correct answer; every other option is clearly wrong for the sentence. Exception: regional variants in `alsoCorrect` (e.g. `bin` with `region: AT` for "Ich ___ gesessen"), accepted as correct with a `why` that explains the difference; use them only when the topic is about that difference.
- Word order:
  - `parts` is the canonical order; `accept` lists every other valid full order. `fixed` locks the first part and may be combined with `accept`; it does not make the answer unique by itself.
  - Parts are in neutral case: a sentence-initial word is lowercase unless it is always capitalized (nouns, names, formal "Sie"). The UI shows parts as stored and capitalizes the first word only after checking.
  - Checking compares sequences of strings, so duplicate words ("die … die") work.
  - Punctuation (`.`, `?`, `!`) belongs to the item, shown after the answer line, never a chip.

## Validation

Per-file shapes are Zod schemas in `src/lib/content-schemas.ts` (shared by `content.config.ts` and the scripts). Everything across files is in `scripts/validate-content.ts` (`pnpm validate`, run in CI and before `astro build`): schemas, folder level, unique ids, choice (one `___`, answer and `alsoCorrect` in options), word order (`accept` orders are distinct permutations of `parts` that start with the fixed part; neutral case via a list of closed-class words such as `Ich`, `Gestern`), MDX and i18n ids exist in `german.yaml`, coverage of ready locales, at least 10 choice items, `review.yaml` in sync.
