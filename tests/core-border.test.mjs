/*
 * A szegély a gráfban (PQW-889; 03 §7.1, §10 H38): a sorvég mint célpont, a
 * szegély rétege, az ellenőrzése, a helye a rajzon és a rácson, a JSON-mentés,
 * a régi mentés és a kész méret.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { BORDER_CORNER, appendBorder, borderLayerIndex, rowEdges } from '../src/core/border.ts';
import { contextOf, emptyPattern } from '../src/core/editor.ts';
import { stitchDimensions } from '../src/core/gauge.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { chartGrid } from '../src/core/grid.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { gaugeContextOf, patternSize } from '../src/core/pattern-size.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { DEFAULT_SHAPE, generateShape } from '../src/core/shapes.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { editNode } from './fixtures/builder.ts';

const BORDER = { stitch: 'sc', hdcRowEnd: 2 };

/** Kis téglalap a Forma szakasz generátorával, szegéllyel vagy anélkül. */
function rectangle(patch = {}) {
  const result = generateShape(emptyPattern(), { ...DEFAULT_SHAPE, widthCm: 5, heightCm: 4, ...patch });
  assert.ok(result.ok, result.reason);
  return result;
}

const graphOf = (pattern) => buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
const rules = (pattern) => validatePattern(pattern, libraryFor(pattern)).map((finding) => finding.rule);

/** A PQW-889 előtti mentés: a szegély választása megvan, a rétege nincs; az utolsó sor fordulással ér véget. */
function legacy(pattern) {
  const graph = graphOf(pattern);
  const index = borderLayerIndex(graph);
  const removed = new Set(graph.layers[index].stitches);
  const piece = pattern.pieces[0];
  return {
    ...pattern,
    pieces: [
      {
        ...piece,
        stitches: piece.stitches.filter((node) => !removed.has(node.id)),
        groups: piece.groups.filter((group) => !group.members.some((id) => removed.has(id))),
        events: piece.events.filter((event) => !removed.has(event.after)),
      },
    ],
  };
}

describe('a szegély rétege a gráfban', () => {
  for (const [stitch, hdcRowEnd, perRow] of [
    ['sc', 2, 1],
    ['hdc', 2, 2],
    ['hdc', 1, 1],
    ['dc', 2, 2],
    ['tr', 2, 3],
  ]) {
    test(`${stitch}, félpálcás sorvég ${hdcRowEnd}: sorvégenként ${perRow} rp, sarkonként 3, a réteg szemszáma a terv szerinti`, () => {
      const { pattern, plan } = rectangle({ stitch, border: { stitch: 'sc', hdcRowEnd } });
      assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
      const graph = graphOf(pattern);
      const index = borderLayerIndex(graph);
      assert.equal(index, graph.layers.length - 1);
      const layer = graph.layers[index];
      assert.equal(layer.shape, 'round');
      assert.equal(layer.stitchCount, plan.border.total);
      assert.equal(layer.closing.kind, 'join-slip');
      assert.equal(layer.closing.statedCount, plan.border.total);

      // Minden sor mindkét végébe a sor szeméhez illő számú szem megy.
      const anchors = layer.stitches.flatMap((id) => graph.nodes.get(id).anchors);
      for (const row of graph.layers.slice(1, index)) {
        const { start, end } = rowEdges(row);
        for (const edge of [start, end]) {
          assert.equal(anchors.filter((anchor) => anchor.into === 'row-end' && anchor.id === edge).length, perRow, `${row.index}. sor, ${edge}`);
        }
      }
      // A négy sarok 3 rp-je szaporításként.
      const corners = pattern.pieces[0].groups.filter((group) => group.members.every((id) => layer.stitches.includes(id)));
      assert.equal(corners.length, 4);
      assert.ok(corners.every((group) => group.def === `inc-${BORDER_CORNER}sc`));
    });
  }

  test('03 §7.1 H: 60 × 40 pálcás takaró körül a szegély rétege 288 szem', () => {
    const pattern = emptyPattern();
    const gauge = {
      active: 'p1',
      profiles: [
        {
          id: 'p1',
          yarn: { name: 'Próba', cycWeight: 4, metersPer100g: null, ballMassG: null },
          hookMm: 5,
          blocked: false,
          gauges: [{ stitch: 'dc', form: 'rows', stitchesPer10cm: 16, rowsPer10cm: 8, source: 'measured' }],
          swatch: { widthCm: null, heightCm: null, massG: null },
        },
      ],
    };
    const result = generateShape({ ...pattern, gauge }, { ...DEFAULT_SHAPE, stitch: 'dc', widthCm: 37.5, heightCm: 50, border: BORDER });
    assert.ok(result.ok, result.reason);
    const graph = graphOf(result.pattern);
    assert.equal(graph.layers[borderLayerIndex(graph)].stitchCount, 288);
  });

  test('a szegély csak az utolsó sor fordulása után, egyszer fűzhető a darabhoz', () => {
    const { pattern } = rectangle();
    const piece = pattern.pieces[0];
    assert.match(appendBorder(pattern, piece, libraryFor(pattern), BORDER), /fordulása után/);
    const { pattern: bordered } = rectangle({ border: BORDER });
    const withTurn = { ...bordered.pieces[0], events: [...bordered.pieces[0].events.slice(0, -1), { ...bordered.pieces[0].events.at(-1), kind: 'turn' }] };
    assert.match(appendBorder(bordered, withTurn, libraryFor(bordered), BORDER), /már van szegélye/);
  });
});

describe('az ellenőrző a szegélyen', () => {
  test('a sorvég célpontja a sor szélső szeme; a sor közepébe mutató sorvég rossz sorba mutat', () => {
    const { pattern } = rectangle({ border: BORDER });
    const graph = graphOf(pattern);
    const layer = graph.layers[borderLayerIndex(graph)];
    const sideStitch = layer.stitches.find((id) => graph.nodes.get(id).anchors[0]?.into === 'row-end');
    const row = graph.layers[graph.layerOf.get(graph.nodes.get(sideStitch).anchors[0].id)];
    const middle = row.positions[Math.floor(row.positions.length / 2)];
    const broken = { ...pattern, pieces: [editNode(pattern, sideStitch, {}).pieces[0]] };
    const piece = broken.pieces[0];
    broken.pieces[0] = {
      ...piece,
      stitches: piece.stitches.map((node) => (node.id === sideStitch ? { ...node, anchors: [{ into: 'row-end', id: middle }] } : node)),
    };
    assert.deepEqual([...new Set(rules(broken))], ['anchor-layer']);
  });

  test('a nem létező sorvég célpont nem létező hivatkozás', () => {
    const { pattern } = rectangle({ border: BORDER });
    const piece = pattern.pieces[0];
    const last = piece.stitches.findLast((node) => node.anchors[0]?.into === 'row-end');
    const broken = { ...pattern, pieces: [{ ...piece, stitches: piece.stitches.map((node) => (node === last ? { ...node, anchors: [{ into: 'row-end', id: 'n9999' }] } : node)) }] };
    assert.deepEqual([...new Set(rules(broken))], ['dangling-reference']);
  });
});

describe('mentés, írott minta és régi mentés', () => {
  test('a sorvég célpont a JSON-mentésben megmarad', () => {
    const { pattern } = rectangle({ border: BORDER });
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok);
    assert.deepEqual(loaded.pattern, pattern);
    const raw = JSON.parse(savePattern(pattern));
    const node = raw.pieces[0].stitches.find((candidate) => candidate.anchors[0]?.into === 'row-end');
    node.anchors[0].mode = 'back-loop';
    assert.equal(loadPattern(JSON.stringify(raw)).ok, false);
  });

  test('a régi mentés (csak a választás) betöltődik, a szegélysor ugyanaz, a rajzon és a méretben nincs szegély', () => {
    const { pattern } = rectangle({ border: BORDER });
    const old = legacy(pattern);
    const loaded = loadPattern(savePattern(old));
    assert.ok(loaded.ok);
    assert.equal(borderLayerIndex(graphOf(loaded.pattern)), -1);
    assert.deepEqual(validatePattern(loaded.pattern, libraryFor(loaded.pattern)), []);
    const library = libraryFor(pattern);
    const borderLine = (p) => formatWrittenPattern(writePattern(p, libraryFor(p), 'hu')).split('\n').find((line) => line.startsWith('Szegély: '));
    assert.ok(borderLine(old));
    assert.equal(borderLine(old), borderLine(pattern));
    assert.doesNotThrow(() => layoutPattern(loaded.pattern, library));
  });
});

describe('a szegély a rajzon, a rácson és a kész méretben', () => {
  test('a szegély szemei a darab körül: a felső él fölött, a láncalap alatt, a sorvégek a sor szélén kívül', () => {
    const { pattern } = rectangle({ border: BORDER });
    const graph = graphOf(pattern);
    const index = borderLayerIndex(graph);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const layer = graph.layers[index];
    for (const id of layer.stitches) assert.ok(layout.nodes.has(id), id);
    assert.ok(layout.layers[index], 'a szegély rétegének helye');

    const rows = [...layout.nodes.values()].filter((node) => node.layer > 0 && node.layer < index);
    const minX = Math.min(...rows.map((node) => node.top.x));
    const maxX = Math.max(...rows.map((node) => node.top.x));
    const topY = Math.min(...rows.map((node) => node.top.y));
    const outside = (placed) => placed.top.x < minX || placed.top.x > maxX;
    const grouped = new Set(pattern.pieces[0].groups.flatMap((group) => group.members));
    for (const id of layer.stitches) {
      const anchor = graph.nodes.get(id).anchors[0];
      if (!anchor || id === layer.joinSlip) continue;
      const placed = layout.nodes.get(id);
      const targetLayer = graph.layerOf.get(anchor.id);
      // A sarok 3 szeme legyezőben: a függőlegestől a vízszintesig, kifelé.
      const corner = grouped.has(id);
      if (anchor.into === 'row-end') assert.ok(outside(placed), `${id}: a sor szélén kívül`);
      else if (targetLayer === 0) assert.ok(placed.top.y > 0 || (corner && outside(placed)), `${id}: a láncalap alatt`);
      else assert.ok(placed.top.y < topY || (corner && outside(placed)), `${id}: a felső él fölött`);
    }
  });

  test('a rácson a sorok sávjai mellett a szegély négy sávja a darab körül', () => {
    const { pattern } = rectangle({ border: BORDER });
    const library = libraryFor(pattern);
    const graph = graphOf(pattern);
    const index = borderLayerIndex(graph);
    const grid = chartGrid(pattern, library, 'rows', contextOf(pattern));
    const borderBands = grid.bands.filter((band) => band.layer === index);
    assert.equal(borderBands.length, 4);
    const rowBands = grid.bands.filter((band) => band.layer < index);
    assert.equal(rowBands.length, index);
    const inner = { x0: Math.min(...rowBands.map((b) => b.area.x0)), x1: Math.max(...rowBands.map((b) => b.area.x1)) };
    assert.ok(borderBands.some((band) => band.area.x1 <= inner.x0 + 0.01));
    assert.ok(borderBands.some((band) => band.area.x0 >= inner.x1 - 0.01));
  });

  test('a kész méret a szegéllyel: minden oldalon egy rövidpálcás sor magassága', () => {
    const { pattern } = rectangle({ border: BORDER });
    const library = libraryFor(pattern);
    const bordered = patternSize(pattern, graphOf(pattern), library).size.total;
    const old = legacy(pattern);
    const plain = patternSize(old, graphOf(old), libraryFor(old)).size.total;
    const rim = stitchDimensions(library.get('sc'), 'row', gaugeContextOf(pattern, library)).heightMm.value * 0.2;
    assert.ok(Math.abs(bordered.widthCm.value - plain.widthCm.value - rim) < 1e-9);
    assert.ok(Math.abs(bordered.heightCm.value - plain.heightCm.value - rim) < 1e-9);
  });
});
