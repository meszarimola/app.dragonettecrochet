/*
 * Beszúrási mód a Szemek szakaszban (PQW-869): csak a szem által megengedett
 * módok, billentyűzettel választható, és a sor kitöltése, az állapotsor és az
 * írott minta követi.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function foundation(page: Page, chains: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await page.locator('#chain-count').fill(String(chains));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
}

test('hátsó szálas rövidpálcás sor és reliefes sor: a mód billentyűzettel választható, a minta követi', async ({ page }) => {
  await open(page);
  await foundation(page, 8);

  const insertion = page.getByRole('group', { name: 'Beszúrás' });
  // Láncszemnél nincs mit választani.
  await expect(insertion).toBeHidden();

  await page.keyboard.press('3'); // rövidpálca
  await expect(insertion).toBeVisible();
  await expect(insertion.getByRole('radio')).toHaveCount(5);
  await expect(insertion.getByRole('radio', { name: 'Mindkét szál' })).toBeChecked();

  // Billentyűzettel: fókusz a csoportra, nyíllal a hátsó szálig.
  await insertion.getByRole('radio', { name: 'Mindkét szál' }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(insertion.getByRole('radio', { name: 'Hátsó szál' })).toBeChecked();
  await expect(insertion).toContainText('Írott mintában: rp (hsz)');

  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await expect(page.locator('#status')).toContainText('Sor kitöltve, hátsó szál.');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  // A fordulólánc az 1. rövidpálca helyett áll (PQW-891): 8 láncszemből 6 rp a 3. láncszemtől.
  await expect(page.locator('#written-text')).toContainText(
    '1. sor: a horogtól számított 3. láncszemtől kezdve (a kihagyott láncszemek 1 rp-nek számítanak) 6 rp (hsz)',
  );
  await expect(page.locator('#written-text')).toContainText('hsz – hátsó szálba');

  // A kúszószem reliefet nem enged: csak három mód; a hátsó szálat engedi, ezért az marad kiválasztva.
  await page.keyboard.press('2');
  await expect(insertion.getByRole('radio')).toHaveCount(3);
  await expect(insertion.getByRole('radio', { name: 'Első relief' })).toHaveCount(0);
  await expect(insertion.getByRole('radio', { name: 'Hátsó szál' })).toBeChecked();

  // Reliefes sor egyráhajtásos pálcával; a választás a szemváltás után is megmarad.
  await page.keyboard.press('5');
  await insertion.getByText('Első relief').click();
  // A rádiógombon a gyorsbillentyűk nem élnek, mint a többi mezőben: vissza a vászonra.
  await page.locator('#board').focus();
  await page.keyboard.press('f');
  await page.keyboard.press('3');
  await page.keyboard.press('5');
  await expect(insertion.getByRole('radio', { name: 'Első relief' })).toBeChecked();
  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await expect(page.locator('#status')).toContainText('Sor kitöltve, első relief.');
  await expect(page.locator('#written-text')).toContainText('Eerp');
});
