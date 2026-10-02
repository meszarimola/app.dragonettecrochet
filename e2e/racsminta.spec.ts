/*
 * Grid-based techniques (PQW-864): the "Filet crochet" type opens the
 * "Grid chart" section; a small filet motif whose first rows alone are complete
 * gives an error-free pattern with the recognised repeat unit; a C2C image with
 * two colours is error-free, and the written pattern writes the colours per tile.
 * The mirrored view is gone (PQW-911), so the motif with lettering gives no
 * warning.
 */

import { expect, type Page, test } from '@playwright/test';

/*
 * The filet crochet pattern type — and with it every technique of the grid
 * section — is switched off for the first round of acceptance testing
 * (KB: owner-decisions.md §13). We do NOT delete the tests: when the type is
 * switched back on, this single block is what goes away.
 */
test.beforeEach(() => {
  test.skip(true, 'PQW-925: the filet crochet pattern type is temporarily switched off');
});

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

/** The make-a-pattern sheet (PQW-987) is closed on load, and its opener is in the file menu. */
async function openSheet(page: Page): Promise<void> {
  const sheet = page.locator('#setup-toggle');
  if ((await sheet.getAttribute('aria-expanded')) !== 'true') {
    await page.locator('#file-toggle').click();
    await sheet.click();
  }
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

async function setSize(page: Page, width: number, height: number): Promise<void> {
  for (const [id, value] of [
    ['#grid-width', width],
    ['#grid-height', height],
  ] as const) {
    const input = page.locator(id);
    await input.fill(String(value));
    await input.blur();
  }
}

const cell = (page: Page, x: number, y: number) => page.locator(`#grid-board [data-x="${x}"][data-y="${y}"]`);

test('small filet motif: the first two rows are complete, the rest come from the repeat unit; painted from the keyboard, error-free, written as a repeat', {
  tag: '@kiadas',
}, async ({ page }) => {
  await open(page);
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="filet"]').click();
  await openSheet(page);
  const section = page.locator('#section-grid');
  await expect(section).toHaveAttribute('open', '');

  await setSize(page, 8, 4);
  await expect(page.locator('#grid-board [role="gridcell"]')).toHaveCount(32);
  await expect(page.locator('#grid-ratio')).toContainText('the grid is shown in the ratio of the gauge');

  // Row 1: every even cell filled; row 2: every odd one filled (open is the default).
  await section.getByRole('radio', { name: 'Filled cell' }).check();
  await cell(page, 0, 0).focus();
  for (let x = 0; x < 8; x += 1) {
    if (x % 2 === 0) await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
  }
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Home');
  for (let x = 0; x < 8; x += 1) {
    if (x % 2 === 1) await page.keyboard.press('Space');
    await page.keyboard.press('ArrowRight');
  }
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-label', 'row 3, cell 2: filled');

  // In rows 3 and 4 only the first two cells (the repeat) are given, the rest deleted: they fill in from the repeat.
  for (const y of [2, 3]) {
    await cell(page, 0, y).focus();
    for (let x = 0; x < 8; x += 1) {
      if (x >= 2) await page.keyboard.press('Delete');
      else if (x % 2 === y % 2) await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
    }
  }
  await expect(page.locator('#grid-unit')).toHaveText(/^Repeating unit, recognised: 2 × 2 cells\./);
  await expect(page.locator('#grid-board .is-unit')).toHaveCount(4);
  await expect(page.locator('#grid-details')).toContainText(
    'Repeating unit: 2 × 2 cells, extended over the whole 8 × 4 cell grid.',
  );

  // The keys of the grid did not reach the canvas: Delete did not undo the last step.
  await expect(page.locator('#status')).not.toContainText('deleted');
  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Filet: 4 rows done; undo brings the previous one back.');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  const text = await writtenText(page);
  expect(text).toMatch(/Row 1 – foundation: ch \d+\./);
  expect(text).toMatch(/\[[^\]]+\] \d+ times/);
  await expect(section.getByRole('button', { name: 'Grid from the current pattern' })).toBeEnabled();
});

test('C2C image with two colours: 6 diagonal rows, colours per tile; creation is still refused, understandably (PQW-926)', async ({
  page,
}) => {
  await open(page);
  await openSheet(page);
  const section = page.locator('#section-grid');
  await section.locator('summary').click();
  await page.locator('#grid-technique').selectOption({ label: 'Corner-to-corner (C2C)' });
  await setSize(page, 4, 3);
  await expect(page.locator('#grid-colors li')).toHaveCount(2);

  await section.getByRole('radio', { name: 'B: Burgundy' }).check();
  for (const [x, y] of [
    [0, 0],
    [1, 1],
    [2, 2],
  ] as const) {
    await cell(page, x, y).click();
  }
  await expect(page.locator('#grid-size')).toHaveText(/, 6 diagonal rows, 12 tiles\.$/);
  await expect(page.locator('#grid-details')).toContainText('Tiles per colour: A: 9, B: 3 tiles.');

  // The button of the mirrored view is gone (PQW-911): the motif with lettering gives no warning either.
  await section.getByLabel(/Lettered motif/).check();
  await expect(page.locator('.tools [data-action="mirror"]')).toHaveCount(0);
  await expect(page.locator('#grid-warnings li')).toHaveCount(0);

  /*
   * Creating the pattern is refused today with a clear message: the program
   * cannot yet build the chain arc of the tiles in every shape (PQW-926). The
   * grid, the tile counts and the warnings are correct regardless, so we go on
   * checking the above.
   */
  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('This C2C shape cannot be made yet');
  await expect(page.locator('#status')).toContainText('1 × 1 and 2 × 1 work');
});
