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

test('pattern type: regular and irregular crochet are selectable, the rest are „hamarosan” and inactive (PQW-925, PQW-963)', async ({
  page,
}) => {
  await open(page);

  const regular = page.getByRole('button', { name: /Szabályos horgolás/ });
  await expect(regular).toBeEnabled();
  await expect(regular).toHaveAttribute('aria-pressed', 'true');
  await expect(regular).not.toContainText('Hamarosan');

  const irregular = page.getByRole('button', { name: /Szabálytalan horgolás/ });
  await expect(irregular).toBeEnabled();
  await expect(irregular).not.toContainText('Hamarosan');

  // Filet and amigurumi are temporarily switched off.
  for (const name of ['Filéhorgolás', 'Amigurumi']) {
    const item = page.getByRole('button', { name: new RegExp(name) });
    await expect(item).toBeDisabled();
    await expect(item).toContainText('Hamarosan');
  }
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

test('the granny square cannot be chosen in the motif chooser, and is marked as such (PQW-925)', async ({ page }) => {
  await open(page);

  await openSheet(page);
  await page.locator('#section-rounds').click();
  const granny = page.locator('#rounds-shape option[value="granny-square"]');
  await expect(granny).toBeDisabled();
  await expect(granny).toHaveText(/Nagymama-négyzet — Hamarosan/);
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
