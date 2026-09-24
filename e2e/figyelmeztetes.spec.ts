/*
 * How warnings appear (PQW-923, points 3 and 4).
 *
 * The request of the owner: a warning should pop up at the top in a small box,
 * and disappear on its own after three seconds; the persistent indicator at the
 * right end of the menu bar should stay; and clicking a warning should not put a
 * highlight square on the stitch, because that makes the interface crowded.
 *
 * These are parts of the interface (not the drawing on the canvas), so here we
 * can and must measure.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
  await expect(page.locator('#written')).toBeHidden();
}

/**
 * Row of mixed height: single crochet and double crochet side by side.
 *
 * Since PQW-924 this does NOT give a warning — according to the owner this is
 * how a wavy pattern is made — so the test of the pop-up box is built on the
 * message of turning, and this setup records that no warning arises.
 */
async function mixedHeights(page: Page): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');
  await page.keyboard.press('Alt+3');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+5');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Enter');
}

/** Laying down 12 chain stitches from the keyboard; at this point the box still speaks. */
async function chains(page: Page): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
}

/*
 * The box now shows ONLY warnings (PQW-932); feedback on actions is gone.
 * The warning, however, was asked for here in PQW-923, so that stays, and we
 * measure the mechanism on it.
 *
 * KB: owner-decisions.md §3
 */
test('the warning box pops up at the top, and disappears after three seconds (PQW-923)', async ({ page }) => {
  await open(page);
  const alert = page.locator('#alert');
  await expect(alert, 'without an action there is no box').toBeHidden();

  await withWarning(page);

  await expect(alert, 'there is visible feedback about the warning').toBeVisible();
  await expect(alert).toHaveAttribute('aria-live', 'polite');
  await expect(alert, 'it marks it as a warning').toContainText('Figyelmeztetés:');

  // It does not cover the menu bar: it starts below it.
  const bar = (await page.locator('header.bar').boundingBox())!;
  const box = (await alert.boundingBox())!;
  expect(box.y, 'the box is below the menu bar').toBeGreaterThanOrEqual(bar.y + bar.height - 1);

  // After three seconds it disappears on its own; the persistent indicator stays.
  await expect(alert).toBeHidden({ timeout: 5000 });
  await expect(page.locator('#error-count'), 'the corner indicator stays').toBeVisible();
});

/*
 * Turning and a new pattern do not pop up (PQW-929) — the state has to be read
 * off the chart. The hidden live region, however, stays for the screen reader.
 *
 * KB: owner-decisions.md §3
 */
test('turning and a new pattern do not nag, but the live region stays (PQW-929)', async ({ page }) => {
  await open(page);
  const alert = page.locator('#alert');

  await chains(page);
  // We wait until the box of the chain stitches disappears on its own, otherwise we would be measuring that one.
  await expect(alert).toBeHidden({ timeout: 5000 });

  await page.keyboard.press('Alt+f');
  await expect(alert, 'turning does not nag').toBeHidden();
  await expect(page.locator('#status'), 'but the live region does say it').toContainText('a munka megfordítva');

  // „Új minta” is the type menu since PQW-1045; a type starts the pattern anew.
  await page.getByRole('button', { name: 'Új minta' }).click();
  await page.locator('.type[data-type="regular"]').click();
  await expect(alert, 'a new pattern does not nag').toBeHidden();
  await expect(page.locator('#status'), 'the live region announces the start of the empty pattern').toContainText(
    'Üres minta',
  );
});

/**
 * One remaining warning: a double crochet row after a single crochet row, where
 * the height of the chain stitches that start the row does not suit the stitch
 * that starts the row. (Mixed height has given no finding since PQW-924, so that
 * is not what serves as the trigger.)
 */
async function withWarning(page: Page): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('12');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');
  await page.keyboard.press('Alt+3');
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');
  /*
   * The turning chain is brought by the first stitch of the row (PQW-944), so
   * the height would work out by itself. For the warning the crocheter lays down
   * ONE chain stitch, and then continues with double crochet: the chain is lower
   * than the stitch that starts the row.
   */
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('1');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+5');
  for (let i = 0; i < 12; i += 1) await page.keyboard.press('Enter');
}

/** 22 chain stitches, but only five single crochets: a long, unworked "tail" is left. */
async function withTail(page: Page): Promise<void> {
  await page.locator('#board').focus();
  await page.keyboard.press('Alt+1');
  await page.locator('#chain-count').focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('22');
  await page.locator('#board').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+3');
  for (let i = 0; i < 5; i += 1) await page.keyboard.press('Enter');
  await page.keyboard.press('Alt+f');
}

/** The highlighted stitches on the canvas; an empty array if the chart is clean. */
const highlight = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    (window as unknown as Record<string, Record<string, () => string[]>>).mintatervezoRacs!['highlight']!(),
  );

/*
 * The chart is clean by default; a clicked finding is marked in red dashes for
 * five seconds (PQW-930). This partly reverses PQW-923: there the click did not
 * highlight, because every circle was on the chart by default anyway, and that
 * is what made it crowded.
 *
 * KB: owner-decisions.md §4
 */
test('the chart is clean by default, clicking a finding brings a marking, and it disappears after five seconds (PQW-930)', async ({
  page,
}) => {
  await open(page);
  await withWarning(page);

  expect(await highlight(page), 'nothing is marked on the chart by default').toEqual([]);

  await page.locator('#error-toggle').click();
  const finding = page.locator('#findings button.finding').first();
  await expect(finding).toBeVisible();
  await finding.click();

  expect((await highlight(page)).length, 'the stitches of the selected finding are marked').toBeGreaterThan(0);

  // It marks, but does not SELECT: the buttons tied to a selection stay inactive.
  await expect(page.locator('[data-action="delete-selection"]'), 'the click does not select').toBeDisabled();
  await expect(page.locator('[data-action="duplicate-selection"]')).toBeDisabled();

  // After five seconds it disappears on its own, so that it does not stay there in the way.
  await expect.poll(() => highlight(page), { timeout: 9000 }).toEqual([]);
});

/*
 * The actions give no feedback (PQW-932), and making a pattern is not
 * continuous: going back to a skipped place is filling a gap, not a crossed
 * stitch, so there is no question.
 *
 * KB: owner-decisions.md §3, §5
 */
test('the actions do not nag, and filling a gap does not ask (PQW-932)', async ({ page }) => {
  await open(page);
  const alert = page.locator('#alert');

  await chains(page);
  await expect(alert, 'laying down the chain stitches does not nag').toBeHidden();

  await page.keyboard.press('Alt+f');
  await expect(alert, 'turning does not nag').toBeHidden();

  await page.keyboard.press('Alt+5');
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Enter');
  await expect(alert, 'laying down the stitch does not nag').toBeHidden();

  await page.keyboard.press('ControlOrMeta+z');
  await expect(alert, 'undoing does not nag').toBeHidden();

  // Stepping back onto a target skipped earlier, the stitch goes down without a question.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await expect(
    page.getByRole('button', { name: 'Keresztezett szem' }),
    'no question about filling the gap',
  ).toHaveCount(0);
  await expect(alert, 'and it does not nag either').toBeHidden();
});

test('an unworked tail on the foundation chain is a warning, not an error (PQW-930)', async ({ page }) => {
  await open(page);
  await withTail(page);

  await page.locator('#error-toggle').click();
  const list = page.locator('#findings');
  await expect(list, 'the tail does not appear as an error').not.toContainText('Hiba:');
  await expect(list, 'but as a warning').toContainText('Figyelmeztetés:');
});

test('there is no knowledge-base reference on the finding card (PQW-930)', async ({ page }) => {
  await open(page);
  await withWarning(page);

  await page.locator('#error-toggle').click();
  const list = page.locator('#findings');
  await expect(list, 'the end user is not interested in the knowledge base').not.toContainText('Tudásbázis');
  await expect(list, 'the disclosure went away too').not.toContainText('Részletek');
  await expect(page.locator('#findings details')).toHaveCount(0);
});

test('mixed stitch height gives no warning (PQW-924)', async ({ page }) => {
  await open(page);
  await mixedHeights(page);

  // According to the owner this is how a wavy pattern is made: it is deliberate, not an error.
  await expect(page.locator('#error-count'), 'no warning on the indicator').toHaveText('Nincs hiba');
  await expect(page.locator('#alert')).not.toContainText('Figyelmeztetés:');
});
