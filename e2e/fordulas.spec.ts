/*
 * Turning does not lay down a chain stitch, and the turning chain is brought by
 * the first stitch (PQW-944).
 *
 * KB: owner-decisions.md §7
 */

import { expect, type Page, test } from '@playwright/test';

interface Node {
  readonly id: string;
  readonly def: string;
  readonly layer: number;
}

interface Cell {
  readonly layer: number;
}

const nodes = (page: Page): Promise<Node[]> =>
  page.evaluate(() =>
    (window as unknown as { mintatervezoKijeloles: { nodes(): Node[] } }).mintatervezoKijeloles.nodes(),
  );

const cells = (page: Page): Promise<Cell[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells());

const workingLayer = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { layer(): number } }).mintatervezoRacs.layer());

/** Clean sheet, 12 chain stitches, turn, row 2 filled with single crochet, then another turn. */
async function twoRowsThenTurn(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  // “New pattern” is the type menu since PQW-1045; since PQW-1126 the shape starts the pattern.
  await page.getByRole('button', { name: 'New pattern' }).click();
  await page.locator('.type[data-type="regular"]').click();
  await page.getByRole('menuitem', { name: /Flat shape/ }).click();
  await page.locator('[data-action="close-setup"]').click();

  const palette = page.locator('#palette');
  const chain = palette.getByRole('button', { name: /Chain \(ch\)/ }).first();
  if ((await chain.getAttribute('aria-pressed')) !== 'true') await chain.click();
  await page.locator('#chain-count').fill('12');
  await page.locator('#board').click();

  await page.getByRole('button', { name: 'Turn' }).click();
  const sc = palette.getByRole('button', { name: /Single crochet \(sc\)/ }).first();
  if ((await sc.getAttribute('aria-pressed')) !== 'true') await sc.click();
  await page.getByRole('button', { name: 'Fill row' }).click();
  await page.getByRole('button', { name: 'Turn' }).click();
}

test('turning does not lay down a chain stitch, and the grid of the next row appears (PQW-944)', async ({ page }) => {
  await twoRowsThenTurn(page);

  // After turning there is not a single symbol in row 3 yet.
  const layer = await workingLayer(page);
  expect(layer).toBe(2);
  expect((await nodes(page)).filter((node) => node.layer === layer)).toEqual([]);

  // The grid of row 3, however, is there, with all 11 of its cells.
  await expect.poll(async () => (await cells(page)).filter((cell) => cell.layer === layer).length).toBe(11);
});

test('the first stitch brings the turning chain: one chain stitch from a single crochet (PQW-944)', async ({
  page,
}) => {
  await twoRowsThenTurn(page);
  const layer = await workingLayer(page);

  await page.locator('#board').press('Enter');
  const first = (await nodes(page)).filter((node) => node.layer === layer);
  expect(first.map((node) => node.def)).toEqual(['ch']);

  // The next stitch is already a single crochet: the swap applies only to the first one.
  await page.locator('#board').press('Enter');
  expect((await nodes(page)).filter((node) => node.layer === layer).map((node) => node.def)).toEqual(['ch', 'sc']);
});

test('right after turning it is visible that row 3 is next (PQW-946)', async ({ page }) => {
  await twoRowsThenTurn(page);

  const labels = (): Promise<string[]> =>
    page.evaluate(() =>
      (window as unknown as { mintatervezoRacs: { labelBoxes(): { text: string }[] } }).mintatervezoRacs
        .labelBoxes()
        .map((label) => label.text),
    );

  // After turning the arrow marker, and after the first stitch (the turning chain) the own label of the row.
  await expect.poll(labels).toContain('Row 3 →');
  await page.locator('#board').press('Enter');
  await expect.poll(labels).toContain('Row 3 (1)');
  expect(await labels()).not.toContain('Row 3 →');
});
