/*
 * The symbol style (PQW-868): CYC or JIS redraws the palette, and the choice is
 * remembered across a reload.
 */

import { expect, test } from '@playwright/test';

test('JIS redraws the palette and is remembered', { tag: '@kiadas' }, async ({ page }) => {
  await page.goto('/');
  const preview = page.getByRole('button', { name: /^Single crochet \(sc\)/ }).locator('canvas');
  const cyc = await preview.screenshot();

  await page.getByRole('combobox', { name: 'Symbol style' }).selectOption('jis');
  expect((await preview.screenshot()).equals(cyc), 'single crochet becomes an ×').toBe(false);

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Symbol style' })).toHaveValue('jis');
});
