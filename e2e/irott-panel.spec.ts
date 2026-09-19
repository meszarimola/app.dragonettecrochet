/*
 * The written pattern panel on a new pattern (PQW-915).
 *
 * The bug was reported three times, and the tests so far did not catch it
 * because they started with a CLEAN storage: the default of the panel is closed,
 * so the trouble did not show. For anyone who once opened the panel the stored
 * state is `nyitva`, and from then on every new pattern came up open. This test
 * therefore deliberately starts from the `nyitva` state.
 */

import { expect, type Page, test } from '@playwright/test';

const WRITTEN_KEY = 'dc-mintatervezo:irott-minta';

/** Load with the given stored panel state; we reject the cookie bar. */
async function open(page: Page, stored: 'nyitva' | 'zarva' | null): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // Storage can throw in a private window; the test then looks at the default.
      }
    },
    [WRITTEN_KEY, stored] as const,
  );
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
}

test('the panel opened by hand is closed by „Új minta” (PQW-915)', async ({ page }) => {
  await open(page, null);

  const written = page.locator('#written');
  await expect(written).toBeHidden();

  // The user opens it: from here on the stored state is „nyitva”.
  await page.locator('#written-toggle').click();
  await expect(written).toBeVisible();

  await page.locator('[data-action="new"]').click();
  await expect(written, 'the new pattern is empty: the panel must be closed').toBeHidden();
  await expect(page.locator('#written-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('on an empty pattern even a stored „nyitva” state does not open the panel (PQW-915)', async ({ page }) => {
  // This is the blind spot of the earlier tests: the storage already brings a „nyitva” value with it.
  await open(page, 'nyitva');

  await expect(page.locator('#written')).toBeHidden();
  await expect(page.locator('#written-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('in the chain count field Enter lays down the stitches (PQW-915)', async ({ page }) => {
  /*
   * The help of the stitch palette promises Enter as well as a click on the
   * canvas (KB: owner-decisions.md §12). The global key handler, however, bails
   * out in every text field (PQW-911), so the Enter pressed IN THE FIELD was
   * swallowed: the user typed 12, pressed Enter, and nothing happened. This
   * test works without a click, from the keyboard only.
   */
  await open(page, null);

  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');

  const count = page.locator('#chain-count');
  await expect(count).toBeVisible();
  await count.fill('12');
  await count.press('Enter');

  await expect(page.locator('#status')).toContainText('12 láncszem');
  await expect(page.locator('[data-action="end-row"]'), 'after the foundation chain one can turn').toBeEnabled();
});

test('what the user opens stays open as long as there is something to show (PQW-915)', async ({ page }) => {
  await open(page, null);

  await page.locator('#written-toggle').click();
  await expect(page.locator('#written')).toBeVisible();

  // A stitch goes into the pattern: the panel must stay open.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.keyboard.press('Enter');

  await expect(page.locator('#written')).toBeVisible();
  await expect(page.locator('#written-text, #written-notices')).not.toHaveCount(0);
});
