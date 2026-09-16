/*
 * A futó verzió a sarokban (PQW-903): a felirat látszik, a `v<szám>.<szám>.<szám>`
 * mintára illeszkedik, nem kattintható, a vásznat nem takarja, és nem görget.
 */

import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: a verziófelirat látszik, és nem takarja a vásznat`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const deny = page.getByRole('button', { name: 'Elutasítom' });
    if (await deny.isVisible()) await deny.click();

    const version = page.locator('#version');
    await expect(version).toBeVisible();
    await expect(version).toHaveText(/^v\d+\.\d+\.\d+$/);
    // A képernyőolvasónak nem mond fölösleges tokent.
    await expect(version).toHaveAttribute('aria-hidden', 'true');
    expect(await version.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');

    // Az oldal nem görget a felirattól.
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    expect(size).toEqual([viewport.width, viewport.height]);

    // Tényleg látszik-e: a felirat helyén a kép megváltozik, ha elrejtjük. A `toBeVisible()` ezt
    // nem venné észre, mert a takarást (oldalsáv a felirat fölött) nem nézi.
    const label = (await version.boundingBox())!;
    const clip = { x: Math.floor(label.x), y: Math.floor(label.y), width: Math.ceil(label.width), height: Math.ceil(label.height) };
    const painted = await page.screenshot({ clip });
    await version.evaluate((element) => element.style.setProperty('visibility', 'hidden'));
    const blank = await page.screenshot({ clip });
    await version.evaluate((element) => element.style.removeProperty('visibility'));
    expect(painted.equals(blank), 'a verziófelirat nem látszik: valami eltakarja').toBe(false);

    // A szám nem felirat: a kétnyelvű szótár (PQW-900) nem fordítja, angolul is ugyanaz.
    const hungarian = (await version.textContent()) ?? '';
    await page.goto('/?lang=en');
    await expect(page.locator('#version')).toHaveText(hungarian);
    await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+\.\d+$/);

    await page.goto('/');
    // A vászon a teljes munkaterületet kitölti, fölötte a két oldalsáv. A felirat a bal
    // oldalsáv sávjában marad, így a szabad rajzterületből nem takar el semmit.
    const types = (await page.locator('#types').boundingBox())!;
    expect(label.x, 'a felirat a bal oldalsáv sávjában kezdődik').toBeGreaterThanOrEqual(types.x);
    expect(label.x + label.width, 'a felirat nem ér ki a rajzterületre').toBeLessThanOrEqual(types.x + types.width);
    expect(label.y, 'a felirat az oldalsáv magasságában van').toBeGreaterThanOrEqual(types.y);
    expect(label.y + label.height).toBeLessThanOrEqual(types.y + types.height + 1);
  });
}
