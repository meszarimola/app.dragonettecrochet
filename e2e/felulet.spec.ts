/*
 * The whole interface (PQW-1141): the work-in-progress line, a bar with Home, the
 * brand, the title, New, Undo and Redo (PQW-1149), the selection tool (PQW-1143),
 * the symbol style and the language — and the stitch palette with the version under it. Nothing else.
 */

import { expect, test } from '@playwright/test';

test('the bar holds Home, the title, New, Undo, Redo, Select, Duplicate, Delete, the symbol style and the language, and nothing else', {
  tag: '@kiadas',
}, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  await expect(page.getByText('Work in progress: the designer keeps growing, so do check back later.')).toBeVisible();
  const bar = page.locator('header.bar');
  await expect(bar.getByRole('link', { name: 'Back to the dragonettecrochet.com home page' })).toHaveAttribute(
    'href',
    'https://dragonettecrochet.com/en/',
  );
  await expect(bar.getByRole('heading', { name: 'Pattern designer' })).toBeVisible();
  await expect(bar.locator('.brand-mark')).toBeVisible();
  await expect(bar.getByRole('button')).toHaveCount(6);
  await expect(bar.getByRole('button', { name: 'New' })).toBeVisible();
  // PQW-1149: Undo and Redo stand as a group of their own between New and the selection's group.
  await expect(bar.locator('.tool__label')).toHaveText(['New', 'Undo', 'Redo', 'Select', 'Duplicate', 'Delete']);
  // PQW-1143–1145: Select, Duplicate and Delete stand together, labelled, and wake with the chart.
  const group = bar.locator('.tools__group').filter({ has: page.locator('#select-tool') });
  await expect(group.locator('.tool__label')).toHaveText(['Select', 'Duplicate', 'Delete']);
  for (const name of ['Undo', 'Redo', 'Select', 'Duplicate', 'Delete'])
    await expect(bar.getByRole('button', { name })).toBeDisabled();
  await expect(bar.getByRole('combobox')).toHaveCount(2);
  await expect(bar.getByRole('combobox', { name: 'Symbol style' })).toHaveValue('cyc');
  await expect(bar.getByRole('combobox', { name: 'Interface language' })).toHaveValue('en');

  await expect(page.getByRole('heading', { name: 'Stitches', exact: true })).toBeVisible();
  await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  expect(errors, 'the page logs no error').toEqual([]);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: the page does not scroll`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const size = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]);
    expect(size).toEqual([viewport.width, viewport.height]);
  });
}
