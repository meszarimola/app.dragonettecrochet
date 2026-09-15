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

/*
 * Íves és megtört sorok a vásznon (PQW-893): a félkör kupola, a fentről induló
 * háromszög a gerincnél derékszögben megtört sorokkal. Mindkettő kb. kétszer
 * olyan széles, mint magas; az egyenes sorokkal rajzolt lapos „V” ennél jóval
 * szélesebb volt.
 */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: a félkör és a háromszög-kendő a vásznon a valós alakjában, hibátlanul`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openShawls(page);

    /** A szemek befoglaló téglalapjának szélesség/magasság aránya, ablak-koordinátában (`window.mintatervezoKijeloles`). */
    const aspect = () =>
      page.evaluate(() => {
        const api = (window as unknown as { mintatervezoKijeloles: { nodes(): { layer: number; x: number; y: number }[] } }).mintatervezoKijeloles;
        const nodes = api.nodes().filter((node) => node.layer > 0);
        const xs = nodes.map((node) => node.x);
        const ys = nodes.map((node) => node.y);
        return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
      });

    await page.locator('#shawl-kind').selectOption({ label: 'Félkör' });
    await page.locator('#shawl-stitch').selectOption({ label: 'Rövidpálca' });
    await page.locator('#shawl-size').fill('8');
    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#status')).toContainText('Félkör,');
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
    // Kis darabon a középső lyuk és a lelógó fordulóláncok miatt a kupola arányaiban magasabb; egyenes sorokkal kb. 3 volt.
    const dome = await aspect();
    expect(dome).toBeGreaterThan(1.2);
    expect(dome).toBeLessThan(2.4);

    await page.locator('#shawl-kind').selectOption({ label: 'Fentről induló háromszög' });
    await page.locator('#shawl-size').fill('8');
    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(page.locator('#status')).toContainText('Fentről induló háromszög,');
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
    const triangle = await aspect();
    expect(triangle).toBeGreaterThan(1.5);
    expect(triangle).toBeLessThan(2.7);
  });
}
