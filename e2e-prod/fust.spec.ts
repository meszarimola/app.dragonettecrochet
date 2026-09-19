/*
 * Füstpróba a telepített felületen (PQW-928).
 *
 * Nem az alkalmazás logikáját méri — arra ott a teljes `e2e/` készlet a
 * buildelt kimeneten. Ez arra válaszol, hogy *a telepítés* sikerült-e: a
 * megfelelő verzió megy ki, az oldal felépül, és egy láncalap valóban
 * lerakható.
 *
 * Miért így, és nem másképp (PQW-928 mérés alapján, nem feltevésből):
 *   * A láncszemek számát tartó `#count-field` REJTETT, amíg a láncszem mint
 *     szem nincs kiválasztva. Ezért előbb Alt+1, és csak utána a szám —
 *     fordított sorrendben a beírás sehova nem megy, és az alapértelmezett 12
 *     marad. A korábbi füstpróbák pontosan ezen buktak el.
 *   * Az írott minta panelje alapból zárva van, ezért a `#written-text` üres;
 *     a lerakást az állapotüzenet igazolja, ami mérhetően megjelenik.
 */

import { expect, type Page, test } from '@playwright/test';

const VART_VERZIO = process.env.VART_VERZIO ?? '';

/** Megnyitás a sütisáv elutasításával — ahogy az `e2e/editor.spec.ts` teszi. */
async function open(page: Page): Promise<string[]> {
  const hibak: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') hibak.push(m.text());
  });
  page.on('pageerror', (e) => hibak.push(`pageerror: ${e.message}`));
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
  return hibak;
}

test('a kiszolgált felület a várt verziót mutatja', async ({ page }) => {
  test.skip(VART_VERZIO === '', 'nincs megadva VART_VERZIO');
  await open(page);
  await expect(page.getByText(`v${VART_VERZIO}`, { exact: true })).toBeVisible();
});

test('az oldal felépül: vászon, panel és eszköztár a helyén', async ({ page }) => {
  const hibak = await open(page);
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Fordulás' })).toBeVisible();
  expect(hibak, `konzolhibák: ${hibak.join(' | ')}`).toHaveLength(0);
});

test('láncalap lerakható a megadott szemszámmal', async ({ page }) => {
  const hibak = await open(page);

  // Előbb a szem, utána a szám — különben a mező még rejtett (lásd a fejlécet).
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await expect(page.locator('#count-field')).toBeVisible();

  await page.locator('#chain-count').fill('22');
  await page.locator('#chain-count').press('Tab');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');

  await expect(page.getByText('22 láncszem').first()).toBeVisible({ timeout: 10_000 });
  expect(hibak, `konzolhibák: ${hibak.join(' | ')}`).toHaveLength(0);
});
