---
paths:
  - "src/content/pages/**"
  - "src/layouts/ProsePage.astro"
  - "src/components/pages/**"
  - "src/pages/**/about/**"
  - "src/pages/**/legal/**"
  - "src/pages/**/privacy/**"
---

# Site pages (about, legal, privacy)

- `src/content/pages/<slug>/<locale>.mdx` with frontmatter `title` and `description`, routed by `src/pages/[...locale]/<slug>/index.astro` through `ProsePage.astro`. The slugs are listed in `pageSlugs` (`src/lib/pages.ts`).
- MDX components: `<De>`, `<Email />` (the contact `site.email` as a link), `<PageLink page="…">` (another site page in the current locale), `<AudioOnly>` (shown once `site.audio` is true).
- `i18n-coverage` requires every page in every ready locale; a locale that is not ready shows the English text. Not part of the review scopes and not indexed by search.

## Legal (Austria)

- Two pages in every ready locale, each with its own footer link, linking to each other:
  - "Legal notice" at `/legal/`: the Offenlegung according to § 25 Mediengesetz. Name and town of residence of the Medieninhaber, email, purpose of the site, and the basic direction (grundlegende Richtung, § 25(4)) as a factual line about what the site publishes. A grammar course goes beyond a small website that only presents its owner, so the basic direction is included. No postal address. Then the content and code licenses.
  - "Privacy" at `/privacy/`, a separate page because a privacy notice inside the imprint is not enough: the controller, hosting by Cloudflare (processor, legal basis, Data Privacy Framework), Cloudflare Web Analytics (legal basis and the storage period from Cloudflare's docs), browser storage, search in the browser, GitHub links, computer-generated audio once it exists, the rights under Art. 15 to 18, 20 and 21 GDPR and the Datenschutzbehörde.
- Browser storage on the privacy page names the real keys: `theme` in localStorage and `seen:<level>/<slug>` in sessionStorage. Both stay on the device and are strictly necessary for functions the visitor uses, so they need no consent under § 165(3) TKG 2021. Update the page when the site stores something new in the browser, adds a third-party service, or Cloudflare changes what Web Analytics keeps.
- Name and town are written in the pages; the email comes from `site.email`. No placeholders or TODOs on live pages. Keep them short and plain, and add no legal claims that have not been confirmed.
- `/about/` holds the accessibility statement (WCAG 2.2 AA target, word order without dragging) and, once audio exists, the computer-generated voice note.
- When sponsor banners arrive: label them as ads ("Anzeige" / localized) and extend the legal notice as required for commercial sites (§ 5 ECG may require a postal address).
