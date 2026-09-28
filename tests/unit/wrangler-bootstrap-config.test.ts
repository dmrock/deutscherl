import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bootstrapConfig, stripJsonComments } from '../../scripts/ci/wrangler-bootstrap-config.ts';

describe('wrangler bootstrap config', () => {
  it('strips comments but keeps // inside strings', () => {
    const source = '// head\n{ "a": "https://x.test", /* b */ "c": 1 // tail\n}';
    expect(JSON.parse(stripJsonComments(source))).toEqual({ a: 'https://x.test', c: 1 });
  });

  it('drops routes from the real wrangler.jsonc and keeps the rest', () => {
    const config = bootstrapConfig(readFileSync('wrangler.jsonc', 'utf8'));
    expect(config.routes).toBeUndefined();
    expect(config).toMatchObject({
      name: 'deutscherl',
      workers_dev: false,
      preview_urls: true,
      assets: { directory: './dist', not_found_handling: '404-page' },
    });
  });
});
