/*
 * Kijelölés, törlés, másolás, beillesztés és duplikálás a szerkesztőben
 * (PQW-875): a sorszámmal kijelölt sor másolása és beillesztése, visszavonás;
 * törlés az érintett szemek megmutatásával; kijelölés billentyűzettel és
 * területtel.
 *
 * A szemek helyét a felület automatizált böngészőben adja ki
 * (`window.mintatervezoKijeloles`, src/ui/main.ts).
 */

import { expect, test, type Page } from '@playwright/test';

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
  // Az írott minta panelje csukva indul (PQW-911): nem takarja a vásznat.
  await expect(page.locator('#written')).toBeHidden();
}

const api = <T>(page: Page, name: 'nodes' | 'selection' | 'labels'): Promise<T> =>
  page.evaluate((method) => {
    const w = window as unknown as Record<string, Record<string, () => unknown>>;
    return (method === 'labels' ? w.mintatervezoRacs!.labels!() : w.mintatervezoKijeloles![method]!()) as never;
  }, name);

/** Félpálcás téglalap csak billentyűvel, a végén szem nélkül (Esc). */
async function rectangle(page: Page, width: number, rows: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').fill(String(width + 2));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+4');
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) await page.keyboard.press('Alt+f');
    for (let i = 0; i < width; i += 1) await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Egész minta' }).click();
  await page.locator('#board').focus();
}

async function clickLabel(page: Page, layer: number): Promise<void> {
  const label = (await api<{ layer: number; x: number; y: number }[]>(page, 'labels')).find((candidate) => candidate.layer === layer);
  expect(label, `a(z) ${layer}. sor sorszáma`).toBeTruthy();
  await page.mouse.click(label!.x, label!.y);
}

test('a sorszámmal kijelölt sor másolása, beillesztése a következő sorként és visszavonása; duplikálás a menüsorból', async ({ page }) => {
  await open(page);
  await rectangle(page, 5, 2);
  const summary = page.locator('#summary');
  const status = page.locator('#status');
  const duplicate = page.locator('.tools [data-action="duplicate-selection"]');
  const remove = page.locator('.tools [data-action="delete-selection"]');
  await expect(summary).toContainText('3. sor: 5 szem');
  await expect(duplicate).toBeDisabled();
  await expect(remove).toBeDisabled();

  await clickLabel(page, 2);
  await expect(status).toHaveText('3. sor kijelölve: 5 szem.');
  await expect(duplicate).toBeEnabled();
  await expect(remove).toBeEnabled();

  await page.keyboard.press('ControlOrMeta+c');
  await expect(status).toContainText('a vágólapon');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(summary).toContainText('3 sor. 4. sor: 5 szem.');
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');

  // Egy visszavonás az egész beillesztést visszaveszi.
  await page.keyboard.press('ControlOrMeta+z');
  await expect(summary).toContainText('2 sor. 3. sor: 5 szem.');

  await clickLabel(page, 2);
  await duplicate.click();
  await expect(summary).toContainText('3 sor. 4. sor: 5 szem.');
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(summary).toContainText('2 sor. 3. sor: 5 szem.');
});

test('középső szem törlése: az érintett szemek megjelennek, a törlés megszakítható, vagy velük együtt megy', async ({ page }) => {
  await open(page);
  await rectangle(page, 5, 2);
  const summary = page.locator('#summary');
  const dialog = page.locator('dialog.ask');

  const row1 = (await api<PlacedNode[]>(page, 'nodes')).filter((node) => node.layer === 1 && node.def === 'hdc').sort((a, b) => a.x - b.x);
  await page.mouse.click(row1[2]!.x, row1[2]!.y);
  await expect(page.locator('#status')).toContainText('Kijelölve: 1 szem');

  await page.keyboard.press('Delete');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('még 1 szem horgol: 3. sor: 1 szem');
  await dialog.getByRole('button', { name: 'Megszakítás' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#status')).toHaveText('A törlés megszakítva; a minta nem változott.');
  await expect(summary).toContainText('3. sor: 5 szem');

  await page.getByRole('button', { name: 'Kijelölés törlése' }).click();
  await dialog.getByRole('button', { name: 'Törlés velük együtt' }).click();
  await expect(summary).toContainText('3. sor: 4 szem');
  await page.keyboard.press('ControlOrMeta+z');
  await expect(summary).toContainText('3. sor: 5 szem');
});

test('kijelölés billentyűzettel és területtel; kevés célpontnál figyelmeztet, és nem illeszt be', async ({ page }) => {
  await open(page);
  await rectangle(page, 5, 2);
  const summary = page.locator('#summary');
  const status = page.locator('#status');

  // Billentyűzettel: az utolsó szem, majd Shift+Home-mal a sor elejéig, Ctrl+D a következő sorba.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Shift+Home');
  // A sor a fordulólánc 2 láncszemével és 4 félpálcával: a fordulólánc az 1. szem helyett áll (PQW-891).
  await expect(status).toContainText('Kijelölve: 6 szem (3. sor: 6 szem)');
  await page.keyboard.press('ControlOrMeta+d');
  await expect(summary).toContainText('3 sor. 4. sor: 5 szem.');
  await page.keyboard.press('ControlOrMeta+z');
  await page.keyboard.press('Escape');

  // Terület: a menüsor gombjával, az 1. sor jelei köré húzott téglalap.
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

  // A sor közepéről másolt 5 szemnek a kész 2. sor végén nincs célpontja: nem kerül be félig sem.
  await page.keyboard.press('ControlOrMeta+d');
  await expect(status).toContainText('Nincs elég célpont');
  await expect(status).toContainText('A minta nem változott.');
  await expect(summary).toContainText('2 sor. 3. sor: 5 szem.');
});
