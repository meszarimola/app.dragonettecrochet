/*
 * Sík formák (PQW-862): a „Forma” szakaszból 20 × 30 cm-es félpálcás téglalap
 * profil nélkül, becslés jelzéssel, egy lépésben visszavonva; egyenlő szárú
 * háromszög az él szögéből; szegélyes téglalap. Mindegyik hibátlan, és az írott
 * minta elkészül.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function openShapes(page: Page) {
  const section = page.locator('#section-shape');
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('20 × 30 cm-es félpálcás téglalap profil nélkül: becsült tényleges méret, hibátlan sorok, egy lépésben visszavonható', async ({ page }) => {
  await open(page);
  const section = await openShapes(page);

  await expect(page.locator('#shape-stitch')).toHaveValue('hdc');
  await expect(page.locator('#shape-size')).toHaveText(/^Tényleges méret: ≈ \d+(,\d)? × \d+(,\d)? cm, \d+ sor\.$/);
  await expect(page.locator('#shape-source')).toContainText('Nincs profil: a méret becslés 4 mm-es tűből.');
  await expect(page.locator('#shape-preview polygon')).toHaveCount(1);
  // Téglalapnál nincs szög és felső él.
  await expect(page.locator('#shape-angle')).toBeHidden();
  await expect(page.locator('#shape-top')).toBeHidden();

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText(/Téglalap, \d+ sor elkészült; visszavonással a korábbi minta visszajön\./);
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toMatch(/1\. sor: a horogtól számított 3\. láncszemtől kezdve \d+ fp \(\d+ szem\)\. Fordítás\./);

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Visszavonva.');
  await expect(page.locator('#written-text')).not.toContainText('fp');
});

test('egyenlő szárú háromszög az él szögéből, és szegélyes téglalap: hibátlan, az írott minta a szegéllyel', async ({ page }) => {
  await open(page);
  const section = await openShapes(page);

  await page.locator('#shape-kind').selectOption({ label: 'Egyenlő szárú háromszög' });
  await expect(page.locator('#shape-width-label')).toHaveText('Alsó él, cm');
  await expect(page.locator('#shape-border')).toBeHidden();
  await page.locator('#shape-measure').selectOption({ label: 'Az él szöge' });
  await expect(page.locator('#shape-height')).toBeHidden();
  await page.locator('#shape-width').fill('20');
  await page.locator('#shape-angle').fill('40');
  await expect(page.locator('#shape-details')).toContainText('Az él szöge a függőlegestől kb.');
  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Egyenlő szárú háromszög,');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  // Az alapszem a félpálca: az élek félpálcák összehorgolásával fogynak.
  expect(await writtenText(page)).toMatch(/\d\. sor: 2 lsz \(nem számít szemnek\), [23] fp összehorgolása, \d+ fp, [23] fp összehorgolása \(\d+ szem\)\./);

  await page.locator('#shape-kind').selectOption({ label: 'Téglalap' });
  await page.locator('#shape-width').fill('15');
  await page.locator('#shape-height').fill('10');
  await page.locator('#shape-border').check();
  await expect(page.locator('#shape-hdc-row-end')).toBeVisible();
  await expect(page.locator('#shape-details')).toContainText(/Szegély: \d+ rp körben, sarkonként 3, sorvégenként 2;/);
  await expect(page.locator('#shape-preview rect')).toHaveCount(1);
  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Téglalap,');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  await expect(page.locator('#written-text')).toContainText(/Szegély: 1 lsz \(nem számít szemnek\), felső él: 3 rp a sarokszembe, .*Kör zárása: 1 ksz az első szembe\./);
});
