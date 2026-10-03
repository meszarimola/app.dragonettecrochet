/*
 * New opens an empty free-form chart (PQW-1141): the stitches wake up, and a
 * stitch picked in the palette lands where the drawing area is clicked.
 */

import { expect, type Page, test } from '@playwright/test';

/** How many inked pixels the board has in the square around a point. */
async function inkAround(page: Page, x: number, y: number): Promise<number> {
  return page.locator('#board').evaluate(
    (canvas: HTMLCanvasElement, at) => {
      const dpr = window.devicePixelRatio || 1;
      const ctx = canvas.getContext('2d')!;
      const half = 24 * dpr;
      const data = ctx.getImageData(at.x * dpr - half, at.y * dpr - half, half * 2, half * 2).data;
      let count = 0;
      for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) count += 1;
      return count;
    },
    { x, y },
  );
}

test('New opens an empty chart, and a picked stitch lands where the drawing area is clicked', {
  tag: '@kiadas',
}, async ({ page }) => {
  await page.goto('/');
  const board = page.locator('#board');
  const sc = page.getByRole('button', { name: /^Single crochet \(sc\)/ });
  await expect(board).toBeHidden();
  await expect(sc).toBeDisabled();

  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await expect(board).toBeVisible();
  await expect(sc).toBeEnabled();

  await sc.click();
  await expect(sc).toHaveAttribute('aria-pressed', 'true');
  await board.click({ position: { x: 200, y: 150 } });
  expect(await inkAround(page, 200, 150)).toBeGreaterThan(0);
  expect(await inkAround(page, 400, 300), 'nothing drawn where nobody clicked').toBe(0);
});

test('a click without a stitch places nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.locator('#board').click({ position: { x: 200, y: 150 } });
  expect(await inkAround(page, 200, 150)).toBe(0);
});

test('Alt and a digit pick the stitch with that shortcut', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.keyboard.press('Alt+Digit3');
  await expect(page.getByRole('button', { name: /^Single crochet \(sc\)/ })).toHaveAttribute('aria-pressed', 'true');
});

test('before New the shortcut is left to the browser', async ({ page }) => {
  await page.goto('/');
  const prevented = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', { code: 'Digit3', key: '3', altKey: true, cancelable: true });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

test('Escape puts the picked stitch down, and a click then places nothing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  const sc = page.getByRole('button', { name: /^Single crochet \(sc\)/ });
  await sc.click();
  await page.keyboard.press('Escape');
  await expect(sc).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#board').click({ position: { x: 200, y: 150 } });
  expect(await inkAround(page, 200, 150)).toBe(0);
});

test('a reload keeps the chart, and it can be edited on', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: /^Chain \(ch\)/ }).click();
  await page.locator('#board').click({ position: { x: 200, y: 150 } });
  expect(await inkAround(page, 200, 150)).toBeGreaterThan(0);

  await page.reload();
  await expect(page.locator('#board'), 'the chart is open without pressing New').toBeVisible();
  expect(await inkAround(page, 200, 150), 'the stitch is where it was').toBeGreaterThan(0);
  await page.getByRole('button', { name: /^Chain \(ch\)/ }).click();
  await page.locator('#board').click({ position: { x: 400, y: 300 } });
  expect(await inkAround(page, 400, 300)).toBeGreaterThan(0);

  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(page.locator('#zoom-reset')).toHaveText('125%');
  await page.reload();
  await expect(page.locator('#zoom-reset'), 'the view comes back too').toHaveText('125%');
});

test('New again clears the chart', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: /^Chain \(ch\)/ }).click();
  await page.locator('#board').click({ position: { x: 200, y: 150 } });
  expect(await inkAround(page, 200, 150)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  expect(await inkAround(page, 200, 150)).toBe(0);
});
