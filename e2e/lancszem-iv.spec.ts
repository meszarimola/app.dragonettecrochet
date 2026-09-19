/*
 * A láncszemsor íve (PQW-951).
 *
 * A tulajdonos a kagylós mintát rajzolta: egy rövidpálca, 5 láncszem, és a
 * következő rövidpálca az alsó sor 5. szemébe — alul 3 kihagyott szem, felül 5
 * láncszem. „ha beillesztem a következő rövidpálcát, akkor ilyen csúnyán adja
 * ki a mintakészítő… a rövidpálca az ami rögzített, azt nem tudjuk tömöríteni.”
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

/** Egy réteg jelei jobbról balra — a 2. sor haladási iránya. */
const rightToLeft = async (page: Page, layer: number): Promise<Box[]> =>
  (await boxes(page)).filter((box) => box.layer === layer).sort((a, b) => b.left - a.left);

const pick = async (page: Page, name: RegExp): Promise<void> => {
  const button = page.locator('#palette').getByRole('button', { name }).first();
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
};

test('5 láncszem 3 kihagyott szem fölött ívet ad, és a rövidpálca a helyén marad (PQW-951)', async ({ page }) => {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();

  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('24');
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Fordulás' }).click();

  /*
   * A cellát az alatta lévő szem OSZLOPA alapján keressük: minden lerakás után
   * eltolódik a rajz, a célpontok sorszáma pedig nem sorfolytonos.
   */
  const above = async (column: number): Promise<Cell> => {
    const all = await cells(page);
    const base = all.filter((cell) => cell.layer === 0).sort((a, b) => b.x - a.x);
    const at = base[column]!.x;
    return all
      .filter((cell) => cell.layer === 1)
      .reduce((best, cell) => (Math.abs(cell.x - at) < Math.abs(best.x - at) ? cell : best));
  };

  // 1. rövidpálca a láncalap utolsó szemébe.
  await pick(page, /Rövidpálca \(rp\)/);
  const first = await above(0);
  await page.mouse.click(first.x, first.y);
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(1);

  // 5 láncszem a rövidpálca után: öt szemet hidal át.
  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('5');
  const next = await above(1);
  await page.mouse.click(next.x, next.y);
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(6);

  // 2. rövidpálca az alsó sor 5. szemébe: alatta már csak 3 kihagyott szem marad.
  await pick(page, /Rövidpálca \(rp\)/);
  const target = await above(4);
  await page.mouse.click(target.x, target.y);
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(7);

  const row = await rightToLeft(page, 1);
  const base = await rightToLeft(page, 0);
  const middle = (box: Box) => (box.left + box.right) / 2;

  // A két rövidpálca a láncalap saját oszlopában: az 1. és az 5. szem fölött.
  const columns = base.map(middle);
  expect(Math.abs(middle(row[0]!) - columns[0]!)).toBeLessThan(2);
  expect(Math.abs(middle(row[6]!) - columns[4]!)).toBeLessThan(2);

  // A sor nem lóg túl a láncalapon.
  expect(row[0]!.right).toBeLessThanOrEqual(Math.max(...base.map((box) => box.right)) + 1);

  // Az öt láncszem nem csúszik egymásba.
  const arc = row.slice(1, 6);
  for (let i = 0; i < arc.length - 1; i += 1) {
    expect(arc[i + 1]!.right, `a ${i + 1}. és ${i + 2}. láncszem külön áll`).toBeLessThanOrEqual(arc[i]!.left + 1);
  }

  // Az ív: a közepe magasabban áll a két végénél (a vásznon kisebb y).
  const tops = arc.map((box) => box.top);
  expect(tops[2]!).toBeLessThan(tops[0]! - 1);
  expect(tops[2]!).toBeLessThan(tops[4]! - 1);

  // Az ív öt cellát kap, nem hármat.
  const between = (await cells(page)).filter(
    (cell) => cell.layer === 1 && cell.x < middle(row[0]!) - 1 && cell.x > middle(row[6]!) + 1,
  );
  expect(between.length, 'lent három szem, fent öt cella').toBe(5);
});

test('a lánc utólag, két kész rövidpálca közé téve is ívet ad (PQW-952)', async ({ page }) => {
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

  // Előbb MINDEN rövidpálca, négyesével — a sor még üres közöttük.
  await pick(page, /Rövidpálca \(rp\)/);
  for (const column of [0, 4, 8, 12, 16, 20]) {
    const cell = await above(column);
    await page.mouse.click(cell.x, cell.y);
  }
  await expect.poll(async () => (await rightToLeft(page, 1)).length).toBe(6);

  // Utólag a láncszemek a rések közepébe.
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

  // Mind a hat rövidpálca a saját oszlopában maradt.
  const stitches = row.filter((_, i) => i % 6 === 0);
  [0, 4, 8, 12, 16, 20].forEach((column, i) => {
    expect(Math.abs(middle(stitches[i]!) - middle(base[column]!)), `${i + 1}. rövidpálca`).toBeLessThan(2);
  });

  // A sor egyik vége sem lóg túl a láncalapon.
  expect(row[0]!.right).toBeLessThanOrEqual(Math.max(...base.map((box) => box.right)) + 1);
  expect(row.at(-1)!.left).toBeGreaterThanOrEqual(Math.min(...base.map((box) => box.left)) - 1);

  // Minden rés íves: a közepe magasabban áll a szélénél.
  for (let gap = 0; gap < 5; gap += 1) {
    const arc = row.slice(gap * 6 + 1, gap * 6 + 6);
    expect(arc.length, `${gap + 1}. rés öt láncszeme`).toBe(5);
    expect(arc[2]!.top, `${gap + 1}. rés íve`).toBeLessThan(arc[0]!.top - 1);
  }
});
