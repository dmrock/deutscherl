---
paths:
  - "src/content/pages/**"
  - "src/layouts/ProsePage.astro"
  - "src/components/pages/**"
  - "src/pages/**/about/**"
  - "src/pages/**/legal/**"
---

# Site pages (about, legal)

- `src/content/pages/<slug>/<locale>.mdx` with frontmatter `title` and `description`, routed by `src/pages/[...locale]/<slug>/index.astro` through `ProsePage.astro`.
- MDX components: `<De>`, `<Email />` (the contact `site.email` as a link), `<AudioOnly>` (shown once `site.audio` is true).
- `i18n-coverage` requires every page in every ready locale; a locale that is not ready shows the English text. Not part of the review scopes and not indexed by search.

## Legal (Austria)

- One short page, "Legal notice and privacy" at `/legal/`, in every ready locale, linked in the footer:
  - the Offenlegung according to § 25 Mediengesetz for a small private website: name and town of residence of the Medieninhaber, email, purpose of the site; no postal address;
  - plain privacy paragraphs: hosting by Cloudflare with the legal basis, Cloudflare Web Analytics, browser storage, search in the browser, GitHub links, computer-generated audio once it exists, rights and the Datenschutzbehörde.
- Name and town are written in the page; the email comes from `site.email`. No placeholders or TODOs on live pages. Keep it short and plain, and add no legal claims that have not been confirmed.
- `/about/` holds the accessibility statement (WCAG 2.2 AA target, word order without dragging) and, once audio exists, the computer-generated voice note.
- When sponsor banners arrive: label them as ads ("Anzeige" / localized) and extend the legal notice as required for commercial sites (§ 5 ECG may require a postal address).
