/*
 * Browser tests against the built output; `npm run test:e2e` builds first.
 *
 * Its own port with `--strictPort`: if the port is taken the run fails instead
 * of measuring another worktree's preview. KB: incidents.md §3
 *
 * The limits are explicit, and locally tighter than in CI, so that a broken
 * locator reports in seconds instead of waiting out a timeout. They cannot go
 * below the deliberate timers in the interface — a warning hides itself after
 * three seconds, a chart marking after five. KB: testing.md §4
 */

import { existsSync, readFileSync } from 'node:fs';

import { defineConfig, devices } from '@playwright/test';

/**
 * The worktree's own port, which `npm run munkafa` wrote into its .env.local.
 * The config reads it rather than the caller, because since PQW-1123 there are
 * several entry points — the release set, the nightly full suite, a single spec
 * by hand — and a port read in only one of them is a port collision in the
 * others. PORT in the environment still wins. KB: incidents.md §3
 */
function portFromEnvFile() {
  if (!existsSync('.env.local')) return undefined;
  const found = /^PORT=(\d+)/m.exec(readFileSync('.env.local', 'utf8'));
  return found ? Number(found[1]) : undefined;
}

const PORT = Number(process.env.PORT) || portFromEnvFile() || 5181;
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? 'github' : 'list',
  timeout: CI ? 30_000 : 20_000,
  expect: { timeout: 5_000 },
  maxFailures: CI ? 0 : 5,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    actionTimeout: CI ? 0 : 10_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
