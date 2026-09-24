/*
 * The critical paths of the editor in the browser (PQW-857): a rectangle from
 * the keyboard only, save and reload, JSON, PNG and SVG export; the written
 * pattern panel with the chosen notation (PQW-868).
 */

import { readFile } from 'node:fs/promises';
import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

/** The notation section is closed by default (PQW-882). */
async function openNotation(page: Page): Promise<void> {
  await page.locator('#section-notation').evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
}

/** Foundation chain and rows from the keyboard only (PQW-911): Alt+1 = chain stitch, Alt+3 = single crochet, Alt+4 = half double crochet, Alt+F = turn. */
async function rectangle(page: Page, stitchKey: string, width: number, rows: number, chains: number): Promise<void> {
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(chains));
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press(stitchKey);
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) await page.keyboard.press('Alt+f');
    // The first stitch of a turned row becomes the turning chain (PQW-944), so there we crochet one more time.
    for (let i = 0; i < width + (row > 1 ? 1 : 0); i += 1) await page.keyboard.press('Enter');
  }
}

/**
 * The comparable part of the recorded text: without the title and the name of
 * the piece (they differ in the editor), and without the closing sentence of the
 * last row, because the editor has no fasten off yet.
 */
function comparable(text: string): string {
  const lines = text.trimEnd().split('\n').slice(1);
  // Since PQW-923 the foundation chain row reads „1. sor – alapsor:”, in English „Row 1 – foundation:”.
  const start = lines.findIndex((line) => /^(1\. sor – alapsor|Row 1 – foundation):/.test(line));
  lines.splice(start - 1, 1);
  lines[lines.length - 1] = lines.at(-1)!.replace(/ (A fonal elvágása|Fasten off)\.$/, '');
  return lines.join('\n');
}

const fixture = (locale: string, name: string) =>
  readFile(new URL(`../tests/fixtures/written/${locale}/${name}.txt`, import.meta.url), 'utf8');

test('written pattern: the recorded text of the rectangle in the panel, and the text changes when the notation changes', async ({
  page,
}) => {
  test.slow();
  await open(page);
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+4', 15, 22, 17);

  // The written pattern panel starts closed (PQW-911), and does not refresh while closed.
  await page.locator('#written-toggle').click();
  const text = page.locator('#written-text');
  await expect(text).toContainText('23. sor:');
  /*
   * A rectangle drawn in the designer is built by the rule of today (PQW-944):
   * the turning chain stands in the place of the first stitch of the row, so the
   * text writes out the skip. The recorded text of the worked example still
   * keeps the earlier structure (moving the examples and the generators over is
   * PQW-945), so here we compare the rows one by one.
   */
  const lines = comparable((await text.textContent())!).split('\n');
  const reference = comparable(await fixture('hu', 'felpalcas-teglalap')).split('\n');
  expect(lines.filter((line) => !/^\d/.test(line))).toEqual(reference.filter((line) => !/^\d/.test(line)));
  expect(lines.find((line) => line.startsWith('1. sor'))).toBe('1. sor – alapsor: 17 lsz.');
  expect(lines.find((line) => line.startsWith('2. sor'))).toBe(
    '2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 fp (16 szem). Fordítás.',
  );
  expect(lines.find((line) => line.startsWith('3–22. sor'))).toBe(
    '3–22. sor: 2 lsz (1 fp-nek számít), 1 szem kihagyása, 15 fp (16 szem). Fordítás.',
  );

  // The notation starts closed (PQW-882) and sits in the sheet (PQW-987).
  await openNotation(page);
  await page.locator('#terms').selectOption('en-US');
  await expect(text).toContainText('Row 23:');
  const english = comparable((await text.textContent())!).split('\n');
  const englishReference = comparable(await fixture('en-US', 'felpalcas-teglalap')).split('\n');
  expect(english.filter((line) => !/^Rows? /.test(line) && line !== 'sk – skip')).toEqual(
    englishReference.filter((line) => !/^Rows? /.test(line)),
  );
  expect(english.find((line) => line.startsWith('Rows 3–22'))).toBe(
    'Rows 3–22: ch 2 (counts as 1 hdc), sk 1 st, 15 hdc (16 sts). Turn.',
  );
  await expect(page.locator('#palette')).toContainText('Half double crochet (hdc)');

  // The notation starts closed (PQW-882) and sits in the sheet (PQW-987).
  await openNotation(page);
  await page.locator('#terms').selectOption('en-GB');
  await expect(text).toContainText('Abbreviations (UK terms)');
  // The turning chain stands in place of stitch 1 (PQW-891): 14 half double crochets and the turning chain.
  await expect(text).toContainText('15 htr (16 sts)');
  expect(await text.textContent()).not.toMatch(/\b(sc|hdc|sl st)\b/);

  // The choice survives a reload, while the interface language stays Hungarian.
  await page.reload();
  await expect(page.locator('#terms')).toHaveValue('en-GB');
  await expect(text).toContainText('Stitch key (UK terms)');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
});

test('10 × 10 half double crochet rectangle from the keyboard only, error-free', async ({ page }) => {
  await open(page);
  // The chain count field is only visible for a chain stitch; we select it first.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+4', 10, 10, 12);

  await expect(page.locator('#summary')).toContainText('10 sor.');
  await expect(page.locator('#summary')).toContainText('11. sor: 11 szem.');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  await expect(page.locator('#findings li')).toHaveCount(0);
});

test('the pattern survives a reload, and can be loaded back as JSON', async ({ page }) => {
  await open(page);
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+3', 4, 2, 6);
  const before = await page.locator('#summary').textContent();
  expect(before).toContain('3. sor: 5 szem.');

  await page.reload();
  await expect(page.locator('#summary')).toHaveText(before!);

  const downloadPromise = page.waitForEvent('download');
  // Saving is in the file actions dropdown (PQW-911).
  await page.locator('#file-toggle').click();
  await page.getByRole('button', { name: 'JSON mentése' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const json = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(json).formatVersion).toBe(1);

  // „Új minta” is the type menu since PQW-1045; the type starts the pattern anew.
  await page.getByRole('button', { name: 'Új minta' }).click();
  await page.locator('.type[data-type="regular"]').click();
  await expect(page.locator('#summary')).toContainText('Üres minta');

  await page
    .locator('#import-file')
    .setInputFiles({ name: 'minta.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.locator('#summary')).toHaveText(before!);
});

test('PNG and SVG export with a stitch key', async ({ page }) => {
  await open(page);
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+5', 4, 2, 7);

  // The exports are in the file actions dropdown (PQW-911).
  const svgPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const svg = await readFile((await (await svgPromise).path())!, 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('Jelmagyarázat');
  expect(svg).toContain('egyráhajtásos pálca (erp)');

  const pngPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.locator('#export-open').click();
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  const pngDownload = await pngPromise;
  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);
  const png = await readFile((await pngDownload.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(2000);
});

/* ---- Japanese preset (PQW-876) ---- */

test('with the Japanese preset the half double crochet rectangle is error-free by the Japanese rule, and the pattern remembers it', async ({
  page,
}) => {
  await open(page);
  // The notation starts closed (PQW-882) and sits in the sheet (PQW-987).
  await openNotation(page);
  await page.locator('#tradition').selectOption('japanese');
  await expect(page.locator('#chart-style')).toHaveValue('jis');
  await expect(page.locator('#status')).toContainText('Előbeállítás: japán');

  // 12 chain stitches: for half double crochet the skip is 2, the first stitch goes into chain 3, and there will be 10 half double crochets (PQW-924).
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+4', 10, 3, 12);

  await expect(page.locator('#summary')).toContainText('4. sor: 11 szem.');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  // The written pattern panel starts closed (PQW-911), and does not refresh while closed.
  await page.locator('#written-toggle').click();
  const text = page.locator('#written-text');
  await expect(text).toContainText('2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 fp (11 szem).');
  await expect(text).toContainText('2 lsz (1 fp-nek számít)');

  await page.reload();
  await expect(page.locator('#tradition')).toHaveValue('japanese');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
});

/* ---- Guided crochet (PQW-879) ---- */

/** Foundation chain with the given number of chain stitches, from the keyboard only. */
async function foundation(page: Page, chains: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(chains));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
}

test('a guided cursor makes an error-free single crochet row on the foundation chain', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('Alt+3'); // single crochet
  // Enter all the way: the cursor always jumps to the next free target in the direction of travel.
  for (let i = 0; i < 11; i += 1) await page.keyboard.press('Enter');

  await expect(page.locator('#summary')).toContainText('2. sor: 11 szem');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  await expect(page.locator('#findings li')).toHaveCount(0);
});

test('an increase goes onto an occupied target without a question', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('Alt+4'); // half double crochet
  await page.keyboard.press('Enter'); // one stitch
  // One half double crochet and the turning chain that counts (PQW-891).
  await expect(page.locator('#summary')).toContainText('2. sor: 2 szem');

  // We move the cursor onto the target we have just crocheted into (an occupied one).
  await page.locator('#board').focus();
  let onUsed = false;
  for (const key of ['ArrowRight', 'ArrowLeft', 'ArrowLeft', 'Home', 'End', 'ArrowRight']) {
    await page.keyboard.press(key);
    if (/már horgoltál bele/.test((await page.locator('#status').textContent()) ?? '')) {
      onUsed = true;
      break;
    }
  }
  expect(onUsed).toBe(true);

  /*
   * Moving the cursor there is the intent itself, so there is no confirmation
   * question (PQW-931): Enter puts the second stitch straight into the same
   * target.
   */
  await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toContainText('2. sor: 3 szem');
  await expect(page.locator('#status')).toContainText('szaporítás');
  await expect(page.locator('dialog.ask')).toBeHidden();

  // It does not ask the third time either: an increase can be repeated any number of times.
  await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toContainText('2. sor: 4 szem');
  await expect(page.locator('dialog.ask')).toBeHidden();
});

test('„Sor kitöltése” fills the row in one step, and can be undone in one step', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('Alt+4'); // half double crochet
  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await expect(page.locator('#summary')).toContainText('2. sor: 11 szem');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');

  // One undo takes back the whole fill.
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(page.locator('#summary')).not.toContainText('2. sor: 11 szem');
  await expect(page.locator('#summary')).toContainText('2. sor következik.');
});
