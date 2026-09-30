/**
 * JS budget check (CLAUDE.md, "UX rules"): gzipped JavaScript that each built page loads.
 *
 * Counted per page: inline scripts, local `<script src>`, `modulepreload` links and island
 * component/renderer URLs, plus every local chunk they import (static and dynamic, so the number
 * is an upper bound). External scripts (the analytics beacon) and non-JS script types (JSON-LD)
 * are not counted. Each file is gzipped separately.
 *
 * Budgets: pages with Svelte islands (topic pages with exercises) 45 KB, all other pages 3 KB.
 *
 * Usage: node scripts/check-js-budget.ts [dist]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const BUDGETS = {
  static: 3 * 1024,
  islands: 45 * 1024,
} as const;

export type PageType = keyof typeof BUDGETS;

export interface PageScripts {
  /** Bodies of inline JavaScript `<script>` elements */
  inline: string[];
  /** Local script URLs (absolute paths such as `/_astro/x.js`) */
  files: string[];
  hasIslands: boolean;
}

const JS_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript']);

function attribute(attrs: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(
    attrs,
  );
  if (!match) return undefined;
  return (match[1] ?? match[2] ?? match[3] ?? '').replaceAll('&amp;', '&');
}

function isLocalUrl(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

/** Scripts that a built HTML page loads. */
export function extractScripts(html: string): PageScripts {
  const inline: string[] = [];
  const files = new Set<string>();

  for (const [, attrs = '', body = ''] of html.matchAll(
    /<script\b([^>]*)>([\s\S]*?)<\/script>/gi,
  )) {
    const type = (attribute(attrs, 'type') ?? '').toLowerCase();
    if (!JS_TYPES.has(type)) continue;
    const src = attribute(attrs, 'src');
    if (src !== undefined) {
      if (isLocalUrl(src)) files.add(src);
    } else if (body.trim()) {
      inline.push(body);
    }
  }

  for (const [, attrs = ''] of html.matchAll(/<link\b([^>]*)>/gi)) {
    const href = attribute(attrs, 'href');
    if (attribute(attrs, 'rel') === 'modulepreload' && href && isLocalUrl(href)) files.add(href);
  }

  let hasIslands = false;
  for (const [, attrs = ''] of html.matchAll(/<astro-island\b([^>]*)>/gi)) {
    hasIslands = true;
    for (const name of ['component-url', 'renderer-url', 'before-hydration-url']) {
      const url = attribute(attrs, name);
      if (url && isLocalUrl(url)) files.add(url);
    }
  }

  return { inline, files: [...files], hasIslands };
}

/** Relative and absolute module specifiers imported by a JS file (static and dynamic). */
export function importsOf(js: string): string[] {
  const specifiers = new Set<string>();
  const patterns = [
    /\b(?:import|export)\s*(?:[\w*{}\s,$]*?\bfrom\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const [, specifier = ''] of js.matchAll(pattern)) {
      if (specifier.startsWith('./') || specifier.startsWith('../') || isLocalUrl(specifier)) {
        specifiers.add(specifier);
      }
    }
  }
  return [...specifiers];
}

export function gzipSize(content: string | Buffer): number {
  return gzipSync(content, { level: 9 }).length;
}

export interface PageMeasurement {
  type: PageType;
  bytes: number;
  files: string[];
}

/** Gzipped JS size of one page; `files` are the URL paths of all JS files it loads. */
export function measurePage(
  html: string,
  distDir: string,
  fileSize: (path: string) => number = (path) => gzipSize(readFileSync(path)),
): PageMeasurement {
  const scripts = extractScripts(html);
  const seen = new Set<string>();
  const queue = [...scripts.files];
  while (queue.length > 0) {
    const url = queue.shift() as string;
    if (seen.has(url)) continue;
    const path = join(distDir, url);
    if (!existsSync(path)) throw new Error(`Script ${url} does not exist in ${distDir}`);
    seen.add(url);
    for (const specifier of importsOf(readFileSync(path, 'utf8'))) {
      const next = isLocalUrl(specifier) ? specifier : posix.join(posix.dirname(url), specifier);
      if (existsSync(join(distDir, next))) queue.push(next);
    }
  }
  const inlineBytes = scripts.inline.reduce((sum, body) => sum + gzipSize(body), 0);
  const fileBytes = [...seen].reduce((sum, url) => sum + fileSize(join(distDir, url)), 0);
  return {
    type: scripts.hasIslands ? 'islands' : 'static',
    bytes: inlineBytes + fileBytes,
    files: [...seen],
  };
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));
}

const kb = (bytes: number) => `${(bytes / 1024).toFixed(2)} KB`;

function main(): void {
  const distDir = resolve(process.argv[2] ?? 'dist');
  if (!existsSync(distDir)) {
    console.error(`${distDir} does not exist. Run the build first.`);
    process.exitCode = 1;
    return;
  }
  const sizes = new Map<string, number>();
  const cachedSize = (path: string) => {
    let size = sizes.get(path);
    if (size === undefined) {
      size = gzipSize(readFileSync(path));
      sizes.set(path, size);
    }
    return size;
  };

  const pages = htmlFiles(distDir).map((file) => ({
    page: `/${relative(distDir, file).split(sep).join('/')}`,
    ...measurePage(readFileSync(file, 'utf8'), distDir, cachedSize),
  }));

  const failures = pages.filter((page) => page.bytes > BUDGETS[page.type]);
  for (const type of Object.keys(BUDGETS) as PageType[]) {
    const ofType = pages.filter((page) => page.type === type);
    if (ofType.length === 0) continue;
    const largest = ofType.reduce((max, page) => (page.bytes > max.bytes ? page : max));
    console.log(
      `${type.padEnd(8)} ${String(ofType.length).padStart(5)} pages, budget ${kb(BUDGETS[type])}, ` +
        `largest ${kb(largest.bytes)} (${largest.page})`,
    );
  }
  if (failures.length === 0) {
    console.log(`JS budget check passed (${pages.length} pages).`);
    return;
  }
  for (const page of failures) {
    console.error(`${page.page}: ${kb(page.bytes)} > ${kb(BUDGETS[page.type])} (${page.type})`);
  }
  console.error(`\nJS budget exceeded on ${failures.length} page(s) (CLAUDE.md, "UX rules").`);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
