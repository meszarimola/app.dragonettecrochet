/*
 * The whole interface (PQW-1141): the work-in-progress line, a bar with Home, the
 * brand, the title, New, the symbol style and the language — and the stitch
 * palette with the version under it. Nothing else.
 */

import { expect, test } from '@playwright/test';

test('the bar holds Home, the title, New, the symbol style and the language, and nothing else', {
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
  await expect(bar.getByRole('button')).toHaveCount(1);
  await expect(bar.getByRole('button', { name: 'New' })).toBeVisible();
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
