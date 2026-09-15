/*
 * Ovális láncalapról (PQW-890; 04 §3.4, §9.4): a láncszem másik oldala mint
 * célpont, a körterv (az 1. kör 2L + 2, utána rövidpálcánál körönként +6), a
 * generált gráf és az ellenőrzője, az írott minta és a visszaolvasás, a mentés,
 * a rajz, és az ovális részként.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addAmigurumiPart, createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { figureSize, roundGaugeOf, shapeSchedule } from '../src/core/amigurumi.ts';
import { canonicalPattern } from '../src/core/canonical.ts';
import { contextOf, defaultCursor, emptyPattern, endRoundSpiral, fillRow, work, workIntoSame } from '../src/core/editor.ts';
import { buildPieceGraph, computeLayers } from '../src/core/graph.ts';
import { targetPoint } from '../src/core/grid.ts';
import { copySelection, duplicateSelection, pasteFragment } from '../src/core/selection.ts';
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

/* ---- PQW-899: félpálcás és pálcás ovális, kézi horgolás, másolás, a figura magassága ---- */

const withTradition = (tradition) => ({ ...emptyPattern(), conventions: { ...emptyPattern().conventions, tradition } });

describe('félpálcás és pálcás ovális (PQW-899)', () => {
  test('végenként a lapos érték fele: félpálcánál körönként +8, pálcánál +12; a láncszemek a szem kezdőláncával', () => {
    const base = emptyPattern();
    for (const [stitch, perEnd, turningChain] of [
      ['sc', 3, 1],
      ['hdc', 4, 2],
      ['dc', 6, 3],
    ]) {
      const planned = shapeSchedule({ ...oval(12, 8), stitch }, roundGaugeOf(base, stitch));
      assert.ok(planned.ok, planned.reason);
      const { counts, oval: plan } = planned.schedule;
      assert.deepEqual([plan.stitch, plan.perEnd, plan.turningChain], [stitch, perEnd, turningChain]);
      const W = plan.chains - turningChain;
      assert.equal(counts[0], 2 * W - 2 + 2 * perEnd, `${stitch}: az 1. kör`);
      assert.ok(counts.slice(1).every((count, i) => count - counts[i] === 2 * perEnd), `${stitch}: +${2 * perEnd} körönként`);
    }
    // A rövidpálcás ovális a PQW-890 szerint marad: 2L + 2.
    const sc = shapeSchedule(oval(8, 5), DK).schedule;
    assert.equal(sc.counts[0], 2 * sc.oval.chains + 2);
  });

  test('a generált ovális hibátlan, a körök szemszáma a körterv szerint, CYC és japán hagyománnyal, eltolással és anélkül', () => {
    for (const base of [emptyPattern(), withTradition('japanese')]) {
      for (const stitch of ['hdc', 'dc']) {
        for (const stagger of [true, false]) {
          const result = createAmigurumi(base, part({ ...oval(12, 8), stitch }, { stagger }), false);
          const pattern = ok(result);
          const label = `${stitch}, ${base.conventions.tradition ?? 'cyc'}, eltolás: ${stagger}`;
          assert.deepEqual(rules(pattern), [], label);
          assert.deepEqual(computeLayers(pattern, libraryFor(pattern)).slice(1).map((layer) => layer.stitchCount), result.schedule.counts, label);
        }
      }
    }
  });

  test('a számító kezdőlánc (pálca) a horoghoz legközelebbi vég egyik szeme; a nem számító (félpálca) nem', () => {
    const dc = ok(createAmigurumi(emptyPattern(), part({ ...oval(8, 5), stitch: 'dc' }), false));
    const hdc = ok(createAmigurumi(emptyPattern(), part({ ...oval(8, 5), stitch: 'hdc' }), false));
    const first = (pattern) => graphOf(pattern).layers[1];
    assert.deepEqual([first(dc).turningChain.length, first(dc).turningChainCounts], [3, true]);
    assert.deepEqual([first(hdc).turningChain.length, first(hdc).turningChainCounts], [2, false]);
    const groups = (pattern) => pattern.pieces[0].groups.map((group) => group.def).slice(0, 2);
    assert.deepEqual(groups(dc), ['inc-7dc', 'inc-5dc']);
    assert.deepEqual(groups(hdc), ['inc-5hdc', 'inc-4hdc']);
  });

  test('az írott minta a szem kezdőláncának kihagyásával, és visszaolvasva ugyanazt a gráfot adja, mindhárom jelöléssel', () => {
    const dc = ok(createAmigurumi(emptyPattern(), part({ ...oval(8, 5), stitch: 'dc' }), false));
    assert.ok(
      textOf(dc).includes('1. kör: hagyj ki 3 láncszemet, majd 6 erp, 7 erp a következő láncszembe, a láncszemek másik oldalán vissza: 5 erp, 5 erp a következő láncszembe (24).'),
      textOf(dc),
    );
    for (const base of [emptyPattern(), withTradition('japanese')]) {
      for (const stitch of ['hdc', 'dc']) {
        const pattern = ok(createAmigurumi(base, part({ ...oval(10, 6), stitch }), false));
        const library = libraryFor(pattern);
        for (const locale of ['hu', 'en-US', 'en-GB']) {
          const back = readPattern(textOf(pattern, locale), { library, locale, conventions: pattern.conventions });
          assert.ok(back.ok, `${stitch} ${locale}: ${JSON.stringify(back.error)}`);
          assert.deepEqual(canonicalPattern(back.pattern).pieces, canonicalPattern(pattern).pieces, `${stitch} ${locale}`);
        }
      }
    }
  });

  test('mentés: a szem megmarad, a szem nélküli régi mentés rövidpálcás, ismeretlen szem hibás', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part({ ...oval(8, 5), stitch: 'hdc' }), false));
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok);
    assert.deepEqual(loaded.pattern.pieces[0].sections[0].shape, { kind: 'oval', lengthCm: 8, widthCm: 5, stitch: 'hdc' });
    const old = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    assert.equal(JSON.parse(savePattern(old)).pieces[0].sections[0].shape.stitch, undefined);
    const raw = JSON.parse(savePattern(pattern));
    raw.pieces[0].sections[0].shape.stitch = 'tr';
    assert.equal(loadPattern(JSON.stringify(raw)).ok, false);
  });

  test('a figura magassága: a lapos ovális a vastagságával (egy szemszélesség) járul hozzá, nem a körmagassággal', () => {
    const base = emptyPattern();
    for (const stitch of ['sc', 'dc']) {
      const gauge = roundGaugeOf(base, stitch);
      const sole = ok(createAmigurumi(base, part({ ...oval(8, 5), stitch }, { name: 'Talp' }), false));
      const size = figureSize(sole);
      assert.equal(size.parts[0].sections[0].schedule.heightCm, 1 / gauge.stitchesPerCm, stitch);
      assert.equal(size.heightCm, 1 / gauge.stitchesPerCm, stitch);
      assert.ok(size.widthCm >= 7 && size.widthCm <= 9, `${stitch}: a hossz a szélesség`);
    }
    // Varrva a gömb a talpra ül: a figura magassága a gömbé és a talp vastagságáé, a besüllyedő süveggel csökkentve.
    const head = ok(createAmigurumi(base, part({ kind: 'sphere', diameterCm: 6, method: '6n' }, { name: 'Test' }), false));
    const figure = figureSize(ok(addAmigurumiPart(head, part(oval(8, 5), { name: 'Talp' }), { method: 'sewn', distribute: true }, false)));
    const alone = figureSize(head);
    assert.ok(figure.heightCm < alone.heightCm + 1, `${figure.heightCm} < ${alone.heightCm} + 1`);
  });
});

describe('kézi horgolás a láncszem másik oldalába (PQW-899)', () => {
  const mode = { roundsOnChain: true };
  const chains = (count) => ok(work(emptyPattern(), { def: 'ch', count }, 0));
  const cursorOf = (pattern, stitch = 'sc', editorMode = mode) => defaultCursor(pattern, contextOf(pattern, editorMode), stitch);
  const place = (pattern, stitch = 'sc') => ok(work(pattern, { def: stitch, count: 1 }, cursorOf(pattern, stitch), [], mode));

  /** Az 1. kör a vezetett kurzorral: elöl a legtávolabbi láncszemig, ott `far` szem, a másik oldalon vissza, a végén `near` szem. */
  function guided(count, stitch = 'sc', far = 4, near = 3) {
    let pattern = chains(count);
    do pattern = place(pattern, stitch);
    while (contextOf(pattern, mode).frontier < count - 1);
    for (let k = 1; k < far; k += 1) pattern = ok(workIntoSame(pattern, stitch));
    while (cursorOf(pattern, stitch) < contextOf(pattern, mode).slots.length) pattern = place(pattern, stitch);
    for (let k = 1; k < near; k += 1) pattern = ok(workIntoSame(pattern, stitch));
    return ok(endRoundSpiral(pattern));
  }

  test('amigurumiban a láncalapon a kurzor a kezdőlánc utáni láncszemre áll; sorban marad a sor szabálya', () => {
    const pattern = chains(8);
    assert.equal(cursorOf(pattern, 'sc'), 1);
    assert.equal(cursorOf(pattern, 'hdc'), 2);
    assert.equal(cursorOf(pattern, 'dc'), 3);
    assert.equal(cursorOf(pattern, 'sc', {}), 2);
    assert.equal(contextOf(pattern, {}).oval, false);
  });

  test('a másik oldal célpontjai az első szem után jelennek meg, a legtávolabbi láncszem nélkül; a vég után oda ugrik a kurzor', () => {
    let pattern = chains(8);
    assert.equal(contextOf(pattern, mode).slots.length, 8);
    pattern = place(pattern);
    const context = contextOf(pattern, mode);
    const undersides = context.slots.filter((slot) => slot.kind === 'underside');
    assert.equal(undersides.length, 6);
    const base = graphOf(pattern).layers[0];
    assert.deepEqual(undersides.map((slot) => slot.id), base.positions.slice(1));
    while (contextOf(pattern, mode).frontier < 7) pattern = place(pattern);
    for (let k = 0; k < 3; k += 1) pattern = ok(workIntoSame(pattern, 'sc'));
    const at = contextOf(pattern, mode);
    assert.equal(at.slots[cursorOf(pattern)].kind, 'underside');
    assert.equal(at.slots[cursorOf(pattern)].id, base.positions[1]);
  });

  test('a vezetett kurzorral horgolt 1. kör hibátlan, és ugyanaz, mint a generált ovális 1. köre', () => {
    const manual = guided(8);
    assert.deepEqual(rules(manual), []);
    const generated = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    const round1 = (pattern) => textOf(pattern).split('\n').find((line) => line.startsWith('1. kör'));
    assert.equal(round1(manual).replace(' Folytasd spirálban.', ''), round1(generated));
    assert.deepEqual(manual.pieces[0].groups.map((group) => group.def), ['inc-4sc', 'inc-3sc']);
    for (const stitch of ['hdc', 'dc']) assert.deepEqual(rules(guided(9, stitch, 5, 4)), [], stitch);
  });

  test('a „Sor kitöltése” a legtávolabbi láncszem után a láncszemek másik oldalán folytatódik', () => {
    const filled = ok(fillRow(chains(8), { def: 'sc', count: 1 }, mode));
    const anchors = filled.pieces[0].stitches.flatMap((node) => node.anchors);
    assert.deepEqual(
      [anchors.filter((anchor) => anchor.into === 'stitch').length, anchors.filter((anchor) => anchor.into === 'underside').length],
      [7, 6],
    );
    assert.deepEqual(rules(ok(endRoundSpiral(filled))), []);
    // Mód nélkül sor marad: a másik oldalba nem horgol.
    const row = ok(fillRow(chains(8), { def: 'sc', count: 1 }));
    assert.ok(row.pieces[0].stitches.every((node) => node.anchors.every((anchor) => anchor.into !== 'underside')));
  });

  test('a másik oldal célpontja a rajzon a láncszem túloldalán áll, szemben az elöl belehorgolt szemmel', () => {
    let pattern = chains(8);
    for (let k = 0; k < 3; k += 1) pattern = place(pattern);
    const context = contextOf(pattern, mode);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const index = context.slots.findIndex((slot) => slot.kind === 'underside' && slot.id === graphOf(pattern).layers[0].positions[5]);
    const chain = layout.nodes.get(context.slots[index].id).top;
    const back = targetPoint(layout, context, index);
    const frontIndex = context.slots.findIndex((slot) => slot.kind === 'stitch' && slot.id === context.slots[index].id);
    const front = layout.nodes.get(pattern.pieces[0].stitches.find((node) => node.anchors[0]?.id === context.slots[frontIndex].id && node.anchors[0].into === 'stitch').id).top;
    assert.ok(Math.sign(back.y - chain.y) !== Math.sign(front.y - chain.y), `${back.y} / ${front.y} / ${chain.y}`);
  });

  test('másolás: az 1. kör egyedül érthető üzenettel nem másolható; a láncalappal együtt üres mintába beilleszthető, duplikálni nem', () => {
    const pattern = guided(8);
    const graph = graphOf(pattern);
    const [base, first] = graph.layers;
    const alone = copySelection(pattern, first.stitches);
    assert.equal(alone.ok, false);
    assert.match(alone.reason, /csak a láncalappal együtt másolható/);
    assert.match(duplicateSelection(pattern, first.stitches).reason, /csak a láncalappal együtt másolható/);

    const both = copySelection(pattern, [...base.stitches, ...first.stitches]);
    assert.ok(both.ok, both.reason);
    const pasted = ok(pasteFragment(emptyPattern(), both.fragment));
    assert.deepEqual(rules(pasted), []);
    assert.deepEqual(canonicalPattern(pasted).pieces[0].stitches, canonicalPattern(pattern).pieces[0].stitches);
    assert.match(duplicateSelection(pattern, [...base.stitches, ...first.stitches]).reason, /csak üres mintába/);
  });
});
