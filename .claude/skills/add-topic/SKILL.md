---
name: add-topic
description: Plan and write new German grammar content for the site, either a topic (a lesson with practice, src/content/topics/<level>/<slug>/) or a reference page (lookup tables, src/content/reference/<slug>/), from settling the level through a checked draft in every locale. Use it whenever someone wants to create, add or write a new topic, lesson, grammar page, reference page or reference table, such as "create a new topic on the Präteritum", "add a lesson about reflexive verbs", "write the A2 lesson for modal verbs" or "create a new reference page for verbs with prepositions", even if they do not say "topic". Not for editing or fixing an existing topic or reference page.
argument-hint: "<grammar point> [level | reference]"
---

# Add a topic or reference page

Arguments: `$ARGUMENTS`, the grammar point and optionally a level or `reference`. Without arguments, ask what the new page should teach.

The site has two kinds of content page:

- A **topic** is a lesson for one level: an explanation in the learner's language, German examples, an Austrian note where one exists, and a practice pool.
- A **reference page** is a lookup table for several levels, such as noun gender clues or irregular verbs: mostly tables, a short text, no practice.

The work has three phases, and the user approves the plan before any file is written:

1. Research: decide which kind of page it is, settle the level, and find what the site already covers.
2. Plan: draft the page, show it, and settle the open choices with the user.
3. Write and check: create the files, verify the German, validate, and run a separate quality pass.

Copy this checklist into your task list and tick it off as you go:

```
- [ ] Rules read (content.md, review.md, and reference.md for a reference page)
- [ ] Kind of page decided: topic or reference page
- [ ] Level (topic) or levels (reference page) settled with sources
- [ ] Overlap with existing topics and reference pages checked
- [ ] Model pages read in full
- [ ] Plan shown, questions answered, plan approved
- [ ] Branch content/<level>-<slug> or content/reference-<slug>
- [ ] meta.yaml, german.yaml, en.mdx, i18n/en.yaml
- [ ] German verified (two sources per fact)
- [ ] Translations for every other locale
- [ ] pnpm validate, review:sync, i18n:coverage, check:language, lint pass
- [ ] Page checked in pnpm dev
- [ ] Separate quality pass done, findings fixed
- [ ] CLAUDE.md updated if needed
- [ ] Summary with unsettled points
```

## Phase 1: research

### Read the rules first

Read `.claude/rules/content.md` and `.claude/rules/review.md` before planning, and `.claude/rules/reference.md` as well for a reference page. They define the file layout, the MDX components, lesson formatting, exercise item rules, table rules, the source rules and the content checklist. This skill does not repeat them; when they and this skill disagree, the rules win.

### Topic or reference page

Decide this first, because the two kinds have different files, rules and plans.

- A rule the learner can apply, explained step by step and practised, is a **topic**.
- A list of words the learner has to look up because no rule on the site gives their form (gender clues with their exceptions, irregular verb forms) is a **reference page**. Its scope is narrow on purpose: every row is a word a learner at the covered levels meets and cannot derive from a rule, with only the forms those levels teach. No full inventories, generated paradigms or imported word lists, and at most about 80 rows per page.
- When the request fits both (a rule plus a long list of exceptions), suggest the split: the rule as a topic, the exceptions as a reference page. When the request would make a dictionary rather than a grammar table, say so and suggest a narrower page.

### Settle the level

The level decides vocabulary, sentence length and how much of the rule the page teaches, so get it right before anything else.

- Check where the grammar point sits in at least two of these: the Goethe-Institut or ÖSD exam descriptions for the level (Prüfungsziele, Modellsätze), Profile Deutsch, and the grammar progression of an established course series (Hueber Menschen or Schritte, Klett Netzwerk, Cornelsen Studio). Note what each source says.
- If the user named a level and the sources disagree, say so and recommend one.
- Some points are split across levels (the Perfekt with `haben` at A1, the full `haben` or `sein` choice at A2). Then say which part belongs at which level and plan only that part.
- For a reference page, settle `levels` instead: the levels whose learners need the table (`[a1, a2]` for both pages so far). Rows and forms are limited to what those levels teach.
- Levels and their availability are in `src/config/site.ts` (`levels`, `plannedTopics`). A topic for a level with `available: false` (B1, B2, C1 today) means opening that level: setting `available: true`, removing the topic from `plannedTopics` and its `planned.<id>` UI strings, and changing the e2e tests that use `/b1/` as the coming-soon example (`tests/e2e/layout.spec.ts`, `a11y.spec.ts`, `language.spec.ts`, `seo.spec.ts`, `navigation.spec.ts`). That is a site change, not just content. Ask the user before planning such a topic, and if they agree, list these changes in the plan. A reference page whose `levels` include a level that is not available yet raises the same question.

### Check what already exists

- List every topic with its category and order: `grep -E '^(category|order):' src/content/topics/*/*/meta.yaml`, and read the `title` and `summary` of each `en.mdx`.
- List the reference pages with their order and levels: `grep -E '^(order|levels):' src/content/reference/*/meta.yaml`, and read their titles and summaries.
- A table that already lives on a reference page is not copied into a topic, and a topic's rule is not repeated on a reference page. Topics and reference pages do not link to each other.
- If the new page overlaps an existing one, say how you would split the material, or suggest extending the existing page instead.

### Read two model pages in full

For a topic, pick the two existing topics closest to the new one: same category first, then same level. For a reference page, read both existing reference pages (`genus`, `unregelmaessige-verben`). Read all their files: `meta.yaml`, `german.yaml`, `en.mdx`, `i18n/en.yaml`, `ru.mdx`, `i18n/ru.yaml`. Copy their structure: the comment lines at the top of the YAML files, the title pattern, the heading style, how examples follow each rule, the length of `why` texts, the tone. A page that looks like its neighbours is easier for learners and for the teacher who verifies it.

What the existing topics have in common:

- Title: `'<German term or words>: <short plain explanation>'`, such as `'Dativ: to whom, with whom'` or `'Negation: nicht and kein'`. German words in the title stay unmarked.
- Summary: one or two short sentences, `*word*` for German words.
- 2 to 7 `##` sections in sentence case, most often 4 to 6. A heading may hold German in `<De>`.
- 8 to 30 examples, numbered `e1`, `e2`, …, usually two per case.
- 10 to 19 choice items (`c1`, …) and 6 to 8 word-order items (`w1`, …).
- Every topic so far has one Austrian note (`at1`), the Dativ two, placed after the section it belongs to. A topic without a confirmed Austrian note is allowed; say so in the plan.

What the existing reference pages have in common:

- Title in the same pattern, such as `'Noun gender: clues for der, die and das'`.
- A short text, then one main `<GermanTable>` with its rows grouped by pattern, and a small second table only where the columns differ.
- Text only for what the table cannot show: how to read it, conditions, exceptions. Examples only where a sentence shows a rule the table cannot.

Both kinds use a German slug in lowercase ASCII, `ä` as `ae`, `ö` as `oe`, `ü` as `ue`, `ß` as `ss`, words joined with `-` (`wechselpraepositionen`, `unregelmaessige-verben`).

## Phase 2: plan

Write the plan in the conversation. For a topic:

```
Topic: <title in English>, <level>
Slug: src/content/topics/<level>/<slug>/
Category: <category id>, order <n> (and which topics shift)
Level evidence: <source>: <what it says>; <source>: <what it says>
Overlap: <existing topics or reference pages it touches, and how>

Summary (In short box): <draft>

Sections:
1. <heading>: <what it explains> (examples e1–e2)
2. <heading>: <rule table type, if any> (examples e3–e6)
...

Austrian note: <candidate, with the two sources that would confirm it>, or "none found"
Exercises: <n> choice items on <what they test>; <n> word-order items on <what they test>
Sources to use: <list>
Out of scope: <what this level leaves for a later topic>
Site changes: <none, or the level/category changes above>
```

For a reference page:

```
Reference page: <title in English>, levels <list>
Slug: src/content/reference/<slug>/
Order: <n> in the reference list (and which pages shift)
Level evidence: <why these levels need the table>
Overlap: <existing topics or reference pages it touches, and how>

Summary (In short box): <draft>

Tables:
- <table id>: columns <column ids>, groups <group ids> (about <n> rows), gloss yes/no
Text: <what the text explains that the tables cannot>
Row selection: <which words make the list and why, which ones are left out>
Austrian note: <candidate, with the two sources that would confirm it>, or "none found"
Sources to use: <list>
Site changes: <none, or the level changes above>
```

Then ask about the choices that are really the user's, with the `AskUserQuestion` tool. Offer 2 to 4 concrete variants per question, put your recommendation first and mark it "(Recommended)", and say in each description what the variant includes and what it leaves out. Ask at most four questions at once, and only where the answer changes the plan. Typical questions:

- Scope: the narrow variant (one rule, more practice) against the broad one (rule plus its main exception), or splitting the material into two topics, or into a topic and a reference page.
- Placement: the category and the order within it, when more than one fits. A new category needs an id in `categoryIds` in `src/config/site.ts` and a `category.<id>` string in every `src/i18n/ui/<locale>.ts`, so offer it only when no existing category fits.
- For a reference page: which rows make the cut and how they are grouped, when the list is close to the limit.
- Austrian angle: which Austrian usage to show when there are several candidates, or none when the sources do not support one.
- The level, when the sources disagree.

Revise the plan with the answers and show the final version. Write files only after the user approves it.

## Phase 3: write and check

### Branch

Work on a branch named after the task: `content/<level>-<slug>` for a topic (for example `content/a2-modalverben`), `content/reference-<slug>` for a reference page. If the session already started on a generated branch name, rename it with `git branch -m <name>` before the first commit.

### Write the files in this order

1. `meta.yaml`: `sources`, and for a topic `level`, `category`, `order`; for a reference page `order` and `levels`. Each source title says what it confirms (`'Duden: Keks (österreichisch: das Keks)'`). If the new page takes an order another page already has, move the other page and say so in the summary.
2. `german.yaml`: all German of the page lives here and nowhere else. A topic has examples, choice items, word-order items and Austrian notes. A reference page has `tables`, examples and Austrian notes, and no choice or word-order items.
3. `en.mdx`: the canonical explanation. The teacher verifies this page, and every other locale is translated from it.
4. `i18n/en.yaml`: example translations and Austrian note translations; for a topic every `why` and word-order `translation`; for a reference page `columns`, `groups` and `glosses`.
5. For every other locale in `src/i18n/locales.ts` (Russian today): `<locale>.mdx` and `i18n/<locale>.yaml`, translated from the meaning of the English page, following the locale's rules in `content.md`.

Do not create `review.yaml`. `pnpm review:sync` writes it.

### Verify the German

Writing the German and checking it are separate steps. After `german.yaml` is written, go through it line by line:

- Check each form, gender, auxiliary, rule and exception against two independent sources from the list in `content.md` (Duden, DWDS, grammis, Österreichisches Wörterbuch, Variantengrammatik, Variantenwörterbuch, established grammars and course material). Fetch the entries; do not rely on memory.
- Fix what is wrong. Replace sentences that are correct but sound like a textbook with ones a native speaker would say.
- For a topic, check every choice item: exactly one option fits the sentence. Read each wrong option in the gap and make sure no context makes it correct.
- For a topic, check every word-order item: write down every order a native speaker would accept, and put each one other than `parts` in `accept`.
- For a reference page, check every table cell, and check that every row earns its place under the scope rule above.
- Add the sources you used to `meta.yaml`.
- Leave out what no two sources settle, and keep a note of it for the summary.

### Validate

Run these and fix every error, then run them again until they pass:

```sh
pnpm validate
pnpm review:sync
pnpm i18n:coverage
pnpm check:language
pnpm lint
```

Then start `pnpm dev` and open the English and Russian pages: `http://localhost:4321/<level>/<slug>/` for a topic, `http://localhost:4321/reference/<slug>/` for a reference page. Check that the examples sit under the rules they belong to and that tables fit on a phone-width screen. For a topic, check that it appears in the sidebar under the planned category and that one practice round works. For a reference page, check that it appears on `/reference/` and in the sidebar of the other reference pages. If the dev server is not available, say that you could not check the page.

### Quality pass

The session that wrote the German is the worst judge of it. Start a fresh `general-purpose` sub-agent with the `Agent` tool. Give it the page's path, the rule files to read (`.claude/rules/content.md`, plus `.claude/rules/reference.md` for a reference page), and this brief: run the content checklist from `content.md` on every file of the page, check each German fact against two sources it fetches itself, fix what it finds directly in the files, and return a list of what it changed and what it could not settle. Then read its changes, run the validation again, and keep its unsettled points for the summary.

### Repository updates

- For a topic, update the topic count in `CLAUDE.md` ("levels A1 and A2 (7 and 6 topics …)"), and the level list if a level opened.
- If a rule or the structure changed (a new category, a new level), update the matching file in `.claude/rules/` in the same branch.

### Commit and pull request

Commit only when the user asks. Then:

- `git commit -s`, a message in English that says what the page covers, for example `A2 topic: modal verbs in the present tense` or `Reference page: verbs with prepositions`.
- The pull request description says what the page adds and nothing about how the plan was chosen. It never mentions who asked for it.

## Rules that are easy to miss

- Everything stays `draft`. Never set `reviewed` or `verified`, never edit `review.yaml`, and never run `review:minor` or `review:set` unless the user asks for that command.
- No German sentences in MDX. The MDX references examples and tables by id; single German words in the text go in `<De>`.
- No native-language text outside the localization files listed in `CLAUDE.md`. `check:language` catches Cyrillic in the wrong file, but not English text in the wrong place.
- German words in explanations are bold (`<De>`, `*word*`), never italic.
- Write your own examples. Never copy sentences from course books, exam material or websites, and never copy word lists wholesale.

## Summary for the user

End with:

- the files created and changed, and the URL of the page in `pnpm dev`;
- the level or levels and the sources that support them;
- the result of each check (validate, coverage, language, lint, the page in the browser);
- what the quality pass changed;
- every point no two sources settled, with what you checked, so the user can decide or pass it to the teacher.
