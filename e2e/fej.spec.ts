/*
 * The head of the designer (PQW-853, PQW-918, PQW-922): its own favicon (ICO and SVG) and the apple-touch-icon load,
 * the description and the theme-color are on the built page, and there is no
 * console error on load.
 */

import { expect, test } from '@playwright/test';

test('favicon, apple-touch-icon, description and theme-color on the built page; without a console error', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');

  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /horgolásminta-tervező/i);
  await expect(page.locator('head meta[name="theme-color"]')).toHaveAttribute('content', '#faf7f3');
  // The root is indexable (PQW-918).
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://app.dragonettecrochet.com/',
  );

  for (const selector of [
    'head link[rel="icon"][sizes="32x32"]',
    'head link[rel="icon"][type="image/svg+xml"]',
    'head link[rel="apple-touch-icon"]',
  ]) {
    const href = await page.locator(selector).getAttribute('href');
    expect(href, selector).toMatch(/^\//);
    const response = await request.get(href!);
    expect(response.status(), href!).toBe(200);
    expect(response.headers()['content-type'] ?? '', href!).toMatch(/image\//);
  }
  expect(errors).toEqual([]);
});

test('in the menu bar the D6 dragonfly mark stands before the title, as a decorative element, at least 20 px tall (PQW-922)', async ({
  page,
}) => {
  await page.goto('/');
  const mark = page.locator('.bar__lead svg.brand-mark');
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute('aria-hidden', 'true');
  const box = await mark.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(20);
  await expect(page.locator('.bar__lead h1.bar__title')).toHaveText('Mintatervező');
});
