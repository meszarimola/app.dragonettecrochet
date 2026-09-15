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

interface Point {
  readonly x: number;
  readonly y: number;
}

/** A sorszámok és a kurzor célpontja ablak-koordinátában (`window.mintatervezoRacs`, src/ui/main.ts). */
const view = (page: Page) =>
  page.evaluate(() => {
    const api = (window as unknown as { mintatervezoRacs: { labels(): (Point & { layer: number })[]; cursor(): Point | null } })
      .mintatervezoRacs;
    return { labels: api.labels(), cursor: api.cursor() };
  });

/*
 * Lenyitott írott minta mellett (PQW-883): az „Egész minta” a panel fölé
 * illeszt, a kurzor célpontja nem kerül a panel alá, az állapotsor nem fedi
 * a panel szövegét, és a panel legfeljebb a munkaterület harmada.
 */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: lenyitott írott mintánál a minta és a kurzor a panel fölött látszik`, async ({ page }) => {
    test.slow();
    await page.setViewportSize(viewport);
    await open(page);
    const written = page.locator('#written');
    await expect(written).toBeVisible();

    // 10 soros félpálcás téglalap billentyűvel: 1 = láncszem, 4 = félpálca, F = fordulás.
    await page.locator('#board').focus();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('4');
    for (let row = 1; row <= 10; row += 1) {
      if (row > 1) await page.keyboard.press('f');
      for (let i = 0; i < 10; i += 1) await page.keyboard.press('Enter');
    }
    await page.keyboard.press('f');
    await expect(page.locator('#summary')).toContainText('11. sor következik.');

    const stage = await box(page, '.stage');
    const types = await box(page, '#types');
    const panel = await box(page, '#panel');
    const cover = await box(page, '#written');
    expect(cover.height).toBeLessThanOrEqual(stage.height / 3 + 1);

    /** A pont a vászon takarás nélküli részén: a két oldalsáv között, a panel fölött. */
    const expectUncovered = (point: Point | null, name: string) => {
      expect(point, name).not.toBeNull();
      expect(point!.x, name).toBeGreaterThan(types.x + types.width);
      expect(point!.x, name).toBeLessThan(panel.x);
      expect(point!.y, name).toBeGreaterThan(stage.y);
      expect(point!.y, name).toBeLessThan(cover.y);
    };

    await page.getByRole('button', { name: 'Egész minta' }).click();
    const fitted = await view(page);
    const rows = fitted.labels.filter((label) => label.layer <= 10);
    expect(rows.map((label) => label.layer).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const label of rows) expectUncovered(label, `${label.layer}. sor`);
    expectUncovered(fitted.cursor, 'a kurzor célpontja az „Egész minta” után');

    // Az állapotsor a panel fölött van, nem a szövegén.
    const status = await box(page, '#status');
    expect(status.y + status.height).toBeLessThanOrEqual(cover.y + 1);

    // Csukott panelnél a kurzort a panel helyére toljuk; nyitáskor a nézet visszahozza.
    await written.getByRole('button', { name: 'Lecsukás' }).click();
    await expect(written).toBeHidden();
    const before = (await view(page)).cursor!;
    await page.mouse.move(panel.x - 40, stage.y + 40);
    await page.mouse.wheel(0, before.y - (cover.y + stage.y + stage.height) / 2);
    await expect.poll(async () => (await view(page)).cursor!.y).toBeGreaterThan(cover.y);

    await page.locator('#written-toggle').click();
    await expect(written).toBeVisible();
    await expect.poll(async () => (await view(page)).cursor!.y).toBeLessThan(cover.y);
    expectUncovered((await view(page)).cursor, 'a kurzor célpontja a panel lenyitása után');
  });
}
