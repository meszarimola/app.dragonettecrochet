import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { computeLayers } from '../src/core/graph.ts';
import { foundationChainLength, repeatCounts } from '../src/core/repeat.ts';
import { createStitchLibrary } from '../src/core/stitch-library.ts';
import {
  chevron,
  dcRectangle,
  grannySquare,
  hdcRectangle,
  shellStitch,
  vStitchPattern,
  wave,
} from './fixtures/examples.ts';
import { DOUBLE_CROCHET } from '../src/core/stitches.ts';
import { validatePattern } from '../src/core/validate.ts';
import { PieceBuilder, patternOf } from './fixtures/builder.ts';
import { testLibrary } from './fixtures/library.ts';

const layersOf = (example) => computeLayers(example.pattern, testLibrary);
const counts = (layers) => layers.map((layer) => [layer.stitchCount, layer.positionCount]);

test('félpálcás téglalap: 22 sor, soronként 15 szem, a fordulólánc nem számít (03 §3.1 A)', () => {
  const example = hdcRectangle();
  const layers = layersOf(example);

  assert.equal(layers.length, 23);
  assert.deepEqual(counts(layers.slice(1)), Array.from({ length: 22 }, () => [15, 15]));
  assert.deepEqual(layers[0].stitches, example.rows[0]);
  assert.deepEqual(layers[1].stitches, [...example.turningChains[1], ...example.rows[1]]);
  assert.ok(layers.every((layer) => layer.shape === 'row'));
});

test('a láncalap végén álló fordulólánc az 1. sorhoz tartozik, együtt N + T láncszem (03 §1.2)', () => {
  const layers = layersOf(hdcRectangle());
  const foundation = layers[0].positionCount + (layers[1].stitches.length - layers[1].stitchCount);
  assert.equal(foundation, 17);
  assert.equal(foundation, foundationChainLength(15, 2, false));
});

test('pálcás téglalap: a számító fordulólánccal 18 láncszem ad 16 szemet (03 §3.1 B)', () => {
  const layers = layersOf(dcRectangle());

  assert.equal(layers[0].positionCount, 15);
  assert.deepEqual(counts(layers.slice(1)), Array.from({ length: 16 }, () => [16, 16]));
  assert.equal(layers[0].positionCount + 3, foundationChainLength(16, 3, true));
});

test('fordulás után a sor oldala vált: páratlan sor színe, páros visszája (01 §8.4 szabály 19)', () => {
  const sides = layersOf(dcRectangle({ rows: 4 })).map((layer) => layer.side);
  assert.deepEqual(sides, ['right', 'right', 'wrong', 'right', 'wrong']);
});

test('kagyló 6+1: mindkét sor 6n + 1 szem (03 §4.2 E)', () => {
  assert.deepEqual(counts(layersOf(shellStitch({ repeats: 3 })).slice(1)), [
    [19, 19],
    [19, 19],
  ]);
});

test('V-szem: a láncívként belehorgolt láncszemek beleszámítanak, az utolsó sor díszívei nem (03 §4.3, PQW-870)', () => {
  // 4 ismétlés: 2 szélső pálca + 4 × 2 pálca, és 4 egyláncszemes ív; a 2. sor az 1. sor íveibe horgol.
  assert.deepEqual(counts(layersOf(vStitchPattern({ repeats: 4 })).slice(1)), [
    [14, 14],
    [10, 14],
  ]);
});

test('cikcakk és hullám: a sorok szemszáma állandó (03 §4.2 G, §2.3)', () => {
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

test('nagymama-négyzet: a láncívként, egészben belehorgolt sarok- és oldalívek beleszámítanak (03 §8, PQW-870)', () => {
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

test('a záró és továbbvezető kúszószem mintánként bekapcsolva számít (szókészlet D7)', () => {
  const example = grannySquare();
  const pattern = { ...example.pattern, conventions: { ...example.pattern.conventions, joinSlipStitchCounts: true } };
  // 1. kör: +1 záró; 2–3. kör: +3 továbbvezető és +1 záró.
  assert.deepEqual(
    computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount),
    [0, 21, 40, 40],
  );
});

/** Rövidpálcás háló: az 1. sor „1 rp, [1 lsz, 1 láncszem kihagyása, 1 rp] 2-szer”, a 2. sor egyenként belehorgol. */
function scMesh({ decorative = false } = {}, conventions = {}) {
  const b = new PieceBuilder('p1', 'Háló');
  const foundation = b.chain(6);
  const row1 = [b.stitch('sc', foundation[4]), b.stitch('ch'), b.stitch('sc', foundation[2]), b.stitch('ch'), b.stitch('sc', foundation[0])];
  b.event('turn');
  b.chain(1);
  // Díszláncnál a 2. sor jelölten kihagyja a láncszemeket, és csak a rövidpálcákba horgol.
  const chains = [row1[1], row1[3]];
  for (const target of [...row1].reverse()) if (!decorative || !chains.includes(target)) b.stitch('sc', target);
  if (decorative) b.skip(...chains);
  b.event('fasten-off');
  return patternOf('Háló', [b.build()], conventions);
}

const stitchCounts = (pattern) => computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount);
const withChainCounts = (example, chainCounts) => ({ ...example.pattern, conventions: { ...example.pattern.conventions, chainCounts } });

test('az egyenként belehorgolt láncszemek beleszámítanak (PQW-870)', () => {
  const pattern = scMesh();
  assert.deepEqual(validatePattern(pattern, testLibrary), []);
  assert.deepEqual(counts(computeLayers(pattern, testLibrary).slice(1)), [
    [5, 5],
    [5, 5],
  ]);
});

test('a díszlánc, amibe semmi nem horgol, nem számít, akkor sem, ha nem az utolsó sorban van (PQW-870)', () => {
  const pattern = scMesh({ decorative: true });
  assert.deepEqual(validatePattern(pattern, testLibrary), []);
  assert.deepEqual(counts(computeLayers(pattern, testLibrary).slice(1)), [
    [3, 5],
    [3, 3],
  ]);
});

test('a láncszemek számolása mintánként felülírható: mind számít, vagy egyik sem (PQW-870)', () => {
  assert.deepEqual(stitchCounts(withChainCounts(vStitchPattern(), true)), [0, 14, 14]);
  assert.deepEqual(stitchCounts(withChainCounts(vStitchPattern(), false)), [0, 10, 10]);
  assert.deepEqual(stitchCounts(withChainCounts(grannySquare(), true)), [0, 20, 36, 52]);
  assert.deepEqual(stitchCounts(withChainCounts(grannySquare(), false)), [0, 12, 24, 36]);
  assert.deepEqual(stitchCounts(scMesh({ decorative: true }, { chainCounts: true })), [0, 5, 3]);
  assert.deepEqual(stitchCounts(scMesh({}, { chainCounts: false })), [0, 3, 5]);
  // A pozíciószám és a fordulólánc számolása nem változik.
  assert.deepEqual(counts(layersOf({ pattern: withChainCounts(vStitchPattern(), false) })), [
    [0, 14],
    [10, 14],
    [10, 14],
  ]);
  assert.deepEqual(stitchCounts(withChainCounts(dcRectangle({ rows: 2 }), false)), [0, 16, 16]);
});

test('a sor fordulóláncának konvenciója soronként felülírható (README §4.3)', () => {
  const example = dcRectangle({ rows: 2 });
  const piece = example.pattern.pieces[0];
  const events = piece.events.map((event, i) => (i === 0 ? { ...event, conventions: { turningChainCounts: false } } : event));
  const pattern = { ...example.pattern, pieces: [{ ...piece, events }] };

  assert.deepEqual(
    computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount),
    [0, 16, 15],
  );
});

test('a számolt réteg csak a types.ts Layer mezőit adja vissza', () => {
  assert.deepEqual(Object.keys(layersOf(hdcRectangle({ rows: 1 }))[1]).sort(), [
    'index',
    'piece',
    'positionCount',
    'shape',
    'side',
    'stitchCount',
    'stitches',
  ]);
});

test('láncalap: N + T, ha a fordulólánc nem számít, és N + T − 1, ha számít (03 §1.2)', () => {
  assert.equal(foundationChainLength(100, 3, false), 103);
  assert.equal(foundationChainLength(100, 3, true), 102);
  assert.equal(foundationChainLength(25, 1, false), 26);
});

test('„X többszöröse + Y”: a fordulólánc benne van-e az Y-ban (03 §4.1, README §4.4)', () => {
  // Kagyló: 6 többszöröse + 1, és még 1 lsz a rövidpálca fordulóláncának.
  assert.deepEqual(repeatCounts({ repeatWidth: 6, edgeStitches: 1, turningChainIncluded: false }, 3, 1, false), {
    chains: 20,
    workedChains: 19,
    firstRowPositions: 19,
  });
  // Dora Does: V-szem 3 + 2, 20 V = 62 lsz, és utána jön a fordulólánc.
  assert.equal(repeatCounts({ repeatWidth: 3, edgeStitches: 2, turningChainIncluded: false }, 20, 3, false).chains, 65);
  // Oombawka: 8 többszöröse + 2, a 2 lsz a fordulólánc.
  assert.deepEqual(repeatCounts({ repeatWidth: 8, edgeStitches: 2, turningChainIncluded: true }, 1, 2, false), {
    chains: 10,
    workedChains: 8,
    firstRowPositions: 8,
  });
});

test('a szemkönyvtár nem enged kétszer szereplő azonosítót', () => {
  assert.throws(() => createStitchLibrary([DOUBLE_CROCHET, DOUBLE_CROCHET]), /Kétszer szereplő szemazonosító: dc/);
});
