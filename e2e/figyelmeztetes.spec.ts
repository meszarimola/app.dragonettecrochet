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

/*
 * A doboz MÁR CSAK figyelmeztetést mutat (PQW-932). A műveletek visszajelzése
 * megszűnt — a tulajdonos: „csak akkor írj ki tooltipet ha explicit kérem…
 * senkit nem érdekel”. A figyelmeztetést viszont ő maga kérte ide a
 * PQW-923-ban, ezért az marad, és a mechanizmust azon mérjük.
 */
test('a figyelmeztetés doboza fent bukkan fel, és három másodperc után eltűnik (PQW-923)', async ({ page }) => {
  await open(page);
  const alert = page.locator('#alert');
  await expect(alert, 'művelet nélkül nincs doboz').toBeHidden();

  await withWarning(page);

  await expect(alert, 'a figyelmeztetésről van látható visszajelzés').toBeVisible();
  await expect(alert).toHaveAttribute('aria-live', 'polite');
  await expect(alert, 'figyelmeztetésként jelöli').toContainText('Figyelmeztetés:');

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
  /*
   * A fordulóláncot a sor első szeme hozza (PQW-944), ezért a magasság magától
   * stimmelne. A figyelmeztetéshez a horgoló maga tesz le EGY láncszemet, és
   * utána pálcával folytatja: a lánc alacsonyabb, mint a sort kezdő szem.
   */
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+5');
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Enter');
}

/** 22 láncszem, de csak öt rövidpálca: hosszú, be nem horgolt „farok” marad. */
async function withTail(page: Page): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('22');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+3');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');
}

/** A kiemelt szemek a vásznon; üres tömb, ha a rajz tiszta. */
const highlight = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as Record<string, Record<string, () => string[]>>).mintatervezoRacs!['highlight']!());

/*
 * A tulajdonos döntése az UAT első köréből (PQW-930): „a rajzon ne is legyen
 * megjelölve a hiba, vagy figyelmeztetés, csak a jobb felső sarokban… ha
 * rákattint a felhasználó és kiválasztja a hibát, akkor a mintán jelölje meg
 * pirossal, de piros szaggatottal és 5 mp múlva tűnjön el”.
 *
 * Ez részben visszavonja a PQW-923-at: ott a kattintás azért nem emelt ki, mert
 * a rajzon alapból is ott volt minden karika, és attól lett zsúfolt.
 */
test('a rajz alapból tiszta, a találatra kattintva jelölés jön, és öt másodperc után eltűnik (PQW-930)', async ({ page }) => {
  await open(page);
  await withWarning(page);

  expect(await highlight(page), 'alapból semmi nincs megjelölve a rajzon').toEqual([]);

  await page.locator('#error-toggle').click();
  const finding = page.locator('#findings button.finding').first();
  await expect(finding).toBeVisible();
  await finding.click();

  expect((await highlight(page)).length, 'a kiválasztott találat szemei megjelölve').toBeGreaterThan(0);

  // Jelöl, de nem JELÖL KI: a kijelöléshez kötött gombok tétlenek maradnak.
  await expect(page.locator('[data-action="delete-selection"]'), 'a kattintás nem jelöl ki').toBeDisabled();
  await expect(page.locator('[data-action="duplicate-selection"]')).toBeDisabled();

  // Öt másodperc után magától eltűnik, hogy ne maradjon ott zavarni.
  await expect.poll(() => highlight(page), { timeout: 9000 }).toEqual([]);
});

/*
 * A tulajdonos szava (PQW-932): „csak akkor írj ki tooltipet ha explicit
 * kérem”, és a műveletek visszajelzéséről: „senkit nem érdekel”. Külön pont,
 * hogy a minta alkotása nem folytonos: „a sort úgy és olyan formában hozza
 * létre, olyan sorrendben, ahogy csak akarja” — egy kihagyott helyre
 * visszatérni pótlás, nem keresztezett szem, ezért nincs kérdés.
 */
test('a műveletek nem üzengetnek, és a pótlás nem kérdez (PQW-932)', async ({ page }) => {
  await open(page);
  const alert = page.locator('#alert');

  await chains(page);
  await expect(alert, 'a láncszemek lerakása nem üzenget').toBeHidden();

  await page.keyboard.press('Alt+f');
  await expect(alert, 'a fordulás nem üzenget').toBeHidden();

  await page.keyboard.press('Alt+5');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Enter');
  await expect(alert, 'a szem lerakása nem üzenget').toBeHidden();

  await page.keyboard.press('ControlOrMeta+z');
  await expect(alert, 'a visszavonás nem üzenget').toBeHidden();

  // Visszalépve egy korábban kihagyott célpontra a szem kérdés nélkül kerül le.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Keresztezett szem' }), 'nincs kérdés a pótlásról').toHaveCount(0);
  await expect(alert, 'és nem is üzenget').toBeHidden();
});

test('a láncalap be nem horgolt farka figyelmeztetés, nem hiba (PQW-930)', async ({ page }) => {
  await open(page);
  await withTail(page);

  await page.locator('#error-toggle').click();
  const list = page.locator('#findings');
  await expect(list, 'a farok nem hibaként jelenik meg').not.toContainText('Hiba:');
  await expect(list, 'hanem figyelmeztetésként').toContainText('Figyelmeztetés:');
});

test('a találat kártyáján nincs tudásbázis-hivatkozás (PQW-930)', async ({ page }) => {
  await open(page);
  await withWarning(page);

  await page.locator('#error-toggle').click();
  const list = page.locator('#findings');
  await expect(list, 'a végfelhasználót nem érdekli a tudásbázis').not.toContainText('Tudásbázis');
  await expect(list, 'a lenyíló is kikerült').not.toContainText('Részletek');
  await expect(page.locator('#findings details')).toHaveCount(0);
});


test('a vegyes szemmagasság nem ad figyelmeztetést (PQW-924)', async ({ page }) => {
  await open(page);
  await mixedHeights(page);

  // A tulajdonos szerint így készül a hullámos minta: ez szándékos, nem hiba.
  await expect(page.locator('#error-count'), 'nincs figyelmeztetés a jelzőn').toHaveText('Nincs hiba');
  await expect(page.locator('#alert')).not.toContainText('Figyelmeztetés:');
});
