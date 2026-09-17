/*
 * Rácsos technikák, második rész (PQW-894): mozaik egy kihagyással hibátlan, az
 * írott minta a lejjebb horgolt szemet jelöli, az SVG-export a talpát; filé a
 * sor eleji fogyasztással és a sor végi szaporítással hibátlan; kép betöltése
 * a rácsba a mintasűrűség arányában.
 */

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function openGrid(page: Page) {
  const section = page.locator('#section-grid');
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function setSize(page: Page, width: number, height: number): Promise<void> {
  for (const [id, value] of [
    ['#grid-width', width],
    ['#grid-height', height],
  ] as const) {
    const input = page.locator(id);
    await input.fill(String(value));
    await input.blur();
  }
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

const cell = (page: Page, x: number, y: number) => page.locator(`#grid-board [data-x="${x}"][data-y="${y}"]`);

test('mozaik egy kihagyással: hibátlan, az írott minta a lejjebb horgolt szemet, az SVG a talpát jelöli', async ({ page }) => {
  await open(page);
  const section = await openGrid(page);
  await page.locator('#grid-technique').selectOption({ label: 'Mozaik' });
  await expect(page.locator('#grid-mosaic-field')).toBeVisible();
  await setSize(page, 5, 4);
  await expect(page.locator('#grid-board [role="gridcell"]')).toHaveCount(20);

  // A 2. sor közepén A színű cella: ott kihagyás, a 3. sorban fölötte lejjebb horgolt pálca.
  await section.getByRole('radio', { name: 'A: Natúr' }).check();
  await cell(page, 2, 1).click();
  await expect(page.locator('#grid-details')).toContainText('Egysoros mozaik: a lejjebb horgolt szem egyráhajtásos pálca 2 sorral lejjebb, összesen 1.');

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Mozaik: 4 sor elkészült');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  expect(await writtenText(page)).toContain('1 erp 2 sorral lejjebb');

  const download = page.waitForEvent('download');
  // Az export a fájlműveletek lenyílójában van (PQW-911).
  await page.locator('#file-toggle').click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toContain('data-spike');
  expect(svg).toContain('Pötty a szár végén');
});

test('alakított filé: a sor eleji fogyasztás és a sor végi szaporítás hibátlan, az írott minta kiírja', async ({ page }) => {
  await open(page);
  await page.locator('.type[data-type="filet"]').click();
  const section = await openGrid(page);
  await setSize(page, 4, 3);

  // Az 1. és a 3. sor jobb szélén nincs cella: a 2. sor végén új nyitott cella, a 3. sor elején fogyasztás.
  await section.getByRole('radio', { name: 'Nincs cella (alakítás)' }).check();
  await cell(page, 3, 0).click();
  await cell(page, 3, 2).click();
  await expect(page.locator('#grid-details')).toContainText('Szaporítás a sor végén a 2. sorban');
  await expect(page.locator('#grid-details')).toContainText('Fogyasztás a sor elején a 3. sorban');

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Filé: 3 sor elkészült');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toContain('háromráhajtásos pálca 2 sorral lejjebb');
  expect(text).toMatch(/4\. sor: 4 ksz, 3 lsz/);
});

test('kép betöltése: a rács a megadott szélességű, a kép sötét fele teli cella', async ({ page }) => {
  await open(page);
  await page.locator('.type[data-type="filet"]').click();
  await openGrid(page);
  await setSize(page, 10, 8);

  // 40 × 20 képpontos kép a böngészőben rajzolva: bal fele fekete, jobb fele fehér.
  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 20;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 40, 20);
    context.fillStyle = '#000000';
    context.fillRect(0, 0, 20, 20);
    return canvas.toDataURL('image/png');
  });
  await page.locator('#grid-image').setInputFiles({
    name: 'motivum.png',
    mimeType: 'image/png',
    buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
  });
  await expect(page.locator('#status')).toContainText(/A kép betöltve: 10 × \d+ cella, a mintasűrűség arányában\./);
  await expect(cell(page, 0, 0)).toHaveAttribute('aria-label', /: teli$/);
  await expect(cell(page, 9, 0)).toHaveAttribute('aria-label', /: nyitott$/);
});
