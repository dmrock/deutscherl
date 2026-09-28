/**
 * Repository language check (CLAUDE.md, "Repository language").
 *
 * Fails when non-Latin letters (Cyrillic, Greek, Arabic, Hebrew, CJK, Devanagari, ...) appear in a
 * tracked file outside the localization paths. Latin letters with diacritics, including German
 * ä ö ü ß, are allowed everywhere.
 *
 * Usage:
 *   node scripts/check-language.ts            # all files tracked by git (CI)
 *   node scripts/check-language.ts <file>...  # only these files (pre-commit hook)
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localeCodes } from '../src/i18n/locales.ts';

export interface Violation {
  path: string;
  line: number;
  column: number;
  char: string;
  script: string;
}

/** A letter that is not Latin (Common/Inherited cover shared marks and modifier letters). */
const NON_LATIN_LETTER = /[\p{L}--[\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]]/v;

/** Scripts named in the report; anything else is reported as "non-Latin". */
const SCRIPT_NAMES = [
  'Cyrillic',
  'Greek',
  'Arabic',
  'Hebrew',
  'Han',
  'Hiragana',
  'Katakana',
  'Hangul',
  'Devanagari',
  'Bengali',
  'Thai',
  'Armenian',
  'Georgian',
] as const;

const SCRIPT_PATTERNS = SCRIPT_NAMES.map(
  (name) => [name, new RegExp(`\\p{Script=${name}}`, 'u')] as const,
);

/** File that may contain a native-language name, but only on `name:` lines. */
const LOCALES_FILE = 'src/i18n/locales.ts';
const NAME_LINE = /^\s*name:\s*(['"]).*\1,?\s*$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Localization paths where native-language text is allowed in the whole file. */
export function allowedPathPatterns(locales: readonly string[] = localeCodes): RegExp[] {
  const locale = `(?:${locales.map(escapeRegExp).join('|')})`;
  return [
    new RegExp(`^src/i18n/ui/${locale}\\.ts$`),
    new RegExp(`^src/content/topics/.+/${locale}\\.mdx$`),
    new RegExp(`^src/content/topics/.+/i18n/${locale}\\.yaml$`),
    /^db\/data\/words\.jsonl$/,
    /^db\/overrides\/[^/]+\.yaml$/,
    new RegExp(`^tests/fixtures/i18n/${locale}/.+`),
  ];
}

const ALLOWED_PATHS = allowedPathPatterns();

export function isAllowedPath(path: string): boolean {
  return ALLOWED_PATHS.some((pattern) => pattern.test(path));
}

function scriptOf(char: string): string {
  return SCRIPT_PATTERNS.find(([, pattern]) => pattern.test(char))?.[0] ?? 'non-Latin';
}

/** Non-Latin letters in `content`, or none when `path` is a localization file. */
export function findViolations(path: string, content: string): Violation[] {
  if (isAllowedPath(path)) return [];
  const violations: Violation[] = [];
  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (path === LOCALES_FILE && NAME_LINE.test(line)) continue;
    let column = 1;
    for (const char of line) {
      if (NON_LATIN_LETTER.test(char)) {
        violations.push({ path, line: index + 1, column, char, script: scriptOf(char) });
      }
      column += char.length;
    }
  }
  return violations;
}

function isBinary(buffer: Buffer): boolean {
  return buffer.subarray(0, 8000).includes(0);
}

function trackedFiles(): string[] {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return output.split('\0').filter(Boolean);
}

/** Reads each file (skipping deleted, non-regular and binary files) and collects violations. */
export function checkFiles(paths: readonly string[], root = process.cwd()): Violation[] {
  const violations: Violation[] = [];
  for (const path of paths) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute) || !statSync(absolute).isFile()) continue;
    const buffer = readFileSync(absolute);
    if (isBinary(buffer)) continue;
    const repoPath = relative(root, absolute).split(sep).join('/');
    violations.push(...findViolations(repoPath, buffer.toString('utf8')));
  }
  return violations;
}

export function formatViolation({ path, line, column, char, script }: Violation): string {
  const codePoint = char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, '0');
  return `${path}:${line}:${column}  ${script} letter "${char}" (U+${codePoint})`;
}

function main(): void {
  const args = process.argv.slice(2);
  const paths = args.length > 0 ? args : trackedFiles();
  const violations = checkFiles(paths);
  if (violations.length === 0) {
    console.log(`Language check passed (${paths.length} files).`);
    return;
  }
  for (const violation of violations) console.error(formatViolation(violation));
  console.error(
    `\nLanguage check failed: ${violations.length} non-Latin letter(s) outside localization files.` +
      '\nNative-language text belongs only in localization files (CLAUDE.md, "Repository language").',
  );
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
