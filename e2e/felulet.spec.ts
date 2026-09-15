/*
 * A szerkesztő átszervezett felülete (PQW-873): bal oldali mintatípus-menü,
 * ikonos menüsor, szemválasztó a jobb oldali panelen (PQW-882), a menüsorban hibaszámláló, és az
 * írott minta a vászon alján lenyitható panelben.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

test('mintatípus: a szabályos aktív, a többi „hamarosan” és inaktív', async ({ page }) => {
  await open(page);

  await expect(page.getByRole('button', { name: /Szabályos horgolás/ })).toHaveAttribute('aria-pressed', 'true');

  for (const name of ['Filéhorgolás', 'Amigurumi', 'Szabálytalan horgolás']) {
    const item = page.getByRole('button', { name: new RegExp(name) });
    await expect(item).toBeDisabled();
    await expect(item).toContainText('Hamarosan');
  }
});

test('szemválasztás a jobb oldali panelből, majd horgolás', async ({ page }) => {
  await open(page);

  const palette = page.locator('#palette');
  await expect(palette).toBeVisible();

  // Láncszem kiválasztása a panel listájából.
  const chain = palette.getByRole('button', { name: /Láncszem/ }).first();
  await chain.click();
  await expect(chain).toHaveAttribute('aria-pressed', 'true');

  // Láncalap a megadott számú láncszemmel.
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('8');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');

  // Rövidpálcás sor, szintén a panelből választva.
  const sc = palette.getByRole('button', { name: /Rövidpálca \(rp\)/ }).first();
  await sc.click();
  await expect(sc).toHaveAttribute('aria-pressed', 'true');
  await expect(chain).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#board').focus();
  for (let i = 0; i < 7; i += 1) await page.keyboard.press('Enter');

  await expect(page.locator('#summary')).toContainText('7 szem.');
});

test('a hibaszámláló a menüsorban legördíti az ellenőrzés listáját', async ({ page }) => {
  await open(page);

  const errorToggle = page.locator('#error-toggle');
  const errors = page.locator('#errors');

  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  await expect(errors).toBeHidden();

  await errorToggle.click();
  await expect(errorToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(errors).toBeVisible();
  await expect(errors.locator('#summary')).toContainText('Üres minta');

  // Escape bezárja a legördülőt.
  await page.locator('#board').focus();
  await page.keyboard.press('Escape');
  await expect(errors).toBeHidden();
});

test('az írott minta a vászon alján, lenyitható panelben', async ({ page }) => {
  await open(page);

  const written = page.locator('#written');
  const writtenToggle = page.getByRole('button', { name: 'Írott minta' });

  // Széles nézetben alapból nyitva, a stage alján.
  await expect(written).toBeVisible();
  const stage = page.locator('.stage').boundingBox();
  const box = await written.boundingBox();
  const stageBox = await stage;
  expect(box!.y).toBeGreaterThan(stageBox!.y + stageBox!.height / 2);

  await writtenToggle.click();
  await expect(written).toBeHidden();
  await writtenToggle.click();
  await expect(written).toBeVisible();
});
