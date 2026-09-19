/*
 * Validation: the worked examples from the knowledge base are clean, and every
 * deliberately broken variant of them reports exactly the rule expected.
 */

import { strict as assert } from 'node:assert';
import { after, describe, test } from 'node:test';

import { addAmigurumiPart, createAmigurumi } from '../src/core/amigurumi-generator.ts';
import { generateColorwork } from '../src/core/colorwork.ts';
import { generateMosaic } from '../src/core/mosaic.ts';
import { emptyPattern } from '../src/core/editor.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { RULES } from '../src/core/rules.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { PieceBuilder, editNode, patternOf } from './fixtures/builder.ts';
import {
  WORKED_EXAMPLES,
  chevron,
  dcRectangle,
  grannySquare,
  hdcRectangle,
  shellStitch,
  vStitchPattern,
  wave,
} from './fixtures/examples.ts';
import { testLibrary } from './fixtures/library.ts';

const tested = new Set();

/** Asserts which rules the findings carry, and which stitches they touch when `nodes` is given. */
function assertOnly(pattern, rule, nodes, library = testLibrary) {
  const findings = validatePattern(pattern, library);
  assert.deepEqual([...new Set(findings.map((finding) => finding.rule))], [rule], JSON.stringify(findings, null, 1));
  if (nodes) assert.deepEqual(findings.map((finding) => finding.nodes), nodes);
  for (const finding of findings) {
    assert.equal(finding.severity, RULES[rule].severity);
    assert.equal(finding.reference, RULES[rule].reference);
  }
  tested.add(rule);
  return findings;
}

describe('the worked examples validate cleanly as graphs', () => {
  for (const [name, make] of Object.entries(WORKED_EXAMPLES)) {
    test(name, () => {
      assert.deepEqual(validatePattern(make().pattern, testLibrary), []);
    });
  }
});

/** The next row's targets in order: the stitch under the turning chain is left out, the last one is the top of the turning chain (PQW-891). */
// The turning chain is not a target (PQW-924): the next row works into every stitch of the previous row.
const targetsOf = (row) => [...row].reverse();

describe('half double crochet rectangle, broken (03 §3.1 A)', () => {
  test('wrong foundation chain: the first half double goes into the 4th chain instead of the 3rd', () => {
    // A half double skips 2 chains (PQW-924); starting at the 4th chain would leave 3 as the turning chain.
    const example = hdcRectangle({ firstStitchFromHook: 4 });
    assertOnly(example.pattern, 'foundation-chain', [[...example.turningChains[1], example.rows[1][0]]]);
  });

  test('row 5 turns with 1 chain instead of 2: a warning', () => {
    const example = hdcRectangle({ turningChain: { row: 5, chains: 1 } });
    assertOnly(example.pattern, 'turning-chain-height', [example.turningChains[5]]);
  });

  test('row 2 skips two stitches at the start: the turning chain covers only one of them (PQW-944)', () => {
    const example = hdcRectangle({ row2SkipsTwo: true });
    // The first skipped position belongs to the turning chain; the second one really did get no stitch.
    assertOnly(example.pattern, 'unused-position', [[example.rows[1].at(-1)]]);
  });

  test('row 2 skips the first stitch: the turning chain stands there, so it is not an error (PQW-944)', () => {
    const example = hdcRectangle({ row2SkipsFirst: true });
    /*
     * A turning chain that counts as a stitch sits in the place of the row's
     * first stitch, so the position below it gets no stitch — that is not a
     * skipped stitch.
     */
    assert.deepEqual(validatePattern(example.pattern, testLibrary), []);
  });

  test('a stitch is missing in the middle of row 2: a warning', () => {
    const example = hdcRectangle({ row2SkipsOneInMiddle: true });
    assertOnly(example.pattern, 'reach-single', [[example.rows[2][6], example.rows[2][7]]]);
  });

  test('two stitches in row 3 have their targets swapped, with no marking', () => {
    const { pattern, rows, turningChains } = hdcRectangle();
    const below = targetsOf(rows[2]);
    const swapped = editNode(editNode(pattern, rows[3][5], { anchors: [below[6]] }), rows[3][6], { anchors: [below[5]] });
    assertOnly(swapped, 'against-direction', [[rows[3][5], rows[3][6]]]);
  });

  test('the same thing marked as crossed stitches is clean (03 §10 C13)', () => {
    const { pattern, rows, turningChains } = hdcRectangle();
    const below = targetsOf(rows[2]);
    let crossed = editNode(editNode(pattern, rows[3][5], { anchors: [below[6]] }), rows[3][6], { anchors: [below[5]] });
    crossed = {
      ...crossed,
      pieces: crossed.pieces.map((piece) => ({
        ...piece,
        stitches: piece.stitches.map((node) => (node.id === rows[3][6] ? { ...node, flags: ['crossed'] } : node)),
      })),
    };
    assert.deepEqual(validatePattern(crossed, testLibrary), []);
  });

  test('the last stitch of row 2 goes into the bottom chain of the turning chain instead of its top', () => {
    const { pattern, rows, turningChains } = hdcRectangle();
    const broken = editNode(pattern, rows[2].at(-1), { anchors: [turningChains[1][0]] });
    assertOnly(broken, 'turning-chain-placement', [[rows[2].at(-1), turningChains[1][0]]]);
  });

  test('floating chain: two chain stitches at the end of the last row', () => {
    const example = hdcRectangle({ trailingChains: 2 });
    const stitches = example.pattern.pieces[0].stitches;
    assertOnly(example.pattern, 'floating-chain', [stitches.slice(-2).map((node) => node.id)]);
  });

  test('another row is worked after the crab stitch row', () => {
    const example = hdcRectangle({ crabRow: 21 });
    const findings = assertOnly(example.pattern, 'unworkable-top');
    // The top of the turning chain is no longer a target (PQW-924): every stitch of row 22 would go into a crab stitch.
    assert.deepEqual(
      findings.map((finding) => finding.nodes),
      example.rows[22].map((id) => [id]),
    );
  });
});

describe('double crochet rectangle, broken (03 §3.1 B)', () => {
  test('row 2 skips the first stitch of the previous row: the turning chain stands there (PQW-944)', () => {
    const example = dcRectangle({ row2SkipsFirst: true });
    assert.deepEqual(validatePattern(example.pattern, testLibrary), []);
  });

  test('a stitch in row 2 is worked into a stitch of row 3', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[2][3], { anchors: [rows[3][3]] }), 'future-anchor', [[rows[2][3]]]);
  });

  test('a stitch in row 3 reaches down into row 1 without being marked as a spike stitch', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[3][3], { anchors: [rows[1][3]] }), 'anchor-layer', [[rows[3][3]]]);
  });

  test('a stitch names a previous stitch that is not the one before it on the yarn path', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[2][5], { prev: rows[2][3] }), 'yarn-path', [[rows[2][5]]]);
  });

  test('working into a stitch that does not exist', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[2][5], { anchors: ['nincs-ilyen'] }), 'dangling-reference', [[rows[2][5]]]);
  });

  test('a stitch that is not in the library', () => {
    const { pattern, rows } = dcRectangle();
    assertOnly(editNode(pattern, rows[2][5], { def: 'hamispalca' }), 'unknown-stitch', [[rows[2][5]]]);
  });
});

describe('shell stitch 6+1, broken (03 §4.2 E)', () => {
  test('the first repeat skips 3 chains instead of 2', () => {
    assertOnly(shellStitch({ firstRepeatSkipsThree: true }).pattern, 'repeat-balance');
  });

  test('the first shell is marked as a V stitch', () => {
    const example = shellStitch({ firstShellDef: 'v-st-dc' });
    assertOnly(example.pattern, 'group-mismatch', [example.rows[1].slice(1, 6)]);
  });
});

describe('V stitch, broken (03 §4.2 F)', () => {
  test('the two doubles of the first V sit in one stitch with no group', () => {
    const example = vStitchPattern({ firstVUngrouped: true });
    assertOnly(example.pattern, 'unmarked-increase', [[example.rows[1][1], example.rows[1][3]]]);
  });
});

describe('chevron, broken (03 §4.2 G)', () => {
  test('the valley has 2 skipped stitches and a plain double instead of a decrease', () => {
    const { pattern, valley } = chevron();
    const broken = editNode(pattern, valley.node, { def: 'dc', anchors: [valley.targets[2]] });
    assertOnly(broken, 'reach', [[valley.before, valley.node]]);
  });

  test('the three targets of the valley sit on a plain double with no decrease marking', () => {
    const { pattern, valley } = chevron();
    assertOnly(editNode(pattern, valley.node, { def: 'dc' }), 'unmarked-decrease', [[valley.node]]);
  });

  test('the valley is a two-double decrease but has three targets', () => {
    const { pattern, valley } = chevron();
    assertOnly(editNode(pattern, valley.node, { def: 'dc2tog' }), 'anchor-count', [[valley.node]]);
  });
});

describe('wave: mixed stitch heights are not an error (PQW-924)', () => {
  test('row 3 is single crochet too: this is how the wave pattern is made, so no warning', () => {
    /*
     * The owner is the crochet expert: stitches of different heights in one
     * row are a deliberate design device, not a mistake. The program used to
     * raise a "mixed-heights" warning here and circled those stitches on the
     * chart as well (PQW-924).
     */
    const example = wave({ flatRow3: true });
    assert.deepEqual(validatePattern(example.pattern, testLibrary), []);
  });
});

describe('granny square, broken (03 §8)', () => {
  test('round 2 states a stitch count that leaves out the chain spaces (24 instead of 36, PQW-870)', () => {
    const example = grannySquare({ round2StatedCount: 24 });
    assertOnly(example.pattern, 'stated-count', [[example.rows[2].at(-1)]]);
  });

  test('the closing slip stitch of round 2 goes into the first double instead of the top of the starting chain', () => {
    const example = grannySquare({ round2JoinsFirstDc: true });
    assertOnly(example.pattern, 'round-join', [[example.rows[2].at(-1)]]);
  });
});

/* ---- Rounds (PQW-861) ---- */

/** Single crochet in the round from a magic ring, rounds closed: round 1 has 6 stitches, then each round works as given. */
function scRounds(...rounds) {
  const b = new PieceBuilder('p1', 'Kör');
  const ring = b.ring();
  b.chain(1);
  let below = Array.from({ length: 6 }, () => b.stitch('sc', { ring }));
  b.stitch('sl-st', below[0]);
  b.event('join-slip');
  for (const round of rounds) {
    b.chain(1);
    const next = round(b, below);
    b.stitch('sl-st', next[0]);
    b.event('join-slip');
    below = next;
  }
  return patternOf('Kör', [b.build()]);
}
const increaseEach = (b, below) => below.flatMap((target) => b.inSame('inc-2sc', ['sc', 'sc'], target));
const plainEach = (b, below) => below.map((target) => b.stitch('sc', target));
const byThree = (b, below) => Array.from({ length: below.length / 3 }, (_, i) => b.stitch('sc3tog', ...below.slice(3 * i, 3 * i + 3)));
const motif = (patch) => generateMotif(emptyPattern(), { ...DEFAULT_MOTIF, ...patch }).pattern;

describe('rounds, broken (04 §2, §3.2, §8, §9, PQW-861)', () => {
  test('the generated flat circle with staggered increases is clean', () => {
    assert.deepEqual(validatePattern(motif({ rounds: 8 }), testLibrary), []);
  });

  test('one round keeps less than half its stitches: 12 down to 4', () => {
    assertOnly(scRounds(increaseEach, byThree), 'round-growth');
  });

  test('two rounds with no increases: it cups', () => {
    assertOnly(scRounds(increaseEach, plainEach, plainEach), 'round-cupping');
  });

  test('a single round without increases is not cupping yet', () => {
    assert.deepEqual(validatePattern(scRounds(increaseEach, plainEach), testLibrary), []);
  });

  test('twice the flat rate of increases in one round: it ruffles', () => {
    assertOnly(scRounds(increaseEach, increaseEach), 'round-ruffling');
  });

  test('without staggering, the increases stack up in rounds 3-5; through round 4 nothing is reported', () => {
    assertOnly(motif({ rounds: 5, stagger: false }), 'stacked-increases');
    assert.deepEqual(validatePattern(motif({ rounds: 4, stagger: false }), testLibrary), []);
  });

  test('a color change in a spiral with no jog fix; with the fix nothing is reported', () => {
    assertOnly(motif({ rounds: 4, closing: 'spiral', colorEvery: 2 }), 'spiral-color-jog');
    assert.deepEqual(validatePattern(motif({ rounds: 4, closing: 'spiral', colorEvery: 2, jogFix: 'back-loop' }), testLibrary), []);
  });

  test('in a polygon the corners stack deliberately: nothing is reported', () => {
    for (const shape of ['square', 'hexagon', 'octagon', 'granny-square']) {
      const pattern = motif({ shape, rounds: 6 });
      assert.deepEqual(validatePattern(pattern, libraryFor(pattern)), [], shape);
    }
  });
});

/* ---- Amigurumi (PQW-863) ---- */

/** Head (a 6 cm sphere) and body (a 5 cm cylinder with an open top) sewn together with even distribution: 28 stitches onto 30. */
function headAndBody(under3 = false) {
  const head = createAmigurumi(emptyPattern(), { name: 'Fej', shape: { kind: 'sphere', diameterCm: 6, method: '6n' }, stagger: true, eyes: true }, under3);
  const body = { name: 'Test', shape: { kind: 'cylinder', diameterCm: 5, heightCm: 5, bottom: 'closed', top: 'open' }, stagger: true, eyes: false };
  return addAmigurumiPart(head.pattern, body, { method: 'sewn', distribute: true }, under3).pattern;
}

describe('amigurumi, broken (04 §5.4, §5.7, PQW-863)', () => {
  test('the generated head-and-body figure with distribution is clean, including for a child under 3', () => {
    assert.deepEqual(validatePattern(headAndBody(), testLibrary), []);
    assert.deepEqual(validatePattern(headAndBody(true), testLibrary), []);
  });

  test('the two sewn edges have different stitch counts and there is no distribution', () => {
    const pattern = headAndBody();
    const { distribution: _distribution, ...join } = pattern.joins[0];
    assertOnly({ ...pattern, joins: [join] }, 'join-count');
  });

  test('the seam points at a round that does not exist', () => {
    const pattern = headAndBody();
    assertOnly({ ...pattern, joins: [{ ...pattern.joins[0], b: { piece: 'p1', layer: 40 } }] }, 'join-edge');
  });

  test('safety eyes in a toy meant for a child under 3', () => {
    assertOnly({ ...headAndBody(), toy: { under3: true } }, 'toy-safety-eyes');
  });
});

describe('the stated stitch count follows the chain-counting convention (03 §10 B10, PQW-870)', () => {
  const withChainCounts = (example, chainCounts) => ({ ...example.pattern, conventions: { ...example.pattern.conventions, chainCounts } });

  test('when no chain counts, the stated count of both rows is wrong', () => {
    const example = vStitchPattern();
    assertOnly(withChainCounts(example, false), 'stated-count', [[example.rows[1].at(-1)], [example.rows[2].at(-1)]]);
  });

  test('when only worked-into chains count, the stated count of the last row is wrong because it includes its decorative arches', () => {
    const example = vStitchPattern();
    assertOnly(withChainCounts(example, 'worked-into'), 'stated-count', [[example.rows[2].at(-1)]]);
  });
});

describe('an insertion mode the stitch does not allow (01 §4.3, PQW-869)', () => {
  test('the finishing crab stitch row worked into the back loop', () => {
    const example = hdcRectangle({ rows: 3, crabRow: 3 });
    const id = example.rows[3][0];
    const node = example.pattern.pieces[0].stitches.find((candidate) => candidate.id === id);
    const pattern = editNode(example.pattern, id, { anchors: node.anchors.map((anchor) => ({ ...anchor, mode: 'back-loop' })) });
    assertOnly(pattern, 'insertion-mode', [[id]]);
  });
});

describe('grid-based techniques (PQW-864)', () => {
  test('4 colors in one tapestry row: a warning about the carried colors (03 §10 G36)', () => {
    const colors = ['Fehér', 'Piros', 'Kék', 'Zöld'].map((name) => ({ name, hex: '#000000' }));
    const cells = [
      [0, 1, 2, 3],
      [0, 0, 1, 1],
    ];
    const result = generateColorwork(emptyPattern(), { technique: 'tapestry', cells, colors, unit: null, lettering: false });
    assert.ok(result.ok, result.reason);
    assertOnly(result.pattern, 'carried-colors');
  });

  /** Mosaic: a spike stitch in rows 3, 4 and 5 (PQW-894). */
  const mosaic = () => {
    const cells = [
      [0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 0, 1, 1, 1],
      [0, 1, 0, 0, 0, 1, 0],
      [1, 1, 1, 0, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1],
    ];
    const colors = [
      { name: 'Fehér', hex: '#ffffff' },
      { name: 'Kék', hex: '#0000ff' },
    ];
    const result = generateMosaic(emptyPattern(), { cells, colors, variant: 1, unit: null, lettering: false });
    assert.ok(result.ok, result.reason);
    const graph = buildPieceGraph(result.pattern, result.pattern.pieces[0], testLibrary);
    const drop = result.pattern.pieces[0].stitches.find((node) => node.flags?.includes('spike') && graph.layerOf.get(node.id) === 5);
    return { pattern: result.pattern, graph, drop };
  };

  test('mosaic: a spike stitch reaching 4 rows down is too deep (03 §5.6, §10 C17)', () => {
    const { pattern, graph, drop } = mosaic();
    assert.deepEqual(validatePattern(pattern, testLibrary), []);
    const deep = graph.layers[1].stitches.find((id) => graph.defs.get(id).kind !== 'chain');
    assertOnly(editNode(pattern, drop.id, { anchors: [deep] }), 'spike-depth', [[drop.id]]);
  });

  test('mosaic: a spike stitch left unmarked, or aimed at an already worked stitch, is an error (03 §10 C17)', () => {
    const { pattern, graph, drop } = mosaic();
    const unflagged = {
      ...pattern,
      pieces: [{ ...pattern.pieces[0], stitches: pattern.pieces[0].stitches.map((node) => (node.id === drop.id ? { ...node, flags: undefined } : node)) }],
    };
    assert.ok(validatePattern(unflagged, testLibrary).some((finding) => finding.rule === 'anchor-layer' && finding.nodes.includes(drop.id)));
    // Row 4 already worked into this stitch of row 3: a spike stitch cannot go there.
    const worked = graph.layers[4].stitches
      .map((id) => graph.nodes.get(id))
      .find((node) => !node.flags && node.anchors.length === 1 && graph.layerOf.get(node.anchors[0].id) === 3);
    const reused = editNode(pattern, drop.id, { anchors: [worked.anchors[0].id] });
    assert.ok(validatePattern(reused, testLibrary).some((finding) => finding.rule === 'anchor-layer' && finding.nodes.includes(drop.id)));
  });
});

describe('two shoulders within one piece, after fastening off (PQW-901)', () => {
  /** A four-stitch row 1, the left shoulder above it, then the right shoulder above row 1 with a new yarn. */
  const shoulders = (resume = { layer: 1, name: 'Jobb váll' }) => {
    const builder = new PieceBuilder('p1', 'Elejerész');
    const chains = builder.chain(5);
    const row1 = [...chains.slice(0, 4)].reverse().map((chain) => builder.stitch('sc', chain));
    builder.event('turn');
    builder.chain(1);
    for (const target of [row1[3], row1[2]]) builder.stitch('sc', target);
    builder.event('fasten-off');
    builder.chain(1);
    for (const target of [row1[1], row1[0]]) builder.stitch('sc', target);
    builder.event('fasten-off');
    const piece = builder.build();
    const events = piece.events.map((event, i) => (i === 1 ? { ...event, resume } : event));
    return patternOf('Két váll', [{ ...piece, events }], { turningChainCounts: false });
  };

  test('both shoulders are clean: the other shoulder works the rest of the row', () => {
    assert.deepEqual(validatePattern(shoulders(), testLibrary), []);
  });

  test('both shoulders get the same row number because both sit above row 1', () => {
    const pattern = shoulders();
    const graph = buildPieceGraph(pattern, pattern.pieces[0], testLibrary);
    assert.deepEqual(
      graph.layers.map((layer) => [layer.index, layer.below, layer.row]),
      [
        [0, 0, 0],
        [1, 0, 1],
        [2, 1, 2],
        [3, 1, 2],
      ],
    );
  });

  test('resuming above a row that does not exist: an error', () => {
    assertOnly(shoulders({ layer: 9, name: 'Jobb váll' }), 'resume-layer', undefined, testLibrary);
  });
});

test('every rule has a knowledge-base reference', () => {
  for (const [rule, def] of Object.entries(RULES)) {
    assert.match(def.reference, /^0[1-6] §\d/, `${rule}: missing or malformed reference`);
    assert.ok(def.summary.trim(), `${rule}: missing summary`);
  }
});

/*
 * The owner's decision from the first round of UAT (PQW-930): "you took the
 * making of patterns far too strictly. in real life this works much more
 * loosely... there is a long 'tail' left over from the foundation chain. you
 * flagged it as an error. don't - make it only a warning."
 *
 * A skipped position at either end of a row can be deliberate, so we report it
 * without calling it an error. A stitch missing in the MIDDLE of a row is a
 * separate rule (`reach`, `reach-single`) and stays an error: there the hole
 * is not a matter of style.
 */
test('an unworked tail at the end of a row is a warning, not an error (PQW-930)', () => {
  assert.equal(RULES['unused-position'].severity, 'warning');
  assert.equal(RULES['floating-chain'].severity, 'warning');
});

test('every rule has a user-facing message using the word „szem”, with no internal concept and no knowledge-base code (PQW-879)', () => {
  for (const [rule, def] of Object.entries(RULES)) {
    assert.ok(def.message.trim(), `${rule}: missing user-facing message`);
    // The body text carries no 'réteg', no 'darab' and no knowledge-base code (a § or a 0X marker).
    assert.doesNotMatch(def.message, /réteg|darab|§|\b0[1-6] /i, `${rule}: the message carries an internal concept or a knowledge-base code`);
  }
});

after(() => {
  // Every rule has at least one broken example.
  assert.deepEqual([...tested].sort(), Object.keys(RULES).sort());
});
