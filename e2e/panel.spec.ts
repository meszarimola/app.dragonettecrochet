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
  expect(itemCount).toBe(4);
  for (let i = 0; i < itemCount; i += 1) await check(items.nth(i));
});
