import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moveNotFoundPages } from '../../src/config/not-found-pages.ts';

describe('moveNotFoundPages', () => {
  let dir = '';
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'not-found-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('moves 404/index.html to 404.html at the root and under each locale prefix', () => {
    for (const prefix of ['', 'ru']) {
      mkdirSync(join(dir, prefix, '404'), { recursive: true });
      writeFileSync(join(dir, prefix, '404', 'index.html'), `404 ${prefix}`);
    }

    expect(moveNotFoundPages(dir, ['', 'ru'])).toEqual([
      join(dir, '404.html'),
      join(dir, 'ru', '404.html'),
    ]);
    expect(readFileSync(join(dir, 'ru', '404.html'), 'utf8')).toBe('404 ru');
    expect(existsSync(join(dir, '404'))).toBe(false);
    expect(existsSync(join(dir, 'ru', '404'))).toBe(false);
  });

  it('fails when a locale has no 404 page', () => {
    expect(() => moveNotFoundPages(dir, ['ru'])).toThrow(/expected a 404 page/);
  });
});
