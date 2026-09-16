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

/** Az írott minta lenyitva: alacsony ablakban alapból csukva van (PQW-891), ott a gombjával nyitjuk. */
async function openWritten(page: Page): Promise<void> {
  const written = page.locator('#written');
  if (await written.isHidden()) await page.locator('#written-toggle').click();
  await expect(written).toBeVisible();
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
    await openWritten(page);
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
  // A panel csukva indul (PQW-911): előbb a menüsorból nyitjuk.
  await expect(written).toBeHidden();
  await writtenToggle.click();
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

/** Az írott minta elválasztója (PQW-885). */
const separatorOf = (page: Page) => page.getByRole('separator', { name: 'Az írott minta magassága' });
const heightOf = async (page: Page) => (await box(page, '#written')).height;
/** A két érték legfeljebb `tolerance` képponttal tér el. */
const near = (actual: number, expected: number, tolerance = 2) => Math.abs(actual - expected) <= tolerance;
/** Egy képkocka: addigra a ResizeObserver lefutott. */
const settle = (page: Page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

/*
 * Lenyitott írott minta mellett (PQW-883): az „Egész minta” a panel fölé
 * illeszt, a kurzor célpontja nem kerül a panel alá, és az állapotsor nem fedi
 * a panel szövegét. A panel alapból legfeljebb 22rem, alacsony ablakban a
 * munkaterület fele, és más magasságnál is a látható részre illeszt; teljes
 * nézetben a vászon nem igazodik (PQW-885).
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
    // A panel minden ablakméretben csukva indul (PQW-911): a gombjával nyitjuk.
    const low = viewport.height < 640;
    await expect(written).toBeHidden();
    await page.locator('#written-toggle').click();
    await expect(written).toBeVisible();

    // 10 soros félpálcás téglalap billentyűvel: 1 = láncszem, 4 = félpálca, F = fordulás.
    await page.locator('#board').focus();
    await page.keyboard.press('Alt+1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+4');
    for (let row = 1; row <= 10; row += 1) {
      if (row > 1) await page.keyboard.press('Alt+f');
      for (let i = 0; i < 10; i += 1) await page.keyboard.press('Enter');
    }
    await page.keyboard.press('Alt+f');
    await expect(page.locator('#summary')).toContainText('11. sor következik.');

    const stage = await box(page, '.stage');
    const types = await box(page, '#types');
    const panel = await box(page, '#panel');
    const cover = await box(page, '#written');
    // Alapból legfeljebb 22rem és a munkaterület fele. Alacsony ablakban a 40%-a, de legalább a fejléc (a betűk
    // magasságától függ): a vászon közepe mindenképp szabad marad (PQW-891).
    if (low) {
      const minimum = await written.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--written-min')) || 0);
      expect(cover.height).toBeLessThanOrEqual(Math.max(minimum, stage.height * 0.4) + 1);
      expect(cover.y).toBeGreaterThan(stage.y + stage.height / 2);
    } else {
      expect(near(cover.height, Math.min(352, stage.height / 2))).toBe(true);
    }

    /** A pont a vászon takarás nélküli részén: a két oldalsáv között, a panel fölött. */
    const expectUncovered = (point: Point | null, name: string, bottom = cover.y) => {
      expect(point, name).not.toBeNull();
      expect(point!.x, name).toBeGreaterThan(types.x + types.width);
      expect(point!.x, name).toBeLessThan(panel.x);
      expect(point!.y, name).toBeGreaterThan(stage.y);
      expect(point!.y, name).toBeLessThan(bottom);
    };

    await page.getByRole('button', { name: 'Egész minta' }).click();
    const fitted = await view(page);
    // A láncalap (0. réteg) felirata a PQW-916 óta szintén ott van a rajz mellett; itt a sorokat nézzük.
    const rows = fitted.labels.filter((label) => label.layer >= 1 && label.layer <= 10);
    expect(rows.map((label) => label.layer).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const label of rows) expectUncovered(label, `${label.layer}. sor`);
    expectUncovered(fitted.cursor, 'a kurzor célpontja az „Egész minta” után');

    // Az állapotszöveg a PQW-916 óta rejtett élő régió: sem a rajzot, sem a panel szövegét nem takarja.
    const status = await page.locator('#status').boundingBox();
    expect((status?.width ?? 0) * (status?.height ?? 0), 'az állapotszöveg nem lebeg a vászon fölött').toBeLessThanOrEqual(4);

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

    // Más magasságnál is a panel fölé illeszt: csak a fejléc, majd egy negyeddel magasabb panel.
    const separator = separatorOf(page);
    for (const key of ['Home', 'PageUp']) {
      await separator.focus();
      await page.keyboard.press(key);
      await settle(page);
      const top = (await box(page, '#written')).y;
      await page.getByRole('button', { name: 'Egész minta' }).click();
      const shown = await view(page);
      const shownRows = shown.labels.filter((label) => label.layer >= 1 && label.layer <= 10);
      expect(shownRows).toHaveLength(10);
      for (const label of shownRows) expectUncovered(label, `${label.layer}. sor (${key} után)`, top);
      expectUncovered(shown.cursor, `a kurzor célpontja (${key} után)`, top);
    }

    // Teljes nézetben a vászon nem igazodik: a nézet a panel mögött változatlan.
    const behind = await view(page);
    await separator.focus();
    await page.keyboard.press('End');
    await expect.poll(() => heightOf(page)).toBeGreaterThan(stage.height - 1);
    await settle(page);
    expect(await view(page)).toEqual(behind);
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: az elválasztó billentyűzettel és egérrel a fejléctől a teljes munkaterületig állít`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const written = page.locator('#written');
    await openWritten(page);
    const separator = separatorOf(page);
    const stage = await box(page, '.stage');

    // Billentyűzet: End a teljes munkaterület, Home csak a fejléc, a nyíl legfeljebb 5 %-ot lép.
    await separator.focus();
    await page.keyboard.press('End');
    await expect.poll(() => heightOf(page)).toBeGreaterThan(stage.height - 1);
    await expect(separator).toHaveAttribute('aria-valuenow', '100');
    await expect(written.getByRole('button', { name: 'Vissza', exact: true })).toBeVisible();

    // Home után csak a fejléc marad: a szöveg törzse összezárul. A fejléc magassága a betűtípustól függ, keskeny panelen két sorba is törhet.
    await page.keyboard.press('Home');
    await expect.poll(async () => (await box(page, '#written-body')).height).toBeLessThanOrEqual(10);
    expect(await heightOf(page)).toBeLessThan(stage.height / 2);
    await expect(written.getByRole('button', { name: 'Lecsukás' })).toBeInViewport();
    const low = Number(await separator.getAttribute('aria-valuenow'));
    await expect(separator).toHaveAttribute('aria-valuemin', String(low));
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => Number(await separator.getAttribute('aria-valuenow'))).toBeGreaterThan(low);
    expect(Number(await separator.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(low + 5);

    // Egér: az elválasztót a munkaterület negyedéhez húzva a panel a háromnegyede.
    const grip = await box(page, '#written-grip');
    const x = grip.x + grip.width / 2;
    await page.mouse.move(x, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, stage.y + stage.height / 4 + grip.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => near(await heightOf(page), (stage.height * 3) / 4, 3)).toBe(true);

    // A „Teljes nézet” a teljes munkaterületre nyit, a „Vissza” a korábbi magasságra áll.
    const before = await heightOf(page);
    await written.getByRole('button', { name: 'Teljes nézet' }).click();
    await expect.poll(() => heightOf(page)).toBeGreaterThan(stage.height - 1);
    await written.getByRole('button', { name: 'Vissza', exact: true }).click();
    await expect.poll(async () => near(await heightOf(page), before)).toBe(true);
    await expect(written.getByRole('button', { name: 'Teljes nézet' })).toBeVisible();

    // A fejléc alá húzva lecsukódik; újranyitva a húzás előtti magasságot kapja.
    const start = await box(page, '#written-grip');
    await page.mouse.move(x, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, stage.y + stage.height - 2, { steps: 5 });
    await page.mouse.up();
    await expect(written).toBeHidden();
    await expect(page.locator('#written-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#written-toggle')).toBeFocused();
    await page.locator('#written-toggle').click();
    await expect(written).toBeVisible();
    await expect.poll(async () => near(await heightOf(page), before)).toBe(true);
  });

  test(`${viewport.width}×${viewport.height}: a hosszú állapotüzenet nem borítja fel az elrendezést`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const written = page.locator('#written');
    await openWritten(page);
    const stage = await box(page, '.stage');

    /*
     * A mag hosszú hibaüzeneteinek mintájára (PQW-884). Az állapotszöveg a
     * PQW-916 óta nem lebegő doboz a vásznon, hanem rejtett élő régió: a
     * képernyőolvasó felolvassa, de a rajzot nem takarja, és a hossza sem mozdít
     * az elrendezésen — sem lenyitott írott mintánál, sem teljes nézetben.
     */
    const long =
      'Nincs elég célpont: a beillesztett sor tizenkét szemet vár, de az előző sorban csak kilenc szabad célpont van, ezért a minta nem változott. Tedd a kurzort egy korábbi szemre, és próbáld újra.';
    const say = async () => {
      await page.locator('#status').evaluate((element, text) => {
        element.textContent = text;
      }, long);
      await settle(page);
    };
    /** Az üzenet szövege megvan, de látható doboza nincs, és az oldal nem görget. */
    const expectQuiet = async () => {
      await expect(page.locator('#status')).toContainText('Nincs elég célpont');
      const status = await page.locator('#status').boundingBox();
      expect((status?.width ?? 0) * (status?.height ?? 0), 'az állapotszöveg nem lebeg a vászon fölött').toBeLessThanOrEqual(4);
      const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
      expect(size).toEqual([viewport.width, viewport.height]);
    };

    await say();
    await expectQuiet();

    // Teljes nézetben sem lesz belőle doboz.
    await written.getByRole('button', { name: 'Teljes nézet' }).click();
    await expect.poll(() => heightOf(page)).toBeGreaterThan(stage.height - 1);
    await say();
    await expectQuiet();
  });
}

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/*
 * Körben horgolt mintánál a rács a készülő kör sávjával körben nagyobb a
 * rajznál (PQW-887): az „Egész minta” a rács szélét is a látható részre
 * illeszti, lenyitott írott minta mellett. Alacsony ablakban ehhez a nagyítás
 * legkisebb lépcsőjénél kisebbre is kicsinyít.
 */
for (const [viewport, rounds] of [
  [{ width: 1440, height: 900 }, 6],
  [{ width: 1000, height: 506 }, 6],
] as const) {
  test(`${viewport.width}×${viewport.height}: az „Egész minta” a körben horgolt minta rácsát is a látható részre illeszti`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await openWritten(page);

    const section = page.locator('#section-rounds');
    if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
    await page.locator('#rounds-shape').selectOption({ label: 'Nagymama-négyzet' });
    await page.locator('#rounds-count').fill(String(rounds));
    await page.locator('#rounds-count').press('Tab');
    await page.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#status')).toContainText(`${rounds} kör elkészült`);
    await page.getByRole('button', { name: 'Egész minta' }).click();

    const grid = await page.evaluate(() => (window as unknown as { mintatervezoRacs: { bounds(): Rect | null } }).mintatervezoRacs.bounds());
    expect(grid).not.toBeNull();
    const stage = await box(page, '.stage');
    const types = await box(page, '#types');
    const panel = await box(page, '#panel');
    const cover = await box(page, '#written');
    expect(grid!.left).toBeGreaterThanOrEqual(types.x + types.width);
    expect(grid!.right).toBeLessThanOrEqual(panel.x);
    expect(grid!.top).toBeGreaterThanOrEqual(stage.y);
    expect(grid!.bottom).toBeLessThanOrEqual(cover.y);
  });
}
