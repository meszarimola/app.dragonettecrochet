/*
 * Sarokból sarokba (PQW-864): W + H − 1 átlós sor, a d. átló csempéi, a
 * szaporító és fogyasztó szakasz oldalanként (03 §5.5, §10 G33), a láncalap
 * a hagyomány függvényeiből, a színek csempénként, és hogy minden C2C-minta
 * hibátlanul átmegy az ellenőrzőn, kiírható és menthető.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { C2C_STITCH, c2cRowCount, generateC2C, planC2C, tilesInRow } from '../src/core/c2c.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { cellCounts } from '../src/core/pixel-chart.ts';
import { foundationChainLength } from '../src/core/repeat.ts';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { firstChainFromHook, withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';
import { GRID_CORE_TEXTS } from '../src/ui/i18n/core/grid.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

const COLORS = [
  { name: 'Fehér', hex: '#ffffff' },
  { name: 'Piros', hex: '#c0392b' },
  { name: 'Kék', hex: '#2e86c1' },
];

const cyc = () => emptyPattern();
const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });

const plain = (width, height, color = 0) => Array.from({ length: height }, () => Array.from({ length: width }, () => color));
const make = (pattern, cells, colors = COLORS) => {
  const result = generateC2C(pattern, { cells, colors, unit: null, lettering: false });
  assert.ok(result.ok, JSON.stringify(result.reason));
  return result;
};
/** A mag kódot és adatot ad; a mondat a felület szótárában készül (PQW-904). */
const hu = (message) => renderCoreText(GRID_CORE_TEXTS.hu, message);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));

function random(seed) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

describe('átlós sorok és csempék (03 §5.5, §10 G33)', () => {
  const SIZES = [
    [1, 1],
    [3, 2],
    [2, 3],
    [4, 4],
    [5, 2],
    [1, 4],
    [6, 3],
  ];

  test('W × H rács W + H − 1 sor, a d. sorban min(d, W, H, W + H − d) csempe, és minden cella pontosan egyszer', () => {
    for (const [width, height] of SIZES) {
      const plan = planC2C(cyc(), plain(width, height), COLORS).plan;
      assert.equal(plan.rows.length, c2cRowCount(width, height), `${width} × ${height}`);
      plan.rows.forEach((row) => assert.equal(row.tiles.length, tilesInRow(row.row, width, height), `${width} × ${height}, ${row.row}. sor`));
      const cells = plan.rows.flatMap((row) => row.tiles.map((tile) => `${tile.x},${tile.y}`));
      assert.equal(cells.length, width * height);
      assert.equal(new Set(cells).size, width * height);
    }
  });

  test('a kép jobb alsó sarkából indul, és a bal felsőben ér véget', () => {
    const plan = planC2C(cyc(), plain(5, 2), COLORS).plan;
    assert.deepEqual(plan.rows[0].tiles[0], { x: 4, y: 0, color: 0 });
    assert.deepEqual(plan.rows.at(-1).tiles, [{ x: 0, y: 1, color: 0 }]);
  });

  test('szaporító és fogyasztó szakasz: egy oldal addig nő, amíg a mérete meg nincs, a két oldal függetlenül vált', () => {
    for (const [width, height] of SIZES) {
      const plan = planC2C(cyc(), plain(width, height), COLORS).plan;
      // A páros sor a jobb élen (magasság), a páratlan az alsó élen (szélesség) kezd.
      for (const row of plan.rows.slice(1)) {
        const [startSide, endSide] = row.row % 2 === 0 ? [height, width] : [width, height];
        assert.equal(row.start, row.row <= startSide ? 'increase' : 'decrease', `${width} × ${height}, ${row.row}. sor eleje`);
        assert.equal(row.end, row.row <= endSide ? 'increase' : 'decrease', `${width} × ${height}, ${row.row}. sor vége`);
      }
    }
    const plan = planC2C(cyc(), plain(5, 2), COLORS).plan;
    assert.deepEqual(
      plan.rows.map((row) => [row.start, row.end]),
      [
        ['increase', 'increase'],
        ['increase', 'increase'],
        ['increase', 'decrease'],
        ['decrease', 'increase'],
        ['increase', 'decrease'],
        ['decrease', 'decrease'],
      ],
    );
  });

  test('a láncalap: 6 lsz, az első pálca a 4. láncszembe; japán hagyományban is a függvények szerint (PQW-924)', () => {
    const def = resolveStitch(C2C_STITCH);
    const plan = planC2C(cyc(), plain(2, 2), COLORS).plan;
    assert.deepEqual(plan.foundation, { chains: 6, fromHook: 4 });
    const jp = planC2C(japanese(), plain(2, 2), COLORS).plan;
    assert.deepEqual(jp.foundation, {
      chains: foundationChainLength(3, def.turningChain, true, 'japanese'),
      fromHook: firstChainFromHook(def.turningChain, true, 'japanese'),
    });
    const { pattern } = make(cyc(), plain(2, 1));
    const row1 = writePattern(pattern, libraryFor(pattern), 'hu').pieces[0].lines.find((line) => line.startsWith('2. sor: '));
    /*
     * A csempe nyitó három láncszeme láncív (03 §5.5), nem kihagyott láncszem:
     * a sor „3 lsz, 3 erp” alakban indul, és a végén a következő csempe tere áll.
     */
    assert.match(row1, /^2\. sor: 3 lsz, 3 erp[ (]/);
  });
});

describe('színek és ellenőrző', () => {
  test('minden pálca a csempéje színével: színenként a cellák háromszorosa', () => {
    // Ma csak az 1 × 1 és a 2 × 1 alakzat épül fel (PQW-926).
    const cells = [[0, 1]];
    const { pattern } = make(cyc(), cells);
    const dcColors = new Map();
    for (const node of pattern.pieces[0].stitches) {
      if (node.def === C2C_STITCH) dcColors.set(node.color ?? 0, (dcColors.get(node.color ?? 0) ?? 0) + 1);
    }
    for (const [color, count] of cellCounts(cells)) assert.equal(dcColors.get(color), 3 * count, `${color}. szín`);
    assert.deepEqual(pattern.pieces[0].grid.colors, COLORS);
  });

  test('a nagyobb alakzatokat a program érthetően elutasítja, amíg a csempék láncíve nem áll össze (PQW-926)', () => {
    for (const [width, height] of [[1, 2], [3, 1], [2, 2], [4, 3]]) {
      const result = generateC2C(cyc(), { cells: plain(width, height), colors: COLORS, unit: null, lettering: false });
      assert.equal(result.ok, false, `${width} × ${height}`);
      assert.equal(result.reason.code, 'c2c-repeated-increase', `${width} × ${height}`);
      assert.match(hu(result.reason), /egyelőre nem készíthető el/, `${width} × ${height}`);
    }
  });

  test('a ma támogatott alakzatok hibátlanok, kiírhatók és menthetők: 1 × 1 és 2 × 1, CYC és japán hagyomány', () => {
    const next = random(2);
    for (const base of [cyc, japanese]) {
      for (const [width, height] of [[1, 1], [2, 1]]) {
        const cells = Array.from({ length: height }, () => Array.from({ length: width }, () => Math.floor(next() * COLORS.length)));
        const label = `${width} × ${height}`;
        const { pattern } = make(base(), cells);
        assert.deepEqual(findings(pattern), [], label);
        const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
        assert.equal(graph.layers.length - 1, c2cRowCount(width, height), label);
        for (const locale of ['hu', 'en-US', 'en-GB']) assert.ok(formatWrittenPattern(writePattern(pattern, libraryFor(pattern), locale)), label);
        const loaded = loadPattern(savePattern(pattern));
        assert.ok(loaded.ok, label);
        assert.deepEqual(loaded.pattern, pattern, label);
      }
    }
  });

  test('hibás rácsnál és nem számító fordulóláncnál érthető ok', () => {
    const reason = (pattern, cells, colors = COLORS) => {
      const result = planC2C(pattern, cells, colors);
      assert.equal(result.ok, false);
      return result.reason;
    };
    // A mag kódot és adatot ad; a mondat a felület szótárából jön (PQW-904).
    assert.equal(reason(cyc(), []).code, 'chart-no-rows');
    assert.equal(reason(cyc(), [[0, 3]]).code, 'chart-color-index');
    assert.equal(reason(cyc(), [[0]], []).code, 'chart-no-colors');
    assert.deepEqual(reason(cyc(), [[0, 0], [0]]), { code: 'chart-size', data: { max: 80 } });
    const notCounting = { ...emptyPattern(), conventions: { ...emptyPattern().conventions, turningChainCounts: false } };
    assert.equal(reason(notCounting, [[0]]).code, 'c2c-turning-chain');

    assert.match(hu(reason(cyc(), [])), /legalább egy sort/);
    assert.match(hu(reason(cyc(), [[0, 3]])), /színlista egyik színe/);
    assert.match(hu(reason(cyc(), [[0]], [])), /legalább egy színt/);
    assert.match(hu(reason(cyc(), [[0, 0], [0]])), /egyforma széles/);
    assert.equal(
      hu(reason(notCounting, [[0]])),
      'A C2C-csempe 3 láncszeme az első pálca helyett áll: a mintában a pálca fordulóláncának szemnek kell számítania.',
    );
  });
});
