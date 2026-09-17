/*
 * Füstpróba az éles kiszolgálón (PQW-928).
 *
 * A rendes `playwright.config.ts` a buildelt kimenetet szolgálja ki helyben. Ez
 * a változat nem indít kiszolgálót, hanem a már élesített oldalt méri, ezért
 * külön mappát olvas (`e2e-prod`): így egyetlen rendes böngészős teszt sem
 * futhat véletlenül élesben, és fordítva sem.
 *
 * A telepítő szkript hívja, de kézzel is futtatható:
 *   VART_VERZIO=0.19.0 npm run fust
 */

import { defineConfig, devices } from '@playwright/test';

const CIM = process.env.PROD_URL ?? 'https://app.dragonettecrochet.com';

export default defineConfig({
  testDir: 'e2e-prod',
  fullyParallel: true,
  // Éles kiszolgáló hálózaton át: egy újrapróbálás elfér, hogy egy pillanatnyi
  // hálózati döccenés ne buktasson meg egy amúgy sikeres telepítést.
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: CIM,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'asztali', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'alacsony', use: { ...devices['Desktop Chrome'], viewport: { width: 1000, height: 506 } } },
  ],
});
