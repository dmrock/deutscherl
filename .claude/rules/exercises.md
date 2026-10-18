---
paths:
  - "src/components/exercises/**"
  - "src/lib/exercises.ts"
  - "src/lib/exercise-strings.ts"
  - "src/pages/**"
  - "tests/e2e/exercises.spec.ts"
  - "tests/e2e/helpers/**"
---

# Exercises (Svelte islands)

Exercise types are multiple choice and word order by drag and drop; there is no free-text input. The item rules are in `.claude/rules/content.md`.

## Runner

- Rounds of 5 mixed items from the topic pool: 3 choice + 2 word order (`ROUND_COUNTS`); a kind without unseen items is filled with the other.
- Seen item ids in `sessionStorage` under `seen:<level>/<slug>` (shared between locales), stored when a round starts. When fewer unseen items are left than a round needs, those are kept and the seen list starts over. Storage access in try/catch with an in-memory fallback.
- Options and the word bank are shuffled. "Try again" starts a new round with unseen items.
- All randomness goes through the seedable RNG (`createRng`); `?seed=<n>` works only in non-production builds (`allowSeed`).
- The logic lives in `src/lib/exercises.ts`: pure and shipped to the client, so no UI strings or collections there.
- UI strings are the `exercise.*` keys (plus `topic.austrianUsage`), resolved on the server by `src/lib/exercise-strings.ts` and passed as one `strings` prop; placeholders are filled on the client with `format()`.

## Practice section

- Starts with a "Start practice" button: server-rendered, disabled until the island hydrates, `exercise.needsJs` in `<noscript>`. The round is picked when it is pressed, so items count as seen only when someone practises.
- A choice item is answered with one click. Focus moves to the feedback after an answer, then to the progress dots of the next question; "Question 3 of 5" is the dots' accessible name (`role="img"`), not visible text.
- After each answer: right or wrong, the `why` in the current locale, and "Report a mistake" as a quiet flag icon at the end of the feedback header (tooltip on hover and keyboard focus, Escape hides it, label also as screen-reader text). It opens the GitHub issue form in a new tab with page URL (canonical), locale and item id prefilled (`reportMistakeUrl`, title `[Mistake] <path> <item id>`).
- The result screen shows the score and every answer of the round in order: the learner's German sentence, struck through with the correct sentence below when wrong, and the Austrian label for regional answers.
- Back to the explanation: the article has `id="explanation"`; the card header shows "↑ Explanation" (`exercise.toExplanation`, `.practice-only`, hidden until a round starts) and the result screen "Back to the explanation" (`exercise.backToExplanation`) next to "Try again". Plain in-page links, so the round is kept.

## No layout jumps

- The practice card has a wrapper (`[data-practice-area]` on the topic page). "Start practice" marks it active and scrolls the card to the top once.
- The wrapper is then at least a screen tall (below the sticky header, above the mobile bottom bar, `global.css`) and never shrinks while the page is open (`--practice-tallest`, set by the runner, reset when its width changes).
- The card always fits its content and grows into the spare room below it, so page height and scroll position stay the same (an e2e test checks this at desktop and phone width).
- Answering never changes the size of what is already on screen: fixed-width gap, ✓/✗ as corner badges on the option buttons.
- When a question with its feedback is taller than the screen, the page scrolls smoothly (`block: 'nearest'`) only as far as needed. Focus always moves with `preventScroll`; the feedback fades in (`motion-safe:animate-appear`).

## Word order UI

- Two `svelte-dnd-action` zones: the answer line and the word bank. Words move from the bank into the line, inside it and back. Use the library; never hand-roll drag and drop.
- Mouse drags immediately. Touch: `delayTouchStart: 250` (a long press drags, a swipe scrolls).
- Keyboard: the library's built-in support (Tab to a word, Space picks it up, arrows move it, Tab/Shift+Tab to the other zone); its screen-reader messages are localized (`exercise.wordOrder.*`, `setAriaStrings`). The keyboard drag trigger is Space only.
- Tap, click or Enter on a word moves it without dragging (WCAG 2.5.7): from the bank to the end of the line, from the line back to the bank. Only trusted clicks count (the library dispatches a synthetic click after a touch tap); the listener is attached per word (iOS may not deliver Svelte's delegated clicks on plain elements); after Enter the focus stays in the same zone (Check when the bank is empty).
- "Check" becomes active when the bank is empty. A `fixed` first part is a locked chip before the line. The bank never starts in a valid order.
- After checking, wrong positions are marked against the closest valid order, and the feedback shows that order.
