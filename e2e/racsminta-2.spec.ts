/*
 * Grid-based techniques, part two (PQW-894): mosaic with one skip is error-free,
 * the written pattern marks the stitch worked lower down and the SVG export
 * marks its base; filet with the decrease at the start of the row and the
 * increase at the end of the row is error-free; loading an image into the grid
 * in proportion to the gauge.
 */

import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

/*
 * The filet crochet pattern type is switched off for the first round of
 * acceptance testing (KB: owner-decisions.md §13). We do NOT delete the tests:
 * when the type is switched back on, this single block is what goes away.
 */
test.beforeEach(() => {
  test.skip(true, 'PQW-925: the filet crochet pattern type is temporarily switched off');
});

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

async function openGrid(page: Page) {
  const section = page.locator('#section-grid');
  if (await section.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page);
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

test('mosaic with one skip: error-free, the written pattern marks the stitch worked lower down, the SVG marks its base', async ({
  page,
}) => {
  await open(page);
  const section = await openGrid(page);
  await page.locator('#grid-technique').selectOption({ label: 'Mozaik' });
  await expect(page.locator('#grid-mosaic-field')).toBeVisible();
  await setSize(page, 5, 4);
  await expect(page.locator('#grid-board [role="gridcell"]')).toHaveCount(20);

  // A cell of colour A in the middle of row 2: a skip there, and above it in row 3 a double crochet worked lower down.
  await section.getByRole('radio', { name: 'A: Natúr' }).check();
  await cell(page, 2, 1).click();
  await expect(page.locator('#grid-details')).toContainText(
    'Egysoros mozaik: a lejjebb horgolt szem egyráhajtásos pálca 2 sorral lejjebb, összesen 1.',
  );

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Mozaik: 4 sor elkészült');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  expect(await writtenText(page)).toContain('1 erp 2 sorral lejjebb');

  const download = page.waitForEvent('download');
  // The export is in the file actions dropdown (PQW-911).
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toContain('data-spike');
  expect(svg).toContain('Pötty a szár végén');
});

test('shaped filet: the decrease at the start of the row and the increase at the end of the row are error-free, and the written pattern spells them out', async ({
  page,
}) => {
  await open(page);
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="filet"]').click();
  const section = await openGrid(page);
  await setSize(page, 4, 3);

  // There is no cell at the right edge of rows 1 and 3: a new open cell at the end of row 2, a decrease at the start of row 3.
  await section.getByRole('radio', { name: 'Nincs cella (alakítás)' }).check();
  await cell(page, 3, 0).click();
  await cell(page, 3, 2).click();
  await expect(page.locator('#grid-details')).toContainText('Szaporítás a sor végén a 2. sorban');
  await expect(page.locator('#grid-details')).toContainText('Fogyasztás a sor elején a 3. sorban');

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Filé: 3 sor elkészült');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  // The widening at the end of the row is built from chain (03 §5.2, PQW-924); at the decrease the turning chain does not sit on a column.
  expect(text).toMatch(/3\. sor: .*, 3 lsz \(\d+ szem\)/);
  expect(text).toMatch(/4\. sor: 3 ksz, 3 lsz/);
});

test('loading an image: the grid has the given width, and the dark half of the image is filled cells', async ({
  page,
}) => {
  await open(page);
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="filet"]').click();
  await openGrid(page);
  await setSize(page, 10, 8);

  // A 40 × 20 pixel image drawn in the browser: its left half black, its right half white.
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
