import { defineConfig, devices } from '@playwright/test';

// E2E_PORT: another port when 4321 is busy, e.g. a preview running in another worktree.
const PORT = Number(process.env.E2E_PORT ?? 4321);
const isCI = Boolean(process.env.CI);

// Tests run against the built site (`pnpm build` first). No screenshot tests
// (`.claude/rules/testing.md`).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // --ignore-lock keeps the server in the foreground: Astro 7 moves `astro preview` to the
    // background when it detects an AI agent, which Playwright would see as an early exit.
    command: `astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !isCI,
  },
});
