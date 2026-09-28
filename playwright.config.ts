import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const isCI = Boolean(process.env.CI);

// Tests run against the built site (`pnpm build` first). No screenshot tests (CLAUDE.md, "Testing").
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
