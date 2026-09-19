/*
 * The id of a grid colour (PQW-905).
 *
 * A language-independent id goes into the saved pattern, not the translated
 * name: someone who saves on an English interface and reopens on a Hungarian
 * one should see the same colour in their own language. The name comes from
 * the display — in the interface language on screen, in the notation language
 * in the written pattern (PQW-868) — while whatever the user typed in stays
 * exactly as it was.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { VOCABULARIES } from '../src/core/pattern-text.ts';
import { DEFAULT_COLORS, colorLabel } from '../src/ui/grid-chart-view.ts';
import { setUiLanguage } from '../src/ui/i18n.ts';

/** Restores the Hungarian interface afterwards so no other test depends on order. */
function withLanguage(language, run) {
  try {
    setUiLanguage(language);
    return run();
  } finally {
    setUiLanguage('hu');
  }
}

test('built-in colours carry an id, not a name', () => {
  assert.ok(DEFAULT_COLORS.length >= 2);
  for (const color of DEFAULT_COLORS) {
    assert.ok(color.id, `missing id: ${JSON.stringify(color)}`);
    assert.equal(color.name, undefined, 'the name of a built-in colour belongs to the display, not to the saved data');
    assert.match(color.hex, /^#[0-9a-f]{6}$/i);
  }
  assert.deepEqual(DEFAULT_COLORS.map((color) => color.id), ['natural', 'burgundy']);
});

test('the saved data comes out identical in both languages', () => {
  const hu = withLanguage('hu', () => JSON.stringify(DEFAULT_COLORS));
  const en = withLanguage('en', () => JSON.stringify(DEFAULT_COLORS));
  assert.equal(hu, en, 'a saved colour must not depend on the interface language');
  assert.match(hu, /"id":\s*"natural"/);
  assert.doesNotMatch(hu, /Natúr|Natural/);
});

test('the displayed name follows the interface language', () => {
  assert.equal(withLanguage('hu', () => colorLabel(DEFAULT_COLORS[0])), 'Natúr');
  assert.equal(withLanguage('en', () => colorLabel(DEFAULT_COLORS[0])), 'Natural');
  assert.equal(withLanguage('hu', () => colorLabel(DEFAULT_COLORS[1])), 'Bordó');
  assert.equal(withLanguage('en', () => colorLabel(DEFAULT_COLORS[1])), 'Burgundy');
});

test('a user-given name is never translated, and an older pattern saved with a name still shows', () => {
  const own = { name: 'Anyu fonala', hex: '#123456' };
  assert.equal(withLanguage('hu', () => colorLabel(own)), 'Anyu fonala');
  assert.equal(withLanguage('en', () => colorLabel(own)), 'Anyu fonala');

  // A save from before PQW-905 holds only a name: it is shown unchanged.
  const legacy = { name: 'Natúr', hex: '#f3ecdf' };
  assert.equal(withLanguage('en', () => colorLabel(legacy)), 'Natúr');

  // An unknown id does not make the row vanish either: the fallback text is used.
  assert.equal(withLanguage('hu', () => colorLabel({ id: 'nincs-ilyen', hex: '#000000' }, 'A')), 'A');
  assert.equal(colorLabel(undefined, 'A'), 'A');
});

test('the written pattern names a built-in colour in the notation language', () => {
  assert.equal(VOCABULARIES.hu.colorwork.colorNames['natural'], 'Natúr');
  assert.equal(VOCABULARIES['en-US'].colorwork.colorNames['natural'], 'Natural');
  assert.equal(VOCABULARIES['en-GB'].colorwork.colorNames['burgundy'], 'Burgundy');
  // Every built-in colour has a name in all three vocabularies.
  for (const id of DEFAULT_COLORS.map((color) => color.id)) {
    for (const locale of ['hu', 'en-US', 'en-GB']) {
      assert.ok(VOCABULARIES[locale].colorwork.colorNames[id], `${locale}/${id}`);
    }
  }
});
