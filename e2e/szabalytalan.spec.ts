/*
 * The free-form chart type in the browser (PQW-963): choosing the type, placing
 * stitches with one click, selecting and duplicating them, undo, the JSON round
 * trip, and that switching types keeps both patterns.
 */

import { readFile } from 'node:fs/promises';
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
  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#board')).toBeVisible();
  await expect(page.locator(board)).toBeHidden();
  await expect(page.locator('#tools-row')).toBeVisible();
});

test('one click places one stitch, and the tool stays armed', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);

  await place(page, 500, 300);
  await expect(page.locator('#status')).toContainText('1. sor');
  await expect(page.locator('#status')).toContainText('1 szem');

  await place(page, 560, 300);
  await place(page, 620, 300);
  await expect(page.locator('#status')).toContainText('3 szem');
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
  await expect(page.locator('#status')).toContainText('3 szem kijelölve');

  await page.getByRole('button', { name: 'Másolás' }).click();
  await expect(page.locator('#status')).toContainText('3 szem másolva');

  // Undo takes the copies back, so nothing that was selected is left.
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 szem kijelölve');
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
  await expect(page.locator('#status')).toContainText('2 szem');

  // „Új” is the type menu since PQW-1045: a choice empties that type, and undo brings it back.
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#summary')).not.toHaveText(regularBefore ?? '');
  await page.locator('#board').focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#summary')).toHaveText(regularBefore ?? '');

  await page.reload();
  const denyAgain = page.getByRole('button', { name: 'Elutasítom' });
  if (await denyAgain.isVisible()) await denyAgain.click();
  // The drawing is still in the store after the reload: picking the type empties it,
  // and one undo brings it back, as the „Új” menu promises (PQW-1045).
  await chooseIrregular(page);
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#props-count')).toContainText('Nincs kijelölt szem');
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('2 szem kijelölve');
});

test('the JSON round trip keeps the free-form chart (AS-12)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560, 620]) await place(page, x, 300);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#json-toggle').click();
  await page.getByRole('button', { name: 'JSON mentése' }).click();
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
  await expect(page.locator('#status')).toContainText('Minta betöltve');
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 szem kijelölve');
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
  await page.getByRole('button', { name: 'Másolás' }).focus();
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
  await expect(page.locator('#rows-list')).toContainText('3 szem');

  // A new row takes the opposite direction, and new stitches land in it.
  await page.locator('#row-new').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);
  await expect(page.locator('#row-direction')).toHaveValue('rtl');
  await page.locator(board).focus();
  await page.keyboard.press('Alt+1');
  for (const x of [510, 570]) await place(page, x, 340);
  await expect(page.locator('#rows-list')).toContainText('2 szem');

  await page.locator('#row-color').fill('#b07cc6');
  await page.locator('#row-color').dispatchEvent('change');
  // The rarer row actions are behind the list's „⋯” button (interface.md §59).
  await page.locator('#rows-more-toggle').click();
  await page.locator('#row-select').click();
  await expect(page.locator('#status')).toContainText('2 szem kijelölve');
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
  await expect(page.locator('#status')).toContainText('2 szem kijelölve');

  await page.locator('#layer-new').click();
  await expect(page.locator('#layers-list li')).toHaveCount(2);
  await page.locator('#layer-move-items').click();
  await expect(page.locator('#status')).toContainText('2 szem áthelyezve');

  // A hidden layer's stitches cannot be selected, though they are still in the pattern.
  await page.locator('#layers-list li').first().getByRole('button', { name: 'Látható' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#props-count')).toContainText('Nincs kijelölt szem');
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
  expect(grid.size, 'a rács mérete a beírt érték').toBe(25);
  expect(snap, 'az illesztés be van kapcsolva').toBe(true);
  expect(grid.visible, 'a rács látszik').toBe(true);
  expect(items, 'három szem került le').toHaveLength(3);
  for (const item of items) {
    // A negative multiple gives -0, which is not `0` to a strict comparison.
    expect(Math.abs(item.x % 25), 'a szem a rács vonalára került vízszintesen').toBe(0);
    expect(Math.abs(item.y % 25), 'a szem a rács vonalára került függőlegesen').toBe(0);
  }
});

test('the circle guide turns the new stitches away from its middle (AS-6 előkészítése)', async ({ page }) => {
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
  expect(polar.visible, 'a körrács látszik').toBe(true);
  expect(items, 'négy szem került le').toHaveLength(4);

  const turns = items.map((item) => {
    const wanted = (Math.atan2(item.x - polar.center.x, polar.center.y - item.y) * 180) / Math.PI;
    return Math.abs(((item.rotation - wanted + 540) % 360) - 180);
  });
  for (const gap of turns) {
    expect(gap, 'a szem teteje a középponttól kifelé néz').toBeLessThan(0.01);
  }
  expect(new Set(items.map((item) => Math.round(item.rotation))).size, 'a négy irány négyféle elfordulás').toBe(4);
});

test('⌘ a húzáson az illesztést kapcsolja ki, nem a kijelölést bontja meg', async ({ page }) => {
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
  await expect(page.locator('#props-count'), 'a kijelölés együtt marad').toContainText('1');
  const free = (await stored(page)).items[0];
  if (free === undefined) throw new Error('no stitch');
  expect(free.x - first.x, 'pont annyit mozdult, amennyit húztam').toBeCloseTo(37, 6);
  expect(free.y - first.y, 'pont annyit mozdult, amennyit húztam').toBeCloseTo(23, 6);

  // The same drag without the key lands on the grid.
  await drag(free, 11, 7, false);
  const snapped = (await stored(page)).items[0];
  if (snapped === undefined) throw new Error('no stitch');
  expect(Math.abs(snapped.x % 20), 'billentyű nélkül a rácsra ugrik').toBe(0);
  expect(Math.abs(snapped.y % 20), 'billentyű nélkül a rácsra ugrik').toBe(0);
});

test('⌘ a lerakásnál is kikapcsolja az illesztést, nem csak húzásnál (PQW-975)', async ({ page }) => {
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
  expect(Math.abs(snapped.x % 25), 'illesztéssel a rácsra ül').toBe(0);
  expect(Math.abs(snapped.y % 25), 'illesztéssel a rácsra ül').toBe(0);

  // With the key held it lands exactly where the pointer was — the owner's case.
  await page.locator(board).click({ position: { x: 483 + 63, y: 257 + 41 }, modifiers: ['Meta'] });
  const free = (await where())[2];
  if (free === undefined) throw new Error('no third stitch');
  expect(free.x + view.x, 'pont oda került, ahol a mutató volt').toBeCloseTo(483 + 63, 6);
  expect(free.y + view.y, 'pont oda került, ahol a mutató volt').toBeCloseTo(257 + 41, 6);
  expect(Math.abs(free.x % 25) > 0.001 || Math.abs(free.y % 25) > 0.001, 'és nem a rácson ül').toBe(true);
});

test('⌘ + kattintás húzás nélkül továbbra is kivesz egy szemet a kijelölésből', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [480, 560, 640]) await place(page, x, 300);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+a');
  await expect(page.locator('#props-count')).toContainText('3');

  await page.locator(board).click({ position: { x: 560, y: 300 }, modifiers: ['Meta'] });
  await expect(page.locator('#props-count'), 'a középső kikerült').toContainText('2');
});

test('láncív: rajzolás húzással, majd N átállítása 7-re (AS-3)', async ({ page }) => {
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
  await expect(arcTool).toHaveAttribute('data-tip', /Ív húzása/);
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
  expect(drawn.count, 'öt szemmel indul').toBe(5);
  expect(drawn.items, 'és öt szem került a rajzlapra').toBe(5);
  expect(drawn.shape, 'ív, nem egyenes').toBe('arc');
  await expect(page.locator('#status')).toContainText('2. sor');

  // The whole arc is selected right after drawing, so a digit sets its count.
  await expect(page.locator('#props-count')).toContainText('5');
  await expect(page.locator('#props-arc')).toBeVisible();
  await page.locator(board).focus();
  await page.keyboard.press('7');

  const grown = await arc();
  expect(grown.count, 'hét szem').toBe(7);
  expect(grown.members, 'és a csoport is hetet sorol fel').toBe(7);
  expect(grown.items, 'a rajzlapon is hét van').toBe(7);
  await expect(page.locator('#arc-count')).toHaveValue('7');

  // Digits typed one after the other build one number, so 1 then 2 is twelve.
  await page.waitForTimeout(1100);
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  await expect(page.locator('#arc-count'), 'egymás után ütött számjegyek egy számot adnak').toHaveValue('12');
  await page.waitForTimeout(1100);
  await page.keyboard.press('7');
  await expect(page.locator('#arc-count'), 'szünet után új szám kezdődik').toHaveValue('7');

  // The stitches follow the arc: the middle one sits higher than the two ends.
  const heights = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).map((item: { y: number }) => item.y);
  });
  const first = heights[0] ?? 0;
  const middle = heights[3] ?? 0;
  const last = heights[6] ?? 0;
  expect(middle, 'a közepe feljebb domborodik').toBeLessThan(first);
  expect(Math.abs(first - last), 'a két vége egy magasságban van').toBeLessThan(0.001);

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
  expect(dragged.count, 'a végpont húzása nem bontotta szét az ívet').toBe(7);
  const moved = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).groups ?? [])[0].end;
  });
  expect(moved.x, 'hanem a végpontot vitte').toBeCloseTo(ends.end.x + 60, 6);
  expect(moved.y, 'hanem a végpontot vitte').toBeCloseTo(ends.end.y + 40, 6);

  // Breaking it apart keeps every stitch and forgets only the recipe.
  await page.locator('#arc-explode').click();
  const gone = await arc();
  expect(gone.items, 'a hét szem megmarad').toBe(7);
  expect(gone.count, 'de a csoport eltűnt').toBe(0);
});

test('legyező: szétnyíló rajzolás, N átállítása, összefutóra váltás (AS-6, AS-7)', async ({ page }) => {
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
  expect(drawn.kind, 'legyező készült').toBe('fan');
  expect(drawn.count, 'öt szemmel indul').toBe(5);
  expect(drawn.spread, '120 fokos szétnyílással').toBe(120);
  expect(drawn.items, 'és öt szem került a rajzlapra').toBe(5);
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
  expect((await fan()).count, 'hét szemre állt').toBe(7);

  await page.locator('#fan-mode').selectOption('converge');
  const converged = await fan();
  expect(converged.mode, 'összefutóvá vált').toBe('converge');
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
    expect(Math.abs(point.x - meeting.x), 'a csúcsok egy pontban találkoznak').toBeLessThan(0.001);
    expect(Math.abs(point.y - meeting.y), 'a csúcsok egy pontban találkoznak').toBeLessThan(0.001);
  }

  // Arming the palette must lay the fan tool down, or every click draws a fan.
  await expect(fanTool, 'az eszköz a rajzolás után is fel van véve').toHaveAttribute('aria-pressed', 'true');
  await armDoubleCrochet(page);
  await expect(fanTool, 'a paletta leteszi a legyező eszközt').toHaveAttribute('aria-pressed', 'false');
  await place(page, 300, 250);
  expect((await fan()).items, 'a kattintás egy szemet rakott le, nem egy legyezőt').toBe(8);
  await page.keyboard.press('Escape');
  await page.locator(board).click({ position: { x: 500, y: 460 } });

  await page.locator('#fan-explode').click();
  expect((await fan()).kind, 'szétbontva már nincs csoport').toBe('');
  expect((await fan()).items, 'de a hét szem és a külön lerakott megmarad').toBe(8);
});

test('elrendezés: körvonalra, a sor megjegyzi az alakot, Egyenletessé tesz zárja a rést (AS-17, AS-18)', async ({
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
  expect(arranged.line, 'a sor megjegyezte a kört sorvonalként').toBe('circle');
  expect(arranged.items, 'mind a nyolc szem megvan').toBe(8);
  await expect(page.locator('#rowline-row'), 'megjelent a sorvonal megszüntetése').toBeVisible();

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
    expect(Math.abs(off), 'a szem alappontja a körvonalon ül').toBeLessThan(0.001);
  }

  // Delete one stitch where it sits now, then Even out closes the gap.
  const middle = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? [])[3] as { x: number; y: number };
  });
  await page.locator(board).click({ position: { x: middle.x + view.x, y: middle.y + view.y } });
  await expect(page.locator('#props-count')).toContainText('1');
  await page.keyboard.press('Delete');
  expect((await state()).items, 'hét maradt').toBe(7);

  await page.keyboard.press('ControlOrMeta+A');
  await page.locator('#arrange-even').click();
  for (const off of await spread()) {
    expect(Math.abs(off), 'a maradék szemek is a körvonalon ülnek').toBeLessThan(0.001);
  }
  expect((await state()).radius, 'ugyanazon a körön').toBe(arranged.radius);

  await page.locator('#rowline-clear').click();
  expect((await state()).line, 'a sorvonal megszűnt').toBe(null);
  expect((await state()).items, 'a szemek a helyükön maradtak').toBe(7);
});

test('a sorvonal fogantyúval átalakítható, a szemek csak az Egyenletessé teszre követik', async ({ page }) => {
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
  expect(reshaped.line.end.y - before.line.end.y, 'a vonal vége lejjebb került').toBeGreaterThan(70);
  expect(reshaped.ys, 'a szemek még nem mozdultak').toEqual(before.ys);

  await page.locator('#arrange-even').click();
  const evened = await read();
  expect(evened.ys, 'az Egyenletessé tesz viszi rá őket').not.toEqual(before.ys);
  expect(evened.ys[3], 'az utolsó szem a vonal új végén').toBeGreaterThan(before.ys[3]);
});

test('export: SVG és PNG a szabálytalan típusból (AS-13, PQW-1047)', async ({ page }) => {
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
  await page.locator('#rows-list li').nth(1).getByRole('button', { name: 'Látható' }).click();

  const svgDownload = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('svg');
  await page.locator('#export-run').click();
  const svg = await readFile((await (await svgDownload).path()) ?? '', 'utf8');
  expect(svg.startsWith('<svg'), 'vektoros SVG készült').toBe(true);
  // The hidden row's stitch must leave no geometry behind, not merely be invisible.
  const drawn = (svg.match(/<(path|ellipse|circle|line)\b/g) ?? []).length;
  expect(drawn, 'a látható szemek benne vannak').toBeGreaterThan(0);
  const everything = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).length;
  });
  expect(everything, 'a mintában öt szem van, egy a rejtett sorban').toBe(5);
  await page.locator('#rows-list li').nth(1).getByRole('button', { name: 'Látható' }).click();
  const shownAgain = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('svg');
  await page.locator('#export-run').click();
  const all = await readFile((await (await shownAgain).path()) ?? '', 'utf8');
  const drawnAll = (all.match(/<(path|ellipse|circle|line)\b/g) ?? []).length;
  expect(drawnAll, 'a sor visszakapcsolva több alakzat kerül a fájlba').toBeGreaterThan(drawn);
  await page.locator('#rows-list li').nth(1).getByRole('button', { name: 'Látható' }).click();

  const pngDownload = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('png');
  await page.locator('#export-run').click();
  const png = await (await pngDownload).path();
  expect(png, 'PNG is készült').toBeTruthy();
  // The dialog's opener is in a closed menu, so the focus returns to the menu's button.
  await expect(page.locator('#file-toggle')).toBeFocused();

  // PQW-1047: the PDF export is gone; the owner asked for the picture formats only.
});

test('feliratok: sorszámok követik a sort, és nem számítanak szemnek (AS-9)', async ({ page }) => {
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
  expect(made.labels, 'soronként egy sorszám').toHaveLength(2);
  expect(made.labels[0].text, 'az első sor balról jobbra megy').toContain('1');
  expect(made.labels[0].text, 'és viszi az iránynyilat').toContain('→');

  // An annotation is never a stitch: the row counts must not have moved.
  expect(made.counts[0], 'az első sor továbbra is három szem').toContain('3');
  expect(made.counts[1], 'a második is').toContain('3');

  // Turning the row the other way turns the label's arrow with it.
  await page.locator('#rows-list li').first().locator('.rows__pick').click();
  await page.locator('#row-direction').selectOption('rtl');
  const turned = await read();
  const first = turned.labels.find((label) => label.row === made.labels[0].row);
  expect(first?.text, 'a nyíl megfordult').toContain('←');

  // A second press adds nothing: every row already has one.
  await page.locator('#notes-toggle').click();
  await page.locator('#notes-numbers').click();
  expect((await read()).labels, 'nem duplázódik').toHaveLength(2);

  // The numbers go into the export too, not only onto the canvas — into the SVG,
  // now that the PDF is gone (PQW-1047).
  const svgDownload = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.locator('#export-format').selectOption('svg');
  await page.locator('#export-run').click();
  const svg = await readFile((await (await svgDownload).path()) ?? '', 'utf8');
  expect((svg.match(/<text/g) ?? []).length, 'a sorszámok szövegként az SVG-ben vannak').toBeGreaterThan(1);
});

test('felirat és nyíl: lerakás, szöveg és betűméret (FR-ANN-5, FR-ANN-6)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

  await page.locator('#notes-toggle').click();
  await page.locator('[data-action="note-text"]').click();
  await page.locator(board).click({ position: { x: 520, y: 320 } });
  await expect(page.locator('#props-note'), 'megjelenik a felirat blokkja').toBeVisible();
  await expect(page.locator('#note-text'), 'és a szövegmező kapja a fókuszt').toBeFocused();
  await page.locator('#note-text').fill('Ismételd 6×');
  await page.locator('#note-text').blur();

  const notes = async (): Promise<{ note: string; text: string; fontSize: number }[]> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      return (JSON.parse(raw).items ?? []).filter((item: { kind: string }) => item.kind === 'annotation');
    });

  const written = await notes();
  expect(written, 'egy felirat').toHaveLength(1);
  expect(written[0].text, 'a beírt szöveggel').toBe('Ismételd 6×');

  await page.locator('#note-size').fill('28');
  await page.locator('#note-size').blur();
  expect((await notes())[0].fontSize, 'a betűméret állítható').toBe(28);

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
  expect(both, 'felirat és nyíl').toHaveLength(2);
  expect(both[1].note, 'a második nyíl').toBe('arrow');

  // Neither of them is a stitch.
  await expect(page.locator('#rows-list li').first(), 'a sor szemszáma nulla maradt').toContainText('0');
});

test('teljesítmény: ezer szem is kezelhető marad, és a mentés kivárja a kezet (FR-PERF)', async ({ page }) => {
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
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
  await expect(page.locator(board)).toBeVisible();
  await expect(page.locator('#rows-list li').first(), 'ezer szem betöltve').toContainText('1000');

  // Really resizing is what makes the board redraw, so that is what is timed.
  const started = Date.now();
  for (let step = 0; step < 6; step += 1) {
    await page.setViewportSize({ width: 1200 + step * 40, height: 800 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  }
  expect(Date.now() - started, 'hat teljes újrarajzolás két másodpercen belül').toBeLessThan(2000);

  // Every act is written at once, so nothing is ever behind what is on screen.
  await armDoubleCrochet(page);
  await place(page, 300, 300);
  const stored = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).length;
  });
  expect(stored, 'a lerakott szem azonnal mentve').toBe(1001);
});

test('csippentés nagyít, és nem rajzol: amit az első ujj csinált, visszakerül (FR-TOUCH)', async ({ page }) => {
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

  expect(await items(), 'a csippentés nem rakott le szemet').toBe(0);

  // One finger still draws.
  await first.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: rect.x + 500, y: rect.y + 300, id: 3 }],
  });
  await first.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect(await items(), 'egy ujj viszont lerak').toBe(1);
});

test('a láncív azt rögzíti, amit az előkép mutatott, akkor is, ha a ⌘-t előbb engeded el (PQW-975)', async ({
  page,
}) => {
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
  expect(start.x + view.x, 'a kezdőpont ott maradt, ahol lenyomtad').toBeCloseTo(417, 6);
  expect(end.x + view.x, 'a végpont ott, ahol elengedted').toBeCloseTo(663, 6);
  expect(Math.abs(start.x % 20) > 0.001, 'vagyis nem ugrott a rácsra').toBe(true);
});

test('the selection block says what it is for, and the rectangle mode hangs off the area tool (PQW-1009)', async ({
  page,
}) => {
  await open(page);
  await chooseIrregular(page);

  // Since PQW-1022 the block is not there at all until something is selected.
  await expect(page.locator('#section-irregular')).toBeHidden();
  await expect(page.locator('#props-fields')).toBeHidden();

  // „Terület” is not inside a menu, so pressing it closes whatever menu is open.
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
  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
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

test('the notation and the pattern settings wait in a dialog here, and go back to the panel for rows (PQW-1011)', async ({
  page,
}) => {
  await open(page);
  const notation = page.locator('#section-notation');
  await expect(notation).toBeVisible();
  const foldedBefore = await notation.getAttribute('open');

  await chooseIrregular(page);
  await expect(notation).toBeHidden();
  await expect(page.locator('#title')).toBeHidden();

  await page.locator('#file-toggle').click();
  await page.locator('#settings-open').click();
  await expect(page.locator('#settings-dialog')).toBeVisible();
  await expect(page.locator('#ui-language')).toBeVisible();
  await page.locator('#title').fill('Csipkés terítő');
  await page.locator('#title').blur();
  await page.locator('#settings-close').click();
  await expect(page.locator('#settings-dialog')).toBeHidden();
  await expect(page.locator('#file-toggle')).toBeFocused();

  // Back in the regular type the sections are in the panel again, folded as they were.
  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#settings-open')).toBeHidden();
  await expect(notation).toBeVisible();
  expect(await notation.getAttribute('open')).toBe(foldedBefore);
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

  await expect(page.locator('#view-toggle')).toContainText('Segédrács');
  await expect(page.locator('#zoom-toggle')).toContainText('Méretezés');
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
  await expect(page.locator('#layers-list li')).toContainText('Réteg');

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
  await expect(page.locator('#section-irregular')).toContainText('Kijelölt módosítása');
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
  await expect(page.locator('#status')).toContainText('Minta betöltve');
  await page.locator('#tab-layers').click();
  await expect(page.locator('#layers-list li')).toHaveCount(1);
  await expect(page.locator('#layers-list li')).toContainText('Réteg');
});
