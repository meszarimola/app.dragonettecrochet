/*
 * Láncalapos kezdés a tulajdonos leírása szerint (PQW-891): egy sál kezdése
 * 40 láncszemmel, fordulással, rövidpálcás sorokkal. A fordulólánc az 1.
 * rövidpálca helyett áll, ezért az 1. sor a horogtól számított 3. láncszembe
 * kezd, és 38 szem lesz. Kattintással és billentyűzettel is, a tulajdonos
 * ablakméretében (1000×506) és nagy ablakban.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function setChainCount(page: Page, count: number): Promise<void> {
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(count));
}

/** A kurzor célpontja az ablakban (a böngészős tesztek horga, main.ts). */
async function cursorPoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(
    () => (window as unknown as { mintatervezoRacs: { cursor: () => { x: number; y: number } | null } }).mintatervezoRacs.cursor(),
  );
  expect(point).not.toBeNull();
  return point!;
}

/** Ami a pont alatt van: a vásznat takarja-e valami. */
async function elementIdAt(page: Page, point: { x: number; y: number }): Promise<string> {
  return page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id ?? '', point);
}

async function expectScarfRows(page: Page, rows: number): Promise<void> {
  // Az összegzés a készülő sort mutatja; a korábbi sorokat az írott minta.
  const summary = page.locator('#summary');
  // A láncalap az 1. sor (PQW-923): a horgolt sorok száma eggyel kisebb a kiírt sorszámnál.
  await expect(summary).toContainText(`${rows + 1}. sor: 38 szem`);
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');
  await expect(page.locator('#findings li')).toHaveCount(0);

  const written = page.locator('#written');
  if (await written.isHidden()) await page.locator('#written-toggle').click();
  const text = page.locator('#written-text');
  await expect(text).toContainText('1. sor – alapsor: 40 lsz.');
  await expect(text).toContainText('2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp (38 szem).');
  if (rows >= 2) await expect(text).toContainText('3. sor: 1 lsz (fordulólánc), 38 rp (38 szem).');
}

for (const viewport of [
  { width: 1000, height: 506 },
  { width: 1440, height: 900 },
]) {
  test(`${viewport.width}×${viewport.height}: sál kattintással: 40 láncszem a vászonra, F, az 1. rövidpálca a 3. láncszembe, sor kitöltése, 3. sor`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);

    // A vászon közepe szabad: a kattintás a vászonra megy, nem a panelre.
    const board = await page.locator('#board').boundingBox();
    const center = { x: board!.x + board!.width / 2, y: board!.y + board!.height / 2 };
    expect(await elementIdAt(page, center)).toBe('board');

    // Előbb az eszköz, utána a darabszám: a láncszem választása a mezőt az alapértékre állítja.
    await page.getByRole('button', { name: /^Láncszem/ }).first().click();
    await setChainCount(page, 40);
    await page.mouse.click(center.x, center.y);
    await expect(page.locator('#summary')).toContainText('2. sor következik.');

    // A láncalap utáni fordulás elfogadott lépés, hibának tűnő üzenet nélkül.
    await page.locator('[data-action="end-row"]').click();
    const status = page.locator('#status');
    await expect(status).toContainText('Az 1. sor kész, a munka megfordítva.');
    await expect(status).toContainText('2. sor következik.');
    await expect(status).not.toContainText('még nincs szem');

    // Az első rövidpálca kattintással a kurzor célpontjára: a horogtól számított 3. láncszembe.
    await page.getByRole('button', { name: /^Rövidpálca/ }).first().click();
    await expect(status).not.toContainText('Előbb válassz');
    const target = await cursorPoint(page);
    expect(await elementIdAt(page, target)).toBe('board');
    await page.mouse.click(target.x, target.y);
    await expect(page.locator('#summary')).toContainText('2. sor: 1 szem');

    await page.getByRole('button', { name: 'Sor kitöltése' }).click();
    await expect(page.locator('#summary')).toContainText('2. sor: 38 szem');

    await page.locator('[data-action="end-row"]').click();
    await page.getByRole('button', { name: 'Sor kitöltése' }).click();
    await expectScarfRows(page, 2);
  });

  test(`${viewport.width}×${viewport.height}: sál csak billentyűzettel: 40 láncszem, F, rövidpálca, Shift+F, 3. sor`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);

    const board = page.locator('#board');
    await board.focus();
    await page.keyboard.press('Alt+1'); // láncszem
    await setChainCount(page, 40);
    await board.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+f');
    await expect(page.locator('#status')).toContainText('Az 1. sor kész, a munka megfordítva.');
    await page.keyboard.press('Alt+3'); // rövidpálca
    await page.keyboard.press('Shift+Alt+f'); // sor kitöltése
    await expect(page.locator('#summary')).toContainText('2. sor: 38 szem');
    await page.keyboard.press('Alt+f');
    await page.keyboard.press('Shift+Alt+f');
    await expectScarfRows(page, 2);
  });
}
