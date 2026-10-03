/*
 * The count of the right-hand panel (PQW-1154): a basic stitch armed in the
 * palette brings a 1–10 count, and one click lays that many in a row. The
 * canvas shows the DOM nothing, so the stitches are read from the chart the
 * page hands a driven browser.
 */

import { expect, type Page, test } from '@playwright/test';

interface Placed {
  readonly id: number;
  readonly stitch: string;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

const board = (page: Page) => page.locator('#board');
const panel = (page: Page) => page.locator('#place-options');
const count = (page: Page) => page.getByRole('textbox', { name: 'Count' });
const slider = (page: Page) => page.getByRole('slider', { name: 'Count' });

async function stitches(page: Page): Promise<Placed[]> {
  return page.evaluate(
    () => (window as unknown as { dcFreeformChart: () => { stitches: Placed[] } }).dcFreeformChart().stitches,
  );
}

async function newChart(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
}

test('a basic stitch brings a count of 1, and a click then lays that many in a row', { tag: '@kiadas' }, async ({
  page,
}) => {
  await newChart(page);
  await expect(panel(page), 'nothing armed, no count').toBeHidden();
  await page.getByRole('button', { name: /^Double crochet \(dc\)/ }).click();
  await expect(panel(page)).toBeVisible();
  await expect(count(page)).toHaveValue('1');
  await expect(slider(page)).toHaveValue('1');

  await board(page).click({ position: { x: 300, y: 200 } });
  expect(await stitches(page), 'one click, one stitch').toHaveLength(1);

  await count(page).fill('4');
  await board(page).click({ position: { x: 300, y: 320 } });
  const row = (await stitches(page)).slice(1);
  expect(row.map(({ stitch }) => stitch)).toEqual(['dc', 'dc', 'dc', 'dc']);
  for (const placed of row) {
    expect(placed.y, 'on one line').toBeCloseTo(row[0]!.y);
    expect(placed.rotation, 'upright').toBe(0);
  }
  const middle = (row[0]!.x + row[3]!.x) / 2;
  expect(middle, 'centred on the click').toBeCloseTo(300, 0);

  await page.getByRole('button', { name: 'Undo' }).click();
  expect(await stitches(page), 'the row undoes as one step').toHaveLength(1);
});

test('the count takes digits only, never more than 10 and never less than 1', async ({ page }) => {
  await newChart(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  const field = count(page);

  await field.fill('');
  await field.pressSequentially('-a7 ');
  await expect(field, 'the sign, the letter and the space are not taken').toHaveValue('7');
  await expect(slider(page)).toHaveValue('7');

  await field.fill('');
  await field.pressSequentially('25');
  await expect(field, 'a number above 10 becomes 10').toHaveValue('10');
  await expect(slider(page)).toHaveValue('10');

  await field.fill('0');
  await field.blur();
  await expect(field, 'a 0 counts as 1').toHaveValue('1');

  await field.fill('3');
  await field.fill('');
  await field.blur();
  await expect(field, 'an emptied field gets its last value back').toHaveValue('3');
});

test('the slider moves the field, and the count is what a click lays', async ({ page }) => {
  await newChart(page);
  await page.getByRole('button', { name: /^Chain \(ch\)/ }).click();
  await slider(page).fill('6');
  await expect(count(page)).toHaveValue('6');
  await board(page).click({ position: { x: 300, y: 200 } });
  expect(await stitches(page)).toHaveLength(6);
});

test('in a phone-sized window the count covers only the top of the board', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await newChart(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await expect(panel(page)).toBeVisible();
  const covered = (await page.locator('#inspector').boundingBox())!;
  const area = (await board(page).boundingBox())!;
  expect(covered.height, 'the panel is as tall as the count, not the column').toBeLessThan(area.height / 3);

  await board(page).click({ position: { x: area.width - 20, y: area.height - 20 } });
  expect(await stitches(page), 'a tap under where a full column would be still lays a stitch').toHaveLength(1);
});

test('a row wider than the board is not laid', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await newChart(page);
  await page.getByRole('button', { name: /^Double treble \(dtr\)/ }).click();
  await count(page).fill('10');
  const area = (await board(page).boundingBox())!;
  test.skip(area.width > 10 * 20, 'the board is wide enough for ten');
  await board(page).click({ position: { x: area.width / 2, y: area.height / 2 } });
  expect(await stitches(page)).toHaveLength(0);
});

test('increases, decreases and compound stitches bring no count, and lay one stitch', async ({ page }) => {
  await newChart(page);
  await page.getByRole('button', { name: /^Single crochet \(sc\)/ }).click();
  await count(page).fill('5');
  for (const section of ['#palette-increase-decrease', '#palette-compound']) {
    await page.locator(`${section} .stitch`).first().click();
    await expect(panel(page), section).toBeHidden();
  }
  await board(page).click({ position: { x: 300, y: 200 } });
  expect(await stitches(page)).toHaveLength(1);

  await page.keyboard.press('Escape');
  await expect(panel(page), 'disarmed, no count').toBeHidden();
});
