/*
 * Bordás szegély és perem relief szemekkel (PQW-909): a „Forma” szakaszból
 * bordás szegélyű téglalap, a „Kör és motívum” szakaszból bordás peremű lapos
 * kör. Mindkettő hibátlan, az írott minta a bordázatot ismétlésként írja, és a
 * nem választható párosítások mezői eltűnnek.
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

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: bordás szegélyű téglalap, a bordázat ismétlésként kiírva`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openSection(page, 'section-shape');

    await page.locator('#shape-stitch').selectOption('dc');
    await page.locator('#shape-width').fill('10');
    await page.locator('#shape-height').fill('6');

    // A bordázat sorai és egysége csak bekapcsolva látszanak.
    await expect(page.locator('#shape-ribbing-pair')).toBeHidden();
    await page.locator('#shape-ribbing').check();
    await expect(page.locator('#shape-ribbing-pair')).toBeVisible();
    await page.locator('#shape-ribbing-rows').fill('2');
    await page.locator('#shape-ribbing-width').fill('1');

    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

    const text = await writtenText(page);
    // A bordás sor 2 láncszemmel kezdődik, mert láncszem nem állhat relief szem helyett (01 §2.2 [S25]).
    expect(text).toMatch(/2 lsz \(nem számít szemnek\)/);
    // A bordázat ismétlésként áll, nem szemenként felsorolva.
    expect(text).toMatch(/\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/);
  });

  test(`${viewport.width}×${viewport.height}: bordás peremű lapos kör, spirálban nem választható`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openSection(page, 'section-rounds');

    await page.locator('#rounds-count').fill('4');
    await page.locator('#rounds-count').press('Tab');
    await page.locator('#rounds-ribbing').check();
    await page.locator('#rounds-ribbing-rows').fill('2');
    await page.locator('#rounds-ribbing-width').fill('1');

    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
    expect(await writtenText(page)).toMatch(/\(1 (Eerp|Herp), 1 (Eerp|Herp)\) ×\d+/);

    // A bordás perem a kör zárása után kezdődik: spirálban nincs honnan indulnia.
    await page.locator('#rounds-closing').selectOption('spiral');
    await expect(page.locator('#rounds-ribbing-fields')).toBeHidden();
  });
}
