/*
 * The free-form chart type in the browser (PQW-963): choosing the type, placing
 * stitches with one click, selecting and duplicating them, undo, the JSON round
 * trip, and that switching types keeps both patterns.
 */

import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseIrregular(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Free-form designer/ }).click();
  await expect(page.locator('#board-irregular')).toBeVisible();
}

const board = '#board-irregular';

/** Places the armed stitch at a point measured from the canvas's top left corner. */
async function place(page: Page, x: number, y: number): Promise<void> {
  await page.locator(board).click({ position: { x, y } });
}

async function armDoubleCrochet(page: Page): Promise<void> {
  await page.locator(board).focus();
  await page.keyboard.press('Alt+5');
}

test('the free-form type opens its own canvas and hides what belongs to rows', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  await expect(page.locator('#board')).toBeHidden();
  // The selection block waits for a selection (PQW-1022); the rows and layers tabs are there at once.
  await expect(page.locator('#irregular-tabs')).toBeVisible();
  // Filling a row, turning, closing and spiralling belong to regular crochet only.
  await expect(page.locator('#tools-row')).toBeHidden();

  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Regular crochet/ }).click();
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator(board)).toBeHidden();
  await expect(page.locator('#tools-row')).toBeVisible();
});

test('one click places one stitch, and the tool stays armed', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);

  await place(page, 500, 300);
  await expect(page.locator('#status')).toContainText('row 1');
  await expect(page.locator('#status')).toContainText('1 stitch');

  await place(page, 560, 300);
  await place(page, 620, 300);
  await expect(page.locator('#status')).toContainText('3 stitches');
});

test('selecting, duplicating and undo (AS-15, AS-19)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560, 620]) await place(page, x, 300);

  // Esc lays the stitch down, so the next click selects instead of placing.
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 stitches selected');

  await page.getByRole('button', { name: 'Duplicate' }).click();
  await expect(page.locator('#status')).toContainText('3 stitches duplicated');

  // Undo takes the copies back, so nothing that was selected is left.
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 stitches selected');
});

test('the drawing survives a reload; picking a type starts that type anew (AS-1, PQW-1045)', async ({ page }) => {
  await open(page);

  // A regular pattern first: a foundation chain of three.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const regularBefore = await page.locator('#summary').textContent();

  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560]) await place(page, x, 300);
  await expect(page.locator('#status')).toContainText('2 stitches');

  // "New" is the type menu since PQW-1045: a choice empties that type, and undo brings it back.
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Regular crochet/ }).click();
  await expect(page.locator('#summary')).not.toHaveText(regularBefore ?? '');
  await page.locator('#board').focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#summary')).toHaveText(regularBefore ?? '');

  await page.reload();
  const denyAgain = page.getByRole('button', { name: 'Decline' });
  if (await denyAgain.isVisible()) await denyAgain.click();
  // The drawing is still in the store after the reload: picking the type empties it,
  // and one undo brings it back, as the "New" menu promises (PQW-1045).
  await chooseIrregular(page);
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#props-count')).toContainText('No stitch is selected');
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('2 stitches selected');
});

test('the JSON round trip keeps the free-form chart (AS-12)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560, 620]) await place(page, x, 300);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#json-toggle').click();
  await page.getByRole('button', { name: 'Save JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const saved = await readFile((await download.path()) ?? '', 'utf8');
  const parsed = JSON.parse(saved);
  expect(parsed.type).toBe('irregular');
  expect(parsed.items).toHaveLength(3);

  // An empty pattern says nothing about a selection, so the note is blank.
  await chooseIrregular(page);
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#props-count')).toHaveText('');

  await page.locator('#file-toggle').click();
  await page.locator('#import-file').setInputFiles({
    name: 'szabalytalan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved, 'utf8'),
  });
  // The file is read asynchronously; selecting before it is in would select the empty pattern.
  await expect(page.locator('#status')).toContainText('Pattern loaded');
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 stitches selected');
});

test('keys that belong to rows never reach the regular pattern hiding behind this type', async ({ page }) => {
  await open(page);

  // A regular pattern of two chains to compare against.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const stored = () => page.evaluate(() => localStorage.getItem('dc-mintatervezo:minta'));
  const before = await stored();

  await chooseIrregular(page);
  await page.locator(board).focus();
  // Filling, turning, closing, spiralling and crocheting all belong to rows.
  for (const key of ['Alt+f', 'Shift+Alt+f', 'Alt+k', 'Alt+s', 'Enter', 'Enter']) {
    await page.keyboard.press(key);
  }
  // Delete with a toolbar button focused used to delete the regular pattern's last stitch.
  await page.getByRole('button', { name: 'Duplicate' }).focus();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');

  // Picking a type starts a new pattern now (PQW-1045), so what the regular type kept
  // is read from its own store instead of by switching back to it.
  expect(await stored(), 'the regular pattern is untouched').toBe(before);
});

test('rows and rounds: a second row and its own colour (AS-16)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560, 620]) await place(page, x, 420);
  await expect(page.locator('#rows-list li')).toHaveCount(1);
  await expect(page.locator('#rows-list')).toContainText('3 stitches');

  // A new row takes the opposite direction, and new stitches land in it.
  await page.locator('#row-new').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);
  await expect(page.locator('#row-direction')).toHaveValue('rtl');
  await page.locator(board).focus();
  await page.keyboard.press('Alt+1');
  for (const x of [510, 570]) await place(page, x, 340);
  await expect(page.locator('#rows-list')).toContainText('2 stitches');

  await page.locator('#row-color').fill('#b07cc6');
  await page.locator('#row-color').dispatchEvent('change');
  // The rarer row actions are behind the list's „⋯” button (interface.md §59).
  await page.locator('#rows-more-toggle').click();
  await page.locator('#row-select').click();
  await expect(page.locator('#status')).toContainText('2 stitches selected');
});

test('layers: a second layer takes the selected stitches, and hiding it hides them', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560]) await place(page, x, 400);

  await page.locator('#tab-layers').click();
  // A pattern starts with one layer (PQW-1022).
  await expect(page.locator('#layers-list li')).toHaveCount(1);

  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('2 stitches selected');

  await page.locator('#layer-new').click();
  await expect(page.locator('#layers-list li')).toHaveCount(2);
  await page.locator('#layer-move-items').click();
  await expect(page.locator('#status')).toContainText('2 stitches moved');

  // A hidden layer's stitches cannot be selected, though they are still in the pattern.
  await page.locator('#layers-list li').first().getByRole('button', { name: 'Visible' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#props-count')).toContainText('No stitch is selected');
});

/** Every stitch in the autosaved pattern, with the guides that were in force. */
async function stored(page: Page): Promise<{
  items: { x: number; y: number; rotation: number }[];
  polar: { center: { x: number; y: number }; visible: boolean };
  grid: { visible: boolean; size: number };
  snap: boolean;
}> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    const parsed = JSON.parse(raw);
    return {
      items: parsed.items ?? [],
      polar: parsed.guides?.polar ?? { center: { x: 0, y: 0 }, visible: false },
      grid: parsed.guides?.grid ?? { visible: false, size: 0 },
      snap: parsed.guides?.snap ?? false,
    };
  });
}

test('snapping puts a new stitch on the grid, whatever the click hits', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  // The guides live in the view menu, their settings behind its disclosure (interface.md §57).
  await page.locator('#view-toggle').click();
  await page.locator('.view-menu__more > summary').click();
  await page.locator('#guide-grid-size').fill('25');
  await page.locator('#guide-grid-size').blur();
  await page.locator('[data-action="grid"]').click();
  await page.locator('#guide-snap').check();
  await expect(page.locator('#guide-snap')).toBeChecked();

  await armDoubleCrochet(page);
  for (const [x, y] of [
    [483, 257],
    [563, 331],
    [643, 259],
  ]) {
    await place(page, x, y);
  }

  const { items, grid, snap } = await stored(page);
  expect(grid.size, 'the grid size is the value typed in').toBe(25);
  expect(snap, 'snapping is on').toBe(true);
  expect(grid.visible, 'the grid is visible').toBe(true);
  expect(items, 'three stitches were placed').toHaveLength(3);
  for (const item of items) {
    // A negative multiple gives -0, which is not `0` to a strict comparison.
    expect(Math.abs(item.x % 25), 'the stitch landed on a grid line horizontally').toBe(0);
    expect(Math.abs(item.y % 25), 'the stitch landed on a grid line vertically').toBe(0);
  }
});

test('the circle guide turns the new stitches away from its middle (preparing AS-6)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  // The guides live in the view menu, their settings behind its disclosure (interface.md §57).
  await page.locator('#view-toggle').click();
  await page.locator('.view-menu__more > summary').click();
  await page.locator('#guide-polar').check();
  await expect(page.locator('#guide-polar-fields')).toBeVisible();
  await page.locator('#guide-radial').check();

  await armDoubleCrochet(page);
  for (const [x, y] of [
    [520, 200],
    [660, 320],
    [520, 440],
    [380, 320],
  ]) {
    await place(page, x, y);
  }

  const { items, polar } = await stored(page);
  expect(polar.visible, 'the circle guide is visible').toBe(true);
  expect(items, 'four stitches were placed').toHaveLength(4);

  const turns = items.map((item) => {
    const wanted = (Math.atan2(item.x - polar.center.x, polar.center.y - item.y) * 180) / Math.PI;
    return Math.abs(((item.rotation - wanted + 540) % 360) - 180);
  });
  for (const gap of turns) {
    expect(gap, 'the top of the stitch faces away from the middle').toBeLessThan(0.01);
  }
  expect(
    new Set(items.map((item) => Math.round(item.rotation))).size,
    'the four directions give four different rotations',
  ).toBe(4);
});

test('⌘ while dragging turns snapping off, it does not break the selection', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);

  // Where the chart's origin sits on the canvas, measured with the first stitch,
  // so the drag can start exactly on a stitch and not on a resize handle.
  await place(page, 500, 300);
  const first = (await stored(page)).items[0];
  if (first === undefined) throw new Error('no stitch');
  const view = { x: 500 - first.x, y: 300 - first.y };

  // The guides live in the view menu, their settings behind its disclosure (interface.md §57).
  await page.locator('#view-toggle').click();
  await page.locator('.view-menu__more > summary').click();
  await page.locator('#guide-grid-size').fill('20');
  await page.locator('#guide-grid-size').blur();
  await page.locator('[data-action="grid"]').click();
  await page.locator('#guide-snap').check();
  // The menu stays open for the next setting, so it is closed before the canvas gets the keys.
  await page.locator('#view-toggle').click();

  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await place(page, 500, 300);
  await expect(page.locator('#props-count')).toContainText('1');

  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  const drag = async (from: { x: number; y: number }, dx: number, dy: number, free: boolean): Promise<void> => {
    if (free) await page.keyboard.down('Meta');
    await page.mouse.move(rect.x + from.x + view.x, rect.y + from.y + view.y);
    await page.mouse.down();
    await page.mouse.move(rect.x + from.x + view.x + dx, rect.y + from.y + view.y + dy, { steps: 10 });
    await page.mouse.up();
    if (free) await page.keyboard.up('Meta');
  };

  await drag(first, 37, 23, true);
  await expect(page.locator('#props-count'), 'the selection stays together').toContainText('1');
  const free = (await stored(page)).items[0];
  if (free === undefined) throw new Error('no stitch');
  expect(free.x - first.x, 'it moved exactly as far as it was dragged').toBeCloseTo(37, 6);
  expect(free.y - first.y, 'it moved exactly as far as it was dragged').toBeCloseTo(23, 6);

  // The same drag without the key lands on the grid.
  await drag(free, 11, 7, false);
  const snapped = (await stored(page)).items[0];
  if (snapped === undefined) throw new Error('no stitch');
  expect(Math.abs(snapped.x % 20), 'without the key it snaps to the grid').toBe(0);
  expect(Math.abs(snapped.y % 20), 'without the key it snaps to the grid').toBe(0);
});

test('⌘ turns snapping off when placing too, not only when dragging (PQW-975)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  const where = async (): Promise<{ x: number; y: number }[]> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      return (JSON.parse(raw).items ?? []).map((item: { x: number; y: number }) => ({ x: item.x, y: item.y }));
    });

  // Where the chart's origin sits, measured before any snapping can move a stitch.
  await armDoubleCrochet(page);
  await place(page, 500, 300);
  const origin = (await where())[0];
  if (origin === undefined) throw new Error('no stitch');
  const view = { x: 500 - origin.x, y: 300 - origin.y };

  // The guides live in the view menu, their settings behind its disclosure (interface.md §57).
  await page.locator('#view-toggle').click();
  await page.locator('.view-menu__more > summary').click();
  await page.locator('#guide-grid-size').fill('25');
  await page.locator('#guide-grid-size').blur();
  await page.locator('[data-action="grid"]').click();
  await page.locator('#guide-snap').check();

  // Without the key, a placed stitch lands on the grid.
  await armDoubleCrochet(page);
  await place(page, 483, 257);
  const snapped = (await where())[1];
  if (snapped === undefined) throw new Error('no second stitch');
  expect(Math.abs(snapped.x % 25), 'with snapping it sits on the grid').toBe(0);
  expect(Math.abs(snapped.y % 25), 'with snapping it sits on the grid').toBe(0);

  // With the key held it lands exactly where the pointer was — the owner's case.
  await page.locator(board).click({ position: { x: 483 + 63, y: 257 + 41 }, modifiers: ['Meta'] });
  const free = (await where())[2];
  if (free === undefined) throw new Error('no third stitch');
  expect(free.x + view.x, 'it landed exactly where the pointer was').toBeCloseTo(483 + 63, 6);
  expect(free.y + view.y, 'it landed exactly where the pointer was').toBeCloseTo(257 + 41, 6);
  expect(Math.abs(free.x % 25) > 0.001 || Math.abs(free.y % 25) > 0.001, 'and it does not sit on the grid').toBe(true);
});

test('⌘ + click without dragging still takes a stitch out of the selection', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [480, 560, 640]) await place(page, x, 300);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a');
  await expect(page.locator('#props-count')).toContainText('3');

  await page.locator(board).click({ position: { x: 560, y: 300 }, modifiers: ['Meta'] });
  await expect(page.locator('#props-count'), 'the middle one is out').toContainText('2');
});

test('chain arc: drawn by dragging, then N set to 7 (AS-3)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  // Row 2 is the active one, so the arc has to land there. A new row opens only
  // after a row with stitches (PQW-1012), so row 1 gets one, gone again once row 2 is open.
  await armDoubleCrochet(page);
  await place(page, 300, 450);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.locator('#row-new').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);
  await page.locator(board).click({ position: { x: 300, y: 450 } });
  await page.keyboard.press('Delete');

  // The free-form tool group is hidden in the other types, so its tooltip is checked here.
  const arcTool = page.locator('[data-action="chain-arc"]');
  await expect(arcTool).toBeVisible();
  await expect(arcTool).toHaveAttribute('data-tip', /Draw a chain arc/);
  await arcTool.click();
  await expect(arcTool).toHaveAttribute('aria-pressed', 'true');

  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  await page.mouse.move(rect.x + 420, rect.y + 380);
  await page.mouse.down();
  await page.mouse.move(rect.x + 700, rect.y + 380, { steps: 12 });
  await page.mouse.up();

  const arc = async (): Promise<{ count: number; members: number; items: number; rowId: string; shape: string }> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const parsed = JSON.parse(raw);
      const group = (parsed.groups ?? [])[0] ?? { count: 0, memberIds: [], rowId: '', shape: '' };
      return {
        count: group.count,
        members: group.memberIds.length,
        items: (parsed.items ?? []).length,
        rowId: group.rowId,
        shape: group.shape,
      };
    });

  const drawn = await arc();
  expect(drawn.count, 'it starts with five stitches').toBe(5);
  expect(drawn.items, 'and five stitches went onto the canvas').toBe(5);
  expect(drawn.shape, 'an arc, not a straight line').toBe('arc');
  await expect(page.locator('#status')).toContainText('row 2');

  // The whole arc is selected right after drawing, so a digit sets its count.
  await expect(page.locator('#props-count')).toContainText('5');
  await expect(page.locator('#props-arc')).toBeVisible();
  await page.locator(board).focus();
  await page.keyboard.press('7');

  const grown = await arc();
  expect(grown.count, 'seven stitches').toBe(7);
  expect(grown.members, 'and the group lists seven too').toBe(7);
  expect(grown.items, 'there are seven on the canvas too').toBe(7);
  await expect(page.locator('#arc-count')).toHaveValue('7');

  // Digits typed one after the other build one number, so 1 then 2 is twelve.
  await page.waitForTimeout(1100);
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await expect(page.locator('#arc-count'), 'digits typed one after another make one number').toHaveValue('12');
  await page.waitForTimeout(1100);
  await page.keyboard.press('7');
  await expect(page.locator('#arc-count'), 'after a pause a new number starts').toHaveValue('7');

  // The stitches follow the arc: the middle one sits higher than the two ends.
  const heights = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).map((item: { y: number }) => item.y);
  });
  const first = heights[0] ?? 0;
  const middle = heights[3] ?? 0;
  const last = heights[6] ?? 0;
  expect(middle, 'the middle bulges higher').toBeLessThan(first);
  expect(Math.abs(first - last), 'the two ends are at the same height').toBeLessThan(0.001);

  // The endpoint grip sits on the selection box's corner and must win over it:
  // resizing would only break the arc up, which is not what the hand reached for.
  const ends = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    const group = (JSON.parse(raw).groups ?? [])[0];
    return { start: group.start, end: group.end };
  });
  const view = { x: 420 - ends.start.x, y: 380 - ends.start.y };
  await page.mouse.move(rect.x + ends.end.x + view.x, rect.y + ends.end.y + view.y);
  await page.mouse.down();
  await page.mouse.move(rect.x + ends.end.x + view.x + 60, rect.y + ends.end.y + view.y + 40, { steps: 10 });
  await page.mouse.up();
  const dragged = await arc();
  expect(dragged.count, 'dragging the end point did not break the arc apart').toBe(7);
  const moved = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).groups ?? [])[0].end;
  });
  expect(moved.x, 'it moved the end point instead').toBeCloseTo(ends.end.x + 60, 6);
  expect(moved.y, 'it moved the end point instead').toBeCloseTo(ends.end.y + 40, 6);

  // Breaking it apart keeps every stitch and forgets only the recipe.
  await page.locator('#arc-explode').click();
  const gone = await arc();
  expect(gone.items, 'the seven stitches stay').toBe(7);
  expect(gone.count, 'but the group is gone').toBe(0);
});

test('fan: drawn spreading out, N changed, switched to converging (AS-6, AS-7)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  const fanTool = page.locator('[data-action="fan"]');
  await expect(fanTool).toBeVisible();
  await fanTool.click();
  await expect(fanTool).toHaveAttribute('aria-pressed', 'true');

  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  // Press the base point, drag upward: the fan opens upward from there.
  await page.mouse.move(rect.x + 500, rect.y + 500);
  await page.mouse.down();
  await page.mouse.move(rect.x + 500, rect.y + 380, { steps: 12 });
  await page.mouse.up();

  const fan = async (): Promise<{ count: number; mode: string; spread: number; items: number; kind: string }> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const parsed = JSON.parse(raw);
      const group = (parsed.groups ?? [])[0] ?? { count: 0, mode: '', spreadAngle: 0, kind: '' };
      return {
        count: group.count,
        mode: group.mode,
        spread: group.spreadAngle,
        kind: group.kind,
        items: (parsed.items ?? []).length,
      };
    });

  const drawn = await fan();
  expect(drawn.kind, 'a fan was made').toBe('fan');
  expect(drawn.count, 'it starts with five stitches').toBe(5);
  expect(drawn.spread, 'with a 120 degree spread').toBe(120);
  expect(drawn.items, 'and five stitches went onto the canvas').toBe(5);
  await expect(page.locator('#props-fan')).toBeVisible();

  // Every stitch is worked into the same base point.
  const bases = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).map((item: { x: number; y: number; rotation: number; height: number }) => {
      const radians = (item.rotation * Math.PI) / 180;
      return {
        x: item.x - Math.sin(radians) * (item.height / 2),
        y: item.y + Math.cos(radians) * (item.height / 2),
      };
    });
  });
  const first = bases[0] ?? { x: 0, y: 0 };
  for (const point of bases) {
    expect(Math.abs(point.x - first.x), 'minden szem ugyanabba az alappontba megy').toBeLessThan(0.001);
    expect(Math.abs(point.y - first.y), 'minden szem ugyanabba az alappontba megy').toBeLessThan(0.001);
  }

  await page.locator(board).focus();
  await page.keyboard.press('7');
  expect((await fan()).count, 'it moved to seven stitches').toBe(7);

  await page.locator('#fan-mode').selectOption('converge');
  const converged = await fan();
  expect(converged.mode, 'it became converging').toBe('converge');
  expect(converged.items, 'ugyanannyi szemmel').toBe(7);

  // Converging: now the TOP points meet instead of the bases.
  const tops = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).map((item: { x: number; y: number; rotation: number; height: number }) => {
      const radians = (item.rotation * Math.PI) / 180;
      return {
        x: item.x + Math.sin(radians) * (item.height / 2),
        y: item.y - Math.cos(radians) * (item.height / 2),
      };
    });
  });
  const meeting = tops[0] ?? { x: 0, y: 0 };
  for (const point of tops) {
    expect(Math.abs(point.x - meeting.x), 'the tips meet in one point').toBeLessThan(0.001);
    expect(Math.abs(point.y - meeting.y), 'the tips meet in one point').toBeLessThan(0.001);
  }

  // Arming the palette must lay the fan tool down, or every click draws a fan.
  await expect(fanTool, 'the tool stays armed after drawing too').toHaveAttribute('aria-pressed', 'true');
  await armDoubleCrochet(page);
  await expect(fanTool, 'the palette puts the fan tool down').toHaveAttribute('aria-pressed', 'false');
  await place(page, 300, 250);
  expect((await fan()).items, 'the click placed one stitch, not a fan').toBe(8);
  await page.keyboard.press('Escape');
  await page.locator(board).click({ position: { x: 500, y: 460 } });

  await page.locator('#fan-explode').click();
  expect((await fan()).kind, 'once broken apart there is no group any more').toBe('');
  expect((await fan()).items, 'but the seven stitches and the separately placed one stay').toBe(8);
});

test('arranging: onto a circle, the row remembers the shape, Even out closes the gap (AS-17, AS-18)', async ({
  page,
}) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);

  // Eight stitches scattered roughly around a circle.
  const around = [
    [500, 300],
    [570, 330],
    [600, 400],
    [575, 470],
    [500, 500],
    [430, 465],
    [400, 400],
    [428, 332],
  ];
  for (const [x, y] of around) await place(page, x, y);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');

  const state = async (): Promise<{ items: number; line: string | null; radius: number | null }> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const parsed = JSON.parse(raw);
      const line = parsed.rows?.[0]?.line ?? null;
      return {
        items: (parsed.items ?? []).length,
        line: line === null ? null : line.shape,
        radius: line?.radius ?? null,
      };
    });

  // Where the chart's origin sits, measured from the first stitch as it was placed.
  const firstPlaced = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? [])[0] as { x: number; y: number };
  });
  const view = { x: 500 - firstPlaced.x, y: 300 - firstPlaced.y };

  // The edit block shows with a selection only (PQW-1022); the whole row selected is still the whole row.
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#props-arrange')).toBeVisible();
  await page.locator('[data-arrange="circle"]').click();

  const arranged = await state();
  expect(arranged.line, 'the row remembered the circle as its row line').toBe('circle');
  expect(arranged.items, 'mind a nyolc szem megvan').toBe(8);
  await expect(page.locator('#rowline-row'), 'the row line removal appeared').toBeVisible();

  // Every stitch's base point now sits on the circle.
  const spread = async (): Promise<number[]> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const parsed = JSON.parse(raw);
      const line = parsed.rows[0].line;
      return (parsed.items ?? []).map((item: { x: number; y: number; rotation: number; height: number }) => {
        const radians = (item.rotation * Math.PI) / 180;
        const base = {
          x: item.x - Math.sin(radians) * (item.height / 2),
          y: item.y + Math.cos(radians) * (item.height / 2),
        };
        return Math.hypot(base.x - line.center.x, base.y - line.center.y) - line.radius;
      });
    });
  for (const off of await spread()) {
    expect(Math.abs(off), 'the base point of the stitch sits on the circle').toBeLessThan(0.001);
  }

  // Delete one stitch where it sits now, then Even out closes the gap.
  const middle = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? [])[3] as { x: number; y: number };
  });
  await page.locator(board).click({ position: { x: middle.x + view.x, y: middle.y + view.y } });
  await expect(page.locator('#props-count')).toContainText('1');
  await page.keyboard.press('Delete');
  expect((await state()).items, 'seven are left').toBe(7);

  await page.keyboard.press('ControlOrMeta+A');
  await page.locator('#arrange-even').click();
  for (const off of await spread()) {
    expect(Math.abs(off), 'the remaining stitches sit on the circle too').toBeLessThan(0.001);
  }
  expect((await state()).radius, 'on the same circle').toBe(arranged.radius);

  await page.locator('#rowline-clear').click();
  expect((await state()).line, 'the row line is gone').toBe(null);
  expect((await state()).items, 'the stitches stayed where they were').toBe(7);
});

test('the row line can be reshaped by its handle, and the stitches follow only on Even out', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [420, 480, 540, 600]) await place(page, x, 400);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a');
  await page.locator('[data-arrange="line"]').click();

  const read = async (): Promise<{
    line: { start: { x: number; y: number }; end: { x: number; y: number } };
    ys: number[];
  }> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const parsed = JSON.parse(raw);
      return {
        line: parsed.rows[0].line,
        ys: (parsed.items ?? []).map((item: { y: number }) => item.y),
      };
    });

  const before = await read();
  expect(before.line, 'a sor megjegyezte az egyenest').toBeTruthy();

  // Drag the line's end grip downward. Only the line may move.
  const first = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? [])[0] as { x: number; y: number };
  });
  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  // The first stitch sits on the line's start, so the view offset follows from it.
  const view = { x: 420 - first.x, y: 400 - first.y };
  await page.mouse.move(rect.x + before.line.end.x + view.x, rect.y + before.line.end.y + view.y);
  await page.mouse.down();
  await page.mouse.move(rect.x + before.line.end.x + view.x, rect.y + before.line.end.y + view.y + 80, { steps: 10 });
  await page.mouse.up();

  const reshaped = await read();
  expect(reshaped.line.end.y - before.line.end.y, 'the end of the line moved lower').toBeGreaterThan(70);
  expect(reshaped.ys, 'the stitches have not moved yet').toEqual(before.ys);

  await page.locator('#arrange-even').click();
  const evened = await read();
  expect(evened.ys, 'Even out brings them onto it').not.toEqual(before.ys);
  expect(evened.ys[3], 'the last stitch is at the new end of the line').toBeGreaterThan(before.ys[3]);
});

test('export: SVG and PNG from the free-form type (AS-13, PQW-1047)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [440, 500, 560, 620]) await place(page, x, 380);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');

  // A hidden row must not reach the file at all.
  await page.locator('#row-new').click();
  await armDoubleCrochet(page);
  await place(page, 500, 480);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.locator('#rows-list li').nth(1).getByRole('button', { name: 'Visible' }).click();

  const svgDownload = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('svg');
  await page.locator('#export-run').click();
  const svg = await readFile((await (await svgDownload).path()) ?? '', 'utf8');
  expect(svg.startsWith('<svg'), 'a vector SVG was made').toBe(true);
  // The hidden row's stitch must leave no geometry behind, not merely be invisible.
  const drawn = (svg.match(/<(path|ellipse|circle|line)\b/g) ?? []).length;
  expect(drawn, 'the visible stitches are in it').toBeGreaterThan(0);
  const everything = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).length;
  });
  expect(everything, 'the pattern has five stitches, one of them in the hidden row').toBe(5);
  await page.locator('#rows-list li').nth(1).getByRole('button', { name: 'Visible' }).click();
  const shownAgain = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('svg');
  await page.locator('#export-run').click();
  const all = await readFile((await (await shownAgain).path()) ?? '', 'utf8');
  const drawnAll = (all.match(/<(path|ellipse|circle|line)\b/g) ?? []).length;
  expect(drawnAll, 'with the row switched back on more shapes go into the file').toBeGreaterThan(drawn);
  await page.locator('#rows-list li').nth(1).getByRole('button', { name: 'Visible' }).click();

  const pngDownload = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('png');
  await page.locator('#export-run').click();
  const png = await (await pngDownload).path();
  expect(png, 'a PNG was made too').toBeTruthy();
  // The dialog's opener is in a closed menu, so the focus returns to the menu's button.
  await expect(page.locator('#file-toggle')).toBeFocused();

  // PQW-1047: the PDF export is gone; the owner asked for the picture formats only.
});

test('labels: the row numbers follow the row, and do not count as stitches (AS-9)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [460, 520, 580]) await place(page, x, 340);
  await page.locator('#row-new').click();
  await armDoubleCrochet(page);
  for (const x of [460, 520, 580]) await place(page, x, 440);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');

  const read = async (): Promise<{ labels: { text: string; row: string }[]; counts: string[] }> => ({
    labels: await page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      return (JSON.parse(raw).items ?? [])
        .filter((item: { kind: string; note?: string }) => item.kind === 'annotation' && item.note === 'label')
        .map((item: { text: string; linkedRowId: string }) => ({ text: item.text, row: item.linkedRowId }));
    }),
    counts: await page.locator('#rows-list li').allInnerTexts(),
  });

  await page.locator('#notes-toggle').click();
  await page.locator('#notes-numbers').click();
  const made = await read();
  expect(made.labels, 'one row number per row').toHaveLength(2);
  expect(made.labels[0].text, 'the first row runs from left to right').toContain('1');
  expect(made.labels[0].text, 'and it carries the direction arrow').toContain('→');

  // An annotation is never a stitch: the row counts must not have moved.
  expect(made.counts[0], 'the first row is still three stitches').toContain('3');
  expect(made.counts[1], 'the second one too').toContain('3');

  // Turning the row the other way turns the label's arrow with it.
  await page.locator('#rows-list li').first().locator('.rows__pick').click();
  await page.locator('#row-direction').selectOption('rtl');
  const turned = await read();
  const first = turned.labels.find((label) => label.row === made.labels[0].row);
  expect(first?.text, 'the arrow turned around').toContain('←');

  // A second press adds nothing: every row already has one.
  await page.locator('#notes-toggle').click();
  await page.locator('#notes-numbers').click();
  expect((await read()).labels, 'it is not doubled').toHaveLength(2);

  // The numbers go into the export too, not only onto the canvas — into the SVG,
  // now that the PDF is gone (PQW-1047).
  const svgDownload = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('svg');
  await page.locator('#export-run').click();
  const svg = await readFile((await (await svgDownload).path()) ?? '', 'utf8');
  expect((svg.match(/<text/g) ?? []).length, 'the row numbers are in the SVG as text').toBeGreaterThan(1);
});

test('note and arrow: placing, text and font size (FR-ANN-5, FR-ANN-6)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  await page.locator('#notes-toggle').click();
  await page.locator('[data-action="note-text"]').click();
  await page.locator(board).click({ position: { x: 520, y: 320 } });
  await expect(page.locator('#props-note'), 'megjelenik a felirat blokkja').toBeVisible();
  await expect(page.locator('#note-text'), 'and the text field takes the focus').toBeFocused();
  await page.locator('#note-text').fill('Ismételd 6×');
  await page.locator('#note-text').blur();

  const notes = async (): Promise<{ note: string; text: string; fontSize: number }[]> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      return (JSON.parse(raw).items ?? []).filter((item: { kind: string }) => item.kind === 'annotation');
    });

  const written = await notes();
  expect(written, 'egy felirat').toHaveLength(1);
  expect(written[0].text, 'with the text that was typed').toBe('Ismételd 6×');

  await page.locator('#note-size').fill('28');
  await page.locator('#note-size').blur();
  expect((await notes())[0].fontSize, 'the font size can be set').toBe(28);

  // An arrow is drawn by dragging, and carries no text.
  await page.locator('#notes-toggle').click();
  await page.locator('[data-action="note-arrow"]').click();
  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  await page.mouse.move(rect.x + 400, rect.y + 460);
  await page.mouse.down();
  await page.mouse.move(rect.x + 620, rect.y + 500, { steps: 10 });
  await page.mouse.up();
  const both = await notes();
  expect(both, 'a note and an arrow').toHaveLength(2);
  expect(both[1].note, 'the second one is the arrow').toBe('arrow');

  // Neither of them is a stitch.
  await expect(page.locator('#rows-list li').first(), 'the stitch count of the row stayed zero').toContainText('0');
});

test('performance: a thousand stitches stay workable, and the save waits for the hand (FR-PERF)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  // One real stitch first, so the autosave slot holds a whole pattern to grow.
  await armDoubleCrochet(page);
  await place(page, 400, 300);
  await page.waitForTimeout(700);

  // A thousand stitches, straight into the autosave slot, then reloaded.
  await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    const parsed = JSON.parse(raw);
    const items = [];
    for (let index = 0; index < 1000; index += 1) {
      items.push({
        id: `i${index + 1}`,
        kind: 'stitch',
        keyEntryId: 'dc',
        insertion: 'both-loops',
        rowId: parsed.activeRowId,
        layerId: parsed.activeLayerId,
        color: null,
        x: (index % 40) * 30,
        y: Math.floor(index / 40) * 45,
        width: 14,
        height: 34,
        rotation: 0,
        flipX: false,
        flipY: false,
      });
    }
    localStorage.setItem('dc-mintatervezo:minta-szabalytalan', JSON.stringify({ ...parsed, items }));
  });
  await page.reload();
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
  await expect(page.locator(board)).toBeVisible();
  await expect(page.locator('#rows-list li').first(), 'a thousand stitches loaded').toContainText('1000');

  // Really resizing is what makes the board redraw, so that is what is timed.
  const started = Date.now();
  for (let step = 0; step < 6; step += 1) {
    await page.setViewportSize({ width: 1200 + step * 40, height: 800 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  }
  expect(Date.now() - started, 'six full redraws within two seconds').toBeLessThan(2000);

  // Every act is written at once, so nothing is ever behind what is on screen.
  await armDoubleCrochet(page);
  await place(page, 300, 300);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).length;
  });
  expect(stored, 'a lerakott szem azonnal mentve').toBe(1001);
});

test('a pinch zooms and does not draw: what the first finger did is taken back (FR-TOUCH)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);

  const items = async (): Promise<number> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      return (JSON.parse(raw).items ?? []).length;
    });

  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  const first = await page.context().newCDPSession(page);

  // Two fingers down with a stitch armed: the first finger must not leave one.
  await first.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: rect.x + 400, y: rect.y + 400, id: 1 }],
  });
  await first.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: rect.x + 400, y: rect.y + 400, id: 1 },
      { x: rect.x + 600, y: rect.y + 400, id: 2 },
    ],
  });
  await first.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: rect.x + 340, y: rect.y + 400, id: 1 },
      { x: rect.x + 660, y: rect.y + 400, id: 2 },
    ],
  });
  await first.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  expect(await items(), 'the pinch placed no stitch').toBe(0);

  // One finger still draws.
  await first.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: rect.x + 500, y: rect.y + 300, id: 3 }],
  });
  await first.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await items(), 'egy ujj viszont lerak').toBe(1);
});

test('the chain arc keeps what the preview showed, even when ⌘ is released first (PQW-975)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  const where = async (): Promise<{ x: number; y: number }[]> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const group = (JSON.parse(raw).groups ?? [])[0];
      return group === undefined ? [] : [group.start, group.end];
    });

  // Measure the chart origin before any snapping can move a stitch.
  await armDoubleCrochet(page);
  await place(page, 500, 300);
  const origin = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? [])[0] as { x: number; y: number };
  });
  const view = { x: 500 - origin.x, y: 300 - origin.y };

  // The guides live in the view menu, their settings behind its disclosure (interface.md §57).
  await page.locator('#view-toggle').click();
  await page.locator('.view-menu__more > summary').click();
  await page.locator('#guide-grid-size').fill('20');
  await page.locator('#guide-grid-size').blur();
  await page.locator('[data-action="grid"]').click();
  await page.locator('#guide-snap').check();

  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  await page.locator('[data-action="chain-arc"]').click();

  // Draw with the key held, then let go of the key BEFORE the mouse button —
  // the natural order for one hand. What was previewed is what must land.
  await page.keyboard.down('Meta');
  await page.mouse.move(rect.x + 417, rect.y + 383);
  await page.mouse.down();
  await page.mouse.move(rect.x + 663, rect.y + 383, { steps: 12 });
  await page.keyboard.up('Meta');
  await page.mouse.up();

  const [start, end] = await where();
  if (start === undefined || end === undefined) throw new Error('no arc');
  expect(start.x + view.x, 'the start point stayed where it was pressed').toBeCloseTo(417, 6);
  expect(end.x + view.x, 'the end point where it was released').toBeCloseTo(663, 6);
  expect(Math.abs(start.x % 20) > 0.001, 'so it did not snap to the grid').toBe(true);
});

test('the selection block says what it is for, and the rectangle mode hangs off the area tool (PQW-1009)', async ({
  page,
}) => {
  await open(page);
  await chooseIrregular(page);

  // Since PQW-1022 the block is not there at all until something is selected.
  await expect(page.locator('#section-irregular')).toBeHidden();
  await expect(page.locator('#props-fields')).toBeHidden();

  // "Area" is not inside a menu, so pressing it closes whatever menu is open.
  await page.locator('#notes-toggle').click();
  await page.locator('[data-action="select-area"]').click();
  await expect(page.locator('#notes-pop')).toBeHidden();

  const toggle = page.locator('#select-mode-toggle');
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  // PQW-1046: two menu items, not a chooser inside the menu.
  const full = page.locator('[data-rect-mode="full"]');
  await expect(page.locator('[data-rect-mode="partial"]')).toHaveAttribute('aria-checked', 'true');
  await full.click();
  await expect(full).toHaveAttribute('aria-checked', 'true');
  // The choice is a preference of the editor, so it survives a reload.
  await page.reload();
  await page.locator('#select-mode-toggle').click();
  await expect(page.locator('[data-rect-mode="full"]')).toHaveAttribute('aria-checked', 'true');

  // The regular type has no rectangle mode of its own.
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Regular crochet/ }).click();
  await expect(toggle).toBeHidden();
});

test('rows, layers and key share one place behind tabs; the background is the bottom layer (PQW-1010)', async ({
  page,
}) => {
  await open(page);
  await chooseIrregular(page);

  // One list at a time: rows first. Before the first stitch the rows tab only says how to begin (PQW-1015).
  await expect(page.locator('#tab-rows')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#rows-empty')).toBeVisible();
  await expect(page.locator('#rows-list')).toBeHidden();
  await expect(page.locator('#layers-list')).toBeHidden();

  // Moving a row is the footer's job, and it moves the active one.
  // A new row opens only after a row with stitches (PQW-1012).
  await armDoubleCrochet(page);
  await place(page, 300, 450);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.locator('#row-new').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);
  await expect(page.locator('#row-down')).toBeDisabled();
  await page.locator('#row-up').click();
  await expect(page.locator('#rows-list li').first()).toHaveClass(/is-active/);
  await expect(page.locator('#row-up')).toBeDisabled();

  // The rarer actions wait behind „⋯”.
  await expect(page.locator('#row-select')).toBeHidden();
  await page.locator('#rows-more-toggle').click();
  await expect(page.locator('#rows-more-toggle')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#row-select')).toBeVisible();

  // Layers: the background row sits under the list and opens the picture's settings.
  await page.locator('#tab-layers').click();
  await expect(page.locator('#rows-list')).toBeHidden();
  await expect(page.locator('#layer-name')).toBeVisible();
  await expect(page.locator('#layer-bg-visible')).toBeDisabled();
  await page.locator('#layer-bg-pick').click();
  await expect(page.locator('#layer-name')).toBeHidden();
  // The footer acts on the active layer, which is out of sight now: nothing to delete or move.
  await expect(page.locator('#layer-delete')).toBeDisabled();
  await expect(page.locator('#layer-up')).toBeDisabled();
  await expect(page.locator('#layer-bg-load')).toBeVisible();

  // Renaming the active layer happens in its own field.
  await page.locator('#layers-list li').first().locator('.rows__pick').click();
  await page.locator('#layer-name').fill('Szegély');
  await page.locator('#layer-name').blur();
  await expect(page.locator('#layers-list li').first()).toContainText('Szegély');
});

/*
 * PQW-1011's dialog is gone with PQW-1048: the language and the symbol set sit in
 * the bar for both types, and the preset, the terminology, the pattern name and the
 * key list were removed at the owner's request. What replaced it is covered by
 * „the language and the symbol set are in the bar in both types” below.
 */
test('the language and the symbol set are in the bar in both types (PQW-1048)', async ({ page }) => {
  await open(page);
  await expect(page.locator('#ui-language')).toBeVisible();
  await expect(page.locator('#chart-style')).toBeVisible();
  // They are the bar's own, so they stay through a type change.
  await chooseIrregular(page);
  await expect(page.locator('#ui-language')).toBeVisible();
  await expect(page.locator('#chart-style')).toBeVisible();
  // And they still work: the symbol set reaches the free-form canvas too.
  await page.locator('#chart-style').selectOption('jis');
  await expect(page.locator('#status')).toContainText('Symbol style');
  await expect(page.locator('#settings-dialog')).toHaveCount(0);
  await expect(page.locator('#title')).toHaveCount(0);
});

test('a new row opens only after a row with stitches, and the footer deletes the active row (PQW-1012)', async ({
  page,
}) => {
  await open(page);
  await chooseIrregular(page);

  await expect(page.locator('#row-new')).toBeDisabled();
  await expect(page.locator('#row-new-round')).toBeDisabled();

  await armDoubleCrochet(page);
  await place(page, 500, 300);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#row-new')).toBeEnabled();

  await page.locator('#row-new').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);
  await expect(page.locator('#row-new'), 'the new row is empty, so no third one yet').toBeDisabled();
  // Picking the filled first row does not help: a new row still goes after the empty last one.
  await page.locator('#rows-list li').first().locator('.rows__pick').click();
  await expect(page.locator('#row-new')).toBeDisabled();
  await expect(page.locator('#row-insert'), 'but inserting after the filled one is fine').toBeEnabled();

  // The trash is in the footer, not behind „⋯”, and one undo brings the row back.
  await expect(page.locator('#row-delete')).toBeVisible();
  await page.locator('#row-delete').click();
  await expect(page.locator('#rows-list li')).toHaveCount(1);
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+z');
  await expect(page.locator('#rows-list li')).toHaveCount(2);
});

test('there is no stitch key tab any more, only rows and layers (PQW-1013)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  await expect(page.locator('#irregular-tabs button')).toHaveCount(2);
  await expect(page.locator('#section-irregular-key')).toHaveCount(0);
});

test('zoom and guides are two menus, both guides share one size, and there is no row before the first stitch (PQW-1015)', async ({
  page,
}) => {
  await open(page);
  await chooseIrregular(page);

  await expect(page.locator('#view-toggle')).toContainText('Guides');
  await expect(page.locator('#zoom-toggle')).toContainText('Zoom');
  await expect(page.locator('[data-action="isolate"]')).toHaveCount(0);
  await expect(page.locator('#row-fade')).toHaveCount(0);
  await expect(page.locator('#guide-start-angle')).toHaveCount(0);

  // Nothing drawn yet: no „1. sor, 0 szem”, only how to begin.
  await expect(page.locator('#rows-empty')).toBeVisible();
  await expect(page.locator('#rows-list')).toBeHidden();

  // The square grid and the circle guide may show together, and one size sets both.
  await page.locator('#view-toggle').click();
  await page.locator('.view-menu__more > summary').click();
  await expect(page.locator('#guide-grid-size')).toHaveValue('40');
  await page.locator('[data-action="grid"]').click();
  await page.locator('#guide-polar').check();
  await page.locator('#guide-grid-size').fill('30');
  await page.locator('#guide-grid-size').blur();
  const guides = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return JSON.parse(raw).guides;
  });
  expect(guides.grid, 'the square grid is on').toMatchObject({ visible: true, size: 30 });
  expect(guides.polar, 'and so is the circle guide, with the same step').toMatchObject({ visible: true, spacing: 30 });
  // A size only one guide could take is brought into what both accept, so they never part.
  await page.locator('#guide-grid-size').fill('2');
  await page.locator('#guide-grid-size').blur();
  const tiny = await page.evaluate(
    () => JSON.parse(localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}').guides,
  );
  expect([tiny.grid.size, tiny.polar.spacing]).toEqual([4, 4]);

  await page.locator('#view-toggle').click();
  await armDoubleCrochet(page);
  await place(page, 500, 300);
  await expect(page.locator('#rows-empty')).toBeHidden();
  await expect(page.locator('#rows-list li')).toHaveCount(1);
});

test('one layer, an edit block only with a selection, a frame that moves from anywhere inside, and a pointer tool (PQW-1022)', async ({
  page,
}) => {
  await open(page);
  await chooseIrregular(page);

  await page.locator('#tab-layers').click();
  await expect(page.locator('#layers-list li')).toHaveCount(1);
  await expect(page.locator('#layers-list li')).toContainText('Layer');

  await expect(page.locator('#section-irregular')).toBeHidden();
  await expect(page.locator('#select-pointer')).toHaveAttribute('aria-pressed', 'true');

  await armDoubleCrochet(page);
  await place(page, 400, 300);
  await place(page, 600, 300);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');

  // The pointer draws no rectangle on empty ground.
  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  await page.mouse.move(rect.x + 300, rect.y + 200);
  await page.mouse.down();
  await page.mouse.move(rect.x + 700, rect.y + 400, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('#section-irregular')).toBeHidden();

  // Ctrl/⌘ + click takes a second one.
  await page.locator(board).click({ position: { x: 400, y: 300 } });
  await page.locator(board).click({ position: { x: 600, y: 300 }, modifiers: ['ControlOrMeta'] });
  await expect(page.locator('#section-irregular')).toBeVisible();
  await expect(page.locator('#section-irregular')).toContainText('Edit the selection');
  await expect(page.locator('#props-count')).toContainText('2');

  // Grabbing the empty middle of the frame moves both.
  const before = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}').items.map(
      (item: { x: number }) => item.x,
    ),
  );
  await page.mouse.move(rect.x + 500, rect.y + 300);
  await page.mouse.down();
  await page.mouse.move(rect.x + 550, rect.y + 300, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}').items.map(
      (item: { x: number }) => item.x,
    ),
  );
  expect(
    after.map((x: number, i: number) => Math.round(x - before[i])),
    'both moved by the drag',
  ).toEqual([50, 50]);

  // The area tool is the one that draws a rectangle.
  await page.locator('[data-action="select-area"]').click();
  await expect(page.locator('#select-pointer')).toHaveAttribute('aria-pressed', 'false');

  // Either selection tool lays a drawing tool down.
  await page.locator('[data-action="fan"]').click();
  await expect(page.locator('[data-action="fan"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#select-pointer').click();
  await expect(page.locator('[data-action="fan"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#select-pointer')).toHaveAttribute('aria-pressed', 'true');
});

test('an older pattern with the two starting layers loads as one layer (PQW-1022)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  const old = {
    formatVersion: 1,
    type: 'irregular',
    title: 'Régi minta',
    rows: [{ id: 'r1', kind: 'row', direction: 'ltr', color: null, visible: true, locked: false }],
    layers: [
      { id: 'l1', name: 'Mintarajz', visible: true, locked: false },
      { id: 'l2', name: 'Feliratok', visible: true, locked: false },
    ],
    items: [],
    activeRowId: 'r1',
    activeLayerId: 'l2',
    guides: {
      grid: { visible: false, size: 20 },
      polar: { visible: false, center: { x: 0, y: 0 }, rings: 8, spacing: 40, spokes: 12, startAngle: 0 },
      snap: false,
    },
  };
  await page.locator('#file-toggle').click();
  await page.locator('#import-file').setInputFiles({
    name: 'regi.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(old), 'utf8'),
  });
  await expect(page.locator('#status')).toContainText('Pattern loaded');
  await page.locator('#tab-layers').click();
  await expect(page.locator('#layers-list li')).toHaveCount(1);
  await expect(page.locator('#layers-list li')).toContainText('Layer');
});
