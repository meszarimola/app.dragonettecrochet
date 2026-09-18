/*
 * A letisztított felület három fogása (PQW-911): a fájlműveletek lenyíló
 * menüje billentyűzettel is járható, az írott minta panelje csukva indul és a
 * gombjával nyílik, a másolás és a beillesztés pedig a vásznon dolgozik, a
 * szövegmezőkben viszont a böngésző saját szerkesztését hagyja működni.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

test('a fájlműveletek lenyílója billentyűzettel: Tab a gombra, Enter nyit, Esc csuk és visszaadja a fókuszt', async ({ page }) => {
  await open(page);

  const fileToggle = page.locator('#file-toggle');
  const filePop = page.locator('#file-pop');
  await expect(filePop).toBeHidden();
  await expect(fileToggle).toHaveAttribute('aria-expanded', 'false');

  // Az „Új minta” gombról egy Tab a fájlműveletek gombjára visz: a kettő szomszédos (PQW-912).
  await page.locator('[data-action="new"]').focus();
  await page.keyboard.press('Tab');
  await expect(fileToggle).toBeFocused();

  // Enterre nyílik, és a fókusz az első műveleten áll.
  await page.keyboard.press('Enter');
  await expect(filePop).toBeVisible();
  await expect(fileToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(filePop.locator('[data-action="import-json"]')).toBeFocused();

  // Esc csukja, és a fókusz visszatér a gombra.
  await page.keyboard.press('Escape');
  await expect(filePop).toBeHidden();
  await expect(fileToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(fileToggle).toBeFocused();
});

test('az írott minta panelje csukva indul, és a menüsor gombjával nyitható', async ({ page }) => {
  await open(page);

  const written = page.locator('#written');
  const writtenToggle = page.locator('#written-toggle');
  await expect(written).toBeHidden();
  await expect(writtenToggle).toHaveAttribute('aria-expanded', 'false');

  await writtenToggle.click();
  await expect(written).toBeVisible();
  await expect(writtenToggle).toHaveAttribute('aria-expanded', 'true');
  // Nyitva a panel a mostani mintát írja: üres mintán is van mondanivalója.
  await expect(written.locator('#written-notices, #written-text')).not.toHaveCount(0);

  await writtenToggle.click();
  await expect(written).toBeHidden();
});

/** A sorszámok ablak-koordinátában (`window.mintatervezoRacs`, src/ui/main.ts). */
const labels = (page: Page) =>
  page.evaluate(() => (window as unknown as { mintatervezoRacs: { labels(): { layer: number; x: number; y: number }[] } }).mintatervezoRacs.labels());

/** Félpálcás téglalap csak billentyűvel (PQW-911): Alt+1 = láncszem, Alt+4 = félpálca, Alt+F = fordulás. */
async function rectangle(page: Page, width: number, rows: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').fill(String(width + 2));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+4');
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) await page.keyboard.press('Alt+f');
    for (let i = 0; i < width; i += 1) await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Egész minta' }).click();
  await page.locator('#board').focus();
}

test('a Ctrl+C és a Ctrl+V a vásznon másol és illeszt, a szövegmezőben viszont a böngészőé marad', async ({ page }) => {
  await open(page);
  await rectangle(page, 5, 2);
  const summary = page.locator('#summary');
  const status = page.locator('#status');
  await expect(summary).toContainText('3. sor: 6 szem');

  // A vásznon: a sorszámmal kijelölt sor a vágólapra, majd új sorként vissza.
  const label = (await labels(page)).find((candidate) => candidate.layer === 2);
  expect(label, 'a 3. sor sorszáma').toBeTruthy();
  await page.mouse.click(label!.x, label!.y);
  await expect(status).toHaveText('3. sor kijelölve: 6 szem.');

  await page.keyboard.press('ControlOrMeta+c');
  await expect(status).toContainText('a vágólapon');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(summary).toContainText('3 sor. 4. sor: 6 szem.');
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');

  /*
   * Szövegmezőben a szerkesztő nem nyúl a billentyűkhöz: a böngésző saját
   * másolása és beillesztése működik. A naplózó a szerkesztő kezelője UTÁN fut
   * (mindkettő a `document` buborékfázisában), így a `defaultPrevented` elárulja,
   * elnyelte-e a szerkesztő a billentyűt.
   */
  // A naplózó egyszer épül be; a mérések előtt csak a listát ürítjük.
  await page.evaluate(() => {
    const store = window as unknown as { pqwKeys: boolean[] };
    store.pqwKeys = [];
    document.addEventListener('keydown', (event) => {
      // A módosító maga is ad egy billentyűeseményt: csak a betűk érdekesek.
      if (/^[cv]$/i.test(event.key)) store.pqwKeys.push(event.defaultPrevented);
    });
  });

  const log = async (): Promise<boolean[]> => {
    await page.evaluate(() => {
      (window as unknown as { pqwKeys: boolean[] }).pqwKeys = [];
    });
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    return page.evaluate(() => (window as unknown as { pqwKeys: boolean[] }).pqwKeys);
  };

  const title = page.locator('#title');
  await title.fill('Nyári kendő');
  await title.selectText();
  expect(await log(), 'a szövegmezőben a böngésző alapértelmezése marad').toEqual([false, false]);
  await expect(title).toHaveValue('Nyári kendő');
  // A mintán semmi nem változott: a mező billentyűi nem jutottak el a vászonhoz.
  await expect(summary).toContainText('3 sor. 4. sor: 6 szem.');

  // A vásznon ugyanez a két billentyű a szerkesztőé.
  await page.locator('#board').focus();
  expect(await log(), 'a vásznon a szerkesztő kezeli a másolást és a beillesztést').toEqual([true, true]);
});
