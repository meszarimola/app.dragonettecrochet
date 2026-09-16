/*
 * Szegély (PQW-897, PQW-898): a Forma szakaszból készült szegélyes téglalap
 * után az állapotsor nem jósol következő kört, és a szegély a vásznon nem kap
 * sorszámot; a szegélyes egyenlő szárú háromszög hibátlan, az írott minta a
 * szegéllyel.
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

/** A sorszám-címkék rétegei és a legfelső réteg (a szegély) a vásznon (`window.mintatervezoRacs`, `window.mintatervezoKijeloles`). */
const canvasLayers = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as {
      mintatervezoRacs: { labels(): { layer: number }[] };
      mintatervezoKijeloles: { nodes(): { layer: number }[] };
    };
    return { labels: w.mintatervezoRacs.labels().map((label) => label.layer), top: Math.max(...w.mintatervezoKijeloles.nodes().map((node) => node.layer)) };
  });

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: kézi szegélyhorgolás (PQW-902): a B gombbal a célpontok a darab kerületén futnak`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);

    // Kis darab kézzel: 6 láncszem, két rövidpálcás sor, a végén fordulással.
    const board = page.locator('#board');
    await board.focus();
    await page.keyboard.press('1');
    await page.locator('#chain-count').focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('6');
    await board.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('f');
    await page.keyboard.press('3');
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('f');
    await page.keyboard.press('Shift+F');
    await page.keyboard.press('f');

    const status = page.locator('#status');
    const borderButton = page.locator('[data-action="border-round"]');
    await expect(borderButton).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('b');
    await expect(borderButton).toHaveAttribute('aria-pressed', 'true');
    await expect(status).toContainText('Szegély: a célpontok a darab kerületén futnak');

    // A felső él szemei után a sorvégek következnek: a kurzor végigvisz a darab kerületén.
    for (let k = 0; k < 8; k += 1) await page.keyboard.press('Enter');
    await expect(status).toContainText('szem');
    // A félkész, a szabályostól még eltérő szegélyre figyelmeztetés jöhet (a sarkokban 3 rp kell), hiba nem.
    await expect(page.locator('#error-count')).not.toContainText(/\d+ hiba/);

    // Kikapcsolva újra a sor célpontjai jönnek.
    await page.keyboard.press('b');
    await expect(borderButton).toHaveAttribute('aria-pressed', 'false');
    await expect(status).toContainText('Szegély kikapcsolva');
  });

  test(`${viewport.width}×${viewport.height}: szegélyes téglalap után nincs „következik”, a szegélynek nincs sorszáma; szegélyes háromszög hibátlan`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openShapes(page);
    const status = page.locator('#status');

    await page.locator('#shape-width').fill('12');
    await page.locator('#shape-height').fill('8');
    await page.locator('#shape-border').check();
    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(status).toContainText(/Téglalap, \d+ sor és szegély elkészült;/);
    await expect(status).not.toContainText('következik');
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
    const { labels, top } = await canvasLayers(page);
    expect(labels.length).toBeGreaterThan(0);
    expect(labels).not.toContain(top);

    await page.locator('#shape-kind').selectOption({ label: 'Egyenlő szárú háromszög' });
    await expect(page.locator('#shape-border')).toBeChecked();
    await expect(page.locator('#shape-details')).toContainText(/Szegély: \d+ rp körben, sarkonként 3/);
    await section.getByRole('button', { name: 'Minta létrehozása' }).click();
    await expect(status).toContainText(/Egyenlő szárú háromszög, \d+ sor és szegély elkészült;/);
    await expect(status).not.toContainText('következik');
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
    expect(await writtenText(page)).toMatch(/Szegély: 1 lsz \(nem számít szemnek\), felső él: .*\(\d+ szem\)\. Kör zárása: 1 ksz az első szembe\./);
  });
}
