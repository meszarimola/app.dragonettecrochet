/*
 * A „Méret és fonal” szakasz (PQW-859): profil nélkül becslés tartománnyal,
 * profil megadása a panelen, mentés a mintával (újratöltés, JSON-export), és
 * az arányhelyes nézet a rácson.
 */

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

interface Cell {
  readonly layer: number;
  readonly index: number;
  readonly x: number;
  readonly y: number;
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

/** Láncalap és rövidpálcás sorok csak billentyűvel: 1 = láncszem, 3 = rövidpálca, F = fordulás. */
async function rectangle(page: Page, width: number, rows: number): Promise<void> {
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(width + 1));
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('3');
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) await page.keyboard.press('f');
    for (let i = 0; i < width; i += 1) await page.keyboard.press('Enter');
  }
}

/** Kitöltés és kilépés a mezőből, hogy a változás érvényesüljön. */
async function enter(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).fill(value);
  await page.locator(selector).press('Tab');
}

test('a szakasz a Szemek alatt, alapból csukva; profil nélkül a méret becslés, tartománnyal', async ({ page }) => {
  await open(page);
  const size = page.locator('#section-size');
  await expect(size).not.toHaveAttribute('open', '');
  const [stitches, sizeBox, notation] = await Promise.all(
    ['#section-stitches', '#section-size', '#section-notation'].map((selector) => page.locator(selector).boundingBox()),
  );
  expect(stitches!.y).toBeLessThan(sizeBox!.y);
  expect(sizeBox!.y).toBeLessThan(notation!.y);

  await rectangle(page, 5, 2);
  await size.locator('summary').click();
  await expect(page.locator('#size-notice')).toContainText('Nincs profil: a méret becslés 4 mm-es tűből, tartománnyal.');
  await expect(page.locator('#size-total')).toContainText('becsült');
  await expect(page.locator('#size-total')).toContainText('tartomány:');
  await expect(page.locator('#size-rows tbody tr')).toHaveCount(2);
  await expect(page.locator('#size-yarn')).toContainText('A fonalbecsléshez hiányzik');
});

test('profil a panelen: mért méret, fonal gombolyagra; a mintával mentődik, újratöltés után és a JSON-ben is', async ({ page }) => {
  await open(page);
  await rectangle(page, 5, 2);
  await page.locator('#section-size > summary').click();

  await page.getByRole('button', { name: 'Új profil' }).click();
  await expect(page.locator('#size-yarn-name')).toBeFocused();
  await enter(page, '#size-yarn-name', 'Pamut 125');
  await enter(page, '#size-meterage', '250');
  await enter(page, '#size-ball', '50');
  await enter(page, '#size-hook', '4');
  await expect(page.locator('#size-hook-sizes')).toHaveText('US G-6 · régi UK 8');
  await expect(page.locator('#size-origin-meterage')).toHaveText('címkéről');
  await expect(page.locator('#size-origin-cyc')).toContainText('becsült');

  await page.getByRole('button', { name: 'Szem hozzáadása' }).click();
  const gauge = page.locator('#size-gauges li').first();
  await expect(gauge.getByLabel('Szem 10 cm-en')).toBeFocused();
  await expect(gauge).toContainText('Hiányos');
  await enter(page, '#size-gauge-0-stitchesPer10cm', '20');
  await enter(page, '#size-gauge-0-rowsPer10cm', '25');
  await enter(page, '#size-swatch-width', '10');
  await enter(page, '#size-swatch-height', '10');
  await enter(page, '#size-swatch-mass', '5');

  // 5 rövidpálca × 5 mm, 2 sor × 4 mm.
  await expect(page.locator('#size-notice')).toBeHidden();
  await expect(page.locator('#size-total')).toContainText('2,5 cm');
  await expect(page.locator('#size-total')).toContainText('0,8 cm');
  await expect(page.locator('#size-total')).toContainText('mért');
  await expect(page.locator('#size-yarn')).toContainText('≈ 1 db');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action="export-json"]').click();
  const download = await downloadPromise;
  const saved = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(saved.gauge.active).toBe('p1');
  expect(saved.gauge.profiles[0]).toMatchObject({
    yarn: { name: 'Pamut 125', cycWeight: null, metersPer100g: 250, ballMassG: 50 },
    hookMm: 4,
    gauges: [{ stitch: 'sc', form: 'rows', stitchesPer10cm: 20, rowsPer10cm: 25, source: 'measured' }],
    swatch: { widthCm: 10, heightCm: 10, massG: 5 },
  });

  await page.reload();
  await page.locator('#section-size > summary').click();
  await expect(page.locator('#size-profile')).toHaveValue('p1');
  await expect(page.locator('#size-yarn-name')).toHaveValue('Pamut 125');
  await expect(page.locator('#size-total')).toContainText('2,5 cm');

  // Profil nélkül újra becslés; a profil megmarad a választóban.
  await page.locator('#size-profile').selectOption('');
  await expect(page.locator('#size-notice')).toContainText('Nincs profil');
  await expect(page.locator('#size-profile option')).toHaveCount(2);
});

test('arányhelyes nézet: a rács sorai a valós szemarányt követik, és kikapcsolható', async ({ page }) => {
  await open(page);
  await rectangle(page, 5, 3);

  const ratio = async () => {
    const cells: Cell[] = await page.evaluate(() =>
      (window as unknown as { mintatervezoRacs: { cells(): Cell[] } }).mintatervezoRacs.cells(),
    );
    const row = (layer: number) => cells.filter((cell) => cell.layer === layer).sort((a, b) => a.x - b.x);
    const [first, second] = [row(1), row(2)];
    const column = first[1]!.x - first[0]!.x;
    const average = (list: Cell[]) => list.reduce((sum, cell) => sum + cell.y, 0) / list.length;
    return Math.abs(average(first) - average(second)) / column;
  };

  expect(await ratio()).toBeCloseTo(1, 1);
  await page.locator('#section-size > summary').click();
  const aspect = page.getByLabel('Arányhelyes nézet');
  await aspect.check();
  // Profil nélkül a rövidpálcás sor a szélesség 0,8-szerese (02 §4.2).
  await expect.poll(ratio).toBeCloseTo(0.8, 1);
  await aspect.uncheck();
  await expect.poll(ratio).toBeCloseTo(1, 1);
});
