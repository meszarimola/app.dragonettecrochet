/*
 * On the rectangular grid a stitch sits in its cells (PQW-1172): wherever the
 * click lands in a cell, the stitch stands in its middle on the row's line; a
 * row grows to its tallest stitch; a click on a taken cell replaces.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

interface Placed {
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

/** A 10 × 6 grid at its home view: board (0, 0), row 1's bottom left corner, is 64 px in and 24 px up. */
async function grid(page: Page): Promise<{ board: Locator; at: (col: number, boardY: number) => Promise<void> }> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).click();
  await page.getByRole('menuitem', { name: 'Rectangular' }).click();
  await page.getByLabel('Stitches per row').fill('10');
  await page.getByLabel('Rows').fill('6');
  await page.getByRole('button', { name: 'Create' }).click();
  const board = page.locator('#board');
  const { height } = (await board.boundingBox())!;
  const at = (col: number, boardY: number) =>
    board.click({ position: { x: 64 + col * 40 + 7, y: height - 24 + boardY } });
  return { board, at };
}

test('a stitch sits in the middle of the clicked cell, its foot on the row’s line, whatever the spot', {
  tag: '@kiadas',
}, async ({ page }) => {
  const { at } = await grid(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await at(3, -5);
  const [sc] = await stitches(page);
  expect(sc?.cell, 'row 1, cell 4').toEqual({ row: 0, col: 3, span: 1 });
  expect(sc?.x, 'the middle of the cell, not the spot clicked').toBe(3.5 * 40);

  await page.getByRole('button', { name: /^Double crochet \(dc\)/ }).click();
  await at(3, -38);
  const after = await stitches(page);
  expect(after.length, 'a click on a taken cell replaces its stitch').toBe(1);
  expect(after[0]?.stitch).toBe('dc');

  await at(5, -60);
  const raised = (await stitches(page)).find(({ cell }) => cell?.row === 1);
  expect(raised, 'the click above row 1 lands in row 2, as tall as a cell').toBeDefined();
  const dcRow1 = (await stitches(page)).find(({ cell }) => cell?.row === 0)!;
  expect(raised!.y, 'row 2 starts where the taller row 1 ends').toBeLessThan(dcRow1.y - 40);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await stitches(page)).length, 'one undo takes the last stitch').toBe(1);
});

test('an undo past a symbol style switch shows the stitches seated for the style now in use', async ({ page }) => {
  const { at } = await grid(page);
  await page.getByRole('button', { name: /^Decrease \(dec\)/ }).click();
  await at(2, -20);
  const cyc = (await stitches(page))[0]!.y;
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await at(2, -60);
  await page.locator('#chart-style').selectOption('jis');
  const jis = (await stitches(page)).find(({ stitch }) => stitch === 'sc2tog')!.y;
  expect(jis, 'the two styles draw sc2tog at different heights').not.toBe(cyc);
  await page.getByRole('button', { name: 'Undo' }).click();
  expect((await stitches(page)).map(({ stitch, y }) => [stitch, y])).toEqual([['sc2tog', jis]]);
});

test('while a tall stitch is dragged out of its row, the rows above follow at once', async ({ page }) => {
  const { board, at } = await grid(page);
  await page.getByRole('button', { name: /^Treble \(tr\)/ }).click();
  await at(2, -20);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await at(2, -80);
  const before = (await stitches(page)).find(({ stitch }) => stitch === 'sc')!.y;
  await page.getByRole('button', { name: 'Select' }).click();
  const box = (await board.boundingBox())!;
  const tr = (await stitches(page)).find(({ stitch }) => stitch === 'tr')!;
  await page.mouse.move(box.x + 64 + tr.x, box.y + box.height - 24 + tr.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 64 + tr.x + 300, box.y + box.height - 24 + tr.y, { steps: 5 });
  const during = (await stitches(page)).find(({ stitch }) => stitch === 'sc')!.y;
  expect(during, 'row 1 is a cell again, so row 2 comes down with it before the release').toBe(before + (63 - 40));
  await page.mouse.up();
});

test('a count fills the working way, and a shell takes five cells', async ({ page }) => {
  const { at } = await grid(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await page.locator('#place-count').fill('3');
  await page.locator('#place-count').press('Enter');
  await at(5, -20);
  expect(
    (await stitches(page)).map(({ cell }) => cell?.col),
    'row 1 is worked from the right, so the row goes left',
  ).toEqual([5, 4, 3]);

  await page.getByRole('button', { name: /^Shell/ }).click();
  await at(8, -60);
  const shell = (await stitches(page)).find(({ stitch }) => stitch === 'shell-5dc');
  expect(shell?.cell, 'row 2 goes right; pushed back to fit cells 5–9').toEqual({ row: 1, col: 5, span: 5 });
});
