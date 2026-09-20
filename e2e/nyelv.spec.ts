/*
 * The language of the interface (PQW-900): the `?lang=en` link of the main site
 * gives an English interface, the manual chooser switches within the page
 * (without a new stored key), the main site link follows the language, and the
 * interface language is independent of the notation of the pattern (PQW-868).
 *
 * The language chooser is in the „Jelölés és jelek” section, which is closed by
 * default (PQW-882), so the section has to be opened first. The section titles,
 * however, are visible while closed, so we measure the interface language on them.
 */

import { expect, type Page, test } from '@playwright/test';

/** Load and reject the cookie bar; the button by an attribute that is independent of language. */
async function open(page: Page, search = ''): Promise<void> {
  await page.goto(`/${search}`);
  const deny = page.locator('[data-consent="denied"]');
  if (await deny.isVisible()) await deny.click();
}

/** The notation is closed by default (PQW-882) and sits in the sheet (PQW-987). */
async function openNotation(page: Page): Promise<void> {
  const sheet = page.locator('#setup-toggle');
  if ((await sheet.getAttribute('aria-expanded')) !== 'true') {
    // The opener lives in the file menu (PQW-987), which has to be open to click it.
    await page.locator('#file-toggle').click();
    await sheet.click();
  }
  await page.locator('#section-notation').evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
}

const sizeTitle = (page: Page) => page.locator('#section-size > summary');

test('?lang=en gives an English interface, and the page language is English too', async ({ page }) => {
  await open(page, '?lang=en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/en\//);

  await openNotation(page);
  await expect(page.locator('#ui-language')).toHaveValue('en');
});

test('without the parameter it stays Hungarian, and the home link is Hungarian too', async ({ page }) => {
  await open(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/hu\//);

  await openNotation(page);
  await expect(page.locator('#ui-language')).toHaveValue('hu');
});

test('the manual chooser switches within the page, and writes the language into the address bar too', async ({
  page,
}) => {
  await open(page);
  await openNotation(page);

  await page.locator('#ui-language').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/en\//);
  expect(page.url()).toContain('lang=en');

  await page.locator('#ui-language').selectOption('hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
  expect(page.url()).toContain('lang=hu');
});

test('on a language change the labels of the dropdowns switch to the new language too', async ({ page }) => {
  await open(page);
  // The generator section: the panel fills the dropdowns when it is opened.
  await page.locator('#section-shape').evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await expect(page.locator('#shape-kind')).toContainText('Téglalap');

  await openNotation(page);
  await page.locator('#ui-language').selectOption('en');
  await expect(page.locator('#shape-kind')).toContainText('Rectangle');
});

test('the language of the interface and the notation of the pattern are independent', async ({ page }) => {
  await open(page, '?lang=en');
  await openNotation(page);

  // On an English interface one can work with Hungarian notation too: the stitch
  // names follow the notation, the interface language stays English.
  await page.locator('#terms').selectOption('hu');
  await expect(page.locator('#terms')).toHaveValue('hu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#palette')).toContainText('Láncszem');

  await page.locator('#ui-language').selectOption('hu');
  await expect(page.locator('#terms')).toHaveValue('hu');
});

test('the browser tab title and the description follow the interface language (PQW-905)', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle(/Horgolásminta-tervező/i);
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /horgolásminta-tervező/i);
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', /horgolásminta-tervező/i);

  await openNotation(page);
  await page.locator('#ui-language').selectOption('en');
  await expect(page).toHaveTitle(/Crochet Pattern Designer/);
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /crochet pattern designer/i);
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', /Crochet Pattern Designer/);
});

test('the chosen language survives until the next opening (PQW-906)', async ({ page }) => {
  await open(page);
  await openNotation(page);
  await page.locator('#ui-language').selectOption('en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');

  // We reopen without the parameter: the stored choice decides.
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');

  // `?lang` beats the stored value: a shared link always gives its own language.
  await page.goto('/?lang=hu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
});

test('the stored language works even when the cookie bar is rejected (PQW-906)', async ({ page }) => {
  // Language is an operational setting, not tracking: it does not depend on the analytics consent.
  await page.goto('/');
  await page.locator('[data-consent="denied"]').click();
  await openNotation(page);
  await page.locator('#ui-language').selectOption('en');

  await page.goto('/');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
});

/*
 * The dense basic-stitch grid (PQW-984) prints the abbreviation of the
 * notation. All seven basic stitches have one in English — including the
 * `dtr` that Hungarian spells out — and the abbreviations differ between US
 * and UK terms. The four columns have to hold both sets at the owner's window
 * size without the panel widening the page. (The longest label the grid ever
 * prints is the Hungarian fallback, which `panel.spec.ts` covers.)
 */
test('the dense grid holds the longer English abbreviations too (PQW-984)', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page, '?lang=en');

  const cells = page.locator('#palette .palette__grid').getByRole('button');
  await expect(cells).toHaveCount(7);
  await expect(page.locator('#palette').getByRole('button', { name: /Chain \(ch\)/ })).toHaveCount(1);
  await expect(page.locator('#palette').getByRole('button', { name: /Double treble \(dtr\)/ })).toHaveCount(1);

  await openNotation(page);
  await page.locator('#terms').selectOption('en-GB');
  await expect(page.locator('#palette')).toContainText('Triple treble (trtr)');

  // KB: interface.md §36 — the target size holds at the longest abbreviations.
  for (const cell of await cells.all()) {
    const box = (await cell.boundingBox())!;
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    await expect(cell).toBeInViewport({ ratio: 1 });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1000);
});
