/*
 * The title of the pattern on generation (PQW-896): after “Shawl” → semicircle
 * and then “Shape” → rectangle the title is “Rectangle”, and undo brings back the
 * earlier title as well. Since PQW-920 the generated title follows the notation,
 * not the interface, so with the default US terms it is English.
 *
 * KB: owner-decisions.md §16
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

/** KB: interface.md §79 — the sheet opens from the „New” menu, on one family, and shows only it. */
async function openSheet(page: Page, family: RegExp = /Flat shape/): Promise<void> {
  if (await page.locator('#setup').isHidden()) {
    await page.locator('#types-toggle').click();
    await page.locator('.type[data-type="regular"]').click();
    await page.getByRole('menuitem', { name: family }).click();
  }
}

async function section(page: Page, id: string) {
  const details = page.locator(id);
  if (await details.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page);
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  return details;
}

/** A small single crochet semicircle from the “Shawl” section. */
async function semicircle(page: Page): Promise<void> {
  const shawl = await section(page, '#section-shawl');
  await page.locator('#shawl-kind').selectOption({ label: 'Semicircle' });
  await page.locator('#shawl-stitch').selectOption({ label: 'Single crochet' });
  await page.locator('#shawl-size').fill('6');
  await shawl.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Semicircle:');
}

/** A rectangle from the “Shape” section, with the default settings. */
async function rectangle(page: Page): Promise<void> {
  const shape = await section(page, '#section-shape');
  await shape.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Rectangle:');
}

/** The pattern's title, from the store the app writes it to (PQW-1048). */
const storedTitle = (page: Page) => async () =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('dc-mintatervezo:minta') ?? '{}') as { title?: string }).title);

test('Shawl → semicircle, then Shape → rectangle: the title belongs to the rectangle, and undo brings the semicircle back with its title', {
  tag: '@kiadas',
}, async ({ page }) => {
  await open(page);
  // PQW-1048: the name field is gone, so the title is read where the app keeps it.
  const title = storedTitle(page);

  await semicircle(page);
  await expect.poll(title).toBe('Semicircle');
  await rectangle(page);
  await expect.poll(title).toBe('Rectangle');

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Undone.');
  await expect.poll(title).toBe('Semicircle');
});

/*
 * PQW-1048 removed the name field, so a title cannot be written by hand any more
 * and the test that covered it is gone with the control. The generated title is
 * still covered above, and `core-pattern-title` keeps the naming rules under test.
 */
