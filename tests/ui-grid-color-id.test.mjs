/*
 * A rács színeinek azonosítója (PQW-905).
 *
 * A mentett mintába nyelvfüggetlen azonosító kerül, nem a lefordított név: aki
 * angol felületen ment és magyaron nyit meg, ugyanazt a színt lássa a saját
 * nyelvén. A nevet a megjelenítés adja — a felületen a felület nyelvén, az
 * írott mintában a jelölés nyelvén (PQW-868) —, amit pedig a felhasználó maga
 * ír be, az változatlanul marad.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { VOCABULARIES } from '../src/core/pattern-text.ts';
import { DEFAULT_COLORS, colorLabel } from '../src/ui/grid-chart-view.ts';
import { setUiLanguage } from '../src/ui/i18n.ts';

/** A tesztek után maradjon magyar a felület, hogy a többi teszt ne függjön a sorrendtől. */
function withLanguage(language, run) {
  try {
    setUiLanguage(language);
    return run();
  } finally {
    setUiLanguage('hu');
  }
}

test('a beépített színek azonosítót visznek, nevet nem', () => {
  assert.ok(DEFAULT_COLORS.length >= 2);
  for (const color of DEFAULT_COLORS) {
    assert.ok(color.id, `hiányzó azonosító: ${JSON.stringify(color)}`);
    assert.equal(color.name, undefined, 'a beépített szín neve a megjelenítésé, nem a mentett adaté');
    assert.match(color.hex, /^#[0-9a-f]{6}$/i);
  }
  assert.deepEqual(DEFAULT_COLORS.map((color) => color.id), ['natural', 'burgundy']);
});

test('mindkét nyelven ugyanaz kerül a mentett adatba', () => {
  const hu = withLanguage('hu', () => JSON.stringify(DEFAULT_COLORS));
  const en = withLanguage('en', () => JSON.stringify(DEFAULT_COLORS));
  assert.equal(hu, en, 'a mentett szín nem függhet a felület nyelvétől');
  assert.match(hu, /"id":\s*"natural"/);
  assert.doesNotMatch(hu, /Natúr|Natural/);
});

test('a megjelenített név a felület nyelvét követi', () => {
  assert.equal(withLanguage('hu', () => colorLabel(DEFAULT_COLORS[0])), 'Natúr');
  assert.equal(withLanguage('en', () => colorLabel(DEFAULT_COLORS[0])), 'Natural');
  assert.equal(withLanguage('hu', () => colorLabel(DEFAULT_COLORS[1])), 'Bordó');
  assert.equal(withLanguage('en', () => colorLabel(DEFAULT_COLORS[1])), 'Burgundy');
});

test('a saját név nem fordul, és a régi, névvel mentett minta is megjelenik', () => {
  const own = { name: 'Anyu fonala', hex: '#123456' };
  assert.equal(withLanguage('hu', () => colorLabel(own)), 'Anyu fonala');
  assert.equal(withLanguage('en', () => colorLabel(own)), 'Anyu fonala');

  // A PQW-905 előtti mentésben csak név van: az változatlanul látszik.
  const legacy = { name: 'Natúr', hex: '#f3ecdf' };
  assert.equal(withLanguage('en', () => colorLabel(legacy)), 'Natúr');

  // Ismeretlen azonosítónál sem tűnik el a sor: a tartalék szöveg jön.
  assert.equal(withLanguage('hu', () => colorLabel({ id: 'nincs-ilyen', hex: '#000000' }, 'A')), 'A');
  assert.equal(colorLabel(undefined, 'A'), 'A');
});

test('az írott minta a jelölés nyelvén nevezi meg a beépített színt', () => {
  assert.equal(VOCABULARIES.hu.colorwork.colorNames['natural'], 'Natúr');
  assert.equal(VOCABULARIES['en-US'].colorwork.colorNames['natural'], 'Natural');
  assert.equal(VOCABULARIES['en-GB'].colorwork.colorNames['burgundy'], 'Burgundy');
  // Minden beépített színnek van neve mindhárom szókészletben.
  for (const id of DEFAULT_COLORS.map((color) => color.id)) {
    for (const locale of ['hu', 'en-US', 'en-GB']) {
      assert.ok(VOCABULARIES[locale].colorwork.colorNames[id], `${locale}/${id}`);
    }
  }
});
