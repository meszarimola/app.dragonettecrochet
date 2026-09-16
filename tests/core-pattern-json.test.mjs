import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { contextOf, endRow, fillRow, liveCheck } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { FORMAT_VERSION, loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { JSON_CORE_TEXTS } from '../src/ui/i18n/core/json.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';
import { writtenView } from '../src/ui/written.ts';
import { PieceBuilder, editNode, patternOf } from './fixtures/builder.ts';
import { WORKED_EXAMPLES, dcRectangle } from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

describe('mentés után betöltve ugyanazt a gráfot kapjuk', () => {
  for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
    test(name, () => {
      const { pattern } = make();
      const saved = savePattern(pattern);
      const loaded = loadPattern(saved);

      assert.equal(loaded.ok, true);
      assert.deepEqual(loaded.pattern, pattern);
      assert.equal(savePattern(loaded.pattern), saved);
      assert.deepEqual(validatePattern(loaded.pattern, testLibrary), []);
    });
  }
});

test('a minta jelölése megmarad; érvénytelen értéknél a mező útvonalával hibázik (PQW-868)', () => {
  const { pattern } = dcRectangle({ rows: 1 });
  const notation = { terms: 'en-GB', chartStyle: 'jis', singleCrochet: 'cross' };
  const saved = savePattern({ ...pattern, notation });
  const loaded = loadPattern(saved);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.pattern.notation, notation);
  assert.equal(savePattern(loaded.pattern), saved);

  const raw = JSON.parse(saved);
  raw.notation.terms = 'jp';
  const bad = loadPattern(JSON.stringify(raw));
  assert.equal(bad.ok, false);
  assert.equal(bad.error.path, '$.notation.terms');

  // A jelölés nélküli, korábbi mentés is betölthető.
  const old = loadPattern(savePattern(pattern));
  assert.equal(old.ok, true);
  assert.equal('notation' in old.pattern, false);
});

const GAUGE = {
  active: 'p1',
  profiles: [
    {
      id: 'p1',
      yarn: { name: 'Pamut 125', cycWeight: 3, metersPer100g: 250, ballMassG: 50 },
      hookMm: 4,
      blocked: true,
      gauges: [
        { stitch: 'sc', form: 'rows', stitchesPer10cm: 20, rowsPer10cm: 25, source: 'measured' },
        { stitch: 'dc', form: 'rounds', stitchesPer10cm: null, rowsPer10cm: null, source: 'label' },
      ],
      swatch: { widthCm: 10, heightCm: 10, massG: 5 },
    },
  ],
};

test('a mintával mentett profilok megmaradnak; a profil nélküli régi mentés változatlan (PQW-859)', () => {
  const { pattern } = dcRectangle({ rows: 1 });
  const saved = savePattern({ ...pattern, gauge: GAUGE });
  const loaded = loadPattern(saved);
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.pattern.gauge, GAUGE);
  assert.equal(savePattern(loaded.pattern), saved);
  assert.deepEqual(Object.keys(JSON.parse(saved)), ['formatVersion', 'title', 'gauge', 'conventions', 'pieces']);

  const old = savePattern(pattern);
  assert.doesNotMatch(old, /"gauge"/);
  const reloaded = loadPattern(old);
  assert.equal(reloaded.ok, true);
  assert.equal('gauge' in reloaded.pattern, false);
  assert.equal(savePattern(reloaded.pattern), old);
});

describe('hibás profilnál a mező útvonalával hibázik (PQW-859)', () => {
  const cases = [
    ['nem létező kiválasztott profil', (raw) => (raw.gauge.active = 'p9'), '$.gauge.active'],
    ['nulla tűméret', (raw) => (raw.gauge.profiles[0].hookMm = 0), '$.gauge.profiles[0].hookMm'],
    ['30 mm-nél nagyobb tű', (raw) => (raw.gauge.profiles[0].hookMm = 31), '$.gauge.profiles[0].hookMm'],
    ['ismeretlen vastagság', (raw) => (raw.gauge.profiles[0].yarn.cycWeight = 8), '$.gauge.profiles[0].yarn.cycWeight'],
    ['nem mérhető szem', (raw) => (raw.gauge.profiles[0].gauges[0].stitch = 'ch'), '$.gauge.profiles[0].gauges[0].stitch'],
    ['negatív szemszám', (raw) => (raw.gauge.profiles[0].gauges[0].stitchesPer10cm = -1), '$.gauge.profiles[0].gauges[0].stitchesPer10cm'],
    ['becsült eredet', (raw) => (raw.gauge.profiles[0].gauges[0].source = 'estimated'), '$.gauge.profiles[0].gauges[0].source'],
    [
      'kétszer szereplő szem ugyanabban a formában',
      (raw) => raw.gauge.profiles[0].gauges.push({ ...raw.gauge.profiles[0].gauges[0] }),
      '$.gauge.profiles[0].gauges[2]',
    ],
    ['kétszer szereplő profil', (raw) => raw.gauge.profiles.push({ ...raw.gauge.profiles[0] }), '$.gauge.profiles[1].id'],
    ['ismeretlen mező', (raw) => (raw.gauge.profiles[0].fibre = []), '$.gauge.profiles[0].fibre'],
  ];
  for (const [name, spoil, path] of cases) {
    test(name, () => {
      const raw = JSON.parse(savePattern({ ...dcRectangle({ rows: 1 }).pattern, gauge: GAUGE }));
      spoil(raw);
      const result = loadPattern(JSON.stringify(raw));
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'invalid-format');
      assert.equal(result.error.path, path);
    });
  }
});

test('a nem kötelező mezők is megmaradnak', () => {
  const { pattern, rows } = dcRectangle({ rows: 3 });
  const piece = pattern.pieces[0];
  const withExtras = {
    ...pattern,
    conventions: { ...pattern.conventions, chainCounts: false, repeat: { repeatWidth: 1, edgeStitches: 0, turningChainIncluded: false } },
    pieces: [
      {
        ...piece,
        stitches: piece.stitches.map((node) =>
          node.id === rows[2][0] ? { ...node, flags: ['crossed'], pinned: { x: 1.5, y: -2, rotation: 90 } } : node,
        ),
        events: piece.events.map((event, i) => (i === 0 ? { ...event, conventions: { turningChainCounts: false } } : event)),
        skipped: [rows[1][0]],
      },
    ],
  };
  assert.deepEqual(loadPattern(savePattern(withExtras)).pattern, withExtras);
});

test('a mentés verziózott, a formátum verziója az első mező', () => {
  const saved = savePattern(dcRectangle({ rows: 1 }).pattern);
  assert.equal(FORMAT_VERSION, 1);
  assert.match(saved, /^\{\n {2}"formatVersion": 1,/);
});

test('újabb formátumú mintát nem tölt be', () => {
  const saved = JSON.parse(savePattern(dcRectangle({ rows: 1 }).pattern));
  const result = loadPattern(JSON.stringify({ ...saved, formatVersion: 2 }));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'unsupported-version');
});

test('a láncszem-számolás nélküli régebbi mentés a használat szerinti szabállyal töltődik be (PQW-870)', () => {
  const raw = JSON.parse(savePattern(dcRectangle({ rows: 1 }).pattern));
  delete raw.conventions.chainCounts;
  const loaded = loadPattern(JSON.stringify(raw));
  assert.equal(loaded.ok, true);
  assert.equal(loaded.pattern.conventions.chainCounts, 'worked-into');
});

test('érvénytelen JSON-ra hibát ad', () => {
  const result = loadPattern('{"formatVersion": 1,');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'invalid-json');
});

/** A hiba mondata a felület szótárával; a mag csak kódot és adatot ad (PQW-904). */
const sentence = (error, language = 'hu') => renderCoreText(JSON_CORE_TEXTS[language], error.message);

test('a betöltési hiba kódot és adatot ad, a mondatot a szótár írja (PQW-904)', () => {
  const raw = JSON.parse(savePattern(dcRectangle({ rows: 2 }).pattern));
  raw.pieces[0].stitches[0].fibre = [];
  const result = loadPattern(JSON.stringify(raw));

  assert.equal(result.ok, false);
  assert.deepEqual(result.error.message, { code: 'unknown-field' });
  // A mező útvonala külön mező marad: a felület változatlanul mutatja.
  assert.equal(result.error.path, '$.pieces[0].stitches[0].fibre');
  // A magyar mondat betűre ugyanaz, mint a PQW-904 előtt.
  assert.equal(sentence(result.error), 'Ismeretlen mező.');
  assert.equal(sentence(result.error, 'en'), 'Unknown field.');
});

test('a beágyazott JSON-hibaszöveg adat marad, az újabb formátumé a mag adatából áll össze (PQW-904)', () => {
  const bad = loadPattern('{"formatVersion": 1,');
  assert.equal(bad.error.message.code, 'invalid-json');
  // A JS saját hibaszövegét nem fordítjuk: nyers adatként kerül a mondatba.
  assert.ok(bad.error.message.data.detail.length > 0);
  assert.equal(sentence(bad), `Nem érvényes JSON: ${bad.error.message.data.detail}`);

  const saved = JSON.parse(savePattern(dcRectangle({ rows: 1 }).pattern));
  const newer = loadPattern(JSON.stringify({ ...saved, formatVersion: 2 }));
  assert.deepEqual(newer.error.message, { code: 'unsupported-version', data: { found: 2, known: FORMAT_VERSION } });
  assert.equal(sentence(newer), 'A minta újabb formátumú (2), mint amit ez a verzió ismer (1).');
});

test('a felsorolt értékek és a számadatok a mondatba kerülnek (PQW-904)', () => {
  const raw = JSON.parse(savePattern(dcRectangle({ rows: 2 }).pattern));
  raw.pieces[0].events[0].kind = 'forditas';
  const result = loadPattern(JSON.stringify(raw));
  assert.equal(result.error.message.code, 'expected-one-of');
  assert.equal(sentence(result.error), 'Megengedett értékek: "turn", "join-slip", "spiral", "fasten-off".');

  const negative = JSON.parse(savePattern(dcRectangle({ rows: 2 }).pattern));
  negative.pieces[0].events[0].statedCount = -1;
  const counted = loadPattern(JSON.stringify(negative));
  assert.deepEqual(counted.error.message, { code: 'expected-integer-min', data: { min: 0 } });
  assert.equal(sentence(counted.error), 'Legalább 0 értékű egész számot vártunk.');
});

describe('a formátum hibáit mezőútvonallal jelzi', () => {
  const saved = () => JSON.parse(savePattern(dcRectangle({ rows: 2 }).pattern));
  const cases = [
    ['hiányzó cím', (raw) => delete raw.title, '$.title'],
    ['ismeretlen mező egy szemen', (raw) => (raw.pieces[0].stitches[0].color = 'piros'), '$.pieces[0].stitches[0].color'],
    ['ismeretlen beszúrási mód', (raw) => (raw.pieces[0].stitches[20].anchors[0].mode = 'third-loop'), '$.pieces[0].stitches[20].anchors[0].mode'],
    ['ismeretlen láncszem-számolás', (raw) => (raw.conventions.chainCounts = 'mindig'), '$.conventions.chainCounts'],
    ['rossz eseményfajta', (raw) => (raw.pieces[0].events[0].kind = 'forditas'), '$.pieces[0].events[0].kind'],
    ['negatív szemszám', (raw) => (raw.pieces[0].events[0].statedCount = -1), '$.pieces[0].events[0].statedCount'],
    ['régebbi, nem létező verzió', (raw) => (raw.formatVersion = 0), '$.formatVersion'],
  ];
  for (const [name, mutate, path] of cases) {
    test(name, () => {
      const raw = saved();
      mutate(raw);
      const result = loadPattern(JSON.stringify(raw));
      assert.equal(result.ok, false);
      assert.equal(result.error.code, 'invalid-format');
      assert.equal(result.error.path, path);
    });
  }
});

test('hibás gráfot is betölt; a gráfot az ellenőrző nézi, nem a betöltés', () => {
  const { pattern, rows } = dcRectangle({ rows: 2 });
  const broken = editNode(pattern, rows[2][3], { anchors: ['nincs-ilyen'] });
  const loaded = loadPattern(savePattern(broken));
  assert.equal(loaded.ok, true);
  assert.deepEqual(
    validatePattern(loaded.pattern, testLibrary).map((finding) => finding.rule),
    ['dangling-reference'],
  );
});

test('formátumon kívüli mintát nem ment el', () => {
  const pattern = { ...dcRectangle({ rows: 1 }).pattern, formatVersion: 3 };
  // A mag kódot és adatot dob, nem magyar mondatot (PQW-904).
  assert.throws(
    () => savePattern(pattern),
    (error) => {
      assert.equal(error.code, 'expected-one-of');
      assert.equal(error.path, '$.formatVersion');
      assert.deepEqual(error.data.values, ['1']);
      return true;
    },
  );
});

/*
 * A PQW-891 előtti szabállyal mentett minták: a félpálcás sor a 3., a pálcás a
 * 4. láncszembe kezdett, a félpálca fordulólánca nem számított. Ezek a javított
 * szabállyal hibásnak látszhatnak, de a betöltés, a rajz, az ellenőrzés, az
 * írott minta és a továbbhorgolás nem dobhat hibát.
 */
function oldRuleRectangle(def, turningChain, counts) {
  const stitches = 8;
  const worked = counts ? stitches - 1 : stitches;
  const b = new PieceBuilder('p1', 'Régi mentés');
  const foundation = b.chain(worked + turningChain);
  let row = [];
  for (let i = worked - 1; i >= 0; i -= 1) row.push(b.stitch(def, foundation[i]));
  let top = foundation.at(-1);
  b.event('turn');
  for (let r = 2; r <= 3; r += 1) {
    const turning = b.chain(turningChain);
    const below = [...row].reverse();
    row = (counts ? [...below.slice(1), top] : below).map((target) => b.stitch(def, target));
    top = turning.at(-1);
    // Az utolsó sor nyitva marad: a szerkesztőben innen fordulunk tovább.
    if (r < 3) b.event('turn');
  }
  return patternOf('Régi mentés', [b.build()]);
}

describe('a javítás előtti szabállyal mentett minta betöltése nem törik el (PQW-891)', () => {
  for (const [name, def, chains, counts] of [
    ['félpálca a 3. láncszemtől, nem számító fordulólánccal', 'hdc', 2, false],
    ['pálca a 4. láncszemtől, alapláncszem nélkül', 'dc', 3, true],
    ['rövidpálca a 2. láncszemtől', 'sc', 1, false],
  ]) {
    test(name, () => {
      const loaded = loadPattern(savePattern(oldRuleRectangle(def, chains, counts)));
      assert.equal(loaded.ok, true);
      const pattern = loaded.pattern;
      const library = libraryFor(pattern);

      assert.doesNotThrow(() => buildPieceGraph(pattern, pattern.pieces[0], library));
      const findings = validatePattern(pattern, library);
      assert.ok(Array.isArray(findings));
      assert.doesNotThrow(() => layoutPattern(pattern, library));
      const context = contextOf(pattern);
      const check = liveCheck(pattern, context);
      assert.doesNotThrow(() => writtenView(pattern, context, check, 'hu'));

      // A szerkesztőben tovább lehet horgolni: fordulás és sorkitöltés hibadobás nélkül.
      const turned = endRow(pattern, def);
      assert.equal(turned.ok, true, turned.reason);
      assert.doesNotThrow(() => fillRow(turned.pattern, { def, count: 1 }));
    });
  }
});
