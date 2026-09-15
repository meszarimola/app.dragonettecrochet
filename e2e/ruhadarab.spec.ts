/*
 * Ruhadarabok (PQW-866): a „Ruhadarab” szakaszból felnőtt sapka és ledobott
 * vállú pulóver M méretben, méretsorozattal. Mindkettő hibátlan, az írott
 * mintában a „Méretek” blokk „S (M, L)” alakban áll, és a létrehozás egy
 * lépésben visszavonható.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function openGarment(page: Page) {
  const section = page.locator('#section-garment');
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('felnőtt sapka M méretben, S–L sorozattal: hibátlan, a Méretek blokkal', async ({ page }) => {
  await open(page);
  const section = await openGarment(page);

  await page.locator('#garment-kind').selectOption({ label: 'Sapka' });
  await expect(page.locator('#garment-table-field')).toBeHidden();
  await expect(page.locator('#garment-size')).toHaveValue('adult-m');
  await expect(page.locator('#garment-hem-label')).toHaveText('Perem, cm');
  await expect(page.locator('#garment-result')).toHaveText(/^Felnőtt M: kész körméret ≈ \d+ cm, magasság ≈ \d+ cm; \d+ kör\.$/);
  await expect(page.locator('#garment-checks')).toHaveText(/^Minden ellenőrzés igaz: (\d+)\/\1, 3 méret\.$/);
  await expect(page.locator('#garment-series li').first()).toHaveText('Felnőtt S (Felnőtt M, Felnőtt L)');

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Sapka, Felnőtt M méret (3 méretes sorozattal) elkészült');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toContain('Méretek\nFelnőtt S (Felnőtt M, Felnőtt L)');
  expect(text).toMatch(/Korona: \d+ \(\d+, \d+\) kör/);
});

test('ledobott vállú pulóver M méretben, S–L sorozattal: négy darab varrásokkal, hibátlan, visszavonható', async ({ page }) => {
  await open(page);
  const section = await openGarment(page);

  await expect(page.locator('#garment-kind')).toHaveValue('drop-shoulder');
  await expect(page.locator('#garment-size')).toHaveValue('M');
  await expect(page.locator('#garment-result')).toHaveText(/^M: kész mellbőség ≈ \d+ cm, hossz ≈ \d+ cm, ujjhossz ≈ \d+ cm\.$/);
  await expect(page.locator('#garment-checks')).toHaveText(/^Minden ellenőrzés igaz/);
  await expect(page.locator('#garment-failed li')).toHaveCount(0);

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Ledobott vállú pulóver, M méret (3 méretes sorozattal) elkészült');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toContain('Méretek\nS (M, L)');
  expect(text).toMatch(/Bal ujj\nLáncalap: \d+ lsz\./);
  expect(text).toMatch(/Varrás: Hátrész, 1–\d+\. sor bal széle \(\d+ sorvég\) → Elejerész/);

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Visszavonva.');
  await expect(page.locator('#written-text')).not.toContainText('Méretek');
});
