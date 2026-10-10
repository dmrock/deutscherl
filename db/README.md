# Dictionary data

The dictionary is built from text files in git; the SQLite database is generated from them on every build and never edited (CLAUDE.md, "Dictionary").

```
db/seed/lemmas-a1-a2.txt   which words exist and their level (owner)
        │
        ▼  pnpm dict:import <file> --edition en|ru   (kaikki.org Wiktextract data in .data/)
db/data/words.jsonl        imported entries, one per line (generated, committed)
        │
        ▼  pnpm dict:build   (also runs in pnpm build)
db/overrides/*.yaml ──────▶ .cache/dictionary.sqlite (generated, gitignored)
```

- `db/schema.ts`: Drizzle schema of the generated database.
- `pnpm db:studio`: rebuilds the database and opens Drizzle Studio to browse it. Changes made in Studio are lost on the next build: edit the text files instead.

## Seed list: `db/seed/lemmas-a1-a2.txt`

One word per line, tab-separated: `lemma<TAB>pos<TAB>gender<TAB>level`. Lines starting with `#` are comments.

- `pos`: Wiktextract names: `noun verb adj adv prep pron conj num article particle intj`
- `gender`: `m`, `f`, `n`, or `pl` (plural-only nouns such as `Eltern`) for nouns; `-` for every other word
- `level`: `a1`, `a2`

A word is identified by `(lemma, pos, gender)`, so homonyms are separate lines (`See m` and `See f`, `essen verb` and `Essen n`). Levels come only from this list: Wiktionary has no CEFR levels.

## Import: `scripts/import-wiktionary.ts`

Download the raw Wiktextract files from kaikki.org into `.data/` (gitignored) and keep them compressed:

- English edition: `https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz` (all languages, about 3 GB)
- Russian edition: `https://kaikki.org/dictionary/downloads/ru/ru-extract.jsonl.gz` (about 300 MB)

The per-language "postprocessed" files on kaikki.org work too, but are marked deprecated. Then run, in this order:

```sh
pnpm dict:import .data/raw-wiktextract-data.jsonl.gz --edition en   # about 4 minutes
pnpm dict:import .data/ru-extract.jsonl.gz --edition ru             # about 15 seconds
```

Each edition replaces only its own data, and a re-run with the same input changes nothing:

- `en` rebuilds every entry from the seed list: part of speech, gender, plural, up to 3 English glosses, up to 3 examples with English translations, Austrian senses and Austrian synonyms. Russian data already in `words.jsonl` is kept.
- `ru` replaces the Russian glosses and the Russian translations of examples (only for examples with the same German sentence). It never changes grammar fields.

The import prints a report: words not found, words built from several Wiktionary records (homonyms with the same identity, e.g. `Bank`: bench and bank), missing glosses, Austrian data, and Russian matches that are ambiguous or rely on an unknown part of speech. Fix what the report shows in an override, not in `words.jsonl`.

### Rules the import follows

- Glosses: obsolete, dated, rare, slang, vulgar and derogatory senses and senses of other regions are left out. Several records for one word: the plural and the first glosses come from the first record (the main etymology).
- Austrian data: senses tagged `Austria` get `region: AT`. A synonym becomes a regional variant when it is tagged `Austria`, or when its own entry has an Austrian sense with the same meaning (`Januar` → `Jänner`). Only synonyms of the main sense count, and colloquial, informal, dated or regional ones are left out.
- Russian edition: matched by `(lemma, pos, gender)`; records with the same gender are merged; a record without gender is used only when it is the only one; otherwise the match is reported as ambiguous. A gloss that starts with a usage label (an abbreviation ending in a dot) is left out, except for the first sense of a record, where only the label is removed.
- Ids: lowercase NFC lemma + `-der`/`-die`/`-das` for nouns, `-<pos>` for other words (`see-der`, `essen-verb`, `schnell-adj`); umlauts and ß stay. When two words get the same id, the second one (by exact lemma, then part of speech and gender) gets `-2`.

## Overrides: `db/overrides/*.yaml`

Manual edits and additions. The import never reads or writes them; `pnpm dict:build` applies them on top of `words.jsonl`, and they always win. Files are applied in name order; one file per topic of work keeps them easy to review (e.g. `homonyms.yaml`, `austria.yaml`).

```yaml
patch:                         # field-level patches of imported words, by id
  bank-die:
    plural: Banken
    glosses:                   # replaces all glosses of each listed locale
      en: [bank (financial institution), bench]
    level: a1
  kartoffel-die:
    regional:                  # replaces all regional variants
      - { region: AT, variant: Erdapfel }
    examples:                  # replaces all examples
      - de: Wir essen heute Kartoffeln.
        translations: { en: We are having potatoes today. }

add:                           # new words that are not in Wiktionary
  - lemma: Jause
    pos: noun
    gender: f
    level: a2
    glosses: { en: [snack, light meal] }
```

Patchable fields: `plural`, `level`, `status`, `glosses.<locale>`, `examples`, `regional`. Lemma, part of speech and gender cannot be patched, because they are the word's identity: add a new word instead. Added words get `source: manual`, the override file on GitHub as source URL and `license: CC BY-SA 4.0` (contributed content, see `LICENSE-CONTENT`).

The build fails when a patch targets an unknown id, when two files patch the same field of the same word, or when an added word's id is already taken.

Entries stay `draft`. Only the owner sets `status: verified`, in an override.
