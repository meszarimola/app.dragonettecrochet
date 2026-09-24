/*
 * Circles and motifs (PQW-861): a flat circle and a granny square from the
 * „Kör és motívum” section, with the round-by-round written pattern; the K key
 * closes a chain ring from the chain stitches. The diagram of the granny square
 * is a square, and its symbols do not crowd (PQW-888).
 *
 * The granny square was switched off for the first round of the UAT
 * (KB: owner-decisions.md §13) and back on in PQW-1038 (§15).
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

/** The make-a-pattern sheet (PQW-987) is closed on load, and its opener is in the file menu. */
async function openSheet(page: Page): Promise<void> {
  const sheet = page.locator('#setup-toggle');
  if ((await sheet.getAttribute('aria-expanded')) !== 'true') {
    await page.locator('#file-toggle').click();
    await sheet.click();
  }
}

async function generate(page: Page, choices: { shape?: string; start?: string; rounds: number }): Promise<void> {
  const section = page.locator('#section-rounds');
  if (await section.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page);
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

/** PQW-1045: a new pattern is started from the „Új” menu, by picking a type. */
async function newRegular(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="regular"]').click();
}

test('flat circle in single crochet: estimated increases, error-free rounds, the sequence of rounds follows the knowledge base', async ({
  page,
}) => {
  await open(page);
  await generate(page, { rounds: 4 });

  await expect(page.locator('#rounds-note')).toContainText('Körönként 6 szaporítás');
  await expect(page.locator('#rounds-note')).toContainText('Becslés');
  await expect(page.locator('#status')).toContainText('Lapos kör, 4 kör elkészült;');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

  const text = await writtenText(page);
  expect(text).toContain('3. kör: 1 lsz (fordulólánc), (szap., 1 rp) ×6 (18). Kör zárása: 1 ksz az első szembe.');
  expect(text).toContain('4. kör: 1 lsz (fordulólánc), 1 rp, (szap., 2 rp) ×5, szap., 1 rp (24).');

  // The round numbers on the canvas: the labels of the four rounds, and since PQW-916 the label of the magic ring (layer 0) as well.
  const labels = await page.evaluate(() =>
    (window as unknown as { mintatervezoRacs: { labels(): unknown[] } }).mintatervezoRacs.labels(),
  );
  expect(labels).toHaveLength(5);

  // Undo brings back the earlier (empty) pattern.
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Visszavonva.');
});

test('granny square with a chain ring, and the K key closes a chain ring from the chain stitches', async ({ page }) => {
  await open(page);
  await generate(page, { shape: 'Nagymama-négyzet', start: 'Láncgyűrű', rounds: 3 });

  await expect(page.locator('#rounds-stitch')).toBeHidden();
  await expect(page.locator('#rounds-closing')).toBeHidden();
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = await writtenText(page);
  expect(text).toContain('Láncgyűrű: 4 lsz, 1 ksz-szel gyűrűvé zárva.');
  expect(text).toContain('1. kör: 3 lsz (1 erp-nek számít), 2 erp a gyűrűbe, 2 lsz, (3 erp a gyűrűbe, 2 lsz) ×3 (20).');
  expect(text).toMatch(/2\. kör: .*\(36\)\. Kör zárása: 1 ksz a kezdőlánc tetejébe\./);
  expect(text).toMatch(/3\. kör: .*\(52\)\. Kör zárása: 1 ksz a kezdőlánc tetejébe\./);

  // New pattern, 6 chain stitches, K: chain ring. The number of chain stitches is visible once the chain stitch is selected.
  await newRegular(page);
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

/** The top of the symbols in window coordinates (`window.mintatervezoKijeloles`, src/ui/main.ts). */
const placedNodes = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { mintatervezoKijeloles: { nodes(): Placed[] } }).mintatervezoKijeloles.nodes(),
  );

const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: the diagram of the 6-round granny square is a square, and the symbols do not crowd`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await generate(page, { shape: 'Nagymama-négyzet', rounds: 6 });
    await expect(page.locator('#status')).toContainText('Nagymama-négyzet, 6 kör elkészült;');
    await page.locator('#zoom-toggle').click();
    await page.getByRole('button', { name: 'Egész minta' }).click();

    // The slip stitch sits on its base, not on the line of the round: it does not count.
    const nodes = (await placedNodes(page)).filter((node) => node.layer > 0 && node.def !== 'sl-st');
    const xs = nodes.map((node) => node.x);
    const ys = nodes.map((node) => node.y);
    const [width, height] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    expect(Math.abs(width - height) / width).toBeLessThan(0.05);
    // In a square the corner is √2 times as far from the centre as the middle of the side; in a circle they are equally far.
    const [cx, cy] = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2];
    const farthest = Math.max(...nodes.map((node) => Math.hypot(node.x - cx, node.y - cy)));
    expect(farthest / (width / 2)).toBeGreaterThan(1.3);

    // The symbols of one round: the nearest neighbour is nowhere closer than a third of the usual distance.
    const nearest = nodes.map((node) =>
      Math.min(
        ...nodes
          .filter((other) => other !== node && other.layer === node.layer)
          .map((other) => Math.hypot(other.x - node.x, other.y - node.y)),
      ),
    );
    expect(Math.min(...nearest)).toBeGreaterThan(median(nearest) / 3);
  });
}
