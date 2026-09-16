/*
 * Körök és motívumok (PQW-861): a lapos körhöz kellő szaporítás, a
 * körgenerátor a tudásbázis táblázataival (04 §3.1, §3.2), sokszög és
 * nagymama-négyzet (04 §6, 03 §8), kezdés és körvég a gráfban, a
 * szerkesztőben, az írott mintában és a mentésben, és a sugárirányú elrendezés.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { canonicalPattern, canonicalPiece } from '../src/core/canonical.ts';
import {
  canCloseRound,
  canEndRound,
  closeRound,
  contextOf,
  defaultCursor,
  deleteLast,
  emptyPattern,
  endRoundSpiral,
  work,
  workIntoSame,
} from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { gaugeContextOf } from '../src/core/pattern-size.ts';
import { VOCABULARIES, formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { DEFAULT_MOTIF, circlePlan, generateMotif, polygonPlan } from '../src/core/round-generator.ts';
import { flatIncreases, niceIncreases } from '../src/core/rounds.ts';
import { libraryFor, resolveStitch } from '../src/core/stitch-variants.ts';
import { withTradition } from '../src/core/tradition.ts';
import { validatePattern } from '../src/core/validate.ts';
import { AMIGURUMI_CORE_TEXTS } from '../src/ui/i18n/core/amigurumi.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';
import { grannySquare } from './fixtures/examples.ts';

/** A mag kódot és adatot ad (PQW-904); a magyar mondat a felület szótárából jön. */
const hu = (message) => renderCoreText(AMIGURUMI_CORE_TEXTS.hu, message);
const why = (result) => (result.ok ? '' : typeof result.reason === 'string' ? result.reason : hu(result.reason));

const ok = (result) => {
  assert.ok(result.ok, why(result));
  return result.pattern;
};
const motif = (patch = {}, base = emptyPattern()) => ok(generateMotif(base, { ...DEFAULT_MOTIF, ...patch }));
const graphOf = (pattern) => buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
const lines = (pattern, locale) => writePattern(pattern, libraryFor(pattern), locale).pieces[0].lines;
const estimate = (id, corners) => flatIncreases(resolveStitch(id), gaugeContextOf(emptyPattern(), libraryFor(emptyPattern())), corners);
const japanese = () => ({ ...emptyPattern(), conventions: withTradition(emptyPattern().conventions, 'japanese') });

/** Minta profillal, amelyben a rövidpálca körben mérve adott szem és kör 10 cm-en. */
function withRoundGauge(pattern, stitchesPer10cm, rowsPer10cm) {
  const profile = {
    id: 'kor',
    yarn: { name: 'Pamut', cycWeight: 3, metersPer100g: null, ballMassG: null },
    hookMm: 4,
    blocked: false,
    gauges: [{ stitch: 'sc', form: 'rounds', stitchesPer10cm, rowsPer10cm, source: 'measured' }],
    swatch: { widthCm: null, heightCm: null, massG: null },
  };
  return { ...pattern, gauge: { active: 'kor', profiles: [profile] } };
}

describe('a lapos körhöz kellő szaporítás (04 §0, §1.2, §9.0)', () => {
  test('profil nélkül becslés a szokásos körös arányból: rp 6, fp 8, erp 12, krp 16', () => {
    assert.deepEqual(['sc', 'hdc', 'dc', 'tr'].map((id) => estimate(id).count), [6, 8, 12, 16]);
    const sc = estimate('sc');
    assert.equal(sc.source, 'estimated');
    assert.equal(sc.from, null);
    assert.ok(Math.abs(sc.exact - 2 * Math.PI) < 1e-9);
  });

  test('páros számra kerekítve, legalább 4', () => {
    assert.deepEqual([5.65, 6.28, 8.48, 8.8, 12.57, 15.71, 1.5].map(niceIncreases), [6, 6, 8, 8, 12, 16, 4]);
  });

  test('sokszögben a sokszög lapos értéke: négyzet 8, hatszög 6,93, nyolcszög 6,63 (04 §6.1)', () => {
    assert.ok(Math.abs(estimate('sc', 4).exact - 8) < 1e-9);
    assert.equal(estimate('sc', 6).exact.toFixed(2), '6.93');
    assert.equal(estimate('sc', 8).exact.toFixed(2), '6.63');
  });

  test('körben mért mintasűrűségből: a mért szemé közvetlenül, a többié a körös aránnyal átszámolva', () => {
    const pattern = withRoundGauge(emptyPattern(), 20, 18);
    const context = gaugeContextOf(pattern, libraryFor(pattern));
    const sc = flatIncreases(resolveStitch('sc'), context);
    assert.equal(sc.source, 'measured');
    assert.equal(sc.from, 'sc');
    assert.ok(Math.abs(sc.aspect - 20 / 18) < 1e-9);
    assert.equal(sc.count, 6);
    const dc = flatIncreases(resolveStitch('dc'), context);
    assert.equal(dc.from, 'sc');
    assert.ok(Math.abs(dc.aspect - (2 * 20) / 18) < 1e-9);
    assert.equal(dc.count, 14);
  });

  test('a mért arány a generátorba is átmegy: magasabb körnél több szaporítás', () => {
    const pattern = motif({ rounds: 2 }, withRoundGauge(emptyPattern(), 20, 14));
    assert.deepEqual(graphOf(pattern).layers.slice(1).map((layer) => layer.stitchCount), [8, 16]);
  });
});

describe('körgenerátor: a tudásbázis táblázatai (04 §3.1, §3.2)', () => {
  const BASE = [
    [1, '6 sc in MR', 6],
    [2, 'inc x6', 12],
    [3, '(sc, inc) x6', 18],
    [4, '(2 sc, inc) x6', 24],
    [5, '(3 sc, inc) x6', 30],
    [6, '(4 sc, inc) x6', 36],
    [7, '(5 sc, inc) x6', 42],
  ];
  const STAGGERED = [
    [1, '6 sc in MR', 6],
    [2, 'inc x6', 12],
    [3, '(inc, 1 sc) x6', 18],
    [4, '1 sc, (inc, 2 sc) x5, inc, 1 sc', 24],
    [5, '(inc, 3 sc) x6', 30],
    [6, '2 sc, (inc, 4 sc) x5, inc, 2 sc', 36],
    [7, '(inc, 5 sc) x6', 42],
    [8, '3 sc, (inc, 6 sc) x5, inc, 3 sc', 48],
  ];
  /** A táblázat sora a mi kiírásunkban: az amerikai szöveg az 1 szemet szám nélkül írja („sc”). */
  const expected = ([round, instruction, count]) => `Rnd ${round}: ${instruction.replace(/\b1 sc\b/g, 'sc')} (${count}).`;

  for (const [name, stagger, table] of [
    ['alap (04 §3.1)', false, BASE],
    ['eltolt szaporítás (04 §3.2)', true, STAGGERED],
  ]) {
    test(name, () => {
      const pattern = motif({ rounds: table.length, stagger, closing: 'spiral' });
      const rounds = lines(pattern, 'en-US')
        .filter((line) => line.startsWith('Rnd '))
        .map((line) => line.replace(/ Fasten off\.$/, ''));
      assert.equal(rounds[0], 'Rnd 1: ch 1 (does not count as a st), 6 sc in ring (6).');
      assert.deepEqual(rounds.slice(1), table.slice(1).map(expected));
    });
  }

  test('a jegy példája magyarul: „3. kör: (1 rp, szap.) ×6 (18)”', () => {
    assert.equal(lines(motif({ rounds: 3, stagger: false, closing: 'spiral' }), 'hu').at(-1), '3. kör: (1 rp, szap.) ×6 (18). A fonal elvágása.');
  });

  test('a terv a pozíciókra: eltolás nélkül (k − 2 szem, szap.), eltolva fél ismétléssel odébb', () => {
    assert.deepEqual(circlePlan(6, 4, false).rounds[2], [1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2]);
    assert.deepEqual(circlePlan(6, 4, true).rounds[2], [1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1, 1, 2, 1]);
  });

  test('zárt körben kezdőlánccal és kúszószemmel; a szemszám ugyanaz', () => {
    const pattern = motif({ rounds: 3, stagger: false });
    assert.equal(lines(pattern, 'hu')[3], '3. kör: 1 lsz (nem számít szemnek), (1 rp, szap.) ×6 (18). Kör zárása: 1 ksz az első szembe.');
    assert.equal(pattern.conventions.roundEnd, 'join-slip');
  });

  test('pálcás körben a 3 láncszemes kezdőlánc az első szem (szókészlet K1)', () => {
    const pattern = motif({ stitch: 'dc', rounds: 2 });
    assert.deepEqual(graphOf(pattern).layers.slice(1).map((layer) => layer.stitchCount), [12, 24]);
    assert.equal(
      lines(pattern, 'hu')[2],
      '2. kör: 3 lsz (1 erp-nek számít), 1 erp ugyanabba a láncszembe, szap. ×11 (24). Kör zárása: 1 ksz a kezdőlánc tetejébe.',
    );
  });

  test('a japán előbeállítással a félpálca kezdőlánca is számít, magyarul és angolul', () => {
    const pattern = motif({ stitch: 'hdc', rounds: 2 }, japanese());
    assert.equal(lines(pattern, 'hu')[1], '1. kör: 2 lsz (1 fp-nek számít), 7 fp a varázskörbe (8). Kör zárása: 1 ksz a kezdőlánc tetejébe.');
    assert.equal(lines(pattern, 'en-US')[2], 'Rnd 2: ch 2 (counts as 1 hdc), hdc in same ch, inc x7 (16). Join with sl st to top of beg ch.');
    assert.equal(
      lines(motif({ stitch: 'hdc', rounds: 1 }), 'hu')[1],
      '1. kör: 2 lsz (nem számít szemnek), 8 fp a varázskörbe (8). Kör zárása: 1 ksz az első szembe.',
    );
  });
});

describe('sokszög és nagymama-négyzet (04 §6, §9.5, 03 §8)', () => {
  test('négyzet rövidpálcával: körönként 8 szaporítás, sarkonként 3 rp egy szembe', () => {
    const pattern = motif({ shape: 'square', rounds: 4 });
    assert.deepEqual(graphOf(pattern).layers.slice(1).map((layer) => layer.stitchCount), [8, 16, 24, 32]);
    assert.equal(pattern.pieces[0].corners, 4);
    assert.equal(pattern.pieces[0].groups.length, 12);
    assert.ok(pattern.pieces[0].groups.every((group) => group.def === 'inc-3sc'));
  });

  test('a sarok új szeme a sarokcsoport közepe, így a sarkok egymás fölé kerülnek', () => {
    const pattern = motif({ shape: 'square', rounds: 4 });
    const piece = pattern.pieces[0];
    const graph = graphOf(pattern);
    const groupOf = new Map(piece.groups.flatMap((group) => group.members.map((id) => [id, group])));
    for (const group of piece.groups) {
      const target = graph.nodes.get(group.members[0]).anchors[0].id;
      if (graph.layerOf.get(group.members[0]) < 3) continue;
      assert.equal(groupOf.get(target)?.members[1], target, `${group.id}: az előző sarok középső szemébe`);
    }
  });

  test('hatszög és nyolcszög: a sokszög lapos értéke körönként, legfeljebb duplázással', () => {
    assert.deepEqual(graphOf(motif({ shape: 'hexagon', rounds: 5 })).layers.slice(1).map((layer) => layer.stitchCount), [6, 12, 21, 28, 35]);
    const octagon = polygonPlan(8, 2 * 8 * Math.tan(Math.PI / 8), 6);
    assert.deepEqual([octagon.first, ...octagon.rounds.map((into) => into.reduce((sum, n) => sum + n, 0))], [8, 13, 20, 27, 33, 40]);
  });

  test('nagymama-négyzet: három körrel pontosan a 03 §8 kidolgozott példája', () => {
    assert.deepEqual(canonicalPiece(motif({ shape: 'granny-square', rounds: 3 }).pieces[0]), canonicalPiece(grannySquare().pattern.pieces[0]));
  });

  test('nagymama-négyzet: a pozíciószám körönként 16-tal nő (16n + 4)', () => {
    const pattern = motif({ shape: 'granny-square', rounds: 5, start: 'chain-ring' });
    assert.deepEqual(graphOf(pattern).layers.slice(1).map((layer) => layer.positionCount), [20, 36, 52, 68, 84]);
  });

  test('a nagymama-négyzet láncszembe nem kezdhető, és nem horgolható spirálban', () => {
    assert.equal(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'granny-square', start: 'chain' }).ok, false);
    assert.equal(generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, shape: 'granny-square', closing: 'spiral' }).ok, false);
  });
});

describe('kezdés és körvég (04 §1.1, §2)', () => {
  test('láncgyűrű: a láncszemek a 0. kör, a gyűrűt záró kúszószem az 1. kör továbbvezetése', () => {
    const pattern = motif({ stitch: 'dc', rounds: 1, start: 'chain-ring' });
    const [ring, first] = graphOf(pattern).layers;
    assert.equal(ring.shape, 'round');
    assert.equal(ring.stitches.length, 4);
    assert.equal(first.travelSlips.length, 1);
    assert.equal(first.turningChain.length, 3);
    assert.equal(first.stitchCount, 12);
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
    assert.equal(lines(pattern, 'hu')[0], 'Láncgyűrű: 4 lsz, 1 ksz-szel gyűrűvé zárva.');
    assert.equal(lines(pattern, 'hu')[1], '1. kör: 3 lsz (1 erp-nek számít), 11 erp a gyűrűbe (12). Kör zárása: 1 ksz a kezdőlánc tetejébe.');
    assert.equal(lines(pattern, 'en-US')[0], 'Chain ring: ch 4, join with sl st to form a ring.');
  });

  test('„2 lsz, 6 rp a 2. láncszembe”: a második láncszem a kezdőlánc, a kör egyetlen láncszembe megy', () => {
    const pattern = motif({ rounds: 2, start: 'chain' });
    const [base, first] = graphOf(pattern).layers;
    assert.equal(base.stitches.length, 1);
    assert.equal(base.shape, 'round');
    assert.equal(first.turningChain.length, 1);
    assert.equal(first.stitchCount, 6);
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
    assert.deepEqual(lines(pattern, 'hu').slice(0, 2), [
      'Láncalap: 2 lsz.',
      '1. kör: hagyj ki 1 láncszemet, majd 6 rp a következő láncszembe (6). Kör zárása: 1 ksz az első szembe.',
    ]);
  });

  test('egy láncszembe legfeljebb 12 szem fér', () => {
    const result = generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, stitch: 'tr', start: 'chain' });
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'chain-start-limit');
    assert.match(hu(result.reason), /legfeljebb 12 szem/);
  });

  test('spirál: a 2. körtől nincs kezdőlánc és kúszószem, a körjelölő egyszer, a darab elején', () => {
    const pattern = motif({ rounds: 3, closing: 'spiral' });
    const piece = pattern.pieces[0];
    assert.deepEqual(piece.events.map((event) => event.kind), ['spiral', 'spiral', 'fasten-off']);
    assert.equal(piece.stitches.filter((node) => node.def === 'sl-st').length, 0);
    const text = lines(pattern, 'hu');
    assert.equal(text[1], VOCABULARIES.hu.spiral);
    assert.equal(text.filter((line) => line === VOCABULARIES.hu.spiral).length, 1);
    assert.equal(pattern.conventions.roundEnd, 'spiral');
  });

  test('színváltás és lépcsőjavítás a kör végén, az írott mintában', () => {
    const pattern = motif({ rounds: 4, closing: 'spiral', colorEvery: 2, jogFix: 'slip-stitch' });
    assert.deepEqual(
      pattern.pieces[0].events.map((event) => [event.colorChange ?? false, event.jogFix ?? null]),
      [[false, null], [true, 'slip-stitch'], [false, null], [false, null]],
    );
    assert.equal(
      lines(pattern, 'hu')[3],
      '2. kör: szap. ×6 (12). Színváltás: a következő kör új színnel. Lépcsőjavítás: a következő kör első szeme helyett 1 ksz.',
    );
  });

  test('a generált minták mindhárom jelöléssel visszaolvashatók', () => {
    const patterns = [
      motif({ rounds: 6 }),
      motif({ rounds: 4, stagger: false, closing: 'spiral', start: 'chain', colorEvery: 1, jogFix: 'back-loop' }),
      motif({ stitch: 'dc', rounds: 3, start: 'chain-ring' }),
      motif({ stitch: 'dc', rounds: 2, start: 'chain' }),
      motif({ shape: 'hexagon', rounds: 4 }),
      motif({ shape: 'granny-square', rounds: 4, start: 'chain-ring' }),
      motif({ stitch: 'hdc', rounds: 3 }, japanese()),
    ];
    for (const pattern of patterns) {
      const library = libraryFor(pattern);
      for (const locale of ['hu', 'en-US', 'en-GB']) {
        const text = formatWrittenPattern(writePattern(pattern, library, locale));
        const result = readPattern(text, { library, locale, conventions: pattern.conventions });
        assert.ok(result.ok, `${pattern.pieces[0].name}, ${locale}: ${JSON.stringify(result.error)}`);
        assert.deepEqual(canonicalPattern(result.pattern).pieces, canonicalPattern(pattern).pieces, `${pattern.pieces[0].name}, ${locale}`);
      }
    }
  });
});

describe('a szerkesztőben: K a láncszemekből láncgyűrűt zár, S spirálban folytat', () => {
  test('6 láncszem, K: láncgyűrű, egyetlen célpontja a gyűrű; 11 erp és zárás után hibátlan', () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 6 }, 0));
    assert.equal(canCloseRound(pattern), true);
    pattern = ok(closeRound(pattern));
    const piece = pattern.pieces[0];
    assert.deepEqual(piece.events, [{ after: piece.stitches[5].id, kind: 'join-slip' }]);
    assert.equal(piece.stitches.at(-1).def, 'sl-st');
    const context = contextOf(pattern);
    assert.equal(context.shape, 'round');
    assert.deepEqual(context.slots.map((slot) => slot.kind), ['space']);
    assert.equal(canEndRound(context), false);

    pattern = ok(work(pattern, { def: 'ch', count: 3 }, 0));
    for (let i = 0; i < 11; i += 1) pattern = ok(work(pattern, { def: 'dc', count: 1 }, 0));
    pattern = ok(closeRound(pattern));
    assert.equal(graphOf(pattern).layers[1].stitchCount, 12);
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
  });

  test('a láncgyűrű kúszószemének törlésével a gyűrű felbomlik, a láncszemek maradnak', () => {
    const pattern = ok(deleteLast(ok(closeRound(ok(work(emptyPattern(), { def: 'ch', count: 6 }, 0))))));
    assert.deepEqual(pattern.pieces[0].events, []);
    assert.deepEqual(pattern.pieces[0].spaces, []);
    assert.equal(pattern.pieces[0].stitches.length, 6);
  });

  test('két láncszemből nem lesz láncgyűrű', () => {
    const result = closeRound(ok(work(emptyPattern(), { def: 'ch', count: 2 }, 0)));
    assert.equal(result.ok, false);
    // A szerkesztő üzenetei a saját kódkészletükkel (PQW-904, másik terület): itt a kód számít.
    assert.equal(result.reason.code, 'ring-needs-chains');
  });

  test('2 lsz, 6 rp a 2. láncszembe, K: az 1. kör zárva, a darab körben halad', () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 2 }, 0));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'sc')));
    for (let i = 0; i < 5; i += 1) pattern = ok(workIntoSame(pattern, 'sc'));
    assert.equal(canEndRound(contextOf(pattern)), true);
    pattern = ok(closeRound(pattern));
    const [base, first] = graphOf(pattern).layers;
    assert.equal(base.shape, 'round');
    assert.equal(first.stitchCount, 6);
    assert.equal(contextOf(pattern).shape, 'round');
    assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), []);
  });

  test('S: a kör vége spirálban, a következő kör zárás nélkül indul', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = ok(work(pattern, { def: 'ch', count: 1 }, 0));
    for (let i = 0; i < 6; i += 1) pattern = ok(work(pattern, { def: 'sc', count: 1 }, 0));
    assert.equal(canEndRound(contextOf(pattern)), true);
    pattern = ok(endRoundSpiral(pattern));
    assert.equal(pattern.pieces[0].events.at(-1).kind, 'spiral');
    const context = contextOf(pattern);
    assert.equal(context.layer, 2);
    assert.equal(context.shape, 'round');
    assert.equal(canEndRound(context), false);
    assert.equal(endRoundSpiral(pattern).ok, false);
  });

  test('sorban nincs spirál', () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 5 }, 0));
    pattern = ok(work(pattern, { def: 'sc', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'sc')));
    const result = endRoundSpiral(pattern);
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'no-spiral-in-row');
  });
});

describe('mentés és betöltés', () => {
  test('a sarkok száma, a színváltás és a lépcsőjavítás megmarad', () => {
    const pattern = motif({ shape: 'square', rounds: 3, closing: 'spiral', colorEvery: 1, jogFix: 'back-loop' });
    const loaded = loadPattern(savePattern(pattern));
    assert.ok(loaded.ok, JSON.stringify(loaded.error));
    assert.deepEqual(loaded.pattern, pattern);
  });

  test('ismeretlen lépcsőjavítás és kettőnél kevesebb sarok: hiba a mező útvonalával', () => {
    const raw = JSON.parse(savePattern(motif({ rounds: 2, closing: 'spiral' })));
    raw.pieces[0].events[0].jogFix = 'csomó';
    assert.equal(loadPattern(JSON.stringify(raw)).error.path, '$.pieces[0].events[0].jogFix');
    delete raw.pieces[0].events[0].jogFix;
    raw.pieces[0].corners = 2;
    assert.equal(loadPattern(JSON.stringify(raw)).error.path, '$.pieces[0].corners');
  });
});

describe('sugárirányú elrendezés', () => {
  test('a jelek a középpontból kifelé mutatnak, az alapjuk az előző kör célpontszemén ül', () => {
    const pattern = motif({ rounds: 4 });
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const graph = graphOf(pattern);
    const radius = (p) => Math.hypot(p.x, p.y);
    let checked = 0;
    for (const node of layout.nodes.values()) {
      if (node.role !== 'stitch' || node.layer < 2) continue;
      const anchors = graph.nodes.get(node.id).anchors;
      node.feet.forEach((foot, i) => {
        const target = layout.nodes.get(anchors[i].id).top;
        assert.ok(Math.hypot(foot.x - target.x, foot.y - target.y) < 1e-6, `${node.id}: a talp a célpont tetején`);
      });
      assert.ok(radius(node.top) > Math.max(...node.feet.map(radius)), `${node.id}: kifelé mutat`);
      checked += 1;
    }
    assert.equal(checked, 12 + 18 + 24);
  });

  test('minden körnek van körszám- és szemszámhelye', () => {
    const pattern = motif({ rounds: 4 });
    const { layers } = layoutPattern(pattern, libraryFor(pattern));
    assert.deepEqual(layers.slice(1).map((layer) => [layer.index, layer.stitchCount]), [[1, 6], [2, 12], [3, 18], [4, 24]]);
    for (const layer of layers.slice(1)) assert.ok([layer.start.x, layer.start.y, layer.end.x, layer.end.y].every(Number.isFinite));
  });

  test('a láncgyűrű láncszemei egyenlő távolságra a középponttól', () => {
    const pattern = motif({ stitch: 'dc', rounds: 1, start: 'chain-ring' });
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const radii = [...layout.nodes.values()].filter((node) => node.layer === 0).map((node) => Math.hypot(node.top.x, node.top.y));
    assert.equal(radii.length, 4);
    for (const r of radii) assert.ok(r > 0 && Math.abs(r - radii[0]) < 1e-6);
  });
});
