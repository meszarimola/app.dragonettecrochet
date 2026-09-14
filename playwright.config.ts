/*
 * Böngészős tesztek a buildelt kimeneten (`npm run test:e2e` előtte buildel).
 *
 * Saját port, `--strictPort`-tal: ha foglalt, a futás hibával áll meg, és nem
 * egy másik worktree előnézetét méri.
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
