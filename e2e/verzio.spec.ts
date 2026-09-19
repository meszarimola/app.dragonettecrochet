/*
 * The running version in the corner (PQW-903): the label is visible, matches the
 * `v<number>.<number>.<number>` pattern, is not clickable, does not cover the
 * canvas, and does not make the page scroll.
 */

import { expect, test } from '@playwright/test';

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: the version label is visible, and does not cover the canvas`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const deny = page.getByRole('button', { name: 'Elutasítom' });
    if (await deny.isVisible()) await deny.click();

    const version = page.locator('#version');
    await expect(version).toBeVisible();
    await expect(version).toHaveText(/^v\d+\.\d+\.\d+$/);
    // It does not say a needless token to the screen reader.
    await expect(version).toHaveAttribute('aria-hidden', 'true');
    expect(await version.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('none');

    // The page does not scroll because of the label.
    const size = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]);
    expect(size).toEqual([viewport.width, viewport.height]);

    // Whether it really is visible: the image changes where the label is if we hide it. `toBeVisible()` would
    // not notice this, because it does not look at covering (a sidebar over the label).
    const label = (await version.boundingBox())!;
    const clip = {
      x: Math.floor(label.x),
      y: Math.floor(label.y),
      width: Math.ceil(label.width),
      height: Math.ceil(label.height),
    };
    const painted = await page.screenshot({ clip });
    await version.evaluate((element) => element.style.setProperty('visibility', 'hidden'));
    const blank = await page.screenshot({ clip });
    await version.evaluate((element) => element.style.removeProperty('visibility'));
    expect(painted.equals(blank), 'the version label is not visible: something is covering it').toBe(false);

    // The number is not a label: the bilingual dictionary (PQW-900) does not translate it, it is the same in English.
    const hungarian = (await version.textContent()) ?? '';
    await page.goto('/?lang=en');
    await expect(page.locator('#version')).toHaveText(hungarian);
    await expect(page.locator('#version')).toHaveText(/^v\d+\.\d+\.\d+$/);

    await page.goto('/');
    // The canvas fills the whole work area, with the two sidebars above it. The label stays
    // within the band of the left sidebar, so it hides nothing of the free drawing area.
    const types = (await page.locator('#types').boundingBox())!;
    expect(label.x, 'the label starts within the band of the left sidebar').toBeGreaterThanOrEqual(types.x);
    expect(label.x + label.width, 'the label does not reach out into the drawing area').toBeLessThanOrEqual(
      types.x + types.width,
    );
    expect(label.y, 'the label is at the height of the sidebar').toBeGreaterThanOrEqual(types.y);
    expect(label.y + label.height).toBeLessThanOrEqual(types.y + types.height + 1);
  });
}
