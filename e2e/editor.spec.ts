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

/** Láncalap és sorok csak billentyűvel (PQW-911): Alt+1 = láncszem, Alt+3 = rövidpálca, Alt+4 = félpálca, Alt+F = fordulás. */
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
    // A fordult sor első szeme a fordulólánc lesz (PQW-944), ezért ott eggyel többször horgolunk.
    for (let i = 0; i < width + (row > 1 ? 1 : 0); i += 1) await page.keyboard.press('Enter');
  }
}

/**
 * A rögzített szöveg összevethető része: a cím és a darab neve nélkül (a
 * szerkesztőben mások), és az utolsó sor záró mondata nélkül, mert a
 * szerkesztőben még nincs fonalelvágás.
 */
function comparable(text: string): string {
  const lines = text.trimEnd().split('\n').slice(1);
  // A láncalap sora a PQW-923 óta „1. sor – alapsor:”, angolul „Row 1 – foundation:”.
  const start = lines.findIndex((line) => /^(1\. sor – alapsor|Row 1 – foundation):/.test(line));
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
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+4', 15, 22, 17);

  // Az írott minta panelje csukva indul (PQW-911), és csukva nem frissül.
  await page.locator('#written-toggle').click();
  const text = page.locator('#written-text');
  await expect(text).toContainText('23. sor:');
  /*
   * A tervezőben rajzolt téglalap a mai szabály szerint épül (PQW-944): a
   * fordulólánc a sor első szemének helyén áll, ezért a szöveg kiírja a
   * kihagyást. A kidolgozott példa rögzített szövege még a korábbi
   * szerkezetet őrzi (a példák és a generátorok átállítása PQW-945), ezért itt
   * a sorokat soronként vetjük össze.
   */
  const lines = comparable((await text.textContent())!).split('\n');
  const reference = comparable(await fixture('hu', 'felpalcas-teglalap')).split('\n');
  expect(lines.filter((line) => !/^\d/.test(line))).toEqual(reference.filter((line) => !/^\d/.test(line)));
  expect(lines.find((line) => line.startsWith('1. sor'))).toBe('1. sor – alapsor: 17 lsz.');
  expect(lines.find((line) => line.startsWith('2. sor'))).toBe('2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 fp (16 szem). Fordítás.');
  expect(lines.find((line) => line.startsWith('3–22. sor'))).toBe('3–22. sor: 2 lsz (1 fp-nek számít), 1 szem kihagyása, 15 fp (16 szem). Fordítás.');

  // A jelölés szakasza alapból csukva van (PQW-882).
  await page.locator('#section-notation').evaluate((el) => { (el as HTMLDetailsElement).open = true; });
  await page.locator('#terms').selectOption('en-US');
  await expect(text).toContainText('Row 23:');
  const english = comparable((await text.textContent())!).split('\n');
  const englishReference = comparable(await fixture('en-US', 'felpalcas-teglalap')).split('\n');
  expect(english.filter((line) => !/^Rows? /.test(line) && line !== 'sk – skip')).toEqual(englishReference.filter((line) => !/^Rows? /.test(line)));
  expect(english.find((line) => line.startsWith('Rows 3–22'))).toBe('Rows 3–22: ch 2 (counts as 1 hdc), sk 1 st, 15 hdc (16 sts). Turn.');
  await expect(page.locator('#palette')).toContainText('Half double crochet (hdc)');

  // A jelölés szakasza alapból csukva van (PQW-882).
  await page.locator('#section-notation').evaluate((el) => { (el as HTMLDetailsElement).open = true; });
  await page.locator('#terms').selectOption('en-GB');
  await expect(text).toContainText('Abbreviations (UK terms)');
  // A fordulólánc az 1. szem helyett áll (PQW-891): 14 félpálca és a fordulólánc.
  await expect(text).toContainText('15 htr (16 sts)');
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
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+4', 10, 10, 12);

  await expect(page.locator('#summary')).toContainText('10 sor.');
  await expect(page.locator('#summary')).toContainText('11. sor: 11 szem.');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  await expect(page.locator('#findings li')).toHaveCount(0);
});

test('a minta újratöltés után megmarad, és JSON-ként visszatölthető', async ({ page }) => {
  await open(page);
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+3', 4, 2, 6);
  const before = await page.locator('#summary').textContent();
  expect(before).toContain('3. sor: 5 szem.');

  await page.reload();
  await expect(page.locator('#summary')).toHaveText(before!);

  const downloadPromise = page.waitForEvent('download');
  // A mentés a fájlműveletek lenyílójában van (PQW-911).
  await page.locator('#file-toggle').click();
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
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+5', 4, 2, 7);

  // Az exportok a fájlműveletek lenyílójában vannak (PQW-911).
  const svgPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
  await page.getByRole('button', { name: 'SVG', exact: true }).click();
  const svg = await readFile((await (await svgPromise).path())!, 'utf8');
  expect(svg).toContain('<svg');
  expect(svg).toContain('Jelmagyarázat');
  expect(svg).toContain('egyráhajtásos pálca (erp)');

  const pngPromise = page.waitForEvent('download');
  await page.locator('#file-toggle').click();
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

  // 12 láncszem: félpálcánál 2 a kihagyás, az első szem a 3. láncszembe, és 10 félpálca lesz (PQW-924).
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await rectangle(page, 'Alt+4', 10, 3, 12);

  await expect(page.locator('#summary')).toContainText('4. sor: 11 szem.');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  // Az írott minta panelje csukva indul (PQW-911), és csukva nem frissül.
  await page.locator('#written-toggle').click();
  const text = page.locator('#written-text');
  await expect(text).toContainText('2. sor: hagyj ki 2 láncszemet, majd minden láncszembe 1 fp (11 szem).');
  await expect(text).toContainText('2 lsz (1 fp-nek számít)');

  await page.reload();
  await expect(page.locator('#tradition')).toHaveValue('japanese');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
});

/* ---- Vezetett horgolás (PQW-879) ---- */

/** Láncalap a megadott láncszemszámmal, csak billentyűvel. */
async function foundation(page: Page, chains: number): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(String(chains));
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
}

test('a láncalapra a vezetett kurzorral hibátlan rövidpálcás sor készül', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('Alt+3'); // rövidpálca
  // Enterrel végig: a kurzor mindig a következő szabad célpontra ugrik a haladási irányban.
  for (let i = 0; i < 11; i += 1) await page.keyboard.press('Enter');

  await expect(page.locator('#summary')).toContainText('2. sor: 11 szem');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');
  await expect(page.locator('#findings li')).toHaveCount(0);
});

test('foglalt célpontra kérdés nélkül kerül a szaporítás', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('Alt+4'); // félpálca
  await page.keyboard.press('Enter'); // egy szem
  // Egy félpálca és a számító fordulólánc (PQW-891).
  await expect(page.locator('#summary')).toContainText('2. sor: 2 szem');

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

  /*
   * A kurzor odavitele maga a szándék, ezért nincs megerősítő kérdés
   * (PQW-931): az Enter azonnal leteszi a második szemet ugyanabba a célpontba.
   */
  await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toContainText('2. sor: 3 szem');
  await expect(page.locator('#status')).toContainText('szaporítás');
  await expect(page.locator('dialog.ask')).toBeHidden();

  // Harmadszorra sem kérdez: a szaporítás akárhányszor ismételhető.
  await page.keyboard.press('Enter');
  await expect(page.locator('#summary')).toContainText('2. sor: 4 szem');
  await expect(page.locator('dialog.ask')).toBeHidden();
});

test('a „Sor kitöltése” egy lépésben kitölti a sort, és egy lépésben visszavonható', async ({ page }) => {
  await open(page);
  await foundation(page, 12);
  await page.keyboard.press('Alt+4'); // félpálca
  await page.getByRole('button', { name: 'Sor kitöltése' }).click();
  await expect(page.locator('#summary')).toContainText('2. sor: 11 szem');
  await expect(page.locator('#summary')).toContainText('Nincs hiba és figyelmeztetés.');

  // Egy visszavonás az egész kitöltést visszaveszi.
  await page.getByRole('button', { name: 'Visszavonás' }).click();
  await expect(page.locator('#summary')).not.toContainText('2. sor: 11 szem');
  await expect(page.locator('#summary')).toContainText('2. sor következik.');
});
