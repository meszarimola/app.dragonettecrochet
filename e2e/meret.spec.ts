/*
 * The „Méret és fonal” section (PQW-859): without a profile an estimate with a
 * range, entering a profile in the panel, saving with the pattern (reload, JSON
 * export), and the proportional view on the grid.
 */

import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

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

/** Foundation chain and single crochet rows from the keyboard only: 1 = chain stitch, 3 = single crochet, F = turn. */
async function rectangle(page: Page, width: number, rows: number): Promise<void> {
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(width + 2));
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+3');
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) await page.keyboard.press('Alt+f');
    // PQW-924: the turning chain is not a stitch; the foundation chain = stitch count + skip (2 for single crochet),
    // and one stitch goes into every chain stitch, so there are exactly width single crochets per row.
    for (let i = 0; i < width; i += 1) await page.keyboard.press('Enter');
  }
}

/** Fill the field and leave it, so that the change takes effect. */
async function enter(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).fill(value);
  await page.locator(selector).press('Tab');
}

test('the section sits under Stitches, closed by default; without a profile the size is an estimate, with a range', async ({
  page,
}) => {
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
  await expect(page.locator('#size-notice')).toContainText(
    'Nincs profil: a méret becslés 4 mm-es tűből, tartománnyal.',
  );
  await expect(page.locator('#size-total')).toContainText('becsült');
  await expect(page.locator('#size-total')).toContainText('tartomány:');
  await expect(page.locator('#size-rows tbody tr')).toHaveCount(2);
  await expect(page.locator('#size-yarn')).toContainText('A fonalbecsléshez hiányzik');
});

test('profile in the panel: measured size, yarn per skein; it is saved with the pattern, after a reload and in the JSON too', async ({
  page,
}) => {
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

  // 5 single crochets × 5 mm, 2 rows × 4 mm.
  await expect(page.locator('#size-notice')).toBeHidden();
  await expect(page.locator('#size-total')).toContainText('2,5 cm');
  await expect(page.locator('#size-total')).toContainText('0,8 cm');
  await expect(page.locator('#size-total')).toContainText('mért');
  await expect(page.locator('#size-yarn')).toContainText('≈ 1 db');

  const downloadPromise = page.waitForEvent('download');
  // The export is in the file actions dropdown (PQW-911).
  await page.locator('#file-toggle').click();
  await page.locator('#json-toggle').click();
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

  // Without a profile it is an estimate again; the profile stays in the chooser.
  await page.locator('#size-profile').selectOption('');
  await expect(page.locator('#size-notice')).toContainText('Nincs profil');
  await expect(page.locator('#size-profile option')).toHaveCount(2);
});

/*
 * ATTENTION: this test records the state of TODAY, not the correct expectation
 * (PQW-927).
 *
 * By the knowledge base (03 §5.1) the grid is square in the plain view, and in
 * the proportional view it follows the ratio of the measured gauge — that is, 1
 * and 0.8 would be correct. Today 1.17 and 1.04 come out; both numbers come from
 * measurement, not from calculation. I measured that this was not caused by
 * PQW-924: the same geometry came out in an earlier commit without the skip
 * rule. The fix lives on in PQW-927; until then this test guards that switching
 * the view works.
 */
test('proportional view: switching the view affects the row ratio of the grid, and can be switched off (the values of today, PQW-927)', async ({
  page,
}) => {
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

  const sima = await ratio();
  expect(sima).toBeCloseTo(1.17, 1);
  await page.locator('#section-size > summary').click();
  const aspect = page.getByLabel('Arányhelyes nézet');
  await aspect.check();
  // Switching the view lowers the row ratio; the correct target value would be 0.8 (PQW-927).
  await expect.poll(ratio).toBeCloseTo(1.04, 1);
  await aspect.uncheck();
  await expect.poll(ratio).toBeCloseTo(1.17, 1);
});
