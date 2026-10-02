/*
 * Flat shapes (PQW-862): from the “Shape” section a 20 × 30 cm half double
 * crochet rectangle without a profile, with an estimate marker, undone in one
 * step; a trapezoid from the angle of the edge. Each is error-free, and the
 * written pattern is produced.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
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

async function openShapes(page: Page) {
  const section = page.locator('#section-shape');
  if (await section.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('20 × 30 cm half double crochet rectangle without a profile: estimated actual size, error-free rows, undone in one step', {
  tag: '@kiadas',
}, async ({ page }) => {
  await open(page);
  const section = await openShapes(page);

  await expect(page.locator('#shape-stitch')).toHaveValue('hdc');
  await expect(page.locator('#shape-size')).toHaveText(/^Finished size: ≈ \d+(\.\d)? × \d+(\.\d)? cm, \d+ rows\.$/);
  await expect(page.locator('#shape-source')).toContainText('No profile: the size is an estimate from a 4 mm hook.');
  await expect(page.locator('#shape-preview polygon')).toHaveCount(1);
  // A rectangle has no angle and no top edge.
  await expect(page.locator('#shape-angle')).toBeHidden();
  await expect(page.locator('#shape-top')).toBeHidden();

  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText(/Rectangle: \d+ rows done; undo brings the previous one back\./);
  await expect(page.locator('#error-count')).toHaveText('No errors');
  const text = await writtenText(page);
  // The 2-chain turning chain stands in place of half double crochet 1, on a foundation chain stitch (PQW-891).
  expect(text).toMatch(/Row 2: skip 2 ch, hdc in each ch across \(\d+ sts\)\. Turn\./);

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Undone.');
  await expect(page.locator('#written-text')).not.toContainText('hdc');
});

test('trapezoid from the angle of the edge: error-free, the written pattern is produced', async ({ page }) => {
  await open(page);
  const section = await openShapes(page);

  await page.locator('#shape-kind').selectOption({ label: 'Trapezoid' });
  await expect(page.locator('#shape-width-label')).toHaveText('Bottom edge, cm');
  await page.locator('#shape-measure').selectOption({ label: 'Angle of the edge' });
  await expect(page.locator('#shape-height')).toBeHidden();
  await page.locator('#shape-width').fill('20');
  await page.locator('#shape-angle').fill('40');
  await expect(page.locator('#shape-details')).toContainText('The edge is about');
  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Trapezoid:');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  // The base stitch is the half double crochet: the edges decrease by crocheting half double crochets together.
  expect(await writtenText(page)).toMatch(
    /Row \d: ch 2 \(counts as 1 hdc\), hdc[23]tog, \d+ hdc, hdc[23]tog \(\d+ sts\)\./,
  );
});
