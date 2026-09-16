/*
 * A felület második köre (PQW-912): a Fájl lenyíló tartalma tényleg látszik, a
 * panelek kapcsolói a menüsorban vannak, a mintatípus-sáv csukható és az
 * állapota megmarad, és a típusválasztás nem nyitja fel az írott mintát.
 *
 * A lenyíló tesztje szándékosan LE IS NYITJA a menüt: a PQW-911-ben pont azért
 * maradt benn egy hiba, mert a tesztek csak a gomb meglétét nézték.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
}

test('a Fájl lenyíló tartalma látszik és a képernyőn belül van', async ({ page }) => {
  await open(page);
  const pop = page.locator('#file-pop');
  await expect(pop).toBeHidden();

  await page.locator('#file-toggle').click();
  await expect(pop).toBeVisible();

  // A menü a gombjához igazodik, nem lóg ki balra.
  const viewport = page.viewportSize()!;
  const box = (await pop.boundingBox())!;
  expect(box.x, 'a lenyíló bal széle a képernyőn belül').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'a lenyíló jobb széle a képernyőn belül').toBeLessThanOrEqual(viewport.width);

  // Mind a négy művelet látszik, olvasható felirattal, a képernyőn belül.
  const items = pop.locator('button');
  await expect(items).toHaveCount(4);
  for (const action of ['import-json', 'export-json', 'export-png', 'export-svg']) {
    const item = pop.locator(`[data-action="${action}"]`);
    await expect(item, action).toBeVisible();
    await expect(item, action).toHaveText(/\S/);
    const rect = (await item.boundingBox())!;
    expect(rect.x, action).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width, action).toBeLessThanOrEqual(viewport.width);
  }

  // A menüpont kattintható: a menü a választás után csukódik.
  await pop.locator('[data-action="export-json"]').click();
  await expect(pop).toBeHidden();
});

test('a panelek kapcsolói a menüsorban vannak, a fejlécben csak a cím és a Főoldal', async ({ page }) => {
  await open(page);

  for (const id of ['#panel-toggle', '#written-toggle', '#error-toggle', '#types-toggle']) {
    await expect(page.locator(`.tools ${id}`), id).toHaveCount(1);
  }
  await expect(page.locator('.bar .bar__toggle')).toHaveCount(0);
  await expect(page.locator('.bar__lead #home-link')).toBeVisible();
});

test('a mintatípus-sáv csukható, és az állapota megmarad újratöltés után', async ({ page }) => {
  await open(page);
  const types = page.locator('#types');
  const toggle = page.locator('#types-toggle');
  await expect(types).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');

  await toggle.click();
  await expect(types).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await page.goto('/');
  await expect(page.locator('#types')).toBeHidden();
  await expect(page.locator('#types-toggle')).toHaveAttribute('aria-expanded', 'false');

  await page.locator('#types-toggle').click();
  await expect(page.locator('#types')).toBeVisible();
});

test('a típusválasztás nem nyitja fel az írott minta panelt', async ({ page }) => {
  await open(page);
  const written = page.locator('#written');
  await expect(written).toBeHidden();

  // Az amigurumiban a szöveg az elsődleges nézet, de a panel a felhasználóé.
  await page.locator('.type[data-type="amigurumi"]').click();
  await expect(written).toBeHidden();

  await page.locator('#written-toggle').click();
  await expect(written).toBeVisible();
});
