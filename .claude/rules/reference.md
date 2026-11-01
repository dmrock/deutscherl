---
paths:
  - "src/content/reference/**"
  - "src/components/content/GermanTable.astro"
  - "src/pages/**/reference/**"
  - "src/lib/reference.ts"
  - "src/components/layout/Sidebar.astro"
  - "src/components/layout/LevelSwitcher.astro"
---

# Reference pages

Pages to look things up while learning, for any level: the gender clues for nouns, the forms of irregular verbs. A reference page is a topic without a level and without practice, and most of its content is tables.

## Scope

Reference pages are curated grammar tables, not a dictionary:

- A row is there because a learner at the levels the site covers meets the word and cannot derive its form from a rule on the site.
- A table shows only the forms those levels teach (for verbs at A1/A2: the present tense where it changes, the Perfekt, the Präteritum only of `sein`, `haben`, `werden` and the modal verbs).
- No full inventories, no lookup of arbitrary words, no generated paradigms, no data imported from dictionaries or word lists.
- One page holds at most about 80 rows. Split long lists into tables by pattern (`a` → `ä`, `e` → `i`, Perfekt with `sein`), 20 rows or fewer each.

## Files (`src/content/reference/<slug>/`)

The same files as a topic (`.claude/rules/content.md`), with these differences:

- `meta.yaml`: `order` (position in the reference list), `levels` (e.g. `[a1, a2]`, shown under the title), `sources`. No `level` or `category`.
- `german.yaml`: `examples`, `austrianNotes` and `tables`; no `choice` or `wordOrder` (validation fails on them).
- `i18n/<locale>.yaml`: `examples`, `austrianNotes`, `columns.<column id>` (column labels, shared by all tables of the page) and `glosses.<row id>` (the meaning of each row of a `gloss` table). In both, `*word*` marks a German word.
- Slugs are German, like topic slugs: `genus`, `unregelmaessige-verben`. Review keys are `reference/<slug>`.

## Tables

- `german.yaml` `tables`: `{ id, columns: [column ids], gloss?: true, rows: [{ id, cells: [one per column], variants?: [{ column, de, region: AT }] }] }`. Row ids are unique across the page (they key the glosses). In cells, `**…**` marks what to notice, e.g. `**ist** gefahren` for the Perfekt with `sein`. No partial-word bold: screen readers split the word.
- Every table with German cells comes from `german.yaml`, so a long table exists once for all locales. `<De>` stays for single words in running text.
- `<GermanTable id="…">caption in the locale</GermanTable>` renders it (`GermanTable.astro`): a real table with `<caption>`, column headers, the first column as row headers, a last "Meaning" column for `gloss` tables. German text is in `lang="de"` spans; labels, meanings and the screen-reader label of a regional variant are in the page locale.
- Layout (`global.css`, `.german-table`): full width; cells do not wrap except the labels and the meaning, so the German columns stay readable at 360px; the box scrolls sideways when needed, the first column stays in view (`position: sticky` with `inset-inline-start`), and the box is a focusable region named by the caption.

## Pages and navigation

- `/reference/` (index: one card per page) and `/reference/<slug>/`, in every locale (`src/pages/[...locale]/reference/`).
- Reference page order: eyebrow ("Reference" · levels), title, badges, In short, "On this page" (links to the `##` sections, when there are at least two), explanation with tables, sponsor slot. No practice, no previous/next cards.
- The "Reference" tab follows the levels after a divider (`LevelSwitcher.astro`): in the header from lg up and in the sidebar sheet. On reference pages the sidebar lists the reference pages (`Base` prop `reference`).
- The home page has a Reference section with links to every page (phones have no other way in from the home page).
- Topics and reference pages do not link to each other.
