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
  'home.start': 'Start with {level}',
  'home.feature.language.title': 'In your language',
  'home.feature.language.text':
    'Short, simple explanations. Every German example comes with a translation.',
  'home.feature.practice.title': 'Practice right away',
  'home.feature.practice.text': 'Exercises for every topic, with an explanation for each answer.',
  'home.feature.austria.title': 'German in Austria',
  'home.feature.austria.text': 'Notes where people in Austria say it differently from Germany.',
  'level.a1.name': 'Beginner',
  'level.a2.name': 'Elementary',
  'level.b1.name': 'Intermediate',
  'level.b2.name': 'Upper intermediate',
  'level.c1.name': 'Advanced',
  'level.comingSoon': 'Coming soon',
  'level.soon': 'soon',
  'level.title': 'Level {level}',
  'level.noTopics': 'Topics for this level are being written.',
  'level.comingSoonText':
    'We are working on this level. In the meantime, try one of the available levels.',
  'category.verbs': 'Verbs',
  'topic.inShort': 'In short',
  'topic.practiceSoon': 'Exercises for this topic are coming soon.',
  'topic.inAustria': 'In Austria',
  'topic.austrianUsage': 'Austrian usage',
  'topic.sources': 'Sources',
  'review.status': 'Review status',
  'review.teacherChecked': 'Checked by a teacher',
  'review.germanChecked': 'German checked by a teacher',
  'review.translationReviewed': 'Translation reviewed',
  'review.translationNotReviewed': 'Translation not reviewed yet',
  'review.draft': 'Draft',
  'nav.languagePicker': 'Language',
  'nav.levels': 'Levels',
  'nav.topics': 'Topics',
  'nav.menu': 'Menu',
  'nav.closeMenu': 'Close menu',
  'nav.prev': 'Previous',
  'nav.next': 'Next',
  'nav.practice': 'Practice',
  'nav.topicNavigation': 'Topic navigation',
  'search.soon': 'Search (coming soon)',
  'theme.dark': 'Dark theme',
  'notFound.title': 'Page not found',
  'notFound.backHome': 'Go to the home page',
} as const;

export type UiKey = keyof typeof en;
export type UiStrings = Record<UiKey, string>;
