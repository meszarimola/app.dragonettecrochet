/*
 * Az írott minta panel új mintánál (PQW-915).
 *
 * A hibát háromszor jelentették, és az eddigi tesztek azért nem fogták meg,
 * mert TISZTA tárolóval indultak: a panel alapértelmezése csukott, így a baj
 * nem látszott. Aki egyszer kinyitotta a panelt, annál a tárolt állapot
 * `nyitva`, és onnantól minden új minta nyitva kapta. Ez a teszt ezért
 * szándékosan a `nyitva` állapotból indul.
 */

import { expect, test, type Page } from '@playwright/test';

const WRITTEN_KEY = 'dc-mintatervezo:irott-minta';

/** Betöltés a megadott tárolt panelállapottal; a süti-sávot elutasítjuk. */
async function open(page: Page, stored: 'nyitva' | 'zarva' | null): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch {
        // Privát ablakban a tárolás dobhat; a teszt ilyenkor az alapértelmezést nézi.
      }
    },
    [WRITTEN_KEY, stored] as const,
  );
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
}

test('a kézzel kinyitott panelt az „Új minta” becsukja (PQW-915)', async ({ page }) => {
  await open(page, null);

  const written = page.locator('#written');
  await expect(written).toBeHidden();

  // A felhasználó kinyitja: innentől a tárolt állapot „nyitva”.
  await page.locator('#written-toggle').click();
  await expect(written).toBeVisible();

  await page.locator('[data-action="new"]').click();
  await expect(written, 'az új minta üres: a panelnek csukva kell lennie').toBeHidden();
  await expect(page.locator('#written-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('üres mintán a tárolt „nyitva” állapot sem nyitja ki a panelt (PQW-915)', async ({ page }) => {
  // Ez a korábbi tesztek vakfoltja: a tároló már „nyitva” értéket hoz magával.
  await open(page, 'nyitva');

  await expect(page.locator('#written')).toBeHidden();
  await expect(page.locator('#written-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('a láncszemszám mezőjében az Enter lerakja a szemeket (PQW-915)', async ({ page }) => {
  /*
   * A jelkészlet súgója azt ígéri: „Enterrel vagy a vászonra kattintva
   * horgolod, a megadott számú láncszemmel.” A globális billentyűkezelő viszont
   * minden szövegmezőben kilép (PQW-911), ezért a MEZŐBEN lenyomott Enter
   * elnyelődött: a felhasználó beírta a 12-t, megnyomta az Entert, és nem
   * történt semmi. Ez a teszt kattintás nélkül, csak billentyűzettel dolgozik.
   */
  await open(page, null);

  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');

  const count = page.locator('#chain-count');
  await expect(count).toBeVisible();
  await count.fill('12');
  await count.press('Enter');

  await expect(page.locator('#status')).toContainText('12 láncszem');
  await expect(page.locator('[data-action="end-row"]'), 'a láncalap után fordulni lehet').toBeEnabled();
});

test('amit a felhasználó kinyit, az nyitva marad, amíg van mit mutatni (PQW-915)', async ({ page }) => {
  await open(page, null);

  await page.locator('#written-toggle').click();
  await expect(page.locator('#written')).toBeVisible();

  // Szem kerül a mintába: a panelnek nyitva kell maradnia.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.keyboard.press('Enter');

  await expect(page.locator('#written')).toBeVisible();
  await expect(page.locator('#written-text, #written-notices')).not.toHaveCount(0);
});
