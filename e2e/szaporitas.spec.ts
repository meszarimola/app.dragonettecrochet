/*
 * Increases and decreases from a menu (PQW-1155): each is a tile with a menu of
 * its part under it, and the right panel sets how many parts, 2–5. A click
 * lays one increase or decrease. The canvas shows the DOM nothing, so the
 * stitches are read from the chart the page hands a driven browser.
 */

import { expect, type Page, test } from '@playwright/test';

interface Placed {
  readonly stitch: string;
}

const board = (page: Page) => page.locator('#board');
const decrease = (page: Page) => page.getByRole('button', { name: /^Decrease \(dec\)/ });
const increase = (page: Page) => page.getByRole('button', { name: /^Increase \(inc\)/ });
const decreaseMenu = (page: Page) => page.getByRole('combobox', { name: 'Decrease stitch' });
const increaseMenu = (page: Page) => page.getByRole('combobox', { name: 'Increase stitch' });
const parts = (page: Page) => page.getByRole('textbox', { name: 'Number of stitches' });
const partsSlider = (page: Page) => page.getByRole('slider', { name: 'Number of stitches' });

async function laid(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    (window as unknown as { dcFreeformChart: () => { stitches: Placed[] } })
      .dcFreeformChart()
      .stitches.map(({ stitch }) => stitch),
  );
}

async function newChart(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
}

test('a decrease of the chosen stitch and count is laid with one click', { tag: '@kiadas' }, async ({ page }) => {
  await newChart(page);
  await expect(decreaseMenu(page), 'sc is the default').toHaveValue('sc');
  await expect(increaseMenu(page)).toHaveValue('sc');

  await decrease(page).click();
  await expect(parts(page)).toBeVisible();
  await expect(parts(page)).toHaveValue('2');
  await expect(page.getByRole('textbox', { name: 'Count' }), 'no basic count beside it').toBeHidden();
  await board(page).click({ position: { x: 200, y: 200 } });

  await decreaseMenu(page).selectOption('dc');
  await expect(decrease(page), 'the menu arms its tile').toHaveAttribute('aria-pressed', 'true');
  await parts(page).fill('3');
  await expect(decrease(page)).toContainText('dc3tog');
  await board(page).click({ position: { x: 320, y: 200 } });

  expect(await laid(page)).toEqual(['sc2tog', 'dc3tog']);
});

test('an increase follows its own menu, and the count is 2–5 whatever is typed', async ({ page }) => {
  await newChart(page);
  await increaseMenu(page).selectOption('dtr');
  await expect(increase(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(decrease(page)).toHaveAttribute('aria-pressed', 'false');

  await parts(page).fill('');
  await parts(page).pressSequentially('9');
  await expect(parts(page), 'above 5 becomes 5').toHaveValue('5');
  await expect(partsSlider(page)).toHaveValue('5');
  await parts(page).fill('1');
  await expect(parts(page), 'below 2 becomes 2').toHaveValue('2');
  await partsSlider(page).fill('4');
  await expect(parts(page)).toHaveValue('4');

  await board(page).click({ position: { x: 300, y: 250 } });
  expect(await laid(page)).toEqual(['inc-4dtr']);
});

test('Alt+8 arms the decrease and Alt+9 the increase; a basic stitch brings its own count back', async ({ page }) => {
  await newChart(page);
  await page.keyboard.press('Alt+Digit8');
  await expect(decrease(page)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Alt+Digit9');
  await expect(increase(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(parts(page)).toBeVisible();

  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await expect(parts(page)).toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Count' })).toBeVisible();

  await page.getByRole('button', { name: /^Invisible decrease/ }).click();
  await expect(page.locator('#place-options'), 'the invisible decrease has no settings').toBeHidden();
});

test('before New the menus are switched off, like the tiles', async ({ page }) => {
  await page.goto('/');
  await expect(decreaseMenu(page)).toBeDisabled();
  await expect(increaseMenu(page)).toBeDisabled();
});

test('each menu stands under its tile, as wide as it, and shows whole names', async ({ page }) => {
  await newChart(page);
  for (const [tile, menu] of [
    [decrease(page), decreaseMenu(page)],
    [increase(page), increaseMenu(page)],
  ] as const) {
    const above = (await tile.boundingBox())!;
    const below = (await menu.boundingBox())!;
    expect(below.y, 'the menu starts where the tile ends').toBeCloseTo(above.y + above.height, 0);
    expect(below.x).toBeCloseTo(above.x, 0);
    expect(below.width, 'as wide as the tile').toBeCloseTo(above.width, 0);
  }
  await expect(decreaseMenu(page).locator('option')).toHaveText([
    'Single crochet',
    'Half double crochet',
    'Double crochet',
    'Treble',
    'Double treble',
  ]);
});
