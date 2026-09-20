/*
 * The right-hand panel and the tooltips of the menu bar (PQW-882): the stitch
 * list is visible on load, the sections can be collapsed, and every icon button
 * has a tooltip that appears at once, the inactive ones too.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

const tipDisplay = (tool: Locator) => tool.evaluate((el) => getComputedStyle(el, '::after').display);
const tipText = (tool: Locator) => tool.evaluate((el) => getComputedStyle(el, '::after').content);

test('on load the stitch list is visible at the top of the panel, the notation closed by default', async ({ page }) => {
  await open(page);

  const stitches = page.locator('#section-stitches');
  const notation = page.locator('#section-notation');
  await expect(stitches).toHaveAttribute('open', '');
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
  expect(stitchesBox!.y).toBeLessThan(notationBox!.y);
});

test('the panel sections can be collapsed and expanded by mouse and by keyboard', async ({ page }) => {
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
  expect(itemCount).toBe(5);
  for (let i = 0; i < itemCount; i += 1) await check(items.nth(i));
});

/*
 * The palette at the owner's window size (PQW-984). The seven basic stitches
 * are a dense grid that is always open; the other eighteen keep the row layout
 * — their structure line is the only thing telling the four „fogyasztás” apart
 * — behind three collapsed groups. Before the split the palette was 1870 px
 * tall and two stitches of the twenty-five were reachable without scrolling.
 */
test('in a narrow window the seven basic stitches and the three group headers are all visible (PQW-984)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page);

  // The whole control, against 1870 px before the split.
  const height = await page.locator('#palette').evaluate((el) => el.getBoundingClientRect().height);
  expect(height, 'the height of the palette').toBeLessThan(300);

  const cells = page.locator('#palette .palette__grid').getByRole('button');
  await expect(cells).toHaveCount(7);
  for (let i = 0; i < 7; i += 1) {
    const cell = cells.nth(i);
    await expect(cell).toBeInViewport({ ratio: 1 });
    // KB: interface.md §36
    const box = (await cell.boundingBox())!;
    expect(Math.round(box.width), `${await cell.getAttribute('data-tip')} width`).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height), `${await cell.getAttribute('data-tip')} height`).toBeGreaterThanOrEqual(44);
  }

  const groups = page.locator('#palette .palette__section--group');
  await expect(groups).toHaveCount(3);
  for (let i = 0; i < 3; i += 1) {
    await expect(groups.nth(i)).not.toHaveAttribute('open', '');
    await expect(groups.nth(i).locator('summary')).toBeInViewport({ ratio: 1 });
  }

  // The cell prints the abbreviation, but the accessible name is still the full name.
  await expect(page.locator('#palette').getByRole('button', { name: /Láncszem \(lsz\)/ })).toHaveCount(1);

  // `#section-stitches` is shared, so the free-form editor gets the same palette.
  await page.getByRole('button', { name: /Szabálytalan horgolás/ }).click();
  await expect(page.locator('#board-irregular')).toBeVisible();
  await expect(cells).toHaveCount(7);
  for (let i = 0; i < 7; i += 1) await expect(cells.nth(i)).toBeInViewport({ ratio: 1 });
  for (let i = 0; i < 3; i += 1) await expect(groups.nth(i).locator('summary')).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#board')).toBeVisible();

  // The other eighteen are one click away, with the structure line that tells them apart.
  await groups.first().locator('summary').click();
  await expect(page.locator('#palette')).toContainText('2 rp egy szembe');
  await expect(page.locator('#palette')).toContainText('3 rp 3 szemen át');

  // A shortcut still reaches a stitch in a closed group, and opens it so the armed button shows.
  await groups.first().locator('summary').click();
  await expect(groups.first()).not.toHaveAttribute('open', '');
  await page.keyboard.press('Alt+Digit8');
  await expect(groups.first()).toHaveAttribute('open', '');
  await expect(
    groups
      .first()
      .getByRole('button', { name: /Szaporítás/ })
      .first(),
  ).toHaveAttribute('aria-pressed', 'true');
});
