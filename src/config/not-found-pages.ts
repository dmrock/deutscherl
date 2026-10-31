/**
 * Per-locale 404 pages. `src/pages/[...locale]/404.astro` is built, like every page with
 * `build.format: 'directory'`, to `404/index.html` and `<code>/404/index.html`. Cloudflare's
 * `not_found_handling: "404-page"` serves the nearest `404.html` up the path, so after the build
 * each one moves to `404.html` and `<code>/404.html`. Build-time only: imported by astro.config.ts.
 */
import { existsSync, renameSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AstroIntegration } from 'astro';
import { defaultLocale, localeCodes } from '../i18n/locales.ts';

/** URL prefix of each locale: `''` for the default locale, otherwise its code. */
const localePrefixes = localeCodes.map((code) => (code === defaultLocale ? '' : code));

/** Moves `<prefix>/404/index.html` to `<prefix>/404.html` in `outDir`; returns the new paths. */
export function moveNotFoundPages(
  outDir: string,
  prefixes: readonly string[] = localePrefixes,
): string[] {
  return prefixes.map((prefix) => {
    const dir = join(outDir, prefix, '404');
    const from = join(dir, 'index.html');
    if (!existsSync(from)) throw new Error(`Missing ${from}: expected a 404 page`);
    const to = join(outDir, prefix, '404.html');
    renameSync(from, to);
    rmdirSync(dir);
    return to;
  });
}

export function notFoundPages(): AstroIntegration {
  return {
    name: 'not-found-pages',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const moved = moveNotFoundPages(fileURLToPath(dir));
        logger.info(`Moved ${moved.length} 404 page(s) to 404.html`);
      },
    },
  };
}
