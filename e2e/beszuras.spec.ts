/*
 * Insertion mode in the Stitches section (PQW-869): only the modes the stitch
 * allows, selectable from the keyboard, and the row fill, the status bar and
 * the written pattern follow it.
 */

import { expect, type Page, test } from '@playwright/test';

import { asReturningVisitor } from './kezdet.ts';

async function open(page: Page): Promise<void> {
  await asReturningVisitor(page);
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

async function foundation(page: Page, chains: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').fill(String(chains));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
}

test('back loop single crochet row and post stitch row: the mode is selectable from the keyboard, and the pattern follows', {
  tag: '@kiadas',
}, async ({ page }) => {
  await open(page);
  await foundation(page, 8);

  const insertion = page.getByRole('group', { name: 'Insertion' });
  // There is nothing to choose for a chain stitch.
  await expect(insertion).toBeHidden();

  await page.keyboard.press('Alt+3'); // single crochet
  await expect(insertion).toBeVisible();
  await expect(insertion.getByRole('radio')).toHaveCount(5);
  await expect(insertion.getByRole('radio', { name: 'both loops' })).toBeChecked();

  // From the keyboard: focus the group, then arrow down to the back loop.
  await insertion.getByRole('radio', { name: 'both loops' }).focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(insertion.getByRole('radio', { name: 'back loop' })).toBeChecked();
  await expect(insertion).toContainText('In the written pattern: sc BLO');

  await page.getByRole('button', { name: 'Fill row' }).click();
  await expect(page.locator('#status')).toContainText('Row filled, back loop.');
  await expect(page.locator('#summary')).toContainText('No errors or warnings.');
  // The written pattern panel starts closed (PQW-911), and does not refresh while closed.
  await page.locator('#written-toggle').click();
  // The turning chain stands in place of single crochet 1 (PQW-891): 6 sc out of 8 chains, from chain 3.
  await expect(page.locator('#written-text')).toContainText('Row 2: skip 2 ch, sc BLO in each ch across');
  await expect(page.locator('#written-text')).toContainText('BLO – back loop only');

  // A slip stitch allows no post stitch: only three modes; it does allow the back loop, so that stays selected.
  await page.keyboard.press('Alt+2');
  await expect(insertion.getByRole('radio')).toHaveCount(3);
  await expect(insertion.getByRole('radio', { name: 'front post' })).toHaveCount(0);
  await expect(insertion.getByRole('radio', { name: 'back loop' })).toBeChecked();

  // Post stitch row in double crochet; the choice survives a change of stitch.
  await page.keyboard.press('Alt+5');
  await insertion.getByText('Front post').click();
  // Shortcuts do not fire on a radio button, as in the other fields: back to the canvas.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+f');
  await page.keyboard.press('Alt+3');
  await page.keyboard.press('Alt+5');
  await expect(insertion.getByRole('radio', { name: 'front post' })).toBeChecked();
  await page.getByRole('button', { name: 'Fill row' }).click();
  await expect(page.locator('#status')).toContainText('Row filled, front post.');
  await expect(page.locator('#written-text')).toContainText('FPdc');
});
