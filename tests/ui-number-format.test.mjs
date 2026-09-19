/*
 * Number formatting follows the interface language (PQW-905).
 *
 * Decimal comma in Hungarian, decimal point in English: every printed number
 * of the sizes, the gauge and the yarn estimate goes through this. The unit
 * (cm, g, m, mm) is the same in both languages and comes from the dictionary,
 * not from this function.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { setUiLanguage } from '../src/ui/i18n.ts';
import { formatNumber } from '../src/ui/size-view.ts';

/** Restores the Hungarian interface afterwards so no other test depends on order. */
function withLanguage(language, run) {
  try {
    setUiLanguage(language);
    return run();
  } finally {
    setUiLanguage('hu');
  }
}

test('decimal comma in Hungarian, decimal point in English', () => {
  assert.equal(withLanguage('hu', () => formatNumber(19.7)), '19,7');
  assert.equal(withLanguage('en', () => formatNumber(19.7)), '19.7');
  assert.equal(withLanguage('hu', () => formatNumber(8.45, 2)), '8,45');
  assert.equal(withLanguage('en', () => formatNumber(8.45, 2)), '8.45');
});

test('decimal places and rounding behave the same in both languages', () => {
  for (const language of ['hu', 'en']) {
    withLanguage(language, () => {
      assert.equal(formatNumber(4).length, 1, 'a whole number gets no needless decimals');
      assert.equal(formatNumber(4.04, 1).replace(',', '.'), '4');
      assert.equal(formatNumber(4.05, 1).replace(',', '.'), '4.1');
      assert.equal(formatNumber(2.5, 0).replace(',', '.'), '3');
    });
  }
});

test('neither language groups thousands: stitch counts and metres stay unbroken', () => {
  assert.equal(withLanguage('hu', () => formatNumber(12500)), '12500');
  assert.equal(withLanguage('en', () => formatNumber(12500)), '12500');
});

test('a language switch shows up at once, so nothing sticks in a cache', () => {
  const first = withLanguage('hu', () => formatNumber(1.5));
  const second = withLanguage('en', () => formatNumber(1.5));
  const third = withLanguage('hu', () => formatNumber(1.5));
  assert.deepEqual([first, second, third], ['1,5', '1.5', '1,5']);
});
