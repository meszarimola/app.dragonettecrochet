/*
 * Selection, deletion, copy, paste and duplication in the editor (PQW-875):
 * copying and pasting the row selected by its label, undo; deletion showing the
 * affected stitches; selection by keyboard and by area.
 *
 * The interface publishes the positions of the stitches in an automated browser
 * (`window.mintatervezoKijeloles`, src/ui/main.ts).
 */

import { expect, type Page, test } from '@playwright/test';

interface PlacedNode {
  readonly id: string;
  readonly def: string;
  readonly layer: number;
  readonly x: number;
  readonly y: number;
}

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
  // The written pattern panel starts closed (PQW-911): it does not cover the canvas.
  await expect(page.locator('#written')).toBeHidden();
}

const api = <T>(page: Page, name: 'nodes' | 'selection' | 'labels'): Promise<T> =>
  page.evaluate((method) => {
    const w = window as unknown as Record<string, Record<string, () => unknown>>;
    return (method === 'labels' ? w.mintatervezoRacs!.labels!() : w.mintatervezoKijeloles![method]!()) as never;
  }, name);

/** Half double crochet rectangle from the keyboard only, ending without a stitch (Esc). */
async function rectangle(page: Page, width: number, rows: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').fill(String(width + 2));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+4');
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) await page.keyboard.press('Alt+f');
    // The first stitch of a turned row becomes the turning chain (PQW-944), so there we crochet one more time.
    for (let i = 0; i < width + (row > 1 ? 1 : 0); i += 1) await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  // Zooming lives in its own menu (interface.md §63).
  await page.locator('#zoom-toggle').click();
  await page.getByRole('button', { name: 'Egész minta' }).click();
  await page.locator('#board').focus();
}

async function clickLabel(page: Page, layer: number): Promise<void> {
  const label = (await api<{ layer: number; x: number; y: number }[]>(page, 'labels')).find(
    (candidate) => candidate.layer === layer,
  );
  expect(label, `the label of row ${layer}`).toBeTruthy();
  await page.mouse.click(label!.x, label!.y);
}

test('copying the row selected by its label, pasting it as the next row and undoing it; duplicating from the menu bar', async ({
  page,
}) => {
  await open(page);
  await rectangle(page, 5, 2);
  const summary = page.locator('#summary');
  const status = page.locator('#status');
  const duplicate = page.locator('.tools [data-action="duplicate-selection"]');
  const remove = page.locator('.tools [data-action="delete-selection"]');
  await expect(summary).toContainText('3. sor: 6 szem');
  await expect(duplicate).toBeDisabled();
  await expect(remove).toBeDisabled();

  await clickLabel(page, 2);
  await expect(status).toHaveText('3. sor kijelölve: 6 szem.');
  await expect(duplicate).toBeEnabled();
  await expect(remove).toBeEnabled();

  await page.keyboard.press('ControlOrMeta+c');
  await expect(status).toContainText('a vágólapon');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(summary).toContainText('3 sor. 4. sor: 6 szem.');
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');

  // One undo takes back the whole paste.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(summary).toContainText('2 sor. 3. sor: 6 szem.');

  await clickLabel(page, 2);
  await duplicate.click();
  await expect(summary).toContainText('3 sor. 4. sor: 6 szem.');
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(summary).toContainText('2 sor. 3. sor: 6 szem.');
});

test('deleting a middle stitch: the affected stitches are shown, the deletion can be cancelled, or goes together with them', async ({
  page,
}) => {
  await open(page);
  await rectangle(page, 5, 2);
  const summary = page.locator('#summary');
  const dialog = page.locator('dialog.ask');

  const row1 = (await api<PlacedNode[]>(page, 'nodes'))
    .filter((node) => node.layer === 1 && node.def === 'hdc')
    .sort((a, b) => a.x - b.x);
  await page.mouse.click(row1[2]!.x, row1[2]!.y);
  await expect(page.locator('#status')).toContainText('Kijelölve: 1 szem');

  await page.keyboard.press('Delete');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('még 1 szem horgol: 3. sor: 1 szem');
  await dialog.getByRole('button', { name: 'Megszakítás' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#status')).toHaveText('A törlés megszakítva; a minta nem változott.');
  await expect(summary).toContainText('3. sor: 6 szem');

  await page.getByRole('button', { name: 'Kijelölés törlése' }).click();
  await dialog.getByRole('button', { name: 'Törlés velük együtt' }).click();
  await expect(summary).toContainText('3. sor: 5 szem');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(summary).toContainText('3. sor: 6 szem');
});

test('selection by keyboard and by area; with too few targets it warns, and pastes nothing', async ({ page }) => {
  await open(page);
  await rectangle(page, 5, 2);
  const summary = page.locator('#summary');
  const status = page.locator('#status');

  // From the keyboard: the last stitch, then Shift+Home to the start of the row, Ctrl+D into the next row.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+Home');
  // The row with the 2 chain stitches of the turning chain and 4 half double crochets: the turning chain stands in place of stitch 1 (PQW-891).
  await expect(status).toContainText('Kijelölve: 7 szem (3. sor: 7 szem)');
  await page.keyboard.press('ControlOrMeta+d');
  await expect(summary).toContainText('3 sor. 4. sor: 6 szem.');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('Escape');

  // Area: with the menu bar button, a rectangle dragged around the symbols of row 1.
  const area = page.locator('.tools [data-action="select-area"]');
  await area.click();
  await expect(area).toHaveAttribute('aria-pressed', 'true');
  const row1 = (await api<PlacedNode[]>(page, 'nodes')).filter((node) => node.layer === 1 && node.def === 'hdc');
  const xs = row1.map((node) => node.x);
  const ys = row1.map((node) => node.y);
  await page.mouse.move(Math.min(...xs) - 6, Math.min(...ys) - 6);
  await page.mouse.down();
  await page.mouse.move(Math.max(...xs) + 6, Math.max(...ys) + 6, { steps: 5 });
  await page.mouse.up();
  const selected = await api<string[]>(page, 'selection');
  expect([...selected].sort()).toEqual(row1.map((node) => node.id).sort());

  // The 5 stitches copied from the middle of the row have no target at the end of the finished row 2: they do not go in even partly.
  await page.keyboard.press('ControlOrMeta+d');
  await expect(status).toContainText('Nincs elég célpont');
  await expect(status).toContainText('A minta nem változott.');
  await expect(summary).toContainText('2 sor. 3. sor: 6 szem.');
});
