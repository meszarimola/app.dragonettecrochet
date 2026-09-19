/*
 * Insertion mode in the Stitches section (PQW-869): only the modes the stitch
 * allows, selectable from the keyboard, and the row fill, the status bar and
 * the written pattern follow it.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function foundation(page: Page, chains: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').fill(String(chains));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
}

test('back loop single crochet row and post stitch row: the mode is selectable from the keyboard, and the pattern follows', async ({ page }) => {
  await open(page);
  await foundation(page, 8);

  const insertion = page.getByRole('group', { name: 'Beszúrás' });
  // There is nothing to choose for a chain stitch.
  await expect(insertion).toBeHidden();

  await page.keyboard.press('Alt+3'); // single crochet
  await expect(insertion).toBeVisible();
  await expect(insertion.getByRole('radio')).toHaveCount(5);
  await expect(insertion.getByRole('radio', { name: 'Mindkét szál' })).toBeChecked();

  // From the keyboard: focus the group, then arrow down to the back loop.
  await insertion.getByRole('radio', { name: 'Mindkét szál' }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(insertion.getByRole('radio', { name: 'Hátsó szál' })).toBeChecked();
  await expect(insertion).toContainText('Írott mintában: rp (hsz)');

  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await expect(page.locator('#status')).toContainText('Sor kitöltve, hátsó szál.');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  // The written pattern panel starts closed (PQW-911), and does not refresh while closed.
  await page.locator('#written-toggle').click();
  // The turning chain stands in place of single crochet 1 (PQW-891): 6 sc out of 8 chains, from chain 3.
  await expect(page.locator('#written-text')).toContainText(
    '2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp (hsz)',
  );
  await expect(page.locator('#written-text')).toContainText('hsz – hátsó szálba');

  // A slip stitch allows no post stitch: only three modes; it does allow the back loop, so that stays selected.
  await page.keyboard.press('Alt+2');
  await expect(insertion.getByRole('radio')).toHaveCount(3);
  await expect(insertion.getByRole('radio', { name: 'Első relief' })).toHaveCount(0);
  await expect(insertion.getByRole('radio', { name: 'Hátsó szál' })).toBeChecked();

  // Post stitch row in double crochet; the choice survives a change of stitch.
  await page.keyboard.press('Alt+5');
  await insertion.getByText('Első relief').click();
  // Shortcuts do not fire on a radio button, as in the other fields: back to the canvas.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+f');
  await page.keyboard.press('Alt+3');
  await page.keyboard.press('Alt+5');
  await expect(insertion.getByRole('radio', { name: 'Első relief' })).toBeChecked();
  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await expect(page.locator('#status')).toContainText('Sor kitöltve, első relief.');
  await expect(page.locator('#written-text')).toContainText('Eerp');
});
