/*
 * The three handles of the cleaned-up interface (PQW-911): the file actions
 * dropdown can be walked from the keyboard too, the written pattern panel starts
 * closed and opens with its button, and copy and paste work on the canvas, while
 * in text fields they leave the browser's own editing alone.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

test('the file actions dropdown from the keyboard: Tab to the button, Enter opens, Esc closes and returns the focus', async ({
  page,
}) => {
  await open(page);

  const fileToggle = page.locator('#file-toggle');
  const filePop = page.locator('#file-pop');
  await expect(filePop).toBeHidden();
  await expect(fileToggle).toHaveAttribute('aria-expanded', 'false');

  // One Tab from the „Új minta” button reaches the file actions button: the two are neighbours (PQW-912).
  await page.locator('[data-action="new"]').focus();
  await page.keyboard.press('Tab');
  await expect(fileToggle).toBeFocused();

  // It opens on Enter, and the focus is on the first action.
  await page.keyboard.press('Enter');
  await expect(filePop).toBeVisible();
  await expect(fileToggle).toHaveAttribute('aria-expanded', 'true');
  // „Minta készítése" is the first item since PQW-987.
  await expect(filePop.locator('#setup-toggle')).toBeFocused();

  // Esc closes it, and the focus returns to the button.
  await page.keyboard.press('Escape');
  await expect(filePop).toBeHidden();
  await expect(fileToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(fileToggle).toBeFocused();
});

test('the written pattern panel starts closed, and can be opened with the menu bar button', async ({ page }) => {
  await open(page);

  const written = page.locator('#written');
  const writtenToggle = page.locator('#written-toggle');
  await expect(written).toBeHidden();
  await expect(writtenToggle).toHaveAttribute('aria-expanded', 'false');

  await writtenToggle.click();
  await expect(written).toBeVisible();
  await expect(writtenToggle).toHaveAttribute('aria-expanded', 'true');
  // Open, the panel describes the current pattern: it has something to say even for an empty pattern.
  await expect(written.locator('#written-notices, #written-text')).not.toHaveCount(0);

  await writtenToggle.click();
  await expect(written).toBeHidden();
});

/** The row labels in window coordinates (`window.mintatervezoRacs`, src/ui/main.ts). */
const labels = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { mintatervezoRacs: { labels(): { layer: number; x: number; y: number }[] } }
    ).mintatervezoRacs.labels(),
  );

/** Half double crochet rectangle from the keyboard only (PQW-911): Alt+1 = chain stitch, Alt+4 = half double crochet, Alt+F = turn. */
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
  // The view group is always a menu (interface.md §57).
  await page.locator('#view-toggle').click();
  await page.getByRole('button', { name: 'Egész minta' }).click();
  await page.locator('#board').focus();
}

test('Ctrl+C and Ctrl+V copy and paste on the canvas, but in a text field the browser default stays', async ({
  page,
}) => {
  await open(page);
  await rectangle(page, 5, 2);
  const summary = page.locator('#summary');
  const status = page.locator('#status');
  await expect(summary).toContainText('3. sor: 6 szem');

  // On the canvas: the row selected by its label goes to the clipboard, then back as a new row.
  const label = (await labels(page)).find((candidate) => candidate.layer === 2);
  expect(label, 'the label of row 3').toBeTruthy();
  await page.mouse.click(label!.x, label!.y);
  await expect(status).toHaveText('3. sor kijelölve: 6 szem.');

  await page.keyboard.press('ControlOrMeta+c');
  await expect(status).toContainText('a vágólapon');
  await page.keyboard.press('ControlOrMeta+v');
  await expect(summary).toContainText('3 sor. 4. sor: 6 szem.');
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');

  /*
   * In a text field the editor does not touch the keys: the browser's own copy
   * and paste work. The logger runs AFTER the handler of the editor (both in the
   * bubble phase on `document`), so `defaultPrevented` reveals whether the
   * editor swallowed the key.
   */
  // The logger is installed once; before the measurements we only clear the list.
  await page.evaluate(() => {
    const store = window as unknown as { pqwKeys: boolean[] };
    store.pqwKeys = [];
    document.addEventListener('keydown', (event) => {
      // The modifier itself also fires a key event: only the letters are interesting.
      if (/^[cv]$/i.test(event.key)) store.pqwKeys.push(event.defaultPrevented);
    });
  });

  const log = async (): Promise<boolean[]> => {
    await page.evaluate(() => {
      (window as unknown as { pqwKeys: boolean[] }).pqwKeys = [];
    });
    await page.keyboard.press('ControlOrMeta+c');
    await page.keyboard.press('ControlOrMeta+v');
    return page.evaluate(() => (window as unknown as { pqwKeys: boolean[] }).pqwKeys);
  };

  const title = page.locator('#title');
  await title.fill('Nyári kendő');
  await title.selectText();
  expect(await log(), 'in a text field the browser default stays').toEqual([false, false]);
  await expect(title).toHaveValue('Nyári kendő');
  // Nothing changed in the pattern: the keys of the field never reached the canvas.
  await expect(summary).toContainText('3 sor. 4. sor: 6 szem.');

  // On the canvas the same two keys belong to the editor.
  await page.locator('#board').focus();
  expect(await log(), 'on the canvas the editor handles copy and paste').toEqual([true, true]);
});
