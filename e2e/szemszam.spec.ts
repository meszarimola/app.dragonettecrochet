/*
 * The stitch count printed for a row (PQW-940).
 *
 * In v0.31.0 the label of row 2 said (13), although there are 22 stitches in it.
 * KB: owner-decisions.md §11
 *
 * The row from right to left: 1 turning chain, 2 single crochets, 2 double
 * crochets, 3 dc into one stitch, 3 chain stitches, 3 dc into one stitch,
 * 3 chain stitches, 3 dc into one stitch, 2 chain stitches — 22 in total.
 */

import { expect, type Page, test } from '@playwright/test';

/** New pattern with a clean sheet; we reject the cookie bar. */
async function start(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  // „Új minta” is the type menu since PQW-1045; the type starts the pattern anew.
  await page.getByRole('button', { name: 'Új minta' }).click();
  await page.locator('.type[data-type="regular"]').click();
}

/** The button of the stitch palette; it only clicks when nothing is selected yet (the button toggles). */
async function pick(page: Page, name: RegExp): Promise<void> {
  const button = page.locator('#palette').getByRole('button', { name }).first();
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
}

test('row 2 of the owner shows 22 stitches, not 13 (PQW-940)', async ({ page }) => {
  await start(page);

  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('22');
  await page.locator('#board').click();
  await page.getByRole('button', { name: 'Fordulás' }).click();

  await pick(page, /Rövidpálca \(rp\)/);
  await page.locator('#board').press('Enter');
  await page.locator('#board').press('Enter');

  await pick(page, /Egyráhajtásos pálca \(erp\)/);
  for (const group of [0, 1, 2]) {
    if (group === 0) {
      // Two standalone double crochets, then the first cluster of three.
      await page.locator('#board').press('Enter');
      await page.locator('#board').press('Enter');
    }
    await page.locator('#board').press('Enter');
    await page.locator('#board').press('Shift+Enter');
    await page.locator('#board').press('Shift+Enter');
    if (group < 2) {
      await pick(page, /Láncszem \(lsz\)/);
      await page.locator('#chain-count').fill('3');
      await page.locator('#board').press('Enter');
      await pick(page, /Egyráhajtásos pálca \(erp\)/);
    }
  }
  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('2');
  await page.locator('#board').press('Enter');

  // The written pattern says the same number as the label on the chart.
  await page.locator('#written-toggle').click();
  const written = page.locator('#written');
  await expect(written).toBeVisible();
  await expect(written).toContainText('(22 szem)');
  await expect(written).not.toContainText('(13 szem)');
});

/*
 * The stitch count of the foundation chain (PQW-942). The case of the owner: 10
 * chain stitches, a new row, a double crochet into the suggested target. At that
 * point 3 chain stitches become vertical, and the foundation chain is
 * 10 − 3 + 1 = 8 stitches.
 */
interface LabelBox {
  readonly text: string;
}

const labels = (page: Page): Promise<LabelBox[]> =>
  page.evaluate(() =>
    (window as unknown as { mintatervezoRacs: { labelBoxes(): LabelBox[] } }).mintatervezoRacs.labelBoxes(),
  );

test('the foundation chain counts the column of the vertical turning chain too (PQW-942)', async ({ page }) => {
  await start(page);

  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('10');
  await page.locator('#board').click();
  await expect.poll(async () => (await labels(page)).map((label) => label.text)).toContain('1. sor – alapsor (10)');

  await page.getByRole('button', { name: 'Fordulás' }).click();
  await pick(page, /Egyráhajtásos pálca \(erp\)/);
  await page.locator('#board').press('Enter');

  // Three chain stitches stood up vertically: 10 − 3 + 1 = 8.
  await expect.poll(async () => (await labels(page)).map((label) => label.text)).toContain('1. sor – alapsor (8)');
});
