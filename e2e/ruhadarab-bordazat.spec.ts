/*
 * Bordás szegély és mandzsetta a „Ruhadarab” szakaszban (PQW-913): ledobott
 * vállú pulóver és felülről horgolt raglán bordázattal, hibátlanul, az írott
 * mintában ismétlésként. A raglán mért körös mintasűrűséget kíván, ezért a
 * „Méret és fonal” szakaszban profilt adunk meg.
 *
 * A nyak bordázata nincs benne: ahhoz a gráfnak az él mentén kellene szemeket
 * felszednie, és a szegélygenerálás a PQW-911-ben szándékosan kikerült.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function openSection(page: Page, id: string) {
  const section = page.locator(`#${id}`);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

/** Kitöltés és kilépés a mezőből, hogy a változás érvényesüljön. */
async function enter(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).fill(value);
  await page.locator(selector).press('Tab');
}

/** Mért körös mintasűrűség profilban: a raglán ezt kívánja (PQW-901). */
async function roundGauge(page: Page): Promise<void> {
  await openSection(page, 'section-size');
  await page.getByRole('button', { name: 'Új profil' }).click();
  await enter(page, '#size-yarn-name', 'Pamut');
  await enter(page, '#size-hook', '5');
  await page.locator('#size-gauge-add').click();
  const row = page.locator('#size-gauges li[data-index="0"]');
  await row.locator('[data-field="stitch"]').selectOption('dc');
  await row.locator('[data-field="form"]').selectOption('rounds');
  await row.locator('[data-field="stitchesPer10cm"]').fill('15');
  await row.locator('[data-field="stitchesPer10cm"]').press('Tab');
  await row.locator('[data-field="rowsPer10cm"]').fill('8');
  await row.locator('[data-field="rowsPer10cm"]').press('Tab');
  await page.locator('#section-size > summary').click();
}

/** A bordázat bekapcsolása a Ruhadarab panelen, sorszámmal és bordaszélességgel. */
async function turnOnRibbing(page: Page, rows: string, width: string): Promise<void> {
  await expect(page.locator('#garment-ribbing-pair')).toBeHidden();
  await page.locator('#garment-ribbing').check();
  await expect(page.locator('#garment-ribbing-pair')).toBeVisible();
  await enter(page, '#garment-ribbing-rows', rows);
  await enter(page, '#garment-ribbing-width', width);
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: ledobott vállú pulóver bordás szegéllyel és mandzsettával`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openSection(page, 'section-garment');

    await expect(page.locator('#garment-kind')).toHaveValue('drop-shoulder');
    await turnOnRibbing(page, '2', '1');

    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

    const text = await writtenText(page);
    // A bordás sor fordulólánca egy láncszemmel rövidebb, és nem számít szemnek (01 §2.2 [S25]).
    expect(text).toMatch(/2 lsz \(nem számít szemnek\)/);
    // A bordázat ismétlésként áll, nem szemenként felsorolva.
    expect(text).toMatch(/\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/);
    // Az 1. sor sima marad: a láncalap köré nem lehet relief szemet horgolni.
    expect(text).not.toMatch(/^1\. sor:.*(Eerp|Herp)/m);
  });

  test(`${viewport.width}×${viewport.height}: felülről horgolt raglán bordás szegéllyel és mandzsettával`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await roundGauge(page);
    const section = await openSection(page, 'section-garment');

    await page.locator('#garment-kind').selectOption({ label: 'Felülről horgolt raglán' });
    await expect(page.locator('#garment-size')).toHaveValue('M');
    await turnOnRibbing(page, '2', '1');

    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

    const text = await writtenText(page);
    // A törzs alsó szegélye és az ujjak mandzsettája relief szemmel, körben ismétlésként.
    expect(text).toMatch(/\(1 (Eerp|Herp), 1 (Eerp|Herp)\) ×\d+/);
    // Az ujj csöve a hónaljtól a mandzsettáig (PQW-913).
    expect(text).toMatch(/Ujj \(2 db\):/);
  });
}

test('a sapkának nincs bordás szegélye: a választás sem jelenik meg', async ({ page }) => {
  await open(page);
  await openSection(page, 'section-garment');
  await page.locator('#garment-kind').selectOption({ label: 'Sapka' });
  await expect(page.locator('#garment-ribbing-fields')).toBeHidden();
});
