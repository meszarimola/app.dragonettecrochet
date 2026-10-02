/*
 * Ribbed edging and brim with post stitches (PQW-909): a rectangle with a
 * ribbed edging from the “Shape” section, a flat circle with a ribbed brim from
 * the “Round and motif” section. Both are error-free, the written pattern writes
 * the ribbing as a repeat, and the fields of combinations that cannot be chosen
 * disappear.
 */

import { expect, type Page, test } from '@playwright/test';

import { asReturningVisitor } from './kezdet.ts';

async function open(page: Page): Promise<void> {
  await asReturningVisitor(page);
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

/** KB: interface.md §79 — the sheet opens from the „New” menu, on one family, and shows only it. */
async function openSheet(page: Page, family: RegExp = /Flat shape/): Promise<void> {
  if (await page.locator('#setup').isHidden()) {
    await page.locator('#types-toggle').click();
    await page.locator('.type[data-type="regular"]').click();
    await page.getByRole('menuitem', { name: family }).click();
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

    await section.getByRole('button', { name: 'Create pattern' }).click();
    await expect(page.locator('#error-count')).toHaveText('No errors');

    const text = await writtenText(page);
    // The ribbed row starts with 2 chain stitches, because a chain stitch cannot stand in place of a post stitch (01 §2.2 [S25]).
    expect(text).toMatch(/ch 2 \(turning chain\)/);
    // The ribbing stands as a repeat, not listed stitch by stitch.
    expect(text).toMatch(/\[(FPdc|BPdc), (FPdc|BPdc)\]/);
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

    await section.getByRole('button', { name: 'Create pattern' }).click();
    await expect(page.locator('#error-count')).toHaveText('No errors');
    expect(await writtenText(page)).toMatch(/\((FPdc|BPdc), (FPdc|BPdc)\) x\d+/);

    // Reading the written pattern closes the sheet below 67 rem, where the two cannot
    // share the stage (PQW-987), so the generator is opened again.
    await openSheet(page);
    // The ribbed brim starts after the round is closed: in a spiral there is nowhere for it to start.
    await page.locator('#rounds-closing').selectOption('spiral');
    await expect(page.locator('#rounds-ribbing-fields')).toBeHidden();
  });
}
