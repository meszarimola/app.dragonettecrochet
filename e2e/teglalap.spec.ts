/*
 * Regular design, Rectangular (PQW-1168): a dialog asks for the stitches per
 * row and the rows, and the chart opens on a guide grid of that size. Only the
 * grid takes a stitch.
 */

import { expect, type Page, test } from '@playwright/test';

interface Chart {
  readonly stitches: unknown[];
  readonly grid?: { readonly rows: number[] };
}

async function currentChart(page: Page): Promise<Chart | null> {
  return page.evaluate(() => (window as unknown as { dcFreeformChart: () => Chart | null }).dcFreeformChart());
}

async function openDialog(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).click();
  await page.getByRole('menuitem', { name: 'Rectangular' }).click();
  await expect(page.getByRole('dialog', { name: 'Rectangular' })).toBeVisible();
}

test('Rectangular asks for the size and opens a guide grid that only takes stitches on itself', {
  tag: '@kiadas',
}, async ({ page }) => {
  await openDialog(page);
  const stitches = page.getByLabel('Stitches per row');
  const rows = page.getByLabel('Rows');
  await expect(stitches, 'the stitch count starts at 20').toHaveValue('20');
  await expect(rows, 'the row count starts at 20').toHaveValue('20');
  await expect(stitches, 'the first field takes the keyboard').toBeFocused();

  await rows.fill('80');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog', { name: 'Rectangular' })).toBeHidden();
  const board = page.locator('#board');
  await expect(board).toBeVisible();
  const chart = await currentChart(page);
  expect(chart?.grid?.rows.length, 'one entry per row').toBe(80);
  expect(new Set(chart?.grid?.rows), 'every row has 20 cells').toEqual(new Set([20]));

  const sc = page.getByRole('button', { name: /^Single crochet \(sc\)/ });
  await sc.click();
  const box = (await board.boundingBox())!;
  // KB: interface.md §89 — row 1 opens in the bottom left: the grid's left edge 64 px in, its foot 24 px up.
  await board.click({ position: { x: 30, y: box.height - 44 } });
  expect((await currentChart(page))?.stitches.length, 'left of the grid nothing is placed').toBe(0);
  await board.click({ position: { x: 124, y: box.height - 44 } });
  expect((await currentChart(page))?.stitches.length, 'on the grid the stitch is placed').toBe(1);

  await page.reload();
  expect((await currentChart(page))?.grid?.rows.length, 'the grid survives a reload').toBe(80);
});

test('a wrong count is named under its field, and Enter creates once it is right', async ({ page }) => {
  await openDialog(page);
  const stitches = page.getByLabel('Stitches per row');
  const rows = page.getByLabel('Rows');

  await stitches.fill('201');
  await rows.fill('');
  await rows.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Rectangular' }), 'nothing is created').toBeVisible();
  await expect(page.locator('#grid-stitches-error')).toHaveText('It can be 200 at most.');
  await expect(page.locator('#grid-rows-error')).toHaveText('Enter a number.');
  await expect(stitches, 'the first wrong field takes the keyboard').toBeFocused();
  await expect(stitches).toHaveAttribute('aria-invalid', 'true');

  await stitches.fill('12');
  await expect(page.locator('#grid-stitches-error'), 'a corrected field drops its message').toHaveText('');
  await rows.fill('501');
  await rows.press('Enter');
  await expect(page.locator('#grid-rows-error')).toHaveText('It can be 500 at most.');
  await rows.fill('30');
  await rows.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Rectangular' })).toBeHidden();
  const chart = await currentChart(page);
  expect(chart?.grid?.rows.length).toBe(30);
  expect(chart?.grid?.rows[0]).toBe(12);
});

test('Cancel, Escape and a click beside the dialog all leave everything as it was', async ({ page }) => {
  await openDialog(page);
  const dialog = page.getByRole('dialog', { name: 'Rectangular' });
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#board'), 'Cancel starts nothing').toBeHidden();
  await expect(page.getByRole('button', { name: 'New' }), 'the focus goes back to New').toBeFocused();

  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).click();
  await page.getByRole('menuitem', { name: 'Rectangular' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).click();
  await page.getByRole('menuitem', { name: 'Rectangular' }).click();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await expect(page.locator('#board'), 'nothing was started').toBeHidden();
});

test('the dialog speaks Hungarian when the interface does', async ({ page }) => {
  await page.goto('/?lang=hu');
  await page.getByRole('button', { name: 'Új', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Szabályos tervezés' }).click();
  await page.getByRole('menuitem', { name: 'Négyszögletű' }).click();
  const dialog = page.getByRole('dialog', { name: 'Téglalap' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Szemek száma')).toHaveValue('20');
  await expect(dialog.getByLabel('Sorok száma')).toHaveValue('20');
  await dialog.getByLabel('Sorok száma').fill('0');
  await page.getByRole('button', { name: 'Létrehozás' }).click();
  await expect(page.locator('#grid-rows-error')).toHaveText('Legalább 1 legyen.');
  await page.getByRole('button', { name: 'Mégse' }).click();
  await expect(dialog).toBeHidden();
});
