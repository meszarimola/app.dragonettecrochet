/*
 * Starting from a foundation chain as the owner describes it (PQW-891): starting
 * a scarf with 40 chain stitches, a turn, and single crochet rows. The turning
 * chain stands in place of single crochet 1, so row 1 starts in the 3rd chain
 * stitch counted from the hook, and there will be 38 stitches. By clicking and
 * from the keyboard, in the window size of the owner (1000×506) and in a large
 * window.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function setChainCount(page: Page, count: number): Promise<void> {
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(count));
}

/** The cursor target in window coordinates (the hook for the browser tests, main.ts). */
async function cursorPoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(
    () => (window as unknown as { mintatervezoRacs: { cursor: () => { x: number; y: number } | null } }).mintatervezoRacs.cursor(),
  );
  expect(point).not.toBeNull();
  return point!;
}

/** What is under the point: whether anything covers the canvas. */
async function elementIdAt(page: Page, point: { x: number; y: number }): Promise<string> {
  return page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id ?? '', point);
}

async function expectScarfRows(page: Page, rows: number): Promise<void> {
  // The summary shows the row in progress; the earlier rows are in the written pattern.
  const summary = page.locator('#summary');
  // The foundation chain is row 1 (PQW-923): the number of crocheted rows is one less than the row number shown.
  await expect(summary).toContainText(`${rows + 1}. sor: 39 szem`);
  await expect(summary).toContainText('Nincs hiba és figyelmeztetés.');
  await expect(page.locator('#findings li')).toHaveCount(0);

  const written = page.locator('#written');
  if (await written.isHidden()) await page.locator('#written-toggle').click();
  const text = page.locator('#written-text');
  await expect(text).toContainText('1. sor – alapsor: 40 lsz.');
  await expect(text).toContainText('2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 rp (39 szem).');
  // The turning chain sits in the place of the first stitch of the row, so the text writes out the skip (PQW-944).
  if (rows >= 2) await expect(text).toContainText('3. sor: 1 lsz (1 rp-nek számít), 1 szem kihagyása, 38 rp (39 szem).');
}

for (const viewport of [
  { width: 1000, height: 506 },
  { width: 1440, height: 900 },
]) {
  test(`${viewport.width}×${viewport.height}: scarf by clicking: 40 chain stitches onto the canvas, F, single crochet 1 into chain 3, fill row, row 3`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);

    // The middle of the canvas is free: the click goes to the canvas, not to the panel.
    const board = await page.locator('#board').boundingBox();
    const center = { x: board!.x + board!.width / 2, y: board!.y + board!.height / 2 };
    expect(await elementIdAt(page, center)).toBe('board');

    // First the tool, then the count: choosing the chain stitch resets the field to its default.
    await page.getByRole('button', { name: /^Láncszem/ }).first().click();
    await setChainCount(page, 40);
    await page.mouse.click(center.x, center.y);
    await expect(page.locator('#summary')).toContainText('2. sor következik.');

    // Turning after the foundation chain is an accepted step, without a message that looks like an error.
    await page.locator('[data-action="end-row"]').click();
    const status = page.locator('#status');
    await expect(status).toContainText('Az 1. sor kész, a munka megfordítva.');
    await expect(status).toContainText('2. sor következik.');
    await expect(status).not.toContainText('még nincs szem');

    // The first single crochet by clicking on the cursor target: into the 3rd chain stitch counted from the hook.
    await page.getByRole('button', { name: /^Rövidpálca/ }).first().click();
    await expect(status).not.toContainText('Előbb válassz');
    const target = await cursorPoint(page);
    expect(await elementIdAt(page, target)).toBe('board');
    await page.mouse.click(target.x, target.y);
    await expect(page.locator('#summary')).toContainText('2. sor: 2 szem');

    await page.getByRole('button', { name: 'Sor kitöltése' }).click();
    await expect(page.locator('#summary')).toContainText('2. sor: 39 szem');

    await page.locator('[data-action="end-row"]').click();
    await page.getByRole('button', { name: 'Sor kitöltése' }).click();
    await expectScarfRows(page, 2);
  });

  test(`${viewport.width}×${viewport.height}: scarf from the keyboard only: 40 chain stitches, F, single crochet, Shift+F, row 3`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);

    const board = page.locator('#board');
    await board.focus();
    await page.keyboard.press('Alt+1'); // chain stitch
    await setChainCount(page, 40);
    await board.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+f');
    await expect(page.locator('#status')).toContainText('Az 1. sor kész, a munka megfordítva.');
    await page.keyboard.press('Alt+3'); // single crochet
    await page.keyboard.press('Shift+Alt+f'); // fill row
    await expect(page.locator('#summary')).toContainText('2. sor: 39 szem');
    await page.keyboard.press('Alt+f');
    await page.keyboard.press('Shift+Alt+f');
    await expectScarfRows(page, 2);
  });
}
