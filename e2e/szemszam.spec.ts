/*
 * A sor kiírt szemszáma (PQW-940).
 *
 * A tulajdonos jelentése a v0.31.0-ról: a 2. sor felirata (13), pedig 22 szem
 * van benne. Szó szerint: „úgy gondolom, hogy nem számolja a kezdő szemet, ami
 * az 1. sorból jött, és nem számolja a láncszemeket sem, pedig azt is kellene.”
 *
 * A sora jobbról balra: 1 fordulólánc, 2 rövidpálca, 2 egyráhajtásos pálca,
 * 3 erp egy szembe, 3 láncszem, 3 erp egy szembe, 3 láncszem, 3 erp egy szembe,
 * 2 láncszem — összesen 22.
 */

import { expect, test, type Page } from '@playwright/test';

/** Új minta tiszta lappal; a süti-sávot elutasítjuk. */
async function start(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await page.getByRole('button', { name: 'Új minta' }).click();
}

/** A jelkészlet gombja; csak akkor kattint, ha még nincs kiválasztva (a gomb kapcsol). */
async function pick(page: Page, name: RegExp): Promise<void> {
  const button = page.locator('#palette').getByRole('button', { name }).first();
  if ((await button.getAttribute('aria-pressed')) !== 'true') await button.click();
}

test('a tulajdonos 2. sora 22 szemet mutat, nem 13-at (PQW-940)', async ({ page }) => {
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
      // Két önálló pálca, majd az első hármas csokor.
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

  // Az írott minta ugyanazt a számot mondja, mint a rajz felirata.
  await page.locator('#written-toggle').click();
  const written = page.locator('#written');
  await expect(written).toBeVisible();
  await expect(written).toContainText('(22 szem)');
  await expect(written).not.toContainText('(13 szem)');
});

/*
 * A láncalap szemszáma (PQW-942). A tulajdonos esete: 10 láncszem, új sor,
 * egyráhajtásos pálca a javasolt célpontba. Ekkor 3 láncszem függőlegessé
 * válik, és a láncalap 10 − 3 + 1 = 8 szem.
 */
interface LabelBox {
  readonly text: string;
}

const labels = (page: Page): Promise<LabelBox[]> =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { labelBoxes(): LabelBox[] } }).mintatervezoRacs.labelBoxes());

test('a láncalap a függőleges fordulólánc oszlopát is számolja (PQW-942)', async ({ page }) => {
  await start(page);

  await pick(page, /Láncszem \(lsz\)/);
  await page.locator('#chain-count').fill('10');
  await page.locator('#board').click();
  await expect.poll(async () => (await labels(page)).map((label) => label.text)).toContain('1. sor – alapsor (10)');

  await page.getByRole('button', { name: 'Fordulás' }).click();
  await pick(page, /Egyráhajtásos pálca \(erp\)/);
  await page.locator('#board').press('Enter');

  // Három láncszem állt függőlegesbe: 10 − 3 + 1 = 8.
  await expect.poll(async () => (await labels(page)).map((label) => label.text)).toContain('1. sor – alapsor (8)');
});
