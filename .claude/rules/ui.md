---
paths:
  - "src/components/**"
  - "src/layouts/**"
  - "src/pages/**"
  - "src/styles/**"
  - "scripts/check-js-budget.ts"
---

# Pages, layout and design

## JavaScript

- Zero JavaScript by default. Svelte only for the exercise islands, hydrated with `client:visible`; they receive already-localized strings as props, never other locales.
- Everything else (theme toggle, closing the language picker, opening search) is a few lines of inline vanilla JS.
- No page transitions: no `<ClientRouter />`, no CSS `@view-transition`.
- Budgets, enforced by `scripts/check-js-budget.ts` in CI (gzipped JS the page loads, each file separately, imported chunks followed, external scripts excluded):
  - pages without islands: ≤ 3 KB (the search UI is not counted: no page loads it until search is opened);
  - pages with islands: ≤ 45 KB (Svelte, svelte-dnd-action and the exercise code; `pnpm budget` prints the current sizes);
  - Lighthouse ≥ 95 in all categories, checked before launch.

## Page types

- Home: intro, level cards (available levels list their topics, the others their planned topics under "Coming soon"), features.
- Level pages: topic cards by category with title and summary. Coming-soon pages: planned topics (`plannedTopics` in `site.ts`, labels `planned.<id>`), `noindex`.
- Topic page order: article (explanation), sponsor slot, practice. No sources on the site.
- Footer on every page, across the whole width under sidebar and content (the `contentinfo` landmark): About, Legal notice and privacy, source code, licenses. On topic pages below lg it keeps clear of the bottom bar.
- `noindex`: coming-soon pages, 404 pages, `ready: false` locales, preview deployments.

## Layout

- Header: level switcher, search, language picker, theme toggle. Left sidebar: topics grouped by category (order in `site.ts`, labels `category.<id>`). Main column: the content.
- Mobile: the sidebar becomes a sheet (the same element with `popover`, opened by a `popovertarget` button, no JS); a bottom bar shows Prev / Practice / Next.
- Static navigation: `scrollbar-gutter: stable` on `<html>`; the header is exactly 3rem (border included); `<body>` is a flex column at least the screen height (header, content row, footer), so short pages do not scroll. The sticky sidebar is as tall as its topics (at most the screen below the header, then it scrolls); the divider is the content column's `border-s`. An e2e test checks header widgets and sidebar position on every page type.
- Russian strings are often 20–30% longer than English: layouts must not break.
- Use logical properties and utilities (`ms-`, `pe-`, `start-`, `text-start`, …), never left/right, so right-to-left locales work.

## Design

- Visual design "Paper": warm cream background, teal accent, soft cards, serif headings, compact spacing.
- Typography: body 15px, German example text 16px, compact cards (`px-3 py-2`). All content uses the full width of the main column (no `max-w-prose` or other text-width limits).
- Theme: follows `prefers-color-scheme`; the toggle saves `theme` in `localStorage`, applied before first paint by the inline script in `ThemeScript.astro` (`data-theme` on `<html>`). Without JS, CSS follows the system preference.
- Tokens (`src/styles/global.css`): semantic colors (`bg`, `surface`, `card`, `fg`, `muted`, `border`, `control`, `accent`, `accent-soft`, `accent-fg`, `focus`, `success(-soft)`, `danger(-soft)`, `header`) per `[data-theme]`, radii (`rounded-ui`, `rounded-card`, `rounded-chip`) and shadows (`shadow-card`, `shadow-pop`), exposed to Tailwind (`bg-bg`, `text-muted`, …). `control` is the border of interactive controls (≥ 3:1).
- Use only these tokens: no raw colors (exception: the Austrian `.flag`), no `dark:` variants except for swapping icons. Dark text is deliberately not pure white (about 13:1) and uses grayscale antialiasing, so it does not glow.
- Favicon: a golden pretzel (Brezel) on the teal tile, `public/favicon.svg`. `favicon.ico` (32 px, one embedded PNG) and `apple-touch-icon.png` (180 px, full-bleed square, since iOS rounds the corners itself) are rendered from it: regenerate both when the SVG changes. No web manifest.
- Examples always show German with its translation (no "Hide translation" toggle). Audio comes later, once there is enough content: pre-generated files with an Austrian voice; no browser speech API and no runtime TTS calls.

## Accessibility

WCAG 2.2 AA without exceptions. Word order meets 2.5.7 (Dragging Movements) because tap, click and Enter move a word without dragging.
