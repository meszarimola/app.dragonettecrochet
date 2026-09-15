/*
 * A szerkesztő kritikus útjai böngészőben (PQW-857): téglalap csak
 * billentyűzettel, mentés és újratöltés, JSON, PNG és SVG export; az írott
 * minta panelje a választott jelöléssel (PQW-868).
 */

import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

/** Láncalap és sorok csak billentyűvel: 1 = láncszem, 3 = rövidpálca, 4 = félpálca, F = fordulás. */
async function rectangle(page: Page, stitchKey: string, width: number, rows: number, chains: number): Promise<void> {
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(chains));
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press(stitchKey);
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) await page.keyboard.press('f');
    for (let i = 0; i < width; i += 1) await page.keyboard.press('Enter');
  }
}

/**
 * A rögzített szöveg összevethető része: a cím és a darab neve nélkül (a
 * szerkesztőben mások), és az utolsó sor záró mondata nélkül, mert a
 * szerkesztőben még nincs fonalelvágás.
 */
function comparable(text: string): string {
  const lines = text.trimEnd().split('\n').slice(1);
  const start = lines.findIndex((line) => /^(Láncalap|Foundation):/.test(line));
  lines.splice(start - 1, 1);
  lines[lines.length - 1] = lines.at(-1)!.replace(/ (A fonal elvágása|Fasten off)\.$/, '');
  return lines.join('\n');
}

const fixture = (locale: string, name: string) =>
  readFile(new URL(`../tests/fixtures/written/${locale}/${name}.txt`, import.meta.url), 'utf8');

test('írott minta: a téglalap rögzített szövege a panelben, és jelölésváltáskor a szöveg is vált', async ({ page }) => {
  test.slow();
  await open(page);
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await rectangle(page, '4', 15, 22, 17);

  const text = page.locator('#written-text');
  await expect(text).toContainText('22. sor:');
  expect(comparable((await text.textContent())!)).toBe(comparable(await fixture('hu', 'felpalcas-teglalap')));

  // A jelölés szakasza alapból csukva van (PQW-882).
  await page.locator('#section-notation').evaluate((el) => { (el as HTMLDetailsElement).open = true; });
  await page.locator('#terms').selectOption('en-US');
  await expect(text).toContainText('Row 22:');
  expect(comparable((await text.textContent())!)).toBe(comparable(await fixture('en-US', 'felpalcas-teglalap')));
  await expect(page.locator('#palette')).toContainText('Half double crochet (hdc)');

  // A jelölés szakasza alapból csukva van (PQW-882).
  await page.locator('#section-notation').evaluate((el) => { (el as HTMLDetailsElement).open = true; });
  await page.locator('#terms').selectOption('en-GB');
  await expect(text).toContainText('Abbreviations (UK terms)');
  await expect(text).toContainText('15 htr (15 sts)');
  expect(await text.textContent()).not.toMatch(/\b(sc|hdc|sl st)\b/);

  // A választás újratöltés után megmarad, a felület nyelve közben magyar.
  await page.reload();
  await expect(page.locator('#terms')).toHaveValue('en-GB');
  await expect(text).toContainText('Stitch key (UK terms)');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
});

test('10 × 10 félpálcás téglalap csak billentyűzettel, hibátlanul', async ({ page }) => {
  await open(page);
  // A láncszem-mező csak láncszemnél látszik; előbb kiválasztjuk.
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await rectangle(page, '4', 10, 10, 12);

  await expect(page.locator('#summary')).toContainText('10 sor.');
  await expect(page.locator('#summary')).toContainText('10. sor: 10 szem.');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  await expect(page.locator('#findings li')).toHaveCount(0);
});

test('a minta újratöltés után megmarad, és JSON-ként visszatölthető', async ({ page }) => {
  await open(page);
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await rectangle(page, '3', 5, 2, 6);
  const before = await page.locator('#summary').textContent();
  expect(before).toContain('2. sor: 5 szem.');

  await page.reload();
  await expect(page.locator('#summary')).toHaveText(before!);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON mentése' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const json = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(json).formatVersion).toBe(1);

  await page.getByRole('button', { name: 'Új minta' }).click();
  await expect(page.locator('#summary')).toContainText('Üres minta');

  await page.locator('#import-file').setInputFiles({ name: 'minta.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await expect(page.locator('#summary')).toHaveText(before!);
});

test('PNG és SVG export jelmagyarázattal', async ({ page }) => {
  await open(page);
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await rectangle(page, '5', 4, 2, 7);

  const svgPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const svg = await readFile((await (await svgPromise).path())!, 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('Jelmagyarázat');
  expect(svg).toContain('egyráhajtásos pálca (erp)');

  const pngPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PNG', exact: true }).click();
  const pngDownload = await pngPromise;
  expect(pngDownload.suggestedFilename()).toMatch(/\.png$/);
  const png = await readFile((await pngDownload.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.length).toBeGreaterThan(2000);
});

/* ---- Japán előbeállítás (PQW-876) ---- */

test('japán előbeállítással a félpálcás téglalap a japán szabály szerint hibátlan, és a minta megjegyzi', async ({ page }) => {
  await open(page);
  // A jelölés szakasza alapból csukva van (PQW-882).
  await page.locator('#section-notation').evaluate((el) => { (el as HTMLDetailsElement).open = true; });
  await page.locator('#tradition').selectOption('japanese');
  await expect(page.locator('#chart-style')).toHaveValue('jis');
  await expect(page.locator('#status')).toContainText('Előbeállítás: japán');

  // 12 láncszem: a félpálca a 4. láncszemtől, 9 félpálca és a számító fordulólánc = 10 szem.
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await rectangle(page, '4', 9, 3, 12);

  await expect(page.locator('#summary')).toContainText('3. sor: 10 szem.');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  const text = page.locator('#written-text');
  await expect(text).toContainText('a horogtól számított 4. láncszemtől kezdve');
  await expect(text).toContainText('2 lsz (1 fp-nek számít)');

  await page.reload();
  await expect(page.locator('#tradition')).toHaveValue('japanese');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
});

/* ---- Vezetett horgolás (PQW-879) ---- */

/** Láncalap a megadott láncszemszámmal, csak billentyűvel. */
async function foundation(page: Page, chains: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(chains));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
}

test('a láncalapra a vezetett kurzorral hibátlan rövidpálcás sor készül', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('3'); // rövidpálca
  // Enterrel végig: a kurzor mindig a következő szabad célpontra ugrik a haladási irányban.
  for (let i = 0; i < 11; i += 1) await page.keyboard.press('Enter');

  await expect(page.locator('#summary')).toContainText('1. sor: 11 szem');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  await expect(page.locator('#findings li')).toHaveCount(0);
});

test('foglalt célpontnál kérdés jön, és a „Mégse” után nem kerül le szem', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('4'); // félpálca
  await page.keyboard.press('Enter'); // egy szem
  await expect(page.locator('#summary')).toContainText('1. sor: 1 szem');

  // A kurzort a most horgolt (foglalt) célpontra visszük.
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

  await page.keyboard.press('Enter');
  const dialog = page.locator('dialog.ask');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('már horgoltál');
  await dialog.getByRole('button', { name: 'Mégse' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#status')).toHaveText('Nem került le szem.');
  await expect(page.locator('#summary')).toContainText('1. sor: 1 szem');

  // „Szaporítás” után viszont lekerül a szem.
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Szaporítás' }).click();
  await expect(page.locator('#summary')).toContainText('1. sor: 2 szem');
});

test('a „Sor kitöltése” egy lépésben kitölti a sort, és egy lépésben visszavonható', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('4'); // félpálca
  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await expect(page.locator('#summary')).toContainText('1. sor: 10 szem');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');

  // Egy visszavonás az egész kitöltést visszaveszi.
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(page.locator('#summary')).not.toContainText('1. sor: 10 szem');
  await expect(page.locator('#summary')).toContainText('1. sor következik.');
});
