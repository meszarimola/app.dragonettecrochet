/*
 * Smoke test against the deployed interface (PQW-928).
 *
 * It does not measure the logic of the app — the whole `e2e/` suite does that
 * on the built output. This answers whether *the deployment* worked: the right
 * version went out, the page builds up, and a foundation chain really can be
 * laid down.
 *
 * Why this way and not another (measured in PQW-928, not assumed):
 *   * `#count-field`, which holds the number of chains, is HIDDEN until the
 *     chain stitch is chosen as the stitch. So Alt+1 first, and the number only
 *     after it — the other way round the typing goes nowhere and the default 12
 *     stays. This is exactly what the earlier smoke tests failed on.
 *   * The written pattern panel is closed by default, so `#written-text` is
 *     empty; the status message is what proves the stitch was laid down, and
 *     that does appear measurably.
 *
 * The selectors are English since PQW-1100, because the deployed app opens in
 * English. They are deliberately the same strings the `e2e/` suite drives
 * (docs/kiadas.md): guessed selectors failed every release before.
 */

import { expect, type Page, test } from '@playwright/test';

const VART_VERZIO = process.env.VART_VERZIO ?? '';

/** Open with the cookie bar rejected — the way `e2e/editor.spec.ts` does it. */
async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
  return errors;
}

/**
 * The editor is closed until there is a pattern (KB: interface.md §80), so the
 * smoke test starts one the way a visitor does: „Új” → a family → the window it
 * opens (§82) → „Minta létrehozása”, which is what opens the editor and closes
 * the window. The rectangle is then undone, because the step that follows lays a
 * foundation chain of its own and wants the clean sheet the undo gives back; the
 * gate stays open, since it follows the editor and not the undo stack.
 * The strings are the ones `e2e/kezdes-zar.spec.ts` drives (docs/kiadas.md).
 */
async function startPattern(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: 'Regular crochet' }).click();
  await page.getByRole('menuitem', { name: 'Flat shape' }).click();
  await page.locator('#section-shape').getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#setup')).toBeHidden();
  await expect(page.locator('#start-note')).toBeHidden();
  await page.getByRole('button', { name: 'Undo' }).click();
}

test('the served interface shows the expected version', async ({ page }) => {
  test.skip(VART_VERZIO === '', 'VART_VERZIO is not set');
  await open(page);
  await expect(page.getByText(`v${VART_VERZIO}`, { exact: true })).toBeVisible();
});

test('the page builds up: canvas, panel and tool bar in place', async ({ page }) => {
  const errors = await open(page);
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Turn' })).toBeVisible();
  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
});

test('a foundation chain can be laid down with the stitch count given', async ({ page }) => {
  const errors = await open(page);
  await startPattern(page);

  // The stitch first, the number after it — otherwise the field is still hidden (see the header).
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await expect(page.locator('#count-field')).toBeVisible();

  await page.locator('#chain-count').fill('22');
  await page.locator('#chain-count').press('Tab');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');

  await expect(page.getByText('22 chains').first()).toBeVisible({ timeout: 10_000 });
  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
});
