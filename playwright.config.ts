/*
 * Browser tests against the built output; `npm run test:e2e` builds first.
 *
 * Its own port with `--strictPort`: if the port is taken the run fails instead
 * of measuring another worktree's preview. KB: incidents.md §3
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 5181);

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
  },
});
