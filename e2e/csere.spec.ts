/*
 * New asks before it replaces a chart that has stitches (PQW-1169), from both
 * of its entries; an empty chart is replaced without a question.
 */

import { expect, type Page, test } from '@playwright/test';

async function stitchCount(page: Page): Promise<number> {
  return page.evaluate(
    () => (window as unknown as { dcFreeformChart: () => { stitches: unknown[] } }).dcFreeformChart().stitches.length,
  );
}

async function chartWithStitch(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await page.locator('#board').click({ position: { x: 200, y: 150 } });
  expect(await stitchCount(page)).toBe(1);
}

async function freeform(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Free-form design' }).click();
}

test('New over a chart with stitches asks first; Cancel, Escape and the backdrop keep the chart', {
  tag: '@kiadas',
}, async ({ page }) => {
  await chartWithStitch(page);
  const dialog = page.getByRole('dialog', { name: 'New pattern' });

  await freeform(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('The current pattern will be replaced. You can bring it back with Undo.');
  await expect(page.getByRole('button', { name: 'Cancel' }), 'the safe choice takes the keyboard').toBeFocused();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  expect(await stitchCount(page), 'Cancel keeps the chart').toBe(1);

  await freeform(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(await stitchCount(page), 'Escape keeps the chart').toBe(1);

  await freeform(page);
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  expect(await stitchCount(page), 'the backdrop keeps the chart').toBe(1);

  await freeform(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).toBeHidden();
  expect(await stitchCount(page), 'Continue starts the new chart').toBe(0);
});

test('an empty chart is replaced without a question', async ({ page }) => {
  await page.goto('/');
  await freeform(page);
  await freeform(page);
  await expect(page.locator('dialog[open]'), 'no dialog of any name is open').toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Free-form design' }), 'the choice was carried out').toBeHidden();
  await expect(page.locator('#board')).toBeVisible();
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).click();
  await page.getByRole('menuitem', { name: 'Rectangular' }).click();
  await expect(page.getByRole('dialog', { name: 'Rectangular' }), 'the size comes straight away').toBeVisible();
});

test('Rectangular over a chart with stitches asks first, then asks for the size', async ({ page }) => {
  await chartWithStitch(page);
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).click();
  await page.getByRole('menuitem', { name: 'Rectangular' }).click();
  await expect(page.getByRole('dialog', { name: 'Rectangular' })).toBeHidden();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('dialog', { name: 'Rectangular' })).toBeVisible();
  expect(await stitchCount(page), 'nothing is replaced before the size is given').toBe(1);
  await page.getByRole('button', { name: 'Create' }).click();
  expect(await stitchCount(page)).toBe(0);
});

test('the question speaks Hungarian when the interface does', async ({ page }) => {
  await page.goto('/?lang=hu');
  const newButton = page.getByRole('button', { name: 'Új', exact: true });
  await newButton.click();
  await page.getByRole('menuitem', { name: 'Szabadtervezés' }).click();
  await page.getByRole('button', { name: /^Rövidpálca/ }).click();
  await page.locator('#board').click({ position: { x: 200, y: 150 } });
  await newButton.click();
  await page.getByRole('menuitem', { name: 'Szabadtervezés' }).click();
  const dialog = page.getByRole('dialog', { name: 'Új minta' });
  await expect(dialog).toContainText('A mostani minta helyére új kerül. A Visszavonással visszahozhatod.');
  await expect(page.getByRole('button', { name: 'Mégse' })).toBeVisible();
  await page.getByRole('button', { name: 'Folytatás' }).click();
  expect(await stitchCount(page)).toBe(0);
});
