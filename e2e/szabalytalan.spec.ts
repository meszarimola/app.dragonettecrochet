/*
 * The free-form chart type in the browser (PQW-963): choosing the type, placing
 * stitches with one click, selecting and duplicating them, undo, the JSON round
 * trip, and that switching types keeps both patterns.
 */

import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseIrregular(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Szabálytalan horgolás/ }).click();
  await expect(page.locator('#board-irregular')).toBeVisible();
}

const board = '#board-irregular';

/** Places the armed stitch at a point measured from the canvas's top left corner. */
async function place(page: Page, x: number, y: number): Promise<void> {
  await page.locator(board).click({ position: { x, y } });
}

async function armDoubleCrochet(page: Page): Promise<void> {
  await page.locator(board).focus();
  await page.keyboard.press('Alt+5');
}

test('the free-form type opens its own canvas and hides what belongs to rows', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  await expect(page.locator('#board')).toBeHidden();
  await expect(page.locator('#section-irregular')).toBeVisible();
  // Filling a row, turning, closing and spiralling belong to regular crochet only.
  await expect(page.locator('#tools-row')).toBeHidden();

  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator(board)).toBeHidden();
  await expect(page.locator('#tools-row')).toBeVisible();
});

test('one click places one stitch, and the tool stays armed', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);

  await place(page, 500, 300);
  await expect(page.locator('#status')).toContainText('1. sor');
  await expect(page.locator('#status')).toContainText('1 szem');

  await place(page, 560, 300);
  await place(page, 620, 300);
  await expect(page.locator('#status')).toContainText('3 szem');
});

test('selecting, duplicating and undo (AS-15, AS-19)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560, 620]) await place(page, x, 300);

  // Esc lays the stitch down, so the next click selects instead of placing.
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 szem kijelölve');

  await page.getByRole('button', { name: 'Duplikálás' }).click();
  await expect(page.locator('#status')).toContainText('3 szem másolva');

  // Undo takes the copies back, so nothing that was selected is left.
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 szem kijelölve');
});

test('the drawing survives a reload, and switching types keeps both patterns (AS-1)', async ({ page }) => {
  await open(page);

  // A regular pattern first: a foundation chain of three.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const regularBefore = await page.locator('#summary').textContent();

  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560]) await place(page, x, 300);
  await expect(page.locator('#status')).toContainText('2 szem');

  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#summary')).toHaveText(regularBefore ?? '');

  await page.reload();
  const denyAgain = page.getByRole('button', { name: 'Elutasítom' });
  if (await denyAgain.isVisible()) await denyAgain.click();
  await chooseIrregular(page);
  await expect(page.locator('#props-count')).toContainText('Nincs kijelölt szem');
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('2 szem kijelölve');
});

test('the JSON round trip keeps the free-form chart (AS-12)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560, 620]) await place(page, x, 300);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.getByRole('button', { name: 'JSON mentése' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const saved = await readFile((await download.path()) ?? '', 'utf8');
  const parsed = JSON.parse(saved);
  expect(parsed.type).toBe('irregular');
  expect(parsed.items).toHaveLength(3);

  // An empty pattern says nothing about a selection, so the note is blank.
  await page.getByRole('button', { name: 'Új minta' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#props-count')).toHaveText('');

  await page.locator('#file-toggle').click();
  await page.locator('#import-file').setInputFiles({
    name: 'szabalytalan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved, 'utf8'),
  });
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 szem kijelölve');
});

test('keys that belong to rows never reach the regular pattern hiding behind this type', async ({ page }) => {
  await open(page);

  // A regular pattern of two chains to compare against.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const before = await page.locator('#summary').textContent();

  await chooseIrregular(page);
  await page.locator(board).focus();
  // Filling, turning, closing, spiralling and crocheting all belong to rows.
  for (const key of ['Alt+f', 'Shift+Alt+f', 'Alt+k', 'Alt+s', 'Enter', 'Enter']) {
    await page.keyboard.press(key);
  }
  // Delete with a toolbar button focused used to delete the regular pattern's last stitch.
  await page.getByRole('button', { name: 'Duplikálás' }).focus();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');

  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#summary')).toHaveText(before ?? '');
});

test('rows and rounds: a second row, its own colour, and the stitch order overlay (AS-16)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560, 620]) await place(page, x, 420);
  await expect(page.locator('#rows-list li')).toHaveCount(1);
  await expect(page.locator('#rows-list')).toContainText('3 szem');

  // A new row takes the opposite direction, and new stitches land in it.
  await page.locator('#row-new').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);
  await expect(page.locator('#row-direction')).toHaveValue('rtl');
  await page.locator(board).focus();
  await page.keyboard.press('Alt+1');
  for (const x of [510, 570]) await place(page, x, 340);
  await expect(page.locator('#rows-list')).toContainText('2 szem');

  // The order runs right to left in this row, so the leftmost stitch is the second.
  await page.locator('#row-order-overlay').check();
  await expect(page.locator('#row-order-overlay')).toBeChecked();

  await page.locator('#row-color').fill('#b07cc6');
  await page.locator('#row-color').dispatchEvent('change');
  await page.locator('#row-select').click();
  await expect(page.locator('#status')).toContainText('2 szem kijelölve');
});

test('the stitch key changes the symbol everywhere, and the legend can go on the image (AS-4)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await page.locator(board).focus();
  await page.keyboard.press('Alt+1');
  for (const x of [500, 560, 620]) await place(page, x, 400);

  await page.locator('#section-irregular-key > summary').click();
  const chain = page.locator('#key-list li').filter({ hasText: 'láncszem' });
  await expect(chain).toHaveCount(1);
  await expect(chain).toContainText('3');

  // The pattern may draw a chain with any symbol it likes; the reference charts use „0”.
  // The chain's oval lies flat and the „0” stands upright, so the drawn stitches
  // have to turn with it — the symbol must not be squeezed into the old one's box.
  const widthOf = async (): Promise<number[]> =>
    page.evaluate(() => {
      const saved = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const items = (JSON.parse(saved).items ?? []) as { width: number; height: number }[];
      return items.map((item) => item.width / item.height);
    });
  const flat = await widthOf();
  expect(flat.every((ratio) => ratio > 1)).toBe(true);

  await chain.locator('select').selectOption('zero');
  await expect(chain.locator('select')).toHaveValue('zero');
  const upright = await widthOf();
  expect(upright).toHaveLength(flat.length);
  expect(upright.every((ratio) => ratio < 1)).toBe(true);

  await page.locator('#legend-on-image').check();
  await expect(page.locator('#legend-on-image')).toBeChecked();

  // The key survives a save and a reload.
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.getByRole('button', { name: 'JSON mentése' }).click();
  const saved = await readFile((await (await downloadPromise).path()) ?? '', 'utf8');
  const parsed = JSON.parse(saved);
  expect(parsed.stitchKey).toHaveLength(1);
  expect(parsed.stitchKey[0].glyphOverride).toBe('zero');
  expect(parsed.legend.visible).toBe(true);
});

test('layers: a second layer takes the selected stitches, and hiding it hides them', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560]) await place(page, x, 400);

  await page.locator('#section-irregular-layers > summary').click();
  await expect(page.locator('#layers-list li')).toHaveCount(2);

  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('2 szem kijelölve');

  await page.locator('#layer-new').click();
  await expect(page.locator('#layers-list li')).toHaveCount(3);
  await page.locator('#layer-move-items').click();
  await expect(page.locator('#status')).toContainText('2 szem áthelyezve');

  // A hidden layer's stitches cannot be selected, though they are still in the pattern.
  await page.locator('#layers-list li').first().getByRole('button', { name: 'Látható' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#props-count')).toContainText('Nincs kijelölt szem');
});

test('two stitches drawn with one symbol are reported in the issues list (AS-5)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

  // A chain and a slip stitch, then the chain redrawn as a dot — the slip stitch's own symbol.
  await page.locator(board).focus();
  await page.keyboard.press('Alt+1');
  await place(page, 500, 400);
  await page.keyboard.press('Alt+2');
  await place(page, 560, 400);

  await page.locator('#section-irregular-key > summary').click();
  await page.locator('#key-list li').filter({ hasText: 'láncszem' }).locator('select').selectOption('dot');
  await expect(page.locator('#key-preset')).toContainText('Saját');

  await page.locator('#error-toggle').click();
  await expect(page.locator('#findings')).toContainText('Ugyanaz a jel két szemet jelöl');
});

/** Every stitch in the autosaved pattern, with the guides that were in force. */
async function stored(page: Page): Promise<{
  items: { x: number; y: number; rotation: number }[];
  polar: { center: { x: number; y: number }; visible: boolean };
  grid: { visible: boolean; size: number };
  snap: boolean;
}> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    const parsed = JSON.parse(raw);
    return {
      items: parsed.items ?? [],
      polar: parsed.guides?.polar ?? { center: { x: 0, y: 0 }, visible: false },
      grid: parsed.guides?.grid ?? { visible: false, size: 0 },
      snap: parsed.guides?.snap ?? false,
    };
  });
}

test('snapping puts a new stitch on the grid, whatever the click hits', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  await page.locator('#guide-grid-size').fill('25');
  await page.locator('#guide-grid-size').blur();
  await page.locator('[data-action="grid"]').click();
  await page.locator('#guide-snap').check();
  await expect(page.locator('#guide-snap')).toBeChecked();

  await armDoubleCrochet(page);
  for (const [x, y] of [
    [483, 257],
    [563, 331],
    [643, 259],
  ]) {
    await place(page, x, y);
  }

  const { items, grid, snap } = await stored(page);
  expect(grid.size, 'a rács mérete a beírt érték').toBe(25);
  expect(snap, 'az illesztés be van kapcsolva').toBe(true);
  expect(grid.visible, 'a rács látszik').toBe(true);
  expect(items, 'három szem került le').toHaveLength(3);
  for (const item of items) {
    // A negative multiple gives -0, which is not `0` to a strict comparison.
    expect(Math.abs(item.x % 25), 'a szem a rács vonalára került vízszintesen').toBe(0);
    expect(Math.abs(item.y % 25), 'a szem a rács vonalára került függőlegesen').toBe(0);
  }
});

test('the circle guide turns the new stitches away from its middle (AS-6 előkészítése)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  await page.locator('#guide-polar').check();
  await expect(page.locator('#guide-polar-fields')).toBeVisible();
  await page.locator('#guide-radial').check();

  await armDoubleCrochet(page);
  for (const [x, y] of [
    [520, 200],
    [660, 320],
    [520, 440],
    [380, 320],
  ]) {
    await place(page, x, y);
  }

  const { items, polar } = await stored(page);
  expect(polar.visible, 'a körrács látszik').toBe(true);
  expect(items, 'négy szem került le').toHaveLength(4);

  const turns = items.map((item) => {
    const wanted = (Math.atan2(item.x - polar.center.x, polar.center.y - item.y) * 180) / Math.PI;
    return Math.abs(((item.rotation - wanted + 540) % 360) - 180);
  });
  for (const gap of turns) {
    expect(gap, 'a szem teteje a középponttól kifelé néz').toBeLessThan(0.01);
  }
  expect(new Set(items.map((item) => Math.round(item.rotation))).size, 'a négy irány négyféle elfordulás').toBe(4);
});

test('⌘ a húzáson az illesztést kapcsolja ki, nem a kijelölést bontja meg', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);

  // Where the chart's origin sits on the canvas, measured with the first stitch,
  // so the drag can start exactly on a stitch and not on a resize handle.
  await place(page, 500, 300);
  const first = (await stored(page)).items[0];
  if (first === undefined) throw new Error('no stitch');
  const view = { x: 500 - first.x, y: 300 - first.y };

  await page.locator('#guide-grid-size').fill('20');
  await page.locator('#guide-grid-size').blur();
  await page.locator('[data-action="grid"]').click();
  await page.locator('#guide-snap').check();

  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await place(page, 500, 300);
  await expect(page.locator('#props-count')).toContainText('1');

  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  const drag = async (from: { x: number; y: number }, dx: number, dy: number, free: boolean): Promise<void> => {
    if (free) await page.keyboard.down('Meta');
    await page.mouse.move(rect.x + from.x + view.x, rect.y + from.y + view.y);
    await page.mouse.down();
    await page.mouse.move(rect.x + from.x + view.x + dx, rect.y + from.y + view.y + dy, { steps: 10 });
    await page.mouse.up();
    if (free) await page.keyboard.up('Meta');
  };

  await drag(first, 37, 23, true);
  await expect(page.locator('#props-count'), 'a kijelölés együtt marad').toContainText('1');
  const free = (await stored(page)).items[0];
  if (free === undefined) throw new Error('no stitch');
  expect(free.x - first.x, 'pont annyit mozdult, amennyit húztam').toBeCloseTo(37, 6);
  expect(free.y - first.y, 'pont annyit mozdult, amennyit húztam').toBeCloseTo(23, 6);

  // The same drag without the key lands on the grid.
  await drag(free, 11, 7, false);
  const snapped = (await stored(page)).items[0];
  if (snapped === undefined) throw new Error('no stitch');
  expect(Math.abs(snapped.x % 20), 'billentyű nélkül a rácsra ugrik').toBe(0);
  expect(Math.abs(snapped.y % 20), 'billentyű nélkül a rácsra ugrik').toBe(0);
});

test('⌘ + kattintás húzás nélkül továbbra is kivesz egy szemet a kijelölésből', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [480, 560, 640]) await place(page, x, 300);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a');
  await expect(page.locator('#props-count')).toContainText('3');

  await page.locator(board).click({ position: { x: 560, y: 300 }, modifiers: ['Meta'] });
  await expect(page.locator('#props-count'), 'a középső kikerült').toContainText('2');
});
