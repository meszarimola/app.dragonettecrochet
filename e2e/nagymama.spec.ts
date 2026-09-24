/*
 * The granny square designer (PQW-1040): a blank canvas, and the crocheter gives
 * each round's stitch count. The stitches spread round a square at their natural
 * size, and the right-hand panel lists the rounds instead of rows and layers.
 *
 * KB: interface.md §68
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function openGranny(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="regular"]').hover();
  await page.getByRole('menuitem', { name: /Nagymama-négyzet/ }).click();
}

interface Stored {
  readonly motif?: string;
  readonly items: readonly { rowId: string; width: number; height: number }[];
  readonly rows: readonly { id: string; kind: string }[];
}

const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}') as Stored);

test('a new granny square is a blank canvas with the rounds panel, not rows and layers', async ({ page }) => {
  await open(page);
  await openGranny(page);

  await expect(page.locator('#board-irregular')).toBeVisible();
  await expect(page.locator('#section-granny')).toBeVisible();
  await expect(page.locator('#granny-empty')).toBeVisible();
  await expect(page.locator('#granny-count')).toBeFocused();
  await expect(page.locator('#irregular-tabs')).toBeHidden();
  await expect(page.locator('#section-irregular-rows')).toBeHidden();
  await expect(page.locator('#section-irregular-layers')).toBeHidden();
  await expect(page.locator('#section-size')).toBeHidden();
  await expect(page.locator('#section-notation')).toBeHidden();
  await expect(page.locator('#section-pattern')).toBeHidden();
  // PQW-1041: the round bands are the background, not the square grid.
  await expect(page.locator('[data-action="grid"]')).toHaveAttribute('aria-pressed', 'false');

  const pattern = await stored(page);
  expect(pattern.motif).toBe('granny-square');
  expect(pattern.items).toHaveLength(0);
});

test('each round takes the count typed for it; the stitches keep one natural size', async ({ page }) => {
  await open(page);
  await openGranny(page);

  await page.locator('#granny-count').fill('8');
  await page.locator('#granny-add').click();
  await page.locator('#granny-count').fill('16');
  await page.locator('#granny-count').press('Enter');

  const rounds = page.locator('#granny-rounds li');
  await expect(rounds).toHaveCount(2);
  await expect(rounds.nth(0)).toContainText('1. kör');
  await expect(rounds.nth(0).locator('input')).toHaveValue('8');
  await expect(rounds.nth(1).locator('input')).toHaveValue('16');
  await expect(rounds.nth(0)).toContainText('erp');
  await expect(page.locator('#granny-empty')).toBeHidden();

  const pattern = await stored(page);
  expect(pattern.rows.map((row) => row.kind)).toEqual(['round', 'round']);
  expect(pattern.items).toHaveLength(24);
  const sizes = new Set(pattern.items.map((item) => `${item.width}×${item.height}`));
  expect(sizes.size, 'every stitch is drawn at the same natural size').toBe(1);
});

test('a round count can be changed afterwards, and the last round removed', async ({ page }) => {
  await open(page);
  await openGranny(page);

  await page.locator('#granny-count').fill('8');
  await page.locator('#granny-add').click();
  await page.locator('#granny-count').fill('16');
  await page.locator('#granny-add').click();

  const first = page.locator('#granny-rounds li').nth(0).locator('input');
  await first.fill('12');
  await first.press('Tab');
  await expect.poll(async () => (await stored(page)).items.length).toBe(28);

  await page.locator('#granny-remove').click();
  await expect(page.locator('#granny-rounds li')).toHaveCount(1);
  await expect.poll(async () => (await stored(page)).items.length).toBe(12);
});

test('the work it replaced comes back with undo', async ({ page }) => {
  await open(page);
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="irregular"]').click();
  await page.locator('#board-irregular').focus();
  await page.keyboard.press('Alt+5');
  await page.locator('#board-irregular').click({ position: { x: 500, y: 300 } });
  await page.locator('#board-irregular').click({ position: { x: 560, y: 300 } });
  const before = (await stored(page)).items.length;
  expect(before).toBeGreaterThan(0);

  await openGranny(page);
  await expect.poll(async () => (await stored(page)).motif).toBe('granny-square');
  await page.locator('#board-irregular').focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect.poll(async () => (await stored(page)).items.length).toBe(before);
  await expect(page.locator('#section-granny')).toBeHidden();
  await expect(page.locator('#irregular-tabs')).toBeVisible();
});
