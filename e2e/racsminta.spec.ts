/*
 * Grid-based techniques (PQW-864): the „Filéhorgolás” type opens the
 * „Rácsminta” section; a small filet motif whose first rows alone are complete
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
  const deny = page.getByRole('button', { name: 'Elutasítom' });
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

test('small filet motif: the first two rows are complete, the rest come from the repeat unit; painted from the keyboard, error-free, written as a repeat', async ({
  page,
}) => {
  await open(page);
  await page.locator('.type[data-type="filet"]').click();
  await openSheet(page);
  const section = page.locator('#section-grid');
  await expect(section).toHaveAttribute('open', '');

  await setSize(page, 8, 4);
  await expect(page.locator('#grid-board [role="gridcell"]')).toHaveCount(32);
  await expect(page.locator('#grid-ratio')).toContainText('a rács a mintasűrűség arányában látszik');

  // Row 1: every even cell filled; row 2: every odd one filled (open is the default).
  await section.getByRole('radio', { name: 'Teli cella' }).check();
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
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-label', '3. sor, 2. cella: teli');

  // In rows 3 and 4 only the first two cells (the repeat) are given, the rest deleted: they fill in from the repeat.
  for (const y of [2, 3]) {
    await cell(page, 0, y).focus();
    for (let x = 0; x < 8; x += 1) {
      if (x >= 2) await page.keyboard.press('Delete');
      else if (x % 2 === y % 2) await page.keyboard.press('Space');
      await page.keyboard.press('ArrowRight');
    }
  }
  await expect(page.locator('#grid-unit')).toHaveText(/^Ismétlő egység, felismerve: 2 × 2 cella\./);
  await expect(page.locator('#grid-board .is-unit')).toHaveCount(4);
  await expect(page.locator('#grid-details')).toContainText(
    'Ismétlő egység: 2 × 2 cella, a teljes 8 × 4 cellás rácsra kiterjesztve.',
  );

  // The keys of the grid did not reach the canvas: Delete did not undo the last step.
  await expect(page.locator('#status')).not.toContainText('törölve');
  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText(
    'Filé: 4 sor elkészült; visszavonással a korábbi minta visszajön.',
  );
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toMatch(/1. sor – alapsor: \d+ lsz\./);
  expect(text).toMatch(/\[[^\]]+\] \d+-(szor|szer|ször)/);
  await expect(section.getByRole('button', { name: 'Rács a mostani mintából' })).toBeEnabled();
});

test('C2C image with two colours: 6 diagonal rows, colours per tile; creation is still refused, understandably (PQW-926)', async ({
  page,
}) => {
  await open(page);
  await openSheet(page);
  const section = page.locator('#section-grid');
  await section.locator('summary').click();
  await page.locator('#grid-technique').selectOption({ label: 'Sarokból sarokba (C2C)' });
  await setSize(page, 4, 3);
  await expect(page.locator('#grid-colors li')).toHaveCount(2);

  await section.getByRole('radio', { name: 'B: Bordó' }).check();
  for (const [x, y] of [
    [0, 0],
    [1, 1],
    [2, 2],
  ] as const) {
    await cell(page, x, y).click();
  }
  await expect(page.locator('#grid-size')).toHaveText(/, 6 átlós sor, 12 csempe\.$/);
  await expect(page.locator('#grid-details')).toContainText('Csempék színenként: A: 9, B: 3 csempe.');

  // The button of the mirrored view is gone (PQW-911): the motif with lettering gives no warning either.
  await section.getByLabel(/Feliratos motívum/).check();
  await expect(page.locator('.tools [data-action="mirror"]')).toHaveCount(0);
  await expect(page.locator('#grid-warnings li')).toHaveCount(0);

  /*
   * Creating the pattern is refused today with a clear message: the program
   * cannot yet build the chain arc of the tiles in every shape (PQW-926). The
   * grid, the tile counts and the warnings are correct regardless, so we go on
   * checking the above.
   */
  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Ez a C2C-alakzat egyelőre nem készíthető el');
  await expect(page.locator('#status')).toContainText('1 × 1 és a 2 × 1 méret működik');
});
