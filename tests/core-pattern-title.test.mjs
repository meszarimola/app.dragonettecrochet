/*
 * The pattern title on generation (PQW-896): every generator (Forma, Kendő,
 * Kör és motívum, Amigurumi, Rácsminta) titles the pattern after the shape it
 * generated, unless the user gave a title of their own; the flag survives
 * saving, and a legacy save without the flag still decides correctly.
 *
 * The language of that title follows the pattern's NOTATION, not the interface
 * (PQW-920, owner-decisions.md §16). A legacy save therefore has to be
 * recognised by the names of every locale, or a pattern made in Hungarian and
 * reopened in US terms would look as if the user had typed its title.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { generateFilet } from '../src/core/filet.ts';
import { DEFAULT_GARMENT, GARMENT_NAMES, generateGarment } from '../src/core/garments.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { allLocaleNames, hasOwnTitle, withGeneratedTitle } from '../src/core/pattern-title.ts';
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

/** The pattern records the notation it was made in; the generated title follows it. */
const inNotation = (pattern, terms) => ({ ...pattern, notation: { terms, chartStyle: 'cyc', singleCrochet: 'plus' } });

/** A save from before the flag: only the names can tell a generated title from a typed one. */
const legacySave = (pattern) => {
  const { titleGenerated: _, ...rest } = pattern;
  return rest;
};

/** The sweater names its pieces, not itself, so its title is never one of its piece names. */
const sweater = (pattern) => ok(generateGarment(pattern, DEFAULT_GARMENT));

const GENERATED_NAMES = {
  hu: ['Félkör', 'Téglalap', 'Lapos kör', 'Gömb', 'Filé'],
  'en-US': ['Semicircle', 'Rectangle', 'Flat circle', 'Sphere', 'Filet'],
  'en-GB': ['Semicircle', 'Rectangle', 'Flat circle', 'Sphere', 'Filet'],
};

describe('generated title', () => {
  for (const [terms, names] of Object.entries(GENERATED_NAMES)) {
    test(`switching generator always retitles to the new shape, in the language of the notation (${terms}): Kendő → Forma → Kör és motívum → Amigurumi → Rácsminta → Kendő`, () => {
      let pattern = inNotation(emptyPattern(), terms);
      const titles = [];
      for (const name of [...Object.keys(generators), 'Kendő']) {
        pattern = generators[name](pattern);
        assert.equal(pattern.titleGenerated, true, name);
        assert.equal(pattern.title, pattern.pieces[0].name, `${name}: the title is the piece name`);
        titles.push(pattern.title);
      }
      assert.deepEqual(titles, [...names, names[0]]);
      assert.equal(new Set(titles).size, 5);
    });
  }

  test('a pattern that records no notation falls back to English, as the interface does', () => {
    assert.equal(generators.Forma(emptyPattern()).title, 'Rectangle');
  });

  test('switching the notation alone does not rewrite an existing title', () => {
    const shape = generators.Forma(inNotation(emptyPattern(), 'hu'));
    assert.equal(inNotation(shape, 'en-US').title, 'Téglalap');
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
    const pattern = generators.Forma(renamed(inNotation(emptyPattern(), 'hu'), '  '));
    assert.deepEqual([pattern.title, pattern.titleGenerated], ['Téglalap', true]);
  });
});

describe('legacy save without the flag', () => {
  test('the default title, the piece name and a known generator name all count as generated; any other title counts as an own title', () => {
    const legacy = legacySave(generators.Kendő(inNotation(emptyPattern(), 'hu')));
    // The bug open since PQW-865: a shawl titled „Félkör” stayed „Félkör” once it became a rectangle.
    assert.equal(hasOwnTitle(legacy), false);
    assert.equal(generators.Forma(legacy).title, 'Téglalap');
    assert.equal(hasOwnTitle(emptyPattern()), false);
    assert.equal(hasOwnTitle(emptyPattern('Lapos kör'), ['Lapos kör']), false);
    assert.equal(hasOwnTitle(emptyPattern('Nyári takaró'), ['Lapos kör']), true);
    assert.equal(generators.Forma(emptyPattern('Nyári takaró')).title, 'Nyári takaró');
  });

  test('the default title of every locale counts as generated, whichever notation opens the pattern', () => {
    assert.equal(hasOwnTitle(inNotation(emptyPattern('Új minta'), 'en-US')), false);
    assert.equal(hasOwnTitle(inNotation(emptyPattern('New pattern'), 'hu')), false);
  });

  test('a title generated in one notation is still a generated title in another (PQW-920)', () => {
    const hungarian = legacySave(sweater(inNotation(emptyPattern(), 'hu')));
    assert.equal(hungarian.title, 'Ledobott vállú pulóver');
    assert.equal(
      hungarian.pieces.some((piece) => piece.name === hungarian.title),
      false,
      'the sweater title is not one of its piece names, so only the name list can place it',
    );
    for (const terms of ['en-US', 'en-GB']) {
      const reopened = inNotation(hungarian, terms);
      assert.equal(hasOwnTitle(reopened, allLocaleNames(GARMENT_NAMES)), false, terms);
      assert.equal(sweater(reopened).title, 'Drop-shoulder sweater', terms);
    }
    // The names of the notation in force would read the Hungarian title as the user's own.
    assert.equal(hasOwnTitle(inNotation(hungarian, 'en-US'), Object.values(GARMENT_NAMES['en-US'])), true);

    const english = legacySave(sweater(inNotation(emptyPattern(), 'en-US')));
    assert.equal(english.title, 'Drop-shoulder sweater');
    assert.equal(hasOwnTitle(inNotation(english, 'hu'), allLocaleNames(GARMENT_NAMES)), false);
    assert.equal(sweater(inNotation(english, 'hu')).title, 'Ledobott vállú pulóver');

    const typed = inNotation(emptyPattern('Nyári pulóver'), 'en-US');
    assert.equal(hasOwnTitle(typed, allLocaleNames(GARMENT_NAMES)), true);
    assert.equal(sweater(typed).title, 'Nyári pulóver');
  });

  test('the own-title flag carries over onto the generated pattern; an unflagged own title stays unflagged', () => {
    const shape = generators.Forma(inNotation(emptyPattern(), 'hu'));
    assert.equal(withGeneratedTitle(shape, renamed(emptyPattern(), 'Sál'), 'Téglalap').titleGenerated, false);
    assert.equal(withGeneratedTitle(shape, emptyPattern('Sál'), 'Téglalap').titleGenerated, undefined);
  });
});

describe('saving', () => {
  test('the flag survives a JSON round trip; an invalid value fails to load; a legacy save loads without the flag', () => {
    const generated = generators.Forma(inNotation(emptyPattern(), 'hu'));
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
