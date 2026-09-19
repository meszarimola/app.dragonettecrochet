/*
 * Editor operations: the worked examples can be drawn by working into targets,
 * and validation finds nothing wrong with them (PQW-857).
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import {
  canEndRow,
  closeRound,
  contextOf,
  defaultCursor,
  deleteLast,
  emptyPattern,
  endRow,
  fillRow,
  insertChain,
  liveCheck,
  setPinned,
  work,
  workIntoGap,
  workIntoSame,
} from '../src/core/editor.ts';
import { buildPieceGraph, computeLayers } from '../src/core/graph.ts';
import { chartGrid } from '../src/core/grid.ts';
import { layoutPattern } from '../src/core/layout.ts';
import { loadPattern, savePattern } from '../src/core/pattern-json.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { rowCaptions } from '../src/ui/chart-labels.ts';
import { EDITOR_CORE_TEXTS } from '../src/ui/i18n/core/editor.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** The core returns a code and data (PQW-904); the Hungarian sentence comes from the interface dictionary. */
const huText = (reason) => renderCoreText(EDITOR_CORE_TEXTS.hu, reason);

function ok(result) {
  assert.ok(result.ok, result.ok ? '' : huText(result.reason));
  return result.pattern;
}

/** One stitch at the cursor's default place, or into the given target. */
function stitch(pattern, def, cursor) {
  const at = cursor ?? defaultCursor(pattern, contextOf(pattern), def);
  return ok(work(pattern, { def, count: 1 }, at));
}

const chains = (pattern, count) => ok(work(pattern, { def: 'ch', count }, 0));

test('a bare foundation chain can be turned (PQW-915)', () => {
  // The bug: the graph counted the unworked end of the foundation chain as
  // row 1's turning chain, so the turning chain was never 0 long and the Turn
  // button stayed disabled. The condition should rest on layer 1 being empty.
  const pattern = chains(emptyPattern(), 12);
  const context = contextOf(pattern);

  assert.equal(context.started, false, 'nothing has been worked into the foundation chain yet');
  assert.equal(canEndRow(context), true, 'turning must be possible after a bare foundation chain');

  // After the turn comes row 1 (PQW-891).
  const turned = ok(endRow(pattern));
  assert.equal(contextOf(turned).layer, 1);
});
const counts = (pattern) => computeLayers(pattern, libraryFor(pattern)).map((layer) => layer.stitchCount);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));

/**
 * A half double crochet rectangle `width` stitches wide: `width + 2` chains,
 * and since the turning chain is the row's first stitch, each row works
 * `width − 1` half doubles (PQW-891).
 */
function hdcRectangle(width, rows) {
  // A half double skips 2 chains, and every chain after that gets one stitch (PQW-924).
  let pattern = chains(emptyPattern(), width + 2);
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) pattern = ok(endRow(pattern));
    // The first stitch of a turned row becomes the turning chain (PQW-944), so we work one more time there.
    for (let i = 0; i < width + (row > 1 ? 1 : 0); i += 1) pattern = stitch(pattern, 'hdc');
  }
  return pattern;
}

describe('half double crochet rectangle using only default targets', () => {
  test('10 × 10: 10 stitches per row, clean', () => {
    const pattern = hdcRectangle(10, 10);
    assert.deepEqual(counts(pattern), [0, ...Array(10).fill(10)]);
    assert.deepEqual(findings(pattern), []);
  });

  test('the first stitch of row 1 goes into the chain after the skip: single and half double into the 3rd, double into the 4th (PQW-924)', () => {
    // Targets are numbered from 0 and chains from the hook from 1: the number of skipped chains is the index.
    const pattern = chains(emptyPattern(), 12);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'hdc'), 2);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'dc'), 3);
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 2);
  });

  test('turning lays down no chain; the first stitch brings the turning chain with it (PQW-944)', () => {
    const before = hdcRectangle(4, 1);
    const pattern = ok(endRow(before));
    const context = contextOf(pattern);
    assert.equal(pattern.pieces[0].stitches.length, before.pieces[0].stitches.length, 'turning lays down nothing');
    assert.equal(context.turningChain, 0);
    assert.equal(context.layer, 2);
    // We stand at the very start of the row: the first stitch's place gets a chain matching its height.
    assert.equal(defaultCursor(pattern, context, 'dc'), 0);
    for (const [tool, chains] of [
      ['sc', 1],
      ['hdc', 2],
      ['dc', 3],
    ]) {
      const first = ok(work(pattern, { def: tool, count: 1 }, 0));
      const layer = computeLayers(first, libraryFor(first))[2];
      assert.equal(layer.stitches.length, chains, `${tool}: ${chains} chains`);
      assert.ok(
        first.pieces[0].stitches.slice(-chains).every((node) => node.def === 'ch'),
        `${tool}: chains instead of the stitch`,
      );
      // The chain sits in the first stitch's place: the next stitch goes to the second target.
      assert.equal(defaultCursor(first, contextOf(first), tool), 1);
    }
  });

  test('no target follows the last one in the row: it does not work twice into the same place', () => {
    const pattern = hdcRectangle(4, 1);
    const context = contextOf(pattern);
    assert.equal(defaultCursor(pattern, context, 'hdc'), context.slots.length);
    const result = work(pattern, { def: 'hdc', count: 1 }, context.slots.length);
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'row-end-reached');
    assert.match(huText(result.reason), /sor végére értél/);
  });

  test('the cursor stays on the magic ring: every stitch of the round goes into it', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = stitch(chains(pattern, 1), 'sc');
    assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 0);
    pattern = stitch(pattern, 'sc');
    assert.deepEqual(counts(pattern), [0, 2]);
  });

  test('a half-finished row reports no findings, only how many targets remain', () => {
    const full = hdcRectangle(10, 2);
    let pattern = ok(endRow(full));
    // The first stitch becomes the turning chain (PQW-944), then three half doubles.
    for (let i = 0; i < 4; i += 1) pattern = stitch(pattern, 'hdc');
    assert.ok(findings(pattern).some((finding) => finding.rule === 'unused-position'));
    // 11 targets: the turning chain sits on the first, 3 stitches follow it, 7 are left.
    assert.deepEqual(liveCheck(pattern), { findings: [], remaining: 7 });
  });

  test('a stitch skipped at the start of a half-finished row does stay an error', () => {
    let pattern = ok(endRow(hdcRectangle(6, 1)));
    /*
     * The first stitch becomes the turning chain and stands at the start of
     * the row (PQW-944). If the crocheter then skips the start of the row —
     * because they change color and deliberately begin later, say — we report
     * it but do not fill it in.
     */
    pattern = stitch(pattern, 'hdc');
    pattern = stitch(pattern, 'hdc', 3);
    assert.deepEqual(
      liveCheck(pattern).findings.map((finding) => finding.rule),
      ['unused-position', 'unused-position'],
    );
  });
});

test('shell stitch 6 × 2 + 1: increasing with "one more into the same", clean (03 §4.2 E)', () => {
  // The turning chain counts as a stitch in no row here (PQW-924): there is no per-row override.
  const start = emptyPattern();
  let pattern = chains({ ...start, conventions: { ...start.conventions, turningChainCounts: false } }, 14);
  pattern = stitch(pattern, 'sc');
  for (const at of [4, 10]) {
    pattern = stitch(pattern, 'shell-5dc', at);
    pattern = stitch(pattern, 'sc', at + 3);
  }
  pattern = ok(endRow(pattern));
  /*
   * Here the turning chain is not a stitch (the pattern's own setting), so it
   * does not take a stitch's place (PQW-944): the crocheter lays the chain
   * down themselves, and the increase supplies all three doubles.
   */
  pattern = chains(pattern, 3);
  pattern = stitch(pattern, 'dc', 0);
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = stitch(pattern, 'sc', 3);
  pattern = stitch(pattern, 'shell-5dc', 6);
  pattern = stitch(pattern, 'sc', 9);
  pattern = stitch(pattern, 'dc', 12);
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = ok(workIntoSame(pattern, 'dc'));

  const piece = pattern.pieces[0];
  assert.deepEqual(
    piece.groups.map((group) => group.def),
    ['shell-5dc', 'shell-5dc', 'inc-3dc', 'shell-5dc', 'inc-3dc'],
  );
  assert.deepEqual(counts(pattern), [0, 13, 13]);
  assert.deepEqual(findings(pattern), []);
});

test('V stitch: its chain becomes a chain space that the next row works into (03 §4.2 F)', () => {
  // The knowledge-base example: a multiple of 3 + 2, with the turning chain not counting.
  const start = emptyPattern();
  let pattern = chains({ ...start, conventions: { ...start.conventions, turningChainCounts: false } }, 8);
  pattern = stitch(pattern, 'dc');
  pattern = stitch(pattern, 'v-st-dc', 5);
  pattern = stitch(pattern, 'dc', 7);
  assert.equal(pattern.pieces[0].spaces.length, 1);

  pattern = ok(endRow(pattern));
  // Here the turning chain is not a stitch (the pattern's own setting), so the crocheter lays it down themselves (PQW-944).
  pattern = chains(pattern, 3);
  const context = contextOf(pattern);
  assert.deepEqual(
    context.slots.map((slot) => slot.kind),
    ['stitch', 'stitch', 'space', 'stitch', 'stitch'],
  );
  pattern = stitch(pattern, 'dc');
  pattern = stitch(pattern, 'v-st-dc', 2);
  pattern = stitch(pattern, 'dc', 4);
  // Row 2 works into row 1's chain space, so it counts; row 2's own arch is decorative (PQW-870).
  assert.deepEqual(counts(pattern), [0, 5, 4]);
  assert.deepEqual(findings(pattern), []);
});

test('a decrease uses two neighbouring targets and the cursor advances by two', () => {
  let pattern = chains(emptyPattern(), 6);
  pattern = stitch(pattern, 'sc2tog');
  const node = pattern.pieces[0].stitches.at(-1);
  assert.equal(node.anchors.length, 2);
  assert.equal(defaultCursor(pattern, contextOf(pattern), 'sc'), 4);
  assert.equal(work(pattern, { def: 'sc3tog', count: 1 }, 4).ok, false);
});

test('round 1 of a granny square into a magic ring, closed with a slip stitch (03 §8)', () => {
  let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
  pattern = chains(pattern, 3);
  pattern = stitch(pattern, 'dc', 0);
  pattern = ok(workIntoSame(pattern, 'dc'));
  for (let side = 0; side < 3; side += 1) {
    pattern = ok(work(pattern, { def: 'ch-sp', count: 2 }, 0));
    for (let i = 0; i < 3; i += 1) pattern = stitch(pattern, 'dc', 0);
  }
  pattern = ok(work(pattern, { def: 'ch-sp', count: 2 }, 0));
  assert.equal(endRow(pattern).ok, false);
  pattern = ok(closeRound(pattern));

  assert.deepEqual(counts(pattern), [0, 12]);
  assert.deepEqual(findings(pattern), []);
  assert.equal(contextOf(pattern).shape, 'round');
});

describe('deleting the last step', () => {
  test('one step is one unit: the turn and its chain step by step, a group, a chain space, a closed round', () => {
    const row = hdcRectangle(3, 1);
    // The turn by itself lays down nothing (PQW-944): one step, one delete.
    const turned = ok(endRow(row));
    assert.deepEqual(ok(deleteLast(turned)), row);
    // The turning chain arrives with the first stitch: two chains for a half double, deleted one chain at a time.
    const started = stitch(turned, 'hdc');
    assert.equal(started.pieces[0].stitches.length, turned.pieces[0].stitches.length + 2);
    assert.deepEqual(ok(deleteLast(ok(deleteLast(started)))), turned);

    const shell = stitch(chains(emptyPattern(), 8), 'shell-5dc', 3);
    assert.deepEqual(ok(deleteLast(shell)), chains(emptyPattern(), 8));

    const base = stitch(chains(emptyPattern(), 4), 'sc');
    // A chain space also lands where the cursor points (PQW-935), so we add it at the working
    // edge: placed at the start of the row it would not be the last step — the single crochet
    // that ended up behind it would be.
    const space = ok(work(base, { def: 'ch-sp', count: 3 }, defaultCursor(base, contextOf(base), 'ch-sp')));
    assert.deepEqual(ok(deleteLast(space)), base);
  });

  test('closing a round is deleted together with its slip stitch', () => {
    let pattern = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    pattern = stitch(chains(pattern, 1), 'sc', 0);
    const open = ok(workIntoSame(pattern, 'sc'));
    assert.deepEqual(ok(deleteLast(ok(closeRound(open)))), open);
  });

  test('an empty pattern has nothing to delete', () => {
    assert.equal(deleteLast(emptyPattern()).ok, false);
  });
});

test('an invalid operation returns ok: false, a code from the core and a Hungarian sentence from the dictionary', () => {
  const empty = emptyPattern();
  for (const result of [
    work(empty, { def: 'sc', count: 1 }, 0),
    work(empty, { def: 'ch-sp', count: 3 }, 0),
    work(empty, { def: 'ch', count: 0 }, 0),
    work(chains(empty, 2), { def: 'magic-ring', count: 1 }, 0),
    work(chains(empty, 2), { def: 'nincs-ilyen', count: 1 }, 0),
    endRow(empty),
    // Two half doubles in two chains: a row, not a round worked into a single chain.
    closeRound(hdcRectangle(3, 1)),
    workIntoSame(chains(empty, 3), 'sc'),
  ]) {
    assert.equal(result.ok, false);
    // The core gives a code, never a Hungarian sentence; the dictionary has text for every code.
    assert.equal(typeof result.reason.code, 'string');
    assert.match(huText(result.reason), /\S/);
  }
});

test('a manual nudge survives saving, leaves the topology alone and can be cleared', () => {
  const pattern = hdcRectangle(3, 1);
  const id = pattern.pieces[0].stitches.at(-1).id;
  const pinned = ok(setPinned(pattern, id, { x: 4.04, y: -2 }));
  assert.deepEqual(pinned.pieces[0].stitches.at(-1).pinned, { x: 4, y: -2, rotation: 0 });
  assert.deepEqual(counts(pinned), counts(pattern));

  const loaded = loadPattern(savePattern(pinned));
  assert.deepEqual(loaded.pattern, pinned);
  assert.deepEqual(ok(setPinned(pinned, id, null)), pattern);
});

test('an empty pattern can be saved and loaded back', () => {
  const pattern = emptyPattern('Próba');
  assert.deepEqual(loadPattern(savePattern(pattern)).pattern, pattern);
});

describe('filling a row (PQW-879)', () => {
  test('on a foundation chain it fills every free target of the row, cleanly', () => {
    const base = chains(emptyPattern(), 12);
    const filled = ok(fillRow(base, { def: 'hdc', count: 1 }));
    // 12 chains, half doubles from the 4th chain on: 9 half doubles plus the turning chain, 10 stitches.
    assert.deepEqual(counts(filled), [0, 10]);
    assert.deepEqual(findings(filled), []);
  });

  test('after a turn it fills the next row too, cleanly', () => {
    let pattern = ok(fillRow(chains(emptyPattern(), 12), { def: 'hdc', count: 1 }));
    pattern = ok(endRow(pattern));
    pattern = ok(fillRow(pattern, { def: 'hdc', count: 1 }));
    assert.deepEqual(counts(pattern), [0, 10, 10]);
    assert.deepEqual(findings(pattern), []);
  });

  test('it gives the same result as working target by target', () => {
    const base = chains(emptyPattern(), 12);
    const filled = ok(fillRow(base, { def: 'hdc', count: 1 }));
    let byHand = base;
    // 12 chains, 2 skipped: 10 stitches fit in the row (PQW-924).
    for (let i = 0; i < 10; i += 1) byHand = stitch(byHand, 'hdc');
    assert.deepEqual(counts(filled), counts(byHand));
  });

  test('it finishes a half-done row using the free targets', () => {
    let pattern = chains(emptyPattern(), 12);
    pattern = stitch(pattern, 'hdc');
    pattern = stitch(pattern, 'hdc');
    pattern = ok(fillRow(pattern, { def: 'hdc', count: 1 }));
    assert.deepEqual(counts(pattern), [0, 10]);
    assert.deepEqual(findings(pattern), []);
  });

  test('it does not fill with chain stitches, and not in an empty row', () => {
    assert.equal(fillRow(chains(emptyPattern(), 12), { def: 'ch', count: 3 }).ok, false);
    // After a filled row no free target is left: it fills no further.
    const filled = ok(fillRow(chains(emptyPattern(), 12), { def: 'hdc', count: 1 }));
    assert.equal(fillRow(filled, { def: 'hdc', count: 1 }).ok, false);
  });
});

describe('starting a row on the foundation chain (PQW-891)', () => {
  /** In yarn order the chains are n1, n2, …: chain k counted from the hook is node number (total − k + 1). */
  const chainFromHook = (pattern, total, k) => pattern.pieces[0].stitches[total - k].id;
  const layerOf = (pattern, n) => computeLayers(pattern, libraryFor(pattern))[n];

  /** Two rows onto the foundation chain following the owner's rule, including the turn after the foundation chain. */
  function twoRows(def, turningChain, total) {
    let pattern = chains(emptyPattern(), total);
    const start = endRow(pattern);
    assert.ok(start.ok, start.ok ? '' : huText(start.reason));
    assert.equal(start.pattern, pattern, 'turning after the foundation chain leaves the pattern unchanged');
    assert.equal(canEndRow(contextOf(pattern)), true);
    // By the owner's table the skip is at least two (PQW-924).
    const skipped = Math.max(2, turningChain);
    assert.equal(
      defaultCursor(pattern, contextOf(pattern), def),
      skipped,
      `${def}: chain number ${skipped + 1} counted from the hook`,
    );

    pattern = ok(fillRow(pattern, { def, count: 1 }));
    const stitches = total - skipped;
    assert.equal(layerOf(pattern, 1).stitchCount, stitches);
    // Row 1's turning chain is the end of the foundation chain and has no node of its own: the first worked stitch comes right after the chains.
    const first = pattern.pieces[0].stitches[total];
    assert.equal(first.def, def);
    assert.deepEqual(
      first.anchors.map((anchor) => anchor.id),
      [chainFromHook(pattern, total, skipped + 1)],
    );
    assert.deepEqual(findings(pattern), []);

    pattern = ok(endRow(pattern));
    pattern = ok(fillRow(pattern, { def, count: 1 }));
    assert.equal(layerOf(pattern, 2).stitchCount, stitches);
    // The top of the turning chain is a target (PQW-944): row 2's last stitch goes there, into the foundation chain's last chain.
    assert.deepEqual(
      pattern.pieces[0].stitches.at(-1).anchors.map((anchor) => anchor.id),
      [pattern.pieces[0].stitches[total - 1].id],
    );
    assert.deepEqual(findings(pattern), []);
    return pattern;
  }

  test('scarf: 40 chains, a turn, 2 chains skipped, 39 single crochets from the 3rd chain; row 2 is 39 stitches too', () => {
    const pattern = twoRows('sc', 1, 40);
    // Row 1's first single crochet goes into the 3rd chain from the hook; row 2's last stitch into the top of row 1's turning chain.
    assert.equal(pattern.pieces[0].stitches[40].anchors[0].id, 'n38');
    assert.equal(pattern.pieces[0].stitches.at(-1).anchors[0].id, 'n40');
  });

  test('half double from the 3rd chain, double from the 4th: after the skip every chain gets one stitch (PQW-924)', () => {
    twoRows('hdc', 2, 20);
    twoRows('dc', 3, 20);
  });

  test('no turning without a stitch: neither in an empty pattern nor on a magic ring', () => {
    const empty = emptyPattern();
    assert.equal(canEndRow(contextOf(empty)), false);
    assert.equal(endRow(empty).ok, false);
    const ring = ok(work(empty, { def: 'magic-ring', count: 1 }, 0));
    assert.equal(canEndRow(contextOf(ring)), false);
    const result = endRow(ring);
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'row-empty');
    assert.match(huText(result.reason), /\S/);
  });
});

/*
 * Designing a pattern is not continuous work (PQW-933).
 *
 * The owner's words: "when someone is designing the pattern, there is no
 * continuity. they create the row in whatever way, whatever form and whatever
 * order they like", and "increase into the one I click on, even if that means
 * moving backwards — this is pattern making, not actual crocheting".
 *
 * So a stitch added afterwards takes its place in the order of the FABRIC,
 * next to its target. The yarn path (the `prev` chain and the array order)
 * follows that, because it also drives the chart columns, the written pattern
 * and validation.
 */
describe('a row can be made in any order (PQW-933)', () => {
  /** 12 chains, a turn, then doubles into the given targets. */
  const row = (slots) => {
    const turned = ok(endRow(chains(emptyPattern(), 12)));
    return slots.reduce((pattern, slot) => ok(work(pattern, { def: 'dc', count: 1 }, slot)), turned);
  };

  /** The layer's stitches in yarn order, each paired with its target. */
  const path = (pattern) =>
    pattern.pieces[0].stitches.filter((node) => node.anchors.length > 0).map((node) => [node.id, node.anchors[0].id]);

  test('a stitch put into a skipped place lands in the same spot on the yarn path as on the fabric', () => {
    // A double into targets 3 and 4, target 5 skipped, another double into 6.
    const gap = row([3, 4, 6]);
    assert.deepEqual(path(gap), [
      ['n13', 'n9'],
      ['n14', 'n8'],
      ['n15', 'n6'],
    ]);

    // Filling the gap: the stitch goes before the one worked into target 6, not at the end of the row.
    const filled = ok(work(gap, { def: 'dc', count: 1 }, 5));
    assert.deepEqual(path(filled), [
      ['n13', 'n9'],
      ['n14', 'n8'],
      ['n16', 'n7'],
      ['n15', 'n6'],
    ]);
    assert.equal(filled.pieces[0].stitches.find((node) => node.id === 'n15').prev, 'n16');

    // The fill-in is not a stitch against the direction of travel: validation has nothing to report on that count.
    assert.deepEqual(
      findings(filled).map((finding) => finding.rule),
      ['unused-position', 'unused-position', 'unused-position', 'unused-position', 'unused-position'],
    );
  });

  test('an increase goes into the stitch the crocheter clicked on', () => {
    const four = row([3, 4, 5, 6]);

    // Target 4 sits further back in the row: the increase used to land next to the last stitch instead.
    const increased = ok(workIntoSame(four, 'dc', 4));
    assert.deepEqual(path(increased), [
      ['n13', 'n9'],
      ['n14', 'n8'],
      ['n17', 'n8'],
      ['n15', 'n7'],
      ['n16', 'n6'],
    ]);
    assert.deepEqual(increased.pieces[0].groups, [{ id: 'g1', def: 'inc-2dc', members: ['n14', 'n17'] }]);

    // Afterwards it still increases into the right stitch at the end of the row, not into the most recently placed one.
    const both = ok(workIntoSame(increased, 'dc', 6));
    assert.deepEqual(both.pieces[0].groups.at(-1), { id: 'g2', def: 'inc-2dc', members: ['n16', 'n18'] });
    assert.deepEqual(
      findings(both).filter((finding) => finding.rule !== 'unused-position'),
      [],
    );
  });

  test('moving forwards, a stitch still lands at the end of the row as before', () => {
    const forward = row([3, 4, 5, 6]);
    assert.deepEqual(path(forward), [
      ['n13', 'n9'],
      ['n14', 'n8'],
      ['n15', 'n7'],
      ['n16', 'n6'],
    ]);
    assert.deepEqual(
      forward.pieces[0].stitches.map((node) => node.prev),
      [null, ...forward.pieces[0].stitches.slice(0, -1).map((node) => node.id)],
    );
  });
});

/*
 * Where a chain stitch belongs (PQW-935): it has no target, but it does have a
 * place.
 *
 * The owner reported that a chain always landed at the end of the row, no
 * matter where the cursor was: "I would have expected that if I click on the
 * second one… it puts the chain into that cell." A chain takes up as many
 * columns as there are chains, and bridges the stitches beneath them.
 */
describe('a chain stitch lands in the column it was pointed at (PQW-935)', () => {
  const row = () => {
    const turned = ok(endRow(chains(emptyPattern(), 22)));
    const first = defaultCursor(turned, contextOf(turned), 'dc');
    return ok(work(turned, { def: 'dc', count: 1 }, first));
  };

  /** Where the last chain sits in terms of targets: which target it bridges. */
  const bridged = (pattern) => pattern.pieces[0].skipped;

  test('it takes the free target under the cursor and bridges it', () => {
    const base = row();
    const context = contextOf(base);
    const far = context.frontier + 3;

    const placed = ok(work(base, { def: 'ch', count: 1 }, far));
    assert.deepEqual(bridged(placed), [context.slots[far].id], 'it bridges the target it was pointed at');

    // Point elsewhere and it lands elsewhere: before the fix the two were identical.
    const nearer = ok(work(base, { def: 'ch', count: 1 }, context.frontier + 1));
    assert.notDeepEqual(bridged(nearer), bridged(placed));
  });

  test('several chains take up several columns', () => {
    const base = row();
    const context = contextOf(base);
    const from = context.frontier + 2;
    const placed = ok(work(base, { def: 'ch', count: 3 }, from));
    assert.deepEqual(
      bridged(placed),
      [from, from + 1, from + 2].map((i) => context.slots[i].id),
    );
  });

  test('a place that does get a stitch later no longer counts as skipped', () => {
    const base = row();
    const context = contextOf(base);
    const at = context.frontier + 2;
    const withChain = ok(work(base, { def: 'ch', count: 1 }, at));
    assert.equal(bridged(withChain).length, 1);

    const worked = ok(work(withChain, { def: 'dc', count: 1 }, at));
    assert.deepEqual(bridged(worked), [], 'the stitch worked into it clears the skip');
  });

  test('reaching back behind the working edge, the chain bridges nothing', () => {
    const base = row();
    const context = contextOf(base);
    const back = ok(work(base, { def: 'ch', count: 1 }, context.frontier));
    assert.deepEqual(bridged(back), []);
  });
});

/*
 * Orphaned bridging marks inherited from earlier versions (PQW-939).
 *
 * A mark points at the STITCH below it, so deleting the chain above it used to
 * leave the mark behind. Old saved patterns carry these along, and the chart
 * handed an orphaned mark to the new chain: instead of the column the owner
 * pointed at, the chain landed right next to the stitch before it. In their
 * words: "it puts the last chain of row 2 right after the double crochet…
 * even though I skipped cells."
 *
 * So the pattern is cleaned on every edit, not only on delete.
 */
describe('the pattern is cleaned of orphaned bridging marks (PQW-939)', () => {
  const row = () => {
    let pattern = ok(endRow(chains(emptyPattern(), 22)));
    for (const def of ['sc', 'sc']) {
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, contextOf(pattern), def)));
    }
    const slot = defaultCursor(pattern, contextOf(pattern), 'dc');
    return { pattern: ok(work(pattern, { def: 'dc', count: 1 }, slot)), slot };
  };

  /** The same pattern, but with an orphaned mark on each of the given targets. */
  const withOrphans = (pattern, slots) => {
    const piece = pattern.pieces[0];
    const orphans = slots.map((i) => contextOf(pattern).slots[i].id);
    return { ...pattern, pieces: [{ ...piece, skipped: [...piece.skipped, ...orphans] }, ...pattern.pieces.slice(1)] };
  };

  test('a new chain takes the place it was pointed at, not the orphaned one', () => {
    const { pattern, slot } = row();
    const dirty = withOrphans(pattern, [slot + 1, slot + 2]);

    const placed = ok(work(dirty, { def: 'ch', count: 1 }, slot + 3));
    assert.deepEqual(
      placed.pieces[0].skipped,
      [contextOf(pattern).slots[slot + 3].id],
      'only the place it was pointed at remains',
    );
  });

  test('the cleanup leaves legitimate marks alone', () => {
    const { pattern, slot } = row();
    const withChain = ok(work(pattern, { def: 'ch', count: 2 }, slot + 1));
    assert.equal(withChain.pieces[0].skipped.length, 2, 'two chains take up two places');

    const again = ok(work(withChain, { def: 'ch', count: 1 }, slot + 4));
    assert.equal(again.pieces[0].skipped.length, 3, 'the earlier two remain, alongside the new one');
  });
});

/*
 * The stitch count of a row (PQW-940). The owner's row showed (13) even though
 * it holds 22 stitches: the program counted neither the turning chain nor the
 * chain stitches.
 *
 * The owner's rule (2026-09-18): the turning chain is the row's first stitch,
 * and chain stitches are stitches too. The STRUCTURAL count lives on
 * separately: the turning chain is not part of it, because the next row does
 * not work into it.
 */
describe('the written stitch count of a row includes the turning chain and the chain stitches (PQW-940)', () => {
  const put = (pattern, def, count = 1) =>
    ok(work(pattern, { def, count }, defaultCursor(pattern, contextOf(pattern), def)));
  const cluster = (pattern, def, count) => {
    const at = defaultCursor(pattern, contextOf(pattern), def);
    let next = ok(work(pattern, { def, count: 1 }, at));
    for (let i = 1; i < count; i += 1) next = ok(workIntoSame(next, def, at));
    return next;
  };

  /** The owner's row 2: 1 turning chain, 2 single crochets, 2 doubles, a 3-double cluster, 3 chains, a 3-double cluster, 3 chains, a 3-double cluster, 2 chains. */
  const ownersRow = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 22 }, 0));
    pattern = ok(endRow(pattern));
    pattern = put(pattern, 'sc');
    pattern = put(pattern, 'sc');
    pattern = put(pattern, 'dc');
    pattern = put(pattern, 'dc');
    pattern = cluster(pattern, 'dc', 3);
    pattern = put(pattern, 'ch', 3);
    pattern = cluster(pattern, 'dc', 3);
    pattern = put(pattern, 'ch', 3);
    pattern = cluster(pattern, 'dc', 3);
    return put(pattern, 'ch', 2);
  };

  test('the row from the owner is 22 stitches, not 13', () => {
    const [, row] = computeLayers(ownersRow(), libraryFor(ownersRow()));
    assert.equal(row.writtenCount, 22, 'the written stitch count');
    // The structural count covers the stitches that can be worked into: no turning chain, and a chain only when something works into it.
    assert.equal(row.stitchCount, 13);
  });

  test('the turning chain is the first stitch of the row: after two single crochets the written count is 3', () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 10 }, 0));
    pattern = ok(endRow(pattern));
    pattern = put(pattern, 'sc');
    pattern = put(pattern, 'sc');
    const [, row] = computeLayers(pattern, libraryFor(pattern));
    assert.equal(row.writtenCount, 3);
    assert.equal(row.stitchCount, 2);
  });

  test('a chain stitch is a stitch too, even with no row above it yet', () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 10 }, 0));
    pattern = ok(endRow(pattern));
    pattern = put(pattern, 'sc');
    const before = computeLayers(pattern, libraryFor(pattern))[1].writtenCount;
    const withChains = put(pattern, 'ch', 3);
    const after = computeLayers(withChains, libraryFor(withChains))[1].writtenCount;
    assert.equal(after - before, 3, 'the three chains raise the stitch count by three');
  });
});

/*
 * The stitch count of the foundation chain (PQW-942). The owner's report: "the
 * key/the bug is when two or more stitches become vertical."
 *
 * Row 1's turning chain is made from the foundation chain's OWN chains: those
 * leave the foundation chain and stack up into one vertical column. That
 * column belongs to the foundation chain too, because the foot of the turning
 * chain is there — so the foundation chain's stitch count is its remaining
 * chains plus one. The owner's example: "10 − 3 + 1 = 8".
 */
describe('the stitch count of the foundation chain includes the column of the turning chain (PQW-942)', () => {
  /** The layers of the foundation chain and the row worked onto it: `count` chains and one double into target `cursor`. */
  const rows = (chains, cursor) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: chains }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: 'dc', count: 1 }, cursor));
    const library = libraryFor(pattern);
    // `computeLayers` does not return the turning chain, so the full graph is needed.
    return { layers: buildPieceGraph(pattern, pattern.pieces[0], library).layers, pattern };
  };

  test('case 1: 10 chains, and after a 3-chain turning chain the foundation chain counts 8', () => {
    const { layers } = rows(10, 3);
    assert.equal(layers[1].turningChain.length, 3, 'three chains turn vertical');
    assert.equal(layers[0].positionCount, 7, 'seven chains remain in the foundation chain');
    assert.equal(layers[0].writtenCount, 8, '10 − 3 + 1');
  });

  test('case 2: with no turning chain the foundation chain reports its own length', () => {
    const { layers } = rows(12, 0);
    assert.equal(layers[1].turningChain.length, 0, 'the row begins in the very last chain');
    assert.equal(layers[0].writtenCount, 12);
  });

  test('case 3: 12 chains, and after a 2-chain turning chain the foundation chain counts 11', () => {
    const { layers } = rows(12, 2);
    assert.equal(layers[1].turningChain.length, 2);
    assert.equal(layers[0].writtenCount, 11, '12 − 2 + 1');
  });

  test('the turning chain stands in a single column, not spread out', () => {
    const { pattern } = rows(10, 3);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const [, row] = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern)).layers;
    const columns = new Set(row.turningChain.map((id) => layout.nodes.get(id).top.x));
    assert.equal(columns.size, 1, 'the three chains sit one above the other');
  });
});

/*
 * Turning, and where the turning chain goes (PQW-944).
 *
 * The owner: "the program opens a new row and drops a chain at the start of
 * it, floating like that. this is no good, take it out and let row 3's grid
 * show… the first stitch type the user picks will decide what goes into row
 * 3's first stitch."
 *
 * By their decision the chain stands IN THE PLACE of the first stitch, and the
 * row's last stitch goes into the top of the previous row's turning chain — so
 * the columns line up and the stitch count does not shrink.
 */
describe('the turning chain stands in the place of the first stitch (PQW-944)', () => {
  const rows = (count) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 12 }, 0));
    for (let row = 1; row <= count; row += 1) {
      if (row > 1) pattern = ok(endRow(pattern));
      pattern = ok(fillRow(pattern, { def: 'sc', count: 1 }));
    }
    return pattern;
  };

  test('after three rows the columns line up and every row has the same stitch count', () => {
    const pattern = rows(3);
    const library = libraryFor(pattern);
    const layout = layoutPattern(pattern, library);
    const layers = buildPieceGraph(pattern, pattern.pieces[0], library).layers;
    const span = (layer) => {
      const xs = layer.stitches.map((id) => layout.nodes.get(id).top.x);
      return [Math.min(...xs), Math.max(...xs)];
    };
    assert.deepEqual(span(layers[2]), span(layers[1]), 'row 3 occupies the same columns as row 2');
    assert.deepEqual(span(layers[3]), span(layers[1]));
    assert.deepEqual(
      layers.map((layer) => layer.writtenCount),
      [11, 11, 11, 11],
    );
    assert.deepEqual(findings(pattern), []);
  });

  test('the last stitch of a row goes into the top of the turning chain of the previous row, with no findings', () => {
    const pattern = rows(3);
    const library = libraryFor(pattern);
    const layers = buildPieceGraph(pattern, pattern.pieces[0], library).layers;
    const top = layers[1].turningChain.at(-1);
    const last = pattern.pieces[0].stitches.find((node) => node.anchors.some((anchor) => anchor.id === top));
    assert.ok(last, 'some stitch works into the top of the turning chain');
    assert.equal(layers[2].stitches.includes(last.id), true, 'and it belongs to row 3');
    assert.deepEqual(findings(pattern), []);
  });

  test('after a turn the grid band of the row in progress is full height, with no chain laid down', () => {
    const two = rows(2);
    const turned = ok(endRow(two));
    assert.equal(turned.pieces[0].stitches.length, two.pieces[0].stitches.length, 'turning lays down no chain');
    const grid = chartGrid(turned, libraryFor(turned), 'rows', contextOf(turned), {});
    const working = grid.bands.find((band) => band.working);
    assert.ok(working, 'the row in progress has a band');
    // Before the fix the chain that was laid down squashed this band down to 11 pixels.
    assert.ok(working.area.y1 - working.area.y0 >= 24, `full-height band: ${working.area.y1 - working.area.y0}`);
    assert.equal(grid.cells.filter((cell) => cell.layer === working.layer).length, 11, 'all 11 cells show up');
  });
});

/*
 * A freshly laid turning chain stands in its place (PQW-946).
 *
 * The owner's four points: the lowest chain slides down onto the row below;
 * the target dot stays on the chain's cell; row 3's caption only appears after
 * the second stitch; and the chain slides in front of the grid while no stitch
 * stands beside it — so its cell looks free even though a stitch is already
 * there.
 */
describe('the turning chain stands in its place as soon as it is laid down (PQW-946)', () => {
  /** 10 chains, row 2 filled with doubles, a turn, then the first stitch. */
  const afterTurn = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 10 }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(fillRow(pattern, { def: 'dc', count: 1 }));
    return ok(endRow(pattern));
  };
  const place = (pattern) =>
    ok(work(pattern, { def: 'dc', count: 1 }, defaultCursor(pattern, contextOf(pattern), 'dc')));

  test('the chain lands in its own cell right away, not in front of the grid', () => {
    const first = place(afterTurn());
    const library = libraryFor(first);
    const layout = layoutPattern(first, library);
    const grid = chartGrid(first, library, 'rows', contextOf(first), {});
    const chain = buildPieceGraph(first, first.pieces[0], library).layers[2].turningChain[0];
    const cell = grid.cells.filter((candidate) => candidate.layer === 2).find((candidate) => candidate.index === 0);
    const x = layout.nodes.get(chain).top.x;
    assert.ok(
      x > cell.area.x0 && x < cell.area.x1,
      `the chain sits in the row's first cell: ${x} ∉ (${cell.area.x0}, ${cell.area.x1})`,
    );
  });

  /*
   * It has to fit WITH ITS SYMBOL (PQW-947). The owner: "not as much as
   * before, but it still sticks out of row 3's cell" — the centre sat on the
   * baseline and the lower half of the symbol hung below it.
   */
  const fitsBand = (pattern, tool) => {
    const library = libraryFor(pattern);
    const layout = layoutPattern(pattern, library);
    const grid = chartGrid(pattern, library, 'rows', contextOf(pattern), {});
    const band = grid.bands.find((candidate) => candidate.layer === 2);
    for (const id of buildPieceGraph(pattern, pattern.pieces[0], library).layers[2].turningChain) {
      const node = layout.nodes.get(id);
      const bottom = node.top.y + node.size / 2;
      const top = node.top.y - node.size / 2;
      assert.ok(
        bottom <= band.area.y1,
        `${tool}: the bottom of ${id} at ${bottom.toFixed(1)} is past the band's bottom at ${band.area.y1.toFixed(1)}`,
      );
      assert.ok(
        top >= band.area.y0,
        `${tool}: the top of ${id} at ${top.toFixed(1)} is past the band's top at ${band.area.y0.toFixed(1)}`,
      );
    }
  };

  test('the chain with its symbol stays inside its own band, at all three stitch heights', () => {
    for (const tool of ['sc', 'hdc', 'dc']) {
      let pattern = ok(work(emptyPattern(), { def: 'ch', count: 11 }, 0));
      pattern = ok(endRow(pattern));
      pattern = ok(fillRow(pattern, { def: tool, count: 1 }));
      pattern = ok(endRow(pattern));
      pattern = ok(work(pattern, { def: tool, count: 1 }, defaultCursor(pattern, contextOf(pattern), tool)));
      pattern = ok(work(pattern, { def: tool, count: 1 }, defaultCursor(pattern, contextOf(pattern), tool)));
      fitsBand(pattern, tool);
    }
  });

  test('the cell of the chain is taken: no free target sits on it', () => {
    const first = place(afterTurn());
    const context = contextOf(first);
    assert.equal(context.used[0], true, 'the place of the turning chain is taken');
    assert.equal(defaultCursor(first, context, 'dc'), 1, 'the cursor stands on the second target');
  });

  test('the row caption shows from the turning chain onwards', () => {
    const first = place(afterTurn());
    const captions = rowCaptions(layoutPattern(first, libraryFor(first)), 'cyc').map((caption) => caption.text);
    assert.ok(captions.includes('3. sor (1)'), captions.join(' | '));
  });
});

/*
 * The turning chain's symbols do not cover each other (PQW-948).
 *
 * The owner: "now the whole thing is squashed together, like a sideways audi
 * logo… single crochet is fine, but anything more than one ring collapses into
 * itself." Measured: the symbols overlapped by 3.7 to 12.4 pixels.
 */
describe('the turning chain symbols stand apart (PQW-948)', () => {
  const rowWith = (tool) => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 11 }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(fillRow(pattern, { def: tool, count: 1 }));
    pattern = ok(endRow(pattern));
    pattern = ok(work(pattern, { def: tool, count: 1 }, defaultCursor(pattern, contextOf(pattern), tool)));
    return ok(work(pattern, { def: tool, count: 1 }, defaultCursor(pattern, contextOf(pattern), tool)));
  };

  for (const [tool, chains] of [
    ['hdc', 2],
    ['dc', 3],
    ['tr', 4],
  ]) {
    test(`${tool}: a gap is left between the ${chains} chains`, () => {
      const pattern = rowWith(tool);
      const library = libraryFor(pattern);
      const layout = layoutPattern(pattern, library);
      const stack = buildPieceGraph(pattern, pattern.pieces[0], library).layers[2].turningChain.map((id) =>
        layout.nodes.get(id),
      );
      assert.equal(stack.length, chains);
      stack.slice(1).forEach((node, i) => {
        const gap = stack[i].top.y - node.top.y - (stack[i].size + node.size) / 2;
        assert.ok(gap > 0, `${tool}: the gap between chain ${i + 1} and chain ${i + 2} is ${gap.toFixed(1)}`);
      });
    });
  }
});

/*
 * Inserting a chain into the foundation chain (PQW-941).
 *
 * The owner's request: "I only realise when I reach the end of the second row
 * that the base is not long enough, I need another chain – but the only way I
 * can change it is to undo all the way back to the base… from a usability
 * point of view that is dreadful." The row above does not move: an empty cell
 * is left above the insertion.
 */
describe('inserting a chain into the foundation chain (PQW-941)', () => {
  /** 8 chains, a turn, four single crochets: row 2 is half done. */
  const halfDone = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 8 }, 0));
    pattern = ok(endRow(pattern));
    for (let i = 0; i < 4; i += 1) pattern = stitch(pattern, 'sc');
    return pattern;
  };
  const base = (pattern) => buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern)).layers[0];
  /** The yarn path is intact: every stitch points at the one before it. */
  const yarnPath = (pattern) =>
    pattern.pieces[0].stitches.every(
      (node, i) => node.prev === (i === 0 ? null : pattern.pieces[0].stitches[i - 1].id),
    );

  test('between two chains: the foundation chain is one longer and the yarn path is intact', () => {
    const pattern = halfDone();
    const chains = base(pattern).stitches;
    const longer = ok(insertChain(pattern, { left: chains[1], right: chains[2] }));
    assert.equal(base(longer).stitches.length, chains.length + 1);
    assert.ok(yarnPath(longer), 'the yarn path is intact');
    assert.deepEqual(
      findings(longer).filter((finding) => finding.severity === 'error'),
      [],
    );
  });

  test('before the start of the chain: that is where the crocheter lengthens it when the base runs out', () => {
    const pattern = halfDone();
    const chains = base(pattern).stitches;
    const longer = ok(insertChain(pattern, { left: null, right: chains[0] }));
    assert.equal(base(longer).stitches.length, chains.length + 1);
    assert.ok(yarnPath(longer));
    assert.deepEqual(
      findings(longer).filter((finding) => finding.severity === 'error'),
      [],
    );
  });

  test('the stitches of row 2 stay where they are, and an empty cell is left above the insertion', () => {
    const pattern = halfDone();
    const chains = base(pattern).stitches;
    const before = pattern.pieces[0].stitches.filter((node) => node.def === 'sc');
    const longer = ok(insertChain(pattern, { left: chains[1], right: chains[2] }));
    const after = longer.pieces[0].stitches.filter((node) => node.def === 'sc');
    assert.deepEqual(
      after.map((node) => node.anchors),
      before.map((node) => node.anchors),
      'the stitches work into the same chains as before',
    );
    // Nothing works into the new chain: the cell above it is empty.
    const worked = new Set(after.flatMap((node) => node.anchors.map((anchor) => anchor.id)));
    const inserted = base(longer).stitches.find((id) => !base(pattern).stitches.includes(id));
    assert.ok(inserted && !worked.has(inserted), 'there is no stitch above the new chain');
  });

  test('it does not insert at the end of the turning chain, nor without a foundation chain', () => {
    const pattern = halfDone();
    const chains = base(pattern).stitches;
    assert.equal(insertChain(pattern, { left: chains.at(-1), right: null }).reason.code, 'insert-at-turning-chain');
    const ring = ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0));
    assert.equal(insertChain(ring, { left: null, right: null }).reason.code, 'insert-needs-chain-base');
  });
});

/*
 * A stitch into an empty cell of an earlier row (PQW-950).
 *
 * The owner, after using the insert: "if I want to go back into the second row
 * to put a stitch above the chain newly inserted into row 1, that I cannot do.
 * could we change this?"
 */
describe('a stitch into an empty cell of an earlier row (PQW-950)', () => {
  /** 14 chains, row 2 filled, row 3 half done, then an insert into the foundation chain. */
  const withGap = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 14 }, 0));
    pattern = ok(endRow(pattern));
    pattern = ok(fillRow(pattern, { def: 'dc', count: 1 }));
    pattern = ok(endRow(pattern));
    for (let i = 0; i < 3; i += 1) pattern = stitch(pattern, 'dc');
    const base = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern)).layers[0].stitches;
    return ok(insertChain(pattern, { left: base[4], right: base[5] }));
  };
  const freeUnder = (pattern, layer) => {
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    const worked = new Set(
      graph.layers[layer].stitches.flatMap((id) => graph.nodes.get(id).anchors.map((anchor) => anchor.id)),
    );
    return graph.layers[layer - 1].positions.find((id) => !worked.has(id));
  };

  test('a stitch can go above the inserted chain, and the rest of the row does not move', () => {
    const pattern = withGap();
    const gap = freeUnder(pattern, 1);
    assert.ok(gap, 'there is an empty place in the foundation chain');
    const before = pattern.pieces[0].stitches.filter((node) => node.def === 'dc');
    const filled = ok(workIntoGap(pattern, 1, gap, { def: 'dc', count: 1 }));
    const graph = buildPieceGraph(filled, filled.pieces[0], libraryFor(filled));
    assert.equal(
      graph.layers[1].stitches.length,
      buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern)).layers[1].stitches.length + 1,
    );
    assert.equal(freeUnder(filled, 1), undefined, 'no empty place is left');
    // The earlier stitches work into the same places, and the yarn path is intact.
    const after = new Map(filled.pieces[0].stitches.map((node) => [node.id, node]));
    for (const node of before) assert.deepEqual(after.get(node.id).anchors, node.anchors, node.id);
    assert.ok(
      filled.pieces[0].stitches.every(
        (node, i) => node.prev === (i === 0 ? null : filled.pieces[0].stitches[i - 1].id),
      ),
    );
    assert.deepEqual(
      findings(filled).filter((finding) => finding.severity === 'error'),
      [],
    );
  });

  test('it refuses a taken place, and refuses a stitch that is not a basic one', () => {
    const pattern = withGap();
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    const taken = graph.nodes.get(graph.layers[1].stitches.at(-1)).anchors[0].id;
    assert.equal(workIntoGap(pattern, 1, taken, { def: 'dc', count: 1 }).reason.code, 'gap-not-free');
    assert.equal(
      workIntoGap(pattern, 1, freeUnder(pattern, 1), { def: 'ch', count: 1 }).reason.code,
      'gap-needs-basic',
    );
  });
});
