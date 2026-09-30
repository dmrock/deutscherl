import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BUDGETS,
  extractScripts,
  gzipSize,
  importsOf,
  measurePage,
} from '../../scripts/check-js-budget.ts';

describe('extractScripts()', () => {
  it('collects inline scripts and local script files', () => {
    const html = `
      <script>console.log(1)</script>
      <script type="module" src="/_astro/page.js"></script>
      <script defer src="https://static.cloudflareinsights.com/beacon.min.js"></script>
      <script type="application/ld+json">{"@type":"WebPage"}</script>
      <link rel="modulepreload" href="/_astro/shared.js">
      <link rel="stylesheet" href="/_astro/page.css">`;
    expect(extractScripts(html)).toEqual({
      inline: ['console.log(1)'],
      files: ['/_astro/page.js', '/_astro/shared.js'],
      hasIslands: false,
    });
  });

  it('detects islands and their component and renderer URLs', () => {
    const html =
      '<astro-island uid="1" component-url="/_astro/Choice.js" renderer-url="/_astro/client.svelte.js" client="visible"></astro-island>';
    expect(extractScripts(html)).toEqual({
      inline: [],
      files: ['/_astro/Choice.js', '/_astro/client.svelte.js'],
      hasIslands: true,
    });
  });
});

describe('importsOf()', () => {
  it('finds static, re-export and dynamic imports of local chunks', () => {
    const js =
      'import{a as b}from"./chunk.js";import"./side.js";export*from"../re.js";const m=import("./lazy.js");import x from"svelte"';
    expect(importsOf(js).sort()).toEqual(['../re.js', './chunk.js', './lazy.js', './side.js']);
  });
});

describe('measurePage()', () => {
  it('sums inline scripts and every reachable local chunk once', () => {
    const dist = mkdtempSync(join(tmpdir(), 'budget-'));
    mkdirSync(join(dist, '_astro'));
    const files: Record<string, string> = {
      'page.js': 'import"./a.js";import"./b.js";',
      'a.js': 'import"./b.js";export const a=1;',
      'b.js': 'export const b=2;',
    };
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(dist, '_astro', name), content);
    }
    const inline = 'console.log("theme")';
    const html = `<script>${inline}</script><script type="module" src="/_astro/page.js"></script>`;

    const result = measurePage(html, dist);

    expect(result.type).toBe('static');
    expect(result.files.sort()).toEqual(['/_astro/a.js', '/_astro/b.js', '/_astro/page.js']);
    const expected =
      gzipSize(inline) + Object.values(files).reduce((sum, content) => sum + gzipSize(content), 0);
    expect(result.bytes).toBe(expected);
  });

  it('fails when a referenced script is missing', () => {
    const dist = mkdtempSync(join(tmpdir(), 'budget-'));
    expect(() => measurePage('<script src="/_astro/missing.js"></script>', dist)).toThrow(
      /does not exist/,
    );
  });

  it('has the budgets from CLAUDE.md', () => {
    expect(BUDGETS).toEqual({ static: 3072, islands: 46080 });
  });
});
