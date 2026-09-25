/*
 * The menu bar is one line (PQW-989). It used to be a chrome line and a context
 * line, 107 px in the owner's 1000 × 506 window. Now it gives way a step at a
 * time instead of wrapping: the view group folds into a menu, the labels go,
 * then the title (interface.md §56).
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseIrregular(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Szabad tervező/ }).click();
  await expect(page.locator('#board-irregular')).toBeVisible();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  for (const irregular of [false, true]) {
    test(`${viewport.width}×${viewport.height}, ${irregular ? 'free-form' : 'regular'}: the bar is one line and every tool is on screen`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await open(page);
      if (irregular) await chooseIrregular(page);

      const bar = (await page.locator('.bar').boundingBox())!;
      const undo = (await page.locator('.tools [data-action="undo"]').boundingBox())!;
      expect(bar.height, 'one line: the bar is no taller than a tool and its padding').toBeLessThan(undo.height * 1.5);

      const tools = page.locator('.tools__group > .tool, .tools .menu > .tool');
      let shown = 0;
      for (const tool of await tools.all()) {
        if (!(await tool.isVisible())) continue;
        shown += 1;
        await expect(tool).toBeInViewport({ ratio: 1 });
      }
      expect(shown, 'the visible buttons of the bar').toBeGreaterThan(10);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);

      // PQW-1048: what closes the line depends on the type and on whether the
      // pickers fit, so the test asks for the rightmost of them rather than naming one.
      const edge = await page
        .locator('.tools__group--end')
        .evaluate((group) =>
          Math.max(
            ...[...group.querySelectorAll('button, select')]
              .filter((el) => (el as HTMLElement).offsetParent !== null)
              .map((el) => el.getBoundingClientRect().right),
          ),
        );
      expect(edge, 'the last control sits at the right edge').toBeGreaterThan(viewport.width - 80);
    });
  }
}

test('even in a wide window zoom and guides are two menus, and the bar keeps its labels', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await open(page);
  await chooseIrregular(page);

  // KB: interface.md §63 — „Méretezés” holds the zoom, „Segédrács” the guides.
  await expect(page.locator('#view-toggle')).toBeVisible();
  await expect(page.locator('.tools [data-action="zoom-in"]')).toBeHidden();
  await expect(page.locator('#view-toggle .tool__label')).toBeVisible();
  await page.locator('#zoom-toggle').click();
  await expect(page.locator('.tools [data-action="zoom-in"] .tool__label')).toBeVisible();
});

test('in the owner’s window the zoom menu stays open while zooming', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page);
  await chooseIrregular(page);

  const toggle = page.locator('#zoom-toggle');
  const zoomIn = page.locator('.tools [data-action="zoom-in"]');
  await expect(toggle).toBeVisible();
  await expect(zoomIn).toBeHidden();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(zoomIn).toBeVisible();
  await zoomIn.click();
  await zoomIn.click();
  await expect(zoomIn, 'the menu stays open for the next step').toBeVisible();

  await page.keyboard.press('Escape');
  await expect(zoomIn).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();

  // A click elsewhere closes it too.
  await toggle.click();
  await page.locator('#section-stitches').click({ position: { x: 5, y: 5 } });
  await expect(zoomIn).toBeHidden();
});

test('the panel toggle opens and closes both side columns', async ({ page }) => {
  await open(page);
  const toggle = page.locator('#panel-toggle');
  await expect(page.locator('#section-stitches')).toBeVisible();
  await expect(page.locator('#panel')).toBeVisible();

  await toggle.click();
  await expect(page.locator('#section-stitches')).toBeHidden();
  await expect(page.locator('#panel')).toBeHidden();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');

  await toggle.click();
  await expect(page.locator('#section-stitches')).toBeVisible();
  await expect(page.locator('#panel')).toBeVisible();
});

test('a type chosen from the keyboard gives the focus back to the menu button', async ({ page }) => {
  await open(page);
  await page.locator('#types-toggle').click();
  await expect(page.locator('.type[data-type="regular"]')).toBeFocused();
  await page.locator('.type[data-type="irregular"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#board-irregular')).toBeVisible();
  await expect(page.locator('#types-toggle')).toBeFocused();
});

test('where the labels give way, a findings count still shows; „no findings” does not', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page);
  await expect(page.locator('.bar')).toHaveAttribute('data-fit', '2');
  const count = page.locator('#error-count');
  await expect(count).toBeHidden();
  // The class is what the findings list sets; a real warning needs a pattern this test is not about.
  await page.locator('#error-toggle').evaluate((el) => el.classList.add('has-warnings'));
  await expect(count).toBeVisible();
});

test('in a phone-sized window the two columns open side by side, not over each other', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await open(page);
  await page.locator('#panel-toggle').click();
  const stitches = (await page.locator('#section-stitches').boundingBox())!;
  const panel = (await page.locator('#panel').boundingBox())!;
  expect(stitches.x + stitches.width, 'the panel starts where the stitches end').toBeLessThanOrEqual(panel.x + 1);
  for (const tile of await page.locator('#palette-basic .stitch').all()) {
    expect((await tile.boundingBox())!.width, 'a tile stays a 44 px target').toBeGreaterThanOrEqual(44);
  }
});
