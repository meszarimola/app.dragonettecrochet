/*
 * Ovális láncalapról (PQW-890; 04 §3.4, §9.4): a láncszem másik oldala mint
 * célpont, a körterv (az 1. kör 2L + 2, utána rövidpálcánál körönként +6), a
 * generált gráf és az ellenőrzője, az írott minta és a visszaolvasás, a mentés,
 * a rajz, és az ovális részként.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addAmigurumiPart, createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { roundGaugeOf, shapeSchedule } from '../src/core/amigurumi.ts';
import { canonicalPattern } from '../src/core/canonical.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph, computeLayers } from '../src/core/graph.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';

/** A 04 §4.4 mintasűrűsége: DK pamut, 3,5 mm-es tű. */
const DK = { stitchesPerCm: 1.9, roundsPerCm: 2, source: 'measured' };

const part = (shape, extra = {}) => ({ name: '', shape, stagger: true, eyes: false, ...extra });
const oval = (lengthCm, widthCm) => ({ kind: 'oval', lengthCm, widthCm });

function ok(result) {
  assert.ok(result.ok, result.reason);
  return result.pattern;
}

const rules = (pattern) => validatePattern(pattern, libraryFor(pattern)).map((finding) => finding.rule);
const graphOf = (pattern, index = 0) => buildPieceGraph(pattern, pattern.pieces[index], libraryFor(pattern));
const textOf = (pattern, locale = 'hu') => formatWrittenPattern(writePattern(pattern, libraryFor(pattern), locale));

describe('a körterv (04 §9.4)', () => {
  test('az 1. kör 2L + 2 szem L láncszemből, utána körönként +6; a láncszemek a hosszból, a körök a szélességből', () => {
    for (const [lengthCm, widthCm] of [
      [8, 5],
      [12, 4],
      [6, 6],
      [20, 10],
    ]) {
      const planned = shapeSchedule(oval(lengthCm, widthCm), DK);
      assert.ok(planned.ok, planned.reason);
      const { counts, start, end, oval: plan } = planned.schedule;
      assert.equal(start, 'chain');
      assert.equal(end, 'open');
      assert.equal(plan.perEnd, 3);
      assert.equal(counts[0], 2 * plan.chains + 2, `${lengthCm} × ${widthCm}: az 1. kör`);
      assert.ok(counts.slice(1).every((count, i) => count - counts[i] === 6), `${lengthCm} × ${widthCm}: +6 körönként`);
      assert.equal(counts.length, Math.round((widthCm / 2) * DK.roundsPerCm));
      assert.ok(plan.chains >= 3);
    }
  });

  test('a hossz a hosszabbik méret; hibás méretnél érthető üzenet', () => {
    assert.match(shapeSchedule(oval(4, 6), DK).reason, /hossza legalább akkora/);
    assert.match(shapeSchedule(oval(Number.NaN, 4), DK).reason, /hossz/);
  });
});

describe('a generált ovális gráfja', () => {
  test('az 1. kör elöl minden láncszembe, a legtávolabbiba 4 rp, a másik oldalon vissza, a horoghoz legközelebbibe 3 rp', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    assert.deepEqual(rules(pattern), []);
    const graph = graphOf(pattern);
    const [base, first] = graph.layers;
    const W = base.positions.length;
    assert.deepEqual(base.undersides, base.positions.slice(1));
    assert.equal(first.stitchCount, 2 * (W + 1) + 2);

    const anchors = first.stitches.flatMap((id) => graph.nodes.get(id).anchors);
    const into = (kind, id) => anchors.filter((anchor) => anchor.into === kind && anchor.id === id).length;
    // Fonalsorrendben az első láncszem a legtávolabbi a horogtól.
    assert.equal(into('stitch', base.positions[0]), 4);
    assert.equal(into('underside', base.positions[0]), 0);
    assert.equal(into('stitch', base.positions[W - 1]), 1);
    assert.equal(into('underside', base.positions[W - 1]), 3);
    for (const id of base.positions.slice(1, -1)) assert.deepEqual([into('stitch', id), into('underside', id)], [1, 1], id);
    const groups = pattern.pieces[0].groups.filter((group) => group.members.every((id) => first.stitches.includes(id)));
    assert.deepEqual(groups.map((group) => group.def).sort(), ['inc-3sc', 'inc-4sc']);
  });

  test('a körök szemszáma a körterv szerint; eltolással és anélkül, becsült és mért mintasűrűséggel is hibátlan, hosszú oválisnál is', () => {
    const dk = { ...emptyPattern(), gauge: undefined };
    for (const base of [emptyPattern(), dk]) {
      for (const shape of [oval(8, 5), oval(15, 12), oval(5, 1)]) {
        for (const stagger of [true, false]) {
          const result = createAmigurumi(base, part(shape, { stagger }), false);
          const pattern = ok(result);
          assert.deepEqual(rules(pattern), [], `${shape.lengthCm} × ${shape.widthCm}, eltolás: ${stagger}`);
          assert.deepEqual(
            computeLayers(pattern, libraryFor(pattern)).slice(1).map((layer) => layer.stitchCount),
            result.schedule.counts,
          );
        }
      }
    }
  });
});

describe('írott minta és visszaolvasás', () => {
  test('az 1. kör: kihagyás, elöl a láncszemekbe, a láncszemek másik oldalán vissza', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    const hu = textOf(pattern);
    assert.ok(
      hu.includes('1. kör: hagyj ki 1 láncszemet, majd 6 rp, 4 rp a következő láncszembe, a láncszemek másik oldalán vissza: 5 rp, 3 rp a következő láncszembe (18).'),
      hu,
    );
    assert.match(hu, /Láncalap: 8 lsz\./);
    assert.match(textOf(pattern, 'en-US'), /Rnd 1: skip 1 ch, 6 sc, 4 sc in next ch, working back along the other side of the chain: 5 sc, 3 sc in next ch \(18\)\./);
    assert.match(textOf(pattern, 'en-GB'), /Rnd 1: miss 1 ch, 6 dc, 4 dc in next ch, working back along the other side of the chain: 5 dc, 3 dc in next ch \(18\)\./);
  });

  test('a szöveg visszaolvasva ugyanazt a gráfot adja, mindhárom jelöléssel', () => {
    for (const shape of [oval(8, 5), oval(14, 8)]) {
      const pattern = ok(createAmigurumi(emptyPattern(), part(shape), false));
      const library = libraryFor(pattern);
      for (const locale of ['hu', 'en-US', 'en-GB']) {
        const back = readPattern(textOf(pattern, locale), { library, locale, conventions: pattern.conventions });
        assert.ok(back.ok, `${locale}: ${JSON.stringify(back.error)}`);
        assert.deepEqual(canonicalPattern(back.pattern).pieces, canonicalPattern(pattern).pieces, locale);
      }
    }
  });

  test('a „másik oldal” csak a láncalapra horgolt 1. körben értelmezhető', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    const text = textOf(pattern).replace('2. kör: ', '2. kör: a láncszemek másik oldalán vissza: ');
    const back = readPattern(text, { library: libraryFor(pattern), locale: 'hu', conventions: pattern.conventions });
    assert.equal(back.ok, false);
  });
});

describe('mentés', () => {
  test('a láncszem másik oldala és az ovális forma a JSON-mentésben megmarad; a móddal megadott másik oldal hibás', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok);
    assert.deepEqual(loaded.pattern, pattern);
    const raw = JSON.parse(savePattern(pattern));
    const node = raw.pieces[0].stitches.find((candidate) => candidate.anchors[0]?.into === 'underside');
    node.anchors[0].mode = 'back-loop';
    assert.equal(loadPattern(JSON.stringify(raw)).ok, false);
  });
});

describe('az ellenőrző az ovális 1. körén', () => {
  /** Egykörös ovális: a hibák nem húzódnak át a következő körbe. */
  const single = () => ok(createAmigurumi(emptyPattern(), part(oval(5, 1)), false));
  const withAnchor = (pattern, id, anchors) => ({
    ...pattern,
    pieces: [{ ...pattern.pieces[0], stitches: pattern.pieces[0].stitches.map((node) => (node.id === id ? { ...node, anchors } : node)) }],
  });

  test('az egykörös ovális hibátlan', () => {
    const pattern = single();
    assert.equal(graphOf(pattern).layers.length, 2);
    assert.deepEqual(rules(pattern), []);
  });

  test('a másik oldal egy láncszeme kimarad: felhasználatlan pozíció', () => {
    const pattern = single();
    const graph = graphOf(pattern);
    const [base, first] = graph.layers;
    const back = first.stitches.find((id) => graph.nodes.get(id).anchors[0]?.into === 'underside' && !graph.groupOf.has(id));
    const target = graph.nodes.get(back).anchors[0].id;
    // A szem a következő láncszem másik oldalába kerül: ott kettő lesz jelöletlenül, ez kimarad.
    const next = base.positions[base.positions.indexOf(target) + 1];
    const broken = withAnchor(pattern, back, [{ into: 'underside', id: next }]);
    const found = new Set(rules(broken));
    assert.ok(found.has('unused-position'), [...found].join(', '));
    assert.deepEqual([...found].filter((rule) => rule !== 'unused-position' && rule !== 'unmarked-increase'), []);
  });

  test('a másik oldal célpontja nem a láncalap láncszeme, hanem az 1. kör egy korábbi szeme: rossz sorba mutat', () => {
    const pattern = single();
    const graph = graphOf(pattern);
    const first = graph.layers[1];
    const front = first.stitches.find((id) => graph.nodes.get(id).anchors[0]?.into === 'stitch');
    const back = first.stitches.find((id) => graph.nodes.get(id).anchors[0]?.into === 'underside');
    const broken = withAnchor(pattern, back, [{ into: 'underside', id: front }]);
    assert.deepEqual([...new Set(rules(broken))], ['anchor-layer']);
  });

  test('elöl két szem célpontja felcserélve: a haladási iránnyal szemben', () => {
    const pattern = single();
    const graph = graphOf(pattern);
    const first = graph.layers[1];
    const fronts = first.stitches.filter((id) => graph.nodes.get(id).anchors[0]?.into === 'stitch' && !graph.groupOf.has(id));
    const [a, b] = fronts;
    const broken = withAnchor(withAnchor(pattern, a, graph.nodes.get(b).anchors), b, graph.nodes.get(a).anchors);
    assert.deepEqual([...new Set(rules(broken))], ['against-direction']);
  });
});

describe('rajz és részek', () => {
  test('a rajzon a láncalap egyenesen, az 1. kör elöl és a másik oldalán a láncalap két oldalán áll', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    const graph = graphOf(pattern);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const [base, first] = graph.layers;
    for (const id of base.stitches) assert.equal(layout.nodes.get(id).top.y, 0, id);
    const side = (kind) =>
      first.stitches.filter((id) => graph.nodes.get(id).anchors[0]?.into === kind && !graph.groupOf.has(id)).map((id) => Math.sign(layout.nodes.get(id).top.y));
    const front = new Set(side('stitch'));
    const back = new Set(side('underside'));
    assert.equal(front.size, 1);
    assert.equal(back.size, 1);
    assert.notDeepEqual([...front], [...back]);
  });

  test('részként: talpként egy gömbhöz varrva, és a fal folytatólagosan az ovális szélén', () => {
    const head = ok(createAmigurumi(emptyPattern(), part({ kind: 'sphere', diameterCm: 6, method: '6n' }, { name: 'Fej' }), false));
    const sewn = ok(addAmigurumiPart(head, part(oval(8, 5), { name: 'Talp' }), { method: 'sewn', distribute: true }, false));
    assert.deepEqual(rules(sewn), []);
    assert.equal(sewn.pieces.length, 2);

    const sole = ok(createAmigurumi(emptyPattern(), part(oval(8, 5), { name: 'Talp' }), false));
    const wall = { kind: 'cylinder', diameterCm: 5, heightCm: 3, bottom: 'open', top: 'open' };
    const joined = ok(addAmigurumiPart(sole, part(wall, { name: 'Fal' }), { method: 'continuous', distribute: true }, false));
    assert.deepEqual(rules(joined), []);
    assert.deepEqual(joined.pieces[0].sections.map((section) => section.name), ['Talp', 'Fal']);
    // A lapos talp nem tömött: a tömés jelölése nincs az ovális után.
    assert.ok(!textOf(sole).includes('tömés'));
  });

  test('önállóan a kör- és a gömbösítő ellenőrzés nem jelez; a mintasűrűség a profilból', () => {
    assert.equal(roundGaugeOf(emptyPattern()).source, 'estimated');
  });
});
