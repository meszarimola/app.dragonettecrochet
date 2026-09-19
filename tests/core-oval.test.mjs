/*
 * The oval foundation chain (PQW-890; 04 §3.4, §9.4): the other side of a chain
 * stitch as a target, the round schedule (round 1 is 2L + 2, then +6 per round
 * for single crochet), the generated graph and its validator, the written
 * pattern and reading it back, saving, the layout, and the oval as a part.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { addAmigurumiPart, createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { fabricThicknessCm, figureSize, roundGaugeOf, shapeSchedule } from '../src/core/amigurumi.ts';
import { canonicalPattern } from '../src/core/canonical.ts';
import { contextOf, defaultCursor, emptyPattern, endRoundSpiral, fillRow, liveCheck, work, workIntoSame } from '../src/core/editor.ts';
import { buildPieceGraph, computeLayers } from '../src/core/graph.ts';
import { targetPoint } from '../src/core/grid.ts';
import { copySelection, duplicateSelection, pasteFragment } from '../src/core/selection.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { AMIGURUMI_CORE_TEXTS } from '../src/ui/i18n/core/amigurumi.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** The gauge of 04 §4.4: DK cotton, 3.5 mm hook. */
const DK = { stitchesPerCm: 1.9, roundsPerCm: 2, source: 'measured', hookMm: 3.5 };

const part = (shape, extra = {}) => ({ name: '', shape, stagger: true, eyes: false, ...extra });
const oval = (lengthCm, widthCm) => ({ kind: 'oval', lengthCm, widthCm });

/** The core returns a code and data (PQW-904); the Hungarian sentence comes from the UI dictionary. */
const hu = (message) => renderCoreText(AMIGURUMI_CORE_TEXTS.hu, message);
const why = (result) => (result.ok ? '' : typeof result.reason === 'string' ? result.reason : hu(result.reason));

function ok(result) {
  assert.ok(result.ok, why(result));
  return result.pattern;
}

const rules = (pattern) => validatePattern(pattern, libraryFor(pattern)).map((finding) => finding.rule);
const graphOf = (pattern, index = 0) => buildPieceGraph(pattern, pattern.pieces[index], libraryFor(pattern));
const textOf = (pattern, locale = 'hu') => formatWrittenPattern(writePattern(pattern, libraryFor(pattern), locale));

describe('round schedule (04 §9.4)', () => {
  test('round 1 has 2L + 2 stitches over L chains, then +6 per round; chains come from the length, rounds from the width', () => {
    for (const [lengthCm, widthCm] of [
      [8, 5],
      [12, 4],
      [6, 6],
      [20, 10],
    ]) {
      const planned = shapeSchedule(oval(lengthCm, widthCm), DK);
      assert.ok(planned.ok, why(planned));
      const { counts, start, end, oval: plan } = planned.schedule;
      assert.equal(start, 'chain');
      assert.equal(end, 'open');
      assert.equal(plan.perEnd, 3);
      assert.equal(counts[0], 2 * plan.chains + 2, `${lengthCm} × ${widthCm}: round 1`);
      assert.ok(counts.slice(1).every((count, i) => count - counts[i] === 6), `${lengthCm} × ${widthCm}: +6 per round`);
      assert.equal(counts.length, Math.round((widthCm / 2) * DK.roundsPerCm));
      assert.ok(plan.chains >= 3);
    }
  });

  test('length must be the larger dimension, and an invalid size says why', () => {
    assert.equal(shapeSchedule(oval(4, 6), DK).reason.code, 'oval-length');
    assert.match(hu(shapeSchedule(oval(4, 6), DK).reason), /hossza legalább akkora/);
    // The field name and its article belong to the dictionary: the core keeps only the field id (PQW-904).
    assert.deepEqual(shapeSchedule(oval(Number.NaN, 4), DK).reason, { code: 'size-range', data: { field: 'length', max: 100 } });
    assert.match(hu(shapeSchedule(oval(Number.NaN, 4), DK).reason), /^A hossz /);
  });
});

describe('graph of the generated oval', () => {
  test('round 1 works into every chain on the front, 4 sc into the farthest chain, then back along the other side with 3 sc into the chain nearest the hook', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    assert.deepEqual(rules(pattern), []);
    const graph = graphOf(pattern);
    const [base, first] = graph.layers;
    const W = base.positions.length;
    assert.deepEqual(base.undersides, base.positions.slice(1));
    assert.equal(first.stitchCount, 2 * (W + 1) + 2);

    const anchors = first.stitches.flatMap((id) => graph.nodes.get(id).anchors);
    const into = (kind, id) => anchors.filter((anchor) => anchor.into === kind && anchor.id === id).length;
    // In yarn order the first chain is the one farthest from the hook.
    assert.equal(into('stitch', base.positions[0]), 4);
    assert.equal(into('underside', base.positions[0]), 0);
    assert.equal(into('stitch', base.positions[W - 1]), 1);
    assert.equal(into('underside', base.positions[W - 1]), 3);
    for (const id of base.positions.slice(1, -1)) assert.deepEqual([into('stitch', id), into('underside', id)], [1, 1], id);
    const groups = pattern.pieces[0].groups.filter((group) => group.members.every((id) => first.stitches.includes(id)));
    assert.deepEqual(groups.map((group) => group.def).sort(), ['inc-3sc', 'inc-4sc']);
  });

  test('round stitch counts follow the schedule; clean with and without stagger, with estimated and measured gauge, and for a long oval', () => {
    const dk = { ...emptyPattern(), gauge: undefined };
    for (const base of [emptyPattern(), dk]) {
      for (const shape of [oval(8, 5), oval(15, 12), oval(5, 1)]) {
        for (const stagger of [true, false]) {
          const result = createAmigurumi(base, part(shape, { stagger }), false);
          const pattern = ok(result);
          assert.deepEqual(rules(pattern), [], `${shape.lengthCm} × ${shape.widthCm}, stagger: ${stagger}`);
          assert.deepEqual(
            computeLayers(pattern, libraryFor(pattern)).slice(1).map((layer) => layer.stitchCount),
            result.schedule.counts,
          );
        }
      }
    }
  });
});

describe('written pattern and reading it back', () => {
  test('round 1 reads as a skip, the stitches into the front of the chain, then back along the other side', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    const hu = textOf(pattern);
    assert.ok(
      hu.includes('1. kör: hagyj ki 1 láncszemet, majd 6 rp, 4 rp a következő láncszembe, a láncszemek másik oldalán vissza: 5 rp, 3 rp a következő láncszembe (18).'),
      hu,
    );
    assert.match(hu, /1. sor – alapsor: 8 lsz\./);
    assert.match(textOf(pattern, 'en-US'), /Rnd 1: skip 1 ch, 6 sc, 4 sc in next ch, working back along the other side of the chain: 5 sc, 3 sc in next ch \(18\)\./);
    assert.match(textOf(pattern, 'en-GB'), /Rnd 1: miss 1 ch, 6 dc, 4 dc in next ch, working back along the other side of the chain: 5 dc, 3 dc in next ch \(18\)\./);
  });

  test('reading the text back gives the same graph in all three notations', () => {
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

  test('the other side of the chain is only meaningful in round 1 on a foundation chain', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    const text = textOf(pattern).replace('2. kör: ', '2. kör: a láncszemek másik oldalán vissza: ');
    const back = readPattern(text, { library: libraryFor(pattern), locale: 'hu', conventions: pattern.conventions });
    assert.equal(back.ok, false);
  });
});

describe('saving', () => {
  test('the chain underside and the oval shape survive a JSON round trip; an underside anchor with a loop mode is rejected', () => {
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

describe('the validator on round 1 of an oval', () => {
  /** A single-round oval: faults cannot leak into a following round. */
  const single = () => ok(createAmigurumi(emptyPattern(), part(oval(5, 1)), false));
  const withAnchor = (pattern, id, anchors) => ({
    ...pattern,
    pieces: [{ ...pattern.pieces[0], stitches: pattern.pieces[0].stitches.map((node) => (node.id === id ? { ...node, anchors } : node)) }],
  });

  test('a single-round oval validates clean', () => {
    const pattern = single();
    assert.equal(graphOf(pattern).layers.length, 2);
    assert.deepEqual(rules(pattern), []);
  });

  test('leaving out one chain on the other side reports an unused position', () => {
    const pattern = single();
    const graph = graphOf(pattern);
    const [base, first] = graph.layers;
    const back = first.stitches.find((id) => graph.nodes.get(id).anchors[0]?.into === 'underside' && !graph.groupOf.has(id));
    const target = graph.nodes.get(back).anchors[0].id;
    // The stitch moves into the next chain underside: that one then holds two without a marked
    // increase, and this one is left out.
    const next = base.positions[base.positions.indexOf(target) + 1];
    const broken = withAnchor(pattern, back, [{ into: 'underside', id: next }]);
    const found = new Set(rules(broken));
    assert.ok(found.has('unused-position'), [...found].join(', '));
    assert.deepEqual([...found].filter((rule) => rule !== 'unused-position' && rule !== 'unmarked-increase'), []);
  });

  test('an underside anchor aimed at an earlier round 1 stitch instead of a foundation chain points at the wrong layer', () => {
    const pattern = single();
    const graph = graphOf(pattern);
    const first = graph.layers[1];
    const front = first.stitches.find((id) => graph.nodes.get(id).anchors[0]?.into === 'stitch');
    const back = first.stitches.find((id) => graph.nodes.get(id).anchors[0]?.into === 'underside');
    const broken = withAnchor(pattern, back, [{ into: 'underside', id: front }]);
    assert.deepEqual([...new Set(rules(broken))], ['anchor-layer']);
  });

  test('swapping the targets of two stitches on the front works against the direction of travel', () => {
    const pattern = single();
    const graph = graphOf(pattern);
    const first = graph.layers[1];
    const fronts = first.stitches.filter((id) => graph.nodes.get(id).anchors[0]?.into === 'stitch' && !graph.groupOf.has(id));
    const [a, b] = fronts;
    const broken = withAnchor(withAnchor(pattern, a, graph.nodes.get(b).anchors), b, graph.nodes.get(a).anchors);
    assert.deepEqual([...new Set(rules(broken))], ['against-direction']);
  });
});

describe('layout and parts', () => {
  test('the layout draws the foundation chain straight, with the front and underside stitches of round 1 on opposite sides of it', () => {
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

  test('as a part: sewn to a sphere as a sole, and a wall continued from the edge of the oval', () => {
    const head = ok(createAmigurumi(emptyPattern(), part({ kind: 'sphere', diameterCm: 6, method: '6n' }, { name: 'Fej' }), false));
    const sewn = ok(addAmigurumiPart(head, part(oval(8, 5), { name: 'Talp' }), { method: 'sewn', distribute: true }, false));
    assert.deepEqual(rules(sewn), []);
    assert.equal(sewn.pieces.length, 2);

    const sole = ok(createAmigurumi(emptyPattern(), part(oval(8, 5), { name: 'Talp' }), false));
    const wall = { kind: 'cylinder', diameterCm: 5, heightCm: 3, bottom: 'open', top: 'open' };
    const joined = ok(addAmigurumiPart(sole, part(wall, { name: 'Fal' }), { method: 'continuous', distribute: true }, false));
    assert.deepEqual(rules(joined), []);
    assert.deepEqual(joined.pieces[0].sections.map((section) => section.name), ['Talp', 'Fal']);
    // A flat sole is not stuffed: no stuffing note follows the oval.
    assert.ok(!textOf(sole).includes('tömés'));
  });

  test('on its own the round and sphere checks stay quiet; the gauge comes from the profile', () => {
    assert.equal(roundGaugeOf(emptyPattern()).source, 'estimated');
  });
});

/* ---- PQW-899: half double and double crochet ovals, crocheting by hand, copying, figure height ---- */

const withTradition = (tradition) => ({ ...emptyPattern(), conventions: { ...emptyPattern().conventions, tradition } });

describe('half double and double crochet ovals (PQW-899)', () => {
  test('each end increases by half the flat-circle value: +8 per round for hdc, +12 for dc; the chain count includes the turning chain of the stitch', () => {
    const base = emptyPattern();
    for (const [stitch, perEnd, turningChain] of [
      ['sc', 3, 1],
      ['hdc', 4, 2],
      ['dc', 6, 3],
    ]) {
      const planned = shapeSchedule({ ...oval(12, 8), stitch }, roundGaugeOf(base, stitch));
      assert.ok(planned.ok, why(planned));
      const { counts, oval: plan } = planned.schedule;
      assert.deepEqual([plan.stitch, plan.perEnd, plan.turningChain], [stitch, perEnd, turningChain]);
      const W = plan.chains - turningChain;
      assert.equal(counts[0], 2 * W - 2 + 2 * perEnd, `${stitch}: round 1`);
      assert.ok(counts.slice(1).every((count, i) => count - counts[i] === 2 * perEnd), `${stitch}: +${2 * perEnd} per round`);
    }
    // The single crochet oval stays as PQW-890 defined it: 2L + 2.
    const sc = shapeSchedule(oval(8, 5), DK).schedule;
    assert.equal(sc.counts[0], 2 * sc.oval.chains + 2);
  });

  test('treble crochet oval (PQW-902): 8 increases per end over a 4-chain turning chain, and it validates clean', () => {
    const base = emptyPattern();
    const planned = shapeSchedule({ ...oval(16, 10), stitch: 'tr' }, roundGaugeOf(base, 'tr'));
    assert.ok(planned.ok, why(planned));
    const { counts, oval: plan } = planned.schedule;
    assert.deepEqual([plan.stitch, plan.perEnd, plan.turningChain], ['tr', 8, 4]);
    assert.ok(counts.slice(1).every((count, i) => count - counts[i] === 16), counts.join(','));
    const pattern = ok(createAmigurumi(base, part({ ...oval(16, 10), stitch: 'tr' }), false));
    assert.deepEqual(rules(pattern), []);
    assert.deepEqual(computeLayers(pattern, libraryFor(pattern)).slice(1).map((layer) => layer.stitchCount), counts);
    assert.match(textOf(pattern), /1\. kör: hagyj ki 4 láncszemet, majd \d+ krp, 9 krp a következő láncszembe, a láncszemek másik oldalán vissza: /);
  });

  test('the generated oval validates clean and its round counts follow the schedule, under CYC and Japanese tradition, with and without stagger', () => {
    for (const base of [emptyPattern(), withTradition('japanese')]) {
      for (const stitch of ['hdc', 'dc', 'tr']) {
        for (const stagger of [true, false]) {
          const result = createAmigurumi(base, part({ ...oval(12, 8), stitch }, { stagger }), false);
          const pattern = ok(result);
          const label = `${stitch}, ${base.conventions.tradition ?? 'cyc'}, stagger: ${stagger}`;
          assert.deepEqual(rules(pattern), [], label);
          assert.deepEqual(computeLayers(pattern, libraryFor(pattern)).slice(1).map((layer) => layer.stitchCount), result.schedule.counts, label);
        }
      }
    }
  });

  test('a counting turning chain (dc) is one of the stitches at the end nearest the hook; a non-counting one (hdc) is not', () => {
    const dc = ok(createAmigurumi(emptyPattern(), part({ ...oval(8, 5), stitch: 'dc' }), false));
    const hdc = ok(createAmigurumi(emptyPattern(), part({ ...oval(8, 5), stitch: 'hdc' }), false));
    const first = (pattern) => graphOf(pattern).layers[1];
    assert.deepEqual([first(dc).turningChain.length, first(dc).turningChainCounts], [3, true]);
    assert.deepEqual([first(hdc).turningChain.length, first(hdc).turningChainCounts], [2, false]);
    const groups = (pattern) => pattern.pieces[0].groups.map((group) => group.def).slice(0, 2);
    assert.deepEqual(groups(dc), ['inc-7dc', 'inc-5dc']);
    assert.deepEqual(groups(hdc), ['inc-5hdc', 'inc-4hdc']);
  });

  test('the written pattern skips the turning chain of the stitch, and reads back to the same graph in all three notations', () => {
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

  test('saving keeps the stitch, an older save without one loads as single crochet, and an unknown stitch is rejected', () => {
    const pattern = ok(createAmigurumi(emptyPattern(), part({ ...oval(8, 5), stitch: 'hdc' }), false));
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok);
    assert.deepEqual(loaded.pattern.pieces[0].sections[0].shape, { kind: 'oval', lengthCm: 8, widthCm: 5, stitch: 'hdc' });
    const old = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    assert.equal(JSON.parse(savePattern(old)).pieces[0].sections[0].shape.stitch, undefined);
    const raw = JSON.parse(savePattern(pattern));
    raw.pieces[0].sections[0].shape.stitch = 'dtr';
    assert.equal(loadPattern(JSON.stringify(raw)).ok, false);
  });

  test('figure height: a flat oval contributes the fabric thickness, not a round height', () => {
    const base = emptyPattern();
    for (const stitch of ['sc', 'dc']) {
      const gauge = roundGaugeOf(base, stitch);
      const sole = ok(createAmigurumi(base, part({ ...oval(8, 5), stitch }, { name: 'Talp' }), false));
      const size = figureSize(sole);
      // Thickness is two yarn diameters and the yarn diameter comes from the hook (02 §1.6); it does not depend on stitch height.
      const thickness = fabricThicknessCm(gauge.hookMm);
      assert.equal(size.parts[0].sections[0].schedule.heightCm, thickness, stitch);
      assert.equal(size.heightCm, thickness, stitch);
      assert.ok(size.widthCm >= 7 && size.widthCm <= 9, `${stitch}: length is the width`);
    }
    // Sewn on, the sphere sits on the sole: figure height is the sphere plus the sole thickness, less the cap that sinks in.
    const head = ok(createAmigurumi(base, part({ kind: 'sphere', diameterCm: 6, method: '6n' }, { name: 'Test' }), false));
    const figure = figureSize(ok(addAmigurumiPart(head, part(oval(8, 5), { name: 'Talp' }), { method: 'sewn', distribute: true }, false)));
    const alone = figureSize(head);
    assert.ok(figure.heightCm < alone.heightCm + 1, `${figure.heightCm} < ${alone.heightCm} + 1`);
  });
});

describe('crocheting into the other side of the chain by hand (PQW-899)', () => {
  const mode = { roundsOnChain: true };
  const chains = (count) => ok(work(emptyPattern(), { def: 'ch', count }, 0));
  const cursorOf = (pattern, stitch = 'sc', editorMode = mode) => defaultCursor(pattern, contextOf(pattern, editorMode), stitch);
  const place = (pattern, stitch = 'sc') => ok(work(pattern, { def: stitch, count: 1 }, cursorOf(pattern, stitch), [], mode));

  /** Round 1 with the guided cursor: along the front to the farthest chain, `far` stitches there, back along the other side, and `near` stitches at the end. */
  function guided(count, stitch = 'sc', far = 4, near = 3) {
    let pattern = chains(count);
    do pattern = place(pattern, stitch);
    while (contextOf(pattern, mode).frontier < count - 1);
    for (let k = 1; k < far; k += 1) pattern = ok(workIntoSame(pattern, stitch));
    while (cursorOf(pattern, stitch) < contextOf(pattern, mode).slots.length) pattern = place(pattern, stitch);
    for (let k = 1; k < near; k += 1) pattern = ok(workIntoSame(pattern, stitch));
    return ok(endRoundSpiral(pattern));
  }

  test('on a foundation chain in amigurumi mode the cursor lands on the chain after the turning chain; in row mode the row rule still applies', () => {
    const pattern = chains(8);
    assert.equal(cursorOf(pattern, 'sc'), 1);
    assert.equal(cursorOf(pattern, 'hdc'), 2);
    assert.equal(cursorOf(pattern, 'dc'), 3);
    assert.equal(cursorOf(pattern, 'sc', {}), 2);
    assert.equal(contextOf(pattern, {}).oval, false);
  });

  test('underside targets appear after the first stitch, without the farthest chain, and the cursor jumps there once the end is worked', () => {
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

  test('round 1 crocheted with the guided cursor validates clean and matches round 1 of the generated oval', () => {
    const manual = guided(8);
    assert.deepEqual(rules(manual), []);
    const generated = ok(createAmigurumi(emptyPattern(), part(oval(8, 5)), false));
    const round1 = (pattern) => textOf(pattern).split('\n').find((line) => line.startsWith('1. kör'));
    assert.equal(round1(manual).replace(' Folytasd spirálban.', ''), round1(generated));
    assert.deepEqual(manual.pieces[0].groups.map((group) => group.def), ['inc-4sc', 'inc-3sc']);
    for (const stitch of ['hdc', 'dc']) assert.deepEqual(rules(guided(9, stitch, 5, 4)), [], stitch);
  });

  test('the foundation-chain start is not flagged mid-crochet: the round goes into the chain after the turning chain', () => {
    let pattern = chains(8);
    for (let k = 0; k < 7; k += 1) pattern = place(pattern);
    for (let k = 0; k < 3; k += 1) pattern = ok(workIntoSame(pattern, 'sc'));
    // The graph still sees a row (nothing on the other side yet), so the validator would flag the foundation-chain start.
    assert.deepEqual(rules(pattern), ['foundation-chain']);
    const context = contextOf(pattern, mode);
    assert.deepEqual(liveCheck(pattern, context).findings, []);
    // The first underside stitch makes it a round and the foundation-chain finding clears itself;
    // the targets still left over are just the half-finished round reporting an unused position.
    const back = place(pattern);
    assert.deepEqual([...new Set(rules(back))], ['unused-position']);
    assert.deepEqual(liveCheck(back, contextOf(back, mode)).findings, []);
    // In row mode the finding stays: there the base chain of the turning chain has to be skipped too.
    assert.deepEqual(liveCheck(pattern, contextOf(pattern)).findings.map((finding) => finding.rule), ['foundation-chain']);
  });

  test('fill row continues along the other side of the chain once it passes the farthest chain', () => {
    const filled = ok(fillRow(chains(8), { def: 'sc', count: 1 }, mode));
    const anchors = filled.pieces[0].stitches.flatMap((node) => node.anchors);
    assert.deepEqual(
      [anchors.filter((anchor) => anchor.into === 'stitch').length, anchors.filter((anchor) => anchor.into === 'underside').length],
      [7, 6],
    );
    assert.deepEqual(rules(ok(endRoundSpiral(filled))), []);
    // Without that mode it stays a row: nothing is worked into the other side.
    const row = ok(fillRow(chains(8), { def: 'sc', count: 1 }));
    assert.ok(row.pieces[0].stitches.every((node) => node.anchors.every((anchor) => anchor.into !== 'underside')));
  });

  test('in the layout an underside target sits on the far side of the chain, opposite the stitch worked into its front', () => {
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

  test('copying: round 1 alone is refused with a reason; together with the foundation chain it pastes into an empty pattern but cannot be duplicated', () => {
    const pattern = guided(8);
    const graph = graphOf(pattern);
    const [base, first] = graph.layers;
    const alone = copySelection(pattern, first.stitches);
    assert.equal(alone.ok, false);
    // Selection reasons use their own code set (PQW-904, a different area): here the code is what matters.
    assert.equal(alone.reason.code, 'copy-oval-first-round');
    assert.equal(duplicateSelection(pattern, first.stitches).reason.code, 'copy-oval-first-round');

    const both = copySelection(pattern, [...base.stitches, ...first.stitches]);
    assert.ok(both.ok, both.reason);
    const pasted = ok(pasteFragment(emptyPattern(), both.fragment));
    assert.deepEqual(rules(pasted), []);
    assert.deepEqual(canonicalPattern(pasted).pieces[0].stitches, canonicalPattern(pattern).pieces[0].stitches);
    assert.equal(duplicateSelection(pattern, [...base.stitches, ...first.stitches]).reason.code, 'foundation-needs-empty');
  });
});
