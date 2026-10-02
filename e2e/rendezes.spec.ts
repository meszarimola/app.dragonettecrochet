/*
 * The right-hand panel (PQW-1146): empty without a selection, and with one it
 * arranges the stitches in a row, on a circle or in a fan, and a changed value
 * re-arranges them on the spot. The canvas shows the DOM nothing, so the
 * stitches are read from the chart the page hands a driven browser.
 */

import { expect, type Page, test } from '@playwright/test';

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

test('the panel is empty until something is selected, then arranges it in a row', { tag: '@kiadas' }, async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New' }).click();
  await expect(page.getByRole('complementary', { name: 'Properties' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'In a row' }), 'nothing selected, nothing offered').toBeHidden();

  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'In a row' }).click();
  const placed = (await stitches(page)).sort((a, b) => a.x - b.x);
  for (const stitch of placed) {
    expect(stitch.rotation, 'upright').toBe(0);
    expect(stitch.y, 'on one line').toBeCloseTo(placed[0]!.y, 6);
  }
  const gaps = placed.slice(1).map((stitch, i) => stitch.x - placed[i]!.x);
  for (const gap of gaps) expect(gap, 'evenly spaced').toBeCloseTo(gaps[0]!, 6);

  await board(page).click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole('button', { name: 'In a row' }), 'deselected, the panel empties').toBeHidden();
});

test('a circle stands the stitches evenly around one centre, and a new radius widens it', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'In a circle' }).click();
  const spread = async (): Promise<number[]> => {
    const placed = await stitches(page);
    const center = {
      x: placed.reduce((sum, { x }) => sum + x, 0) / placed.length,
      y: placed.reduce((sum, { y }) => sum + y, 0) / placed.length,
    };
    return placed.map(({ x, y }) => Math.hypot(x - center.x, y - center.y));
  };
  const before = await spread();
  for (const distance of before) expect(distance, 'every stitch as far from the centre').toBeCloseTo(before[0]!, 6);
  const turns = new Set((await stitches(page)).map(({ rotation }) => rotation.toFixed(3)));
  expect(turns.size, 'each stitch turned its own way, top outwards').toBe(POINTS.length);

  await page.getByRole('group', { name: 'In a circle' }).getByRole('spinbutton', { name: 'Radius' }).fill('80');
  const after = await spread();
  expect(after[0]! - before[0]!, 'the radius grew by 40').toBeCloseTo(40, 6);
});

test('a fan leans its stitches from one point, and a new angle opens it wider', async ({ page }) => {
  await selectedChartWith(page, POINTS);
  await page.getByRole('button', { name: 'In a fan' }).click();
  const outer = async (): Promise<number> => {
    const turns = (await stitches(page)).map(({ rotation }) => rotation).sort((a, b) => a - b);
    return turns.at(-1)! - turns[0]!;
  };
  expect(await outer(), 'the default 90°').toBeCloseTo(Math.PI / 2, 6);
  await page.getByRole('group', { name: 'In a fan' }).getByRole('spinbutton', { name: 'Angle (°)' }).fill('120');
  expect(await outer(), 'opened to 120°').toBeCloseTo((Math.PI * 2) / 3, 6);
});
