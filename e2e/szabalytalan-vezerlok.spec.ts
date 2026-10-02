/*
 * The three controls that reached the hidden regular document without passing a
 * generator section, so PQW-976 hiding the sections did not protect them
 * (PQW-980): the "Preset" select of the shared `#section-notation`, which
 * ran `setTradition`; the "Nudge the selected symbol" box, which only
 * `updateControls()` ever hid and `refresh()` does not reach in this type, so it
 * came through with its arrows and "Back to the computed place" live; and the `#chain-count`
 * field of the shared `#section-stitches`, whose Enter is answered above
 * `irregularKey`.
 *
 * What each test watches is the autosave slot: `commit()` persists in the same
 * breath, so a byte-identical slot is the proof that the hidden document was
 * never touched.
 */

import { expect, type Page, test } from '@playwright/test';

import { asReturningVisitor } from './kezdet.ts';

const STORAGE_KEY = 'dc-mintatervezo:minta';

async function open(page: Page): Promise<void> {
  await asReturningVisitor(page);
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseIrregular(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Free-form designer/ }).click();
  await expect(page.locator('#board-irregular')).toBeVisible();
}

async function chooseRegular(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Regular crochet/ }).click();
  await expect(page.locator('#board')).toBeVisible();
}

async function openSection(page: Page, selector: string): Promise<void> {
  const inSheet = await page.locator(selector).evaluate((el) => el.closest('#setup') !== null);
  if (inSheet) {
    // KB: interface.md §79 — the sheet opens from the „New” menu, on one family.
    if (await page.locator('#setup').isHidden()) {
      await page.locator('#types-toggle').click();
      await page.locator('.type[data-type="regular"]').click();
      const family = selector === '#section-shawl' ? /Shawl/ : /Flat shape/;
      await page.getByRole('menuitem', { name: family }).click();
    }
  }
  // In free-form mode the notation waits in the pattern settings dialog (interface.md §60).
  const inDialog = await page.locator(selector).evaluate((el) => el.closest('#settings-dialog') !== null);
  if (inDialog) {
    await page.locator('#file-toggle').click();
    await page.locator('#settings-open').click();
  }
  const section = page.locator(selector);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
}

const saved = (page: Page): Promise<string | null> => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

/** Clicks a button a pointer can no longer reach, because the box around it is hidden. */
const press = (page: Page, selector: string): Promise<void> =>
  page.evaluate((one) => (document.querySelector(one) as HTMLButtonElement).click(), selector);

/** A flat circle of four rounds, so the regular document has something to lose. */
async function circle(page: Page): Promise<void> {
  await openSection(page, '#section-rounds');
  await page.locator('#rounds-count').fill('4');
  await page.locator('#rounds-count').press('Tab');
  await page.locator('#section-rounds').getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Flat circle: 4 rounds done;');
  // The sheet stays open after generating (PQW-987) and stands over the panel, so the
  // tests that go on to use the panel close it.
  await page.locator('#setup').getByRole('button', { name: 'Collapse' }).click();
}

/** Selects the last symbol, which is what reveals the adjust box. */
async function selectLastSymbol(page: Page): Promise<void> {
  const nodes = await page.evaluate(() =>
    (
      window as unknown as { mintatervezoKijeloles: { nodes: () => { x: number; y: number }[] } }
    ).mintatervezoKijeloles.nodes(),
  );
  const node = nodes.at(-1);
  expect(node, 'a symbol on the board').toBeTruthy();
  await page.mouse.click(node!.x, node!.y);
  await expect(page.locator('#adjust')).toBeVisible();
}

/*
 * The preset chooser was removed in PQW-1048, so a preset can no longer be changed
 * from the free-form type — or from anywhere. The rule it drove is still covered by
 * the core tests of `tradition.ts`.
 */

test('the adjust box leaves with the regular editor, and its buttons stop writing', async ({ page }) => {
  await open(page);
  await circle(page);
  await selectLastSymbol(page);
  // Nudged once here, so "Back to the computed place" has a pin to clear in free-form mode.
  await page.locator('#adjust').getByRole('button', { name: 'Up' }).click();
  await expect(page.locator('#adjust-name')).toContainText('moved by hand');
  const before = await saved(page);

  await chooseIrregular(page);
  await expect(page.locator('#adjust')).toBeHidden();
  // Hiding puts the buttons out of a pointer's reach; the handlers behind them
  // are the other half, so each is clicked on the element itself. Each is
  // located first and written out rather than looped, so a renamed attribute
  // fails here instead of passing because nothing was clicked, and both
  // selectors stand as literals in the PQW-978 inventory.
  await expect(page.locator('#adjust [data-nudge="0,-2"]')).toHaveCount(1);
  await press(page, '#adjust [data-nudge="0,-2"]');
  expect(await saved(page)).toBe(before);
  await expect(page.locator('#adjust [data-action="unpin"]')).toHaveCount(1);
  await press(page, '#adjust [data-action="unpin"]');
  expect(await saved(page)).toBe(before);

  // Back in the regular type the box is there again. Picking a type starts it anew
  // since PQW-1045, so the nudged circle comes back with one undo.
  await chooseRegular(page);
  await page.locator('#board').focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await selectLastSymbol(page);
  await expect(page.locator('#adjust')).toBeVisible();
  await expect(page.locator('#adjust-name')).toContainText('moved by hand');
});

test('the shared palette does not crochet into the hidden pattern from the chain count', async ({ page }) => {
  await open(page);
  await circle(page);
  const before = await saved(page);

  await chooseIrregular(page);
  // The palette and the count field are shared across the types — the palette in
  // `#section-stitches`, the count field at the head of `#panel` since PQW-1135 —
  // and Enter in the count field is handled before `irregularKey` gets to swallow
  // it: the one keystroke the free-form editor never saw.
  await page
    .locator('#palette')
    .getByRole('button', { name: /Chain \(ch\)/ })
    .first()
    .click();
  await expect(page.locator('#count-field')).toBeVisible();
  await page.locator('#chain-count').fill('5');
  await page.locator('#chain-count').press('Enter');
  // Its own store is the proof: switching back would start the regular type anew
  // since PQW-1045, so it could say nothing about what the keystroke did.
  expect(await saved(page)).toBe(before);
});
