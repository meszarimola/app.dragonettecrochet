/*
 * Amigurumi (PQW-863): the Amigurumi pattern type opens the written pattern
 * large; the written pattern of the 6 cm ball marks the eyes and the stuffing;
 * the head-and-body figure sewn together gives a clear message at a differing
 * stitch count, and is error-free with even distribution.
 */

import { expect, type Page, test } from '@playwright/test';

import { asReturningVisitor } from './kezdet.ts';

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
  await asReturningVisitor(page);
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

/** KB: interface.md §79 — the sheet opens from the „New” menu, on one family, and shows only it. */
async function openSheet(page: Page, family: RegExp = /Flat shape/): Promise<void> {
  if (await page.locator('#setup').isHidden()) {
    await page.locator('#types-toggle').click();
    await page.locator('.type[data-type="regular"]').click();
    await page.getByRole('menuitem', { name: family }).click();
  }
}

async function chooseAmigurumi(page: Page): Promise<void> {
  await page.locator('#types-toggle').click();
  await page.locator('.type[data-type="amigurumi"]').click();
  await openSheet(page);
  await expect(page.locator('#section-amigurumi')).toHaveAttribute('open', '');
  // Choosing the type no longer opens the written pattern (PQW-912): the panel
  // belongs to the user, so the tests open it with its button.
  if (await page.locator('#written').isHidden()) await page.locator('#written-toggle').click();
  await expect(page.locator('#written')).toBeVisible();
}

test('in amigurumi the written pattern opens large with its button; the pattern of the 6 cm ball marks the eyes and the stuffing', {
  tag: '@kiadas',
}, async ({ page }) => {
  await open(page);
  await chooseAmigurumi(page);

  await expect(page.locator('#written')).toBeVisible();
  const [panel, board] = await Promise.all([
    page.locator('#written').boundingBox(),
    page.locator('#board').boundingBox(),
  ]);
  expect(panel!.height / board!.height).toBeGreaterThan(0.6);

  await expect(page.locator('#amigurumi-gauge')).toContainText('Estimate from the hook');
  await expect(page.locator('#amigurumi-summary')).toContainText('18 rounds, at most 36 stitches');
  await page.getByRole('button', { name: 'New pattern from this' }).click();
  await expect(page.locator('#status')).toContainText('Fej done;');
  await expect(page.locator('#error-count')).toHaveText('No errors');

  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toContain('Work in a continuous spiral; do not join.');
  expect(text).toContain('Rnd 15: sc, (invdec, 3 sc) x5, invdec, 2 sc (24). Insert safety eyes.');
  expect(text).toContain('pull tight.');
});

test('head and body sewn together: a clear message at a differing stitch count, error-free with even distribution', async ({
  page,
}) => {
  await open(page);
  await chooseAmigurumi(page);
  await page.getByRole('button', { name: 'New pattern from this' }).click();
  await expect(page.locator('#status')).toContainText('Fej done;');

  await page.locator('#amigurumi-name').fill('Test');
  await page.locator('#amigurumi-shape').selectOption({ label: 'Cylinder' });
  await page.locator('#amigurumi-diameter').fill('5');
  await page.locator('#amigurumi-height').fill('5');
  await page.locator('#amigurumi-top').selectOption('open');
  await page.locator('#amigurumi-eyes').uncheck();
  await page.getByRole('button', { name: 'Add as a piece' }).click();
  await expect(page.locator('#status')).toContainText('Turn on the even distribution');

  await page.locator('#amigurumi-distribute').check();
  await page.getByRole('button', { name: 'Add as a piece' }).click();
  await expect(page.locator('#status')).toContainText('Test added, sewn;');
  await expect(page.locator('#error-count')).toHaveText('No errors');

  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toMatch(/Assembly\nSew: Test, Rnd \d+ \(28\) to Fej, Rnd 14 \(30\), easing sts evenly\./);
  await expect(page.locator('#amigurumi-figure')).toContainText('The figure is about');
});

test('from an oval foundation chain (PQW-890): error-free on its own, round 1 on both sides of the chains; sewn onto a ball as a sole', async ({
  page,
}) => {
  await open(page);
  await chooseAmigurumi(page);

  await page.locator('#amigurumi-name').fill('Talp');
  await page.locator('#amigurumi-shape').selectOption({ label: 'Oval' });
  await expect(page.locator('#amigurumi-diameter')).toBeHidden();
  await page.locator('#amigurumi-length').fill('8');
  await page.locator('#amigurumi-width').fill('5');
  await expect(page.locator('#amigurumi-summary')).toContainText('chains');
  await page.getByRole('button', { name: 'New pattern from this' }).click();
  await expect(page.locator('#status')).toContainText('Talp done;');
  // There is no next round after a closed oval (PQW-897).
  await expect(page.locator('#status')).not.toContainText('is next');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toMatch(
    /Rnd 1: skip 1 ch, \d+ sc, 4 sc in next ch, working back along the other side of the chain: \d+ sc, 3 sc in next ch \(\d+\)\./,
  );

  // As a part: first the ball, then the oval sole sewn on, with even distribution.
  await page.locator('#amigurumi-name').fill('Fej');
  await page.locator('#amigurumi-shape').selectOption({ label: 'Sphere' });
  await page.getByRole('button', { name: 'New pattern from this' }).click();
  await expect(page.locator('#status')).toContainText('Fej done;');
  await page.locator('#amigurumi-name').fill('Talp');
  await page.locator('#amigurumi-shape').selectOption({ label: 'Oval' });
  await page.locator('#amigurumi-eyes').uncheck();
  await page.locator('#amigurumi-distribute').check();
  await page.getByRole('button', { name: 'Add as a piece' }).click();
  await expect(page.locator('#status')).toContainText('Talp added, sewn;');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  await expect(page.locator('#written-text')).toContainText('working back along the other side of the chain:');
});

test('oval in double crochet from the generator (PQW-899): the stitch can be chosen, 6 increases at each end, error-free', async ({
  page,
}) => {
  await open(page);
  await chooseAmigurumi(page);

  await page.locator('#amigurumi-name').fill('Talp');
  await expect(page.locator('#amigurumi-stitch')).toBeHidden();
  await page.locator('#amigurumi-shape').selectOption({ label: 'Oval' });
  await page.locator('#amigurumi-stitch').selectOption({ label: 'Double crochet' });
  await page.locator('#amigurumi-length').fill('8');
  await page.locator('#amigurumi-width').fill('5');
  await expect(page.locator('#amigurumi-summary')).toContainText('chains');
  await page.getByRole('button', { name: 'New pattern from this' }).click();
  await expect(page.locator('#status')).toContainText('Talp done;');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  const text = (await page.locator('#written-text').textContent()) ?? '';
  expect(text).toMatch(
    /Rnd 1: skip 3 ch, \d+ dc, 7 dc in next ch, working back along the other side of the chain: \d+ dc, 5 dc in next ch \(\d+\)\./,
  );
  await expect(page.locator('#amigurumi-figure')).toContainText('flat)');
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
    // The sheet carries a “Collapse” of its own since PQW-987, so this one is scoped.
    await page.locator('#written').getByRole('button', { name: 'Collapse' }).click();

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
    await expect(page.locator('#status')).toContainText('worked. Round 1: 11 stitches, 5 more targets.');
    for (let k = 0; k < 5; k += 1) await page.keyboard.press('Enter');
    for (let k = 0; k < 2; k += 1) await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Alt+s');

    await expect(page.locator('#error-count')).toHaveText('No errors');
    // A closed written pattern does not refresh: we reopen it to read it.
    if (await page.locator('#written').isHidden()) await page.locator('#written-toggle').click();
    await expect(page.locator('#written-text')).toContainText(
      'Rnd 1: skip 1 ch, 6 sc, 4 sc in next ch, working back along the other side of the chain: 5 sc, 3 sc in next ch (18).',
    );
  });
}
