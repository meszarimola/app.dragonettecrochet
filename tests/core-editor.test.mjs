/*
 * A szerkesztő műveletei: a kidolgozott példák célpontba horgolással
 * megrajzolhatók, és az ellenőrző hibátlannak látja őket (PQW-857).
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  closeRound,
  contextOf,
  defaultCursor,
  deleteLast,
  emptyPattern,
  endRow,
  liveCheck,
  setPinned,
  work,
  workIntoSame,
} from '../src/core/editor.ts';
import { computeLayers } from '../src/core/graph.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';

function ok(result) {
  assert.ok(result.ok, result.reason);
  return result.pattern;
}

/** Egy szem a kurzor alapértelmezett helyére, vagy a megadott célpontba. */
function stitch(pattern, def, cursor) {
  const at = cursor ?? defaultCursor(pattern, contextOf(pattern), def);
  return ok(work(pattern, { def, count: 1 }, at));
}

const chains = (pattern, count) => ok(work(pattern, { def: 'ch', count }, 0));
const counts = (pattern) => computeLayers(pattern, libraryFor(pattern)).map((layer) => layer.stitchCount);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));

function hdcRectangle(width, rows) {
  let pattern = chains(emptyPattern(), width + 2);
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) pattern = ok(endRow(pattern, 'hdc'));
    for (let i = 0; i < width; i += 1) pattern = stitch(pattern, 'hdc');
  }
  return pattern;
}

describe('félpálcás téglalap csak alapértelmezett célpontokkal', () => {
  test('10 × 10: soronként 10 szem, hibátlan', () => {
    const pattern = hdcRectangle(10, 10);
    assert.deepEqual(counts(pattern), [0, ...Array(10).fill(10)]);
    assert.deepEqual(findings(pattern), []);
  });

  test('az 1. sor első szeme a horogtól számított 3. láncszembe megy (03 §1.2)', () => {
    const pattern = chains(emptyPattern(), 12);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'hdc'), 2);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'dc'), 3);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 1);
  });

  test('a fordulás a kiválasztott szem fordulóláncát is megcsinálja (01 §8.3 szabály 12)', () => {
    const pattern = ok(endRow(hdcRectangle(4, 1), 'dc'));
    const context = contextOf(pattern);
    assert.equal(context.turningChain, 3);
    assert.equal(context.layer, 2);
    // A számító fordulólánc alatti szem kimarad (03 §1.3).
    assert.equal(defaultCursor(pattern, context, 'dc'), 1);
    assert.equal(defaultCursor(pattern, context, 'hdc'), 0);
  });

  test('a sor utolsó célpontja után nincs következő: nem horgol kétszer ugyanabba', () => {
    const pattern = hdcRectangle(4, 1);
    const context = contextOf(pattern);
    assert.equal(defaultCursor(pattern, context, 'hdc'), context.slots.length);
    const result = work(pattern, { def: 'hdc', count: 1 }, context.slots.length);
    assert.equal(result.ok, false);
    assert.match(result.reason, /sor végére értél/);
  });

  test('a varázskörbe a kurzor ott marad: a kör minden szeme belemegy', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = stitch(chains(pattern, 1), 'sc');
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 0);
    pattern = stitch(pattern, 'sc');
    assert.deepEqual(counts(pattern), [0, 2]);
  });

  test('félkész sorban nincs hiba, csak a hátralévő célpontok száma', () => {
    const full = hdcRectangle(10, 2);
    let pattern = ok(endRow(full, 'hdc'));
    for (let i = 0; i < 4; i += 1) pattern = stitch(pattern, 'hdc');
    assert.ok(findings(pattern).some((finding) => finding.rule === 'unused-position'));
    assert.deepEqual(liveCheck(pattern), { findings: [], remaining: 6 });
  });

  test('a félkész sor elején kihagyott szem viszont hiba marad', () => {
    let pattern = ok(endRow(hdcRectangle(6, 1), 'hdc'));
    pattern = stitch(pattern, 'hdc', 1);
    pattern = stitch(pattern, 'hdc');
    assert.deepEqual(
      liveCheck(pattern).findings.map((finding) => finding.rule),
      ['unused-position'],
    );
  });
});

test('kagyló 6 × 2 + 1: szaporítás „még egy ugyanabba”, hibátlan (03 §4.2 E)', () => {
  let pattern = chains(emptyPattern(), 14);
  pattern = stitch(pattern, 'sc');
  for (const at of [4, 10]) {
    pattern = stitch(pattern, 'shell-5dc', at);
    pattern = stitch(pattern, 'sc', at + 3);
  }
  pattern = ok(endRow(pattern, 'dc'));
  pattern = stitch(pattern, 'dc', 0);
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = stitch(pattern, 'sc', 3);
  pattern = stitch(pattern, 'shell-5dc', 6);
  pattern = stitch(pattern, 'sc', 9);
  pattern = stitch(pattern, 'dc', 12);
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = ok(workIntoSame(pattern, 'dc'));

  const piece = pattern.pieces[0];
  assert.deepEqual(piece.groups.map((group) => group.def), ['shell-5dc', 'shell-5dc', 'inc-2dc', 'shell-5dc', 'inc-3dc']);
  assert.deepEqual(counts(pattern), [0, 13, 13]);
  assert.deepEqual(findings(pattern), []);
});

test('V-szem: a láncszeméből láncív lesz, a következő sor abba horgol (03 §4.2 F)', () => {
  // A tudásbázis példája: 3 többszöröse + 2, a fordulólánc nem számít.
  const start = emptyPattern();
  let pattern = chains({ ...start, conventions: { ...start.conventions, turningChainCounts: false } }, 8);
  pattern = stitch(pattern, 'dc');
  pattern = stitch(pattern, 'v-st-dc', 5);
  pattern = stitch(pattern, 'dc', 7);
  assert.equal(pattern.pieces[0].spaces.length, 1);

  pattern = ok(endRow(pattern, 'dc'));
  const context = contextOf(pattern);
  assert.deepEqual(
    context.slots.map((slot) => slot.kind),
    ['stitch', 'stitch', 'space', 'stitch', 'stitch'],
  );
  pattern = stitch(pattern, 'dc');
  pattern = stitch(pattern, 'v-st-dc', 2);
  pattern = stitch(pattern, 'dc', 4);
  // Az 1. sor láncívébe a 2. sor horgol, ezért beleszámít; a 2. sor íve dísz (PQW-870).
  assert.deepEqual(counts(pattern), [0, 5, 4]);
  assert.deepEqual(findings(pattern), []);
});

test('fogyasztás két szomszédos célpontot használ, a kurzor kettőt lép', () => {
  let pattern = chains(emptyPattern(), 6);
  pattern = stitch(pattern, 'sc2tog');
  const node = pattern.pieces[0].stitches.at(-1);
  assert.equal(node.anchors.length, 2);
  assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 3);
  assert.equal(work(pattern, { def: 'sc3tog', count: 1 }, 4).ok, false);
});

test('nagymama-négyzet 1. köre varázskörbe, kúszószemes körzárással (03 §8)', () => {
  let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
  pattern = chains(pattern, 3);
  pattern = stitch(pattern, 'dc', 0);
  pattern = ok(workIntoSame(pattern, 'dc'));
  for (let side = 0; side < 3; side += 1) {
    pattern = ok(work(pattern, { def: 'ch-sp', count: 2 }, 0));
    for (let i = 0; i < 3; i += 1) pattern = stitch(pattern, 'dc', 0);
  }
  pattern = ok(work(pattern, { def: 'ch-sp', count: 2 }, 0));
  assert.equal(endRow(pattern, 'dc').ok, false);
  pattern = ok(closeRound(pattern));

  assert.deepEqual(counts(pattern), [0, 12]);
  assert.deepEqual(findings(pattern), []);
  assert.equal(contextOf(pattern).shape, 'round');
});

describe('az utolsó lépés törlése', () => {
  test('egy lépés egy egység: fordulás a fordulólánccal lépésenként, csoport, láncív, körzárás', () => {
    const row = hdcRectangle(3, 1);
    const turned = ok(endRow(row, 'hdc'));
    // Előbb a fordulólánc két láncszeme, aztán maga a fordulás.
    assert.deepEqual(ok(deleteLast(ok(deleteLast(ok(deleteLast(turned)))))), row);

    const shell = stitch(chains(emptyPattern(), 8), 'shell-5dc', 3);
    assert.deepEqual(ok(deleteLast(shell)), chains(emptyPattern(), 8));

    const base = stitch(chains(emptyPattern(), 4), 'sc');
    const space = ok(work(base, { def: 'ch-sp', count: 3 }, 0));
    assert.deepEqual(ok(deleteLast(space)), base);
  });

  test('a körzárás a kúszószemmel együtt törlődik', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = stitch(chains(pattern, 1), 'sc', 0);
    const open = ok(workIntoSame(pattern, 'sc'));
    assert.deepEqual(ok(deleteLast(ok(closeRound(open)))), open);
  });

  test('üres mintában nincs mit törölni', () => {
    assert.equal(deleteLast(emptyPattern()).ok, false);
  });
});

test('hibás műveletre ok: false és magyar indoklás', () => {
  const empty = emptyPattern();
  for (const result of [
    work(empty, { def: 'sc', count: 1 }, 0),
    work(empty, { def: 'ch-sp', count: 3 }, 0),
    work(empty, { def: 'ch', count: 0 }, 0),
    work(chains(empty, 2), { def: 'magic-ring', count: 1 }, 0),
    work(chains(empty, 2), { def: 'nincs-ilyen', count: 1 }, 0),
    endRow(empty, 'sc'),
    closeRound(hdcRectangle(2, 1)),
    workIntoSame(chains(empty, 3), 'sc'),
  ]) {
    assert.equal(result.ok, false);
    assert.match(result.reason, /\S/);
  }
});

test('kézi igazítás: a mentésben megmarad, a topológián nem változtat, törölhető', () => {
  const pattern = hdcRectangle(3, 1);
  const id = pattern.pieces[0].stitches.at(-1).id;
  const pinned = ok(setPinned(pattern, id, { x: 4.04, y: -2 }));
  assert.deepEqual(pinned.pieces[0].stitches.at(-1).pinned, { x: 4, y: -2, rotation: 0 });
  assert.deepEqual(counts(pinned), counts(pattern));

  const loaded = loadPattern(savePattern(pinned));
  assert.deepEqual(loaded.pattern, pinned);
  assert.deepEqual(ok(setPinned(pinned, id, null)), pattern);
});

test('az üres minta menthető és visszatölthető', () => {
  const pattern = emptyPattern('Próba');
  assert.deepEqual(loadPattern(savePattern(pattern)).pattern, pattern);
});
