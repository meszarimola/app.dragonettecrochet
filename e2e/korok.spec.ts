/*
 * Körök és motívumok (PQW-861): a „Kör és motívum” szakaszból lapos kör és
 * nagymama-négyzet, az írott minta körsoraival; a K billentyű a láncszemekből
 * láncgyűrűt zár. A nagymama-négyzet diagramja négyzet, a jelei nem
 * torlódnak (PQW-888).
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

  // A körszámok a vásznon: a négy kör címkéje, és a PQW-916 óta a varázskör (0. réteg) felirata is.
  const labels = await page.evaluate(() => (window as unknown as { mintatervezoRacs: { labels(): unknown[] } }).mintatervezoRacs.labels());
  expect(labels).toHaveLength(5);

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

  // Új minta, 6 láncszem, K: láncgyűrű. A láncszemek száma a Láncszem kiválasztása után látszik.
  await page.locator('[data-action="new"]').click();
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').fill('6');
  await page.locator('#chain-count').press('Tab');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-action="close-round"]')).toBeEnabled();
  await page.keyboard.press('Alt+k');
  await expect(page.locator('#status')).toContainText('Láncgyűrű: a láncszemek gyűrűvé zárva.');
});

interface Placed {
  readonly id: string;
  readonly def: string;
  readonly layer: number;
  readonly x: number;
  readonly y: number;
}

/** A jelek teteje ablak-koordinátában (`window.mintatervezoKijeloles`, src/ui/main.ts). */
const placedNodes = (page: Page) =>
  page.evaluate(() => (window as unknown as { mintatervezoKijeloles: { nodes(): Placed[] } }).mintatervezoKijeloles.nodes());

const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: a 6 körös nagymama-négyzet diagramja négyzet, és a jelek nem torlódnak`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await generate(page, { shape: 'Nagymama-négyzet', rounds: 6 });
    await expect(page.locator('#status')).toContainText('Nagymama-négyzet, 6 kör elkészült;');
    await page.getByRole('button', { name: 'Egész minta' }).click();

    // A kúszószem a talpán ül, nem a kör vonalán: nem számít bele.
    const nodes = (await placedNodes(page)).filter((node) => node.layer > 0 && node.def !== 'sl-st');
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    const [width, height] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    expect(Math.abs(width - height) / width).toBeLessThan(0.05);
    // Négyzetben a sarok √2-ször olyan messze van a középtől, mint az oldal közepe; körben ugyanolyan messze.
    const [cx, cy] = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
    const farthest = Math.max(...nodes.map((node) => Math.hypot(node.x - cx, node.y - cy)));
    expect(farthest / (width / 2)).toBeGreaterThan(1.3);

    // Egy kör jelei: a legközelebbi szomszéd sehol sincs a szokásos távolság harmadánál közelebb.
    const nearest = nodes.map((node) =>
      Math.min(...nodes.filter((other) => other !== node && other.layer === node.layer).map((other) => Math.hypot(other.x - node.x, other.y - node.y))),
    );
    expect(Math.min(...nearest)).toBeGreaterThan(median(nearest) / 3);
  });
}
