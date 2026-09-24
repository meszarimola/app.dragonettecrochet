/*
 * The side columns and the tooltips of the menu bar (PQW-882, PQW-989): the
 * stitch list is visible on load in the left column, the right panel's sections
 * can be collapsed, and every icon button has a tooltip that appears at once,
 * the inactive ones too.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

const tipDisplay = (tool: Locator) => tool.evaluate((el) => getComputedStyle(el, '::after').display);
const tipText = (tool: Locator) => tool.evaluate((el) => getComputedStyle(el, '::after').content);

test('on load the stitch list is visible in the left column, the notation closed by default (PQW-989)', async ({
  page,
}) => {
  await open(page);

  const stitches = page.locator('#section-stitches');
  const notation = page.locator('#section-notation');
  await expect(stitches).toBeVisible();
  await expect(
    page
      .locator('#palette')
      .getByRole('button', { name: /Láncszem/ })
      .first(),
  ).toBeInViewport();
  await expect(notation).not.toHaveAttribute('open', '');
  await expect(page.locator('#terms')).toBeHidden();

  const stitchesBox = await stitches.boundingBox();
  const notationBox = await notation.boundingBox();
  expect(stitchesBox!.x + stitchesBox!.width, 'the stitches stand left of the settings').toBeLessThan(notationBox!.x);
});

test('the panel sections can be collapsed and expanded by mouse and by keyboard', async ({ page }) => {
  await open(page);

  const notationHead = page.locator('#section-notation > summary');
  await notationHead.click();
  await expect(page.locator('#terms')).toBeVisible();
  await notationHead.click();
  await expect(page.locator('#terms')).toBeHidden();

  const patternHead = page.locator('#section-pattern > summary');
  await patternHead.click();
  await expect(page.locator('#title')).toBeHidden();
});

test('every menu bar icon button shows a tooltip under the mouse, the inactive ones too', async ({ page }) => {
  await open(page);

  // The file actions moved into a dropdown (PQW-911): their buttons become visible by opening the menu.
  await page.locator('#file-toggle').click();
  const tools = page.locator('.tools .tool');
  const count = await tools.count();
  expect(count).toBeGreaterThan(10);
  expect(await page.locator('.tools .tool[title]').count()).toBe(0);

  /*
   * A tool group can belong to one pattern type and be hidden in the others
   * (PQW-967), and a button nobody can see cannot show a tooltip. The shown
   * ones are still counted, so this cannot quietly become a test of nothing.
   */
  let shown = 0;
  for (let i = 0; i < count; i += 1) {
    const tool = tools.nth(i);
    const tip = await tool.getAttribute('data-tip');
    expect(tip, `button without a tooltip: ${await tool.getAttribute('data-action')}`).toBeTruthy();
    if (!(await tool.isVisible())) continue;
    shown += 1;
    await tool.hover({ force: true });
    await expect.poll(() => tipDisplay(tool)).toBe('block');
    expect(await tipText(tool)).toBe(JSON.stringify(tip));
  }
  expect(shown, 'a menüsor látható gombjai').toBeGreaterThan(10);

  // Without a mouse no tooltip is visible.
  await page.mouse.move(0, 0);
  await expect.poll(() => tipDisplay(tools.last())).toBe('none');

  // On an empty pattern undo is inactive, yet its tooltip still appears.
  const undo = page.locator('.tools .tool[data-action="undo"]');
  await expect(undo).toBeDisabled();
  await undo.hover({ force: true });
  await expect.poll(() => tipDisplay(undo)).toBe('block');
});

test('the tooltip appears on keyboard focus too', async ({ page }) => {
  await open(page);

  /*
   * The tooltip appears on `:focus-visible`, and that is triggered only by real
   * keyboard navigation — a `focus()` called from code is not. So we step with
   * one Tab from the Home link in the header onto the first button of the menu
   * bar (that is the toggle of the pattern type bar, PQW-912).
   */
  await page.locator('#home-link').focus();
  await page.keyboard.press('Tab');
  const first = page.locator('.tools .tool').first();
  await expect(first).toBeFocused();
  await expect.poll(() => tipDisplay(first)).toBe('block');
});

test('in a narrow window even a visible tooltip does not hang off to the right', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page);

  const check = async (tool: Locator): Promise<void> => {
    await tool.hover({ force: true });
    await expect.poll(() => tipDisplay(tool)).toBe('block');
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(
      width,
      `tooltip hanging off: ${(await tool.getAttribute('data-action')) ?? (await tool.getAttribute('id'))}`,
    ).toBe(1000);
  };

  /*
   * First the buttons of the menu bar, with the dropdown CLOSED: an open menu
   * covers the buttons behind it, so those would not get a real mouse hover, and
   * their tooltip would not appear either (PQW-912).
   */
  const tools = page.locator('.tools__group > .tool, .tools .menu > .tool');
  const count = await tools.count();
  expect(count).toBeGreaterThan(10);
  let shown = 0;
  for (let i = 0; i < count; i += 1) {
    const tool = tools.nth(i);
    // Hidden groups belong to another pattern type; they have no tooltip to place.
    if (!(await tool.isVisible())) continue;
    shown += 1;
    await check(tool);
  }
  expect(shown, 'a menüsor látható gombjai').toBeGreaterThan(10);

  // Then the items of the file actions, with the menu opened (PQW-911).
  await page.locator('#file-toggle').click();
  const items = page.locator('#file-pop .tool');
  const itemCount = await items.count();
  expect(itemCount).toBe(7);
  // The background picture and pattern settings items belong to the free-form type (interface.md §57, §60).
  for (let i = 0; i < itemCount; i += 1) if (await items.nth(i).isVisible()) await check(items.nth(i));
});

/*
 * The palette at the owner's window size (PQW-984, PQW-989). Every stitch is a
 * tile in the left column, nothing folds, and the tile prints the full name —
 * with the structure line that is the only thing telling the four „fogyasztás”
 * apart. Before PQW-984 the palette was 1870 px tall and two stitches of the
 * twenty-five were reachable without scrolling; before PQW-989 eighteen of them
 * sat behind three collapsed groups.
 */
test('in a narrow window the seven basic tiles are visible, and every stitch is a tile with its full name (PQW-989)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page);

  const basic = page.locator('#palette-basic .palette__grid').getByRole('button');
  await expect(basic).toHaveCount(7);
  for (let i = 0; i < 7; i += 1) {
    const cell = basic.nth(i);
    await expect(cell).toBeInViewport({ ratio: 1 });
    // KB: interface.md §36
    const box = (await cell.boundingBox())!;
    expect(Math.round(box.width), `${await cell.getAttribute('data-tip')} width`).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height), `${await cell.getAttribute('data-tip')} height`).toBeGreaterThanOrEqual(44);
  }

  // PQW-1046: the chain space has no tile of its own; the chain arc tool draws it.
  const tiles = page.locator('#palette .palette__grid').getByRole('button');
  await expect(tiles).toHaveCount(24);
  await expect(page.locator('#palette details')).toHaveCount(0);

  // The tile prints the name, not only the abbreviation.
  await expect(page.locator('#palette')).toContainText('Láncszem (lsz)');
  await expect(page.locator('#palette')).toContainText('Háromráhajtásos pálca');
  await expect(page.locator('#palette')).toContainText('2 rp egy szembe');
  await expect(page.locator('#palette')).toContainText('3 rp 3 szemen át');

  // `#section-stitches` is shared, so the free-form editor gets the same palette.
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Szabad tervező/ }).click();
  await expect(page.locator('#board-irregular')).toBeVisible();
  // The free-form type adds the two drawing tools to the same palette (PQW-1046).
  await expect(tiles).toHaveCount(26);
  await expect(page.locator('#palette')).toContainText('Láncív');
  await expect(page.locator('#palette')).toContainText('Legyező');
  for (let i = 0; i < 7; i += 1) await expect(basic.nth(i)).toBeInViewport({ ratio: 1 });
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#board')).toBeVisible();

  // A shortcut arms a stitch below the fold, and scrolls it into the column.
  await page.keyboard.press('Alt+Digit9');
  const ninth = page.locator('#palette .stitch[aria-pressed="true"]');
  await expect(ninth).toHaveCount(1);
  await expect(ninth).toBeInViewport({ ratio: 1 });
});

/*
 * The order inside „Szemek” (PQW-986). „Beszúrás” is 205 px tall and used to stand
 * above the palette: arming a stitch that takes insertion modes pushed the grid from
 * y 169 to y 390 and three of the seven cells left the window. You pick the stitch
 * first and say where it goes second, so the palette leads.
 */
test('arming a stitch with insertion modes does not push the palette out of the window (PQW-986)', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page);

  const cells = page.locator('#palette-basic .palette__grid').getByRole('button');
  await expect(cells).toHaveCount(7);
  const before = (await page.locator('#palette').boundingBox())!.y;

  await page
    .locator('#palette')
    .getByRole('button', { name: /Egyráhajtásos pálca \(erp\)/ })
    .click();
  await expect(page.locator('#insertion')).toBeVisible();

  const after = (await page.locator('#palette').boundingBox())!.y;
  expect(after, 'the palette does not move when the insertion fieldset appears').toBe(before);
  for (let i = 0; i < 7; i += 1) await expect(cells.nth(i)).toBeInViewport({ ratio: 1 });
});

/*
 * „Kijelölt jel igazítása” (PQW-986). It used to stand after every setting, so in a
 * 506 px window it appeared 436 px below the fold: the answer to a click the user had
 * just made, out of sight and with nothing saying so.
 */
test('the adjust box is on screen when a symbol is selected (PQW-986)', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page);

  await openSheet(page);
  const rounds = page.locator('#section-rounds');
  if ((await rounds.getAttribute('open')) === null) await rounds.locator('summary').click();
  await page.locator('#rounds-count').fill('3');
  await page.locator('#rounds-count').press('Tab');
  await rounds.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('3 kör elkészült');
  await page.locator('#setup').getByRole('button', { name: 'Lecsukás' }).click();

  const nodes = await page.evaluate(() =>
    (
      window as unknown as { mintatervezoKijeloles: { nodes: () => { x: number; y: number }[] } }
    ).mintatervezoKijeloles.nodes(),
  );
  const node = nodes.at(-1)!;
  await page.mouse.click(node.x, node.y);

  const adjust = page.locator('#adjust');
  await expect(adjust).toBeVisible();
  await expect(adjust).toBeInViewport({ ratio: 1 });
});

/** The make-a-pattern sheet (PQW-987) is closed on load, and its opener is in the file menu. */
async function openSheet(page: Page): Promise<void> {
  const sheet = page.locator('#setup-toggle');
  if ((await sheet.getAttribute('aria-expanded')) !== 'true') {
    await page.locator('#file-toggle').click();
    await sheet.click();
  }
}
