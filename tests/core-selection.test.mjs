/*
 * Selection, deletion, copying, pasting and duplicating on the graph (PQW-875):
 * a stitch goes together with everything worked into it or not at all, pasting
 * re-anchors, and on a failure the pattern is left untouched.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { contextOf, defaultCursor, emptyPattern, endRow, work, workIntoSame } from '../src/core/editor.ts';
import { computeLayers } from '../src/core/graph.ts';
import { createHistory, record, undo } from '../src/core/history.ts';
import { layoutPattern } from '../src/core/layout.ts';
import {
  copySelection,
  deleteStitches,
  deletionPlan,
  describeByLayer,
  duplicateSelection,
  expandSelection,
  layerSelection,
  nodesInRect,
  pasteFragment,
  rangeSelection,
  selectAll,
  stepFocus,
  toggleUnit,
} from '../src/core/selection.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { EDITOR_CORE_TEXTS } from '../src/ui/i18n/core/editor.ts';
import { renderCoreText } from '../src/ui/i18n/core/render.ts';

/** The core returns a code and data (PQW-904); the Hungarian sentence comes from the UI dictionary. */
const huText = (reason) => renderCoreText(EDITOR_CORE_TEXTS.hu, reason);

function ok(result) {
  assert.ok(result.ok, result.ok ? '' : huText(result.reason));
  return result.pattern;
}

function copied(result) {
  assert.ok(result.ok, result.ok ? '' : huText(result.reason));
  return result.fragment;
}

function stitch(pattern, def, cursor) {
  const at = cursor ?? defaultCursor(pattern, contextOf(pattern), def);
  return ok(work(pattern, { def, count: 1 }, at));
}

const chains = (pattern, count) => ok(work(pattern, { def: 'ch', count }, 0));
const counts = (pattern) => computeLayers(pattern, libraryFor(pattern)).map((layer) => layer.stitchCount);
const findings = (pattern) => validatePattern(pattern, libraryFor(pattern));
const structural = (pattern) =>
  findings(pattern).filter((finding) => ['unknown-stitch', 'dangling-reference', 'yarn-path', 'group-mismatch'].includes(finding.rule));
const nodes = (pattern) => pattern.pieces[0].stitches;
const byId = (pattern, id) => nodes(pattern).find((node) => node.id === id);

/**
 * A half double crochet rectangle of `width` stitches per row (PQW-891):
 * `width` + 2 chains, and the turning chain counts as the first stitch, so each
 * row works `width` − 1 stitches.
 */
function hdcRectangle(width, rows) {
  // For hdc we skip 2 chains and one stitch goes into every chain (PQW-924).
  let pattern = chains(emptyPattern(), width + 2);
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) pattern = ok(endRow(pattern));
    // After a turn the first stitch of the row is the turning chain (PQW-944), so we work one more time there.
    for (let i = 0; i < width + (row > 1 ? 1 : 0); i += 1) pattern = stitch(pattern, 'hdc');
  }
  return pattern;
}

/**
 * A 14-chain foundation under the rule of the shell pattern source (03 §4.2 E):
 * the single crochet turning chain is only a turning chain, and the first sc of
 * row 1 goes into the 2nd chain (as in the `shellStitch` example, PQW-891).
 */
function shellFoundation() {
  const pattern = chains(emptyPattern(), 14);
  return { ...pattern, conventions: { ...pattern.conventions, turningChainCounts: false } };
}

/** The opening event of layer 2: here the dc turning chain does count as a stitch (a per-row override). */
function turnCounting(pattern) {
  const [piece] = pattern.pieces;
  const events = piece.events.map((event, i) => (i === piece.events.length - 1 ? { ...event, conventions: { turningChainCounts: true } } : event));
  return { ...pattern, pieces: [{ ...piece, events }, ...pattern.pieces.slice(1)] };
}

/** Two rows of the shell pattern, the way the owner draws them (03 §4.2 E). */
function shellRows() {
  let pattern = shellFoundation();
  pattern = stitch(pattern, 'sc');
  for (const at of [4, 10]) {
    pattern = stitch(pattern, 'shell-5dc', at);
    pattern = stitch(pattern, 'sc', at + 3);
  }
  pattern = ok(endRow(pattern));
  // Here the turning chain is not a stitch (the pattern says so), so the crocheter places it by hand (PQW-944).
  pattern = chains(pattern, 3);
  pattern = stitch(pattern, 'dc', 0);
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = stitch(pattern, 'sc', 3);
  pattern = stitch(pattern, 'shell-5dc', 6);
  pattern = stitch(pattern, 'sc', 9);
  pattern = stitch(pattern, 'dc', 12);
  pattern = ok(workIntoSame(pattern, 'dc'));
  return ok(workIntoSame(pattern, 'dc'));
}

/** The stitches of a layer, without its turning chain. */
function body(pattern, layer) {
  return layerSelection(pattern, layer).filter((id) => byId(pattern, id).def !== 'ch');
}

describe('selection', () => {
  test('clicking one stitch of a shell selects the whole shell, in yarn order', () => {
    const pattern = shellRows();
    const shell = pattern.pieces[0].groups[0];
    assert.deepEqual(expandSelection(pattern, [shell.members[2]]), shell.members);
    assert.deepEqual(expandSelection(pattern, ['nincs-ilyen']), []);
  });

  test('shift-click adds the unit, and clicking it again takes it away', () => {
    const pattern = shellRows();
    const [sc] = body(pattern, 1);
    const shell = pattern.pieces[0].groups[0];
    const both = toggleUnit(pattern, [sc], shell.members[0]);
    assert.deepEqual(both, [sc, ...shell.members]);
    assert.deepEqual(toggleUnit(pattern, both, shell.members[4]), [sc]);
  });

  test('a row number selects the whole row including its turning chain, and Ctrl+A selects every stitch', () => {
    const pattern = hdcRectangle(3, 2);
    const row2 = layerSelection(pattern, 2);
    assert.equal(row2.length, 5, 'the 3-stitch row: a 2-chain turning chain (not a stitch) plus 3 hdc');
    assert.deepEqual(row2.slice(0, 2).map((id) => byId(pattern, id).def), ['ch', 'ch']);
    assert.equal(selectAll(pattern).length, nodes(pattern).length);
    assert.deepEqual(layerSelection(pattern, 9), []);
  });

  test('a rectangle selects the stitches whose top falls inside it', () => {
    const pattern = hdcRectangle(4, 2);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const { minX, minY, maxX, maxY } = layout.bounds;
    assert.deepEqual(nodesInRect(pattern, layout, { x: maxX + 50, y: maxY + 50 }, { x: minX - 50, y: minY - 50 }), selectAll(pattern));

    const tops = body(pattern, 2).map((id) => layout.nodes.get(id).top);
    const box = [
      { x: Math.min(...tops.map((p) => p.x)) - 1, y: Math.min(...tops.map((p) => p.y)) - 1 },
      { x: Math.max(...tops.map((p) => p.x)) + 1, y: Math.max(...tops.map((p) => p.y)) + 1 },
    ];
    const inside = nodesInRect(pattern, layout, ...box);
    for (const id of body(pattern, 2)) assert.ok(inside.includes(id));
    assert.ok(inside.every((id) => layout.nodes.get(id).layer === 2));
  });

  test('from the keyboard: sideways within the row, into the neighbouring row, to the start and the end of the row, and a range', () => {
    const pattern = hdcRectangle(4, 2);
    const layout = layoutPattern(pattern, libraryFor(pattern));
    const last = nodes(pattern).at(-1).id;
    assert.equal(stepFocus(pattern, layout, null, 'left'), last);

    const row1 = body(pattern, 1);
    const start = row1[1];
    const side = stepFocus(pattern, layout, start, 'right');
    assert.notEqual(side, start);
    assert.equal(layout.nodes.get(side).layer, 1);
    assert.equal(layout.nodes.get(stepFocus(pattern, layout, start, 'up')).layer, 2);
    const chain = stepFocus(pattern, layout, start, 'down');
    assert.equal(layout.nodes.get(chain).layer, 0);
    assert.equal(stepFocus(pattern, layout, chain, 'down'), chain, 'there is no row below the foundation chain, so focus stays put');

    const row2 = layerSelection(pattern, 2);
    assert.equal(stepFocus(pattern, layout, last, 'first'), row2[0]);
    assert.equal(stepFocus(pattern, layout, row2[0], 'last'), last);
    assert.deepEqual(rangeSelection(pattern, last, row2[0]), row2);
  });
});

describe('deletion', () => {
  test('a stitch in the middle goes together with everything worked into it, and the graph stays intact', () => {
    const pattern = hdcRectangle(5, 3);
    const middle = body(pattern, 1)[2];
    const plan = deletionPlan(pattern, [middle]);
    assert.deepEqual(plan.selected, [middle]);
    assert.equal(plan.dependents.length, 2);
    // The breakdown is data, not a sentence (PQW-904): the UI turns it into prose.
    assert.deepEqual(describeByLayer(pattern, plan.dependents), [
      { layer: 2, shape: 'row', count: 1 },
      { layer: 3, shape: 'row', count: 1 },
    ]);

    const deleted = ok(deleteStitches(pattern, [middle], { withDependents: true }));
    assert.equal(nodes(deleted).length, nodes(pattern).length - 3);
    assert.deepEqual(counts(deleted), [0, 4, 4, 4]);
    assert.deepEqual(structural(deleted), []);
    // The validator runs again: the gap left behind makes a neighbouring stitch reach across one stitch.
    assert.deepEqual(findings(deleted).map((finding) => finding.rule), ['reach-single']);
  });

  test('without the with-dependents flag the deletion aborts, the pattern is unchanged, and the error names what would be affected', () => {
    const pattern = hdcRectangle(5, 3);
    const before = structuredClone(pattern);
    const result = deleteStitches(pattern, [body(pattern, 1)[2]]);
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'has-dependents');
    assert.match(huText(result.reason), /még 2 szem horgol \(3\. sor: 1 szem, 4\. sor: 1 szem\)/);
    assert.deepEqual(pattern, before);
  });

  test('with nothing worked into it the stitch goes right away, and the end of the row moves to the previous stitch', () => {
    const pattern = ok(endRow(hdcRectangle(3, 2)));
    const lastOfRow2 = body(pattern, 2).at(-1);
    assert.deepEqual(deletionPlan(pattern, [lastOfRow2]).dependents, []);
    const deleted = ok(deleteStitches(pattern, [lastOfRow2]));
    assert.deepEqual(deleted.pieces[0].events.map((event) => event.after), [body(pattern, 1).at(-1), body(pattern, 2).at(-2)]);
    assert.deepEqual(counts(deleted), [0, 3, 2]);
    assert.deepEqual(structural(deleted), []);
  });

  test('the whole last row is deleted by its row number, and one undo brings it back', () => {
    const pattern = hdcRectangle(3, 2);
    const history = record(createHistory(pattern), ok(deleteStitches(pattern, layerSelection(pattern, 2))));
    assert.deepEqual(counts(history.present), [0, 3]);
    assert.deepEqual(structural(history.present), []);
    assert.deepEqual(undo(history).present, pattern);
  });

  test('selecting one stitch of a shell deletes the whole shell and everything worked into it', () => {
    const pattern = shellRows();
    const shell = pattern.pieces[0].groups[0];
    const plan = deletionPlan(pattern, [shell.members[0]]);
    assert.deepEqual(plan.selected, shell.members);
    const deleted = ok(deleteStitches(pattern, plan.selected, { withDependents: true }));
    assert.equal(deleted.pieces[0].groups.length, pattern.pieces[0].groups.length - 1 - plan.dependents.filter((id) => pattern.pieces[0].groups.some((g) => g.members[0] === id)).length);
    assert.deepEqual(structural(deleted), []);
  });

  test('an empty selection deletes nothing', () => {
    assert.equal(deleteStitches(hdcRectangle(2, 1), []).ok, false);
  });
});

describe('copying, pasting and duplicating', () => {
  test('copying a whole row and pasting it as the next row gives a graph that validates clean', () => {
    const pattern = hdcRectangle(10, 2);
    const fragment = copied(copySelection(pattern, layerSelection(pattern, 2)));
    assert.equal(fragment.startsLayer, true);
    // The turning chain takes up no position (PQW-924): a 10-stitch row rests on 10 targets.
    assert.equal(fragment.span, 10);
    const pasted = ok(pasteFragment(pattern, fragment));
    assert.deepEqual(counts(pasted), [0, 10, 10, 10]);
    assert.deepEqual(findings(pasted), []);
  });

  test('the row worked off the foundation chain also pastes as the next row', () => {
    const pattern = hdcRectangle(10, 2);
    const pasted = ok(pasteFragment(pattern, copied(copySelection(pattern, layerSelection(pattern, 1)))));
    assert.deepEqual(counts(pasted), [0, 10, 10, 10]);
    assert.deepEqual(findings(pasted), []);
  });

  test('it reuses the turning chain already there instead of working a second one', () => {
    const pattern = ok(endRow(hdcRectangle(6, 2)));
    const pasted = ok(pasteFragment(pattern, copied(copySelection(pattern, layerSelection(pattern, 2)))));
    // The copied row brings its turning chain along (PQW-944): 2 chains and 6 hdc.
    assert.equal(nodes(pasted).length, nodes(pattern).length + 8, 'a turning chain and 6 new hdc');
    assert.deepEqual(counts(pasted), [0, 6, 6, 6]);
    assert.deepEqual(findings(pasted), []);
  });

  test('duplicating repeats row 3 in a single step, and again right after', () => {
    let pattern = hdcRectangle(5, 2);
    const row2 = layerSelection(pattern, 2);
    pattern = ok(duplicateSelection(pattern, row2));
    pattern = ok(duplicateSelection(pattern, row2));
    assert.deepEqual(counts(pattern), [0, 5, 5, 5, 5]);
    assert.deepEqual(findings(pattern), []);
  });

  test('once two rows of the shell pattern are drawn, copying carries it on and it still validates clean', () => {
    let pattern = shellRows();
    const rows = [...layerSelection(pattern, 1), ...layerSelection(pattern, 2)];
    pattern = ok(duplicateSelection(pattern, rows));
    assert.deepEqual(counts(pattern), [0, 13, 13, 13, 13]);
    assert.deepEqual(findings(pattern), []);
    // Row 3 is built like row 1: sc, shell, sc, shell, sc.
    assert.deepEqual(
      pattern.pieces[0].groups.map((group) => group.def),
      ['shell-5dc', 'shell-5dc', 'inc-3dc', 'shell-5dc', 'inc-3dc', 'shell-5dc', 'shell-5dc', 'inc-3dc', 'shell-5dc', 'inc-3dc'],
    );
  });

  test('in the middle of a row it re-anchors from the cursor, keeping the skipped targets', () => {
    let pattern = shellFoundation();
    pattern = stitch(pattern, 'sc');
    pattern = stitch(pattern, 'shell-5dc', 4);
    pattern = stitch(pattern, 'sc', 7);
    const repeat = body(pattern, 1).slice(1); // shell and sc: 3 targets apart
    const fragment = copied(copySelection(pattern, repeat));
    assert.equal(fragment.startsLayer, false);

    const pasted = ok(pasteFragment(pattern, fragment, 10));
    // The same as carrying on by hand (the shell and the sc differ in height: that is a warning, not a fault).
    const byHand = stitch(stitch(pattern, 'shell-5dc', 10), 'sc', 13);
    assert.deepEqual(counts(pasted), [0, 13]);
    assert.deepEqual(pasted, byHand);
  });

  test('too few targets fails with a reason the reader can act on, and the pattern is unchanged', () => {
    let partial = shellFoundation();
    partial = stitch(partial, 'sc');
    partial = stitch(partial, 'shell-5dc', 4);
    partial = stitch(partial, 'sc', 7);
    const before = structuredClone(partial);
    const tooFar = pasteFragment(partial, copied(copySelection(partial, body(partial, 1).slice(1))), 12);
    assert.equal(tooFar.ok, false);
    assert.equal(tooFar.reason.code, 'paste-not-enough-slots');
    assert.match(huText(tooFar.reason), /^Nincs elég célpont: .* A minta nem változott\.$/);
    assert.deepEqual(partial, before);

    const wide = hdcRectangle(10, 2);
    const narrow = hdcRectangle(8, 2);
    const narrowBefore = structuredClone(narrow);
    const row = pasteFragment(narrow, copied(copySelection(wide, layerSelection(wide, 2))));
    assert.equal(row.ok, false);
    assert.equal(row.reason.code, 'paste-span-mismatch');
    assert.match(huText(row.reason), /11 szemre épül, alatta most 9 van: a szemszám nem jön ki/);
    assert.deepEqual(narrow, narrowBefore);
  });

  test('it refuses to paste onto a used target, against the direction of travel, or onto a target of a different kind', () => {
    let pattern = ok(endRow(hdcRectangle(6, 1)));
    // The first stitch is the turning chain (PQW-944), then two hdc into targets 1 and 3.
    pattern = stitch(pattern, 'hdc');
    pattern = stitch(pattern, 'hdc', 1);
    pattern = stitch(pattern, 'hdc', 3);
    const fragment = copied(copySelection(pattern, body(pattern, 2).slice(0, 1)));
    const used = pasteFragment(pattern, fragment, 1);
    assert.equal(used.reason.code, 'paste-slot-used');
    assert.match(huText(used.reason), /célpontba már horgoltál/);
    const backwards = pasteFragment(pattern, fragment, 2);
    assert.equal(backwards.reason.code, 'paste-against-direction');
    assert.match(huText(backwards.reason), /haladási irány ellen/);
    assert.equal(pasteFragment(pattern, fragment, 4).ok, true);

    const ring = stitch(chains(ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0)), 1), 'sc', 0);
    const intoRing = copied(copySelection(ring, [nodes(ring).at(-1).id]));
    const wrongKind = pasteFragment(ok(endRow(hdcRectangle(3, 1))), intoRing);
    assert.equal(wrongKind.reason.code, 'paste-slot-kind');
    assert.match(huText(wrongKind.reason), /célpont szem, a másolt szem viszont varázskörbe horgolt/);
  });

  test('a second row that works into stitches outside the selection cannot be copied', () => {
    const pattern = hdcRectangle(3, 3);
    const result = copySelection(pattern, [body(pattern, 2)[0], ...layerSelection(pattern, 3)]);
    assert.equal(result.ok, false);
    assert.equal(result.reason.code, 'copy-layer-outside');
    assert.match(huText(result.reason), /4\. sor olyan szemekbe is horgol, amelyek nincsenek kijelölve/);
  });

  test('a foundation chain only pastes into an empty pattern', () => {
    const pattern = hdcRectangle(3, 1);
    const fragment = copied(copySelection(pattern, layerSelection(pattern, 0)));
    const refused = pasteFragment(pattern, fragment);
    assert.equal(refused.reason.code, 'foundation-needs-empty');
    assert.match(huText(refused.reason), /csak üres mintába/);
    assert.deepEqual(counts(ok(pasteFragment(emptyPattern(), fragment))), [0]);
  });

  test('a paste is undone in one step, and the clipboard fragment is plain JSON', () => {
    const pattern = hdcRectangle(4, 2);
    const fragment = copied(copySelection(pattern, layerSelection(pattern, 2)));
    assert.deepEqual(JSON.parse(JSON.stringify(fragment)), fragment);
    const history = record(createHistory(pattern), ok(pasteFragment(pattern, fragment)));
    assert.deepEqual(undo(history).present, pattern);
  });
});

/*
 * Bridging markers left orphaned by a deletion (PQW-938).
 *
 * The marker points at the STITCH below it, which deleting the chain does not
 * touch, so it stayed behind with no owner. This is what the owner saw: she
 * placed a single chain and it landed on the far side of the row.
 */
describe('deletion drops the bridging markers it orphans (PQW-938)', () => {
  const build = () => {
    let pattern = ok(work(emptyPattern(), { def: 'ch', count: 40 }, 0));
    pattern = ok(endRow(pattern));
    for (const def of ['sc', 'sc', 'dc']) {
      pattern = ok(work(pattern, { def, count: 1 }, defaultCursor(pattern, contextOf(pattern), def)));
    }
    return pattern;
  };

  test('deleting the selected chains takes their markers with them', () => {
    const base = build();
    const cursor = defaultCursor(base, contextOf(base), 'ch') + 1;
    const withChains = ok(work(base, { def: 'ch', count: 5 }, cursor));
    assert.equal(withChains.pieces[0].skipped.length, 5, 'five positions bridged');

    const ids = withChains.pieces[0].stitches.filter((node) => node.def === 'ch').slice(-5).map((node) => node.id);
    const deleted = ok(deleteStitches(withChains, ids));
    assert.deepEqual(deleted.pieces[0].skipped, [], 'the markers went with the chains');
  });

  test('the chains that remain keep their markers', () => {
    const base = build();
    const cursor = defaultCursor(base, contextOf(base), 'ch') + 1;
    const withChains = ok(work(base, { def: 'ch', count: 5 }, cursor));

    const ids = withChains.pieces[0].stitches.filter((node) => node.def === 'ch').slice(-2).map((node) => node.id);
    const deleted = ok(deleteStitches(withChains, ids));
    assert.equal(deleted.pieces[0].skipped.length, 3, 'the three remaining chains keep theirs');
  });
});
