/*
 * New is a menu (PQW-1165): free-form design starts the chart, regular design
 * opens a submenu of five shapes that are shown but not yet available.
 */

import { expect, test } from '@playwright/test';

const SHAPES = ['Rectangular', 'Granny square', 'Triangle', 'Semicircle', 'Circle'];

test('New opens the menu, and the regular shapes are listed but disabled', async ({ page }) => {
  await page.goto('/');
  const newButton = page.getByRole('button', { name: 'New' });
  const regular = page.getByRole('menuitem', { name: 'Regular design' });
  await expect(newButton).toHaveAttribute('aria-expanded', 'false');

  await newButton.click();
  await expect(newButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menuitem', { name: 'Free-form design' })).toBeVisible();
  await expect(regular).toBeVisible();

  await regular.click();
  await expect(regular).toHaveAttribute('aria-expanded', 'true');
  for (const shape of SHAPES) {
    const item = page.getByRole('menuitem', { name: new RegExp(`^${shape}`) });
    await expect(item, `${shape} is listed`).toBeVisible();
    await expect(item, `${shape} is not available yet`).toHaveAttribute('aria-disabled', 'true');
    await expect(item).toContainText('Coming soon');
  }

  await page.getByRole('menuitem', { name: 'Granny square' }).click({ force: true });
  await expect(page.locator('#board'), 'a disabled shape starts nothing').toBeHidden();
});

test('the menu works from the keyboard', async ({ page }) => {
  await page.goto('/');
  const newButton = page.getByRole('button', { name: 'New' });
  const freeform = page.getByRole('menuitem', { name: 'Free-form design' });
  const regular = page.getByRole('menuitem', { name: 'Regular design' });

  await newButton.focus();
  await page.keyboard.press('ArrowDown');
  await expect(freeform).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(regular).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('menuitem', { name: 'Rectangular' })).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(page.getByRole('menuitem', { name: /^Circle/ }), 'up wraps to the last shape').toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(regular).toBeFocused();
  await expect(regular).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(newButton).toBeFocused();
  await expect(newButton).toHaveAttribute('aria-expanded', 'false');

  await page.keyboard.press('Enter');
  await expect(freeform).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#board'), 'free-form design opens the chart').toBeVisible();
  await expect(freeform).toBeHidden();
});

test('a press outside the menu closes it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).hover();
  await expect(page.getByRole('menuitem', { name: /^Circle/ })).toBeVisible();
  await page.locator('.stage').click({ position: { x: 300, y: 300 } });
  await expect(page.getByRole('menuitem', { name: 'Free-form design' })).toBeHidden();
  await expect(page.getByRole('menuitem', { name: /^Circle/ })).toBeHidden();
});

test('on a phone the open submenu folds below and stays inside the window', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const width = () => page.evaluate(() => document.documentElement.scrollWidth);
  const before = await width();
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('menuitem', { name: 'Regular design' }).click();
  const circle = page.getByRole('menuitem', { name: /^Circle/ });
  await expect(circle).toBeVisible();
  expect(await width(), 'the menu widens nothing').toBe(before);
  const box = await page.locator('#new-menu').boundingBox();
  expect(box!.x + box!.width, 'the menu ends inside the window').toBeLessThanOrEqual(360);
});
