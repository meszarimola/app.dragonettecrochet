/*
 * Shawl shapes (PQW-865): from the “Shawl” section a double crochet triangle
 * starting from the top, without a profile, with a custom ratio and a warning,
 * undone in one step; a semicircle in single crochet. Each is error-free, and
 * the written pattern is produced.
 */

import { expect, type Page, test } from '@playwright/test';

import { asReturningVisitor } from './kezdet.ts';

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

async function openShawls(page: Page) {
  const section = page.locator('#section-shawl');
  if (await section.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page, /Shawl/);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('triangle starting from the top: blocked and unblocked size, custom ratio with a warning, error-free rows, undone in one step', {
  tag: '@kiadas',
}, async ({ page }) => {
  await open(page);
  const section = await openShawls(page);

  await expect(page.locator('#shawl-stitch')).toHaveValue('dc');
  await expect(page.locator('#shawl-result')).toHaveText(
    /^Unblocked ≈ \d+ × \d+ cm, blocked ≈ \d+ × \d+ cm; \d+ rows\.$/,
  );
  await expect(page.locator('#shawl-details')).toContainText('The neck edge is about 180°');
  await expect(page.locator('#shawl-preview polygon')).toHaveCount(2);
  await expect(page.locator('#shawl-warnings li')).toHaveCount(0);
  await expect(page.locator('#shawl-length')).toBeHidden();

  // A custom, smaller ratio: a warning, but the pattern is produced.
  await page.locator('#shawl-rate').selectOption({ label: 'Own rate' });
  await page.locator('#shawl-custom').fill('5');
  await expect(page.locator('#shawl-warnings li')).toHaveCount(1);
  await expect(page.locator('#shawl-warnings')).toContainText('This is a warning, not an error.');

  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText(
    /Top-down triangle: \d+ rows done; undo brings the previous one back\./,
  );
  await expect(page.locator('#error-count')).toHaveText('No errors');
  expect(await writtenText(page)).toMatch(/Row 3: ch 3 \(counts as 1 dc\), .*\(\d+ sts\)\. Turn\./);

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Undone.');
  await expect(page.locator('#written-text')).not.toContainText('dc');
});

test('semicircle in single crochet: radius, even increases, error-free', async ({ page }) => {
  await open(page);
  const section = await openShawls(page);

  await page.locator('#shawl-kind').selectOption({ label: 'Semicircle' });
  await page.locator('#shawl-stitch').selectOption({ label: 'Single crochet' });
  await expect(page.locator('#shawl-size-label')).toHaveText('Radius, cm');
  await expect(page.locator('#shawl-wings')).toBeHidden();
  await page.locator('#shawl-size').fill('12');
  await expect(page.locator('#shawl-result')).toHaveText(/cm across; \d+ rows\.$/);
  await expect(page.locator('#shawl-details')).toContainText('(π · h/w)');

  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Semicircle:');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  // The single crochet turning chain stands in place of stitch 1, on a foundation chain stitch (PQW-891).
  expect(await writtenText(page)).toMatch(/Row 2: skip 2 ch, \d+ sc in next ch \(\d+ sts\)\. Turn\./);
});

/*
 * Curved and broken rows on the canvas (PQW-893): the semicircle is a dome, the
 * triangle starting from the top has rows broken at a right angle at the spine.
 * Both are about twice as wide as they are tall; the flat “V” drawn with
 * straight rows was much wider than that.
 */
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1000, height: 506 },
]) {
  test(`${viewport.width}×${viewport.height}: the semicircle and the triangle shawl on the canvas in their real shape, error-free`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await open(page);
    const section = await openShawls(page);

    /** The width/height ratio of the bounding rectangle of the stitches, in window coordinates (`window.mintatervezoKijeloles`). */
    const aspect = () =>
      page.evaluate(() => {
        const api = (
          window as unknown as { mintatervezoKijeloles: { nodes(): { layer: number; x: number; y: number }[] } }
        ).mintatervezoKijeloles;
        const nodes = api.nodes().filter((node) => node.layer > 0);
        const xs = nodes.map((node) => node.x);
        const ys = nodes.map((node) => node.y);
        return (Math.max(...xs) - Math.min(...xs)) / (Math.max(...ys) - Math.min(...ys));
      });

    await page.locator('#shawl-kind').selectOption({ label: 'Semicircle' });
    await page.locator('#shawl-stitch').selectOption({ label: 'Single crochet' });
    await page.locator('#shawl-size').fill('8');
    await section.getByRole('button', { name: 'Create pattern' }).click();
    await expect(page.locator('#status')).toContainText('Semicircle:');
    await expect(page.locator('#error-count')).toHaveText('No errors');
    // On a small piece the dome is proportionally taller because of the middle hole and the hanging turning chains; with straight rows it was about 3.
    const dome = await aspect();
    expect(dome).toBeGreaterThan(1.2);
    expect(dome).toBeLessThan(2.4);

    await page.locator('#shawl-kind').selectOption({ label: 'Top-down triangle' });
    await page.locator('#shawl-size').fill('8');
    await section.getByRole('button', { name: 'Create pattern' }).click();
    await expect(page.locator('#status')).toContainText('Top-down triangle:');
    await expect(page.locator('#error-count')).toHaveText('No errors');
    const triangle = await aspect();
    expect(triangle).toBeGreaterThan(1.5);
    expect(triangle).toBeLessThan(2.7);
  });
}
