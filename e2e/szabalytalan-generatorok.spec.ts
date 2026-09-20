/*
 * The regular generator sections leave with the regular editor (PQW-976). In
 * free-form mode the panel used to keep „Méret és fonal”, „Forma”, „Kendő”,
 * „Ruhadarab” and „Kör és motívum”, and pressing a „Minta létrehozása” there
 * replaced the hidden regular pattern and autosaved over it. The sections of
 * the switched-off types stay hidden in both modes.
 */

import { expect, type Page, test } from '@playwright/test';

const REGULAR_SECTIONS = ['#section-size', '#section-shape', '#section-shawl', '#section-garment', '#section-rounds'];
const DISABLED_SECTIONS = ['#section-grid', '#section-amigurumi'];

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseIrregular(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Szabálytalan horgolás/ }).click();
  await expect(page.locator('#board-irregular')).toBeVisible();
}

async function chooseRegular(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#board')).toBeVisible();
}

async function openSection(page: Page, selector: string): Promise<void> {
  const section = page.locator(selector);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('the free-form type takes the regular generators out of the panel, and brings them back', async ({ page }) => {
  await open(page);
  for (const selector of REGULAR_SECTIONS) await expect(page.locator(selector)).toBeVisible();

  await chooseIrregular(page);
  for (const selector of REGULAR_SECTIONS) await expect(page.locator(selector)).toBeHidden();
  await expect(page.locator('#section-irregular')).toBeVisible();

  await chooseRegular(page);
  for (const selector of REGULAR_SECTIONS) await expect(page.locator(selector)).toBeVisible();
});

test('a switched-off pattern type stays hidden in both modes', async ({ page }) => {
  await open(page);
  for (const selector of DISABLED_SECTIONS) await expect(page.locator(selector)).toBeHidden();

  await chooseIrregular(page);
  for (const selector of DISABLED_SECTIONS) await expect(page.locator(selector)).toBeHidden();

  await chooseRegular(page);
  for (const selector of DISABLED_SECTIONS) await expect(page.locator(selector)).toBeHidden();
});

test('the regular pattern comes back untouched from free-form mode', async ({ page }) => {
  await open(page);

  // A flat circle of four rounds, and the shape generator left open behind it.
  await openSection(page, '#section-rounds');
  await page.locator('#rounds-count').fill('4');
  await page.locator('#rounds-count').press('Tab');
  await page.locator('#section-rounds').getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Lapos kör, 4 kör elkészült;');
  await openSection(page, '#section-shape');
  const before = await writtenText(page);
  const summaryBefore = await page.locator('#summary').textContent();
  expect(before).toContain('4. kör:');

  await chooseIrregular(page);
  // With the bug the shape generator is still at hand here, and one press
  // crochets a rectangle over the circle nobody can see.
  const create = page.locator('#section-shape').getByRole('button', { name: 'Minta létrehozása' });
  if (await create.isVisible()) await create.click();

  await chooseRegular(page);
  await expect(page.locator('#summary')).toHaveText(summaryBefore ?? '');
  expect(await writtenText(page)).toBe(before);
});
