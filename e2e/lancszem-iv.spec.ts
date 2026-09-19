/*
 * The arc of a row of chain stitches (PQW-951).
 *
 * The shell pattern: one single crochet, 5 chain stitches, and the next single
 * crochet into stitch 5 of the row below — 3 skipped stitches below, 5 chain
 * stitches above.
 *
 * KB: owner-decisions.md §10
 */

import { expect, test, type Page } from '@playwright/test';

interface Cell {
  readonly layer: number;
  readonly index: number;
  readonly slot: number | null;
  readonly x: number;
  readonly y: number;
}

interface Box {
  readonly id: string;
  readonly layer: number;
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const cells = (page: Page): Promise<Cell[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells());

const boxes = (page: Page): Promise<Box[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { stitchBoxes(): Box[] } }).mintatervezoRacs.stitchBoxes());

/** The symbols of one layer from right to left — the direction of travel of row 2. */
const rightToLeft = async (page: Page, layer: number): Promise<Box[]> =>
  (await boxes(page)).filter((box) => box.layer === layer).sort((a, b) => b.left - a.left);

const pick = async (page: Page, name: RegExp): Promise<void> => {
  const button = page.locator('#palette').getByRole('button', { name }).first();
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
};

test('5 chain stitches over 3 skipped stitches make an arc, and the single crochet stays in place (PQW-951)', async ({ page }) => {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();

  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('24');
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Fordulás' }).click();

  /*
   * We look the cell up by the COLUMN of the stitch below it: after every
   * placement the drawing shifts, and the numbering of the targets is not
   * contiguous.
   */
  const above = async (column: number): Promise<Cell> => {
    const all = await cells(page);
    const base = all.filter((cell) => cell.layer === 0).sort((a, b) => b.x - a.x);
    const at = base[column]!.x;
    return all
      .filter((cell) => cell.layer === 1)
      .reduce((best, cell) => (Math.abs(cell.x - at) < Math.abs(best.x - at) ? cell : best));
  };

  // Single crochet 1 into the last stitch of the foundation chain.
  await pick(page, /Rövidpálca \(rp\)/);
  const first = await above(0);
  await page.mouse.click(first.x, first.y);
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(1);

  // 5 chain stitches after the single crochet: they bridge five stitches.
  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('5');
  const next = await above(1);
  await page.mouse.click(next.x, next.y);
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(6);

  // Single crochet 2 into stitch 5 of the row below: only 3 skipped stitches are left under it.
  await pick(page, /Rövidpálca \(rp\)/);
  const target = await above(4);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(7);

  const row = await rightToLeft(page, 1);
  const base = await rightToLeft(page, 0);
  const middle = (box: Box) => (box.left + box.right) / 2;

  // The two single crochets are in their own columns on the foundation chain: above stitches 1 and 5.
  const columns = base.map(middle);
  expect(Math.abs(middle(row[0]!) - columns[0]!)).toBeLessThan(2);
  expect(Math.abs(middle(row[6]!) - columns[4]!)).toBeLessThan(2);

  // The row does not hang over the foundation chain.
  expect(row[0]!.right).toBeLessThanOrEqual(Math.max(...base.map((box) => box.right)) + 1);

  // The five chain stitches do not slide into one another.
  const arc = row.slice(1, 6);
  for (let i = 0; i < arc.length - 1; i += 1) {
    expect(arc[i + 1]!.right, `chain stitches ${i + 1} and ${i + 2} stand apart`).toBeLessThanOrEqual(arc[i]!.left + 1);
  }

  // The arc: its middle stands higher than its two ends (a smaller y on the canvas).
  const tops = arc.map((box) => box.top);
  expect(tops[2]!).toBeLessThan(tops[0]! - 1);
  expect(tops[2]!).toBeLessThan(tops[4]! - 1);

  // The arc gets five cells, not three.
  const between = (await cells(page)).filter(
    (cell) => cell.layer === 1 && cell.x < middle(row[0]!) - 1 && cell.x > middle(row[6]!) + 1,
  );
  expect(between.length, 'three stitches below, five cells above').toBe(5);
});

test('the chain gives an arc when placed between two finished single crochets afterwards too (PQW-952)', async ({ page }) => {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();

  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('25');
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Fordulás' }).click();

  const above = async (column: number): Promise<Cell> => {
    const all = await cells(page);
    const base = all.filter((cell) => cell.layer === 0).sort((a, b) => b.x - a.x);
    const at = base[column]!.x;
    return all
      .filter((cell) => cell.layer === 1)
      .reduce((best, cell) => (Math.abs(cell.x - at) < Math.abs(best.x - at) ? cell : best));
  };

  // First ALL the single crochets, in fours — the row is still empty between them.
  await pick(page, /Rövidpálca \(rp\)/);
  for (const column of [0, 4, 8, 12, 16, 20]) {
    const cell = await above(column);
    await page.mouse.click(cell.x, cell.y);
  }
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(6);

  // Afterwards the chain stitches into the middle of the gaps.
  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('5');
  for (const column of [1, 5, 9, 13, 17]) {
    const cell = await above(column);
    await page.mouse.click(cell.x, cell.y);
  }
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(31);

  const row = await rightToLeft(page, 1);
  const base = await rightToLeft(page, 0);
  const middle = (box: Box) => (box.left + box.right) / 2;

  // All six single crochets stayed in their own columns.
  const stitches = row.filter((_, i) => i % 6 === 0);
  [0, 4, 8, 12, 16, 20].forEach((column, i) => {
    expect(Math.abs(middle(stitches[i]!) - middle(base[column]!)), `single crochet ${i + 1}`).toBeLessThan(2);
  });

  // Neither end of the row hangs over the foundation chain.
  expect(row[0]!.right).toBeLessThanOrEqual(Math.max(...base.map((box) => box.right)) + 1);
  expect(row.at(-1)!.left).toBeGreaterThanOrEqual(Math.min(...base.map((box) => box.left)) - 1);

  // Every gap is arched: its middle stands higher than its edge.
  for (let gap = 0; gap < 5; gap += 1) {
    const arc = row.slice(gap * 6 + 1, gap * 6 + 6);
    expect(arc.length, `the five chain stitches of gap ${gap + 1}`).toBe(5);
    expect(arc[2]!.top, `the arc of gap ${gap + 1}`).toBeLessThan(arc[0]!.top - 1);
  }
});

test('the fan worked into the chain arc fits, and row 3 does not slide off the fabric (PQW-953)', async ({ page }) => {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();

  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('12');
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Fordulás' }).click();

  const above = async (layer: number, column: number): Promise<Cell> => {
    const all = await cells(page);
    const base = all.filter((cell) => cell.layer === 0).sort((a, b) => b.x - a.x);
    const at = base[column]!.x;
    return all
      .filter((cell) => cell.layer === layer)
      .reduce((best, cell) => (Math.abs(cell.x - at) < Math.abs(best.x - at) ? cell : best));
  };

  // Row 2: single crochet, 5 chain stitches, … with four single crochets.
  for (const column of [0, 3, 6, 9]) {
    await pick(page, /Rövidpálca \(rp\)/);
    const cell = await above(1, column);
    await page.mouse.click(cell.x, cell.y);
    if (column === 9) break;
    await pick(page, /Láncszem \(lsz\)/);
    await page.locator('#chain-count').fill('5');
    const gap = await above(1, column + 1);
    await page.mouse.click(gap.x, gap.y);
  }
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(19);

  // Row 3: turning chain, then six double crochets into the same chain stitch.
  await page.getByRole('button', { name: 'Fordulás' }).click();
  await pick(page, /Egyráhajtásos pálca \(erp\)/);
  await page.locator('#board').press('Enter');
  for (let i = 0; i < 6; i += 1) {
    const target = (await cells(page)).find((cell) => cell.layer === 2 && cell.slot === 3);
    expect(target, `the target of double crochet ${i + 1}`).toBeTruthy();
    await page.mouse.click(target!.x, target!.y);
  }
  await expect.poll(async () => (await rightToLeft(page, 2)).length).toBe(9);

  const second = await rightToLeft(page, 1);
  const third = await rightToLeft(page, 2);
  const middle = (box: Box) => (box.left + box.right) / 2;

  // Row 3 stays within row 2.
  expect(Math.min(...third.map(middle))).toBeGreaterThanOrEqual(Math.min(...second.map(middle)) - 1);
  expect(Math.max(...third.map(middle))).toBeLessThanOrEqual(Math.max(...second.map(middle)) + 1);

  // The turning chain stands on the last stitch of row 2.
  const turning = third.slice(-3);
  expect(Math.abs(middle(turning[0]!) - Math.min(...second.map(middle)))).toBeLessThan(2);
});
