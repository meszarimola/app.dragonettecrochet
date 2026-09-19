/*
 * The pattern title on generation (PQW-896): every generator (Forma, Kendő,
 * Kör és motívum, Amigurumi, Rácsminta) titles the pattern after the shape it
 * generated, unless the user gave a title of their own; the flag survives
 * saving, and a legacy save without the flag still decides correctly.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { generateFilet } from '../src/core/filet.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { hasOwnTitle, withGeneratedTitle } from '../src/core/pattern-title.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { DEFAULT_SHAPE, generateShape } from '../src/core/shapes.ts';
import { DEFAULT_SHAWL, generateShawl } from '../src/core/shawls.ts';

const ok = (result) => {
  assert.ok(result.ok, result.reason);
  return result.pattern;
};

/** The "Minta létrehozása" action in all five generators, at small sizes. */
const generators = {
  Kendő: (pattern) => ok(generateShawl(pattern, { ...DEFAULT_SHAWL, kind: 'semicircle', stitch: 'sc', sizeCm: 5 })),
  Forma: (pattern) => ok(generateShape(pattern, { ...DEFAULT_SHAPE, widthCm: 5, heightCm: 5 })),
  'Kör és motívum': (pattern) => ok(generateMotif(pattern, { ...DEFAULT_MOTIF, rounds: 3 })),
  Amigurumi: (pattern) =>
    ok(
      createAmigurumi(
        pattern,
        { name: '', shape: { kind: 'sphere', diameterCm: 4, method: '6n' }, stagger: true, eyes: false },
        false,
      ),
    ),
  Rácsminta: (pattern) =>
    ok(
      generateFilet(pattern, {
        cells: [
          [1, 0],
          [0, 1],
        ],
        unit: null,
        lettering: false,
      }),
    ),
};

/** A hand-edited title, the way the "Minta neve" field saves it (src/ui/main.ts). */
const renamed = (pattern, title) => ({ ...pattern, title, titleGenerated: false });

describe('generated title', () => {
  test('switching generator always retitles to the new shape: Kendő → Forma → Kör és motívum → Amigurumi → Rácsminta → Kendő', () => {
    let pattern = emptyPattern();
    const titles = [];
    for (const name of [...Object.keys(generators), 'Kendő']) {
      pattern = generators[name](pattern);
      assert.equal(pattern.titleGenerated, true, name);
      assert.equal(pattern.title, pattern.pieces[0].name, `${name}: the title is the piece name`);
      titles.push(pattern.title);
    }
    assert.deepEqual(titles, ['Félkör', 'Téglalap', 'Lapos kör', titles[3], titles[4], 'Félkör']);
    assert.equal(new Set(titles).size, 5);
  });

  test('a hand-written title survives every generator, even when it matches a generated name', () => {
    for (const title of ['Nyári kendő', 'Félkör']) {
      let pattern = renamed(emptyPattern(), title);
      for (const [name, generate] of Object.entries(generators)) {
        pattern = generate(pattern);
        assert.equal(pattern.title, title, `${name}: ${title}`);
        assert.equal(pattern.titleGenerated, false, name);
      }
    }
  });

  test('a title cleared to blank falls back to the shape name', () => {
    const pattern = generators.Forma(renamed(emptyPattern(), '  '));
    assert.deepEqual([pattern.title, pattern.titleGenerated], ['Téglalap', true]);
  });
});

describe('legacy save without the flag', () => {
  test('the default title, the piece name and a known generator name all count as generated; any other title counts as an own title', () => {
    const shawl = generators.Kendő(emptyPattern());
    const { titleGenerated: _, ...legacy } = shawl;
    // The bug open since PQW-865: a shawl titled „Félkör” stayed „Félkör” once it became a rectangle.
    assert.equal(hasOwnTitle(legacy), false);
    assert.equal(generators.Forma(legacy).title, 'Téglalap');
    assert.equal(hasOwnTitle(emptyPattern()), false);
    assert.equal(hasOwnTitle(emptyPattern('Lapos kör'), ['Lapos kör']), false);
    assert.equal(hasOwnTitle(emptyPattern('Nyári takaró'), ['Lapos kör']), true);
    assert.equal(generators.Forma(emptyPattern('Nyári takaró')).title, 'Nyári takaró');
  });

  test('the own-title flag carries over onto the generated pattern; an unflagged own title stays unflagged', () => {
    const shape = generators.Forma(emptyPattern());
    assert.equal(withGeneratedTitle(shape, renamed(emptyPattern(), 'Sál'), 'Téglalap').titleGenerated, false);
    assert.equal(withGeneratedTitle(shape, emptyPattern('Sál'), 'Téglalap').titleGenerated, undefined);
  });
});

describe('saving', () => {
  test('the flag survives a JSON round trip; an invalid value fails to load; a legacy save loads without the flag', () => {
    const generated = generators.Forma(emptyPattern());
    assert.equal(loadPattern(savePattern(generated)).pattern.titleGenerated, true);
    assert.equal(loadPattern(savePattern(renamed(generated, 'Sál'))).pattern.titleGenerated, false);
    const wrong = JSON.parse(savePattern(generated));
    wrong.titleGenerated = 'igen';
    assert.equal(loadPattern(JSON.stringify(wrong)).ok, false);
    const old = JSON.parse(savePattern(generated));
    delete old.titleGenerated;
    const loaded = loadPattern(JSON.stringify(old));
    assert.ok(loaded.ok);
    assert.equal(loaded.pattern.titleGenerated, undefined);
  });
});
