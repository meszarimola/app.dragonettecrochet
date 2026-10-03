/*
 * Zoom and moving the view on the free-form board (PQW-1158): the buttons beside
 * Delete, the mouse wheel about the pointer, and ways to move the view that never
 * touch the chart or the selection: since PQW-1159 a plain drag outside Select,
 * and Space or the middle button with any tool. KB: interface.md §87
 */

import { expect, type Page, test } from '@playwright/test';

interface Placed {
  readonly x: number;
  readonly y: number;
}

const board = (page: Page) => page.locator('#board');
const zoomIn = (page: Page) => page.getByRole('button', { name: 'Zoom in' });
const zoomOut = (page: Page) => page.getByRole('button', { name: 'Zoom out' });
const level = (page: Page) => page.locator('#zoom-reset');

async function stitches(page: Page): Promise<Placed[]> {
  return page.evaluate(
    () => (window as unknown as { dcFreeformChart: () => { stitches: Placed[] } }).dcFreeformChart().stitches,
  );
}

async function newChart(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
}

async function dragOnBoard(
  page: Page,
  from: [number, number],
  to: [number, number],
  button: 'left' | 'middle' = 'left',
) {
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down({ button });
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 6 });
  await page.mouse.up({ button });
}

/**
 * A new chart with one stitch 50 and 30 px off the board's middle, zoomed to 200%
 * about that middle; returns where the stitch is now on screen.
 */
async function stitchAt200(page: Page): Promise<{ x: number; y: number }> {
  await newChart(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  const box = (await board(page).boundingBox())!;
  const middle = { x: box.width / 2, y: box.height / 2 };
  await board(page).click({ position: { x: middle.x + 50, y: middle.y + 30 } });
  for (let i = 0; i < 3; i += 1) await zoomIn(page).click();
  await expect(level(page)).toHaveText('200%');
  return { x: middle.x + 100, y: middle.y + 60 };
}

test('the zoom buttons step the level, and the level returns to 100%', { tag: '@kiadas' }, async ({ page }) => {
  await page.goto('/');
  await expect(zoomIn(page), 'nothing to zoom before a chart').toBeDisabled();
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await expect(level(page)).toHaveText('100%');
  await zoomOut(page).click();
  await zoomOut(page).click();
  await expect(level(page)).toHaveText('50%');
  await expect(zoomOut(page), 'already at the smallest').toBeDisabled();
  await level(page).click();

  await zoomIn(page).click();
  await zoomIn(page).click();
  await expect(level(page)).toHaveText('150%');
  await zoomOut(page).click();
  await expect(level(page)).toHaveText('125%');
  await level(page).click();
  await expect(level(page)).toHaveText('100%');
});

test('a click on a zoomed board places at the board point under the pointer', async ({ page }) => {
  await newChart(page);
  await zoomIn(page).click();
  await zoomIn(page).click();
  await zoomIn(page).click();
  await expect(level(page)).toHaveText('200%');
  const box = (await board(page).boundingBox())!;
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await board(page).click({ position: { x: box.width / 2 + 40, y: box.height / 2 + 20 } });
  const [placed] = await stitches(page);
  expect(placed!.x, 'zoomed about the middle, 40 px right is 20 board units right').toBeCloseTo(box.width / 2 + 20, 0);
  expect(placed!.y).toBeCloseTo(box.height / 2 + 10, 0);
});

test('the mouse wheel zooms about the pointer', async ({ page }) => {
  await newChart(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await board(page).click({ position: { x: 200, y: 150 } });
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 150);
  await page.mouse.wheel(0, -400);
  await expect(level(page)).not.toHaveText('100%');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Select' }).click();
  await board(page).click({ position: { x: 200, y: 150 } });
  await expect(board(page), 'the stitch is still under the pointer').toHaveAttribute('data-selected', '1');

  await page.mouse.wheel(0, 4000);
  await expect(level(page), 'the wheel stops at the smallest').toHaveText('50%');
  expect(await stitches(page), 'zooming changed nothing in the chart').toHaveLength(1);
});

test('outside Select a drag moves the view, armed or not, and lays nothing; a still click lays a stitch (PQW-1159)', async ({
  page,
}) => {
  const shown = await stitchAt200(page);
  const before = await stitches(page);

  await dragOnBoard(page, [shown.x, shown.y], [shown.x + 30, shown.y + 20]);
  expect(await stitches(page), 'with a stitch armed, the drag laid nothing and moved nothing').toEqual(before);
  await page.keyboard.press('Escape');
  await dragOnBoard(page, [shown.x + 30, shown.y + 20], [shown.x + 60, shown.y + 40]);
  expect(await stitches(page), 'with nothing armed, the same').toEqual(before);

  await page.getByRole('button', { name: 'Select' }).click();
  await board(page).click({ position: { x: shown.x + 60, y: shown.y + 40 } });
  await expect(board(page), 'the stitch is where the drags took the view').toHaveAttribute('data-selected', '1');
  await expect(page.locator('#pan-tool'), 'no hand tool').toHaveCount(0);
});

test('in Select a drag on empty ground still draws an area, not a pan', async ({ page }) => {
  const shown = await stitchAt200(page);
  await page.getByRole('button', { name: 'Select' }).click();
  await dragOnBoard(page, [shown.x - 40, shown.y - 40], [shown.x + 40, shown.y + 40]);
  await expect(board(page)).toHaveAttribute('data-selected', '1');
});

test('Ctrl + a mouse wheel notch zooms one notch, not to the top', async ({ page }) => {
  await newChart(page);
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect(level(page)).toHaveText('122%');
});

test('Ctrl + plus zooms over the drawing and leaves the page zoom alone elsewhere', async ({ page }) => {
  await newChart(page);
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.keyboard.press('Control+Equal');
  await expect(level(page)).toHaveText('125%');
  await page.mouse.move(box.x - 50, box.y + 200);
  await page.keyboard.press('Control+Equal');
  await expect(level(page), 'away from the drawing the key is the browser’s').toHaveText('125%');
});

test('a pan that ends off the canvas does not eat the next click', async ({ page }) => {
  await newChart(page);
  for (let i = 0; i < 3; i += 1) await zoomIn(page).click();
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(box.x - 40, box.y + 200, { steps: 6 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await board(page).click({ position: { x: 300, y: 200 } });
  expect(await stitches(page)).toHaveLength(1);
});

test('Space and the middle button move the view with a stitch armed, and lay nothing', async ({ page }) => {
  await newChart(page);
  for (let i = 0; i < 3; i += 1) await zoomIn(page).click();
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.keyboard.down('Space');
  await dragOnBoard(page, [300, 200], [150, 100]);
  await page.keyboard.up('Space');
  await dragOnBoard(page, [300, 200], [400, 300], 'middle');
  expect(await stitches(page), 'panning laid no stitch').toHaveLength(0);

  await board(page).click({ position: { x: 300, y: 200 } });
  expect(await stitches(page), 'a plain click still lays one').toHaveLength(1);
});

test('a placing click that wobbles a few pixels still lays its stitch', async ({ page }) => {
  await newChart(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 305, box.y + 203, { steps: 3 });
  await page.mouse.up();
  expect(await stitches(page)).toHaveLength(1);
});

test('a plain drag that ends off the canvas does not eat the next click', async ({ page }) => {
  const shown = await stitchAt200(page);
  await dragOnBoard(page, [shown.x, shown.y], [-60, shown.y]);
  await board(page).click({ position: { x: 300, y: 200 } });
  expect(await stitches(page), 'the second stitch is laid').toHaveLength(2);
});

test('holding the button still, Escape still disarms the stitch', async ({ page }) => {
  await newChart(page);
  const tile = page.getByRole('button', { name: /^Single crochet \(sc\)/ });
  await tile.click();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 300, box.y + 200);
  await page.mouse.down();
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(tile).toHaveAttribute('aria-pressed', 'false');
});

test('at 100% the whole drawing can be dragged down the screen, and a stitch is laid where it is clicked (PQW-1160)', async ({
  page,
}) => {
  await newChart(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await board(page).click({ position: { x: 300, y: 100 } });
  await dragOnBoard(page, [500, 100], [500, 400]);
  await expect(level(page)).toHaveText('100%');
  await board(page).click({ position: { x: 300, y: 50 } });
  const [first, second] = await stitches(page);
  expect(first!.y, 'the first stitch did not move on the sheet').toBeCloseTo(100, 0);
  expect(second!.y, 'clicked 50 px from the top of a view moved down 300').toBeCloseTo(-250, 0);

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Select' }).click();
  await board(page).click({ position: { x: 300, y: 400 } });
  await expect(board(page), 'the first stitch is now 300 px lower on screen').toHaveAttribute('data-selected', '1');
});

test('New starts from the default view again', async ({ page }) => {
  await newChart(page);
  await dragOnBoard(page, [500, 100], [500, 400]);
  await zoomIn(page).click();
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await expect(level(page)).toHaveText('100%');
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await board(page).click({ position: { x: 300, y: 200 } });
  const [placed] = await stitches(page);
  expect(placed!.x).toBeCloseTo(300, 0);
  expect(placed!.y).toBeCloseTo(200, 0);
});

test('zoomed in, a counted row wider than the screen is still laid', async ({ page }) => {
  await newChart(page);
  for (let i = 0; i < 7; i += 1) await zoomIn(page).click();
  await expect(level(page)).toHaveText('800%');
  await page.getByRole('button', { name: /^Double treble \(dtr\)/ }).click();
  await page.getByRole('textbox', { name: 'Count' }).fill('10');
  await board(page).click({ position: { x: 300, y: 200 } });
  expect(await stitches(page)).toHaveLength(10);
});

test('the level button brings back the default view after a pan', async ({ page }) => {
  await newChart(page);
  await dragOnBoard(page, [500, 100], [500, 400]);
  await level(page).click();
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await board(page).click({ position: { x: 300, y: 200 } });
  const [placed] = await stitches(page);
  expect(placed!.y, 'a screen point is the board point again').toBeCloseTo(200, 0);
});
