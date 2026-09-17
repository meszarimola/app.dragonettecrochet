/*
 * A rács a vásznon (PQW-874): a téglalap csak cellákra kattintva, érthető
 * üzenet ott, ahol nincs mibe horgolni, kattintható sorszám, a rács ki- és
 * bekapcsolása a nézet csoportban, és választhatóan az exportban.
 *
 * A cellák helyét a felület automatizált böngészőben adja ki
 * (`window.mintatervezoRacs`, src/ui/main.ts).
 */

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

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
    const api = (window as unknown as { mintatervezoRacs: { layer(): number; cells(): Cell[]; labels(): Racs['labels'] } }).mintatervezoRacs;
    return { layer: api.layer(), cells: api.cells(), labels: api.labels() };
  });

/** Kattintás a célpont cellájára: az alsó sorban (a célpont saját cellája) vagy a készülő sorban (fölötte). */
async function clickSlot(page: Page, slot: number, row: 'alsó' | 'készülő'): Promise<void> {
  const { layer, cells } = await racs(page);
  const cell = cells.find((candidate) => candidate.slot === slot && candidate.layer === (row === 'készülő' ? layer : layer - 1));
  expect(cell, `a(z) ${slot}. célpont cellája (${row} sor)`).toBeTruthy();
  await page.mouse.click(cell!.x, cell!.y);
}

test('a téglalap csak cellákra kattintva készül; ahol nincs mibe horgolni, üzenet jön, és nem kerül le szem', async ({ page }) => {
  await open(page);
  // Az írott minta panelje csukva indul (PQW-911): nem takarja a vásznat.
  await expect(page.locator('#written')).toBeHidden();
  const palette = page.locator('#palette');
  const summary = page.locator('#summary');
  const status = page.locator('#status');
  const fit = page.getByRole('button', { name: 'Egész minta' });

  // Láncalap (a rajzon: 1. sor): a láncszem célpont nélkül megy, egy kattintás a vásznon.
  await palette.getByRole('button', { name: /Láncszem/ }).first().click();
  await page.locator('#chain-count').fill('6');
  await page.locator('#board').click();
  await fit.click();

  // 1. sor: rövidpálcák a láncalap celláiba; a horogtól az 1. láncszem a fordulólánc, a 2. az alapláncszeme,
  // a fordulólánc az 1. rövidpálca helyett áll (PQW-891): 4 rp és a fordulólánc.
  await palette.getByRole('button', { name: /Rövidpálca \(rp\)/ }).first().click();
  for (const slot of [2, 3, 4, 5]) await clickSlot(page, slot, 'alsó');
  await expect(summary).toContainText('2. sor: 5 szem');

  await page.getByRole('button', { name: 'Sor vége, fordulás' }).click();
  await fit.click();
  await expect(summary).toContainText('3. sor következik.');

  // A láncalap már nem célpont: üzenet jön, és nem kerül le szem.
  const { layer, cells } = await racs(page);
  const old = cells.find((cell) => cell.layer === layer - 2);
  expect(old).toBeTruthy();
  await page.mouse.click(old!.x, old!.y);
  await expect(status).toHaveText(/^Ez az 1\. sor egyik helye\. Most a 3\. sor készül: .*Nem került le szem\.$/);
  await expect(summary).toContainText('3. sor következik.');

  // 2. sor: a készülő sor celláiba, a célpontok fölé kattintva; a fordulólánc alatti szem (0.) kimarad.
  for (const slot of [1, 2, 3, 4]) await clickSlot(page, slot, 'készülő');
  await expect(summary).toContainText('3. sor: 5 szem');
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');

  // A sorszám önálló, kattintható célterület: a teljes sort jelöli ki (PQW-875).
  await fit.click();
  const label = (await racs(page)).labels.find((candidate) => candidate.layer === 1);
  expect(label).toBeTruthy();
  await page.mouse.click(label!.x, label!.y);
  await expect(status).toHaveText('2. sor kijelölve: 5 szem.');
  await expect(summary).toContainText('3. sor: 5 szem');
});

test('a rács a nézet csoportban ki- és bekapcsolható, megmarad, és választhatóan kerül az SVG-exportba', async ({ page }) => {
  await open(page);
  const grid = page.locator('.tools [data-action="grid"]');
  await expect(grid).toHaveAttribute('aria-pressed', 'true');
  // A gyorsbillentyű Alt-os (PQW-911); Mac gépen a felirata ⌥R.
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
    // Az export a fájlműveletek lenyílójában van (PQW-911).
    await page.locator('#file-toggle').click();
    await page.getByRole('button', { name: 'SVG', exact: true }).click();
    return readFile((await (await download).path())!, 'utf8');
  };
  const withGrid = await exportSvg();
  expect(withGrid).toContain('data-grid="rows"');
  expect(withGrid).toContain('Rács: váltakozó sávok');

  await page.locator('#export-grid').uncheck();
  const withoutGrid = await exportSvg();
  expect(withoutGrid).not.toContain('data-grid');
  expect(withoutGrid).toContain('Jelmagyarázat');
});
