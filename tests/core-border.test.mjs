/*
 * A szegély a gráfban (PQW-889; 03 §7.1, §10 H38): a sorvég mint célpont, a
 * szegély rétege, az ellenőrzése, a helye a rajzon és a rácson, a JSON-mentés,
 * a régi mentés és a kész méret.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { BORDER_CORNER, appendBorder, borderLayerIndex, rowEdges } from '../src/core/border.ts';
import { canonicalPattern } from '../src/core/canonical.ts';
import { contextOf, emptyPattern, pieceFinished } from '../src/core/editor.ts';
import { contains } from '../src/core/grid.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { planShape } from '../src/core/shapes.ts';
import { generatedMessage } from '../src/ui/shapes-view.ts';
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

/* ---- PQW-897, PQW-898 ---- */

/** Pálcás minta 16 × 8 mintasűrűséggel: a 03 §7.1 H példájához (60 szem × 40 sor). */
function dcGauge() {
  return {
    ...emptyPattern(),
    gauge: {
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
    },
  };
}

/** Forma szegéllyel; a minta alapból üres. */
function shaped(patch, pattern = emptyPattern()) {
  const result = generateShape(pattern, { ...DEFAULT_SHAPE, border: BORDER, ...patch });
  assert.ok(result.ok, result.reason);
  return result;
}

/** Az írott minta minden nyelven visszaolvasható, a szegéllyel együtt ugyanarra a gráfra. */
function assertReadsBack(pattern) {
  const library = libraryFor(pattern);
  for (const locale of ['hu', 'en-US', 'en-GB']) {
    const back = readPattern(formatWrittenPattern(writePattern(pattern, library, locale)), { library, locale, conventions: pattern.conventions });
    assert.ok(back.ok, `${locale}: ${JSON.stringify(back.error)}`);
    assert.deepEqual(back.pattern.pieces[0].border, pattern.pieces[0].border, locale);
    assert.deepEqual(canonicalPattern(back.pattern).pieces[0].stitches, canonicalPattern(pattern).pieces[0].stitches, locale);
  }
}

describe('szegély ferde élű darab köré (PQW-898)', () => {
  test('egyenlő szárú és derékszögű háromszög, trapéz és rombusz köré: hibátlan, a sarkokban 3 rp, a réteg szemszáma a terv szerinti, visszaolvasható', () => {
    for (const patch of [
      { shape: 'isosceles-triangle', widthCm: 10, heightCm: 8 },
      { shape: 'right-triangle', widthCm: 8, heightCm: 8 },
      { shape: 'trapezoid', widthCm: 12, topWidthCm: 6, heightCm: 6 },
      { shape: 'trapezoid', widthCm: 6, topWidthCm: 12, heightCm: 6 },
      { shape: 'diamond', widthCm: 10, heightCm: 10 },
    ]) {
      const { pattern, plan } = shaped(patch);
      assert.deepEqual(rules(pattern), [], patch.shape);
      const graph = graphOf(pattern);
      const index = borderLayerIndex(graph);
      assert.equal(graph.layers[index].stitchCount, plan.border.total, patch.shape);
      const corners = pattern.pieces[0].groups.filter((group) => group.members.every((id) => graph.layerOf.get(id) === index));
      assert.ok(corners.length >= 2 && corners.every((group) => group.members.length === BORDER_CORNER), patch.shape);
      assertReadsBack(pattern);
    }
  });

  test('meredek háromszögnél a lépcsők minden meghagyott szeme 1 rp-t kap; az írott minta ezt ki is írja', () => {
    const { pattern, plan } = shaped({ shape: 'isosceles-triangle', stitch: 'dc', widthCm: 20, heightCm: 5 });
    assert.ok(plan.unworkedRows.length > 0);
    assert.ok(plan.border.sides[0].exposed + plan.border.sides[1].exposed === pattern.pieces[0].skipped.length);
    const graph = graphOf(pattern);
    const index = borderLayerIndex(graph);
    const worked = graph.layers[index].stitches.flatMap((id) => graph.nodes.get(id).anchors).filter((anchor) => anchor.into === 'stitch');
    for (const id of pattern.pieces[0].skipped) assert.equal(worked.filter((anchor) => anchor.id === id).length, 1, id);
    assert.deepEqual(rules(pattern), []);
    const hu = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(hu, /oldal: soronként 2 rp a sor végére, \d+ rp a lépcsők meghagyott szemeibe \(\d+ rp\)/);
    assertReadsBack(pattern);
  });

  test('két szemes csúcsnál a felső élen nincs „0 rp”: csak a két sarok', () => {
    const { pattern, plan } = shaped({ shape: 'isosceles-triangle', widthCm: 10, heightCm: 8 });
    assert.equal(plan.border.top, 0);
    const hu = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(hu, /felső él: 3 rp a sarokszembe, 3 rp a sarokszembe;/);
    assert.doesNotMatch(hu, / 0 rp/);
  });

  test('a láncos hosszabbítással, nagyon meredeken szélesedő él köré érthető okkal nem készül', () => {
    const result = planShape(emptyPattern(), { ...DEFAULT_SHAPE, shape: 'diamond', stitch: 'sc', widthCm: 20, heightCm: 4, border: BORDER });
    assert.equal(result.ok, false);
    assert.match(result.reason, /láncos hosszabbítással/);
  });

  test('a szegély a ferde élű darab rácsán is a darab körül: minden szegélyszem egy szegélysávban', () => {
    const { pattern } = shaped({ shape: 'isosceles-triangle', widthCm: 10, heightCm: 8 });
    const library = libraryFor(pattern);
    const index = borderLayerIndex(graphOf(pattern));
    const grid = chartGrid(pattern, library, 'rows', contextOf(pattern));
    const bands = grid.bands.filter((band) => band.layer === index);
    const layout = layoutPattern(pattern, library);
    for (const node of layout.nodes.values()) {
      if (node.layer !== index || node.role !== 'stitch') continue;
      assert.ok(bands.some((band) => contains(band.area, node.top)), `${node.id} a szegély sávjában`);
    }
  });
});

describe('igazítás a következő szegélysor ismétléséhez (PQW-898; 03 §7.1 H, §10 H39)', () => {
  test('03 §7.1 H: 4 + 0 ismétléshez a felső és az alsó él 58-ról 60-ra, az oldal 80 marad; összesen 292 (igazítás nélkül 288)', () => {
    const repeat = { width: 4, edge: 0 };
    const { pattern, plan } = shaped({ stitch: 'dc', widthCm: 37.5, heightCm: 50, border: { ...BORDER, repeat } }, dcGauge());
    assert.deepEqual([plan.counts[0], plan.counts.length], [60, 40]);
    assert.deepEqual([plan.border.top, plan.border.bottom, plan.border.sides[0].total, plan.border.sides[1].total, plan.border.total], [60, 60, 80, 80, 292]);
    assert.deepEqual([plan.border.topAdjusted, plan.border.bottomAdjusted], [2, 2]);
    for (const n of [plan.border.top, plan.border.bottom, ...plan.border.sides.map((side) => side.total)]) assert.equal(n % 4, 0);
    const graph = graphOf(pattern);
    assert.equal(graph.layers[borderLayerIndex(graph)].stitchCount, 292);
    assert.deepEqual(rules(pattern), []);
    assert.equal(shaped({ stitch: 'dc', widthCm: 37.5, heightCm: 50 }, dcGauge()).plan.border.total, 288);
    const hu = formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));
    assert.match(hu, /felső él: 3 rp a sarokszembe, 60 rp \(2 szembe 2 rp, egyenletesen elosztva\), 3 rp a sarokszembe;/);
    assert.match(hu, /a következő sor ismétléséhez igazítva \(élenként 4 többszöröse \+ 0\) \(292 szem\)\./);
    assertReadsBack(pattern);
  });

  test('egyenlő szárú háromszög 6 + 3-hoz: az alsó él és a két oldal a sarkok között 6 többszöröse + 3, a sorvégeken egyenletesen elosztva', () => {
    const { pattern, plan } = shaped({ shape: 'isosceles-triangle', widthCm: 10, heightCm: 8, border: { ...BORDER, repeat: { width: 6, edge: 3 } } });
    for (const n of [plan.border.bottom, ...plan.border.sides.map((side) => side.total)]) assert.equal((n - 3) % 6, 0, String(n));
    assert.deepEqual(rules(pattern), []);
    assertReadsBack(pattern);
  });

  test('az ismétlés a JSON-mentéssel megmarad; hibás ismétlés nem töltődik be', () => {
    const { pattern } = shaped({ border: { ...BORDER, repeat: { width: 4, edge: 1 } } });
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok);
    assert.deepEqual(loaded.pattern.pieces[0].border, { ...BORDER, repeat: { width: 4, edge: 1 } });
    for (const repeat of [{ width: 0, edge: 1 }, { width: 4, edge: -1 }, { width: 51, edge: 0 }]) {
      const wrong = JSON.parse(savePattern(pattern));
      wrong.pieces[0].border.repeat = repeat;
      assert.equal(loadPattern(JSON.stringify(wrong)).ok, false, JSON.stringify(repeat));
    }
  });
});

describe('a kész szegély után (PQW-897)', () => {
  test('a szegély helye a rajzon szegélyként jelölt, a sorok nem', () => {
    const { pattern } = rectangle({ border: BORDER });
    const index = borderLayerIndex(graphOf(pattern));
    const layout = layoutPattern(pattern, libraryFor(pattern));
    assert.equal(layout.layers[index].border, true);
    assert.ok(layout.layers.slice(0, index).every((layer) => !layer.border));
  });

  test('a darab lezárult: a kész szegély vagy a fonal elvágása után nincs következő sor; félkész darabnál van', () => {
    assert.equal(pieceFinished(graphOf(rectangle({ border: BORDER }).pattern)), true);
    assert.equal(pieceFinished(graphOf(rectangle().pattern)), true);
    assert.equal(pieceFinished(graphOf(legacy(rectangle({ border: BORDER }).pattern))), false);
    assert.equal(pieceFinished(null), false);
  });

  test('a Forma üzenete szegéllyel: „… sor és szegély elkészült”', () => {
    const { plan } = rectangle({ border: BORDER });
    assert.match(generatedMessage({ ...DEFAULT_SHAPE, border: BORDER }, plan), /^Téglalap, \d+ sor és szegély elkészült; /);
    assert.match(generatedMessage(DEFAULT_SHAPE, rectangle().plan), /^Téglalap, \d+ sor elkészült; /);
  });
});

describe('a lezárt darab az amigurumiban is (PQW-897, PQW-890)', () => {
  test('az önálló ovális után a darab lezárult: nincs következő kör', async () => {
    const { createAmigurumi } = await import('../src/core/amigurumi-generator.ts');
    const result = createAmigurumi(emptyPattern(), { name: 'Talp', shape: { kind: 'oval', lengthCm: 8, widthCm: 5 }, stagger: true, eyes: false }, false);
    assert.ok(result.ok, result.reason);
    assert.equal(pieceFinished(graphOf(result.pattern)), true);
  });
});
