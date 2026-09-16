/*
 * A számok alakja a felület nyelve szerint (PQW-905).
 *
 * Magyarul tizedesvessző, angolul tizedespont: a méretek, a mintasűrűség és a
 * fonalbecslés minden kiírt száma ezen megy át. A mértékegység (cm, g, m, mm)
 * mindkét nyelven ugyanaz, azt a szótár adja, nem ez a függvény.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { setUiLanguage } from '../src/ui/i18n.ts';
import { formatNumber } from '../src/ui/size-view.ts';

/** A tesztek után maradjon magyar a felület, hogy a többi teszt ne függjön a sorrendtől. */
function withLanguage(language, run) {
  try {
    setUiLanguage(language);
    return run();
  } finally {
    setUiLanguage('hu');
  }
}

test('magyarul tizedesvessző, angolul tizedespont', () => {
  assert.equal(withLanguage('hu', () => formatNumber(19.7)), '19,7');
  assert.equal(withLanguage('en', () => formatNumber(19.7)), '19.7');
  assert.equal(withLanguage('hu', () => formatNumber(8.45, 2)), '8,45');
  assert.equal(withLanguage('en', () => formatNumber(8.45, 2)), '8.45');
});

test('a tizedesek száma és a kerekítés mindkét nyelven ugyanaz', () => {
  for (const language of ['hu', 'en']) {
    withLanguage(language, () => {
      assert.equal(formatNumber(4).length, 1, 'egész számnál nincs fölösleges tizedes');
      assert.equal(formatNumber(4.04, 1).replace(',', '.'), '4');
      assert.equal(formatNumber(4.05, 1).replace(',', '.'), '4.1');
      assert.equal(formatNumber(2.5, 0).replace(',', '.'), '3');
    });
  }
});

test('nincs ezrestagolás egyik nyelven sem: a szemszám és a méter egyben marad', () => {
  assert.equal(withLanguage('hu', () => formatNumber(12500)), '12500');
  assert.equal(withLanguage('en', () => formatNumber(12500)), '12500');
});

test('a nyelvváltás azonnal látszik, tehát nem ragad be a gyorsítótárba', () => {
  const first = withLanguage('hu', () => formatNumber(1.5));
  const second = withLanguage('en', () => formatNumber(1.5));
  const third = withLanguage('hu', () => formatNumber(1.5));
  assert.deepEqual([first, second, third], ['1,5', '1.5', '1,5']);
});
