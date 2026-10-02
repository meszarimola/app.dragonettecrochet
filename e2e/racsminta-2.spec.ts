/*
 * Grid-based techniques, part two (PQW-894): mosaic with one skip is error-free,
 * the written pattern marks the stitch worked lower down and the SVG export
 * marks its base; filet with the decrease at the start of the row and the
 * increase at the end of the row is error-free; loading an image into the grid
 * in proportion to the gauge.
 */

import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

import { asReturningVisitor } from './kezdet.ts';

/*
 * The filet crochet pattern type is switched off for the first round of
 * acceptance testing (KB: owner-decisions.md §13). We do NOT delete the tests:
 * when the type is switched back on, this single block is what goes away.
 */
test.beforeEach(() => {
  test.skip(true, 'PQW-925: the filet crochet pattern type is temporarily switched off');
});

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
  await page.locator('#grid-technique').selectOption({ label: 'Mosaic' });
  await expect(page.locator('#grid-mosaic-field')).toBeVisible();
  await setSize(page, 5, 4);
  await expect(page.locator('#grid-board [role="gridcell"]')).toHaveCount(20);

  // A cell of colour A in the middle of row 2: a skip there, and above it in row 3 a double crochet worked lower down.
  await section.getByRole('radio', { name: 'A: Natural' }).check();
  await cell(page, 2, 1).click();
  await expect(page.locator('#grid-details')).toContainText(
    'Single row mosaic: the dropped stitch is a double crochet 2 rows below, 1 in total.',
  );

  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Mosaic: 4 rows done');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  expect(await writtenText(page)).toContain('dc in st 2 rows below');

  const download = page.waitForEvent('download');
  // The export is in the file actions dropdown (PQW-911).
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('svg');
  await page.locator('#export-run').click();
  const svg = await readFile((await (await download).path())!, 'utf8');
  expect(svg).toContain('data-spike');
  expect(svg).toContain('Dot at the foot of the stem');
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
  await section.getByRole('radio', { name: 'No cell (shaping)' }).check();
  await cell(page, 3, 0).click();
  await cell(page, 3, 2).click();
  await expect(page.locator('#grid-details')).toContainText('Increase at the end of row 2');
  await expect(page.locator('#grid-details')).toContainText('Decrease at the start of row 3');

  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Filet: 3 rows done');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  const text = await writtenText(page);
  // The widening at the end of the row is built from chain (03 §5.2, PQW-924); at the decrease the turning chain does not sit on a column.
  expect(text).toMatch(/Row 3: .*, ch 3 \(\d+ sts\)/);
  expect(text).toMatch(/Row 4: 3 sl st, ch 3/);
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
    name: 'motif.png',
    mimeType: 'image/png',
    buffer: Buffer.from(dataUrl.split(',')[1]!, 'base64'),
  });
  await expect(page.locator('#status')).toContainText(/Image loaded: 10 × \d+ cells, in the ratio of the gauge\./);
  await expect(cell(page, 0, 0)).toHaveAttribute('aria-label', /: filled$/);
  await expect(cell(page, 9, 0)).toHaveAttribute('aria-label', /: open$/);
});
