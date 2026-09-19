import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { computeLayers } from '../src/core/graph.ts';
import { foundationChainLength, repeatCounts } from '../src/core/repeat.ts';
import { createStitchLibrary } from '../src/core/stitch-library.ts';
import { DOUBLE_CROCHET } from '../src/core/stitches.ts';
import { validatePattern } from '../src/core/validate.ts';
import { PieceBuilder, patternOf } from './fixtures/builder.ts';
import {
  chevron,
  dcRectangle,
  grannySquare,
  hdcRectangle,
  shellStitch,
  vStitchPattern,
  wave,
} from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

const layersOf = (example) => computeLayers(example.pattern, testLibrary);
const counts = (layers) => layers.map((layer) => [layer.stitchCount, layer.positionCount]);

test('half double crochet rectangle: 22 rows of 15 hdc each, with the turning chain as the 16th position (03 §3.1 A, PQW-944)', () => {
  const example = hdcRectangle();
  const layers = layersOf(example);

  assert.equal(layers.length, 23);
  // 15 hdc worked in, and the top of the turning chain is the 16th position: the last stitch of the next row can go there.
  assert.deepEqual(
    counts(layers.slice(1)),
    Array.from({ length: 22 }, () => [15, 16]),
  );
  assert.deepEqual(layers[0].stitches, example.rows[0]);
  assert.deepEqual(layers[1].stitches, [...example.turningChains[1], ...example.rows[1]]);
  assert.ok(layers.every((layer) => layer.shape === 'row'));
});

test('the turning chain standing at the end of the foundation belongs to row 1: together with the foundation that is N + skip chains (03 §1.2, PQW-924)', () => {
  const layers = layersOf(hdcRectangle());
  // 15 hdc into the 15 positions of the foundation; the turning chain is not a stitch, only the chain standing at the start of the row.
  assert.equal(layers[0].positionCount, 15);
  const turningChain = layers[1].stitches.length - layers[1].stitchCount;
  assert.equal(turningChain, 2);
  const foundation = layers[0].positionCount + turningChain;
  assert.equal(foundation, 17);
  assert.equal(foundation, foundationChainLength(15, 2, true));
});

test('double crochet rectangle: a counting turning chain stands on a foundation chain, so 19 chains give 16 stitches (03 §3.1 B, PQW-891)', () => {
  const layers = layersOf(dcRectangle());

  assert.equal(layers[0].positionCount, 16);
  assert.deepEqual(
    counts(layers.slice(1)),
    Array.from({ length: 16 }, () => [16, 17]),
  );
  assert.equal(layers[0].positionCount + 3, 19);
  assert.equal(layers[0].positionCount + 3, foundationChainLength(16, 3, true));
});

test('after a turn the row changes side: odd rows show the right side, even rows the wrong side (01 §8.4 szabály 19)', () => {
  const sides = layersOf(dcRectangle({ rows: 4 })).map((layer) => layer.side);
  assert.deepEqual(sides, ['right', 'right', 'wrong', 'right', 'wrong']);
});

test('shell 6+1: both rows hold 6n + 1 stitches (03 §4.2 E)', () => {
  assert.deepEqual(counts(layersOf(shellStitch({ repeats: 3 })).slice(1)), [
    [19, 19],
    [19, 19],
  ]);
});

test('V-stitch: chains worked into as a chain space count, while the decorative spaces of the last row do not (03 §4.3, PQW-870)', () => {
  // 4 repeats: 2 edge dc + 4 × 2 dc, plus 4 one-chain spaces; row 2 works into the spaces of row 1.
  assert.deepEqual(counts(layersOf(vStitchPattern({ repeats: 4 })).slice(1)), [
    [14, 14],
    [10, 14],
  ]);
});

test('chevron and wave: the stitch count stays the same from row to row (03 §4.2 G, §2.3)', () => {
  assert.deepEqual(counts(layersOf(chevron(2)).slice(1)), [
    [25, 25],
    [25, 25],
  ]);
  assert.deepEqual(counts(layersOf(wave({ repeats: 2 })).slice(1)), [
    [18, 18],
    [18, 18],
    [18, 18],
  ]);
});

test('granny square: corner and side chain spaces worked into as a whole do count (03 §8, PQW-870)', () => {
  const layers = layersOf(grannySquare());

  assert.deepEqual(
    layers.map((layer) => layer.shape),
    ['round', 'round', 'round', 'round'],
  );
  assert.deepEqual(counts(layers), [
    [0, 1],
    [20, 20],
    [36, 36],
    [36, 52],
  ]);
  assert.ok(layers.every((layer) => layer.side === 'right'));
});

test('the joining and travelling slip stitches count once the pattern switches that on (szókészlet D7)', () => {
  const example = grannySquare();
  const pattern = { ...example.pattern, conventions: { ...example.pattern.conventions, joinSlipStitchCounts: true } };
  // Round 1: +1 joining; rounds 2–3: +3 travelling and +1 joining.
  assert.deepEqual(
    computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount),
    [0, 21, 40, 40],
  );
});

/** A single crochet mesh: row 1 reads „1 rp, [1 lsz, 1 láncszem kihagyása, 1 rp] 2-szer”, and row 2 works into each of them one by one. */
function scMesh({ decorative = false } = {}, conventions = {}) {
  const b = new PieceBuilder('p1', 'Háló');
  const foundation = b.chain(6);
  const row1 = [
    b.stitch('sc', foundation[4]),
    b.stitch('ch'),
    b.stitch('sc', foundation[2]),
    b.stitch('ch'),
    b.stitch('sc', foundation[0]),
  ];
  b.event('turn');
  b.chain(1);
  // With a decorative chain, row 2 skips the chains explicitly and works only into the single crochets.
  const chains = [row1[1], row1[3]];
  for (const target of [...row1].reverse()) if (!decorative || !chains.includes(target)) b.stitch('sc', target);
  if (decorative) b.skip(...chains);
  b.event('fasten-off');
  // The mesh is about counting chains: the structure of the source (row 1 starts in the 2nd chain and the turning
  // chain does not count) is kept with an explicit setting, because in a row the turning chain counts by default (PQW-891).
  return patternOf('Háló', [b.build()], { turningChainCounts: false, ...conventions });
}

const stitchCounts = (pattern) => computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount);
const writtenCounts = (pattern) => computeLayers(pattern, testLibrary).map((layer) => layer.writtenCount);
const withChainCounts = (example, chainCounts) => ({
  ...example.pattern,
  conventions: { ...example.pattern.conventions, chainCounts },
});

test('chains that are worked into one by one do count (PQW-870)', () => {
  const pattern = scMesh();
  assert.deepEqual(validatePattern(pattern, testLibrary), []);
  assert.deepEqual(counts(computeLayers(pattern, testLibrary).slice(1)), [
    [5, 5],
    [5, 5],
  ]);
});

test('a decorative chain nothing works into does not count, not even outside the last row (PQW-870)', () => {
  const pattern = scMesh({ decorative: true });
  assert.deepEqual(validatePattern(pattern, testLibrary), []);
  assert.deepEqual(counts(computeLayers(pattern, testLibrary).slice(1)), [
    [3, 5],
    [3, 3],
  ]);
});

test('chain counting can be overridden per pattern: either all of them count, or none (PQW-870, PQW-940)', () => {
  // The setting flips the WRITTEN stitch count; the structural one does not move (PQW-940).
  // The count of the foundation is its remaining chains plus the column of the turning chain (PQW-942).
  assert.deepEqual(writtenCounts(withChainCounts(vStitchPattern(), true)), [15, 14, 14]);
  assert.deepEqual(writtenCounts(withChainCounts(vStitchPattern(), false)), [15, 10, 10]);
  assert.deepEqual(writtenCounts(withChainCounts(grannySquare(), true)), [0, 20, 36, 52]);
  assert.deepEqual(writtenCounts(withChainCounts(grannySquare(), false)), [0, 12, 24, 36]);
  assert.deepEqual(writtenCounts(scMesh({ decorative: true }, { chainCounts: true })), [6, 5, 3]);
  assert.deepEqual(writtenCounts(scMesh({}, { chainCounts: false })), [6, 3, 5]);
  // The structural stitch count, the position count and the counting of the turning chain do not change.
  assert.deepEqual(
    stitchCounts(withChainCounts(vStitchPattern(), true)),
    stitchCounts(withChainCounts(vStitchPattern(), false)),
  );
  assert.deepEqual(counts(layersOf({ pattern: withChainCounts(vStitchPattern(), false) })), [
    [0, 14],
    [14, 14],
    [10, 14],
  ]);
  assert.deepEqual(writtenCounts(withChainCounts(dcRectangle({ rows: 2 }), false)), [17, 17, 17]);
});

test('the turning chain convention of a row can be overridden row by row (README §4.3)', () => {
  const example = dcRectangle({ rows: 2 });
  const piece = example.pattern.pieces[0];
  const events = piece.events.map((event, i) =>
    i === 0 ? { ...event, conventions: { turningChainCounts: false } } : event,
  );
  const pattern = { ...example.pattern, pieces: [{ ...piece, events }] };

  assert.deepEqual(
    computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount),
    [0, 16, 16],
  );
});

test('a computed layer returns only the Layer fields declared in types.ts', () => {
  assert.deepEqual(Object.keys(layersOf(hdcRectangle({ rows: 1 }))[1]).sort(), [
    'below',
    'index',
    'piece',
    'positionCount',
    'row',
    'shape',
    'side',
    'stitchCount',
    'stitches',
    'writtenCount',
  ]);
});

test('foundation: N + T whether or not the turning chain counts; a counting turning chain stands on a foundation chain (03 §1.2, PQW-891)', () => {
  assert.equal(foundationChainLength(100, 3, false), 103);
  assert.equal(foundationChainLength(100, 3, true), 103);
  assert.equal(foundationChainLength(25, 1, false), 26);
});

test('“multiple of X plus Y”: whether the turning chain is part of the Y (03 §4.1, README §4.4)', () => {
  // Shell: a multiple of 6 + 1, plus 1 ch for the single crochet turning chain.
  assert.deepEqual(repeatCounts({ repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false }, 3, 1, false), {
    chains: 20,
    workedChains: 19,
    firstRowPositions: 19,
  });
  // Dora Does: V-stitch 3 + 2, so 20 Vs = 62 ch, and the turning chain comes after that.
  assert.equal(repeatCounts({ repeatWidth: 3, edgeStitches: 2, turningChainIncluded: false }, 20, 3, false).chains, 65);
  // Oombawka: a multiple of 8 + 2, where the 2 ch are the turning chain.
  assert.deepEqual(repeatCounts({ repeatWidth: 8, edgeStitches: 2, turningChainIncluded: true }, 1, 2, false), {
    chains: 10,
    workedChains: 8,
    firstRowPositions: 8,
  });
});

test('the stitch library refuses an id that appears twice', () => {
  assert.throws(() => createStitchLibrary([DOUBLE_CROCHET, DOUBLE_CROCHET]), /Kétszer szereplő szemazonosító: dc/);
});
