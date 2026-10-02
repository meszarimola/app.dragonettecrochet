/*
 * The chart style setting (PQW-868): CYC or JIS, stored apart from the
 * interface language, and the terms follow the interface language.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { readChartStyle, symbolOptionsFor, termsFor, writeChartStyle } from '../src/ui/notation.ts';

test('the terms follow the interface language: Hungarian or US', () => {
  assert.equal(termsFor('hu'), 'hu');
  assert.equal(termsFor('en'), 'en-US');
});

test('a stored chart style is read back, and anything else falls back to CYC', () => {
  assert.equal(readChartStyle(writeChartStyle(null, 'jis')), 'jis');
  assert.equal(readChartStyle(writeChartStyle(null, 'cyc')), 'cyc');
  for (const stored of [null, '', '{', 'null', '"jis"', '{"chartStyle":"abc"}', '[]']) {
    assert.equal(readChartStyle(stored), 'cyc', String(stored));
  }
});

test('a notation stored before the rewrite keeps its chart style', () => {
  assert.equal(readChartStyle('{"terms":"en-GB","chartStyle":"jis","singleCrochet":"cross"}'), 'jis');
});

test('writing the chart style keeps the stored terms, and the × follows JIS', () => {
  const written = JSON.parse(writeChartStyle('{"terms":"en-GB","chartStyle":"cyc","singleCrochet":"plus"}', 'jis'));
  assert.deepEqual(written, { terms: 'en-GB', chartStyle: 'jis', singleCrochet: 'cross' });
  assert.deepEqual(JSON.parse(writeChartStyle('not json', 'cyc')), { chartStyle: 'cyc', singleCrochet: 'plus' });
});

test('JIS draws single crochet as ×, CYC as +', () => {
  assert.deepEqual(symbolOptionsFor('jis'), { singleCrochet: 'cross', style: 'jis' });
  assert.deepEqual(symbolOptionsFor('cyc'), { singleCrochet: 'plus', style: 'cyc' });
});
