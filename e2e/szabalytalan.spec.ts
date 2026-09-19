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
  await page.getByRole('button', { name: /Szabálytalan horgolás/ }).click();
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
  await expect(page.locator('#section-irregular')).toBeVisible();
  // Filling a row, turning, closing and spiralling belong to regular crochet only.
  await expect(page.locator('#tools-row')).toBeHidden();

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

  await page.getByRole('button', { name: 'Duplikálás' }).click();
  await expect(page.locator('#status')).toContainText('3 szem másolva');

  // Undo takes the copies back, so nothing that was selected is left.
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('3 szem kijelölve');
});

test('the drawing survives a reload, and switching types keeps both patterns (AS-1)', async ({ page }) => {
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

  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#summary')).toHaveText(regularBefore ?? '');

  await page.reload();
  const denyAgain = page.getByRole('button', { name: 'Elutasítom' });
  if (await denyAgain.isVisible()) await denyAgain.click();
  await chooseIrregular(page);
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
  await page.getByRole('button', { name: 'JSON mentése' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const saved = await readFile((await download.path()) ?? '', 'utf8');
  const parsed = JSON.parse(saved);
  expect(parsed.type).toBe('irregular');
  expect(parsed.items).toHaveLength(3);

  // An empty pattern says nothing about a selection, so the note is blank.
  await page.getByRole('button', { name: 'Új minta' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#props-count')).toHaveText('');

  await page.locator('#file-toggle').click();
  await page.locator('#import-file').setInputFiles({
    name: 'szabalytalan.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved, 'utf8'),
  });
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
  const before = await page.locator('#summary').textContent();

  await chooseIrregular(page);
  await page.locator(board).focus();
  // Filling, turning, closing, spiralling and crocheting all belong to rows.
  for (const key of ['Alt+f', 'Shift+Alt+f', 'Alt+k', 'Alt+s', 'Enter', 'Enter']) {
    await page.keyboard.press(key);
  }
  // Delete with a toolbar button focused used to delete the regular pattern's last stitch.
  await page.getByRole('button', { name: 'Duplikálás' }).focus();
  await page.keyboard.press('Delete');
  await page.keyboard.press('Backspace');

  await page.getByRole('button', { name: /Szabályos horgolás/ }).click();
  await expect(page.locator('#summary')).toHaveText(before ?? '');
});

test('rows and rounds: a second row, its own colour, and the stitch order overlay (AS-16)', async ({ page }) => {
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

  // The order runs right to left in this row, so the leftmost stitch is the second.
  await page.locator('#row-order-overlay').check();
  await expect(page.locator('#row-order-overlay')).toBeChecked();

  await page.locator('#row-color').fill('#b07cc6');
  await page.locator('#row-color').dispatchEvent('change');
  await page.locator('#row-select').click();
  await expect(page.locator('#status')).toContainText('2 szem kijelölve');
});

test('the stitch key changes the symbol everywhere, and the legend can go on the image (AS-4)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await page.locator(board).focus();
  await page.keyboard.press('Alt+1');
  for (const x of [500, 560, 620]) await place(page, x, 400);

  await page.locator('#section-irregular-key > summary').click();
  const chain = page.locator('#key-list li').filter({ hasText: 'láncszem' });
  await expect(chain).toHaveCount(1);
  await expect(chain).toContainText('3');

  // The pattern may draw a chain with any symbol it likes; the reference charts use „0”.
  // The chain's oval lies flat and the „0” stands upright, so the drawn stitches
  // have to turn with it — the symbol must not be squeezed into the old one's box.
  const widthOf = async (): Promise<number[]> =>
    page.evaluate(() => {
      const saved = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const items = (JSON.parse(saved).items ?? []) as { width: number; height: number }[];
      return items.map((item) => item.width / item.height);
    });
  const flat = await widthOf();
  expect(flat.every((ratio) => ratio > 1)).toBe(true);

  await chain.locator('select').selectOption('zero');
  await expect(chain.locator('select')).toHaveValue('zero');
  const upright = await widthOf();
  expect(upright).toHaveLength(flat.length);
  expect(upright.every((ratio) => ratio < 1)).toBe(true);

  await page.locator('#legend-on-image').check();
  await expect(page.locator('#legend-on-image')).toBeChecked();

  // The key survives a save and a reload.
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.getByRole('button', { name: 'JSON mentése' }).click();
  const saved = await readFile((await (await downloadPromise).path()) ?? '', 'utf8');
  const parsed = JSON.parse(saved);
  expect(parsed.stitchKey).toHaveLength(1);
  expect(parsed.stitchKey[0].glyphOverride).toBe('zero');
  expect(parsed.legend.visible).toBe(true);
});

test('layers: a second layer takes the selected stitches, and hiding it hides them', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [500, 560]) await place(page, x, 400);

  await page.locator('#section-irregular-layers > summary').click();
  await expect(page.locator('#layers-list li')).toHaveCount(2);

  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#status')).toContainText('2 szem kijelölve');

  await page.locator('#layer-new').click();
  await expect(page.locator('#layers-list li')).toHaveCount(3);
  await page.locator('#layer-move-items').click();
  await expect(page.locator('#status')).toContainText('2 szem áthelyezve');

  // A hidden layer's stitches cannot be selected, though they are still in the pattern.
  await page.locator('#layers-list li').first().getByRole('button', { name: 'Látható' }).click();
  await page.locator(board).focus();
  await page.keyboard.press('ControlOrMeta+A');
  await expect(page.locator('#props-count')).toContainText('Nincs kijelölt szem');
});

test('two stitches drawn with one symbol are reported in the issues list (AS-5)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

  // A chain and a slip stitch, then the chain redrawn as a dot — the slip stitch's own symbol.
  await page.locator(board).focus();
  await page.keyboard.press('Alt+1');
  await place(page, 500, 400);
  await page.keyboard.press('Alt+2');
  await place(page, 560, 400);

  await page.locator('#section-irregular-key > summary').click();
  await page.locator('#key-list li').filter({ hasText: 'láncszem' }).locator('select').selectOption('dot');
  await expect(page.locator('#key-preset')).toContainText('Saját');

  await page.locator('#error-toggle').click();
  await expect(page.locator('#findings')).toContainText('Ugyanaz a jel két szemet jelöl');
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

  await page.locator('#guide-grid-size').fill('20');
  await page.locator('#guide-grid-size').blur();
  await page.locator('[data-action="grid"]').click();
  await page.locator('#guide-snap').check();

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

  // Row 2 is the active one, so the arc has to land there.
  await page.locator('#row-new').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);

  // The free-form tool group is hidden in the other types, so its tooltip is checked here.
  const arcTool = page.locator('[data-action="chain-arc"]');
  await expect(arcTool).toBeVisible();
  await expect(arcTool).toHaveAttribute('data-tip', /Láncív/);
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
  await place(page, 260, 250);
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

  await page.locator('#arrange-even').click();
  for (const off of await spread()) {
    expect(Math.abs(off), 'a maradék szemek is a körvonalon ülnek').toBeLessThan(0.001);
  }
  expect((await state()).radius, 'ugyanazon a körön').toBe(arranged.radius);

  await page.locator('#rowline-clear').click();
  expect((await state()).line, 'a sorvonal megszűnt').toBe(null);
  expect((await state()).items, 'a szemek a helyükön maradtak').toBe(7);
});

test('kiemelés: csak a kijelölt szemek érhetők el, Esc kilép (AS-20)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await armDoubleCrochet(page);
  for (const x of [420, 500, 580, 660]) await place(page, x, 380);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');

  // Isolate the middle two.
  await page.locator(board).click({ position: { x: 500, y: 380 } });
  await page.locator(board).click({ position: { x: 580, y: 380 }, modifiers: ['Shift'] });
  await expect(page.locator('#props-count')).toContainText('2');

  const isolate = page.locator('[data-action="isolate"]');
  await isolate.click();
  await expect(isolate).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#status')).toContainText('kiemelve');

  // A stitch outside the isolation cannot be selected any more.
  await page.locator(board).click({ position: { x: 420, y: 380 } });
  await expect(page.locator('#props-count'), 'a kiemelésen kívüli szem nem jelölhető ki').toContainText(
    'Nincs kijelölt szem',
  );

  // Nor can a marquee reach it: the rectangle sweeps across all four stitches.
  const rect = await page.locator(board).boundingBox();
  if (rect === null) throw new Error('no board');
  await page.mouse.move(rect.x + 380, rect.y + 320);
  await page.mouse.down();
  await page.mouse.move(rect.x + 700, rect.y + 440, { steps: 10 });
  await page.mouse.up();
  await expect(page.locator('#props-count'), 'a téglalap is csak a kiemeltekre hat').toContainText('2');

  // Select all must not reach outside the cage either, or Delete would empty the chart.
  await page.locator(board).focus();
  await page.keyboard.press('Control+a');
  await expect(page.locator('#props-count'), 'a mindent kijelölés is csak a kiemeltekre hat').toContainText('2');
  await page.keyboard.press('Delete');
  const left = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    return (JSON.parse(raw).items ?? []).length;
  });
  expect(left, 'a kiemelésen kívüli két szem megmaradt').toBe(2);
  await expect(isolate, 'a kiemelés véget ért, mert nem maradt benne semmi').toHaveAttribute('aria-pressed', 'false');

  await page.locator(board).click({ position: { x: 420, y: 380 } });
  await expect(page.locator('#props-count'), 'és a maradék újra elérhető').toContainText('1');
  await page.keyboard.press('Control+z');

  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await expect(isolate, 'az Esc kilép a kiemelésből').toHaveAttribute('aria-pressed', 'false');
  await page.locator(board).click({ position: { x: 420, y: 380 } });
  await expect(page.locator('#props-count'), 'utána újra elérhető az egész minta').toContainText('1');
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

test('körkörös ismétlés: nyolc szektor a körrács közepe körül (AS-8)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await page.locator('#guide-polar').check();
  await armDoubleCrochet(page);
  await place(page, 560, 260);
  await page.locator(board).focus();
  await page.keyboard.press('Escape');
  await page.locator(board).click({ position: { x: 560, y: 260 } });
  await expect(page.locator('#props-count')).toContainText('1');
  await expect(page.locator('#props-repeat')).toBeVisible();

  await page.locator('#repeat-count').fill('8');
  await page.locator('#repeat-count').blur();
  await page.locator('#repeat-run').click();

  const state = async (): Promise<{ count: number; radii: number[]; angles: number[] }> =>
    page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      const parsed = JSON.parse(raw);
      const middle = parsed.guides.polar.center;
      const items = parsed.items ?? [];
      return {
        count: items.length,
        radii: items.map((item: { x: number; y: number }) => Math.hypot(item.x - middle.x, item.y - middle.y)),
        angles: items
          .map((item: { x: number; y: number }) => {
            const raw = (Math.atan2(item.x - middle.x, middle.y - item.y) * 180) / Math.PI;
            return (raw + 360) % 360;
          })
          .sort((a: number, b: number) => a - b),
      };
    });

  const made = await state();
  expect(made.count, 'nyolc darab, az eredetivel együtt').toBe(8);
  for (const radius of made.radii) {
    expect(Math.abs(radius - made.radii[0]), 'mind ugyanolyan messze a középponttól').toBeLessThan(0.001);
  }
  for (let i = 1; i < made.angles.length; i += 1) {
    expect(made.angles[i] - made.angles[i - 1], 'negyvenöt fokonként').toBeCloseTo(45, 3);
  }

  // One undo step takes the whole ring back.
  await page.locator(board).focus();
  await page.keyboard.press('Control+z');
  expect((await state()).count, 'egyetlen visszavonás viszi vissza az egészet').toBe(1);
});

test('saját szem: hozzáadás a jelkulcshoz, majd lerakás (FR-KEY-4)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);
  await page.locator('#section-irregular-key > summary').click();

  await page.locator('#key-custom-name').fill('Bogyó');
  await page.locator('#key-custom-abbr').fill('bgy');
  await page.locator('#key-custom-glyph').selectOption('asterisk');
  await page.locator('#key-custom-add').click();
  await expect(page.locator('#status')).toContainText('Bogyó');

  // The new stitch is armed, so a click on the canvas places it.
  await page.locator(board).click({ position: { x: 520, y: 380 } });
  const placed = await page.evaluate(() => {
    const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
    const parsed = JSON.parse(raw);
    return {
      items: (parsed.items ?? []).length,
      keyEntryId: (parsed.items ?? [])[0]?.keyEntryId ?? '',
      key: (parsed.stitchKey ?? []).map((entry: { customName: string; glyphOverride: string }) => ({
        name: entry.customName,
        glyph: entry.glyphOverride,
      })),
    };
  });
  expect(placed.items, 'egy szem lekerült').toBe(1);
  expect(placed.key, 'a jelkulcsban ott a saját szem').toContainEqual({ name: 'Bogyó', glyph: 'asterisk' });
  expect(placed.keyEntryId, 'és a lerakott szem arra hivatkozik').toBe(
    (await page.evaluate(() => {
      const raw = localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}';
      return (JSON.parse(raw).stitchKey ?? [])[0]?.id ?? '';
    })) as string,
  );

  // It shows up in the legend list with its own name.
  await expect(page.locator('#key-list li').filter({ hasText: 'Bogyó' })).toHaveCount(1);
});

test('export: SVG, PNG és PDF a szabálytalan típusból (AS-13)', async ({ page }) => {
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
  await page.locator('[data-action="export-svg"]').click();
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
  await page.locator('[data-action="export-svg"]').click();
  const all = await readFile((await (await shownAgain).path()) ?? '', 'utf8');
  const drawnAll = (all.match(/<(path|ellipse|circle|line)\b/g) ?? []).length;
  expect(drawnAll, 'a sor visszakapcsolva több alakzat kerül a fájlba').toBeGreaterThan(drawn);
  await page.locator('#rows-list li').nth(1).getByRole('button', { name: 'Látható' }).click();

  const pngDownload = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('[data-action="export-png"]').click();
  const png = await (await pngDownload).path();
  expect(png, 'PNG is készült').toBeTruthy();

  // PDF over four pages, from the panel.
  await page.locator('#export-across').fill('2');
  await page.locator('#export-across').blur();
  await page.locator('#export-down').fill('2');
  await page.locator('#export-down').blur();
  const pdfDownload = page.waitForEvent('download');
  await page.locator('#export-pdf').click();
  const pdfPath = (await (await pdfDownload).path()) ?? '';
  const pdf = await readFile(pdfPath);
  expect(pdf.subarray(0, 8).toString('latin1'), 'valódi PDF fejléc').toBe('%PDF-1.4');
  expect(pdf.subarray(-6).toString('latin1').trim(), 'és rendes vége').toBe('%%EOF');
  expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length, 'négy lapon').toBe(4);
  await expect(page.locator('#status')).toContainText('4');
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
  await page.locator('#notes-numbers').click();
  expect((await read()).labels, 'nem duplázódik').toHaveLength(2);

  // The numbers go into the print too, not only into the picture.
  const pdfDownload = page.waitForEvent('download');
  await page.locator('#export-pdf').click();
  const pdf = await readFile((await (await pdfDownload).path()) ?? '');
  const inside = pdf.toString('latin1');
  expect((inside.match(/Tj/g) ?? []).length, 'a sorszámok szövegként a PDF-ben vannak').toBeGreaterThan(2);
});

test('felirat és nyíl: lerakás, szöveg és betűméret (FR-ANN-5, FR-ANN-6)', async ({ page }) => {
  await open(page);
  await chooseIrregular(page);

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
