/*
 * The notation and chart style settings (PQW-868): the default follows the
 * interface language, a stored choice is independent of it, the JIS symbol
 * drawing, and a pattern records the notation it was made with.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import {
  TERMS,
  defaultNotation,
  notationForTradition,
  readNotation,
  symbolOptionsFor,
  termsLabel,
  textLanguage,
  traditionLabel,
  uiLanguageOf,
  withNotation,
  writeNotation,
} from '../src/ui/notation.ts';
import { hdcRectangle } from './fixtures/examples.ts';

test('the default notation is Hungarian on a Hungarian interface and US on an English one', () => {
  assert.deepEqual(defaultNotation('hu'), { terms: 'hu', chartStyle: 'cyc', singleCrochet: 'plus' });
  assert.deepEqual(defaultNotation('en'), { terms: 'en-US', chartStyle: 'cyc', singleCrochet: 'plus' });
  assert.equal(readNotation(null, 'en').terms, 'en-US');
});

test('the interface language comes from the <html lang> value', () => {
  assert.deepEqual(['hu', 'en', 'en-GB', 'EN-us', '', 'de'].map(uiLanguageOf), ['hu', 'en', 'en', 'en', 'hu', 'hu']);
});

test('the interface language and the notation can be set independently', () => {
  for (const ui of ['hu', 'en']) {
    for (const terms of TERMS) {
      const stored = writeNotation({ terms, chartStyle: 'jis', singleCrochet: 'cross' });
      assert.deepEqual(readNotation(stored, ui), { terms, chartStyle: 'jis', singleCrochet: 'cross' }, `${ui}, ${terms}`);
    }
  }
});

test('a missing or invalid setting falls back to the default field by field', () => {
  for (const stored of [null, '', 'nem json', '[]', 'null', '42']) {
    assert.deepEqual(readNotation(stored, 'hu'), defaultNotation('hu'), String(stored));
  }
  // The single crochet symbol is not a stored setting, it follows the chart style (PQW-929): JIS → ×.
  assert.deepEqual(readNotation('{"terms":"jp","chartStyle":"jis","singleCrochet":"x"}', 'en'), {
    terms: 'en-US',
    chartStyle: 'jis',
    singleCrochet: 'cross',
  });
  // A previously stored „×” does not come back in CYC style either: the owner asked for the + symbol.
  assert.deepEqual(readNotation('{"terms":"hu","chartStyle":"cyc","singleCrochet":"cross"}', 'hu'), {
    terms: 'hu',
    chartStyle: 'cyc',
    singleCrochet: 'plus',
  });
});

test('the symbol drawing options come from the chart style and the single crochet symbol', () => {
  assert.deepEqual(symbolOptionsFor(defaultNotation('hu')), { singleCrochet: 'plus', style: 'cyc' });
  assert.deepEqual(symbolOptionsFor({ terms: 'hu', chartStyle: 'jis', singleCrochet: 'plus' }), { singleCrochet: 'plus', style: 'jis' });
});

test('a saved pattern records the notation it was made with, and the graph is left alone', () => {
  const { pattern } = hdcRectangle({ rows: 2 });
  const notation = { terms: 'en-GB', chartStyle: 'cyc', singleCrochet: 'cross' };
  const stamped = withNotation(pattern, notation);
  assert.deepEqual(stamped.notation, notation);
  assert.deepEqual({ ...stamped, notation: undefined }, { ...pattern, notation: undefined });

  const loaded = loadPattern(savePattern(stamped));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.pattern.notation, notation);
});

test('the Japanese preset turns on JIS symbols and the × single crochet while the written terms stay (PQW-876)', () => {
  const start = { terms: 'en-GB', chartStyle: 'cyc', singleCrochet: 'plus' };
  const japanese = notationForTradition(start, 'japanese');
  assert.deepEqual(japanese, { terms: 'en-GB', chartStyle: 'jis', singleCrochet: 'cross' });
  assert.deepEqual(symbolOptionsFor(japanese), { singleCrochet: 'cross', style: 'jis' });
  assert.deepEqual(notationForTradition(japanese, 'cyc'), start);
  assert.deepEqual(['cyc', 'japanese'].map(traditionLabel), ['nemzetközi (CYC)', 'japán']);
});

test('the notation labels name the term system', () => {
  assert.deepEqual(TERMS.map(termsLabel), ['magyar', 'amerikai angol (US terms)', 'brit angol (UK terms)']);
  assert.deepEqual(TERMS.map(textLanguage), ['hu', 'en', 'en']);
});
