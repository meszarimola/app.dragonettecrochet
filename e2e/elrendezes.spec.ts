/*
 * The integrity of the layout (PQW-881). After a bad merge conflict resolution
 * half of the stylesheet did not take effect: the pattern type menu landed where
 * the canvas belongs, and the canvas slid out of the picture. These tests look
 * at where the boxes are, not at how things work.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function box(page: Page, selector: string) {
  const found = await page.locator(selector).boundingBox();
  expect(found, selector).not.toBeNull();
  return found!;
}

/** The written pattern opened: in a low window it starts closed (PQW-891), there we open it with its button. */
async function openWritten(page: Page): Promise<void> {
  const written = page.locator('#written');
  if (await written.isHidden()) await page.locator('#written-toggle').click();
  await expect(written).toBeVisible();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: sidebars, canvas and written pattern in their places`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);

    // The page itself does not scroll: everything is inside the visible area.
    const size = await page.evaluate(() => [
      document.documentElement.scrollWidth,
      document.documentElement.scrollHeight,
    ]);
    expect(size).toEqual([viewport.width, viewport.height]);

    const stage = await box(page, '.stage');
    const types = await box(page, '#types');
    const panel = await box(page, '#panel');
    const board = await box(page, '#board');

    // The pattern type menu is a narrow left sidebar, the settings a right sidebar.
    expect(types.x).toBe(stage.x);
    expect(types.width).toBeLessThan(viewport.width / 3);
    expect(types.y).toBe(stage.y);
    expect(panel.x + panel.width).toBeCloseTo(viewport.width, 0);
    expect(panel.width).toBeLessThan(viewport.width / 3);

    // The canvas fills the work area.
    expect(board.y).toBe(stage.y);
    expect(board.y + board.height).toBeLessThanOrEqual(viewport.height);

    // The opened written pattern sits between the two sidebars, not below them —
    // and it reaches both of them. A gap means --side-start or --side-end has
    // drifted from the bar it stands for, which is what happened in PQW-979.
    await openWritten(page);
    const written = await box(page, '#written');
    expect(written.x).toBeCloseTo(types.x + types.width, 0);
    expect(written.x + written.width).toBeCloseTo(panel.x, 0);

    // The version label is chrome under the list, not the tail of a clipped card:
    // its text starts clear of the list's bottom edge, which the list runs right
    // up to whenever it scrolls (PQW-979).
    const list = await box(page, '#types-list');
    const versionTextTop = await page
      .locator('#version')
      .evaluate((el) => el.getBoundingClientRect().top + parseFloat(getComputedStyle(el).paddingBlockStart));
    expect(versionTextTop).toBeGreaterThan(list.y + list.height + 8);

    // The type names are not truncated.
    const clipped = await page
      .locator('.type__name')
      .evaluateAll((names) =>
        names.filter((name) => name.scrollWidth > name.clientWidth + 1).map((name) => name.textContent),
      );
    expect(clipped).toEqual([]);
  });
}

/**
 * What the menu bar looks like, read from the document in one go: the distinct button
 * rows of each half and of the whole, the boxes, and whether the page scrolls sideways.
 * No locators, so the frozen locator inventory (PQW-978) stays put.
 */
const barShape = (page: Page) =>
  page.evaluate(() => {
    const rows = (selector: string) =>
      [
        ...new Set(
          [...document.querySelectorAll(`${selector} .tool`)]
            .filter((tool) => tool.checkVisibility())
            .map((tool) => Math.round(tool.getBoundingClientRect().top)),
        ),
      ].length;
    const rect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect() ?? null;
    const bar = rect('.bar');
    const lead = rect('.bar__lead');
    const chrome = rect('.tools__chrome');
    const endRow = rect('[data-action="end-row"]');
    return {
      rows: { chrome: rows('.tools__chrome'), context: rows('.tools__context'), tools: rows('.tools') },
      barHeight: bar?.height ?? null,
      leadBottom: lead?.bottom ?? null,
      chromeTop: chrome?.top ?? null,
      endRow: endRow && { width: endRow.width, height: endRow.height, right: endRow.right, bottom: endRow.bottom },
      page: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    };
  });

/*
 * The menu bar is chrome and context (PQW-983). The tools used to stand on a line
 * of their own under the title, so in the owner's 1000 × 506 window the bar was
 * 157 px — 31 % of the window — with the tools already wrapped into two rows. The
 * chrome (the buttons that are there in every pattern type) now shares the
 * title's line and the context has the line below it, which gives the canvas back
 * the height of a whole row. The chrome itself never wraps.
 */
for (const { rows, ...viewport } of [
  { width: 1440, height: 900, rows: 1 },
  { width: 1000, height: 506, rows: 2 },
  // The tightest window the split allows: the chrome may not wrap here, and its labels stay.
  { width: 960, height: 506, rows: 2 },
]) {
  test(`${viewport.width}×${viewport.height}: the tools stand beside the title in ${rows} row(s), and the chrome does not wrap`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const shape = await barShape(page);

    // Each half is one line of its own; together they are as many rows as the window allows.
    expect(shape.rows).toEqual({ chrome: 1, context: 1, tools: rows });

    // The title and the chrome are on the same line, so the bar is not a row taller than its tools.
    expect(shape.chromeTop).toBeLessThan(shape.leadBottom!);
    expect(shape.barHeight, 'the bar is at most a quarter of the window').toBeLessThan(viewport.height / 4);

    // A chrome that does not wrap must not push the page sideways either.
    expect(shape.page).toEqual([viewport.width, viewport.height]);

    // The context drops its labels in a narrow window, never the button itself: the „Fordulás”
    // button stays a whole target inside the window (e2e-prod/fust.spec.ts). Read by its action
    // rather than by its text, because the locator inventory is frozen.
    expect(shape.endRow!.width).toBeGreaterThanOrEqual(44);
    expect(shape.endRow!.height).toBeGreaterThanOrEqual(44);
    expect(shape.endRow!.right).toBeLessThanOrEqual(viewport.width);
    expect(shape.endRow!.bottom).toBeLessThanOrEqual(viewport.height);
  });
}

/**
 * The pattern-type list read in one go: whether the box scrolls, and for each card its
 * height and whether it hangs out of the box. No locators, so the frozen locator
 * inventory (PQW-978) stays put.
 */
const typeCards = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector('#types-list');
    if (!list) return null;
    const box = list.getBoundingClientRect();
    return {
      scrolls: list.scrollHeight > list.clientHeight,
      cards: [...list.querySelectorAll('li')].map((item) => {
        const rect = (item.querySelector('button') ?? item).getBoundingClientRect();
        return { height: rect.height, out: rect.top < box.top - 0.5 || rect.bottom > box.bottom + 0.5 };
      }),
    };
  });

/*
 * All four pattern-type cards fit in a 506 px-high window (PQW-985). The card carried
 * 0.6rem of block padding and stood 57 px tall, so four of them and the three 8 px gaps
 * wanted 252 px while the list had 221 px: it scrolled and cut the fourth name in half.
 * PQW-983 gave the list 271 px at 1000 px wide and hid the problem at that one width;
 * below 60rem, where the tools take a line of their own again, the list is back to
 * 221 px and the card itself is what has to give. The badge keeps its own row under the
 * name (§38) and the intro sentence stays: only the air gives way, and not past the
 * 44 px target size (§36).
 */
for (const viewport of [
  { width: 1000, height: 506 },
  { width: 900, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: all four pattern-type cards fit without scrolling`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);

    const list = await typeCards(page);
    expect(list).not.toBeNull();
    expect(list!.cards).toHaveLength(4);
    expect(list!.scrolls, 'the pattern type list scrolls').toBe(false);
    expect(
      list!.cards.map((card) => card.out),
      'a card hangs out of the list',
    ).toEqual([false, false, false, false]);
    // A card is a target, not only a label: no amount of compressing may take it under 44 px.
    for (const card of list!.cards) expect(card.height).toBeGreaterThanOrEqual(44);
  });
}

test('the written pattern can be closed with its own button and from the menu bar', async ({ page }) => {
  await open(page);

  const written = page.locator('#written');
  const writtenToggle = page.locator('#written-toggle');
  // The panel starts closed (PQW-911): we open it from the menu bar first.
  await expect(written).toBeHidden();
  await writtenToggle.click();
  await expect(written).toBeVisible();

  await written.getByRole('button', { name: 'Lecsukás' }).click();
  await expect(written).toBeHidden();
  await expect(writtenToggle).toHaveAttribute('aria-expanded', 'false');
  await expect(writtenToggle).toBeFocused();

  await writtenToggle.click();
  await expect(written).toBeVisible();
  await writtenToggle.click();
  await expect(written).toBeHidden();
});

interface Point {
  readonly x: number;
  readonly y: number;
}

/** The row labels and the cursor target in window coordinates (`window.mintatervezoRacs`, src/ui/main.ts). */
const view = (page: Page) =>
  page.evaluate(() => {
    const api = (
      window as unknown as { mintatervezoRacs: { labels(): (Point & { layer: number })[]; cursor(): Point | null } }
    ).mintatervezoRacs;
    return { labels: api.labels(), cursor: api.cursor() };
  });

/** The separator of the written pattern (PQW-885). */
const separatorOf = (page: Page) => page.getByRole('separator', { name: 'Az írott minta magassága' });
const heightOf = async (page: Page) => (await box(page, '#written')).height;
/** The two values differ by at most `tolerance` pixels. */
const near = (actual: number, expected: number, tolerance = 2) => Math.abs(actual - expected) <= tolerance;
/** One frame: by then the ResizeObserver has run. */
const settle = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

/*
 * With the written pattern open (PQW-883): „Egész minta” fits above the panel,
 * the cursor target does not end up under the panel, and the status bar does not
 * cover the text of the panel. The panel is at most 22rem by default, half of
 * the work area in a low window, and it fits into the visible area at other
 * heights too; in full view the canvas does not re-fit (PQW-885).
 */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: with the written pattern open, the pattern and the cursor stay visible above the panel`, async ({
    page,
  }) => {
    test.slow();
    await page.setViewportSize(viewport);
    await open(page);
    const written = page.locator('#written');
    // The panel starts closed at every window size (PQW-911): we open it with its button.
    const low = viewport.height < 640;
    await expect(written).toBeHidden();
    await page.locator('#written-toggle').click();
    await expect(written).toBeVisible();

    // A 10-row half double crochet rectangle from the keyboard: 1 = chain stitch, 4 = half double crochet, F = turn.
    await page.locator('#board').focus();
    await page.keyboard.press('Alt+1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+4');
    for (let row = 1; row <= 10; row += 1) {
      if (row > 1) await page.keyboard.press('Alt+f');
      for (let i = 0; i < 10; i += 1) await page.keyboard.press('Enter');
    }
    await page.keyboard.press('Alt+f');
    await expect(page.locator('#summary')).toContainText('12. sor következik.');

    const stage = await box(page, '.stage');
    const types = await box(page, '#types');
    const panel = await box(page, '#panel');
    const cover = await box(page, '#written');
    // At most 22rem and half the work area by default. In a low window 40% of it, but at least the header (that depends on
    // the font size): the middle of the canvas stays free in any case (PQW-891).
    if (low) {
      const minimum = await written.evaluate(
        (el) => parseFloat(getComputedStyle(el).getPropertyValue('--written-min')) || 0,
      );
      expect(cover.height).toBeLessThanOrEqual(Math.max(minimum, stage.height * 0.4) + 1);
      expect(cover.y).toBeGreaterThan(stage.y + stage.height / 2);
    } else {
      expect(near(cover.height, Math.min(352, stage.height / 2))).toBe(true);
    }

    /** The point is on the uncovered part of the canvas: between the two sidebars, above the panel. */
    const expectUncovered = (point: Point | null, name: string, bottom = cover.y) => {
      expect(point, name).not.toBeNull();
      expect(point!.x, name).toBeGreaterThan(types.x + types.width);
      expect(point!.x, name).toBeLessThan(panel.x);
      expect(point!.y, name).toBeGreaterThan(stage.y);
      expect(point!.y, name).toBeLessThan(bottom);
    };

    await page.getByRole('button', { name: 'Egész minta' }).click();
    const fitted = await view(page);
    // Since PQW-916 the label of the foundation chain (layer 0) is beside the chart as well; here we look at the rows.
    const rows = fitted.labels.filter((label) => label.layer >= 1 && label.layer <= 10);
    expect(rows.map((label) => label.layer).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const label of rows) expectUncovered(label, `row ${label.layer}`);
    expectUncovered(fitted.cursor, 'the cursor target after „Egész minta”');

    // Since PQW-916 the status text is a hidden live region: it covers neither the chart nor the text of the panel.
    const status = await page.locator('#status').boundingBox();
    expect(
      (status?.width ?? 0) * (status?.height ?? 0),
      'the status text does not float over the canvas',
    ).toBeLessThanOrEqual(4);

    // With the panel closed we push the cursor to where the panel is; opening it brings the view back.
    await written.getByRole('button', { name: 'Lecsukás' }).click();
    await expect(written).toBeHidden();
    const before = (await view(page)).cursor!;
    await page.mouse.move(panel.x - 40, stage.y + 40);
    await page.mouse.wheel(0, before.y - (cover.y + stage.y + stage.height) / 2);
    await expect.poll(async () => (await view(page)).cursor!.y).toBeGreaterThan(cover.y);

    await page.locator('#written-toggle').click();
    await expect(written).toBeVisible();
    await expect.poll(async () => (await view(page)).cursor!.y).toBeLessThan(cover.y);
    expectUncovered((await view(page)).cursor, 'the cursor target after opening the panel');

    // It fits above the panel at other heights too: header only, then a panel a quarter taller.
    const separator = separatorOf(page);
    for (const key of ['Home', 'PageUp']) {
      await separator.focus();
      await page.keyboard.press(key);
      await settle(page);
      const top = (await box(page, '#written')).y;
      await page.getByRole('button', { name: 'Egész minta' }).click();
      const shown = await view(page);
      const shownRows = shown.labels.filter((label) => label.layer >= 1 && label.layer <= 10);
      expect(shownRows).toHaveLength(10);
      for (const label of shownRows) expectUncovered(label, `row ${label.layer} (after ${key})`, top);
      expectUncovered(shown.cursor, `the cursor target (after ${key})`, top);
    }

    // In full view the canvas does not re-fit: the view behind the panel is unchanged.
    const behind = await view(page);
    await separator.focus();
    await page.keyboard.press('End');
    await expect.poll(() => heightOf(page)).toBeGreaterThan(stage.height - 1);
    await settle(page);
    expect(await view(page)).toEqual(behind);
  });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: the separator adjusts from the header to the whole work area, by keyboard and by mouse`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const written = page.locator('#written');
    await openWritten(page);
    const separator = separatorOf(page);
    const stage = await box(page, '.stage');

    // Keyboard: End is the whole work area, Home is the header only, an arrow moves at most 5 %.
    await separator.focus();
    await page.keyboard.press('End');
    await expect.poll(() => heightOf(page)).toBeGreaterThan(stage.height - 1);
    await expect(separator).toHaveAttribute('aria-valuenow', '100');
    await expect(written.getByRole('button', { name: 'Vissza', exact: true })).toBeVisible();

    // After Home only the header remains: the body of the text collapses. The header height depends on the font, and on a narrow panel it may wrap to two lines.
    await page.keyboard.press('Home');
    await expect.poll(async () => (await box(page, '#written-body')).height).toBeLessThanOrEqual(10);
    expect(await heightOf(page)).toBeLessThan(stage.height / 2);
    await expect(written.getByRole('button', { name: 'Lecsukás' })).toBeInViewport();
    const low = Number(await separator.getAttribute('aria-valuenow'));
    await expect(separator).toHaveAttribute('aria-valuemin', String(low));
    await page.keyboard.press('ArrowUp');
    await expect.poll(async () => Number(await separator.getAttribute('aria-valuenow'))).toBeGreaterThan(low);
    expect(Number(await separator.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(low + 5);

    // Mouse: dragging the separator to a quarter of the work area makes the panel three quarters of it.
    const grip = await box(page, '#written-grip');
    const x = grip.x + grip.width / 2;
    await page.mouse.move(x, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, stage.y + stage.height / 4 + grip.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => near(await heightOf(page), (stage.height * 3) / 4, 3)).toBe(true);

    // „Teljes nézet” opens to the whole work area, „Vissza” returns to the earlier height.
    const before = await heightOf(page);
    await written.getByRole('button', { name: 'Teljes nézet' }).click();
    await expect.poll(() => heightOf(page)).toBeGreaterThan(stage.height - 1);
    await written.getByRole('button', { name: 'Vissza', exact: true }).click();
    await expect.poll(async () => near(await heightOf(page), before)).toBe(true);
    await expect(written.getByRole('button', { name: 'Teljes nézet' })).toBeVisible();

    // Dragged below the header it closes; reopened it gets the height it had before the drag.
    const start = await box(page, '#written-grip');
    await page.mouse.move(x, start.y + start.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, stage.y + stage.height - 2, { steps: 5 });
    await page.mouse.up();
    await expect(written).toBeHidden();
    await expect(page.locator('#written-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#written-toggle')).toBeFocused();
    await page.locator('#written-toggle').click();
    await expect(written).toBeVisible();
    await expect.poll(async () => near(await heightOf(page), before)).toBe(true);
  });

  test(`${viewport.width}×${viewport.height}: a long status message does not upset the layout`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const written = page.locator('#written');
    await openWritten(page);
    const stage = await box(page, '.stage');

    /*
     * Modelled on the long error messages of the core (PQW-884). Since PQW-916
     * the status text is not a floating box on the canvas but a hidden live
     * region: the screen reader reads it out, but it does not cover the chart,
     * and its length does not move the layout either — neither with the written
     * pattern open, nor in full view.
     */
    const long =
      'Nincs elég célpont: a beillesztett sor tizenkét szemet vár, de az előző sorban csak kilenc szabad célpont van, ezért a minta nem változott. Tedd a kurzort egy korábbi szemre, és próbáld újra.';
    const say = async () => {
      await page.locator('#status').evaluate((element, text) => {
        element.textContent = text;
      }, long);
      await settle(page);
    };
    /** The text of the message is there, but it has no visible box, and the page does not scroll. */
    const expectQuiet = async () => {
      await expect(page.locator('#status')).toContainText('Nincs elég célpont');
      const status = await page.locator('#status').boundingBox();
      expect(
        (status?.width ?? 0) * (status?.height ?? 0),
        'the status text does not float over the canvas',
      ).toBeLessThanOrEqual(4);
      const size = await page.evaluate(() => [
        document.documentElement.scrollWidth,
        document.documentElement.scrollHeight,
      ]);
      expect(size).toEqual([viewport.width, viewport.height]);
    };

    await say();
    await expectQuiet();

    // It does not become a box in full view either.
    await written.getByRole('button', { name: 'Teljes nézet' }).click();
    await expect.poll(() => heightOf(page)).toBeGreaterThan(stage.height - 1);
    await say();
    await expectQuiet();
  });
}

interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/*
 * For a pattern worked in rounds the grid is larger than the chart all around,
 * by the band of the round in progress (PQW-887): „Egész minta” fits the edge of
 * the grid into the visible area too, with the written pattern open. In a low
 * window it zooms out below the smallest zoom step to do so.
 */
for (const [viewport, rounds] of [
  [{ width: 1440, height: 900 }, 6],
  [{ width: 1000, height: 506 }, 6],
] as const) {
  test(`${viewport.width}×${viewport.height}: „Egész minta” fits the grid of a pattern worked in rounds into the visible area too`, async ({
    page,
  }) => {
    // PQW-925: it uses a granny square, which is temporarily switched off.
    test.skip(true, 'PQW-925: the granny square is temporarily switched off');
    await page.setViewportSize(viewport);
    await open(page);
    await openWritten(page);

    const section = page.locator('#section-rounds');
    if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
    await page.locator('#rounds-shape').selectOption({ label: 'Nagymama-négyzet' });
    await page.locator('#rounds-count').fill(String(rounds));
    await page.locator('#rounds-count').press('Tab');
    await page.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#status')).toContainText(`${rounds} kör elkészült`);
    await page.getByRole('button', { name: 'Egész minta' }).click();

    const grid = await page.evaluate(() =>
      (window as unknown as { mintatervezoRacs: { bounds(): Rect | null } }).mintatervezoRacs.bounds(),
    );
    expect(grid).not.toBeNull();
    const stage = await box(page, '.stage');
    const types = await box(page, '#types');
    const panel = await box(page, '#panel');
    const cover = await box(page, '#written');
    expect(grid!.left).toBeGreaterThanOrEqual(types.x + types.width);
    expect(grid!.right).toBeLessThanOrEqual(panel.x);
    expect(grid!.top).toBeGreaterThanOrEqual(stage.y);
    expect(grid!.bottom).toBeLessThanOrEqual(cover.y);
  });
}
