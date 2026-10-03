/*
 * Delete, duplicate, copy and paste (PQW-1145): the two buttons wake only with
 * a selection, Delete or Backspace deletes too, and Ctrl/⌘ + C then V pastes a
 * copy one step away, selected.
 *
 * Pixels alone cannot tell a copy from the selection frame drawn around its
 * source, so every action is checked by the board's stitch count first, and the
 * copy's place only after the selection is cleared.
 */

import { expect, type Page, test } from '@playwright/test';

/** Whether the board has ink in the square around a point, in CSS pixels. */
async function inkAt(page: Page, x: number, y: number, half = 4): Promise<boolean> {
  return page.locator('#board').evaluate(
    (canvas: HTMLCanvasElement, at) => {
      const dpr = window.devicePixelRatio || 1;
      const size = at.half * 2 * dpr;
      const data = canvas
        .getContext('2d')!
        .getImageData((at.x - at.half) * dpr, (at.y - at.half) * dpr, size, size).data;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) return true;
      return false;
    },
    { x, y, half },
  );
}

const board = (page: Page) => page.locator('#board');

/** A new chart with a single crochet at each point, the Select tool on, and the first one selected. */
async function chartWith(page: Page, points: readonly [number, number][]): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  for (const [x, y] of points) await board(page).click({ position: { x, y } });
  await page.getByRole('button', { name: 'Select' }).click();
  const [x, y] = points[0]!;
  await board(page).click({ position: { x, y } });
}

test('Duplicate and Delete wake with a selection, and do what they say', { tag: '@kiadas' }, async ({ page }) => {
  await chartWith(page, [[200, 200]]);
  const duplicate = page.getByRole('button', { name: 'Duplicate' });
  const remove = page.getByRole('button', { name: 'Delete' });
  await expect(duplicate).toBeEnabled();
  await expect(remove).toBeEnabled();

  await duplicate.click();
  await expect(board(page)).toHaveAttribute('data-stitches', '2');
  await expect(board(page), 'the copy is what is selected').toHaveAttribute('data-selected', '1');

  await remove.click();
  await expect(board(page)).toHaveAttribute('data-stitches', '1');
  await expect(duplicate).toBeDisabled();
  await expect(remove).toBeDisabled();
  expect(await inkAt(page, 220, 220), 'the copy is gone').toBe(false);
  expect(await inkAt(page, 200, 200), 'the original is not').toBe(true);
});

test('a duplicate lands one step down and right, apart from its source', async ({ page }) => {
  await chartWith(page, [[200, 200]]);
  await page.getByRole('button', { name: 'Duplicate' }).click();
  await page.keyboard.press('Escape');
  expect(await inkAt(page, 220, 220)).toBe(true);
  expect(await inkAt(page, 200, 200)).toBe(true);
  expect(await inkAt(page, 210, 210, 2), 'nothing between them').toBe(false);
});

test('the Delete key deletes the selection, and so does Backspace', async ({ page }) => {
  await chartWith(page, [
    [200, 200],
    [400, 200],
  ]);
  await page.keyboard.press('Delete');
  await expect(board(page)).toHaveAttribute('data-stitches', '1');
  await board(page).click({ position: { x: 400, y: 200 } });
  await page.keyboard.press('Backspace');
  await expect(board(page)).toHaveAttribute('data-stitches', '0');
});

test('Ctrl/⌘ + C and V paste a copy, and each further paste one more step away', async ({ page }) => {
  await chartWith(page, [[200, 200]]);
  await page.keyboard.press('ControlOrMeta+KeyC');
  await expect(board(page), 'copying adds nothing').toHaveAttribute('data-stitches', '1');
  await page.keyboard.press('ControlOrMeta+KeyV');
  await expect(board(page)).toHaveAttribute('data-stitches', '2');
  await page.keyboard.press('ControlOrMeta+KeyV');
  await expect(board(page)).toHaveAttribute('data-stitches', '3');
  await expect(board(page)).toHaveAttribute('data-selected', '1');
  await page.keyboard.press('Escape');
  for (const at of [200, 220, 240]) expect(await inkAt(page, at, at), `a stitch at ${at}`).toBe(true);
});

test('Ctrl/⌘ + D duplicates several stitches together', async ({ page }) => {
  await chartWith(page, [
    [200, 200],
    [260, 200],
  ]);
  await board(page).click({ position: { x: 260, y: 200 }, modifiers: ['Shift'] });
  await page.keyboard.press('ControlOrMeta+KeyD');
  await expect(board(page)).toHaveAttribute('data-stitches', '4');
  await expect(board(page)).toHaveAttribute('data-selected', '2');
  await page.keyboard.press('Escape');
  expect(await inkAt(page, 220, 220)).toBe(true);
  expect(await inkAt(page, 280, 220)).toBe(true);
});

test('a stitch at the right edge is duplicated to its left, not onto itself', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  const width = (await board(page).boundingBox())!.width;
  const x = Math.floor(width) - 2;
  await board(page).click({ position: { x, y: 200 } });
  await page.getByRole('button', { name: 'Select' }).click();
  await board(page).click({ position: { x, y: 200 } });
  await page.keyboard.press('ControlOrMeta+KeyD');
  await expect(board(page)).toHaveAttribute('data-stitches', '2');
  await page.keyboard.press('Escape');
  expect(await inkAt(page, x - 20, 220)).toBe(true);
});

test('with nothing selected the shortcuts do nothing', async ({ page }) => {
  await chartWith(page, [[200, 200]]);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Delete');
  await page.keyboard.press('ControlOrMeta+KeyD');
  await page.keyboard.press('ControlOrMeta+KeyV');
  await expect(board(page)).toHaveAttribute('data-stitches', '1');
});

test('Alt + digit still picks a stitch while a select box has focus', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('combobox', { name: 'Symbol style' }).focus();
  await page.keyboard.press('Alt+Digit3');
  await expect(page.getByRole('button', { name: /^Single crochet \(sc\)/ })).toHaveAttribute('aria-pressed', 'true');
});
