/*
 * Láncszem beszúrása a láncalapba, két szem közé kattintva (PQW-941).
 *
 * A tulajdonos kérése: „a második sor végéhez érve jövök rá, hogy az alap az
 * nem elég hosszú, még kéne láncszem – viszont ezt csak úgy tudom módosítani,
 * hogy ha undo-val visszamegyek az alaphoz… használhatóság szempontjából
 * borzasztó rossz.”
 */

import { expect, test, type Page } from '@playwright/test';

interface Cell {
  readonly layer: number;
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

const cells = (page: Page): Promise<Cell[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells());

const labels = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    (window as unknown as { mintatervezoRacs: { labelBoxes(): { text: string }[] } }).mintatervezoRacs
      .labelBoxes()
      .map((label) => label.text),
  );

/** A láncalap cellái balról jobbra. */
const baseCells = async (page: Page): Promise<Cell[]> =>
  (await cells(page)).filter((cell) => cell.layer === 0).sort((a, b) => a.x - b.x);

test('a láncalap két szeme közé kattintva új láncszem kerül, a 2. sor közben is (PQW-941)', async ({ page }) => {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();

  const palette = page.locator('#palette');
  const chain = palette.getByRole('button', { name: /Láncszem \(lsz\)/ }).first();
  if ((await chain.getAttribute('aria-pressed')) !== 'true') await chain.click();
  await page.locator('#chain-count').fill('8');
  await page.locator('#board').click();

  await page.getByRole('button', { name: 'Fordulás' }).click();
  const sc = palette.getByRole('button', { name: /Rövidpálca \(rp\)/ }).first();
  if ((await sc.getAttribute('aria-pressed')) !== 'true') await sc.click();
  // Három rövidpálca: a 2. sor félkész, az alapsor még nem fogyott el.
  for (let i = 0; i < 3; i += 1) await page.locator('#board').press('Enter');

  await expect.poll(async () => (await labels(page)).find((text) => text.startsWith('1. sor'))).toBe('1. sor – alapsor (7)');
  const before = await baseCells(page);

  // A második és a harmadik láncszem közötti vonalra kattintunk.
  const boundary = (before[1]!.x + before[2]!.x) / 2;
  await page.mouse.click(boundary, before[1]!.y);

  await expect.poll(async () => (await labels(page)).find((text) => text.startsWith('1. sor'))).toBe('1. sor – alapsor (8)');
  expect((await baseCells(page)).length).toBe(before.length + 1);

  // Egy lépésben visszavonható.
  await page.locator('#board').press('ControlOrMeta+z');
  await expect.poll(async () => (await labels(page)).find((text) => text.startsWith('1. sor'))).toBe('1. sor – alapsor (7)');
});
