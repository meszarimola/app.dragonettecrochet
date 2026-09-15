/*
 * Amigurumi (PQW-863): az Amigurumi mintatípus az írott mintát nagyban nyitja;
 * a 6 cm-es gömb írott mintája jelöli a szemet és a tömést; a fej-test figura
 * varrva eltérő szemszámnál érthető üzenetet ad, egyenletes elosztással hibátlan.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseAmigurumi(page: Page): Promise<void> {
  await page.locator('.type[data-type="amigurumi"]').click();
  await expect(page.locator('#section-amigurumi')).toHaveAttribute('open', '');
}

test('az Amigurumi típus nagyban nyitja az írott mintát; a 6 cm-es gömb mintája jelöli a szemet és a tömést', async ({ page }) => {
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
