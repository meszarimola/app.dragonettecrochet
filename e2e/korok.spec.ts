/*
 * Körök és motívumok (PQW-861): a „Kör és motívum” szakaszból lapos kör és
 * nagymama-négyzet, az írott minta körsoraival; a K billentyű a láncszemekből
 * láncgyűrűt zár.
 */

import { expect, test, type Page } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function generate(page: Page, choices: { shape?: string; start?: string; rounds: number }): Promise<void> {
  const section = page.locator('#section-rounds');
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  if (choices.shape) await page.locator('#rounds-shape').selectOption({ label: choices.shape });
  if (choices.start) await page.locator('#rounds-start').selectOption({ label: choices.start });
  await page.locator('#rounds-count').fill(String(choices.rounds));
  await page.locator('#rounds-count').press('Tab');
  await page.getByRole('button', { name: 'Minta létrehozása' }).click();
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('lapos kör rövidpálcával: becsült szaporítás, hibátlan körök, a körök sora a tudásbázis szerint', async ({ page }) => {
  await open(page);
  await generate(page, { rounds: 4 });

  await expect(page.locator('#rounds-note')).toContainText('Körönként 6 szaporítás');
  await expect(page.locator('#rounds-note')).toContainText('Becslés');
  await expect(page.locator('#status')).toContainText('Lapos kör, 4 kör elkészült;');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

  const text = await writtenText(page);
  expect(text).toContain('3. kör: 1 lsz (nem számít szemnek), (szap., 1 rp) ×6 (18). Kör zárása: 1 ksz az első szembe.');
  expect(text).toContain('4. kör: 1 lsz (nem számít szemnek), 1 rp, (szap., 2 rp) ×5, szap., 1 rp (24).');

  // A körszámok a vásznon: négy kör címkéje.
  const labels = await page.evaluate(() => (window as unknown as { mintatervezoRacs: { labels(): unknown[] } }).mintatervezoRacs.labels());
  expect(labels).toHaveLength(4);

  // Visszavonással a korábbi (üres) minta jön vissza.
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Visszavonva.');
});

test('nagymama-négyzet láncgyűrűvel, és a K billentyű a láncszemekből láncgyűrűt zár', async ({ page }) => {
  await open(page);
  await generate(page, { shape: 'Nagymama-négyzet', start: 'Láncgyűrű', rounds: 3 });

  await expect(page.locator('#rounds-stitch')).toBeDisabled();
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toContain('Láncgyűrű: 4 lsz, 1 ksz-szel gyűrűvé zárva.');
  expect(text).toContain('1. kör: 3 lsz (1 erp-nek számít), 2 erp a gyűrűbe, 2 lsz, (3 erp a gyűrűbe, 2 lsz) ×3 (20).');
  expect(text).toMatch(/3\. kör: .*\(36\)\. Kör zárása: 1 ksz a kezdőlánc tetejébe\./);

  // Új minta, 6 láncszem, K: láncgyűrű.
  await page.locator('[data-action="new"]').click();
  await page.locator('#chain-count').fill('6');
  await page.locator('#chain-count').press('Tab');
  await page.locator('#board').focus();
  await page.keyboard.press('1');
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-action="close-round"]')).toBeEnabled();
  await page.keyboard.press('k');
  await expect(page.locator('#status')).toContainText('Láncgyűrű: a láncszemek gyűrűvé zárva.');
});
