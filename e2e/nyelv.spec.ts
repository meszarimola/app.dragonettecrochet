/*
 * The language of the interface (PQW-900, PQW-906, PQW-1100).
 *
 * The resolution order is `?lang` → the stored choice → the language of the
 * document → English (interface.md §4). Since PQW-1100 English is the default
 * and the fallback: the app opens in English, and Hungarian is reached with
 * `?lang=hu`, with a stored choice, or with a document that asks for it.
 *
 * This is the bilingual sentinel of the browser suite. Every other spec drives
 * the English interface, so the Hungarian product strings are covered HERE and
 * nowhere else — see the Hungarian block at the bottom, which is what keeps
 * Hungarian from quietly going untested (PQW-1100).
 *
 * The chooser (`#ui-language`) stands in the menu bar since PQW-1048. The
 * titles of the right-hand panel are visible while their sections are closed,
 * so the interface language is measured on them.
 */

import { expect, type Page, test } from '@playwright/test';

/** Load and reject the cookie bar; the button by an attribute that is independent of language. */
async function open(page: Page, search = ''): Promise<void> {
  await page.goto(`/${search}`);
  const deny = page.locator('[data-consent="denied"]');
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

/**
 * PQW-1048 took the terminology chooser off the interface, but the notation is
 * still what names a stitch. The tests set it where the app keeps it.
 */
async function withTerms(page: Page, terms: string): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem(
      'dc-mintatervezo:jeloles',
      JSON.stringify({ terms: value, chartStyle: 'cyc', singleCrochet: 'plus' }),
    );
  }, terms);
}

/**
 * A document that asks for a language: the third step of the resolution order.
 * The app reads it from `document.documentElement.lang` while it starts, so it
 * has to stand in the markup — an init script cannot put it there in time.
 */
async function withDocumentLanguage(page: Page, language: string): Promise<void> {
  await page.route(
    (url) => url.pathname === '/',
    async (route) => {
      const response = await route.fetch();
      const body = (await response.text()).replace('<html lang="en">', `<html lang="${language}">`);
      await route.fulfill({ response, body });
    },
  );
}

const sizeTitle = (page: Page) => page.locator('#section-size > summary');

async function writtenText(page: Page): Promise<string> {
  if ((await page.locator('#written').getAttribute('hidden')) !== null) await page.locator('#written-toggle').click();
  return (await page.locator('#written-text').textContent()) ?? '';
}

test('with no parameter and nothing stored the app opens in English (PQW-1100)', { tag: '@kiadas' }, async ({
  page,
}) => {
  await open(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/en\//);
  await expect(page.locator('#ui-language')).toHaveValue('en');
});

test('?lang=en gives an English interface, and the page language is English too', async ({ page }) => {
  await open(page, '?lang=en');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/en\//);

  await expect(page.locator('#ui-language')).toHaveValue('en');
});

test('?lang=hu gives a Hungarian interface, and the page language is Hungarian too (PQW-1100)', async ({ page }) => {
  await open(page, '?lang=hu');

  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/hu\//);

  await expect(page.locator('#ui-language')).toHaveValue('hu');
});

test('a document that asks for Hungarian gets it, without a parameter (PQW-1100)', async ({ page }) => {
  await withDocumentLanguage(page, 'hu');
  await open(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
  await expect(page.locator('#ui-language')).toHaveValue('hu');
});

test('a document in a language the app does not have falls back to English (PQW-1100)', async ({ page }) => {
  await withDocumentLanguage(page, 'de');
  await open(page);

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#ui-language')).toHaveValue('en');
});

test('the manual chooser switches within the page, and writes the language into the address bar too', async ({
  page,
}) => {
  await open(page);

  await page.locator('#ui-language').selectOption('hu');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/hu\//);
  expect(page.url()).toContain('lang=hu');

  await page.locator('#ui-language').selectOption('en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#home-link')).toHaveAttribute('href', /\/en\//);
  expect(page.url()).toContain('lang=en');
});

test('on a language change the labels of the dropdowns switch to the new language too', async ({ page }) => {
  await open(page);
  // The generator section: the panel fills the dropdowns when it is opened. It sits in
  // the make-a-pattern sheet now (PQW-987).
  await openSheet(page);
  await page.locator('#section-shape').evaluate((el) => {
    (el as HTMLDetailsElement).open = true;
  });
  await expect(page.locator('#shape-kind')).toContainText('Rectangle');

  await page.locator('#ui-language').selectOption('hu');
  await expect(page.locator('#shape-kind')).toContainText('Téglalap');
});

test('a notation stored in the other language does not survive the interface (PQW-1122)', async ({ page }) => {
  // The owner hit this on release day: a browser that had used the app in
  // Hungarian kept `terms: hu`, the interface resolved to English because no
  // language was stored, and the palette read "Láncszem (lsz)" under an English
  // bar — with no control on the page to change it. KB: owner-decisions.md §17
  await withTerms(page, 'hu');
  await open(page, '');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');
  await expect(page.locator('#palette')).toContainText('Chain (ch)');
  await expect(page.locator('#palette')).not.toContainText('Láncszem');
});

test('a notation stored in the other language does not survive a switch either (PQW-1122)', async ({ page }) => {
  await withTerms(page, 'en-US');
  await open(page, '?lang=hu');
  await expect(page.locator('#palette')).toContainText('Láncszem (lsz)');

  await page.locator('#ui-language').selectOption('en');
  await expect(page.locator('#palette')).toContainText('Chain (ch)');
});

test('within the language the stored terms hold, so UK terms stay reachable (PQW-1122)', async ({ page }) => {
  // The terms follow the language, not the other way round: giving that up
  // entirely would make UK terms unreachable, and the main site advertises them.
  await withTerms(page, 'en-GB');
  await open(page, '');

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#palette')).toContainText('Double crochet (dc)');
  await expect(page.locator('#palette')).not.toContainText('Single crochet (sc)');
});

test('the browser tab title and the description follow the interface language (PQW-905)', async ({ page }) => {
  await open(page);
  await expect(page).toHaveTitle(/Crochet Pattern Designer/);
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /crochet pattern designer/i);
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', /Crochet Pattern Designer/);

  await page.locator('#ui-language').selectOption('hu');
  await expect(page).toHaveTitle(/Horgolásminta-tervező/i);
  await expect(page.locator('head meta[name="description"]')).toHaveAttribute('content', /horgolásminta-tervező/i);
  await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', /horgolásminta-tervező/i);
});

test('the chosen language survives until the next opening (PQW-906)', async ({ page }) => {
  // The choice stored here is the Hungarian one on purpose: storing English would
  // prove nothing now that an empty store gives English anyway (PQW-1100).
  await open(page);
  await page.locator('#ui-language').selectOption('hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');

  // We reopen without the parameter: the stored choice decides, not the default.
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');

  // `?lang` beats the stored value: a shared link always gives its own language.
  await page.goto('/?lang=en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(sizeTitle(page)).toHaveText('Size and yarn');

  // And the parameter left the stored choice alone.
  await page.goto('/');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
});

test('a stored Hungarian choice beats the language of the document (PQW-1100)', async ({ page }) => {
  await open(page);
  await page.locator('#ui-language').selectOption('hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');

  // The served document says `lang="en"`, and the stored choice still wins.
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'hu');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
});

test('the stored language works even when the cookie bar is rejected (PQW-906)', async ({ page }) => {
  // Language is an operational setting, not tracking: it does not depend on the analytics consent.
  await page.goto('/');
  await page.locator('[data-consent="denied"]').click();
  await page.locator('#ui-language').selectOption('hu');

  await page.goto('/');
  await expect(sizeTitle(page)).toHaveText('Méret és fonal');
});

/*
 * The basic-stitch tiles (PQW-984, PQW-989) print the full name of the
 * notation, and the names differ between US and UK terms. The seven tiles have
 * to hold both sets at the owner's window size without the column widening the
 * page.
 */
test('the basic tiles hold the longer English names too (PQW-989)', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 506 });
  await open(page, '?lang=en');

  const cells = page.locator('#palette-basic .palette__grid').getByRole('button');
  await expect(cells).toHaveCount(7);
  await expect(page.locator('#palette').getByRole('button', { name: /Chain \(ch\)/ })).toHaveCount(1);
  await expect(page.locator('#palette').getByRole('button', { name: /Double treble \(dtr\)/ })).toHaveCount(1);

  await expect(page.locator('#palette')).toContainText('Double treble (dtr)');

  // KB: interface.md §36 — the target size holds at the longest names.
  for (const cell of await cells.all()) {
    const box = (await cell.boundingBox())!;
    expect(Math.round(box.width)).toBeGreaterThanOrEqual(44);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(44);
    await expect(cell).toBeInViewport({ ratio: 1 });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1000);
});

/*
 * The Hungarian interface, end to end (PQW-1100).
 *
 * Until this ticket every spec drove Hungarian, so a broken Hungarian
 * dictionary failed thirty files at once. They all drive English now, and this
 * block is the whole of the Hungarian coverage that is left: the chrome, the
 * cookie bar, the palette, the editor's answers, the status line, the error bar
 * and the written pattern. If a string here moves, the Hungarian branch of the
 * dictionary moved with it.
 */
/** The pattern's title, from the store the app writes it to (PQW-1048). */
const storedTitle = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => (JSON.parse(localStorage.getItem('dc-mintatervezo:minta') ?? '{}') as { title?: string }).title);

test.describe('the Hungarian interface', () => {
  test('the bar and the panel are Hungarian', async ({ page }) => {
    await open(page, '?lang=hu');

    await expect(page.locator('#stitches-title')).toHaveText('Szemek');
    await expect(sizeTitle(page)).toHaveText('Méret és fonal');
    await expect(page.locator('#view-toggle')).toContainText('Segédrács');
    await expect(page.locator('#zoom-toggle')).toContainText('Méretezés');
    await expect(page.getByRole('button', { name: 'Sor vége, fordulás' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Új minta' })).toBeVisible();
  });

  test('the cookie bar asks in Hungarian', async ({ page }) => {
    await page.goto('/?lang=hu');

    const bar = page.locator('#consent');
    await expect(bar).toBeVisible();
    await expect(page.locator('#consent-title')).toHaveText('Mérhetem a látogatást?');
    await expect(bar.getByRole('button', { name: 'Elfogadom' })).toBeVisible();

    // The label every other spec used to drive, and now drives in English.
    await bar.getByRole('button', { name: 'Elutasítom' }).click();
    await expect(bar).toBeHidden();
  });

  test('the palette names the stitches in Hungarian, and the editor answers in Hungarian', async ({ page }) => {
    await open(page, '?lang=hu');

    // Without a stored notation a Hungarian interface starts from Hungarian terms.
    await expect(page.locator('#palette')).toContainText('Láncszem (lsz)');
    await expect(page.locator('#palette')).toContainText('Rövidpálca (rp)');

    await page.locator('#board').focus();
    await page.keyboard.press('Alt+1');
    await page.locator('#chain-count').fill('6');
    await page.locator('#board').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#status')).toContainText('6 láncszem');
    await expect(page.locator('#summary')).toContainText('2. sor következik.');
  });

  test('a generated pattern is Hungarian in the status, the error bar and the written text', async ({ page }) => {
    await open(page, '?lang=hu');
    await openSheet(page);
    const section = page.locator('#section-rounds');
    if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
    await page.locator('#rounds-count').fill('4');
    await page.locator('#rounds-count').press('Tab');
    await section.getByRole('button', { name: 'Minta létrehozása' }).click();

    await expect(page.locator('#status')).toContainText('Lapos kör, 4 kör elkészült;');
    await expect(page.locator('#error-count')).toHaveText('Nincs hiba');

    // The title is what PQW-920 changed, and the status line above would not
    // have caught it: that comes from the interface dictionary, the title from
    // the notation the pattern records. KB: owner-decisions.md §16
    await expect.poll(() => storedTitle(page)).toBe('Lapos kör');

    // The written pattern follows the notation (PQW-920), which a Hungarian
    // interface defaults to Hungarian: the same four rounds korok.spec.ts reads
    // in English.
    const text = await writtenText(page);
    expect(text).toContain('3. kör: 1 lsz (fordulólánc), (szap., 1 rp) ×6 (18). Kör zárása: 1 ksz az első szembe.');
    expect(text).toContain('Rövidítések');

    await page.keyboard.press('ControlOrMeta+Z');
    await expect(page.locator('#status')).toContainText('Visszavonva.');
  });

  test('the first generated pattern of a session is Hungarian too (PQW-920)', async ({ page }) => {
    // The regression this guards: a fresh pattern records no notation, so the
    // title fell back to the default language and a Hungarian session opened
    // with an English title over a Hungarian pattern.
    await open(page, '?lang=hu');
    await openSheet(page);
    const section = page.locator('#section-shape');
    if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
    await section.getByRole('button', { name: 'Minta létrehozása' }).click();

    await expect.poll(() => storedTitle(page)).toBe('Téglalap');
    expect(await writtenText(page)).toContain('Téglalap');
  });

  test('an editable decimal default follows the interface, not the source (PQW-1100)', async ({ page }) => {
    // The panel rewrites its own fields after applyStaticTexts, so the markup
    // default alone proves nothing — this reads what is on the screen.
    await open(page, '?lang=hu');
    await openSheet(page);
    const section = page.locator('#section-garment');
    if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
    await expect(page.locator('#garment-below')).toHaveValue('14,5');
  });
});

test('an editable decimal default is a point on the English interface (PQW-1100)', async ({ page }) => {
  await open(page, '');
  await openSheet(page);
  const section = page.locator('#section-garment');
  if ((await section.getAttribute('open')) === null) await section.locator('summary').click();
  await expect(page.locator('#garment-below')).toHaveValue('14.5');
});
