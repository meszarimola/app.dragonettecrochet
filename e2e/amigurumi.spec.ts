/*
 * Amigurumi (PQW-863): the Amigurumi pattern type opens the written pattern
 * large; the written pattern of the 6 cm ball marks the eyes and the stuffing;
 * the head-and-body figure sewn together gives a clear message at a differing
 * stitch count, and is error-free with even distribution.
 */

import { expect, type Page, test } from '@playwright/test';

/*
 * PQW-925: the amigurumi pattern type is switched off for the first round of
 * acceptance testing, so these tests do not run. Do NOT delete them: when the
 * type is switched back on, this single block is what goes away, and the
 * coverage returns in one piece.
 */
test.beforeEach(() => {
  test.skip(true, 'PQW-925: the amigurumi pattern type is temporarily switched off');
});

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Elutasítom' });
  if (await deny.isVisible()) await deny.click();
}

async function chooseAmigurumi(page: Page): Promise<void> {
  await page.locator('.type[data-type="amigurumi"]').click();
  await expect(page.locator('#section-amigurumi')).toHaveAttribute('open', '');
  // Choosing the type no longer opens the written pattern (PQW-912): the panel
  // belongs to the user, so the tests open it with its button.
  if (await page.locator('#written').isHidden()) await page.locator('#written-toggle').click();
  await expect(page.locator('#written')).toBeVisible();
}

test('in amigurumi the written pattern opens large with its button; the pattern of the 6 cm ball marks the eyes and the stuffing', async ({
  page,
}) => {
  await open(page);
  await chooseAmigurumi(page);

  await expect(page.locator('#written')).toBeVisible();
  const [panel, board] = await Promise.all([
    page.locator('#written').boundingBox(),
    page.locator('#board').boundingBox(),
  ]);
  expect(panel!.height / board!.height).toBeGreaterThan(0.6);

  await expect(page.locator('#amigurumi-gauge')).toContainText('Becslés a tűből');
  await expect(page.locator('#amigurumi-summary')).toContainText('18 kör, legfeljebb 36 szem');
  await page.getByRole('button', { name: 'Új minta ebből' }).click();
  await expect(page.locator('#status')).toContainText('Fej elkészült;');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toContain('Spirálban, zárás nélkül');
  expect(text).toContain(
    '15. kör: 1 rp, (láthatatlan fogyasztás, 3 rp) ×5, láthatatlan fogyasztás, 2 rp (24). Tedd be a biztonsági szemeket.',
  );
  expect(text).toContain('húzd össze a nyílást.');
});

test('head and body sewn together: a clear message at a differing stitch count, error-free with even distribution', async ({
  page,
}) => {
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
  expect(text).toMatch(
    /Összeállítás\nVarrás: Test, \d+\. kör \(28\) → Fej, 14\. kör \(30\), a szemeket egyenletesen elosztva\./,
  );
  await expect(page.locator('#amigurumi-figure')).toContainText('A figura magassága kb.');
});

test('from an oval foundation chain (PQW-890): error-free on its own, round 1 on both sides of the chains; sewn onto a ball as a sole', async ({
  page,
}) => {
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
  // There is no next round after a closed oval (PQW-897).
  await expect(page.locator('#status')).not.toContainText('következik');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toMatch(
    /1\. kör: hagyj ki 1 láncszemet, majd \d+ rp, 4 rp a következő láncszembe, a láncszemek másik oldalán vissza: \d+ rp, 3 rp a következő láncszembe \(\d+\)\./,
  );

  // As a part: first the ball, then the oval sole sewn on, with even distribution.
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

test('oval in double crochet from the generator (PQW-899): the stitch can be chosen, 6 increases at each end, error-free', async ({
  page,
}) => {
  await open(page);
  await chooseAmigurumi(page);

  await page.locator('#amigurumi-name').fill('Talp');
  await expect(page.locator('#amigurumi-stitch')).toBeHidden();
  await page.locator('#amigurumi-shape').selectOption({ label: 'Ovális' });
  await page.locator('#amigurumi-stitch').selectOption({ label: 'Egyráhajtásos pálca' });
  await page.locator('#amigurumi-length').fill('8');
  await page.locator('#amigurumi-width').fill('5');
  await expect(page.locator('#amigurumi-summary')).toContainText('láncszemből');
  await page.getByRole('button', { name: 'Új minta ebből' }).click();
  await expect(page.locator('#status')).toContainText('Talp elkészült;');
  await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toMatch(
    /1\. kör: hagyj ki 3 láncszemet, majd \d+ erp, 7 erp a következő láncszembe, a láncszemek másik oldalán vissza: \d+ erp, 5 erp a következő láncszembe \(\d+\)\./,
  );
  await expect(page.locator('#amigurumi-figure')).toContainText('lapos)');
});

/** The cursor target in window coordinates (the hook for the browser tests, main.ts). */
async function cursorPoint(page: Page): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(() =>
    (
      window as unknown as { mintatervezoRacs: { cursor: () => { x: number; y: number } | null } }
    ).mintatervezoRacs.cursor(),
  );
  expect(point).not.toBeNull();
  return point!;
}

for (const viewport of [
  { width: 1000, height: 506 },
  { width: 1440, height: 900 },
]) {
  test(`${viewport.width}×${viewport.height}: round 1 of the oval by hand with the guided cursor (PQW-899): back along the other side of the chains after the end, error-free`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    await chooseAmigurumi(page);
    // The chart is needed for aiming: the written pattern panel is closed.
    await page.getByRole('button', { name: 'Lecsukás' }).click();

    const board = page.locator('#board');
    await board.focus();
    await page.keyboard.press('Alt+1'); // chain stitch
    await page.locator('#chain-count').focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('8');
    await board.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Alt+3'); // single crochet

    // Front: 7 single crochets from the chain after the starting chain to the farthest one, then 3 more into the same one at the end.
    for (let k = 0; k < 7; k += 1) await page.keyboard.press('Enter');
    for (let k = 0; k < 3; k += 1) await page.keyboard.press('Shift+Enter');

    // The cursor has jumped to the other side of the chains: the first stitch by click, the rest by keyboard.
    const point = await cursorPoint(page);
    expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('#board') !== null, point)).toBe(
      true,
    );
    await page.mouse.click(point.x, point.y);
    await expect(page.locator('#status')).toContainText('horgolva. 1. kör: 11 szem, még 5 célpont.');
    for (let k = 0; k < 5; k += 1) await page.keyboard.press('Enter');
    for (let k = 0; k < 2; k += 1) await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Alt+s');

    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');
    // A closed written pattern does not refresh: we reopen it to read it.
    if (await page.locator('#written').isHidden()) await page.locator('#written-toggle').click();
    await expect(page.locator('#written-text')).toContainText(
      '1. kör: hagyj ki 1 láncszemet, majd 6 rp, 4 rp a következő láncszembe, a láncszemek másik oldalán vissza: 5 rp, 3 rp a következő láncszembe (18).',
    );
  });
}
