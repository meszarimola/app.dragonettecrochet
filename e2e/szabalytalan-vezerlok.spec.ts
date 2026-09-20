/*
 * The three controls that reached the hidden regular document without passing a
 * generator section, so PQW-976 hiding the sections did not protect them
 * (PQW-980): the „Előbeállítás” select of the shared `#section-notation`, which
 * ran `setTradition`; the „Kijelölt jel igazítása” box, which only
 * `updateControls()` ever hid and `refresh()` does not reach in this type, so it
 * came through with its arrows and „Számolt helyre” live; and the `#chain-count`
 * field of the shared `#section-stitches`, whose Enter is answered above
 * `irregularKey`.
 *
 * What each test watches is the autosave slot: `commit()` persists in the same
 * breath, so a byte-identical slot is the proof that the hidden document was
 * never touched.
 */

import { expect, type Page, test } from '@playwright/test';

const STORAGE_KEY = 'dc-mintatervezo:minta';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseIrregular(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Szabálytalan horgolás/ }).click();
  await expect(page.locator('#board-irregular')).toBeVisible();
}

async function chooseRegular(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#board')).toBeVisible();
}

async function openSection(page: Page, selector: string): Promise<void> {
  const inSheet = await page.locator(selector).evaluate((el) => el.closest('#setup') !== null);
  if (inSheet) {
  const sheet = page.locator('#setup-toggle');
  if ((await sheet.getAttribute('aria-expanded')) !== 'true') {
    // The opener lives in the file menu (PQW-987), which has to be open to click it.
    await page.locator('#file-toggle').click();
    await sheet.click();
  }
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
  await page.locator('#section-rounds').getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Lapos kör, 4 kör elkészült;');
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

test('the notation preset leaves the regular pattern alone in free-form mode', async ({ page }) => {
  await open(page);
  await circle(page);
  await expect(page.locator('#tradition')).toHaveValue('cyc');
  const before = await saved(page);

  await chooseIrregular(page);
  // `#section-notation` is shared between the two editors, so it is correctly
  // still here; its „Jelkészlet” and „Jelstílus” selects go on working. The
  // preset does not, because it is the regular pattern's own conventions.
  await openSection(page, '#section-notation');
  await page.locator('#tradition').selectOption('japanese');
  expect(await saved(page)).toBe(before);

  await chooseRegular(page);
  await expect(page.locator('#tradition')).toHaveValue('cyc');
});

test('the adjust box leaves with the regular editor, and its buttons stop writing', async ({ page }) => {
  await open(page);
  await circle(page);
  await selectLastSymbol(page);
  // Nudged once here, so „Számolt helyre” has a pin to clear in free-form mode.
  await page.locator('#adjust').getByRole('button', { name: 'Fel' }).click();
  await expect(page.locator('#adjust-name')).toContainText('kézzel igazítva');
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

  await chooseRegular(page);
  await expect(page.locator('#adjust')).toBeVisible();
  await expect(page.locator('#adjust-name')).toContainText('kézzel igazítva');
});

test('the shared palette does not crochet into the hidden pattern from the chain count', async ({ page }) => {
  await open(page);
  await circle(page);
  const before = await saved(page);

  await chooseIrregular(page);
  // `#section-stitches` is shared, so the palette and the count field are still
  // here, and Enter in the count field is handled before `irregularKey` gets to
  // swallow it — the one keystroke the free-form editor never saw.
  await page
    .locator('#palette')
    .getByRole('button', { name: /Láncszem \(lsz\)/ })
    .first()
    .click();
  await expect(page.locator('#count-field')).toBeVisible();
  await page.locator('#chain-count').fill('5');
  await page.locator('#chain-count').press('Enter');
  expect(await saved(page)).toBe(before);

  await chooseRegular(page);
  expect(await saved(page)).toBe(before);
});
