/*
 * The title of the pattern on generation (PQW-896): after „Kendő” → semicircle
 * and then „Forma” → rectangle the title is „Téglalap”, and undo brings back the
 * earlier title as well; a title typed by hand into the „Minta neve” field
 * survives generation and a reload.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

/** The make-a-pattern sheet (PQW-987) is closed on load, and its opener is in the file menu. */
async function openSheet(page: Page): Promise<void> {
  const sheet = page.locator('#setup-toggle');
  if ((await sheet.getAttribute('aria-expanded')) !== 'true') {
    await page.locator('#file-toggle').click();
    await sheet.click();
  }
}

async function section(page: Page, id: string) {
  const details = page.locator(id);
  if (await details.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page);
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  return details;
}

/** A small single crochet semicircle from the „Kendő” section. */
async function semicircle(page: Page): Promise<void> {
  const shawl = await section(page, '#section-shawl');
  await page.locator('#shawl-kind').selectOption({ label: 'Félkör' });
  await page.locator('#shawl-stitch').selectOption({ label: 'Rövidpálca' });
  await page.locator('#shawl-size').fill('6');
  await shawl.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Félkör,');
}

/** A rectangle from the „Forma” section, with the default settings. */
async function rectangle(page: Page): Promise<void> {
  const shape = await section(page, '#section-shape');
  await shape.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Téglalap,');
}

test('Kendő → semicircle, then Forma → rectangle: the title belongs to the rectangle, and undo brings the semicircle back with its title', async ({
  page,
}) => {
  await open(page);
  await section(page, '#section-pattern');
  const title = page.locator('#title');

  await semicircle(page);
  await expect(title).toHaveValue('Félkör');
  await rectangle(page);
  await expect(title).toHaveValue('Téglalap');

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Visszavonva.');
  await expect(title).toHaveValue('Félkör');
});

test('a hand-written title survives generation and a reload', async ({ page }) => {
  await open(page);
  await section(page, '#section-pattern');
  const title = page.locator('#title');

  await semicircle(page);
  await title.fill('Nyári kendő');
  await title.press('Tab');
  await expect(page.locator('#status')).toContainText('A minta neve módosult.');

  await rectangle(page);
  await expect(title).toHaveValue('Nyári kendő');
  await semicircle(page);
  await expect(title).toHaveValue('Nyári kendő');

  // The notation survives together with the saved pattern.
  await page.reload();
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
  await section(page, '#section-pattern');
  await expect(title).toHaveValue('Nyári kendő');
  await rectangle(page);
  await expect(title).toHaveValue('Nyári kendő');
});
