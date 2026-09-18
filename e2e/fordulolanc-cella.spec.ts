/*
 * A függőleges fordulólánc egyetlen cellát kap a készülő sorban (PQW-943).
 *
 * A tulajdonos jelentése: „a 2. sorban ott két cella van, és egy kellene
 * legyen.” A fordulólánc láncszemei egymás fölött állnak, célpontként viszont
 * külön-külön szerepelnek, ezért a rajz vízszintesen több cellára vágta
 * ugyanazt az oszlopot — közte nulla széles cellákra is.
 */

import { expect, test, type Page } from '@playwright/test';

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

test('10 láncszem és egy egyráhajtásos pálca: a 3 láncszemes fordulólánc egy cella (PQW-943)', async ({ page }) => {
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
   * A 10 láncszemből 3 állt függőlegesbe, egyetlen oszlopba: a készülő sor
   * 10 − 3 + 1 = 8 cellát kap. A javítás előtt 10 volt, mert a fordulólánc
   * mindhárom láncszeme külön cellát kért ugyanazon az x-en.
   */
  const layer = await workingLayer(page);
  await expect.poll(async () => (await cells(page)).filter((cell) => cell.layer === layer).length).toBe(8);
});
