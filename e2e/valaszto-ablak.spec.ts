/*
 * The make-a-pattern chooser is a modal window (PQW-1138): „Új” → a type → a
 * family opens it, and it has two ways out, both of which answer it.
 * KB: interface.md §82
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

const chooser = (page: Page) => page.locator('#setup');

async function chooseFlatShape(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: 'Regular crochet' }).click();
  await page.getByRole('menuitem', { name: 'Flat shape' }).click();
  await expect(chooser(page)).toBeVisible();
}

test('it is modal: the backdrop is over the stage and the canvas takes no clicks', async ({ page }) => {
  await open(page);
  await chooseFlatShape(page);

  await expect(chooser(page)).toHaveJSProperty('open', true);
  const modal = await chooser(page).evaluate((el) => (el as HTMLDialogElement).matches(':modal'));
  expect(modal, 'the window is in the top layer, not beside the panel').toBe(true);

  // What is under the backdrop cannot be reached: not the stitches, and not the file menu
  // either — which is what used to let a JSON arrive while the chooser stood (PQW-1139).
  const reachable = await page.evaluate(() =>
    ['#palette button', '#file-toggle'].map((selector) => {
      const button = document.querySelector<HTMLButtonElement>(selector);
      button?.focus();
      return document.activeElement === button;
    }),
  );
  expect(reachable, 'the stage is behind the backdrop').toEqual([false, false]);
});

test('„Minta létrehozása” makes the pattern, closes the window and opens the editor', async ({ page }) => {
  await open(page);
  await chooseFlatShape(page);

  await page.locator('#section-shape').getByRole('button', { name: 'Create pattern' }).click();

  await expect(chooser(page)).toBeHidden();
  await expect(page.locator('#start-note')).toBeHidden();
  await expect(page.locator('#status')).toContainText('Rectangle');
  await expect(
    page
      .locator('#palette')
      .getByRole('button', { name: /Chain \(ch\)/ })
      .first(),
  ).toBeEnabled();
  // The focus goes where the work is, not to the body a closing dialog would leave it on.
  await expect(page.locator('#board')).toBeFocused();
});

test('„Vissza” closes the window and reopens the type menu, with the pattern untouched', async ({ page }) => {
  await open(page);
  await chooseFlatShape(page);
  await page.locator('#section-shape').getByRole('button', { name: 'Create pattern' }).click();
  const made = await page.locator('#summary').textContent();

  await chooseFlatShape(page);
  await page.locator('[data-action="close-setup"]').click();

  await expect(chooser(page)).toBeHidden();
  await expect(page.locator('#types'), 'it leads back where it was opened from').toBeVisible();
  await expect(page.locator('#summary'), 'nothing but a creation replaces the pattern').toHaveText(made!);
});

test('Escape is the same way out as „Vissza”, even from the field the window opens on', async ({ page }) => {
  await open(page);
  await chooseFlatShape(page);
  // The window opens with its shape select focused, which the document key handler leaves alone.
  await expect(page.locator('#shape-kind')).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(chooser(page)).toBeHidden();
  await expect(page.locator('#types')).toBeVisible();
  await expect(page.locator('#start-note'), 'nothing was made, so the editor is still closed').toBeVisible();
});

test('it does not take width from the stage: the canvas keeps the room the panel leaves', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page);
  await chooseFlatShape(page);
  await page.locator('#section-shape').getByRole('button', { name: 'Create pattern' }).click();

  const before = await page.evaluate(() =>
    (
      window as unknown as { mintatervezoRacs: { bounds(): { x: number; width: number } | null } }
    ).mintatervezoRacs.bounds(),
  );
  await chooseFlatShape(page);
  const during = await page.evaluate(() =>
    (
      window as unknown as { mintatervezoRacs: { bounds(): { x: number; width: number } | null } }
    ).mintatervezoRacs.bounds(),
  );

  expect(during, 'the chart is where it was; a modal window is above the stage, not beside it').toEqual(before);
});
