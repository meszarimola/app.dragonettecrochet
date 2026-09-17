/*
 * Rácsos technikák (PQW-864): a Filéhorgolás típus lenyitja a Rácsminta
 * szakaszt; kis filémotívum, amelynek csak az első sorai teljesek, a
 * felismert ismétlő egységgel hibátlan mintát ad; C2C-kép két színnel
 * hibátlan, és az írott minta a színeket csempénként írja. A tükrözött nézet
 * megszűnt (PQW-911), ezért a feliratos motívum nem ad figyelmeztetést.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
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

test('kis filémotívum: az első két sor teljes, a többi az ismétlő egységből; billentyűzettel festve, hibátlan, ismétlésként írva', async ({ page }) => {
  await open(page);
  await page.locator('.type[data-type="filet"]').click();
  const section = page.locator('#section-grid');
  await expect(section).toHaveAttribute('open', '');

  await setSize(page, 8, 4);
  await expect(page.locator('#grid-board [role="gridcell"]')).toHaveCount(32);
  await expect(page.locator('#grid-ratio')).toContainText('a rács a mintasűrűség arányában látszik');

  // 1. sor: teli minden páros cella; 2. sor: teli minden páratlan (a nyitott az alapértelmezés).
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
  await expect(cell(page, 1, 1)).toHaveAttribute('aria-label', '2. sor, 2. cella: teli');

  // A 3. és a 4. sorban csak az első két cella (az ismétlés) van megadva, a többi törölve: az ismétlésből töltődik.
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
  await expect(page.locator('#grid-details')).toContainText('Ismétlő egység: 2 × 2 cella, a teljes 8 × 4 cellás rácsra kiterjesztve.');

  // A rács billentyűi nem jutottak el a vászonhoz: a Delete nem az utolsó lépést törölte.
  await expect(page.locator('#status')).not.toContainText('törölve');
  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Filé: 4 sor elkészült; visszavonással a korábbi minta visszajön.');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toMatch(/1. sor – alapsor: \d+ lsz\./);
  expect(text).toMatch(/\[[^\]]+\] \d+-(szor|szer|ször)/);
  await expect(section.getByRole('button', { name: 'Rács a mostani mintából' })).toBeEnabled();
});

test('C2C-kép két színnel: 6 átlós sor, hibátlan, színek csempénként; a feliratos motívum nem figyelmeztet', async ({ page }) => {
  await open(page);
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

  // A tükrözött nézet gombja megszűnt (PQW-911): a feliratos motívum sem ad figyelmeztetést.
  await section.getByLabel(/Feliratos motívum/).check();
  await expect(page.locator('.tools [data-action="mirror"]')).toHaveCount(0);
  await expect(page.locator('#grid-warnings li')).toHaveCount(0);

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Sarokból sarokba (C2C): 6 sor elkészült');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toContain('Színek: A – Natúr, B – Bordó.');
  expect(text).toContain('Színek csempénként, a haladási irányban:');
  expect(text).toContain('(az utolsó ráhajtásnál válts');
});
