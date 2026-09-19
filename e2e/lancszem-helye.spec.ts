/*
 * The chain stitch goes where the crocheter points (PQW-935).
 *
 * The measurement before the fix: the chain stitch always went to the end of the
 * row regardless of the cursor — bit for bit the same place with the cursor set
 * to target 9 and to target 6.
 *
 * KB: owner-decisions.md §9
 */

import { expect, test, type Page } from '@playwright/test';

interface Cell {
  readonly layer: number;
  readonly slot: number | null;
  readonly x: number;
  readonly y: number;
}

interface Node {
  readonly id: string;
  readonly def: string;
  readonly layer: number;
  readonly x: number;
  readonly y: number;
}

const cells = (page: Page): Promise<Cell[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells());

const workingLayer = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { layer(): number } }).mintatervezoRacs.layer());

const nodes = (page: Page): Promise<Node[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoKijeloles: { nodes(): Node[] } }).mintatervezoKijeloles.nodes());

/** The own cell of the target in the bottom row: that is where the crocheter points. */
async function targetCell(page: Page, slot: number): Promise<Cell> {
  const layer = await workingLayer(page);
  const cell = (await cells(page)).find((candidate) => candidate.layer === layer - 1 && candidate.slot === slot);
  expect(cell, `the cell of target ${slot}`).toBeTruthy();
  return cell!;
}

/** 22 chain stitches, a turn, two single crochets, then three double crochets into one target. */
async function cluster(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();
  const palette = page.locator('#palette');
  await palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first().click();
  await page.locator('#chain-count').fill('22');
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Fordulás' }).click();
  await palette.getByRole('button', { name: /Rövidpálca \(rp\)/ }).first().click();
  await page.locator('#board').press('Enter');
  await page.locator('#board').press('Enter');
  await palette.getByRole('button', { name: /Egyráhajtásos pálca \(erp\)/ }).first().click();
  await page.locator('#board').press('Enter');
  await page.locator('#board').press('Shift+Enter');
  await page.locator('#board').press('Shift+Enter');
}

/** The chain stitches of the row on the chart (not counting the turning chain that starts the row). */
async function rowChains(page: Page): Promise<Node[]> {
  const layer = await workingLayer(page);
  const row = (await nodes(page)).filter((node) => node.layer === layer && node.def === 'ch');
  // The turning chain stands at the very start of the row, on the edge opposite the direction of travel.
  const edge = Math.max(...row.map((node) => node.x));
  return row.filter((node) => Math.abs(node.x - edge) > 1);
}

test('the chain stitch goes into the cell that was clicked, not to the end of the row (PQW-935)', async ({ page }) => {
  await cluster(page);
  expect(await rowChains(page), 'after the cluster there is still no chain stitch in the row').toHaveLength(0);

  // The cluster sits in target 5. The chain stitch goes into the 8th: skipping two.
  const wanted = await targetCell(page, 8);
  await page.locator('#palette').getByRole('button', { name: /Láncszem \(lsz\)/ }).first().click();
  await page.locator('#chain-count').fill('1');
  await page.mouse.click(wanted.x, wanted.y);

  const chains = await rowChains(page);
  expect(chains, 'one chain stitch went into the row').toHaveLength(1);
  expect(Math.abs(chains[0]!.x - wanted.x), 'it stands in the column that was clicked').toBeLessThan(3);
});

test('clicking into two different cells puts the chain stitch in two separate places (PQW-935)', async ({ page }) => {
  await cluster(page);
  const palette = page.locator('#palette');
  await palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first().click();
  await page.locator('#chain-count').fill('1');

  const first = await targetCell(page, 7);
  await page.mouse.click(first.x, first.y);
  const second = await targetCell(page, 9);
  await page.mouse.click(second.x, second.y);

  const chains = (await rowChains(page)).map((node) => node.x).sort((a, b) => a - b);
  expect(chains, 'two chain stitches in the row').toHaveLength(2);
  const wanted = [first.x, second.x].sort((a, b) => a - b);
  for (const [i, x] of chains.entries()) {
    expect(Math.abs(x - wanted[i]!), 'each one in its own column').toBeLessThan(3);
  }
});
