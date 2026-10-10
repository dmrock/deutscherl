/**
 * Drizzle Studio (`pnpm db:studio`) for browsing the generated dictionary database. Browse only: the
 * database is rebuilt from db/data/words.jsonl and db/overrides/ by `pnpm dict:build`, so edits
 * made in Studio are lost (CLAUDE.md, "Dictionary").
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './db/schema.ts',
  dbCredentials: { url: 'file:.cache/dictionary.sqlite' },
});
