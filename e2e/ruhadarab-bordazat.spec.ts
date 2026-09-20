/*
 * Ribbed edging and cuff in the „Ruhadarab” section (PQW-913): a drop shoulder
 * sweater and a top-down raglan with ribbing, error-free, as a repeat in the
 * written pattern. The raglan wants a measured round gauge, so we enter a
 * profile in the „Méret és fonal” section.
 *
 * The ribbing of the neck is not included: for that the graph would have to pick
 * up stitches along the edge, and edging generation was deliberately left out in
 * PQW-911.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

/** The make-a-pattern sheet (PQW-987) is closed on load, and its opener is in the file menu. */
async function openSheet(page: Page): Promise<void> {
  const sheet = page.locator('#setup-toggle');
  if ((await sheet.getAttribute('aria-expanded')) !== 'true') {
    await page.locator('#file-toggle').click();
    await sheet.click();
  }
}

async function openSection(page: Page, id: string) {
  const section = page.locator(`#${id}`);
  if (await section.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

/** Fill the field and leave it, so that the change takes effect. */
async function enter(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).fill(value);
  await page.locator(selector).press('Tab');
}

/** Measured round gauge in a profile: the raglan wants this (PQW-901). */
async function roundGauge(page: Page): Promise<void> {
  await openSection(page, 'section-size');
  await page.getByRole('button', { name: 'Új profil' }).click();
  await enter(page, '#size-yarn-name', 'Pamut');
  await enter(page, '#size-hook', '5');
  await page.locator('#size-gauge-add').click();
  const row = page.locator('#size-gauges li[data-index="0"]');
  await row.locator('[data-field="stitch"]').selectOption('dc');
  await row.locator('[data-field="form"]').selectOption('rounds');
  await row.locator('[data-field="stitchesPer10cm"]').fill('15');
  await row.locator('[data-field="stitchesPer10cm"]').press('Tab');
  await row.locator('[data-field="rowsPer10cm"]').fill('8');
  await row.locator('[data-field="rowsPer10cm"]').press('Tab');
  await page.locator('#section-size > summary').click();
}

/** Switching the ribbing on in the Ruhadarab panel, with the row count and the rib width. */
async function turnOnRibbing(page: Page, rows: string, width: string): Promise<void> {
  await expect(page.locator('#garment-ribbing-pair')).toBeHidden();
  await page.locator('#garment-ribbing').check();
  await expect(page.locator('#garment-ribbing-pair')).toBeVisible();
  await enter(page, '#garment-ribbing-rows', rows);
  await enter(page, '#garment-ribbing-width', width);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: drop shoulder sweater with ribbed edging and cuffs`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openSection(page, 'section-garment');

    await expect(page.locator('#garment-kind')).toHaveValue('drop-shoulder');
    await turnOnRibbing(page, '2', '1');

    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

    const text = await writtenText(page);
    // The turning chain of the ribbed row is one chain stitch shorter, and it is a turning chain (01 §2.2 [S25]).
    expect(text).toMatch(/2 lsz \(fordulólánc\)/);
    // The ribbing stands as a repeat, not listed stitch by stitch.
    expect(text).toMatch(/\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/);
    // Row 1 stays plain: a post stitch cannot be crocheted around the foundation chain.
    expect(text).not.toMatch(/^2\. sor:.*(Eerp|Herp)/m);
  });

  test(`${viewport.width}×${viewport.height}: top-down raglan with ribbed edging and cuffs`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await roundGauge(page);
    const section = await openSection(page, 'section-garment');

    await page.locator('#garment-kind').selectOption({ label: 'Felülről horgolt raglán' });
    await expect(page.locator('#garment-size')).toHaveValue('M');
    await turnOnRibbing(page, '2', '1');

    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

    const text = await writtenText(page);
    // The lower edging of the body and the cuff of the sleeves with post stitches, as a repeat in the round.
    expect(text).toMatch(/\(1 (Eerp|Herp), 1 (Eerp|Herp)\) ×\d+/);
    // The tube of the sleeve from the underarm to the cuff (PQW-913).
    expect(text).toMatch(/Ujj \(2 db\):/);
  });
}

test('a hat has no ribbed edging: the choice does not even appear', async ({ page }) => {
  await open(page);
  await openSection(page, 'section-garment');
  await page.locator('#garment-kind').selectOption({ label: 'Sapka' });
  await expect(page.locator('#garment-ribbing-fields')).toBeHidden();
});
