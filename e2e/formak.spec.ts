/*
 * Flat shapes (PQW-862): from the „Forma” section a 20 × 30 cm half double
 * crochet rectangle without a profile, with an estimate marker, undone in one
 * step; an isosceles triangle from the angle of the edge. Each is error-free,
 * and the written pattern is produced.
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

async function openShapes(page: Page) {
  const section = page.locator('#section-shape');
  if (await section.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('20 × 30 cm half double crochet rectangle without a profile: estimated actual size, error-free rows, undone in one step', async ({
  page,
}) => {
  await open(page);
  const section = await openShapes(page);

  await expect(page.locator('#shape-stitch')).toHaveValue('hdc');
  await expect(page.locator('#shape-size')).toHaveText(/^Tényleges méret: ≈ \d+(,\d)? × \d+(,\d)? cm, \d+ sor\.$/);
  await expect(page.locator('#shape-source')).toContainText('Nincs profil: a méret becslés 4 mm-es tűből.');
  await expect(page.locator('#shape-preview polygon')).toHaveCount(1);
  // A rectangle has no angle and no top edge.
  await expect(page.locator('#shape-angle')).toBeHidden();
  await expect(page.locator('#shape-top')).toBeHidden();

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText(
    /Téglalap, \d+ sor elkészült; visszavonással a korábbi minta visszajön\./,
  );
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  // The 2-chain turning chain stands in place of half double crochet 1, on a foundation chain stitch (PQW-891).
  expect(text).toMatch(/2\. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 fp \(\d+ szem\)\. Fordítás\./);

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Visszavonva.');
  await expect(page.locator('#written-text')).not.toContainText('fp');
});

test('isosceles triangle from the angle of the edge: error-free, the written pattern is produced', async ({ page }) => {
  await open(page);
  const section = await openShapes(page);

  await page.locator('#shape-kind').selectOption({ label: 'Egyenlő szárú háromszög' });
  await expect(page.locator('#shape-width-label')).toHaveText('Alsó él, cm');
  await page.locator('#shape-measure').selectOption({ label: 'Az él szöge' });
  await expect(page.locator('#shape-height')).toBeHidden();
  await page.locator('#shape-width').fill('20');
  await page.locator('#shape-angle').fill('40');
  await expect(page.locator('#shape-details')).toContainText('Az él szöge a függőlegestől kb.');
  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Egyenlő szárú háromszög,');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  // The base stitch is the half double crochet: the edges decrease by crocheting half double crochets together.
  expect(await writtenText(page)).toMatch(
    /\d\. sor: 2 lsz \(1 fp-nek számít\), [23] fp összehorgolása, \d+ fp, [23] fp összehorgolása \(\d+ szem\)\./,
  );
});
