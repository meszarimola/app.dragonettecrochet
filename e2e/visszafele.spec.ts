/*
 * Making a pattern is not continuous (PQW-933).
 *
 * KB: owner-decisions.md §5, §6
 *
 * The drawing is made on the canvas, so we measure the positions from the
 * browser hook of the interface (`window.mintatervezoRacs`,
 * `window.mintatervezoKijeloles`).
 *
 * A leaning stitch is revealed by the BOUNDING RECTANGLE of its symbol: the
 * symbol of an upright double crochet is one symbol wide (21 pixels), that of a
 * leaning one reaches from its base to its top. The measurement before the fix:
 * the double crochet next to the filled-in stitch became 46.5 pixels wide,
 * because its base stayed on one chain stitch and its top moved onto another.
 */

import { expect, test, type Page } from '@playwright/test';

/** The symbol of an upright double crochet is 21 pixels wide; a wider symbol is leaning. */
const UPRIGHT = 24;

interface Cell {
  readonly layer: number;
  readonly index: number;
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

interface Box {
  readonly id: string;
  readonly layer: number;
  readonly left: number;
  readonly right: number;
}

/** One double crochet on the chart: its top, and the bounding rectangle of the symbol. */
interface Stitch {
  readonly x: number;
  readonly left: number;
  readonly right: number;
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
}

const cells = (page: Page): Promise<Cell[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells());

const workingLayer = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { layer(): number } }).mintatervezoRacs.layer());

const nodes = (page: Page): Promise<Node[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoKijeloles: { nodes(): Node[] } }).mintatervezoKijeloles.nodes());

const boxes = (page: Page): Promise<Box[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { stitchBoxes(): Box[] } }).mintatervezoRacs.stitchBoxes());

/** The middle of the own cell of the target in the bottom row: that is where the crocheter points. */
async function targetColumn(page: Page, slot: number): Promise<number> {
  const layer = await workingLayer(page);
  const cell = (await cells(page)).find((candidate) => candidate.layer === layer - 1 && candidate.slot === slot);
  expect(cell, `the cell of target ${slot} in the bottom row`).toBeTruthy();
  return cell!.x;
}

/** Click on the own cell of the target. */
async function clickTarget(page: Page, slot: number): Promise<void> {
  const layer = await workingLayer(page);
  const cell = (await cells(page)).find((candidate) => candidate.layer === layer - 1 && candidate.slot === slot);
  expect(cell, `the cell of target ${slot} in the bottom row`).toBeTruthy();
  await page.mouse.click(cell!.x, cell!.y);
}

/** 12 chain stitches, a turn, and the selected double crochet. */
async function foundation(page: Page): Promise<void> {
  const palette = page.locator('#palette');
  await palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first().click();
  await page.locator('#chain-count').fill('12');
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Fordulás' }).click();
  await palette.getByRole('button', { name: /Egyráhajtásos pálca \(erp\)/ }).first().click();
}

/** The double crochets of the row in progress, by identifier. */
async function stitches(page: Page): Promise<Map<string, Stitch>> {
  const layer = await workingLayer(page);
  const box = new Map((await boxes(page)).map((candidate) => [candidate.id, candidate]));
  const found = (await nodes(page)).filter((node) => node.layer === layer && node.def === 'dc');
  return new Map(found.map((node) => [node.id, { x: node.x, left: box.get(node.id)!.left, right: box.get(node.id)!.right }]));
}

test('clicking on the skipped place puts the stitch there, and the rest stay (PQW-933)', async ({ page }) => {
  await open(page);
  await foundation(page);

  // Three double crochets so that target 5 stays empty: this is the "gap".
  for (const slot of [3, 4, 6]) await clickTarget(page, slot);
  const before = await stitches(page);
  expect([...before.keys()], 'three double crochets in the row').toHaveLength(3);
  const gap = await targetColumn(page, 5);

  // Filling the gap: a click on the empty target, which is BACKWARDS in the row.
  await clickTarget(page, 5);

  const after = await stitches(page);
  expect([...after.keys()], 'four double crochets in the row').toHaveLength(4);
  for (const [id, was] of before) {
    expect(after.get(id)?.x, `double crochet ${id} has not slipped`).toBe(was.x);
  }
  const added = [...after].find(([id]) => !before.has(id));
  expect(added?.[1].x, 'the new double crochet landed above the chain stitch that was clicked').toBe(gap);
  for (const [id, { left, right }] of after) {
    expect(right - left, `double crochet ${id} has not leaned over`).toBeLessThan(UPRIGHT);
  }

  // Filling the gap is not an error: the crocheter clicked there because that is where it was meant to go.
  await page.locator('#error-toggle').click();
  await expect(page.locator('#findings'), 'filling the gap is not an error').not.toContainText('Hiba:');
});

test('it increases into the stitch that was clicked, not into the last one laid down (PQW-933)', async ({ page }) => {
  await open(page);
  await foundation(page);

  for (const slot of [3, 4, 5, 6]) await clickTarget(page, slot);
  expect([...(await stitches(page)).keys()], 'four double crochets in the row').toHaveLength(4);

  // Back to target 4, which ALREADY has a double crochet: this is where we increase.
  await clickTarget(page, 4);

  const after = await stitches(page);
  expect([...after.keys()], 'five double crochets in the row').toHaveLength(5);

  // The two legs of the increase open from ONE base, from the chain stitch that was
  // clicked: only these two lean, and the symbol of each sits over this column. Before
  // the fix three stitches leaned, because half the row had slipped.
  const column = await targetColumn(page, 4);
  const leaning = [...after].filter(([, { left, right }]) => right - left >= UPRIGHT);
  expect(leaning, 'the two legs of the increase lean, nothing else').toHaveLength(2);
  for (const [id, { left, right }] of leaning) {
    expect(left - 1 <= column && column <= right + 1, `leg ${id} starts from the chain stitch that was clicked`).toBe(true);
  }

  await page.locator('#error-toggle').click();
  await expect(page.locator('#findings'), 'increasing backwards is not an error either').not.toContainText('Hiba:');
});
