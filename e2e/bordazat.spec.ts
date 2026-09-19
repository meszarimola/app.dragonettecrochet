/*
 * Ribbed edging and brim with post stitches (PQW-909): a rectangle with a
 * ribbed edging from the „Forma” section, a flat circle with a ribbed brim from
 * the „Kör és motívum” section. Both are error-free, the written pattern writes
 * the ribbing as a repeat, and the fields of combinations that cannot be chosen
 * disappear.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function openSection(page: Page, id: string) {
  const section = page.locator(`#${id}`);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: rectangle with a ribbed edging, the ribbing written as a repeat`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openSection(page, 'section-shape');

    await page.locator('#shape-stitch').selectOption('dc');
    await page.locator('#shape-width').fill('10');
    await page.locator('#shape-height').fill('6');

    // The rows and the unit of the ribbing are only visible once it is switched on.
    await expect(page.locator('#shape-ribbing-pair')).toBeHidden();
    await page.locator('#shape-ribbing').check();
    await expect(page.locator('#shape-ribbing-pair')).toBeVisible();
    await page.locator('#shape-ribbing-rows').fill('2');
    await page.locator('#shape-ribbing-width').fill('1');

    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

    const text = await writtenText(page);
    // The ribbed row starts with 2 chain stitches, because a chain stitch cannot stand in place of a post stitch (01 §2.2 [S25]).
    expect(text).toMatch(/2 lsz \(fordulólánc\)/);
    // The ribbing stands as a repeat, not listed stitch by stitch.
    expect(text).toMatch(/\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/);
  });

  test(`${viewport.width}×${viewport.height}: flat circle with a ribbed brim, not available in a spiral`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openSection(page, 'section-rounds');

    await page.locator('#rounds-count').fill('4');
    await page.locator('#rounds-count').press('Tab');
    await page.locator('#rounds-ribbing').check();
    await page.locator('#rounds-ribbing-rows').fill('2');
    await page.locator('#rounds-ribbing-width').fill('1');

    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
    expect(await writtenText(page)).toMatch(/\(1 (Eerp|Herp), 1 (Eerp|Herp)\) ×\d+/);

    // The ribbed brim starts after the round is closed: in a spiral there is nowhere for it to start.
    await page.locator('#rounds-closing').selectOption('spiral');
    await expect(page.locator('#rounds-ribbing-fields')).toBeHidden();
  });
}
