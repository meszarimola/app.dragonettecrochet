/*
 * A láncszem oda kerül, ahová a horgoló mutat (PQW-935).
 *
 * A tulajdonos jelentése: az egyráhajtásos pálcánál a kihagyás jól működött, a
 * láncszemnél viszont nem. Szó szerint: „azt vártam volna, hogy ha a másodikba
 * klikkelek, amit a köröcske jelöl, hogy ott az egér, akkor abba a cellába
 * tegye a láncszemet.”
 *
 * A javítás előtti mérés: a láncszem a kurzortól függetlenül mindig a sor
 * végére került — a 9. és a 6. célpontra állított kurzorral bitre ugyanoda.
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

/** A célpont saját cellája az alsó sorban: oda mutat a horgoló. */
async function targetCell(page: Page, slot: number): Promise<Cell> {
  const layer = await workingLayer(page);
  const cell = (await cells(page)).find((candidate) => candidate.layer === layer - 1 && candidate.slot === slot);
  expect(cell, `a(z) ${slot}. célpont cellája`).toBeTruthy();
  return cell!;
}

/** 22 láncszem, fordulás, két rövidpálca, majd három egyráhajtásos pálca egy célpontba. */
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

/** A sor láncszemei a rajzon (a sort kezdő fordulóláncot nem számítva). */
async function rowChains(page: Page): Promise<Node[]> {
  const layer = await workingLayer(page);
  const row = (await nodes(page)).filter((node) => node.layer === layer && node.def === 'ch');
  // A fordulólánc a sor legelején áll, a haladási iránnyal szemközti szélen.
  const edge = Math.max(...row.map((node) => node.x));
  return row.filter((node) => Math.abs(node.x - edge) > 1);
}

test('a láncszem a megkattintott cellába kerül, nem a sor végére (PQW-935)', async ({ page }) => {
  await cluster(page);
  expect(await rowChains(page), 'a csokor után még nincs láncszem a sorban').toHaveLength(0);

  // A csokor az 5. célpontban ül. A láncszem a 8.-ba megy: kettőt átugorva.
  const wanted = await targetCell(page, 8);
  await page.locator('#palette').getByRole('button', { name: /Láncszem \(lsz\)/ }).first().click();
  await page.locator('#chain-count').fill('1');
  await page.mouse.click(wanted.x, wanted.y);

  const chains = await rowChains(page);
  expect(chains, 'egy láncszem került a sorba').toHaveLength(1);
  expect(Math.abs(chains[0]!.x - wanted.x), 'a megkattintott oszlopban áll').toBeLessThan(3);
});

test('két különböző cellába kattintva két külön helyre kerül a láncszem (PQW-935)', async ({ page }) => {
  await cluster(page);
  const palette = page.locator('#palette');
  await palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first().click();
  await page.locator('#chain-count').fill('1');

  const first = await targetCell(page, 7);
  await page.mouse.click(first.x, first.y);
  const second = await targetCell(page, 9);
  await page.mouse.click(second.x, second.y);

  const chains = (await rowChains(page)).map((node) => node.x).sort((a, b) => a - b);
  expect(chains, 'két láncszem a sorban').toHaveLength(2);
  const wanted = [first.x, second.x].sort((a, b) => a - b);
  for (const [i, x] of chains.entries()) {
    expect(Math.abs(x - wanted[i]!), 'mindkettő a saját oszlopában').toBeLessThan(3);
  }
});
