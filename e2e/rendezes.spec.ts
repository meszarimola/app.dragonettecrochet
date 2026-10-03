/*
 * The right-hand panel (PQW-1146, PQW-1147): empty without a selection, and with
 * one it arranges the stitches in a row or around one point; the chosen
 * arrangement's settings appear under the buttons and re-arrange on the spot.
 * The canvas shows the DOM nothing, so the stitches are read from the chart the
 * page hands a driven browser.
 */

import { expect, type Locator, type Page, test } from '@playwright/test';

interface Placed {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly rotation: number;
}

const board = (page: Page) => page.locator('#board');

async function stitches(page: Page): Promise<Placed[]> {
  return page.evaluate(
    () => (window as unknown as { dcFreeformChart: () => { stitches: Placed[] } }).dcFreeformChart().stitches,
  );
}

/** A new chart with a double crochet at each point, all of them selected by an area drag. */
async function selectedChartWith(page: Page, points: readonly [number, number][]): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: /^Double crochet \(dc\)/ }).click();
  for (const [x, y] of points) await board(page).click({ position: { x, y } });
  await page.getByRole('button', { name: 'Select' }).click();
  const box = (await board(page).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 250, { steps: 4 });
  await page.mouse.move(box.x + 480, box.y + 360, { steps: 4 });
  await page.mouse.up();
  await expect(board(page)).toHaveAttribute('data-selected', String(points.length));
}

const POINTS: readonly [number, number][] = [
  [120, 200],
  [260, 120],
  [400, 260],
  [330, 300],
];

const rowGaps = async (page: Page): Promise<number[]> => {
  const placed = (await stitches(page)).sort((a, b) => a.x - b.x);
  return placed.slice(1).map((stitch, i) => stitch.x - placed[i]!.x);
};

const spread = async (page: Page): Promise<number> => {
  const turns = (await stitches(page)).map(({ rotation }) => rotation).sort((a, b) => a - b);
  return turns.at(-1)! - turns[0]!;
};

test('the panel is empty until something is selected, then arranges it in a row', { tag: '@kiadas' }, async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByRole('complementary', { name: 'Properties' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'In a row' }), 'nothing selected, nothing offered').toBeHidden();

  await selectedChartWith(page, POINTS);
  await expect(page.getByRole('textbox', { name: 'Spacing' }), 'no settings before a choice').toBeHidden();
  await page.getByRole('button', { name: 'In a row' }).click();
  await expect(page.getByRole('button', { name: 'In a row' })).toHaveAttribute('aria-pressed', 'true');
  const placed = (await stitches(page)).sort((a, b) => a.x - b.x);
  for (const stitch of placed) {
    expect(stitch.rotation, 'upright').toBe(0);
    expect(stitch.y, 'on one line').toBeCloseTo(placed[0]!.y, 6);
  }
  const gaps = await rowGaps(page);
  for (const gap of gaps) expect(gap, 'evenly spaced').toBeCloseTo(gaps[0]!, 6);

  await board(page).click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole('button', { name: 'In a row' }), 'deselected, the panel empties').toBeHidden();
});

test('the spacing slider of a row moves its field and the stitches; the field goes past the slider, which stays at its end', async ({
  page,
}) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'In a row' }).click();
  const slider = page.getByRole('slider', { name: 'Spacing' });
  const field = page.getByRole('textbox', { name: 'Spacing' });
  await expect(field).toHaveValue('4');
  const before = (await rowGaps(page))[0]!;

  await slider.fill('9');
  await expect(field).toHaveValue('9');
  expect((await rowGaps(page))[0]! - before, 'five more between each').toBeCloseTo(5, 6);

  await field.fill('25');
  await expect(slider, 'at its end').toHaveValue('10');
  expect((await rowGaps(page))[0]! - before, 'the typed 25, not the 10 of the slider').toBeCloseTo(21, 6);
});

test('around leans the stitches from one point; its radius slider and the dial re-arrange them', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'Around' }).click();
  await expect(page.getByRole('textbox', { name: 'Spacing' }), 'only the chosen settings').toBeHidden();
  await expect(page.getByRole('textbox', { name: 'Radius' })).toHaveValue('24');
  expect(await spread(page), 'the default 90°').toBeCloseTo(Math.PI / 2, 6);

  const angle = page.getByRole('textbox', { name: 'Angle (°)' });
  await angle.fill('120');
  expect(await spread(page), 'opened to 120°').toBeCloseTo((Math.PI * 2) / 3, 6);

  const handle = page.getByRole('slider', { name: 'Angle (°)' });
  await handle.focus();
  await handle.press('ArrowRight');
  await expect(angle).toHaveValue('121');
  await expect(handle).toHaveAttribute('aria-valuenow', '121');

  const dial = (await page.locator('#arrange-dial').boundingBox())!;
  await page.mouse.click(dial.x + dial.width / 2, dial.y + dial.height - 4);
  await expect(angle, 'a press at the bottom of the ring').toHaveValue('180');
  expect(await spread(page)).toBeCloseTo(Math.PI, 6);

  await page.mouse.click(dial.x + 4, dial.y + dial.height / 2);
  await expect(angle, 'a press on the left of the ring').toHaveValue('270');

  await handle.press('End');
  await handle.press('ArrowRight');
  await expect(angle, 'turning past 359 comes round to 0').toHaveValue('0');

  const radius = page.getByRole('textbox', { name: 'Radius' });
  await page.getByRole('slider', { name: 'Radius' }).fill('60');
  await expect(radius).toHaveValue('60');
});

test('the fields take digits only, and the angle no more than 359', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'Around' }).click();
  const angle = page.getByRole('textbox', { name: 'Angle (°)' });
  await angle.fill('');
  await angle.pressSequentially('-4x5 ');
  await expect(angle, 'the sign, the letter and the space are not taken').toHaveValue('45');
  await angle.fill('');
  await angle.pressSequentially('720');
  await expect(angle).toHaveValue('359');

  const radius = page.getByRole('textbox', { name: 'Radius' });
  await radius.fill('');
  await radius.pressSequentially('3.5e');
  await expect(radius).toHaveValue('35');
  await radius.fill('');
  await radius.blur();
  await expect(radius, 'an emptied field gets its last value back').toHaveValue('35');
});

test('Backspace and Delete typed in a value edit the value, not the chart', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'Around' }).click();
  const radius = page.getByRole('textbox', { name: 'Radius' });
  await radius.click();
  await radius.press('End');
  await radius.press('Backspace');
  await radius.press('Delete');
  await radius.press('Escape');
  const handle = page.getByRole('slider', { name: 'Angle (°)' });
  await handle.focus();
  await handle.press('Backspace');
  await handle.press('Delete');
  await expect(board(page), 'no stitch deleted').toHaveAttribute('data-stitches', String(POINTS.length));
  await expect(board(page), 'still selected').toHaveAttribute('data-selected', String(POINTS.length));
  await expect(radius).toHaveValue('2');
});

test('the settings go with the selection they were made for', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'Around' }).click();
  await page.getByRole('button', { name: 'New' }).click();
  await page.getByRole('button', { name: /^Double crochet \(dc\)/ }).click();
  for (const [x, y] of POINTS) await board(page).click({ position: { x, y } });
  await page.getByRole('button', { name: 'Select' }).click();
  await board(page).click({ position: { x: POINTS[0]![0], y: POINTS[0]![1] } });
  await expect(board(page)).toHaveAttribute('data-selected', '1');
  await expect(page.getByRole('textbox', { name: 'Radius' }), 'a new selection starts without settings').toBeHidden();
  await expect(page.getByRole('button', { name: 'Around' })).toHaveAttribute('aria-pressed', 'false');
});

test('an arrangement larger than the sheet is not taken', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'Around' }).click();
  const before = await stitches(page);
  // PQW-1160: the sheet is three screens wide, so the largest radius the field takes.
  await page.getByRole('textbox', { name: 'Radius' }).fill('9999');
  expect(await stitches(page), 'nothing moved').toEqual(before);
});

test('a typed 0 counts as the smallest value the slider allows', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'Around' }).click();
  const radius = page.getByRole('textbox', { name: 'Radius' });
  await radius.fill('1');
  const atOne = await stitches(page);
  await radius.fill('5');
  await radius.fill('0');
  expect(await stitches(page), 'the feet stay apart, as at 1').toEqual(atOne);
});

test('arranged stitches moved by hand keep their order and place when a setting changes', async ({ page }) => {
  await selectedChartWith(page, [...POINTS, [200, 330], [440, 160]]);
  await page.getByRole('button', { name: 'Around' }).click();
  await page.getByRole('textbox', { name: 'Angle (°)' }).fill('300');
  const box = (await board(page).boundingBox())!;
  const [first] = await stitches(page);
  await page.mouse.move(box.x + first!.x, box.y + first!.y);
  await page.mouse.down();
  await page.mouse.move(box.x + first!.x + 30, box.y + first!.y + 20, { steps: 5 });
  await page.mouse.up();
  const moved = await stitches(page);
  expect(moved[0]!.x - first!.x, 'the drag moved them').toBeCloseTo(30, 6);

  const radius = page.getByRole('textbox', { name: 'Radius' });
  await expect(radius, 'the settings stay after a move').toBeVisible();
  await radius.fill('40');
  await radius.fill('24');
  const back = await stitches(page);
  back.forEach((stitch, i) => {
    expect(stitch.x, `stitch ${stitch.id} where the move left it`).toBeCloseTo(moved[i]!.x, 6);
    expect(stitch.y, `stitch ${stitch.id} where the move left it`).toBeCloseTo(moved[i]!.y, 6);
    expect(stitch.rotation, `stitch ${stitch.id} keeps its turn`).toBeCloseTo(moved[i]!.rotation, 6);
  });
});

test('after a click on an arrange button the chart shortcuts still work', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'In a row' }).click();
  await page.keyboard.press('Delete');
  await expect(board(page)).toHaveAttribute('data-stitches', '0');
});

test('Feet and Tops turn the stitches round, and a press on the side already chosen changes nothing', async ({
  page,
}) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'Around' }).click();
  const group = page.getByRole('group', { name: 'Facing the point' });
  const feetButton = group.getByRole('button', { name: 'Feet' });
  const topsButton = group.getByRole('button', { name: 'Tops' });
  await expect(feetButton, 'the feet face the point by default').toHaveAttribute('aria-pressed', 'true');
  await expect(topsButton).toHaveAttribute('aria-pressed', 'false');
  const feet = await stitches(page);
  const leftmost = (placed: Placed[]) => placed.reduce((a, b) => (a.x < b.x ? a : b));
  expect(leftmost(feet).rotation, 'feet in: the left one leans left').toBeLessThan(0);

  await feetButton.click();
  expect(await stitches(page), 'Feet again: nothing turns').toEqual(feet);
  await expect(feetButton).toHaveAttribute('aria-pressed', 'true');

  await topsButton.click();
  await expect(topsButton).toHaveAttribute('aria-pressed', 'true');
  await expect(feetButton).toHaveAttribute('aria-pressed', 'false');
  const tops = await stitches(page);
  expect(leftmost(tops).rotation, 'tops in: the left one leans right').toBeGreaterThan(0);
  expect(await spread(page), 'the angle is kept').toBeCloseTo(Math.PI / 2, 6);

  await topsButton.click();
  expect(await stitches(page), 'Tops again: nothing turns').toEqual(tops);

  await feetButton.click();
  await expect(feetButton).toHaveAttribute('aria-pressed', 'true');
  expect(await stitches(page), 'back as it was').toEqual(feet);
});

/** How far the frame's arrow sits from the middle of the button, in CSS pixels. */
async function arrowOffset(page: Page, button: Locator, frame: Locator): Promise<number> {
  const middle = await button.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.left + box.width / 2;
  });
  const arrow = await frame.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.left + el.clientLeft + Number.parseFloat(getComputedStyle(el, '::before').left);
  });
  return arrow - middle;
}

const panelScrolls = (page: Page) =>
  page.locator('#inspector').evaluate((panel) => panel.scrollHeight > panel.clientHeight);

test('the settings sit in a frame whose arrow points at the chosen button, and fit a 1000 × 506 window', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await selectedChartWith(page, POINTS);

  const row = page.getByRole('button', { name: 'In a row' });
  await row.click();
  expect(Math.abs(await arrowOffset(page, row, page.locator('#arrange-row-options'))), 'under In a row').toBeLessThan(
    1,
  );
  expect(await panelScrolls(page), 'In a row: every setting in view').toBe(false);

  const around = page.getByRole('button', { name: 'Around' });
  await around.click();
  expect(
    Math.abs(await arrowOffset(page, around, page.locator('#arrange-around-options'))),
    'under Around',
  ).toBeLessThan(1);
  expect(await panelScrolls(page), 'Around: every setting in view').toBe(false);
});

test('on a short window the whole handle of the small dial can be grabbed, even over the field', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'Around' }).click();
  const handle = (await page.getByRole('slider', { name: 'Angle (°)' }).boundingBox())!;
  const dial = (await page.locator('#arrange-dial').boundingBox())!;
  const inner = { x: handle.x + 3, y: handle.y + handle.height / 2 };
  await page.mouse.move(inner.x, inner.y);
  await page.mouse.down();
  await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height - 2, { steps: 4 });
  await page.mouse.up();
  await expect(
    page.getByRole('textbox', { name: 'Angle (°)' }),
    'dragged from the inner edge to the bottom',
  ).toHaveValue('180');
});
