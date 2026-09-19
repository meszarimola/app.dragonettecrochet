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

describe('loading a saved pattern gives back the same graph', () => {
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

test('the notation survives a save, and an invalid value fails with its field path (PQW-868)', () => {
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

  // An earlier save with no notation still loads.
  const old = loadPattern(savePattern(pattern));
  assert.equal(old.ok, true);
  assert.equal('notation' in old.pattern, false);
});

test('the retired border field in an older save does not break loading (PQW-911)', () => {
  const { pattern } = dcRectangle({ rows: 1 });
  const raw = JSON.parse(savePattern(pattern));
  // Before PQW-911 the piece stored the border choice; there is no such field today, and the reader drops it.
  raw.pieces[0].border = { stitch: 'sc', hdcRowEnd: 2, repeat: { width: 4, edge: 0 } };
  const loaded = loadPattern(JSON.stringify(raw));
  assert.equal(loaded.ok, true);
  assert.equal('border' in loaded.pattern.pieces[0], false);
  assert.deepEqual(validatePattern(loaded.pattern, testLibrary), []);
});

test('a save holding a drawn border is rejected with a readable error (PQW-911)', () => {
  const { pattern } = dcRectangle({ rows: 1 });
  const raw = JSON.parse(savePattern(pattern));
  // Before PQW-911 border stitches anchored into a row end; no such anchor exists today.
  raw.pieces[0].stitches[0].anchors = [{ into: 'row-end', id: raw.pieces[0].stitches[0].id }];
  const loaded = loadPattern(JSON.stringify(raw));

  assert.equal(loaded.ok, false);
  assert.equal(loaded.error.message.code, 'legacy-border');
  assert.match(loaded.error.path, /anchors\[0\]\.into$/);

  // The sentence says what happened: it shows no code and no field name.
  for (const [language, expected] of [
    ['hu', /szegély.*nem tölthető be/i],
    ['en', /border.*cannot be loaded/i],
  ]) {
    const sentence = renderCoreText(JSON_CORE_TEXTS[language], loaded.error.message);
    assert.match(sentence, expected, `${language}: ${sentence}`);
  }
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

test('profiles saved with the pattern survive, and an old save without profiles is unchanged (PQW-859)', () => {
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

describe('a broken profile fails with its field path (PQW-859)', () => {
  const cases = [
    ['the selected profile does not exist', (raw) => (raw.gauge.active = 'p9'), '$.gauge.active'],
    ['a zero hook size', (raw) => (raw.gauge.profiles[0].hookMm = 0), '$.gauge.profiles[0].hookMm'],
    ['a hook larger than 30 mm', (raw) => (raw.gauge.profiles[0].hookMm = 31), '$.gauge.profiles[0].hookMm'],
    ['an unknown yarn weight', (raw) => (raw.gauge.profiles[0].yarn.cycWeight = 8), '$.gauge.profiles[0].yarn.cycWeight'],
    ['a stitch that cannot be measured', (raw) => (raw.gauge.profiles[0].gauges[0].stitch = 'ch'), '$.gauge.profiles[0].gauges[0].stitch'],
    ['a negative stitch count', (raw) => (raw.gauge.profiles[0].gauges[0].stitchesPer10cm = -1), '$.gauge.profiles[0].gauges[0].stitchesPer10cm'],
    ['an estimated source', (raw) => (raw.gauge.profiles[0].gauges[0].source = 'estimated'), '$.gauge.profiles[0].gauges[0].source'],
    [
      'the same stitch twice in the same form',
      (raw) => raw.gauge.profiles[0].gauges.push({ ...raw.gauge.profiles[0].gauges[0] }),
      '$.gauge.profiles[0].gauges[2]',
    ],
    ['the same profile twice', (raw) => raw.gauge.profiles.push({ ...raw.gauge.profiles[0] }), '$.gauge.profiles[1].id'],
    ['an unknown field', (raw) => (raw.gauge.profiles[0].fibre = []), '$.gauge.profiles[0].fibre'],
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

test('the optional fields survive a round trip too', () => {
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

test('the save is versioned, and the format version is its first field', () => {
  const saved = savePattern(dcRectangle({ rows: 1 }).pattern);
  assert.equal(FORMAT_VERSION, 1);
  assert.match(saved, /^\{\n {2}"formatVersion": 1,/);
});

test('a pattern in a newer format is not loaded', () => {
  const saved = JSON.parse(savePattern(dcRectangle({ rows: 1 }).pattern));
  const result = loadPattern(JSON.stringify({ ...saved, formatVersion: 2 }));
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'unsupported-version');
});

test('an older save without the chain-counting field loads with the worked-into rule (PQW-870)', () => {
  const raw = JSON.parse(savePattern(dcRectangle({ rows: 1 }).pattern));
  delete raw.conventions.chainCounts;
  const loaded = loadPattern(JSON.stringify(raw));
  assert.equal(loaded.ok, true);
  assert.equal(loaded.pattern.conventions.chainCounts, 'worked-into');
});

test('invalid JSON returns an error', () => {
  const result = loadPattern('{"formatVersion": 1,');
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'invalid-json');
});

/** The error sentence comes from the interface dictionary; the core gives only a code and data (PQW-904). */
const sentence = (error, language = 'hu') => renderCoreText(JSON_CORE_TEXTS[language], error.message);

test('a load error carries a code and data, and the dictionary writes the sentence (PQW-904)', () => {
  const raw = JSON.parse(savePattern(dcRectangle({ rows: 2 }).pattern));
  raw.pieces[0].stitches[0].fibre = [];
  const result = loadPattern(JSON.stringify(raw));

  assert.equal(result.ok, false);
  assert.deepEqual(result.error.message, { code: 'unknown-field' });
  // The field path stays a field of its own: the interface shows it unchanged.
  assert.equal(result.error.path, '$.pieces[0].stitches[0].fibre');
  // The Hungarian sentence is letter for letter what it was before PQW-904.
  assert.equal(sentence(result.error), 'Ismeretlen mező.');
  assert.equal(sentence(result.error, 'en'), 'Unknown field.');
});

test('the embedded JSON error text stays data, and the newer-format sentence is assembled from the core data (PQW-904)', () => {
  const bad = loadPattern('{"formatVersion": 1,');
  assert.equal(bad.error.message.code, 'invalid-json');
  // The JS error text itself is not translated: it goes into the sentence as raw data.
  assert.ok(bad.error.message.data.detail.length > 0);
  assert.equal(sentence(bad.error), `Nem érvényes JSON: ${bad.error.message.data.detail}`);

  const saved = JSON.parse(savePattern(dcRectangle({ rows: 1 }).pattern));
  const newer = loadPattern(JSON.stringify({ ...saved, formatVersion: 2 }));
  assert.deepEqual(newer.error.message, { code: 'unsupported-version', data: { found: 2, known: FORMAT_VERSION } });
  assert.equal(sentence(newer.error), 'A minta újabb formátumú (2), mint amit ez a verzió ismer (1).');
});

test('the listed values and the numbers make it into the sentence (PQW-904)', () => {
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

describe('format errors are reported with a field path', () => {
  const saved = () => JSON.parse(savePattern(dcRectangle({ rows: 2 }).pattern));
  const cases = [
    ['a missing title', (raw) => delete raw.title, '$.title'],
    ['an unknown field on a stitch', (raw) => (raw.pieces[0].stitches[0].color = 'piros'), '$.pieces[0].stitches[0].color'],
    ['an unknown insertion mode', (raw) => (raw.pieces[0].stitches[20].anchors[0].mode = 'third-loop'), '$.pieces[0].stitches[20].anchors[0].mode'],
    ['an unknown chain-counting rule', (raw) => (raw.conventions.chainCounts = 'mindig'), '$.conventions.chainCounts'],
    ['a wrong event kind', (raw) => (raw.pieces[0].events[0].kind = 'forditas'), '$.pieces[0].events[0].kind'],
    ['a negative stitch count', (raw) => (raw.pieces[0].events[0].statedCount = -1), '$.pieces[0].events[0].statedCount'],
    ['an older version that never existed', (raw) => (raw.formatVersion = 0), '$.formatVersion'],
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

test('a broken graph still loads: checking the graph is the validator job, not the loader', () => {
  const { pattern, rows } = dcRectangle({ rows: 2 });
  const broken = editNode(pattern, rows[2][3], { anchors: ['nincs-ilyen'] });
  const loaded = loadPattern(savePattern(broken));
  assert.equal(loaded.ok, true);
  assert.deepEqual(
    validatePattern(loaded.pattern, testLibrary).map((finding) => finding.rule),
    ['dangling-reference'],
  );
});

test('a pattern outside the format is not saved', () => {
  const pattern = { ...dcRectangle({ rows: 1 }).pattern, formatVersion: 3 };
  // The core throws a code and data, not a Hungarian sentence (PQW-904).
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
 * Patterns saved under the pre-PQW-891 rule: an hdc row started in the 3rd
 * chain and a dc row in the 4th, and the hdc turning chain did not count.
 * Under the fixed rule these can look wrong, but loading, charting,
 * validating, writing out and carrying on crocheting must none of them throw.
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
    // The last row stays open: in the editor we turn on from here.
    if (r < 3) b.event('turn');
  }
  return patternOf('Régi mentés', [b.build()]);
}

describe('a pattern saved under the pre-fix rule still loads without breaking (PQW-891)', () => {
  for (const [name, def, chains, counts] of [
    ['hdc from the 3rd chain, with a non-counting turning chain', 'hdc', 2, false],
    ['dc from the 4th chain, without a foundation stitch', 'dc', 3, true],
    ['sc from the 2nd chain', 'sc', 1, false],
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

      // Work can carry on in the editor: turning and filling a row without throwing.
      const turned = endRow(pattern);
      assert.equal(turned.ok, true, turned.reason);
      assert.doesNotThrow(() => fillRow(turned.pattern, { def, count: 1 }));
    });
  }
});
