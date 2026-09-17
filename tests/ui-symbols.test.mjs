/*
 * A paraméteres jelrajz táblázatos tesztjei (PQW-867): ferde vonalak =
 * ráhajtások, a szár hossza a láncszem-magasságból, közös talp és közös tető,
 * jelölés a talpon, a rövidpálca + vagy ×.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { STITCHES, stitchById } from '../src/core/stitches.ts';
import { hatchCount, placedShapes, shapeBounds, stemLength, symbolShapes } from '../src/ui/symbols.ts';

const ROLES = [
  'stem', 'bar', 'hatch', 'cross', 'chain', 'dot', 'ring', 'closure', 'tilde',
  'front-loop', 'back-loop', 'front-post', 'back-post',
];

function roleCounts(shapes) {
  const counts = Object.fromEntries(ROLES.map((role) => [role, 0]));
  for (const shape of shapes) counts[shape.role] += 1;
  return counts;
}

function only(counts) {
  return { ...Object.fromEntries(ROLES.map((role) => [role, 0])), ...counts };
}

const near = (a, b) => Math.abs(a - b) < 1e-9;
const samePoint = (p, q) => near(p.x, q.x) && near(p.y, q.y);
const stems = (shapes) => shapes.filter((shape) => shape.role === 'stem');

// prettier-ignore
const SYMBOLS = [
  ['ch',            { chain: 1 }],
  ['sl-st',         { dot: 1 }],
  ['sc',            { stem: 1, cross: 1 }],
  ['hdc',           { stem: 1, bar: 1 }],
  ['dc',            { stem: 1, bar: 1, hatch: 1 }],
  ['tr',            { stem: 1, bar: 1, hatch: 2 }],
  ['dtr',           { stem: 1, bar: 1, hatch: 3 }],
  ['inc-2sc',       { stem: 2, cross: 2 }],
  ['inc-2dc',       { stem: 2, bar: 2, hatch: 2 }],
  ['sc2tog',        { stem: 2, cross: 2 }],
  ['sc3tog',        { stem: 3, cross: 3 }],
  ['dc2tog',        { stem: 2, bar: 1, hatch: 2 }],
  ['dc3tog',        { stem: 3, bar: 1, hatch: 3 }],
  ['invdec',        { stem: 2, cross: 2, 'front-loop': 2 }],
  ['shell-5dc',     { stem: 5, bar: 5, hatch: 5 }],
  ['v-st-dc',       { stem: 2, bar: 2, hatch: 2, chain: 1 }],
  ['cl-3dc',        { stem: 3, bar: 1, hatch: 3 }],
  ['cl-3dc-spread', { stem: 3, bar: 1, hatch: 3 }],
  ['puff-3',        { stem: 3, bar: 1 }],
  ['bobble-5dc',    { stem: 5, bar: 1, hatch: 5 }],
  ['popcorn-5dc',   { stem: 5, hatch: 5, closure: 1 }],
  ['picot',         { chain: 3, dot: 1 }],
  ['rev-sc',        { stem: 1, cross: 1, tilde: 2 }],
  ['ch-sp',         { chain: 3 }],
  ['magic-ring',    { ring: 1 }],
];

test('a jeltáblázatban a könyvtár minden szeme szerepel', () => {
  assert.deepEqual(
    SYMBOLS.map(([id]) => id),
    STITCHES.map((stitch) => stitch.id),
  );
});

for (const [id, expected] of SYMBOLS) {
  test(`${id}: a jel elemei`, () => {
    assert.deepEqual(roleCounts(symbolShapes(stitchById(id))), only(expected));
  });
}

test('minden szár annyi ferde vonalat kap, ahány ráhajtása van a részszemnek', () => {
  for (const def of STITCHES) {
    const shapes = symbolShapes(def);
    const part = def.kind === 'joined' ? stitchById(def.part) : def;
    assert.equal(roleCounts(shapes).hatch, stems(shapes).length * hatchCount(part), def.id);
  }
});

// prettier-ignore
const HATCHES = [
  // azonosító  ráhajtás  ferde vonal
  ['sc',        0,        0],
  ['hdc',       1,        0],   // a félpálca sima T (01 §8.1 szabály 1–2)
  ['dc',        1,        1],
  ['tr',        2,        2],
  ['dtr',       3,        3],
];

for (const [id, yarnOvers, hatches] of HATCHES) {
  test(`${id}: ferde vonalak = ráhajtások, a félpálca kivételével`, () => {
    const def = stitchById(id);
    assert.equal(def.yarnOvers, yarnOvers);
    assert.equal(hatchCount(def), hatches);
    assert.equal(roleCounts(symbolShapes(def)).hatch, hatches);
  });
}

test('a ferde vonal valóban ferde: se nem vízszintes, se nem függőleges', () => {
  for (const shape of symbolShapes(stitchById('tr')).filter((s) => s.role === 'hatch')) {
    assert.ok(!near(shape.from.x, shape.to.x) && !near(shape.from.y, shape.to.y));
  }
});

// prettier-ignore
const STEMS = [
  // azonosító  láncszem-magasság  szárhossz
  ['sc',        1,                 18],
  ['hdc',       2,                 26],
  ['dc',        3,                 34],
  ['tr',        4,                 42],
  ['dtr',       5,                 50],
];

for (const [id, chainHeight, length] of STEMS) {
  test(`${id}: a szár hossza a láncszem-magasságból jön`, () => {
    const def = stitchById(id);
    const [stem] = stems(symbolShapes(def));
    assert.equal(def.chainHeight, chainHeight);
    assert.equal(stemLength(def.chainHeight), length);
    assert.ok(near(Math.hypot(stem.to.x - stem.from.x, stem.to.y - stem.from.y), length));
  });
}

test('szaporításnál, kagylónál és V-szemnél a szárak talpa közös', () => {
  for (const id of ['inc-2sc', 'inc-2dc', 'shell-5dc', 'v-st-dc']) {
    const [first, ...rest] = stems(symbolShapes(stitchById(id)));
    for (const stem of rest) assert.ok(samePoint(stem.from, first.from), id);
    assert.ok(rest.some((stem) => !samePoint(stem.to, first.to)), `${id}: a tetők szétnyílnak`);
  }
});

test('fogyasztásnál a szárak teteje közös, a talpuk különböző', () => {
  for (const id of ['sc2tog', 'sc3tog', 'dc2tog', 'dc3tog', 'invdec', 'cl-3dc-spread']) {
    const [first, ...rest] = stems(symbolShapes(stitchById(id)));
    for (const stem of rest) {
      assert.ok(samePoint(stem.to, first.to), `${id}: közös tető`);
      assert.ok(!samePoint(stem.from, first.from), `${id}: külön talp`);
    }
  }
});

test('egy szembe horgolt fürtnél, bogyónál és pufnál a talp és a tető is közös', () => {
  for (const id of ['cl-3dc', 'bobble-5dc', 'puff-3']) {
    const [first, ...rest] = stems(symbolShapes(stitchById(id)));
    for (const stem of rest) assert.ok(samePoint(stem.from, first.from) && samePoint(stem.to, first.to), id);
  }
});

/* ---- Beszúrás a talpon ---- */

const MARKS = ['front-loop', 'back-loop', 'front-post', 'back-post'];

for (const id of ['sc', 'hdc', 'dc', 'tr']) {
  for (const insertion of MARKS) {
    test(`${id}, ${insertion}: egy jelölés a talpon`, () => {
      const shapes = symbolShapes(stitchById(id), { singleCrochet: 'plus', insertion });
      const marks = shapes.filter((shape) => MARKS.includes(shape.role));
      assert.equal(marks.length, 1);
      assert.equal(marks[0].role, insertion);
      for (const point of [marks[0].from, marks[0].control, marks[0].to]) {
        assert.ok(Math.hypot(point.x, point.y) <= 10, `a talptól messze: ${point.x}, ${point.y}`);
      }
    });
  }
}

test('az első relief jobbra, a hátsó balra nyílik', () => {
  const mark = (insertion) =>
    symbolShapes(stitchById('dc'), { singleCrochet: 'plus', insertion }).find((s) => s.role === insertion);
  assert.ok(mark('front-post').to.x > 0);
  assert.ok(mark('back-post').to.x < 0);
});

test('mindkét szál, láncív és gyűrű nem kap jelölést', () => {
  for (const insertion of ['both-loops', 'space', 'ring']) {
    const shapes = symbolShapes(stitchById('dc'), { singleCrochet: 'plus', insertion });
    assert.equal(shapes.filter((shape) => MARKS.includes(shape.role)).length, 0, insertion);
  }
});

test('több szemen át horgolt szemnél minden talp megkapja a jelölést', () => {
  const shapes = symbolShapes(stitchById('sc2tog'), { singleCrochet: 'plus', insertion: 'back-loop' });
  const feet = stems(shapes).map((stem) => stem.from.x);
  const marks = shapes.filter((shape) => shape.role === 'back-loop');
  assert.deepEqual(
    marks.map((mark) => (mark.from.x + mark.to.x) / 2),
    feet,
  );
});

test('nem megengedett beszúrási módra hibát dob', () => {
  const cases = [['ch', 'front-loop'], ['sl-st', 'front-post'], ['rev-sc', 'back-loop'], ['invdec', 'both-loops']];
  for (const [id, insertion] of cases) {
    assert.throws(() => symbolShapes(stitchById(id), { singleCrochet: 'plus', insertion }), RangeError, id);
  }
});

/* ---- Rövidpálca: + vagy × ---- */

test('a rövidpálca alapból +: a keresztvonal a sor tengelyén áll', () => {
  const shapes = symbolShapes(stitchById('sc'));
  const cross = shapes.find((shape) => shape.role === 'cross');
  // A jel saját terében a sor tengelye a vízszintes (PQW-931).
  assert.ok(near(cross.from.y, cross.to.y));
  assert.ok(Math.abs(cross.to.x - cross.from.x) > 1);
  // Álló szárnál ez merőleges is a szárra: az eddigi állítás nem sérült meg.
  const [stem] = stems(shapes);
  const dot = (stem.to.x - stem.from.x) * (cross.to.x - cross.from.x) + (stem.to.y - stem.from.y) * (cross.to.y - cross.from.y);
  assert.ok(near(dot, 0));
});

test('a szaporítás legyezőjében a ferde szárak keresztvonala is vízszintes marad', () => {
  const shapes = symbolShapes(stitchById('inc-2sc'));
  const crosses = shapes.filter((shape) => shape.role === 'cross');
  assert.equal(crosses.length, 2);
  // A + nem fordul el a legyező szárainak dőlésével (PQW-929, PQW-931).
  for (const cross of crosses) assert.ok(near(cross.from.y, cross.to.y), JSON.stringify(cross));
  // A szárak viszont ferdék maradtak: a jel nem lett kiegyenesítve.
  assert.ok(stems(shapes).every((stem) => Math.abs(stem.to.x - stem.from.x) > 1));
});

test('× beállítással két átló, függőleges szár nélkül, összetett jelben is', () => {
  const options = { singleCrochet: 'cross' };
  const sc = symbolShapes(stitchById('sc'), options);
  assert.deepEqual(roleCounts(sc), only({ cross: 2 }));
  for (const arm of sc) assert.ok(near(Math.abs(arm.to.x - arm.from.x), Math.abs(arm.to.y - arm.from.y)));

  assert.deepEqual(roleCounts(symbolShapes(stitchById('inc-2sc'), options)), only({ cross: 4 }));
  assert.deepEqual(roleCounts(symbolShapes(stitchById('dc'), options)), roleCounts(symbolShapes(stitchById('dc'))));
});

/* ---- Japán (JIS) jelstílus (PQW-868) ---- */

test('JIS stílusban a rövidpálca mindig ×, a + beállítástól függetlenül, összetett jelben is', () => {
  const jis = { singleCrochet: 'plus', style: 'jis' };
  assert.deepEqual(roleCounts(symbolShapes(stitchById('sc'), jis)), only({ cross: 2 }));
  assert.deepEqual(roleCounts(symbolShapes(stitchById('sc2tog'), jis)), only({ cross: 4 }));
});

test('JIS stílusban a hátsó szál vízszintes vonal a talp alatt', () => {
  const [mark] = symbolShapes(stitchById('dc'), { singleCrochet: 'plus', style: 'jis', insertion: 'back-loop' })
    .filter((shape) => shape.role === 'back-loop');
  assert.equal(mark.kind, 'line');
  assert.ok(near(mark.from.y, mark.to.y) && mark.from.y > 0);
  assert.ok(mark.from.x < 0 && mark.to.x > 0);
  assert.ok(Math.hypot(mark.from.x, mark.from.y) <= 10);
});

test('JIS stílusban minden szem jele a × rövidpálcás CYC-jel, csak a hátsó szál és a varázskör jele más', () => {
  for (const def of STITCHES.filter((stitch) => stitch.kind !== 'ring')) {
    for (const singleCrochet of ['plus', 'cross']) {
      const jis = symbolShapes(def, { singleCrochet, style: 'jis' });
      assert.deepEqual(jis, symbolShapes(def, { singleCrochet: 'cross' }), `${def.id}, ${singleCrochet}`);
    }
  }
  for (const insertion of ['front-loop', 'front-post', 'back-post']) {
    const jis = symbolShapes(stitchById('hdc'), { singleCrochet: 'plus', style: 'jis', insertion });
    assert.deepEqual(jis, symbolShapes(stitchById('hdc'), { singleCrochet: 'cross', insertion }), insertion);
  }
});

/* ---- A JIS jelkészlet kiegészítése (PQW-876) ---- */

test('JIS stílusban a varázskör a „わ” jel: saját vonalakból, kör nélkül, a kör helyén és méretében', () => {
  const ring = stitchById('magic-ring');
  const jis = symbolShapes(ring, { singleCrochet: 'plus', style: 'jis' });
  assert.ok(jis.length >= 4);
  assert.ok(jis.every((shape) => shape.role === 'ring' && (shape.kind === 'line' || shape.kind === 'curve')));
  const [circle, wa] = [shapeBounds(symbolShapes(ring)), shapeBounds(jis)];
  assert.ok(wa.minX >= circle.minX && wa.maxX <= circle.maxX && wa.minY >= circle.minY && wa.maxY <= circle.maxY);
  assert.ok(wa.maxX - wa.minX > 10 && wa.maxY - wa.minY > 10, 'olvasható méretű');
});

test('a diagramon is: JIS stílusban a varázskör helyén „わ”, CYC-ben kör', () => {
  const ring = stitchById('magic-ring');
  const placement = { role: 'ring', feet: [], top: { x: 50, y: 40 }, angle: 0, size: 20 };
  assert.deepEqual(roleCounts(placedShapes(ring, placement)), only({ ring: 1 }));
  const jis = placedShapes(ring, placement, { singleCrochet: 'plus', style: 'jis' });
  assert.ok(jis.length >= 4 && jis.every((shape) => shape.kind !== 'ellipse'));
  const { minX, maxX, minY, maxY } = shapeBounds(jis);
  assert.ok(minX >= 40 && maxX <= 60 && minY >= 30 && maxY <= 50);
});

test('JIS stílusban a rákhurok a × rövidpálca, fölötte hullámvonallal', () => {
  const shapes = symbolShapes(stitchById('rev-sc'), { singleCrochet: 'plus', style: 'jis' });
  assert.deepEqual(roleCounts(shapes), only({ cross: 2, tilde: 2 }));
  const top = Math.min(...shapes.filter((s) => s.role === 'cross').flatMap((s) => [s.from.y, s.to.y]));
  assert.ok(shapes.filter((s) => s.role === 'tilde').every((s) => s.from.y < top && s.to.y < top));
});

test('minden jelnek véges, nem üres befoglaló téglalapja van', () => {
  for (const def of STITCHES) {
    const { minX, minY, maxX, maxY } = shapeBounds(symbolShapes(def));
    assert.ok([minX, minY, maxX, maxY].every(Number.isFinite), def.id);
    assert.ok(maxX > minX && maxY > minY, def.id);
  }
});
