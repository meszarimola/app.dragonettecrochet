/*
 * Kendőformák (PQW-865): a „Kendő” szakaszból fentről induló pálcás
 * háromszög profil nélkül, saját aránnyal figyelmeztetéssel, egy lépésben
 * visszavonva; félkör rövidpálcával. Mindegyik hibátlan, és az írott minta
 * elkészül.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function openShawls(page: Page) {
  const section = page.locator('#section-shawl');
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('fentről induló háromszög: blokkolt és blokkolatlan méret, saját arány figyelmeztetéssel, hibátlan sorok, egy lépésben visszavonható', async ({ page }) => {
  await open(page);
  const section = await openShawls(page);

  await expect(page.locator('#shawl-stitch')).toHaveValue('dc');
  await expect(page.locator('#shawl-result')).toHaveText(/^Blokkolás nélkül ≈ \d+ × \d+ cm, blokkolva ≈ \d+ × \d+ cm; \d+ sor\.$/);
  await expect(page.locator('#shawl-details')).toContainText('A nyakél szöge kb. 180°');
  await expect(page.locator('#shawl-preview polygon')).toHaveCount(2);
  await expect(page.locator('#shawl-warnings li')).toHaveCount(0);
  await expect(page.locator('#shawl-length')).toBeHidden();

  // Saját, kisebb arány: figyelmeztetés, de a minta elkészül.
  await page.locator('#shawl-rate').selectOption({ label: 'Saját arány' });
  await page.locator('#shawl-custom').fill('5');
  await expect(page.locator('#shawl-warnings li')).toHaveCount(1);
  await expect(page.locator('#shawl-warnings')).toContainText('Ez figyelmeztetés, nem hiba.');

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText(/Fentről induló háromszög, \d+ sor elkészült; visszavonással a korábbi minta visszajön\./);
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  expect(await writtenText(page)).toMatch(/2\. sor: 3 lsz \(1 erp-nek számít\), .*\(\d+ szem\)\. Fordítás\./);

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Visszavonva.');
  await expect(page.locator('#written-text')).not.toContainText('erp');
});

test('félkör rövidpálcával: sugár, egyenletes szaporítás, hibátlan', async ({ page }) => {
  await open(page);
  const section = await openShawls(page);

  await page.locator('#shawl-kind').selectOption({ label: 'Félkör' });
  await page.locator('#shawl-stitch').selectOption({ label: 'Rövidpálca' });
  await expect(page.locator('#shawl-size-label')).toHaveText('Sugár, cm');
  await expect(page.locator('#shawl-wings')).toBeHidden();
  await page.locator('#shawl-size').fill('12');
  await expect(page.locator('#shawl-result')).toHaveText(/cm átmérő; \d+ sor\.$/);
  await expect(page.locator('#shawl-details')).toContainText('(π · h/w)');

  await section.getByRole('button', { name: 'Minta létrehozása' }).click();
  await expect(page.locator('#status')).toContainText('Félkör,');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  // A rövidpálcás fordulólánc az 1. szem helyett áll, alapláncszemen (PQW-891).
  expect(await writtenText(page)).toMatch(
    /1\. sor: hagyj ki 2 láncszemet, majd \d+ rp a következő láncszembe \(\d+ szem\)\. Fordítás\./,
  );
});
