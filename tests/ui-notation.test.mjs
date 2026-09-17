/*
 * A jelölés és a jelstílus beállítása (PQW-868): alapértelmezés a felület
 * nyelvéből, a mentett választás attól függetlenül, a JIS jelrajz, és a
 * minta rögzíti a jelölését.
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

test('magyar felületen magyar, angol felületen amerikai az alapértelmezett jelölés', () => {
  assert.deepEqual(defaultNotation('hu'), { terms: 'hu', chartStyle: 'cyc', singleCrochet: 'plus' });
  assert.deepEqual(defaultNotation('en'), { terms: 'en-US', chartStyle: 'cyc', singleCrochet: 'plus' });
  assert.equal(readNotation(null, 'en').terms, 'en-US');
});

test('a felület nyelve a <html lang> értékéből', () => {
  assert.deepEqual(['hu', 'en', 'en-GB', 'EN-us', '', 'de'].map(uiLanguageOf), ['hu', 'en', 'en', 'en', 'hu', 'hu']);
});

test('a felület nyelve és a jelölés egymástól függetlenül állítható', () => {
  for (const ui of ['hu', 'en']) {
    for (const terms of TERMS) {
      const stored = writeNotation({ terms, chartStyle: 'jis', singleCrochet: 'cross' });
      assert.deepEqual(readNotation(stored, ui), { terms, chartStyle: 'jis', singleCrochet: 'cross' }, `${ui}, ${terms}`);
    }
  }
});

test('hiányzó vagy érvénytelen beállítás helyett mezőnként az alapértelmezés', () => {
  for (const stored of [null, '', 'nem json', '[]', 'null', '42']) {
    assert.deepEqual(readNotation(stored, 'hu'), defaultNotation('hu'), String(stored));
  }
  // A rövidpálca jele nem tárolt beállítás, hanem a jelstílusból jön (PQW-929): JIS → ×.
  assert.deepEqual(readNotation('{"terms":"jp","chartStyle":"jis","singleCrochet":"x"}', 'en'), {
    terms: 'en-US',
    chartStyle: 'jis',
    singleCrochet: 'cross',
  });
  // Egy korábban tárolt „×” CYC stílusban sem jön vissza: a tulajdonos + jelet kért.
  assert.deepEqual(readNotation('{"terms":"hu","chartStyle":"cyc","singleCrochet":"cross"}', 'hu'), {
    terms: 'hu',
    chartStyle: 'cyc',
    singleCrochet: 'plus',
  });
});

test('a jelrajz beállítása a jelstílusból és a rövidpálca jeléből', () => {
  assert.deepEqual(symbolOptionsFor(defaultNotation('hu')), { singleCrochet: 'plus', style: 'cyc' });
  assert.deepEqual(symbolOptionsFor({ terms: 'hu', chartStyle: 'jis', singleCrochet: 'plus' }), { singleCrochet: 'plus', style: 'jis' });
});

test('a mentett minta megmondja, milyen jelöléssel készült, a gráf nem változik', () => {
  const { pattern } = hdcRectangle({ rows: 2 });
  const notation = { terms: 'en-GB', chartStyle: 'cyc', singleCrochet: 'cross' };
  const stamped = withNotation(pattern, notation);
  assert.deepEqual(stamped.notation, notation);
  assert.deepEqual({ ...stamped, notation: undefined }, { ...pattern, notation: undefined });

  const loaded = loadPattern(savePattern(stamped));
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.pattern.notation, notation);
});

test('a japán előbeállítás a JIS jeleket és a × rövidpálcát kapcsolja be, a szövegjelölés marad (PQW-876)', () => {
  const start = { terms: 'en-GB', chartStyle: 'cyc', singleCrochet: 'plus' };
  const japanese = notationForTradition(start, 'japanese');
  assert.deepEqual(japanese, { terms: 'en-GB', chartStyle: 'jis', singleCrochet: 'cross' });
  assert.deepEqual(symbolOptionsFor(japanese), { singleCrochet: 'cross', style: 'jis' });
  assert.deepEqual(notationForTradition(japanese, 'cyc'), start);
  assert.deepEqual(['cyc', 'japanese'].map(traditionLabel), ['nemzetközi (CYC)', 'japán']);
});

test('az angol jelölés neve megnevezi a rendszert', () => {
  assert.deepEqual(TERMS.map(termsLabel), ['magyar', 'amerikai angol (US terms)', 'brit angol (UK terms)']);
  assert.deepEqual(TERMS.map(textLanguage), ['hu', 'en', 'en']);
});
