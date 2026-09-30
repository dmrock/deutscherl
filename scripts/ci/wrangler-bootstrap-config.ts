/**
 * Writes a Wrangler config for the one-time bootstrap deploy (CI only).
 *
 * `wrangler versions upload` fails for a Worker that was never deployed. The preview job therefore
 * deploys once with this config: the same as wrangler.jsonc, but without routes, so the custom
 * domain stays untouched until the first production deploy from main.
 *
 * Usage: node scripts/ci/wrangler-bootstrap-config.ts <output.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Removes // and block comments outside of strings (wrangler.jsonc has no trailing commas). */
export function stripJsonComments(source: string): string {
  return source.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (match) =>
    match.startsWith('"') ? match : '',
  );
}

/** wrangler.jsonc without routes: the Worker exists afterwards, but no domain points to it. */
export function bootstrapConfig(jsonc: string): Record<string, unknown> {
  const config = JSON.parse(stripJsonComments(jsonc));
  delete config.routes;
  config.workers_dev = false;
  config.preview_urls = true;
  return config;
}

function main(): void {
  const output = process.argv[2];
  if (!output) {
    console.error('Usage: node scripts/ci/wrangler-bootstrap-config.ts <output.json>');
    process.exit(1);
  }
  const config = bootstrapConfig(readFileSync('wrangler.jsonc', 'utf8'));
  writeFileSync(output, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`Wrote ${output} (wrangler.jsonc without routes).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
