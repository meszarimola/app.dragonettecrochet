/*
 * Undo and redo (PQW-1149): two toolbar buttons and their keys. Every change is
 * one step, a drag is one step however far it goes, and an arrangement is one
 * step however often its settings are turned. The canvas shows the DOM nothing,
 * so the stitches are read from the chart the page hands a driven browser.
 */

import { expect, type Page, test } from '@playwright/test';

interface Placed {
  readonly x: number;
  readonly y: number;
}

const board = (page: Page) => page.locator('#board');
const undoButton = (page: Page) => page.getByRole('button', { name: 'Undo' });
const redoButton = (page: Page) => page.getByRole('button', { name: 'Redo' });

async function stitches(page: Page): Promise<Placed[]> {
  return page.evaluate(
    () => (window as unknown as { dcFreeformChart: () => { stitches: Placed[] } }).dcFreeformChart().stitches,
  );
}

async function chartWith(page: Page, points: readonly [number, number][]): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  for (const [x, y] of points) await board(page).click({ position: { x, y } });
}

test('Undo and Redo walk back and forth over placed stitches', { tag: '@kiadas' }, async ({ page }) => {
  await page.goto('/');
  await expect(undoButton(page), 'nothing to undo before a chart').toBeDisabled();
  await chartWith(page, [
    [200, 200],
    [300, 200],
  ]);
  await expect(redoButton(page)).toBeDisabled();

  await undoButton(page).click();
  await expect(board(page)).toHaveAttribute('data-stitches', '1');
  await undoButton(page).click();
  await expect(board(page)).toHaveAttribute('data-stitches', '0');
  await expect(undoButton(page), 'the blank chart is where history starts').toBeDisabled();

  await redoButton(page).click();
  await redoButton(page).click();
  await expect(board(page)).toHaveAttribute('data-stitches', '2');
  await expect(redoButton(page)).toBeDisabled();

  await undoButton(page).click();
  await board(page).click({ position: { x: 400, y: 300 } });
  await expect(redoButton(page), 'a new change clears what could be redone').toBeDisabled();
});

test('Ctrl/⌘ + Z undoes; Ctrl/⌘ + Y and Ctrl/⌘ + Shift + Z redo', async ({ page }) => {
  await chartWith(page, [[200, 200]]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect(board(page)).toHaveAttribute('data-stitches', '0');
  await page.keyboard.press('ControlOrMeta+y');
  await expect(board(page)).toHaveAttribute('data-stitches', '1');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('ControlOrMeta+Shift+z');
  await expect(board(page)).toHaveAttribute('data-stitches', '1');
});

test('undoing a delete brings the stitches back selected', async ({ page }) => {
  await chartWith(page, [
    [200, 200],
    [300, 200],
  ]);
  await page.getByRole('button', { name: 'Select' }).click();
  await board(page).click({ position: { x: 200, y: 200 } });
  await page.keyboard.press('Delete');
  await expect(board(page)).toHaveAttribute('data-stitches', '1');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(board(page)).toHaveAttribute('data-stitches', '2');
  await expect(board(page)).toHaveAttribute('data-selected', '1');
});

test('a drag is one step, however many moves it takes', async ({ page }) => {
  await chartWith(page, [[200, 200]]);
  await page.getByRole('button', { name: 'Select' }).click();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 240, { steps: 8 });
  await page.mouse.move(box.x + 320, box.y + 260, { steps: 8 });
  await page.mouse.up();
  expect((await stitches(page))[0]!.x).toBeCloseTo(320, 0);

  await undoButton(page).click();
  const [stitch] = await stitches(page);
  expect(stitch!.x, 'back where it stood before the drag').toBeCloseTo(200, 0);
  expect(stitch!.y).toBeCloseTo(200, 0);
});

test('an arrangement and every turn of its settings undo in one step', async ({ page }) => {
  await chartWith(page, [
    [120, 200],
    [260, 120],
    [400, 260],
  ]);
  await page.getByRole('button', { name: 'Select' }).click();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 480, box.y + 360, { steps: 6 });
  await page.mouse.up();
  const before = await stitches(page);

  await page.getByRole('button', { name: 'In a row' }).click();
  const slider = page.getByRole('slider', { name: 'Spacing' });
  for (const gap of ['5', '6', '7', '8', '9']) await slider.fill(gap);
  await page.getByRole('textbox', { name: 'Spacing' }).fill('12');

  await slider.focus();
  await page.keyboard.press('ControlOrMeta+z');
  expect(await stitches(page), 'one undo, and the stitches stand where they did').toEqual(before);
  await expect(page.getByRole('slider', { name: 'Spacing' }), 'the arrangement has ended').toBeHidden();
});

test('New can be undone', async ({ page }) => {
  await chartWith(page, [[200, 200]]);
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(board(page)).toHaveAttribute('data-stitches', '0');
  await undoButton(page).click();
  await expect(board(page)).toHaveAttribute('data-stitches', '1');
});

test('a drag that ends where it began is not a step', async ({ page }) => {
  await chartWith(page, [
    [200, 200],
    [300, 200],
  ]);
  await page.getByRole('button', { name: 'Select' }).click();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 200, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 260, box.y + 200, { steps: 6 });
  await page.mouse.move(box.x + 200, box.y + 200, { steps: 6 });
  await page.mouse.up();
  await undoButton(page).click();
  await expect(board(page), 'the undo took the last placed stitch, not the empty drag').toHaveAttribute(
    'data-stitches',
    '1',
  );
});

test('New on a blank chart clears what could be redone', async ({ page }) => {
  await chartWith(page, [[200, 200]]);
  await undoButton(page).click();
  await expect(redoButton(page)).toBeEnabled();
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await expect(redoButton(page)).toBeDisabled();
});
