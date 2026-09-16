/*
 * A felület nyelve (PQW-900): a főoldal `?lang=en` linkje angol felületet ad, a
 * kézi választó a lapon belül vált (új tárolt kulcs nélkül), a főoldal linkje a
 * nyelvet követi, és a felület nyelve független a minta jelölésétől (PQW-868).
 *
 * A nyelvválasztó a „Jelölés és jelek” szakaszban van, ami alapból csukva
 * (PQW-882), ezért a szakaszt előbb ki kell nyitni. A szakaszcímek viszont
 * csukva is látszanak, így azokon mérjük a felület nyelvét.
 */

import { expect, test, type Page } from '@playwright/test';

/** Betöltés és a süti-sáv elutasítása; a gomb nyelvtől független attribútummal. */
async function open(page: Page, search = ''): Promise<void> {
  await page.goto(`/${search}`);
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
}

/** A jelölés szakasza alapból csukva van (PQW-882). */
async function openNotation(page: Page): Promise<void> {
  await page.locator('#section-notation').evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
}

const sizeTitle = (page: Page) => page.locator('#section-size > summary');

test('a ?lang=en angol felületet ad, a lap nyelve is angol', async ({ page }) => {
  await open(page, '?lang=en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/en\//);

  await openNotation(page);
  await expect(page.locator('#ui-language')).toHaveValue('en');
});

test('paraméter nélkül magyar marad, a főoldal linkje is magyar', async ({ page }) => {
  await open(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/hu\//);

  await openNotation(page);
  await expect(page.locator('#ui-language')).toHaveValue('hu');
});

test('a kézi választó a lapon belül vált, és a címsorba is beírja a nyelvet', async ({ page }) => {
  await open(page);
  await openNotation(page);

  await page.locator('#ui-language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/en\//);
  expect(page.url()).toContain('lang=en');

  await page.locator('#ui-language').selectOption('hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
  expect(page.url()).toContain('lang=hu');
});

test('nyelvváltáskor a legördülők feliratai is az új nyelvre váltanak', async ({ page }) => {
  await open(page);
  // A generátor szakasza: a választólistákat a panel a megnyitáskor tölti fel.
  await page.locator('#section-shape').evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await expect(page.locator('#shape-kind')).toContainText('Téglalap');

  await openNotation(page);
  await page.locator('#ui-language').selectOption('en');
  await expect(page.locator('#shape-kind')).toContainText('Rectangle');
});

test('a felület nyelve és a minta jelölése független egymástól', async ({ page }) => {
  await open(page, '?lang=en');
  await openNotation(page);

  // Angol felületen is lehet magyar jelöléssel dolgozni: a szemnevek a
  // jelölést követik, a felület nyelve marad angol.
  await page.locator('#terms').selectOption('hu');
  await expect(page.locator('#terms')).toHaveValue('hu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#palette')).toContainText('Láncszem');

  await page.locator('#ui-language').selectOption('hu');
  await expect(page.locator('#terms')).toHaveValue('hu');
});

test('a nyelvválasztás nem vezet be új tárolt kulcsot', async ({ page }) => {
  await open(page);
  await openNotation(page);
  const before = await page.evaluate(() => Object.keys(localStorage).sort());

  await page.locator('#ui-language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(before);
});
