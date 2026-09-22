/*
 * The grid on the canvas (PQW-874): the rectangle by clicking on cells only, a
 * clear message where there is nothing to crochet into, a clickable row label,
 * switching the grid on and off in the view group, and optionally in the export.
 *
 * The interface publishes the positions of the cells in an automated browser
 * (`window.mintatervezoRacs`, src/ui/main.ts).
 */

import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

interface Cell {
  readonly layer: number;
  readonly index: number;
  readonly slot: number | null;
  readonly x: number;
  readonly y: number;
}

interface Racs {
  readonly layer: number;
  readonly cells: Cell[];
  readonly labels: { layer: number; x: number; y: number }[];
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

const racs = (page: Page): Promise<Racs> =>
  page.evaluate(() => {
    const api = (
      window as unknown as { mintatervezoRacs: { layer(): number; cells(): Cell[]; labels(): Racs['labels'] } }
    ).mintatervezoRacs;
    return { layer: api.layer(), cells: api.cells(), labels: api.labels() };
  });

/** Click on the cell of the target: in the bottom row (the own cell of the target) or in the row in progress (above it). */
async function clickSlot(page: Page, slot: number, row: 'alsó' | 'készülő'): Promise<void> {
  const { layer, cells } = await racs(page);
  const cell = cells.find(
    (candidate) => candidate.slot === slot && candidate.layer === (row === 'készülő' ? layer : layer - 1),
  );
  expect(cell, `the cell of target ${slot} (row ${row})`).toBeTruthy();
  await page.mouse.click(cell!.x, cell!.y);
}

test('the rectangle is made by clicking on cells only; where there is nothing to crochet into, a message comes and no stitch is laid down', async ({
  page,
}) => {
  await open(page);
  // The written pattern panel starts closed (PQW-911): it does not cover the canvas.
  await expect(page.locator('#written')).toBeHidden();
  const palette = page.locator('#palette');
  const summary = page.locator('#summary');
  const status = page.locator('#status');
  const fit = page.getByRole('button', { name: 'Egész minta' });

  // Foundation chain (row 1 on the chart): the chain stitch goes without a target, one click on the canvas.
  await palette
    .getByRole('button', { name: /Láncszem/ })
    .first()
    .click();
  await page.locator('#chain-count').fill('6');
  await page.locator('#board').click();
  // Zooming lives in its own menu (interface.md §63).
  await page.locator('#zoom-toggle').click();
  await fit.click();

  // Row 1: single crochets into the cells of the foundation chain; for single crochet we skip 2 chain stitches (PQW-924), and into the rest
  // one single crochet each goes: 4 stitches out of 6 chain stitches.
  await palette
    .getByRole('button', { name: /Rövidpálca \(rp\)/ })
    .first()
    .click();
  for (const slot of [2, 3, 4, 5]) await clickSlot(page, slot, 'alsó');
  await expect(summary).toContainText('2. sor: 5 szem');

  await page.getByRole('button', { name: 'Sor vége, fordulás' }).click();
  await page.locator('#zoom-toggle').click();
  await fit.click();
  await expect(summary).toContainText('3. sor következik.');

  // The foundation chain is no longer a target: a message comes, and no stitch is laid down.
  const { layer, cells } = await racs(page);
  const old = cells.find((cell) => cell.layer === layer - 2);
  expect(old).toBeTruthy();
  await page.mouse.click(old!.x, old!.y);
  await expect(status).toHaveText(/^Ez az 1\. sor egyik helye\. Most a 3\. sor készül: .*Nem került le szem\.$/);
  await expect(summary).toContainText('3. sor következik.');

  // Row 2: into the cells of the row in progress, clicking above the targets; one goes into every stitch (PQW-924).
  for (const slot of [0, 1, 2, 3]) await clickSlot(page, slot, 'készülő');
  await expect(summary).toContainText('3. sor: 4 szem, még 1 célpont');
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');

  // The row label is an independent, clickable target area: it selects the whole row (PQW-875).
  await page.locator('#zoom-toggle').click();
  await fit.click();
  const label = (await racs(page)).labels.find((candidate) => candidate.layer === 1);
  expect(label).toBeTruthy();
  await page.mouse.click(label!.x, label!.y);
  await expect(status).toHaveText('2. sor kijelölve: 5 szem.');
  await expect(summary).toContainText('3. sor: 4 szem, még 1 célpont');
});

test('the grid can be switched on and off in the view group, it survives, and it goes into the SVG export optionally', async ({
  page,
}) => {
  await open(page);
  const grid = page.locator('.tools [data-action="grid"]');
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  // The shortcut uses Alt (PQW-911); on a Mac its label is ⌥R.
  await expect(grid).toHaveAttribute('data-tip', /^Rács ki és be \((Alt\+R|⌥R)\)$/);

  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').fill('6');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+3');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toContainText('2. sor: 5 szem');
  expect((await racs(page)).cells.length).toBeGreaterThan(0);

  await page.locator('#view-toggle').click();
  await grid.click();
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
  expect((await racs(page)).cells).toEqual([]);

  await page.reload();
  await expect(grid).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+r');
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  expect((await racs(page)).cells.length).toBeGreaterThan(0);

  const exportSvg = async () => {
    const download = page.waitForEvent('download');
    // The export is in the file actions dropdown (PQW-911).
    await page.locator('#file-toggle').click();
    await page.locator('#export-open').click();
    await page.getByRole('button', { name: 'SVG', exact: true }).click();
    return readFile((await (await download).path())!, 'utf8');
  };
  const withGrid = await exportSvg();
  expect(withGrid).toContain('data-grid="rows"');
  expect(withGrid).toContain('Rács: váltakozó sávok');

  /*
   * The grid does not divide the stitches into groups (PQW-924). The owner saw
   * the thick vertical lines on the exported image, so here we look at the
   * downloaded file, not just at the designer: the designer and the export draw
   * the same grid, from shared code.
   */
  const thickVertical = [...withGrid.matchAll(/<path d="M[-\d.]+ [-\d.]+V[-\d.]+"[^>]*stroke-width="([\d.]+)"/g)]
    .map((match) => Number(match[1]))
    .filter((width) => width > 1);
  expect(thickVertical, 'there is no thick vertical cell line in the exported grid').toEqual([]);
  // The numbering is the new one too: the foundation chain is row 1, there is no „0” row number.
  expect(withGrid).toContain('1. sor – alapsor');
  expect(withGrid).not.toMatch(/>0<\/text>/);

  // The grid option is in the export dialog (interface.md §57); Escape closes it again.
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-grid').uncheck();
  await page.keyboard.press('Escape');
  const withoutGrid = await exportSvg();
  expect(withoutGrid).not.toContain('data-grid');
  expect(withoutGrid).toContain('Jelmagyarázat');
});
