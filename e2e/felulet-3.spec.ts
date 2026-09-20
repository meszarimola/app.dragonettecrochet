/*
 * The second round of the interface (PQW-912): the content of the File dropdown
 * really is visible, the panel toggles are in the menu bar, the pattern type bar
 * can be collapsed and its state survives, and choosing a type does not open the
 * written pattern.
 *
 * The dropdown test deliberately OPENS the menu too: in PQW-911 a bug stayed in
 * precisely because the tests only looked at whether the button existed.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
}

test('the content of the File dropdown is visible and stays on screen', async ({ page }) => {
  await open(page);
  const pop = page.locator('#file-pop');
  await expect(pop).toBeHidden();

  await page.locator('#file-toggle').click();
  await expect(pop).toBeVisible();

  // The menu aligns to its button, and does not hang off to the left.
  const viewport = page.viewportSize()!;
  const box = (await pop.boundingBox())!;
  expect(box.x, 'the left edge of the dropdown is on screen').toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, 'the right edge of the dropdown is on screen').toBeLessThanOrEqual(viewport.width);

  // The sheet opener joined the menu in PQW-987: it starts a pattern, as the „Új minta"
  // button beside the menu does. It is checked the same way, then the four file actions.
  const items = pop.locator('button');
  await expect(items).toHaveCount(5);
  const opener = pop.locator('#setup-toggle');
  await expect(opener).toBeVisible();
  await expect(opener).toHaveText(/\S/);
  const openerBox = (await opener.boundingBox())!;
  expect(openerBox.x).toBeGreaterThanOrEqual(0);
  expect(openerBox.x + openerBox.width).toBeLessThanOrEqual(viewport.width);

  for (const action of ['import-json', 'export-json', 'export-png', 'export-svg']) {
    const item = pop.locator(`[data-action="${action}"]`);
    await expect(item, action).toBeVisible();
    await expect(item, action).toHaveText(/\S/);
    const rect = (await item.boundingBox())!;
    expect(rect.x, action).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width, action).toBeLessThanOrEqual(viewport.width);
  }

  // The menu item is clickable: the menu closes after the choice.
  await pop.locator('[data-action="export-json"]').click();
  await expect(pop).toBeHidden();
});

test('the panel toggles are in the menu bar, the header holds only the title and Home', async ({ page }) => {
  await open(page);

  for (const id of ['#panel-toggle', '#written-toggle', '#error-toggle', '#types-toggle']) {
    await expect(page.locator(`.tools ${id}`), id).toHaveCount(1);
  }
  await expect(page.locator('.bar .bar__toggle')).toHaveCount(0);
  await expect(page.locator('.bar__lead #home-link')).toBeVisible();
});

test('the pattern type bar can be collapsed, and its state survives a reload', async ({ page }) => {
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

test('choosing a pattern type does not open the written pattern panel', async ({ page }) => {
  // PQW-925: it clicks the amigurumi type, which is temporarily switched off.
  test.skip(true, 'PQW-925: the amigurumi pattern type is temporarily switched off');
  await open(page);
  const written = page.locator('#written');
  await expect(written).toBeHidden();

  // In amigurumi the text is the primary view, but the panel belongs to the user.
  await page.locator('.type[data-type="amigurumi"]').click();
  await expect(written).toBeHidden();

  await page.locator('#written-toggle').click();
  await expect(written).toBeVisible();
});
