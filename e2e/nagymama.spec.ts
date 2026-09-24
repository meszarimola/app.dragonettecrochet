/*
 * The granny square designer (PQW-1040, PQW-1043): the app gives the grid and the
 * crocheter fills it. Every round is a ring of cells whose count she sets, a
 * stitch goes into the cell nearest where she dropped it, and the panel is the
 * rows panel without the kind and the direction.
 *
 * KB: interface.md §71
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function openGranny(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="regular"]').hover();
  await page.getByRole('menuitem', { name: /Nagymama-négyzet/ }).click();
}

async function armDoubleCrochet(page: Page): Promise<void> {
  await page.locator('#board-irregular').focus();
  await page.keyboard.press('Alt+5');
}

interface Cell {
  readonly rowId: string;
  readonly index: number;
  readonly angle: number;
  readonly x: number;
  readonly y: number;
}

/** Where the cells of the grid sit on screen (`mintatervezoSzabad`, main.ts). */
const cells = (page: Page) =>
  page.evaluate(() => (window as unknown as { mintatervezoSzabad: { cells(): Cell[] } }).mintatervezoSzabad.cells());

/** Clicks the middle of one cell; without snapping the stitch lands exactly there. */
async function placeInCell(page: Page, rowId: string, index: number): Promise<void> {
  const cell = (await cells(page)).find((candidate) => candidate.rowId === rowId && candidate.index === index);
  if (cell === undefined) throw new Error(`no cell ${rowId}/${index}`);
  await page.mouse.click(cell.x, cell.y);
}

interface Stored {
  readonly motif?: string;
  readonly grannyRadial?: boolean;
  readonly items: readonly { rowId: string; rotation: number }[];
  readonly rows: readonly { id: string; kind: string; cells?: number }[];
}

const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('dc-mintatervezo:minta-szabalytalan') ?? '{}') as Stored);

test('a new granny square is a grid of one round, and nothing is drawn into it', async ({ page }) => {
  await open(page);
  await openGranny(page);

  await expect(page.locator('#board-irregular')).toBeVisible();
  await expect(page.locator('#rows-list .rows__cells').first()).toBeFocused();
  await expect(page.locator('#rows-list .rows__cells').first()).toHaveValue('8');
  // The square grid is not the background: the round bands are (PQW-1041).
  await expect(page.locator('[data-action="grid"]')).toHaveAttribute('aria-pressed', 'false');

  const pattern = await stored(page);
  expect(pattern.motif).toBe('granny-square');
  expect(pattern.items, 'the designer draws no stitches').toHaveLength(0);
  expect(pattern.rows.map((row) => row.cells)).toEqual([8]);
});

test('the rounds panel is the rows panel without the kind and the direction (PQW-1043)', async ({ page }) => {
  await open(page);
  await openGranny(page);

  await expect(page.locator('#section-irregular-rows')).toBeVisible();
  await expect(page.locator('#irregular-tabs')).toBeHidden();
  await expect(page.locator('#section-irregular-layers')).toBeHidden();
  await expect(page.locator('#section-irregular-rows .panel__title').first()).toHaveText('Körök');

  // What a granny round has no use for.
  await expect(page.locator('#row-kind-fields')).toBeHidden();
  await expect(page.locator('#row-new')).toBeHidden();
  // The grid count is a counter in the round's own line (PQW-1044), and „Új kör” says so.
  await expect(page.locator('#rows-list .rows__cells')).toHaveCount(1);
  await expect(page.locator('#row-new-round')).toContainText('Új kör');
  await expect(page.locator('#row-radial')).toBeChecked();
  await expect(page.locator('#row-color')).toBeVisible();
  for (const id of ['#row-new-round', '#row-up', '#row-down', '#row-delete', '#rows-more-toggle']) {
    await expect(page.locator(id)).toBeVisible();
  }
});

test('each round takes the grid count set for it, and a new round follows the last', async ({ page }) => {
  await open(page);
  await openGranny(page);

  const counter = (round: number) => page.locator('#rows-list .rows__cells').nth(round - 1);
  await counter(1).fill('12');
  await counter(1).press('Tab');
  await expect.poll(async () => (await stored(page)).rows[0]?.cells).toBe(12);

  await page.locator('#row-new-round').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);
  // A new round starts from the one before it, and can be changed.
  await expect(counter(2)).toHaveValue('12');
  await counter(2).fill('20');
  await counter(2).press('Tab');
  await expect.poll(async () => (await stored(page)).rows.map((row) => row.cells)).toEqual([12, 20]);
  expect((await stored(page)).items, 'still nothing drawn').toHaveLength(0);
});

test('a stitch goes into the cell it was dropped on, in that cell\u2019s own round', async ({ page }) => {
  await open(page);
  await openGranny(page);
  await page.locator('#row-new-round').click();
  await armDoubleCrochet(page);

  // Cell 1 of eight is the middle of the top side; cell 0 is the top-left corner.
  await placeInCell(page, 'r1', 1);
  await placeInCell(page, 'r2', 1);

  const pattern = await stored(page);
  expect(pattern.items).toHaveLength(2);
  expect(pattern.items.map((item) => item.rowId)).toEqual(['r1', 'r2']);
  // Both face straight up, away from the middle.
  expect(pattern.items.map((item) => item.rotation)).toEqual([0, 0]);
  await expect(page.locator('#rows-list li').nth(0)).toContainText('1 szem');
  await expect(page.locator('#rows-list li').nth(1)).toContainText('1 szem');
});

test('a stitch goes exactly where it was dropped, still facing outwards (PQW-1044)', async ({ page }) => {
  await open(page);
  await openGranny(page);
  await armDoubleCrochet(page);

  // Between two cells, where nothing is pre-drawn: the stitch stays put.
  const [first, second] = await cells(page);
  if (first === undefined || second === undefined) throw new Error('no cells');
  await page.mouse.click((first.x + second.x) / 2, (first.y + second.y) / 2);
  const placed = (await stored(page)).items[0];
  expect(placed, 'one stitch, between two cells').toBeDefined();
  const onACell = (await cells(page)).some(
    (cell) => Math.abs(cell.x - (first.x + second.x) / 2) < 1 && Math.abs(cell.y - (first.y + second.y) / 2) < 1,
  );
  expect(onACell, 'the spot clicked is not a cell middle').toBe(false);
  // The turn is the circle guide's: away from the middle, whatever the side.
  expect(placed?.rotation).toBeGreaterThan(315);
  expect(placed?.rotation).toBeLessThan(360);
});

test('the stitches can be left upright instead of facing outwards (PQW-1042)', async ({ page }) => {
  await open(page);
  await openGranny(page);
  await armDoubleCrochet(page);

  // The first cell is the top-left corner: with the switch on it turns diagonally.
  await placeInCell(page, 'r1', 0);
  await expect.poll(async () => (await stored(page)).items[0]?.rotation).toBe(315);

  await page.locator('#row-radial').uncheck();
  await expect.poll(async () => (await stored(page)).grannyRadial).toBe(false);
  await placeInCell(page, 'r1', 4);
  const pattern = await stored(page);
  expect(pattern.items).toHaveLength(2);
  expect(pattern.items[1]?.rotation, 'placed with the turn off').toBe(0);
  expect(pattern.items[0]?.rotation, 'the one placed before is left alone').toBe(315);
});

test('a round can be removed, and the work the square replaced comes back with undo', async ({ page }) => {
  await open(page);
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="irregular"]').click();
  await armDoubleCrochet(page);
  await page.locator('#board-irregular').click({ position: { x: 500, y: 300 } });
  const before = (await stored(page)).items.length;
  expect(before).toBeGreaterThan(0);

  await openGranny(page);
  await page.locator('#row-new-round').click();
  await expect(page.locator('#rows-list li')).toHaveCount(2);
  await page.locator('#row-delete').click();
  await expect(page.locator('#rows-list li')).toHaveCount(1);

  // Three steps back: the round removed, the round added, and the square itself.
  await page.locator('#board-irregular').focus();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('ControlOrMeta+Z');
  await expect.poll(async () => (await stored(page)).items.length).toBe(before);
  await expect(page.locator('#irregular-tabs')).toBeVisible();
});

test('a granny square from v0.67-v0.69 keeps its stitches and takes its counts as the grid (PQW-1043)', async ({
  page,
}) => {
  await open(page);
  await openGranny(page);
  await armDoubleCrochet(page);
  await placeInCell(page, 'r1', 1);

  // What those versions stored: a generated round, with the count on the group.
  await page.evaluate(() => {
    const key = 'dc-mintatervezo:minta-szabalytalan';
    const raw = JSON.parse(localStorage.getItem(key) ?? '{}') as {
      rows: { id: string; cells?: number }[];
      items: { id: string; rowId: string; layerId: string }[];
      groups?: unknown[];
    };
    const first = raw.rows[0];
    const item = raw.items[0];
    if (first === undefined || item === undefined) throw new Error('nothing to convert');
    delete first.cells;
    raw.groups = [
      {
        id: 'g1',
        kind: 'grannyRound',
        rowId: first.id,
        layerId: item.layerId,
        keyEntryId: 'dc',
        center: { x: 0, y: 0 },
        inner: 0,
        count: 1,
        radial: false,
        memberIds: [item.id],
      },
    ];
    localStorage.setItem(key, JSON.stringify(raw));
  });
  await page.reload();
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="irregular"]').click();

  // The migration happens as the pattern is read, so the panel is what shows it;
  // the store keeps the old shape until the next edit.
  const counter = page.locator('#rows-list .rows__cells').first();
  await expect(counter, 'the round takes its old count as the grid count').toHaveValue('1');
  await expect(page.locator('#row-radial'), 'and the way its stitches faced').not.toBeChecked();
  await expect(page.locator('#rows-list li').nth(0), 'the stitch is kept').toContainText('1 szem');
  // Once something is edited the file is written in the new shape, with no group left.
  await counter.fill('4');
  await counter.press('Tab');
  await expect.poll(async () => (await stored(page)).rows[0]?.cells).toBe(4);
  await expect.poll(async () => (await stored(page)).items.length).toBe(1);
});
