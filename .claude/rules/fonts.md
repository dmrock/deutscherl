---
paths:
  - "src/config/fonts.ts"
  - "src/i18n/locales.ts"
  - "src/layouts/Base.astro"
  - "src/styles/**"
---

# Fonts

- Each locale's font is configured in `locales.ts` (`family`, Fontsource variable-font `package`, `subsets`, `preload`): self-hosted, `font-display: swap`. Only the listed subsets get `@font-face` rules; `preload` lists the subsets every page of that locale uses right away.
- `src/config/fonts.ts` builds Astro's Fonts API config from `locales.ts` + `germanFont`, with a small provider that reads the installed Fontsource packages (`metadata.json`, `unicode.json`, `files/`): versions pinned by the lockfile, no network at build time, metric-adjusted fallbacks. Each family gets a CSS variable from its name (`--font-golos-text`). `Base.astro` renders `<Font>` for the locale font (preloaded) and the German font, and sets `--font-body` / `--font-de`.
- Locale fonts: `en` Atkinson Hyperlegible Next, `ru` Golos Text. A locale in a script without a good match (Arabic, Hindi, …) gets its own font entry; nothing else changes.
- German content blocks (examples, exercises) use one German font on every locale for consistent umlauts and ß: Atkinson Hyperlegible Next (Latin only), via the `german` utility (slightly larger than explanation text). Inline German words in explanation text keep the locale font.
- Headings (`h1`–`h3`) use a system serif stack (`--heading-font`: Iowan Old Style / Charter on Apple, Georgia elsewhere), no font download.
- Choosing a font for a new locale: build a temporary comparison page on the PR (candidates at body and example size, light and dark, next to German blocks), choose on the preview, then remove the page and keep only the chosen package.
