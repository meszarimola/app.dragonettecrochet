/*
 * The two controls PQW-976 left outside its scope (PQW-980). Neither goes
 * through a generator section, so hiding the sections did not protect them:
 * the „Előbeállítás” select of the shared `#section-notation` ran
 * `setTradition` on the hidden regular document, and the „Kijelölt jel
 * igazítása” box stayed standing in free-form mode because only
 * `updateControls()` ever hid it — and `refresh()` does not reach that in this
 * type. Its arrows and „Számolt helyre” then wrote into the pattern nobody
 * could see.
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
  const section = page.locator(selector);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
}

const saved = (page: Page): Promise<string | null> => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);

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
  // still here. Only the counting half of the preset belongs to the regular
  // document, and that half must not run.
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
  // are the other half, so each is clicked on the element itself. Both are
  // located first, so a renamed attribute fails here instead of passing
  // because nothing was clicked.
  for (const selector of ['#adjust [data-nudge="0,-2"]', '#adjust [data-action="unpin"]']) {
    await expect(page.locator(selector)).toHaveCount(1);
    await page.evaluate((one) => (document.querySelector(one) as HTMLButtonElement).click(), selector);
    expect(await saved(page)).toBe(before);
  }

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
