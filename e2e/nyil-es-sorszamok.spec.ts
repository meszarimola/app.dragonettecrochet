/*
 * A kurzor nyila, a sorfeliratok és az állapotszöveg a rajzon (PQW-916).
 *
 * Mindhárom pontot a tulajdonos élőben reprodukálta: 12 láncszem és egy
 * fordulás után a nyíl átfut a szemeken, a sorok mellett nincs számozás, és a
 * vászon fölött lebeg egy állapotszöveg.
 *
 * A tanulság a PQW-912-ből: az átfedést MÉRNI kell, nem szemre nézni — ott
 * pont ez hiányzott, és háromszor csúszott át miatta ugyanaz a hiba. Ezért
 * ezek a tesztek a felület böngészős horgából (`window.mintatervezoRacs`,
 * src/ui/main.ts) kérik el a nyíl, a szemek és a feliratok dobozát, és
 * metszést számolnak.
 */

import { expect, test, type Page } from '@playwright/test';

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
  // Az írott minta panelje csukva indul (PQW-911, PQW-915): nem takarja a vásznat.
  await expect(page.locator('#written')).toBeHidden();
}

/**
 * A jegy esete: 12 láncszem, fordulás, majd az 1. sor első szemei — csak
 * billentyűvel (PQW-911).
 *
 * A fordulás önmagában még nem hoz iránynyilat: az 1. sor ilyenkor nincs benne
 * a gráfban, és a `directionArrow()` (src/ui/main.ts) csak akkor rajzol, ha a
 * sornak van szeme. Megmértem: lánc és fordulás után a nyíl doboza `null`, az
 * első félpálca után jelenik meg — ezért rak le a beállítás szemeket is.
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

/** Két doboz metszi-e egymást. A fél képpontnyi érintkezés még nem takarás. */
function overlaps(a: Rect, b: Rect): boolean {
  return Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
}

const describe = (r: Rect) => `[${r.left.toFixed(1)}, ${r.top.toFixed(1)} – ${r.right.toFixed(1)}, ${r.bottom.toFixed(1)}]`;

/*
 * A nyíl a rajzról a sorszámok sávjába került (PQW-929). A PQW-916 megoldása a
 * sor jelei fölé emelte, de épp a KÖVETKEZŐ sor rácssávjába és téglalapjára
 * esett; a tulajdonos döntése: „mellé tedd, ne rá. és írd ki, hogy hanyadik
 * sor.” A mérés ezért már nem a rajzon keresi a nyilat, hanem a feliratok
 * között — és azt is ellenőrzi, hogy a felirat nem takar semmit.
 */
test('a következő sor felirata a rajz mellett áll, nyíllal, és nem takar semmit (PQW-929)', async ({ page }) => {
  await open(page);

  // 12 láncszem, majd fordulás: a 2. sor nyitva van, de még üres.
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');

  expect(await api<Rect | null>(page, 'arrowBox'), 'a rajzon nincs többé iránynyíl').toBeNull();

  const labels = await api<LabelBox[]>(page, 'labelBoxes');
  const next = labels.find((label) => /[←→]/.test(label.text));
  expect(next, `a következő sor felirata nyíllal: ${labels.map((l) => l.text).join(' | ')}`).toBeDefined();
  expect(next!.text, 'kiírja, hányadik sor következik').toMatch(/2\. sor/);

  const stitches = await api<StitchBox[]>(page, 'stitchBoxes');
  for (const stitch of stitches) {
    expect(overlaps(next!, stitch), `a felirat ${describe(next!)} takarja a ${stitch.id} szemet ${describe(stitch)}`).toBe(false);
  }
  // A sorszámok feliratára sem csúszik rá: a láncalap feliratával sem fedi egymást.
  for (const other of labels.filter((label) => label !== next)) {
    expect(overlaps(next!, other), `a következő sor felirata takarja ezt: „${other.text}”`).toBe(false);
  }
});

test('minden sor mellett ott a sorszám és a szemszám, takarás nélkül (PQW-916)', async ({ page }) => {
  await open(page);
  await foundationTurnAndRow(page);

  const labels = await api<LabelBox[]>(page, 'labelBoxes');
  const stitches = await api<StitchBox[]>(page, 'stitchBoxes');
  const arrow = await api<Rect | null>(page, 'arrowBox');

  /*
   * A láncalap a PQW-923 óta maga az 1. sor, a szemszámával. A szám a rajzon
   * lévő láncszem-jeleké: fordulás után kettő közülük az 1. sor fordulóláncába
   * kerül át (a félpálca a horogtól számított 3. láncszembe megy), ezért a
   * tizenkettőből tíz marad a 0. rétegen. A felirat így a rajzzal egyezik, és
   * nem egy másik szemszámot állít.
   */
  const foundation = labels.find((label) => label.layer === 0);
  expect(foundation, 'a láncalapnak is van felirata').toBeDefined();
  expect(foundation!.text, 'a láncalap az 1. sor, a rajzolt láncszemeivel').toMatch(/^1\. sor – alapsor \(\d+\)$/);

  const row = labels.find((label) => label.layer === 1);
  expect(row, 'az 1. sornak is van felirata').toBeDefined();
  expect(row!.text, 'a sorszám és a szemszám egy feliraton').toMatch(/^2\. sor \(\d+\)$/);

  /*
   * A felirat a RAJZ mellett áll, nem a rajzon belül. A doboz-átfedés erre
   * kevés: a félkész sor felirata a rajz közepén, a korábbi sorok szemei fölött
   * ült, és mégsem metszett egyetlen jelet sem — a képen viszont azonnal
   * látszott. Ezért itt vízszintesen mérünk: minden feliratnak a jelek sávján
   * kívül kell lennie.
   */
  const right = Math.max(...stitches.map((stitch) => stitch.right));
  const left = Math.min(...stitches.map((stitch) => stitch.left));
  const types = (await page.locator('#types').boundingBox())!;
  const panel = (await page.locator('#panel').boundingBox())!;
  for (const label of labels) {
    // A rajz mellett áll — vagy a látható sáv széléhez simulva, ha ott már nem férne el.
    const besideChart = label.left >= right - 0.5 || label.right <= left + 0.5;
    const hugsEdge = label.left <= types.x + types.width + 8 || label.right >= panel.x - 8;
    expect(besideChart || hugsEdge, `a(z) „${label.text}” felirat a jelek közé szorult ${describe(label)}`).toBe(true);
  }

  for (const label of labels) {
    for (const stitch of stitches) {
      expect(overlaps(label, stitch), `a(z) ${label.layer}. felirat ${describe(label)} takarja a ${stitch.id} szemet ${describe(stitch)}`).toBe(false);
    }
    if (arrow) expect(overlaps(label, arrow), `a(z) ${label.layer}. felirat takarja a nyilat ${describe(arrow)}`).toBe(false);
  }
});

/*
 * Az „Egész minta” illesztése a feliratokról is tudjon (PQW-916).
 *
 * Ezt a doboz-átfedés nem fogta meg: a feliratok a rajz mellett rendben voltak,
 * csak épp a jobb szélső kicsúszott a jelkészlet-panel alá, és olvashatatlan
 * lett. A képen rögtön látszott, mérés viszont nem volt rá — most van.
 */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: az „Egész minta” után a feliratok a két oldalsáv között maradnak (PQW-916)`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await foundationTurnAndRow(page);
    await page.getByRole('button', { name: 'Egész minta' }).click();
    await page.waitForTimeout(200);

    const labels = await api<LabelBox[]>(page, 'labelBoxes');
    expect(labels.length, 'van mit elhelyezni').toBeGreaterThan(0);
    const types = (await page.locator('#types').boundingBox())!;
    const panel = (await page.locator('#panel').boundingBox())!;

    for (const label of labels) {
      expect(label.left, `a(z) „${label.text}” felirat a mintatípus-sáv alá csúszik ${describe(label)}`).toBeGreaterThanOrEqual(types.x + types.width - 0.5);
      expect(label.right, `a(z) „${label.text}” felirat a jelkészlet-panel alá csúszik ${describe(label)}`).toBeLessThanOrEqual(panel.x + 0.5);
    }
  });
}

/*
 * Szűk ablak, hosszabb felirat (PQW-916).
 *
 * Az angol „Foundation chain (10)” jóval szélesebb a magyar „Láncalap (10)”-nél,
 * és 1000×506-ban a rajz jobb oldalán már nincs neki hely. A böngészős szemle
 * mérte meg, hogy ilyenkor a felirat visszacsúszik a jelek fölé (n9, n10) — a
 * korábbi esetek ezt nem fogták meg, mert magyarul és az „Egész minta” utáni
 * nézetben mérnek. A felirat inkább lógjon ki, mint hogy takarjon.
 */
test('1000×506, angol felület: a hosszabb felirat sem csúszik a szemekre (PQW-916)', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await page.goto('/?lang=en');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await foundationTurnAndRow(page);

  const labels = await api<LabelBox[]>(page, 'labelBoxes');
  const stitches = await api<StitchBox[]>(page, 'stitchBoxes');
  const arrow = await api<Rect | null>(page, 'arrowBox');
  expect(labels.map((label) => label.text)).toContain('Row 1 – foundation (10)');

  for (const label of labels) {
    for (const stitch of stitches) {
      expect(overlaps(label, stitch), `a(z) „${label.text}” felirat ${describe(label)} takarja a ${stitch.id} szemet ${describe(stitch)}`).toBe(false);
    }
    if (arrow) expect(overlaps(label, arrow), `a(z) „${label.text}” felirat takarja a nyilat ${describe(arrow)}`).toBe(false);
  }
});

test('a vászon területén nincs lebegő állapotszöveg, de az élő régió megmarad (PQW-916)', async ({ page }) => {
  await open(page);
  await foundationTurnAndRow(page);

  const status = page.locator('#status');
  // A felület jelzést ad: a szöveg a képernyőolvasónak megmarad. (Fordulás után
  // ez a „Láncalap kész…” üzenet; a szövegét nem kötjük meg, csak azt, hogy van.)
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await expect(status).not.toBeEmpty();

  // De a látható rajz fölé nem kerül: a doboza legfeljebb a rejtett élő régió mérete.
  const box = await status.boundingBox();
  const area = box ? box.width * box.height : 0;
  expect(area, `az állapotszöveg még mindig a vászon fölött lebeg: ${box ? describe({ left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height }) : 'nincs doboza'}`).toBeLessThanOrEqual(4);
});
