/*
 * Amigurumi (PQW-863): az Amigurumi mintatípus az írott mintát nagyban nyitja;
 * a 6 cm-es gömb írott mintája jelöli a szemet és a tömést; a fej-test figura
 * varrva eltérő szemszámnál érthető üzenetet ad, egyenletes elosztással hibátlan.
 */

import { expect, test, type Page } from '@playwright/test';

/*
 * PQW-925: az amigurumi mintatípus az átvételi tesztelés első körében ki van
 * kapcsolva, ezért ezek a tesztek nem futnak. NEM töröljük őket: a típus
 * visszakapcsolásakor ez az egy blokk kerül ki, és a fedettség egyben
 * visszajön.
 */
test.beforeEach(() => {
  test.skip(true, 'PQW-925: az amigurumi mintatípus ideiglenesen kikapcsolva');
});

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseAmigurumi(page: Page): Promise<void> {
  await page.locator('.type[data-type="amigurumi"]').click();
  await expect(page.locator('#section-amigurumi')).toHaveAttribute('open', '');
  // A típusválasztás már nem nyitja fel az írott mintát (PQW-912): a panel a
  // felhasználóé, ezért a tesztek a gombjával nyitják ki.
  if (await page.locator('#written').isHidden()) await page.locator('#written-toggle').click();
  await expect(page.locator('#written')).toBeVisible();
}

test('amigurumiban az írott minta a gombjával nagyban nyílik; a 6 cm-es gömb mintája jelöli a szemet és a tömést', async ({ page }) => {
  await open(page);
  await chooseAmigurumi(page);

  await expect(page.locator('#written')).toBeVisible();
  const [panel, board] = await Promise.all([page.locator('#written').boundingBox(), page.locator('#board').boundingBox()]);
  expect(panel!.height / board!.height).toBeGreaterThan(0.6);

  await expect(page.locator('#amigurumi-gauge')).toContainText('Becslés a tűből');
  await expect(page.locator('#amigurumi-summary')).toContainText('18 kör, legfeljebb 36 szem');
  await page.getByRole('button', { name: 'Új minta ebből' }).click();
  await expect(page.locator('#status')).toContainText('Fej elkészült;');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toContain('Spirálban, zárás nélkül');
  expect(text).toContain('15. kör: 1 rp, (láthatatlan fogyasztás, 3 rp) ×5, láthatatlan fogyasztás, 2 rp (24). Tedd be a biztonsági szemeket.');
  expect(text).toContain('húzd össze a nyílást.');
});

test('fej-test figura varrva: eltérő szemszámnál érthető üzenet, egyenletes elosztással hibátlan', async ({ page }) => {
  await open(page);
  await chooseAmigurumi(page);
  await page.getByRole('button', { name: 'Új minta ebből' }).click();
  await expect(page.locator('#status')).toContainText('Fej elkészült;');

  await page.locator('#amigurumi-name').fill('Test');
  await page.locator('#amigurumi-shape').selectOption({ label: 'Henger' });
  await page.locator('#amigurumi-diameter').fill('5');
  await page.locator('#amigurumi-height').fill('5');
  await page.locator('#amigurumi-top').selectOption('open');
  await page.locator('#amigurumi-eyes').uncheck();
  await page.getByRole('button', { name: 'Hozzáadás részként' }).click();
  await expect(page.locator('#status')).toContainText('Kapcsold be az egyenletes elosztást');

  await page.locator('#amigurumi-distribute').check();
  await page.getByRole('button', { name: 'Hozzáadás részként' }).click();
  await expect(page.locator('#status')).toContainText('Test hozzáadva, varrva;');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toMatch(/Összeállítás\nVarrás: Test, \d+\. kör \(28\) → Fej, 14\. kör \(30\), a szemeket egyenletesen elosztva\./);
  await expect(page.locator('#amigurumi-figure')).toContainText('A figura magassága kb.');
});

test('ovális láncalapról (PQW-890): önállóan hibátlan, az 1. kör a láncszemek két oldalán; talpként egy gömbhöz varrva', async ({ page }) => {
  await open(page);
  await chooseAmigurumi(page);

  await page.locator('#amigurumi-name').fill('Talp');
  await page.locator('#amigurumi-shape').selectOption({ label: 'Ovális' });
  await expect(page.locator('#amigurumi-diameter')).toBeHidden();
  await page.locator('#amigurumi-length').fill('8');
  await page.locator('#amigurumi-width').fill('5');
  await expect(page.locator('#amigurumi-summary')).toContainText('láncszemből');
  await page.getByRole('button', { name: 'Új minta ebből' }).click();
  await expect(page.locator('#status')).toContainText('Talp elkészült;');
  // A lezárt ovális után nincs következő kör (PQW-897).
  await expect(page.locator('#status')).not.toContainText('következik');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toMatch(/1\. kör: hagyj ki 1 láncszemet, majd \d+ rp, 4 rp a következő láncszembe, a láncszemek másik oldalán vissza: \d+ rp, 3 rp a következő láncszembe \(\d+\)\./);

  // Részként: előbb a gömb, utána az ovális talp varrva, egyenletes elosztással.
  await page.locator('#amigurumi-name').fill('Fej');
  await page.locator('#amigurumi-shape').selectOption({ label: 'Gömb' });
  await page.getByRole('button', { name: 'Új minta ebből' }).click();
  await expect(page.locator('#status')).toContainText('Fej elkészült;');
  await page.locator('#amigurumi-name').fill('Talp');
  await page.locator('#amigurumi-shape').selectOption({ label: 'Ovális' });
  await page.locator('#amigurumi-eyes').uncheck();
  await page.locator('#amigurumi-distribute').check();
  await page.getByRole('button', { name: 'Hozzáadás részként' }).click();
  await expect(page.locator('#status')).toContainText('Talp hozzáadva, varrva;');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  await expect(page.locator('#written-text')).toContainText('a láncszemek másik oldalán vissza:');
});

test('pálcás ovális a generátorból (PQW-899): a szem választható, végenként 6 szaporítás, hibátlan', async ({ page }) => {
  await open(page);
  await chooseAmigurumi(page);

  await page.locator('#amigurumi-name').fill('Talp');
  await expect(page.locator('#amigurumi-stitch')).toBeHidden();
  await page.locator('#amigurumi-shape').selectOption({ label: 'Ovális' });
  await page.locator('#amigurumi-stitch').selectOption({ label: 'Egyráhajtásos pálca' });
  await page.locator('#amigurumi-length').fill('8');
  await page.locator('#amigurumi-width').fill('5');
  await expect(page.locator('#amigurumi-summary')).toContainText('láncszemből');
  await page.getByRole('button', { name: 'Új minta ebből' }).click();
  await expect(page.locator('#status')).toContainText('Talp elkészült;');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toMatch(/1\. kör: hagyj ki 3 láncszemet, majd \d+ erp, 7 erp a következő láncszembe, a láncszemek másik oldalán vissza: \d+ erp, 5 erp a következő láncszembe \(\d+\)\./);
  await expect(page.locator('#amigurumi-figure')).toContainText('lapos)');
});

/** A kurzor célpontja az ablakban (a böngészős tesztek horga, main.ts). */
async function cursorPoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(
    () => (window as unknown as { mintatervezoRacs: { cursor: () => { x: number; y: number } | null } }).mintatervezoRacs.cursor(),
  );
  expect(point).not.toBeNull();
  return point!;
}

for (const viewport of [
  { width: 1000, height: 506 },
  { width: 1440, height: 900 },
]) {
  test(`${viewport.width}×${viewport.height}: ovális 1. köre kézzel, vezetett kurzorral (PQW-899): a vég után a láncszemek másik oldalán vissza, hibátlan`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await chooseAmigurumi(page);
    // A rajz kell a célzáshoz: az írott minta panel lecsukva.
    await page.getByRole('button', { name: 'Lecsukás' }).click();

    const board = page.locator('#board');
    await board.focus();
    await page.keyboard.press('Alt+1'); // láncszem
    await page.locator('#chain-count').focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('8');
    await board.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+3'); // rövidpálca

    // Elöl: a kezdőlánc utáni láncszemtől a legtávolabbiig 7 rövidpálca, a végén még 3 ugyanabba.
    for (let k = 0; k < 7; k += 1) await page.keyboard.press('Enter');
    for (let k = 0; k < 3; k += 1) await page.keyboard.press('Shift+Enter');

    // A kurzor a láncszemek másik oldalára ugrott: az első szem kattintással, a többi billentyűvel.
    const point = await cursorPoint(page);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('#board') !== null, point)).toBe(true);
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#status')).toContainText('horgolva. 1. kör: 11 szem, még 5 célpont.');
    for (let k = 0; k < 5; k += 1) await page.keyboard.press('Enter');
    for (let k = 0; k < 2; k += 1) await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Alt+s');

    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
    // A lecsukott írott minta nem frissül: újra kinyitva olvassuk.
    if (await page.locator('#written').isHidden()) await page.locator('#written-toggle').click();
    await expect(page.locator('#written-text')).toContainText(
      '1. kör: hagyj ki 1 láncszemet, majd 6 rp, 4 rp a következő láncszembe, a láncszemek másik oldalán vissza: 5 rp, 3 rp a következő láncszembe (18).',
    );
  });
}
