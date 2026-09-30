/**
 * English UI strings: the source of truth. Every other locale file is typed against `UiStrings`,
 * so a missing key is a type error. Placeholders use `{name}` syntax.
 */
export const en = {
  'site.tagline': 'German grammar, explained simply',
  'site.skipToContent': 'Skip to content',
  'home.title': 'Learn German grammar',
  'home.intro':
    'Short explanations in your language, examples in German and exercises to practice. Free, no account needed.',
  'level.comingSoon': 'Coming soon',
  'nav.languagePicker': 'Language',
  'languageHint.available': 'This page is available in {language}.',
  'languageHint.dismiss': 'Dismiss',
  'notFound.title': 'Page not found',
  'notFound.backHome': 'Go to the home page',
} as const;

export type UiKey = keyof typeof en;
export type UiStrings = Record<UiKey, string>;
