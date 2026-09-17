/*
 * A figyelmeztetések megjelenése (PQW-923, 3. és 4. pont).
 *
 * A tulajdonos kérése: a figyelmeztetés bukkanjon fel fent egy kis dobozban, és
 * három másodperc után tűnjön el magától; a menüsor jobb szélén lévő tartós
 * jelző maradjon; a figyelmeztetésre kattintva pedig ne jelenjen meg kiemelő
 * négyzet a szemen, mert attól zsúfolt a felület.
 *
 * Ezek a felület részei (nem a vászon rajza), ezért itt mérni lehet és kell.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await expect(page.locator('#written')).toBeHidden();
}

/**
 * Olyan minta, amelyre a program figyelmeztetést ad, de hibát nem: egy sorban
 * kevert magasságú szemek (rövidpálca és egyráhajtásos pálca). Megmértem: a
 * félkész sor már „1 figyelmeztetés”-t ad, fordulás után viszont hibák is
 * keletkeznének, azért nem fordulunk.
 */
async function withWarning(page: Page): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');
  await page.keyboard.press('Alt+3');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+5');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Enter');
}

test('a figyelmeztetés fent bukkan fel, és három másodperc után eltűnik (PQW-923)', async ({ page }) => {
  await open(page);
  const alert = page.locator('#alert');
  await expect(alert, 'figyelmeztetés nélkül nincs doboz').toBeHidden();

  await withWarning(page);
  await expect(alert, 'a figyelmeztetés felbukkan').toBeVisible();
  await expect(alert).toHaveAttribute('aria-live', 'polite');
  await expect(alert).not.toBeEmpty();
  // A szöveg egyszer írja ki a „Figyelmeztetés” szót, kettős kettőspont nélkül.
  await expect(alert).not.toContainText(': :');
  await expect(alert).toContainText('Figyelmeztetés:');

  // A menüsort nem takarja: alatta kezdődik.
  const bar = (await page.locator('header.bar').boundingBox())!;
  const box = (await alert.boundingBox())!;
  expect(box.y, 'a doboz a menüsor alatt van').toBeGreaterThanOrEqual(bar.y + bar.height - 1);

  // Három másodperc után magától eltűnik; a tartós jelző marad.
  await expect(alert).toBeHidden({ timeout: 5000 });
  await expect(page.locator('#error-count'), 'a sarki jelző megmarad').toBeVisible();
});

test('a figyelmeztetésre kattintva nincs kiemelő négyzet a szemen (PQW-923)', async ({ page }) => {
  await open(page);
  await withWarning(page);

  // A figyelmeztetés listája a menüsor jobb széléről nyílik.
  await page.locator('#error-toggle').click();
  const finding = page.locator('#findings button.finding').first();
  await expect(finding).toBeVisible();
  await finding.click();

  /*
   * A kattintás odagörget, de nem jelöl ki: a kijelöléshez kötött gombok
   * tétlenek maradnak. (A kiemelő négyzet a vásznon rajzolódott, ezért a
   * kijelölés hiányát mérjük, ami ugyanazt jelenti.)
   */
  await expect(page.locator('[data-action="delete-selection"]'), 'a kattintás nem jelöl ki').toBeDisabled();
  await expect(page.locator('[data-action="duplicate-selection"]')).toBeDisabled();
});
