/*
 * The reorganised interface of the editor (PQW-873): pattern type menu on the
 * left, icon menu bar, stitch chooser on the right-hand panel (PQW-882), an
 * error counter in the menu bar, and the written pattern in a panel that opens
 * at the bottom of the canvas.
 */

import { expect, type Page, test } from '@playwright/test';

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

test('the „Új” button is the type menu: one move to start a new pattern (PQW-1045)', async ({ page }) => {
  await open(page);
  // There is no second type button any more; „Új” opens the list.
  await expect(page.locator('[data-action="new"]')).toHaveCount(0);
  const newButton = page.locator('#types-toggle');
  await expect(newButton).toContainText('Új');
  await expect(page.locator('#types')).toBeHidden();
  await newButton.click();
  await expect(page.locator('#types')).toBeVisible();

  // Lay a stitch down, then pick a type: the pattern starts empty, and undo brings the work back.
  await page.locator('.type[data-type="irregular"]').click();
  await page.locator('#board-irregular').focus();
  await page.keyboard.press('Alt+5');
  await page.locator('#board-irregular').click({ position: { x: 500, y: 300 } });
  const firstRow = page.locator('#rows-list li').first();
  await expect(firstRow).toContainText('1 szem');

  await newButton.click();
  await page.locator('.type[data-type="irregular"]').click();
  await expect(page.locator('#status')).toContainText('Új szabálytalan minta indult.');
  await expect(page.locator('#rows-empty'), 'the new pattern is empty').toBeVisible();

  // The intro of the menu promises it, so it has to hold (PQW-1045).
  await page.locator('#board-irregular').focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(firstRow).toContainText('1 szem');
});

test('pattern type: regular and irregular crochet are selectable, the rest are „hamarosan” and inactive (PQW-925, PQW-963)', async ({
  page,
}) => {
  await open(page);
  await page.locator('#types-toggle').click();

  const regular = page.getByRole('button', { name: /Szabályos horgolás/ });
  await expect(regular).toBeEnabled();
  await expect(regular).toHaveAttribute('aria-pressed', 'true');
  await expect(regular).not.toContainText('Hamarosan');

  const irregular = page.getByRole('button', { name: /Szabad tervező/ });
  await expect(irregular).toBeEnabled();
  await expect(irregular).not.toContainText('Hamarosan');

  // Filet and amigurumi are temporarily switched off.
  for (const name of ['Filéhorgolás', 'Amigurumi']) {
    const item = page.getByRole('button', { name: new RegExp(name) });
    await expect(item).toBeDisabled();
    await expect(item).toContainText('Hamarosan');
  }
});

test('the regular type opens a side menu of shapes, and a choice opens its generator with the shape set (PQW-1038)', async ({
  page,
}) => {
  await open(page);
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="irregular"]').click();
  await expect(page.locator('#board-irregular')).toBeVisible();

  await page.locator('#types-toggle').click();
  const menu = page.locator('#types-regular-menu');
  await expect(menu).toBeHidden();
  await page.locator('.type[data-type="regular"]').hover();
  await expect(menu).toBeVisible();
  await expect(menu.locator('.flyout__name')).toHaveText(['Négyszögletes', 'Háromszög', 'Félkör', 'Nagymama-négyzet']);
  await expect(menu.locator('.flyout__detail')).toHaveText([
    'Forma: Téglalap',
    'Forma: Egyenlő szárú háromszög',
    'Kendő: Félkör',
    'Üres vászon, körönként',
  ]);

  await page.getByRole('menuitem', { name: /Félkör/ }).click();
  await expect(page.locator('#types')).toBeHidden();
  await expect(page.locator('#board-irregular')).toBeHidden();
  await expect(page.locator('#setup')).toBeVisible();
  await expect(page.locator('#section-shawl')).toHaveAttribute('open', '');
  await expect(page.locator('#section-rounds')).not.toHaveAttribute('open', '');
  await expect(page.locator('#shawl-kind')).toBeFocused();
  await expect(page.locator('#shawl-kind')).toHaveValue('semicircle');
  await expect(page.locator('#status')).not.toContainText('Félkör, ');
});

test('the side menu works from the keyboard: right arrow opens it, arrows move, left arrow closes it (PQW-1038)', async ({
  page,
}) => {
  await open(page);
  await page.locator('#types-toggle').click();
  await expect(page.locator('.type[data-type="regular"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#types-regular-menu')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Négyszögletes/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: /Háromszög/ })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#types-regular-menu')).toBeHidden();
  await expect(page.locator('.type[data-type="regular"]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('#shape-kind')).toHaveValue('rectangle');
  await expect(page.locator('#section-shape')).toHaveAttribute('open', '');
});

test('the sections of the switched-off crochet kinds are not visible in the panel (PQW-925)', async ({ page }) => {
  await open(page);

  // We do not even build the panel for a switched-off type: the section is hidden.
  // They live in the make-a-pattern sheet now (PQW-987), so the sheet is opened first —
  // otherwise they would read as hidden merely because the sheet is.
  await openSheet(page);
  await expect(page.locator('#section-grid')).toBeHidden();
  await expect(page.locator('#section-amigurumi')).toBeHidden();
  // The sections of regular crochet are in their places.
  await expect(page.locator('#section-rounds')).toBeVisible();
  await expect(page.locator('#section-shape')).toBeVisible();
});

test('the granny square can be chosen in the motif chooser (PQW-1038)', async ({ page }) => {
  await open(page);

  await openSheet(page);
  await page.locator('#section-rounds').click();
  const granny = page.locator('#rounds-shape option[value="granny-square"]');
  await expect(granny).toBeEnabled();
  await expect(granny).toHaveText('Nagymama-négyzet');

  // PQW-1039: with the granny square chosen, only its own fields show.
  await page.locator('#rounds-shape').selectOption('granny-square');
  for (const id of ['#rounds-stitch', '#rounds-closing', '#rounds-stagger', '#rounds-jog', '#rounds-closing-note']) {
    await expect(page.locator(id)).toBeHidden();
  }
  for (const id of ['#rounds-start', '#rounds-count', '#rounds-colors', '#rounds-ribbing']) {
    await expect(page.locator(id)).toBeVisible();
  }
});

/*
 * The symbol of the single crochet follows from the symbol style, so the choice
 * was removed — an earlier „×” cannot come back from the browser storage either.
 * The geometry of the symbol is measured by the unit tests
 * (tests/ui-symbols.test.mjs); here the interface is the subject.
 *
 * KB: owner-decisions.md §2
 */
test('the single crochet symbol cannot be chosen separately (PQW-929)', async ({ page }) => {
  await open(page);

  await page.locator('#section-notation').click();
  await expect(page.locator('#sc-mark'), 'the + / × choice was removed').toHaveCount(0);
  await expect(page.locator('#sc-mark-jis'), 'and its note as well').toHaveCount(0);
  // The symbol style, however, can still be chosen: the symbol comes from that.
  await expect(page.locator('#chart-style')).toBeVisible();
});

test('choosing a stitch from the right-hand panel, then crocheting', async ({ page }) => {
  await open(page);

  const palette = page.locator('#palette');
  await expect(palette).toBeVisible();

  // Choosing a chain stitch from the list of the panel.
  const chain = palette.getByRole('button', { name: /Láncszem/ }).first();
  await chain.click();
  await expect(chain).toHaveAttribute('aria-pressed', 'true');

  // Foundation chain with the given number of chain stitches.
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('8');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');

  // Single crochet row, also chosen from the panel.
  const sc = palette.getByRole('button', { name: /Rövidpálca \(rp\)/ }).first();
  await sc.click();
  await expect(sc).toHaveAttribute('aria-pressed', 'true');
  await expect(chain).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#board').focus();
  for (let i = 0; i < 7; i += 1) await page.keyboard.press('Enter');

  await expect(page.locator('#summary')).toContainText('7 szem.');
});

test('the error counter in the menu bar drops down the list of findings', async ({ page }) => {
  await open(page);

  const errorToggle = page.locator('#error-toggle');
  const errors = page.locator('#errors');

  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  await expect(errors).toBeHidden();

  await errorToggle.click();
  await expect(errorToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(errors).toBeVisible();
  await expect(errors.locator('#summary')).toContainText('Üres minta');

  // Escape closes the dropdown.
  await page.locator('#board').focus();
  await page.keyboard.press('Escape');
  await expect(errors).toBeHidden();
});

test('the written pattern at the bottom of the canvas, in a panel that opens', async ({ page }) => {
  await open(page);

  const written = page.locator('#written');
  const writtenToggle = page.getByRole('button', { name: 'Írott minta' });

  // The panel starts closed (PQW-911): at startup the canvas is free.
  await expect(written).toBeHidden();
  await expect(writtenToggle).toHaveAttribute('aria-expanded', 'false');

  // Opened, it sits at the bottom of the stage.
  await writtenToggle.click();
  await expect(written).toBeVisible();
  const stageBox = await page.locator('.stage').boundingBox();
  const box = await written.boundingBox();
  expect(box!.y).toBeGreaterThan(stageBox!.y + stageBox!.height / 2);

  await writtenToggle.click();
  await expect(written).toBeHidden();
  await writtenToggle.click();
  await expect(written).toBeVisible();
});
