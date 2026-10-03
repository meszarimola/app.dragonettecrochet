/*
 * On the rectangular grid a dragged stitch drops into the nearest cell when it
 * is let go (PQW-1173): it replaces what was there, and it cannot be carried
 * off the grid.
 */

import { expect, type Page, test } from '@playwright/test';

interface Placed {
  readonly id: number;
  readonly stitch: string;
  readonly x: number;
  readonly y: number;
  readonly cell?: { readonly row: number; readonly col: number; readonly span: number };
}

async function stitches(page: Page): Promise<Placed[]> {
  return page.evaluate(
    () => (window as unknown as { dcFreeformChart: () => { stitches: Placed[] } }).dcFreeformChart().stitches,
  );
}

/** A 10 × 6 grid with an sc in row 1, cell 3 and a dc in row 2, cell 6; board (0, 0) is 64 px in and 24 px up. */
async function gridWithStitches(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).click();
  await page.getByRole('menuitem', { name: 'Rectangular' }).click();
  await page.getByLabel('Stitches per row').fill('10');
  await page.getByLabel('Rows').fill('6');
  await page.getByRole('button', { name: 'Create' }).click();
  const board = page.locator('#board');
  const box = (await board.boundingBox())!;
  const screen = (x: number, y: number) => ({ x: box.x + 64 + x, y: box.y + box.height - 24 + y });
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await board.click({ position: { x: 64 + 2 * 40 + 20, y: box.height - 24 - 20 } });
  await page.getByRole('button', { name: /^Double crochet \(dc\)/ }).click();
  await board.click({ position: { x: 64 + 5 * 40 + 20, y: box.height - 24 - 70 } });
  await page.getByRole('button', { name: 'Select' }).click();
  const drag = async (from: Placed, dx: number, dy: number) => {
    const start = screen(from.x, from.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + dx, start.y + dy, { steps: 6 });
    await page.mouse.up();
  };
  return { drag };
}

test('a dragged stitch drops into the cell nearest to where it is let go', { tag: '@kiadas' }, async ({ page }) => {
  const { drag } = await gridWithStitches(page);
  const sc = (await stitches(page)).find(({ stitch }) => stitch === 'sc')!;
  await drag(sc, 40 * 5 + 13, -45);
  const moved = (await stitches(page)).find(({ id }) => id === sc.id)!;
  expect(moved.cell, 'row 2, cell 8').toEqual({ row: 1, col: 7, span: 1 });
  expect(moved.x, 'in the middle of the cell, not where it was let go').toBe(7.5 * 40);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await stitches(page)).find(({ id }) => id === sc.id)?.cell, 'one undo puts it back').toEqual({
    row: 0,
    col: 2,
    span: 1,
  });
});

test('a stitch dropped on a taken cell replaces it', async ({ page }) => {
  const { drag } = await gridWithStitches(page);
  const all = await stitches(page);
  const sc = all.find(({ stitch }) => stitch === 'sc')!;
  const dc = all.find(({ stitch }) => stitch === 'dc')!;
  await drag(sc, dc.x - sc.x, -50);
  const after = await stitches(page);
  expect(
    after.map(({ stitch }) => stitch),
    'the dc gave way',
  ).toEqual(['sc']);
  expect(after[0]?.cell).toEqual({ row: 1, col: 5, span: 1 });
});

test('a stitch cannot be carried off the grid: let go outside, it stays on the nearest cell', async ({ page }) => {
  const { drag } = await gridWithStitches(page);
  const sc = (await stitches(page)).find(({ stitch }) => stitch === 'sc')!;
  await drag(sc, -400, 200);
  const moved = (await stitches(page)).find(({ id }) => id === sc.id)!;
  expect(moved.cell, 'row 1, cell 1: the corner nearest to where it was let go').toEqual({ row: 0, col: 0, span: 1 });
});

test('a stitch dragged straight along its row onto another: the drawing loses the replaced one too', async ({
  page,
}) => {
  const { drag } = await gridWithStitches(page);
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  const box = (await page.locator('#board').boundingBox())!;
  await page.locator('#board').click({ position: { x: 64 + 6 * 40 + 20, y: box.height - 24 - 20 } });
  await page.getByRole('button', { name: 'Select' }).click();
  const row1 = (await stitches(page)).filter(({ cell }) => cell?.row === 0);
  expect(row1.length).toBe(2);
  const [left, right] = row1.sort((a, b) => a.x - b.x);
  await drag(left!, right!.x - left!.x, 0);
  expect((await stitches(page)).filter(({ cell }) => cell?.row === 0).length, 'one gave way').toBe(1);
  await expect(page.locator('#board'), 'the drawing shows the chart as recorded').toHaveAttribute(
    'data-stitches',
    String((await stitches(page)).length),
  );
});
