/*
 * Inserting a chain stitch into the foundation chain by clicking between two
 * stitches (PQW-941).
 *
 * KB: owner-decisions.md §1
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

const labels = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    (window as unknown as { mintatervezoRacs: { labelBoxes(): { text: string }[] } }).mintatervezoRacs
      .labelBoxes()
      .map((label) => label.text),
  );

/** The foundation chain cells from left to right. */
const baseCells = async (page: Page): Promise<Cell[]> =>
  (await cells(page)).filter((cell) => cell.layer === 0).sort((a, b) => a.x - b.x);

test('clicking between two stitches of the foundation chain inserts a new chain stitch, even part-way through row 2 (PQW-941)', async ({
  page,
}) => {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();

  const palette = page.locator('#palette');
  const chain = palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first();
  if ((await chain.getAttribute('aria-pressed')) !== 'true') await chain.click();
  await page.locator('#chain-count').fill('8');
  await page.locator('#board').click();

  await page.getByRole('button', { name: 'Fordulás' }).click();
  const sc = palette.getByRole('button', { name: /Rövidpálca \(rp\)/ }).first();
  if ((await sc.getAttribute('aria-pressed')) !== 'true') await sc.click();
  // Three single crochets: row 2 is half-finished, the foundation row is not used up yet.
  for (let i = 0; i < 3; i += 1) await page.locator('#board').press('Enter');

  await expect
    .poll(async () => (await labels(page)).find((text) => text.startsWith('1. sor')))
    .toBe('1. sor – alapsor (7)');
  const before = await baseCells(page);

  // We click on the line between the second and the third chain stitch.
  const boundary = (before[1]!.x + before[2]!.x) / 2;
  await page.mouse.click(boundary, before[1]!.y);

  await expect
    .poll(async () => (await labels(page)).find((text) => text.startsWith('1. sor')))
    .toBe('1. sor – alapsor (8)');
  expect((await baseCells(page)).length).toBe(before.length + 1);

  // Undone in one step.
  await page.locator('#board').press('ControlOrMeta+z');
  await expect
    .poll(async () => (await labels(page)).find((text) => text.startsWith('1. sor')))
    .toBe('1. sor – alapsor (7)');
});

test('a stitch can be placed by going back into the empty cell above the insertion (PQW-950)', async ({ page }) => {
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
  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await page.getByRole('button', { name: 'Fordulás' }).click();
  await page.locator('#board').press('Enter');
  await page.locator('#board').press('Enter');

  const rowCells = async (): Promise<Cell[]> =>
    (await cells(page)).filter((cell) => cell.layer === 1).sort((a, b) => a.x - b.x);
  const rowLabel = async (): Promise<string | undefined> =>
    (await labels(page)).find((text) => text.startsWith('2. sor'));
  const beforeRow = await rowCells();
  const beforeLabel = await rowLabel();

  // Insert between two stitches of the foundation chain: an EMPTY CELL is left above it in row 2.
  const base = (await cells(page)).filter((cell) => cell.layer === 0).sort((a, b) => a.x - b.x);
  await page.mouse.click((base[2]!.x + base[3]!.x) / 2, base[2]!.y);
  await expect.poll(async () => (await rowCells()).length).toBe(beforeRow.length + 1);
  expect(await rowLabel(), 'the insertion does not change the stitch count of row 2').toBe(beforeLabel);

  /*
   * The empty cell has no target: the rest of the row points at the targets of
   * row 3. (After the insertion every cell's x shifts, so we do not look them
   * up by position.)
   */
  const gapCell = (await rowCells()).find((cell) => cell.slot === null);
  expect(gapCell, 'there is an empty cell above the insertion').toBeTruthy();
  await page.mouse.click(gapCell!.x, gapCell!.y);

  const count = Number(/\((\d+)\)/.exec(beforeLabel!)![1]);
  await expect.poll(rowLabel).toBe(`2. sor (${count + 1})`);
});
