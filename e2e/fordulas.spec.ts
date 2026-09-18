/*
 * A fordulás nem rak le láncszemet, és a fordulóláncot az első szem hozza
 * (PQW-944).
 *
 * A tulajdonos jelentése: „a program nyit egy új sort, aminek az elejére egy
 * ilyen lebegőként beletesz egy láncot. ez így nem jó, vedd ezt ki és a 3. sor
 * gridje jelenjen meg… ha rövidpálcát tesz hozzá, akkor ne rövidpálca jelenjen
 * meg, hanem egy láncszem; ha félpálcát, akkor két láncszem; ha erp-t, akkor
 * három láncszem.”
 */

import { expect, test, type Page } from '@playwright/test';

interface Node {
  readonly id: string;
  readonly def: string;
  readonly layer: number;
}

interface Cell {
  readonly layer: number;
}

const nodes = (page: Page): Promise<Node[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoKijeloles: { nodes(): Node[] } }).mintatervezoKijeloles.nodes());

const cells = (page: Page): Promise<Cell[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells());

const workingLayer = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { layer(): number } }).mintatervezoRacs.layer());

/** Tiszta lap, 12 láncszem, fordulás, a 2. sor kitöltve rövidpálcával, majd újabb fordulás. */
async function twoRowsThenTurn(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();

  const palette = page.locator('#palette');
  const chain = palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first();
  if ((await chain.getAttribute('aria-pressed')) !== 'true') await chain.click();
  await page.locator('#chain-count').fill('12');
  await page.locator('#board').click();

  await page.getByRole('button', { name: 'Fordulás' }).click();
  const sc = palette.getByRole('button', { name: /Rövidpálca \(rp\)/ }).first();
  if ((await sc.getAttribute('aria-pressed')) !== 'true') await sc.click();
  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await page.getByRole('button', { name: 'Fordulás' }).click();
}

test('a fordulás nem tesz le láncszemet, és a következő sor rácsa megjelenik (PQW-944)', async ({ page }) => {
  await twoRowsThenTurn(page);

  // A fordulás után a 3. sorban még nincs egyetlen jel sem.
  const layer = await workingLayer(page);
  expect(layer).toBe(2);
  expect((await nodes(page)).filter((node) => node.layer === layer)).toEqual([]);

  // A 3. sor rácsa viszont ott van, mind a 11 cellájával.
  await expect.poll(async () => (await cells(page)).filter((cell) => cell.layer === layer).length).toBe(11);
});

test('az első szem hozza a fordulóláncot: rövidpálcából egy láncszem (PQW-944)', async ({ page }) => {
  await twoRowsThenTurn(page);
  const layer = await workingLayer(page);

  await page.locator('#board').press('Enter');
  const first = (await nodes(page)).filter((node) => node.layer === layer);
  expect(first.map((node) => node.def)).toEqual(['ch']);

  // A következő szem már rövidpálca: a csere csak az elsőre vonatkozik.
  await page.locator('#board').press('Enter');
  expect((await nodes(page)).filter((node) => node.layer === layer).map((node) => node.def)).toEqual(['ch', 'sc']);
});
