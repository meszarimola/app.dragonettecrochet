/*
 * The arrow of the cursor, the row labels and the status text on the chart
 * (PQW-916).
 *
 * All three points were reproduced live by the owner: after 12 chain stitches
 * and one turn the arrow runs across the stitches, there is no numbering beside
 * the rows, and a status text floats over the canvas.
 *
 * The lesson from PQW-912: overlap has to be MEASURED, not eyeballed — that was
 * exactly what was missing there, and the same bug slipped through three times
 * because of it. So these tests ask the browser hook of the interface
 * (`window.mintatervezoRacs`, src/ui/main.ts) for the boxes of the arrow, the
 * stitches and the labels, and compute intersections.
 */

import { expect, type Page, test } from '@playwright/test';

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

type LabelBox = Rect & { readonly layer: number; readonly text: string };
type StitchBox = Rect & { readonly id: string; readonly layer: number };

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
  // The written pattern panel starts closed (PQW-911, PQW-915): it does not cover the canvas.
  await expect(page.locator('#written')).toBeHidden();
}

/**
 * The case from the ticket: 12 chain stitches, a turn, then the first stitches
 * of row 1 — from the keyboard only (PQW-911).
 *
 * A turn on its own does not yet bring a direction arrow: row 1 is not in the
 * graph at that point, and `directionArrow()` (src/ui/main.ts) only draws when
 * the row has a stitch. I measured it: after the chain and the turn the box of
 * the arrow is `null`, and it appears after the first half double crochet — that
 * is why the setup lays down stitches too.
 */
async function foundationTurnAndRow(page: Page): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');
  await page.keyboard.press('Alt+4');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Enter');
}

const api = <T>(page: Page, method: 'arrowBox' | 'stitchBoxes' | 'labelBoxes'): Promise<T> =>
  page.evaluate((name) => {
    const hook = (window as unknown as Record<string, Record<string, () => unknown>>).mintatervezoRacs!;
    return hook[name]!() as never;
  }, method);

/** Whether two boxes intersect. A half-pixel touch is not yet covering. */
function overlaps(a: Rect, b: Rect): boolean {
  return (
    Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5
  );
}

const describe = (r: Rect) =>
  `[${r.left.toFixed(1)}, ${r.top.toFixed(1)} – ${r.right.toFixed(1)}, ${r.bottom.toFixed(1)}]`;

/*
 * The arrow moved from the chart into the band of the row numbers (PQW-929). The
 * solution of PQW-916 lifted it above the symbols of the row, but it landed
 * right in the grid band and the rectangle of the NEXT row; the decision of the
 * owner: „mellé tedd, ne rá. és írd ki, hogy hanyadik sor.” The measurement
 * therefore no longer looks for the arrow on the chart but among the labels —
 * and it also checks that the label covers nothing.
 */
test('the label of the next row stands beside the chart, with an arrow, and covers nothing (PQW-929)', async ({
  page,
}) => {
  await open(page);

  // 12 chain stitches, then a turn: row 2 is open, but still empty.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');

  expect(await api<Rect | null>(page, 'arrowBox'), 'there is no direction arrow on the chart any more').toBeNull();

  const labels = await api<LabelBox[]>(page, 'labelBoxes');
  const next = labels.find((label) => /[←→]/.test(label.text));
  expect(next, `the label of the next row, with an arrow: ${labels.map((l) => l.text).join(' | ')}`).toBeDefined();
  expect(next!.text, 'it says which row comes next').toMatch(/2\. sor/);

  const stitches = await api<StitchBox[]>(page, 'stitchBoxes');
  for (const stitch of stitches) {
    expect(overlaps(next!, stitch), `the label ${describe(next!)} covers stitch ${stitch.id} ${describe(stitch)}`).toBe(
      false,
    );
  }
  // It does not slide onto the row labels either: it does not overlap the label of the foundation chain.
  for (const other of labels.filter((label) => label !== next)) {
    expect(overlaps(next!, other), `the label of the next row covers this one: „${other.text}”`).toBe(false);
  }
});

test('beside every row there is the row number and the stitch count, without covering anything (PQW-916)', async ({
  page,
}) => {
  await open(page);
  await foundationTurnAndRow(page);

  const labels = await api<LabelBox[]>(page, 'labelBoxes');
  const stitches = await api<StitchBox[]>(page, 'stitchBoxes');
  const arrow = await api<Rect | null>(page, 'arrowBox');

  /*
   * Since PQW-923 the foundation chain is row 1 itself, with its stitch count.
   * The number is that of the chain stitch symbols on the chart: after a turn two
   * of them move into the turning chain of row 1 (the half double crochet goes
   * into the 3rd chain stitch counted from the hook), so ten of the twelve stay
   * on layer 0. The label thus agrees with the chart, and does not state some
   * other stitch count.
   */
  const foundation = labels.find((label) => label.layer === 0);
  expect(foundation, 'the foundation chain has a label too').toBeDefined();
  expect(foundation!.text, 'the foundation chain is row 1, with the chain stitches drawn').toMatch(
    /^1\. sor – alapsor \(\d+\)$/,
  );

  const row = labels.find((label) => label.layer === 1);
  expect(row, 'row 1 has a label too').toBeDefined();
  expect(row!.text, 'the row number and the stitch count on one label').toMatch(/^2\. sor \(\d+\)$/);

  /*
   * The label stands BESIDE the chart, not inside it. Box overlap is not enough
   * for this: the label of the half-finished row sat in the middle of the chart,
   * above the stitches of the earlier rows, and yet intersected not a single
   * symbol — while on the screenshot it showed at once. So here we measure
   * horizontally: every label has to be outside the band of the symbols.
   */
  const right = Math.max(...stitches.map((stitch) => stitch.right));
  const left = Math.min(...stitches.map((stitch) => stitch.left));
  const stitchesBar = (await page.locator('#section-stitches').boundingBox())!;
  const panel = (await page.locator('#panel').boundingBox())!;
  for (const label of labels) {
    // It stands beside the chart — or hugging the edge of the visible band, if it would no longer fit there.
    const besideChart = label.left >= right - 0.5 || label.right <= left + 0.5;
    const hugsEdge = label.left <= stitchesBar.x + stitchesBar.width + 8 || label.right >= panel.x - 8;
    expect(
      besideChart || hugsEdge,
      `the label „${label.text}” is squeezed in among the symbols ${describe(label)}`,
    ).toBe(true);
  }

  for (const label of labels) {
    for (const stitch of stitches) {
      expect(
        overlaps(label, stitch),
        `label ${label.layer} ${describe(label)} covers stitch ${stitch.id} ${describe(stitch)}`,
      ).toBe(false);
    }
    if (arrow) expect(overlaps(label, arrow), `label ${label.layer} covers the arrow ${describe(arrow)}`).toBe(false);
  }
});

/*
 * The fit of „Egész minta” should know about the labels too (PQW-916).
 *
 * Box overlap did not catch this: the labels were fine beside the chart, only
 * the rightmost one slid under the stitch palette panel and became unreadable.
 * It showed at once on the screenshot, but there was no measurement for it —
 * now there is.
 */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: after „Egész minta” the labels stay between the two sidebars (PQW-916)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await foundationTurnAndRow(page);
    // A narrow bar folds its view group into a menu (interface.md §56).
    if (await page.locator('#view-toggle').isVisible()) await page.locator('#view-toggle').click();
    await page.getByRole('button', { name: 'Egész minta' }).click();
    await page.waitForTimeout(200);

    const labels = await api<LabelBox[]>(page, 'labelBoxes');
    expect(labels.length, 'there is something to place').toBeGreaterThan(0);
    const stitchesBar = (await page.locator('#section-stitches').boundingBox())!;
    const panel = (await page.locator('#panel').boundingBox())!;

    for (const label of labels) {
      expect(
        label.left,
        `the label „${label.text}” slides under the stitch column ${describe(label)}`,
      ).toBeGreaterThanOrEqual(stitchesBar.x + stitchesBar.width - 0.5);
      expect(
        label.right,
        `the label „${label.text}” slides under the stitch palette panel ${describe(label)}`,
      ).toBeLessThanOrEqual(panel.x + 0.5);
    }
  });
}

/*
 * Narrow window, longer label (PQW-916).
 *
 * The English „Foundation chain (10)” is much wider than the Hungarian
 * „Láncalap (10)”, and at 1000×506 there is no longer room for it on the right
 * of the chart. The browser review measured that in that case the label slides
 * back over the symbols (n9, n10) — the earlier cases did not catch this,
 * because they measure in Hungarian and in the view after „Egész minta”. The
 * label should rather hang out than cover something.
 */
test('1000×506, English interface: even the longer label does not slide onto the stitches (PQW-916)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await page.goto('/?lang=en');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await foundationTurnAndRow(page);

  const labels = await api<LabelBox[]>(page, 'labelBoxes');
  const stitches = await api<StitchBox[]>(page, 'stitchBoxes');
  const arrow = await api<Rect | null>(page, 'arrowBox');
  expect(labels.map((label) => label.text)).toContain('Row 1 – foundation (11)');

  for (const label of labels) {
    for (const stitch of stitches) {
      expect(
        overlaps(label, stitch),
        `the label „${label.text}” ${describe(label)} covers stitch ${stitch.id} ${describe(stitch)}`,
      ).toBe(false);
    }
    if (arrow)
      expect(overlaps(label, arrow), `the label „${label.text}” covers the arrow ${describe(arrow)}`).toBe(false);
  }
});

test('there is no floating status text over the canvas area, but the live region stays (PQW-916)', async ({ page }) => {
  await open(page);
  await foundationTurnAndRow(page);

  const status = page.locator('#status');
  // The interface does give a signal: the text stays for the screen reader. (After
  // a turn this is the „Láncalap kész…” message; we do not pin down its text, only that there is one.)
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).not.toBeEmpty();

  // But it does not get over the visible chart: its box is at most the size of the hidden live region.
  const box = await status.boundingBox();
  const area = box ? box.width * box.height : 0;
  expect(
    area,
    `the status text still floats over the canvas: ${box ? describe({ left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height }) : 'it has no box'}`,
  ).toBeLessThanOrEqual(4);
});
