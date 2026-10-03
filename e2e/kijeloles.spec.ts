/*
 * Selection on the free-form chart (PQW-1143): with the Select tool one stitch is
 * taken by a click, several by dragging an area or by Shift + click, and what is
 * selected moves when dragged and turns on the round handle above it.
 */

import { expect, type Page, test } from '@playwright/test';

interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** The bounding box of the inked pixels inside a region of the board, in CSS pixels; null if none. */
async function inkBox(page: Page, region: Box): Promise<Box | null> {
  return page.locator('#board').evaluate((canvas: HTMLCanvasElement, r) => {
    const dpr = window.devicePixelRatio || 1;
    const [x0, y0] = [Math.round(r.minX * dpr), Math.round(r.minY * dpr)];
    const [w, h] = [Math.round((r.maxX - r.minX) * dpr), Math.round((r.maxY - r.minY) * dpr)];
    const data = canvas.getContext('2d')!.getImageData(x0, y0, w, h).data;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (data[(y * w + x) * 4 + 3]! === 0) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    if (minX === Infinity) return null;
    return { minX: (x0 + minX) / dpr, minY: (y0 + minY) / dpr, maxX: (x0 + maxX) / dpr, maxY: (y0 + maxY) / dpr };
  }, region);
}

const around = (x: number, y: number, half = 30): Box => ({
  minX: x - half,
  minY: y - half,
  maxX: x + half,
  maxY: y + half,
});

async function selected(page: Page): Promise<string | null> {
  return page.locator('#board').getAttribute('data-selected');
}

/** Opens a new chart and places a stitch at each point, then switches to the Select tool. */
async function chartWith(page: Page, stitch: RegExp, points: readonly [number, number][]): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: stitch }).click();
  for (const [x, y] of points) await page.locator('#board').click({ position: { x, y } });
  await page.getByRole('button', { name: 'Select' }).click();
  await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'true');
}

/** Drags on the board from one point to another, in board coordinates. */
async function drag(page: Page, from: [number, number], to: [number, number], shift = false): Promise<void> {
  const box = (await page.locator('#board').boundingBox())!;
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + (from[0] + to[0]) / 2, box.y + (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 4 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
}

test('a clicked stitch is selected, and dragging it moves it', { tag: '@kiadas' }, async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [[200, 200]]);
  await page.locator('#board').click({ position: { x: 200, y: 200 } });
  expect(await selected(page)).toBe('1');

  await drag(page, [200, 200], [400, 260]);
  expect(await inkBox(page, around(400, 260)), 'the stitch is at its new place').not.toBeNull();
  expect(await inkBox(page, around(200, 200, 12)), 'and gone from the old one').toBeNull();
  expect(await selected(page), 'it stays selected').toBe('1');
});

test('a dragged area selects several stitches, and they move together', async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [
    [150, 150],
    [220, 150],
    [500, 400],
  ]);
  await drag(page, [120, 120], [260, 190]);
  expect(await selected(page)).toBe('2');

  await drag(page, [150, 150], [150, 300]);
  expect(await inkBox(page, around(150, 300, 15))).not.toBeNull();
  expect(await inkBox(page, around(220, 300, 15))).not.toBeNull();
  expect(await inkBox(page, around(500, 400, 15)), 'the stitch outside the area stays').not.toBeNull();
  expect(await inkBox(page, around(185, 150, 50)), 'nothing is left where the two stood').toBeNull();
});

test('the selection moves from anywhere in its frame, and a stitch under the frame stays put', async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [
    [150, 150],
    [250, 250],
    [200, 200],
  ]);
  const board = page.locator('#board');
  await board.click({ position: { x: 150, y: 150 } });
  await board.click({ position: { x: 250, y: 250 }, modifiers: ['Shift'] });
  expect(await selected(page)).toBe('2');

  await drag(page, [170, 230], [170, 280]);
  await drag(page, [200, 200], [200, 300]);
  expect(await selected(page), 'a press on the unselected stitch did not change the selection').toBe('2');

  await page.keyboard.press('Escape');
  expect(await inkBox(page, around(150, 300, 15)), 'the first stitch moved down twice').not.toBeNull();
  expect(await inkBox(page, around(250, 400, 15)), 'and the second with it').not.toBeNull();
  expect(await inkBox(page, around(200, 200, 15)), 'the stitch under the frame stayed').not.toBeNull();
  expect(await inkBox(page, around(150, 150, 15))).toBeNull();
  expect(await inkBox(page, around(250, 250, 15))).toBeNull();

  await drag(page, [100, 150], [300, 450]);
  expect(await selected(page), 'a new area takes every stitch in it').toBe('3');
});

test('Shift + click adds a stitch to the selection and takes it out again', async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [
    [150, 150],
    [350, 150],
  ]);
  const board = page.locator('#board');
  await board.click({ position: { x: 150, y: 150 } });
  await board.click({ position: { x: 350, y: 150 }, modifiers: ['Shift'] });
  expect(await selected(page)).toBe('2');
  await board.click({ position: { x: 350, y: 150 }, modifiers: ['Shift'] });
  expect(await selected(page)).toBe('1');
});

test('Ctrl or ⌘ + click adds a stitch to the selection too, and takes it out again', async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [
    [150, 150],
    [350, 150],
    [550, 150],
  ]);
  const board = page.locator('#board');
  await board.click({ position: { x: 150, y: 150 } });
  await board.click({ position: { x: 350, y: 150 }, modifiers: ['ControlOrMeta'] });
  await board.click({ position: { x: 550, y: 150 }, modifiers: ['ControlOrMeta'] });
  expect(await selected(page)).toBe('3');
  await board.click({ position: { x: 350, y: 150 }, modifiers: ['ControlOrMeta'] });
  expect(await selected(page)).toBe('2');
});

test('the round handle turns the selection, and the handle turns with it', async ({ page }) => {
  await chartWith(page, /^Double crochet \(dc\)/, [[300, 300]]);
  await page.locator('#board').click({ position: { x: 300, y: 300 } });

  // The handle is the topmost ink straight above the stitch.
  const column = (await inkBox(page, { minX: 299, minY: 150, maxX: 301, maxY: 300 }))!;
  const handle: [number, number] = [300, column.minY + 6];
  const reach = 300 - handle[1];
  // A quarter turn clockwise: from straight above the centre to straight right of it.
  await drag(page, handle, [300 + reach, 300]);

  // The handle followed: it now stands to the right of the stitch, and nothing is left above it.
  expect(await inkBox(page, around(300 + reach, 300, 5)), 'the handle is to the right').not.toBeNull();
  expect(await inkBox(page, around(300, handle[1], 5)), 'and gone from above').toBeNull();

  await page.keyboard.press('Escape');
  const turned = (await inkBox(page, around(300, 300, 30)))!;
  expect(turned.maxX - turned.minX, 'turned a quarter, it lies flat').toBeGreaterThan(turned.maxY - turned.minY);
});

test('a corner handle makes the selection larger and smaller, gaps included', async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [
    [300, 300],
    [360, 300],
  ]);
  await drag(page, [270, 270], [390, 330]);
  expect(await selected(page)).toBe('2');
  // The frame's lower right corner: the lowest, rightmost ink below the handle.
  const frame = (await inkBox(page, { minX: 250, minY: 270, maxX: 420, maxY: 360 }))!;
  const corner: [number, number] = [frame.maxX - 4, frame.maxY - 4];
  const center: [number, number] = [330, 300];
  // Twice as far from the centre: twice the size.
  await drag(page, corner, [center[0] + (corner[0] - center[0]) * 2, center[1] + (corner[1] - center[1]) * 2]);
  await page.keyboard.press('Escape');

  expect(await inkBox(page, around(270, 300, 6)), 'the left stitch moved out to x = 270').not.toBeNull();
  expect(await inkBox(page, around(390, 300, 6)), 'the right one to x = 390').not.toBeNull();
  const big = (await inkBox(page, around(390, 300, 40)))!;
  expect(big.maxX - big.minX, 'a single crochet is drawn twice as wide').toBeGreaterThan(36);

  await page.locator('#board').click({ position: { x: 390, y: 300 } });
  const small = (await inkBox(page, { minX: 340, minY: 250, maxX: 460, maxY: 360 }))!;
  await drag(
    page,
    [small.maxX - 4, small.maxY - 4],
    [390 + (small.maxX - 4 - 390) / 4, 300 + (small.maxY - 4 - 300) / 4],
  );
  await page.keyboard.press('Escape');
  const shrunk = (await inkBox(page, around(390, 300, 40)))!;
  expect(shrunk.maxX - shrunk.minX, 'and a quarter of that after shrinking').toBeLessThan(16);
});

test('a plain click on one stitch of a selection narrows it to that one, and does not move it', async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [
    [150, 150],
    [220, 150],
  ]);
  await drag(page, [120, 120], [260, 190]);
  expect(await selected(page)).toBe('2');
  // Two pixels of jitter between the press and the release is still a click.
  await drag(page, [220, 150], [222, 150]);
  expect(await selected(page)).toBe('1');
  const box = (await inkBox(page, around(220, 150, 20)))!;
  expect(Math.abs((box.minX + box.maxX) / 2 - 220), 'the stitch did not shift').toBeLessThan(1);
});

test('a stitch dragged past the edge of the screen stays on the sheet, where zooming out reaches it (PQW-1160)', async ({
  page,
}) => {
  await chartWith(page, /^Single crochet \(sc\)/, [[100, 100]]);
  await page.locator('#board').click({ position: { x: 100, y: 100 } });
  const board = (await page.locator('#board').boundingBox())!;
  await page.mouse.move(board.x + 100, board.y + 100);
  await page.mouse.down();
  await page.mouse.move(board.x - 200, board.y - 200, { steps: 6 });
  await page.mouse.up();
  expect(await inkBox(page, { minX: 0, minY: 0, maxX: 30, maxY: 30 }), 'it left the screen').toBeNull();
  await page.locator('#board').click({ position: { x: 500, y: 500 } });
  expect(await selected(page)).toBe('0');

  await page.getByRole('button', { name: 'Zoom out' }).click();
  await page.getByRole('button', { name: 'Zoom out' }).click();
  await expect(page.locator('#zoom-reset')).toHaveText('50%');
  // Zoomed to 50% about the middle, the stitch at (-200, -200) is drawn here.
  const at = { x: (-200 + board.width / 2) * 0.5, y: (-200 + board.height / 2) * 0.5 };
  await page.locator('#board').click({ position: at });
  expect(await selected(page), 'reached again').toBe('1');
});

test('near the top of the board the handle drops below the selection, and still turns it', async ({ page }) => {
  await chartWith(page, /^Double crochet \(dc\)/, [[300, 30]]);
  await page.locator('#board').click({ position: { x: 300, y: 30 } });
  const column = (await inkBox(page, { minX: 299, minY: 30, maxX: 301, maxY: 200 }))!;
  const handle: [number, number] = [300, column.maxY - 6];
  await drag(page, handle, [300 - (handle[1] - 30), 30]);
  const turned = (await inkBox(page, around(300, 30, 24)))!;
  expect(turned.maxX - turned.minX, 'turned a quarter, it lies flat').toBeGreaterThan(turned.maxY - turned.minY);
});

test('a click on empty paper or Escape clears the selection, and a stitch tile puts Select down', async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [[200, 200]]);
  const board = page.locator('#board');
  await board.click({ position: { x: 200, y: 200 } });
  await board.click({ position: { x: 500, y: 500 } });
  expect(await selected(page)).toBe('0');

  await board.click({ position: { x: 200, y: 200 } });
  await page.keyboard.press('Escape');
  expect(await selected(page)).toBe('0');

  await page.getByRole('button', { name: /^Chain \(ch\)/ }).click();
  await expect(page.getByRole('button', { name: 'Select' })).toHaveAttribute('aria-pressed', 'false');
  await board.click({ position: { x: 200, y: 200 } });
  expect(await selected(page), 'a click with a stitch armed places, it does not select').toBe('0');
});

test('a stitch shrunk to the smallest size is still taken by a press on it, and moves', async ({ page }) => {
  await chartWith(page, /^Single crochet \(sc\)/, [[300, 300]]);
  await page.locator('#board').click({ position: { x: 300, y: 300 } });
  const frame = (await inkBox(page, around(300, 300, 30)))!;
  // Far past the centre: the resize stops at the smallest size.
  await drag(page, [frame.maxX - 4, frame.maxY - 4], [250, 250]);
  await page.keyboard.press('Escape');
  const tiny = (await inkBox(page, around(300, 300, 30)))!;
  expect(tiny.maxX - tiny.minX, 'it is a quarter of its size').toBeLessThan(10);

  await page.locator('#board').click({ position: { x: 301, y: 301 } });
  expect(await selected(page)).toBe('1');
  await drag(page, [301, 301], [450, 380]);
  await page.keyboard.press('Escape');
  expect(await inkBox(page, around(449, 379, 10)), 'it moved, it did not grow').not.toBeNull();
  expect(await inkBox(page, around(300, 300, 10))).toBeNull();
});
