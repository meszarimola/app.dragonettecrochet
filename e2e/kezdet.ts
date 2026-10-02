/*
 * The editor is closed until there is a pattern (KB: interface.md §80), so a
 * spec that measures the editor has to arrive with one.
 *
 * It arrives as a returning visitor rather than by clicking through the type
 * menu: the menu's own entries open the make-a-pattern sheet, which covers the
 * panel (§54), and since PQW-1137 they also close the editor until a pattern is
 * made — so a spec about row endings would have to generate a shape it is not
 * about. The arrival itself is covered by `kezdes-zar.spec.ts`.
 *
 * The seeded state is that of a visitor whose previous pattern is empty: the
 * stored type says one was made in it (PQW-1137), the stored pattern is the empty
 * one the app itself saves, and the editor therefore opens on a clean sheet.
 *
 * Playwright's default `testMatch` collects `*.spec.ts` only, so this file is
 * not picked up as a test.
 */

import type { Page } from '@playwright/test';

/** The key the interface writes when a pattern is made; its presence is what opens the gate. */
const TYPE_KEY = 'dc-mintatervezo:tipus';

/**
 * Seeds the chosen type before the page script runs, so the app starts open.
 * Call it before `page.goto`.
 *
 * It seeds only an absent key: an init script runs on every navigation, and
 * overwriting here would undo the type the app itself stored, so a reload would
 * land in another type than the one the spec chose.
 */
export async function asReturningVisitor(page: Page, type = 'regular'): Promise<void> {
  await page.addInitScript(
    (seed: { key: string; type: string }) => {
      if (localStorage.getItem(seed.key) === null) localStorage.setItem(seed.key, seed.type);
    },
    { key: TYPE_KEY, type },
  );
}
