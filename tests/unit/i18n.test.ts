import { describe, expect, it } from 'vitest';
import { defaultLocale, localeCodes, locales } from '../../src/i18n/locales.ts';
import { en } from '../../src/i18n/ui/en.ts';
import { ui } from '../../src/i18n/ui/index.ts';
import {
  alternates,
  getLocaleFromPath,
  localizePath,
  normalizePath,
  stripLocale,
  t,
} from '../../src/i18n/utils.ts';

describe('locales', () => {
  it('has exactly one default locale, English', () => {
    expect(locales.filter((locale) => locale.default).map((locale) => locale.code)).toEqual(['en']);
    expect(defaultLocale).toBe('en');
  });

  it('has UI strings with every key for every locale', () => {
    const keys = Object.keys(en).sort();
    for (const code of localeCodes) {
      expect(Object.keys(ui[code]).sort(), code).toEqual(keys);
    }
  });
});

describe('t()', () => {
  it('returns the string for the locale', () => {
    expect(t('en', 'home.title')).toBe(en['home.title']);
    expect(t('ru', 'home.title')).toBe(ui.ru['home.title']);
  });

  it('replaces placeholders and keeps unknown ones', () => {
    expect(t('en', 'level.title', { level: 'A2' })).toBe('Level A2');
    expect(t('en', 'level.title', {})).toBe('Level {level}');
  });
});

describe('path helpers', () => {
  it('normalizes leading and trailing slashes', () => {
    expect(normalizePath('a2/perfekt')).toBe('/a2/perfekt/');
    expect(normalizePath('/')).toBe('/');
    expect(normalizePath('/sitemap.xml')).toBe('/sitemap.xml');
  });

  it('detects the locale from the path', () => {
    expect(getLocaleFromPath('/')).toBe('en');
    expect(getLocaleFromPath('/a2/perfekt/')).toBe('en');
    expect(getLocaleFromPath('/ru/')).toBe('ru');
    expect(getLocaleFromPath('/ru')).toBe('ru');
    expect(getLocaleFromPath('/ru/a2/perfekt/')).toBe('ru');
    expect(getLocaleFromPath('/en/a2/')).toBe('en');
    expect(getLocaleFromPath('/russia/')).toBe('en');
  });

  it('strips the locale prefix', () => {
    expect(stripLocale('/ru/a2/perfekt/')).toBe('/a2/perfekt/');
    expect(stripLocale('/ru/')).toBe('/');
    expect(stripLocale('/a2/perfekt/')).toBe('/a2/perfekt/');
  });

  it('localizes paths: default locale unprefixed, others prefixed, trailing slash', () => {
    expect(localizePath('/a2/perfekt/', 'en')).toBe('/a2/perfekt/');
    expect(localizePath('/a2/perfekt/', 'ru')).toBe('/ru/a2/perfekt/');
    expect(localizePath('/', 'ru')).toBe('/ru/');
    expect(localizePath('/ru/a2/perfekt/', 'en')).toBe('/a2/perfekt/');
    expect(localizePath('/ru/a2/perfekt', 'ru')).toBe('/ru/a2/perfekt/');
  });

  it('round-trips between locales', () => {
    for (const path of ['/', '/a1/', '/a2/perfekt/']) {
      for (const code of localeCodes) {
        expect(stripLocale(localizePath(path, code))).toBe(path);
        expect(getLocaleFromPath(localizePath(path, code))).toBe(code);
      }
    }
  });

  it('builds hreflang alternates with x-default', () => {
    expect(alternates('/ru/a2/perfekt/', 'https://example.com')).toEqual([
      { hreflang: 'en', href: 'https://example.com/a2/perfekt/' },
      { hreflang: 'ru', href: 'https://example.com/ru/a2/perfekt/' },
      { hreflang: 'x-default', href: 'https://example.com/a2/perfekt/' },
    ]);
  });
});
