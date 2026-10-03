/*
 * Zoom and moving the view on the free-form board (PQW-1158): the buttons beside
 * Delete, the mouse wheel about the pointer, and three ways to move the view that
 * never touch the chart or the selection. KB: interface.md §87
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
const panTool = (page: Page) => page.getByRole('button', { name: 'Move view' });

async function stitches(page: Page): Promise<Placed[]> {
  return page.evaluate(
    () => (window as unknown as { dcFreeformChart: () => { stitches: Placed[] } }).dcFreeformChart().stitches,
  );
}

async function newChart(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
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

test('the zoom buttons step the level, and the level returns to 100%', { tag: '@kiadas' }, async ({ page }) => {
  await page.goto('/');
  await expect(zoomIn(page), 'nothing to zoom before a chart').toBeDisabled();
  await page.getByRole('button', { name: 'New' }).click();
  await expect(level(page)).toHaveText('100%');
  await expect(zoomOut(page), 'already at the smallest').toBeDisabled();

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
  await expect(level(page)).toHaveText('100%');
  expect(await stitches(page), 'zooming changed nothing in the chart').toHaveLength(1);
});

test('the Move view tool moves the view, not the stitches or the selection', async ({ page }) => {
  await newChart(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await board(page).click({ position: { x: 300, y: 200 } });
  await page.getByRole('button', { name: 'Select' }).click();
  await board(page).click({ position: { x: 300, y: 200 } });
  await expect(board(page)).toHaveAttribute('data-selected', '1');
  for (let i = 0; i < 3; i += 1) await zoomIn(page).click();
  const before = await stitches(page);

  await panTool(page).click();
  await expect(panTool(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Select' }), 'one mode at a time').toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await dragOnBoard(page, [300, 200], [200, 150]);
  expect(await stitches(page), 'the chart did not move').toEqual(before);
  await expect(board(page), 'the selection stayed').toHaveAttribute('data-selected', '1');

  await panTool(page).click();
  await expect(page.getByRole('button', { name: 'Select' }), 'back to the mode before').toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(board(page), 'and the selection with it').toHaveAttribute('data-selected', '1');
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
