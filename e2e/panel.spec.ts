/*
 * A jobb oldali panel és a menüsor tooltipjei (PQW-882): a szemlista
 * betöltéskor látszik, a szakaszok összecsukhatók, és minden ikongombnak
 * azonnal megjelenő tooltipje van, az inaktívaknak is.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

const tipDisplay = (tool: Locator) => tool.evaluate((el) => getComputedStyle(el, '::after').display);
const tipText = (tool: Locator) => tool.evaluate((el) => getComputedStyle(el, '::after').content);

test('betöltéskor a szemlista a panel tetején látszik, a jelölés alapból csukva', async ({ page }) => {
  await open(page);

  const stitches = page.locator('#section-stitches');
  const notation = page.locator('#section-notation');
  await expect(stitches).toHaveAttribute('open', '');
  await expect(page.locator('#palette').getByRole('button', { name: /Láncszem/ }).first()).toBeInViewport();
  await expect(notation).not.toHaveAttribute('open', '');
  await expect(page.locator('#terms')).toBeHidden();

  const stitchesBox = await stitches.boundingBox();
  const notationBox = await notation.boundingBox();
  expect(stitchesBox!.y).toBeLessThan(notationBox!.y);
});

test('a panel szakaszai egérrel és billentyűzettel le- és felcsukhatók', async ({ page }) => {
  await open(page);

  const notationHead = page.locator('#section-notation > summary');
  await notationHead.click();
  await expect(page.locator('#terms')).toBeVisible();
  await notationHead.click();
  await expect(page.locator('#terms')).toBeHidden();

  const stitchesHead = page.locator('#section-stitches > summary');
  await stitchesHead.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#palette')).toBeHidden();
  await page.keyboard.press('Enter');
  await expect(page.locator('#palette')).toBeVisible();

  const patternHead = page.locator('#section-pattern > summary');
  await patternHead.click();
  await expect(page.locator('#title')).toBeHidden();
});

test('minden menüsor-ikongomb egér alatt tooltipet mutat, az inaktív is', async ({ page }) => {
  await open(page);

  // A fájlműveletek lenyílóba kerültek (PQW-911): a gombjaik a menü kinyitásával látszanak.
  await page.locator('#file-toggle').click();
  const tools = page.locator('.tools .tool');
  const count = await tools.count();
  expect(count).toBeGreaterThan(10);
  expect(await page.locator('.tools .tool[title]').count()).toBe(0);

  for (let i = 0; i < count; i += 1) {
    const tool = tools.nth(i);
    const tip = await tool.getAttribute('data-tip');
    expect(tip, `tooltip nélküli gomb: ${await tool.getAttribute('data-action')}`).toBeTruthy();
    await tool.hover({ force: true });
    await expect.poll(() => tipDisplay(tool)).toBe('block');
    expect(await tipText(tool)).toBe(JSON.stringify(tip));
  }

  // Egér nélkül egyik tooltip sem látszik.
  await page.mouse.move(0, 0);
  await expect.poll(() => tipDisplay(tools.last())).toBe('none');

  // Az üres mintán a visszavonás inaktív, a tooltipje mégis megjelenik.
  const undo = page.locator('.tools .tool[data-action="undo"]');
  await expect(undo).toBeDisabled();
  await undo.hover({ force: true });
  await expect.poll(() => tipDisplay(undo)).toBe('block');
});

test('billentyűzetes fókuszra is megjelenik a tooltip', async ({ page }) => {
  await open(page);

  /*
   * A tooltip `:focus-visible`-re jelenik meg, azt pedig csak a valódi
   * billentyűzetes navigáció váltja ki — a programból hívott `focus()` nem.
   * Ezért a fejléc Főoldal linkjéről lépünk egy Tabbal a menüsor első gombjára
   * (az a mintatípus-sáv kapcsolója, PQW-912).
   */
  await page.locator('#home-link').focus();
  await page.keyboard.press('Tab');
  const first = page.locator('.tools .tool').first();
  await expect(first).toBeFocused();
  await expect.poll(() => tipDisplay(first)).toBe('block');
});

test('keskeny ablakban a látható tooltip sem lóg ki jobbra', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page);

  const check = async (tool: Locator): Promise<void> => {
    await tool.hover({ force: true });
    await expect.poll(() => tipDisplay(tool)).toBe('block');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width, `kilógó tooltip: ${(await tool.getAttribute('data-action')) ?? (await tool.getAttribute('id'))}`).toBe(1000);
  };

  /*
   * Előbb a menüsor gombjai, CSUKOTT lenyílóval: a nyitott menü rátakar a
   * mögötte lévő gombokra, így azok nem kapnának valódi egérrámutatást, és a
   * tooltipjük sem jelenne meg (PQW-912).
   */
  const tools = page.locator('.tools__group > .tool, .tools .menu > .tool');
  const count = await tools.count();
  expect(count).toBeGreaterThan(10);
  for (let i = 0; i < count; i += 1) await check(tools.nth(i));

  // Azután a fájlműveletek menüpontjai, kinyitott menüvel (PQW-911).
  await page.locator('#file-toggle').click();
  const items = page.locator('#file-pop .tool');
  const itemCount = await items.count();
  expect(itemCount).toBe(4);
  for (let i = 0; i < itemCount; i += 1) await check(items.nth(i));
});
