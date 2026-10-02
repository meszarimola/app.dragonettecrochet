/*
 * Smoke test against the deployed interface (PQW-928).
 *
 * It does not measure the logic of the app — the whole `e2e/` suite does that
 * on the built output. This answers whether *the deployment* worked: the right
 * version went out, the page builds up, and a stitch really can be placed on a
 * new free-form chart.
 *
 * The selectors are English, because the deployed app opens in English, and
 * deliberately the same strings the `e2e/` suite drives (docs/kiadas.md):
 * guessed selectors failed every release before.
 */

import { expect, type Page, test } from '@playwright/test';

const VART_VERZIO = process.env.VART_VERZIO ?? '';

async function open(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.goto('/');
  return errors;
}

test('the served interface shows the expected version', async ({ page }) => {
  test.skip(VART_VERZIO === '', 'VART_VERZIO is not set');
  await open(page);
  await expect(page.getByText(`v${VART_VERZIO}`, { exact: true })).toBeVisible();
});

test('the page builds up: the bar and the stitches in place', async ({ page }) => {
  const errors = await open(page);
  await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Stitches', exact: true })).toBeVisible();
  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
});

test('a stitch can be placed on a new chart', async ({ page }) => {
  const errors = await open(page);
  await page.getByRole('button', { name: 'New' }).click();
  const sc = page.getByRole('button', { name: /^Single crochet \(sc\)/ });
  await sc.click();
  await expect(sc).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#board').click({ position: { x: 120, y: 120 } });
  const inked = await page.locator('#board').evaluate((canvas: HTMLCanvasElement) => {
    const data = canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height).data ?? [];
    return data.some((value, index) => index % 4 === 3 && value > 0);
  });
  expect(inked, 'the stitch is drawn').toBe(true);
  expect(errors, `console errors: ${errors.join(' | ')}`).toHaveLength(0);
});
