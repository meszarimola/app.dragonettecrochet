/*
 * A minta címe generáláskor (PQW-896): Kendő → félkör, majd Forma → téglalap
 * után a cím „Téglalap”, és a visszavonás a korábbi címet is visszahozza; a
 * „Minta neve” mezőben kézzel írt cím generálás után és újratöltés után is
 * megmarad.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function section(page: Page, id: string) {
  const details = page.locator(id);
  if ((await details.getAttribute('open')) === null) await details.locator('summary').click();
  return details;
}

/** Kis rövidpálcás félkör a Kendő szakaszból. */
async function semicircle(page: Page): Promise<void> {
  const shawl = await section(page, '#section-shawl');
  await page.locator('#shawl-kind').selectOption({ label: 'Félkör' });
  await page.locator('#shawl-stitch').selectOption({ label: 'Rövidpálca' });
  await page.locator('#shawl-size').fill('6');
  await shawl.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Félkör,');
}

/** Téglalap a Forma szakaszból, alapbeállítással. */
async function rectangle(page: Page): Promise<void> {
  const shape = await section(page, '#section-shape');
  await shape.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Téglalap,');
}

test('Kendő → félkör, majd Forma → téglalap: a cím a téglalapé, és a visszavonás a félkört a címével hozza vissza', async ({ page }) => {
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

test('a kézzel írt cím generálás után és újratöltés után is megmarad', async ({ page }) => {
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

  // A jelölés a mentett mintával együtt megmarad.
  await page.reload();
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
  await section(page, '#section-pattern');
  await expect(title).toHaveValue('Nyári kendő');
  await rectangle(page);
  await expect(title).toHaveValue('Nyári kendő');
});
