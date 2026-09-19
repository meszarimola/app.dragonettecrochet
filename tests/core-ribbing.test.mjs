/*
 * Ribbed edging and rim worked with post stitches (PQW-909; 01 §2.2 [S25], §4.3, 03 §7.1):
 * the ribbing is built in the row builder with a per-stitch insertion mode, on
 * the edge of a flat piece and on the rim of a piece worked in the round,
 * written out as a repeat and readable back.
 */

import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';

import { emptyPattern } from '../src/core/editor.ts';
import { buildPieceGraph } from '../src/core/graph.ts';
import { readPattern } from '../src/core/pattern-read.ts';
import { formatWrittenPattern, writePattern } from '../src/core/pattern-text.ts';
import { appendRibbing, DEFAULT_RIBBING, MAX_RIBBING_ROWS, ribbingProblem } from '../src/core/ribbing.ts';
import { DEFAULT_MOTIF, generateMotif } from '../src/core/round-generator.ts';
import { DEFAULT_SHAPE, generateShape } from '../src/core/shapes.ts';
import { libraryFor } from '../src/core/stitch-variants.ts';
import { validatePattern } from '../src/core/validate.ts';
import { legendInsertions } from '../src/ui/chart-svg.ts';

const errors = (pattern) =>
  validatePattern(pattern, libraryFor(pattern))
    .filter((finding) => finding.severity === 'error')
    .map((finding) => finding.rule);

const text = (pattern) => formatWrittenPattern(writePattern(pattern, libraryFor(pattern), 'hu'));

/** Flat rectangle with a ribbed edging. */
function flat(options = DEFAULT_RIBBING) {
  const shape = generateShape(emptyPattern(), { ...DEFAULT_SHAPE, widthCm: 10, heightCm: 6, stitch: 'dc' });
  assert.ok(shape.ok, shape.reason);
  const piece = appendRibbing(shape.pattern, shape.pattern.pieces[0], libraryFor(shape.pattern), options);
  assert.equal(typeof piece, 'object', String(piece));
  return { ...shape.pattern, pieces: [piece] };
}

/** Piece worked in the round with a ribbed rim; the stitch count is matched to the repeat. */
function roundPiece(options = DEFAULT_RIBBING) {
  const motif = generateMotif(emptyPattern(), {
    ...DEFAULT_MOTIF,
    shape: 'circle',
    stitch: 'dc',
    rounds: 3,
    closing: 'join-slip',
  });
  assert.ok(motif.ok, motif.reason);
  const piece = appendRibbing(motif.pattern, motif.pattern.pieces[0], libraryFor(motif.pattern), options);
  return { pattern: motif.pattern, piece };
}

describe('ribbed edging on a flat piece', () => {
  test('the ribbing passes validation with no errors', () => {
    assert.deepEqual(errors(flat()), []);
  });

  test('the ribbing leaves the stitch count unchanged', () => {
    const pattern = flat();
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    const layers = graph.layers.filter((layer) => layer.index > 0);
    const last = layers[layers.length - 1];
    const before = layers[layers.length - 1 - DEFAULT_RIBBING.rows];
    assert.equal(last.stitchCount, before.stitchCount);
  });

  test('the turning chain of a post-stitch row does not count as a stitch and is one chain shorter', () => {
    const pattern = flat();
    const graph = buildPieceGraph(pattern, pattern.pieces[0], libraryFor(pattern));
    const ribbed = graph.layers[graph.layers.length - 1];
    assert.equal(ribbed.turningChainCounts, false);
    // For a double crochet, 2 chains instead of 3 (01 §2.2 [S25]).
    assert.equal(ribbed.turningChain.length, 2);
  });

  test('the ribbing is written as a repeat, not listed stitch by stitch', () => {
    const written = text(flat());
    assert.match(written, /\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/);
    assert.match(written, /Eerp – első relief egyráhajtásos pálca/);
    assert.match(written, /Herp – hátsó relief egyráhajtásos pálca/);
  });

  test('the written pattern reads back', () => {
    const pattern = flat();
    const written = text(pattern);
    const back = readPattern(written, { library: libraryFor(pattern), locale: 'hu', conventions: pattern.conventions });
    assert.ok(back.ok, back.ok ? '' : back.reason);
  });

  test('2×2 ribbing passes validation too', () => {
    assert.deepEqual(errors(flat({ rows: 2, width: 2 })), []);
  });
});

describe('ribbed rim in the round', () => {
  test('the ribbed rim passes validation with no errors', () => {
    const { pattern, piece } = roundPiece();
    assert.ok(!('code' in piece), JSON.stringify(piece));
    assert.deepEqual(errors({ ...pattern, pieces: [piece] }), []);
  });

  test('in the round a stitch count that does not divide into the repeat is refused with a precise reason', () => {
    const { piece } = roundPiece({ rows: 1, width: 5 });
    // The core returns a code and data; the sentence is written by the UI (PQW-904).
    assert.equal(piece.code, 'ribbing-round-multiple');
    assert.equal(piece.data.unit, 10);
    assert.equal(piece.data.nearest % 10, 0);
    assert.notEqual(piece.data.count % 10, 0);
  });
});

describe('ribbing refusals', () => {
  test('the row count and the rib width must be within range', () => {
    assert.equal(ribbingProblem({ rows: 0, width: 1 }).code, 'ribbing-rows-range');
    assert.deepEqual(ribbingProblem({ rows: MAX_RIBBING_ROWS + 1, width: 1 }), {
      code: 'ribbing-rows-range',
      data: { max: MAX_RIBBING_ROWS },
    });
    assert.equal(ribbingProblem({ rows: 2, width: 0 }).code, 'ribbing-width-range');
    assert.equal(ribbingProblem(DEFAULT_RIBBING), null);
  });

  test('ribbing cannot be worked onto a foundation chain', () => {
    const pattern = emptyPattern();
    const piece = { id: 'p1', name: 'Darab', stitches: [], spaces: [], rings: [], groups: [], events: [], skipped: [] };
    const result = appendRibbing(pattern, piece, libraryFor(pattern), DEFAULT_RIBBING);
    assert.equal(result.code, 'ribbing-needs-row');
  });
});

describe('post-stitch notation', () => {
  test('the chart legend marks the post stitches (with the PQW-869 notation)', () => {
    const pattern = flat();
    const marked = legendInsertions(pattern, libraryFor(pattern)).map(({ def, mode }) => `${def.id}/${mode}`);
    assert.ok(marked.includes('dc/front-post'), marked.join(', '));
    assert.ok(marked.includes('dc/back-post'), marked.join(', '));
  });

  test('the ribbing is written per standard in all three notations', () => {
    const pattern = flat();
    const library = libraryFor(pattern);
    const written = (locale) => formatWrittenPattern(writePattern(pattern, library, locale));
    assert.match(written('hu'), /Eerp/);
    assert.match(written('hu'), /Herp/);
    assert.match(written('en-US'), /FPdc/);
    assert.match(written('en-US'), /BPdc/);
    // In UK notation the one-yarn-over double crochet is "tr".
    assert.match(written('en-GB'), /FPtr/);
    assert.match(written('en-GB'), /BPtr/);
  });
});

describe('the Shape generator with a ribbed edging', () => {
  const shapeWith = (patch) =>
    generateShape(emptyPattern(), { ...DEFAULT_SHAPE, widthCm: 10, heightCm: 6, stitch: 'dc', ...patch });

  test('produces an error-free pattern with the ribbing written as a repeat', () => {
    const result = shapeWith({ ribbing: { rows: 2, width: 1 } });
    assert.ok(result.ok, result.reason);
    assert.deepEqual(errors(result.pattern), []);
    assert.match(text(result.pattern), /\[1 (Eerp|Herp), 1 (Eerp|Herp)\]/);
  });
});
