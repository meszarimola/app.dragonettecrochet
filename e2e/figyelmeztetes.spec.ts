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
 * Vegyes magasságú sor: rövidpálca és egyráhajtásos pálca egymás mellett.
 *
 * A PQW-924 óta ez NEM ad figyelmeztetést — a tulajdonos szerint így készül a
 * hullámos minta —, ezért a felbukkanó doboz tesztje a fordulás üzenetére épül,
 * ez a beállítás pedig azt rögzíti, hogy figyelmeztetés nem keletkezik.
 */
async function mixedHeights(page: Page): Promise<void> {
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

/** 12 láncszem lerakása billentyűvel; a doboz ekkor még üzen. */
async function chains(page: Page): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
}

test('a doboz fent bukkan fel, és három másodperc után eltűnik (PQW-923)', async ({ page }) => {
  await open(page);
  const alert = page.locator('#alert');
  await expect(alert, 'művelet nélkül nincs doboz').toBeHidden();

  await chains(page);

  await expect(alert, 'a lerakott láncszemekről van látható visszajelzés').toBeVisible();
  await expect(alert).toHaveAttribute('aria-live', 'polite');
  await expect(alert, 'megmondja, mi történt').toContainText('12 láncszem');

  // A menüsort nem takarja: alatta kezdődik.
  const bar = (await page.locator('header.bar').boundingBox())!;
  const box = (await alert.boundingBox())!;
  expect(box.y, 'a doboz a menüsor alatt van').toBeGreaterThanOrEqual(bar.y + bar.height - 1);

  // Három másodperc után magától eltűnik; a tartós jelző marad.
  await expect(alert).toBeHidden({ timeout: 5000 });
  await expect(page.locator('#error-count'), 'a sarki jelző megmarad').toBeVisible();
});

/*
 * A tulajdonos döntése az UAT első köréből (PQW-929): „ne üzengess. a
 * felhasználó nem figyel egy pillanatra, és nem látja az üzenetet.” A fordulás
 * és az új minta ezért nem bukkan fel — az állapotot a rajzról kell leolvasni.
 * A rejtett élő régió viszont megmarad a képernyőolvasónak.
 */
test('a fordulás és az új minta nem üzenget, de az élő régió megmarad (PQW-929)', async ({ page }) => {
  await open(page);
  const alert = page.locator('#alert');

  await chains(page);
  // Megvárjuk, míg a láncszemek doboza magától eltűnik, különben az övét mérnénk.
  await expect(alert).toBeHidden({ timeout: 5000 });

  await page.keyboard.press('Alt+f');
  await expect(alert, 'a fordulás nem üzenget').toBeHidden();
  await expect(page.locator('#status'), 'az élő régió viszont elmondja').toContainText('a munka megfordítva');

  await page.getByRole('button', { name: 'Új minta' }).click();
  await expect(alert, 'az új minta nem üzenget').toBeHidden();
  await expect(page.locator('#status'), 'az élő régió az üres minta kezdését mondja').toContainText('Üres minta');
});

/**
 * Egy megmaradt figyelmeztetés: rövidpálcás sor után pálcás sor, ahol a sort
 * kezdő láncszemek magassága nem illik a sort kezdő szemhez. (A vegyes
 * magasság PQW-924 óta nem ad bejegyzést, ezért nem az szolgál kiváltóként.)
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
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');
  await page.keyboard.press('Alt+5');
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Enter');
}

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


test('a vegyes szemmagasság nem ad figyelmeztetést (PQW-924)', async ({ page }) => {
  await open(page);
  await mixedHeights(page);

  // A tulajdonos szerint így készül a hullámos minta: ez szándékos, nem hiba.
  await expect(page.locator('#error-count'), 'nincs figyelmeztetés a jelzőn').toHaveText('Nincs hiba');
  await expect(page.locator('#alert')).not.toContainText('Figyelmeztetés:');
});
