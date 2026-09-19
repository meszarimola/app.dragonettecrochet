/*
 * The vertical turning chain gets a single cell in the row in progress (PQW-943).
 *
 * The chain stitches of the turning chain stand one above the other, but as
 * targets they appear separately, so the drawing cut the same column
 * horizontally into several cells — including zero-width ones in between.
 *
 * KB: owner-decisions.md §8
 */

import { expect, type Page, test } from '@playwright/test';

interface Cell {
  readonly layer: number;
  readonly index: number;
  readonly slot: number | null;
  readonly x: number;
  readonly y: number;
}

const cells = (page: Page): Promise<Cell[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells());

const workingLayer = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { layer(): number } }).mintatervezoRacs.layer());

test('10 chain stitches and one double crochet: the 3-chain turning chain is one cell (PQW-943)', async ({ page }) => {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();

  const palette = page.locator('#palette');
  const chain = palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first();
  if ((await chain.getAttribute('aria-pressed')) !== 'true') await chain.click();
  await page.locator('#chain-count').fill('10');
  await page.locator('#board').click();

  await page.getByRole('button', { name: 'Fordulás' }).click();
  const dc = palette.getByRole('button', { name: /Egyráhajtásos pálca \(erp\)/ }).first();
  if ((await dc.getAttribute('aria-pressed')) !== 'true') await dc.click();
  await page.locator('#board').press('Enter');

  /*
   * Of the 10 chain stitches 3 stood up vertically, into a single column: the
   * row in progress gets 10 − 3 + 1 = 8 cells. Before the fix it was 10, because
   * all three chain stitches of the turning chain asked for a separate cell on
   * the same x.
   */
  const layer = await workingLayer(page);
  await expect.poll(async () => (await cells(page)).filter((cell) => cell.layer === layer).length).toBe(8);
});
