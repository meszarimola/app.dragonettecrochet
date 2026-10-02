/*
 * Garments (PQW-866): from the "Garment" section an adult hat and a drop
 * shoulder sweater in size M, with a size series. Both are error-free, in the
 * written pattern the "Sizes" block stands in the form "S (M, L)", and the
 * creation can be undone in one step.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
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

async function openGarment(page: Page) {
  const section = page.locator('#section-garment');
  if (await section.evaluate((el) => el.closest('#setup') !== null)) await openSheet(page);
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  return section;
}

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('adult hat in size M, with an S–L series: error-free, with the "Sizes" block', async ({ page }) => {
  await open(page);
  const section = await openGarment(page);

  await page.locator('#garment-kind').selectOption({ label: 'Hat' });
  await expect(page.locator('#garment-table-field')).toBeHidden();
  await expect(page.locator('#garment-size')).toHaveValue('adult-m');
  await expect(page.locator('#garment-hem-label')).toHaveText('Brim, cm');
  await expect(page.locator('#garment-result')).toHaveText(
    /^Adult M: finished circumference ≈ \d+ cm, height ≈ \d+ cm; \d+ rounds\.$/,
  );
  await expect(page.locator('#garment-checks')).toHaveText(/^Every check is true: (\d+)\/\1, 3 sizes\.$/);
  await expect(page.locator('#garment-series li').first()).toHaveText('Adult S (Adult M, Adult L)');

  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Hat, size Adult M (with a 3 size range) done');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  const text = await writtenText(page);
  expect(text).toContain('Sizes\nAdult S (Adult M, Adult L)');
  expect(text).toMatch(/Crown: \d+ \(\d+, \d+\) rnds/);
});

test('drop shoulder sweater in size M, with an S–L series: four pieces with seams, error-free, undoable', async ({
  page,
}) => {
  await open(page);
  const section = await openGarment(page);

  await expect(page.locator('#garment-kind')).toHaveValue('drop-shoulder');
  await expect(page.locator('#garment-size')).toHaveValue('M');
  await expect(page.locator('#garment-result')).toHaveText(
    /^M: finished bust ≈ \d+ cm, length ≈ \d+ cm, sleeve length ≈ \d+ cm\.$/,
  );
  await expect(page.locator('#garment-checks')).toHaveText(/^Every check is true/);
  await expect(page.locator('#garment-failed li')).toHaveCount(0);

  await section.getByRole('button', { name: 'Create pattern' }).click();
  await expect(page.locator('#status')).toContainText('Drop-shoulder sweater, size M (with a 3 size range) done');
  await expect(page.locator('#error-count')).toHaveText('No errors');
  const text = await writtenText(page);
  expect(text).toContain('Sizes\nS (M, L)');
  expect(text).toMatch(/Left sleeve\nRow 1 – foundation: ch \d+\./);
  expect(text).toMatch(/Sew: Back, Rows 1–\d+, left edge \(\d+ row ends\) to Front/);

  await page.keyboard.press('ControlOrMeta+Z');
  await expect(page.locator('#status')).toContainText('Undone.');
  await expect(page.locator('#written-text')).not.toContainText('Sizes');
});
