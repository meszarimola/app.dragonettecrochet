/*
 * Az elrendezés épsége (PQW-881). Egy hibás ütközésfeloldás után a stíluslap
 * fele nem érvényesült: a mintatípus-menü a vászon helyére került, a vászon
 * kicsúszott a képből. Ezek a tesztek a dobozok helyét nézik, nem a működést.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function box(page: Page, selector: string) {
  const found = await page.locator(selector).boundingBox();
  expect(found, selector).not.toBeNull();
  return found!;
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: oldalsávok, vászon és írott minta a helyén`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);

    // Az oldal maga nem görget: minden a látható részen belül van.
    const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    expect(size).toEqual([viewport.width, viewport.height]);

    const stage = await box(page, '.stage');
    const types = await box(page, '#types');
    const panel = await box(page, '#panel');
    const board = await box(page, '#board');

    // A mintatípus-menü keskeny bal oldalsáv, a beállítások jobb oldalsáv.
    expect(types.x).toBe(stage.x);
    expect(types.width).toBeLessThan(viewport.width / 3);
    expect(types.y).toBe(stage.y);
    expect(panel.x + panel.width).toBeCloseTo(viewport.width, 0);
    expect(panel.width).toBeLessThan(viewport.width / 3);

    // A vászon kitölti a munkaterületet.
    expect(board.y).toBe(stage.y);
    expect(board.y + board.height).toBeLessThanOrEqual(viewport.height);

    // A lenyitott írott minta a két oldalsáv között, nem alattuk.
    const written = await box(page, '#written');
    expect(written.x).toBeGreaterThanOrEqual(types.x + types.width - 1);
    expect(written.x + written.width).toBeLessThanOrEqual(panel.x + 1);

    // A típusok neve nem csonkul.
    const clipped = await page.locator('.type__name').evaluateAll((names) =>
      names.filter((name) => name.scrollWidth > name.clientWidth + 1).map((name) => name.textContent),
    );
    expect(clipped).toEqual([]);
  });
}

test('az írott minta a saját gombjával és a menüsorból is lecsukható', async ({ page }) => {
  await open(page);

  const written = page.locator('#written');
  const writtenToggle = page.locator('#written-toggle');
  await expect(written).toBeVisible();

  await written.getByRole('button', { name: 'Lecsukás' }).click();
  await expect(written).toBeHidden();
  await expect(writtenToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(writtenToggle).toBeFocused();

  await writtenToggle.click();
  await expect(written).toBeVisible();
  await writtenToggle.click();
  await expect(written).toBeHidden();
});
