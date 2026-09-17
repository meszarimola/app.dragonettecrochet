/*
 * A tervező feje (PQW-853, PQW-918, PQW-922): a saját favicon (ICO és SVG) és az apple-touch-icon betöltődik,
 * a buildelt oldalon ott a leírás és a theme-color, és betöltéskor nincs
 * konzolhiba.
 */

import { expect, test } from '@playwright/test';

test('favicon, apple-touch-icon, leírás és theme-color a buildelt oldalon; konzolhiba nélkül', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');

  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /horgolásminta-tervező/i);
  await expect(page.locator('head meta[name="theme-color"]')).toHaveAttribute('content', '#faf7f3');
  // A gyökér indexelhető (PQW-918).
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', 'https://app.dragonettecrochet.com/');

  for (const selector of ['head link[rel="icon"][sizes="32x32"]', 'head link[rel="icon"][type="image/svg+xml"]', 'head link[rel="apple-touch-icon"]']) {
    const href = await page.locator(selector).getAttribute('href');
    expect(href, selector).toMatch(/^\//);
    const response = await request.get(href!);
    expect(response.status(), href!).toBe(200);
    expect(response.headers()['content-type'] ?? '', href!).toMatch(/image\//);
  }
  expect(errors).toEqual([]);
});

test('a menüsorban a D6 szitakötő-jel a cím előtt, díszítő elemként, legalább 20 px magasan (PQW-922)', async ({ page }) => {
  await page.goto('/');
  const mark = page.locator('.bar__lead svg.brand-mark');
  await expect(mark).toBeVisible();
  await expect(mark).toHaveAttribute('aria-hidden', 'true');
  const box = await mark.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(20);
  await expect(page.locator('.bar__lead h1.bar__title')).toHaveText('Mintatervező');
});
