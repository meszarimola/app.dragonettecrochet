/*
 * Kijelölés, törlés, másolás, beillesztés és duplikálás a gráfon (PQW-875):
 * a törlés a belé horgolt szemekkel együtt vagy sehogy, a beillesztés
 * újraköt, és hibánál a minta nem változik.
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

function ok(result) {
  assert.ok(result.ok, result.reason);
  return result.pattern;
}

function copied(result) {
  assert.ok(result.ok, result.reason);
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
 * Félpálcás téglalap soronként `width` szemmel (PQW-891): `width` + 2 láncszem,
 * a fordulólánc számít első szemnek, így soronként `width` − 1 szemet horgolunk.
 */
function hdcRectangle(width, rows) {
  let pattern = chains(emptyPattern(), width + 2);
  for (let row = 1; row <= rows; row += 1) {
    if (row > 1) pattern = ok(endRow(pattern, 'hdc'));
    for (let i = 0; i < width - 1; i += 1) pattern = stitch(pattern, 'hdc');
  }
  return pattern;
}

/**
 * 14 láncszemes láncalap a kagylóminta forrásának szabályával (03 §4.2 E): a
 * rövidpálcás fordulólánc nem számít szemnek, az 1. sor első rövidpálcája a
 * 2. láncszembe megy (mint a `shellStitch` mintapéldában, PQW-891).
 */
function shellFoundation() {
  const pattern = chains(emptyPattern(), 14);
  return { ...pattern, conventions: { ...pattern.conventions, turningChainCounts: false } };
}

/** A 2. sor nyitó eseménye: a pálcás fordulólánc itt szemnek számít (soronkénti felülírás). */
function turnCounting(pattern) {
  const [piece] = pattern.pieces;
  const events = piece.events.map((event, i) => (i === piece.events.length - 1 ? { ...event, conventions: { turningChainCounts: true } } : event));
  return { ...pattern, pieces: [{ ...piece, events }, ...pattern.pieces.slice(1)] };
}

/** A kagylóminta két sora, ahogy a tulajdonos megrajzolja (03 §4.2 E). */
function shellRows() {
  let pattern = shellFoundation();
  pattern = stitch(pattern, 'sc');
  for (const at of [4, 10]) {
    pattern = stitch(pattern, 'shell-5dc', at);
    pattern = stitch(pattern, 'sc', at + 3);
  }
  pattern = turnCounting(ok(endRow(pattern, 'dc')));
  pattern = stitch(pattern, 'dc', 0);
  pattern = ok(workIntoSame(pattern, 'dc'));
  pattern = stitch(pattern, 'sc', 3);
  pattern = stitch(pattern, 'shell-5dc', 6);
  pattern = stitch(pattern, 'sc', 9);
  pattern = stitch(pattern, 'dc', 12);
  pattern = ok(workIntoSame(pattern, 'dc'));
  return ok(workIntoSame(pattern, 'dc'));
}

/** A réteg szemei a fordulólánc nélkül. */
function body(pattern, layer) {
  return layerSelection(pattern, layer).filter((id) => byId(pattern, id).def !== 'ch');
}

describe('kijelölés', () => {
  test('a kagyló egy szemére kattintva az egész kagyló kijelölődik, fonalsorrendben', () => {
    const pattern = shellRows();
    const shell = pattern.pieces[0].groups[0];
    assert.deepEqual(expandSelection(pattern, [shell.members[2]]), shell.members);
    assert.deepEqual(expandSelection(pattern, ['nincs-ilyen']), []);
  });

  test('Shift-kattintás: az egység hozzáadása, újra kattintva elvétele', () => {
    const pattern = shellRows();
    const [sc] = body(pattern, 1);
    const shell = pattern.pieces[0].groups[0];
    const both = toggleUnit(pattern, [sc], shell.members[0]);
    assert.deepEqual(both, [sc, ...shell.members]);
    assert.deepEqual(toggleUnit(pattern, both, shell.members[4]), [sc]);
  });

  test('a sorszámmal a teljes sor a fordulólánccal, Ctrl+A-val minden szem', () => {
    const pattern = hdcRectangle(3, 2);
    const row2 = layerSelection(pattern, 2);
    assert.equal(row2.length, 4, 'a 3 szemes sor: 2 láncszemes fordulólánc (az 1. szem) és 2 félpálca');
    assert.deepEqual(row2.slice(0, 2).map((id) => byId(pattern, id).def), ['ch', 'ch']);
    assert.equal(selectAll(pattern).length, nodes(pattern).length);
    assert.deepEqual(layerSelection(pattern, 9), []);
  });

  test('téglalappal: azok a szemek, amelyeknek a teteje benne van', () => {
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

  test('billentyűzettel: a sorban oldalra, a szomszéd sorba, a sor elejére és végére, és tartomány', () => {
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
    assert.equal(stepFocus(pattern, layout, chain, 'down'), chain, 'a láncalap alatt nincs sor: helyben marad');

    const row2 = layerSelection(pattern, 2);
    assert.equal(stepFocus(pattern, layout, last, 'first'), row2[0]);
    assert.equal(stepFocus(pattern, layout, row2[0], 'last'), last);
    assert.deepEqual(rangeSelection(pattern, last, row2[0]), row2);
  });
});

describe('törlés', () => {
  test('egy középső szem a belé horgolt szemekkel együtt törlődik, a gráf ép marad', () => {
    const pattern = hdcRectangle(5, 3);
    const middle = body(pattern, 1)[2];
    const plan = deletionPlan(pattern, [middle]);
    assert.deepEqual(plan.selected, [middle]);
    assert.equal(plan.dependents.length, 2);
    assert.equal(describeByLayer(pattern, plan.dependents), '2. sor: 1 szem, 3. sor: 1 szem');

    const deleted = ok(deleteStitches(pattern, [middle], { withDependents: true }));
    assert.equal(nodes(deleted).length, nodes(pattern).length - 3);
    assert.deepEqual(counts(deleted), [0, 4, 4, 4]);
    assert.deepEqual(structural(deleted), []);
    // Az ellenőrző újrafut: a kimaradt hely miatt a szomszédos szem átnyúlik egy szemen.
    assert.deepEqual(findings(deleted).map((finding) => finding.rule), ['reach-single']);
  });

  test('megszakítás: velük együtt törlés nélkül a minta nem változik, és a hiba megnevezi az érintetteket', () => {
    const pattern = hdcRectangle(5, 3);
    const before = structuredClone(pattern);
    const result = deleteStitches(pattern, [body(pattern, 1)[2]]);
    assert.equal(result.ok, false);
    assert.match(result.reason, /még 2 szem horgol \(2\. sor: 1 szem, 3\. sor: 1 szem\)/);
    assert.deepEqual(pattern, before);
  });

  test('ha semmi nem horgol bele, rögtön töröl; a sor vége az előző szemre kerül', () => {
    const pattern = ok(endRow(hdcRectangle(3, 2), null));
    const lastOfRow2 = body(pattern, 2).at(-1);
    assert.deepEqual(deletionPlan(pattern, [lastOfRow2]).dependents, []);
    const deleted = ok(deleteStitches(pattern, [lastOfRow2]));
    assert.deepEqual(deleted.pieces[0].events.map((event) => event.after), [body(pattern, 1).at(-1), body(pattern, 2).at(-2)]);
    assert.deepEqual(counts(deleted), [0, 3, 2]);
    assert.deepEqual(structural(deleted), []);
  });

  test('a teljes utolsó sor törlése a sorszámmal, és egy lépésben visszavonható', () => {
    const pattern = hdcRectangle(3, 2);
    const history = record(createHistory(pattern), ok(deleteStitches(pattern, layerSelection(pattern, 2))));
    assert.deepEqual(counts(history.present), [0, 3]);
    assert.deepEqual(structural(history.present), []);
    assert.deepEqual(undo(history).present, pattern);
  });

  test('a kagyló egy szemét kijelölve az egész kagyló és a belé horgolt szemek törlődnek', () => {
    const pattern = shellRows();
    const shell = pattern.pieces[0].groups[0];
    const plan = deletionPlan(pattern, [shell.members[0]]);
    assert.deepEqual(plan.selected, shell.members);
    const deleted = ok(deleteStitches(pattern, plan.selected, { withDependents: true }));
    assert.equal(deleted.pieces[0].groups.length, pattern.pieces[0].groups.length - 1 - plan.dependents.filter((id) => pattern.pieces[0].groups.some((g) => g.members[0] === id)).length);
    assert.deepEqual(structural(deleted), []);
  });

  test('üres kijelölésre nincs törlés', () => {
    assert.equal(deleteStitches(hdcRectangle(2, 1), []).ok, false);
  });
});

describe('másolás, beillesztés, duplikálás', () => {
  test('egy teljes sor másolása és beillesztése a következő sorként hibátlan gráfot ad', () => {
    const pattern = hdcRectangle(10, 2);
    const fragment = copied(copySelection(pattern, layerSelection(pattern, 2)));
    assert.equal(fragment.startsLayer, true);
    // A számító fordulólánc alatti szem kimarad: a 10 szemes sor 9 célpontra épül a kezdőhelytől.
    assert.equal(fragment.span, 9);
    const pasted = ok(pasteFragment(pattern, fragment));
    assert.deepEqual(counts(pasted), [0, 10, 10, 10]);
    assert.deepEqual(findings(pasted), []);
  });

  test('az 1. sor a láncalapról is a következő sorként illeszthető be', () => {
    const pattern = hdcRectangle(10, 2);
    const pasted = ok(pasteFragment(pattern, copied(copySelection(pattern, layerSelection(pattern, 1)))));
    assert.deepEqual(counts(pasted), [0, 10, 10, 10]);
    assert.deepEqual(findings(pasted), []);
  });

  test('a meglévő fordulóláncot felhasználja, nem horgol kétszer fordulóláncot', () => {
    const pattern = ok(endRow(hdcRectangle(6, 2), 'hdc'));
    const pasted = ok(pasteFragment(pattern, copied(copySelection(pattern, layerSelection(pattern, 2)))));
    assert.equal(nodes(pasted).length, nodes(pattern).length + 5, 'a fordulólánc az 1. szem: 5 új félpálca');
    assert.deepEqual(counts(pasted), [0, 6, 6, 6]);
    assert.deepEqual(findings(pasted), []);
  });

  test('duplikálás: „ismételd a 2. sort” egy lépésben, egymás után többször is', () => {
    let pattern = hdcRectangle(5, 2);
    const row2 = layerSelection(pattern, 2);
    pattern = ok(duplicateSelection(pattern, row2));
    pattern = ok(duplicateSelection(pattern, row2));
    assert.deepEqual(counts(pattern), [0, 5, 5, 5, 5]);
    assert.deepEqual(findings(pattern), []);
  });

  test('a kagylóminta két sor megrajzolása után másolással folytatható, hibátlanul', () => {
    let pattern = shellRows();
    const rows = [...layerSelection(pattern, 1), ...layerSelection(pattern, 2)];
    pattern = ok(duplicateSelection(pattern, rows));
    assert.deepEqual(counts(pattern), [0, 13, 13, 13, 13]);
    assert.deepEqual(findings(pattern), []);
    // A 3. sor ugyanúgy épül, mint az 1.: rövidpálca, kagyló, rövidpálca, kagyló, rövidpálca.
    assert.deepEqual(
      pattern.pieces[0].groups.map((group) => group.def),
      ['shell-5dc', 'shell-5dc', 'inc-2dc', 'shell-5dc', 'inc-3dc', 'shell-5dc', 'shell-5dc', 'inc-2dc', 'shell-5dc', 'inc-3dc'],
    );
  });

  test('sor közepén: a kurzortól köti újra, a kihagyott célpontokkal együtt', () => {
    let pattern = shellFoundation();
    pattern = stitch(pattern, 'sc');
    pattern = stitch(pattern, 'shell-5dc', 4);
    pattern = stitch(pattern, 'sc', 7);
    const repeat = body(pattern, 1).slice(1); // kagyló és rövidpálca: 3 célpont távolságra
    const fragment = copied(copySelection(pattern, repeat));
    assert.equal(fragment.startsLayer, false);

    const pasted = ok(pasteFragment(pattern, fragment, 10));
    // Ugyanaz, mintha kézzel horgoltuk volna tovább (a kagyló és a rövidpálca magassága eltér: az figyelmeztetés, nem hiba).
    const byHand = stitch(stitch(pattern, 'shell-5dc', 10), 'sc', 13);
    assert.deepEqual(counts(pasted), [0, 13]);
    assert.deepEqual(pasted, byHand);
  });

  test('kevés célpontra érthető hiba, és a minta nem változik', () => {
    let partial = shellFoundation();
    partial = stitch(partial, 'sc');
    partial = stitch(partial, 'shell-5dc', 4);
    partial = stitch(partial, 'sc', 7);
    const before = structuredClone(partial);
    const tooFar = pasteFragment(partial, copied(copySelection(partial, body(partial, 1).slice(1))), 12);
    assert.equal(tooFar.ok, false);
    assert.match(tooFar.reason, /^Nincs elég célpont: .* A minta nem változott\.$/);
    assert.deepEqual(partial, before);

    const wide = hdcRectangle(10, 2);
    const narrow = hdcRectangle(8, 2);
    const narrowBefore = structuredClone(narrow);
    const row = pasteFragment(narrow, copied(copySelection(wide, layerSelection(wide, 2))));
    assert.equal(row.ok, false);
    assert.match(row.reason, /10 szemre épül, alatta most 8 van: a szemszám nem jön ki/);
    assert.deepEqual(narrow, narrowBefore);
  });

  test('foglalt célpontra, a haladási irány ellen és más fajtájú célpontra nem illeszt be', () => {
    let pattern = ok(endRow(hdcRectangle(6, 1), 'hdc'));
    pattern = stitch(pattern, 'hdc', 0);
    pattern = stitch(pattern, 'hdc', 2);
    const fragment = copied(copySelection(pattern, body(pattern, 2).slice(0, 1)));
    assert.match(pasteFragment(pattern, fragment, 0).reason, /célpontba már horgoltál/);
    assert.match(pasteFragment(pattern, fragment, 1).reason, /haladási irány ellen/);
    assert.equal(pasteFragment(pattern, fragment, 3).ok, true);

    const ring = stitch(chains(ok(work(emptyPattern(), { def: 'magic-ring', count: 1 }, 0)), 1), 'sc', 0);
    const intoRing = copied(copySelection(ring, [nodes(ring).at(-1).id]));
    assert.match(pasteFragment(ok(endRow(hdcRectangle(3, 1), 'hdc')), intoRing).reason, /célpont szem, a másolt szem viszont varázskörbe horgolt/);
  });

  test('a nem kijelölt szemekbe horgoló második sor nem másolható', () => {
    const pattern = hdcRectangle(3, 3);
    const result = copySelection(pattern, [body(pattern, 2)[0], ...layerSelection(pattern, 3)]);
    assert.equal(result.ok, false);
    assert.match(result.reason, /3\. sor olyan szemekbe is horgol, amelyek nincsenek kijelölve/);
  });

  test('a láncalap csak üres mintába illeszthető', () => {
    const pattern = hdcRectangle(3, 1);
    const fragment = copied(copySelection(pattern, layerSelection(pattern, 0)));
    assert.match(pasteFragment(pattern, fragment).reason, /csak üres mintába/);
    assert.deepEqual(counts(ok(pasteFragment(emptyPattern(), fragment))), [0]);
  });

  test('a beillesztés egy lépésben visszavonható, és a vágólap sima JSON', () => {
    const pattern = hdcRectangle(4, 2);
    const fragment = copied(copySelection(pattern, layerSelection(pattern, 2)));
    assert.deepEqual(JSON.parse(JSON.stringify(fragment)), fragment);
    const history = record(createHistory(pattern), ok(pasteFragment(pattern, fragment)));
    assert.deepEqual(undo(history).present, pattern);
  });
});
