/*
 * Arriving at the designer with nothing to come back to (PQW-1133): the editor
 * is closed and „Új” is the only way on. KB: interface.md §80
 *
 * The spec deliberately does not seed the stored type the way `kezdet.ts` does —
 * the closed state is what it measures.
 */

import { expect, type Page, test } from '@playwright/test';

async function open(page: Page): Promise<void> {
  await page.goto('/');
  const deny = page.getByRole('button', { name: 'Decline' });
  if (await deny.isVisible()) await deny.click();
}

/** The middle of the canvas in window coordinates. */
async function boardCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator('#board').boundingBox();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

const chain = (page: Page) =>
  page
    .locator('#palette')
    .getByRole('button', { name: /Chain \(ch\)/ })
    .first();

test('a first visit opens closed: the stage says so and the stitches are out of reach', async ({ page }) => {
  await open(page);

  await expect(page.locator('#start-note')).toBeVisible();
  await expect(page.getByText('Every pattern begins with a type.')).toBeVisible();

  await expect(chain(page)).toBeDisabled();
  for (const action of ['fill-row', 'end-row', 'close-round', 'spiral-round', 'select-area', 'undo', 'redo']) {
    await expect(page.locator(`[data-action="${action}"]`)).toBeDisabled();
  }
  await expect(page.locator('#written-toggle')).toBeDisabled();

  // The view controls are not part of the gate.
  await expect(page.locator('[data-action="grid"]')).toBeEnabled();
  await expect(page.locator('#panel-toggle')).toBeEnabled();
  await expect(page.locator('#ui-language')).toBeEnabled();

  // The pattern's own settings are, because every one of them is written through `commit`.
  await expect(page.locator('#section-size')).toHaveAttribute('inert', '');
});

test('in a narrow window the note does not cover the side columns it leaves open', async ({ page }) => {
  // Below 48rem the note spans the whole stage, so only its button may take the pointer.
  await page.setViewportSize({ width: 600, height: 800 });
  await open(page);

  await page.locator('#panel-toggle').click();
  const box = await page.locator('#panel').boundingBox();
  const inside = { x: box!.x + box!.width / 2, y: box!.y + 24 };
  const id = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('#panel')?.id ?? '', inside);
  expect(id, 'the panel takes its own clicks').toBe('panel');
});

test('neither the canvas nor the keyboard crochets while it is closed', async ({ page }) => {
  await open(page);

  const center = await boardCenter(page);
  await page.mouse.click(center.x, center.y);
  // Alt+1 is the chain stitch; Enter and Alt+F are the two keyboard ways to crochet.
  await page.keyboard.press('Alt+Digit1');
  await expect(chain(page)).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#board').press('Enter');
  await page.locator('#board').press('Alt+KeyF');

  await expect(page.locator('#summary')).toContainText('Empty pattern: start with a foundation chain');
  await expect(page.locator('#start-note')).toBeVisible();
});

test('the stage button leads to the one menu that starts a pattern, and a type opens the editor', async ({ page }) => {
  await open(page);

  await page.locator('#start-new').click();
  await expect(page.locator('#types')).toBeVisible();
  await expect(page.locator('#types-toggle')).toHaveAttribute('aria-expanded', 'true');
  // Nothing is the chosen type yet, so the first card that can be chosen takes the focus.
  await expect(page.locator('.type[aria-pressed="true"]')).toHaveCount(0);
  await expect(page.locator('.type:not([disabled])').first()).toBeFocused();

  await page.getByRole('button', { name: 'Free-form designer' }).click();

  await expect(page.locator('#start-note')).toBeHidden();
  await expect(chain(page)).toBeEnabled();
  await expect(page.locator('[data-action="undo"]')).toBeEnabled();
  await expect(page.locator('[data-action="note-text"]')).toBeEnabled();
  await expect(page.locator('#section-size')).not.toHaveAttribute('inert', '');
});

test('opening a JSON is the second way in, and the cards say which type it opened', async ({ page }) => {
  await open(page);

  await page.locator('#file-toggle').click();
  await page.locator('#json-toggle').click();
  await page.locator('#import-file').setInputFiles({
    name: 'minta.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        formatVersion: 1,
        title: 'Scarf',
        conventions: {
          turningChainCounts: 'stitch-default',
          roundEnd: 'stitch-default',
          picotCounts: false,
          joinSlipStitchCounts: false,
          chainCounts: true,
        },
        pieces: [
          {
            id: 'p1',
            name: 'Piece',
            stitches: [
              { id: 's1', def: 'ch', prev: null, anchors: [] },
              { id: 's2', def: 'ch', prev: 's1', anchors: [] },
            ],
            spaces: [],
            rings: [],
            groups: [],
            events: [],
            skipped: [],
          },
        ],
      }),
    ),
  });

  await expect(page.locator('#start-note')).toBeHidden();
  await expect(chain(page)).toBeEnabled();
  await page.locator('#types-toggle').click();
  await expect(page.getByRole('button', { name: 'Regular crochet' })).toHaveAttribute('aria-pressed', 'true');
});

test('a flat shape opens the editor too, and the gate stays open after a reload', async ({ page }) => {
  await open(page);

  await page.locator('#types-toggle').click();
  await page.getByRole('button', { name: 'Regular crochet' }).click();
  await page.getByRole('menuitem', { name: 'Flat shape' }).click();
  await expect(page.locator('#start-note')).toBeHidden();

  await page.reload();
  await expect(page.locator('#start-note')).toBeHidden();
  await expect(chain(page)).toBeEnabled();
});
