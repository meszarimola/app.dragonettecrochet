/*
 * The rectangular design's dialog (PQW-1168): every code a count can fail with
 * has a message in both languages, and the limit it names is the field's own.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { MAX_GRID_ROWS, MAX_GRID_STITCHES, readGridCount } from '../src/core/grid.ts';
import { gridCountMessage } from '../src/ui/grid-dialog.ts';
import { UI_LANGUAGES, UI_TEXTS } from '../src/ui/i18n.ts';

const CODES = ['grid-count-empty', 'grid-count-not-whole', 'grid-count-too-small', 'grid-count-too-large'];

test('every failure code has a message of its own in both languages', () => {
  for (const language of UI_LANGUAGES) {
    const words = UI_TEXTS[language].sections.gridCount;
    const messages = CODES.map((code) => gridCountMessage(code, MAX_GRID_ROWS, words));
    assert.ok(
      messages.every((message) => message.length > 0),
      language,
    );
    assert.equal(new Set(messages).size, CODES.length, `${language}: two codes share a message`);
  }
});

test('too large names the limit of the field it is about', () => {
  for (const language of UI_LANGUAGES) {
    const words = UI_TEXTS[language].sections.gridCount;
    assert.match(gridCountMessage('grid-count-too-large', MAX_GRID_STITCHES, words), /\b200\b/);
    assert.match(gridCountMessage('grid-count-too-large', MAX_GRID_ROWS, words), /\b500\b/);
  }
});

test('every code the core can return is one the dialog knows', () => {
  const returned = ['', 'x', '0', '999'].map((text) => readGridCount(text, MAX_GRID_STITCHES)).map((r) => r.code);
  assert.deepEqual(new Set(returned), new Set(CODES));
});
