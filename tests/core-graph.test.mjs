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

test('a láncalap végén álló fordulólánc az 1. sorhoz tartozik: a láncalappal együtt N + kihagyás láncszem (03 §1.2, PQW-924)', () => {
  const layers = layersOf(hdcRectangle());
  // 15 félpálca a láncalap 15 pozíciójába; a fordulólánc nem szem, csak a sor elején álló lánc.
  assert.equal(layers[0].positionCount, 15);
  const turningChain = layers[1].stitches.length - layers[1].stitchCount;
  assert.equal(turningChain, 2);
  const foundation = layers[0].positionCount + turningChain;
  assert.equal(foundation, 17);
  assert.equal(foundation, foundationChainLength(15, 2, true));
});

test('pálcás téglalap: a számító fordulólánc alapláncszemen áll, 19 láncszem ad 16 szemet (03 §3.1 B, PQW-891)', () => {
  const layers = layersOf(dcRectangle());

  assert.equal(layers[0].positionCount, 16);
  assert.deepEqual(counts(layers.slice(1)), Array.from({ length: 16 }, () => [16, 16]));
  assert.equal(layers[0].positionCount + 3, 19);
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
  // A háló a láncszemek számolásáról szól: a forrás szerkezete (az 1. sor a 2. láncszembe kezd, a fordulólánc nem
  // számít) kifejezett beállítással marad, mert sorban a fordulólánc alapértelmezésben számít (PQW-891).
  return patternOf('Háló', [b.build()], { turningChainCounts: false, ...conventions });
}

const stitchCounts = (pattern) => computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount);
const writtenCounts = (pattern) => computeLayers(pattern, testLibrary).map((layer) => layer.writtenCount);
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

test('a láncszemek számolása mintánként felülírható: mind számít, vagy egyik sem (PQW-870, PQW-940)', () => {
  // A beállítás a KIÍRT szemszámot billenti; a szerkezeté ettől nem mozdul (PQW-940).
  // A láncalap száma a megmaradt láncszemei és a fordulólánc oszlopa (PQW-942).
  assert.deepEqual(writtenCounts(withChainCounts(vStitchPattern(), true)), [15, 14, 14]);
  assert.deepEqual(writtenCounts(withChainCounts(vStitchPattern(), false)), [15, 10, 10]);
  assert.deepEqual(writtenCounts(withChainCounts(grannySquare(), true)), [0, 20, 36, 52]);
  assert.deepEqual(writtenCounts(withChainCounts(grannySquare(), false)), [0, 12, 24, 36]);
  assert.deepEqual(writtenCounts(scMesh({ decorative: true }, { chainCounts: true })), [6, 5, 3]);
  assert.deepEqual(writtenCounts(scMesh({}, { chainCounts: false })), [6, 3, 5]);
  // A szerkezet szemszáma, a pozíciószám és a fordulólánc számolása nem változik.
  assert.deepEqual(stitchCounts(withChainCounts(vStitchPattern(), true)), stitchCounts(withChainCounts(vStitchPattern(), false)));
  assert.deepEqual(counts(layersOf({ pattern: withChainCounts(vStitchPattern(), false) })), [
    [0, 14],
    [14, 14],
    [10, 14],
  ]);
  assert.deepEqual(writtenCounts(withChainCounts(dcRectangle({ rows: 2 }), false)), [17, 17, 17]);
});

test('a sor fordulóláncának konvenciója soronként felülírható (README §4.3)', () => {
  const example = dcRectangle({ rows: 2 });
  const piece = example.pattern.pieces[0];
  const events = piece.events.map((event, i) => (i === 0 ? { ...event, conventions: { turningChainCounts: false } } : event));
  const pattern = { ...example.pattern, pieces: [{ ...piece, events }] };

  assert.deepEqual(
    computeLayers(pattern, testLibrary).map((layer) => layer.stitchCount),
    [0, 16, 16],
  );
});

test('a számolt réteg csak a types.ts Layer mezőit adja vissza', () => {
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

test('láncalap: N + T, akár számít a fordulólánc, akár nem; számító fordulólánc alapláncszemen áll (03 §1.2, PQW-891)', () => {
  assert.equal(foundationChainLength(100, 3, false), 103);
  assert.equal(foundationChainLength(100, 3, true), 103);
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
